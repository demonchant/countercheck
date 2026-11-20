# Countercheck screen recording script

This guide gives the exact screen actions and narration for a full product walkthrough, followed by a three-minute edit plan. Use the local app for the complete payment flow. The hosted Vercel app uses anonymous guest sessions and should remain read-only for the recording unless public Testnet payments are deliberately enabled.

## Before recording

1. Start the local Testnet demo only when you are ready to record:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\start-testnet-demo.ps1 -EnableTestnetSettlement
   ```

   Startup runs checks and prepares the flow; it does not submit a transaction.

2. Open `http://127.0.0.1:4173` in a clean browser window. Set zoom to 100%, record at 1920x1080 and 30 fps, hide bookmarks and unrelated tabs, and keep the pointer visible.
3. Confirm the header says **TESTNET SETTLEMENT ON**. Confirm the seller is configured by clicking **Load demo seller** before the take if needed; this fills the badge from the local app configuration and starts its Registry check. Do not show `.env`, terminal environment values, service logs, private keys, recovery phrases, or wallet exports.
4. The hosted app can load the configured seller badge without a sign-in. Confirm it says **TESTNET PAYMENTS LOCKED** for a read-only hosted preview. Use the local loopback app for the full payment path; its separately configured Testnet action is unchanged.
5. A new final-button click submits one 1 CCD Testnet payment. It must be your intentional approval of a new payment for this recording. Click it only once. Never splice a previous transaction into a new click as though it came from that session.

## Full walkthrough — about four minutes

### 00:00–00:25 — Set the scene

**Screen actions**

1. Show the app header with **Concordium / Testnet** and the payment-mode tag.
2. Keep the hero title **Before an agent pays, check the other side** visible.

**Say**

> A buyer agent can receive a valid payment request from a new seller and still need to know whether that request belongs to the seller it intended to pay. Countercheck puts the seller's registered identity and the exact payment terms in front of the transfer.

### 00:25–00:55 — Show the blocked seller

**Screen actions**

1. Scroll to **Check the counterparty**.
2. Click **Show a blocked check**.
3. Show `demo-invalid-seller` in the badge field and wait for the **seller-mismatch** result.
4. Point to the blocked state. Do not click the quote button.

**Say**

> First, I show the negative case. This badge does not match the seller bound to the local buyer policy. Countercheck blocks the flow before a quote, review, or payment.

This deliberate check uses a placeholder badge. It does not call the chain or spend funds.

### 00:55–01:30 — Verify the configured seller

**Screen actions**

1. Click **Load demo seller**.
2. Show the configured seller badge filling the field automatically.
3. Wait for **Verified for this check** and point to the checked time, registered wallet, and **Open Registry response** link if shown.

**Say**

> Now I load the demo seller configured for this buyer. Countercheck checks the live Testnet Registry, compares the Agent Card hash, and matches the registered wallet to the intended payment recipient. A badge is an identity signal; it is not an endorsement or a service-quality guarantee.

The **Check seller** button can also run this check after a badge is entered manually. The demo-seller button saves typing and uses the configured seller.

### 01:30–02:00 — Check the live payment request

**Screen actions**

1. Click **Check the live request**.
2. Wait for the quote panel.
3. Point to **Network**, **Asset**, **Amount**, **Recipient**, **Network fee**, **Quote expires**, and **Spend ceiling**.
4. Show that the quote is 1 CCD or less and the fee sponsor is displayed.

**Say**

> The buyer now fetches the seller's live x402 request. Countercheck checks the Testnet, native CCD asset, seller recipient, sponsor, expiry, and the buyer's one-CCD ceiling. This is a quote check; it does not authorize a payment.

### 02:00–02:45 — Review and approve the exact transaction

**Screen actions**

1. Click **Prepare unsigned transaction review**.
2. Scroll through the review and pause on the buyer sender, seller recipient, payment amount, sponsor, nonce, expiry, fee estimate, available balances, signer check, and **Signing digest**.
3. Point to **Exact unsigned transaction payload**.
4. Click **Approve this exact transaction**.
5. Wait for the fresh-check/approval result. Keep the separate payment button visible.

**Say**

> Countercheck prepares the exact transaction and shows what will be signed. Approval is tied to this digest. The service rechecks identity, quote, and chain details before recording approval. If the details change, the review must be prepared again.

### 02:45–03:25 — Submit, confirm, and show the receipt

**Screen actions**

1. Read the button label **Sign, pay 1 CCD, and get resource** aloud.
2. Click it once only if you intend to make this new Testnet payment.
3. Keep the settlement progress on screen; do not refresh or click again.
4. When complete, show **Paid resource delivered**, the transaction hash, amount, local receipt ID, and seller response.
5. Click **View finalized transaction on Testnet explorer**. Confirm the explorer is set to Testnet and inspect the transaction before describing it as independently checked.

**Say**

> I am authorizing the displayed one-CCD Testnet transfer. The buyer signs the reviewed digest. The facilitator sponsors the network fee, waits for finalization, and reads the finalized payment details before the seller returns the paid resource. Countercheck keeps a local hash-linked receipt for this result.

If you show the existing 19 November transaction instead of making a new payment, label it **previous recorded Testnet run** and do not present it as the result of a button click in this recording. The original capture did not include an independent explorer inspection.

### 03:25–03:45 — State the limits

**Screen actions**

1. Return to the app header and show **Concordium / Testnet**.
2. Keep the receipt visible or return to the main workflow.

**Say**

> This is a single-operator Testnet prototype. The hosted purchase gate stays off for this recording; its guest session scopes browser state but does not identify a buyer. The local receipt is hash-linked, not externally immutable, and a Registry badge does not guarantee seller behavior.

## Three-minute cut

Keep these shots in order. Trim pauses, not the approval or settlement distinction.

| Video time | Exact action | Narration point |
|---|---|---|
| 00:00–00:18 | Show the hero and Testnet header. | A structured payment request still needs a buyer-side seller and policy check. |
| 00:18–00:38 | Click **Show a blocked check**; hold on `seller-mismatch`. | Wrong configured seller; the flow stops before a quote or payment. |
| 00:38–01:00 | Click **Load demo seller**; hold on verified status and wallet. | Registry badge, Agent Card hash, and registered wallet check. |
| 01:00–01:22 | Click **Check the live request**; show quote fields. | Testnet, CCD, amount, recipient, sponsor, expiry, and one-CCD ceiling. |
| 01:22–01:55 | Click **Prepare unsigned transaction review**, point to digest, click **Approve this exact transaction**. | Exact transaction is displayed; approval is digest-bound and checks are fresh. |
| 01:55–02:35 | Click **Sign, pay 1 CCD, and get resource** once, if authorizing a new Testnet payment; show settlement and paid response. | The person makes the separate authorization; facilitator finalizes before fulfillment. |
| 02:35–02:52 | Show receipt and transaction hash; open Testnet explorer if you inspect it during capture. | Local evidence plus the transaction reference. |
| 02:52–03:00 | Show Testnet header and state the access boundary. | Hosted guest sessions scope browser state but do not identify buyers. Keep public purchases locked unless anonymous access to the shared Testnet buyer is intended. |

If settlement takes longer, keep a moment of the real progress state and edit only after the result is known. Identify any previously recorded transaction as historical. Do not splice it as if it followed the current click.

## Optional read-only appendix

Record A2A/MCP as a separate appendix; it is not needed for the three-minute cut.

1. Run `node .\demo\read-only-agent-tour.mjs` to show the buyer and seller read-only A2A actions.
2. Run `node .\demo\read-only-mcp-tour.mjs` to show the two read-only MCP tools.
3. Only show the optional Ollama assistant if it is already configured and running. It can request verification and quote checks; it cannot approve, sign, or pay.

## Stop the demo

After recording, stop the local services:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\stop-testnet-demo.ps1
```

Review the recording for secrets and personal data before sharing it. Do not claim production readiness, buyer identity authentication, market validation, or seller quality.
