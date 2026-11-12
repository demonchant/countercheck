import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const model = process.env.OLLAMA_MODEL || "llama3.2:3b";
const ollamaUrl = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/u, "");
// This model host must not load the buyer signing key from .env.
process.env.CCD_PRIVATE_KEY = "";
const { createCountercheckMcpServer } = await import("./mcp-server.mjs");
const client = new Client({ name: "countercheck-local-agent", version: "0.1.0" });
const server = createCountercheckMcpServer();
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const terminal = createInterface({ input: stdin, output: stdout });
const system = [
  "You are Countercheck, a local assistant for checking configured buyer and seller agents before a paid service call.",
  "You may call only the read-only tools provided to you: verify_counterparties and request_purchase_quote.",
  "Never claim a badge, wallet, quote, payment, or settlement is verified unless the tool result says so.",
  "If counterpart verification is blocked, unavailable, or not fully verified, do not request a quote.",
  "Never ask the user to paste identity documents, recovery phrases, private keys, or passwords.",
  "Explain that a badge is an accountability link, not an endorsement or proof of service quality.",
].join(" ");

function ollamaTool(tool) {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema || { type: "object", properties: {}, additionalProperties: false },
    },
  };
}

async function callModel(messages, tools) {
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, messages, tools, stream: false }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
  return (await response.json()).message;
}

async function answer(question, safeTools) {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: question },
  ];
  const toolSpecs = safeTools.map(ollamaTool);
  for (let turn = 0; turn < 4; turn += 1) {
    const message = await callModel(messages, toolSpecs);
    messages.push(message);
    if (!Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
      return message.content || "I could not form a response.";
    }
    for (const call of message.tool_calls) {
      const name = call.function?.name;
      const tool = safeTools.find((candidate) => candidate.name === name);
      if (!tool) {
        messages.push({ role: "tool", tool_name: name || "unknown", content: "Tool refused: it is not on the read-only allowlist." });
        continue;
      }
      try {
        console.log(`[Read-only MCP] ${name}`);
        const result = await client.callTool({ name, arguments: call.function.arguments || {} });
        console.log(`[MCP result] ${JSON.stringify(result.content || result)}`);
        messages.push({ role: "tool", tool_name: name, content: JSON.stringify(result) });
      } catch (error) {
        messages.push({ role: "tool", tool_name: name, content: JSON.stringify({ status: "unavailable", message: error.message }) });
      }
    }
  }
  return "I stopped after four tool turns. Please ask a narrower question.";
}

try {
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const { tools } = await client.listTools();
  const safeTools = tools.filter((tool) => ["verify_counterparties", "request_purchase_quote"].includes(tool.name));
  if (safeTools.length !== 2) throw new Error("Countercheck read-only MCP tools are missing.");
  console.log(`Countercheck local agent ready (${model}; payments are never available to this agent).`);
  console.log("Commands: /verify (read-only), /quote (read-only), /exit. Or ask a question. Prompts and responses stay on this laptop.");
  while (true) {
    const question = (await terminal.question("You> ")).trim();
    if (!question) continue;
    if (question === "/exit") break;
    if (question === "/verify" || question === "/quote") {
      const name = question === "/verify" ? "verify_counterparties" : "request_purchase_quote";
      try {
        console.log(`[Read-only MCP] ${name}`);
        const result = await client.callTool({ name, arguments: {} });
        console.log(`[MCP result] ${JSON.stringify(result.content || result)}\n`);
      } catch (error) {
        console.log(`Countercheck> The read-only MCP request failed: ${error.message}\n`);
      }
      continue;
    }
    try {
      console.log(`Countercheck> ${await answer(question, safeTools)}\n`);
    } catch (error) {
      console.log(`Countercheck> Local model unavailable: ${error.message}\n`);
    }
  }
} finally {
  terminal.close();
  await client.close().catch(() => {});
  await server.close().catch(() => {});
}
