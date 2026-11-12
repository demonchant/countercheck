import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { x402HTTPResourceServer } from "@x402/core/http";
import { ExactConcordiumScheme } from "@x402/concordium/exact/server";
import { AccountAddress } from "@concordium/web-sdk";
import { resolveSellerResourceUrl, sellerListenConfig } from "./seller-resource-config.mjs";
import { createChallengeOnlyFacilitator, hasPaymentAuthorization } from "./seller-challenge-only.mjs";
import { createA2AJsonRpcHandler } from "./a2a-agent.mjs";
import { inspectBadge } from "./registry.mjs";
import { createQuote, parseChallenge } from "./payment.mjs";
import { config as buyerConfig } from "./config.mjs";

const TESTNET = "ccd:4221332d34e1694168c2a0c0b3fd0f27";
const MAX_PAYMENT_MICROCCD = "1000000";
const allowedEnv = new Set([
  "SELLER_RESOURCE_ENABLED", "SELLER_RESOURCE_HOST", "SELLER_RESOURCE_PORT",
  "SELLER_RESOURCE_PUBLIC_URL", "SELLER_CHALLENGE_ONLY",
  "SELLER_PAY_TO", "CCD_FACILITATOR_ADDRESS", "FACILITATOR_API_TOKEN", "FACILITATOR_SETTLEMENT_ENABLED", "CONCORDIUM_NETWORK",
]);

function loadSellerEnv() {
  try {
    const contents = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of contents.split(/\r?\n/u)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/u);
      if (!match || !allowedEnv.has(match[1]) || match[1] in process.env) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/u, "$2");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

loadSellerEnv();

const enabled = process.env.SELLER_RESOURCE_ENABLED === "true";
if (process.env.SELLER_RESOURCE_ENABLED !== undefined && !["true", "false"].includes(process.env.SELLER_RESOURCE_ENABLED)) {
  throw new Error("SELLER_RESOURCE_ENABLED must be true or false");
}
if (!enabled) throw new Error("Seller resource is disabled. Enable SELLER_RESOURCE_ENABLED only for an explicitly approved local Testnet run.");
const challengeOnly = process.env.SELLER_CHALLENGE_ONLY === "true";
if (process.env.SELLER_CHALLENGE_ONLY !== undefined && !["true", "false"].includes(process.env.SELLER_CHALLENGE_ONLY)) {
  throw new Error("SELLER_CHALLENGE_ONLY must be true or false");
}
if (process.env.FACILITATOR_SETTLEMENT_ENABLED !== undefined && !["true", "false"].includes(process.env.FACILITATOR_SETTLEMENT_ENABLED)) {
  throw new Error("FACILITATOR_SETTLEMENT_ENABLED must be true or false");
}
if (challengeOnly && process.env.FACILITATOR_SETTLEMENT_ENABLED === "true") {
  throw new Error("Challenge-only mode refuses facilitator settlement to be enabled.");
}
const renderRuntime = process.env.RENDER === "true";
const { host, port } = sellerListenConfig({
  render: renderRuntime,
  configuredHost: process.env.SELLER_RESOURCE_HOST,
  configuredPort: process.env.SELLER_RESOURCE_PORT,
  platformPort: process.env.PORT,
});
if ((process.env.CONCORDIUM_NETWORK || TESTNET) !== TESTNET) throw new Error("Seller resource is Testnet-only");
const payTo = process.env.SELLER_PAY_TO || "";
const sponsor = process.env.CCD_FACILITATOR_ADDRESS || "";
const token = process.env.FACILITATOR_API_TOKEN || "";
if (!payTo || !sponsor || (!challengeOnly && token.length < 32)) {
  throw new Error("Seller resource requires SELLER_PAY_TO and CCD_FACILITATOR_ADDRESS, plus FACILITATOR_API_TOKEN outside challenge-only mode.");
}
try { AccountAddress.fromBase58(payTo); AccountAddress.fromBase58(sponsor); }
catch { throw new Error("Seller payee and sponsor must be valid Concordium account addresses"); }

const auth = { authorization: `Bearer ${token}` };
const facilitator = challengeOnly
  ? createChallengeOnlyFacilitator({ network: TESTNET, sponsorAddress: sponsor })
  : new HTTPFacilitatorClient({
    url: "http://127.0.0.1:4180",
    timeoutMs: 90_000,
    createAuthHeaders: async () => ({ verify: auth, settle: auth, supported: auth }),
  });
const resource = new x402ResourceServer(facilitator)
  .register(TESTNET, new ExactConcordiumScheme());
const resourceUrl = resolveSellerResourceUrl({
  publicUrl: process.env.SELLER_RESOURCE_PUBLIC_URL || "",
  renderExternalUrl: renderRuntime ? process.env.RENDER_EXTERNAL_URL || "" : "",
  port,
});
const httpResource = new x402HTTPResourceServer(resource, {
  "GET /resource": {
    accepts: {
      scheme: "exact",
      network: TESTNET,
      payTo,
      price: { amount: MAX_PAYMENT_MICROCCD, asset: "CCD" },
      maxTimeoutSeconds: 60,
    },
    resource: resourceUrl,
    description: challengeOnly
      ? "Countercheck Testnet x402 v2 challenge (1 CCD); paid fulfillment is disabled."
      : "Countercheck Testnet resource (1 CCD)",
    mimeType: "application/json",
    unpaidResponseBody: async () => ({ contentType: "application/json", body: { error: "payment_required" } }),
  },
});

async function verifyCounterparties() {
  const missing = [
    !buyerConfig.buyerBadge && "BUYER_BADGE",
    !buyerConfig.sellerBadge && "SELLER_BADGE",
    !buyerConfig.accountAddress && "CCD_ACCOUNT_ADDRESS",
    !buyerConfig.sellerPayTo && "SELLER_PAY_TO",
  ].filter(Boolean);
  if (missing.length) return { status: "blocked", missing };
  const [buyer, seller] = await Promise.all([
    inspectBadge(buyerConfig.buyerBadge, buyerConfig.accountAddress),
    inspectBadge(buyerConfig.sellerBadge, buyerConfig.sellerPayTo),
  ]);
  return { status: buyer.status === "verified" && seller.status === "verified" ? "verified" : "blocked", network: TESTNET, buyer, seller };
}

async function getSellerOffer() {
  const response = await fetch(resourceUrl, {
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  const checked = parseChallenge(response, {
    network: TESTNET,
    asset: "CCD",
    sellerPayTo: payTo,
    sponsorAddress: sponsor,
    maxSpendMicroCcd: MAX_PAYMENT_MICROCCD,
  });
  await response.body?.cancel();
  if (checked.error) return { status: "unavailable", message: checked.error };
  return {
    status: "challenge_available",
    resourceUrl,
    payment: checked.summary,
    paidFulfillmentAvailable: !challengeOnly && process.env.FACILITATOR_SETTLEMENT_ENABLED === "true",
    message: "This reports a live x402 challenge. It does not authorize or claim a completed payment.",
  };
}

const cardFile = (name) => new URL(`../agent-cards/${name}`, import.meta.url);
const buyerA2A = createA2AJsonRpcHandler({
  cardPath: cardFile("countercheck-buyer-1147.json"),
  actions: {
    verify_counterparties: verifyCounterparties,
    request_purchase_quote: createQuote,
  },
});
const sellerA2A = createA2AJsonRpcHandler({
  cardPath: cardFile("countercheck-seller-1146.json"),
  actions: { get_x402_offer: getSellerOffer },
});

function requestAdapter(request, url) {
  return {
    getHeader(name) {
      const value = request.headers[name.toLowerCase()];
      return Array.isArray(value) ? value.join(", ") : value;
    },
    getMethod: () => request.method || "GET",
    getPath: () => url.pathname,
    getUrl: () => resourceUrl,
    getAcceptHeader: () => String(request.headers.accept || ""),
    getUserAgent: () => String(request.headers["user-agent"] || ""),
    getBody: () => undefined,
  };
}

function send(response, status, headers, body) {
  response.writeHead(status, { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers });
  if (typeof body === "string" || Buffer.isBuffer(body)) response.end(body);
  else response.end(JSON.stringify(body ?? {}));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", resourceUrl);
  if (request.method === "POST" && url.pathname === "/a2a/buyer/v1") return buyerA2A(request, response);
  if (request.method === "POST" && url.pathname === "/a2a/seller/v1") return sellerA2A(request, response);
  if (request.method === "GET" && url.pathname === "/healthz") {
    if (renderRuntime) return send(response, 404, { "content-type": "application/json; charset=utf-8" }, { error: "not_found" });
    return send(response, 200, { "content-type": "application/json; charset=utf-8" }, {
      ok: true,
      network: TESTNET,
      resource: resourceUrl,
      amountMicroCcd: MAX_PAYMENT_MICROCCD,
      settlementEnabled: !challengeOnly && process.env.FACILITATOR_SETTLEMENT_ENABLED === "true",
      paidFulfillmentAvailable: !challengeOnly && process.env.FACILITATOR_SETTLEMENT_ENABLED === "true",
      note: "Local configuration only; fetch /resource for the live x402 challenge.",
    });
  }
  if (url.pathname !== "/resource") return send(response, 404, { "content-type": "application/json; charset=utf-8" }, { error: "not_found" });
  if (request.method !== "GET") return send(response, 405, { allow: "GET", "content-type": "application/json; charset=utf-8" }, { error: "method_not_allowed" });
  if (challengeOnly && hasPaymentAuthorization(request.headers)) {
    return send(response, 503, { "content-type": "application/json; charset=utf-8" }, {
      error: "settlement_unavailable",
      paidFulfillmentAvailable: false,
    });
  }

  try {
    const context = { adapter: requestAdapter(request, url), path: url.pathname, method: request.method };
    const processed = await httpResource.processHTTPRequest(context);
    if (processed.type === "payment-error") {
      return send(response, processed.response.status, processed.response.headers, processed.response.body);
    }
    if (processed.type === "no-payment-required") {
      return send(response, 403, { "content-type": "application/json; charset=utf-8" }, { error: "payment_flow_required" });
    }

    const content = { resource: "Countercheck Testnet demonstration resource", paid: true, network: TESTNET };
    const responseBody = Buffer.from(JSON.stringify(content));
    const settled = await httpResource.processSettlement(
      processed.paymentPayload,
      processed.paymentRequirements,
      processed.declaredExtensions,
      { request: context, responseBody, responseHeaders: { "content-type": "application/json; charset=utf-8" } },
      undefined,
      processed.beforeHandlerSettlement,
    );
    if (!settled.success) return send(response, settled.response.status, settled.response.headers, settled.response.body);
    return send(response, 200, { "content-type": "application/json; charset=utf-8", ...settled.headers }, responseBody);
  } catch (error) {
    console.warn("x402 resource request failed; request and credential details were withheld.");
    return send(response, 503, { "content-type": "application/json; charset=utf-8" }, { error: "facilitator_unavailable_or_settlement_unresolved" });
  }
});

server.headersTimeout = 10_000;
server.requestTimeout = 100_000;
server.keepAliveTimeout = 5_000;
await httpResource.initialize();
server.listen(port, host, () => {
  console.log(`Countercheck x402 Testnet resource listening at ${resourceUrl}`);
  console.log(`Resource mode: ${challengeOnly ? "challenge-only; paid fulfillment disabled" : "facilitator-backed"}. No buyer or sponsor private keys are loaded by this process.`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
