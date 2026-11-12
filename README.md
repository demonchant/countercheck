# Countercheck

**Verify the agent. Cap the spend. Keep the receipt.**

Countercheck is a buyer-side gate for agents that call paid services. Before requesting payment, it checks the seller's Concordium Agent Registry badge and anchored Agent Card, compares the registered payment wallet to the seller's configured recipient, and checks the x402 request against a fixed spend policy. A person authorizes the purchase; a successful result is recorded with its payment evidence.

This is an **implemented local prototype, not a live testnet payment deployment**. The builder reports that buyer, seller and sponsor Testnet accounts are funded and that buyer/seller agents are registered with matching payment wallets; those claims have not been independently checked here. The local x402 facilitator and mocked tests are implemented, but it has not been started against Testnet, and no transaction has been signed or broadcast.

## Status

- Concordium Agent Registry read path: implementation in progress; live testnet behavior unverified.
- The buyer agent must also have a live Registry badge whose registered payment wallet matches its local testnet account.
- The event brief says to bring an agent you already run. This workspace contains Countercheck, but no existing host agent was provided or connected; eligibility depends on integrating it into the builder's existing agent and should be confirmed against Encode's event page.
- Concordium testnet x402 sponsored payment: local facilitator implementation exists; live signing/settlement remains disabled and unverified pending sponsor key configuration, a seller x402 server configured to call this facilitator, and separate explicit approval.
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

Open `http://127.0.0.1:4173`. Registry checks and quote inspection are read-only. In browser mode, a purchase needs fresh successful badge/card checks, must pass the configured policy, and receives a separate user confirmation. The server uses the buyer agent's local signing key; it never puts that key in the browser or MCP context. Sponsored gas does not make the purchase amount free.

An optional **local Ollama agent** is included to connect a local model to the Countercheck MCP tools. This laptop has `llama3.2:3b`; run `npm run agent`. It can check configured buyer/seller badges and request a read-only quote, but it is deliberately not given the payment tool. Prompts go to the local Ollama service at `127.0.0.1:11434`; no model API key is required. The host uses the MCP SDK in-process, so it does not need to spawn another process.

## Agent integration (MCP)

Countercheck also exposes local stdio MCP tools for an existing agent framework. After `npm install` and local configuration, add a server entry that runs `npm run mcp` from this project directory. `verify_counterparties` and `request_purchase_quote` are read-only; `purchase_within_policy` can sign and pay, so enabling `PAYMENTS_ENABLED=true` while granting this tool is the local operator's standing authorization for purchases within the configured seller, native CCD network, buyer account, and amount cap. The agent cannot supply or change those values. Do not attach the MCP server to an untrusted or shared agent runtime. The signing key stays in the local process environment and is never included in tool arguments or results.

The local Ollama/MCP integration is included as a minimal host example. It has not yet completed live Registry checks because no buyer or seller badges are configured.

The standalone facilitator has its own local config and endpoints. It uses Concordium protocol-level sponsored transactions: buyer pays the service amount and sponsor pays the transaction fee. Settlement defaults to disabled.

## Review path

1. Start the local app with payment disabled.
2. Enter a real Concordium testnet badge and run the live check. A network or registry error must remain an error; it is not replaced with sample data.
3. Once both buyer and seller have real badges, the buyer badge's registered payment wallet matches its local testnet account, and a paid service/facilitator are configured, request a quote. Inspect the seller, recipient, amount, asset, network, spend cap, and sponsored-fee terms. Quote inspection works with payments disabled.
4. In the browser, confirm the purchase explicitly. In MCP mode, grant `purchase_within_policy` only with full awareness that it uses the configured local policy as standing authorization. Verify any reported transaction independently in CCDExplorer and inspect the saved receipt.

The last two steps remain blocked until the required external resources exist. A local UI or configured variable alone is not proof of testnet behavior.

## Browser test coverage

Playwright browser scenarios cover the payment-disabled home page, Registry outage and seller mismatch states, a read-only 1 CCD quote preview, and rejection of unmarked local API requests. The UI fixtures are not live Registry evidence and never invoke the purchase endpoint. Install Playwright's Chromium browser with `npx playwright install chromium`, then run `npm run test:browser`; run all tests with `npm run test:all`.
