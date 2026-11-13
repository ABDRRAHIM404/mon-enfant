"""Configuration safety checks; use synthetic credentials and no network."""
import contextlib
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("resend_setup", Path(__file__).parents[1] / "configure-resend.py")
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)

ENV = {"RESEND_API_KEY": "synthetic-sending-key", "RESEND_ADMIN_API_KEY": "synthetic-admin-key",
    "SUPABASE_ACCESS_TOKEN": "synthetic-management-key", "MAIL_FROM_EMAIL": "notify@example.invalid",
    "RESEND_DOMAIN_ID": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}
DOMAIN = {"name": "example.invalid", "status": "verified", "capabilities": {"sending": "enabled"},
    "click_tracking": False, "open_tracking": False}
BEFORE = {"site_url": setup.SITE, "mailer_autoconfirm": False, "jwt_exp": 3600,
    "uri_allow_list": "https://mon-enfant.vercel.app/auth/callback",
    "refresh_token_rotation_enabled": True, "mailer_templates_recovery_content": "original template"}


class ResendSetupTests(unittest.TestCase):
    def test_rejects_invalid_sender_and_unbounded_limits(self):
        for delta in [{"MAIL_FROM_EMAIL": "bad\r\nBcc: other@example.invalid"},
            {"AUTH_EMAIL_RATE_LIMIT": "0"}, {"AUTH_EMAIL_RATE_LIMIT": "101"},
            {"AUTH_EMAIL_COOLDOWN_SECONDS": "1"}, {"MAIL_FROM_NAME": "Header\nInjection"}]:
            with self.subTest(delta=delta), self.assertRaises(setup.SetupError):
                setup.settings({**ENV, **delta})

    def test_domain_mismatch_unverified_and_tracking_fail_closed(self):
        for delta in [{"name": "other.invalid"}, {"status": "pending"},
            {"capabilities": {"sending": "disabled"}}, {"click_tracking": True}, {"open_tracking": None}]:
            with self.subTest(delta=delta), self.assertRaises(setup.SetupError):
                setup.validate_domain({**DOMAIN, **delta}, ENV["MAIL_FROM_EMAIL"])

    def test_apply_changes_only_smtp_and_limits_and_verifies_preserved_auth(self):
        mail = setup.settings(ENV)
        output = io.StringIO()
        with patch.object(setup, "request_json", side_effect=[DOMAIN, BEFORE, {}, {**BEFORE, **mail}]) as request, patch.object(setup, "verify_smtp") as smtp, contextlib.redirect_stdout(output):
            setup.configure(ENV, apply=True)
        self.assertEqual(request.call_args_list[2].args, (setup.AUTH_URL, ENV["SUPABASE_ACCESS_TOKEN"], "PATCH", mail))
        self.assertEqual(set(mail), setup.MAIL_KEYS)
        smtp.assert_called_once_with(ENV["RESEND_API_KEY"])
        self.assertEqual(request.call_count, 4)
        for key in ["RESEND_API_KEY", "RESEND_ADMIN_API_KEY", "SUPABASE_ACCESS_TOKEN", "MAIL_FROM_EMAIL"]:
            self.assertNotIn(ENV[key], output.getvalue())

    def test_preflight_failure_never_patches_hosted_settings(self):
        for hosted in [{**BEFORE, "site_url": "https://unexpected.invalid"},
            {**BEFORE, "mailer_autoconfirm": True}, {**BEFORE, "hook_send_email_enabled": True}]:
            with patch.object(setup, "request_json", side_effect=[DOMAIN, hosted]) as request, patch.object(setup, "verify_smtp"), self.assertRaises(setup.SetupError):
                setup.configure(ENV, apply=True)
            self.assertTrue(all(len(c.args) < 3 for c in request.call_args_list))

    def test_missing_credentials_make_no_network_calls(self):
        with patch.object(setup, "request_json") as request, self.assertRaisesRegex(setup.SetupError, "Missing environment"):
            setup.configure({})
        request.assert_not_called()

    def test_unexpected_auth_readback_is_reported_as_failure(self):
        changed = {**BEFORE, **setup.settings(ENV), "jwt_exp": 7200}
        with patch.object(setup, "request_json", side_effect=[DOMAIN, BEFORE, {}, changed]), patch.object(setup, "verify_smtp"), self.assertRaisesRegex(setup.SetupError, "changed unexpectedly"):
            setup.configure(ENV, apply=True)


if __name__ == "__main__":
    unittest.main()
