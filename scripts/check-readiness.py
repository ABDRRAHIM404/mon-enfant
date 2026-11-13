#!/usr/bin/env python3
"""Read-only, credential-free monitor of the fixed synthetic deployment.

No Auth mail, login, patient lookup, privileged key or provider response logging.
The manual failure drill changes only this process's report/exit status.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request

ORIGIN = 'https://mon-enfant.vercel.app'
READINESS = '/api/health'
PROTECTED = '/patients/00000000-0000-4000-8000-000000000000/export'
BODY_LIMIT = 4096


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def read_url(path):
    if path not in (READINESS, PROTECTED):
        raise ValueError('Unsupported monitor path')
    opener = urllib.request.build_opener(NoRedirect())
    request = urllib.request.Request(ORIGIN + path, headers={'Accept': 'application/json', 'User-Agent': 'MonEnfantReadiness/1'})
    try:
        with opener.open(request, timeout=12) as response:
            return response.status, response.headers, response.read(BODY_LIMIT + 1)
    except urllib.error.HTTPError as response:
        with response:
            return response.code, response.headers, response.read(BODY_LIMIT + 1)


def readiness_result(response):
    status, headers, body = response
    if status != 200:
        return 'unexpected_status'
    if len(body) > BODY_LIMIT or 'no-store' not in headers.get('Cache-Control', '').lower() or headers.get('Set-Cookie') or not headers.get('Content-Type', '').lower().startswith('application/json'):
        return 'contract_failure'
    try:
        return 'ok' if json.loads(body) == {'status': 'ok'} else 'contract_failure'
    except (ValueError, UnicodeError):
        return 'contract_failure'


def denial_result(response):
    status, headers, _ = response
    location = urllib.parse.urljoin(ORIGIN, headers.get('Location', ''))
    return 'denied' if status in (302, 303, 307, 308) and location == ORIGIN + '/login' and 'no-store' in headers.get('Cache-Control', '').lower() else 'access_boundary_failure'


def check(reader=read_url, exercise_failure=False):
    started = time.monotonic()
    results = {}
    for name, path, evaluate in [('readiness', READINESS, readiness_result), ('anonymous_export', PROTECTED, denial_result)]:
        try:
            results[name] = evaluate(reader(path))
        except Exception:
            # Never print urllib errors, redirected URLs, response bodies or headers.
            results[name] = 'transport_failure'
    baseline_healthy = results == {'readiness': 'ok', 'anonymous_export': 'denied'}
    failure_injected = exercise_failure and baseline_healthy
    if failure_injected:
        results['readiness'] = 'controlled_failure_injected'
    healthy = results == {'readiness': 'ok', 'anonymous_export': 'denied'}
    return {'status': 'ok' if healthy else 'unavailable', 'checked_at': datetime.now(timezone.utc).isoformat(), 'drill': exercise_failure, 'failure_injected': failure_injected, 'elapsed_ms': round((time.monotonic() - started) * 1000), **results}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exercise-failure', action='store_true')
    args = parser.parse_args()
    report = check(exercise_failure=args.exercise_failure)
    output = Path('test-results/readiness/result.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report), flush=True)
    return 0 if report['status'] == 'ok' else 1


if __name__ == '__main__':
    raise SystemExit(main())
