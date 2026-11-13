"""Exercise monitor failure classification without network or credentials."""
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('readiness_monitor', Path(__file__).parents[1] / 'check-readiness.py')
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)
GOOD = (200, {'Cache-Control': 'no-store', 'Content-Type': 'application/json'}, b'{"status":"ok"}')
DENIED = (307, {'Location': '/login', 'Cache-Control': 'private, no-store'}, b'')


class ReadinessMonitorTests(unittest.TestCase):
    def test_both_boundaries_must_pass(self):
        report = monitor.check(lambda path: GOOD if path == monitor.READINESS else DENIED)
        self.assertEqual(report['status'], 'ok')
        self.assertEqual(report['anonymous_export'], 'denied')
        self.assertFalse(report['drill'])

    def test_dependency_outage_is_not_hidden_by_a_working_login_gate(self):
        report = monitor.check(lambda path: (503, {}, b'private provider details') if path == monitor.READINESS else DENIED)
        self.assertEqual(report['status'], 'unavailable')
        self.assertEqual(report['readiness'], 'unexpected_status')
        self.assertNotIn('private provider details', json.dumps(report))

    def test_unauthenticated_success_is_a_failure_even_when_readiness_is_healthy(self):
        report = monitor.check(lambda path: GOOD)
        self.assertEqual(report['status'], 'unavailable')
        self.assertEqual(report['anonymous_export'], 'access_boundary_failure')

    def test_readiness_rejects_cached_cookie_setting_invalid_and_oversized_responses(self):
        invalid = [
            (200, {'Content-Type': 'application/json'}, b'{"status":"ok"}'),
            (200, {**GOOD[1], 'Set-Cookie': 'synthetic-only'}, GOOD[2]),
            (200, GOOD[1], b'{"status":"ok","private":"must not escape"}'),
            (200, GOOD[1], b'not json'),
            (200, GOOD[1], b'x' * (monitor.BODY_LIMIT + 1)),
            (200, {**GOOD[1], 'Content-Type': 'text/html'}, GOOD[2]),
        ]
        for response in invalid:
            with self.subTest(response_type=response[1].get('Content-Type')):
                self.assertEqual(monitor.readiness_result(response), 'contract_failure')

    def test_export_denial_rejects_external_or_unexpected_redirect_destinations(self):
        for location in ['https://unrelated.example.invalid/login', '/account', '/login?token=must-not-escape', '//unrelated.example.invalid/login', '']:
            self.assertEqual(monitor.denial_result((307, {**DENIED[1], 'Location': location}, b'')), 'access_boundary_failure')

    def test_transport_errors_are_redacted(self):
        def failure(_):
            raise RuntimeError('private token and URL must not escape')
        report = monitor.check(failure)
        self.assertEqual(report['status'], 'unavailable')
        self.assertEqual(report['readiness'], 'transport_failure')
        self.assertEqual(report['anonymous_export'], 'transport_failure')
        self.assertNotIn('private token', json.dumps(report))

    def test_failure_drill_does_not_send_a_request_to_a_broken_dependency(self):
        paths = []
        def read(path):
            paths.append(path)
            return GOOD if path == monitor.READINESS else DENIED
        report = monitor.check(read, exercise_failure=True)
        self.assertEqual(paths, [monitor.READINESS, monitor.PROTECTED])
        self.assertTrue(report['drill'])
        self.assertEqual(report['status'], 'unavailable')
        self.assertEqual(report['readiness'], 'controlled_failure_injected')

    def test_probe_paths_are_fixed(self):
        with self.assertRaisesRegex(ValueError, 'Unsupported monitor path'):
            monitor.read_url('https://unrelated.example.invalid')
