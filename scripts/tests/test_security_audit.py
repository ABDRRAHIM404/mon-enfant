import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('security_audit', Path(__file__).parents[1] / 'audit-security.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class SecurityAuditTests(unittest.TestCase):
    def test_baseline_has_explicit_scope(self):
        result = audit.evaluate([dict(audit.EXPECTED)])
        self.assertEqual(result['status'], 'baseline_met')
        self.assertFalse(result['full_security_acceptance_claimed'])

    def test_drift_is_reported_without_waiving_it(self):
        result = audit.evaluate([{**audit.EXPECTED, 'anonymous_table_or_column_access': 1}])
        self.assertEqual(result['status'], 'review_required')
        self.assertEqual(result['failed_checks'], ['anonymous_table_or_column_access'])

    def test_unknown_payload_fields_cannot_enter_the_report(self):
        with self.assertRaises(ValueError):
            audit.evaluate([{**audit.EXPECTED, 'private_provider_payload': 'must remain private'}])

    def test_missing_rows_fields_and_boolean_integer_substitution_fail(self):
        for rows in ([], [audit.EXPECTED, audit.EXPECTED], [{}],
                     [{**audit.EXPECTED, 'public_table_count': True}],
                     [{**audit.EXPECTED, 'evidence_bucket_contract': 1}]):
            with self.assertRaises(ValueError): audit.evaluate(rows)
