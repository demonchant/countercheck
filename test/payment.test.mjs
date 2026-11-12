import test from "node:test";
import assert from "node:assert/strict";
import { inspectRequirement, parseChallenge, paymentTransaction } from "../src/payment.mjs";

const policy = {
  network: "ccd:4221332d34e1694168c2a0c0b3fd0f27",
  asset: "CCD",
  maxSpendMicroCcd: "1000000",
  sellerPayTo: "seller-test-address",
  sponsorAddress: "sponsor-test-address",
};

function requirement(feePayer = policy.sponsorAddress) {
  return {
    scheme: "exact",
    network: policy.network,
    asset: policy.asset,
    amount: "1000000",
    payTo: policy.sellerPayTo,
    maxTimeoutSeconds: 300,
    ...(feePayer === undefined ? {} : { extra: { feePayer } }),
  };
}

test("quote validator rejects a missing fee payer", () => {
  const result = inspectRequirement(requirement(null), policy);
  assert.equal(result.ok, false);
  assert.match(result.reason, /fee payer/u);
});

test("quote validator rejects an omitted extra object or omitted required payment fields", async (context) => {
  const cases = [
    ["fee payer extension", (value) => { delete value.extra; }],
    ["scheme", (value) => { delete value.scheme; }],
    ["network", (value) => { delete value.network; }],
    ["asset", (value) => { delete value.asset; }],
    ["amount", (value) => { delete value.amount; }],
    ["recipient", (value) => { delete value.payTo; }],
    ["expiry", (value) => { delete value.maxTimeoutSeconds; }],
  ];
  for (const [name, mutate] of cases) {
    await context.test(name, () => {
      const value = requirement();
      mutate(value);
      assert.equal(inspectRequirement(value, policy).ok, false);
    });
  }
});

test("quote validator rejects a fee payer that differs from the configured sponsor", () => {
  const result = inspectRequirement(requirement("different-testnet-sponsor-address"), policy);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "The quote fee payer does not match the configured sponsor.");
});

test("quote validator accepts the configured sponsor fee payer", () => {
  const result = inspectRequirement(requirement(), policy);
  assert.equal(result.ok, true);
  assert.equal(result.summary.feePayer, policy.sponsorAddress);
  assert.equal(result.summary.amountMicroCcd, "1000000");
});

test("quote validator rejects wrong scheme, network, asset, amount, recipient, expiry, and sponsor", async (context) => {
  const failures = [
    ["wrong scheme", (value) => { value.scheme = "upto"; }],
    ["wrong network", (value) => { value.network = "ccd:mainnet"; }],
    ["non-native asset", (value) => { value.asset = "EURR"; }],
    ["amount above 1 CCD", (value) => { value.amount = "1000001"; }],
    ["zero amount", (value) => { value.amount = "0"; }],
    ["wrong recipient", (value) => { value.payTo = "another-seller"; }],
    ["fractional expiry", (value) => { value.maxTimeoutSeconds = 20.5; }],
    ["too-short expiry", (value) => { value.maxTimeoutSeconds = 5; }],
    ["too-long expiry", (value) => { value.maxTimeoutSeconds = 301; }],
    ["wrong sponsor", (value) => { value.extra.feePayer = "another-sponsor"; }],
  ];
  for (const [name, mutate] of failures) {
    await context.test(name, () => {
      const value = requirement();
      mutate(value);
      assert.equal(inspectRequirement(value, policy).ok, false);
    });
  }
});

test("quote validator rejects a spend cap configured above the hard 1 CCD ceiling", () => {
  const result = inspectRequirement(requirement(), { ...policy, maxSpendMicroCcd: "1000001" });
  assert.equal(result.ok, false);
});

test("challenge parser accepts a constructed x402 v2 402 fixture (not live evidence)", () => {
  const encoded = Buffer.from(JSON.stringify({ x402Version: 2, accepts: [requirement()] })).toString("base64url");
  const parsed = parseChallenge(new Response(null, { status: 402, headers: { "payment-required": encoded } }), policy);
  assert.equal(parsed.summary.amountMicroCcd, "1000000");
  assert.equal(parsed.summary.network, policy.network);
});

test("challenge parser refuses a non-v2 challenge and changed quote terms", async (context) => {
  const staleVersion = Buffer.from(JSON.stringify({ x402Version: 1, accepts: [requirement()] })).toString("base64url");
  assert.match(parseChallenge(new Response(null, { status: 402, headers: { "payment-required": staleVersion } }), policy).error, /v2/u);
  const wrongAmount = requirement(); wrongAmount.amount = "1000001";
  const encoded = Buffer.from(JSON.stringify({ x402Version: 2, accepts: [wrongAmount] })).toString("base64url");
  await context.test("challenge above hard cap", () => {
    assert.match(parseChallenge(new Response(null, { status: 402, headers: { "payment-required": encoded } }), policy).error, /ceiling/u);
  });
  await context.test("non-402 response", () => {
    assert.match(parseChallenge(new Response(null, { status: 200 }), policy).error, /Expected HTTP 402/u);
  });
});

test("payment response parser accepts Concordium's 32-byte hex hash without a prefix only on successful Testnet response", () => {
  const transaction = "a".repeat(64);
  const encoded = Buffer.from(JSON.stringify({ success: true, network: policy.network, transaction })).toString("base64url");
  const response = new Response(null, { status: 200, headers: { "payment-response": encoded } });
  assert.equal(paymentTransaction(response), transaction);
  const wrongNetwork = new Response(null, { status: 200, headers: { "payment-response": Buffer.from(JSON.stringify({ success: true, network: "ccd:mainnet", transaction })).toString("base64url") } });
  assert.equal(paymentTransaction(wrongNetwork), null);
  const unresolved = new Response(null, { status: 200, headers: { "payment-response": Buffer.from(JSON.stringify({ success: false, network: policy.network, transaction })).toString("base64url") } });
  assert.equal(paymentTransaction(unresolved), null);
});
