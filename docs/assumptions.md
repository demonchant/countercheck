# Assumptions and open questions

**Reviewed:** 19 November 2026

## Current live-demo evidence

- The 19 November Testnet run rejected a mismatched seller, verified the configured seller badge/card/wallet, accepted an exact 1 CCD quote, prepared and approved the exact transaction digest, signed and settled through the local facilitator, confirmed finality/details with a second gRPC read, received `paid: true`, and wrote a local hash-linked receipt. See [`evidence/live-e2e-2026-11-19.json`](../evidence/live-e2e-2026-11-19.json).
- The explorer URL is available, but the explorer was not independently inspected during that capture. This is one configured run, not production readiness, general reliability, or demand evidence.
- The safe demo launcher remains review-only: it starts the buyer app and challenge-only seller on loopback, forces payment/settlement off, blanks signing keys/tokens in child processes, and checks an actual local HTTP 402 response.

## Event and eligibility

- The official [Concordium announcement](https://www.concordium.com/article/concordium-trusted-agents-hackathon-encode-club), reviewed 19 November, requires a Concordium Testnet project with meaningful use of at least one Concordium component. It requests a description, public repository, video up to three minutes, CCDExplorer link, and short go-live plan; final deadline is 9 December 2026 at 23:59 UTC. It sets the project/team/idea checkpoint for 22 November.
- The announcement frames the programme around bringing an agent builders already run. The linked [Encode programme page](https://www.encodeclub.com/programmes/concordium-trusted-agents-hackathon) was not readable. Whether pre-existing-agent use is strictly enforced, the exact portal fields, and consequences of missing the checkpoint remain `UNKNOWN`; confirm before the checkpoint.
- No portal registration, team entry, submission, or receipt is established in this workspace.

## User/problem assumptions

- First-user hypothesis: an operator of an agent that buys paid data/API services from newly encountered providers.
- Evidence is limited to developer proposals, including [issue #450](https://github.com/Merit-Systems/awesome-agentic-commerce/issues/450), [issue #2332](https://github.com/x402-foundation/x402/issues/2332), and [issue #3500](https://github.com/x402-foundation/x402/issues/3500). These do not establish incident frequency, market demand, or willingness to adopt/pay. Issue #2332 points to adjacent Mycelium Trails payment/action evidence work; #3500 discusses scope evidence.
- [x402-doctor](https://github.com/Fizzl13/x402-doctor) is counter-evidence to generic challenge-diagnostics differentiation. The defensible distinction is limited to combining current Concordium Registry/card/wallet facts with explicit buyer policy in one payment path.
- No buyer interviews, pilot, telemetry, or independent usability sessions are recorded. The user problem remains `INFERRED`.

## Registry and transaction status

- The 12 November Registry read is historical and shows null `agent_uri`. Fresh checks on 17 and 19 November report active badges, matching card hashes, and registered wallets. The README-reported `setAgentURI` transaction hashes still lack corresponding finalized receipts; current state checks do not establish which transaction produced the present state.
- The checked-in source supports exact transaction review, digest-bound approval, buyer signing, facilitator settlement, finality read-back, paid fulfillment, and local receipt. The 19 November evidence demonstrates the configured path once.
- No public/mainnet deployment, independent explorer inspection during the recorded run, or production user exists in the reviewed evidence.
- The local receipt log can be rewritten by a privileged filesystem actor; it is not externally anchored or immutable.

## Product AI gate

**AI IN PRODUCT: YES — optional local assistant.** `src/local-agent.mjs` uses Ollama and only the read-only MCP tools `verify_counterparties` and `request_purchase_quote`. It cannot sign or pay. Deterministic Registry and payment-policy logic remains authoritative. No representative evaluation or output-quality result is documented. `OLLAMA_URL` is configurable; prompts go to the configured host, loopback by default. The deterministic UI/MCP path works without the model.

## Security, privacy, and operation

- Public badge checks use Registry/card/account information; the app does not require identity documents. This is not a privacy audit or data-protection certification.
- A badge supports accountability and card-integrity checks only. It is not an endorsement, conduct rating, proof of service quality, or guarantee of present control of an external wallet.
- The local tools are single-operator and loopback-oriented. No multi-tenant identity or remote buyer authentication is verified. Do not enable public buyer payments until per-user authorization is implemented and reviewed.
- The hash-linked JSONL is local and can be rewritten by a privileged filesystem actor. It is not an external immutable or legal audit log.
- Do not claim EU AI Act compliance; legal/privacy scope has not been assessed.

## Next validation questions

1. Does Encode require an already-running agent or named framework, and what are the exact 22 November portal fields?
2. Can the two README-reported Registry update hashes be reconciled with finalized receipts and current card bytes?
3. Will a target agent buyer use a badge/payee binding, and what proof must a receipt contain?
4. What deployment model, retention period, managed signing, and operator controls would real users require?
