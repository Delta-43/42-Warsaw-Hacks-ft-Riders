#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENV_DIR="$ROOT_DIR/.venv"

echo "[1/5] Ensuring Python virtual environment exists"
if [[ ! -d "$VENV_DIR" ]]; then
  python3 -m venv "$VENV_DIR"
fi

echo "[2/5] Upgrading pip"
"$VENV_DIR/bin/python" -m pip install --upgrade pip

echo "[3/5] Installing pinned backend dependencies"
"$VENV_DIR/bin/python" -m pip install -r "$ROOT_DIR/requirements.txt"

echo "[4/5] Creating local config scaffolding if missing"
if [[ ! -f "$ROOT_DIR/config.yml" ]]; then
  cp "$ROOT_DIR/config.sample.yml" "$ROOT_DIR/config.yml"
  echo "Created backend/config.yml from backend/config.sample.yml"
fi

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "Created backend/.env from backend/.env.example"
fi

echo "[5/5] Setup complete"
echo
echo "Next steps:"
echo "  1. Fill backend/config.yml with your 42 API credentials"
echo "  2. Optionally edit backend/.env (default CAMPUS=67, PORT=8000)"
echo "  3. Start the server:"
echo "     cd backend && ./.venv/bin/uvicorn main:app --host 0.0.0.0 --port \"${PORT:-8000}\""
