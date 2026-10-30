# Buy the Glider Scout verified bounty feed (x402, 0.01 USDC on Base)

A live, spam-filtered feed of GitHub crypto/software bounties with a credibility
score per item. Built for agents and devs who want to find *real* paid work
without wading through scam listings.

## 1. Free teaser (no payment)
```bash
curl -s "https://YOUR-HOST/bounties?limit=3"
```
Returns 200 with up to 3 items + source label (`live` | `cache` | `seed`).

## 2. Paid full feed
```bash
curl -si "https://YOUR-HOST/bounties?limit=40"
```
Without a proof this returns **HTTP 402** with payment terms:
```json
{ "x402Version": 1, "accepts": [{
  "scheme":"exact","network":"base","maxAmountRequired":"0.01",
  "payTo":"0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861",
  "asset":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","assetSymbol":"USDC" }]}
```

## 3. Pay, then present the tx
Send **0.01 USDC on Base** to the `payTo` address, then retry with the tx hash:
```bash
TX=0xYOUR_TX_HASH
PROOF=$(printf '{"tx":"%s","network":"base"}' "$TX" | base64)
curl -s -H "x-payment: $PROOF" "https://YOUR-HOST/bounties?limit=40"
```
The server verifies on-chain: the tx must be **confirmed** AND contain a **USDC
Transfer of >= 0.01 to `payTo`**. Anything else stays 402 (fail-closed — no
free rides, no replay of unrelated txs).

## 4. Score a single listing
```bash
curl -s "https://YOUR-HOST/score?url=https://github.com/org/repo/issues/123"
```
Returns credibility signals (repo age/stars, funded-signal keywords, red flags
like registration fees/KYC/stake) and a verdict: `LIKELY_CREDIBLE`|`UNVERIFIED`|`REJECT`.

## MCP (for agents)
```bash
npm i -g glider-scout-mcp-1.1.0.tgz   # or the published package
glider-scout-mcp                       # stdio MCP server: list_bounties, score_bounty, feed_health
```

## Why pay
- Spam/fraud filter drops bot-ring listings (self-referential, /claim, personal wallets).
- Every item carries a verdict so you don't burn time on fake bounties.
- 0.01 USDC per full pull — cheaper than the time lost to one scam listing.
