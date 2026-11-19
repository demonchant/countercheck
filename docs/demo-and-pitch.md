# Countercheck: pitch and demo

## One-line pitch

Countercheck gives an agent buyer a reviewable decision before paying: verify the registered seller and declared wallet, enforce exact x402 payment rules, approve the transaction digest, then receive the paid response only after finalized Testnet settlement.

## Problem and evidence

An agent buyer can receive a valid payment challenge and still lack an easy way to establish that the payee is the intended registered agent, that the charge matches buyer rules, and that the paid action returned a result. Existing identity checks and payment flows often sit in separate places. Ecosystem proposals document this integration gap, but they do not demonstrate prevalence. No buyer interviews, incident frequency, adoption, or willingness-to-pay data have been collected; the demand claim remains a hypothesis.

## Solution and distinction

The core is a deterministic buyer gate that links Concordium Registry identity and Agent Card integrity to the wallet and terms in a live x402 challenge. It shows the precise sponsored transfer, repeats checks before signing, signs only the reviewed digest, and makes the seller wait for facilitator-confirmed finality before returning a paid resource. The spend limit is hard-capped at one CCD in this prototype. The differentiator is the joined decision and evidence trail across identity, policy, settlement, and service response, not an AI claim.

## Observed proof

On 19 November 2026, the local Testnet run demonstrated a rejected seller mismatch followed by successful configured seller verification, a live accepted quote, an exact transaction review, digest-bound approval, sponsored settlement, finalized transaction detail read-back, paid response, and local receipt. Transaction hash: [`71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147`](https://testnet.ccdscan.io/?d=transaction&dsh=71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147). The facilitator's second Testnet gRPC read matched the finalized transaction. The explorer page was not inspected during the run. Evidence and its limits are recorded in [`../evidence/live-e2e-2026-11-19.json`](../evidence/live-e2e-2026-11-19.json).

## Three-minute demo spine

1. State the buyer's uncertainty before an agent pays.
2. Show the seller-mismatch block and that no payment is available.
3. Load the configured badge and show the live Registry/card/wallet check.
4. Show the quote's network, asset, recipient, sponsor, expiry, and one CCD cap.
5. Prepare and approve the exact transaction after fresh checks.
6. Sign and pay once; show facilitator finality, the seller's paid response, local receipt, and explorer link.
7. End with the boundaries: one Testnet run, local hash-linked record, no conduct assurance, no market validation.

The timestamped shot list and voiceover are in [`../DEMO_SCRIPT.md`](../DEMO_SCRIPT.md). The event announcement specifies a demo video up to three minutes; keep the A2A/MCP/Ollama tour as a separate work-review appendix.

## AI position

AI is optional and outside the authorization path. The Ollama wrapper can only call read-only MCP verification and quote tools. Prompts go to the configured `OLLAMA_URL` (loopback by default). Deterministic code decides the result. There is no model quality evaluation, so no accuracy claim should be made. The core workflow works without the model.

## Go-live path

Keep real user accounts separate; replace local operator-held buyer signing with an appropriate user-controlled signer and preserve exact-digest review. Operate the facilitator behind private authenticated service networking with durable replay state, reconciliation for unresolved settlement, independent transaction/read-back monitoring, abuse limits, and tested recovery. Validate the problem with agent buyers before designing multi-seller onboarding or broad spend rules. Mainnet launch requires separate review, authorization, funding, and security work.
