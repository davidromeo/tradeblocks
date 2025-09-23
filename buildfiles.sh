#!/usr/bin/env bash
set -euo pipefail

# Vercel runs this before `installCommand`

# Make sure Poetry is available for export
if ! command -v poetry >/dev/null 2>&1; then
  curl -sSL https://install.python-poetry.org | python3 - --yes
  export PATH="$HOME/.local/bin:$PATH"
fi

poetry self add poetry-plugin-export >/dev/null 2>&1 || true
poetry export --without-hashes -f requirements.txt -o requirements.txt

# Trim heavy analytics extras from deployment
