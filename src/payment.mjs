import "./node-crypto-shims.mjs";
import { createHash, randomUUID } from "node:crypto";
import * as SDK from "@concordium/web-sdk";
import { buildBasicAccountSigner } from "@concordium/web-sdk";
import { ConcordiumGRPCNodeClient, credentials } from "@concordium/web-sdk/nodejs";
import { getPublicKey } from "@concordium/web-sdk/shims/ed25519";
import { getConcordiumGrpcUrl, parseGrpcUrl } from "@x402/concordium";
import { config, MAX_PAYMENT_MICROCCD, missingPaymentSettings } from "./config.mjs";
import { inspectBadge } from "./registry.mjs";
import { buildSponsoredTransferReview, createDigestBoundSigner, EXACT_PAYMENT_MICROCCD, signableMatchesReview, TESTNET } from "./payment-transaction.mjs";
import { appendAudit } from "./audit.mjs";

const QUOTE_TTL_MS = 45_000;
const quotes = new Map();
const preparedReviews = new Map();

function createGrpcClient() {
  const [host, port] = parseGrpcUrl(getConcordiumGrpcUrl(TESTNET));
  return new ConcordiumGRPCNodeClient(host, port, credentials.createSsl());
}

function microCcd(value) {
  return BigInt(SDK.CcdAmount.toMicroCcd(value));
}

async function readTransactionSnapshot(expiry) {
  if (config.network !== TESTNET) throw new Error("Only Concordium Testnet is supported.");
  const grpc = createGrpcClient();
  const buyerAddress = SDK.AccountAddress.fromBase58(config.accountAddress);
  const sponsorAddress = SDK.AccountAddress.fromBase58(config.sponsorAddress);
  const [nextNonce, buyer, sponsor, chainParameters] = await Promise.all([
    grpc.getNextAccountNonce(buyerAddress),
    grpc.getAccountInfo(buyerAddress),
    grpc.getAccountInfo(sponsorAddress),
    grpc.getBlockChainParameters(),
  ]);
  if (!nextNonce.allFinal) throw new Error("The buyer account nonce is not final. Wait and prepare a fresh review.");
  const credential = buyer.accountCredentials?.[0]?.value?.contents?.credentialPublicKeys;
  if (buyer.accountThreshold !== 1 || credential?.threshold !== 1 || !credential.keys?.[0]) {
    const keyCount = Object.keys(credential?.keys || {}).length;
    throw new Error(`The configured buyer signer cannot satisfy this account policy (account threshold ${buyer.accountThreshold}; first credential threshold ${credential?.threshold ?? "unavailable"}; ${keyCount} credential key(s)). Configure a signer matching the on-chain threshold.`);
  }
  if (!/^[0-9a-f]{64}$/iu.test(config.privateKey)) throw new Error("The configured buyer signer is unavailable for a secure key match check.");
  const derivedKey = Buffer.from(await getPublicKey(Buffer.from(config.privateKey, "hex"))).toString("hex");
  if (derivedKey.toLowerCase() !== credential.keys[0].verifyKey.toLowerCase()) {
    throw new Error("The configured buyer key does not match the first on-chain credential key.");
  }
  const buyerBalance = microCcd(buyer.accountAvailableBalance);
  const sponsorBalance = microCcd(sponsor.accountAvailableBalance);
  const prepared = buildSponsoredTransferReview({
    network: config.network,
    sender: config.accountAddress,
    recipient: config.sellerPayTo,
    sponsor: config.sponsorAddress,
    amountMicroCcd: "1000000",
    asset: "CCD",
    nonce: nextNonce.nonce,
    expiry,
    chainParameters,
  });
  const fee = BigInt(prepared.review.feeMicroCcd);
  if (buyerBalance < 1_000_000n) throw new Error("Buyer available balance is below the 1 CCD payment amount.");
  if (sponsorBalance < fee) throw new Error("Sponsor available balance is below the estimated network fee.");
  return {
    ...prepared,
    snapshot: {
      buyerBalanceMicroCcd: buyerBalance.toString(),
      sponsorBalanceMicroCcd: sponsorBalance.toString(),
      buyerThreshold: buyer.accountThreshold,
      credentialThreshold: credential.threshold,
      signerKeyMatches: true,
      nonceFinal: nextNonce.allFinal,
      chainParameters,
    },
  };
}

async function verifiedQuoteSnapshot(quote, allowUsed = false) {
  if (!quote || (!allowUsed && quote.used) || quote.expiresAt <= Date.now()) throw new Error("This quote expired or was already used. Request a fresh quote.");
  const [sellerVerification, buyerVerification, challenge] = await Promise.all([
    inspectBadge(config.sellerBadge, config.sellerPayTo),
    inspectBadge(config.buyerBadge, config.accountAddress),
    requestChallenge(),
  ]);
  if (sellerVerification.status !== "verified" || buyerVerification.status !== "verified") throw new Error("Buyer or seller Registry verification changed. Prepare a new quote.");
  if (challenge.error || JSON.stringify(challenge.summary) !== JSON.stringify(quote.summary)) throw new Error("The seller challenge changed. Prepare a new quote and transaction review.");
}

function reviewResponse(reviewId, prepared) {
  const expiryEpochSeconds = prepared.review.expiryEpochSeconds;
  return {
    status: "review_ready",
    reviewId,
    reviewExpiresAt: new Date(Math.min(expiryEpochSeconds * 1000, Date.now() + QUOTE_TTL_MS)).toISOString(),
    review: {
      ...prepared.review,
      transactionExpiry: new Date(expiryEpochSeconds * 1000).toISOString(),
      buyerAvailableBalanceMicroCcd: prepared.snapshot.buyerBalanceMicroCcd,
      sponsorAvailableBalanceMicroCcd: prepared.snapshot.sponsorBalanceMicroCcd,
      requiredSignatures: {
        accountThreshold: prepared.snapshot.buyerThreshold,
        credentialThreshold: prepared.snapshot.credentialThreshold,
        signerKeyMatchesOnChain: prepared.snapshot.signerKeyMatches,
      },
    },
    paymentEnabled: config.paymentsEnabled,
  };
}

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

export function inspectRequirement(requirement, policy = config) {
  const amount = requirement?.amount ?? requirement?.maxAmountRequired;
  const payTo = requirement?.payTo;
  const asset = requirement?.asset;
  const network = requirement?.network;
  const scheme = requirement?.scheme;
  if (scheme !== "exact") return { ok: false, reason: "Only the exact x402 payment scheme is allowed." };
  if (network !== policy.network) return { ok: false, reason: "The x402 quote is not for Concordium testnet." };
  if (asset !== policy.asset) return { ok: false, reason: "The x402 quote is not for the configured native CCD asset." };
  if (typeof amount !== "string" || !/^\d+$/u.test(amount)) return { ok: false, reason: "The x402 amount is missing or malformed." };
  const configuredCap = policy.maxSpendMicroCcd ? BigInt(policy.maxSpendMicroCcd) : 0n;
  if (configuredCap <= 0n || configuredCap > MAX_PAYMENT_MICROCCD) return { ok: false, reason: "The configured buyer spend ceiling must be between 1 microCCD and 1 CCD." };
  if (BigInt(amount) <= 0n || BigInt(amount) > configuredCap || BigInt(amount) > MAX_PAYMENT_MICROCCD) return { ok: false, reason: "The requested amount exceeds the configured or hard 1 CCD spend ceiling." };
  if (BigInt(amount) !== EXACT_PAYMENT_MICROCCD) return { ok: false, reason: "This prototype currently supports an exact 1 CCD payment only." };
  if (payTo !== policy.sellerPayTo) return { ok: false, reason: "The x402 recipient does not match the configured seller payment wallet." };
  const expirySeconds = requirement?.maxTimeoutSeconds;
  if (!Number.isInteger(expirySeconds) || expirySeconds <= 5 || expirySeconds > 300) return { ok: false, reason: "The quote expiry must be an integer from 6 through 300 seconds." };
  const feePayer = requirement?.extra?.feePayer ?? requirement?.feePayer;
  if (typeof feePayer !== "string" || feePayer.length < 8) return { ok: false, reason: "The quote does not identify the sponsored fee payer." };
  if (!policy.sponsorAddress) return { ok: false, reason: "The configured sponsor fee payer is missing." };
  if (feePayer !== policy.sponsorAddress) return { ok: false, reason: "The quote fee payer does not match the configured sponsor." };
  return {
    ok: true,
    summary: { scheme, network, asset, amountMicroCcd: amount, payTo, maxTimeoutSeconds: expirySeconds, feePayer },
  };
}

export function parseChallenge(response, policy = config) {
  if (response.status !== 402) return { error: `Expected HTTP 402, received ${response.status}.` };
  const payload = parsePaymentRequired(response);
  if (!payload) return { error: "The 402 response did not contain a readable x402 payment challenge." };
  if (payload.x402Version !== 2) return { error: "Only x402 v2 payment challenges are supported." };
  const requirements = candidatesFrom(payload);
  for (const requirement of requirements) {
    const check = inspectRequirement(requirement, policy);
    if (check.ok) return { payload, requirement, summary: check.summary };
  }
  const firstFailure = requirements.map((requirement) => inspectRequirement(requirement, policy)).find((result) => !result.ok);
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

export async function createQuote(ownerId) {
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
    quotes.set(id, { id, ownerId, expiresAt, requirement: challenge.requirement, summary: challenge.summary, verification, challenge: challenge.payload, used: false });
    for (const [key, quote] of quotes) if (quote.expiresAt <= Date.now() || quote.used) quotes.delete(key);
    return { status: "quoted", quoteId: id, checkedAt: new Date().toISOString(), expiresAt: new Date(expiresAt).toISOString(), verification, payment: challenge.summary, spendCapMicroCcd: config.maxSpendMicroCcd, paymentEnabled: config.paymentsEnabled };
  } catch (error) {
    return { status: "unavailable", message: error.name === "TimeoutError" ? "The seller quote timed out. No payment was made." : "The seller quote could not be read. No payment was made." };
  }
}

export async function prepareTransactionReview(quoteId, ownerId) {
  const quote = quotes.get(quoteId);
  if (!quote || quote.ownerId !== ownerId) return { status: "blocked", message: "This quote belongs to another buyer session or has expired. Request a new quote." };
  try {
    for (const [id, item] of preparedReviews) if (item.expiresAt <= Date.now()) preparedReviews.delete(id);
    await verifiedQuoteSnapshot(quote);
    const timeout = Math.min(quote.summary.maxTimeoutSeconds - 5, 45);
    const expiryEpochSeconds = Math.floor(Date.now() / 1000) + timeout;
    const prepared = await readTransactionSnapshot(SDK.TransactionExpiry.fromEpochSeconds(expiryEpochSeconds));
    const reviewId = randomUUID();
    const expiresAt = Math.min(quote.expiresAt, expiryEpochSeconds * 1000);
    preparedReviews.set(reviewId, { quoteId, ownerId, prepared, expiresAt, approved: false });
    return { ...reviewResponse(reviewId, prepared), reviewExpiresAt: new Date(expiresAt).toISOString() };
  } catch (error) {
    return { status: "blocked", message: error.message || "A fresh transaction review could not be prepared." };
  }
}

export async function approveTransactionReview(reviewId, signingDigest, ownerId) {
  const record = preparedReviews.get(reviewId);
  if (record && record.ownerId !== ownerId) return { status: "blocked", message: "This transaction review belongs to another buyer session." };
  if (!record || record.approved || record.expiresAt <= Date.now()) {
    preparedReviews.delete(reviewId);
    return { status: "blocked", message: "This transaction review expired or was already approved. Prepare and review it again." };
  }
  if (signingDigest !== record.prepared.review.signingDigest) {
    preparedReviews.delete(reviewId);
    return { status: "review_changed", message: "The approved digest does not match the prepared transaction. Review a fresh transaction." };
  }
  try {
    const quote = quotes.get(record.quoteId);
    await verifiedQuoteSnapshot(quote);
    const fresh = await readTransactionSnapshot(record.prepared.signable.header.expiry);
    const originalReview = reviewResponse(reviewId, record.prepared).review;
    const freshReview = reviewResponse(reviewId, fresh).review;
    if (JSON.stringify(originalReview) !== JSON.stringify(freshReview)) {
      preparedReviews.delete(reviewId);
      return { status: "review_changed", message: "Nonce, fee, balance, identity, challenge, or transaction details changed. Prepare and approve a new review." };
    }
  } catch (error) {
    preparedReviews.delete(reviewId);
    return { status: "review_changed", message: error.message || "Fresh pre-approval checks failed. Prepare a new review." };
  }
  record.approved = true;
  quotes.get(record.quoteId).used = true;
  return {
    status: "approved_unsubmitted",
    approvalId: reviewId,
    signingDigest,
    message: "Approval was recorded for this exact transaction. Continue only if the displayed 1 CCD Testnet payment is intended.",
  };
}

export function paymentTransaction(response) {
  const encoded = response.headers.get("payment-response") || response.headers.get("x-payment-response");
  if (!encoded) return null;
  for (const value of [encoded, Buffer.from(encoded, "base64url").toString("utf8")]) {
    try {
      const payload = JSON.parse(value);
      if (payload?.success !== true || payload.network !== config.network || typeof payload.transaction !== "string") continue;
      if (!/^(?:0x)?[0-9a-f]{64}$/iu.test(payload.transaction)) continue;
      return payload.transaction.replace(/^0x/iu, "").toLowerCase();
    } catch { /* Try the other encoding. */ }
  }
  return null;
}

function jsonSafe(value) {
  if (typeof value === "bigint") return value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER) ? value.toString() : Number(value);
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  return value;
}

function paymentResponseBody(response) {
  const encoded = response.headers.get("payment-response") || response.headers.get("x-payment-response");
  if (!encoded) return null;
  for (const value of [encoded, Buffer.from(encoded, "base64").toString("utf8"), Buffer.from(encoded, "base64url").toString("utf8")]) {
    try { return JSON.parse(value); } catch { /* Try the other wire encoding. */ }
  }
  return null;
}

export async function confirmPurchase(approvalId, signingDigest, ownerId) {
  const missing = missingPaymentSettings();
  if (missing.length) return { status: "blocked", message: "The local payment policy is not enabled or fully configured.", missing };
  const record = preparedReviews.get(approvalId);
  if (record && record.ownerId !== ownerId) return { status: "blocked", message: "This transaction approval belongs to another buyer session." };
  if (!record || !record.approved || record.processing || record.expiresAt <= Date.now()
    || signingDigest !== record.prepared.review.signingDigest) {
    return { status: "blocked", message: "This exact transaction approval is missing, expired, or already used. Prepare and approve a fresh review." };
  }
  record.processing = true;
  const quote = quotes.get(record.quoteId);
  try {
    if (!signableMatchesReview(record.prepared.signable, record.prepared.review)) throw new Error("The prepared transaction no longer matches its reviewed digest.");
    await verifiedQuoteSnapshot(quote, true);
    const fresh = await readTransactionSnapshot(record.prepared.signable.header.expiry);
    if (JSON.stringify(reviewResponse(approvalId, fresh).review) !== JSON.stringify(reviewResponse(approvalId, record.prepared).review)) {
      throw new Error("Nonce, fee, balance, identity, challenge, or transaction details changed. Prepare a new review.");
    }

    const signer = createDigestBoundSigner(signingDigest, buildBasicAccountSigner(config.privateKey));
    const signed = await SDK.Transaction.sign(record.prepared.signable, signer);
    const signedTransaction = jsonSafe(SDK.Transaction.toJSON(signed));
    const paymentPayload = {
      x402Version: 2,
      payload: { signedTransaction },
      resource: quote.challenge.resource,
      accepted: quote.requirement,
    };
    const encoded = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
    const response = await fetch(config.sellerResourceUrl, {
      method: "GET",
      headers: { accept: "application/json", "payment-signature": encoded },
      redirect: "error",
      signal: AbortSignal.timeout(100_000),
    });
    const bodyText = await response.text();
    let body;
    try { body = JSON.parse(bodyText); } catch { body = null; }
    const settlement = paymentResponseBody(response);
    const transaction = settlement?.success === true ? paymentTransaction(response) : null;
    if (!response.ok || settlement?.success !== true || !transaction || body?.paid !== true) {
      const unresolved = settlement?.errorReason === "settlement_unresolved" || settlement?.errorReason === "finalization_details_unavailable";
      return {
        status: unresolved ? "settlement_unresolved" : "settlement_failed",
        message: unresolved
          ? "Settlement was submitted or may still be processing, but finality was not confirmed. Do not retry this approval; check Testnet before preparing a new transaction."
          : `The seller did not confirm paid fulfillment (HTTP ${response.status}). No success receipt was recorded.`,
        settlement: settlement?.errorReason || "paid_resource_response_missing",
        transaction: settlement?.transaction || "",
      };
    }
    const receipt = appendAudit({
      status: "paid_and_finalized",
      ...(ownerId ? { buyerAuthorizationHash: createHash("sha256").update(ownerId).digest("hex") } : {}),
      network: TESTNET,
      transactionHash: transaction,
      buyer: record.prepared.review.sender,
      seller: record.prepared.review.recipient,
      sponsor: record.prepared.review.sponsor,
      amountMicroCcd: record.prepared.review.amountMicroCcd,
      asset: "CCD",
      feeMicroCcd: record.prepared.review.feeMicroCcd,
      independentCheck: false,
      chainReadbackVerified: true,
      finality: "a second facilitator gRPC read of the finalized block matched buyer, seller, amount, and CCD asset; no separate explorer API read was made",
      explorerUrl: `https://testnet.ccdscan.io/?d=transaction&dsh=${transaction}`,
    });
    return {
      status: "paid_and_finalized",
      message: "Payment finalized on Concordium Testnet. The seller returned the paid resource.",
      transactionHash: transaction,
      receipt,
      resource: body,
      explorerUrl: `https://testnet.ccdscan.io/?d=transaction&dsh=${transaction}`,
    };
  } catch (error) {
    return { status: "settlement_failed", message: error.message || "Purchase stopped before a confirmed paid response. Do not retry this approval." };
  } finally {
    preparedReviews.delete(approvalId);
  }
}
