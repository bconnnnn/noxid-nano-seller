'use strict';

const PAY_TO = 'nano_3154czz87etettuydyts5qg1798sqcqx1rpkropcu3h3t845pnr6y7gmz3ze';
const PRICE_RAW = '100000000000000000000000000'; // 0.0001 XNO
const PRICE_XNO = '0.0001';
const NETWORK = 'nano:mainnet';
const VERIFY_BASE = 'https://pursekeeper.dev/v1/verify';
const HASH_RE = /^[A-Fa-f0-9]{64}$/;

function quote(resource) {
  return {
    error: 'payment_required',
    resource,
    payment: {
      scheme: 'nano-send-hash',
      network: NETWORK,
      asset: 'XNO',
      pay_to: PAY_TO,
      amount_raw: PRICE_RAW,
      amount_xno: PRICE_XNO,
      retry_header: 'X-Nano-Payment'
    },
    instructions: `Send ${PRICE_XNO} XNO to ${PAY_TO}, then retry with X-Nano-Payment: <your 64-hex send block hash>.`
  };
}

async function verifyPayment(hash, fetchImpl = fetch) {
  if (!HASH_RE.test(hash || '')) {
    return { ok: false, reason: 'invalid_hash_format' };
  }

  const url = new URL(VERIFY_BASE);
  url.searchParams.set('hash', hash.toUpperCase());
  url.searchParams.set('to', PAY_TO);
  url.searchParams.set('min_raw', PRICE_RAW);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal
    });

    let data = null;
    try { data = await response.json(); } catch { data = null; }

    if (!response.ok || !data || data.ok !== true || data.confirmed !== true) {
      return {
        ok: false,
        reason: data?.reason || data?.error || `verifier_http_${response.status}`
      };
    }

    if (String(data.to || '').toLowerCase() !== PAY_TO.toLowerCase()) {
      return { ok: false, reason: 'wrong_recipient' };
    }

    if (BigInt(data.amount_raw || '0') < BigInt(PRICE_RAW)) {
      return { ok: false, reason: 'amount_too_small' };
    }

    return {
      ok: true,
      hash: hash.toUpperCase(),
      from: data.from || null,
      amount_raw: String(data.amount_raw)
    };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === 'AbortError' ? 'verifier_timeout' : 'verifier_unavailable'
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { PAY_TO, PRICE_RAW, PRICE_XNO, NETWORK, HASH_RE, quote, verifyPayment };
