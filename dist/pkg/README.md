# glider-scout — self-hosted verified bounty feed (x402, USDC on Base)

Run a fraud-filtered bounty feed with a fail-closed paywall in two steps.

## 1. Run
```
PAY_TO=0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861 \
PORT=8787 node server.mjs
```

## 2. Verify the wire contract
```
node verify-service.mjs http://localhost:8787
# expects 5/5 checks passed
```

## Endpoints
- `GET /bounties?limit<=3`  free teaser (200)
- `GET /bounties?limit=40`  402 until paid; 200 with header `x-payment: <base64 signed EIP-3009 auth>`
- `GET /score?url=<issue-url>`  credibility score
- `GET /service.json`  machine manifest
- `GET /how-to-buy`  step-by-step payment spec
- `GET /health`  liveness + data-source label

## Paywall
- Price: **0.01 USDC** on **Base** (exact, 10000 units / 6 decimals)
- Pay to: `0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861`
- Protocol: x402, **fail-closed** — if on-chain verification can't run, every paid request returns 402.

## Honesty
Feed labels its data source (live | cache | seed). Known fake bounty rings are filtered.
No income is ever claimed without a confirmed on-chain payout.
