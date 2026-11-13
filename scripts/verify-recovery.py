#!/usr/bin/env python3
"""Test hosted recovery using an operator-generated one-use token. No email is sent.
No browser or build runs locally. Never prints token URLs, cookies or credentials.
"""
import os,json,pathlib,subprocess,secrets,urllib.request,urllib.error,urllib.parse,uuid,tempfile
from operator_http import Browser
ROOT=pathlib.Path(__file__).resolve().parent.parent;PROJECT='zkkasbxvdvecnafgjpxd'
assert (ROOT/'supabase/.temp/project-ref').read_text().strip()==PROJECT
cfg=dict(line.split('=',1) for line in (ROOT/'.env.local').read_text().splitlines() if line and not line.startswith('#'))
env={**os.environ,**cfg};BASE=cfg['NEXT_PUBLIC_SUPABASE_URL'];PUBLIC=cfg['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
assert BASE==f'https://{PROJECT}.supabase.co'
r=subprocess.run(['supabase','projects','api-keys','--project-ref',PROJECT,'--reveal','--output-format','json'],env=env,capture_output=True,text=True,check=True,cwd=ROOT)
d=json.loads(r.stdout);keys=d if isinstance(d,list) else d.get('api_keys',d.get('keys',[]));SERVICE=next(k['api_key'] for k in keys if k['name']=='service_role')
checks=[];user=None

def check(value,label):
 if not value:raise AssertionError(label)
 checks.append(label);print('PASS '+label,flush=True)
def api(path,data,admin=False):
 headers={'apikey':SERVICE if admin else PUBLIC,'Content-Type':'application/json'}
 if admin:headers['Authorization']='Bearer '+SERVICE
 req=urllib.request.Request(BASE+path,data=json.dumps(data).encode(),headers=headers,method='POST')
 try:
  with urllib.request.urlopen(req,timeout=30) as r:return r.status,json.loads(r.read() or 'null')
 except urllib.error.HTTPError as e:return e.code,None
try:
 email=f'qa-recovery-{uuid.uuid4().hex[:12]}@example.invalid';old=secrets.token_urlsafe(30);new=secrets.token_urlsafe(30)
 status,user=api('/auth/v1/admin/users',{'email':email,'password':old,'email_confirm':True,'app_metadata':{'synthetic_fixture':True}},True)
 check(status in (200,201) and user.get('id'),'Synthetic recovery user created without outgoing mail')
 status,old_session=api('/auth/v1/token?grant_type=password',{'email':email,'password':old});check(status==200,'Original credential works before recovery')
 status,link=api('/auth/v1/admin/generate_link',{'type':'recovery','email':email},True)
 token=link.get('hashed_token') or link.get('properties',{}).get('hashed_token') if link else None
 check(status==200 and token,'Provider creates a one-use recovery token without sending it')
 path='/auth/confirm?'+urllib.parse.urlencode({'token_hash':token,'type':'recovery'})
 browser=Browser();url,page,headers=browser.get(path)
 check(url.endswith('/auth/reset-password') and 'Choisissez un nouveau mot de passe' in page,'Hosted recovery token creates an authenticated reset session')
 _,mismatch,_=browser.submit('/auth/reset-password',page,{'password':new,'confirmation':new+'different'},lambda f:'confirmation' in f['names'])
 check('Les deux mots de passe doivent être identiques' in mismatch,'Mismatched passwords are rejected without changing credentials')
 status,_=api('/auth/v1/token?grant_type=password',{'email':email,'password':old});check(status==200,'Original password remains valid after rejected input')
 _,page,_=browser.get('/auth/reset-password')
 url,page,_=browser.submit('/auth/reset-password',page,{'password':new,'confirmation':new},lambda f:'confirmation' in f['names'])
 check('/login?password=updated' in url and 'Votre mot de passe a été modifié' in page,'Hosted reset saves the password and signs out')
 status,_=api('/auth/v1/token?grant_type=password',{'email':email,'password':old});check(status>=400,'Old password is invalid after recovery')
 status,new_session=api('/auth/v1/token?grant_type=password',{'email':email,'password':new});check(status==200 and new_session.get('access_token'),'New password authenticates successfully')
 status,_=api('/auth/v1/token?grant_type=refresh_token',{'refresh_token':old_session['refresh_token']});check(status>=400,'Password reset invalidates earlier refresh sessions')
 url,_,_=browser.get('/auth/reset-password');check('/login' in url,'Reset session is cleared after the successful change')
 fresh=Browser();url,_,_=fresh.get(path);check('recovery=invalid' in url,'Recovery token cannot be reused and returns to self-service recovery')
 missing_browser=Browser();url,page,_=missing_browser.get('/auth/callback?next=reset-password&code=invalid-synthetic-code');check('recovery=browser' in url and 'Ce navigateur ne peut pas confirmer la demande' in page,'Hosted PKCE callback explains missing browser proof without claiming the link expired')
finally:
 if user and user.get('id'):
  uid=str(uuid.UUID(user['id']))
  with tempfile.NamedTemporaryFile(mode='w',suffix='.sql') as f:
   f.write(f"begin; insert into public.professional_profiles(user_id) values ('{uid}') on conflict (user_id) do nothing; update public.professional_profiles set verification_status='suspended' where user_id='{uid}'; commit;");f.flush()
   result=subprocess.run(['supabase','db','query','--linked','--file',f.name,'--output-format','json'],env=env,capture_output=True,text=True,cwd=ROOT)
   assert result.returncode==0,'Recovery fixture retirement failed'
print(json.dumps({'checks':checks,'fixture_suspended':True,'outgoing_email_sent':False}))
