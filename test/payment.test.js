'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PAY_TO, PRICE_RAW, quote, verifyPayment } = require('../lib/payment');

const GOOD_HASH = 'A'.repeat(64);

test('quote names Nano mainnet, price and payout address', () => {
  const q = quote('/api/echo');
  assert.equal(q.payment.network, 'nano:mainnet');
  assert.equal(q.payment.pay_to, PAY_TO);
  assert.equal(q.payment.amount_raw, PRICE_RAW);
  assert.equal(q.payment.retry_header, 'X-Nano-Payment');
});

test('verifyPayment rejects malformed hash without network', async () => {
  let called = false;
  const result = await verifyPayment('nope', async () => { called = true; });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_hash_format');
  assert.equal(called, false);
});

test('verifyPayment accepts confirmed matching send', async () => {
  const fakeFetch = async url => {
    assert.equal(url.searchParams.get('to'), PAY_TO);
    assert.equal(url.searchParams.get('min_raw'), PRICE_RAW);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        found: true,
        ok: true,
        confirmed: true,
        to: PAY_TO,
        from: 'nano_test_sender',
        amount_raw: PRICE_RAW
      })
    };
  };
  const result = await verifyPayment(GOOD_HASH, fakeFetch);
  assert.equal(result.ok, true);
  assert.equal(result.hash, GOOD_HASH);
});

test('verifyPayment rejects underpayment', async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      confirmed: true,
      to: PAY_TO,
      amount_raw: '1'
    })
  });
  const result = await verifyPayment(GOOD_HASH, fakeFetch);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'amount_too_small');
});
