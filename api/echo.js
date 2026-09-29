'use strict';

const { quote, verifyPayment } = require('../lib/payment');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const resource = '/api/echo';
  const paymentHash = String(req.headers['x-nano-payment'] || '').trim();

  if (!paymentHash) {
    return res.status(402).json(quote(resource));
  }

  const payment = await verifyPayment(paymentHash);
  if (!payment.ok) {
    return res.status(402).json({ ...quote(resource), payment_error: payment.reason });
  }

  const rawMsg = Array.isArray(req.query?.msg) ? req.query.msg[0] : req.query?.msg;
  const msg = String(rawMsg ?? 'hello').slice(0, 500);

  return res.status(200).json({
    ok: true,
    service: 'noxid-nano-echo',
    result: msg,
    payment: {
      network: 'nano:mainnet',
      hash: payment.hash,
      amount_raw: payment.amount_raw
    }
  });
};
