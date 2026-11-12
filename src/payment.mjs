import { createHash, randomUUID } from "node:crypto";
import { config, missingPaymentSettings } from "./config.mjs";
import { appendAudit } from "./audit.mjs";
import { inspectBadge } from "./registry.mjs";

const QUOTE_TTL_MS = 45_000;
const MAX_RESPONSE_BYTES = 512_000;
const quotes = new Map();
let paymentBusy = false;

function parsePaymentRequired(response) {
  const encoded = response.headers.get("payment-required") || response.headers.get("x-payment-required");
  if (!encoded) return null;
  for (const candidate of [encoded, Buffer.from(encoded, "base64url").toString("utf8")]) {
    try { return JSON.parse(candidate); } catch { /* Try the other wire encoding. */ }
  }
  return null;
}

function candidatesFrom(payload) {
  if (Array.isArray(payload?.accepts)) return payload.accepts;
  if (Array.isArray(payload?.paymentRequirements)) return payload.paymentRequirements;
  if (payload?.paymentRequirements && typeof payload.paymentRequirements === "object") return [payload.paymentRequirements];
  return [];
}

export function inspectRequirement(requirement) {
  const amount = requirement?.amount ?? requirement?.maxAmountRequired;
  const payTo = requirement?.payTo;
  const asset = requirement?.asset;
  const network = requirement?.network;
  const scheme = requirement?.scheme;
  if (scheme !== "exact") return { ok: false, reason: "Only the exact x402 payment scheme is allowed." };
  if (network !== config.network) return { ok: false, reason: "The x402 quote is not for Concordium testnet." };
  if (asset !== config.asset && asset !== `${config.network}/slip44:919`) return { ok: false, reason: "The x402 quote is not for the configured native CCD asset." };
  if (typeof amount !== "string" || !/^\d+$/u.test(amount)) return { ok: false, reason: "The x402 amount is missing or malformed." };
  if (BigInt(amount) <= 0n || BigInt(amount) > BigInt(config.maxSpendMicroCcd)) return { ok: false, reason: "The requested amount exceeds the configured spend ceiling." };
  if (payTo !== config.sellerPayTo) return { ok: false, reason: "The x402 recipient does not match the configured seller payment wallet." };
  const expirySeconds = requirement?.maxTimeoutSeconds;
  if (typeof expirySeconds !== "number" || expirySeconds <= 0 || expirySeconds > 300) return { ok: false, reason: "The quote expiry is missing or outside the accepted 5-minute maximum." };
  const feePayer = requirement?.extra?.feePayer ?? requirement?.feePayer;
  if (typeof feePayer !== "string" || feePayer.length < 8) return { ok: false, reason: "The quote does not identify the sponsored fee payer." };
  if (!config.sponsorAddress) return { ok: false, reason: "The configured sponsor fee payer is missing." };
  if (feePayer !== config.sponsorAddress) return { ok: false, reason: "The quote fee payer does not match the configured sponsor." };
  return {
    ok: true,
    summary: { scheme, network, asset, amountMicroCcd: amount, payTo, maxTimeoutSeconds: expirySeconds, feePayer },
  };
}

function parseChallenge(response) {
  if (response.status !== 402) return { error: `Expected HTTP 402, received ${response.status}.` };
  const payload = parsePaymentRequired(response);
  if (!payload) return { error: "The 402 response did not contain a readable x402 payment challenge." };
  const requirements = candidatesFrom(payload);
  for (const requirement of requirements) {
    const check = inspectRequirement(requirement);
    if (check.ok) return { payload, requirement, summary: check.summary };
  }
  const firstFailure = requirements.map(inspectRequirement).find((result) => !result.ok);
  return { error: firstFailure?.reason || "The x402 challenge did not offer a supported payment requirement." };
}

async function requestChallenge() {
  const response = await fetch(config.sellerResourceUrl, {
    method: "GET",
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  const challenge = parseChallenge(response);
  await response.body?.cancel();
  return challenge;
}

export async function createQuote() {
  const missing = [];
  if (!config.sellerBadge) missing.push("SELLER_BADGE");
  if (!config.buyerBadge) missing.push("BUYER_BADGE");
  if (!config.accountAddress) missing.push("CCD_ACCOUNT_ADDRESS");
  if (!config.sellerPayTo) missing.push("SELLER_PAY_TO");
  if (!config.sellerResourceUrl) missing.push("SELLER_RESOURCE_URL");
  if (!config.maxSpendMicroCcd) missing.push("MAX_SPEND_MICROCCD");
  if (missing.length) {
    return { status: "blocked", message: "The buyer or seller policy is not configured for a quote.", missing };
  }

  const [sellerVerification, buyerVerification] = await Promise.all([
    inspectBadge(config.sellerBadge, config.sellerPayTo),
    inspectBadge(config.buyerBadge, config.accountAddress),
  ]);
  const verification = { seller: sellerVerification, buyer: buyerVerification };
  if (sellerVerification.status !== "verified" || buyerVerification.status !== "verified") {
    return { status: "blocked", message: "Buyer or seller identity verification failed. No payment quote was accepted.", verification };
  }

  try {
    const challenge = await requestChallenge();
    if (challenge.error) return { status: "blocked", message: challenge.error };
    const id = randomUUID();
    const expiresAt = Date.now() + QUOTE_TTL_MS;
    quotes.set(id, { id, expiresAt, requirement: challenge.requirement, summary: challenge.summary, verification, used: false });
    for (const [key, quote] of quotes) if (quote.expiresAt <= Date.now() || quote.used) quotes.delete(key);
    return { status: "quoted", quoteId: id, expiresAt: new Date(expiresAt).toISOString(), verification, payment: challenge.summary, spendCapMicroCcd: config.maxSpendMicroCcd, paymentEnabled: config.paymentsEnabled };
  } catch (error) {
    return { status: "unavailable", message: error.name === "TimeoutError" ? "The seller quote timed out. No payment was made." : "The seller quote could not be read. No payment was made." };
  }
}

function paymentTransaction(response) {
  const encoded = response.headers.get("payment-response") || response.headers.get("x-payment-response");
  if (!encoded) return null;
  for (const value of [encoded, Buffer.from(encoded, "base64url").toString("utf8")]) {
    try {
      const payload = JSON.parse(value);
      const stack = [payload];
      while (stack.length) {
        const item = stack.pop();
        if (!item || typeof item !== "object") continue;
        for (const key of ["transactionHash", "transaction_hash", "txHash", "tx_hash"]) {
          if (typeof item[key] === "string" && /^0x[0-9a-f]{64}$/iu.test(item[key])) return item[key];
        }
        stack.push(...Object.values(item).filter((child) => child && typeof child === "object"));
      }
    } catch { /* Try the other encoding. */ }
  }
  return null;
}

async function buildPaidFetch(quote) {
  const { ExactConcordiumScheme } = await import("@x402/concordium/exact/client");
  const { wrapFetchWithPaymentFromConfig } = await import("@x402/fetch");
  const { AccountAddress, buildBasicAccountSigner } = await import("@concordium/web-sdk");
  const accountAddress = AccountAddress.fromBase58(config.accountAddress);
  const signer = { accountAddress, signer: buildBasicAccountSigner(config.privateKey) };
  const scheme = new ExactConcordiumScheme(signer);
  return wrapFetchWithPaymentFromConfig(fetch, {
    // Concordium's sponsored transaction mechanism is published as x402 v2.
    schemes: [{ network: config.network, client: scheme, x402Version: 2 }],
    paymentRequirementsSelector(requirements) {
      const allowed = requirements.find((requirement) => {
        const check = inspectRequirement(requirement);
        return check.ok && JSON.stringify(check.summary) === JSON.stringify(quote.summary);
      });
      if (!allowed) throw new Error("The seller's current payment requirements no longer match the reviewed quote.");
      return allowed;
    },
  });
}

async function readLimited(response) {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Paid response exceeded the 512 KB retention limit.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export async function confirmPurchase(quoteId) {
  const missing = missingPaymentSettings();
  if (missing.length) return { status: "blocked", message: "The local payment policy is not enabled or fully configured.", missing };
  const quote = quotes.get(quoteId);
  if (!quote || quote.expiresAt <= Date.now() || quote.used) return { status: "blocked", message: "This quote expired or was already used. Request a fresh quote." };
  if (paymentBusy) return { status: "blocked", message: "Another payment is being reconciled. Wait before starting another purchase." };
  quote.used = true;
  paymentBusy = true;
  let intent;
  try {
    intent = appendAudit({
      status: "payment-authorized",
      sellerBadge: config.sellerBadge,
      buyerBadge: config.buyerBadge,
      payTo: quote.summary.payTo,
      amountMicroCcd: quote.summary.amountMicroCcd,
      asset: quote.summary.asset,
      network: quote.summary.network,
      verificationAt: quote.verification.seller.checkedAt,
      resourceHost: new URL(config.sellerResourceUrl).host,
      quoteId,
    });
    const [sellerVerification, buyerVerification] = await Promise.all([
      inspectBadge(config.sellerBadge, config.sellerPayTo),
      inspectBadge(config.buyerBadge, config.accountAddress),
    ]);
    if (sellerVerification.status !== "verified" || buyerVerification.status !== "verified") {
      const verification = { seller: sellerVerification, buyer: buyerVerification };
      appendAudit({ status: "refused-before-signing", parentId: intent.id, reason: `${buyerVerification.status}/${sellerVerification.status}` });
      return { status: "blocked", message: "Buyer or seller verification changed before signing. No payment was made.", verification };
    }
    const paidFetch = await buildPaidFetch(quote);
    const response = await paidFetch(config.sellerResourceUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    const body = await readLimited(response);
    const responseHash = createHash("sha256").update(body).digest("hex");
    const transactionHash = paymentTransaction(response);
    const record = appendAudit({
      status: response.ok && transactionHash ? "settlement-reported-chain-check-pending" : "unresolved",
      parentId: intent.id,
      sellerBadge: config.sellerBadge,
      payTo: quote.summary.payTo,
      amountMicroCcd: quote.summary.amountMicroCcd,
      asset: quote.summary.asset,
      network: quote.summary.network,
      serviceStatus: response.status,
      responseDigest: responseHash,
      responseBytes: body.byteLength,
      transactionHash,
      explorerUrl: transactionHash ? `https://ccdexplorer.io/testnet/transaction/${encodeURIComponent(transactionHash)}` : null,
      note: "A returned payment response is not independent confirmation; verify the transaction in CCDExplorer.",
    });
    return {
      status: record.status,
      message: transactionHash ? "The paid response arrived. Independently check the transaction before treating settlement as verified." : "The service response arrived without a readable transaction hash. Reconcile before retrying.",
      record,
      responsePreview: body.toString("utf8").slice(0, 2_000),
    };
  } catch (error) {
    if (!intent) return { status: "blocked", message: "The local receipt log could not be verified. No payment was started." };
    let record = null;
    try {
      record = appendAudit({
        status: "unresolved",
        parentId: intent.id,
        sellerBadge: config.sellerBadge,
        payTo: quote.summary.payTo,
        amountMicroCcd: quote.summary.amountMicroCcd,
        asset: quote.summary.asset,
        network: quote.summary.network,
        errorCode: error.name === "TimeoutError" ? "timeout-after-authorized-request" : "payment-or-response-error",
        errorMessage: "The outcome may be uncertain. Reconcile the sender account and CCDExplorer before retrying.",
      });
    } catch { /* Preserve an unresolved result even if local disk persistence has failed. */ }
    return { status: "unresolved", message: "The payment outcome is unresolved. Check the sender account and explorer before retrying.", record };
  } finally {
    paymentBusy = false;
  }
}
