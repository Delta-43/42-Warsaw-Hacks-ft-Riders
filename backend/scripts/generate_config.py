#!/usr/bin/env python3
"""
Generate backend/config.yml from environment variables if it doesn't already exist.

Required env vars:
  INTRA_CLIENT   - 42 API v2 client UID
  INTRA_SECRET   - 42 API v2 client secret

Optional env vars (v3 / staff API, leave empty if unused):
  INTRA_V3_CLIENT
  INTRA_V3_SECRET
  INTRA_V3_LOGIN
  INTRA_V3_PASSWORD

Run this script before starting the server on Railway (or any environment
where config.yml is not committed to the repo):

    python scripts/generate_config.py
"""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BACKEND_DIR / "config.yml"
SAMPLE_PATH = BACKEND_DIR / "config.sample.yml"


def main() -> None:
    if CONFIG_PATH.exists():
        print(f"config.yml already exists at {CONFIG_PATH} — skipping generation.")
        return

    client = os.environ.get("INTRA_CLIENT", "").strip()
    secret = os.environ.get("INTRA_SECRET", "").strip()

    if not client or not secret:
        print(
            "ERROR: INTRA_CLIENT and INTRA_SECRET environment variables must be set "
            "to generate config.yml.",
            file=sys.stderr,
        )
        sys.exit(1)

    v3_client = os.environ.get("INTRA_V3_CLIENT", "").strip()
    v3_secret = os.environ.get("INTRA_V3_SECRET", "").strip()
    v3_login = os.environ.get("INTRA_V3_LOGIN", "").strip()
    v3_password = os.environ.get("INTRA_V3_PASSWORD", "").strip()

    config = f"""\
intra:
  v2:
    client: "{client}"
    secret: "{secret}"
    uri: "https://api.intra.42.fr/v2/oauth/token"
    endpoint: "https://api.intra.42.fr/v2"
    scopes: "public"
  v3:
    client: "{v3_client}"
    secret: "{v3_secret}"
    login: "{v3_login}"
    password: "{v3_password}"
    uri: 'https://auth.42.fr/auth/realms/staff-42/protocol/openid-connect/token'
"""

    CONFIG_PATH.write_text(config, encoding="utf-8")
    print(f"config.yml written to {CONFIG_PATH}")


if __name__ == "__main__":
    main()
