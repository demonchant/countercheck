# Rubric and claim-to-proof map

**Official source:** [Concordium Trusted Agents Hackathon announcement](https://www.concordium.com/article/concordium-trusted-agents-hackathon-encode-club), reviewed 19 November 2026. It publishes no numeric weights, subweights, bonus points, or performance bands; none are invented here. The linked [Encode programme page](https://www.encodeclub.com/programmes/concordium-trusted-agents-hackathon) did not return readable programme terms in this review.

The announcement frames the brief as bringing an agent a builder already runs. It does not define whether that is a strict eligibility rule. Confirm this, the exact portal fields, and checkpoint consequences with Encode before relying on an interpretation. The public announcement does confirm the checkpoint date and the other requirements below.

## Eligibility and submission requirements

| Official requirement | Implementation/proof path | Current status / gap |
|---|---|---|
| Project runs on Concordium Testnet and meaningfully uses at least one Concordium component. | CIS-8004 Registry/card/wallet checks and sponsored x402 transfer on Testnet. | `VERIFIED` for one configured local Testnet run, recorded in [`evidence/live-e2e-2026-11-19.json`](../evidence/live-e2e-2026-11-19.json). This does not prove broader reliability or production readiness. |
| Checkpoint 1: project, team and idea, 22 November 2026. | Enter the project/team/idea in the official Encode portal. | `UNKNOWN`: portal status and exact fields were not supplied or checked. Confirm and complete before the checkpoint; no entry is claimed. |
| Description, public repository, demo video up to 3 minutes, CCDExplorer link, and short plan for going live. | README, public source, current demo recording, transaction link, production path. | `PARTIAL`: local description, plan, script, and explorer link exist. Public repository/revision, current <=3-minute recording, portal submission, and receipt are not established. The explorer was not inspected during the recorded run. |
| Final deadline: 9 December 2026 at 23:59 UTC. | Submit through the official programme portal. | `PLANNED`: no submission performed or receipt recorded. |

## Published judging considerations

| Exact public wording | Observable intent | Evidence and shortest judge path | Status | Remaining gap |
|---|---|---|---|---|
| “how deeply a project uses Concordium identity, the Agent Registry and agent payments” | Check registered human accountability/card/wallet facts, enforce buyer policy, and demonstrate sponsored payment. | Show mismatch rejection; load the configured seller; inspect live Registry/card/wallet and exact 1 CCD quote; review and approve the exact digest; pay once; show paid response, receipt and transaction link. See live E2E evidence. | `VERIFIED` for one Testnet run | One configured buyer/seller/sponsor; no separate explorer inspection; historical `setAgentURI` transaction receipts remain unreconciled. |
| “whether it has a believable route to mainnet and real users” | Present operational, key-management, security and user-validation steps. | [`docs/demo-and-pitch.md`](demo-and-pitch.md), [`docs/deployment.md`](deployment.md), [`docs/remote-deployment-readiness.md`](remote-deployment-readiness.md). | `PARTIAL` | No public deployment, buyer interviews, pilot, production signer, security audit, or mainnet evidence. |
| “whether the core flow works end to end” | Verify seller → inspect quote → apply policy → review/approve → sign/pay → confirm finality → fulfill and retain evidence. | `evidence/live-e2e-2026-11-19.json` records all of these once, including a second Testnet gRPC read-back and `paid: true` seller response. | `VERIFIED` for one configured Testnet run | Does not establish general reliability, independent explorer inspection, or production behavior. |
| “whether it solves a real problem” | Help an agent operator review a counterparty and payment terms before a bounded service purchase. | Individual developer proposals in [`docs/ecosystem-research.md`](ecosystem-research.md); no direct buyer research. | `INFERRED` | No buyer interviews, incident/frequency data, adoption, or willingness-to-pay evidence. |

## Claim-to-proof ledger

| Product claim | Required behavior | Evidence route | Status / limit |
|---|---|---|---|
| Checks the seller's current badge, card hash and registered wallet. | Live active-state, card-hash and wallet reads. | `src/registry.mjs`; [`evidence/live-e2e-2026-11-19.json`](../evidence/live-e2e-2026-11-19.json). | `VERIFIED` for the captured run only. Registration is not conduct, quality, or endorsement. |
| Checks registered payee against the live x402 challenge. | Registry wallet matches configured recipient and challenge `payTo`; exact amount/network/asset/sponsor/expiry policy passes. | `src/payment.mjs`; live E2E evidence. | `VERIFIED` for the captured 1 CCD quote only. |
| Displays and signs only the reviewed transaction digest. | Prepare exact transaction; fresh checks; bind approval; sign the same digest. | `src/payment.mjs`, `src/payment-transaction.mjs`, `public/app.js`; live E2E evidence. | `VERIFIED` for one configured run. The broader rejection matrix has not been independently exercised here. |
| Facilitator settles and confirms payment before seller fulfillment. | Authenticated settlement, replay guard, finalization, second Testnet read-back and paid resource response. | `src/facilitator-core.mjs`; live E2E evidence with hash `71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147`. | `VERIFIED` for one configured run; single-process local facilitator only. |
| Keeps a payment/action receipt. | Persist a local hash-linked record with transaction reference and response digest. | `src/audit.mjs`; receipt record in live E2E evidence. | `VERIFIED` for the local record in that run. It is not immutable or externally anchored. |
| Optional assistant supports read-only checks. | Local model can call only `verify_counterparties` and `request_purchase_quote`; deterministic results remain authoritative. | `src/local-agent.mjs`, `src/mcp-server.mjs`. | `IMPLEMENTED / UNVERIFIED` as an AI-quality claim; no representative evaluation. Prompts go to the configured Ollama host, loopback by default. |

## Product AI gate

**AI IN PRODUCT: YES — optional local Ollama adapter.** It can explain results and request two read-only MCP checks. It cannot authorize, sign, or pay. The deterministic UI/MCP path works without Ollama and remains authoritative. No quality evaluation has been run; do not claim model accuracy. The current Ollama URL is configurable, so prompts go to the configured host, not necessarily to the same laptop.

Before making an assistant-quality claim, compare outputs with deterministic `/verify` and `/quote` outcomes on labeled verified, blocked, mismatch, over-cap/unsupported, and unavailable cases. Require zero upgrades of blocked/unavailable results and zero claims of payment or settlement unsupported by tool output.
