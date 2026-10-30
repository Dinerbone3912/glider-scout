import { classify } from './fraud.mjs';
import assert from 'node:assert';
let pass=0, fail=0;
const t=(name,fn)=>{ try{ fn(); pass++; console.log('PASS',name);}catch(e){ fail++; console.log('FAIL',name,'-',e.message);} };

t('scam: registration fee => FRAUD', ()=>assert.equal(classify({title:'Bounty',body:'Pay a registration fee to join'}).verdict,'FRAUD'));
t('scam: seed phrase => FRAUD', ()=>assert.equal(classify({title:'x',body:'send us your seed phrase'}).verdict,'FRAUD'));
t('scam: airdrop wallet drain => FRAUD', ()=>assert.equal(classify({title:'airdrop claim',body:'connect wallet'}).verdict,'FRAUD'));
t('good listing => LIKELY_CREDIBLE', ()=>{ const r=classify({title:'Fix bug',body:'Bounty program funded and ready',labels:['bounty'],reward:{amount:50,currency:'USDC'},createdDaysAgo:2}); assert.equal(r.verdict,'LIKELY_CREDIBLE'); });
t('no reward => still credible w/ funding+label', ()=>{ const r=classify({title:'Add feature',body:'escrow paid upon merge',labels:['bounty'],createdDaysAgo:5}); assert.ok(r.score>=40&&r.score<100); });
t('bare issue => REJECT/UNVERIFIED (low score)', ()=>{ const r=classify({title:'random question',body:'how do I',createdDaysAgo:200}); assert.ok(r.score<40); });
t('closed issue => REJECT', ()=>assert.equal(classify({state:'closed',labels:['bounty'],reward:{amount:10,currency:'USDC'}}).verdict,'REJECT'));
t('assigned reduces score', ()=>{ const a=classify({title:'x',body:'bounty',labels:['bounty'],reward:{amount:10,currency:'USDC'}}); const b=classify({title:'x',body:'bounty',labels:['bounty'],reward:{amount:10,currency:'USDC'},assignees:['u']}); assert.ok(b.score<a.score); });
console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
