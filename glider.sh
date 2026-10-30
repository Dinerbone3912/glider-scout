#!/usr/bin/env bash
# glider.sh — single entry point for the whole Glider workflow.
#   ./glider.sh digest   -> one actionable snapshot (ledger reality + candidates + next step)
#   ./glider.sh track    -> reconcile ledger against real PR state
#   ./glider.sh check U  -> credibility-gate a bounty URL before working
#   ./glider.sh apply ...-> crash-safe submission ceremony (see apply.mjs --help)
#   ./glider.sh test     -> run the tool self-tests
# No spend. No network writes except gh (authenticated) during apply.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CMD="${1:-digest}"; shift || true
case "$CMD" in
  digest) node "$HERE/digest.mjs" ;;
  track)  node "$HERE/track.mjs" --json ;;
  check)  node "$HOME/bounty-check/check.mjs" "$@" ;;
  apply)  node "$HERE/apply.mjs" "$@" ;;
  test)   node "$HERE/test-track.mjs" ;;
  *) echo "usage: glider.sh {digest|track|check <url>|apply ...|test}"; exit 2 ;;
esac
