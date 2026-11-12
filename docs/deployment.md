# Deployment and local operations

Countercheck's buyer app and facilitator remain loopback-only. The Node server rejects non-loopback buyer `HOST` values because there is no multi-user authentication. The dedicated seller service can run on Render from [`render.yaml`](../render.yaml); it listens on Render's assigned `PORT`, uses the platform HTTPS edge, and exposes only `/resource` (the app returns 404 for `/healthz` on Render). Buyer keys and sponsor keys are not part of this deployment. The seller challenge-only process needs only the public seller and sponsor account addresses.

The supplied Render origin is `https://countercheck-zid6.onrender.com`. A direct HTTPS request on 2026-11-12 completed TLS but returned HTTP 502 with `x-render-routing: no-deploy` at both `/` and `/resource`; see [`evidence/render-public-check-2026-11-12.json`](../evidence/render-public-check-2026-11-12.json). Subsequent Render logs supplied by the operator show a build from commit `d7f0a5579e0a922a0649034f31e16708536945a0`, followed by `npm run start` (the buyer app), which listens on `127.0.0.1:10000`; Render requires `0.0.0.0:$PORT`, so its port scan finds no open listener. A direct read of that exact public commit confirmed that its `package.json` has no `seller` script, and both `render.yaml` and `src/seller-resource.mjs` return HTTP 404. Therefore, changing the start command on the current revision to `npm run seller` would also fail. First publish the local seller service and Render configuration to GitHub; then update the existing Render service's Build Command to `npm ci` and Start Command to `npm run seller`. The seller service detects Render via `RENDER=true`, binds `0.0.0.0:$PORT`, and derives its challenge URL from the platform-assigned `RENDER_EXTERNAL_URL` plus `/resource`. Add the required non-secret public addresses and keep settlement disabled as listed below. Do not expose the buyer app on the public service. Do not set `SELLER_RESOURCE_PUBLIC_URL` or `SELLER_RESOURCE_URL` to this host until `/resource` externally returns a genuine, validated HTTP 402 challenge.

`render.yaml` configures a free web service with automatic deploys disabled and prompts for `SELLER_PAY_TO` and `CCD_FACILITATOR_ADDRESS`; these are public account addresses, not private keys. The deployment uses `SELLER_CHALLENGE_ONLY=true` and `FACILITATOR_SETTLEMENT_ENABLED=false`. A challenge-only endpoint cannot verify or settle an authorization and must not claim paid fulfillment. Render's free service may sleep when idle, so the first request after inactivity can have a cold start. The older [`Caddyfile.example`](../deploy/Caddyfile.example) is an alternative self-hosted reverse proxy design, not the selected hosting path.

## Prerequisites for a live testnet run

1. Confirm the full Encode eligibility terms and checkpoint access; the public event article does not settle whether an existing LLM agent/framework is mandatory.
2. After 19 November 2026, confirm the hosted Registry MCP and the CIS-8004/CIS-8 testnet deployments and response schemas.
3. Create or use separate Concordium testnet identities/accounts for the buyer and seller. The identity provider verifies each responsible owner. Register both agents and their exact Agent Cards on testnet; configure each registered `agentWallet`.
4. Obtain the buyer's dedicated testnet signing key through the wallet's supported secure export flow. Keep it only in a local ignored `.env` or secret manager. Use a disposable, low-balance test account. Never use a mainnet key.
5. Configure a genuine testnet seller endpoint that returns an x402 v2 `402 Payment Required` challenge for Concordium testnet, native CCD exact payment, correct `payTo`, short expiry and the sponsor's `feePayer`. Configure its x402 facilitator client to call Countercheck's local facilitator (see [facilitator guide](facilitator.md)).
6. Review the exact destination, amount cap, asset, network, signer and gas sponsor. The service amount is still paid by the buyer; sponsorship only covers the network fee.
7. Have test CCD/payment assets as required by the seller flow. The builder reports all three accounts funded with test CCD and the buyer/seller agents registered; this has not been independently verified. No transaction has been signed or sent in this work.

## Environment configuration

Copy the template and fill values only on the builder's machine:

```powershell
Copy-Item .env.example .env
```

Required to enable payment:

| Variable | Format/purpose |
|---|---|
| `HOST` | Keep `127.0.0.1`; other bind addresses are rejected. |
| `PORT` | Local HTTP port; default `4173`. |
| `REGISTRY_MCP_URL` | HTTPS origin only, default official hosted Registry MCP. |
| `CONCORDIUM_NETWORK` | Fixed current testnet CAIP-2 ID; mainnet is rejected. |
| `BUYER_BADGE` | Buyer's testnet CIS-8004 badge. Its Registry `agentWallet` must equal `CCD_ACCOUNT_ADDRESS`. |
| `SELLER_BADGE` | Seller's testnet CIS-8004 badge. Its Registry `agentWallet` must equal `SELLER_PAY_TO`. |
| `SELLER_PAY_TO` | Exact native CCD payee address used by seller's x402 challenge. |
| `SELLER_RESOURCE_URL` | Fixed HTTPS endpoint; arbitrary URLs are never accepted over the API. Loopback HTTP is allowed for local dev only. |
| `MAX_SPEND_MICROCCD` | Positive integer maximum per purchase in atomic microCCD (6 decimals). Set a low amount. |
| `SELLER_ASSET` | `CCD` only in this build. |
| `PAYMENTS_ENABLED` | Must be explicitly set to `true` after reviewing the full setup; safe default is `false`. |
| `CCD_ACCOUNT_ADDRESS` | Buyer's Concordium testnet sender account, also linked in the buyer badge. |
| `CCD_PRIVATE_KEY` | Dedicated buyer testnet signing key. Secret: never commit, log, display or send it to an MCP/model. |
| `AUDIT_LOG_PATH` | Local JSONL output path outside `public/`; default `./data/receipts.jsonl`. |

Facilitator-specific variables are listed in `.env.example`: sponsor address/key (`CCD_FACILITATOR_ADDRESS`, `CCD_FACILITATOR_PRIVATE_KEY`), API bearer token, amount policy, sponsor balance reserve and replay store path. The facilitator has its own `FACILITATOR_SETTLEMENT_ENABLED=false` gate, separate from buyer `PAYMENTS_ENABLED`. Read [docs/facilitator.md](facilitator.md) before configuring it. Never copy the buyer key into the sponsor variable or paste either key into chat.

The event's description of a sponsored transaction does not mean the purchase is tokenless. Payment asset and network fee are different values. The x402 client signs from the buyer key; a seller/facilitator adds sponsorship and submits if its challenge is valid.

## Start/stop

```powershell
npm install
npm run dev
```

Open only `http://127.0.0.1:4173`. Stop with Ctrl+C. `npm start` runs without file watching. `PAYMENTS_ENABLED=false` is the initial mode. Current environment status (12 November 2026): dependencies installed and `package-lock.json` generated using a temp npm cache and `--ignore-scripts`; npm's global offline setting and dead local proxy were bypassed for that command only. A regular install failed because this Windows environment returned `spawn EPERM` while running protobufjs's postinstall script. That script only checks dependency version-scheme compatibility; I ran it directly with Node and it exited successfully. `npm run dev` still fails with `spawn EPERM`, while `npm start` runs. `npm audit` reports three moderate entries tied to `uuid` via `@concordium/web-sdk`, with no automatic fix offered; review before production. The local web UI and Ollama/MCP read-only agent both started; no tests or build were run.

## MCP agent setup

The optional stdio MCP process is started from the project directory with:

```powershell
npm run mcp
```

This laptop also has the local Ollama model `llama3.2:3b`. Start the included read-only agent host in another terminal with:

```powershell
npm run agent
```

It calls Ollama on loopback and connects to the same Countercheck MCP server in-process through the SDK's in-memory transport. It exposes only `verify_counterparties` and `request_purchase_quote` to the model. The model has no purchase capability. The browser signing path also remains disabled until it can show the exact prepared transaction, nonce, expiry, fee and balances before signing. No prompt or tool result is sent to a hosted model service by this local host.

Configure the host agent to launch that command with this directory as its working directory. Keep `.env` local; do not copy the buyer key into MCP arguments, host prompts, or agent configuration text. The MCP process offers:

- `verify_counterparties`: read-only live checks of the configured buyer and seller badges/cards/wallet links.
- `request_purchase_quote`: read-only live rechecks and seller x402 quote inspection. Works when payments are disabled and needs no signing key.
- MCP tools are read-only. Payment authorization is available only in the browser review flow.

The seller resource, buyer payment, and facilitator settlement are separate explicit flags, all off by default. The hard buyer and facilitator limit is 1,000,000 microCCD. Keep every service on loopback and do not enable signing or settlement until Registry state, buyer/sponsor accounts, seller payee, exact terms, and a human-approved transaction review are ready. An ambiguous result consumes the quote and must be reconciled before another payment attempt.

## Safe run order

1. Start with payment disabled and check the displayed mode. `/api/status` reports configuration only; it is not a health check of the Registry or facilitator.
2. Use the seller badge to exercise the read-only `/api/verify` flow. Proceed only when active state, card hash and registered wallet have returned from the live Registry.
3. Verify the buyer badge is also active, its card hash matches, and its `agentWallet` equals the payment sender account.
4. Confirm the local facilitator reports settlement disabled and `/supported` advertises the intended Testnet sponsor.
5. Start the local x402 seller resource with `SELLER_RESOURCE_ENABLED=true` only after the live Registry/account checks and facilitator response are ready. Confirm its actual `/resource` response is an HTTP 402 with the expected exact 1 CCD terms.
6. Request a buyer-side read-only quote. Confirm Countercheck accepts the same seller, asset, network, amount, timeout and sponsor terms. Registry failures must block this step.
7. Before any settlement, review the exact transaction details and obtain explicit approval. Then and only then enable buyer payment and facilitator settlement for the single controlled Testnet run. Do not use browser automation for a transaction.
8. If a hash is returned, independently open it in CCDExplorer and check network, sender, recipient, amount, finalization and result. A response hash/header alone is not confirmation.
9. On timeout or missing transaction reference, inspect the sender account and chain before any retry. Preserve `unresolved` status until reconciled.

## Operations and recovery

- Stop the local service to pause new requests. The app does not run jobs or background workers.
- Keep `.env` and the local `data/` file off Git and screenshots. Rotate/revoke the testnet key through the supported wallet/network process if exposed.
- Back up the local receipt file only if needed and protect it; this prototype has no encrypted backup or tested restore path. Chain transaction state remains authoritative for payment settlement.
- A corrupted/hash-chain-mismatched log blocks new append operations. Preserve the original file for review; do not delete/reset it while an ambiguous transaction may be outstanding.
- No Docker container is used; there is one local Node process and no port conflict is expected. Public hosting requires a separate authentication, key-management and operator review before implementation.

## Production path

1. Pilot with a named agent buyer and seller, plus a documented data-minimization/retention policy.
2. Move signing into a dedicated policy-limited wallet/signing service; never store an unrestricted long-lived private key in a general web process. Add independent user identities, scoped approvals, rate limits, monitoring and incident response.
3. Deploy a merchant facilitator with production sponsorship budgets and exact supported networks/assets; prove constraints and settlement from a real test environment first.
4. Replace the local JSONL with an authenticated, encrypted, access-controlled record store or externally anchored audit mechanism chosen with users and legal/privacy review.
5. Do threat modeling and data-protection/legal review; verify identity-provider and external-wallet binding freshness; establish key rotation/revocation and support paths.
6. Roll out to real users with a capped allowlist, observable failure/pending states, independent transaction reconciliation and measured user feedback before expanding.

No mainnet deployment, user pilot, legal review, production account, contract deployment, or security audit exists in this workspace.
