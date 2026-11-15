#!/usr/bin/env python3
"""Temporary synthetic parent-browser accounts; operator keys stay on this PC."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import secrets
import uuid

spec=importlib.util.spec_from_file_location('clinical_operator',Path(__file__).with_name('clinical-browser-fixtures.py'))
op=importlib.util.module_from_spec(spec)
spec.loader.exec_module(op)
PREFIX='MON_ENFANT_PARENT_BROWSER_'
ROLES=('DOCTOR','PARENT','SECOND','OUTSIDE')
STATE=Path.home()/'.local/state/mon-enfant/parent-browser'

def path(run):
    if not re.fullmatch('[a-f0-9]{16}',run or ''):raise RuntimeError('Invalid fixture run')
    return STATE/(run+'.json')

def save(state,credentials):
    STATE.mkdir(parents=True,exist_ok=True,mode=0o700);STATE.chmod(0o700)
    for target,value in [(path(state['run']),json.dumps(state)),(path(state['run']).with_suffix('.env'),''.join(k+'='+v+'\n' for k,v in credentials.items()))]:
        target.touch(mode=0o600,exist_ok=True);target.chmod(0o600);target.write_text(value)

def load(run):
    state=json.loads(path(run).read_text());assert state['run']==run
    for actor in state['actors']:
        uuid.UUID(actor['id']);assert actor['role'] in ROLES
    return state

def validate(state):
    ids=','.join("'"+str(uuid.UUID(a['id']))+"'" for a in state['actors'])
    if not ids:return None
    rows=op.sql(f"select count(*)::integer n from auth.users where id in({ids}) and raw_app_meta_data->>'synthetic_fixture'='true' and raw_app_meta_data->>'fixture_kind'='parent_browser' and raw_app_meta_data->>'fixture_run'='{state['run']}' and email like 'qa-parent-{state['run']}-%@example.invalid'")
    if rows!=[{'n':len(state['actors'])}]:raise RuntimeError('Fixture scope check failed')
    return ids

def prepare():
    if any(name.startswith(PREFIX) for name in op.secret_names()):raise RuntimeError('Finish the recorded parent fixture first')
    state={'run':uuid.uuid4().hex[:16],'actors':[],'secrets':[]};credentials={};save(state,credentials)
    try:
        for role in ROLES:
            email=f"qa-parent-{state['run']}-{role.lower()}@example.invalid";password=secrets.token_urlsafe(32)
            user=op.api('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'synthetic_fixture':True,'fixture_kind':'parent_browser','fixture_run':state['run']}})
            uid=str(uuid.UUID(user['id']));state['actors'].append({'id':uid,'role':role});save(state,credentials)
            if role in ('DOCTOR','OUTSIDE'):
                op.sql(f"insert into public.professional_profiles(user_id,role,verification_status,professional_id) values('{uid}','doctor','approved','QAP-{state['run']}-{role}')")
            if role=='DOCTOR':
                op.sql(f"insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) select '{uid}',c,true,'{uid}' from unnest(array['consultation','growth','vaccination','appointment']) c")
            for field,value in [('EMAIL',email),('PASSWORD',password)]:
                key=PREFIX+role+'_'+field;credentials[key]=value;state['secrets'].append(key);save(state,credentials)
                op.command(['gh','secret','set',key,'--repo',op.REPO],value)
        key=PREFIX+'PUBLIC_KEY';public=op.CFG.get('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') or op.CFG.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
        if not public:raise RuntimeError('Public application key missing')
        credentials[key]=public;state['secrets'].append(key);save(state,credentials);op.command(['gh','secret','set',key,'--repo',op.REPO],public)
    except Exception:
        print(json.dumps({'run':state['run'],'setup_incomplete':True,'cleanup_required':True}),flush=True);raise
    print(json.dumps({'run':state['run'],'accounts_prepared':len(state['actors']),'temporary_encrypted_secrets':len(state['secrets']),'outgoing_email_sent':False}),flush=True)

def inspect(run):
    state=load(run);ids=validate(state)
    if len(state['actors'])!=4:raise RuntimeError('Incomplete fixture')
    doctor=next(a['id'] for a in state['actors'] if a['role']=='DOCTOR')
    data=op.sql(f"""with children as(select id from public.children where created_by='{doctor}') select
    (select count(*) from children)::integer children,
    (select count(*) from public.clinical_entries where child_id in(select id from children))::integer clinical_revisions,
    (select count(*) from private.guardian_claims c join private.guardian_invitations i on i.id=c.invitation_id where i.child_id in(select id from children))::integer claims,
    (select count(*) from private.guardian_links where child_id in(select id from children))::integer guardian_links,
    (select count(*) from private.guardian_links where child_id in(select id from children) and revoked_at is null)::integer active_links,
    (select count(*) from private.parent_correction_requests where child_id in(select id from children))::integer requests,
    (select count(*) from private.parent_correction_responses s join private.parent_correction_requests r on r.id=s.request_id where r.child_id in(select id from children))::integer responses,
    (select count(*) from public.children where created_by in({ids}) and created_by<>'{doctor}')::integer other_created_children""")
    expected={'children':3,'clinical_revisions':12,'claims':6,'guardian_links':6,'active_links':0,'requests':3,'responses':3,'other_created_children':0}
    if data!=[expected]:raise RuntimeError('Full three-viewport parent persistence not proven')
    source=op.sql("select status,revision,(select count(*)::integer from public.vaccine_rules r where r.version_id=v.id) rules from public.vaccine_versions v where parent_id is null")
    if source!=[{'status':'draft','revision':1,'rules':25}]:raise RuntimeError('Original draft was changed')
    print(json.dumps({'run':run,'database_persistence_verified':True,**expected,'original_draft_preserved':True}),flush=True)

def cleanup(run):
    state=load(run);ids=validate(state)
    allowed={PREFIX+role+'_'+field for role in ROLES for field in ('EMAIL','PASSWORD')}|{PREFIX+'PUBLIC_KEY'}
    if not set(state['secrets']).issubset(allowed):raise RuntimeError('Unexpected cleanup secret scope')
    if ids:
        doctor=next((a['id'] for a in state['actors'] if a['role']=='DOCTOR'),None)
        if doctor:
            op.sql(f"""begin;
            with ended as(update private.guardian_links set revoked_at=now(),revoked_by='{doctor}',revocation_reason='Fermeture de liens entièrement fictifs après test navigateur.' where child_id in(select id from public.children where created_by='{doctor}') and revoked_at is null returning id,child_id)
            insert into private.guardian_events(actor_id,child_id,entity_id,kind,reason) select '{doctor}',child_id,id,'link_revoked','Fermeture du test entièrement fictif.' from ended;
            update private.guardian_invitations set revoked_at=now() where created_by='{doctor}' and revoked_at is null;
            update private.guardian_claims set state='cancelled',revision=revision+1,decided_at=now() where invitation_id in(select id from private.guardian_invitations where created_by='{doctor}') and state='pending';
            update public.access_grants set revoked_at=now() where professional_id in({ids}) and revoked_at is null;
            update public.professional_facilities set revoked_at=now() where professional_id in({ids}) and revoked_at is null;
            update public.professional_capabilities set enabled=false where professional_id in({ids});
            update public.professional_profiles set verification_status='suspended' where user_id in({ids});
            delete from auth.sessions where user_id in({ids});commit;""")
        for actor in state['actors']:op.api('/auth/v1/admin/users/'+actor['id'],{'ban_duration':'876000h'},'PUT')
        proof=op.sql(f"select (select count(*)::integer from auth.sessions where user_id in({ids})) sessions,(select count(*)::integer from auth.users where id in({ids}) and banned_until>now()) banned,(select count(*)::integer from private.guardian_links where guardian_id in({ids}) and revoked_at is null) active_links,(select count(*)::integer from public.access_grants where professional_id in({ids}) and revoked_at is null) active_grants,(select count(*)::integer from public.professional_capabilities where professional_id in({ids}) and enabled) capabilities")
        if proof!=[{'sessions':0,'banned':len(state['actors']),'active_links':0,'active_grants':0,'capabilities':0}]:raise RuntimeError('Fixture retirement not proven')
    present=op.secret_names()
    for name in state['secrets']:
        if name in present:op.command(['gh','secret','delete',name,'--repo',op.REPO])
    if set(state['secrets'])&op.secret_names():raise RuntimeError('Temporary secrets remain')
    # Owner-visible hardware handoffs contain a live invitation or temporary login.
    # Remove only these fixed names after the actors have been fully retired.
    for suffix in ('-hardware-qr.png','-hardware-invitation.html','-hardware-parent.txt'):
        handoff=STATE/(run+suffix)
        handoff.unlink(missing_ok=True)
        if handoff.exists():raise RuntimeError('Hardware handoff retirement failed')
    path(run).with_suffix('.env').unlink(missing_ok=True);path(run).unlink()
    print(json.dumps({'run':run,'accounts_retired':len(state['actors']),'temporary_secrets_removed':len(state['secrets']),'retirement_verified':True}),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);group=parser.add_mutually_exclusive_group(required=True)
    for flag in ('prepare','check','cleanup'):group.add_argument('--'+flag,action='store_true')
    parser.add_argument('--run');args=parser.parse_args()
    try:
        if args.prepare:prepare()
        elif args.check:inspect(args.run)
        else:cleanup(args.run)
    except Exception:
        print('Parent fixture operation failed; private state retained and credentials/provider responses withheld.',flush=True);raise SystemExit(1) from None
