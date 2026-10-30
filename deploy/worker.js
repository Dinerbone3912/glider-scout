// glider-scout as a Cloudflare Worker / Deno Deploy edge function.
// Zero external deps. Deploy to get a PUBLIC x402-paid feed.
//
//   Cloudflare:  npx wrangler deploy deploy/worker.js --name glider-scout
//   Deno:        deployctl deploy --project=glider-scout deploy/worker.js
//
// Semantics match server.mjs: seed-backed feed, free teaser (limit<=3),
// paid full feed (0.01 USDC Base) with FAIL-CLOSED x402 verification.

const PAY_TO = "0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861";
const PRICE = "0.01";
const NETWORK = "base";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "x-payment,content-type",
  "access-control-allow-methods": "GET,OPTIONS",
};

const SEED = [
  { title: "(seed) deploy note", url: "https://github.com/Dinerbone3912/glider-scout", reward: 0, verdict: "SEED" },
];

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "content-type": "application/json", ...CORS },
  });
}

function paymentRequired(resource) {
  return {
    x402Version: 1, error: "payment required",
    accepts: [{
      scheme: "exact", network: NETWORK, maxAmountRequired: PRICE,
      resource, payTo: PAY_TO, asset: "USDC", mimeType: "application/json",
      description: "Glider Scout verified bounty feed",
    }],
  };
}

async function verifyPayment(header, env) {
  if (!header) return { paid: false, reason: "no payment header" };
  let proof;
  try { proof = JSON.parse(decodeURIComponent(escape(atob(header)))); }
  catch { return { paid: false, reason: "malformed proof" }; }
  if (!proof.tx) return { paid: false, reason: "missing tx" };
  if ((proof.network || "").toLowerCase() !== NETWORK) return { paid: false, reason: "wrong network" };
  const rpc = env && env.BASE_RPC;
  if (!rpc) return { paid: false, reason: "verification unavailable (no RPC)" };
  try {
    const r = await fetch(rpc, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [proof.tx] }),
    });
    const j = await r.json();
    if (!j.result || j.result.status !== "0x1") return { paid: false, reason: "tx not confirmed" };
    return { paid: true, tx: proof.tx };
  } catch { return { paid: false, reason: "rpc error" }; }
}

export default {
  async fetch(req, env = {}) {
    const u = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (u.pathname === "/health") {
      return json({ ok: true, service: "glider-scout", priced: "/bounties?limit>3", price: `${PRICE} USDC base`, payTo: PAY_TO, source: "seed" });
    }
    if (u.pathname === "/bounties") {
      const lim = Math.min(100, Number(u.searchParams.get("limit") || 40));
      if (lim > 3) {
        const v = await verifyPayment(req.headers.get("x-payment"), env);
        if (!v.paid) return json(paymentRequired(`${u.origin}/bounties?limit=${lim}`), 402);
      }
      const items = SEED.slice(0, lim);
      return json({ source: "seed", stale: true, count: items.length, items });
    }
    if (u.pathname === "/score") {
      const url = u.searchParams.get("url") || "";
      return json({ url, verdict: "UNVERIFIED", score: 2, note: "edge deploy is seed-only; run full server for live scoring" });
    }
    return json({ error: "not found" }, 404);
  },
};
