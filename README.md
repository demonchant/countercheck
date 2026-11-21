# Countercheck

**Before an agent pays, check the other side.** Countercheck is a buyer-side policy gate for paid agent services on Concordium Testnet. It connects an active CIS-8004 seller badge and Agent Card to the seller's registered wallet, then checks that wallet against the payee and terms in a live x402 request before a person reviews a specific transaction.

> Agent commerce can make a payment request easy to execute while leaving the buyer to connect three separate facts: who the seller is registered as, where the request sends funds, and whether those exact terms fit the buyer's policy. Countercheck puts that review in one flow. This is a concrete technical problem and a product hypothesis; the issue discussions below do not establish its frequency or market demand.

## What Countercheck can do

- Check configured Concordium buyer and seller badges, pinned Agent Card hashes, active status, and registered payment wallets.
- Let an existing A2A client discover the read-only buyer policy and seller offer services, or let a local MCP host call the verification and quote tools.
- Compare the live x402 request with a fixed Testnet policy for native CCD, configured recipient and sponsor, exact amount, and expiry.
- Prepare the exact unsigned transaction for review, require a person's approval of its signing digest, and repeat identity and payment checks before signing.
- Record a transaction intent before dispatch, independently verify finalized transaction details after settlement, check the paid resource response, and write a hash-linked local receipt.
- Offer an optional local Ollama assistant for read-only explanations and checks; deterministic code retains control of identity, policy, and payment authorization.

The [agent integration guide](docs/agent-integration.md) shows the A2A and MCP connection paths. The reproducible A2A tour is `npm run demo:a2a`. The latest combined automated run passed 136 Node tests and 6 browser tests; the test results use local fixtures where documented in [verification evidence](docs/test-evidence.md).

## The problem and the product

An agent buyer finds a paid data or API service. The service returns a valid HTTP 402 payment challenge, with a network, token, amount, recipient and expiry. A successful transfer proves that value moved. By itself, it does not show that the recipient is the registered wallet of the seller the buyer intended, that the charge fits the buyer's ceiling, or what resource the seller returned after settlement.

Countercheck makes those checks before signing:

1. It checks the active Concordium Testnet seller badge, the registered Agent Card hash and the wallet declared by that card. It rejects a badge other than the configured seller.
2. It fetches the seller's live x402 v2 challenge and enforces this prototype's policy: Concordium Testnet, native CCD, the configured seller wallet and sponsor, an unexpired exact 1 CCD request, within a hard-coded maximum of 1 CCD.
3. It reads fresh chain state and displays the unsigned transaction, sender, recipient, fee payer, nonce, expiry, estimated fee and signing digest.
4. A person approves that digest. Countercheck repeats the seller, buyer, challenge and chain checks before signing. Changed terms require a new review.
5. A separate action signs and submits the transfer through the configured facilitator. The seller returns the resource only after settlement, and the buyer checks finality and transaction details before recording a local hash-linked receipt.

The built-in optional Ollama adapter can request read-only checks. Deterministic code makes all identity, policy and authorization decisions; the model cannot approve, sign or pay. No model-quality evaluation is claimed.

### What is already available

The [x402 Doctor project](https://github.com/Fizzl13/x402-doctor) already offers x402 preflight and Concordium badge/card/payee checks. Countercheck does not claim to invent or uniquely provide those checks. Its current evidence-backed distinction is an end-to-end, narrowly configured native-CCD Testnet purchase path: fresh transaction construction, explicit digest-bound human approval, facilitator settlement/finality verification, paid fulfillment and a local receipt. This comparison was refreshed against the competitor's public documentation on 20 November 2026 and should be checked again before submission.

## Hackathon requirement map

The official [Concordium Trusted Agents Hackathon announcement](https://www.concordium.com/article/concordium-trusted-agents-hackathon-encode-club) requires a Testnet project with meaningful use of at least one Concordium component. It asks for a description, public repository, demo video up to three minutes, CCDExplorer link and a short go-live plan. Its published judging considerations cover Concordium identity/Registry/agent payments, a believable path to mainnet and users, an end-to-end core flow, and solving a real problem. The announcement publishes no numeric weights or fixed tracks. The linked Encode programme page did not provide readable exact portal terms in this review; confirm any eligibility interpretation and portal fields with the organizer.

| Hackathon item | How Countercheck addresses it | Evidence and status |
|---|---|---|
| Start from an agent the builder already runs | For this demonstration, we built both a buyer agent and a seller agent because we did not have an established agent available to extend. | **Eligibility fit needs organizer confirmation.** The demo shows the complete buyer/seller payment flow, but it does not plug into a separately established production agent. The event's official announcement describes an existing-agent starting point; the unreadable programme page leaves the enforcement details unknown. |
| Show an accountable human behind the agent | Concordium's badge ties the agent record to an account connected to an identity-verified holder; Countercheck checks the active record, card hash and wallet relation. | **Shown for configured Testnet badges.** The holder's personal identity is not disclosed to the buyer, and the badge is not an endorsement. |
| Agent payment and paid service | The buyer service prepares/signs the payment only after a person's explicit digest approval; the seller returns its resource after facilitator settlement. | **One configured Testnet run.** This is deliberately human-approved, not autonomous spending. The sponsor pays network fees; the buyer still pays the 1 CCD service price. |
| Keep a record of agent activity | The buyer writes a hash-linked local receipt with the transaction and paid response references. | **One run.** The receipt is local and privileged users can rewrite it; no public immutable audit trail is claimed. |
| Concordium Testnet plus meaningful Concordium component | Reads CIS-8004 Registry badge/card/wallet facts and uses the Concordium Testnet x402 payment flow with a sponsored native CCD transfer. | **Demonstrated once locally on Testnet.** See the [sanitized run record](evidence/live-e2e-2026-11-19.json) and [transaction](https://testnet.ccdscan.io/?d=transaction&dsh=71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147). The explorer was not independently inspected during that run. |
| Project description | Problem, mechanism, boundaries and user hypothesis are described above. | **Included in this repository.** The problem is not presented as validated market demand. |
| Public repository | Source is hosted at [github.com/demonchant/countercheck](https://github.com/demonchant/countercheck). | **Public URL identified.** Confirm the exact revision is pushed before submitting. |
| CCDExplorer link | The Testnet transaction link is provided above and in the evidence record. | **Transaction reference recorded.** Independent explorer-page inspection remains outstanding. |
| Short go-live plan | Continue Testnet validation with dedicated accounts and individual signing; add key protection, rate limits, abuse controls, durable settlement and recovery; run a security review and a small buyer pilot before considering mainnet. | **Proposed plan.** No mainnet deployment, security audit or user pilot is claimed. |
| Depth of Concordium identity, Registry and payments | The flow checks buyer and seller badge/account wallet relations, seller card integrity, exact x402 terms, sponsored settlement and paid fulfillment. | **One configured end-to-end Testnet run.** This is not a reliability or production claim; a badge is not an endorsement. |
| End-to-end core flow | Verify → interrogate request → review/approve exact digest → settle → check finality → receive paid response → write local receipt. | **One run captured** in the evidence record. Automated tests separately cover deterministic policy and UI states. |
| Real problem | Gives the buyer a reviewable link between registered seller, payment recipient, buyer policy and returned resource. | **Technical need; demand unvalidated.** No buyer interviews, frequency data, adoption or willingness-to-pay evidence is claimed. |

The published judging considerations are covered above: Concordium identity/Registry/payment depth is demonstrated in one configured Testnet run; the end-to-end path is recorded once; a route to real users and mainnet is planned but not deployed; and the problem remains a hypothesis without buyer interviews. The announcement gives no numeric weights or fixed tracks. Its existing-agent framing is clear, but the linked programme terms were not readable enough to establish how eligibility is enforced. Confirm that with Encode before submission.

## Demo and hosted application

- **Live buyer app:** [countercheck-six.vercel.app](https://countercheck-six.vercel.app/)
- Buyer API status: [Vercel `/api/status`](https://countercheck-six.vercel.app/api/status)
- Render buyer API health: [buyer `/healthz`](https://countercheck-1-lecq.onrender.com/healthz)
- Seller resource: [seller `/resource`](https://countercheck-seller-1146.onrender.com/resource) (HTTP 402 with an x402 challenge is expected before payment)
- Testnet transaction: [CCDScan](https://testnet.ccdscan.io/?d=transaction&dsh=71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147)

The hosted app is a **read-only demo by default**. Its guest cookie scopes quote, approval and receipt state to a browser session; it does not identify a person or prevent another guest session. A hosted purchase uses the one Render-configured buyer account. If the public-purchase gate is enabled, any visitor can request a payment after reviewing and approving the digest. The 1 CCD limit applies to each transaction, not to cumulative spending. Do not enable public purchases unless that shared-account exposure is intended and funded balances and abuse controls have been reviewed.

### Full hosted buyer + seller + private facilitator setup

The read-only Vercel/Render setup does not need a private facilitator. To run the hosted paid path, provision three Render services (public seller web service, buyer API web service and **private** facilitator service), then configure Vercel. A facilitator address is a Testnet account address; the private facilitator is a service endpoint, not a separate address.

Use low-balance dedicated Testnet accounts. The buyer pays the 1 CCD service price; the facilitator sponsor pays network fees. Keep every private key and shared API token in the host's secret-variable store. Never add secrets to Vercel browser-prefixed variables, source files, screenshots or Git. The checked-in [`render.yaml`](render.yaml) is a blueprint starting point; it includes a billable private service and disables automatic Render deploys. Review all three services and current provider pricing before applying it.

**Seller Render web service** (`npm run seller`):

| Variable | Required value/purpose |
|---|---|
| `SELLER_RESOURCE_ENABLED` | `true` |
| `SELLER_CHALLENGE_ONLY` | `false` for paid fulfillment; `true` deliberately refuses settlement. |
| `FACILITATOR_SETTLEMENT_ENABLED` | `true` only for the paid seller path. |
| `CONCORDIUM_NETWORK` | `ccd:4221332d34e1694168c2a0c0b3fd0f27` (Testnet) |
| `SELLER_PAY_TO` | Seller's Concordium Testnet account address. |
| `CCD_FACILITATOR_ADDRESS` | Sponsor account address; must match facilitator and buyer configuration. |
| `FACILITATOR_URL` | Render private-network host and port for the facilitator, not a public `onrender.com` URL. |
| `FACILITATOR_API_TOKEN` | Same random secret as the facilitator token; at least 32 characters. |

Allow Render to derive the public seller `/resource` URL from its assigned HTTPS origin, or set `SELLER_RESOURCE_PUBLIC_URL` to that exact HTTPS URL. Do not paste a local address into the buyer's hosted configuration.

**Buyer API Render web service** (`npm start`):

| Variable | Required value/purpose |
|---|---|
| `BUYER_API_SERVICE` | `true`; requires a private `BUYER_API_TOKEN` of at least 32 characters. |
| `HOST` | `0.0.0.0` on Render. |
| `BUYER_API_TOKEN` | Private proxy credential; must equal the Vercel server-side token. |
| `PAYMENTS_ENABLED` | `true` only when you intend to permit transaction review and payments. |
| `FACILITATOR_SETTLEMENT_ENABLED` | `true` only when buyer-side settlement is intended. |
| `BUYER_BADGE`, `CCD_ACCOUNT_ADDRESS`, `CCD_PRIVATE_KEY` | Buyer badge, matching Testnet wallet and server-side buyer signing key. |
| `SELLER_BADGE`, `SELLER_PAY_TO` | Seller badge and the same Testnet wallet registered in its Agent Card. |
| `SELLER_RESOURCE_URL` | Public HTTPS seller origin; Render resolves it to `/resource`. |
| `CCD_FACILITATOR_ADDRESS`, `MAX_SPEND_MICROCCD` | Sponsor address and `1000000` (1 CCD maximum). |
| `SELLER_ASSET`, `CONCORDIUM_NETWORK` | `CCD` and the Testnet ID above. |
| `AUDIT_LOG_PATH` | Durable path on the buyer's persistent disk, outside public files. |

The buyer and seller badge wallets must match their configured wallet addresses. The buyer's private key must satisfy the account's current on-chain signer policy; do not assume a key is valid without the transaction-review preflight.

**Private facilitator Render service** (`npm run facilitator`):

| Variable | Required value/purpose |
|---|---|
| Service type and network | Private service, reachable only on Render's private network. Attach persistent disk. |
| `FACILITATOR_PRIVATE_SERVICE` | `true`. |
| `FACILITATOR_HOST`, `FACILITATOR_PORT` | `0.0.0.0` and `4180`. |
| `FACILITATOR_SETTLEMENT_ENABLED` | `true` only when ready to sponsor Testnet transactions. |
| `FACILITATOR_STORE_PATH` | Persistent disk path, e.g. `/var/data/facilitator-settlements`. |
| `FACILITATOR_API_TOKEN` | Random secret matching the seller token. |
| `CCD_ACCOUNT_ADDRESS`, `SELLER_PAY_TO`, `CCD_FACILITATOR_ADDRESS` | Buyer, seller and sponsor account addresses used by the flow. |
| `CCD_FACILITATOR_PRIVATE_KEY` | Dedicated Testnet sponsor signing key, held only in Render secrets. |
| `CONCORDIUM_NETWORK`, `FACILITATOR_MAX_AMOUNT_MICROCCD` | Testnet ID above and `1000000` maximum. |
| `FACILITATOR_MIN_SPONSOR_BALANCE_MICROCCD` | Operator reserve threshold; chain submission still decides fee sufficiency. |

**Vercel Production project** (server-side variables):

| Variable | Value |
|---|---|
| `COUNTERCHECK_API_ORIGIN` | Buyer API origin only: `https://countercheck-1-lecq.onrender.com` (no path). Do not use the seller or facilitator URL. |
| `COUNTERCHECK_API_TOKEN` | Same private value as Render `BUYER_API_TOKEN`. |
| `COUNTERCHECK_API_PROXY_ENABLED` | `true`. |
| `COUNTERCHECK_PUBLIC_PURCHASES_ENABLED` | Keep `false` for read-only; set `true` only when intentionally opening the shared Testnet buyer to anonymous visitors. |

After changing environment variables, redeploy the applicable service so it reads them. Enable the gates in order: first verify the private facilitator and seller challenge in challenge-only mode; then configure buyer and seller credentials; only after a reviewed, funded preflight, enable settlement/payment at facilitator, seller and buyer; enable the Vercel public switch last. A Git push alone does not update Render when `autoDeployTrigger` is off. These instructions do not mean the hosted purchase path is currently enabled or verified. For Vercel-only/read-only configuration see [the focused proxy guide](docs/vercel-configuration.md); for operations and recovery see [deployment guide](docs/deployment.md).

## Run locally

Requirements: Node.js 20+, PowerShell on Windows, and a private `.env` based on [`.env.example`](.env.example). Do not commit `.env` or paste secrets into chat. The following commands install locked dependencies and start a **read-only/review-only** local server:

```powershell
npm ci
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\start-safe-demo.ps1
```

Open <http://127.0.0.1:4173>. For the complete local Testnet purchase, configure separate buyer, seller and sponsor Testnet accounts, badges, wallets, seller resource, facilitator and secret keys in `.env`, then explicitly start settlement mode:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\start-testnet-demo.ps1 -EnableTestnetSettlement
```

Startup performs preflight and does not pay. The explicit **Sign, pay 1 CCD, and get resource** action submits one payment after review. Stop using:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\stop-testnet-demo.ps1
```

For variable definitions, account boundaries and recovery steps see [local deployment and operations](docs/deployment.md). Never run with mainnet keys; this build rejects non-Testnet configuration.

## Verification and test evidence

| Check | What it covers | Result |
|---|---|---|
| `npm test` | Node.js deterministic unit/integration tests: policy rejection cases, digest-bound review, facilitator core/store behavior, auth/proxy/session behavior, seller challenge/fulfillment, Agent Card, A2A/MCP boundaries. | 107 passed, 0 failed in the recorded run. No live payment was sent by this command. |
| `npm run test:browser` | Chromium browser tests for the current UI, fail-closed Registry outage and seller-mismatch states, mocked read-only 1 CCD quote, no payment call, local-origin rejection. | 5 passed, 0 failed after updating stale selectors to the current page. API/Registry/quote responses in these browser cases are fixtures, not live-service checks. |
| Local Testnet E2E | One configured buyer/seller/sponsor flow through digest approval, sponsored settlement, finality read-back and paid resource. | One run, recorded in [sanitized evidence](evidence/live-e2e-2026-11-19.json); not repeated by the automated suites. |

The optional assistant has no quality benchmark. No production load test, security audit, multi-user testnet payment test, or mainnet test is claimed.

## Boundaries and evidence

- This prototype supports Concordium Testnet, native CCD and one exact 1 CCD payment per transaction. The limit is not cumulative.
- The facilitator sponsor pays network fees. The buyer pays the 1 CCD service amount.
- Registry checks bind registered account, active badge, Agent Card hash and declared wallet for the captured check. They do not establish honesty, quality, legal compliance or future wallet control.
- The local receipt is hash-linked but can be changed by a privileged filesystem actor; it is not immutable or externally anchored.
- Public guest sessions scope hosted transaction state but do not identify people. Public hosted payments are deliberately gated and would share one buyer account among visitors.
- The product need is a hypothesis supported by individual developer discussions, not by buyer research. No interviews, customer telemetry, pilot, adoption or willingness-to-pay data are claimed.
- One successful Testnet run is not production readiness or a reliability guarantee. Independent inspection of the transaction in CCDScan remains outstanding.

## Project guides

- [Architecture and data flow](docs/architecture.md)
- [Deployment and local operations](docs/deployment.md)
- [Vercel proxy setup](docs/vercel-configuration.md)
- [Facilitator behavior and threat boundaries](docs/facilitator.md)
- [A2A/MCP integration with an existing agent](docs/agent-integration.md)
- The go-live plan is summarized in the hackathon requirement map above.
- [Sanitized Testnet evidence index](evidence/README.md)
- [Click-by-click demo script](DEMO_SCRIPT.md) · [recording checklist](DEMO_CHECKLIST.md)

## Credits

Motion/editing workflow reference: [gitethanwoo/video-editing](https://github.com/gitethanwoo/video-editing), MIT license. No external code from that skill is shipped as a runtime dependency.
