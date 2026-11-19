# Live demo readiness — 19 November 2026

## Observed full workflow

The full local Testnet path completed once on 19 November. A mismatched seller badge was rejected before payment. The configured seller then passed a live Registry/card/wallet check; its live x402 quote passed policy; the app prepared an exact unsigned transaction; the server recorded approval bound to its signing digest after fresh checks; the buyer signed that digest; the local facilitator verified and settled; a second Concordium Testnet gRPC read confirmed the finalized sender, recipient, amount, and CCD asset; and the seller returned its paid JSON resource.

The payment was exactly 1 CCD (`1,000,000` microCCD). The sponsor paid the estimated network fee of `4,621,359` microCCD. The transaction is [`71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147`](https://testnet.ccdscan.io/?d=transaction&dsh=71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147). A hash-linked local receipt and qualification record were written. The explorer was not independently inspected during the capture; see [`../evidence/live-e2e-2026-11-19.json`](../evidence/live-e2e-2026-11-19.json).

This proves the configured local Testnet workflow worked once. It does not prove production readiness, broad reliability, public deployment, user demand, or market validation.

## Start and stop

For the challenge-only demo, run `.\demo\start-safe-demo.ps1`. It blanks signing keys and tokens and refuses paid fulfillment.

For the full local Testnet path, ensure the private `.env` contains the configured buyer, seller, sponsor, badges, API token, 1 CCD cap, and local resource settings. Then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\start-testnet-demo.ps1 -EnableTestnetSettlement
```

Open `http://127.0.0.1:4173`. The launcher binds every service to loopback and confirms payment configuration and seller/facilitator settlement state. It makes no payment at startup. The separate **Sign, pay 1 CCD, and get resource** button broadcasts one Testnet transfer after review and approval.

Stop with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\demo\stop-testnet-demo.ps1
```

Never screen-record `.env`, terminal environment values, service logs, wallet exports, or private keys. The app only displays account addresses, public transaction data, and the exact user-approved transaction payload.

## Capability evidence

| Capability | Current evidence | Boundary |
|---|---|---|
| Failed seller check | Live `seller-mismatch` response for a badge other than the configured seller | Local seller-binding policy rejection; no payment attempted. |
| Seller identity/card/wallet | Live configured badge returned `verified` in the successful run | Registration and hash/wallet match only, not conduct or quality. |
| x402 policy and spend cap | Live exact 1 CCD Testnet native CCD quote accepted | One configured seller and one supported native-CCD amount. |
| Exact transaction review | Live Testnet nonce, balances, chain parameters, signer-key match, unsigned payload, fee, expiry, and digest produced | Buyer account and first credential must use supported 1-of-1 key threshold. |
| Digest approval and buyer signature | Approval rechecked and bound to exact digest; successful settlement used that digest | Local configured key; not a wallet extension or multi-user custody system. |
| Facilitator/sponsored settlement | Authenticated local service verified and settled one transaction | Local single-process store/replay guard; testnet only. Sponsor funds the fee. |
| Finality and paid resource | Second facilitator gRPC read matched finalized details; seller response contained `paid: true` | No separate explorer API read was made in the capture. |
| Local receipt | Hash-linked receipt and appended qualification note recorded | Local file, not externally anchored or immutable. |
| A2A and MCP | Implemented read-only buyer/seller actions and two MCP tools | Not exercised in the payment evidence run. |
| Optional Ollama assistant | Local-model wrapper only calls the two read-only MCP tools | Requires local Ollama/model; no quality evaluation, no signing authority. |
| Hackathon delivery | Event source says Testnet project, description, public repo, video up to 3 minutes, explorer link, and short go-live plan | Eligibility wording and exact Encode portal requirements remain partly unknown; no public release or submission receipt is established. |
| Problem validation | Ecosystem proposals and competitor review documented | No direct buyer interviews, incident-rate evidence, adoption data, or willingness-to-pay validation. |

## Recording notes

The complete screen-recording script is [`../DEMO_SCRIPT.md`](../DEMO_SCRIPT.md). It includes a full work demo that covers the UI and agent interfaces, plus a three-minute edit aligned with the published video limit. The dated read-only preflight remains available at [`../evidence/live-demo-preflight-2026-11-19.json`](../evidence/live-demo-preflight-2026-11-19.json); do not confuse it with the later paid run.
