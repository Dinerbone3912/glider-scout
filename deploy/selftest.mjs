// Tests worker.js fetch(): health, teaser, paywall fail-closed, live feed + fraud filter.
import worker from './worker.js';
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64');

// Mock global fetch so live-feed path is deterministic.
const realFetch = globalThis.fetch;
function mockGithub(items) {
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('api.github.com')) {
      return new Response(JSON.stringify({ items }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, opts); // rpc etc
  };
}
async function hit(path, headers = {}) {
  const res = await worker.fetch(new Request('https://x.dev' + path, { headers }), {});
  return { status: res.status, body: await res.json() };
}
let pass = 0, fail = 0; const ok = (c, m) => { c ? (pass++, console.log('PASS', m)) : (fail++, console.log('FAIL', m)); };

const h = await hit('/health');
ok(h.status === 200 && h.body.payTo === '0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861', '/health advertises payTo');

// teaser uses live path
mockGithub([
  { title: '$500 Add connector', html_url: 'https://g/1', repository_url: 'https://api.github.com/repos/a/b', labels: [{ name: 'bounty' }] },
  { title: 'FREE airdrop, send seed to claim', html_url: 'https://g/2', repository_url: 'https://api.github.com/repos/x/y', labels: [{ name: 'bounty' }] },
]);
const t = await hit('/bounties?limit=3');
ok(t.status === 200 && t.body.source === 'live', 'teaser => 200 live');
ok(t.body.items.every(x => x.verdict !== 'FRAUD'), 'fraud item filtered out');
ok(t.body.items[0].reward === 500, 'reward parsed from $500');

// paywall
const p = await hit('/bounties?limit=40');
ok(p.status === 402 && p.body.accepts[0].maxAmountRequired === '0.01', 'paid tier => 402 + price');
const f = await hit('/bounties?limit=40', { 'x-payment': enc({ tx: '0xdead', network: 'base' }) });
ok(f.status === 402 && f.body.error === 'payment required', 'forged proof => 402 fail-closed (no RPC)');
const wn = await hit('/bounties?limit=40', { 'x-payment': enc({ tx: '0xabc', network: 'ethereum' }) });
ok(wn.status === 402, 'wrong network => 402');
const bad = await hit('/bounties?limit=40', { 'x-payment': '%%%' });
ok(bad.status === 402, 'malformed => 402');

// live-fetch failure falls back to seed
globalThis.fetch = async () => { throw new Error('network down'); };
const fb = await hit('/bounties?limit=3');
ok(fb.status === 200 && fb.body.source === 'seed', 'github failure => seed fallback');

globalThis.fetch = realFetch;
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
