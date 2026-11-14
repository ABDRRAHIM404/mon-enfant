#!/usr/bin/env python3
"""Synthetic hosted registry forms + provider ACL/idempotency/concurrency smoke.
No browser, build, outgoing email or credentials on stdout. Run after deployment.
"""
import concurrent.futures,json,os,pathlib,secrets,subprocess,tempfile,urllib.request,urllib.error,uuid
from operator_http import Browser,Forms
ROOT=pathlib.Path(__file__).resolve().parent.parent
PROJECT='zkkasbxvdvecnafgjpxd'
assert (ROOT/'supabase/.temp/project-ref').read_text().strip()==PROJECT
cfg=dict(line.split('=',1) for line in (ROOT/'.env.local').read_text().splitlines() if line and not line.startswith('#'))
env={**os.environ,**cfg};BASE=cfg['NEXT_PUBLIC_SUPABASE_URL'];PUBLIC=cfg['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
assert BASE==f'https://{PROJECT}.supabase.co'
r=subprocess.run(['supabase','projects','api-keys','--project-ref',PROJECT,'--reveal','--output-format','json'],env=env,capture_output=True,text=True,check=True,cwd=ROOT)
d=json.loads(r.stdout);keys=d if isinstance(d,list) else d.get('api_keys',d.get('keys',[]));SERVICE=next(k['api_key'] for k in keys if k['name']=='service_role')
fixtures=[];sessions=[];checks=[];run=uuid.uuid4().hex[:10]
def check(value,label):
 if not value:raise AssertionError(label)
 checks.append(label);print('PASS '+label,flush=True)
def api(path,data=None,token=None,admin=False,method=None):
 headers={'apikey':SERVICE if admin else PUBLIC,'Content-Type':'application/json'}
 if token or admin:headers['Authorization']='Bearer '+(SERVICE if admin else token)
 req=urllib.request.Request(BASE+path,data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method or ('POST' if data is not None else 'GET'))
 try:
  with urllib.request.urlopen(req,timeout=40) as response:return response.status,json.loads(response.read() or 'null')
 except urllib.error.HTTPError as error:
  error.read();return error.code,None

def sql(text):
 with tempfile.NamedTemporaryFile(mode='w',suffix='.sql') as f:
  f.write(text);f.flush();r=subprocess.run(['supabase','db','query','--linked','--file',f.name,'--output-format','json'],env=env,capture_output=True,text=True,cwd=ROOT)
 if r.returncode:raise AssertionError('Trusted synthetic fixture operation failed')
 return json.loads(r.stdout).get('rows',[])
def create(kind,role='doctor'):
 email=f'qa-registry-{run}-{kind}@example.invalid';password=secrets.token_urlsafe(30)
 status,u=api('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'synthetic_fixture':True,'fixture_run':run}},admin=True)
 assert status in (200,201);uid=u['id'];fixtures.append(uid)
 browser=Browser();_,page,_=browser.login(email,password)
 browser.submit('/account',page,{},lambda f:'Activer mon espace soignant' in f['text'])
 sql(f"update public.professional_profiles set role='{role}',verification_status='approved',professional_id='QAR-{run}-{kind}' where user_id='{uid}'")
 status,session=api('/auth/v1/token?grant_type=password',{'email':email,'password':password});assert status==200;sessions.append(session)
 return {'id':uid,'web':browser,'token':session['access_token']}
def rpc(actor,name,payload=None):return api('/rest/v1/rpc/'+name,payload or {},actor['token'])
def get(actor,path):return actor['web'].get(path)
def submit(actor,path,page,kind,fields):return actor['web'].submit(path,page,fields,lambda f:f['fields'].get('kind')==kind)
def facility(actor,name):
 _,page,_=get(actor,'/practices');_,page,_=submit(actor,'/practices',page,'facility',{'name':name,'city':'Rabat'})
 status,items=rpc(actor,'my_facilities');check(status==200 and len(items)==1,'Hosted practice declaration reaches the scoped API')
 return items[0]['id']
try:
 a=create('a');b=create('b');outsider=create('outside');admin=create('admin','admin')
 fa=facility(a,'Centre fictif A');fb=facility(b,'Centre fictif B')
 _,page,_=get(a,'/patients/new')
 form=next(f for f in Forms(page).forms if f['fields'].get('kind')=='register');operation=form['fields']['operationId']
 fields={'facility_id':fa,'register_year':'2026','register_book':'A','local_number':'00125','given_name':'Enfant QA','family_name':run,'name_status':'confirmed','birth_date':'2025-02-03','birth_date_precision':'exact','sex':'unknown','history_status':'unknown','source_type':'new_registration','syntheticOnly':'on'}
 url,page,_=submit(a,'/patients/new',page,'register',fields)
 check('/patients/' in url and 'Identité et provenance' in page and '00125' in page,'Hosted registration creates the child, creator grant and original local number')
 child=url.rsplit('/',1)[-1];uuid.UUID(child)
 status,profile=rpc(a,'get_child_profile',{'p_child_id':child});check(status==200 and profile['can_manage_access'],'Creator receives explicit access management')
 universal=profile['universal_id']
 payload={key:fields.get(key,'') for key in ['facility_id','register_book','local_number','given_name','family_name','name_status','birth_date','birth_date_precision','sex','history_status','source_type','paper_reference','provenance_note','guardian_name','guardian_phone','duplicate_override_reason']};payload['register_year']=2026
 status,retry=rpc(a,'register_child',{'p_operation_id':operation,'p_payload':payload});check(status==200 and retry==child,'Retry of the hosted registration returns the same child')
 status,_=rpc(a,'register_child',{'p_operation_id':operation,'p_payload':{**payload,'local_number':'changed'}});check(status>=400,'Operation ID cannot be reused with different data')
 _,page,_=get(a,'/patients?q=00125');check('Enfant QA' in page and '00125' in page,'Hosted registry search finds the scoped local number')
 for actor in (outsider,admin):
  status,_=rpc(actor,'get_child_profile',{'p_child_id':child});check(status in (401,403),'Unrelated professional or admin cannot read the child')
 status,_=api('/rest/v1/children?select=id',token=a['token']);check(status in (401,403),'Direct clinical table SELECT is denied to approved doctors')
 _,page,_=get(b,'/patients/link');_,page,_=submit(b,'/patients/link',page,'request',{'universal_id':universal,'facility_id':fb,'register_year':'2026','register_book':'B','local_number':'78','reason':'Autorisation de soins fictive vérifiée pour le test.'})
 status,requests=rpc(b,'my_access_requests');check(status==200 and len(requests)==1 and requests[0]['child_id'] is None,'Access-request receipt does not disclose child data or internal ID')
 request=requests[0]['id']
 _,page,_=get(a,'/access-requests');check(f'QAR-{run}-b' in page,'Current child access manager sees the hosted review worklist')
 _,page,_=submit(a,'/access-requests',page,'decide',{'requestId':request,'decision':'approve','authorizationChecked':'on','reason':'Contrôle fictif de la base légitime de soins.'})
 status,pb=rpc(b,'get_child_profile',{'p_child_id':child});check(status==200 and pb['universal_id']==universal and pb['registers'][0]['number']=='78' and not pb['can_manage_access'],'Approved B sees the same child under local 78 without implicit management')
 _,page,_=get(b,'/patients/'+child);check('78' in page and universal in page,'Hosted B overview renders the shared identity and own register')
 status,pa=rpc(a,'get_child_profile',{'p_child_id':child});check(status==200 and pa['registers'][0]['number']=='00125','Approval preserves A’s original local 00125')
 _,page,_=get(a,'/patients/'+child);_,page,_=submit(a,'/patients/'+child,page,'revoke',{'childId':child,'professionalId':b['id'],'reason':'Fin fictive de la prise en charge.'})
 status,_=rpc(b,'get_child_profile',{'p_child_id':child});check(status in (401,403),'Hosted revocation cuts B access immediately with the existing JWT')
 # Unknown ID yields the same requester fields and null internal ID.
 status,missing=rpc(b,'request_child_access',{'p_operation_id':str(uuid.uuid4()),'p_universal_id':str(uuid.uuid4()),'p_facility_id':fb,'p_year':2026,'p_book':'B','p_number':'79','p_reason':'Demande fictive sans enfant exposé.'})
 status,requests=rpc(b,'my_access_requests');check(status==200 and any(r['id']==missing and r['child_id'] is None and r['status']=='pending' for r in requests),'Nonexistent identifiers receive a non-disclosing pending receipt')
 # Reauthorization uses the same register association; only one concurrent decision wins.
 status,request=rpc(b,'request_child_access',{'p_operation_id':str(uuid.uuid4()),'p_universal_id':universal,'p_facility_id':fb,'p_year':2026,'p_book':'B','p_number':'78','p_reason':'Nouvelle autorisation fictive de soins.'});assert status==200
 decision={'p_request_id':request,'p_approve':True,'p_reason':'Autorisation fictive contrôlée de nouveau.','p_authorization_checked':True,'p_delegate':False}
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:rpc(a,'decide_child_access',decision),range(2)))
 check(sum(status==200 for status,_ in results)==1 and sum(status>=400 for status,_ in results)==1,'Concurrent access decisions yield exactly one committed approval')
 status,pb=rpc(b,'get_child_profile',{'p_child_id':child});check(status==200 and len(pb['registers'])==1,'Reauthorization preserves the existing register association')
 # Simultaneous new operations for the same authorized demographic match require review.
 race=[{'p_operation_id':str(uuid.uuid4()),'p_payload':{**payload,'family_name':run+'-race','local_number':number}} for number in ('R1','R2')]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda data:rpc(a,'register_child',data),race))
 check(sum(status==200 for status,_ in results)==1 and sum(status>=400 for status,_ in results)==1,'Concurrent matching registrations commit once and require duplicate review')
 # Paper transcription carries unknown fields without inventing demographic data.
 _,page,_=get(a,'/patients/new?source=paper');url,page,_=submit(a,'/patients/new?source=paper',page,'register',{'facility_id':fa,'register_year':'2026','register_book':'PAPER','local_number':'0009','name_status':'unknown','birth_date_precision':'unknown','sex':'unknown','history_status':'partial','source_type':'paper_transcription','paper_reference':'Registre fictif page 9','syntheticOnly':'on'})
 paper=url.rsplit('/',1)[-1];status,pp=rpc(a,'get_child_profile',{'p_child_id':paper});check(status==200 and pp['given_name'] is None and pp['birth_date'] is None and pp['paper_reference']=='Registre fictif page 9','Hosted paper form preserves unknown demographics and provenance')
 _,page,_=get(a,'/dashboard');check('Votre registre de soins.' in page and 'Enfants de mon registre' in page,'Hosted dashboard renders real derived registry counts')
 # Global signout invalidates this exact session even while the access JWT is unexpired.
 status,_=api('/auth/v1/logout?scope=global',{},a['token']);check(status in (200,204),'Global provider signout succeeds')
 status,_=rpc(a,'get_child_profile',{'p_child_id':child});check(status in (401,403),'Revoked Auth session blocks the already-issued clinical JWT')
 audit=sql(f"select count(*)::integer as count from public.audit_events where entity_id='{child}' and action='accessed'");check(audit[0]['count']>0,'Actual hosted clinical reads append metadata-only audit events')
finally:
 if fixtures:
  ids=','.join("'"+v+"'" for v in fixtures)
  sql(f"begin; update public.child_access_requests set status='withdrawn',decision_reason='Fermeture de la fixture fictive.',decided_by=requester_id,decided_at=now() where requester_id in ({ids}) and status='pending'; update public.access_grants set revoked_at=now() where professional_id in ({ids}); update public.professional_facilities set revoked_at=now() where professional_id in ({ids}); update public.professional_profiles set verification_status='suspended' where user_id in ({ids}); commit;")
 for session in sessions:api('/auth/v1/logout?scope=global',{},session['access_token'])
print(json.dumps({'run':run,'checks':checks,'fixtures_retired':len(fixtures),'outgoing_email_sent':False}))
