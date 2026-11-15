#!/usr/bin/env python3
"""Focused native HTTPS sharing proof using a prepared synthetic fixture only.
No emails or browser/build work. Never emit session, share or clinical payloads.
Retire the fixture with parent-browser-fixtures.py after this one-shot proof.
"""
import argparse
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import secrets
import urllib.error
import urllib.request
import uuid

spec = importlib.util.spec_from_file_location('sharing_fixture', Path(__file__).with_name('parent-browser-fixtures.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
op = fixture.op
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--run', required=True)
args = parser.parse_args()
state = fixture.load(args.run)
ids = fixture.validate(state)
credentials = dict(line.split('=', 1) for line in fixture.path(args.run).with_suffix('.env').read_text().splitlines())
public = credentials[fixture.PREFIX + 'PUBLIC_KEY']
stage = 'persistence'

def request(path, body, token=None):
    headers = {'apikey': public, 'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(op.BASE + path, data=json.dumps(body).encode(), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            return response.status, json.loads(response.read() or 'null')
    except urllib.error.HTTPError as error:
        data = json.loads(error.read() or 'null')
        return error.code, {'code': data.get('code') if isinstance(data, dict) else None}

def session(role):
    prefix = fixture.PREFIX + role + '_'
    status, data = request('/auth/v1/token?grant_type=password', {'email': credentials[prefix+'EMAIL'], 'password': credentials[prefix+'PASSWORD']})
    if status != 200: raise RuntimeError('Synthetic login failed')
    return data['access_token']

def session_id(token):
    part = token.split('.')[1]
    return str(uuid.UUID(json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))['session_id']))

def rpc(token, name, body):
    return request('/rest/v1/rpc/' + name, body, token)

def ok(result):
    status, data = result
    if status not in (200, 204): raise RuntimeError('Expected successful scoped operation')
    return data

try:
    actor = {a['role']: str(uuid.UUID(a['id'])) for a in state['actors']}
    facts = op.sql(f"""select
    (select count(*)::integer from public.children where created_by='{actor['DOCTOR']}') children,
    (select count(*)::integer from private.clinician_shares where guardian_id in({ids})) shares,
    (select count(*)::integer from private.clinician_shares where guardian_id in({ids}) and revoked_at is not null) revoked,
    (select count(*)::integer from private.guardian_links where guardian_id in({ids}) and revoked_at is null) active_links,
    (select count(*)::integer from public.access_grants where professional_id='{actor['OUTSIDE']}') recipient_grants""")
    assert facts == [{'children': 3, 'shares': 6, 'revoked': 6, 'active_links': 0, 'recipient_grants': 0}]
    doctor, parent, nurse = session('DOCTOR'), session('SECOND'), session('OUTSIDE')
    op.sql(f"update public.professional_profiles set role='nurse' where user_id='{actor['OUTSIDE']}' and role='doctor' and verification_status='approved'")
    child = str(uuid.UUID(op.sql(f"select id from public.children where created_by='{actor['DOCTOR']}' and family_name='{args.run}-tablet'")[0]['id']))
    stage = 'fresh-guardian-authority'
    secret = secrets.token_urlsafe(32)
    ok(rpc(doctor, 'create_guardian_invitation', {'p_child_id':child,'p_recipient_email':credentials[fixture.PREFIX+'SECOND_EMAIL'],'p_token_hash':hashlib.sha256(secret.encode()).hexdigest(),'p_reason':'Invitation entièrement fictive pour le contrôle HTTP.'}))
    claim = ok(rpc(parent, 'claim_guardian_invitation', {'p_operation_id':str(uuid.uuid4()),'p_token':secret,'p_relationship':'mother','p_consent':True}))
    deadline = op.sql("select ((now() at time zone 'Africa/Casablanca')::date+7)::text deadline")[0]['deadline']
    link = ok(rpc(doctor, 'review_guardian_claim', {'p_operation_id':str(uuid.uuid4()),'p_claim_id':claim,'p_expected_revision':1,'p_decision':'approved','p_relationship':'mother','p_authority_reference':'Vérification entièrement fictive.','p_reason':'Consentement et identité entièrement fictifs.','p_identity_checked':True,'p_guardianship_checked':True,'p_expires_on':deadline,'p_can_export':True}))
    stage = 'nurse-current-session-scope'
    receipt = ok(rpc(parent,'issue_clinician_share',{'p_child_id':child,'p_scope':'vaccination_read','p_consent':True}))
    assert receipt['accepted']
    assert ok(rpc(nurse,'redeem_clinician_share',{'p_token':receipt['token']}))['accepted']
    view = ok(rpc(nurse,'read_clinician_share',{'p_share_id':receipt['id'],'p_page':1}))
    assert view['scope']=='vaccination_read' and view['data']['history']['total']==1 and 'appointments' not in view['data']
    assert rpc(nurse,'get_child_profile',{'p_child_id':child})==(403,{'code':'42501'})
    second = session('OUTSIDE')
    assert rpc(second,'read_clinician_share',{'p_share_id':receipt['id'],'p_page':1})==(403,{'code':'42501'})
    sid = session_id(nurse)
    op.sql(f"delete from auth.sessions where id='{sid}' and user_id='{actor['OUTSIDE']}'")
    assert rpc(nurse,'read_clinician_share',{'p_share_id':receipt['id'],'p_page':1})==(403,{'code':'42501'})
    stage = 'issuer-logout-existing-jwt'
    full = ok(rpc(parent,'issue_clinician_share',{'p_child_id':child,'p_scope':'booklet_read','p_consent':True}))
    assert full['accepted'] and ok(rpc(second,'redeem_clinician_share',{'p_token':full['token']}))['accepted']
    view = ok(rpc(second,'read_clinician_share',{'p_share_id':full['id'],'p_page':1}))
    assert view['scope']=='booklet_read' and view['data']['appointment_total']==1 and 'link' not in view['data']
    parent_sid = session_id(parent)
    op.sql(f"delete from auth.sessions where id='{parent_sid}' and user_id='{actor['SECOND']}'")
    assert rpc(second,'read_clinician_share',{'p_share_id':full['id'],'p_page':1})==(403,{'code':'42501'})
    stage = 'database-expiry'
    parent = session('SECOND')
    # Historical immutable lifecycle facts are inserted as the scoped operator, not modified or backdated through the app.
    expired = secrets.token_urlsafe(32)
    expired_id = str(uuid.uuid4())
    op.sql(f"""insert into private.clinician_shares(id,child_id,guardian_id,guardian_link_id,issuer_session,token_hash,scope,created_at,expires_at,consumed_at,recipient_id,recipient_session,professional_id)
    select '{expired_id}','{child}','{actor['SECOND']}','{str(uuid.UUID(link))}','{session_id(parent)}','{hashlib.sha256(expired.encode()).hexdigest()}','vaccination_read',now()-interval '6 minutes',now()-interval '1 minute',now()-interval '5 minutes','{actor['OUTSIDE']}','{session_id(second)}',professional_id from public.professional_profiles where user_id='{actor['OUTSIDE']}'""")
    assert not ok(rpc(second,'redeem_clinician_share',{'p_token':expired}))['accepted']
    assert rpc(second,'read_clinician_share',{'p_share_id':expired_id,'p_page':1})==(403,{'code':'42501'})
    unused = secrets.token_urlsafe(32)
    unused_id = str(uuid.uuid4())
    op.sql(f"""insert into private.clinician_shares(id,child_id,guardian_id,guardian_link_id,issuer_session,token_hash,scope,created_at,expires_at)
    select '{unused_id}',child_id,guardian_id,guardian_link_id,issuer_session,'{hashlib.sha256(unused.encode()).hexdigest()}',scope,created_at,expires_at from private.clinician_shares where id='{expired_id}'""")
    assert op.sql(f"select (consumed_at is null and revoked_at is null and expires_at<now() and private.share_authority_current(s)) valid_other_facts from private.clinician_shares s where id='{unused_id}'")==[{'valid_other_facts':True}]
    assert not ok(rpc(second,'redeem_clinician_share',{'p_token':unused}))['accepted']
    stage = 'original-source-and-no-grants'
    proof = op.sql(f"""select
    (select count(*)::integer from public.access_grants where professional_id='{actor['OUTSIDE']}') recipient_grants,
    (select count(*)::integer from public.professional_capabilities where professional_id='{actor['OUTSIDE']}') recipient_capabilities,
    (select count(*)::integer from public.vaccine_rules r join public.vaccine_versions v on v.id=r.version_id where v.parent_id is null and v.revision=1 and v.status='draft') draft_rules""")
    assert proof==[{'recipient_grants':0,'recipient_capabilities':0,'draft_rules':25}]
    print(json.dumps({'run':args.run,'passed':True,'browser_persistence':facts[0],'nurse_read_only':True,'recipient_session_bound':True,'recipient_logout_old_jwt_denied':True,'issuer_logout_old_jwt_denied':True,'database_expiry_denied':True,'no_clinical_grants_or_capabilities':True,'original_25_draft_rules_unchanged':True,'fixture_cleanup_required':True}),flush=True)
except Exception:
    print(json.dumps({'run':args.run,'failed_stage':stage,'provider_details_withheld':True,'fixture_cleanup_required':True}),flush=True)
    raise RuntimeError('Synthetic sharing proof failed; response details withheld') from None
