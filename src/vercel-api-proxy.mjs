import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ROUTES = new Map([
  ["GET /api/status", "GET"],
  ["GET /api/session", "GET"],
  ["GET /api/demo-seller", "GET"],
  ["GET /api/receipts", "GET"],
  ["POST /api/verify", "POST"],
  ["POST /api/quote", "POST"],
  ["POST /api/prepare", "POST"],
  ["POST /api/approve", "POST"],
  ["POST /api/purchase", "POST"],
  ["POST /api/receipt/acknowledge", "POST"],
]);

const SESSION_ROUTES = new Set([
  "GET /api/session",
  "GET /api/receipts",
  "POST /api/quote",
  "POST /api/prepare",
  "POST /api/approve",
  "POST /api/purchase",
  "POST /api/receipt/acknowledge",
]);

const GUEST_COOKIE = "countercheck_guest";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24;

function guestCookieValue(request) {
  const cookies = String(request.headers?.cookie || "").split(";");
  return cookies.map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${GUEST_COOKIE}=`))?.slice(GUEST_COOKIE.length + 1) || "";
}

function guestIdentity(request, response, apiToken, secureCookie) {
  const key = createHash("sha256").update(apiToken).digest();
  const value = guestCookieValue(request);
  const [issuedAtText, id, suppliedSignature, extra] = value.split(".");
  const issuedAt = Number(issuedAtText);
  const nowSeconds = Math.floor(Date.now() / 1_000);
  let valid = false;
  if (!extra && /^\d{10}$/u.test(issuedAtText || "") && nowSeconds >= issuedAt && nowSeconds - issuedAt <= GUEST_COOKIE_MAX_AGE
    && /^[a-f0-9]{64}$/u.test(id || "") && /^[a-f0-9]{64}$/u.test(suppliedSignature || "")) {
    const expected = createHmac("sha256", key).update(`${issuedAtText}.${id}`).digest();
    const supplied = Buffer.from(suppliedSignature, "hex");
    valid = supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }
  const sessionId = valid ? `${issuedAtText}_${id}` : `${nowSeconds}_${randomBytes(32).toString("hex")}`;
  if (!valid) {
    const [newIssuedAt, randomId] = sessionId.split("_");
    const signature = createHmac("sha256", key).update(`${newIssuedAt}.${randomId}`).digest("hex");
    response.setHeader?.("set-cookie", `${GUEST_COOKIE}=${newIssuedAt}.${randomId}.${signature}; Path=/; Max-Age=${GUEST_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secureCookie ? "; Secure" : ""}`);
  }
  return {
    ownerKey: `user_guest_${sessionId}:sess_guest_${sessionId}`,
  };
}

export function allowedBuyerApiRoute(method, requestUrl) {
  let url;
  try { url = new URL(requestUrl, "https://vercel.invalid"); }
  catch { return false; }
  return !url.search && ROUTES.get(`${method} ${url.pathname}`) === method;
}

export function resolveBuyerApiOrigin(value, { vercel = true } = {}) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error("COUNTERCHECK_API_ORIGIN must be an HTTPS origin."); }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash
    || (vercel ? url.protocol !== "https:" : !["http:", "https:"].includes(url.protocol))) {
    throw new Error("COUNTERCHECK_API_ORIGIN must be a clean HTTPS origin without credentials, path, query, or fragment.");
  }
  return url.origin;
}

async function readRequestBody(request) {
  if (request.body !== undefined && request.body !== null) {
    if (Buffer.isBuffer(request.body)) return request.body;
    if (typeof request.body === "string") return Buffer.from(request.body);
    return Buffer.from(JSON.stringify(request.body));
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 8_192) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

export async function handleBuyerApiProxy(request, response, env = process.env) {
  if (env.COUNTERCHECK_API_PROXY_ENABLED !== "true") return sendJson(response, 503, { error: "api_proxy_not_configured" });
  if (!allowedBuyerApiRoute(request.method || "", request.url || "/")) return sendJson(response, 404, { error: "not_found" });
  const method = request.method || "";
  const pathname = new URL(request.url, "https://vercel.invalid").pathname;
  const purchasesEnabled = env.COUNTERCHECK_PUBLIC_PURCHASES_ENABLED === "true";
  if (pathname === "/api/status" && method === "GET") {
    return proxyToBuyerApi(request, response, env, pathname, undefined, { purchasesEnabled });
  }
  const token = env.COUNTERCHECK_API_TOKEN || "";
  if (token.length < 32) return sendJson(response, 503, { error: "api_proxy_not_configured" });
  if (pathname === "/api/session" && method === "GET") {
    guestIdentity(request, response, token, env.VERCEL === "1");
    return sendJson(response, 200, { guestSession: true, purchasesEnabled });
  }
  let identity;
  if (SESSION_ROUTES.has(`${method} ${pathname}`)) {
    identity = guestIdentity(request, response, token, env.VERCEL === "1");
    if (!purchasesEnabled && pathname !== "/api/receipts") return sendJson(response, 403, { error: "testnet_purchases_not_enabled" });
  }

  return proxyToBuyerApi(request, response, env, pathname, identity, { purchasesEnabled });
}

async function proxyToBuyerApi(request, response, env, pathname, identity, config) {
  const token = env.COUNTERCHECK_API_TOKEN || "";
  if (token.length < 32) return sendJson(response, 503, { error: "api_proxy_not_configured" });
  let origin;
  try { origin = resolveBuyerApiOrigin(env.COUNTERCHECK_API_ORIGIN || "", { vercel: env.VERCEL === "1" }); }
  catch { return sendJson(response, 503, { error: "api_proxy_not_configured" }); }

  const method = request.method || "";
  let body;
  const headers = { accept: "application/json", authorization: `Bearer ${token}` };
  if (identity) headers["x-countercheck-user-id"] = identity.ownerKey;
  if (method === "POST") {
    if (!String(request.headers?.["content-type"] || "").toLowerCase().startsWith("application/json")) {
      return sendJson(response, 415, { error: "content_type_required" });
    }
    try { body = await readRequestBody(request); }
    catch (error) { return sendJson(response, error.message === "body_too_large" ? 413 : 400, { error: "invalid_request" }); }
    if (body.length > 8_192) return sendJson(response, 413, { error: "body_too_large" });
    headers["content-type"] = "application/json";
  }

  try {
    const upstream = await fetch(new URL(pathname, `${origin}/`), {
      method,
      headers,
      ...(method === "POST" ? { body } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await upstream.arrayBuffer();
    if (payload.byteLength > 65_536) return sendJson(response, 502, { error: "api_response_too_large" });
    let output = Buffer.from(payload);
    if (pathname === "/api/status" && upstream.ok) {
      try {
        const status = JSON.parse(output.toString("utf8"));
        status.publicPurchasesEnabled = config.purchasesEnabled;
        status.paymentEnabled = status.paymentEnabled === true && status.settlementEnabled === true && config.purchasesEnabled;
        output = Buffer.from(JSON.stringify(status));
      } catch { return sendJson(response, 502, { error: "buyer_api_invalid_response" }); }
    }
    response.writeHead(upstream.status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    response.end(output);
  } catch {
    return sendJson(response, 502, { error: "buyer_api_unavailable" });
  }
}

export function createBuyerApiProxyHandler(pathname) {
  return async function buyerApiProxyHandler(request, response) {
    const incomingUrl = request.url || "";
    const queryStart = incomingUrl.indexOf("?");
    request.url = `${pathname}${queryStart === -1 ? "" : incomingUrl.slice(queryStart)}`;
    return handleBuyerApiProxy(request, response);
  };
}
