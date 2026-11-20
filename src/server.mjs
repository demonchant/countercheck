import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { config, missingPaymentSettings } from "./config.mjs";
import { createBuyerApiAuthorizer } from "./api-auth.mjs";
import { inspectBadge } from "./registry.mjs";
import { appendAudit, recentAudit } from "./audit.mjs";
import { approveTransactionReview, confirmPurchase, createQuote, prepareTransactionReview } from "./payment.mjs";

const root = resolve(fileURLToPath(new URL("../public", import.meta.url)));
const contentTypes = new Map([[".html", "text/html; charset=utf-8"], [".css", "text/css; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".svg", "image/svg+xml"]]);
const expectedOrigin = `http://127.0.0.1:${config.port}`;
const authorizeApiRequest = createBuyerApiAuthorizer({ remote: config.remoteDeployment, port: config.port, token: config.apiToken });

function buyerOwner(request, response) {
  if (!config.remoteDeployment) return { ok: true, ownerId: undefined };
  const ownerId = request.headers["x-countercheck-user-id"];
  if (typeof ownerId !== "string" || !/^user_[A-Za-z0-9_-]{4,}:sess_[A-Za-z0-9_-]{4,}$/u.test(ownerId)) {
    sendJson(response, 401, { error: "individual_authorization_required" });
    return { ok: false };
  }
  return { ok: true, ownerId };
}

function ownerReceiptHash(ownerId) {
  return ownerId ? createHash("sha256").update(ownerId).digest("hex") : undefined;
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) throw new Error("Content-Type must be application/json.");
  let length = 0;
  const chunks = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 8_192) throw new Error("Request body exceeds 8 KB.");
    chunks.push(chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Request body must be a JSON object.");
  return body;
}

async function serveStatic(pathname, response) {
  const relative = pathname === "/"
    ? "index.html"
    : pathname.startsWith("/assets/")
      ? pathname.slice("/assets/".length)
      : pathname.slice(1);
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    response.writeHead(404); response.end(); return;
  }
  try {
    const content = await readFile(target);
    response.writeHead(200, {
      "content-type": contentTypes.get(extname(target)) || "application/octet-stream",
      "cache-control": target.endsWith(".html") ? "no-store" : "public, max-age=300",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
    });
    response.end(content);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500);
    response.end("Not found");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", expectedOrigin);
  if (request.method === "GET" && url.pathname === "/healthz") return sendJson(response, 200, { ok: true });
  if (!config.remoteDeployment && request.method === "GET" && url.pathname.startsWith("/assets/")) return serveStatic(url.pathname, response);
  if (!config.remoteDeployment && request.method === "GET" && url.pathname === "/") return serveStatic("/", response);

  if (url.pathname.startsWith("/api/") && !authorizeApiRequest(request)) {
    return sendJson(response, config.remoteDeployment ? 401 : 403, { error: config.remoteDeployment ? "unauthorized" : "local_origin_required" });
  }

  if (request.method === "GET" && url.pathname === "/api/status") {
    return sendJson(response, 200, {
      project: "Countercheck",
      mode: "local-testnet-client",
      network: config.network,
      registryEndpointConfigured: Boolean(config.registryBase),
      paymentReady: missingPaymentSettings().length === 0,
      paymentEnabled: config.paymentsEnabled,
      settlementEnabled: config.settlementEnabled,
      paymentMissing: missingPaymentSettings(),
      sellerConfigured: Boolean(config.sellerBadge && config.sellerPayTo && config.sellerResourceUrl),
      note: "Configuration status only. This is not a live network-health check.",
    });
  }
  if (request.method === "GET" && url.pathname === "/api/demo-seller" && !config.remoteDeployment) {
    if (!config.sellerBadge) return sendJson(response, 404, { error: "demo_seller_not_configured" });
    return sendJson(response, 200, { badge: config.sellerBadge });
  }
  if (request.method === "GET" && url.pathname === "/api/receipts") {
    const owner = buyerOwner(request, response);
    if (!owner.ok) return;
    try {
      const records = recentAudit(100);
      return sendJson(response, 200, { records: config.remoteDeployment
        ? records.filter((record) => record.buyerAuthorizationHash === ownerReceiptHash(owner.ownerId)).slice(0, 12)
        : records.slice(0, 12) });
    }
    catch { return sendJson(response, 500, { error: "Local receipt log could not be read." }); }
  }
  if (!url.pathname.startsWith("/api/")) {
    response.writeHead(404); response.end("Not found"); return;
  }
  if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed." });

  let body;
  try { body = await readJson(request); }
  catch (error) { return sendJson(response, 400, { error: error.message }); }

  if (url.pathname === "/api/verify") {
    if (typeof body.badge !== "string") return sendJson(response, 400, { error: "badge must be a string." });
    if (config.sellerBadge && body.badge !== config.sellerBadge) {
      return sendJson(response, 200, { status: "seller-mismatch", message: "This purchase flow is bound to the locally configured seller badge. No other badge can authorize a purchase." });
    }
    return sendJson(response, 200, await inspectBadge(body.badge));
  }
  if (url.pathname === "/api/quote") {
    const owner = buyerOwner(request, response);
    if (!owner.ok) return;
    return sendJson(response, 200, await createQuote(owner.ownerId));
  }
  if (url.pathname === "/api/prepare") {
    if (typeof body.quoteId !== "string") return sendJson(response, 400, { error: "quoteId must be a string." });
    const owner = buyerOwner(request, response);
    if (!owner.ok) return;
    return sendJson(response, 200, await prepareTransactionReview(body.quoteId, owner.ownerId));
  }
  if (url.pathname === "/api/approve") {
    if (typeof body.reviewId !== "string" || typeof body.signingDigest !== "string") {
      return sendJson(response, 400, { error: "reviewId and signingDigest are required." });
    }
    const owner = buyerOwner(request, response);
    if (!owner.ok) return;
    return sendJson(response, 200, await approveTransactionReview(body.reviewId, body.signingDigest, owner.ownerId));
  }
  if (url.pathname === "/api/purchase") {
    if (typeof body.approvalId !== "string" || typeof body.signingDigest !== "string") return sendJson(response, 400, { error: "approvalId and signingDigest are required." });
    const owner = buyerOwner(request, response);
    if (!owner.ok) return;
    return sendJson(response, 200, await confirmPurchase(body.approvalId, body.signingDigest, owner.ownerId));
  }
  if (url.pathname === "/api/receipt/acknowledge") {
    if (typeof body.recordId !== "string" || typeof body.transactionHash !== "string" || !/^(?:0x)?[0-9a-f]{64}$/iu.test(body.transactionHash)) {
      return sendJson(response, 400, { error: "A receipt id and 32-byte transaction hash are required." });
    }
    const owner = buyerOwner(request, response);
    if (!owner.ok) return;
    const transactionHash = body.transactionHash.replace(/^0x/iu, "").toLowerCase();
    const record = appendAudit({ status: "operator-attested-explorer-check", parentId: body.recordId, transactionHash, ...(owner.ownerId ? { buyerAuthorizationHash: ownerReceiptHash(owner.ownerId) } : {}), independentCheck: false, note: "Operator-attested explorer inspection; no automated CCDExplorer API read-back was made." });
    return sendJson(response, 200, { status: "recorded", record });
  }
  return sendJson(response, 404, { error: "Unknown endpoint." });
});

server.headersTimeout = 10_000;
server.requestTimeout = 35_000;
server.keepAliveTimeout = 5_000;
server.listen(config.port, config.host, () => {
  console.log(`Countercheck buyer API listening at ${config.host}:${config.port}`);
  console.log(`Concordium network: ${config.network}; payments ${config.paymentsEnabled ? "enabled by operator configuration" : "disabled"}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
