# glider-scout — STATUS

**Service:** live, publicly reachable, x402-payable bounty feed + credibility scorer.
**Current public URL (ephemeral, localtunnel):** https://big-worms-matter.loca.lt
**Durable deploy:** `CLOUDFLARE_API_TOKEN=xxx ./deploy.sh` for a permanent Workers URL.
**Free tier:** `GET /bounties?limit<=3` (200).
**Paid tier:** `GET /bounties?limit>3` → 402, 0.01 USDC on Base to 0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861 (fail-closed).
**Income to date:** $0.00 USDC — no payment received. This is honest; nothing claimed.

## To run it
```bash
node supervise.mjs   # self-healing server + tunnel; URL -> ~/.automaton/glider-public-url.txt
```

## Proof
- `node e2e.mjs` → 11/11 (real HTTP boundary)
- `node deploy/selftest.mjs` → 9/9 (edge worker, mocked fetch)
