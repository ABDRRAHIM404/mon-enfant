#!/usr/bin/env python3
"""One-shot synthetic native fixture and real authenticated HTTP projection checks.
Retire with parent-browser-fixtures.py --cleanup --run. Never print credentials.
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

spec = importlib.util.spec_from_file_location('mobile_fixture', Path(__file__).with_name('parent-browser-fixtures.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
op = fixture.op
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--run', required=True)
args = parser.parse_args()
state = fixture.load(args.run)
ids = fixture.validate(state)
credentials = dict(line.split('=', 1) for line in fixture.path(args.run).with_suffix('.env').read_text().splitlines())
public = credentials[fixture.PREFIX+'PUBLIC_KEY']
stage = 'preflight'

def request(path, body, token=None):
    headers = {'apikey': public, 'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer '+token
    req = urllib.request.Request(op.BASE+path, data=json.dumps(body).encode(), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            return response.status, json.loads(response.read() or 'null')
    except urllib.error.HTTPError as error:
        data = json.loads(error.read() or 'null')
        return error.code, {'code': data.get('code') if isinstance(data, dict) else None}

def session(role):
    prefix = fixture.PREFIX+role+'_'
    status, data = request('/auth/v1/token?grant_type=password', {'email': credentials[prefix+'EMAIL'], 'password': credentials[prefix+'PASSWORD']})
    assert status == 200
    return data['access_token']

def rpc(token, name, body=None):
    return request('/rest/v1/rpc/'+name, body or {}, token)

def ok(result):
    status, data = result
    assert status in (200, 204)
    return data

try:
    actors = {a['role']: str(uuid.UUID(a['id'])) for a in state['actors']}
    assert op.sql(f"select count(*)::integer n from public.children where created_by='{actors['DOCTOR']}'") == [{'n': 0}]
    doctor, parent, outsider = session('DOCTOR'), session('PARENT'), session('SECOND')
    ok(rpc(parent, 'save_parent_profile', {'p_display_name': 'Responsable fictif mobile'}))
    ok(rpc(outsider, 'save_parent_profile', {'p_display_name': 'Autre responsable fictif'}))
    stage = 'registered-child'
    facility = str(uuid.UUID(ok(rpc(doctor, 'create_facility', {'p_operation_id': str(uuid.uuid4()), 'p_name': 'Centre entièrement fictif mobile', 'p_city': 'Rabat fictif'}))))
    payload = {'facility_id': facility, 'register_year': 2026, 'register_book': 'NATIVE-QA', 'local_number': '001', 'given_name': 'Enfant fictif', 'family_name': args.run+' mobile', 'birth_date': '2025-01-01', 'birth_date_precision': 'exact', 'sex': 'unknown'}
    operation = str(uuid.uuid4())
    assert ok(rpc(doctor, 'prepare_child_registration', {'p_operation_id': operation, 'p_payload': payload}))['state'] == 'ready'
    child = str(uuid.UUID(ok(rpc(doctor, 'register_child', {'p_operation_id': operation, 'p_payload': payload}))))
    stage = 'guardian-review'
    secret = secrets.token_urlsafe(32)
    ok(rpc(doctor, 'create_guardian_invitation', {'p_child_id': child, 'p_recipient_email': credentials[fixture.PREFIX+'PARENT_EMAIL'], 'p_token_hash': hashlib.sha256(secret.encode()).hexdigest(), 'p_reason': 'Invitation entièrement fictive pour le test natif.'}))
    claim = ok(rpc(parent, 'claim_guardian_invitation', {'p_operation_id': str(uuid.uuid4()), 'p_token': secret, 'p_relationship': 'mother', 'p_consent': True}))
    times = op.sql("select ((now() at time zone 'Africa/Casablanca')::date+7)::text deadline,to_char(now()+interval '2 days','YYYY-MM-DD') appointment_day,(now() at time zone 'Africa/Casablanca')::date::text current_day")[0]
    link = str(uuid.UUID(ok(rpc(doctor, 'review_guardian_claim', {'p_operation_id': str(uuid.uuid4()), 'p_claim_id': claim, 'p_expected_revision': 1, 'p_decision': 'approved', 'p_relationship': 'mother', 'p_authority_reference': 'Vérification entièrement fictive.', 'p_reason': 'Consentement et identité entièrement fictifs.', 'p_identity_checked': True, 'p_guardianship_checked': True, 'p_expires_on': times['deadline'], 'p_can_export': True}))))
    stage = 'synthetic-clinical-history'
    entry = {'p_operation_id': str(uuid.uuid4()), 'p_child_id': child, 'p_kind': 'vaccination', 'p_facility_id': facility, 'p_occurred_on': None, 'p_occurrence_precision': 'unknown', 'p_source_type': 'paper_transcription', 'p_source_reference': 'Source papier entièrement fictive', 'p_source_verified': False, 'p_payload': {'vaccine_code': 'UNKNOWN', 'vaccine_label': 'Vaccin transcrit fictif', 'dose_label': 'Dose inconnue', 'lot_status': 'unknown', 'site_status': 'unknown', 'provider_status': 'unknown', 'administration_facility_status': 'unknown', 'matching_status': 'unmatched'}}
    ok(rpc(doctor, 'write_clinical_entry', entry))
    local = times['appointment_day']+'T12:00:00+00:00'
    # Obtain the explicit provider offset; never trust this PC/phone's older tzdata.
    offset = op.sql(f"select extract(epoch from(('{local}'::timestamptz at time zone 'Africa/Casablanca')-('{local}'::timestamptz at time zone 'UTC')))::integer zone_offset")[0]['zone_offset']
    assert offset in (0, 3600)
    suffix = '+01:00' if offset else '+00:00'
    ok(rpc(doctor, 'create_appointment', {'p_operation_id': str(uuid.uuid4()), 'p_child_id': child, 'p_facility_id': facility, 'p_purpose': 'consultation', 'p_purpose_label': 'Consultation fictive mobile', 'p_vaccine_item_id': None, 'p_starts_at': times['appointment_day']+'T12:00:00'+suffix, 'p_ends_at': times['appointment_day']+'T12:30:00'+suffix, 'p_reason': 'Rendez-vous entièrement fictif', 'p_reviewed': True}))
    stage = 'authenticated-http-projections'
    home = ok(rpc(parent, 'parent_mobile_view', {'p_kind': 'home'}))
    assert len(home['children']) == 1 and home['children'][0]['id'] == child
    assert home['server_day'] == times['current_day'] and home['timezone'] == 'Africa/Casablanca'
    assert home['next_appointment']['starts_offset_seconds'] == offset
    for kind in ('booklet', 'calendar', 'vaccine_references', 'vaccination_history'):
        view = ok(rpc(parent, 'parent_mobile_view', {'p_kind': kind, 'p_child_id': child}))
        assert view['timezone'] == 'Africa/Casablanca'
        assert rpc(outsider, 'parent_mobile_view', {'p_kind': kind, 'p_child_id': child}) == (403, {'code': '42501'})
        if kind == 'calendar':
            assert len(view['items']) == 1
            assert view['items'][0]['starts_display'] == home['next_appointment']['starts_display']
        if kind == 'vaccination_history': assert view['total'] == 1
    stage = 'existing-jwt-session-denial'
    part = parent.split('.')[1]
    sid = str(uuid.UUID(json.loads(base64.urlsafe_b64decode(part+'='*(-len(part)%4)))['session_id']))
    assert request('/auth/v1/logout?scope=local', {}, parent)[0] == 204
    assert rpc(parent, 'parent_mobile_view', {'p_kind': 'booklet', 'p_child_id': child}) == (403, {'code': '42501'})
    assert op.sql(f"select count(*)::integer n from auth.sessions where id='{sid}'") == [{'n': 0}]
    assert op.sql("select status,revision,(select count(*)::integer from public.vaccine_rules r where r.version_id=v.id) rules from public.vaccine_versions v where parent_id is null") == [{'status': 'draft', 'revision': 1, 'rules': 25}]
    state['mobile'] = {'child': child, 'guardian_link': link, 'facility': facility, 'http_passed': True, 'appointment_display': home['next_appointment']['starts_display']}
    fixture.save(state, credentials)
    print(json.dumps({'run': args.run, 'passed': True, 'hosted_authenticated_mobile_views': 5, 'other_parent_child_views_denied': 4, 'canonical_provider_time_verified': True, 'real_logout_old_jwt_denied': True, 'original_25_draft_rules_unchanged': True, 'native_fixture_ready': True, 'cleanup_required': True}))
except Exception:
    print(json.dumps({'run': args.run, 'failed_stage': stage, 'provider_details_withheld': True, 'cleanup_required': True}))
    raise SystemExit(1) from None
