import test from "node:test";
import assert from "node:assert/strict";
import * as SDK from "@concordium/web-sdk";
import { buildSponsoredTransferReview, createDigestBoundSigner, signableMatchesReview, TESTNET } from "../src/payment-transaction.mjs";

const parties = {
  network: TESTNET,
  sender: "3phKp6hd4vJU3WHexeVrc7mrkFbx3S9UtAxxsPEwE7S6rmNq7x",
  recipient: "44khdNXk2yBn8PvJYFYNsKuZrV8oUvdHo23bL6dA7YyEYGkEF7",
  sponsor: "4izZERn99ZDyiJ1PjBisVvaHMRNXZ2iZeKfwzd3Qxk6jfQMgY1",
  amountMicroCcd: "1000000",
  asset: "CCD",
  nonce: SDK.SequenceNumber.create(5n),
  expiry: SDK.TransactionExpiry.fromEpochSeconds(Math.floor(Date.now() / 1000) + 55),
  chainParameters: {
    euroPerEnergy: { numerator: 1n, denominator: 50_000n },
    microGTUPerEuro: { numerator: 1_000_000n, denominator: 1n },
  },
};

test("prepare produces exact unsigned Testnet V1 review without invoking a signer", () => {
  const prepared = buildSponsoredTransferReview(parties);
  assert.equal(prepared.signable.version, 1);
  assert.equal(prepared.review.network, TESTNET);
  assert.equal(prepared.review.sender, parties.sender);
  assert.equal(prepared.review.recipient, parties.recipient);
  assert.equal(prepared.review.amountMicroCcd, "1000000");
  assert.equal(prepared.review.asset, "CCD");
  assert.equal(prepared.review.sponsor, parties.sponsor);
  assert.equal(prepared.review.feePayer, parties.sponsor);
  assert.equal(prepared.review.nonce, "5");
  assert.equal(prepared.review.signingDigest.length, 64);
  assert.equal(prepared.signable.signatures.sender[0], undefined);
  assert.equal(prepared.signable.signatures.sponsor, undefined);
  assert.equal(signableMatchesReview(prepared.signable, prepared.review), true);
});

test("prepare rejects Mainnet, non-CCD assets, and amounts other than exactly 1 CCD", () => {
  assert.throws(() => buildSponsoredTransferReview({ ...parties, network: "ccd:mainnet" }), /Testnet/u);
  assert.throws(() => buildSponsoredTransferReview({ ...parties, asset: "EURR" }), /native CCD/u);
  assert.throws(() => buildSponsoredTransferReview({ ...parties, amountMicroCcd: "999999" }), /exactly 1 CCD/u);
  assert.throws(() => buildSponsoredTransferReview({ ...parties, amountMicroCcd: "1000001" }), /exactly 1 CCD/u);
});

test("changing recipient, sponsor, nonce, or expiry changes the approved digest", () => {
  const original = buildSponsoredTransferReview(parties).review;
  for (const altered of [
    { ...parties, recipient: parties.sender },
    { ...parties, sponsor: parties.recipient },
    { ...parties, nonce: SDK.SequenceNumber.create(6n) },
    { ...parties, expiry: SDK.TransactionExpiry.fromEpochSeconds(Math.floor(Date.now() / 1000) + 90) },
  ]) {
    const changed = buildSponsoredTransferReview(altered);
    assert.notEqual(changed.review.signingDigest, original.signingDigest);
    assert.equal(signableMatchesReview(changed.signable, original), false);
  }
});

test("digest-bound signer does not invoke signing key for an altered transaction", async () => {
  let calls = 0;
  const signer = { getSignatureCount: () => 1n, async sign() { calls += 1; return { 0: { 0: "fixture-signature" } }; } };
  const prepared = buildSponsoredTransferReview(parties);
  const guarded = createDigestBoundSigner(prepared.review.signingDigest, signer);
  await assert.rejects(guarded.sign(Buffer.alloc(32, 1)), /changed after review/u);
  assert.equal(calls, 0);
  await guarded.sign(Buffer.from(prepared.review.signingDigest, "hex"));
  assert.equal(calls, 1);
});
