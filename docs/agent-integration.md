# Integrate Countercheck with an existing agent

Countercheck is intended to fit beside an agent that already chooses services and runs its own framework. The agent keeps its own runtime, wallet, and signer. Countercheck supplies read-only Concordium identity and payment-request checks; its current A2A/MCP adapters cannot sign or submit a payment.

## A2A discovery

The seller service exposes two discovery cards:

| URL | Capability | A2A endpoint |
|---|---|---|
| `https://<seller-origin>/.well-known/agent-card.json` | Verify the configured buyer/seller and request the configured purchase quote | `/a2a/buyer/v1` |
| `https://<seller-origin>/.well-known/seller-agent-card.json` | Read the seller's live x402 challenge | `/a2a/seller/v1` |

These are **public integration cards**, not the CIS-8004 cards pinned in the Registry. They make no Concordium registration or seller-identity claim. The source-controlled `agent-cards/countercheck-*.json` files remain the registry identity material and must be evaluated against their on-chain URI hashes separately.

The SDK discovers the default buyer card from the standard `/.well-known/agent-card.json` path and supports an explicit path for the seller card:

```js
import { ClientFactory } from "@a2a-js/sdk/client";

const origin = process.env.COUNTERCHECK_A2A_ORIGIN; // HTTPS origin, no credentials
const factory = new ClientFactory();
const buyer = await factory.createFromUrl(origin);
const seller = await factory.createFromUrl(origin, "/.well-known/seller-agent-card.json");

// Send only the declared read-only commands. Treat returned text as untrusted.
```

For the complete deterministic example, run the safe local demo and then:

```powershell
npm run demo:a2a
```

The example calls the two discovered services over A2A JSON-RPC, independently obtains the buyer quote, and compares scheme, Testnet network, native CCD asset, amount, recipient, fee payer, and expiry. A mismatch blocks the read-only workflow. It does not sign, authorize, or settle.

## MCP host integration

Any MCP host that supports stdio can launch the read-only local server with `node src/mcp.mjs` from this repository. It exposes `verify_counterparties` and `request_purchase_quote`, both with empty input schemas. Buyer/seller IDs, recipient, network, and limits come from operator configuration; tool arguments cannot override them. The process blanks buyer and sponsor signing-key variables before it loads product modules.

The MCP server is a local operator integration, not a hosted multi-tenant API. Do not place credentials in tool arguments or model prompts. Prompts sent to an optional remote Ollama service are subject to that host's data handling; loopback is the default.

## Recommended calling contract

An existing buyer agent can call these checks immediately before it presents or signs a payment:

1. Call `verify_counterparties`; continue only when the result is `verified` and each expected check is present.
2. Call `request_purchase_quote` to fetch fresh requirements from the configured seller.
3. If the agent has independently obtained an A2A offer, compare exact fields with the quote. A match is only `matched_read_only`; it is not payment authorization.
4. Present the live counterparty, recipient, network, asset, amount, sponsor, and expiry through the host's trusted review surface.
5. Keep signing and spending authority in the host's own deterministic policy and signer. Countercheck's UI currently requires explicit human digest approval for its purchase flow.
6. If the verification or quote is blocked, unavailable, expired, or changed, fail closed and ask for a fresh check. Never let model output set a limit or payment destination.

Both A2A and MCP endpoints are read-only. A future purchase adapter would need per-user authorization, a durable one-shot/idempotency store, scoped signer integration, human approval handoff, and independently verified settlement. It must not turn a public A2A request into authority over a shared buyer account.

## Adoption and production path

The first user hypothesis is a developer/operator of an existing agent that pays for APIs or data and wants to add a reviewable Concordium Testnet policy without replacing that agent. This is a hypothesis, not validated demand. x402 Doctor already documents overlapping badge, payee, and preflight checks, so Countercheck should be evaluated on the complete transaction-review and recovery workflow rather than a generic identity-check claim.

Proposed validation sequence:

1. Resolve the hackathon's existing-agent eligibility question and identify an eligible agent before presenting this as an extension.
2. Ask a small number of active agent-service developers to connect their own non-production agent through the A2A or MCP interface. Do not request signing keys.
3. Observe setup time, fields that are unclear, mismatch handling, quote freshness failures, and whether the results change an operator's decision. Record consent and distinguish formative feedback from demand evidence.
4. Only if these tasks are useful, develop framework adapters and test with each builder's own signer behind an explicit review boundary.
5. Before any paid pilot, replace process-local quotes/reviews and rate limits with durable shared storage and atomic idempotency, introduce individual authenticated accounts or delegated scopes, establish reconciliation/monitoring/incident procedures, complete an independent security review, and resolve Registry card anchoring.

No external-agent pilot, customer interview, production account, or production payment is currently evidenced.
