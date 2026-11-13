#!/usr/bin/env python3
"""Targeted hosted Auth SMTP setup. Credentials come only from the environment.

--plan is offline and needs no credentials. --check verifies the actual Resend
domain, SMTP authentication and hosted settings without modifying them. --apply
does the same preflight, PATCHes only mail configuration, and verifies the result.
No email is sent by any mode. Do not run with HTTP debug logging enabled.
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

PROJECT = "zkkasbxvdvecnafgjpxd"
SITE = "https://mon-enfant.vercel.app"
AUTH_URL = f"https://api.supabase.com/v1/projects/{PROJECT}/config/auth"
MAIL_KEYS = frozenset({"smtp_host", "smtp_port", "smtp_user", "smtp_pass",
    "smtp_admin_email", "smtp_sender_name", "smtp_max_frequency", "rate_limit_email_sent"})
PRESERVED_KEYS = ("site_url", "uri_allow_list", "mailer_autoconfirm",
    "jwt_exp", "refresh_token_rotation_enabled", "security_refresh_token_reuse_interval",
    "mailer_templates_confirmation_content", "mailer_templates_recovery_content")


class SetupError(Exception):
    """Only fixed, non-secret messages may be passed to this exception."""


def required(env, key):
    value = env.get(key, "").strip()
    if not value:
        raise SetupError(f"Missing environment variable: {key}")
    return value


def settings(env):
    sender = required(env, "MAIL_FROM_EMAIL")
    if not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", sender):
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


def configure(env, apply=False):
    mail = settings(env)
    token = required(env, "SUPABASE_ACCESS_TOKEN")
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
        print("PASS: verified sender domain, tracking disabled and SMTP TLS/authentication accepted.")
        print("Current hosted mail settings:", json.dumps(actual, sort_keys=True))
    print("No email sent. Real signup/recovery delivery still requires a mailbox walkthrough.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--plan", action="store_true")
    modes.add_argument("--check", action="store_true")
    modes.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.plan:
        print("Target: Mon Enfant hosted Supabase Auth; Resend SMTP over TLS on port 465.")
        print("Default limits: 30 Auth emails/hour; 60-second recipient cooldown. Provider quotas also apply.")
        print("Required environment names: RESEND_API_KEY, RESEND_ADMIN_API_KEY, RESEND_DOMAIN_ID, MAIL_FROM_EMAIL, SUPABASE_ACCESS_TOKEN.")
        print("No network calls, changes or email sent.")
        return 0
    try:
        configure(os.environ, args.apply)
        return 0
    except SetupError as error:
        print("SETUP PENDING:", str(error), file=sys.stderr)
        return 1
    except Exception:
        print("SETUP PENDING: unexpected operator error; no raw exception or credentials logged.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
