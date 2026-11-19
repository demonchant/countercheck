import * as SDK from "@concordium/web-sdk";

export const TESTNET = "ccd:4221332d34e1694168c2a0c0b3fd0f27";
export const EXACT_PAYMENT_MICROCCD = 1_000_000n;

function jsonSafe(value) {
  if (typeof value === "bigint") {
    return value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)
      ? value.toString()
      : Number(value);
  }
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  return value;
}

/** Build the exact unsigned V1 sponsored CCD transfer used for an x402 v2 review. */
export function buildSponsoredTransferReview({ network, sender, recipient, sponsor, amountMicroCcd, asset, nonce, expiry, chainParameters }) {
  if (network !== TESTNET) throw new Error("Only Concordium Testnet payments can be prepared.");
  if (asset !== "CCD") throw new Error("Only native CCD payments can be prepared.");
  if (BigInt(amountMicroCcd) !== EXACT_PAYMENT_MICROCCD) throw new Error("The reviewed payment must be exactly 1 CCD.");

  const senderAddress = SDK.AccountAddress.fromBase58(sender);
  const recipientAddress = SDK.AccountAddress.fromBase58(recipient);
  const sponsorAddress = SDK.AccountAddress.fromBase58(sponsor);
  const payload = SDK.Transaction.transfer({
    toAddress: recipientAddress,
    amount: SDK.CcdAmount.fromMicroCcd(EXACT_PAYMENT_MICROCCD),
  });
  const signable = payload
    .addMetadata({ sender: senderAddress, nonce, expiry })
    .addSponsor(sponsorAddress)
    .build();
  if (signable.version !== 1 || signable.header.sender.toString() !== senderAddress.toString()
    || signable.header.sponsor?.account?.toString() !== sponsorAddress.toString()
    || signable.payload.type !== SDK.AccountTransactionType.Transfer
    || signable.payload.toAddress.toString() !== recipientAddress.toString()
    || BigInt(SDK.CcdAmount.toMicroCcd(signable.payload.amount)) !== EXACT_PAYMENT_MICROCCD) {
    throw new Error("The prepared transaction does not match the reviewed parties and amount.");
  }

  const energy = SDK.Transaction.getEnergyCost(signable);
  const fee = SDK.convertEnergyToMicroCcd(energy, chainParameters);
  const signingDigest = Buffer.from(SDK.AccountTransactionV1.signDigest(SDK.Transaction.preFinalized(signable))).toString("hex");
  const transaction = jsonSafe(SDK.Transaction.toJSON(signable));
  return Object.freeze({
    signable,
    review: Object.freeze({
      network,
      sender: senderAddress.toString(),
      recipient: recipientAddress.toString(),
      amountMicroCcd: EXACT_PAYMENT_MICROCCD.toString(),
      asset: "CCD",
      sponsor: sponsorAddress.toString(),
      feePayer: sponsorAddress.toString(),
      nonce: signable.header.nonce.value.toString(),
      expiryEpochSeconds: Number(signable.header.expiry.expiryEpochSeconds),
      energy: energy.value.toString(),
      feeMicroCcd: fee.microCcdAmount.toString(),
      signingDigest,
      transaction,
    }),
  });
}

export function signableMatchesReview(signable, review) {
  if (!signable || !review || signable.version !== 1) return false;
  try {
    return Buffer.from(SDK.AccountTransactionV1.signDigest(SDK.Transaction.preFinalized(signable))).toString("hex") === review.signingDigest
      && signable.header.sender.toString() === review.sender
      && signable.header.sponsor?.account?.toString() === review.sponsor
      && signable.payload.type === SDK.AccountTransactionType.Transfer
      && signable.payload.toAddress.toString() === review.recipient
      && SDK.CcdAmount.toMicroCcd(signable.payload.amount).toString() === review.amountMicroCcd
      && signable.header.nonce.value.toString() === review.nonce
      && Number(signable.header.expiry.expiryEpochSeconds) === review.expiryEpochSeconds;
  } catch {
    return false;
  }
}

/** Refuse to invoke the buyer key unless the SDK asks to sign the approved digest. */
export function createDigestBoundSigner(expectedDigest, signer) {
  if (!/^[0-9a-f]{64}$/u.test(expectedDigest || "") || !signer || typeof signer.sign !== "function") {
    throw new Error("A reviewed transaction digest and account signer are required.");
  }
  return Object.freeze({
    getSignatureCount: () => signer.getSignatureCount(),
    async sign(digest) {
      if (Buffer.from(digest).toString("hex") !== expectedDigest) {
        throw new Error("The transaction changed after review; prepare and approve it again.");
      }
      return signer.sign(digest);
    },
  });
}
