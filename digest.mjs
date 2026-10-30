#!/usr/bin/env node
// digest.mjs — one command that produces the single actionable snapshot for a wake.
// Combines: (1) live income reality, (2) fresh funded bounty candidates, (3) next action.
// Writes ~/glider-jobs/digest.md and prints a short summary. Read-only, no spend.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const JOBS = join(homedir(), 'glider-jobs');
mkdirSync(JOBS, { recursive: true });
const LEDGER = join(homedir(), '.automaton', 'income-ledger.jsonl');

function ledgerSummary() {
  if (!existsSync(LEDGER)) return { entries: [], confirmed: 0, pending: 0 };
  const entries = readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  const confirmed = entries.filter((e) => e.payout_confirmed && e.income_usdc > 0)
    .reduce((s, e) => s + (e.income_usdc || 0), 0);
  const pending = entries.filter((e) => /PENDING|MERGED_UNPAID|CHANGES/.test(e.status || '')).length;
  return { entries, confirmed, pending };
}

async function freshCandidates() {
  try {
    // reuse hunt.mjs output if present and fresh (< 6h)
    const sl = join(JOBS, 'shortlist.json');
    if (existsSync(sl)) {
      const d = JSON.parse(readFileSync(sl, 'utf8'));
      const ageH = (Date.now() - Date.parse(d.generated)) / 3.6e6;
      if (ageH >= 0 && ageH < 6) return { source: 'cached', ageH: +ageH.toFixed(1), jobs: d.jobs || [] };
    }
  } catch {}
  try {
    execFileSync('node', [join(homedir(), 'glider-scout', 'hunt.mjs')], { stdio: 'ignore', timeout: 60000 });
    const d = JSON.parse(readFileSync(join(JOBS, 'shortlist.json'), 'utf8'));
    return { source: 'fresh', jobs: d.jobs || [] };
  } catch (e) {
    return { source: 'error', error: String(e.message).slice(0, 160), jobs: [] };
  }
}

(async () => {
  const led = ledgerSummary();
  const cand = await freshCandidates();
  const top = (cand.jobs || []).filter((j) => j.reward_usd > 0).slice(0, 5);
  const next = top.length
    ? `Evaluate top candidate ($${top[0].reward_usd}) with check.mjs, then solve+submit.`
    : 'No funded candidate in feed → 1 distribution action, then wait.';

  const md = [
    `# Glider Digest — ${new Date().toISOString()}`,
    ``,
    `**Confirmed income:** $${led.confirmed.toFixed(2)} USDC`,
    `**Pending submissions:** ${led.pending}`,
    ``,
    `## Ledger`,
    ...led.entries.map((e) => `- ${e.status} | ${e.source} | $${e.income_usdc || 0} ${e.pr ? '· ' + e.pr : ''}`),
    ``,
    `## Funded candidates (${cand.source})`,
    ...(top.length ? top.map((j) => `- $${j.reward_usd} · ${j.url} — ${j.title}`) : ['- (none)']),
    ``,
    `## Next action`,
    next,
  ].join('\n');
  writeFileSync(join(JOBS, 'digest.md'), md);
  console.log(md);
})();
