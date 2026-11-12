import { writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const registry = "https://agent-registry-mcp.concordium.com";
const agents = [
  { label: "buyer", badge: "JyP9WD3R9D4tgxwjcy8jc" },
  { label: "seller", badge: "JyP9WBwwDBZxrqhuqHWPt" },
];

async function get(path) {
  const response = await fetch(`${registry}${path}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { responseText: text }; }
  return { httpStatus: response.status, body };
}

let requestId = 0;
let sessionId;
let protocolVersion = "2025-03-26";
const endpoint = `${registry}/mcp`;
const headers = { accept: "application/json, text/event-stream", "content-type": "application/json" };

function parseMcp(text) {
  const dataLines = text.split(/\r?\n/u).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
  return JSON.parse(dataLines.length ? dataLines.at(-1) : text);
}

async function mcp(method, params = {}) {
  const id = ++requestId;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { ...headers, ...(method === "initialize" ? {} : { "mcp-protocol-version": protocolVersion }), ...(sessionId ? { "mcp-session-id": sessionId } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  sessionId ||= response.headers.get("mcp-session-id") || undefined;
  const text = await response.text();
  if (method === "notifications/initialized") return undefined;
  const payload = parseMcp(text);
  if (!response.ok || payload.error) throw new Error(`Registry MCP ${method} failed with HTTP ${response.status}`);
  if (method === "initialize") protocolVersion = payload.result?.protocolVersion || protocolVersion;
  return payload.result;
}

await mcp("initialize", { protocolVersion, capabilities: {}, clientInfo: { name: "countercheck-readonly-inspection", version: "0.1.0" } });
await mcp("notifications/initialized");

const observations = [];
for (const agent of agents) {
  const encoded = encodeURIComponent(agent.badge);
  const [checkBadge, verifyAgentCard] = await Promise.all([
    get(`/v1/check-badge/${encoded}?network=testnet`),
    get(`/v1/verify-agent-card/${encoded}?network=testnet`),
  ]);
  const record = await mcp("tools/call", { name: "agent_by_token_address", arguments: { token_address: agent.badge, network: "testnet" } });
  if (record.isError) throw new Error(`Registry could not resolve the ${agent.label} badge`);
  const recordText = record.content?.find((part) => part.type === "text")?.text;
  const parsedRecord = typeof recordText === "string" ? JSON.parse(recordText) : record.structuredContent;
  const wallet = await mcp("tools/call", { name: "get_agent_wallet", arguments: { token_id: String(parsedRecord.token_id), network: "testnet" } });
  if (wallet.isError) throw new Error(`Registry wallet lookup failed for the ${agent.label}`);
  const walletText = wallet.content?.find((part) => part.type === "text")?.text;
  observations.push({ label: agent.label, badge: agent.badge, checkBadge, verifyAgentCard, agentRecord: parsedRecord, agentWallet: walletText ? JSON.parse(walletText) : wallet.structuredContent });
}

const evidence = {
  provenance: "OBSERVED",
  observedAtUtc: new Date().toISOString(),
  network: "testnet",
  registryBase: registry,
  methods: ["GET check-badge", "GET verify-agent-card", "MCP read-only agent_by_token_address", "MCP read-only get_agent_wallet"],
  actions: "Read-only Registry inspection; no transaction was built, signed, or submitted",
  observations,
};
const output = new URL("../evidence/registry-readonly-2026-11-12.json", import.meta.url);
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "w" });
for (const item of observations) {
  console.log(JSON.stringify({
    agent: item.label,
    checkHttp: item.checkBadge.httpStatus,
    cardHttp: item.verifyAgentCard.httpStatus,
    active: item.checkBadge.body.on_chain?.status,
    agentUri: item.checkBadge.body.on_chain?.agent_uri,
    anchoredHash: item.checkBadge.body.on_chain?.metadata_hash_hex,
    badgeValid: item.checkBadge.body.badge_valid,
    cardMatch: item.verifyAgentCard.body.match,
    owner: item.agentRecord.owner_account,
    agentWallet: item.agentWallet?.agent_wallet,
  }));
}
console.log(`Saved public read-only evidence: ${output.pathname}`);
