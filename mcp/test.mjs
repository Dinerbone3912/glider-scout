// Real stdio test: spawn the MCP server, speak JSON-RPC, assert responses.
// Requires glider-scout server running on GLIDER_BASE (default :8787).
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const srv = spawn(process.execPath, ['mcp/server.mjs'], {
  env: { ...process.env, GLIDER_BASE: process.env.GLIDER_BASE || 'http://127.0.0.1:8787' },
  stdio: ['pipe', 'pipe', 'inherit'],
});
let buf = '', nextId = 1;
const pending = new Map();
srv.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});
function rpc(method, params) {
  const id = nextId++;
  return new Promise((res, rej) => {
    pending.set(id, res);
    srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`timeout ${method}`)); } }, 8000);
  });
}

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('PASS', m)) : (fail++, console.log('FAIL', m)); };

try {
  await sleep(300);
  const init = await rpc('initialize', {});
  ok(init.result?.serverInfo?.name === 'glider-scout', 'initialize -> serverInfo.name=glider-scout');

  const list = await rpc('tools/list', {});
  const names = (list.result?.tools || []).map(t => t.name).sort();
  ok(JSON.stringify(names) === JSON.stringify(['feed_health','list_bounties','score_bounty']), `tools/list -> ${names.join(',')}`);

  const health = await rpc('tools/call', { name: 'feed_health', arguments: {} });
  const htxt = health.result?.content?.[0]?.text || '';
  ok(health.result && !health.result.isError && htxt.includes('"ok":true'), 'feed_health returns ok:true');

  const lb = await rpc('tools/call', { name: 'list_bounties', arguments: { limit: 3 } });
  const lbtxt = lb.result?.content?.[0]?.text || '';
  ok(!lb.result?.isError && lbtxt.includes('"items"'), 'list_bounties(limit=3) returns items');

  const lbPaid = await rpc('tools/call', { name: 'list_bounties', arguments: { limit: 40 } });
  ok(lbPaid.result?.isError === true && /Paid tier required/.test(lbPaid.result?.content?.[0]?.text || ''), 'list_bounties(limit=40) surfaces 402 as tool error');

  const sc = await rpc('tools/call', { name: 'score_bounty', arguments: {} });
  ok(sc.result?.isError === true && /url is required/.test(sc.result?.content?.[0]?.text || ''), 'score_bounty without url -> error');

  const unk = await rpc('tools/call', { name: 'nope', arguments: {} });
  ok(unk.result?.isError === true, 'unknown tool -> error');
} catch (e) {
  console.log('FAIL exception', e.message); fail++;
} finally { srv.kill(); }

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
