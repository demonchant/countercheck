# Countercheck

**Before an agent pays, check the other side.** Countercheck is a buyer-side guardrail for agent commerce on Concordium Testnet.

## A buyer agent meets a new seller

Imagine a buyer agent searching for a data service. It finds a seller that can answer the question, and the seller returns an x402 request: pay 1 CCD to this address, on Concordium Testnet, before the quote expires. The request is machine-readable and ready to settle. But the buyer still has to decide: **is this the seller I intended to pay, and do these exact terms fit my policy?**

A payment protocol can describe and settle the request. A registry can publish an agent's identity and card. Those are useful parts of the system, but the buyer needs them connected to this particular payment. A badge alone is not an endorsement, and a successful transfer alone does not explain why this seller was paid.

Countercheck puts that buyer-side check in front of the transfer. It checks the seller's Concordium badge, registered Agent Card hash, and payment wallet. It then fetches the live x402 request and checks the network, asset, amount, recipient, fee sponsor, expiry, and spend cap. A mismatch stops the flow before signing. If the checks pass, Countercheck prepares the exact transaction so a person can review and approve it.

This is a focused product hypothesis, not a claim that x402 or agent registries are broken. The need and demand still require validation with real agent buyers.

## What happens in a Countercheck purchase

1. **Check the seller.** Read the Concordium Testnet Registry for an active badge, matching Agent Card hash, and registered payment wallet. The configured buyer flow rejects a different seller badge.
2. **Check the quote.** Read the seller's live x402 v2 challenge. The demo accepts only the configured Concordium Testnet, native CCD, matching seller recipient, configured fee sponsor, an unexpired request, and at most 1 CCD.
3. **Review the exact transaction.** Read the current nonce and balances, prepare the sponsored transaction, and display its sender, recipient, amount, fee, expiry, payload, and signing digest.
4. **Approve one digest.** A person approves the exact review. Countercheck repeats the identity, quote, and chain checks before signing; changed details require a fresh review.
5. **Confirm settlement and fulfillment.** In the local Testnet demo, the facilitator submits the transfer, waits for finalization, and checks the finalized transaction details before the seller returns its paid resource. Countercheck records a local hash-linked receipt.

The optional local AI assistant can request read-only identity and quote checks. Deterministic policy code makes the decisions; the assistant cannot approve, sign, or pay.

## Hosted demo

- Buyer app: [countercheck-six.vercel.app](https://countercheck-six.vercel.app/)
- Buyer API status: [countercheck-six.vercel.app/api/status](https://countercheck-six.vercel.app/api/status)
- Buyer API health: [countercheck-1-lecq.onrender.com/healthz](https://countercheck-1-lecq.onrender.com/healthz)
- Seller x402 challenge: [countercheck-seller-1146.onrender.com/resource](https://countercheck-seller-1146.onrender.com/resource)

The seller resource returns HTTP 402 with an x402 challenge; this is the expected response before payment. Hosted buyer purchases now require an individually authenticated Clerk account, an explicit allowlist entry, and a same-session approval of the exact transaction. They remain blocked until the Clerk and Testnet settings in [Vercel configuration](docs/vercel-configuration.md) are complete. Authorized users share the buyer API's one configured Testnet account. Use the local Testnet setup below for the complete review, approval, and settlement flow without a Clerk account.

## Run the local Testnet demo

Requirements: Node.js 20 or newer, dependencies from the lockfile, and a private `.env` configured from `.env.example`. Configure the separate Testnet buyer and sponsor accounts, registered buyer and seller badges, seller recipient, local API token, and the 1 CCD spend ceiling. Never put private keys or API tokens in the repository or a recording.

Start the review-only demo:

```powershell
.\demo\start-safe-demo.ps1
```

For the full local Testnet flow, start the explicit settlement mode:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\start-testnet-demo.ps1 -EnableTestnetSettlement
```

Open `http://127.0.0.1:4173`. Startup does not send a transaction. The **Sign, pay 1 CCD, and get resource** button is the separate payment action. Stop the services with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\stop-testnet-demo.ps1
```

## Recorded Testnet evidence

One local end-to-end Testnet run was completed on 19 November 2026. It blocked a mismatched seller, verified the configured seller, accepted the 1 CCD quote, prepared and approved the exact transaction digest, settled the transfer, confirmed finality and payment details with a second gRPC read, and received the seller's paid resource. The transaction is available in [CCDScan Testnet](https://testnet.ccdscan.io/?d=transaction&dsh=71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147). The explorer was not independently inspected during the capture. Sanitized evidence is in [`evidence/live-e2e-2026-11-19.json`](evidence/live-e2e-2026-11-19.json).

This proves the configured flow worked once. It does not establish production readiness, general reliability, buyer demand, or a public payment deployment.

## Boundaries

- Concordium Testnet only; one configured buyer, seller, and sponsor; native CCD; a 1 CCD cap.
- Hosted purchases require a Clerk user allowlist and bind each quote, review, approval, and purchase to the same user session. A person must still approve each exact transaction.
- The hosted buyer uses one configured Testnet buyer account shared by its allowlisted users. Its 1 CCD cap applies per payment, not as a shared aggregate budget.
- Hosted purchase requests stay blocked until both the Vercel authorization/purchase gate and the Render buyer/facilitator Testnet gates are configured.
- The local receipt is hash-linked but can be rewritten by a privileged filesystem actor. It is not externally anchored or immutable.
- Registry checks confirm registered identity and card/wallet consistency. They do not guarantee seller behavior, current wallet control, service quality, or legal compliance.
- No direct buyer interviews, pilot, adoption data, or willingness-to-pay validation are claimed.

## Project guides

- [Architecture](docs/architecture.md)
- [Local deployment and operations](docs/deployment.md)
- [Vercel and Render configuration](docs/vercel-configuration.md)
- [Facilitator contract](docs/facilitator.md)
- [Click-by-click demo script](DEMO_SCRIPT.md) and [recording checklist](DEMO_CHECKLIST.md)
- [Evidence index](evidence/README.md)
