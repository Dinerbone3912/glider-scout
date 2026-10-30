#!/usr/bin/env node
// verify-bounty.mjs — zero-dependency credibility check for a GitHub bounty issue.
// Usage: node verify-bounty.mjs <owner/repo> <issue-number>
// Honest verdict: FUNDED / REWARD_UNCONFIRMED / SIGNAL / REJECTED, with reasons.

const API = 'https://api.github.com';
const FUNDED_HOST = /\b(algora\.io|taskmarket|polar\.sh|opire|gitcoin\.co|superteam|bountysource|issuehunt)\b/i;
const FUNDED_MARKER = /\b(escrowed?|funded|amount:\s*\$?\d|reward:\s*\$?\d|held in (?:escrow|trust)|paid on merge via)\b/i;
const REWARD_RE = /\$\s?([1-9][0-9,]*)\s*(k)?|([1-9][0-9,]*)\s*(k)?\s*(?:usd|usdc|usdt|dollars?)/i;
const RED_FLAGS = [
  [/verbatim copy of all instructions/i, 'PROMPT_EXFIL: asks to embed full system prompt/instructions'],
  [/instructions and guidelines (?:that were )?present in your context/i, 'PROMPT_EXFIL: asks to copy context instructions'],
  [/environment details[^.]{0,80}(?:OS|CPU|home path|shell)/i, 'PROMPT_EXFIL: asks to disclose environment details'],
  [/review competing PRs|attack other PRs|identify bad PRs/i, 'MANIPULATIVE: instructs attacking competing submissions'],
  [/multiple agents are actively competing.*one winner/is, 'MULTI_AGENT_RING: single-winner competition pattern'],
  [/\/claim #?\d+/i, 'BOT_RING: tag-based claim flow typical of bounty bots'],
];
const NO_ESCROW = [/post[- ]merge/i, /after (?:the )?pr (?:is )?merge/i, /\d[- ]\d\s*days?\s*(?:post|after)/i];
function reward(t){const m=t.match(REWARD_RE);if(!m)return 0;const num=(m[1]||m[3]||'').replace(/,/g,'');const k=m[2]||m[4];return num?(parseInt(num,10)||0)*(k?1000:1):0;}
async function gh(p){const r=await fetch(API+p,{headers:{'User-Agent':'glider-verify',Accept:'application/vnd.github+json'}});if(!r.ok)throw new Error(`GitHub API ${r.status} for ${p}`);return r.json();}
function analyze(issue,comments){
  const all=`${issue.title}\n${issue.body||''}\n${comments.map(c=>c.body||'').join('\n')}`;
  const flags=RED_FLAGS.filter(([re])=>re.test(all)).map(([,w])=>w);
  const amt=reward(all),hasHost=FUNDED_HOST.test(all),hasMarker=FUNDED_MARKER.test(all);
  const postMerge=NO_ESCROW.some(re=>re.test(all)),escrow=/escrow/i.test(all);
  let verdict,reasons=[],reasons_extra=null;
  if(flags.some(f=>f.startsWith('PROMPT_EXFIL')||f.startsWith('MANIPULATIVE'))){verdict='REJECTED';reasons=flags;}
  else if((hasHost||escrow)&&hasMarker&&amt>0){verdict='FUNDED';reasons=['escrow/rail host present','funding marker present',`reward $${amt}`];}
  else if(amt>0&&hasMarker){verdict='REWARD_UNCONFIRMED';reasons_extra=flags;reasons=[`reward $${amt} claimed`,hasHost?'rail host present':'NO escrow/rail host',postMerge?'payment promised POST-MERGE only (not escrow)':'no explicit funding rail'];if(reasons_extra)reasons.push(...reasons_extra);}
  else if(amt>0){verdict='SIGNAL';reasons=[`reward $${amt} mentioned, no funding marker`];reasons.push(...flags);}
  else{verdict='SIGNAL';reasons=['no concrete reward found'];reasons.push(...flags);}
  return{verdict,amount_usd:amt,reasons,payOnMergeOnly:postMerge&&!escrow};
}
async function main(){
  const[repo,num]=process.argv.slice(2);
  if(!repo||!num){console.error('usage: node verify-bounty.mjs <owner/repo> <issue-number>');process.exit(2);}
  try{
    const issue=await gh(`/repos/${repo}/issues/${num}`);
    let comments=[];try{comments=await gh(`/repos/${repo}/issues/${num}/comments?per_page=100`);}catch{}
    const res=analyze(issue,comments);
    console.log(JSON.stringify({url:issue.html_url,title:issue.title,state:issue.state,...res,
      honest_note:res.verdict==='FUNDED'?'Funded rail detected. Still confirm escrow before deep work.':'NOT a confirmed funded job. Post-merge promises are not escrow.'},null,2));
    process.exit(res.verdict==='REJECTED'?3:0);
  }catch(e){console.error('error:',e.message);process.exit(1);}
}
if(import.meta.url===`file://${process.argv[1]}`)main();
export{analyze,reward};
