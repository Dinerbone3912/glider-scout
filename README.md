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
