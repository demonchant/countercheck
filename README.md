# Countercheck

**Verify the agent. Cap the spend. Keep the receipt.**

Countercheck is a buyer-side gate for agents that call paid services. Before requesting payment, it checks the seller's Concordium Agent Registry badge and anchored Agent Card, compares the registered payment wallet to the seller's configured recipient, and checks the x402 request against a fixed spend policy. A person authorizes the purchase; a successful result is recorded with its payment evidence.

This is an **implemented local Testnet payment path, not a completed live payment demonstration**. The local seller returns an x402 v2 exact HTTP 402 challenge for 1 CCD, Testnet, and the configured seller and sponsor. Its public Render service has not deployed: the current remote revision lacks the seller service and the deployment runs the buyer app, which does not bind to Render's public port. Both Registry agents are Active, but their on-chain `agent_uri` values remain null, so buyer identity verification and quote acceptance are blocked. No Registry update or payment was signed or submitted. Payment and settlement remain disabled.

## Status

- Concordium Agent Registry read path: live HTTP 200 responses; both Testnet badges are Active, but `agent_uri` is null and card verification is therefore blocked. Owners, `agentWallet` addresses and the buyer/seller configured accounts match. See [`docs/agent-card-integrity.md`](docs/agent-card-integrity.md).
- The buyer agent must also have a live Registry badge whose registered payment wallet matches its local testnet account.
- The event brief says to bring an agent you already run. This workspace contains Countercheck, but no existing host agent was provided or connected; eligibility depends on integrating it into the builder's existing agent and should be confirmed against Encode's event page.
- Concordium Testnet x402 v2 exact resource: local SDK-backed seller server returns HTTP 402 for exactly 1 CCD, native CCD, the configured seller payee, a 60-second timeout, and the configured sponsor. The public URL currently returns 502 `no-deploy`.
- A2A v1: local JSON-RPC endpoints now expose only read-only buyer Registry/quote checks and seller offer retrieval. They have not been verified on the public Render host. Agent Cards declare those callable paths separately from the card JSON URL.
- Sponsored settlement: facilitator policy checks the fee payer against its configured sponsor and regression tests cover missing/wrong fields. Actual buyer/sponsor signatures and settlement are unverified. The current buyer UI does not show generated nonce/expiry before the SDK signs, and facilitator signing/submission happen together at `/settle`; payments and settlement must stay off until the review boundary is redesigned and approved.
- Both configured amount ceilings are now hard limited to 1,000,000 microCCD (1 CCD), regardless of environment values.
- Agent Card integrity and seller payment-wallet match: must fail closed when either cannot be confirmed.
- Optional local agent model: `llama3.2:3b` through Ollama. Payment checks and policy remain deterministic; the model cannot make payments. The public event announcement does not state that a particular model/provider is required.
- Legal status: this prototype does not establish EU AI Act compliance or certify agent behavior or service quality.

## Local development

Prerequisites: Node.js 20 or later. Copy `.env.example` to `.env`, fill only the non-secret Registry endpoint and your own seller configuration, and keep the buyer signing key in local secret storage. The service must bind to loopback. Payment is disabled unless explicitly enabled after reviewing the configured target, asset, amount ceiling, and facilitator.

```powershell
npm install
npm run dev
npm test
npx playwright install chromium
npm run test:browser
```

The dedicated seller process is `npm run seller`. Locally it binds to loopback (port 4191), exposes only `/resource` and the two A2A JSON-RPC paths, and loads no buyer or sponsor private key. Challenge-only mode uses the x402 SDK to issue a real 1 CCD Testnet challenge and refuses paid fulfillment. Do not run it publicly until the Render settings point to this command and the required public account addresses are configured. Keep payment and settlement disabled.

Open `http://127.0.0.1:4173`. Registry checks and quote inspection are read-only. The current browser confirmation is not an adequate signing approval: it does not first display the final transaction nonce, absolute expiry, fee estimate and current balances. Keep payment disabled until that review is implemented. The server uses the buyer agent's local signing key; it never puts that key in the browser or MCP context. Sponsored gas does not make the purchase amount free.

An optional **local Ollama agent** is included to connect a local model to the Countercheck MCP tools. This laptop has `llama3.2:3b`; run `npm run agent`. It can check configured buyer/seller badges and request a read-only quote, but it is deliberately not given the payment tool. Prompts go to the local Ollama service at `127.0.0.1:11434`; no model API key is required. The host uses the MCP SDK in-process, so it does not need to spawn another process.

## Agent integration (MCP)

Countercheck exposes local stdio MCP tools for an existing agent framework. After `npm install` and local configuration, add a server entry that runs `npm run mcp` from this project directory. The available MCP tools are read-only: `verify_counterparties` and `request_purchase_quote`. Payment signing is not exposed as an MCP action; the browser review page is the only buyer authorization path in this build. The signing key stays in the local process environment and is never included in tool arguments or results.

The local Ollama/MCP integration is included as a minimal host example. Fresh Registry reads confirm both badges are Active, but neither card can be verified because its on-chain URI is null.

The standalone facilitator has its own local config and endpoints. It uses Concordium protocol-level sponsored transactions: buyer pays the service amount and sponsor pays the transaction fee. Settlement defaults to disabled.

## Review path

1. Start the local app with payment disabled.
2. Enter a real Concordium testnet badge and run the live check. A network or registry error must remain an error; it is not replaced with sample data.
3. Once both buyer and seller have real badges, the buyer badge's registered payment wallet matches its local testnet account, and a paid service/facilitator are configured, request a quote. Inspect the seller, recipient, amount, asset, network, spend cap, and sponsored-fee terms. Quote inspection works with payments disabled.
4. The browser page is not ready to sign: it does not present the final generated transaction details before the SDK creates the buyer signature. Do not use it for payment until the exact details can be reviewed and explicitly approved. Verify any future reported transaction independently in CCDExplorer and inspect the saved receipt.

The live Registry checks return data but the two cards remain unverified until their owners set a matching public URI/hash and the updates finalize. Payment quote acceptance, buyer signing, sponsor signing/submission, and explorer verification remain blocked until the exact prerequisites in [Testnet payment readiness](docs/live-testnet-readiness.md) are met. A local UI, service health response, builder parameter, or configured variable alone is not proof of a Testnet transaction.

The point-by-point state for the requested nine-step demonstration is in [Testnet payment readiness](docs/live-testnet-readiness.md).

## Browser test coverage

Playwright browser scenarios cover the payment-disabled home page, Registry outage and seller mismatch states, a read-only 1 CCD quote preview, and rejection of unmarked local API requests. The UI fixtures are not live Registry evidence and never invoke the purchase endpoint. Install Playwright's Chromium browser with `npx playwright install chromium`, then run `npm run test:browser`; run all tests with `npm run test:all`.

## Demo recording package

The existing recording files remain on the builder's machine and are not included in the source publication. They demonstrate the seller challenge only, not signatures or payment. The read-only Registry helper uses Node; payment and settlement remain disabled.
