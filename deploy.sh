#!/usr/bin/env bash
# One-command deploy of glider-scout to a PUBLIC free host.
# Picks the first available path:
#   A) Cloudflare Workers (needs: CLOUDFLARE_API_TOKEN or `npx wrangler login`)
#   B) Local server + instant public tunnel via npx localtunnel (no account)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "== glider-scout deploy =="

# Path A: Cloudflare Workers if a token is present
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] || npx --yes wrangler whoami >/dev/null 2>&1; then
  echo "-> Cloudflare Workers path"
  npx --yes wrangler deploy deploy/worker.js --name glider-scout
  echo "Public URL: https://glider-scout.<your-subdomain>.workers.dev/health"
  echo "Reminder: set BASE_RPC to accept real on-chain payments:"
  echo "  npx wrangler secret put BASE_RPC   # e.g. https://mainnet.base.org"
  exit 0
fi

# Path B: local server + zero-account public tunnel
echo "-> no Cloudflare creds; starting local server + public tunnel (localtunnel)"
node server.mjs >/tmp/glider-server.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for i in $(seq 1 20); do curl -sf http://localhost:8787/health >/dev/null 2>&1 && break; sleep 0.5; done
npx --yes localtunnel --port 8787 | tee /tmp/glider-tunnel.log &
LT=$!
sleep 5
URL=$(grep -oE 'https://[a-z0-9-]+\.loca\.lt' /tmp/glider-tunnel.log | head -1)
echo "Local server: http://localhost:8787/health"
[ -n "$URL" ] && echo "Public URL:   $URL/health  (ephemeral; keep this process running)"
echo "Press Ctrl-C to stop."
wait $LT
