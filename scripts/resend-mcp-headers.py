#!/usr/bin/env python3
"""Codex HTTP header helper. Stdout is credential-bearing: never run uncontained.

Configure as http_headers_helper, not a shell command containing the key.
The helper reads only RESEND_API_KEY from the process environment or a private
dotenv file. It does not load other variables or evaluate shell expressions.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shlex
import sys


def credential_headers(env_file, environ):
    key = environ.get("RESEND_API_KEY", "").strip()
    if not key and env_file.exists():
        info = env_file.stat()
        if info.st_mode & 0o077 or info.st_uid != os.getuid():
            raise ValueError("Private credential file required")
        values = []
        for line in env_file.read_text().splitlines():
            name, separator, value = line.partition("=")
            if separator and name.strip() == "RESEND_API_KEY":
                parts = shlex.split(value, comments=True)
                if len(parts) > 1:
                    raise ValueError("Single credential value required")
                values.append(parts[0] if parts else "")
        if len(values) > 1:
            raise ValueError("Ambiguous credential entries")
        key = values[0] if values else ""
    if not key:
        return {}
    if not re.fullmatch(r"re_[A-Za-z0-9_-]{10,}", key):
        raise ValueError("Invalid credential format")
    return {"Authorization": "Bearer " + key}


def main():
    parser = argparse.ArgumentParser(description="Credential header helper for the local Resend MCP connection.")
    parser.add_argument("--env-file", type=Path, required=True)
    args = parser.parse_args()
    try:
        headers = credential_headers(args.env_file, os.environ)
    except (OSError, ValueError):
        print("Resend credential unavailable; check private environment configuration.", file=sys.stderr)
        return 1
    print(json.dumps(headers))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
