#!/usr/bin/env python3
"""Hosted synthetic appointment and cross-doctor acceptance. No browser, build or email.
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

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
ZONE=ZoneInfo('Africa/Casablanca')

def local_slot(days=7):
    date=(datetime.now(ZONE)+timedelta(days=days)).date().isoformat()
    return date+'T10:00',date+'T10:30'

def instant(local):
    return datetime.fromisoformat(local).replace(tzinfo=ZONE).isoformat(timespec='seconds')

def plan(child,facility,item=None,slot=('2026-01-02T10:00','2026-01-02T10:30'),operation=None):
    return {'p_operation_id':operation or str(uuid.uuid4()),'p_child_id':child,'p_facility_id':facility,'p_purpose':'vaccination' if item else 'consultation','p_purpose_label':'Suivi vaccinal fictif' if item else 'Consultation fictive indépendante','p_vaccine_item_id':item,'p_starts_at':instant(slot[0]),'p_ends_at':instant(slot[1]),'p_reason':basis['reason'],'p_reviewed':True}

def form_fields(facility,item=None,slot=('2026-01-02T10:00','2026-01-02T10:30')):
    return {'facility_id':facility,'purpose':'vaccination' if item else 'consultation','purpose_label':'Suivi vaccinal fictif' if item else 'Consultation fictive indépendante','vaccine_item_id':item or '','starts_local':slot[0],'ends_local':slot[1],'starts_offset':'auto','ends_offset':'auto','reason':basis['reason'],'reviewed':'on','syntheticOnly':'on'}

def history(actor,child,appointment):
    status,result=rpc(actor,'appointment_history',{'p_child_id':child,'p_appointment_id':appointment});assert status==200
    return result

def work(actor,bucket):
    status,result=rpc(actor,'appointment_worklist',{'p_bucket':bucket});assert status==200
    return result

def grant(manager,doctor,enabled=True):
    path='/admin/clinical-permissions?q='+doctor['platform'];_,page,_=manager['web'].get(path)
    _,page,_=manager['web'].submit(path,page,{'professionalId':doctor['id'],'capability':'appointment','decision':'enable' if enabled else 'disable','evidence_reference':basis['evidence_reference'],'reason':basis['reason'],'verified':'on'},lambda f:'capability' in f['names'])
    status,caps=rpc(doctor,'my_clinical_capabilities')
    check(status==200 and ('appointment' in caps)==enabled,'Actual manager form '+('grants' if enabled else 'revokes')+' the separate appointment capability')

def vaccine_payload(item):
    return {'vaccine_code':'VPO','vaccine_label':'Vaccin fictif','dose_label':'','lot_status':'unknown','lot_number':'','site_status':'unknown','site':'','provider_status':'unknown','administered_by':'','administration_facility_status':'unknown','administration_facility':'','matching_status':'clinician_validated','schedule_item_id':item,'duplicate_override_reason':'','notes':'Saisie fictive pour la continuité.'}

print('START synthetic appointment run '+run,flush=True)
try:
    editor=create('editor','admin',manage=True)
    reviewer=create('reviewer',review=True,capable=True)
    a=create('a',capable=True)
    b=create('b',capable=True)
    outside=create('outside')
    sql(f"update private.staff_permissions set can_manage_clinical_permissions=true where user_id='{editor['id']}'")
    status,listing=rpc(a,'vaccine_catalog');assert status==200
    seed=next(v for v in listing['versions'] if not v['parent_id'])
    status,version=change(editor,'clone',seed['id'],seed['revision'],{'label':'QA rendez-vous fictifs '+run});assert status==200;versions.append(version)
    status,_=change(reviewer,'approve',version,1,{'source_authenticated':True,'clinical_reviewed':True,'birth_window_reviewed':True});assert status==200
    status,fa=rpc(a,'create_facility',{'p_operation_id':str(uuid.uuid4()),'p_name':'Centre rendez-vous fictif A','p_city':'Rabat'});assert status==200
    status,fb=rpc(b,'create_facility',{'p_operation_id':str(uuid.uuid4()),'p_name':'Centre rendez-vous fictif B','p_city':'Rabat'});assert status==200
    status,child=rpc(a,'register_child',{'p_operation_id':str(uuid.uuid4()),'p_payload':{'facility_id':fa,'register_year':2026,'register_book':'A','local_number':'125','given_name':'Enfant rendez-vous fictif','family_name':run,'birth_date':'2025-01-01','sex':'female'}});assert status==200
    status,profile=rpc(a,'get_child_profile',{'p_child_id':child});assert status==200
    status,request=rpc(b,'request_child_access',{'p_operation_id':str(uuid.uuid4()),'p_universal_id':profile['universal_id'],'p_facility_id':fb,'p_year':2026,'p_book':'A','p_number':'78','p_reason':basis['reason']});assert status==200
    status,_=rpc(a,'decide_child_access',{'p_request_id':request,'p_approve':True,'p_reason':basis['reason'],'p_authorization_checked':True});assert status==200
    status,bprofile=rpc(b,'get_child_profile',{'p_child_id':child})
    check(status==200 and profile['universal_id']==bprofile['universal_id'] and profile['registers'][0]['number']=='125' and bprofile['registers'][0]['number']=='78','A/125 and B/78 retain one child identity and distinct local registers')
    status,item=rpc(a,'assign_vaccine_item',{'p_operation_id':str(uuid.uuid4()),'p_child_id':child,'p_version_id':version,'p_dose_code':'VPO1','p_facility_id':fa,'p_reason':basis['reason'],'p_eligibility_checked':True});assert status==200
    status,_=rpc(a,'create_appointment',plan(child,fa,item))
    check(status in (401,403),'Vaccination capability and account approval do not grant appointment management')
    grant(editor,a);grant(editor,b)
    for actor in (editor,outside):
        status,_=rpc(actor,'appointments_export',{'p_child_id':child});check(status in (401,403),'Unrelated doctor/catalog or permission admin cannot export child appointments')
    for table in ('appointments','appointment_events'):
        status,_=api('/rest/v1/'+table+'?select=*',token=a['token']);check(status in (401,403),'Direct '+table+' access denied')
    path=f'/patients/{child}/appointments/new?item={item}';_,page,_=a['web'].get(path)
    operation=next(f for f in Forms(page).forms if 'purpose' in f['names'])['fields']['operationId']
    url,page,_=a['web'].submit(path,page,form_fields(fa,item),lambda f:'purpose' in f['names']);appointment=url.rsplit('/',1)[-1];uuid.UUID(appointment)
    current=history(a,child,appointment)
    check(current['appointment']['effective_state']=='missed' and len(current['events'])==1,'Actual planning form creates a missed appointment flag for a passed slot, not a missed dose')
    status,same=rpc(a,'create_appointment',plan(child,fa,item,operation=operation))
    check(status==200 and same==appointment,'Retry of actual planning form creates one appointment')
    status,result=rpc(a,'create_appointment',plan(child,fa,item))
    check(status==409 and result.get('hint')=='appointment_duplicate','Duplicate owner/item reminder returns actual HTTP 409')
    status,refs=rpc(a,'vaccine_followup_worklist',{'p_bucket':'potentially_overdue_unconfirmed'})
    check(status==200 and refs['total']==1 and refs['items'][0]['history_status']=='unknown','Potentially overdue/unconfirmed reference retains unknown history separately')
    _,page,_=a['web'].get('/follow-up?bucket=missed_vaccinations')
    check('Suivi vaccinal fictif' in page and 'Historique et décision / replanifier' in page,'Dedicated missed-vaccination appointment view offers the manual decision action')
    path=f'/patients/{child}/appointments/{appointment}'
    _,stale_page,_=a['web'].get(path);_,page,_=a['web'].get(path)
    operation=next(f for f in Forms(page).forms if 'decision' in f['names'])['fields']['operationId']
    slot=local_slot(7);fields={'decision':'reschedule','starts_local':slot[0],'ends_local':slot[1],'starts_offset':'auto','ends_offset':'auto','reason':basis['reason'],'reviewed':'on','syntheticOnly':'on'}
    _,page,_=a['web'].submit(path,page,fields,lambda f:'decision' in f['names']);current=history(a,child,appointment)
    check([e['state'] for e in current['events']]==['scheduled','missed','scheduled'] and current['events'][-1]['previous_starts_at']==current['events'][0]['starts_at'] and current['events'][-1]['professional_id']==a['platform'],'Actual manual reschedule retains the original missed slot, actor and old/new times')
    status,clinical=rpc(a,'clinical_export',{'p_child_id':child})
    check(status==200 and clinical==[] and current['appointment']['documentation'] is None and work(a,'missed_vaccinations')['total']==0,'Rescheduling clears only the old appointment warning and leaves vaccination unconfirmed')
    mutation={'p_operation_id':operation,'p_appointment_id':appointment,'p_expected_revision':1,'p_action':'reschedule','p_starts_at':instant(slot[0]),'p_ends_at':instant(slot[1]),'p_reason':basis['reason'],'p_reviewed':True}
    status,_=rpc(a,'change_appointment',mutation)
    check(status==200 and len(history(a,child,appointment)['events'])==3,'Retry of the reschedule creates no duplicate missed or rescheduled events')
    _,stale_result,_=a['web'].submit(path,stale_page,fields,lambda f:'decision' in f['names'])
    check('Une autre décision a été enregistrée' in stale_result,'Actual stale appointment form requires reloading')
    status,result=rpc(a,'change_appointment',{**mutation,'p_operation_id':str(uuid.uuid4())})
    check(status==409 and result.get('code')=='PT409','Actual provider returns HTTP 409 for stale appointment revisions')
    race=[]
    for days in (9,10):
        slot2=local_slot(days);race.append({**mutation,'p_operation_id':str(uuid.uuid4()),'p_expected_revision':3,'p_starts_at':instant(slot2[0]),'p_ends_at':instant(slot2[1])})
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda data:rpc(a,'change_appointment',data),race))
    check(sorted(status for status,_ in results)==[200,409] and len(history(a,child,appointment)['events'])==4,'Concurrent manual reschedules retain one winner and one deterministic conflict')
    path=f'/patients/{child}/appointments/new';_,page,_=a['web'].get(path)
    url,page,_=a['web'].submit(path,page,form_fields(fa,slot=local_slot(8)),lambda f:'purpose' in f['names']);consultation=url.rsplit('/',1)[-1];uuid.UUID(consultation)
    _,page,_=a['web'].get('/appointments?view=month&date='+local_slot()[0][:10])
    check('Suivi vaccinal fictif' in page and 'Consultation fictive indépendante' in page and 'Africa/Casablanca' in page,'Actual month calendar lists both separately planned slots with timezone context')
    path=f'/patients/{child}/records/new?kind=vaccination';_,page,_=b['web'].get(path)
    fields={**vaccine_payload(item),'facility_id':fb,'occurrence_precision':'exact','occurred_on':'2026-01-02','source_type':'observed','source_verified':'on','syntheticOnly':'on'}
    url,page,_=b['web'].submit(path,page,fields,lambda f:f['fields'].get('kind')=='vaccination');clinical_root=url.rsplit('/',1)[-1];uuid.UUID(clinical_root)
    current=history(a,child,appointment);resolved=work(a,'resolved_by_other')
    check(current['appointment']['effective_state']=='dose_documented' and current['appointment']['documentation']['professional_id']==b['platform'] and resolved['total']==1 and resolved['counts']['upcoming']==1,'B’s actual vaccination updates A’s follow-up queue and preserves the independent consultation')
    check(len(current['events'])==4 and current['events'][-1]['state']=='scheduled' and history(a,child,consultation)['appointment']['effective_state']=='scheduled','Cross-doctor completion manufactures no attendance event or consultation cancellation')
    _,page,_=a['web'].get('/follow-up?bucket=resolved_by_other')
    check(b['platform'] in page and 'La présence au rendez-vous initial' in page,'Actual resolved queue attributes the qualifying dose without claiming appointment attendance')
    status,result=rpc(b,'change_appointment',{**mutation,'p_operation_id':str(uuid.uuid4()),'p_expected_revision':4,'p_action':'cancel','p_starts_at':None,'p_ends_at':None})
    check(status in (401,403),'Another treating doctor cannot cancel A’s appointment')
    status,overview=rpc(a,'patient_visit_overview',{'p_child_id':child})
    check(status==200 and overview['last_documented_care']=='2026-01-02' and overview['next_own_appointment']['id']==consultation,'Last-care/next-visit metadata reflects shared clinical care and only outstanding appointments')
    _,page,_=a['web'].get('/patients')
    check('Dernier soin documenté' in page and 'Mon prochain rendez-vous' in page,'Actual scoped register exposes documented last care and next own appointment')
    _,content,headers=a['web'].get(f'/patients/{child}/export');export=json.loads(content)
    exported={row['id']:row for row in export['appointments_including_all_events']}
    check(export['format']=='mon-enfant-clinical-ledger-v3' and set(exported)=={appointment,consultation} and len(exported[appointment]['events'])==4 and len(exported[consultation]['events'])==1 and 'no-store' in headers.get('Cache-Control',''),'Private complete ledger-v3 export retains both appointments and every decision')
    _,page,_=a['web'].get(f'/patients/{child}/summary')
    check('Rendez-vous et toutes leurs décisions' in page and a['platform'] in page and b['platform'] in page,'Printable summary contains appointment events and both clinical authors')
    path=f'/patients/{child}/records/{clinical_root}';_,page,_=b['web'].get(path)
    _,page,_=b['web'].submit(path,page,{**fields,'entry_state':'withdrawn','amendment_reason':'Retrait fictif de la preuve, rapprochement à réexaminer.'},lambda f:f['fields'].get('kind')=='vaccination')
    check(work(a,'resolved_by_other')['total']==0 and work(a,'upcoming')['total']==2 and history(a,child,appointment)['appointment']['documentation'] is None,'Withdrawal reopens the same outstanding vaccine follow-up without duplicate reminder rows')
    grant(editor,a,False)
    status,_=rpc(a,'change_appointment',{**mutation,'p_operation_id':str(uuid.uuid4()),'p_expected_revision':4,'p_action':'cancel','p_starts_at':None,'p_ends_at':None})
    check(status in (401,403),'Revoked appointment capability denies writes with the existing JWT')
    check(len(history(a,child,appointment)['events'])==4,'Revoked write capability retains authorized appointment history reads')
    sql(f"update public.access_grants set revoked_at=now() where child_id='{child}' and professional_id='{b['id']}'")
    status,_=rpc(b,'patient_appointments',{'p_child_id':child});check(status in (401,403),'Revoked child grant denies shared appointment reads')
    status,_=api('/auth/v1/logout?scope=global',{},a['token']);assert status in (200,204)
    status,_=rpc(a,'appointment_worklist',{'p_bucket':'all'});check(status in (401,403),'Global logout cuts appointment queues for the previously issued JWT')
    check(detail(reviewer,seed['id'])['version']['status']=='draft','Technical appointment tests leave the genuine source unapproved')
finally:
    for version in versions:
        sql(f"with retired as (update public.vaccine_versions set status='retired',revision=revision+1 where id='{version}' and status<>'retired' returning id) insert into public.audit_events(actor_id,entity_id,entity_type,action) select null,id,'vaccine_fixture_cleanup','updated' from retired")
    if fixtures:
        ids=','.join("'"+v+"'" for v in fixtures)
        sql(f"begin; update public.professional_capabilities set enabled=false where professional_id in({ids}); update private.staff_permissions set can_manage_clinical_permissions=false,can_manage_vaccine_catalog=false,can_review_vaccine_catalog=false where user_id in({ids}); update public.access_grants set revoked_at=now() where professional_id in({ids}); update public.professional_facilities set revoked_at=now() where professional_id in({ids}); update public.professional_profiles set verification_status='suspended' where user_id in({ids}); commit;")
    for session in sessions:api('/auth/v1/logout?scope=global',{},session['access_token'])
print(json.dumps({'run':run,'checks':checks,'fixtures_retired':len(fixtures),'qa_versions_retired':len(versions),'outgoing_email_sent':False,'clinical_approval_claimed':False}))
