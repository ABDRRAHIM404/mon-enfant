#!/usr/bin/env python3
"""Low-resource operator smoke test of actual hosted HTML forms. No browser or mail.
Uses only synthetic Auth fixtures, never prints tokens, and suspends fixtures at exit.
Run after the feature is deployed to the canonical development origin.
"""
import os,json,pathlib,subprocess,secrets,urllib.request,urllib.error,http.cookiejar,html.parser,uuid,tempfile
from operator_http import Browser,Forms
ROOT=pathlib.Path(__file__).resolve().parent.parent
PROJECT='zkkasbxvdvecnafgjpxd';SITE='https://mon-enfant.vercel.app'
assert (ROOT/'supabase/.temp/project-ref').read_text().strip()==PROJECT
cfg=dict(line.split('=',1) for line in (ROOT/'.env.local').read_text().splitlines() if line and not line.startswith('#'))
env={**os.environ,**cfg};BASE=cfg['NEXT_PUBLIC_SUPABASE_URL'];PUBLIC=cfg['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
assert BASE==f'https://{PROJECT}.supabase.co'
r=subprocess.run(['supabase','projects','api-keys','--project-ref',PROJECT,'--reveal','--output-format','json'],env=env,capture_output=True,text=True,check=True,cwd=ROOT)
d=json.loads(r.stdout);keys=d if isinstance(d,list) else d.get('api_keys',d.get('keys',[]));SERVICE=next(k['api_key'] for k in keys if k['name']=='service_role')
fixtures=[];evidence_path=None;checks=[];run=uuid.uuid4().hex[:10];staff=None;reviewReady=False
def check(value,label):
 if not value:raise AssertionError(label)
 checks.append(label);print('PASS '+label,flush=True)
def admin(path,data,method='POST'):
 req=urllib.request.Request(BASE+path,data=json.dumps(data).encode(),method=method,headers={'apikey':SERVICE,'Authorization':'Bearer '+SERVICE,'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=30) as r:return json.loads(r.read() or 'null')
def sql(text):
 with tempfile.NamedTemporaryFile(mode='w',suffix='.sql') as f:
  f.write(text);f.flush();r=subprocess.run(['supabase','db','query','--linked','--file',f.name,'--output-format','json'],env=env,capture_output=True,text=True,cwd=ROOT)
 if r.returncode:raise AssertionError('Trusted fixture operation failed')
 return json.loads(r.stdout).get('rows',[])
def create(kind):
 email=f'qa-web-{run}-{kind}@example.invalid';password=secrets.token_urlsafe(30)
 user=admin('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'synthetic_fixture':True,'fixture_run':run}})
 fixtures.append(user['id']);return user['id'],email,password
try:
 doctor,email,password=create('doctor');owner=Browser();url,page,_=owner.login(email,password)
 check(url.endswith('/account') and 'Activer mon espace soignant' in page,'Hosted login form creates a working server session')
 auth_cookies=[c for c in owner.jar if c.name.startswith('sb-') and 'auth-token' in c.name]
 check(auth_cookies and all(c.secure and c.has_nonstandard_attr('HttpOnly') for c in auth_cookies),'Hosted session cookies are Secure and HTTP-only')
 url,page,_=owner.submit('/account',page,{},lambda f:'Activer mon espace soignant' in f['text'])
 check(url.endswith('/provisional') and 'Non vérifié' in page,'Profile activation form initializes the unverified account')
 reviewer,email2,password2=create('reviewer');staff=Browser();_,page,_=staff.login(email2,password2)
 staff.submit('/account',page,{},lambda f:'Activer mon espace soignant' in f['text'])
 sql(f"begin; update public.professional_profiles set role='admin',verification_status='approved',professional_id='QAW-ADMIN-{run}' where user_id='{reviewer}'; insert into private.staff_permissions(user_id,can_review_professionals) values ('{reviewer}',true); commit;")
 reviewReady=True
 _,page,_=owner.get('/verification')
 check(any('evidence' in f['names'] for f in Forms(page).forms),'Authenticated verification page renders its submission form')
 doc=b'%PDF-1.4\n% Synthetic web fixture. No identity information.\n%%EOF\n'
 _,page,_=owner.submit('/verification',page,{'displayName':'Docteur QA Web','registration':'QAW-'+run,'facility':'Centre QA Fictif','syntheticOnly':'on'},lambda f:'evidence' in f['names'],('evidence',doc))
 check('Votre demande est enregistrée' in page or 'Votre demande est en cours d’examen' in page,'Hosted multipart server action reaches the submitted view')
 requests=sql(f"select id,evidence_path from public.verification_requests where professional_id='{doctor}' and status='under_review'")
 check(len(requests)==1,'Hosted submission persisted one pending application')
 request=requests[0]['id'];evidence_path=requests[0]['evidence_path']
 url,_,_=owner.get('/dashboard');check(url.endswith('/account'),'Pending doctor is denied the clinical workspace')
 url,_,_=owner.get('/admin/verifications');check(url.endswith('/account'),'Doctor is denied the admin queue')
 _,page,_=staff.get('/admin/verifications/'+request)
 check('Docteur QA Web' in page and 'registrationChecked' in page,'Authorized reviewer can open the actual application detail')
 _,download,_=staff.get('/admin/evidence/'+request)
 check(download.startswith('%PDF-'),'Authorized hosted download serves the private evidence')
 _,page,_=staff.submit('/admin/verifications/'+request,page,{'requestId':request,'decision':'approved','reason':'Revue automatisée de justificatifs fictifs, sans valeur médicale.','identityChecked':'on','registrationChecked':'on'},lambda f:'decision' in f['names'])
 check(sql(f"select verification_status from public.professional_profiles where user_id='{doctor}'")[0]['verification_status']=='approved','Hosted review form approves atomically through the guarded RPC')
 _,page,_=owner.get('/account');check('Ouvrir mon espace' in page,'Approved doctor receives the clinical workspace link')
 _,page,_=owner.get('/verification');check('Motif de décision' in page,'Applicant history renders the persisted decision relationship')
 _,page,_=owner.get('/account');url,page,_=owner.submit('/account',page,{},lambda f:'Se déconnecter' in f['text'])
 check('/login' in url and 'Heureux de vous retrouver' in page,'Hosted logout clears the session and returns to login')
 url,_,_=owner.get('/account');check('/login' in url,'The logged-out cookie jar cannot revisit the protected account')
finally:
 # Close only our synthetic pending applications, including previously interrupted runs.
 if reviewReady:
  pending=sql(f"select r.id,r.professional_id,r.evidence_path from public.verification_requests r join auth.users u on u.id=r.professional_id join public.professional_profiles p on p.user_id=u.id where r.status='under_review' and p.role='doctor' and u.raw_app_meta_data->>'synthetic_fixture'='true' and u.email like 'qa-%@example.invalid' and (p.verification_status='suspended' or u.raw_app_meta_data->>'fixture_run'='{run}')")
  for item in pending:
   uid=str(uuid.UUID(item['professional_id']));rid=str(uuid.UUID(item['id']))
   sql(f"update public.professional_profiles set verification_status='under_review' where user_id='{uid}'")
   _,pending_page,_=staff.get('/admin/verifications/'+rid)
   staff.submit('/admin/verifications/'+rid,pending_page,{'requestId':rid,'decision':'rejected','reason':'Fermeture de la fixture fictive après vérification automatisée.'},lambda f:'decision' in f['names'])
   assert sql(f"select status from public.verification_requests where id='{rid}'")[0]['status']=='rejected','Synthetic review cleanup failed'
   admin('/storage/v1/object/professional-evidence',{'prefixes':[item['evidence_path']]},'DELETE')
   sql(f"update public.professional_profiles set verification_status='suspended' where user_id='{uid}'")
 if evidence_path:admin('/storage/v1/object/professional-evidence',{'prefixes':[evidence_path]},'DELETE')
 if fixtures:
  ids=','.join("'"+v+"'" for v in fixtures)
  sql(f"begin; update private.staff_permissions set can_review_professionals=false where user_id in ({ids}); update public.professional_profiles set verification_status='suspended' where user_id in ({ids}); commit;")
print(json.dumps({'run':run,'checks':checks,'fixture_users_suspended':len(fixtures),'outgoing_email_sent':False}))
