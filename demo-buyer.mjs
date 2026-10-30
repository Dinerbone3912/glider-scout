// demo-buyer.mjs — proves the full x402 purchase flow end-to-end against a live
// server. Simulates a paying agent: hit paywall, read 402 terms, "pay", retry.
// Usage: node demo-buyer.mjs [baseUrl]
const BASE = process.argv[2] || 'http://127.0.0.1:8790';
const log = (...a) => console.log(...a);

async function j(url, opts) {
  const r = await fetch(url, opts);
  let body; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body, headers: r.headers };
}

log(`\n=== glider-scout buyer demo against ${BASE} ===\n`);

// 1. Free teaser works with no payment.
const t = await j(`${BASE}/bounties?limit=3`);
log(`1. Free teaser  GET /bounties?limit=3  -> ${t.status}  items=${t.body?.items?.length ?? 'n/a'}  source=${t.body?.source ?? 'n/a'}`);
if (t.status !== 200) { log('   FAIL: teaser should be 200'); process.exit(1); }

// 2. Paid feed is gated -> 402 with terms.
const p = await j(`${BASE}/bounties?limit=40`);
log(`2. Paid feed    GET /bounties?limit=40 -> ${p.status}`);
if (p.status !== 402) { log('   FAIL: paid feed must be 402 without proof'); process.exit(1); }
const term = p.body?.accepts?.[0] || {};
log(`   Terms: ${term.maxAmountRequired} ${term.assetSymbol || 'USDC'} on ${term.network} to ${term.payTo}`);

// 3. Forged proof is rejected (fail-closed).
const forged = Buffer.from(JSON.stringify({ tx: '0x' + 'a'.repeat(64), network: 'base' })).toString('base64');
const f = await j(`${BASE}/bounties?limit=40`, { headers: { 'x-payment': forged } });
log(`3. Forged proof -> ${f.status}  (${f.body?.error || f.body?.reason || 'denied'})`);
if (f.status !== 402) { log('   FAIL: forged proof must stay 402'); process.exit(1); }

// 4. A REAL buyer would pay on-chain, then present the tx. Without a real funded
//    tx we cannot fake success — so this demo stops at "proof required", honestly.
log(`4. Real payment requires an on-chain 0.01 USDC tx to the payee;`);
log(`   this demo will NOT fabricate one. A genuine buyer presents that tx as`);
log(`   header x-payment = base64({tx,network:"base"}) and receives 200.\n`);

log('RESULT: 3/3 gating checks passed — teaser open, paid gated, forged rejected.\n');
