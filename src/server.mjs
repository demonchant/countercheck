import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { config, missingPaymentSettings } from "./config.mjs";
import { inspectBadge } from "./registry.mjs";
import { appendAudit, recentAudit } from "./audit.mjs";
import { confirmPurchase, createQuote } from "./payment.mjs";

const root = resolve(fileURLToPath(new URL("../public", import.meta.url)));
const contentTypes = new Map([[".html", "text/html; charset=utf-8"], [".css", "text/css; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".svg", "image/svg+xml"]]);
const expectedOrigin = `http://127.0.0.1:${config.port}`;

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

function authorizedLocalRequest(request) {
  if (request.headers.host !== `127.0.0.1:${config.port}`) return false;
  if (request.headers.origin !== expectedOrigin) return false;
  if (request.headers["x-countercheck-request"] !== "1") return false;
  return true;
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
  if (request.method === "GET" && url.pathname.startsWith("/assets/")) return serveStatic(url.pathname, response);
  if (request.method === "GET" && url.pathname === "/") return serveStatic("/", response);

  if (request.method === "GET" && url.pathname === "/api/status") {
    return sendJson(response, 200, {
      project: "Countercheck",
      mode: "local-testnet-client",
      network: config.network,
      registryEndpointConfigured: Boolean(config.registryBase),
      paymentReady: missingPaymentSettings().length === 0,
      paymentEnabled: config.paymentsEnabled,
      paymentMissing: missingPaymentSettings(),
      sellerConfigured: Boolean(config.sellerBadge && config.sellerPayTo && config.sellerResourceUrl),
      note: "Configuration status only. This is not a live network-health check.",
    });
  }
  if (request.method === "GET" && url.pathname === "/api/receipts") {
    try { return sendJson(response, 200, { records: recentAudit(12) }); }
    catch { return sendJson(response, 500, { error: "Local receipt log could not be read." }); }
  }
  if (!url.pathname.startsWith("/api/")) {
    response.writeHead(404); response.end("Not found"); return;
  }
  if (!authorizedLocalRequest(request)) return sendJson(response, 403, { error: "This local action is allowed only from the Countercheck page on loopback." });
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
    return sendJson(response, 200, await createQuote());
  }
  if (url.pathname === "/api/purchase") {
    if (typeof body.quoteId !== "string") return sendJson(response, 400, { error: "quoteId must be a string." });
    return sendJson(response, 200, await confirmPurchase(body.quoteId));
  }
  if (url.pathname === "/api/receipt/acknowledge") {
    if (typeof body.recordId !== "string" || typeof body.transactionHash !== "string" || !/^(?:0x)?[0-9a-f]{64}$/iu.test(body.transactionHash)) {
      return sendJson(response, 400, { error: "A receipt id and 32-byte transaction hash are required." });
    }
    const transactionHash = body.transactionHash.replace(/^0x/iu, "").toLowerCase();
    const record = appendAudit({ status: "operator-recorded-explorer-check", parentId: body.recordId, transactionHash, independentCheck: true, note: "Operator-recorded explorer inspection; no automated CCDExplorer API read-back was made." });
    return sendJson(response, 200, { status: "recorded", record });
  }
  return sendJson(response, 404, { error: "Unknown endpoint." });
});

server.headersTimeout = 10_000;
server.requestTimeout = 35_000;
server.keepAliveTimeout = 5_000;
server.listen(config.port, config.host, () => {
  console.log(`Countercheck listening at ${expectedOrigin}`);
  console.log(`Concordium network: ${config.network}; payments ${config.paymentsEnabled ? "enabled by operator configuration" : "disabled"}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
