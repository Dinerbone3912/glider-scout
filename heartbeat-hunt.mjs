#!/usr/bin/env node
// heartbeat-hunt.mjs — invoked by the hunt-refresh heartbeat: hunt -> refresh candidates -> status file.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const CAND = join(HERE, 'candidates.json');
const STATUS = join(homedir(), 'glider-jobs', 'hunt-status.json');
function sh(a){ try{ return execFileSync(process.execPath,a,{cwd:HERE,encoding:'utf8',timeout:120000}); }catch(e){ return (e.stdout||'')+(e.stderr||''); } }
sh([join(HERE,'hunt.mjs')]); sh([join(HERE,'refresh-candidates.mjs')]);
let cred=0,verified=0,top=null;
if(existsSync(CAND)){ try{ const d=JSON.parse(readFileSync(CAND,'utf8')); cred=d.count||0; verified=(d.candidates||[]).filter(c=>c.tier==='VERIFIED').length; top=(d.candidates||[])[0]||null; }catch{} }
const status={updated:new Date().toISOString(),candidates_credible_unsubmitted:cred,verified_funded:verified,top:top?{tier:top.tier,reward_usd:top.reward_usd,url:top.url,title:top.title}:null,action:verified>0?'ACT: run glider.sh apply on top VERIFIED candidate':cred>0?'REVIEW: reward-bearing but unconfirmed funding':'IDLE: no credible reward-bearing bounty; sleep long'};
writeFileSync(STATUS,JSON.stringify(status,null,2));
console.log(`[hunt ${status.updated}] cred=${cred} verified=${verified} -> ${status.action}`);
