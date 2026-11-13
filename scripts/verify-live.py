#!/usr/bin/env python3
"""Operator-only synthetic integration smoke test. No local build/browser or outgoing email.
Requires authenticated Supabase CLI and .env.local. Never prints credentials/tokens.
Fixtures are suspended and their grants revoked on completion; audit history is retained.
"""
import json,os,pathlib,secrets,subprocess,tempfile,urllib.request,urllib.error,uuid,datetime
ROOT=pathlib.Path(__file__).resolve().parent.parent
PROJECT='zkkasbxvdvecnafgjpxd'
assert (ROOT/'supabase/.temp/project-ref').read_text().strip()==PROJECT, 'Wrong linked project'
config=dict(line.split('=',1) for line in (ROOT/'.env.local').read_text().splitlines() if line and not line.startswith('#'))
BASE=config['NEXT_PUBLIC_SUPABASE_URL'];PUBLIC=config['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
assert BASE==f'https://{PROJECT}.supabase.co', 'Wrong integration target'
ENV=os.environ.copy();ENV.update(config)
keys_result=subprocess.run(['supabase','projects','api-keys','--project-ref',PROJECT,'--reveal','--output-format','json'],env=ENV,capture_output=True,text=True,check=True,cwd=ROOT)
key_data=json.loads(keys_result.stdout);keys=key_data if isinstance(key_data,list) else key_data.get('api_keys',key_data.get('keys',[]))
SERVICE=next((k.get('api_key',k.get('value')) for k in keys if k.get('name')=='service_role'),None)
assert SERVICE, 'CLI did not return an administrative key; no fixture was created'
run=uuid.uuid4().hex[:12];fixtures=[];sessions=[];checks=[];evidence_path=None;request_id=None;reviewer=None;child_id=None

def check(condition,label):
    if not condition: raise AssertionError(label)
    checks.append(label);print('PASS '+label,flush=True)
def api(path,method='GET',data=None,token=None,admin=False,raw=None,content_type=None):
    headers={'apikey':SERVICE if admin else PUBLIC}
    if admin or token: headers['Authorization']='Bearer '+(SERVICE if admin else token)
    body=raw if raw is not None else json.dumps(data).encode() if data is not None else None
    if body is not None: headers['Content-Type']=content_type or 'application/json'
    if path.startswith('/rest/'): headers['Prefer']='return=representation'
    req=urllib.request.Request(BASE+path,headers=headers,data=body,method=method)
    try:
        with urllib.request.urlopen(req,timeout=30) as response:
            payload=response.read();status=response.status
    except urllib.error.HTTPError as error: status=error.code;payload=error.read()
    try: value=json.loads(payload) if payload else None
    except (ValueError,UnicodeDecodeError): value=None
    return status,value

def sql(text):
    with tempfile.NamedTemporaryFile(mode='w',suffix='.sql') as f:
        f.write(text);f.flush()
        r=subprocess.run(['supabase','db','query','--linked','--file',f.name,'--output-format','json'],env=ENV,capture_output=True,text=True,cwd=ROOT)
    if r.returncode: raise AssertionError('Trusted fixture SQL operation failed')
    return json.loads(r.stdout).get('rows',[])
def user(kind):
    email=f'qa-{run}-{kind}@example.invalid';password=secrets.token_urlsafe(30)
    status,body=api('/auth/v1/admin/users','POST',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'synthetic_fixture':True,'fixture_run':run}},admin=True)
    check(status in (200,201) and body.get('id'),f'{kind}: create synthetic Auth fixture without email')
    uid=body['id'];fixtures.append(uid)
    status,session=api('/auth/v1/token?grant_type=password','POST',{'email':email,'password':password})
    check(status==200 and session.get('access_token'),f'{kind}: password authentication')
    sessions.append(session)
    return uid,session

def rpc(name,data,session): return api('/rest/v1/rpc/'+name,'POST',data,token=session['access_token'])
try:
    status,_=api('/auth/v1/health');check(status==200,'Hosted Auth health')
    status,_=api('/rest/v1/children?select=id');check(status in (401,403),'Anonymous clinical read denied')
    doctor,d=user('doctor');other,o=user('other');reviewer,a=user('reviewer');ordinary,b=user('admin-without-permission')
    for uid,session in [(doctor,d),(other,o),(reviewer,a),(ordinary,b)]:
        status,body=api('/rest/v1/professional_profiles','POST',{'user_id':uid},token=session['access_token'])
        check(status==201 and body[0]['verification_status']=='unverified',f'{uid[:8]}: PostgREST initializes only an unverified profile')
    status,_=api('/rest/v1/professional_profiles?user_id=eq.'+doctor,'PATCH',{'verification_status':'approved','professional_id':'FORGED'},token=d['access_token'])
    check(status in (401,403),'Direct profile self-approval denied')
    sql(f"begin; update public.professional_profiles set role='admin',verification_status='approved',professional_id='QA-ADMIN-{run}' where user_id='{reviewer}'; update public.professional_profiles set role='admin',verification_status='approved',professional_id='QA-ORDINARY-{run}' where user_id='{ordinary}'; insert into private.staff_permissions(user_id,can_review_professionals) values ('{reviewer}',true); commit;")
    status,allowed=rpc('can_review_professionals',{},a);check(status==200 and allowed is True,'Explicit reviewer permission enforced from current database state')
    status,allowed=rpc('can_review_professionals',{},b);check(status==200 and allowed is False,'Admin role alone does not grant review permission')
    request_id=str(uuid.uuid4());evidence_path=f'{doctor}/{request_id}/evidence.pdf'
    document=b'%PDF-1.4\n% Synthetic integration evidence. No identity data.\n%%EOF\n'
    status,_=api('/storage/v1/object/professional-evidence/'+evidence_path,'POST',token=d['access_token'],raw=document,content_type='application/pdf')
    check(status in (200,201),'Owner uploads evidence into the private bucket')
    status,_=api('/storage/v1/object/authenticated/professional-evidence/'+evidence_path,token=o['access_token'])
    check(status>=400,'Another doctor cannot read private evidence')
    payload={'p_request_id':request_id,'p_display_name':'Docteur QA Fictif','p_registration_number':'QA-'+run.upper(),'p_facility_name':'Centre QA Fictif','p_evidence_path':evidence_path}
    status,_=rpc('submit_verification',payload,d);check(status in (200,201,204),'Atomic application submission through live PostgREST')
    status,rows=api('/rest/v1/professional_profiles?select=verification_status&user_id=eq.'+doctor,token=d['access_token']);check(status==200 and rows[0]['verification_status']=='under_review','Submission leaves the account under review')
    decision={'p_request_id':request_id,'p_decision':'approved','p_reason':'Contrôles automatisés de documents fictifs, sans valeur de qualification médicale.','p_identity_checked':True,'p_registration_checked':True}
    status,_=rpc('review_verification',decision,d);check(status>=400,'Doctor cannot self-approve through RPC')
    status,_=rpc('review_verification',decision,b);check(status>=400,'Ordinary admin cannot approve through RPC')
    status,_=rpc('review_verification',{**decision,'p_identity_checked':False},a);check(status>=400,'Approval requires actual reviewer attestations')
    status,_=rpc('record_evidence_access',{'p_request_id':request_id},a);check(status in (200,204),'Reviewer evidence access is audited')
    status,signed=api('/storage/v1/object/sign/professional-evidence/'+evidence_path,'POST',{'expiresIn':60},token=a['access_token']);check(status==200 and bool(signed.get('signedURL')),'Authorized reviewer can obtain a short-lived evidence URL')
    status,_=rpc('review_verification',decision,a);check(status in (200,204),'Explicit reviewer approves the account')
    status,rows=api('/rest/v1/professional_profiles?select=verification_status,professional_id&user_id=eq.'+doctor,token=d['access_token']);check(status==200 and rows[0]['verification_status']=='approved' and rows[0]['professional_id'].startswith('PRO-'),'Approval assigns a platform professional ID')
    status,_=rpc('review_verification',decision,a);check(status>=400,'A second decision cannot overwrite the first')
    child_id=str(uuid.uuid4())
    sql(f"begin; insert into public.children(id,given_name,family_name,birth_date,sex,created_by) values ('{child_id}','QA Fictif','{run}','2026-01-01','unknown','{doctor}'); insert into public.access_grants(child_id,professional_id,granted_by) values ('{child_id}','{doctor}','{reviewer}'); commit;")
    status,rows=api('/rest/v1/children?select=id&id=eq.'+child_id,token=d['access_token']);check(status==200 and rows==[{'id':child_id}],'Approved doctor can read only the explicitly granted child')
    status,rows=api('/rest/v1/children?select=id&id=eq.'+child_id,token=a['access_token']);check(status==200 and rows==[],'Reviewer admin has no blanket clinical access')
    status,_=rpc('set_professional_suspension',{'p_user_id':doctor,'p_suspend':True,'p_reason':'Suspension de la fixture de test.'},a);check(status in (200,204),'Audited suspension succeeds')
    status,rows=api('/rest/v1/children?select=id&id=eq.'+child_id,token=d['access_token']);check(status==200 and rows==[],'Suspension cuts clinical reads with the existing access token')
    status,_=rpc('set_professional_suspension',{'p_user_id':doctor,'p_suspend':False,'p_reason':'Réactivation de la fixture de test.'},a);check(status in (200,204),'Audited reactivation succeeds')
    status,refreshed=api('/auth/v1/token?grant_type=refresh_token','POST',{'refresh_token':d['refresh_token']});check(status==200 and refreshed.get('access_token'),'Refresh-token lifecycle works');sessions.append(refreshed)
    status,_=api('/auth/v1/logout?scope=global','POST',token=refreshed['access_token']);check(status in (200,204),'Global sign-out succeeds')
    status,_=api('/auth/v1/token?grant_type=refresh_token','POST',{'refresh_token':refreshed['refresh_token']});check(status>=400,'Sign-out invalidates refresh credentials')
finally:
    if evidence_path:
        api('/storage/v1/object/professional-evidence','DELETE',{'prefixes':[evidence_path]},admin=True)
    if fixtures:
        literals=','.join("'"+v+"'" for v in fixtures)
        sql(f"begin; update public.access_grants set revoked_at=now() where professional_id in ({literals}); update private.staff_permissions set can_review_professionals=false where user_id in ({literals}); update public.professional_profiles set verification_status='suspended' where user_id in ({literals}); commit;")
    for session in sessions: api('/auth/v1/logout?scope=global','POST',token=session['access_token'])
report={'run':run,'project':PROJECT,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':checks,'fixture_users_suspended':len(fixtures),'fixture_child_id':child_id,'outgoing_email_sent':False}
print(json.dumps(report,ensure_ascii=False))
