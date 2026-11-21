import { randomUUID } from "node:crypto";
import { ClientFactory } from "@a2a-js/sdk/client";
import { compareAgentOfferToQuote } from "../src/a2a-workflow.mjs";
import { COUNTERCHECK_SELLER_CARD_PATH } from "../src/a2a-agent-card.mjs";

const localOrigin = process.env.COUNTERCHECK_DEMO_ORIGIN || "http://127.0.0.1:4191";
const clientFactory = new ClientFactory();

function checkedOrigin(value) {
  const url = new URL(value);
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]).has(url.hostname);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash
    || !(url.protocol === "https:" || (url.protocol === "http:" && loopback))) {
    throw new Error("Set COUNTERCHECK_DEMO_ORIGIN to an HTTPS origin or local loopback HTTP origin.");
  }
  return url.origin;
}

function resultText(result) {
  const message = result?.message || result;
  const parts = message?.parts || result?.artifacts?.flatMap((artifact) => artifact.parts || []) || [];
  const part = parts.find((item) => item?.content?.$case === "text" || typeof item?.text === "string");
  const text = part?.content?.value ?? part?.text;
  if (typeof text !== "string") throw new Error("A2A agent returned no text result.");
  return JSON.parse(text);
}

async function ask(client, command) {
  const result = await client.sendMessage({
    message: {
      messageId: randomUUID(),
      role: "ROLE_USER",
      parts: [{ content: { $case: "text", value: command } }],
    },
    configuration: { acceptedOutputModes: ["text/plain"], returnImmediately: false },
  });
  return resultText(result);
}

try {
  const origin = checkedOrigin(localOrigin);
  const buyer = await clientFactory.createFromUrl(origin);
  const seller = await clientFactory.createFromUrl(origin, COUNTERCHECK_SELLER_CARD_PATH);
  const offer = await ask(seller, "get_x402_offer");
  const identity = await ask(buyer, "verify_counterparties");
  const quote = await ask(buyer, "request_purchase_quote");
  const comparison = compareAgentOfferToQuote(offer, quote);
  console.log(JSON.stringify({
    protocol: "A2A v1 Agent Card discovery + JSON-RPC via @a2a-js/sdk ClientFactory",
    coordinator: "Deterministic software buyer; no human actor or model makes authorization decisions.",
    calls: [
      { agent: "Countercheck Seller", request: "get_x402_offer", status: offer.status, payment: offer.payment },
      { agent: "Countercheck Buyer", request: "verify_counterparties", status: identity.status },
      { agent: "Countercheck Buyer", request: "request_purchase_quote", status: quote.status, payment: quote.payment },
    ],
    decision: comparison,
    safety: "The SDK discovers each read-only integration card over HTTP and calls both declared A2A endpoints. Seller offer text is treated as untrusted; the buyer independently requests a fresh quote and compares exact terms. This tour does not sign, approve, settle, or pay.",
    limitation: "The discovered cards describe public integration services; they are not CIS-8004 Agent Cards and do not attest to Registry identity. The buyer, seller, and coordinator were built for this project, so this does not establish a pre-existing third-party agent or autonomous purchase.",
  }, null, 2));
  if (comparison.status !== "matched_read_only" || identity.status !== "verified") process.exitCode = 1;
} catch {
  console.error("A2A SDK interoperability tour failed. Start the local Testnet demo and verify its read-only configuration; no payment was attempted.");
  process.exitCode = 1;
}
