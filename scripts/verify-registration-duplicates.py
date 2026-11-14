#!/usr/bin/env python3
"""Small native HTTPS acceptance for fictional duplicate cases; no browser/build."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import secrets
import urllib.request
import urllib.error
import uuid

spec=importlib.util.spec_from_file_location('operator_fixture',Path(__file__).with_name('clinical-browser-fixtures.py'))
op=importlib.util.module_from_spec(spec);spec.loader.exec_module(op)
PUBLIC=op.CFG.get('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') or op.CFG.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
STATE=Path.home()/'.local/state/mon-enfant/duplicate-checks';STATE.mkdir(parents=True,exist_ok=True,mode=0o700);STATE.chmod(0o700)
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--cleanup');args=parser.parse_args()
if args.cleanup and not re.fullmatch('[a-f0-9]{16}',args.cleanup):raise SystemExit('Invalid fixture run')
run=args.cleanup or uuid.uuid4().hex[:16];stage='setup';actors=[];state_path=STATE/(run+'.json')
def save():
    state_path.touch(mode=0o600,exist_ok=True);state_path.chmod(0o600);state_path.write_text(json.dumps({'run':run,'actors':[{'id':a['id'],'role':a['role']} for a in actors]}))
def api(path,body,token=None):
    headers={'apikey':PUBLIC,'Content-Type':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    request=urllib.request.Request(op.BASE+path,data=json.dumps(body).encode(),headers=headers,method='POST')
    try:
        with urllib.request.urlopen(request,timeout=30) as response:return response.status,json.loads(response.read() or 'null')
    except urllib.error.HTTPError as error:
        payload=json.loads(error.read() or 'null');code=payload.get('code') if isinstance(payload,dict) else None
        return error.code,{'code':code if isinstance(code,str) and re.fullmatch('[A-Z0-9]{5}|PGRST[0-9]{3}',code) else None}
def rpc(actor,name,args):return api('/rest/v1/rpc/'+name,args,actor['token'])
def ok(result):
    status,data=result
    if status not in (200,204):raise RuntimeError('Expected successful scoped RPC')
    return data
def new_actor(role):
    email=f'qa-duplicate-{run}-{role.lower()}@example.invalid';password=secrets.token_urlsafe(32)
    user=op.api('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'synthetic_fixture':True,'fixture_kind':'duplicate_check','fixture_run':run}})
    actor={'id':str(uuid.UUID(user['id'])),'role':role};actors.append(actor);save()
    actual='admin' if role=='ADMIN' else 'doctor'
    op.sql(f"insert into public.professional_profiles(user_id,role,verification_status,professional_id) values('{actor['id']}','{actual}','approved','QAD-{run}-{role}')")
    session=ok(api('/auth/v1/token?grant_type=password',{'email':email,'password':password}));actor['token']=session['access_token']
    if actual=='doctor':actor['facility']=ok(rpc(actor,'create_facility',{'p_operation_id':str(uuid.uuid4()),'p_name':'Centre de doublons entièrement fictif '+role,'p_city':'Rabat fictif'}))
    return actor

def cleanup():
    rows=op.sql(f"select id from auth.users where raw_app_meta_data->>'fixture_kind'='duplicate_check' and raw_app_meta_data->>'fixture_run'='{run}' and raw_app_meta_data->>'synthetic_fixture'='true' and email like 'qa-duplicate-{run}-%@example.invalid'")
    ids=','.join("'"+str(uuid.UUID(row['id']))+"'" for row in rows)
    if ids:
        op.sql(f"begin; update public.access_grants set revoked_at=now() where professional_id in({ids}) and revoked_at is null; update public.professional_facilities set revoked_at=now() where professional_id in({ids}) and revoked_at is null; update public.professional_capabilities set enabled=false where professional_id in({ids}); update public.professional_profiles set verification_status='suspended' where user_id in({ids}); delete from auth.sessions where user_id in({ids});commit;")
        for row in rows:op.api('/auth/v1/admin/users/'+row['id'],{'ban_duration':'876000h'},'PUT')
        proof=op.sql(f"select (select count(*)::integer from auth.sessions where user_id in({ids})) sessions,(select count(*)::integer from auth.users where id in({ids}) and banned_until>now()) banned,(select count(*)::integer from public.access_grants where professional_id in({ids}) and revoked_at is null) active_grants")
        if proof!=[{'sessions':0,'banned':len(rows),'active_grants':0}]:raise RuntimeError('Retirement not proven')
    state_path.unlink(missing_ok=True)
    print(json.dumps({'run':run,'accounts_retired':len(rows),'retirement_verified':True,'github_secrets_created':0,'outgoing_email_sent':False}),flush=True)

if args.cleanup:
    try:cleanup()
    except Exception:raise SystemExit('Cleanup failed; private state retained and provider details withheld.') from None
    raise SystemExit(0)
save();passed=False
try:
    a=new_actor('A');b=new_actor('B');admin=new_actor('ADMIN');stage='first-registration'
    body={'facility_id':a['facility'],'register_year':2026,'register_book':'QA','local_number':'00125','given_name':run+' Amine fictif','family_name':run+' Doublon fictif','birth_date':'2025-01-01','birth_date_precision':'exact','sex':'male','smi_reference':'SMI fictive non unique'}
    op_a=str(uuid.uuid4());assert ok(rpc(a,'prepare_child_registration',{'p_operation_id':op_a,'p_payload':body,'p_mother_name':'Mère fictive QA','p_birthplace':'Maternité fictive QA'}))['state']=='ready'
    child_a=ok(rpc(a,'register_child',{'p_operation_id':op_a,'p_payload':body}));proposed={**body,'facility_id':b['facility']};op_b=str(uuid.uuid4())
    stage='cross-clinician-warning';warning=ok(rpc(b,'prepare_child_registration',{'p_operation_id':op_b,'p_payload':proposed}));assert warning['state']=='needs_details' and child_a not in json.dumps(warning) and a['id'] not in json.dumps(warning)
    assert rpc(b,'get_child_profile',{'p_child_id':child_a})==(403,{'code':'42501'})
    stage='secondary-match-no-access';assert ok(rpc(b,'prepare_child_registration',{'p_operation_id':op_b,'p_payload':proposed,'p_mother_name':'Mère fictive QA','p_birthplace':'Maternité fictive QA'}))['state']=='need_qr'
    assert rpc(b,'register_child',{'p_operation_id':op_b,'p_payload':proposed})==(409,{'code':'PT409'})
    assert rpc(admin,'prepare_child_registration',{'p_operation_id':str(uuid.uuid4()),'p_payload':proposed})==(403,{'code':'42501'})
    stage='controlled-review';review_op=str(uuid.uuid4());ok(rpc(b,'prepare_child_registration',{'p_operation_id':review_op,'p_payload':proposed}));assert ok(rpc(b,'prepare_child_registration',{'p_operation_id':review_op,'p_payload':proposed,'p_mother_name':'Mère fictive QA','p_birthplace':'Lieu fictif différent'}))['state']=='needs_review'
    queue=ok(rpc(a,'registration_review_queue',{}));case=next(item for item in queue['items'] if item['operation_id']==review_op)
    decision={'p_actor_id':b['id'],'p_operation_id':review_op,'p_expected_revision':case['revision'],'p_decision':'distinct','p_authority_reference':'Source entièrement fictive vérifiée pour le test.','p_reason':'Identités distinctes entièrement fictives, aucune fusion.','p_identity_checked':True}
    assert rpc(b,'review_child_registration',decision)==(403,{'code':'42501'});ok(rpc(a,'review_child_registration',decision));assert rpc(a,'review_child_registration',decision)==(409,{'code':'PT409'})
    stage='distinct-commit';child_b=ok(rpc(b,'finish_child_registration',{'p_operation_id':review_op}));assert child_a!=child_b;assert ok(rpc(b,'finish_child_registration',{'p_operation_id':review_op}))==child_b
    assert rpc(b,'get_child_profile',{'p_child_id':child_a})==(403,{'code':'42501'})
    counts=op.sql(f"select count(*)::integer n from public.children where created_by in('{a['id']}','{b['id']}')");assert counts==[{'n':2}]
    passed=True;print(json.dumps({'run':run,'passed':True,'generic_cross_clinician_warning':True,'secondary_match_grants_no_access':True,'registration_http_409_pt409':True,'review_http_409_pt409':True,'independent_controlled_review':True,'no_automatic_merge':True,'distinct_children':2,'idempotent_commit':True}),flush=True)
except Exception:
    print(json.dumps({'run':run,'passed':False,'failed_stage':stage,'provider_details_withheld':True}),flush=True)
finally:
    try:cleanup()
    except Exception:
        print(json.dumps({'run':run,'cleanup_required':True,'private_state_retained':True}),flush=True);passed=False
raise SystemExit(0 if passed else 1)
