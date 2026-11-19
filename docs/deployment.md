# Deployment and local operations

## Current boundary

One configured buyer/seller/facilitator workflow completed on Concordium Testnet on 19 November 2026. The buyer app, facilitator, and payment-enabled seller are intended for loopback use. There is no verified public buyer deployment, multi-user authentication, production signer, or mainnet path. The public Render seller attempt recorded on 12 November returned HTTP 502 `no-deploy`; do not treat the configured URL as live.

The project owner has since supplied `https://countercheck-red.vercel.app/` for the buyer web app and `https://countercheck-seller-1146.onrender.com` for the seller challenge service. Use the separate Render `countercheck-buyer-api` origin behind the Vercel proxy; setup instructions are in [`vercel-configuration.md`](vercel-configuration.md). Supplied URLs alone do not verify deployment or change the authorization boundary.

The Vercel API proxy injects a server bearer token but does not authenticate each visitor. It now hard-blocks public `POST /api/purchase` with `403 individual_authorization_required`. Do not remove this block or expose a payment-enabled buyer API through another public endpoint until per-user authorization, scoped approvals, and a security review exist. The local loopback demo bypasses the public proxy and retains its separate explicit Testnet payment action. `PAYMENTS_ENABLED=false` and `FACILITATOR_SETTLEMENT_ENABLED=false` remain the safe defaults outside that launcher.

## Prerequisites for the local Testnet demo

- Node.js 20 or newer and dependencies from the checked-in lockfile.
- Separate Testnet buyer, seller, and sponsor accounts; buyer/seller badges and current registered `agentWallet` matches.
- Dedicated low-balance buyer and sponsor credentials, held only in ignored `.env` or a secret manager. Never use mainnet keys.
- A seller endpoint that produces the expected exact native-CCD x402 challenge and calls the local authenticated facilitator for payment.
- A private `.env` configured using `.env.example`; keep all services on loopback.
- A human reviews the exact seller, amount, asset, network, sponsor/fee, signer and digest before selecting the payment action.

The 19 November evidence is one completed run, not a guarantee that a fresh run will succeed. Registry, seller, facilitator, node access, balances and expiry are time-sensitive and must be checked again.

## Start and stop

Review-only challenge mode (no signing keys or API tokens passed to child processes):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\start-safe-demo.ps1
```

Full local Testnet mode (startup preflight does not pay; the explicit UI action broadcasts one Testnet transfer):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\start-testnet-demo.ps1 -EnableTestnetSettlement
```

Open `http://127.0.0.1:4173`. Stop with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\stop-testnet-demo.ps1
```

Never record `.env`, terminal environment values, service logs, wallet exports, or private keys. If a payment result is ambiguous, preserve `unresolved`, check the sender and chain, and do not retry until reconciled.

## Configuration summary

Copy `.env.example` to `.env` and fill values only on the builder's machine. Important settings:

| Variable | Purpose |
|---|---|
| `HOST`, `PORT` | Buyer API bind; keep `127.0.0.1` and port `4173`. Non-loopback buyer binds are rejected. |
| `REGISTRY_MCP_URL` | Official Registry MCP HTTPS origin. |
| `CONCORDIUM_NETWORK` | Fixed Testnet CAIP-2 ID; mainnet is rejected. |
| `BUYER_BADGE`, `SELLER_BADGE` | Configured Testnet agent records. Registered wallets must match buyer sender and seller payee respectively. |
| `SELLER_PAY_TO`, `SELLER_RESOURCE_URL`, `SELLER_ASSET` | Fixed seller recipient and live x402 resource (`CCD` only). Arbitrary API-provided URLs are not accepted. |
| `MAX_SPEND_MICROCCD` | Buyer spend ceiling; code rejects values above 1,000,000 microCCD (1 CCD). |
| `PAYMENTS_ENABLED` | Buyer payment gate; default `false`. |
| `CCD_ACCOUNT_ADDRESS`, `CCD_PRIVATE_KEY` | Buyer account and dedicated Testnet signing key. Secret stays server-side. |
| `CCD_FACILITATOR_ADDRESS`, `CCD_FACILITATOR_PRIVATE_KEY`, `FACILITATOR_API_TOKEN` | Distinct sponsor account, key and API credential. Never reuse the buyer key. |
| `FACILITATOR_SETTLEMENT_ENABLED` | Facilitator settlement gate; default `false`. |
| `FACILITATOR_MAX_AMOUNT_MICROCCD`, `FACILITATOR_MIN_SPONSOR_BALANCE_MICROCCD`, `FACILITATOR_STORE_PATH` | Facilitator amount cap, minimum reserve and local replay store. |
| `SELLER_RESOURCE_ENABLED`, `SELLER_CHALLENGE_ONLY` | Seller resource mode; leave disabled or challenge-only unless a payment run is intended. |
| `AUDIT_LOG_PATH` | Local hash-linked receipt log, outside `public/`. |
| `OLLAMA_URL`, `OLLAMA_MODEL` | Optional model host and name. Prompts are sent to the configured Ollama host; loopback is the default. |

## Optional local assistant

Run `npm run mcp` for the stdio read-only MCP server or `npm run agent` for the Ollama host. The model can use `verify_counterparties` and `request_purchase_quote` only; deterministic checks remain authoritative, and no model-quality evaluation is documented. Do not provide keys in prompts or tool arguments.

## Operations and recovery

- Stop the local services to pause new requests. No background jobs run.
- Keep `.env`, `data/`, and wallet material out of Git and recordings. Rotate/revoke a Testnet key through the supported wallet/network process if exposed.
- Protect and back up the local receipt and facilitator store if needed. No encrypted backup/restore test is established. Preserve a corrupted or unresolved store for review; do not reset it while settlement status is ambiguous.
- The facilitator replay guard is filesystem-backed and single-process. It is not a distributed lock or multi-instance service.
- Sponsorship pays the network fee; the buyer still pays the service amount.
- The local record is hash-linked but not externally anchored or immutable.

## Public/production path

Before public buyer access, add per-user authentication and authorization, individual approvals, rate limits, private service networking, managed signing, durable shared replay/idempotency, monitoring, incident response, independent settlement reconciliation, and an access/retention policy. Then verify the deployed revision and authoritative state. No public deployment, user pilot, mainnet account, contract deployment, legal review, or security audit is established here. External deploy, spending, or submission actions require separate authorization.
