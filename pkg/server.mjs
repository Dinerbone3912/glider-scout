#!/usr/bin/env node
// Glider Scout — zero-dependency bounty feed server. Node >=18.
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
const BOT_RING_REPOS = [/zhangjiayang6835-cyber\/bounty-plaza/i, /\/bounty-plaza$/i];
const RING_TEXT = [/\/claim\b/i, /post\s+your\s+(wallet|address)/i, /reply\s+with\s+your\s+(address|wallet)/i, /bounty\s+seguro/i];

export function isSpamItem(issue){
  const repo=`${issue.repository_url||''} ${issue.html_url||''}`;
  if(BOT_RING_REPOS.some(re=>re.test(repo))) return {spam:true,why:'bot-ring repo'};
  const text=`${issue.title||''}\n${issue.body||''}`;
  for(const re of RING_TEXT) if(re.test(text)) return {spam:true,why:`ring text: ${re}`};
  if(/\[bounty\].*\[bounty\]/i.test(issue.title||'')) return {spam:true,why:'self-referential title'};
  return {spam:false};
}

async function gh(p){
  const headers={'Accept':'application/vnd.github+json','User-Agent':'glider-scout','X-GitHub-Api-Version':'2022-11-28'};
  if(GITHUB_TOKEN) headers.Authorization=`Bearer ${GITHUB_TOKEN}`;
  const r=await fetch(`https://api.github.com${p}`,{headers});
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

import { classify } from './fraud.mjs';
export function scoreBounty(issue){
  const reward = issue && issue.reward ? issue.reward : null;
  return classify({
    title: issue?.title || '',
    body: issue?.body || '',
    labels: issue?.labels || [],
    reward,
    state: issue?.state || 'open',
    comments: issue?.comments || 0,
    assignees: issue?.assignees || [],
    createdDaysAgo: issue?.createdDaysAgo || 0,
  });
}

function toFeedItem(issue){
  const s=scoreBounty(issue);
  const m=issue.html_url.match(/github\.com\/([^/]+)\/([^/]+)\/issues/);
  return {id:`${m?`${m[1]}/${m[2]}`:'repo'}#${issue.number}`,repo:m?`${m[1]}/${m[2]}`:null,number:issue.number,
    title:issue.title,url:issue.html_url,created_at:issue.created_at,comments:issue.comments,
    labels:s.labels,reward:s.reward,credibility:s.score,verdict:s.verdict,reasons:s.reasons};
}
function readJSON(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')); }catch{ return null; } }
function itemIsSpam(it){ return isSpamItem({title:it.title,body:'',html_url:it.url,repository_url:it.repo?`https://github.com/${it.repo}`:''}).spam; }
function cleanItems(items){ return (items||[]).filter(it=>!itemIsSpam(it)); }

export async function fetchBounties({lim=40}={}){
  const q=encodeURIComponent('is:issue is:open label:bounty OR label:"💎 Bounty" OR label:reward');
  try{
    const data=await gh(`/search/issues?q=${q}&sort=created&order=desc&per_page=${lim}`);
    let items=(data.items||[]).filter(raw=>!isSpamItem(raw).spam).map(toFeedItem).filter(i=>i.verdict!=='FRAUD');
    items.sort((a,b)=>b.credibility-a.credibility);
    if(items.length){ const out={items,updated:new Date().toISOString(),source:'live'}; fs.writeFileSync(CACHE,JSON.stringify(out)); return {...out,items:items.slice(0,lim)}; }
  }catch(e){}
  const cached=readJSON(CACHE);
  if(cached&&cached.items?.length) return {...cached,source:'cache',stale:true,items:cleanItems(cached.items).slice(0,lim)};
  const seed=readJSON(SEED);
  if(seed&&seed.items?.length) return {...seed,source:'seed',stale:true,items:cleanItems(seed.items).slice(0,lim)};
  return {items:[],error:'no data available (offline, no cache/seed)',updated:new Date().toISOString()};
}

import { paymentRequired, verifyPayment } from './paywall.mjs';
import { readFileSync } from 'node:fs';
let LANDING_HTML='';
try{ LANDING_HTML = readFileSync(new URL('./index.html', import.meta.url),'utf8'); }catch{}
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,`http://localhost:${PORT}`);
  const json=(code,obj)=>{res.writeHead(code,{'content-type':'application/json','access-control-allow-origin':'*'});res.end(JSON.stringify(obj));};
  if(u.pathname==='/'||u.pathname==='/index.html'){
    if(LANDING_HTML){ res.writeHead(200,{'content-type':'text/html; charset=utf-8'}); return res.end(LANDING_HTML); }
    return json(200,{ok:true,service:'glider-scout'});
  }
  if(u.pathname==='/health') return json(200,{ok:true,service:'glider-scout',priced:'/bounties?limit>3',price:'0.01 USDC base',payTo:process.env.PAY_TO||'0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861',endpoints:['/bounties','/score?url=']});
  if(u.pathname==='/bounties'){
    const lim=Math.min(100,Number(u.searchParams.get('limit')||40));
    if(lim>3){
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
import { realpathSync } from 'node:fs';
function __isMain(){ try{ return import.meta.url===`file://${realpathSync(process.argv[1])}`; }catch{ return false; } }
if(__isMain()){server.listen(PORT,()=>console.log(`glider-scout on :${PORT}`));}
export {server};
