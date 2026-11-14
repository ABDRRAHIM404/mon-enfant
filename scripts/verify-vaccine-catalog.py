#!/usr/bin/env python3
"""Hosted synthetic catalog forms/review/conflicts. No browser, build or email.
Only QA clones are edited/approved/retired; the initial source remains a draft.
"""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid
from operator_http import Browser, Forms

ROOT = Path(__file__).resolve().parent.parent
PROJECT = 'zkkasbxvdvecnafgjpxd'
assert (ROOT/'supabase/.temp/project-ref').read_text().strip() == PROJECT
cfg = dict(line.split('=',1) for line in (ROOT/'.env.local').read_text().splitlines() if line and not line.startswith('#'))
env = {**os.environ, **cfg}
BASE = cfg['NEXT_PUBLIC_SUPABASE_URL']
PUBLIC = cfg['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
assert BASE == f'https://{PROJECT}.supabase.co'
r = subprocess.run(['supabase','projects','api-keys','--project-ref',PROJECT,'--reveal','--output-format','json'],env=env,capture_output=True,text=True,check=True,cwd=ROOT)
d = json.loads(r.stdout)
keys = d if isinstance(d,list) else d.get('api_keys',d.get('keys',[]))
SERVICE = next(k['api_key'] for k in keys if k['name']=='service_role')
fixtures = []
sessions = []
versions = []
checks = []
run = uuid.uuid4().hex[:10]
basis = {'reason':'Décision de test fictive sans valeur clinique.', 'evidence_reference':'Source fictive pour la vérification technique uniquement.'}

def check(value, label):
    if not value:
        raise AssertionError(label)
    checks.append(label)
    print('PASS '+label,flush=True)

def api(path,data=None,token=None,admin=False,method=None):
    headers = {'apikey':SERVICE if admin else PUBLIC,'Content-Type':'application/json'}
    if token or admin:
        headers['Authorization'] = 'Bearer '+(SERVICE if admin else token)
    req = urllib.request.Request(BASE+path,data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=40) as response:
            return response.status,json.loads(response.read() or 'null')
    except urllib.error.HTTPError as error:
        # Never print raw provider messages or Auth responses.
        try:
            body = json.loads(error.read() or 'null')
        except ValueError:
            body = None
        return error.code,body

def sql(text):
    with tempfile.NamedTemporaryFile(mode='w',suffix='.sql') as f:
        f.write(text)
        f.flush()
        r = subprocess.run(['supabase','db','query','--linked','--file',f.name,'--output-format','json'],env=env,capture_output=True,text=True,cwd=ROOT)
    if r.returncode:
        raise AssertionError('Trusted synthetic catalog fixture operation failed')
    return json.loads(r.stdout).get('rows',[])

def create(kind,role='doctor',manage=False,review=False,capable=False):
    email = f'qa-vaccine-{run}-{kind}@example.invalid'
    password = secrets.token_urlsafe(30)
    status,user = api('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'synthetic_fixture':True,'fixture_run':run}},admin=True)
    assert status in (200,201)
    uid = user['id']
    fixtures.append(uid)
    web = Browser()
    _,page,_ = web.login(email,password)
    web.submit('/account',page,{},lambda f:'Activer mon espace soignant' in f['text'])
    platform = f'QAV-{run}-{kind}'
    sql(f"update public.professional_profiles set role='{role}',verification_status='approved',professional_id='{platform}' where user_id='{uid}'; insert into private.staff_permissions(user_id,can_manage_vaccine_catalog,can_review_vaccine_catalog) values('{uid}',{str(manage).lower()},{str(review).lower()});")
    if capable:
        sql(f"insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values('{uid}','vaccination',true,'{uid}')")
    status,session = api('/auth/v1/token?grant_type=password',{'email':email,'password':password})
    assert status == 200
    sessions.append(session)
    return {'id':uid,'web':web,'token':session['access_token']}

def rpc(actor,name,data=None):
    return api('/rest/v1/rpc/'+name,data or {},actor['token'])

def change(actor,action,version,revision,extra=None,operation=None):
    return rpc(actor,'change_vaccine_catalog',{'p_operation_id':operation or str(uuid.uuid4()),'p_action':action,'p_version_id':version,'p_expected_revision':revision,'p_input':{**basis,**(extra or {})}})

def detail(actor,version):
    status,result = rpc(actor,'vaccine_catalog',{'p_version_id':version})
    assert status == 200
    return result

def submit(actor,path,page,mode,fields):
    return actor['web'].submit(path,page,fields,lambda f:f['fields'].get('action')==mode)

try:
    editor = create('editor','admin',manage=True)
    reviewer = create('reviewer',review=True,capable=True)
    doctor = create('reader')
    admin = create('general-admin','admin')
    status,listing = rpc(doctor,'vaccine_catalog')
    assert status == 200
    seed = next(v for v in listing['versions'] if not v['parent_id'])
    original = detail(doctor,seed['id'])['version']
    check(original['status']=='draft' and not original['review_verified'] and len(original['rules'])==25,'Hosted initial 25-dose transcription remains an unapproved draft')
    source_bytes = (ROOT/'data-for-supa/MON_ENFANT_PNI_DATA.json').read_bytes()
    check(original['source_sha256']==hashlib.sha256(source_bytes).hexdigest() and original['source_document']==json.loads(source_bytes),'Hosted source snapshot and exact original-file hash match')
    for actor in (doctor,admin):
        status,_ = change(actor,'clone',seed['id'],seed['revision'],{'label':'Unauthorized QA clone'})
        check(status in (401,403),'General doctor/admin approval does not confer catalog editing')
    for table in ('vaccine_versions','vaccine_rules','vaccine_catalog_changes'):
        status,_ = api('/rest/v1/'+table+'?select=*',token=editor['token'])
        check(status in (401,403),'Direct '+table+' reads are denied even to catalog staff')
    path='/vaccines/'+seed['id']
    _,page,_ = editor['web'].get(path)
    form = next(f for f in Forms(page).forms if f['fields'].get('action')=='clone')
    operation = form['fields']['operationId']
    label = 'QA fictif '+run
    url,page,_ = submit(editor,path,page,'clone',{**basis,'label':label})
    version = url.rsplit('/',1)[-1]
    uuid.UUID(version)
    versions.append(version)
    check(label in page and 'Brouillon' in page,'Hosted clone form creates a distinct draft version')
    status,same = change(editor,'clone',seed['id'],seed['revision'],{'label':label},operation)
    check(status==200 and same==version,'Retry of the real clone form creates no duplicate version')
    path='/vaccines/'+version+'?dose=VPO1'
    _,page,_ = editor['web'].get(path)
    _,stale_page,_ = editor['web'].get(path)
    fields={**basis,'unit':'weeks','age_value':'9','eligibility':'all','automatic_scheduling':'on'}
    _,page,_ = submit(editor,path,page,'edit',fields)
    current = detail(doctor,version)
    rule = next(r for r in current['version']['rules'] if r['dose_code']=='VPO1')
    check(current['version']['revision']==2 and rule['source_age']=={'unit':'weeks','value':8} and rule['age']=={'unit':'weeks','value':9},'Hosted rule form changes configured age while preserving source age')
    _,stale_result,_ = submit(editor,path,stale_page,'edit',{**fields,'age_value':'10'})
    check('Cette version a changé' in stale_result,'Hosted stale catalog form asks for a reload instead of overwriting')
    status,result = change(editor,'edit',version,1,{'dose_code':'VPO1','age':{'unit':'weeks','value':10},'eligibility':'all','automatic_scheduling':True})
    check(status==409 and result.get('code')=='PT409','Actual provider returns HTTP 409 for deterministic catalog conflicts')
    for code,age,eligibility in [('HB1',{'unit':'first_4_weeks'},'all'),('HPV',{'unit':'years','value':11},'all'),('Rota1',{'unit':'weeks','value':8},'all')]:
        status,_=change(editor,'edit',version,2,{'dose_code':code,'age':age,'eligibility':eligibility,'automatic_scheduling':True})
        check(status==400,'Hosted source invariant rejects invalid '+code+' scheduling')
    status,_=change(reviewer,'approve',version,2,{'source_authenticated':True,'clinical_reviewed':True,'birth_window_reviewed':False})
    check(status==400,'Qualified flag alone cannot bypass required source/window review attestations')
    path='/vaccines/'+version
    _,page,_=reviewer['web'].get(path)
    _,page,_=submit(reviewer,path,page,'approve',{**basis,'source_authenticated':'on','clinical_reviewed':'on','birth_window_reviewed':'on'})
    current=detail(doctor,version)
    check(current['version']['status']=='approved' and current['version']['reviewed_by']==reviewer['id'] and current['history'][-1]['action']=='approve','Independent synthetic reviewer can approve the QA clone through the actual form')
    check(original['status']=='draft' and detail(doctor,seed['id'])['version']['status']=='draft','Synthetic review does not activate the initial source version')
    status,_=change(editor,'edit',version,3,{'dose_code':'VPO1','age':{'unit':'weeks','value':8},'eligibility':'all','automatic_scheduling':True})
    check(status in (401,403),'Approved rule content cannot be edited')
    _,page,_=editor['web'].get(path)
    _,page,_=submit(editor,path,page,'retire',basis)
    current=detail(doctor,version)
    check(current['version']['status']=='retired' and len(current['history'])==4 and current['version']['review_verified'],'Retirement preserves source rules and the entire clone/edit/review history')
    status,race_version=change(editor,'clone',seed['id'],seed['revision'],{'label':'QA race '+run})
    assert status==200
    versions.append(race_version)
    payload={'dose_code':'VPO1','age':{'unit':'weeks','value':9},'eligibility':'all','automatic_scheduling':True}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:change(editor,'edit',race_version,1,payload),range(2)))
    check(sorted(status for status,_ in results)==[200,409],'Concurrent catalog edits commit one winner and one HTTP 409')
    status,_=change(editor,'retire',race_version,2)
    assert status==200
    sql(f"update private.staff_permissions set can_manage_vaccine_catalog=false where user_id='{editor['id']}'")
    status,_=change(editor,'clone',seed['id'],seed['revision'],{'label':'QA revoked '+run})
    check(status in (401,403),'Revoked catalog appointment cuts writes with the issued JWT')
    status,_=api('/auth/v1/logout?scope=global',{},doctor['token'])
    assert status in (200,204)
    status,_=rpc(doctor,'vaccine_catalog')
    check(status in (401,403),'Global logout denies catalog reads with the previously issued token')
finally:
    # Retire only this run's QA versions; never touch the source seed or other work.
    for version in versions:
        sql(f"with retired as (update public.vaccine_versions set status='retired',revision=revision+1 where id='{version}' and status<>'retired' returning id) insert into public.audit_events(actor_id,entity_id,entity_type,action) select null,id,'vaccine_fixture_cleanup','updated' from retired")
    if fixtures:
        ids=','.join("'"+v+"'" for v in fixtures)
        sql(f"begin; update public.professional_capabilities set enabled=false where professional_id in({ids}); update private.staff_permissions set can_manage_vaccine_catalog=false,can_review_vaccine_catalog=false where user_id in({ids}); update public.professional_profiles set verification_status='suspended' where user_id in({ids}); commit;")
    for session in sessions:
        api('/auth/v1/logout?scope=global',{},session['access_token'])
print(json.dumps({'run':run,'checks':checks,'fixtures_retired':len(fixtures),'qa_versions_retired':len(versions),'outgoing_email_sent':False,'clinical_approval_claimed':False}))
