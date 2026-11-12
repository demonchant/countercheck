import test from "node:test";
import assert from "node:assert/strict";
import { createChallengeOnlyFacilitator, hasPaymentAuthorization } from "../src/seller-challenge-only.mjs";

const network = "ccd:4221332d34e1694168c2a0c0b3fd0f27";
const sponsor = "4izZERn99ZDyiJ1PjBisVvaHMRNXZ2iZeKfwzd3Qxk6jfQMgY1";

test("challenge-only capability advertises the configured Testnet exact sponsor", async () => {
  const facilitator = createChallengeOnlyFacilitator({ network, sponsorAddress: sponsor });
  assert.deepEqual(await facilitator.getSupported(), {
    kinds: [{ x402Version: 2, scheme: "exact", network, extra: { feePayer: sponsor } }],
    extensions: [],
    signers: { [network]: [sponsor] },
  });
});

test("challenge-only capability refuses verification and settlement", async () => {
  const facilitator = createChallengeOnlyFacilitator({ network, sponsorAddress: sponsor });
  assert.equal((await facilitator.verify()).isValid, false);
  assert.equal((await facilitator.settle()).success, false);
  assert.equal((await facilitator.settle()).errorReason, "settlement_disabled");
});

test("challenge-only request guard detects payment authorization headers without reading their values", () => {
  assert.equal(hasPaymentAuthorization({ "payment-signature": "sensitive-payload" }), true);
  assert.equal(hasPaymentAuthorization({ "x-payment": "sensitive-payload" }), true);
  assert.equal(hasPaymentAuthorization({ accept: "application/json" }), false);
});
