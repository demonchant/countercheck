# Deployment and local operations

## Current boundary

One configured buyer/seller/facilitator workflow completed on Concordium Testnet on 19 November 2026. The buyer app is hosted at `https://countercheck-six.vercel.app/`, with the buyer API at `https://countercheck-1-lecq.onrender.com`; the challenge-only seller is at `https://countercheck-seller-1146.onrender.com`. On 20 November, the buyer app and `/api/status` returned HTTP 200, buyer API `/healthz` returned HTTP 200, and seller `/resource` returned the expected HTTP 402 x402 challenge. These checks confirm those routes respond; they do not verify a public payment flow, multi-user authentication, a production signer, or a mainnet path.

The Vercel proxy keeps the buyer API token server-side. It creates a signed, HttpOnly guest-browser cookie and sends a server-generated session binding for quote, transaction review, approval, purchase, and receipt access. This scopes state to a browser session; it does not identify or authorize a person. The configured seller badge is read through the same server-side proxy. Hosted purchasing also requires an explicit Vercel public-purchase switch plus the Render buyer and facilitator gates. The new guest-session and seller-proxy behavior is source-reviewed but not deployed or live-verified. Setup instructions are in [`vercel-configuration.md`](vercel-configuration.md).

If hosted purchases are enabled, any visitor can use the one configured Testnet buyer account. The visitor must still approve the exact transaction digest for every payment. The 1 CCD limit is per transaction, not an aggregate budget. Keep the Vercel public-purchase switch off unless anonymous Testnet payments are intended and the shared buyer/sponsor balances have been reviewed. The local loopback demo bypasses the public proxy and retains its separate explicit Testnet payment action. `PAYMENTS_ENABLED=false` and `FACILITATOR_SETTLEMENT_ENABLED=false` remain the safe defaults outside that launcher.

## Prerequisites for the local Testnet demo

- Node.js 20 or newer and dependencies from the checked-in lockfile.
- Separate Testnet buyer, seller, and sponsor accounts; buyer/seller badges and current registered `agentWallet` matches.
- Dedicated low-balance buyer and sponsor credentials, held only in ignored `.env` or a secret manager. Never use mainnet keys.
- A seller endpoint that produces the expected exact native-CCD x402 challenge and calls the local authenticated facilitator for payment.
- A private `.env` configured using `.env.example`; keep all services on loopback.
- A human reviews the exact seller, amount, asset, network, sponsor/fee, signer and digest before selecting the payment action.

The 19 November evidence is one completed run, not a guarantee that a fresh run will succeed. Registry, seller, facilitator, node access, balances and expiry are time-sensitive and must be checked again.

The seller service also exposes A2A v1 discovery cards at `/.well-known/agent-card.json` and `/.well-known/seller-agent-card.json`. These describe the read-only integration capabilities; they are not the Agent Cards anchored to badges 1147/1146 and do not prove CIS-8004 identity. The current seller badge/card mismatch remains unresolved.

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

## Production readiness path

The current hosted configuration is a controlled Testnet demonstration. It is not a production multi-user payment architecture: guest cookies are anonymous session scoping; hosted visitors share a configured buyer account; buyer quote/review state and rate limits are process-local; and the buyer signing key is a server secret. Persistent audit intent improves crash reconciliation but does not provide distributed atomicity, identity, or signer isolation. Hosted payments remain disabled by default.

Before a paid pilot, complete these gates:

1. **Prove fit with existing operators.** Integrate through the A2A or stdio MCP interfaces without requesting another agent's signing key. Record setup friction and real policy mismatches; do not infer adoption from the hackathon demo.
2. **Give each operator an identity and account boundary.** Replace guest scoping with individual authentication (OIDC/passkey or an equivalent approved identity provider), per-tenant data access, and explicit authorization. Never route multiple customers through one buyer key.
3. **Move state to a shared durable store.** Persist quotes, review/approval state, idempotency keys, dispatch intents, and reconciliation outcomes with atomic uniqueness and transaction locking. Prove recovery across restart and concurrent instances.
4. **Isolate signing authority.** Move signing behind a scoped managed signer/HSM or user-controlled wallet. Enforce network, asset, recipient, amount and digest policy in a separate deterministic service; do not pass signer credentials to an agent or model.
5. **Operate the service.** Add centralized rate limits, request tracing without secrets, settlement/reconciliation alerts, key rotation, backup/restore, retention controls, incident response, and service-level objectives.
6. **Earn the production boundary.** Resolve the seller card URI, run fresh Testnet end-to-end and failure/recovery drills, independently review security and privacy, and only then evaluate mainnet support under a separate architecture and authorization.

These are prerequisites, not implemented production capabilities. Mainnet use is not currently supported.

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
| `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_ALLOW_REMOTE` | Optional model host and name. Loopback is the default. Remote hosts require `OLLAMA_ALLOW_REMOTE=true` and HTTPS; prompts are sent to that configured host. |

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

Before broader production access, add rate limits, private service networking, managed signing, durable shared replay/idempotency, monitoring, incident response, independent settlement reconciliation, and an access/retention policy. Then verify the deployed revision and authoritative state. No mainnet account, contract deployment, legal review, or security audit is established here. External deploy, spending, or submission actions require separate authorization.
