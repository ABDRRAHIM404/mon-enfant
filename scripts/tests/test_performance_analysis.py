import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    'performance_analysis', Path(__file__).parents[1] / 'analyze-performance.py')
analysis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analysis)


class PerformanceAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.paths = []
        for device in analysis.DEVICES:
            folder = self.root / ('clinical-synthetic-' + device)
            folder.mkdir()
            for screen in analysis.SCREENS:
                proofs = []
                for profile, settings in analysis.PROFILES.items():
                    proof = dict(screen=screen, profile=profile,
                                 cache_disabled=True, performance_acceptance_claimed=False,
                                 document_ttfb_ms=800, fcp_ms=1800, lcp_ms=2500, cls=0.1,
                                 observed_long_task_blocking_ms=100, load_ms=2600,
                                 observation_end_ms=3600, reported_transfer_bytes=123456,
                                 resource_count=12)
                    proof.update(zip(('cpu_slowdown', 'latency_ms',
                                      'download_bytes_per_second', 'upload_bytes_per_second'), settings))
                    proofs.append(proof)
                path = folder / ('performance-' + screen + '.json')
                path.write_text(json.dumps(proofs))
                self.paths.append(path)

    def mutate(self, change):
        data = json.loads(self.paths[0].read_text())
        change(data)
        self.paths[0].write_text(json.dumps(data))

    def test_exact_boundaries_pass_but_do_not_claim_field_or_full_acceptance(self):
        result = analysis.analyze(self.root)
        self.assertEqual(result['status'], 'targets_met')
        self.assertEqual(result['observations'], 36)
        self.assertFalse(result['performance_acceptance_claimed'])
        self.assertFalse(result['field_compliance_claimed'])

    def test_exceedance_identifies_case_without_input_paths(self):
        self.mutate(lambda data: data[1].update(lcp_ms=2501))
        result = analysis.analyze(self.root)
        self.assertEqual(result['status'], 'targets_missed')
        self.assertEqual(result['failures'], [dict(viewport='desktop', screen='registration',
                         profile='constrained', metric='lcp_ms', observed=2501, target=2500)])
        self.assertNotIn(str(self.root), json.dumps(result))

    def test_missing_screen_cannot_be_reported_as_pass(self):
        self.paths[-1].unlink()
        with self.assertRaises(ValueError): analysis.analyze(self.root)

    def test_duplicate_profile_cannot_substitute_for_missing_measurement(self):
        self.mutate(lambda data: data.__setitem__(1, copy.deepcopy(data[0])))
        with self.assertRaises(ValueError): analysis.analyze(self.root)

    def test_wrong_throttling_cannot_be_reported_as_constrained(self):
        self.mutate(lambda data: data[1].update(cpu_slowdown=1))
        with self.assertRaises(ValueError): analysis.analyze(self.root)

    def test_unrecognized_raw_field_is_rejected(self):
        self.mutate(lambda data: data[0].update(raw_dom='must-never-be-reported'))
        with self.assertRaises(ValueError): analysis.analyze(self.root)

    def test_nonfinite_or_boolean_measurements_are_rejected(self):
        original = self.paths[0].read_text()
        for value in (float('nan'), float('inf'), True, -1):
            with self.subTest(value=value):
                self.paths[0].write_text(original)
                self.mutate(lambda data: data[0].update(lcp_ms=value))
                with self.assertRaises(ValueError): analysis.analyze(self.root)

    def test_unknown_artifact_device_cannot_hide_missing_coverage(self):
        self.paths[0].parent.rename(self.root / 'unrecognized-device')
        with self.assertRaises(ValueError): analysis.analyze(self.root)
