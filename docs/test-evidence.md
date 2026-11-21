# Verification evidence

Recorded 20 November 2026 in the local workspace. These results describe the current source tree; browser tests use the local app and mocked service responses, and do not perform a purchase.

## Automated checks

| Command | Result | Scope and limits |
|---|---|---|
| `npm test` | **107 passed, 0 failed, 0 skipped** (Node test runner; approximately 0.36 seconds in the captured run). | Deterministic unit/integration tests for transaction/policy constraints, quote validation, digest and replay protections, facilitator settlement behavior with test doubles, configuration and service boundaries, proxy/session behavior, seller challenge-only behavior, Agent Cards and A2A. No live signing or chain transfer was triggered by this command. |
| `npm run test:browser` | **5 passed, 0 failed** (Playwright Chromium; approximately 5.1 seconds). | Local page and assets, disabled payment state, simulated Registry outage, simulated seller mismatch, mocked 1 CCD read-only quote, and local API origin/header guard. Registry and quote data in scenarios are fixtures; payment endpoint is asserted not to be called. |

The browser suite initially failed because it expected an old heading, labels, `/assets/...` paths, and an old authorization error string. The tests were updated to follow the current `public/index.html` and the current `local_origin_required` API response, then rerun successfully. The implementation was not changed to weaken request authorization.

## Live integration evidence

- One configured Concordium Testnet end-to-end purchase is recorded in [`../evidence/live-e2e-2026-11-19.json`](../evidence/live-e2e-2026-11-19.json). The sequence includes seller mismatch rejection, configured buyer/seller checks, a 1 CCD quote, exact transaction review, digest approval, sponsored settlement, finalized transaction read-back and paid seller response.
- The transaction reference is in that record and in the [CCDScan link](https://testnet.ccdscan.io/?d=transaction&dsh=71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147). The explorer page was not independently inspected during that run.
- One successful run does not establish general reliability or production readiness. Automated tests are not a substitute for the live run, and fixture-based browser tests are not live Registry/payment tests.

## Not established

No load test, third-party security audit, mainnet test, hosted public purchase test, multi-user authorization/payment test, production signer test, model-quality evaluation, buyer interview, pilot, adoption metric, market-size estimate, or willingness-to-pay validation is claimed.

## 21 November security regression pass

After the 20 November run, the buyer was changed to compute the expected transaction hash from the exact signed payload, read that hash from Concordium Testnet through the buyer-side gRPC client, and check finalized sender, recipient, sponsor, and amount before writing a paid receipt. Seller success headers alone no longer establish success. A missing response, chain timeout, pending transaction, or mismatch remains unresolved. This new path has fixture coverage only; no new payment was authorized or run.

The optional Ollama client now defaults to loopback and requires an exact `OLLAMA_ALLOW_REMOTE=true` plus HTTPS for a remote host. The Registry panel now lists the specific checks and explains that a URI-pinned hash match does not establish that the card points at the currently running endpoint. A process-local mutex serializes buyer settlement attempts; it does not solve multi-instance locking.

The clean-install verification passed: `npm ci`; `npm test` (131 passed); `npm run test:browser` (6 passed); `npm run test:all` (same counts); and `node --check` on the edited JavaScript files. Playwright cases use fixtures and assert that no payment occurs. The exact run notes and limits are in [`../evidence/security-regression-2026-11-21.json`](../evidence/security-regression-2026-11-21.json). The production build is static and `package.json` defines no separate lint, type-check, or build script.

## 21 November interoperability and recovery update

Added standard A2A Agent Card discovery for the read-only buyer policy and seller offer services, including a `ClientFactory.createFromUrl` flow that discovers both cards and calls their actual A2A JSON-RPC endpoints. These integration cards explicitly make no CIS-8004 identity claim. A browser preflight test covers the public read-only A2A method/header boundary.

The buyer now fsyncs a hash-linked dispatch intent with the exact expected transaction hash and reviewed parties/amount before the signed payment request is sent. This leaves a reconciliation pointer if the process restarts; it is not proof that the seller received the request. The local JSONL audit refuses to grow beyond 16 MiB, preventing unbounded history reads; archiving is manual and distributed durability remains unimplemented.

The final Node suite passed **136 tests**. The final browser suite remains **6 tests** and uses fixture responses; it performs no purchase. The new discovery test uses local Countercheck endpoints and fixture actions, so it proves A2A discovery/protocol client compatibility rather than third-party agent provenance, live Registry results, or eligibility. See [`../evidence/agent-production-regression-2026-11-21.json`](../evidence/agent-production-regression-2026-11-21.json) for the final combined run.
