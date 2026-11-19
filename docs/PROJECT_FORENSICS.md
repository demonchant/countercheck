# Workspace forensics

## Completion review — 19 November 2026

- This workspace is an uncommitted Countercheck repository: `main` has no commits and the files are untracked. An `origin` URL is configured but was not fetched or compared. Do not treat the workspace as published.
- The latest 19 November evidence records one complete configured Testnet workflow: mismatch rejection, live Registry/card/wallet check, exact quote and transaction review, digest-bound approval, buyer signature, sponsored settlement, second gRPC finality read-back, paid response, and local hash-linked receipt. See `evidence/live-e2e-2026-11-19.json`. The explorer page was not independently inspected.
- The earlier `evidence/live-demo-preflight-2026-11-19.json` is a distinct read-only challenge-mode capture; it does not supersede or contradict the later full run.
- Nine specialists plus the lead reviewed rules, user evidence, competitors, rubric, product strategy, integration architecture, AI, security/access, and UX/demo. Their findings are summarized in `docs/specialist-reviews-2026-11-19.md`.
- This checkpoint continuation reconciles README, rubric, analysis, architecture, assumptions, deployment, facilitator, and evidence records with the later E2E evidence. It also documents unresolved eligibility, remote deployment, public buyer authentication, historical Registry transaction receipts, user validation, and explorer inspection.
- No test suite or new payment was run in this documentation continuation. `.env` values were not read or printed. No deployment, publication, portal entry, or submission was performed.

The 17 November review below is retained as a dated historical snapshot. Its statement that the latest Registry read was from 12 November was superseded by the 17 and 19 November observations; those newer reads do not reconcile the README-reported Registry transaction hashes.

## Completion review — 17 November 2026

- The workspace now contains the Countercheck source, docs, evidence, demo scripts/media and deployment configuration described below; the older 11–12 November entries are historical snapshots, not the current repository state.
- `.git` exists and `git status` reports branch `main` with **no commits yet**; the working tree is untracked. `origin` is configured as `https://github.com/demonchant/countercheck.git`; the remote branch was not queried or compared with this workspace in this pass.
- The source now contains an unsigned exact-transaction review and digest-bound `approved_unsubmitted` response. `confirmPurchase()` still blocks signing/submission. Documentation that said the exact preview was missing has been corrected.
- README claims later CIS-8004 URI updates, but the evidence bundle's latest Registry capture (12 November) says both URIs were null and contains no matching transaction receipts/read-back. Current Registry state is marked `UNKNOWN` pending fresh evidence.
- The optional local Ollama assistant is shipped with read-only MCP tools; `AI IN PRODUCT` is corrected to `YES` (optional local), with model quality unevaluated. Existing-agent event eligibility remains unknown.
- No tests, servers, deployments, or external transactions were run in this completion pass. `.env` contents were not read or printed. Existing demo videos and local media were left untouched.

**Date:** 11 November 2026

## Starting state

- The workspace contained `AGENTS.md`, `HACKATHON_START.md`, `MASTER_PROMPT.md`, `HACKATHON_BUILD_STANDARD_V2.md`, and `HACKATHON_REBUILD_PLAYBOOK.md` only.
- There was no application source, package manifest, test suite, deployment, media, `hackathon-input/` folder, wallet, or event PDF.
- `git status` and `git rev-parse` reported that this directory is not a Git repository. No prior implementation or remote was available to inspect.
- No files from a Corpus/Monad starter project were present; its reference-review instructions do not apply.
- The only event packet is the brief pasted in chat. Full Encode eligibility terms and exact portal fields were not available as readable material during source review.

## Work created in this build

The project name is Countercheck. All product source created here is new work and is not represented as pre-existing work. The local implementation and any later hackathon work should be distinguished in the final revision history once a repository is initialized.

## Verification boundary

Dependencies were installed with `--ignore-scripts` using a temp cache after temporarily bypassing the npm offline setting and dead proxy for the install command; npm's global config was not changed. A regular lifecycle install failed when the OS blocked the `protobufjs` postinstall child process (`spawn EPERM`). That package script only checks version-scheme compatibility; it was run directly with Node and exited successfully. The built-in HTTP UI and local Ollama/MCP read-only agent started with payments disabled. The direct `/verify` MCP call returned `blocked` with `BUYER_BADGE`, `SELLER_BADGE`, `CCD_ACCOUNT_ADDRESS` and `SELLER_PAY_TO` missing. `/quote` returned `blocked` with buyer/seller badges, sender, payee, resource URL and spend cap missing; no seller network request was made. No tests were run, and no wallet was connected, transaction submitted, or deployment performed. The earlier read-only hosted Registry MCP health request failed with a connection-receive error; that does not establish a service outage. The build window opens on 19 November 2026; testnet behavior remains a prerequisite.

## Follow-up inspection and implementation

**Date:** 12 November 2026

- The workspace still has no `.git` directory; `git status` and revision history remain unavailable. `.env` exists, but its contents were not read, printed, or used as evidence.
- Read-only Registry GET checks for both badges returned `HTTP unavailable` for both `check-badge` and `verify-agent-card`. The exact URI/on-chain hash state is therefore `UNKNOWN`; this result does not prove a Registry outage.
- Local card SHA-256 values were computed from local bytes only. The public raw URLs and current anchored hashes were not freshly verified. Both card metadata blocks still point at `/v1/badge-check/` and mainnet docs, unlike the current Testnet REST checks; do not alter these card bytes until URI anchoring is known.
- Implemented a loopback x402 v2 seller resource using `@x402/core` and the Concordium server scheme. After correcting its async unpaid-response callback, a read-only GET returned an actual HTTP 402 for exactly 1 CCD using the running local facilitator's supported Testnet sponsor; captured at `evidence/seller-challenge-2026-11-12.json`. The seller process was stopped after capture; no payment header/signature was sent.
- Enforced a hard 1 CCD amount ceiling on buyer and facilitator configuration and request validation; aligned native asset spelling, integer expiry checks, and the configured sponsor requirement. Added explicit facilitator expiry/nonce-shape checks, a second sponsor reserve read before SDK settlement, and a per-process settlement queue.
- Inspected the pinned Concordium x402 2.30.0 package source: its facilitator `settle()` invokes `verify()` immediately before sponsor signature; that verification checks buyer signature, transaction expiry, current account nonce and buyer available balance. This is dependency-source review, not Testnet execution evidence.
- Fixed payment-response extraction to read the x402 v2 `transaction` field and accept an unprefixed 32-byte Concordium transaction hash, while requiring success and the configured Testnet ID.
- Removed the MCP payment action. The MCP path is read-only. The browser can prepare and approve an exact transaction digest, but the buyer signing/submission path is not connected. Seller resource, buyer payments, and facilitator settlement remain separately gated.
- See [live Testnet payment readiness](live-testnet-readiness.md) for the nine-step matrix and exact remaining prerequisites. No transaction was signed, submitted, or broadcast.
