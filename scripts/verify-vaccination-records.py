#!/usr/bin/env python3
"""Hosted synthetic vaccination records, matching and reference decisions. No browser, build or email.
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

ROOT = Path(os.environ.get('MON_ENFANT_OPERATOR_ROOT', Path(__file__).resolve().parent.parent))
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
    web.submit('/account',page,{},lambda f:'Activer mon espace professionnel' in f['text'])
    platform = f'QAV-{run}-{kind}'
    sql(f"update public.professional_profiles set role='{role}',verification_status='approved',professional_id='{platform}' where user_id='{uid}'; insert into private.staff_permissions(user_id,can_manage_vaccine_catalog,can_review_vaccine_catalog) values('{uid}',{str(manage).lower()},{str(review).lower()});")
    if capable:
        sql(f"insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values('{uid}','vaccination',true,'{uid}')")
    status,session = api('/auth/v1/token?grant_type=password',{'email':email,'password':password})
    assert status == 200
    sessions.append(session)
    return {'id':uid,'web':web,'token':session['access_token'],'platform':platform}

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

def payload(item='',code='VPO'):
    return {'vaccine_code':code,'vaccine_label':'Vaccin fictif '+code,'dose_label':'','lot_status':'unknown','lot_number':'','site_status':'unknown','site':'','provider_status':'unknown','administered_by':'','administration_facility_status':'unknown','administration_facility':'','matching_status':'clinician_validated' if item else 'unmatched','schedule_item_id':item,'duplicate_override_reason':'','notes':'Saisie fictive de vérification.'}

def entry(child,facility,p=None):
    return {'p_operation_id':str(uuid.uuid4()),'p_child_id':child,'p_kind':'vaccination','p_facility_id':facility,'p_occurred_on':'2026-01-02','p_occurrence_precision':'exact','p_source_type':'observed','p_source_reference':None,'p_source_verified':True,'p_payload':p or payload()}

def intended(actor,child):
    status,result=rpc(actor,'patient_vaccine_items',{'p_child_id':child})
    assert status==200
    return result['items']

print('START synthetic vaccination run '+run,flush=True)
try:
    editor=create('editor','admin',manage=True)
    reviewer=create('reviewer',review=True,capable=True)
    a=create('a',capable=True)
    b=create('b',capable=True)
    outside=create('outside')
    status,listing=rpc(a,'vaccine_catalog');assert status==200
    seed=next(v for v in listing['versions'] if not v['parent_id'])
    status,version=change(editor,'clone',seed['id'],seed['revision'],{'label':'QA administrations fictives '+run});assert status==200
    versions.append(version)
    status,_=change(reviewer,'approve',version,1,{'source_authenticated':True,'clinical_reviewed':True,'birth_window_reviewed':True});assert status==200
    status,fa=rpc(a,'create_facility',{'p_operation_id':str(uuid.uuid4()),'p_name':'Centre vaccinal fictif A','p_city':'Rabat'});assert status==200
    status,fb=rpc(b,'create_facility',{'p_operation_id':str(uuid.uuid4()),'p_name':'Centre vaccinal fictif B','p_city':'Rabat'});assert status==200
    status,child=rpc(a,'register_child',{'p_operation_id':str(uuid.uuid4()),'p_payload':{'facility_id':fa,'register_year':2026,'register_book':'V','local_number':'125','given_name':'Enfant vaccinal fictif','family_name':run,'birth_date':'2025-01-01','sex':'female'}});assert status==200
    status,profile=rpc(a,'get_child_profile',{'p_child_id':child});assert status==200
    status,request=rpc(b,'request_child_access',{'p_operation_id':str(uuid.uuid4()),'p_universal_id':profile['universal_id'],'p_facility_id':fb,'p_year':2026,'p_book':'V','p_number':'78','p_reason':'Autorisation fictive de continuité vaccinale.'});assert status==200
    status,_=rpc(a,'decide_child_access',{'p_request_id':request,'p_approve':True,'p_reason':'Base légitime fictive contrôlée.','p_authorization_checked':True});assert status==200
    for actor in (editor,outside):
        status,_=rpc(actor,'vaccine_items_export',{'p_child_id':child})
        check(status in (401,403),'Unrelated doctor/catalog admin cannot export intended child items')
    for table in ('child_vaccine_items','vaccine_item_changes','vaccination_entry_links','vaccination_duplicate_overrides'):
        status,_=api('/rest/v1/'+table+'?select=*',token=a['token'])
        check(status in (401,403),'Direct '+table+' access denied')
    path=f'/patients/{child}/vaccinations?version={version}'
    _,page,_=a['web'].get(path)
    form=next(f for f in Forms(page).forms if 'dose_code' in f['names'])
    operation=form['fields']['operationId']
    fields={'facility_id':fa,'dose_code':'VPO1','reason':basis['reason'],'eligibility_checked':'on','syntheticOnly':'on'}
    _,page,_=a['web'].submit(path,page,fields,lambda f:'dose_code' in f['names'])
    item=intended(a,child)[0]['id']
    check('Administration non confirmée' in page and '2025-02-26' in page,'Hosted assignment form shows an unconfirmed routine reference, not an appointment')
    assign={'p_operation_id':operation,'p_child_id':child,'p_version_id':version,'p_dose_code':'VPO1','p_facility_id':fa,'p_reason':basis['reason'],'p_eligibility_checked':True}
    status,same=rpc(a,'assign_vaccine_item',assign)
    check(status==200 and same==item and len(intended(a,child))==1,'Retry of actual assignment is idempotent')
    status,result=rpc(a,'assign_vaccine_item',{**assign,'p_operation_id':str(uuid.uuid4())})
    check(status==409 and result.get('code')=='PT409','Hosted duplicate intended-dose assignment returns actual HTTP 409')
    path=f'/patients/{child}/records/new?kind=vaccination'
    _,page,_=a['web'].get(path)
    historical={**payload(code='BCG'),'facility_id':fa,'occurrence_precision':'unknown','occurred_on':'','source_type':'paper_transcription','source_reference':'Registre fictif page 15, date et lot inconnus.','syntheticOnly':'on'}
    url,page,_=a['web'].submit(path,page,historical,lambda f:f['fields'].get('kind')=='vaccination')
    historical_root=url.rsplit('/',1)[-1];uuid.UUID(historical_root)
    status,history=rpc(a,'clinical_entry_history',{'p_child_id':child,'p_root_id':historical_root})
    check(status==200 and history[0]['occurred_on'] is None and not history[0]['source_verified'] and history[0]['vaccine_mapping'] is None and not intended(a,child)[0]['documented_entries'],'Actual paper-transcription form retains uncertainty and fulfills no intended item')
    _,page,_=b['web'].get(path)
    form=next(f for f in Forms(page).forms if f['fields'].get('kind')=='vaccination');operation=form['fields']['operationId']
    matched={**payload(item),'facility_id':fb,'occurrence_precision':'exact','occurred_on':'2026-01-02','source_type':'observed','source_verified':'on','syntheticOnly':'on'}
    url,page,_=b['web'].submit(path,page,matched,lambda f:f['fields'].get('kind')=='vaccination')
    root=url.rsplit('/',1)[-1];uuid.UUID(root)
    status,history=rpc(a,'clinical_entry_history',{'p_child_id':child,'p_root_id':root})
    check(status==200 and history[0]['author_id']==b['id'] and history[0]['facility_id']==fb and history[0]['vaccine_mapping']['item_id']==item,'Second doctor actual form records their authorship and immutable intended-item version')
    status,same=rpc(b,'write_clinical_entry',{**entry(child,fb,payload(item)),'p_operation_id':operation})
    check(status==200 and same==root,'Actual vaccination form retry does not duplicate an administration')
    _,page,_=a['web'].get(f'/patients/{child}/vaccinations')
    check('Administration documentée et rapprochée' in page and b['platform'] in page,'Doctor A sees the shared completion from doctor B')
    _,page,_=a['web'].get(path)
    duplicate={**matched,**payload(),'facility_id':fa}
    _,warning,_=a['web'].submit(path,page,duplicate,lambda f:f['fields'].get('kind')=='vaccination')
    check('potentiellement en doublon' in warning and b['platform'] in warning,'Actual vaccination form warns and lists the conflicting administration')
    status,result=rpc(a,'write_clinical_entry',entry(child,fa))
    check(status==409 and result.get('hint')=='vaccine_duplicate_review','Actual HTTP 409 identifies duplicate review separately from revision conflicts')
    override='Administration fictive distincte confirmée après relecture du doublon potentiel.'
    url,page,_=a['web'].submit(path,warning,{**duplicate,'duplicate_override_reason':override},lambda f:f['fields'].get('kind')=='vaccination')
    duplicate_root=url.rsplit('/',1)[-1];uuid.UUID(duplicate_root)
    status,review=rpc(a,'clinical_entry_history',{'p_child_id':child,'p_root_id':duplicate_root})
    check(status==200 and review[0]['duplicate_review']=={'reason':override,'conflicting_entry_ids':[root]},'Reasoned form override stores the exact conflicting revision and keeps both events')
    path=f'/patients/{child}/records/{root}';_,stale_page,_=b['web'].get(path)
    _,correction_page,_=b['web'].get(path)
    correction={**matched,**payload(),'duplicate_override_reason':basis['reason'],'amendment_reason':'Rapprochement fictif annulé après contrôle de la source.','entry_state':'active'}
    _,page,_=b['web'].submit(path,correction_page,correction,lambda f:f['fields'].get('kind')=='vaccination')
    status,history=rpc(a,'clinical_entry_history',{'p_child_id':child,'p_root_id':root})
    check(status==200 and len(history)==2 and history[0]['vaccine_mapping']['version_id']==version and history[1]['vaccine_mapping'] is None and not intended(a,child)[0]['documented_entries'],'Correction reopens only its intended item and preserves original version mapping')
    _,stale_result,_=b['web'].submit(path,stale_page,correction,lambda f:f['fields'].get('kind')=='vaccination')
    check('Une autre correction a été enregistrée' in stale_result,'Stale actual vaccine correction form requires reloading')
    stale={**entry(child,fb),'p_root_id':root,'p_expected_revision':1,'p_amendment_reason':basis['reason']}
    status,result=rpc(b,'write_clinical_entry',stale)
    check(status==409 and result.get('code')=='PT409','Stale vaccination correction returns actual HTTP 409 promptly')
    _,page,_=b['web'].get(path)
    _,page,_=b['web'].submit(path,page,{**correction,'notes':'This attempted edit must not change withdrawal data.','entry_state':'withdrawn','amendment_reason':'Retrait fictif conservant les données de la dernière version.'},lambda f:f['fields'].get('kind')=='vaccination')
    status,history=rpc(a,'clinical_entry_history',{'p_child_id':child,'p_root_id':root})
    check(status==200 and len(history)==3 and history[-1]['entry_state']=='withdrawn' and history[-1]['payload']==history[-2]['payload'],'Withdrawal form appends history and retains clinical data despite edited fields')
    path=f'/patients/{child}/vaccinations/{item}';_,page,_=a['web'].get(path)
    _,page,_=a['web'].submit(path,page,{'facility_id':fa,'reason':basis['reason'],'syntheticOnly':'on'},lambda f:'itemId' in f['fields'])
    status,changes=rpc(a,'vaccine_item_history',{'p_child_id':child,'p_item_id':item})
    check(status==200 and len(changes)==2 and changes[-1]['state']=='withdrawn','Actual reference withdrawal appends an attributed decision')
    status,result=rpc(a,'change_vaccine_item',{'p_operation_id':str(uuid.uuid4()),'p_item_id':item,'p_expected_revision':1,'p_state':'active','p_facility_id':fa,'p_reason':basis['reason'],'p_eligibility_checked':True})
    check(status==409 and result.get('code')=='PT409','Stale reference decision returns actual HTTP 409')
    _,page,_=a['web'].get(path)
    _,page,_=a['web'].submit(path,page,{'facility_id':fa,'reason':basis['reason'],'eligibility_checked':'on','syntheticOnly':'on'},lambda f:'itemId' in f['fields'])
    status,changes=rpc(a,'vaccine_item_history',{'p_child_id':child,'p_item_id':item})
    current_form=next(f for f in Forms(page).forms if 'itemId' in f['fields'])
    check(status==200 and [c['state'] for c in changes]==['active','withdrawn','active'] and current_form['fields']['expected_revision']=='3' and intended(a,child)[0]['state']=='active','Actual reactivation retains all three reference revisions')
    race=[{**assign,'p_operation_id':str(uuid.uuid4()),'p_dose_code':'VPO2'} for _ in range(2)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda data:rpc(a,'assign_vaccine_item',data),race))
    check(sorted(status for status,_ in results)==[200,409],'Concurrent assignment commits one item and one deterministic HTTP 409')
    second=next(i for i in intended(a,child) if i['dose_code']=='VPO2')
    status,retained=rpc(b,'write_clinical_entry',{**entry(child,fb,payload(second['id'])),'p_occurred_on':'2026-02-02'});assert status==200
    status,_=change(editor,'retire',version,2);assert status==200
    status,new_attempt=rpc(a,'assign_vaccine_item',{**assign,'p_operation_id':str(uuid.uuid4()),'p_dose_code':'VPO3'})
    status2,retained_history=rpc(a,'clinical_entry_history',{'p_child_id':child,'p_root_id':retained})
    check(status==400 and status2==200 and retained_history[0]['vaccine_mapping']['version_id']==version,'Retirement prevents new assignments while retaining original administration mappings')
    _,content,headers=a['web'].get(f'/patients/{child}/export');export=json.loads(content)
    check(export['format']=='mon-enfant-clinical-ledger-v2' and export['vaccination_module_included'] and len(export['clinical_entries'])==6 and len(export['vaccine_items_including_all_decisions'])==2 and len(export['vaccine_items_including_all_decisions'][0]['changes'])==3 and 'no-store' in headers.get('Cache-Control',''),'Private JSON export includes all vaccine revisions, mappings and intended-item decisions')
    _,page,_=a['web'].get(f'/patients/{child}/summary')
    check('Références vaccinales et toutes leurs décisions' in page and a['platform'] in page and b['platform'] in page,'Printable summary retains both authors and reference decision history')
    sql(f"update public.professional_capabilities set enabled=false where professional_id='{a['id']}'")
    status,_=rpc(a,'write_clinical_entry',entry(child,fa,payload(code='PCV')))
    check(status in (401,403),'Revoked capability cuts vaccination writes with the issued JWT')
    sql(f"update public.access_grants set revoked_at=now() where child_id='{child}' and professional_id='{b['id']}'")
    status,_=rpc(b,'patient_vaccine_items',{'p_child_id':child})
    check(status in (401,403),'Revoked child grant cuts shared vaccine item reads')
    status,_=api('/auth/v1/logout?scope=global',{},a['token']);assert status in (200,204)
    status,_=rpc(a,'vaccine_items_export',{'p_child_id':child})
    check(status in (401,403),'Global logout cuts complete vaccine exports with the old token')
    check(detail(reviewer,seed['id'])['version']['status']=='draft','Technical QA never activates the original unreviewed source')
finally:
    for version in versions:
        sql(f"with retired as (update public.vaccine_versions set status='retired',revision=revision+1 where id='{version}' and status<>'retired' returning id) insert into public.audit_events(actor_id,entity_id,entity_type,action) select null,id,'vaccine_fixture_cleanup','updated' from retired")
    if fixtures:
        ids=','.join("'"+v+"'" for v in fixtures)
        sql(f"begin; update public.professional_capabilities set enabled=false where professional_id in({ids}); update private.staff_permissions set can_manage_vaccine_catalog=false,can_review_vaccine_catalog=false where user_id in({ids}); update public.access_grants set revoked_at=now() where professional_id in({ids}); update public.professional_facilities set revoked_at=now() where professional_id in({ids}); update public.professional_profiles set verification_status='suspended' where user_id in({ids}); commit;")
    for session in sessions:
        api('/auth/v1/logout?scope=global',{},session['access_token'])
print(json.dumps({'run':run,'checks':checks,'fixtures_retired':len(fixtures),'qa_versions_retired':len(versions),'outgoing_email_sent':False,'clinical_approval_claimed':False}))
