#!/usr/bin/env node
// track.mjs — reconcile the income ledger against real submitter state.
// Reads ~/.automaton/income-ledger.jsonl entries that carry a PR URL, queries
// GitHub via `gh`, and updates each entry's status to reality. MERGED does NOT
// equal paid: income_usdc stays 0 unless a separate payout confirmation exists.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

const LEDGER = process.argv.includes('--ledger')
  ? process.argv[process.argv.indexOf('--ledger') + 1]
  : `${homedir()}/.automaton/income-ledger.jsonl`;
const AS_JSON = process.argv.includes('--json');

function gh(args) {
  try {
    return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (e) { return { __error: String(e.stderr || e.message).slice(0, 300) }; }
}
function parsePr(url) {
  const m = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(url || '');
  return m ? { owner: m[1], repo: m[2], num: m[3] } : null;
}
function classify(pr) {
  if (pr.__error) return { status: 'TRACK_ERROR', detail: pr.__error };
  if (pr.merged) return { status: 'MERGED_UNPAID', detail: `merged ${pr.merged_at}` };
  if (pr.state === 'closed') return { status: 'REJECTED', detail: 'closed without merge' };
  return { status: 'PENDING_MAINTAINER_REVIEW', detail: 'open, awaiting decision' };
}
function main() {
  if (!existsSync(LEDGER)) { console.error(`no ledger at ${LEDGER}`); process.exit(1); }
  const lines = readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean);
  const out = []; let changed = 0;
  for (const line of lines) {
    let e; try { e = JSON.parse(line); } catch { out.push(line); continue; }
    const ref = parsePr(e.pr);
    if (!ref) { out.push(JSON.stringify(e)); continue; }
    const pr = gh(['api', `repos/${ref.owner}/${ref.repo}/pulls/${ref.num}`]);
    const cls = classify(pr);
    if (e.status !== cls.status) { e.status = cls.status; e.status_checked_at = new Date().toISOString(); e.status_detail = cls.detail; changed++; }
    if (e.income_usdc > 0 && !e.payout_confirmed) { e.income_usdc = 0; e.note = (e.note || '') + ' [income zeroed: payout not confirmed]'; }
    out.push(JSON.stringify(e));
  }
  writeFileSync(LEDGER, out.join('\n') + '\n');
  if (AS_JSON) console.log(JSON.stringify({ ledger: LEDGER, changed, entries: out.map((l) => JSON.parse(l)) }, null, 2));
  else console.log(`reconciled ${out.length} entries, ${changed} status change(s) -> ${LEDGER}`);
}
main();
