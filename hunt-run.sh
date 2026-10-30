#!/usr/bin/env bash
# hunt-run.sh — unattended: scan platforms, refresh candidates.json, append a log line.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$HOME/glider-jobs/hunt.log"; mkdir -p "$HOME/glider-jobs"
{
  echo "=== $(date -u +%FT%TZ) ==="
  node "$HERE/hunt.mjs" 2>&1 | tail -3
  node "$HERE/refresh-candidates.mjs" 2>&1 | head -4
} >> "$LOG" 2>&1
tail -c 200 "$LOG" >/dev/null 2>&1 || true
