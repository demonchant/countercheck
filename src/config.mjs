import { readFileSync } from "node:fs";
import { renderResourceUrl, resolveBuyerSellerResourceUrl } from "./seller-resource-config.mjs";
import { resolveBuyerApiRuntime } from "./api-auth.mjs";

function loadLocalEnv() {
  const allowed = new Set([
    "HOST", "PORT", "RENDER", "BUYER_API_TOKEN", "BUYER_API_SERVICE",
    "REGISTRY_MCP_URL", "CONCORDIUM_NETWORK", "SELLER_ASSET", "SELLER_BADGE",
    "BUYER_BADGE", "SELLER_PAY_TO", "SELLER_RESOURCE_URL", "SELLER_RESOURCE_PUBLIC_URL",
    "MAX_SPEND_MICROCCD", "PAYMENTS_ENABLED", "CCD_ACCOUNT_ADDRESS",
    "CCD_FACILITATOR_ADDRESS", "CCD_PRIVATE_KEY", "AUDIT_LOG_PATH",
  ]);
  try {
    const contents = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of contents.split(/\r?\n/u)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/u);
      if (!match || !allowed.has(match[1]) || match[1] in process.env) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/u, "$2");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

loadLocalEnv();

const readBool = (name, fallback = false) => {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
};

const readPositiveInteger = (name) => {
  const value = process.env[name] ?? "";
  if (!/^\d+$/u.test(value) || BigInt(value) <= 0n) return null;
  return value;
};

export const MAX_PAYMENT_MICROCCD = 1_000_000n;

const renderRuntime = process.env.RENDER === "true";
const apiToken = process.env.BUYER_API_TOKEN || "";
const buyerApiService = process.env.BUYER_API_SERVICE === "true";
if (process.env.BUYER_API_SERVICE !== undefined && !["true", "false"].includes(process.env.BUYER_API_SERVICE)) {
  throw new Error("BUYER_API_SERVICE must be true or false");
}
const apiRuntime = buyerApiService
  ? resolveBuyerApiRuntime({ render: renderRuntime, host: process.env.HOST, apiToken })
  : resolveBuyerApiRuntime({ render: false, host: process.env.HOST && new Set(["127.0.0.1", "localhost", "::1"]).has(process.env.HOST) ? process.env.HOST : "127.0.0.1" });

const registryRoot = process.env.REGISTRY_MCP_URL || "https://agent-registry-mcp.concordium.com";
const registryUrl = new URL(registryRoot);
if (registryUrl.protocol !== "https:" || registryUrl.pathname !== "/") {
  throw new Error("REGISTRY_MCP_URL must be an HTTPS origin without a path");
}

const network = process.env.CONCORDIUM_NETWORK || "ccd:4221332d34e1694168c2a0c0b3fd0f27";
if (network !== "ccd:4221332d34e1694168c2a0c0b3fd0f27") {
  throw new Error("This build is testnet-only; CONCORDIUM_NETWORK must use the current testnet CAIP-2 ID");
}

const asset = process.env.SELLER_ASSET || "CCD";
if (asset !== "CCD") throw new Error("SELLER_ASSET is fixed to native CCD in this build");
const maxSpendMicroCcd = readPositiveInteger("MAX_SPEND_MICROCCD");
if (maxSpendMicroCcd && BigInt(maxSpendMicroCcd) > MAX_PAYMENT_MICROCCD) {
  throw new Error("MAX_SPEND_MICROCCD cannot exceed the hard 1 CCD buyer limit");
}
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("PORT must be an integer from 1024 through 65535");

const resource = resolveBuyerSellerResourceUrl({
  configuredUrl: process.env.SELLER_RESOURCE_URL || "",
  renderExternalUrl: process.env.RENDER_EXTERNAL_URL || "",
  render: renderRuntime,
});

export const config = Object.freeze({
  host: apiRuntime.host,
  remoteDeployment: apiRuntime.remote,
  apiToken,
  port,
  registryBase: registryUrl.origin,
  network,
  asset,
  sellerBadge: process.env.SELLER_BADGE || "",
  buyerBadge: process.env.BUYER_BADGE || "",
  sellerPayTo: process.env.SELLER_PAY_TO || "",
  sellerResourceUrl: resource,
  maxSpendMicroCcd,
  paymentsEnabled: readBool("PAYMENTS_ENABLED"),
  settlementEnabled: readBool("FACILITATOR_SETTLEMENT_ENABLED"),
  accountAddress: process.env.CCD_ACCOUNT_ADDRESS || "",
  sponsorAddress: process.env.CCD_FACILITATOR_ADDRESS || "",
  privateKey: process.env.CCD_PRIVATE_KEY || "",
  auditPath: process.env.AUDIT_LOG_PATH || "./data/receipts.jsonl",
});

export function missingPaymentSettings() {
  const missing = [];
  if (!config.paymentsEnabled) missing.push("PAYMENTS_ENABLED=true");
  if (!config.sellerBadge) missing.push("SELLER_BADGE");
  if (!config.buyerBadge) missing.push("BUYER_BADGE");
  if (!config.sellerPayTo) missing.push("SELLER_PAY_TO");
  if (!config.sponsorAddress) missing.push("CCD_FACILITATOR_ADDRESS");
  if (!config.sellerResourceUrl) missing.push("SELLER_RESOURCE_URL");
  if (!config.maxSpendMicroCcd) missing.push("MAX_SPEND_MICROCCD");
  if (!config.accountAddress) missing.push("CCD_ACCOUNT_ADDRESS");
  if (!config.privateKey) missing.push("CCD_PRIVATE_KEY");
  return missing;
}
