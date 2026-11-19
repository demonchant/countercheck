# Specialist reviews — 19 November 2026

Nine specialists completed bounded reviews in addition to the lead during the checkpoint continuation. They did not edit the shared workspace, run tests, inspect `.env`, or trigger payments. Findings were reconciled below.

| Role | Finding and confidence | Counter-evidence / open question |
|---|---|---|
| Rules and eligibility | Official announcement confirms Testnet use, meaningful Concordium component, the 22 Nov project/team/idea checkpoint, required artifacts, final deadline, and four judging considerations. Confidence high on public wording. | Announcement frames the brief as an agent already in use but does not define strict enforcement. Encode programme page is unreadable; exact portal fields/checkpoint status remain unknown. |
| User/ecosystem research | Issue #450 is a concrete developer proposal for checking counterparty legitimacy before paying a new endpoint. Confidence medium that this design concern exists. | One proposal is not incident frequency, direct buyer evidence, or demand. MCP reports focus more on seller-side payment diagnostics. |
| Competitor/complaints | x402-doctor covers generic challenge diagnostics; x402 issue #2332 describes adjacent Mycelium Trails payment/action anchoring; issue #3500 raises delegated scope evidence. | Countercheck's defensible distinction is the combined current Concordium identity/card/wallet facts plus explicit buyer payment policy, not novel identity, payment, diagnosis, or receipt technology. |
| Track-fit/judge evidence | One full local Testnet run now supports the event's end-to-end and agent-payment criteria for the configured case. | No official weights/performance bands; no public deployment, independent explorer inspection during capture, or user-demand evidence. |
| Product strategy/originality | Candidate A remains the strongest available fit: a buyer decision gate combining Registry accountability with exact x402 policy and human-reviewed payment. Confidence medium for event/engineering fit. | The original scorecard predates the paid run and the need remains unvalidated. Do not claim fraud prevention, unique receipts, or broad demand. |
| Architecture/integration | Source and sanitized evidence show Registry/card/wallet checks, exact review, digest approval, buyer signature, facilitator settlement, second gRPC finality read-back, paid response, and local receipt once. | Single buyer/seller/sponsor; local single-process replay store; no production security, multi-user auth, or independent CCDScan API result. Historical Registry update hashes remain unreconciled. |
| AI/model workflow | Optional Ollama interface exposes only read-only MCP verification/quote tools; deterministic code remains authoritative. Keep it optional and do not lead with AI quality. | No model evaluation. `OLLAMA_URL` is configurable, so prompts go to the configured host, loopback by default. |
| Security/access | Loopback local demo has separate buyer/sponsor keys, safe defaults, digest-bound signing, and replay controls. Confidence high by source inspection, not runtime security audit. | Remote buyer proxy does not authenticate each visitor; do not expose a payment-enabled buyer API. Store is local/single-process, receipts are mutable, and multi-user identity is absent. |
| UX/accessibility/demo | Source review shows visible progress/errors, focus styles, labels, responsive layout, and reduced-motion support. The three-minute cut is planned and matches the current proof path. | No fresh browser/accessibility audit or current <=3-minute recording. Workflow steps could use list/progress semantics. During recording, inspect CCDScan independently if possible. |

## Source ledger

- Official event: [Concordium Trusted Agents Hackathon announcement](https://www.concordium.com/article/concordium-trusted-agents-hackathon-encode-club), retrieved 19 Nov 2026; linked [Encode programme page](https://www.encodeclub.com/programmes/concordium-trusted-agents-hackathon) remained unreadable.
- Official platform: [CIS-8004](https://docs.concordium.com/en/mainnet/technical-reference/agent-registry/cis-8004.html), [badge verification](https://docs.concordium.com/en/mainnet/technical-reference/agent-registry/concordium-badge.html), and [Registry MCP](https://docs.concordium.com/en/mainnet/technical-reference/agent-registry/mcp-service.html), retrieved 19 Nov 2026.
- User/problem proposals: [agentic-commerce issue #450](https://github.com/Merit-Systems/awesome-agentic-commerce/issues/450), [x402 issue #2332](https://github.com/x402-foundation/x402/issues/2332), [x402 issue #3500](https://github.com/x402-foundation/x402/issues/3500), and [MCP discussion #2436](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2436), retrieved 19 Nov 2026. These do not measure prevalence.
- Alternatives: [x402-doctor](https://github.com/Fizzl13/x402-doctor), [x402 repository](https://github.com/x402-foundation/x402), [ERC-8004 specification](https://github.com/erc-8004/erc-8004-contracts/blob/master/ERC8004SPEC.md), retrieved 19 Nov 2026.
- Direct project proof: [`../evidence/live-e2e-2026-11-19.json`](../evidence/live-e2e-2026-11-19.json), `OBSERVED`, one configured local Testnet run; explorer not independently inspected.

## Candidate comparison

These are internal planning judgments, not event scores.

| Candidate | Problem and solution brief | Fit and proof | Decision |
|---|---|---|---|
| Buyer-side Countercheck review | An agent buyer wants a paid result from a new provider, but a payment challenge alone may not establish that its payee matches the intended accountable seller and buyer policy. Evidence: one developer proposal; prevalence and adoption unknown. Countercheck checks Registry facts and x402 policy before a bounded purchase. | Strong fit to identity, Registry, and agent-payment criteria; one full configured Testnet path is evidenced. | Selected, keep claims narrow and user validation open. |
| Attribute gate | A service operator wants to verify an attribute without collecting identity documents. | Event-compatible direction, but no concrete service, target user, or supplied pain evidence; weaker use of the existing Registry/x402 work. | Reject for this project. |
| Standalone action receipt | A counterparty wants to connect a paid service result with payment evidence. | Relevant, but adjacent Mycelium Trails work and x402 #3500 weaken standalone differentiation. | Reject as a standalone product; retain local receipt as supporting evidence only. |

The project/team/idea portal entry, existing-agent eligibility interpretation, public repository/revision, current short video, user validation, and submission receipt are not established. The recorded E2E run proves one configured Testnet workflow only.
