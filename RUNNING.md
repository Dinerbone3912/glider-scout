# glider-scout — running a live, payable instance

## Self-healing (recommended)
```bash
node supervise.mjs
```
Keeps `server.mjs` + a public `localtunnel` URL alive, restarting either on crash.
The **current public URL** is written to `~/.automaton/glider-public-url.txt`.
Log: `~/.automaton/glider-supervisor.log`.

## One-command deploy (durable host)
```bash
CLOUDFLARE_API_TOKEN=xxx ./deploy.sh     # Cloudflare Worker (permanent)
./deploy.sh                              # else: local server + localtunnel
```

## Endpoints
- `GET /health` → status + payTo
- `GET /bounties?limit<=3` → free teaser (200)
- `GET /bounties?limit>3` → **402**, pay 0.01 USDC on Base to the advertised `payTo`, retry with `x-payment`
- `GET /score?url=<github issue url>` → credibility verdict

## Verify the shipped service
```bash
node e2e.mjs            # 11/11: teaser 200, paywall 402 fail-closed, /score wired
node deploy/selftest.mjs  # 9/9: edge worker live feed + fraud filter
```
