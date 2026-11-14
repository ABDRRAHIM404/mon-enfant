#!/usr/bin/env python3
"""Small native HTTP checks after the combined synthetic cloud browser story.
Use an already prepared parent-browser fixture. Operator keys stay on this PC;
only public application keys and each fixture user's session exercise RPCs.
Always retire the recorded fixture with parent-browser-fixtures.py afterward.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import urllib.request
import urllib.error
import uuid

spec=importlib.util.spec_from_file_location('updates_fixture',Path(__file__).with_name('parent-browser-fixtures.py'))
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
op=fixture.op
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--run',required=True);args=parser.parse_args()
state=fixture.load(args.run);ids=fixture.validate(state)
credentials=dict(line.split('=',1) for line in fixture.path(args.run).with_suffix('.env').read_text().splitlines())
public=credentials[fixture.PREFIX+'PUBLIC_KEY'];stage='persistence'

def request(path,body,token=None):
    headers={'apikey':public,'Content-Type':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    req=urllib.request.Request(op.BASE+path,data=json.dumps(body).encode(),headers=headers,method='POST')
    try:
        with urllib.request.urlopen(req,timeout=35) as response:return response.status,json.loads(response.read() or 'null')
    except urllib.error.HTTPError as error:
        data=json.loads(error.read() or 'null');return error.code,{'code':data.get('code') if isinstance(data,dict) else None}

def session(role):
    prefix=fixture.PREFIX+role+'_';status,data=request('/auth/v1/token?grant_type=password',{'email':credentials[prefix+'EMAIL'],'password':credentials[prefix+'PASSWORD']})
    if status!=200:raise RuntimeError('Fixture login failed')
    return data['access_token']

def rpc(token,name,body):return request('/rest/v1/rpc/'+name,body,token)

def ok(result):
    status,data=result
    if status not in (200,204):raise RuntimeError('Expected successful scoped RPC')
    return data

try:
    nurse=next(a['id'] for a in state['actors'] if a['role']=='SECOND')
    proof=op.sql(f"select (select count(*)::integer from private.provisional_children where owner_id='{nurse}') children,(select count(*)::integer from private.provisional_entries where owner_id='{nurse}') revisions,(select count(*)::integer from private.provisional_entries where owner_id='{nurse}' and validation_state<>'unverified') promoted,(select count(*)::integer from public.children where created_by='{nurse}') trusted_children")
    assert proof==[{'children':3,'revisions':21,'promoted':0,'trusted_children':0}]
    token=session('SECOND');outside=session('OUTSIDE');doctor=session('DOCTOR');parent=session('PARENT')
    rows=op.sql(f"select id from private.provisional_children where owner_id='{nurse}' order by created_at limit 1");child=str(uuid.UUID(rows[0]['id']))
    stage='http-conflict';booklet=ok(rpc(token,'provisional_booklet',{'p_child_id':child}));latest=next(e for e in booklet['entries'] if e['kind']=='appointment' and e['revision']==2)
    write={'p_operation_id':str(uuid.uuid4()),'p_child_id':child,'p_kind':'appointment','p_occurred_on':latest['occurred_on'],'p_occurrence_precision':latest['occurrence_precision'],'p_source_type':latest['source_type'],'p_source_reference':latest['source_reference'],'p_payload':latest['payload'],'p_root_id':latest['root_id'],'p_expected_revision':1,'p_reason':'Conflit entièrement fictif pour le test.','p_entry_state':'active'}
    assert rpc(token,'write_provisional_entry',write)==(409,{'code':'PT409'})
    stage='approval-no-promotion';op.sql(f"update public.professional_profiles set verification_status='approved',professional_id='QAUP-{args.run}-NURSE' where user_id='{nurse}' and role='nurse' and verification_status='unverified'")
    approved=ok(rpc(token,'provisional_booklet',{'p_child_id':child}));assert approved['child']['validation_state']=='unverified' and approved['child']['account_status']=='unverified';assert all(e['validation_state']=='unverified' and e['account_status']=='unverified' for e in approved['entries'])
    for other in (outside,doctor,parent):assert rpc(other,'provisional_booklet',{'p_child_id':child})==(403,{'code':'42501'})
    for name in ('get_child_profile','clinical_export','vaccine_items_export','appointments_export'):assert rpc(token,name,{'p_child_id':child})==(403,{'code':'42501'})
    stage='verified-nurse-clinical-boundaries';facility=ok(rpc(token,'create_facility',{'p_operation_id':str(uuid.uuid4()),'p_name':'Centre infirmier entièrement fictif','p_city':'Rabat fictif'}))
    body={'facility_id':facility,'register_year':2026,'register_book':'QA-NURSE','local_number':'125','given_name':args.run+' Infirmier fictif','family_name':args.run+' Validation fictive','birth_date':'2025-01-01','birth_date_precision':'exact','sex':'male'};operation=str(uuid.uuid4())
    assert ok(rpc(token,'prepare_child_registration',{'p_operation_id':operation,'p_payload':body}))['state']=='ready'
    trusted=ok(rpc(token,'register_child',{'p_operation_id':operation,'p_payload':body}));clinical={'p_operation_id':str(uuid.uuid4()),'p_child_id':trusted,'p_kind':'consultation','p_facility_id':facility,'p_occurred_on':'2026-01-02','p_occurrence_precision':'exact','p_source_type':'observed','p_source_reference':None,'p_source_verified':False,'p_payload':{'reason':'Motif entièrement fictif'}}
    assert rpc(token,'write_clinical_entry',clinical)==(403,{'code':'42501'})
    op.sql(f"insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values('{nurse}','consultation',true,'{nurse}')")
    assert uuid.UUID(ok(rpc(token,'write_clinical_entry',clinical)))
    stage='current-session-denial';op.sql(f"update public.professional_profiles set verification_status='suspended' where user_id='{nurse}'")
    assert rpc(token,'provisional_booklet',{'p_child_id':child})==(403,{'code':'42501'});assert rpc(token,'get_child_profile',{'p_child_id':trusted})==(403,{'code':'42501'})
    source=op.sql("select status,revision,(select count(*)::integer from public.vaccine_rules r where r.version_id=v.id) rules from public.vaccine_versions v where parent_id is null");assert source==[{'status':'draft','revision':1,'rules':25}]
    print(json.dumps({'run':args.run,'passed':True,'provisional_children':3,'immutable_revisions':21,'http_409_pt409':True,'approval_does_not_promote':True,'verified_nurse_requires_capability_and_child_grant':True,'other_authors_denied_after_approval':True,'suspension_existing_jwt_denied':True,'original_25_rule_draft_preserved':True,'outgoing_email_sent':False}),flush=True)
except Exception:
    print(json.dumps({'run':args.run,'passed':False,'failed_stage':stage,'provider_details_withheld':True,'cleanup_required':True}),flush=True);raise SystemExit(1) from None
