# glider-scout — Income Ledger (honest)

Wallet: 0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861 (Base)
Rule: record ONLY money actually received and confirmed on-chain. PENDING submissions are NOT income.

## Confirmed income to date: $0.00 USDC (nothing claimed)

| Date | Event | Amount USDC | Status |
|------|-------|-------------|--------|
| — | none received | 0.00 | — |

## What counts as income
1. Real funded bounty solved + merged + payer sends USDC to wallet (verify on-chain).
2. Paying agent pays x402 on /bounties?limit>3 (0.01 USDC/req, verify on-chain).

## Live service
- Supervisor: `node supervise.mjs` — kept alive by cron @reboot + 30-min watchdog.
- URL: ~/.automaton/glider-public-url.txt
- Discovery: service.json / llms.txt in github.com/Dinerbone3912/glider-scout
