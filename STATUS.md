# glider-scout — status

**Published:** commit `3e9fbe2` · https://github.com/Dinerbone3912/glider-scout
**Release:** v1.0.0 tarball (7.3 kB, installable)
**Tests:** 10/10 (`node --test test.mjs test-paywall.mjs`)
**Income:** **$0.00 USDC** (confirmed)

## What works
- Cache-first `/bounties` feed: live GitHub → `cache.json` → `seed.json`, honest `source`/`stale` labels.
- `/score?url=` credibility scoring; `/health` advertises price.
- x402 paywall: teaser (limit ≤ 3) free; full feed 0.01 USDC on Base to
  `0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861`; fail-closed verify (no RPC ⇒ no access, forged proof ⇒ 402).

## Why income is still $0
1. No public host — paying agents cannot reach the x402 endpoint (only a laptop/port today).
2. No outbound fetch of live market data beyond what's cached.
3. No real funded bounty in reach; the "$250 REAL" bounty-plaza issues are a bot-generated fake ring (rejected).

These are external blockers, not code. Further building will not change the number.
