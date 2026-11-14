#!/usr/bin/env python3
"""Read-only linked synthetic-project catalog review; provider output stays private."""
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent
PROJECT = 'zkkasbxvdvecnafgjpxd'
EXPECTED = {
    'public_table_count': 24,
    'public_tables_without_rls': 0,
    'anonymous_table_or_column_access': 0,
    'direct_clinical_read_grants': 0,
    'unexpected_authenticated_write_grants': 0,
    'privileged_profile_insert_columns': 0,
    'self_profile_id_insert': True,
    'private_table_or_column_grants': 0,
    'anonymous_function_count': 1,
    'unexpected_anonymous_functions': 0,
    'public_default_execute_functions': 0,
    'definer_functions_without_search_path': 0,
    'public_view_count': 0,
    'client_schema_create': False,
    'anonymous_private_schema_usage': False,
    'client_rls_bypass_roles': 0,
    'storage_objects_rls': True,
    'evidence_bucket_count': 1,
    'evidence_bucket_contract': True,
}


def evaluate(rows):
    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
        raise ValueError('Invalid classified catalog result.')
    row = rows[0]
    if set(row) != set(EXPECTED) or any(type(row[key]) is not type(value)
                                      for key, value in EXPECTED.items()):
        raise ValueError('Unexpected catalog result fields or types.')
    failures = [key for key, expected in EXPECTED.items() if row[key] != expected]
    return {'status': 'review_required' if failures else 'baseline_met',
            'checks': row, 'failed_checks': failures,
            'full_security_acceptance_claimed': False}


def main():
    try:
        if (ROOT / 'supabase/.temp/project-ref').read_text().strip() != PROJECT:
            raise ValueError('Only the fixed linked synthetic project is permitted.')
        result = subprocess.run([
            'supabase', 'db', 'query', '--linked', '--file',
            str(ROOT / 'supabase/checks/security-baseline.sql'), '--output-format', 'json',
        ], cwd=ROOT, capture_output=True, text=True, timeout=40)
        if result.returncode:
            raise ValueError('Catalog query failed.')
        report = evaluate(json.loads(result.stdout).get('rows'))
    except Exception:
        print(json.dumps({'status': 'unverified', 'full_security_acceptance_claimed': False}))
        return 2
    report['checked_at'] = datetime.now(timezone.utc).isoformat()
    print(json.dumps(report))
    return 0 if report['status'] == 'baseline_met' else 1


if __name__ == '__main__':
    raise SystemExit(main())
