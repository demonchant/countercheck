# Evidence index

## Live end-to-end Testnet run — 19 November 2026

The local full demo showed a blocked mismatched-seller check, then a verified configured seller, accepted live 1 CCD x402 quote, exact transaction review, digest-bound approval, finalized sponsored transfer, and paid seller response. The captured transaction hash is `71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147`. The facilitator waited for finalization and independently reread the finalized transaction details over its Concordium Testnet gRPC connection. The explorer page was not independently inspected during the capture. The sanitized run summary and qualification note are in [`live-e2e-2026-11-19.json`](live-e2e-2026-11-19.json); the local receipt log retains the append-only original record plus a qualification record.

This is one observed Testnet workflow. It does not establish production security, adoption, or reliability across accounts and network conditions. The optional MCP/A2A/Ollama interfaces are separate capabilities and are not evidenced by this payment run.

## Read-only preflight — 19 November 2026

The safe demo app made a fresh Registry/card/wallet check and accepted a live exact 1 CCD x402 quote from the local challenge-only seller. The timestamped, sanitized summary is [`live-demo-preflight-2026-11-19.json`](live-demo-preflight-2026-11-19.json). This is a separate read-only capture and should not be confused with the later full E2E evidence above.

The 17 November capture and its video remain historical evidence. The README-reported Registry update transaction hashes still have no corresponding finalized receipts in this evidence folder. The project workspace has no commit history or verified public release state.

## Historical completion review — 17 November 2026

The 12 November Registry capture is historical and showed both badges Active with null `agent_uri` values. A fresh read-only Registry MCP check on 17 November verified both configured badges, current card hashes, and registered wallets; see [`registry-live-read-2026-11-17.json`](registry-live-read-2026-11-17.json). This current check does not reconcile the README-reported `setAgentURI` transaction hashes with finalized receipts. The local seller also returned a genuine x402 HTTP 402 challenge during the demo session. Buyer quote/transaction preparation could not reach its chain node, so no unsigned transaction was prepared or approved in that session. Signing/submission remain blocked; no paid transaction or paid receipt is present. No tests were run.

The assembled local demo is [`countercheck-demo-2026-11-17.mp4`](../countercheck-demo-2026-11-17.mp4) (129.4 seconds, 1920×1080, audio). It has not been published.

**As of 12 November 2026, 13:25 UTC:** no Registry update or payment was signed/submitted; no payment was broadcast, finalized, or independently verified. Evidence below distinguishes actual read-only observations from builder responses and tests. The old card integrity and preview records concern the previous card revision; current local cards are candidate bytes and are not yet public or Registry-anchored.

| Evidence | Provenance/status | What it proves | What it does not prove |
|---|---|---|---|
| Official event article: <https://www.concordium.com/article/concordium-trusted-agents-hackathon-encode-club> | `OFFICIAL`, retrieved 11 Nov 2026 | Published eligibility summary, Testnet requirement, dates, submission artifacts and judging prose. | Full Encode terms, exact portal fields or participant registration state. |
| Registry/CIS-8004/MCP docs linked in `docs/dependency-audit.md` | `OFFICIAL`, retrieved 11 Nov 2026 | Intended hosted API, card hash and owner authorization behavior. | This project's transaction state. |
| `registry-readonly-2026-11-12.json` | `OBSERVED`, Node read-only REST + MCP, 12:46 UTC | Both REST endpoint pairs returned HTTP 200; both tokens are Active; both `agent_uri` values are null; owner and `agentWallet` match. | A verified Agent Card, because there is no URI/hash comparison; any payment signature or transaction. |
| `agent-card-integrity-2026-11-12.json` | `OBSERVED`, GitHub public GET/API + local bytes, 11:54 UTC; historical previous card revision | Previous public raw card bytes matched the then-current local files; it records old hashes, registration times and history. | Current candidate card publication, current public hashes, or the original preimage/source of either on-chain hash. |
| `set-agent-uri-previews-2026-11-12.json` | `OBSERVED_REGISTRY_BUILDER_RESPONSE`, 11:49 UTC; superseded | Registry builder produced unsigned `setAgentURI` parameter previews for the previous card bytes and URLs. | Current card parameters, a full account transaction, fee quote, signature, submission or finality. Do not sign; rebuild after final publication. |
| `seller-challenge-refresh-2026-11-12.json` | `OBSERVED`, real local HTTP GET, 11:45 UTC | Actual loopback seller returned HTTP 402 and x402 v2 exact on Testnet: 1,000,000 microCCD, CCD, configured seller payee, 60s timeout, configured facilitator sponsor. No `PAYMENT-SIGNATURE` was sent. | Buyer Registry verification/quote acceptance, buyer or sponsor balance/key proof, signature, settlement, finality, or a public seller endpoint. |
| `seller-challenge-refresh-2026-11-12.json` (latest refresh) | `OBSERVED`, real local HTTP GET, 13:25 UTC | Current service on local port 4191 generated HTTP 402 with x402 v2 exact Testnet CCD, 1,000,000 microCCD, configured seller and sponsor, 60s timeout. No payment signature was sent. | Public HTTPS reachability or paid fulfillment. |
| `render-public-check-2026-11-12.json` | `OBSERVED`, HTTPS GET to user-supplied Render host | HTTPS handshake succeeded; the captured responses were HTTP 502 `no-deploy`. Later GETs of `/resource` and both A2A paths also returned 502 `no-deploy`. | A deployed or publicly reachable seller/A2A service or a live public challenge. |
| `facilitator-readonly-2026-11-12.json` | `OBSERVED`, local GET, 10:58 UTC | Facilitator reported Testnet, settlement disabled, and x402 v2 exact support with fee payer. | Sponsor key/address pairing, current balance, node health, signature, or chain activity. A fresh health check at 11:43 UTC again reported settlement disabled. |
| Source code in `src/` and `public/` | `VERIFIED` for the captured configured Testnet path; other modes remain `IMPLEMENTED / UNVERIFIED` | The dated E2E evidence records a live payment and paid fulfillment; source contains the broader intended path. | General reliability, production security, public deployment, multi-user authorization, or unrelated modes. |
| Unit tests in `test/` | `SIMULATED` | Deterministic rejection, replay and finality-check behavior against explicit test fixtures. | Registry status, a live challenge, real signatures, sponsor submission, or chain finalization. |

The prior PowerShell `.NET` Registry probe returned `ReceiveFailure`; that probe did not establish Registry outage. `demo/show-registry-readonly.ps1` now delegates to the Node implementation. Reproduce card and seller reads with `node demo/audit-agent-cards-readonly.mjs` and `node demo/capture-seller-challenge-readonly.mjs` while the local seller process is running. The seller process is currently stopped.

For any later authorized payment, retain the exact transaction review/approval, buyer and sponsor signing results, transaction hash, and independent explorer or second-node read-back. Never include keys, seeds, identity documents, `.env` contents, or unreduced sensitive request bodies.
