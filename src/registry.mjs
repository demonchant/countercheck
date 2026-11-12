import { config } from "./config.mjs";

const timeoutMs = 8_000;
const badgePattern = /^[1-9A-HJ-NP-Za-km-z]{12,120}$/u;

async function getJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.registryBase}${path}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      redirect: "error",
    });
    const body = await response.json().catch(() => null);
    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

function jsonToolValue(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseSseOrJson(response, raw) {
  if (!raw) return null;
  if (!raw.includes("data:")) {
    try { return JSON.parse(raw); } catch { return null; }
  }
  const frames = raw.split(/\r?\n/u).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
  for (const frame of frames.reverse()) {
    try { return JSON.parse(frame); } catch { /* Ignore non-JSON SSE frames. */ }
  }
  return null;
}

async function callMcpTool(name, badge) {
  const endpoint = `${config.registryBase}/mcp`;
  const headers = { accept: "application/json, text/event-stream", "content-type": "application/json" };
  let sessionId;
  let protocolVersion = "2025-03-26";
  let id = 0;
  const request = async (method, params = {}) => {
    const currentId = ++id;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { ...headers, ...(method === "initialize" ? {} : { "mcp-protocol-version": protocolVersion }), ...(sessionId ? { "mcp-session-id": sessionId } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: currentId, method, params }),
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    sessionId ||= response.headers.get("mcp-session-id") || undefined;
    const raw = await response.text();
    const payload = parseSseOrJson(response, raw);
    if (!response.ok || payload?.error) throw new Error(payload?.error?.message || `Registry MCP returned HTTP ${response.status}`);
    if (method === "initialize" && typeof payload?.result?.protocolVersion === "string") protocolVersion = payload.result.protocolVersion;
    return payload?.result;
  };

  await request("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "countercheck", version: "0.1.0" },
  });
  await fetch(endpoint, {
    method: "POST",
    headers: { ...headers, "mcp-protocol-version": protocolVersion, ...(sessionId ? { "mcp-session-id": sessionId } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }),
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const tools = await request("tools/list");
  const tool = tools?.tools?.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Registry MCP tool ${name} is not available`);

  const properties = tool.inputSchema?.properties || {};
  const args = {};
  const badgeKey = ["badge", "token_address", "id", "agent_token_address"].find((key) => key in properties);
  if (badgeKey) {
    args[badgeKey] = badge;
  } else if (name === "get_agent_wallet" && "token_id" in properties) {
    // Current Registry MCP accepts token_id for get_agent_wallet, while
    // Countercheck receives the public token-address badge. Resolve the ID
    // through the Registry before making the wallet lookup.
    const resolver = tools?.tools?.find((candidate) => candidate.name === "agent_by_token_address");
    if (!resolver) throw new Error("Registry MCP cannot resolve a badge token address");
    const resolved = await request("tools/call", {
      name: "agent_by_token_address",
      arguments: { token_address: badge, network: "testnet" },
    });
    if (resolved?.isError) throw new Error("Registry MCP could not resolve the badge token address");
    const resolvedText = resolved?.content?.find((item) => item.type === "text")?.text;
    const record = jsonToolValue(resolvedText);
    if (!record || !/^\d+$/u.test(String(record.token_id ?? ""))) {
      throw new Error("Registry MCP returned no valid token ID for the badge");
    }
    args.token_id = String(record.token_id);
  } else {
    throw new Error(`Registry MCP ${name} input schema changed; no badge field was found`);
  }
  if ("network" in properties) args.network = "testnet";

  const result = await request("tools/call", { name, arguments: args });
  if (result?.isError) throw new Error("Registry MCP tool returned an error");
  const text = result?.content?.find((item) => item.type === "text")?.text;
  return text ? jsonToolValue(text) : result?.structuredContent || result;
}

function boolAt(object, keys) {
  for (const key of keys) if (typeof object?.[key] === "boolean") return object[key];
  return null;
}

function findBool(root, candidates) {
  const queue = [root];
  const seen = new Set();
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    const direct = boolAt(value, candidates);
    if (direct !== null) return direct;
    for (const child of Object.values(value)) if (child && typeof child === "object") queue.push(child);
  }
  return null;
}

function findString(root, keys) {
  const queue = [root];
  const seen = new Set();
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    for (const key of keys) if (typeof value[key] === "string" && value[key]) return value[key];
    for (const child of Object.values(value)) if (child && typeof child === "object") queue.push(child);
  }
  return null;
}

function walletValue(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return null;
  return findString(value, ["agentWallet", "agent_wallet", "wallet", "address", "value", "text"]);
}

function sameAddress(left, right) {
  if (!left || !right) return false;
  if (/^0x[0-9a-f]{40}$/iu.test(left) && /^0x[0-9a-f]{40}$/iu.test(right)) return left.toLowerCase() === right.toLowerCase();
  return left === right;
}

export async function inspectBadge(badge, expectedPayTo = "") {
  if (!badgePattern.test(badge || "")) {
    return { status: "invalid-input", message: "Enter a Concordium Agent Registry badge token address." };
  }

  try {
    const encoded = encodeURIComponent(badge);
    const [check, card] = await Promise.all([
      getJson(`/v1/check-badge/${encoded}?network=testnet`),
      getJson(`/v1/verify-agent-card/${encoded}?network=testnet`),
    ]);
    if (!check.response.ok || !card.response.ok) {
      const status = check.response.status === 409 || card.response.status === 409 ? "revoked" : "unavailable";
      return { status, message: `Registry check did not complete (badge ${check.response.status}, card ${card.response.status}).` };
    }

    const badgeActive = findBool(check.body, ["active", "isActive", "is_active"]);
    const checkOk = findBool(check.body, ["valid", "verified", "success", "badgeValid", "badge_valid"]);
    const cardMatches = findBool(card.body, ["match", "matches", "hashMatch", "hash_match"]);
    const checkStatus = findString(check.body, ["status"]);
    const active = badgeActive ?? (checkStatus ? checkStatus.toLowerCase() === "active" : null);
    const onchainWallet = walletValue(await callMcpTool("get_agent_wallet", badge));
    if (active !== true || cardMatches !== true || (checkOk === false)) {
      return {
        status: active === false ? "revoked" : "unverified",
        message: "The Registry response did not prove an active badge and matching Agent Card. Payment is blocked.",
        active,
        cardMatches,
      };
    }
    if (!onchainWallet) {
      return { status: "wallet-missing", message: "The Registry did not return an agentWallet. Payment is blocked.", active, cardMatches };
    }
    const recipientMatches = expectedPayTo ? sameAddress(onchainWallet, expectedPayTo) : null;
    if (expectedPayTo && !recipientMatches) {
      return { status: "payee-mismatch", message: "The registered agentWallet does not match the configured x402 recipient.", active, cardMatches, recipientMatches };
    }
    return {
      status: "verified",
      message: "Active Registry entry, Agent Card hash, and registered payment wallet were checked on Concordium testnet.",
      active: true,
      cardMatches: true,
      onchainWallet,
      recipientMatches,
      checkedAt: new Date().toISOString(),
      evidenceUrl: `${config.registryBase}/v1/check-badge/${encoded}?network=testnet`,
    };
  } catch (error) {
    return {
      status: "unavailable",
      message: error.name === "TimeoutError" || error.name === "AbortError" ? "Registry check timed out. No payment was made." : "Registry verification is unavailable. No payment was made.",
    };
  }
}
