import { scoreBounty } from './server.mjs';
import assert from 'node:assert';
let pass=0, fail=0;
const T=(n,f)=>{try{f();console.log('PASS',n);pass++;}catch(e){console.log('FAIL',n,'-',e.message);fail++;}};

T('explicit USD + escrow + label = credible', ()=>{
  const r=scoreBounty({title:'Fix parser',body:'Bounty $250 USDC via algora escrow',labels:[{name:'bounty'}],created_at:new Date().toISOString(),comments:2,assignees:[],state:'open',html_url:'https://github.com/a/b/issues/1',number:1});
  assert.equal(r.verdict,'LIKELY_CREDIBLE'); assert.ok(r.score>=65); assert.deepEqual(r.reward,{amount:250,currency:'USD'});
});
T('registration fee = FRAUD', ()=>{
  const r=scoreBounty({title:'Earn',body:'pay a $20 registration fee to join',labels:[],created_at:new Date().toISOString(),comments:0,assignees:[],state:'open',html_url:'x',number:2});
  assert.equal(r.verdict,'FRAUD'); assert.equal(r.score,0);
});
T('no reward no signal = low', ()=>{
  const r=scoreBounty({title:'help',body:'please fix',labels:[],created_at:new Date().toISOString(),comments:0,assignees:[],state:'open',html_url:'x',number:3});
  assert.ok(r.score<40, 'score '+r.score);
});
T('stale penalized', ()=>{
  const old=new Date(Date.now()-120*86400000).toISOString();
  const r=scoreBounty({title:'x',body:'$100 bounty escrow',labels:[{name:'bounty'}],created_at:old,comments:1,assignees:[],state:'open',html_url:'x',number:4});
  assert.ok(r.reasons.includes('stale >90d'));
});
T('SOL reward parsed', ()=>{
  const r=scoreBounty({title:'x',body:'reward 1.5 SOL',labels:[],created_at:new Date().toISOString(),comments:0,assignees:[],state:'open',html_url:'x',number:5});
  assert.deepEqual(r.reward,{amount:1.5,currency:'SOL'});
});
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
