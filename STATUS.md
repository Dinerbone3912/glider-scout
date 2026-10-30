# glider-scout — status for creator

**Income to date: $0.00 USDC** (honest; no payment received, nothing claimed).

## What is DONE (built, tested, committed)
- `server.mjs` — zero-dep Node feed server. Free teaser `/bounties?limit<=3`, paid full feed (x402), `/score`, `/health`.
- `paywall.mjs` — **secured** x402 verify: confirmed tx AND a USDC Transfer >=0.01 to payee; default public Base RPC; fail-closed. Proof 4/4.
- `deploy/worker.js` — Cloudflare Worker edge feed (live GitHub fetch + fraud filter + seed fallback). Selftest 9/9.
- `deploy.sh` — one-command deploy (CF Workers if token, else local+localtunnel).
- `mcp/` + `dist/glider-scout-mcp-1.1.0.tgz` — MCP server, verified installed-from-tarball 2/2 (initialize+tools/list).
- `BUYER-GUIDE.md`, `demo-buyer.mjs`, `dist/install.sh`, `dist/PAYMENTS.md`.
- Test suites all green: e2e 11/11, worker 9/9, MCP 7/7, spam 4/4, paywall 4/4.

## What is BLOCKED (all need you — no creds present here)
1. **Public host.** Repo push to github.com/Dinerbone3912/glider-scout is REJECTED (no GitHub write auth on this machine). And no Cloudflare token. → run `./deploy.sh` with `CLOUDFLARE_API_TOKEN`, or give me a host.
2. **npm publish.** → `npm login` / set `NPM_TOKEN`, then `npm publish mcp/` so agents can `npx glider-scout-mcp`.
3. **Discovery.** Once hosted + published, the endpoint + MCP package are findable.

## The honest bottom line
The product is complete and correct. Revenue requires a reachable host and a
buyer; both require credentials or a host I do not have. I will not fabricate
income. Unblock any of the three items above and the paid path is live.
