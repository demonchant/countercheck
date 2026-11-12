import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.mjs";
import { inspectBadge } from "./registry.mjs";
import { createQuote } from "./payment.mjs";

const toolDefinitions = [
  {
    name: "verify_counterparties",
    description: "Read-only: check the configured buyer and seller badges, anchored Agent Cards, and registered payment wallets on Concordium testnet. Does not authorize payment.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "request_purchase_quote",
    description: "Read-only: recheck both configured agents and inspect the configured seller's live x402 requirements. Returns a short-lived one-use quote; does not pay.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

function resultText(value, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value) }], ...(isError ? { isError: true } : {}) };
}

export function createCountercheckMcpServer() {
  const server = new Server({ name: "countercheck", version: "0.1.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = request.params.arguments;
    if (request.params.name === "verify_counterparties") {
      if (args !== undefined && (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length)) return resultText({ status: "invalid-input", message: "This tool accepts no arguments; seller and buyer identities come from local operator configuration." }, true);
      const missing = [!config.buyerBadge && "BUYER_BADGE", !config.sellerBadge && "SELLER_BADGE", !config.accountAddress && "CCD_ACCOUNT_ADDRESS", !config.sellerPayTo && "SELLER_PAY_TO"].filter(Boolean);
      if (missing.length) return resultText({ status: "blocked", missing });
      const [buyer, seller] = await Promise.all([
        inspectBadge(config.buyerBadge, config.accountAddress),
        inspectBadge(config.sellerBadge, config.sellerPayTo),
      ]);
      return resultText({ status: buyer.status === "verified" && seller.status === "verified" ? "verified" : "blocked", network: config.network, buyer, seller });
    }
    if (request.params.name === "request_purchase_quote") {
      if (args !== undefined && (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length)) return resultText({ status: "invalid-input", message: "This tool accepts no arguments; target and policy come from local operator configuration." }, true);
      return resultText(await createQuote());
    }
    return resultText({ status: "unknown-tool" }, true);
  });
  return server;
}
