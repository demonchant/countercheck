import { readFileSync } from "node:fs";

const TESTNET = "ccd:4221332d34e1694168c2a0c0b3fd0f27";
const MAX_PAYMENT_MICROCCD = 1_000_000n;
const allowedEnv = new Set([
  "HOST", "PORT", "CONCORDIUM_NETWORK", "CCD_ACCOUNT_ADDRESS", "SELLER_PAY_TO",
  "FACILITATOR_HOST", "FACILITATOR_PORT", "FACILITATOR_SETTLEMENT_ENABLED",
  "FACILITATOR_API_TOKEN", "FACILITATOR_MAX_AMOUNT_MICROCCD",
  "FACILITATOR_MIN_SPONSOR_BALANCE_MICROCCD", "FACILITATOR_STORE_PATH",
  "CCD_FACILITATOR_ADDRESS", "CCD_FACILITATOR_PRIVATE_KEY",
]);

function loadFacilitatorEnv() {
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

loadFacilitatorEnv();

function positiveInteger(name, fallback) {
  const value = process.env[name] || fallback;
  if (typeof value !== "string" || !/^\d+$/u.test(value) || BigInt(value) <= 0n) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function bool(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

const host = process.env.FACILITATOR_HOST || process.env.HOST || "127.0.0.1";
if (!new Set(["127.0.0.1", "localhost", "::1"]).has(host)) {
  throw new Error("FACILITATOR_HOST must be loopback; remote access requires a separate security design");
}
const port = Number(process.env.FACILITATOR_PORT || "4180");
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("FACILITATOR_PORT must be an integer from 1024 through 65535");
}
const network = process.env.CONCORDIUM_NETWORK || TESTNET;
if (network !== TESTNET) throw new Error("The facilitator is Testnet-only");
const maxAmountMicroCcd = positiveInteger("FACILITATOR_MAX_AMOUNT_MICROCCD", "1000000");
if (BigInt(maxAmountMicroCcd) > MAX_PAYMENT_MICROCCD) throw new Error("FACILITATOR_MAX_AMOUNT_MICROCCD cannot exceed the hard 1 CCD facilitator limit");

export const facilitatorConfig = Object.freeze({
  host: host === "localhost" ? "127.0.0.1" : host,
  port,
  network,
  buyerAddress: process.env.CCD_ACCOUNT_ADDRESS || "",
  sellerPayTo: process.env.SELLER_PAY_TO || "",
  sponsorAddress: process.env.CCD_FACILITATOR_ADDRESS || "",
  sponsorPrivateKey: process.env.CCD_FACILITATOR_PRIVATE_KEY || "",
  apiToken: process.env.FACILITATOR_API_TOKEN || "",
  settlementEnabled: bool("FACILITATOR_SETTLEMENT_ENABLED"),
  maxAmountMicroCcd,
  minSponsorBalanceMicroCcd: positiveInteger("FACILITATOR_MIN_SPONSOR_BALANCE_MICROCCD", "10000"),
  storePath: process.env.FACILITATOR_STORE_PATH || "./data/facilitator-settlements",
  grpcHost: "grpc.testnet.concordium.com",
  grpcPort: 20000,
});

export const TESTNET_CAIP2 = TESTNET;
