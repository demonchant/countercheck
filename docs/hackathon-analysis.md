# Hackathon analysis

**Event:** Concordium Trusted Agents Hackathon with Encode Club  
**Retrieved:** 11 November 2026; official-source and live-demo refresh 19 November 2026  
**Project:** Countercheck — buyer-side verification and payment policy for agent commerce.

**Current demo state (19 Nov):** a full configured local Testnet workflow completed once: mismatch rejection, live Registry/card/wallet checks, exact 1 CCD quote, transaction review and digest approval, buyer signature, sponsored settlement, second gRPC finality read-back, paid seller response and local hash-linked receipt. See [live demo readiness](live-demo-readiness-2026-11-19.md) and [captured evidence](../evidence/live-e2e-2026-11-19.json). This does not establish production readiness, general reliability, market demand, or independent explorer inspection. The safe review-only launcher remains available. Nine specialist reviews plus lead reconciliation are recorded in [specialist reviews](specialist-reviews-2026-11-19.md).

## Official rules and dates

The official [Concordium announcement](https://www.concordium.com/article/concordium-trusted-agents-hackathon-encode-club), reviewed 19 November 2026, describes a free, online, solo-or-team six-week event. It frames the brief as bringing an agent the builder already runs; strict enforcement is not defined in the announcement, and the linked Encode programme page was unreadable. The public requirement is that the project run on Concordium Testnet and meaningfully use at least one Concordium component. The project/team/idea checkpoint is 22 November; exact portal fields and completion status are unknown. Suggested directions are starting points, not fixed tracks.

| Date (UTC) | Event item |
|---|---|
| 2 November 2026 | Programme/workshops begin |
| 19 November 2026 | Build window opens |
| 22 November 2026 | Checkpoint: project, team, idea |
| 9 December 2026, 23:59 | Final submission deadline |
| 10–11 December 2026 | Judging |

Submissions require a description, public code repository, video up to three minutes, CCDExplorer link, and a short mainnet/real-user production plan. The Encode page was not readable enough to verify application details or exact form fields. These remain unknown.

## User problem hypothesis

An agent operator or buyer wants to purchase a service from a newly encountered agent. A payment protocol can settle a payment, but that alone does not prove which seller identity the buyer intended, what the paid service returned, or whether the action stayed within a user-approved cap. An ecosystem issue proposes a payee-verification gate before first payment; another issue proposes linking post-settlement action evidence to payment evidence. These are individual proposals, not prevalence or market-size evidence. See [ecosystem research](ecosystem-research.md).

**Problem:** An agent buyer is trying to obtain a paid API/data result from a newly encountered provider, but payment settlement by itself does not verify the accountable seller identity or the service action/result; the buyer may have insufficient evidence to review the transaction later. Evidence: [x402 Foundation issue #2332](https://github.com/x402-foundation/x402/issues/2332), opened 15 May 2026, and [agentic-commerce issue #450](https://github.com/Merit-Systems/awesome-agentic-commerce/issues/450), opened 14 July 2026. Assumptions: the issue authors represent a recurring job, that buyers need this in practice, and that they would adopt/pay for this workflow.

**Solution:** Countercheck checks buyer/seller Concordium badges and card hashes, matches registered wallets to the payment sender/recipient, applies a fixed x402 spend policy, and supports digest-bound human approval, sponsored settlement, paid fulfillment, and a local hash-linked receipt. The full path is evidenced once on Testnet in `evidence/live-e2e-2026-11-19.json`. A badge/receipt does not prove seller quality, correctness, or legal compliance; local records are not immutable or externally anchored.

## Candidate concepts and selection

### A. Countercheck — accountable paid-service gate (selected for a bounded build)

**Problem:** A buyer agent receiving a 402 challenge has a URL/pay-to address, but the protocol's payment itself does not tell it whether that payee matches the intended accountable seller. Individual ecosystem reports describe both pre-payment counterparty checks and post-payment action evidence; prevalence is unknown.

**Solution:** Check buyer/seller badge/card/payment-wallet facts, enforce a configured recipient/asset/network/amount cap, prepare and display the exact transaction, record digest-bound approval after rechecks, settle through the configured facilitator, and retain a local receipt after paid fulfillment. One completed Testnet run proves this configured path. An optional local assistant can request read-only checks, while deterministic code remains authoritative. **AI IN PRODUCT: YES, optional local assistant; evaluation pending.**

**AI IN PRODUCT: YES, optional local assistant in the current build.** The user outcome depends on deterministic status, card-hash, payee, network, amount, expiry, and transaction checks; the assistant is limited to read-only explanations/requests and has no documented quality evaluation. It is not needed for authoritative decisions. Whether the full event terms require an existing agent/framework remains unknown.

### B. Privacy-preserving attribute gate

**Problem:** A service operator wants to restrict access based on an attribute such as age without storing identity documents. Concordium's ID/Verify & Access stack is a plausible way to prove an attribute privately, but no specific affected service, user complaint, or desired attribute policy was supplied.

**Solution:** The user proves an eligible predicate and the service receives only a valid/invalid result. Proof could be a testnet Verify & Access flow. This directly matches a suggested direction but does not naturally exercise the Agent Registry and x402, and it needs an actual service context to establish value. **AI IN PRODUCT: NO.** Rejected for this build due weaker evidence and less integrated agent-commerce path.

### C. Payment-linked action record

**Problem:** A counterparty or auditor may need evidence connecting a settled payment to the action/result delivered, beyond a transaction hash. One x402 issue explicitly raises action scope and post-settlement record integrity; user demand is unknown.

**Solution:** Create a locally hash-chained receipt tying request/action digest, response digest, policy result, and transaction reference together, then permit independent audit. It can be demonstrated with a real paid response and transaction. This has clear evidence semantics but risks becoming a generic log and overclaiming EU AI Act support. **AI IN PRODUCT: NO.** Retained as the differentiating receipt mechanism inside Candidate A rather than a standalone ledger.

## Candidate gate (internal, not an event score)

The playbook's 10 dimensions are scored 1–5. Scores below 3 need mitigation; rubric fit, hardest-promise feasibility, and evidence/reviewer path each need at least 4/5 and mandatory floors must pass. Scores reflect evidence available on 11 November, before the build window.

| Candidate | User pain | Rubric fit | Mechanism | Hardest promise | Sponsor load-bearing | API access | Evidence | Failure handling | Judge path | Scope | Total | Decision |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| A. Countercheck gate + linked receipt | 3 | 5 | 4 | 4 | 5 | 3 | 4 | 4 | 4 | 3 | 39/50 | **GO for bounded Testnet demo; user value remains unvalidated** |
| B. Attribute gate | 2 | 4 | 3 | 3 | 4 | 2 | 3 | 4 | 3 | 3 | 31/50 | Reject for this build |
| C. Standalone action record | 3 | 3 | 3 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 36/50 | Reject as standalone; preserve as submechanism |

The candidate score is an internal reassessment after the 19 November Testnet run; it is not an event score. The user-pain score remains 3 because direct buyer validation is absent. The 12 November Registry capture is historical and has null card URIs. README-reported Registry update transaction hashes still lack finalized receipts; fresh 17 and 19 November reads verify current badges, card hashes and registered wallets, and the 19 November E2E run establishes one configured payment path. This does not reconcile the historical update transaction hashes.

## Rubric fit and hardest promise

The event publishes no track weights. See the exact wording and criterion-to-proof map in [rubric-matrix.md](rubric-matrix.md). Candidate A was preferred because Registry accountability and x402 payment terms form one buyer workflow. Removing the Registry removes the seller/card-integrity gate; removing x402 removes the paid-service terms and settlement path. The remaining uncertainty is whether target buyers value this combined control.

**Hardest promise:** refuse a mismatched seller or out-of-policy x402 request, then complete a human-reviewed sponsored Testnet purchase and fulfill only after finality. This was demonstrated once in the configured 19 November run, with second gRPC read-back and a local receipt. It is verified for that run, not a reliability or production claim. Independent CCDExplorer inspection remains outstanding.

**Abnormal case:** registry timeout, revoked badge, invalid card hash, payee mismatch, expired quote, price above cap, duplicate purchase request, facilitator failure, ambiguous settlement, and response timeout all remain non-success states. After an ambiguous transaction submission, block a second attempt until receipt reconciliation.

## Product AI Gate

`AI IN PRODUCT: YES` — optional local Ollama assistant. `src/local-agent.mjs` uses only read-only MCP tools (`verify_counterparties`, `request_purchase_quote`) and has no signing/payment capability. Deterministic checks remain authoritative; no model-quality evaluation has been performed. The announcement frames the programme around an agent builders already run, but the unreadable Encode terms leave strict eligibility and any named framework requirement unknown. Do not infer portal eligibility from the local assistant.

## Milestones and pivot

1. Before the 22 November checkpoint, confirm strict existing-agent eligibility and exact portal fields; enter the project/team/idea and preserve the portal confirmation. No entry is established here.
2. Rehearse the configured full Testnet path using the dedicated demo accounts; use the safe launcher when a payment is not intended.
3. Independently inspect the recorded transaction in CCDExplorer and capture that inspection in the current demo if available.
4. Validate the buyer problem with target agent operators if available; do not convert issue reports into demand claims.
5. Publish a reviewed public repository, record a current under-three-minute demo, and submit the required artifacts before 9 December. None is established as complete here.

**Pivot:** if the buyer-side badge/payee gate is not valued by target operators, narrow or reject the product rather than overstate issue reports as demand. If the Encode terms require a pre-existing operational agent the team cannot evidence, confirm eligibility before spending the remaining event time.

## Research and build team

Nine specialists plus lead completed bounded reviews in the mandated roles (rules, user/ecosystem, competitor/complaints, rubric/evidence, strategy, architecture/integration, AI gate, security/identity, UX/demo). The reviews were reconciled: they agree on the workflow's event fit and badge/payment authority boundaries; dissent/open limits are preserved in the research, integration, and assumptions records. The cross-review emphasized that sponsorship pays network fees, not the service price; a badge check is not payment authorization; and a CIS-8 binding needs current-state checks. No specialists edited project files.

