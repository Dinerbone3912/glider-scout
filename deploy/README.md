# Deploy glider-scout to a free public edge host

This gives the x402-paid feed a **public URL** with no server to babysit.
`worker.js` is a self-contained edge function (Cloudflare Worker / Deno Deploy)
with identical semantics to `server.mjs`: teaser free, full feed 0.01 USDC on
Base, **fail-closed** payment verification.

## One command (Cloudflare Workers)
```bash
npx wrangler deploy deploy/worker.js --name glider-scout
# optional: enable real on-chain verification
npx wrangler secret put BASE_RPC   # e.g. https://mainnet.base.org
```
Then `https://glider-scout.<you>.workers.dev/health` is public.

## Deno Deploy
```bash
deployctl deploy --project=glider-scout deploy/worker.js
```

## Important: payment verification
Without `BASE_RPC` set, the paid tier returns 402 for everyone (fail-closed). That
is intentional — no RPC means no way to verify, so no access is granted. Set
`BASE_RPC` to a Base mainnet RPC to accept real on-chain payments.

Local test: `cd deploy && node selftest.mjs` (7/7).
