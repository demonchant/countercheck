# Agent Card and service endpoint audit

**Updated:** 12 November 2026. **Network:** Concordium Testnet only.

References: [CIS-8004](https://docs.concordium.com/en/mainnet/technical-reference/agent-registry/cis-8004.html), [Concordium combined Agent Card guidance](https://docs.concordium.com/en/mainnet/technical-reference/agent-registry/agent-card.html), [Concordium badge extension](https://docs.concordium.com/en/mainnet/technical-reference/agent-registry/concordium-badge.html), and [A2A v1.0 Agent Card](https://a2a-protocol.org/v1.0.0/specification/).

## URL roles

- CIS-8004 `agent_uri` serves the Agent Card JSON. The anchored `metadata_hash` is SHA-256 of the exact response bytes.
- A2A v1 `supportedInterfaces[].url` is the callable A2A endpoint. A JSON file URL is not an A2A endpoint; A2A v1 does not use the legacy top-level `url` field.
- Concordium's combined card also uses top-level `services[]` for named callable endpoints. The seller's x402 resource is a separate service from its A2A interface.

## Implemented interfaces

The local source now uses the official JavaScript A2A SDK (`@a2a-js/sdk` 1.0.0) and exposes two JSON-RPC v1 interfaces on the dedicated seller process:

| Agent | Candidate A2A endpoint | Supported read-only operations |
|---|---|---|
| Buyer #1147 | `https://countercheck-zid6.onrender.com/a2a/buyer/v1` | `verify_counterparties` calls the real Registry checks; `request_purchase_quote` runs the buyer's live x402 validator. Neither operation signs or submits. |
| Seller #1146 | `https://countercheck-zid6.onrender.com/a2a/seller/v1` | `get_x402_offer` fetches the actual seller `/resource` and validates the response. It does not accept payment or claim fulfillment. |

The A2A handlers accept only their named commands, limit request bodies to 32 KB, reject protocol versions other than 1.0, and apply an in-memory rate limit. They do not load or expose buyer or sponsor private keys. Local in-process checks returned A2A HTTP 200 for both paths; the buyer reported `blocked` because the live Registry still has `agent_uri=null` for both tokens. These local checks do not prove public reachability.

The seller resource is implemented by the x402 Concordium SDK and has a challenge-only mode. A fresh local request returned HTTP 402 with x402 v2 exact, Concordium Testnet, native CCD, 1,000,000 microCCD, the configured seller and sponsor addresses, and a 60-second timeout. The same run reported `paidFulfillmentAvailable=false`. Render has not yet deployed this code. The last direct public request returned HTTP 502; Render logs show the remote commit lacks `src/seller-resource.mjs` and uses the buyer app's `npm run start`, which binds to loopback rather than Render's public port. Current local x402 development uses port 4191 because Node's Fetch API rejects port 4190 as a forbidden port.

## Card contents and status

The local cards now declare their actual A2A JSON-RPC endpoints in `supportedInterfaces[]` and named services in `services[]`. Neither card advertises the card JSON as a service endpoint. The seller lists the separate `/resource` endpoint. `x402Support` remains `false` and both cards set `active=false` until a public service check passes and paid fulfillment is available. Descriptions explicitly state that a 402 challenge does not mean payment has settled.

The supplied host is a user-provided Render URL. Its TLS endpoint was reachable, but `/resource` returned 502 `no-deploy`; therefore public service URL/hash checks have not passed. Do not treat these local card bytes as final Registry metadata yet. After Render serves the actual service, test `/resource` and both A2A endpoints externally, update `active` accurately, publish the final card files, fetch their exact commit-pinned raw GitHub responses, compare bytes and hash them, and then rebuild the Registry previews.

No Registry update or payment has been signed or submitted. Payment signing and facilitator settlement remain disabled.
