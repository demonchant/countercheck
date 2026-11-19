# Live Concordium Testnet readiness

**Source review:** 19 November 2026. **Network:** Concordium Testnet (`ccd:4221332d34e1694168c2a0c0b3fd0f27`). One configured local E2E workflow completed on 19 November. This is testnet evidence, not production readiness or general reliability.

## Observed workflow

[`evidence/live-e2e-2026-11-19.json`](../evidence/live-e2e-2026-11-19.json) records:

1. A mismatched seller badge was rejected before payment.
2. The configured seller badge/card/wallet check passed against the live Registry path.
3. Buyer and seller checks passed; the live x402 challenge accepted exact native CCD for 1,000,000 microCCD (1 CCD), the configured payee, sponsor, and 60-second timeout.
4. The app prepared an exact unsigned transaction review and recorded approval bound to its signing digest after fresh checks.
5. The buyer signed, the local facilitator verified and settled, and a second Testnet gRPC read matched finalized sender, recipient, amount, and asset.
6. The seller returned its paid JSON resource and the app wrote a local hash-linked receipt.

Transaction: [CCDScan Testnet link](https://testnet.ccdscan.io/?d=transaction&dsh=71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147). The explorer was not independently inspected during the capture. The sponsor paid an estimated network fee of 4,621,359 microCCD; the buyer paid 1 CCD for the service.

## Capability status and limits

| Capability | Status | Evidence boundary |
|---|---|---|
| Registry badge/card/wallet checks | `VERIFIED` for the captured run | Active state, card hash, and wallet binding passed for configured buyer/seller. This is not seller endorsement or quality assurance. |
| x402 terms and spend policy | `VERIFIED` for the captured quote | Exact 1 CCD native Testnet CCD; one configured seller and policy. Broad rejection matrix not independently exercised here. |
| Exact review and digest approval | `VERIFIED` for the captured run | Fresh nonce, balance, chain parameters and signer-key check; approval followed rechecks. Supported signer configuration is limited. |
| Buyer signature and submission | `VERIFIED` for the captured run | One explicit user action signed the reviewed digest and submitted through the configured seller/facilitator path. |
| Facilitator settlement | `VERIFIED` for the captured run | Authenticated local service, one configured buyer/seller/sponsor, filesystem replay store, process-local serialization; not a multi-instance service. |
| Finality and paid resource | `VERIFIED` for the captured run | Second facilitator gRPC read matched transaction details; seller returned `paid: true`. No separate CCDScan API read was captured. |
| Local receipt | `VERIFIED` for the captured run | Hash-linked local record; not externally anchored or immutable. |
| A2A and MCP | `IMPLEMENTED / UNVERIFIED` in this payment evidence | Read-only buyer/seller actions and two MCP tools were not exercised in the payment run. |
| Optional Ollama assistant | `IMPLEMENTED / UNVERIFIED` for quality | Read-only tools only; no model evaluation. Prompts go to configurable `OLLAMA_URL`, loopback by default. |
| Public deployment / multi-user use | `BLOCKED` | Buyer API is single-operator and unauthenticated for remote visitors. Do not expose payment-enabled buyer service publicly before per-user authorization and security review. |
| User/problem validation | `INFERRED` | Issue proposals and competitor review only; no buyer interviews or adoption data. |

## Reproduction modes

For review-only challenge mode, run `powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\start-safe-demo.ps1`. It blanks signing keys and tokens, forces payments and settlement off, and refuses paid fulfillment.

For the full local Testnet path, privately configure the dedicated demo accounts and `.env`, then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\start-testnet-demo.ps1 -EnableTestnetSettlement
```

Open `http://127.0.0.1:4173`. Startup preflight does not make a payment. The separate **Sign, pay 1 CCD, and get resource** action broadcasts one Testnet transfer after human review and approval. Stop with `powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\stop-testnet-demo.ps1`.

Never screen-record `.env`, terminal environment values, logs, wallet exports, or private keys. Use separate low-balance Testnet buyer and sponsor accounts; never use mainnet credentials.

## Remaining handoff prerequisites

1. Before the 22 November checkpoint, confirm whether a pre-existing running agent is a strict eligibility condition, check the exact Encode portal fields, and enter project/team/idea. Portal state is unknown; this workspace does not establish an entry.
2. Independently inspect the transaction in CCDScan and record the result if you need to claim explorer inspection.
3. Reconcile the README-reported `setAgentURI` update hashes with finalized receipts and current card bytes; recent live state checks do not identify which update produced the present state.
4. Publish and verify the public repository/revision, then capture a current video no longer than three minutes. Neither is established as complete here.
5. Keep public buyer payments disabled until individual authentication/authorization, durable shared replay protection, operational controls, and security review are implemented.
6. Validate the buyer problem with target operators; do not claim demand from issue reports.
7. Submit the required artifacts by 9 December 2026 at 23:59 UTC and retain the portal confirmation. No submission is claimed.

The successful run proves one configured Testnet workflow. It does not establish production readiness, broad reliability, independent explorer verification, adoption, legal compliance, or a prize result.
