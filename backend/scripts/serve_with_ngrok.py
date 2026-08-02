#!/usr/bin/env python3
"""Expose the local backend on a public ngrok URL.

Start the API normally first, then run this alongside it:

    uvicorn main:app --port 8000
    python scripts/serve_with_ngrok.py --port 8000

Requires an ngrok authtoken (free): https://dashboard.ngrok.com/get-started/your-authtoken
Set it via the NGROK_AUTHTOKEN env var, or once via `ngrok config add-authtoken <token>`.
Install the extra dependency first: pip install -r requirements-dev.txt
"""

import argparse
import os
import time

from pyngrok import conf, ngrok


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    args = parser.parse_args()

    authtoken = os.environ.get("NGROK_AUTHTOKEN")
    if authtoken:
        conf.get_default().auth_token = authtoken

    tunnel = ngrok.connect(args.port, "http")
    print(f"Public URL: {tunnel.public_url} -> http://127.0.0.1:{args.port}")
    print("Press Ctrl+C to stop the tunnel.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        ngrok.disconnect(tunnel.public_url)
        ngrok.kill()


if __name__ == "__main__":
    main()
