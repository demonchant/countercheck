# Countercheck

**Before an agent pays, check the other side.** Countercheck is a buyer-side control for agent commerce. It checks that a seller badge is active, that the seller's current Agent Card matches the registered hash and wallet, and that a live x402 payment request fits the buyer's configured rules. It then shows the exact sponsored Concordium transaction for human approval.

The problem is specific: payment settlement can move value without showing that the buyer paid the intended registered agent or received the expected service response. That creates a gap between “the payment settled” and “the buyer can explain why this agent was paid.” The gap is a credible product hypothesis supported by ecosystem proposals; prevalence, buyer demand, and willingness to adopt remain unvalidated. A badge gives an accountability link, not an endorsement or a service-quality guarantee.

## What the build does

- **Verifies the counterparty:** reads the Concordium Testnet Registry, checks active status and Agent Card hash, and matches the registered payment wallet.
- **Checks the request:** fetches the seller's live x402 v2 challenge and rejects the wrong scheme, network, asset, payee, sponsor, expiry, or amount. The current demo is native CCD with a hard 1 CCD buyer cap.
- **Prepares and reviews:** reads current Testnet nonce, balances, chain parameters, and signer key match; displays sender, seller, sponsor, fee, expiry, payload, and signing digest.
- **Separates approval from payment:** fresh checks run before digest approval and again before signing. The buyer key is invoked only for the reviewed digest. A separate button submits through the authenticated local facilitator.
- **Settles and fulfills:** the facilitator applies replay protection, reserves sponsor balance, submits the sponsored transfer, waits for finalization, and performs a second Testnet gRPC read to match sender, recipient, amount, and asset. The seller returns its paid resource only after successful settlement.
- **Keeps a local evidence trail:** successful payments create hash-linked local records with a transaction hash and CCDScan link. The local log is tamper-evident, not immutable or externally anchored.
- **Exposes read-only agent interfaces:** buyer and seller A2A endpoints, plus MCP tools for counterpart checks and quotes. An optional local Ollama assistant can call only those two read-only MCP tools; AI cannot approve, sign, or pay.

## Run the demo

Install the pinned dependencies with Node.js 20 or newer, create a private `.env` from `.env.example`, and configure the buyer, seller, and sponsor accounts, registered badges, local API token, seller resource, and 1 CCD spend ceiling. Keep the buyer and sponsor keys separate. The buyer account needs the supported 1-of-1 signer used by this prototype, and the sponsor needs enough Testnet CCD for the currently estimated network fee and configured reserve.

Start the review-only demo with `.\demo\start-safe-demo.ps1`. It blanks signing keys and tokens, runs the seller challenge-only, and cannot fulfill paid requests.

For the full, loopback-only Testnet workflow, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\start-testnet-demo.ps1 -EnableTestnetSettlement
```

Open `http://127.0.0.1:4173`. The launcher confirms that the buyer, seller, and facilitator report the fixed Concordium Testnet and the paid workflow is configured. It does not sign or send a transaction by itself. The final **Sign, pay 1 CCD, and get resource** action signs and broadcasts one 1 CCD Testnet payment. Stop the services with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\stop-testnet-demo.ps1
```

Never expose `.env`, private keys, API tokens, log files, or recovery phrases in a recording or repository. Do not reuse the configured demo keys outside Testnet.

## Verified end-to-end run

On 19 November 2026, the live workflow rejected a mismatched seller badge, verified the configured seller, accepted the live 1 CCD x402 quote, prepared the exact sponsored transaction, recorded digest-bound approval, and completed a finalized Testnet payment. The seller returned `paid: true` only after settlement. Transaction: [`71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147`](https://testnet.ccdscan.io/?d=transaction&dsh=71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147). The facilitator's second gRPC read matched the finalized payment details. We did not independently inspect the explorer page in the captured run; the receipt records that limit. Sanitized evidence is in [`evidence/live-e2e-2026-11-19.json`](evidence/live-e2e-2026-11-19.json).

For the full screen-recording plan and the shorter three-minute hackathon cut, see [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) and [`DEMO_CHECKLIST.md`](DEMO_CHECKLIST.md).

## Boundaries and current evidence

- Concordium Testnet only. A separate mainnet launch is not implemented or authorized.
- Fixed 1 CCD native transfer, one configured buyer, seller, and fee sponsor. The facilitator sponsor pays the network fee; the buyer pays the service amount.
- Buyer signer support is limited to an account and first credential with a 1-of-1 threshold and the configured first key. Other threshold configurations need additional signer support.
- Each purchase requires a separate human approval tied to the exact transaction digest. This is per-payment authorization, not individual user login or multi-user account separation; the local service uses one configured buyer key.
- The Vercel proxy hard-blocks public purchase requests until per-user authorization exists. The local loopback Testnet demo still supports the separate review, approval, and payment action.
- Local service and receipt storage are for a controlled demo, not a multi-tenant production deployment. No public service has been deployed or independently security-reviewed.
- Registry identity checks do not establish behavior, honesty, quality, legal compliance, or control of a wallet beyond the registered record.
- No direct buyer interviews, adoption data, or market-size validation are claimed. Hackathon eligibility details and exact portal fields remain partly unknown; see the [event analysis](docs/hackathon-analysis.md) and [rubric map](docs/rubric-matrix.md).

## Checkpoint handoff — 22 November

The official announcement calls for a project, team, and idea checkpoint on 22 November 2026. This workspace contains the project description and proof plan, but it does not establish an Encode portal entry, team record, or checkpoint confirmation. Before the checkpoint, confirm whether the programme strictly requires an agent already in use, complete the official portal fields, and retain its confirmation. The linked Encode terms were not readable during review.

The project owner supplied the [buyer web app](https://countercheck-red.vercel.app/) and [seller service](https://countercheck-seller-1146.onrender.com) URLs. Their current deployments have not been independently verified from this workspace. See the [Vercel and Render configuration](docs/vercel-configuration.md) and [environment-ready handoff](docs/live-testnet-readiness.md) for remaining prerequisites and the exact observed Testnet boundary.

The copy-ready [checkpoint brief](docs/checkpoint-brief.md) contains the project/idea draft and leaves participant details and portal confirmation explicit.

## Project notes

- [Event analysis and candidate selection](docs/hackathon-analysis.md), [official rubric map](docs/rubric-matrix.md)
- [Problem and competitor research](docs/competitive-analysis.md), [ecosystem research](docs/ecosystem-research.md), [assumptions and limits](docs/assumptions.md)
- [Product architecture](docs/architecture.md), [proposal and mechanism](docs/proposal-or-mechanism.md), [dependency audit](docs/dependency-audit.md)
- [Live Testnet readiness](docs/live-testnet-readiness.md), [dated demo handoff](docs/live-demo-readiness-2026-11-19.md), [evidence index](evidence/README.md)
- [Deployment and security boundaries](docs/deployment.md), [Vercel and Render configuration](docs/vercel-configuration.md), [remote deployment status](docs/remote-deployment-readiness.md), [facilitator contract](docs/facilitator.md)
- [Demo and pitch](docs/demo-and-pitch.md), [specialist reviews](docs/specialist-reviews-2026-11-19.md), [workspace forensics](docs/PROJECT_FORENSICS.md)
