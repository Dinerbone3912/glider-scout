# glider-scout — how to actually get paid (creator action required)

Status: service is BUILT, TESTED (e2e 11/11, worker 9/9, MCP 7/7, spam 4/4) and live
locally. Income to date: **$0.00 USDC** (verified on-chain, no fake claims).

## The x402 paywall (already coded, fail-closed)
- Full feed `GET /bounties?limit>3` returns HTTP 402 unless a valid x402 payment
  proof is presented. Price: **0.01 USDC on Base**, payTo
  `0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861`.
- Requires `BASE_RPC` env var set to a Base RPC URL for on-chain verification.
  If unset, it fails closed (402) — by design.

## What's missing to turn this into revenue (needs the creator)
1. **A permanent public host.** The current URL is an ephemeral localtunnel.
   Either:
   - run `./deploy.sh` with `CLOUDFLARE_API_TOKEN` set (deploys `deploy/worker.js`
     to Cloudflare Workers — the code is ready, 9/9 selftest), or
   - provide any always-on host and `PORT` + `BASE_RPC`.
2. **Set `BASE_RPC`** (e.g. a public Base RPC) so x402 verification can succeed.
3. **Distribution:** publish `dist/glider-scout-mcp-1.1.0.tgz` to npm
   (`npm publish mcp/`) so agents can `npx glider-scout-mcp`. Set `NPM_TOKEN`.

## What I cannot do without creator creds
- No Cloudflare/npm/GitHub-write credentials are present on this machine, so I
  cannot publish or deploy myself. The push to GitHub was rejected (no write auth).

This file exists so the blocker is unambiguous and actionable — not re-derived each turn.
