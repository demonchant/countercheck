import * as SDK from "@concordium/web-sdk";

const TESTNET = "ccd:4221332d34e1694168c2a0c0b3fd0f27";

export function paidFulfillmentHasIndependentProof({ httpStatus, settlement, responseTransaction, body, expectedTransactionHash, chainVerification }) {
  const expectedHash = String(expectedTransactionHash || "").replace(/^0x/iu, "").toLowerCase();
  return httpStatus >= 200 && httpStatus < 300
    && settlement?.success === true
    && String(responseTransaction || "").replace(/^0x/iu, "").toLowerCase() === expectedHash
    && body?.paid === true
    && chainVerification?.status === "verified"
    && chainVerification.transactionHash === expectedHash;
}

function address(value) {
  try { return value?.toString() || null; }
  catch { return null; }
}

function amount(value) {
  try { return SDK.CcdAmount.toMicroCcd(value).toString(); }
  catch { return null; }
}

/** Validate a node read-back; seller response fields are never treated as chain proof. */
export function inspectFinalizedPayment(status, expected) {
  const transactionHash = String(expected?.transactionHash || "").replace(/^0x/iu, "").toLowerCase();
  if (expected?.network !== TESTNET || !/^[0-9a-f]{64}$/u.test(transactionHash)) {
    return { status: "unresolved", reason: "invalid_expected_payment" };
  }
  if (status?.status !== SDK.TransactionStatusEnum.Finalized) {
    return { status: "unresolved", reason: status?.status === "committed" || status?.status === "received" ? "transaction_not_finalized" : "transaction_status_unavailable" };
  }

  const summary = status.outcome?.summary;
  if (!summary) return { status: "unresolved", reason: "finalized_summary_unavailable" };

  const observedHash = address(summary.hash)?.replace(/^0x/iu, "").toLowerCase();
  const observedSender = address(summary.sender);
  const observedRecipient = address(summary.transfer?.to);
  const observedSponsor = address(summary.sponsor?.sponsor);
  const observedAmount = amount(summary.transfer?.amount);
  const mismatches = [];
  if (summary.type !== SDK.TransactionSummaryType.AccountTransaction
    || summary.transactionType !== SDK.TransactionKindString.Transfer) mismatches.push("transactionType");
  if (observedHash !== transactionHash) mismatches.push("transactionHash");
  if (observedSender !== expected.sender) mismatches.push("sender");
  if (observedRecipient !== expected.recipient) mismatches.push("recipient");
  if (observedSponsor !== expected.sponsor) mismatches.push("sponsor");
  if (observedAmount !== String(expected.amountMicroCcd)) mismatches.push("amountMicroCcd");
  if (mismatches.length) return { status: "mismatch", reason: "finalized_transaction_does_not_match_review", mismatches };

  return {
    status: "verified",
    transactionHash,
    sender: observedSender,
    recipient: observedRecipient,
    sponsor: observedSponsor,
    amountMicroCcd: observedAmount,
    blockHash: address(status.outcome?.blockHash),
  };
}

export async function readFinalizedPayment(grpc, expected) {
  try {
    const rawHash = String(expected?.transactionHash || "").replace(/^0x/iu, "");
    if (!/^[0-9a-f]{64}$/iu.test(rawHash)) return { status: "unresolved", reason: "invalid_expected_payment" };
    const status = await grpc.getBlockItemStatus(SDK.TransactionHash.fromHexString(rawHash));
    return inspectFinalizedPayment(status, expected);
  } catch {
    return { status: "unresolved", reason: "chain_read_unavailable" };
  }
}
