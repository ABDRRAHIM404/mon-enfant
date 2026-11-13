#!/usr/bin/env python3
"""Prepare/check/retire synthetic accounts for manual cloud browser checks.
Operator API credentials never leave this PC. Only temporary fixture credentials
are uploaded through stdin to dedicated encrypted GitHub secrets.
"""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid
from operator_http import Browser

PROJECT='zkkasbxvdvecnafgjpxd'
REPO='ABDRRAHIM404/mon-enfant'
BUCKET='professional-evidence'
ROLES=('desktop','tablet','mobile','reviewer')
ROOT=Path(os.environ.get('MON_ENFANT_OPERATOR_ROOT',Path(__file__).resolve().parent.parent))
STATE_ROOT=Path.home()/'.local/state/mon-enfant/readiness'
CFG={line.split('=',1)[0]:line.split('=',1)[1] for line in (ROOT/'.env.local').read_text().splitlines() if line and not line.startswith('#')}
ENV={**os.environ,**CFG}
BASE=CFG['NEXT_PUBLIC_SUPABASE_URL']
assert BASE==f'https://{PROJECT}.supabase.co'
assert (ROOT/'supabase/.temp/project-ref').read_text().strip()==PROJECT
SERVICE=None

def command(args,input_text=None):
    result=subprocess.run(args,input=input_text,text=True,capture_output=True,env=ENV,cwd=ROOT)
    if result.returncode:
        raise RuntimeError('Scoped readiness operator command failed; no credential output was printed')
    return result.stdout

def api(path,data=None,method='POST'):
    global SERVICE
    if SERVICE is None:
        result=json.loads(command(['supabase','projects','api-keys','--project-ref',PROJECT,'--reveal','--output-format','json']))
        keys=result if isinstance(result,list) else result.get('api_keys',result.get('keys',[]))
        SERVICE=next(item['api_key'] for item in keys if item['name']=='service_role')
    request=urllib.request.Request(BASE+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers={'apikey':SERVICE,'Authorization':'Bearer '+SERVICE,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(request,timeout=40) as response:return json.loads(response.read() or 'null')
    except urllib.error.HTTPError as error:
        error.read()
        raise RuntimeError('Scoped readiness provider operation failed without exposing its response') from None

def sql(query):
    with tempfile.NamedTemporaryFile(mode='w',suffix='.sql') as file:
        file.write(query);file.flush()
        result=command(['supabase','db','query','--linked','--file',file.name,'--output-format','json'])
    return json.loads(result).get('rows',[])

def existing_secrets():
    return {row['name'] for row in json.loads(command(['gh','secret','list','--repo',REPO,'--json','name']))}

def state_path(run):
    if not re.fullmatch('[a-f0-9]{16}',run):raise RuntimeError('Invalid synthetic run identifier')
    return STATE_ROOT/(run+'.json')

def save(state,credentials):
    STATE_ROOT.mkdir(parents=True,exist_ok=True,mode=0o700);STATE_ROOT.chmod(0o700)
    path=state_path(state['run']);path.touch(mode=0o600,exist_ok=True);path.chmod(0o600)
    path.write_text(json.dumps(state))
    env_path=path.with_suffix('.env');env_path.touch(mode=0o600,exist_ok=True);env_path.chmod(0o600)
    env_path.write_text(''.join(key+'='+value+'\n' for key,value in credentials.items()))

def load(run):
    path=state_path(run);state=json.loads(path.read_text());assert state['run']==run
    credentials=dict(line.split('=',1) for line in path.with_suffix('.env').read_text().splitlines())
    for actor in state['actors']:
        uuid.UUID(actor['id']);assert actor['role'] in ROLES
    return state,credentials

def validate(state):
    ids=','.join("'"+actor['id']+"'" for actor in state['actors'])
    rows=sql(f"select count(*)::integer n from auth.users where id in({ids}) and raw_app_meta_data->>'synthetic_fixture'='true' and raw_app_meta_data->>'fixture_run'='{state['run']}' and email like 'qa-readiness-{state['run']}-%@example.invalid'")
    if rows[0]['n']!=len(state['actors']):raise RuntimeError('Fixture identity check failed; no cleanup performed')
    return ids

def prepare():
    if any(name.startswith('MON_ENFANT_READINESS_') for name in existing_secrets()):raise RuntimeError('Dedicated readiness secrets already exist; finish their recorded run before preparing another')
    real=sql("select count(*)::integer n from public.verification_requests r join auth.users u on u.id=r.professional_id where coalesce(u.raw_app_meta_data->>'synthetic_fixture','false')<>'true'")
    if real[0]['n']:raise RuntimeError('This project contains non-fixture identity applications; use an isolated synthetic staging project for reviewer browser tests')
    state={'run':uuid.uuid4().hex[:16],'actors':[],'secrets':[]};credentials={};save(state,credentials)
    try:
        for role in ROLES:
            email=f"qa-readiness-{state['run']}-{role}@example.invalid";password=secrets.token_urlsafe(32)
            user=api('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'synthetic_fixture':True,'fixture_run':state['run']}})
            uid=str(uuid.UUID(user['id']));state['actors'].append({'id':uid,'role':role})
            prefix='MON_ENFANT_READINESS_'+role.upper()
            credentials[prefix+'_EMAIL']=email;credentials[prefix+'_PASSWORD']=password;save(state,credentials)
            if role=='reviewer':
                sql(f"begin; insert into public.professional_profiles(user_id,role,verification_status,professional_id) values('{uid}','admin','approved','QAR-{state['run']}-REVIEWER'); insert into private.staff_permissions(user_id,can_review_professionals) values('{uid}',true); commit;")
            for suffix in ('EMAIL','PASSWORD'):
                key=prefix+'_'+suffix
                command(['gh','secret','set',key,'--repo',REPO],credentials[key])
                state['secrets'].append(key);save(state,credentials)
    except Exception:
        print(json.dumps({'run':state['run'],'setup_incomplete':True,'cleanup_required':True}),flush=True)
        raise
    print(json.dumps({'run':state['run'],'accounts_prepared':len(state['actors']),'temporary_encrypted_secrets':len(state['secrets']),'outgoing_email_sent':False}))

def inspect(run,expected_bytes):
    state,_=load(run);ids=validate(state)
    data=sql(f"select u.id,(select count(*)::integer from public.verification_requests r where r.professional_id=u.id) applications,(select count(*)::integer from storage.objects o where o.bucket_id='{BUCKET}' and split_part(o.name,'/',1)=u.id::text) objects,(select coalesce(bool_and((o.metadata->>'size')::bigint={expected_bytes}),false) from storage.objects o where o.bucket_id='{BUCKET}' and split_part(o.name,'/',1)=u.id::text) sizes_match from auth.users u where u.id in({ids})")
    uploads=[row for row in data if row['id']!=next(actor['id'] for actor in state['actors'] if actor['role']=='reviewer')]
    if expected_bytes:
        if any(row['applications']!=1 or row['objects']!=1 or not row['sizes_match'] for row in uploads):raise RuntimeError('Expected exact-size private evidence persistence was not proven')
        statuses=sql(f"select count(*)::integer n from public.verification_requests r join public.verification_decisions d on d.request_id=r.id where r.professional_id in({ids}) and r.status='rejected' and d.decision='rejected'")
        if statuses[0]['n']!=3:raise RuntimeError('Expected synthetic review decisions were not persisted')
    elif any(row['applications'] or row['objects'] for row in data):raise RuntimeError('Rejected platform upload unexpectedly persisted data')
    print(json.dumps({'run':run,'accounts_checked':len(data),'exact_file_bytes':expected_bytes,'private_objects':sum(row['objects'] for row in data),'database_persistence_verified':True}))

def cleanup(run):
    state,credentials=load(run)
    if state['actors']:
        ids=validate(state)
        pending=sql(f"select id from public.verification_requests where professional_id in({ids}) and status='under_review'")
        if pending:
            reviewer=Browser();reviewer.login(credentials['MON_ENFANT_READINESS_REVIEWER_EMAIL'],credentials['MON_ENFANT_READINESS_REVIEWER_PASSWORD'])
            for row in pending:
                request=str(uuid.UUID(row['id']));path='/admin/verifications/'+request;_,page,_=reviewer.get(path)
                reviewer.submit(path,page,{'requestId':request,'decision':'rejected','reason':'Fermeture de justificatif entièrement fictif après test navigateur.'},lambda form:'decision' in form['names'])
            if sql(f"select count(*)::integer n from public.verification_requests where professional_id in({ids}) and status='under_review'")[0]['n']:raise RuntimeError('Fixture application cleanup did not complete')
        objects=sql(f"select name from storage.objects where bucket_id='{BUCKET}' and split_part(name,'/',1) in(select id::text from auth.users where id in({ids}))")
        names=[row['name'] for row in objects]
        if names:api('/storage/v1/object/'+BUCKET,{'prefixes':names},'DELETE')
        sql(f"begin; update private.staff_permissions set can_review_professionals=false,can_manage_clinical_permissions=false,can_manage_vaccine_catalog=false,can_review_vaccine_catalog=false where user_id in({ids}); update public.professional_capabilities set enabled=false where professional_id in({ids}); update public.professional_profiles set verification_status='suspended' where user_id in({ids}); delete from auth.sessions where user_id in({ids}); commit;")
        for actor in state['actors']:api('/auth/v1/admin/users/'+actor['id'],{'ban_duration':'876000h'},'PUT')
    present=existing_secrets()
    for name in state['secrets']:
        if name in present:command(['gh','secret','delete',name,'--repo',REPO])
    if set(state['secrets']) & existing_secrets():raise RuntimeError('Temporary readiness secrets remain; do not discard the recorded run')
    state_path(run).with_suffix('.env').unlink();state_path(run).unlink()
    print(json.dumps({'run':run,'accounts_retired':len(state['actors']),'temporary_secrets_removed':len(state['secrets']),'private_objects_removed':len(names) if state['actors'] else 0,'outgoing_email_sent':False}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--prepare',action='store_true');group.add_argument('--check',action='store_true');group.add_argument('--cleanup',action='store_true')
    parser.add_argument('--run');parser.add_argument('--expected-bytes',type=int,default=0)
    args=parser.parse_args()
    try:
        if args.prepare:prepare()
        elif args.check:inspect(args.run,args.expected_bytes)
        else:cleanup(args.run)
    except Exception:
        print('Readiness operator step failed. Inspect the recorded synthetic run; credentials and provider responses were not printed.',flush=True)
        raise SystemExit(1) from None
