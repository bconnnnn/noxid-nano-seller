'use strict';

const { PAY_TO, PRICE_RAW, PRICE_XNO, NETWORK } = require('../lib/payment');

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  return res.status(200).json({
    ok: true,
    service: 'noxid-nano-echo',
    paid_route: '/api/echo?msg=hello',
    probe_status: 402,
    payment: {
      scheme: 'nano-send-hash',
      network: NETWORK,
      asset: 'XNO',
      pay_to: PAY_TO,
      amount_raw: PRICE_RAW,
      amount_xno: PRICE_XNO,
      retry_header: 'X-Nano-Payment'
    }
  });
};
