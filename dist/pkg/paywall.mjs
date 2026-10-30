// x402 paywall for glider-scout (no deps). FAIL-CLOSED: grant access only when
// the tx is confirmed AND contains a USDC Transfer to PAY_TO of >= price.
const PAY_TO = (process.env.PAY_TO || '0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861').toLowerCase();
const PRICE_USDC = '0.01';
const PRICE_UNITS = 10000n; // 0.01 USDC (6 decimals)
const NETWORK = 'base';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const RPC = process.env.BASE_RPC || 'https://mainnet.base.org';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export function paymentRequired(resource) {
  return { x402Version: 1, error: 'payment required', accepts: [{ scheme: 'exact', network: NETWORK,
    maxAmountRequired: PRICE_USDC, resource, payTo: PAY_TO, asset: USDC, assetSymbol: 'USDC',
    mimeType: 'application/json', description: 'Glider Scout verified bounty feed — 0.01 USDC on Base' }] };
}
const addrFromTopic = t => '0x' + t.slice(-40).toLowerCase();
function findValidTransfer(rc) {
  for (const log of (rc.logs || [])) {
    if ((log.address || '').toLowerCase() !== USDC) continue;
    const tp = log.topics || [];
    if (tp[0] !== TRANSFER_TOPIC || tp.length < 3) continue;
    if (addrFromTopic(tp[2]) !== PAY_TO) continue;
    const v = BigInt(log.data && log.data !== '0x' ? log.data : '0x0');
    if (v >= PRICE_UNITS) return { value: v.toString() };
  }
  return null;
}
export async function verifyPayment(header) {
  if (!header) return { paid: false, reason: 'no payment header' };
  let proof;
  try { proof = JSON.parse(Buffer.from(header, 'base64').toString('utf8')); }
  catch { return { paid: false, reason: 'malformed payment proof' }; }
  if (!proof.tx || !/^0x[0-9a-fA-F]{64}$/.test(proof.tx)) return { paid: false, reason: 'missing/invalid tx hash' };
  if ((proof.network || '').toLowerCase() !== NETWORK) return { paid: false, reason: 'wrong network' };
  try {
    const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [proof.tx] }) });
    if (!r.ok) return { paid: false, reason: `rpc http ${r.status}` };
    const j = await r.json(); const rc = j.result;
    if (!rc) return { paid: false, reason: 'tx not found' };
    if (rc.status !== '0x1') return { paid: false, reason: 'tx reverted/not confirmed' };
    const t = findValidTransfer(rc);
    if (!t) return { paid: false, reason: 'no qualifying USDC transfer to payee' };
    return { paid: true, tx: proof.tx, amountUnits: t.value };
  } catch (e) { return { paid: false, reason: 'rpc error: ' + e.message }; }
}
