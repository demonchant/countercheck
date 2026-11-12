import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createA2AJsonRpcHandler } from "../src/a2a-agent.mjs";

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
