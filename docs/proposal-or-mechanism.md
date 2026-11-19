# Proposal and mechanism

## User and outcome

An agent buyer needs to obtain data or an API response from an unfamiliar paid provider while keeping a human-approved spend boundary and enough evidence to review what happened. Countercheck binds a single x402 request to two registered agent identities and a deterministic policy result.

## Mechanism

1. A Concordium account is the accountable owner of each registered CIS-8004 agent.
2. Each agent's testnet badge resolves to a current active record and a public Agent Card whose bytes match the on-chain hash.
3. The Registry's `agentWallet` payment address for the buyer must match the sender account; the seller's must match the seller's `payTo` in the payment challenge.
4. The buyer reads the seller's 402 challenge without payment and accepts only exact native CCD on Concordium testnet, the expected payee, a positive atomic-unit amount below a fixed cap, short expiry and explicit fee payer.
5. The current product displays the quote and exact unsigned transaction review, records digest-bound approval after rechecks, and uses a separate explicit action for buyer signing and settlement. One configured local Testnet run exercised this path end to end; see [`../evidence/live-e2e-2026-11-19.json`](../evidence/live-e2e-2026-11-19.json).
6. The run recorded finalized transaction details from a second Testnet gRPC read, a paid resource response, and a local hash-linked receipt. CCDExplorer was not independently inspected during capture; local receipts are not immutable or externally anchored.

## Trust and failure boundaries

- Registry identity/card checks establish the registry claim, not behavior or service quality.
- A badge check does not authorize money movement; policy, account signature and explicit confirmation remain separate.
- Local hash-linked log is neither immutable nor externally anchored. Its strongest current use is a reproducible local digest and transaction reference.
- x402 transaction hash/header is not independent read-back. A response can be lost after settlement. Preserve unresolved state and inspect sender/chain before retry.
- Sponsorship covers the network fee, not service amount.

## Ecosystem value hypothesis

If buyers need to connect seller accountability to a specific purchase, this workflow makes the registry, x402 and action evidence one decision path. One Testnet run proves the configured mechanism, not that buyers need or will adopt it. A generic directory, reputation score, or payment wrapper is not the intended product.

## Roadmap, gated by evidence

1. Reproduce the configured buyer/seller Testnet workflow and independently inspect its transaction in CCDExplorer.
2. Validate the buyer problem and receipt fields with a real agent buyer and seller.
3. Add per-user authorization and managed, policy-limited signing before remote/public use; replace process-local replay protection if operating multiple instances.
4. Evaluate external audit anchoring only if users need a third party to verify local record integrity.
5. Review production custody, privacy, retention, regulatory scope and merchant onboarding before a pilot.

