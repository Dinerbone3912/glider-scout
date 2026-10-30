#!/usr/bin/env node
// Glider Scout — zero-dependency bounty feed server.
// Fetches public GitHub issues carrying bounty labels, scores credibility,
// serves a clean JSON feed. No deps, Node >=18.
import http from 'node:http';
import { URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dir=path.dirname(fileURLToPath(import.meta.url));
const CACHE=path.join(__dir,'cache.json');
const SEED=path.join(__dir,'seed.json');

const PORT = Number(process.env.PORT || 8790);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

const BOUNTY_LABELS = ['bounty','bounties','💎 bounty','reward','paid','$$$'];
const FUNDING_SIGNALS = [/algora/i,/taskmarket/i,/polar\.sh/i,/gofrantic/i,/escrow/i,/usdc/i,/superteam/i,/gitcoin/i,/bounty\./i];
const RED_FLAGS = [/registration fee/i,/pay.*(to|upfront).*join/i,/kyc required/i,/send.*(deposit|gas) first/i,/dm.*private key/i];

async function gh(path){
  const headers={'Accept':'application/vnd.github+json','User-Agent':'glider-scout','X-GitHub-Api-Version':'2022-11-28'};
  if(GITHUB_TOKEN) headers.Authorization=`Bearer ${GITHUB_TOKEN}`;
  const r=await fetch(`https://api.github.com${path}`,{headers});
  const body=await r.json().catch(()=>null);
  if(!r.ok){const e=new Error(`GitHub ${r.status}: ${body?.message||r.statusText}`);e.rateLimited=r.status===403||r.status===429;throw e;}
  return body;
}

function parseReward(text){
  if(!text) return null;
  let m=text.match(/\$\s?([\d,]+(?:\.\d+)?)/); if(m) return {amount:Number(m[1].replace(/,/g,'')),currency:'USD'};
  m=text.match(/([\d,]+(?:\.\d+)?)\s*(?:USDC|USDT)/i); if(m) return {amount:Number(m[1].replace(/,/g,'')),currency:'USDC'};
  m=text.match(/([\d.]+)\s*SOL/i); if(m) return {amount:Number(m[1]),currency:'SOL'};
  return null;
}

export function scoreBounty(issue){
  const text=`${issue.title}\n${issue.body||''}`;
  const labels=(issue.labels||[]).map(l=>typeof l==='string'?l:l.name).filter(Boolean);
  const reasons=[]; let score=50;
  for(const re of RED_FLAGS) if(re.test(text)) return {score:0,verdict:'FRAUD',reasons:[`red flag: ${re}`]};
  const reward=parseReward(text);
  if(reward){score+=15;reasons.push(`reward ${reward.amount} ${reward.currency}`);} else {score-=15;reasons.push('no explicit reward');}
  if(FUNDING_SIGNALS.some(re=>re.test(text))){score+=20;reasons.push('funding/escrow signal');} else {score-=5;reasons.push('no funding signal');}
  const hasLabel=labels.some(l=>BOUNTY_LABELS.includes(l.toLowerCase()));
  if(hasLabel){score+=10;reasons.push('bounty label');} else {score-=20;reasons.push('no bounty label');}
  const ageDays=(Date.now()-new Date(issue.created_at).getTime())/86400000;
  if(ageDays>90){score-=20;reasons.push('stale >90d');} else if(ageDays>30){score-=8;reasons.push('aging >30d');}
  if(issue.comments>20){score-=10;reasons.push('crowded');}
  if((issue.assignees&&issue.assignees.length)){score-=10;reasons.push('assigned');}
  if(issue.state!=='open'){score=0;reasons.push('not open');}
  score=Math.max(0,Math.min(100,score));
  const verdict=score>=65?'LIKELY_CREDIBLE':score>=40?'UNVERIFIED':'REJECT';
  return {score,verdict,reward,reasons,labels};
}

function toFeedItem(issue){
  const s=scoreBounty(issue);
  const m=issue.html_url.match(/github\.com\/([^/]+)\/([^/]+)\/issues/);
  return {id:`${m?`${m[1]}/${m[2]}`:'repo'}#${issue.number}`,repo:m?`${m[1]}/${m[2]}`:null,number:issue.number,
    title:issue.title,url:issue.html_url,created_at:issue.created_at,comments:issue.comments,
    labels:s.labels,reward:s.reward,credibility:s.score,verdict:s.verdict,reasons:s.reasons};
}

function readJSON(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')); }catch{ return null; } }

export async function fetchBounties({lim=40}={}){
  // 1) Live attempt; on success, persist cache.
  const q=encodeURIComponent('is:issue is:open label:bounty OR label:"💎 Bounty" OR label:reward');
  try{
    const data=await gh(`/search/issues?q=${q}&sort=created&order=desc&per_page=${lim}`);
    let items=(data.items||[]).map(toFeedItem).filter(i=>i.verdict!=='FRAUD');
    items.sort((a,b)=>b.credibility-a.credibility);
    if(items.length){ const out={items,updated:new Date().toISOString(),source:'live'}; fs.writeFileSync(CACHE,JSON.stringify(out)); return {...out,items:items.slice(0,lim)}; }
  }catch(e){ /* fall through to cache */ }

  // 2) Cache, then seed — never return empty if we have prior data.
  const cached=readJSON(CACHE);
  if(cached&&cached.items?.length) return {...cached,source:'cache',stale:true,items:cached.items.slice(0,lim)};
  const seed=readJSON(SEED);
  if(seed&&seed.items?.length) return {...seed,source:'seed',stale:true,items:seed.items.slice(0,lim)};
  return {items:[],error:'no data available (offline, no cache/seed)',updated:new Date().toISOString()};
}

import { paymentRequired, verifyPayment } from './paywall.mjs';

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,`http://localhost:${PORT}`);
  const json=(code,obj)=>{res.writeHead(code,{'content-type':'application/json','access-control-allow-origin':'*'});res.end(JSON.stringify(obj));};
  if(u.pathname==='/'||u.pathname==='/health') return json(200,{ok:true,service:'glider-scout',priced:'/bounties?limit>3',price:'0.01 USDC base',payTo:process.env.PAY_TO||'0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861',endpoints:['/bounties','/score?url=']});
  if(u.pathname==='/bounties'){
    const lim=Math.min(100,Number(u.searchParams.get('limit')||40));
    const free=lim<=3; // teaser tier
    if(!free){
      const v=await verifyPayment(req.headers['x-payment']);
      if(!v.paid){ res.writeHead(402,{'content-type':'application/json','access-control-allow-origin':'*'}); return res.end(JSON.stringify(paymentRequired(`http://localhost:${PORT}/bounties?limit=${lim}`))); }
    }
    const d=await fetchBounties({lim}); return json(d.error&&!d.items.length?503:200,d);
  }
  if(u.pathname==='/score'&&u.searchParams.get('url')){
    const m=u.searchParams.get('url').match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    if(!m) return json(400,{error:'expected a github issue URL'});
    try{ const issue=await gh(`/repos/${m[1]}/${m[2]}/issues/${m[3]}`); return json(200,toFeedItem(issue)); }
    catch(e){ return json(502,{error:e.message}); }
  }
  json(404,{error:'not found'});
});
if(import.meta.url===`file://${process.argv[1]}`){server.listen(PORT,()=>console.log(`glider-scout on :${PORT}`));}
export {server};
