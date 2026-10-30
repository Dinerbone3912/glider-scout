// fraud.mjs — hardened spam/scam classifier for bounty listings (pure, deterministic).
const RED_FLAGS = [
  [/registration fee/i, 'asks for a registration fee'],
  [/pay\b.{0,20}(to|upfront|first).{0,15}join/i, 'pay-to-join'],
  [/kyc required/i, 'requires KYC'],
  [/send\b.{0,20}(deposit|gas|fee).{0,10}first/i, 'send deposit/gas first'],
  [/dm\b.{0,20}private key/i, 'asks for private key via DM'],
  [/seed phrase/i, 'mentions seed phrase'],
  [/guaranteed\b.{0,10}(profit|return|usdc)/i, 'guaranteed profit claim'],
  [/(click|join)\b.{0,10}telegram/i, 'telegram funnel'],
  [/airdrop\b.{0,10}(claim|connect wallet)/i, 'airdrop wallet-drain pattern'],
];
const FUNDING_SIGNALS = [/escrow/i, /funded (and|&) (ready|available)/i, /bounty (pool|program)/i, /algora/i, /gitcoin/i, /usdc|usdt|dai/i, /paid (upon|on) (merge|acceptance)/i];
const BOUNTY_LABELS = ['bounty', 'good first issue', 'help wanted', '💰 bounty', 'paid', 'reward'];

export function classify({ title='', body='', labels=[], reward=null, state='open', comments=0, assignees=[], createdDaysAgo=0 }={}) {
  const text = `${title}\n${body}`;
  const reasons = [];
  for (const [re, why] of RED_FLAGS) if (re.test(text)) return { score:0, verdict:'FRAUD', reasons:[`red flag: ${why}`] };
  let score = 50;
  if (reward && reward.amount > 0) { score += 15; reasons.push(`reward ${reward.amount} ${reward.currency||''}`.trim()); } else { score -= 15; reasons.push('no explicit reward'); }
  if (FUNDING_SIGNALS.some(re=>re.test(text))) { score += 20; reasons.push('funding/escrow signal'); } else { score -= 5; reasons.push('no funding signal'); }
  if (labels.some(l=>BOUNTY_LABELS.includes(String(l).toLowerCase()))) { score += 10; reasons.push('bounty label'); } else { score -= 20; reasons.push('no bounty label'); }
  if (createdDaysAgo > 90) { score -= 20; reasons.push('stale >90d'); } else if (createdDaysAgo > 30) { score -= 8; reasons.push('aging >30d'); }
  if (comments > 20) { score -= 10; reasons.push('crowded (>20 comments)'); }
  if (assignees && assignees.length) { score -= 10; reasons.push('already assigned'); }
  if (state !== 'open') return { score:0, verdict:'REJECT', reasons:[...reasons, 'not open'] };
  score = Math.max(0, Math.min(100, score));
  const verdict = score>=70 ? 'LIKELY_CREDIBLE' : score>=40 ? 'UNVERIFIED' : 'REJECT';
  return { score, verdict, reasons };
}
