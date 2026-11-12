import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.mjs";
import { inspectRequirement } from "../src/payment.mjs";

function requirement(feePayer) {
  return {
    scheme: "exact",
    network: config.network,
    asset: config.asset,
    amount: "1000000",
    payTo: config.sellerPayTo,
    maxTimeoutSeconds: 300,
    ...(feePayer === undefined ? {} : { extra: { feePayer } }),
  };
}

test("quote validator rejects a missing fee payer", () => {
  const result = inspectRequirement(requirement(undefined));
  assert.equal(result.ok, false);
  assert.match(result.reason, /fee payer/u);
});

test("quote validator rejects a fee payer that differs from the configured sponsor", () => {
  assert.ok(config.sponsorAddress, "test requires configured sponsor address");
  const result = inspectRequirement(requirement("different-testnet-sponsor-address"));
  assert.equal(result.ok, false);
  assert.equal(result.reason, "The quote fee payer does not match the configured sponsor.");
});

test("quote validator accepts the configured sponsor fee payer", () => {
  assert.ok(config.sponsorAddress, "test requires configured sponsor address");
  const result = inspectRequirement(requirement(config.sponsorAddress));
  assert.equal(result.ok, true);
  assert.equal(result.summary.feePayer, config.sponsorAddress);
});
