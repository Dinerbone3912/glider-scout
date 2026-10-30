import { isSpamItem, scoreBounty } from './server.mjs';
let pass=0, fail=0;
const ok=(c,m)=>{c?(pass++,console.log('PASS',m)):(fail++,console.log('FAIL',m));};

const ring = {
  title: '[Bounty] 💰 Bounty Seguro',
  body: 'Reply with your wallet address to /claim this bounty.',
  html_url: 'https://github.com/zhangjiayang6835-cyber/bounty-plaza/issues/123',
  repository_url: 'https://api.github.com/repos/zhangjiayang6835-cyber/bounty-plaza',
  labels: ['bounty'], created_at: new Date().toISOString(), comments: 2, state: 'open',
};
const legit = {
  title: 'Add Jira Service Management connector ($250)',
  body: 'Funded on Algora. Escrow via algora.io. Accepting PRs.',
  html_url: 'https://github.com/onyx-dot-app/onyx/issues/2281',
  repository_url: 'https://api.github.com/repos/onyx-dot-app/onyx',
  labels: ['bounty'], created_at: new Date(Date.now()-5*86400000).toISOString(), comments: 4, state: 'open',
};

ok(isSpamItem(ring).spam === true, 'bot-ring issue flagged as spam');
ok(isSpamItem(legit).spam === false, 'legitimate bounty NOT flagged');
const sc = scoreBounty(legit);
ok(sc.verdict !== 'FRAUD' && sc.score >= 40, `legit scores ${sc.score}/${sc.verdict}`);
ok(isSpamItem({title:'[Bounty] x [Bounty] y', body:'', html_url:'https://github.com/a/b/issues/1', repository_url:''}).spam === true, 'self-referential title flagged');
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
