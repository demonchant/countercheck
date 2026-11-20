# Architecture

**Current review: 19 November 2026.** The full configured buyer path completed once on Testnet: mismatch rejection, live Registry/card/wallet checks, exact quote, transaction review and digest approval, buyer signature, sponsored settlement, second gRPC finality read-back, paid response, and local hash-linked receipt. See [`../evidence/live-e2e-2026-11-19.json`](../evidence/live-e2e-2026-11-19.json). The explorer was not independently inspected during capture. README-reported Registry update hashes still lack finalized receipts.

## Product definition

Countercheck is a buyer-side operator tool for one configured paid seller. Its deterministic path checks buyer/seller Concordium Testnet badges, card hashes and registered `agentWallet` values; matches the seller wallet to the x402 recipient; checks the quote against a fixed exact-payment policy; prepares the sponsored transfer for review; binds approval to its digest; signs and submits through the configured facilitator; and waits for finality and paid fulfillment. One captured local run verifies this configured path only. An optional local Ollama assistant can explain or request the two read-only MCP checks; it has no signing/payment tools, and no model-quality evaluation is documented. Badges do not authorize spending or establish service quality. The hosted Vercel surface uses signed anonymous guest-browser sessions; they scope quote/review/receipt state but do not identify or authorize buyers.

### Data flow

```mermaid
sequenceDiagram
    actor Operator
    participant UI as Local browser UI
    participant API as Loopback Node service
    participant Registry as Concordium Registry MCP / REST
    participant Seller as Configured x402 seller
    participant Facilitator as Local Countercheck x402 facilitator
    participant CCD as Concordium testnet
    participant Log as Local hash-linked JSONL

    Operator->>UI: Enter configured seller badge
    UI->>API: POST /api/verify
    API->>Registry: check_badge + verify_agent_card + get_agent_wallet
    Registry-->>API: Active state, card hash result, registered wallet
    API-->>UI: Verified / blocked / unavailable
    Operator->>UI: Request quote
    UI->>API: POST /api/quote
    API->>Registry: Recheck buyer and seller badges, cards and wallets
    API->>Seller: Read HTTP 402 challenge (no payment)
    Seller-->>API: Network, asset, amount, payTo, expiry, fee payer
    API-->>UI: Quote only if it matches policy
    API->>Registry: Recheck buyer and seller before review
    API->>Seller: Re-read x402 challenge
    API->>CCD: Read nonce, account balances and chain parameters
    API-->>UI: Exact unsigned sponsored transfer, fee, balances and digest
    Operator->>UI: Approve this digest or cancel
    UI->>API: POST /api/approve (review id + digest)
    API->>Registry: Recheck identities and challenge
    API->>CCD: Recheck nonce, balances and transaction details
    API-->>UI: approved_unsubmitted or blocked/changed
    Operator->>UI: Sign, pay and request resource (explicit action)
    UI->>API: POST /api/purchase for approved digest
    API->>Registry: Recheck buyer/seller identities and challenge
    API->>CCD: Recheck chain state, sign exact digest, submit through seller/facilitator path
    CCD-->>API: Finalized transaction details (second gRPC read)
    API->>Seller: Receive paid resource after settlement
    API->>Log: Append hash-linked local receipt
    API-->>UI: Paid response, transaction hash and receipt
    Note over UI,Log: CCDExplorer URL is provided; independent explorer inspection was not captured
```

## Components and contracts

| Component | Responsibility | Authority/secret boundary | State/failure |
|---|---|---|---|
| `public/` | Badge entry, quote review, transaction review/approval, explicit payment action, status/receipt display. | No signing key. Same-origin JSON requests only. | Safe mode disables signing/payment; full configured Testnet mode requires a separate explicit click. |
| `api/` and `src/vercel-api-proxy.mjs` | Route-allowlisted Vercel functions proxy status, configured seller badge, guest-session-bound quote/review/payment calls, and receipts to the buyer API. | Buyer API bearer stays in Vercel server environment. Guest cookies are signed with an HMAC key derived from the bearer token and marked HttpOnly/Secure/SameSite; server creates the identity header. | Clerk is not used. A guest cookie scopes one browser session but is not identity or authorization. Public payment switch defaults off; if enabled, every visitor can use the shared configured Testnet buyer account. |
| `src/server.mjs` | Loopback HTTP API; content limits, origin/header checks, static UI, status. | Binds only to `127.0.0.1`; rejects non-loopback config. | Request body ≤8 KB; no public exposure/authentication. |
| `src/registry.mjs` | Hosted Registry REST check and MCP `get_agent_wallet` call; verifies testnet badge/card and exact payment-wallet equality. | Read-only. No key sent to Registry service. | Timeout, schema drift, revoked/missing badge, hash mismatch, wallet missing, recipient mismatch all fail closed. |
| `src/payment.mjs` | Fixed seller challenge read, quote policy, fresh transaction review, digest-bound approval, signing, purchase and paid-result verification. | Buyer key remains server-side; review checks it matches the supported first credential key. Approval and signing are separate user actions. | Quotes/reviews expire; changed identity, challenge, nonce, balance or transaction invalidates approval. Ambiguous settlement remains unresolved and must not be retried blindly. |
| `src/facilitator.mjs`, `src/facilitator-server.mjs` | Standalone local x402 v2 `/supported`, `/verify`, `/settle` API on Concordium Testnet. | Separate sponsor key, API bearer token, loopback bind, testnet CAIP-2 and configured buyer/seller/sponsor. Settlement requires `FACILITATOR_SETTLEMENT_ENABLED=true`. | One captured Testnet settlement reached finality; single-process/local deployment only. |
| `src/facilitator-core.mjs`, `src/facilitator-store.mjs` | Apply a fixed one-buyer/one-seller/native-CCD policy, sponsor balance reserve and persistent replay claim. | Never logs/stores the sponsor key or raw payment signature. Receipt records hash the payload and preserve transaction metadata only. | Persistent single-host replay barrier; ambiguous results stay blocked for manual reconciliation. |
| `src/mcp.mjs` | stdio tools for read-only counterpart verification and quote request. | Never accepts key, seller, wallet, network, URL or cap as tool input; no purchase tool is exposed. | Keep the process local and restrict its host agent. |
| `src/local-agent.mjs` | Optional Ollama model host wired to the Countercheck MCP server through the SDK's in-memory transport. | Only read-only verification/quote tools are advertised; no purchase tool or wallet key is available. `OLLAMA_URL` can point to a non-loopback host. | Requires an available configured Ollama service and installed dependencies; no model-quality evaluation is documented. |
| `src/seller-resource.mjs` | Local x402 v2 exact resource using the pinned x402 Concordium server scheme. | Fixed 1 CCD native resource; retrieves sponsor capability from facilitator; HTTP endpoint loopback only; opt-in via `SELLER_RESOURCE_ENABLED`. | Fresh read-only GET returned a genuine HTTP 402 challenge on Testnet; no public endpoint is deployed. |
| `src/audit.mjs` | Append local records with previous-record SHA-256 link. | Local filesystem only. Not an external immutable ledger. | The successful run wrote a hash-linked payment/fulfillment record. It is locally mutable by a privileged filesystem actor. |
| Concordium hosted Registry MCP | Active registration, card integrity, and registered payment-wallet reads. | Official hosted service is documented as stateless and keyless. | Service availability and testnet contract status must be checked in the event build window. |
| x402 service/facilitator | Merchant challenge, payment verification, sponsor signature and settlement. | The buyer signs the service transfer; the configured sponsor account pays network fees and submits. Service amount is still paid by the buyer. | One local Testnet settlement is evidenced. Provider failure or ambiguous response must be reconciled before any manual retry. |

### Canonical state transitions

`idle → checking → verified | blocked | unavailable`  
`verified → quote-requested → quoted | blocked | unavailable`  
`quoted → review-ready → approved-unsubmitted | cancelled | review-changed | blocked`  
`approved-unsubmitted → signing → submitted → finalized → fulfilled | unresolved | failed`

The recorded run's facilitator performs a second Testnet gRPC read and matches finalized sender, recipient, amount and asset before fulfillment. This is an observed postcondition for that run, not an independent explorer inspection. If the transaction hash is missing or the request times out after the signer may have acted, retain `unresolved`, inspect the sender and chain, and do not submit a duplicate.

## Data model and invariants

- `BuyerPolicy`: fixed buyer badge, buyer `agentWallet` equal to the sender account, Concordium Testnet network, native CCD asset, configured ceiling, and a current exact supported amount of 1,000,000 microCCD (1 CCD). Configured locally, not accepted from an agent's untrusted tool arguments.
- `SellerPolicy`: fixed seller badge and exact `agentWallet` payee, configured paid resource, and supported x402 requirements.
- `Verification`: buyer and seller testnet badges, active status, card-hash match, registered wallets, intended sender/payee match, timestamps and Registry response provenance. Freshness gate: recheck both for every quote and immediately before payment.
- `Quote`: one-use random ID; short expiry; x402 version, exact scheme, network, asset, amount, pay-to, fee payer and timeout. Payment is rejected if the live requirements differ from the review.
- `Receipt`: status, parent intent ID, seller badge, recipient, atomic amount, asset, network, service HTTP status, response SHA-256, payment transaction hash and explorer URL. The 19 November run wrote a local record; request and response bodies are not written to the log.
- A quote/review is one-use through the purchase flow. Ambiguous outcomes require chain/account reconciliation before another attempt.
- The JSONL hash chain is local and can be rewritten by a sufficiently privileged filesystem actor; it is not a cryptographic external anchor or an immutable audit system.

## Security and residual risk

- The signing key is a highly sensitive local process secret. Use a dedicated low-balance testnet account, never a personal/mainnet key. Do not expose it in browser code, MCP tool context, shell output, logs, screenshots, or Git.
- Keep the local server on loopback; its API requires exact local `Origin`, `Host`, JSON content type and custom header. The hosted anonymous guest cookie scopes session state, but does not authenticate a person or prevent public access when payments are enabled.
- Seller URL is fixed in operator configuration, never supplied to the HTTP API. This avoids arbitrary-URL/SSRF input. Require HTTPS except for a loopback seller.
- Redirects are rejected. Registry inputs are bounded and encoded. Registry/MCP output is untrusted; only required booleans, statuses, wallet strings and exact payment requirements are interpreted.
- Payment policy is limited to Testnet and `exact`, native CCD, exact seller recipient, a hard 1 CCD ceiling, short expiry, and current buyer/seller verification. The browser displays the exact transaction fields and requires digest-bound approval after rechecks. MCP has no payment tool. One full payment path is verified in the 19 November capture.
- The seller resource, buyer payment, Vercel public-purchase and facilitator settlement flags default off. The seller route generates 1 CCD requirements through the x402 SDK; it does not substitute a static challenge fixture.
- Facilitator sponsorship does not eliminate amount risk or sender signing. The agent wallet needs the payment asset. Do not claim the service is free.
- Badge verification proves the registry's accountability claim and card integrity only. It does not attest to conduct. CIS-8 external-key binding is not necessarily proof of present-day control of an arbitrary smart wallet.
- No third-party data is logged except the minimal public badge, response digest, payment reference and status. Full response data is shown transiently in the local UI only; it is not persisted.

## Decision records

| Decision | Choice | Reason / revisit trigger |
|---|---|---|
| Product AI | Optional Ollama wrapper; payment and identity gates stay deterministic. | The local model can use MCP read tools. `OLLAMA_URL` is configurable, so prompts go to its configured host (loopback by default). Keep payment out of the model tool list. |
| Registry interface | Hosted Registry REST reads + MCP `get_agent_wallet`. | Official docs expose stable REST routes for badge/card and MCP tool for the registered wallet. Change if the testnet service response requires another official path. |
| Network | Concordium Testnet only (`ccd:4221332d34e1694168c2a0c0b3fd0f27`). | Configuration rejects other network IDs. |
| Payment | `@x402/concordium` exact scheme; x402 package versions pinned at 2.30.0; `@concordium/web-sdk` pinned at stable 12.0.2. | x402 npm registry showed 2.30.0 as current on 11 Nov; package README was served at 2.28.0 during review, so inspect installed API and lockfile before any payment attempt. SDK 12.0.2 was the stable npm version; 13.x was alpha. |
| Persistence | Local append-only JSONL with chained hashes. | One local operator and minimal receipt; no need for remote account/database yet. Revisit for shared deployments, tamper-resistant external anchoring, or retention requirements. |
| UI/server | Node built-in HTTP + static accessible UI; Vercel proxy for the hosted buyer API. | Keeps the local demo small. Public hosted purchases require deliberate operator enablement and remain an anonymous shared-account Testnet surface. |

