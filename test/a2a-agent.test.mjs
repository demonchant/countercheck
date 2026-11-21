import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createA2AJsonRpcHandler } from "../src/a2a-agent.mjs";
import { createCountercheckAgentCards, COUNTERCHECK_AGENT_CARD_PATH, COUNTERCHECK_SELLER_CARD_PATH } from "../src/a2a-agent-card.mjs";
import { ClientFactory } from "@a2a-js/sdk/client";

const cardPath = new URL("../agent-cards/countercheck-buyer-1147.json", import.meta.url);

async function withServer(handler, callback) {
  const server = createServer((request, response) => handler(request, response));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try { await callback(`http://127.0.0.1:${port}/a2a/buyer/v1`); }
  finally { server.close(); await once(server, "close"); }
}

function sendMessage(text) {
  return {
    jsonrpc: "2.0",
    id: "test-1",
    method: "SendMessage",
    params: {
      message: {
        messageId: "message-1",
        role: "ROLE_USER",
        parts: [{ text }],
      },
      configuration: { acceptedOutputModes: ["text/plain"], returnImmediately: false },
    },
  };
}

test("A2A v1 JSON-RPC invokes a real read-only action and returns its result", async () => {
  let called = false;
  const handler = createA2AJsonRpcHandler({
    cardPath,
    actions: { verify_counterparties: async () => { called = true; return { status: "blocked", reason: "test action result" }; } },
  });
  await withServer(handler, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "a2a-version": "1.0" },
      body: JSON.stringify(sendMessage("verify_counterparties")),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(called, true);
    assert.equal(body.result.message.parts[0].text, JSON.stringify({ status: "blocked", reason: "test action result" }));
  });
});

test("official A2A SDK client interoperates with the Countercheck JSON-RPC endpoint", async () => {
  const handler = createA2AJsonRpcHandler({
    cardPath,
    actions: { verify_counterparties: async () => ({ status: "verified", source: "test fixture" }) },
  });
  await withServer(handler, async (endpoint) => {
    const card = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(cardPath, "utf8")));
    card.supportedInterfaces[0].url = endpoint;
    const client = await new ClientFactory().createFromAgentCard(card);
    const result = await client.sendMessage({
      message: {
        messageId: "sdk-interoperability-test",
        role: "ROLE_USER",
        parts: [{ content: { $case: "text", value: "verify_counterparties" } }],
      },
      configuration: { acceptedOutputModes: ["text/plain"], returnImmediately: false },
    });
    const responseMessage = result.message || result;
    const responseText = responseMessage.parts?.[0]?.content?.value;
    assert.deepEqual(JSON.parse(responseText), { status: "verified", source: "test fixture" });
  });
});

test("A2A SDK discovers the read-only buyer and seller cards and calls both declared endpoints", async () => {
  const buyerHandler = createA2AJsonRpcHandler({
    cardPath,
    actions: {
      verify_counterparties: async () => ({ status: "verified", proof: "fixture" }),
      request_purchase_quote: async () => ({ status: "quoted", payment: { network: "ccd:testnet" } }),
    },
  });
  const sellerHandler = createA2AJsonRpcHandler({
    cardPath,
    actions: { get_x402_offer: async () => ({ status: "challenge_available", payment: { network: "ccd:testnet" } }) },
  });
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && discoveryCards[url.pathname]) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(discoveryCards[url.pathname]));
      return;
    }
    if (url.pathname === "/a2a/buyer/v1") return buyerHandler(request, response);
    if (url.pathname === "/a2a/seller/v1") return sellerHandler(request, response);
    response.writeHead(404); response.end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const discoveryCards = createCountercheckAgentCards(`${origin}/resource`);
  try {
    const factory = new ClientFactory();
    const buyer = await factory.createFromUrl(origin);
    const seller = await factory.createFromUrl(origin, COUNTERCHECK_SELLER_CARD_PATH);
    assert.equal(discoveryCards[COUNTERCHECK_AGENT_CARD_PATH].supportedInterfaces[0].url, `${origin}/a2a/buyer/v1`);
    assert.match(discoveryCards[COUNTERCHECK_AGENT_CARD_PATH].description, /not a CIS-8004 Agent Card/u);
    assert.equal(discoveryCards[COUNTERCHECK_SELLER_CARD_PATH].supportedInterfaces[0].url, `${origin}/a2a/seller/v1`);
    const buyerResult = await buyer.sendMessage({
      message: { messageId: "discovery-buyer", role: "ROLE_USER", parts: [{ content: { $case: "text", value: "verify_counterparties" } }] },
      configuration: { acceptedOutputModes: ["text/plain"], returnImmediately: false },
    });
    const sellerResult = await seller.sendMessage({
      message: { messageId: "discovery-seller", role: "ROLE_USER", parts: [{ content: { $case: "text", value: "get_x402_offer" } }] },
      configuration: { acceptedOutputModes: ["text/plain"], returnImmediately: false },
    });
    const buyerMessage = buyerResult.message || buyerResult;
    const sellerMessage = sellerResult.message || sellerResult;
    assert.deepEqual(JSON.parse(buyerMessage.parts[0].content.value), { status: "verified", proof: "fixture" });
    assert.deepEqual(JSON.parse(sellerMessage.parts[0].content.value), { status: "challenge_available", payment: { network: "ccd:testnet" } });
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("A2A endpoint rejects unsupported versions and does not execute an action", async () => {
  let called = false;
  const handler = createA2AJsonRpcHandler({
    cardPath,
    actions: { verify_counterparties: async () => { called = true; return { status: "verified" }; } },
  });
  await withServer(handler, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "a2a-version": "0.3" },
      body: JSON.stringify(sendMessage("verify_counterparties")),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "unsupported_a2a_version" });
    assert.equal(called, false);
  });
});

test("A2A v1 endpoint rejects a missing A2A-Version header", async () => {
  const handler = createA2AJsonRpcHandler({ cardPath, actions: { verify_counterparties: async () => ({ status: "verified" }) } });
  await withServer(handler, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sendMessage("verify_counterparties")),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "unsupported_a2a_version" });
  });
});

test("A2A browser preflight permits only the read-only JSON-RPC method and protocol headers", async () => {
  const handler = createA2AJsonRpcHandler({ cardPath, actions: {} });
  await withServer(handler, async (url) => {
    const response = await fetch(url, { method: "OPTIONS" });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
    assert.match(response.headers.get("access-control-allow-headers"), /a2a-version/iu);
  });
});

test("A2A endpoint rejects undeclared request commands", async () => {
  const handler = createA2AJsonRpcHandler({ cardPath, actions: { verify_counterparties: async () => ({ status: "verified" }) } });
  await withServer(handler, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "a2a-version": "1.0" },
      body: JSON.stringify(sendMessage("purchase")),
    });
    const body = await response.json();
    assert.equal(body.result.message.parts[0].text.includes("unsupported_request"), true);
    assert.equal(body.result.message.parts[0].text.includes("purchase"), false);
  });
});

test("A2A endpoint enforces a process-wide ceiling across client addresses", async () => {
  let called = 0;
  const handler = createA2AJsonRpcHandler({
    cardPath,
    actions: { verify_counterparties: async () => { called += 1; return { status: "verified" }; } },
    processRateLimitOptions: { limit: 1, windowMs: 60_000, maxEntries: 1 },
  });
  await withServer(handler, async (url) => {
    const send = () => fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "a2a-version": "1.0" },
      body: JSON.stringify(sendMessage("verify_counterparties")),
    });
    assert.equal((await send()).status, 200);
    const limited = await send();
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), { error: "rate_limited" });
    assert.equal(called, 1);
  });
});
