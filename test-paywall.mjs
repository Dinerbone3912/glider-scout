// Self-contained tests for the x402 paywall (node --test, no deps).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentRequired, verifyPayment } from './paywall.mjs';

test('paymentRequired advertises correct payTo/price', () => {
  const p = paymentRequired('/bounties?limit=40');
  assert.equal(p.x402Version, 1);
  assert.equal(p.accepts[0].payTo, '0x944664B9d45fEf8C9BDBb084Ce59E6f6eE724861');
  assert.equal(p.accepts[0].maxAmountRequired, '0.01');
  assert.equal(p.accepts[0].network, 'base');
});

test('no header => not paid', async () => {
  const v = await verifyPayment(undefined);
  assert.equal(v.paid, false);
});

test('malformed proof => not paid', async () => {
  const v = await verifyPayment('not-base64-json');
  assert.equal(v.paid, false);
});

test('wrong network => not paid', async () => {
  const h = Buffer.from(JSON.stringify({ tx: '0xabc', network: 'ethereum' })).toString('base64');
  const v = await verifyPayment(h);
  assert.equal(v.paid, false);
  assert.match(v.reason, /network/);
});

test('valid shape but no RPC => fail-closed (not paid)', async () => {
  const h = Buffer.from(JSON.stringify({ tx: '0xdeadbeef', network: 'base' })).toString('base64');
  const v = await verifyPayment(h);
  assert.equal(v.paid, false);
  assert.match(v.reason, /RPC|verification/);
});
