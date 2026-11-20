const ROUTES = new Map([
  ["GET /api/status", "GET"],
  ["GET /api/receipts", "GET"],
  ["POST /api/verify", "POST"],
  ["POST /api/quote", "POST"],
  ["POST /api/prepare", "POST"],
  ["POST /api/approve", "POST"],
  ["POST /api/purchase", "POST"],
  ["POST /api/receipt/acknowledge", "POST"],
]);

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
  const pathname = new URL(request.url, "https://vercel.invalid").pathname;
  if (request.method === "POST" && pathname === "/api/purchase") {
    return sendJson(response, 403, { error: "individual_authorization_required" });
  }
  const token = env.COUNTERCHECK_API_TOKEN || "";
  if (token.length < 32) return sendJson(response, 503, { error: "api_proxy_not_configured" });
  let origin;
  try { origin = resolveBuyerApiOrigin(env.COUNTERCHECK_API_ORIGIN || "", { vercel: env.VERCEL === "1" }); }
  catch { return sendJson(response, 503, { error: "api_proxy_not_configured" }); }

  const method = request.method;
  let body;
  const headers = { accept: "application/json", authorization: `Bearer ${token}` };
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
    response.writeHead(upstream.status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    response.end(Buffer.from(payload));
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
