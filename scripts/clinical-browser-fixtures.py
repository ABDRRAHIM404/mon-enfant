#!/usr/bin/env python3
"""Prepare, verify and retire fictional accounts for hosted clinical browsers.

Only temporary synthetic login credentials enter GitHub. Operator keys remain
in memory on this PC. No email, local browser, build or dependency install.
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

PROJECT = 'zkkasbxvdvecnafgjpxd'
REPO = 'ABDRRAHIM404/mon-enfant'
PREFIX = 'MON_ENFANT_CLINICAL_BROWSER_'
ROLES = ('A', 'B', 'MANAGER', 'OUTSIDE')
ROOT = Path(os.environ.get('MON_ENFANT_OPERATOR_ROOT', Path(__file__).resolve().parent.parent))
STATE_ROOT = Path.home() / '.local/state/mon-enfant/clinical-browser'
CFG = dict(line.split('=', 1) for line in (ROOT / '.env.local').read_text().splitlines() if line and not line.startswith('#'))
ENV = {**os.environ, **CFG}
BASE = CFG['NEXT_PUBLIC_SUPABASE_URL']
assert BASE == f'https://{PROJECT}.supabase.co'
assert (ROOT / 'supabase/.temp/project-ref').read_text().strip() == PROJECT
SERVICE = None


def command(args, input_text=None):
    result = subprocess.run(args, input=input_text, capture_output=True, text=True, env=ENV, cwd=ROOT)
    if result.returncode:
        raise RuntimeError('Scoped clinical fixture command failed; details withheld')
    return result.stdout


def sql(query):
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql') as file:
        file.write(query)
        file.flush()
        result = command(['supabase', 'db', 'query', '--linked', '--file', file.name, '--output-format', 'json'])
    return json.loads(result).get('rows', [])


def api(path, data, method='POST'):
    global SERVICE
    if SERVICE is None:
        result = json.loads(command(['supabase', 'projects', 'api-keys', '--project-ref', PROJECT, '--reveal', '--output-format', 'json']))
        keys = result if isinstance(result, list) else result.get('api_keys', result.get('keys', []))
        SERVICE = next(key['api_key'] for key in keys if key['name'] == 'service_role')
    request = urllib.request.Request(BASE + path, data=json.dumps(data).encode(), method=method, headers={'apikey': SERVICE, 'Authorization': 'Bearer ' + SERVICE, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            return json.loads(response.read() or 'null')
    except urllib.error.HTTPError as error:
        error.read()
        raise RuntimeError('Scoped fixture provider operation failed; response withheld') from None


def secret_names():
    return {row['name'] for row in json.loads(command(['gh', 'secret', 'list', '--repo', REPO, '--json', 'name']))}


def state_path(run):
    if not re.fullmatch('[a-f0-9]{16}', run):
        raise RuntimeError('Invalid clinical fixture run')
    return STATE_ROOT / (run + '.json')


def save(state, credentials):
    STATE_ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
    STATE_ROOT.chmod(0o700)
    for path, content in ((state_path(state['run']), json.dumps(state)), (state_path(state['run']).with_suffix('.env'), ''.join(key + '=' + value + '\n' for key, value in credentials.items()))):
        path.touch(mode=0o600, exist_ok=True)
        path.chmod(0o600)
        path.write_text(content)


def load(run):
    state = json.loads(state_path(run).read_text())
    assert state['run'] == run
    for actor in state['actors']:
        uuid.UUID(actor['id'])
        assert actor['role'] in ROLES
    return state


def validate(state):
    ids = ','.join("'" + actor['id'] + "'" for actor in state['actors'])
    if not ids:
        return None
    rows = sql(f"select count(*)::integer n from auth.users where id in({ids}) and raw_app_meta_data->>'synthetic_fixture'='true' and raw_app_meta_data->>'fixture_kind'='clinical_browser' and raw_app_meta_data->>'fixture_run'='{state['run']}' and email like 'qa-cbrowser-{state['run']}-%@example.invalid'")
    if rows[0]['n'] != len(state['actors']):
        raise RuntimeError('Fixture identity validation failed; cleanup refused')
    return ids


def prepare(session_only=False):
    if any(name.startswith(PREFIX) for name in secret_names()):
        raise RuntimeError('Finish the recorded clinical fixture run first')
    state = {'run': uuid.uuid4().hex[:16], 'actors': [], 'secrets': [], 'purpose': 'session' if session_only else 'clinical'}
    credentials = {}
    save(state, credentials)
    try:
        for role in (('A',) if session_only else ROLES):
            email = f"qa-cbrowser-{state['run']}-{role.lower()}@example.invalid"
            password = secrets.token_urlsafe(32)
            user = api('/auth/v1/admin/users', {'email': email, 'password': password, 'email_confirm': True, 'app_metadata': {'synthetic_fixture': True, 'fixture_run': state['run'], 'fixture_kind': 'clinical_browser'}})
            uid = str(uuid.UUID(user['id']))
            state['actors'].append({'id': uid, 'role': role})
            for field, value in (('EMAIL', email), ('PASSWORD', password)):
                credentials[PREFIX + role + '_' + field] = value
            save(state, credentials)
            profile_role = 'admin' if role == 'MANAGER' else 'doctor'
            platform = f"QAB-{state['run']}-{role}"
            sql(f"insert into public.professional_profiles(user_id,role,verification_status,professional_id) values('{uid}','{profile_role}','approved','{platform}')")
            if role == 'MANAGER':
                sql(f"insert into private.staff_permissions(user_id,can_manage_clinical_permissions) values('{uid}',true)")
            for field in ('EMAIL', 'PASSWORD'):
                key = PREFIX + role + '_' + field
                # Record the intended secret before publishing, so interrupted
                # setup can remove it even if GitHub accepted a timed-out call.
                state['secrets'].append(key)
                save(state, credentials)
                command(['gh', 'secret', 'set', key, '--repo', REPO], credentials[key])
    except Exception:
        print(json.dumps({'run': state['run'], 'setup_incomplete': True, 'cleanup_required': True}), flush=True)
        raise
    print(json.dumps({'run': state['run'], 'accounts_prepared': len(state['actors']), 'temporary_encrypted_secrets': len(state['secrets']), 'outgoing_email_sent': False}), flush=True)


def inspect(run):
    state = load(run)
    ids = validate(state)
    if state.get('purpose') == 'session':
        rows = sql(f"select (select count(*) from public.children where created_by in({ids}))::integer children,(select count(*) from public.clinical_entries where author_id in({ids}))::integer clinical_entries,(select count(*) from public.access_grants where professional_id in({ids}))::integer grants,(select count(*) from public.professional_capabilities where professional_id in({ids}))::integer capabilities,(select count(*) from private.staff_permissions where user_id in({ids}))::integer staff_permissions")
        if len(state['actors']) != 1 or rows != [{'children': 0, 'clinical_entries': 0, 'grants': 0, 'capabilities': 0, 'staff_permissions': 0}]:
            raise RuntimeError('Session-only fixture scope was not proven')
        print(json.dumps({'run': run, 'session_only_scope_verified': True, **rows[0]}), flush=True)
        return
    if len(state['actors']) != 4:
        raise RuntimeError('Fixture setup incomplete')
    a = next(actor['id'] for actor in state['actors'] if actor['role'] == 'A')
    b = next(actor['id'] for actor in state['actors'] if actor['role'] == 'B')
    rows = sql(f"""with children as (select id from public.children where created_by='{a}')
        select (select count(*) from children)::integer children,
        (select count(*) from public.clinical_entries where child_id in(select id from children))::integer clinical_revisions,
        (select count(*) from public.clinical_entries where child_id in(select id from children) and kind='consultation' and revision=2 and author_id='{b}')::integer second_doctor_corrections,
        (select count(*) from public.clinical_entries where child_id in(select id from children) and kind='growth')::integer growth_entries,
        (select count(*) from public.appointments where child_id in(select id from children))::integer appointments,
        (select count(*) from public.appointment_events e join public.appointments a on a.id=e.appointment_id where a.child_id in(select id from children))::integer appointment_events,
        (select count(*) from public.access_grants where child_id in(select id from children) and professional_id='{b}' and revoked_at is not null)::integer revoked_second_doctor_grants""")
    expected = {'children': 3, 'clinical_revisions': 9, 'second_doctor_corrections': 3, 'growth_entries': 3, 'appointments': 3, 'appointment_events': 6, 'revoked_second_doctor_grants': 3}
    if rows != [expected]:
        raise RuntimeError('Full three-viewport clinical persistence was not proven')
    print(json.dumps({'run': run, 'database_persistence_verified': True, **expected}), flush=True)


def cleanup(run):
    state = load(run)
    allowed = {PREFIX + role + '_' + field for role in ROLES for field in ('EMAIL', 'PASSWORD')}
    if not set(state['secrets']).issubset(allowed):
        raise RuntimeError('Unexpected cleanup secret scope')
    ids = validate(state)
    if ids:
        pending = sql(f"select id,requester_id from public.child_access_requests where requester_id in({ids}) and status='pending'")
        if pending:
            credentials = dict(line.split('=', 1) for line in state_path(run).with_suffix('.env').read_text().splitlines())
            for actor in state['actors']:
                requests = [row for row in pending if row['requester_id'] == actor['id']]
                if not requests:
                    continue
                web = Browser()
                prefix = PREFIX + actor['role'] + '_'
                web.login(credentials[prefix + 'EMAIL'], credentials[prefix + 'PASSWORD'])
                for row in requests:
                    request_id = str(uuid.UUID(row['id']))
                    _, page, _ = web.get('/access-requests')
                    web.submit('/access-requests', page, {'requestId': request_id, 'reason': 'Retrait de demande entièrement fictive après test navigateur.'}, lambda form: form['fields'].get('requestId') == request_id and form['fields'].get('kind') == 'withdraw')
            if sql(f"select count(*)::integer n from public.child_access_requests where requester_id in({ids}) and status='pending'")[0]['n']:
                raise RuntimeError('Pending fictional requests were not withdrawn; state retained')
        sql(f"""begin;
            update public.professional_capabilities set enabled=false where professional_id in({ids});
            update private.staff_permissions set can_manage_clinical_permissions=false where user_id in({ids});
            update public.access_grants set revoked_at=coalesce(revoked_at,now()) where professional_id in({ids});
            update public.professional_facilities set revoked_at=coalesce(revoked_at,now()) where professional_id in({ids});
            update public.professional_profiles set verification_status='suspended' where user_id in({ids});
            delete from auth.sessions where user_id in({ids}); commit;""")
        for actor in state['actors']:
            api('/auth/v1/admin/users/' + actor['id'], {'ban_duration': '876000h'}, 'PUT')
        remaining = sql(f"select (select count(*) from auth.sessions where user_id in({ids}))::integer sessions,(select count(*) from public.access_grants where professional_id in({ids}) and revoked_at is null)::integer grants,(select count(*) from public.professional_capabilities where professional_id in({ids}) and enabled)::integer capabilities,(select count(*) from auth.users where id in({ids}) and banned_until>now())::integer banned")
        if remaining != [{'sessions': 0, 'grants': 0, 'capabilities': 0, 'banned': len(state['actors'])}]:
            raise RuntimeError('Fixture retirement readback failed; state retained')
    for key in set(state['secrets']) & secret_names():
        command(['gh', 'secret', 'delete', key, '--repo', REPO])
    if set(state['secrets']) & secret_names():
        raise RuntimeError('Temporary secrets remain; state retained')
    state_path(run).with_suffix('.env').unlink()
    state_path(run).unlink()
    print(json.dumps({'run': run, 'accounts_retired': len(state['actors']), 'temporary_secrets_removed': len(state['secrets']), 'retirement_verified': True, 'outgoing_email_sent': False}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument('--prepare', action='store_true')
    modes.add_argument('--check', action='store_true')
    modes.add_argument('--cleanup', action='store_true')
    parser.add_argument('--run')
    parser.add_argument('--session-only', action='store_true', help='Prepare only one fictional doctor, without capabilities, grants or staff permissions')
    args = parser.parse_args()
    if args.session_only and not args.prepare:
        parser.error('--session-only requires --prepare')
    try:
        if args.prepare:
            prepare(args.session_only)
        elif args.check:
            inspect(args.run)
        else:
            cleanup(args.run)
    except Exception:
        print('Clinical browser operator step failed. Private state is retained; credentials and provider responses are withheld.', flush=True)
        raise SystemExit(1) from None
