import { verifyToken } from "@clerk/backend";

const ROUTES = new Map([
  ["GET /api/status", "GET"],
  ["GET /api/session", "GET"],
  ["GET /api/receipts", "GET"],
  ["POST /api/verify", "POST"],
  ["POST /api/quote", "POST"],
  ["POST /api/prepare", "POST"],
  ["POST /api/approve", "POST"],
  ["POST /api/purchase", "POST"],
  ["POST /api/receipt/acknowledge", "POST"],
]);

const USER_ROUTES = new Set([
  "GET /api/receipts",
  "POST /api/quote",
  "POST /api/prepare",
  "POST /api/approve",
  "POST /api/purchase",
  "POST /api/receipt/acknowledge",
]);

function list(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function authConfig(env) {
  const publishableKey = env.CLERK_PUBLISHABLE_KEY || "";
  const jwtKey = env.CLERK_JWT_KEY || "";
  const authorizedParties = list(env.CLERK_AUTHORIZED_PARTIES);
  const allowedUserIds = new Set(list(env.COUNTERCHECK_ALLOWED_USER_IDS));
  const enabled = publishableKey.startsWith("pk_") && jwtKey.includes("BEGIN PUBLIC KEY") && authorizedParties.length > 0;
  const purchasesEnabled = enabled
    && allowedUserIds.size > 0
    && env.COUNTERCHECK_PUBLIC_PURCHASES_ENABLED === "true";
  return { publishableKey, jwtKey, authorizedParties, allowedUserIds, enabled, purchasesEnabled };
}

export function publicBuyerAuthConfig(env = process.env) {
  const config = authConfig(env);
  return {
    enabled: config.enabled,
    publishableKey: config.enabled ? config.publishableKey : "",
    purchasesEnabled: config.purchasesEnabled,
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

async function authenticateBuyer(request, config) {
  const authorization = String(request.headers?.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return { error: { status: 401, code: "sign_in_required" } };
  try {
    const verified = await verifyToken(token, {
      jwtKey: config.jwtKey,
      authorizedParties: config.authorizedParties,
    });
    const claims = verified.data;
    if (verified.errors || typeof claims?.sub !== "string" || typeof claims?.sid !== "string") {
      return { error: { status: 401, code: "invalid_session" } };
    }
    return {
      userId: claims.sub,
      sessionId: claims.sid,
      ownerKey: `${claims.sub}:${claims.sid}`,
      allowed: config.allowedUserIds.has(claims.sub),
    };
  } catch {
    return { error: { status: 401, code: "invalid_session" } };
  }
}

export async function handleBuyerAuthConfig(request, response, env = process.env) {
  if (request.method !== "GET" || (request.url && new URL(request.url, "https://vercel.invalid").search)) {
    return sendJson(response, 404, { error: "not_found" });
  }
  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(publicBuyerAuthConfig(env)));
}

export async function handleBuyerApiProxy(request, response, env = process.env) {
  if (env.COUNTERCHECK_API_PROXY_ENABLED !== "true") return sendJson(response, 503, { error: "api_proxy_not_configured" });
  if (!allowedBuyerApiRoute(request.method || "", request.url || "/")) return sendJson(response, 404, { error: "not_found" });
  const method = request.method || "";
  const pathname = new URL(request.url, "https://vercel.invalid").pathname;
  const config = authConfig(env);
  if (pathname === "/api/status" && method === "GET") {
    return proxyToBuyerApi(request, response, env, pathname, undefined, config);
  }
  if (pathname === "/api/session" && method === "GET") {
    if (!config.enabled) return sendJson(response, 503, { error: "individual_authorization_not_configured" });
    const identity = await authenticateBuyer(request, config);
    if (identity.error) return sendJson(response, identity.error.status, { error: identity.error.code });
    return sendJson(response, 200, {
      authenticated: true,
      authorized: identity.allowed,
      userId: identity.userId,
      purchasesEnabled: config.purchasesEnabled,
    });
  }

  let identity;
  if (USER_ROUTES.has(`${method} ${pathname}`)) {
    if (!config.enabled) return sendJson(response, 503, { error: "individual_authorization_not_configured" });
    identity = await authenticateBuyer(request, config);
    if (identity.error) return sendJson(response, identity.error.status, { error: identity.error.code });
    if (!identity.allowed) return sendJson(response, 403, { error: "buyer_user_not_authorized" });
    if (!config.purchasesEnabled) return sendJson(response, 403, { error: "testnet_purchases_not_enabled" });
  }

  return proxyToBuyerApi(request, response, env, pathname, identity, config);
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
        status.individualAuthorizationEnabled = config.enabled && config.allowedUserIds.size > 0;
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
