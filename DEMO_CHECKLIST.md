# Countercheck demo checklist

## Pick the correct mode

- [ ] **Review-only / challenge mode:** start `powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\start-safe-demo.ps1`. Keys and API tokens are blanked; paid fulfillment is refused.
- [ ] **Full Testnet mode:** configure `.env` privately, then start `powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\start-testnet-demo.ps1 -EnableTestnetSettlement`. The launcher checks live Registry, seller quote, and unsigned transaction review before reporting ready.
- [ ] Open `http://127.0.0.1:4173` and confirm **TESTNET SETTLEMENT ON** only for the full mode. Keep all services on loopback.
- [ ] Describe this as a one-operator local demo. The digest approval is authorization for that transaction, not per-user login; do not enable or imply public buyer payments.
- [ ] Do not screen-record `.env`, terminal environment dumps, logs, private keys, recovery phrases, wallet exports, or unrelated desktop content.

## Record the workflow

- [ ] Click **Show a blocked check**. It fills `demo-invalid-seller` and returns `seller-mismatch` against the configured seller; this is intentional, makes no chain call, and spends nothing.
- [ ] Click **Load demo seller** next. It fills the configured `SELLER_BADGE` from the local app settings and starts the real Registry/card/wallet check. If it says the seller is not configured, stop and privately set `SELLER_BADGE` and matching seller settings in `.env`, restart, and retry.
- [ ] Request the quote and show exact network, asset, payee, sponsor, expiry, and spend ceiling.
- [ ] Prepare the transaction review. Show the exact parties, amount, fee, nonce, expiry, signer check, and digest.
- [ ] Approve the exact digest. Explain that fresh checks run again before signing.
- [ ] Click **Sign, pay 1 CCD, and get resource** once. This sends one Testnet payment; do not double-click or retry an unresolved result.
- [ ] Show the seller's paid JSON response, receipt, transaction hash, and explorer link. During capture, distinguish facilitator gRPC finality confirmation from your own independent explorer inspection.
- [ ] Open the transaction link in CCDScan and inspect the Testnet sender, recipient, amount, finalization, and result during recording. The 19 November evidence file did not capture an independent explorer inspection.
- [ ] For the read-only capability appendix, run `node .\demo\read-only-agent-tour.mjs` and `node .\demo\read-only-mcp-tour.mjs`. The optional `npm run agent` requires a running local Ollama service/model.
- [ ] For the public hackathon video, use the three-minute cut in [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md). Keep the full interface tour as a longer work-review recording.

## Evidence and boundaries

One live Testnet run on 19 November 2026 rejected a mismatched seller, verified the configured seller, accepted the live quote, prepared and approved the exact transaction, settled, confirmed finality through a second facilitator gRPC read, and received the paid seller response. The 1 CCD transaction hash and sanitized evidence are in [`evidence/live-e2e-2026-11-19.json`](evidence/live-e2e-2026-11-19.json). The explorer page was not inspected during that run. This proves one configured Testnet workflow, not production readiness, adoption, or general reliability.

If Registry, seller, facilitator, or chain preflight fails, show the real blocked state. Do not splice a historical receipt into a new recording as if it followed the current click. The badge verifies registration and card integrity only. Local receipts are hash-linked, not externally anchored or immutable.

## After recording

- [ ] Stop services with `powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\stop-testnet-demo.ps1` (or `stop-safe-demo.ps1` for challenge mode).
- [ ] Check the recording frame by frame for secrets and accidental personal data.
- [ ] Keep the actual date, Testnet mode, transaction hash, and limits with the recording.
- [ ] Do not claim deployment, market validation, independent explorer verification, production readiness, or submission unless separately evidenced.
