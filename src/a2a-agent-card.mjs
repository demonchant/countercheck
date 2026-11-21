const CARD_DISCOVERY_PATH = "/.well-known/agent-card.json";
const SELLER_CARD_PATH = "/.well-known/seller-agent-card.json";

function originOf(resourceUrl) {
  let url;
  try { url = new URL(resourceUrl); }
  catch { throw new Error("A2A card discovery requires a valid resource URL."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("A2A card discovery requires an HTTP(S) URL without credentials.");
  }
  return url.origin;
}

const capabilities = { streaming: false, pushNotifications: false };

/** Public discovery cards describe the read-only service and make no CIS-8004 identity claim. */
export function createCountercheckAgentCards(resourceUrl) {
  const origin = originOf(resourceUrl);
  const disclaimer = "Read-only integration endpoint. This discovery card is not a CIS-8004 Agent Card, does not prove a Concordium registration, and cannot authorize, sign, or settle a payment.";
  const buyer = {
    name: "Countercheck Read-only Buyer Policy Service",
    description: `Checks configured Concordium Testnet counterparties and live x402 requirements. ${disclaimer}`,
    version: "1.0.0",
    protocolVersion: "1.0",
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    capabilities,
    skills: [
      { id: "verify-counterparties", name: "Verify counterparties", description: "Read-only configured buyer and seller Registry, Agent Card hash, and wallet checks. Request: verify_counterparties.", tags: ["concordium", "identity", "registry"] },
      { id: "request-purchase-quote", name: "Request purchase quote", description: "Read-only fresh seller x402 challenge check under the configured Testnet CCD policy. Request: request_purchase_quote.", tags: ["x402", "quote", "ccd"] },
    ],
    supportedInterfaces: [{ url: new URL("/a2a/buyer/v1", origin).href, protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
    securitySchemes: {},
    securityRequirements: [],
  };
  const seller = {
    name: "Countercheck Testnet Offer Service",
    description: `Returns the configured seller's current read-only x402 offer. ${disclaimer}`,
    version: "1.0.0",
    protocolVersion: "1.0",
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    capabilities,
    skills: [{ id: "get-x402-offer", name: "Get x402 offer", description: "Fetches the live configured seller challenge; no payment authorization or fulfillment. Request: get_x402_offer.", tags: ["x402", "ccd", "testnet"] }],
    supportedInterfaces: [{ url: new URL("/a2a/seller/v1", origin).href, protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
    securitySchemes: {},
    securityRequirements: [],
  };
  return { [CARD_DISCOVERY_PATH]: buyer, [SELLER_CARD_PATH]: seller };
}

export const COUNTERCHECK_AGENT_CARD_PATH = CARD_DISCOVERY_PATH;
export const COUNTERCHECK_SELLER_CARD_PATH = SELLER_CARD_PATH;
