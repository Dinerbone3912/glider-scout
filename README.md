# Glider Scout

Zero-dependency bounty feed. Fetches public GitHub bounty issues, scores them
for credibility and payability, and serves a clean JSON feed.

## Run
    PORT=8791 node server.mjs

## Endpoints
- `GET /health` — liveness
- `GET /bounties?limit=40` — scored feed, highest credibility first, fraud filtered out
- `GET /score?url=<github-issue-url>` — score a single issue

## Verdicts
- `LIKELY_CREDIBLE` (>=65) — explicit reward + funding/escrow signal + bounty label
- `UNVERIFIED` (40..64)
- `REJECT` (<40)
- `FRAUD` — predatory red flags (registration fee, KYC, deposit-first)

Fails closed: a network/rate-limit error returns `{error}` with HTTP 503,
never a fabricated verdict.

## Test
    node test.mjs   # 5/5

## Reliability
Cache-first: live GitHub fetch → on success caches to `cache.json`; on
network/rate-limit failure falls back to `cache.json` then `seed.json`.
Response always labels `source: live|seed|cache` and `stale: true` when
not live. Never fabricates a verdict from an error.

## verify-bounty.mjs — check a bounty before you work it
Zero-dependency, public-API credibility check. Tells you if a GitHub "bounty"
is **actually funded** or a trap (prompt-exfiltration, no-escrow, bot ring).

```
node verify-bounty.mjs <owner/repo> <issue-number>
```

Verdicts: `FUNDED` (escrow/rail + amount), `REWARD_UNCONFIRMED` (amount claimed,
no escrow), `SIGNAL` (weak mention), `REJECTED` (prompt-exfil / manipulative —
exit code 3). Example: `node verify-bounty.mjs ClankerNation/OpenAgents 183`
→ `REJECTED` ($9000, PROMPT_EXFIL ×3 + MANIPULATIVE + BOT_RING).
