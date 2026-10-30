#!/usr/bin/env node
// refresh-candidates.mjs — turn hunt.mjs shortlist into the wake-time decision file.
// Reads ~/glider-jobs/shortlist.json, drops fakes & already-submitted (ledger), ranks, writes candidates.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os'; import { join } from 'node:path';
const SL = join(homedir(), 'glider-jobs', 'shortlist.json');
const LEDGER = join(homedir(), '.automaton', 'income-ledger.jsonl');
const OUT = join(homedir(), 'glider-scout', 'candidates.json');
const FAKE = /bounty-plaza|bounty seguro|\/claim\b|telegram|seed phrase|registration fee|kyc|personal wallet/i;
const CREDIBLE_HOST = /algora\.io|taskmarket|polar\.sh|opire|gitcoin|superteam|hackerone|github\.com/i;
if (!existsSync(SL)) { console.error('no shortlist; run hunt.mjs first'); process.exit(1); }
const sl = JSON.parse(readFileSync(SL, 'utf8'));
// Issues already submitted (any ledger entry referencing the issue URL).
const submitted = new Set();
if (existsSync(LEDGER)) for (const ln of readFileSync(LEDGER, 'utf8').split('\n')) {
  if (!ln.trim()) continue; try { const e = JSON.parse(ln); const u = e.issue || e.source_url || e.url; if (u) submitted.add(u.replace(/[#/]$/, '')); } catch {}
}
const out = [];
for (const j of sl.jobs || []) {
  const blob = `${j.title} ${j.url}`;
  if (FAKE.test(blob)) continue;
  if (submitted.has(j.url)) continue;
  // Credibility: needs a real reward OR a funded signal, on a recognizable host.
  const credibleHost = CREDIBLE_HOST.test(j.url);
  const hasReward = Number(j.reward_usd) > 0 || j.funded_signal;
  if (!credibleHost || !hasReward) continue;
  // Tier: fully verified = reward>0 AND funded_signal; partial otherwise.
  const tier = Number(j.reward_usd) > 0 && j.funded_signal ? 'VERIFIED' : Number(j.reward_usd) > 0 ? 'REWARD' : 'SIGNAL';
  out.push({ ...j, tier });
}
out.sort((a, b) => (b.reward_usd - a.reward_usd) || (a.tier === 'VERIFIED' ? -1 : 1));
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), count: out.length, candidates: out }, null, 2));
console.log(`candidates.json -> ${out.length} credible, unsubmitted`);
for (const c of out.slice(0, 10)) console.log(`  [${c.tier}] $${c.reward_usd || '?'} ${c.url}\n     ${c.title}`);
