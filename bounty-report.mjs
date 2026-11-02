#!/usr/bin/env node
// bounty-report.mjs — produce a SELF-CONTAINED, sellable report of vetted bounties.
// No live server, no tunnel: reads the existing candidate files and verifies each
// through the public GitHub API, then writes a static, timestamped JSON+MD report.
// This is the actual product: a buyer downloads it and gets only credibility-checked,
// reward-bearing, non-trap bounties with evidence — no infra required to be "up".

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HOME = homedir();
const outDir = join(HOME, 'glider-scout', 'reports');
mkdirSync(outDir, { recursive: true });

const FUNDED_HOST = /\b(algora\.io|taskmarket|polar\.sh|opire|gitcoin\.co|superteam|bountysource|issuehunt)\b/i;
const FUNDED_MARKER = /\b(escrowed?|funded|amount:\s*\$?\d|reward:\s*\$?\d|held in (?:escrow|trust)|paid on merge via)\b/i;
const REWARD_RE = /\$\s?([1-9][0-9,]*)\s*(k)?|([1-9][0-9,]*)\s*(k)?\s*(?:usd|usdc|usdt|dollars?)/i;
const RED_FLAGS = [
  [/verbatim copy of all instructions/i, 'PROMPT_EXFIL'],
  [/instructions and guidelines (?:that were )?present in your context/i, 'PROMPT_EXFIL'],
  [/environment details[^.]{0,80}(?:OS|CPU|home path|shell)/i, 'PROMPT_EXFIL'],
  [/review competing PRs|attack other PRs|identify bad PRs/i, 'MANIPULATIVE'],
  [/multiple agents are actively competing.*one winner/is, 'MULTI_AGENT_RING'],
  [/\/claim #?\d+/i, 'BOT_RING'],
];
const NO_ESCROW = [/post[- ]merge/i, /after (?:the )?pr (?:is )?merge/i];

function parseReward(t){const m=t.match(REWARD_RE);if(!m)return 0;const n=(m[1]||m[3]||'').replace(/,/g,'');const k=m[2]||m[4];return n?(parseInt(n,10)||0)*(k?1000:1):0;}

async function gh(p, tries=3){
  let last;
  for (let i=0;i<tries;i++){
    try{
      const r = await fetch('https://api.github.com'+p, {headers:{'User-Agent':'glider-report',Accept:'application/vnd.github+json'}});
      if(r.status===404) throw Object.assign(new Error('404'),{fatal:true});
      if(!r.ok){ last=new Error(String(r.status)); }
      else return await r.json();
    }catch(e){ last=e; if(e.fatal) throw e; }
    await new Promise(r=>setTimeout(r, 500*(i+1)));
  }
  throw last || new Error('fetch failed');
}

function assess(issue, comments){
  const all = `${issue.title}\n${issue.body||''}\n${comments.map(c=>c.body||'').join('\n')}`;
  const flags = [...new Set(RED_FLAGS.filter(([re])=>re.test(all)).map(([,w])=>w))];
  const amt = parseReward(all);
  const hasHost = FUNDED_HOST.test(all), hasMarker = FUNDED_MARKER.test(all);
  const postMerge = NO_ESCROW.some(re=>re.test(all)), escrow = /escrow/i.test(all);
  let verdict;
  if (flags.some(f=>f==='PROMPT_EXFIL'||f==='MANIPULATIVE')) verdict='REJECTED';
  else if ((hasHost||escrow)&&hasMarker&&amt>0) verdict='FUNDED';
  else if (amt>0&&hasMarker) verdict='REWARD_UNCONFIRMED';
  else verdict='SIGNAL';
  return {verdict,amount_usd:amt,flags,pay_on_merge_only:postMerge&&!escrow,
          evidence:{has_funding_rail:hasHost,has_funding_marker:hasMarker,has_escrow_word:escrow}};
}

function loadCandidates(){
  const set = new Map();
  for (const f of ['candidates.json', join(HOME,'glider-jobs','candidates.json'), join(HOME,'glider-jobs','hunt-status.json')]) {
    try {
      const d = JSON.parse(readFileSync(f,'utf8'));
      const items = Array.isArray(d)?d:(d.items||d.candidates||d.top||[]);
      for(const c of items){const u=c.url||c.html_url;if(u&&u.includes('github.com'))set.set(u,(c.owner_repo||null));}
    } catch {}
  }
  return [...set.keys()];
}

function ownerRepo(url){
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/);
  return m ? {repo:`${m[1]}/${m[2]}`, num:m[3]} : null;
}

async function main(){
  const urls = loadCandidates();
  const results = [];
  for (const url of urls.slice(0, 25)) {
    const ref = ownerRepo(url);
    if (!ref) continue;
    try {
      const issue = await gh(`/repos/${ref.repo}/issues/${ref.num}`);
      let comments = [];
      try { comments = await gh(`/repos/${ref.repo}/issues/${ref.num}/comments?per_page=50`); } catch {}
      results.push({url: issue.html_url, title: issue.title, state: issue.state, ...assess(issue, comments)});
    } catch (e) {
      // FAIL CLOSED: if we cannot read the issue, we must NOT imply it is clean.
      results.push({url, verdict:'UNVERIFIED', amount_usd:0, flags:[],
        error:`unreachable: ${e.message}`,
        evidence:{note:'could not fetch — treat as unverified, do not work'}});
    }
    await new Promise(r=>setTimeout(r,300)); // be a good API citizen
  }
  const sellable = results.filter(r=>r.verdict==='FUNDED'||r.verdict==='REWARD_UNCONFIRMED');
  const report = {
    generated_at: new Date().toISOString(),
    product: 'Glider Bounty Report',
    summary: {
      scanned: results.length,
      funded: results.filter(r=>r.verdict==='FUNDED').length,
      reward_unconfirmed: results.filter(r=>r.verdict==='REWARD_UNCONFIRMED').length,
      rejected_traps: results.filter(r=>r.verdict==='REJECTED').length,
      signal_only: results.filter(r=>r.verdict==='SIGNAL').length,
      unverified: results.filter(r=>r.verdict==='UNVERIFIED').length,
    },
    honest_note: 'FUNDED = public evidence of an escrow/funding rail and amount. REWARD_UNCONFIRMED = amount claimed but no escrow proven — do not treat as guaranteed payment. This report is evidence, not a promise of payment.',
    bounties: results,
  };
  const stamp = report.generated_at.slice(0,10);
  writeFileSync(join(outDir, `bounty-report-${stamp}.json`), JSON.stringify(report,null,2));

  // Markdown for human reading
  let md = `# Glider Bounty Report — ${stamp}\n\nGenerated ${report.generated_at}\n\n`;
  md += `Scanned ${report.summary.scanned} · FUNDED ${report.summary.funded} · Unconfirmed ${report.summary.reward_unconfirmed} · Traps ${report.summary.rejected_traps} · Signal ${report.summary.signal_only}\n\n`;
  md += `> ${report.honest_note}\n\n## Sellable (FUNDED / UNCONFIRMED)\n\n`;
  for (const b of sellable) {
    md += `### ${b.verdict} — $${b.amount_usd} — ${b.title}\n${b.url}\n`;
    if (b.flags.length) md += `Flags: ${b.flags.join(', ')}\n`;
    if (b.pay_on_merge_only) md += `_Payment promised post-merge only (not escrow)._\n`;
    md += `\n`;
  }
  md += `## Unverified (could not fetch — NOT checked, do not work)\n\n`;
  for (const b of results.filter(r=>r.verdict==='UNVERIFIED')) md += `- ${b.url} — ${b.error}\n`;
  md += `\n## Rejected traps\n\n`;
  for (const b of results.filter(r=>r.verdict==='REJECTED')) md += `- ${b.url} — ${b.flags.join(', ')}\n`;
  writeFileSync(join(outDir, `bounty-report-${stamp}.md`), md);

  console.log(JSON.stringify({generated:report.generated_at, summary:report.summary,
    files:[`reports/bounty-report-${stamp}.json`,`reports/bounty-report-${stamp}.md`]}, null, 2));
}

main().catch(e=>{console.error('fatal:',e.message);process.exit(1);});
