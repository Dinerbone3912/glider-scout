#!/usr/bin/env node
// hunt.mjs — query real bounty platforms with public APIs, filter to funded &
// credible, write ranked shortlist to ~/glider-jobs/shortlist.json. No secrets.
import { writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const UA = { 'User-Agent': 'glider-scout', Accept: 'application/vnd.github+json' };
const OUT = join(homedir(), 'glider-jobs'); mkdirSync(OUT, { recursive: true });
// funded_signal must come from a real escrow/funded-rail host or an EXPLICIT funding marker,
// not a bare mention of "USDC"/"bounty" in the body (that caused false positives like the $9k listing).
const FUNDED_HOST = /algora\.io|taskmarket|polar\.sh|opire|gitcoin\.co|superteam|hackerone/i;
const FUNDED_MARKER = /\b(?:escrow(?:ed)?|funded|bounty\s+paid|held in escrow|amount:\s*\$?[1-9]|reward:\s*\$?[1-9])\b/i;
const FAKE = /bounty-plaza|bounty seguro|\/claim\b|telegram|seed phrase|registration fee|kyc/i;
async function gh(p){ const r=await fetch('https://api.github.com'+p,{headers:UA}); return r.ok?r.json():{err:r.status}; }
function rewardOf(t){ const m=t.match(/\$\s?([1-9][0-9]{1,5})|([1-9][0-9]{1,5})\s?(?:usdc|usd)/i); return m?Number(m[1]||m[2]):0; }
const queries=['is:issue is:open label:algora','is:issue is:open label:bounty','is:issue is:open label:"💰 Bounty"','is:issue is:open bounty in:title archived:false'];
const seen=new Set(), rows=[];
for(const q of queries){
 const s=await gh('/search/issues?q='+encodeURIComponent(q)+'&sort=updated&per_page=30');
 if(!s.items){ console.error(`q "${q}" -> ${s.err??'none'}`); continue; }
 for(const i of s.items){
  if(seen.has(i.html_url))continue; seen.add(i.html_url);
  const text=`${i.title} ${i.body||''}`; if(FAKE.test(text))continue;
  const hostFunded = FUNDED_HOST.test(text) || FUNDED_HOST.test(i.html_url||'');
  const markerFunded = FUNDED_MARKER.test(text);
  const amt=rewardOf(text);
  // Require: an explicit funding marker AND either a real funded host or a concrete reward amount.
  const funded = markerFunded && (hostFunded || amt>0);
  if(amt>0||funded) rows.push({url:i.html_url,title:i.title.slice(0,100),repo:i.repository_url?.split('/repos/')[1]||'',reward_usd:amt,funded_signal:funded,comments:i.comments,updated:i.updated_at,labels:(i.labels||[]).map(l=>l.name)});
 }
}
rows.sort((a,b)=>(b.reward_usd-a.reward_usd)||(Number(b.funded_signal)-Number(a.funded_signal)));
writeFileSync(join(OUT,'shortlist.json'),JSON.stringify({generated:new Date().toISOString(),count:rows.length,jobs:rows},null,2));
console.log(`scanned ${seen.size} -> ${rows.length} candidates`);
for(const r of rows.slice(0,12))console.log(`  $${r.reward_usd||'?'}${r.funded_signal?' [funded]':''} ${r.url}\n     ${r.title}`);
