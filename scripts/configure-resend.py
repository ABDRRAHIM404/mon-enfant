#!/usr/bin/env python3
"""Targeted hosted Auth SMTP setup. Credentials come only from the environment.

--plan is offline and needs no credentials. --check verifies the actual Resend
domain, SMTP authentication and hosted settings without modifying them. --apply
does the same preflight, PATCHes only mail configuration, and verifies the result.
Only --send-owner-test sends email: one fixed non-clinical SMTP test to the
Resend account owner's address. It never changes Supabase. --apply-owner-auth
explicitly configures the synthetic app's Auth sender for owner-only testing;
other recipients still need a verified domain. All setup modes send no email.
Do not run with HTTP debug logging enabled.
"""
import argparse
import http.client
import json
import os
import re
import smtplib
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from email.message import EmailMessage

PROJECT = "zkkasbxvdvecnafgjpxd"
SITE = "https://mon-enfant.vercel.app"
AUTH_URL = f"https://api.supabase.com/v1/projects/{PROJECT}/config/auth"
MAIL_KEYS = frozenset({"smtp_host", "smtp_port", "smtp_user", "smtp_pass",
    "smtp_admin_email", "smtp_sender_name", "smtp_max_frequency", "rate_limit_email_sent"})
PRESERVED_KEYS = ("site_url", "uri_allow_list", "mailer_autoconfirm",
    "jwt_exp", "refresh_token_rotation_enabled", "security_refresh_token_reuse_interval",
    "mailer_templates_confirmation_content", "mailer_templates_recovery_content")
TEST_SENDER = "onboarding@resend.dev"
ADDRESS = re.compile(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


class SetupError(Exception):
    """Only fixed, non-secret messages may be passed to this exception."""


def required(env, key):
    value = env.get(key, "").strip()
    if not value:
        raise SetupError(f"Missing environment variable: {key}")
    return value


def settings(env):
    sender = required(env, "MAIL_FROM_EMAIL")
    if not ADDRESS.fullmatch(sender):
        raise SetupError("MAIL_FROM_EMAIL must be a single address on your verified sending domain.")
    name = env.get("MAIL_FROM_NAME", "Mon Enfant").strip()
    if not name or len(name) > 100 or any(ord(c) < 32 for c in name):
        raise SetupError("Invalid MAIL_FROM_NAME.")
    try:
        hourly = int(env.get("AUTH_EMAIL_RATE_LIMIT", "30"))
        cooldown = int(env.get("AUTH_EMAIL_COOLDOWN_SECONDS", "60"))
    except ValueError:
        raise SetupError("Email limits must be integers.") from None
    if not 3 <= hourly <= 100 or not 60 <= cooldown <= 3600:
        raise SetupError("Use 3–100 Auth emails/hour and a 60–3600 second recipient cooldown.")
    return {"smtp_host": "smtp.resend.com", "smtp_port": "465", "smtp_user": "resend",
        "smtp_pass": required(env, "RESEND_API_KEY"), "smtp_admin_email": sender,
        "smtp_sender_name": name, "smtp_max_frequency": cooldown,
        "rate_limit_email_sent": hourly}


def request_json(url, token, method="GET", body=None):
    req = urllib.request.Request(url, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json",
            "User-Agent": "MonEnfant-MailSetup/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Provider messages can contain addresses or credential material. Never echo them.
        raise SetupError(f"Provider request failed (HTTP {error.code}); no credentials or response body logged.") from None
    except (urllib.error.URLError, TimeoutError, ValueError):
        raise SetupError("Provider request failed; no credentials or response body logged.") from None


def validate_domain(domain, sender):
    if (domain.get("status") != "verified" or
        domain.get("capabilities", {}).get("sending") != "enabled" or
        sender.rsplit("@", 1)[-1].lower() != str(domain.get("name", "")).lower()):
        raise SetupError("The exact sender domain must be verified and enabled for sending in Resend.")
    if domain.get("click_tracking") is not False or domain.get("open_tracking") is not False:
        raise SetupError("Disable click and open tracking on the Resend Auth sending domain before applying.")


class ProxySMTP(smtplib.SMTP_SSL):
    def _get_socket(self, host, port, timeout):
        proxy = urllib.request.getproxies().get("https")
        if not proxy:
            return super()._get_socket(host, port, timeout)
        parsed = urllib.parse.urlsplit(proxy)
        if parsed.scheme != "http" or parsed.username or parsed.password:
            raise SetupError("SMTP setup supports an unauthenticated HTTP CONNECT proxy or a direct connection.")
        connection = http.client.HTTPConnection(parsed.hostname, parsed.port or 8080, timeout=timeout)
        connection.set_tunnel(host, port)
        try:
            connection.connect()
            return self.context.wrap_socket(connection.sock, server_hostname=host)
        except Exception:
            connection.close()
            raise


def verify_smtp(key):
    try:
        with ProxySMTP("smtp.resend.com", 465, timeout=25, context=ssl.create_default_context()) as smtp:
            smtp.login("resend", key)
            smtp.noop()
    except SetupError:
        raise
    except Exception:
        raise SetupError("SMTP TLS/authentication check failed; no email sent and no credential logged.") from None


def owner_test(env, send=False):
    """Exercise real Resend SMTP without reconfiguring global Auth delivery."""
    key = required(env, "RESEND_API_KEY")
    if not send:
        verify_smtp(key)
        print("PASS: SMTP TLS/authentication accepted. No email sent; Supabase unchanged.")
        return
    recipient = required(env, "RESEND_TEST_RECIPIENT")
    if not ADDRESS.fullmatch(recipient):
        raise SetupError("RESEND_TEST_RECIPIENT must be one address belonging to the Resend account owner.")
    try:
        operation = str(uuid.UUID(required(env, "RESEND_SMOKE_OPERATION_ID")))
    except ValueError:
        raise SetupError("RESEND_SMOKE_OPERATION_ID must be a UUID retained for retries.") from None
    message = EmailMessage()
    message["From"] = "Mon Enfant <" + TEST_SENDER + ">"
    message["To"] = recipient
    message["Subject"] = "Mon Enfant — test SMTP Resend"
    message["Message-ID"] = "<" + operation + "@mon-enfant.test>"
    message["Resend-Idempotency-Key"] = "mon-enfant/owner-smoke/" + operation
    message.set_content("Test technique de livraison SMTP pour Mon Enfant.\n"
        "Ce message ne contient aucune donnée clinique ni lien de connexion.\n")
    send_started = False
    accepted = False
    try:
        with ProxySMTP("smtp.resend.com", 465, timeout=25, context=ssl.create_default_context()) as smtp:
            smtp.login("resend", key)
            send_started = True
            refused = smtp.send_message(message, from_addr=TEST_SENDER, to_addrs=[recipient])
            if refused:
                raise SetupError("SMTP recipient refused; no recipient or provider message logged.")
            accepted = True
    except SetupError:
        raise
    except Exception:
        if not accepted:
            if send_started:
                raise SetupError("SMTP test outcome is unknown. Inspect Resend before retrying with the same operation ID.") from None
            raise SetupError("SMTP test connection/authentication failed; no recipient or credential logged.") from None
        # A QUIT/connection-close failure does not undo an accepted message.
    print("PASS: one owner-only test message accepted by Resend SMTP. Supabase unchanged.")
    print("Provider acceptance is not mailbox-delivery proof; confirm receipt privately.")


def configure(env, apply=False, owner_only=False):
    if owner_only:
        recipient = required(env, "RESEND_TEST_RECIPIENT")
        if not ADDRESS.fullmatch(recipient):
            raise SetupError("Owner-only Auth testing needs the Resend account owner's single email address.")
        mail = settings({**env, "MAIL_FROM_EMAIL": TEST_SENDER})
    else:
        mail = settings(env)
    token = required(env, "SUPABASE_ACCESS_TOKEN")
    if not owner_only:
        domain_id = required(env, "RESEND_DOMAIN_ID")
        if not re.fullmatch(r"[0-9a-fA-F-]{36}", domain_id):
            raise SetupError("RESEND_DOMAIN_ID must be the verified domain's UUID.")
        # Keep the domain-management credential operator-only. A domain-restricted
        # sending key is used as the SMTP password and never shipped to the browser.
        admin = required(env, "RESEND_ADMIN_API_KEY")
        domain = request_json("https://api.resend.com/domains/" + domain_id, admin)
        validate_domain(domain, mail["smtp_admin_email"])
    verify_smtp(mail["smtp_pass"])
    before = request_json(AUTH_URL, token)
    if before.get("site_url") != SITE or before.get("mailer_autoconfirm") is not False:
        raise SetupError("Unexpected Auth origin or email-confirmation setting; no changes applied.")
    if before.get("hook_send_email_enabled"):
        raise SetupError("An active Send Email hook overrides SMTP; review it before switching delivery.")
    if apply:
        if set(mail) != MAIL_KEYS:
            raise SetupError("Unexpected Auth configuration fields; no changes applied.")
        request_json(AUTH_URL, token, "PATCH", mail)
        after = request_json(AUTH_URL, token)
        if any(after.get(k) != before.get(k) for k in PRESERVED_KEYS):
            raise SetupError("Auth settings changed unexpectedly; inspect hosted configuration before retrying.")
        # smtp_pass is deliberately omitted: it is commonly masked on readback.
        if any(str(after.get(k)) != str(v) for k, v in mail.items() if k != "smtp_pass"):
            raise SetupError("Mail configuration readback differs; inspect hosted settings before retrying.")
        print("PASS: Resend SMTP settings and email limits applied and read back; Auth/session settings preserved.")
    else:
        actual = {k: before.get(k) for k in sorted(MAIL_KEYS) if k != "smtp_pass"}
        # Print only connection/limit state; do not print even the sender address.
        actual.pop("smtp_admin_email", None)
        actual.pop("smtp_sender_name", None)
        print("PASS: owner-only test sender and SMTP TLS/authentication checked." if owner_only else
            "PASS: verified sender domain, tracking disabled and SMTP TLS/authentication accepted.")
        print("Current hosted mail settings:", json.dumps(actual, sort_keys=True))
    if owner_only:
        print("OWNER-ONLY TEST MODE: Resend restricts the shared sender to its account owner's inbox. Other recipients require a verified domain.")
    print("No email sent. Real signup/recovery delivery still requires a mailbox walkthrough.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--plan", action="store_true")
    modes.add_argument("--check", action="store_true")
    modes.add_argument("--apply", action="store_true")
    modes.add_argument("--check-owner-test", action="store_true")
    modes.add_argument("--send-owner-test", action="store_true")
    modes.add_argument("--check-owner-auth", action="store_true")
    modes.add_argument("--apply-owner-auth", action="store_true")
    args = parser.parse_args()
    if args.plan:
        print("Target: Mon Enfant hosted Supabase Auth; Resend SMTP over TLS on port 465.")
        print("Default limits: 30 Auth emails/hour; 60-second recipient cooldown. Provider quotas also apply.")
        print("Required environment names: RESEND_API_KEY, RESEND_ADMIN_API_KEY, RESEND_DOMAIN_ID, MAIL_FROM_EMAIL, SUPABASE_ACCESS_TOKEN.")
        print("Without a domain: --check-owner-test needs RESEND_API_KEY; --send-owner-test additionally needs RESEND_TEST_RECIPIENT and a retained RESEND_SMOKE_OPERATION_ID UUID.")
        print("Owner-only Auth setup: --check-owner-auth / --apply-owner-auth also need RESEND_TEST_RECIPIENT and SUPABASE_ACCESS_TOKEN; shared sender is forced to onboarding@resend.dev.")
        print("No network calls, changes or email sent.")
        return 0
    try:
        if args.check_owner_test or args.send_owner_test:
            owner_test(os.environ, send=args.send_owner_test)
        else:
            configure(os.environ, apply=args.apply or args.apply_owner_auth,
                owner_only=args.check_owner_auth or args.apply_owner_auth)
        return 0
    except SetupError as error:
        print("SETUP PENDING:", str(error), file=sys.stderr)
        return 1
    except Exception:
        print("SETUP PENDING: unexpected operator error; no raw exception or credentials logged.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
