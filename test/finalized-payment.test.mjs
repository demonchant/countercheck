import test from "node:test";
import assert from "node:assert/strict";
import * as SDK from "@concordium/web-sdk";
import { inspectFinalizedPayment, paidFulfillmentHasIndependentProof, readFinalizedPayment } from "../src/finalized-payment.mjs";
import { buildSponsoredTransferReview, TESTNET } from "../src/payment-transaction.mjs";

const expected = {
  network: TESTNET,
  transactionHash: "a".repeat(64),
  sender: "3phKp6hd4vJU3WHexeVrc7mrkFbx3S9UtAxxsPEwE7S6rmNq7x",
  recipient: "44khdNXk2yBn8PvJYFYNsKuZrV8oUvdHo23bL6dA7YyEYGkEF7",
  sponsor: "4izZERn99ZDyiJ1PjBisVvaHMRNXZ2iZeKfwzd3Qxk6jfQMgY1",
  amountMicroCcd: "1000000",
};

function finalizedSummary(overrides = {}) {
  return {
    type: SDK.TransactionSummaryType.AccountTransaction,
    transactionType: SDK.TransactionKindString.Transfer,
    hash: SDK.TransactionHash.fromHexString(expected.transactionHash),
    sender: SDK.AccountAddress.fromBase58(expected.sender),
    sponsor: { sponsor: SDK.AccountAddress.fromBase58(expected.sponsor), cost: SDK.CcdAmount.fromMicroCcd(210n) },
    transfer: {
      tag: SDK.TransactionEventTag.Transferred,
      to: SDK.AccountAddress.fromBase58(expected.recipient),
      amount: SDK.CcdAmount.fromMicroCcd(1_000_000n),
    },
    ...overrides,
  };
}

test("buyer-side chain read-back accepts only the exact finalized sponsored CCD transfer", () => {
  const result = inspectFinalizedPayment({
    status: SDK.TransactionStatusEnum.Finalized,
    outcome: { blockHash: "finalized-block-fixture", summary: finalizedSummary() },
  }, expected);
  assert.equal(result.status, "verified");
  assert.equal(result.transactionHash, expected.transactionHash);
  assert.equal(result.sender, expected.sender);
  assert.equal(result.recipient, expected.recipient);
  assert.equal(result.sponsor, expected.sponsor);
  assert.equal(result.amountMicroCcd, "1000000");
});

test("seller success cannot replace a missing, pending, committed, or unknown chain read-back", () => {
  for (const status of [undefined, { status: SDK.TransactionStatusEnum.Received }, { status: SDK.TransactionStatusEnum.Committed },
    { status: SDK.TransactionStatusEnum.Finalized, outcome: { summary: null } }]) {
    assert.equal(inspectFinalizedPayment(status, expected).status, "unresolved");
  }
});

test("finalized transactions with the wrong hash, parties, amount, sponsor, or transaction type are rejected", () => {
  const cases = [
    finalizedSummary({ hash: SDK.TransactionHash.fromHexString("b".repeat(64)) }),
    finalizedSummary({ sender: SDK.AccountAddress.fromBase58(expected.recipient) }),
    finalizedSummary({ transfer: { ...finalizedSummary().transfer, to: SDK.AccountAddress.fromBase58(expected.sender) } }),
    finalizedSummary({ transfer: { ...finalizedSummary().transfer, amount: SDK.CcdAmount.fromMicroCcd(999_999n) } }),
    finalizedSummary({ sponsor: { sponsor: SDK.AccountAddress.fromBase58(expected.sender), cost: SDK.CcdAmount.fromMicroCcd(210n) } }),
    finalizedSummary({ transactionType: SDK.TransactionKindString.Failed }),
  ];
  for (const summary of cases) {
    const result = inspectFinalizedPayment({ status: SDK.TransactionStatusEnum.Finalized, outcome: { summary } }, expected);
    assert.equal(result.status, "mismatch");
    assert.ok(result.mismatches.length > 0);
  }
});

test("readFinalizedPayment queries the locally expected hash and fails closed on node errors", async () => {
  let observedHash;
  const result = await readFinalizedPayment({
    async getBlockItemStatus(hash) {
      observedHash = hash.toString();
      return { status: SDK.TransactionStatusEnum.Finalized, outcome: { summary: finalizedSummary() } };
    },
  }, expected);
  assert.equal(observedHash, expected.transactionHash);
  assert.equal(result.status, "verified");

  const unavailable = await readFinalizedPayment({ async getBlockItemStatus() { throw new Error("node unavailable"); } }, expected);
  assert.deepEqual(unavailable, { status: "unresolved", reason: "chain_read_unavailable" });
});

test("seller success headers alone cannot authorize a paid receipt", () => {
  const sellerClaims = {
    httpStatus: 200,
    settlement: { success: true },
    responseTransaction: expected.transactionHash,
    body: { paid: true },
    expectedTransactionHash: expected.transactionHash,
  };
  assert.equal(paidFulfillmentHasIndependentProof(sellerClaims), false);
  assert.equal(paidFulfillmentHasIndependentProof({
    ...sellerClaims,
    chainVerification: { status: "unresolved", transactionHash: expected.transactionHash },
  }), false);
  assert.equal(paidFulfillmentHasIndependentProof({
    ...sellerClaims,
    chainVerification: { status: "verified", transactionHash: "b".repeat(64) },
  }), false);
  assert.equal(paidFulfillmentHasIndependentProof({
    ...sellerClaims,
    chainVerification: { status: "verified", transactionHash: expected.transactionHash },
  }), true);
});

test("Concordium SDK computes the expected hash from the exact signed transaction", async () => {
  const prepared = buildSponsoredTransferReview({
    network: TESTNET,
    sender: expected.sender,
    recipient: expected.recipient,
    sponsor: expected.sponsor,
    amountMicroCcd: expected.amountMicroCcd,
    asset: "CCD",
    nonce: SDK.SequenceNumber.create(8n),
    expiry: SDK.TransactionExpiry.fromEpochSeconds(Math.floor(Date.now() / 1000) + 60),
    chainParameters: {
      euroPerEnergy: { numerator: 1n, denominator: 50_000n },
      microGTUPerEuro: { numerator: 1_000_000n, denominator: 1n },
    },
  });
  const signed = await SDK.Transaction.sign(prepared.signable, SDK.buildBasicAccountSigner("01".repeat(32)));
  const hash = Buffer.from(SDK.Transaction.getAccountTransactionHash(SDK.Transaction.finalize(signed))).toString("hex");
  assert.match(hash, /^[0-9a-f]{64}$/u);
  assert.equal(inspectFinalizedPayment({ status: SDK.TransactionStatusEnum.Received }, { ...expected, transactionHash: hash }).status, "unresolved");
});
