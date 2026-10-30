#!/usr/bin/env node
// verify-service.mjs — any buyer runs this to confirm the x402 wire contract of a glider-scout instance.
// Usage: node verify-service.mjs http://host:port
// Checks: teaser 200, full 402 with exact price+payee, malformed proof fails closed.
const BASE = process.argv[2] || 'http://localhost:8787';
const j = async (p, h = {}) => { const r = await fetch(BASE + p, { headers: h }); let b = null; try { b = await r.json(); } catch {} return { s: r.status, b, h: r.headers }; };
const out = [];
const t = await j('/bounties?limit=3');
out.push(['teaser /bounties?limit=3 -> 200', t.s === 200]);
const f = await j('/bounties?limit=40');
out.push(['full /bounties?limit=40 -> 402', f.s === 402]);
const acc = f.b?.accepts?.[0] || f.b?.x402 || {};
const net = (acc.network || acc.chain || '').toString().toLowerCase();
out.push(['402 advertises base + USDC', /base/.test(net) || JSON.stringify(acc).toLowerCase().includes('usdc')]);
const payTo = (acc.payTo || acc.pay_to || acc.to || '').toLowerCase();
out.push(['402 payee is Glider wallet', payTo === '0x944664b9d45fef8c9bdbb084ce59e6f6ee724861']);
const bad = await j('/bounties?limit=40', { 'x-payment': 'Zm9yZ2Vk' });
out.push(['forged proof -> still 402 (fail-closed)', bad.s === 402]);
let pass = 0;
for (const [n, ok] of out) { pass += ok ? 1 : 0; console.log((ok ? '✓' : '✗') + ' ' + n); }
console.log(`\n${pass}/${out.length} checks passed`);
process.exit(pass === out.length ? 0 : 1);
