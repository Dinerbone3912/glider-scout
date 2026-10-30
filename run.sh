#!/usr/bin/env bash
# run.sh — get a working Glider Scout server in 10s, no clone needed beyond this dir.
# Usage: ./run.sh [PORT]
set -euo pipefail
PORT="${1:-8790}"
command -v node >/dev/null || { echo "need node >=18"; exit 1; }
echo "[glider-scout] starting on http://127.0.0.1:${PORT}"
PORT="$PORT" exec node server.mjs
