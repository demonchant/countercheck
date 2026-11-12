import { readFileSync } from "node:fs";
import { renderResourceUrl } from "./seller-resource-config.mjs";

function loadLocalEnv() {
  try {
    const contents = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of contents.split(/\r?\n/u)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/u);
      if (!match || match[1] in process.env) continue;
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

const hostname = process.env.HOST || "127.0.0.1";
if (!new Set(["127.0.0.1", "localhost", "::1"]).has(hostname)) {
  throw new Error("HOST must be loopback. Add authenticated access before exposing this service.");
}

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

const renderResource = process.env.RENDER === "true" ? renderResourceUrl(process.env.RENDER_EXTERNAL_URL || "") : "";
const resource = process.env.SELLER_RESOURCE_URL || renderResource;
if (resource) {
  const resourceUrl = new URL(resource);
  if (resourceUrl.protocol !== "https:" && !(resourceUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(resourceUrl.hostname))) {
    throw new Error("SELLER_RESOURCE_URL must use HTTPS (HTTP is allowed only for local development)");
  }
}

export const config = Object.freeze({
  host: hostname === "localhost" ? "127.0.0.1" : hostname,
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
