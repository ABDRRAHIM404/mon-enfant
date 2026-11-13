"""Owner-only Resend SMTP boundary checks, without network or real credentials."""
import contextlib
import importlib.util
import io
from pathlib import Path
import smtplib
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("resend_owner_setup", Path(__file__).parents[1] / "configure-resend.py")
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)
ENV = {"RESEND_API_KEY": "synthetic-send-key", "RESEND_TEST_RECIPIENT": "owner@example.invalid",
    "RESEND_SMOKE_OPERATION_ID": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}


class OwnerSmtpTests(unittest.TestCase):
    def test_connection_check_sends_nothing_and_never_changes_auth(self):
        with patch.object(setup, "verify_smtp") as verify, patch.object(setup, "request_json") as request, patch.object(setup, "ProxySMTP") as smtp, contextlib.redirect_stdout(io.StringIO()):
            setup.owner_test(ENV)
        verify.assert_called_once_with(ENV["RESEND_API_KEY"])
        request.assert_not_called()
        smtp.assert_not_called()

    def test_sends_exactly_one_fixed_plain_message_with_stable_retry_key(self):
        output = io.StringIO()
        with patch.object(setup, "ProxySMTP") as factory, patch.object(setup, "request_json") as request, contextlib.redirect_stdout(output):
            smtp = factory.return_value.__enter__.return_value
            smtp.send_message.return_value = {}
            setup.owner_test(ENV, send=True)
            setup.owner_test(ENV, send=True)
        self.assertEqual(smtp.send_message.call_count, 2)
        first, second = smtp.send_message.call_args_list
        message = first.args[0]
        self.assertEqual(message["Resend-Idempotency-Key"], second.args[0]["Resend-Idempotency-Key"])
        self.assertEqual(message["Message-ID"], second.args[0]["Message-ID"])
        self.assertEqual(first.kwargs, {"from_addr": "onboarding@resend.dev", "to_addrs": [ENV["RESEND_TEST_RECIPIENT"]]})
        self.assertEqual(message.get_content_type(), "text/plain")
        self.assertNotIn("https://", message.get_content())
        self.assertIn("not mailbox-delivery proof", output.getvalue())
        for value in ENV.values():
            self.assertNotIn(value, output.getvalue())
        request.assert_not_called()

    def test_invalid_recipient_or_missing_retry_id_never_opens_smtp(self):
        for delta in [{"RESEND_TEST_RECIPIENT": ""}, {"RESEND_TEST_RECIPIENT": "owner@example.invalid,second@example.invalid"},
            {"RESEND_TEST_RECIPIENT": "owner@example.invalid\r\nBcc: another@example.invalid"}, {"RESEND_SMOKE_OPERATION_ID": ""}, {"RESEND_SMOKE_OPERATION_ID": "invalid"}]:
            with self.subTest(delta=delta), patch.object(setup, "ProxySMTP") as smtp, self.assertRaises(setup.SetupError):
                setup.owner_test({**ENV, **delta}, send=True)
            smtp.assert_not_called()

    def test_uncertain_send_error_never_echoes_provider_contents_or_retries(self):
        with patch.object(setup, "ProxySMTP") as factory, self.assertRaisesRegex(setup.SetupError, "outcome is unknown") as raised:
            smtp = factory.return_value.__enter__.return_value
            smtp.send_message.side_effect = smtplib.SMTPServerDisconnected("synthetic-private-provider-message")
            setup.owner_test(ENV, send=True)
        smtp.send_message.assert_called_once()
        self.assertNotIn("synthetic-private-provider-message", str(raised.exception))

    def test_quit_failure_after_acceptance_does_not_claim_a_failed_send(self):
        output = io.StringIO()
        with patch.object(setup, "ProxySMTP") as factory, contextlib.redirect_stdout(output):
            smtp = factory.return_value.__enter__.return_value
            smtp.send_message.return_value = {}
            factory.return_value.__exit__.side_effect = smtplib.SMTPServerDisconnected("synthetic-close-error")
            setup.owner_test(ENV, send=True)
        smtp.send_message.assert_called_once()
        self.assertIn("accepted", output.getvalue())
        self.assertNotIn("synthetic-close-error", output.getvalue())


if __name__ == "__main__":
    unittest.main()
