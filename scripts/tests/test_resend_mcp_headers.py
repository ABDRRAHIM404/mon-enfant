"""Use synthetic values only: helper stdout intentionally contains a header."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("resend_mcp_headers", Path(__file__).parents[1] / "resend-mcp-headers.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
KEY = "re_synthetic_fixture_not_a_real_key"


class McpHeaderTests(unittest.TestCase):
    def test_private_file_reads_only_one_requested_variable_without_evaluation(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/".env.local"
            path.write_text('OTHER_SECRET=do-not-load\nRESEND_API_KEY="'+KEY+'" # comment\n')
            path.chmod(0o600)
            self.assertEqual(helper.credential_headers(path, {}), {"Authorization": "Bearer "+KEY})

    def test_process_environment_takes_precedence_without_reading_file(self):
        self.assertEqual(helper.credential_headers(Path("/missing/env"), {"RESEND_API_KEY": KEY}), {"Authorization": "Bearer "+KEY})

    def test_missing_credentials_return_no_headers(self):
        self.assertEqual(helper.credential_headers(Path("/missing/env"), {}), {})

    def test_header_injection_and_shell_expressions_are_rejected(self):
        for key in [KEY+"\r\nInjected: value", "$(printenv)", "`printenv`", "your_key_here"]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                helper.credential_headers(Path("/missing/env"), {"RESEND_API_KEY": key})

    def test_public_file_and_ambiguous_entries_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/".env.local"
            path.write_text("RESEND_API_KEY="+KEY)
            path.chmod(0o644)
            with self.assertRaises(ValueError):
                helper.credential_headers(path, {})
            path.chmod(0o600)
            path.write_text("RESEND_API_KEY="+KEY+"\nRESEND_API_KEY="+KEY)
            with self.assertRaises(ValueError):
                helper.credential_headers(path, {})


if __name__ == "__main__":
    unittest.main()
