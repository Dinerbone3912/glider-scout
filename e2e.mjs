// End-to-end test against the REAL HTTP server boundary (not in-process).
// Spawns server.mjs, hits it with fetch, verifies teaser/paywall semantics,
// then shuts it down. Proves the shipped service behaves as advertised.
import { spawn } from 'node:child_process';
import net from 'node:net';
function getFreePort(){ return new Promise((res,rej)=>{ const srv=net.createServer(); srv.listen(0,'127.0.0.1',()=>{ const p=srv.address().port; srv.close(()=>res(p)); }); srv.on('error',rej); }); }
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = await getFreePort();
const BASE = `http://localhost:${PORT}`;
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('PASS', m)) : (fail++, console.log('FAIL', m)); };

const srv = spawn(process.execPath, ['server.mjs'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
let up = false;
for (let i = 0; i < 40; i++) {
  try { const r = await fetch(`${BASE}/health`); if (r.ok) { up = true; break; } } catch {}
  await sleep(100);
}
if (!up) { console.error('server did not start'); srv.kill(); process.exit(1); }

try {
  const h = await (await fetch(`${BASE}/health`)).json();
  ok(h.ok === true && h.payTo === '0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861', '/health advertises payTo');

  const t = await fetch(`${BASE}/bounties?limit=3`);
  const tj = await t.json();
  ok(t.status === 200, 'teaser limit=3 => 200');
  ok(Array.isArray(tj.items) && tj.items.length <= 3, 'teaser returns <=3 items');

  const p = await fetch(`${BASE}/bounties?limit=40`);
  const pj = await p.json();
  ok(p.status === 402, 'paid tier no payment => 402');
  ok(pj.accepts?.[0]?.maxAmountRequired === '0.01' && pj.accepts[0].payTo === h.payTo, '402 advertises correct price+payee');

  const f = await fetch(`${BASE}/bounties?limit=40`, { headers: { 'x-payment': enc({ tx: '0xdead', network: 'base' }) } });
  ok(f.status === 402, 'forged proof => 402 (fail-closed)');

  const wn = await fetch(`${BASE}/bounties?limit=40`, { headers: { 'x-payment': enc({ tx: '0xabc', network: 'ethereum' }) } });
  ok(wn.status === 402, 'wrong network => 402');

  const bad = await fetch(`${BASE}/bounties?limit=40`, { headers: { 'x-payment': '%%%' } });
  ok(bad.status === 402, 'malformed proof => 402');

  const noUrl = await fetch(`${BASE}/score`);
  ok(noUrl.status === 404, '/score without url => 404');
  const badUrl = await fetch(`${BASE}/score?url=notaurl`);
  ok(badUrl.status === 400, '/score with non-github url => 400');
  // A syntactically valid but nonexistent issue => upstream 502 (proves the route is wired, not 404)
  const sc = await fetch(`${BASE}/score?url=https://github.com/x/y/issues/1`);
  ok(sc.status === 502 || sc.status === 200, '/score route is wired (200 or upstream 502)');
} finally {
  srv.kill();
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
