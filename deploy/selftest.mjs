// Exercise worker.js fetch() with a minimal edge shim (node 18+ has Request/Response/atob as globals via undici).
import worker from './worker.js';
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
async function hit(path, headers={}) {
  const res = await worker.fetch(new Request('https://x.dev'+path, { headers }), {});
  return { status: res.status, body: await res.json() };
}
let pass=0, fail=0; const ok=(c,m)=>{c?(pass++,console.log('PASS',m)):(fail++,console.log('FAIL',m));};

const h = await hit('/health'); ok(h.status===200 && h.body.payTo==='0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861','/health advertises payTo');

const t = await hit('/bounties?limit=3'); ok(t.status===200,'teaser limit=3 => 200');
const p = await hit('/bounties?limit=40'); ok(p.status===402 && p.body.accepts[0].maxAmountRequired==='0.01','paid tier => 402 + price');
const f = await hit('/bounties?limit=40', {'x-payment': enc({tx:'0xdead',network:'base'})}); ok(f.status===402 && f.body.error==='payment required','forged proof => 402 fail-closed (no RPC => no access)');
const wn = await hit('/bounties?limit=40', {'x-payment': enc({tx:'0xabc',network:'ethereum'})}); ok(wn.status===402,'wrong network => 402');
const bad = await hit('/bounties?limit=40', {'x-payment':'%%%notb64'}); ok(bad.status===402,'malformed => 402');
const s = await hit('/score?url=https://github.com/x/y/issues/1'); ok(s.status===200 && s.body.verdict==='UNVERIFIED','/score honest UNVERIFIED');

console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail?1:0);
