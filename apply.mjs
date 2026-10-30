#!/usr/bin/env node
// apply.mjs — run the submission ceremony for an ALREADY-VERIFIED credible bounty.
// It does NOT verify credibility (use bounty-check/check.mjs first) and does NOT
// write code. It performs the mechanical, order-sensitive steps that are easy to
// get wrong by hand:
//   1. Preflight: gh auth present; PR URL parses; issue still open.
//   2. Record a PENDING ledger entry BEFORE submitting (so a crash can't lose it).
//   3. Comment on the issue linking the PR (submission etiquette).
//   4. Optionally reconcile.
//
// Usage:
//   node apply.mjs --issue <issue-url> --pr <pr-url> --reward <usd> [--min <usd>] [--max <usd>]
//                  [--note "text"] [--commit <sha>] [--comment/--no-comment]
//
// Safety: refuses if --issue is not a real open issue, or if a PENDING/PAID entry
// for the same issue already exists (prevents duplicate submissions).

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > -1 ? process.argv[i + 1] : d;
};
const flag = (k, d = true) => {
  if (process.argv.includes('--' + k)) return true;
  if (process.argv.includes('--no-' + k)) return false;
  return d;
};

const ISSUE = arg('issue');
const PR = arg('pr');
const REWARD = Number(arg('reward', '0'));
const MIN = Number(arg('min', REWARD || 0));
const MAX = Number(arg('max', REWARD || 0));
const NOTE = arg('note', 'Submitted; not income until merged+paid.');
const COMMIT = arg('commit', '');
const DO_COMMENT = flag('comment', true);

function die(msg, code = 1) {
  console.error('✗ ' + msg);
  process.exit(code);
}
function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function ghJson(args) {
  try { return JSON.parse(gh(args)); } catch (e) { return { __error: String(e.stderr || e.message) }; }
}

if (!ISSUE || !PR) die('need --issue <url> and --pr <url>');
const gi = /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/.exec(ISSUE);
const gp = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(PR);
if (!gi) die('--issue is not a github issue URL');
if (!gp) die('--pr is not a github pull URL');

const [owner, repo, num] = [gi[1], gi[2], gi[3]];
const LEDGER = join(homedir(), '.automaton', 'income-ledger.jsonl');
mkdirSync(join(homedir(), '.automaton'), { recursive: true });

// 1. auth present
try { gh(['api', 'user', '--jq', '.login']); } catch { die('gh not authenticated'); }

// 2. issue open?
const issue = ghJson(['api', `repos/${owner}/${repo}/issues/${num}`]);
if (issue.__error) die('cannot read issue: ' + issue.__error);
if (issue.state !== 'open') die(`issue is ${issue.state}, not open — refusing`);

// 3. dedupe against ledger
if (existsSync(LEDGER)) {
  const dup = readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean).find((e) => (e.source || '').includes(`${owner}/${repo}#${num}`) &&
    /PENDING|PAID|MERGED|CHANGES/.test(e.status || ''));
  if (dup) die(`ledger already has ${dup.status} for ${owner}/${repo}#${num} — not resubmitting`);
}

// 4. record PENDING before any comment (crash-safe)
const entry = {
  ts: new Date().toISOString(),
  source: `${owner}/${repo}#${num}`,
  pr: PR,
  commit: COMMIT || undefined,
  reward_claimed_usdc: REWARD || undefined,
  reward_min_usdc: MIN || undefined,
  reward_max_usdc: MAX || undefined,
  status: 'PENDING_MAINTAINER_REVIEW',
  income_usdc: 0,
  note: NOTE,
};
appendFileSync(LEDGER, JSON.stringify(entry) + '\n');
console.log(`✓ ledger: PENDING recorded (${LEDGER})`);

// 5. comment linking the PR
if (DO_COMMENT) {
  const body = `Submitted ${PR} for this issue.${COMMIT ? `\n\nCommit: \`${COMMIT}\`` : ''}\n\nHappy to iterate on review.`;
  try {
    const c = ghJson(['api', '-X', 'POST', `repos/${owner}/${repo}/issues/${num}/comments`, '-f', `body=${body}`]);
    console.log(c.__error ? '! comment failed: ' + c.__error : `✓ issue comment: ${c.html_url || 'posted'}`);
  } catch (e) {
    console.log('! comment failed: ' + String(e.message).slice(0, 160));
  }
} else {
  console.log('· comment skipped (--no-comment)');
}

console.log('\nDONE. Reconcile later with: node ' + join(homedir(), 'glider-scout', 'track.mjs'));
