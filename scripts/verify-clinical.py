#!/usr/bin/env python3
"""Synthetic hosted clinical forms/capabilities/amendments/export acceptance.
Small HTTPS requests only; no browser/build/email. Operator keys stay in memory.
"""
import concurrent.futures,json,os,pathlib,secrets,subprocess,tempfile,urllib.request,urllib.error,uuid
from operator_http import Browser,Forms
ROOT=pathlib.Path(__file__).resolve().parent.parent;PROJECT='zkkasbxvdvecnafgjpxd'
assert(ROOT/'supabase/.temp/project-ref').read_text().strip()==PROJECT
cfg=dict(line.split('=',1)for line in(ROOT/'.env.local').read_text().splitlines()if line and not line.startswith('#'));env={**os.environ,**cfg};BASE=cfg['NEXT_PUBLIC_SUPABASE_URL'];PUBLIC=cfg['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];assert BASE==f'https://{PROJECT}.supabase.co'
r=subprocess.run(['supabase','projects','api-keys','--project-ref',PROJECT,'--reveal','--output-format','json'],env=env,capture_output=True,text=True,check=True,cwd=ROOT);d=json.loads(r.stdout);keys=d if isinstance(d,list)else d.get('api_keys',d.get('keys',[]));SERVICE=next(k['api_key']for k in keys if k['name']=='service_role')
fixtures=[];sessions=[];checks=[];run=uuid.uuid4().hex[:10]
def check(value,label):
 if not value:raise AssertionError(label)
 checks.append(label);print('PASS '+label,flush=True)
def api(path,data=None,token=None,admin=False):
 headers={'apikey':SERVICE if admin else PUBLIC,'Content-Type':'application/json'}
 if token or admin:headers['Authorization']='Bearer '+(SERVICE if admin else token)
 req=urllib.request.Request(BASE+path,data=json.dumps(data).encode()if data is not None else None,headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=40)as response:return response.status,json.loads(response.read()or'null')
 except urllib.error.HTTPError as error:error.read();return error.code,None
def sql(text):
 with tempfile.NamedTemporaryFile(mode='w',suffix='.sql')as f:
  f.write(text);f.flush();r=subprocess.run(['supabase','db','query','--linked','--file',f.name,'--output-format','json'],env=env,capture_output=True,text=True,cwd=ROOT)
 if r.returncode:raise AssertionError('Trusted synthetic fixture operation failed')
 return json.loads(r.stdout).get('rows',[])
def create(kind,role='doctor',manager=False):
 email=f'qa-clinical-{run}-{kind}@example.invalid';password=secrets.token_urlsafe(30);status,u=api('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'synthetic_fixture':True,'fixture_run':run}},admin=True);assert status in(200,201);uid=u['id'];fixtures.append(uid)
 web=Browser();_,page,_=web.login(email,password);web.submit('/account',page,{},lambda f:'Activer mon espace professionnel'in f['text'])
 platform=f'QAC-{run}-{kind}';sql(f"update public.professional_profiles set role='{role}',verification_status='approved',professional_id='{platform}' where user_id='{uid}'")
 if manager:sql(f"insert into private.staff_permissions(user_id,can_manage_clinical_permissions) values('{uid}',true)")
 status,session=api('/auth/v1/token?grant_type=password',{'email':email,'password':password});assert status==200;sessions.append(session);return{'id':uid,'web':web,'token':session['access_token'],'platform':platform}
def rpc(a,name,data=None):return api('/rest/v1/rpc/'+name,data or{},a['token'])
def grant(manager,doctor,capability,enable=True):
 path='/admin/clinical-permissions?q='+doctor['platform'];_,page,_=manager['web'].get(path)
 _,page,_=manager['web'].submit(path,page,{'professionalId':doctor['id'],'capability':capability,'decision':'enable'if enable else'disable','evidence_reference':'Qualification fictive contrôlée pour le test.','reason':'Décision fictive automatisée sans valeur clinique.','verified':'on'},lambda f:'capability'in f['names'])
 status,caps=rpc(doctor,'my_clinical_capabilities');check(status==200 and((capability in caps)==enable),'Hosted permission form '+('grants 'if enable else'revokes ')+capability)
def entry(child,facility,payload=None,kind='consultation'):
 return{'p_operation_id':str(uuid.uuid4()),'p_child_id':child,'p_kind':kind,'p_facility_id':facility,'p_occurred_on':'2026-01-02','p_occurrence_precision':'exact','p_source_type':'observed','p_source_reference':None,'p_source_verified':True,'p_payload':payload or{'reason':'Contrôle fictif','findings':'Observation originale fictive','assessment':'','plan':''}}
try:
 a=create('a');b=create('b');manager=create('manager','admin',True);outsider=create('outside');plainadmin=create('admin','admin')
 status,fa=rpc(a,'create_facility',{'p_operation_id':str(uuid.uuid4()),'p_name':'Centre clinique fictif A','p_city':'Rabat'});assert status==200
 status,fb=rpc(b,'create_facility',{'p_operation_id':str(uuid.uuid4()),'p_name':'Centre clinique fictif B','p_city':'Rabat'});assert status==200
 status,child=rpc(a,'register_child',{'p_operation_id':str(uuid.uuid4()),'p_payload':{'facility_id':fa,'register_year':2026,'register_book':'C','local_number':'125','given_name':'Enfant clinique fictif','family_name':run,'birth_date':'2025-01-01','sex':'unknown'}});assert status==200
 status,profile=rpc(a,'get_child_profile',{'p_child_id':child});assert status==200
 status,request=rpc(b,'request_child_access',{'p_operation_id':str(uuid.uuid4()),'p_universal_id':profile['universal_id'],'p_facility_id':fb,'p_year':2026,'p_book':'C','p_number':'78','p_reason':'Autorisation fictive de continuité des soins.'});assert status==200
 status,_=rpc(a,'decide_child_access',{'p_request_id':request,'p_approve':True,'p_reason':'Base légitime fictive contrôlée.','p_authorization_checked':True});assert status==200
 status,_=rpc(a,'write_clinical_entry',entry(child,fa));check(status in(401,403),'Account approval and child access alone cannot author clinical records')
 status,_=rpc(plainadmin,'list_clinical_permissions');check(status in(401,403),'Admin role alone cannot manage clinical permissions')
 for capability in('consultation','prescription','risk','growth'):grant(manager,a,capability)
 _,page,_=a['web'].get(f'/patients/{child}/records');check('Nouvelle saisie'in page and 'Consultation'in page,'Hosted clinical timeline reflects active explicit capabilities')
 path=f'/patients/{child}/records/new?kind=consultation';_,page,_=a['web'].get(path);form=next(f for f in Forms(page).forms if f['fields'].get('kind')=='consultation');operation=form['fields']['operationId']
 fields={'facility_id':fa,'occurred_on':'2026-01-02','occurrence_precision':'exact','source_type':'observed','source_verified':'on','reason':'Contrôle fictif','findings':'Observation originale fictive','syntheticOnly':'on'}
 url,page,_=a['web'].submit(path,page,fields,lambda f:f['fields'].get('kind')=='consultation');root=url.rsplit('/',1)[-1];uuid.UUID(root);original_page=page
 status,history=rpc(a,'clinical_entry_history',{'p_child_id':child,'p_root_id':root});check(status==200 and len(history)==1 and history[0]['author_id']==a['id']and history[0]['professional_id']==a['platform'],'Hosted consultation records immutable identity, author and platform provenance')
 retry=entry(child,fa);retry['p_operation_id']=operation;status,same=rpc(a,'write_clinical_entry',retry);check(status==200 and same==root,'Retry of the hosted clinical form creates no duplicate event')
 for actor in(outsider,manager,plainadmin):
  status,_=rpc(actor,'clinical_export',{'p_child_id':child});check(status in(401,403),'Unrelated doctor or clinical-permission admin cannot export patient data')
 status,_=api('/rest/v1/clinical_entries?select=id',token=a['token']);check(status in(401,403),'Direct clinical ledger SELECT is denied')
 grant(manager,b,'consultation')
 path=f'/patients/{child}/records/{root}';_,page,_=b['web'].get(path);url,page,_=b['web'].submit(path,page,{**fields,'facility_id':fb,'findings':'Correction fictive du second médecin.','amendment_reason':'Source fictive relue, observation corrigée.','entry_state':'active'},lambda f:f['fields'].get('kind')=='consultation')
 status,history=rpc(a,'clinical_entry_history',{'p_child_id':child,'p_root_id':root});check(status==200 and len(history)==2 and history[0]['payload']['findings']=='Observation originale fictive'and history[1]['author_id']==b['id'],'Second doctor correction preserves A’s original and attributes the new revision to B')
 _,stale_result,_=a['web'].submit(path,original_page,{**fields,'amendment_reason':'Correction fictive depuis un formulaire périmé.','entry_state':'active'},lambda f:f['fields'].get('kind')=='consultation')
 check('Une autre correction a été enregistrée'in stale_result,'Hosted stale form returns the explicit reload/conflict message')
 stale={**entry(child,fa),'p_root_id':root,'p_expected_revision':1,'p_amendment_reason':'Correction fictive devenue obsolète.'};status,_=rpc(a,'write_clinical_entry',stale);check(status==409,'Stale correction cannot overwrite a newer revision')
 updates=[{**entry(child,fa),'p_root_id':root,'p_expected_revision':2,'p_amendment_reason':'Correction concurrente fictive contrôlée.'}for _ in range(2)]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:results=list(pool.map(lambda data:rpc(a,'write_clinical_entry',data),updates))
 check(sum(status==200 for status,_ in results)==1 and sum(status==409 for status,_ in results)==1,'Concurrent corrections commit exactly one next revision')
 _,page,_=b['web'].get(path);_,page,_=b['web'].submit(path,page,{**fields,'facility_id':fb,'amendment_reason':'Retrait fictif de cette saisie erronée.','entry_state':'withdrawn'},lambda f:f['fields'].get('kind')=='consultation')
 status,history=rpc(a,'clinical_entry_history',{'p_child_id':child,'p_root_id':root});check(status==200 and len(history)==4 and history[-1]['entry_state']=='withdrawn','Hosted withdrawal appends a fourth revision instead of deleting history')
 growth=f'/patients/{child}/records/new?kind=growth';_,page,_=a['web'].get(growth);url,page,_=a['web'].submit(growth,page,{'facility_id':fa,'occurred_on':'2026-01-02','occurrence_precision':'exact','source_type':'observed','source_verified':'on','weight_kg':'8.25','height_cm':'72','head_cm':'44','syntheticOnly':'on'},lambda f:f['fields'].get('kind')=='growth')
 _,page,_=a['web'].get(f'/patients/{child}/growth');check('8.25'in page and 'chart-weight_kg'in page and 'aucun percentile'in page,'Hosted growth page renders recorded units and raw-value charts')
 for kind,payload in[('prescription',{'medication':'Traitement fictif','instructions':'Instructions fictives du prescripteur','duration':'7 jours fictifs'}),('risk',{'category':'allergy','description':'Allergie fictive rapportée','severity':'unknown'})]:
  status,_=rpc(a,'write_clinical_entry',entry(child,fa,payload,kind));check(status==200,'Explicitly permitted '+kind+' entry records successfully')
 _,page,_=a['web'].get(f'/patients/{child}/summary');check('Observation originale fictive'in page and a['platform']in page and b['platform']in page and 'Imprimer / enregistrer en PDF'in page,'Printable summary preserves original, corrections, attribution and print control')
 _,content,headers=a['web'].get(f'/patients/{child}/export');export=json.loads(content);check(export['format']=='mon-enfant-clinical-ledger-v2'and export['vaccination_module_included']and export['vaccine_items_including_all_decisions']==[]and len(export['clinical_entries'])==7 and 'attachment'in headers.get('Content-Disposition','')and 'no-store'in headers.get('Cache-Control',''),'Authorized JSON download includes all seven revisions/events and private response headers')
 grant(manager,a,'consultation',False);status,_=rpc(a,'write_clinical_entry',entry(child,fa));check(status in(401,403),'Revoked capability cuts writes with the existing access JWT')
 status,history=rpc(a,'clinical_entry_history',{'p_child_id':child,'p_root_id':root});check(status==200 and len(history)==4,'Capability revocation retains authorized clinical history reads')
 status,_=api('/auth/v1/logout?scope=global',{},a['token']);assert status in(200,204);status,_=rpc(a,'clinical_export',{'p_child_id':child});check(status in(401,403),'Global logout cuts clinical exports for the issued JWT')
finally:
 if fixtures:
  ids=','.join("'"+v+"'"for v in fixtures);sql(f"begin; update public.professional_capabilities set enabled=false where professional_id in({ids}); update private.staff_permissions set can_manage_clinical_permissions=false where user_id in({ids}); update public.access_grants set revoked_at=now() where professional_id in({ids}); update public.professional_facilities set revoked_at=now() where professional_id in({ids}); update public.professional_profiles set verification_status='suspended' where user_id in({ids}); commit;")
 for session in sessions:api('/auth/v1/logout?scope=global',{},session['access_token'])
print(json.dumps({'run':run,'checks':checks,'fixtures_retired':len(fixtures),'outgoing_email_sent':False,'clinical_qualification_claimed':False}))
