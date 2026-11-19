# Local Concordium Testnet facilitator

**Status:** one configured Testnet payment completed through the local facilitator on 19 November 2026. The sanitized evidence records a second gRPC read that matched finalized sender, recipient, amount, and asset, followed by paid fulfillment. See [`../evidence/live-e2e-2026-11-19.json`](../evidence/live-e2e-2026-11-19.json). This proves one run, not multi-instance safety or production readiness; the explorer was not independently inspected during capture.

## Payment flow

**Current boundary:** the buyer UI prepares and displays the exact sponsored-transfer review, records approval bound to its digest after fresh checks, and requires a separate explicit action to sign and purchase. The local facilitator `/verify` and `/settle` path was exercised in the single recorded Testnet run. Both payment flags default to `false`; enable them only for an intentionally reviewed local Testnet demonstration.

1. The Countercheck buyer agent asks the seller resource for a quote. The seller returns an x402 v2 `exact` challenge for native CCD on Concordium Testnet, with the configured seller wallet, a bounded amount/expiry, and the sponsor address as `extra.feePayer`.
2. Countercheck checks the badge/card and fixed local policy, then builds the exact transaction review. It records digest-bound consent; a separate buyer action invokes the buyer signer for that digest. The buyer signature authorizes the **payment amount** to the seller; the sponsor separately pays the network fee.
3. The seller's x402 server sends the payment payload and exact requirements to this facilitator's `/verify`, then `/settle`, with the local bearer token. The facilitator pins the request to the configured buyer, seller wallet, sponsor and Testnet. The Concordium x402 scheme checks the sender signature, nonce, amount, recipient, expiry and sponsor binding.
4. The facilitator reads sponsor balance, checks the configured minimum reserve, claims the payload hash, and calls the SDK `/settle` flow. It serializes settlements within its process and rechecks sponsor reserve. The sponsor pays the protocol transaction fee; the buyer pays the CCD transfer amount. Exact transaction review and explicit authorization precede signing/submission.
5. Settlement waits for Concordium finalization. The facilitator persists only transaction metadata, the payload digest, verification/reserve results and outcome, not payment signatures or the key. Identical finalized requests return the stored result. Failed or ambiguous requests are replay-blocked for manual reconciliation; they are not automatically submitted again.

The sponsor reserve is an operator-set lower balance threshold, not a prediction of the exact transaction fee. Concordium's node remains authoritative: it can reject a transaction if the sponsor cannot cover the actual fee. The SDK's buyer preflight and the facilitator's sponsor reserve preflight are different checks.

## Local setup (Windows PowerShell)

1. Install Node.js 20+ and project dependencies if needed: `npm install`.
2. Create `.env` if it does not exist: `Copy-Item .env.example .env`.
3. In the local `.env`, set:
   - `CCD_ACCOUNT_ADDRESS` to the buyer account already linked by the buyer badge.
   - `SELLER_PAY_TO` to the seller account already linked by the seller badge.
   - `CCD_FACILITATOR_ADDRESS` to the sponsor account.
   - `CCD_FACILITATOR_PRIVATE_KEY` to the sponsor's supported 32-byte hex Ed25519 account signing key. Do not use a seed phrase, buyer key, or mainnet key.
   - `FACILITATOR_API_TOKEN` to a fresh random local secret of at least 32 characters.
   - Keep `FACILITATOR_SETTLEMENT_ENABLED=false`.
4. Check the account address/key pairing through the supported wallet export process. This code does not prove the key matches the address at startup; the first sponsor signature would test that, and must wait for explicit approval.
5. Run `npm run facilitator`. It binds only to loopback at `http://127.0.0.1:4180`.

The account addresses and keys are not repeated in project records. Do not paste a private key, seed phrase, or API token into chat, MCP tool arguments, issue reports, or screenshots. `.env`, the replay store and audit data are ignored by Git. The facilitator loads only its named environment variables; it does not load Countercheck's buyer private key.

## HTTP interface

- `GET /healthz` returns local mode/network status only; it does not call Concordium.
- `GET /supported` advertises x402 v2, `exact`, Testnet and the configured fee payer.
- `POST /verify` and `POST /settle` accept the x402 v2 JSON body `{ "x402Version": 2, "paymentPayload": {}, "paymentRequirements": {} }` and require `Authorization: Bearer <FACILITATOR_API_TOKEN>`.

The repository includes a loopback-only x402 v2 resource server in `src/seller-resource.mjs`. It uses the pinned x402 SDK, offers a fixed 1 CCD native-CCD resource on Testnet, and obtains the sponsor fee payer from the facilitator's `/supported` response. It calls facilitator `/verify` and `/settle` through the SDK after receiving a buyer-signed request. The full buyer/seller/facilitator path was exercised once in the 19 November run. The buyer signing key stays in the Countercheck buyer process; the seller process has no signing key and does not receive the sponsor private key.

For a single-host demo, set the buyer's `SELLER_RESOURCE_URL` to the local `/resource` URL, then start the facilitator, seller resource and buyer app on loopback. The 19 November evidence records a complete configured Testnet payment. Earlier 12 and 17 November files document read-only challenge captures and remain historical evidence, not the latest payment status.

## Tests and boundaries

Run mocked tests with `npm test`. They exercise policy checks, buyer insufficiency returned by the scheme verifier, sponsor reserve insufficiency, bad recipient/network/amount, duplicate payloads, failed/ambiguous settlement, disabled mode and HTTP bearer auth. The tests use fake signers/schemes and do not contact a node, sign or broadcast.

This local store is a replay barrier for one Windows process/data directory, not a multi-host distributed lock or legally immutable record. Protect its directory and back it up carefully. On `unresolved` or duplicate-pending results, inspect the sponsor/buyer accounts and CCDExplorer before any manual action. The facilitator only accepts one configured buyer and one seller recipient. It is Testnet-only, loopback-only and settlement-off by default.

## Path to production

Mainnet use would require a separate production sponsor account, managed signing/HSM or equivalent custody, rate and fee budgets, authenticated seller integrations, durable shared idempotency storage, health/monitoring and incident response, operational reconciliation, and security/legal/privacy review. Do not switch the network constant or expose this local service publicly to pursue that path. No EU AI Act compliance claim follows from these logs.
