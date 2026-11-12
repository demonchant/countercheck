# Live Concordium Testnet payment readiness

**Inspection date:** 12 November 2026, refreshed 11:54 UTC
**Network:** Concordium Testnet only (`ccd:4221332d34e1694168c2a0c0b3fd0f27`)
**Outcome:** no payment was authorized, signed, submitted, or broadcast during this inspection.

## Current update — 12 November 2026, 13:25 UTC

- Fresh Registry read at 12:46 UTC confirms buyer #1147 and seller #1146 are Active, owned by the expected accounts, and each `agent_uri` is still null. Agent Card verification therefore remains blocked. Raw read-only results are in [`evidence/registry-readonly-2026-11-12.json`](../evidence/registry-readonly-2026-11-12.json).
- The dedicated seller process now includes separate buyer and seller A2A v1 JSON-RPC interfaces. Local requests exercised buyer verification/quote and seller offer retrieval; quote and identity verification correctly returned `blocked` because the Registry URIs are unset. These local calls are not proof of public A2A availability.
- A local direct GET to the seller returned a genuine SDK-generated HTTP 402: x402 v2 exact, Concordium Testnet, CCD, 1,000,000 microCCD, seller #1146 recipient, configured sponsor, and a 60-second timeout. The observed capture is [`evidence/seller-challenge-refresh-2026-11-12.json`](../evidence/seller-challenge-refresh-2026-11-12.json). The seller A2A call returned the same validated terms and `paidFulfillmentAvailable=false`. No payment header, signature, or settlement request was sent.
- The operator's Render URL is HTTPS reachable, but the latest direct checks of `/resource` and both A2A paths returned HTTP 502 with `x-render-routing: no-deploy`. Render logs showed the current remote revision starts `npm run start` and does not contain the seller service files. Updated source and `render.yaml` are prepared locally but have not yet been pushed or deployed.
- The local seller's development port is now 4191. Node's Fetch API rejects port 4190, which prevented local buyer/A2A fetches even though a Node HTTP diagnostic could retrieve the seller challenge. Local `SELLER_RESOURCE_URL` now points to port 4191; `SELLER_RESOURCE_PUBLIC_URL` remains unset until the public challenge passes external checks.
- A2A SDK schema and protocol tests and x402 challenge-generation tests pass locally. No Agent Card revision has been published, no fresh final Registry previews are prepared, and no Registry or payment transaction was signed or submitted. `PAYMENTS_ENABLED=false` and `FACILITATOR_SETTLEMENT_ENABLED=false`.

## Step status

| Target step | Status | Evidence and remaining gap |
|---|---|---|
| Buyer agent #1147 verified | `BLOCKED` | Live Testnet Registry confirms token 1147 is `Active`; its `agent_uri` is null, so no card hash match can be established. The current on-chain hash is `289c7e7f4d3c891fa56963da7bf199ce872ab52228abf692c376d3a637a97d53`. Its owner and `agentWallet` are both `3phKp6hd4vJU3WHexeVrc7mrkFbx3S9UtAxxsPEwE7S6rmNq7x`, matching the configured buyer account. |
| Seller agent #1146 verified | `BLOCKED` | Live Testnet Registry confirms token 1146 is `Active`; its `agent_uri` is null, so no card hash match can be established. The current on-chain hash is `fc0f1a6e90f7f5d60f06159e4a34638331bd200b31de8bd9e8bfe169c3a2f858`. Its owner and `agentWallet` are both `44khdNXk2yBn8PvJYFYNsKuZrV8oUvdHo23bL6dA7YyEYGkEF7`, matching the configured seller payee. |
| Seller serves x402 v2 exact resource | `VERIFIED` (local Testnet offer) | A fresh local GET at 11:45:31 UTC returned HTTP 402 from `src/seller-resource.mjs`, initialized against facilitator `/supported`. Challenge: x402 v2 exact, Testnet, CCD, 1,000,000 microCCD, configured seller payee, configured sponsor, 60-second timeout. See [`evidence/seller-challenge-refresh-2026-11-12.json`](../evidence/seller-challenge-refresh-2026-11-12.json). `SELLER_RESOURCE_URL` is now configured as `http://127.0.0.1:4190/resource`; the seller process was stopped after this read-only capture. This is a loopback resource, not a public endpoint. |
| Buyer receives a genuine 1 CCD challenge | `PARTIAL` | The seller emitted a fresh genuine challenge. A direct call to Countercheck's guarded quote path remains blocked because both cards have null on-chain `agent_uri`; no quote was accepted by the buyer. |
| Buyer signs payment authorization | `BLOCKED` | The current browser path asks for quote-level confirmation, then the pinned x402 client constructs and signs a sponsored transaction inside the paid fetch. The UI does not first display the generated nonce, absolute expiry, exact transaction, or live fee/balance details for explicit review. Payment remains disabled; no buyer signature was created. A two-stage prepare → show details → approve → sign flow is required before enabling this path. |
| Sponsor signs as fee payer | `IMPLEMENTED / UNVERIFIED` | The Testnet-only facilitator uses the Concordium SDK sponsor signer, validates the fee payer against the configured sponsor, and is settlement-off by default. The sponsor key/address pairing and live signature have not been checked. |
| Facilitator submits sponsored transaction | `IMPLEMENTED / UNVERIFIED` | Authenticated loopback `/settle` invokes the pinned x402 Concordium facilitator only after policy checks, buyer verification, replay claim, and a fresh sponsor reserve check. Distinct settlement requests are serialized per process. No request reached `/settle` in this work. |
| Concordium Testnet finalizes | `IMPLEMENTED / UNVERIFIED` | The SDK is configured with `requireFinalization: true`; finalization is awaited. No Testnet transaction or receipt exists. |
| Countercheck verifies actual finalized transfer | `PARTIAL` | The facilitator queries finalization details again and compares status, sender, recipient, exact amount, and CCD asset before storing success. The second read uses the same configured Testnet gRPC signer/node, so an independent explorer/node check is still required and has not occurred. The buyer UI only labels the seller response as chain-check pending. |

## Live Registry and card facts

The initial PowerShell `.NET` request returned `ReceiveFailure`. The Node-based diagnostic now reaches the hosted Registry: both badges return HTTP 200 from `check-badge` and `verify-agent-card`, and MCP read-only token/wallet lookups succeed. The Registry is reachable. The blocker is that both on-chain `agent_uri` values are null. The helper now uses Node, matching Countercheck's Registry path. Raw responses are in [`evidence/registry-readonly-2026-11-12.json`](../evidence/registry-readonly-2026-11-12.json).

The local cards and current GitHub raw copies match byte-for-byte. Their SHA-256 values are `af92a669f19f9a9ee942ce97b9791a0e592cbcacde096332a2e230cb05627e89` (buyer) and `98dc0eab2eee124c3af8103d0c8bf502744c41ff5d13f048c42e214b358089b0` (seller). The on-chain hashes are different. Both agents were registered before the only public GitHub commit touching these files (`3ca4f3b6398cede158c8196ff4b118029820b986`, 03:47:30 UTC). The returned history had no prior version matching the chain hashes, so the source/preimage of those earlier hashes is unknown. Details: [`docs/agent-card-integrity.md`](agent-card-integrity.md) and [`evidence/agent-card-integrity-2026-11-12.json`](../evidence/agent-card-integrity-2026-11-12.json).

The hosted Registry builder returned unsigned `CIS-8004.setAgentURI` parameter previews for the current published card bytes and immutable commit-pinned URLs. Full owners, hashes, URIs, parameter JSON/hex and suggested energy appear in [`evidence/set-agent-uri-previews-2026-11-12.json`](../evidence/set-agent-uri-previews-2026-11-12.json). These are parameter previews, not signed transactions or fee estimates. Recommended card copy changes are recorded in [`docs/agent-card-integrity.md`](agent-card-integrity.md); if those changes are accepted, publish final immutable card bytes and rebuild the previews before anyone signs.

The existing loopback facilitator returned `ok=true`, the Testnet CAIP-2, `settlementEnabled=false`, and x402 v2 exact support at `/healthz` and `/supported`. The configured fee payer is present in that capability response. The response is saved as [`evidence/facilitator-readonly-2026-11-12.json`](../evidence/facilitator-readonly-2026-11-12.json); it proves local service configuration only, not sponsor key pairing or node health.

The current local and public branch Agent Card files contain these exact byte hashes:

| Card | Local URL claim | Local SHA-256 |
|---|---|---|
| Buyer #1147 | `https://raw.githubusercontent.com/demonchant/countercheck/main/agent-cards/countercheck-buyer-1147.json` | `af92a669f19f9a9ee942ce97b9791a0e592cbcacde096332a2e230cb05627e89` |
| Seller #1146 | `https://raw.githubusercontent.com/demonchant/countercheck/main/agent-cards/countercheck-seller-1146.json` | `98dc0eab2eee124c3af8103d0c8bf502744c41ff5d13f048c42e214b358089b0` |

The `main` URLs are mutable. Commit-pinned URLs are used in the unsigned previews. The `/v1/badge-check/` embedded verification paths are a documented permanent alias; they are not stale. The cards should still be reviewed before update: the seller description must reflect the local-only resource, and neither top-level `url` should be represented as a callable public A2A endpoint because no public A2A endpoint exists.

The seller card declares an empty `services` object. This remains appropriate for a loopback-only endpoint; no public seller endpoint is deployed. The local `.env` now points `SELLER_RESOURCE_URL` to the loopback resource. The seller server is opt-in and is currently stopped.

## Validation and signing controls

- Buyer and facilitator amount ceilings reject configurations or requirements above 1,000,000 microCCD (1 CCD). The local seller's configured resource price is exactly 1,000,000 microCCD.
- The buyer quote validator and facilitator require the same exact Concordium Testnet ID, literal native asset `CCD`, exact seller recipient, exact configured fee payer, and an integer timeout from 6 through 300 seconds. The facilitator additionally checks the buyer sender, V1 transfer, signed transaction sponsor, nonce shape, and header expiry window.
- The pinned Concordium x402 2.30.0 source shows `settle()` re-running verification immediately before sponsor signature. That verification checks the buyer signature, transaction expiry, current account nonce, and buyer available balance. This is source inspection of the locked dependency, not a live Testnet observation.
- Countercheck reads the sponsor's available balance before claiming and again immediately before calling the SDK settlement method. This is a configurable minimum reserve, not an exact fee estimate; the chain remains authoritative for actual fee sufficiency.
- Replay claims are durable per payload in the local filesystem store. A claim left by an ambiguous outcome stays blocked for reconciliation. The facilitator serializes settlements within one process, but the local store is not a distributed lock for multiple machines.
- The client now parses the x402 `PAYMENT-RESPONSE` `transaction` field only when it reports success on the configured Testnet, and accepts Concordium's 32-byte hex hash with or without `0x`. This parser behavior has unit coverage, not a live settlement result.
- Buyer payment and facilitator settlement are confirmed off (`PAYMENTS_ENABLED=false`; facilitator `/healthz` reports `settlementEnabled=false`). The seller process was enabled only in its own process environment for a read-only challenge fetch and was then stopped. The MCP payment tool has been removed. The browser flow still lacks an exact generated-transaction review before signing; do not enable it.

## Exact remaining prerequisites

1. Review final card text. The candidate unsigned previews pin the current published content; rebuild if any card bytes or URI changes. No public card revision has been published.
2. Each current owner/approved operator must sign and submit its separate CIS-8004 update. No Registry transaction was signed or submitted here. After finalization, verify both cards report a matching hash and registered wallet.
3. Confirm the loopback seller resource is running for the demo and fetch a fresh challenge. The URL is configured; seller process currently stopped. The facilitator remains Testnet-only and settlement-off.
4. Refactor the buyer flow to prepare and display the exact unsigned transaction (sender, recipient, amount, asset/network, nonce, absolute expiry, sponsor), estimate fee and show sponsor balance, then require explicit approval before buyer signing. Add a separate exact review/approval gate before invoking facilitator `/settle`, which combines sponsor signing and submission.
5. Once Registry checks pass, confirm buyer/sponsor balances and key/address pairing safely. Recheck nonce, buyer balance, and sponsor balance immediately before transaction preparation/signing; display fresh values.
6. Only after presenting exact payment transaction details and obtaining explicit user approval may a payment be signed/submitted. Keep both flags off until then.
7. After an authorized run, capture the buyer signature result, sponsor submission, transaction hash and finalization. Verify the finalized transfer independently through CCDExplorer or a second Testnet node. Never use fixtures as live evidence.

There is no public deployment, production-readiness claim, EU AI Act compliance claim, or hackathon submission receipt established by this record.
