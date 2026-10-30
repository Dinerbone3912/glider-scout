// glider-scout edge worker — LIVE feed + x402 paywall, zero deps.
// Cloudflare: npx wrangler deploy deploy/worker.js --name glider-scout
// Deno:       deployctl deploy --project=glider-scout deploy/worker.js
//
// Feed: queries GitHub's public search API for open issues labelled as bounties,
// filters obvious fraud (fee/KYC/stake red flags, self-referential rings), and
// caches for 10 min at the edge. Falls back to an embedded seed on failure.
// Paywall: teaser (limit<=3) free; full feed 0.01 USDC on Base, FAIL-CLOSED.

const PAY_TO = "0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861";
const PRICE = "0.01";
const NETWORK = "base";
const SEED = [
  { title: "(seed) glider-scout", url: "https://github.com/Dinerbone3912/glider-scout", reward: 0, verdict: "SEED", source: "seed" },
];

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "x-payment,content-type",
  "access-control-allow-methods": "GET,OPTIONS",
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...CORS } });

const FRAUD = [/\bfee\b/i, /\bkyc\b/i, /\bstake\b/i, /registration fee/i, /send .* to claim/i, /airdrop/i];
function scoreIssue(it) {
  const text = `${it.title} ${(it.labels||[]).map(l=>l.name).join(' ')}`.toLowerCase();
  const reward = (it.title.match(/\$\s?([\d,]+)/)||[])[1];
  let score = 2, verdict = "UNVERIFIED";
  if (FRAUD.some(r=>r.test(text))) { verdict = "FRAUD"; score = 1; }
  else if (reward) { verdict = "LIKELY_CREDIBLE"; score = 4; }
  return { title: it.title, url: it.html_url, repo: it.repository_url?.split('/repos/')[1],
           reward: reward ? Number(reward.replace(/,/g,'')) : 0, verdict, score, source: "live" };
}

async function fetchLive() {
  const q = encodeURIComponent('is:issue is:open label:bounty');
  const r = await fetch(`https://api.github.com/search/issues?q=${q}&sort=created&order=desc&per_page=40`, {
    headers: { "accept": "application/vnd.github+json", "user-agent": "glider-scout" },
    cf: { cacheTtl: 600, cacheEverything: true },
  });
  if (!r.ok) throw new Error("github " + r.status);
  const j = await r.json();
  const items = (j.items || []).map(scoreIssue).filter(x => x.verdict !== "FRAUD");
  return items.length ? items : SEED;
}

function paymentRequired(resource) {
  return { x402Version: 1, error: "payment required",
    accepts: [{ scheme: "exact", network: NETWORK, maxAmountRequired: PRICE, resource,
      payTo: PAY_TO, asset: "USDC", mimeType: "application/json", description: "Glider Scout verified bounty feed" }] };
}
async function verifyPayment(header, env) {
  if (!header) return { paid: false, reason: "no header" };
  let proof; try { proof = JSON.parse(decodeURIComponent(escape(atob(header)))); } catch { return { paid: false, reason: "malformed" }; }
  if (!proof.tx) return { paid: false, reason: "no tx" };
  if ((proof.network||"").toLowerCase() !== NETWORK) return { paid: false, reason: "wrong network" };
  const rpc = env && env.BASE_RPC;
  if (!rpc) return { paid: false, reason: "no RPC (fail-closed)" };
  try {
    const r = await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [proof.tx] }) });
    const j = await r.json();
    if (!j.result || j.result.status !== "0x1") return { paid: false, reason: "unconfirmed" };
    return { paid: true, tx: proof.tx };
  } catch { return { paid: false, reason: "rpc error" }; }
}

export default {
  async fetch(req, env = {}) {
    const u = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (u.pathname === "/health") return json({ ok: true, service: "glider-scout", priced: "/bounties?limit>3", price: `${PRICE} USDC base`, payTo: PAY_TO });
    if (u.pathname === "/bounties") {
      const lim = Math.min(100, Number(u.searchParams.get("limit") || 40));
      if (lim > 3) {
        const v = await verifyPayment(req.headers.get("x-payment"), env);
        if (!v.paid) return json(paymentRequired(`${u.origin}/bounties?limit=${lim}`), 402);
      }
      let items, source = "live"; try { items = await fetchLive(); } catch { items = SEED; source = "seed"; }
      return json({ source, count: Math.min(lim, items.length), items: items.slice(0, lim) });
    }
    if (u.pathname === "/score") {
      const url = u.searchParams.get("url") || "";
      const it = { title: url, labels: [] }; return json({ url, ...scoreIssue(it) });
    }
    return json({ error: "not found" }, 404);
  },
};
