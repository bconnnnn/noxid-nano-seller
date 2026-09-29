# NOXID Nano Echo

A minimal Nano-paid HTTP service used for machine-to-machine seller verification.

## Paid route

`GET /api/echo?msg=hello`

An unpaid call returns HTTP `402` with:
- network: `nano:mainnet`
- asset: `XNO`
- price: `0.0001 XNO`
- public receiving address
- retry header: `X-Nano-Payment`

To pay, send the quoted amount to the quoted address and retry with the 64-hex send-block hash in `X-Nano-Payment`. The service checks the confirmed block using pursekeeper.dev's public `/v1/verify` endpoint and delivers only when recipient and amount match.

## Free status

`GET /api/status`

## Security notes

- The service never stores or requests a Nano seed/private key.
- Payment verification is read-only and checks a confirmed send block.
- The payment hash is a bearer proof and this minimal demo does not maintain a persistent spent-hash database; use a state store or per-order addresses before using the pattern for higher-value production sales.
