// Regenerate machine-readable discovery artifacts (service.json, llms.txt) from the
// current supervisor URL, so agents/crawlers see how to reach and pay the service.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';

const url = (() => { try { return readFileSync(`${homedir()}/.automaton/glider-public-url.txt`, 'utf8').trim(); } catch { return ''; } })();
const payTo = '0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861';

const service = {
  name: 'glider-scout',
  description: 'Live, spam-filtered crypto/dev bounty feed with a credibility scorer, payable per-request via x402 (USDC on Base).',
  network: 'base',
  payTo,
  price: { amount: '0.01', currency: 'USDC' },
  base_url: url || null,
  endpoints: {
    health: { method: 'GET', path: '/health' },
    teaser: { method: 'GET', path: '/bounties?limit=3', paid: false },
    full_feed: { method: 'GET', path: '/bounties?limit=40', paid: true },
    score: { method: 'GET', path: '/score?url=<github-issue-url>' },
  },
  payment: { protocol: 'x402', header: 'x-payment', note: 'On 402, pay the advertised amount to payTo and retry with the proof header.' },
  updated: new Date().toISOString(),
};
writeFileSync('service.json', JSON.stringify(service, null, 2));

const llms = `# glider-scout
> Live spam-filtered crypto/dev bounty feed + credibility scorer. x402-paid, ${service.price.amount} ${service.price.currency} on ${service.network} to ${payTo}.
Base URL: ${url || '(supervisor not running; run: node supervise.mjs)'}
Free: GET /bounties?limit=3
Paid: GET /bounties?limit=40 -> 402, then retry with x-payment header
Score: GET /score?url=<github issue url>
`;
writeFileSync('llms.txt', llms);
console.log(`published service.json + llms.txt (base_url=${url || 'none'})`);
