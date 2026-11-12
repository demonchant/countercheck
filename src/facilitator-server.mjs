import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const MAX_BODY_BYTES = 64 * 1024;

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) throw new Error("content_type_required");
  let length = 0;
  const chunks = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("invalid_json"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid_request");
  if (body.x402Version !== 2 || !body.paymentPayload || !body.paymentRequirements) throw new Error("invalid_request");
  return body;
}

function tokenMatches(request, token) {
  if (typeof token !== "string" || token.length < 32) return false;
  const authorization = request.headers.authorization || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expectedBuffer = Buffer.from(token);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function createFacilitatorServer({ api, config }) {
  if (!api || !config) throw new Error("Facilitator API and config are required.");
  return createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://127.0.0.1:${config.port}`);
    if (request.method === "GET" && url.pathname === "/healthz") {
      return sendJson(response, 200, { ok: true, network: config.network, settlementEnabled: Boolean(config.settlementEnabled) });
    }
    if (request.method === "GET" && url.pathname === "/supported") {
      return sendJson(response, 200, api.getSupported());
    }
    if (url.pathname !== "/verify" && url.pathname !== "/settle") return sendJson(response, 404, { error: "not_found" });
    if (request.method !== "POST") return sendJson(response, 405, { error: "method_not_allowed" });
    if (!tokenMatches(request, config.apiToken)) return sendJson(response, 401, { error: "unauthorized" });

    let body;
    try { body = await readJson(request); }
    catch (error) { return sendJson(response, error.message === "body_too_large" ? 413 : 400, { error: error.message }); }

    try {
      const result = url.pathname === "/verify"
        ? await api.verify(body.paymentPayload, body.paymentRequirements)
        : await api.settle(body.paymentPayload, body.paymentRequirements);
      return sendJson(response, 200, result);
    } catch {
      return sendJson(response, 503, { error: url.pathname === "/verify" ? "verification_unavailable" : "settlement_unresolved" });
    }
  });
}
