# Countercheck screen-recording script

This is the capture plan for the finished build. It includes a full work demo and an edit plan for the event's three-minute video limit. All on-screen claims stay tied to behavior the demo actually shows.

## Before recording

1. Confirm `.env` is configured privately, Node.js 20+ and dependencies are installed, and the Testnet buyer and sponsor have enough test CCD. The buyer spends exactly 1 CCD; the sponsor separately pays the fee shown in the review.
2. Start the full local workflow:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\start-testnet-demo.ps1 -EnableTestnetSettlement
   ```

   The launcher confirms a live Registry/quote and unsigned transaction review. Startup does not sign or pay; the separate final UI action does.
3. Open `http://127.0.0.1:4173` in a clean browser window. Hide bookmarks and unrelated tabs. Set the browser to 100% zoom and record at 1920×1080, 30 fps, with the pointer visible. Turn on cursor emphasis; keep the microphone close and levels below clipping.
4. Check that the payment tag says **TESTNET SETTLEMENT ON**, the workflow steps are readable, and there is no private key, seed phrase, `.env`, terminal environment dump, service log, account export, or unrelated personal data on screen.
   This is a one-operator, loopback demo. The separate approval is a human authorization for this exact transaction; it is not per-user login or a multi-user identity system. Do not imply that public buyer authorization is ready.
5. Click **Show a blocked check** for the negative case. It puts the deliberate placeholder `demo-invalid-seller` in the seller field; the API compares it with the locally configured `SELLER_BADGE` and returns `seller-mismatch`. It does not call the chain or spend anything. Then click **Load demo seller**: the local app reads `SELLER_BADGE` from its configuration, fills the field, and starts the real Registry check. No badge needs to be typed into the UI for this path.
   If **Load demo seller** reports that the seller is not configured, stop and set `SELLER_BADGE` plus the matching seller payee/resource settings in the local `.env`, restart the demo, then run the checks again. Do not put private keys or tokens in the seller field or the recording.
6. A successful recording requires one fresh Testnet transfer. The final button sends exactly 1 CCD after the digest review and approval. Do not click it twice. Do not describe a previously recorded receipt as a payment made during the recording.
7. Optional feature tour: while the full demo services are running, use `node demo/read-only-agent-tour.mjs` and `node demo/read-only-mcp-tour.mjs`. Both are read-only. `npm run agent` additionally requires a local Ollama service and configured model; skip that part if it is unavailable.

## Full product demo — about 5½ minutes including read-only appendix

### 00:00–00:22 — State the user problem

**Screen:** Hero, then scroll to the workflow. Keep the Testnet label visible.

**Voice:** “An agent can pay an API and still leave the buyer unsure which registered seller received the money, whether the terms matched the request, and what came back. Countercheck puts a buyer-side check in front of that payment. The badge is an accountability link; it is not an endorsement.”

### 00:22–00:45 — Show a real blocked path

**Screen:** Click **Show a blocked check**. Show the deliberate placeholder in the field and the red `seller-mismatch` result.

**Voice:** “First, the blocked case. This badge does not match the seller selected in the local purchase policy, so the app stops here. No quote is available and no payment has been prepared.”

### 00:45–01:20 — Check the registered seller

**Screen:** Click **Load demo seller**. The configured `SELLER_BADGE` fills the field automatically. Wait for the green verified result and check time; point to the Registry/card and wallet evidence.

**Voice:** “Now I load the configured demo seller. Countercheck reads the live Concordium Testnet Registry, checks the active badge and Agent Card hash, and compares the seller's registered wallet with the intended payee. This checks registration and integrity. It says nothing about the seller's honesty or service quality.”

### 01:20–01:52 — Inspect the live x402 request

**Screen:** Click **Check the live request**. Hold on the quote grid: network, CCD asset, amount, recipient, sponsor, expiry, and spend ceiling.

**Voice:** “The buyer now reads the seller's live x402 request. The policy accepts only the configured Concordium Testnet, native CCD, the registered seller wallet, the configured fee sponsor, a short expiry, and no more than one CCD. A changed or unsupported term blocks the quote.”

### 01:52–02:42 — Review and approve the exact transaction

**Screen:** Click **Prepare unsigned transaction review**. Scroll only enough to show sender, recipient, 1 CCD, fee payer, nonce, expiry, available balances, signer match, and digest. Click **Approve this exact transaction** and show fresh recheck progress.

**Voice:** “Before any signature, the app reads the current account nonce, buyer and sponsor balances, and chain parameters. It displays the exact transfer and its digest. Approval is tied to that digest, and the service repeats the identity, quote, and chain checks. If anything changed, it asks for a fresh review.”

### 02:42–03:28 — Settle, fulfill, and retain proof

**Screen:** Click **Sign, pay 1 CCD, and get resource** once. Keep the settlement message visible. Then show the paid JSON response, receipt row, transaction hash, and explorer link.

**Voice:** “I separately authorize the displayed one CCD Testnet transfer. The buyer signs only the reviewed digest. The authenticated facilitator checks the payment, protects against replay, sponsors the network fee, and waits for finalization. It rereads the finalized transaction details before the seller returns this paid resource. Countercheck records the result locally and links the transaction for an explorer check.”

### 03:28–03:55 — Bound the claim

**Screen:** Open the transaction link in a new tab, select Testnet if asked, and search the displayed hash. If the explorer does not load, leave the app receipt visible and state that the facilitator's finalized-block read succeeded but the explorer could not be checked in the capture.

**Voice:** “This is one successful Testnet run, not a production claim. The local receipt is hash-linked but not externally anchored. A Registry badge does not guarantee behavior, and this prototype still needs buyer research and production hardening.”

### 03:55–04:12 — Show the local access boundary

**Screen:** Return to the app header and keep the loopback URL and Testnet label visible. Do not expose configuration or terminal secrets.

**Voice:** “This recording runs locally with one configured buyer and a separate explicit approval for the displayed digest. That approval protects this payment action; individual user login and multi-user authorization are not implemented, so the buyer API is not exposed publicly.”

## Optional feature appendix — about 60–90 seconds

Record this as a separate appendix for work reviewers; keep it outside the three-minute event cut.

### Read-only A2A agent discovery

**Screen:** From the project terminal, run:

```powershell
node .\demo\read-only-agent-tour.mjs
```

**Voice:** “The buyer and seller also expose read-only A2A actions. The buyer agent can verify counterparties and request a quote; the seller agent reports its x402 offer and whether paid fulfillment is available. These calls cannot approve or pay.”

### MCP and optional local assistant

**Screen:** Run `node .\demo\read-only-mcp-tour.mjs`. If Ollama is already running and configured, run `npm run agent`, enter `/verify`, then `/quote`, and exit. Do not show the terminal environment or configuration.

**Voice:** “The same bounded checks are available over MCP. The optional Ollama assistant can call only the read-only verification and quote tools. Deterministic checks remain authoritative; the assistant cannot approve, sign, or pay.”

The MCP/agent tour is a distinct read-only capability capture. It is not part of the 19 November payment evidence and no model-quality claim is made.

### Local receipt boundary

Point to the receipt list and say: “Records are chained locally so edits can be detected. They are not a public ledger or an immutable audit service.”

## Three-minute hackathon edit

The event announcement caps the demo video at three minutes. Use these exact spans from the work demo; cut the optional A2A/MCP appendix and long pauses. Keep one sentence on the real problem, one visible blocked result, one live verification, the full exact-transaction review and distinct payment click, and the actual receipt/hash.

| Edit time | Shot / action | Keep this voiceover point |
|---|---|---|
| 00:00–00:18 | Hero and Testnet status | Payment alone does not tell the buyer whether the intended registered seller received it. |
| 00:18–00:33 | Click **Show a blocked check**; show `demo-invalid-seller` and `seller-mismatch` | Deliberate wrong-seller case; stops before quote/payment and spends nothing. |
| 00:33–00:58 | Click **Load demo seller**; show configured badge fill and verified state | Loads `SELLER_BADGE` from local config; live Registry/card/wallet checks; badge is not an endorsement. |
| 00:58–01:21 | Open live quote | Exact Testnet/native-CCD/payee/sponsor/expiry policy; one CCD maximum. |
| 01:21–01:55 | Prepare review; hold on digest and parties; approve | Current nonce/balances; exact digest; fresh recheck and separate approval. |
| 01:55–02:25 | Click pay once; show settlement and paid response | Digest-bound buyer signing; sponsored fee; finalized payment before fulfillment. |
| 02:25–02:48 | Receipt, hash, explorer page | Local evidence trail plus visible Testnet transaction reference. |
| 02:48–03:00 | Return to app / limits panel | One observed Testnet run; no production, demand, or quality guarantee. |

If settlement takes longer than the edit allows, keep the real progress screen for a few seconds, then cut to the receipt from that same run. Add an on-screen label **“same Testnet run”**; do not splice in a historical receipt as if it came from the current click. Keep the transaction hash readable for at least three seconds.

## Exact phrases to preserve

- Say **Testnet**, **one observed run**, and **local receipt**.
- Say **facilitator-confirmed finalization** unless you personally inspect the explorer or an independent node during capture.
- Say **single-operator local demo**; do not describe digest approval as individual account authentication.
- Do not say the badge proves safe behavior, the product guarantees a successful service, the local record is immutable, the project is production-ready, or buyers have validated demand.
- Do not show the private configuration file or terminal output that could contain secrets.
