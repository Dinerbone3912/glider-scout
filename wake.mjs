#!/usr/bin/env node
// wake.mjs — single source of truth for "what should Glider do right now?"
// Reads hunt-status.json + income-ledger.jsonl and emits exactly ONE action.
// Deterministic, no network. Exit 0 always. Prints JSON.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HOME = homedir();
const statusPath = join(HOME, 'glider-jobs', 'hunt-status.json');
const ledgerPath = join(HOME, '.automaton', 'income-ledger.jsonl');
const urlPath = join(HOME, '.automaton', 'glider-public-url.txt');

function readJson(p, fallback) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; }
}
function ledgerSummary() {
  let lines = [];
  try { lines = readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch {}
  const paid = lines.filter(e => Number(e.income_usdc) > 0);
  const pending = lines.filter(e => e.status && /PENDING/i.test(e.status));
  return {
    entries: lines.length,
    confirmed_usdc: paid.reduce((s, e) => s + Number(e.income_usdc || 0), 0),
    pending_count: pending.length,
    pending_bounty: pending[0]?.bounty || null,
  };
}

const status = readJson(statusPath, null);
const ledger = ledgerSummary();
const url = (() => { try { return readFileSync(urlPath, 'utf8').trim(); } catch { return ''; } })();

let action, reason, target = null;

if (status) {
  const vf = Number(status.verified_funded ?? 0);
  const top = (status.top || [])[0];
  const a = String(status.action || '');
  if (vf > 0 && top?.url) {
    action = 'APPLY'; target = top.url;
    reason = `${vf} verified-funded bounty(s); top = ${top.url}`;
  } else if (a.startsWith('ACT') && top?.url) {
    action = 'APPLY'; target = top.url;
    reason = `hunt-status action=${a} with top candidate`;
  } else if (!url) {
    action = 'SUPERVISE';
    reason = 'public URL missing/stale — restart supervisor only';
  } else {
    action = 'SLEEP';
    reason = 'no verified-funded bounty; service live; sleep long';
  }
} else {
  action = url ? 'SLEEP' : 'SUPERVISE';
  reason = 'no hunt-status file yet (heartbeat pending)';
}

console.log(JSON.stringify({
  action, reason, target,
  public_url: url || null,
  income_confirmed_usdc: ledger.confirmed_usdc,
  pending_submissions: ledger.pending_count,
  pending_bounty: ledger.pending_bounty,
  honest_note: 'Income counts only confirmed payments. Pending != income.',
}, null, 2));
