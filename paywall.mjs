// Minimal x402-style paywall for glider-scout (no deps).
// Free tier: /bounties?limit<=3 and /health. Paid tier: full feed, requires
// a valid payment proof header. Payment verification is pluggable; the default
// verifier checks an on-chain tx via a public RPC if configured, else returns
// 402 with payment requirements (fail-closed — never grants access for free).
const PAY_TO = process.env.PAY_TO || '0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861';
const PRICE_USDC = '0.01';
const NETWORK = 'base';
const RPC = process.env.BASE_RPC || '';

// Return the 402 body advertising how to pay.
export function paymentRequired(resource) {
  return {
    x402Version: 1,
    error: 'payment required',
    accepts: [{
      scheme: 'exact',
      network: NETWORK,
      maxAmountRequired: PRICE_USDC,
      resource,
      payTo: PAY_TO,
      asset: 'USDC',
      mimeType: 'application/json',
      description: 'Glider Scout verified bounty feed',
    }],
  };
}

// Verify a payment proof header ('x-payment': base64 JSON {tx, network, ...}).
// Fail-closed: any error or absence => not paid.
export async function verifyPayment(header) {
  if (!header) return { paid: false, reason: 'no payment header' };
  let proof;
  try { proof = JSON.parse(Buffer.from(header, 'base64').toString('utf8')); }
  catch { return { paid: false, reason: 'malformed payment proof' }; }
  if (!proof.tx) return { paid: false, reason: 'missing tx hash' };
  if ((proof.network || '').toLowerCase() !== NETWORK) return { paid: false, reason: 'wrong network' };
  // If no RPC configured, we cannot verify on-chain — do NOT grant access.
  if (!RPC) return { paid: false, reason: 'verification unavailable (no RPC)' };
  try {
    const r = await fetch(RPC, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [proof.tx] }),
    });
    const j = await r.json();
    if (!j.result || j.result.status !== '0x1') return { paid: false, reason: 'tx not confirmed' };
    return { paid: true, tx: proof.tx };
  } catch (e) {
    return { paid: false, reason: 'rpc error: ' + e.message };
  }
}
