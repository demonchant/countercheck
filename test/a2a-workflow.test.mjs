import test from "node:test";
import assert from "node:assert/strict";
import { compareAgentOfferToQuote } from "../src/a2a-workflow.mjs";

const terms = {
  scheme: "exact",
  network: "ccd:4221332d34e1694168c2a0c0b3fd0f27",
  asset: "CCD",
  amountMicroCcd: "1000000",
  payTo: "registered-seller-wallet",
  maxTimeoutSeconds: 60,
  feePayer: "configured-sponsor",
};

test("A2A coordinator matches seller offer to the independently policy-checked buyer quote", () => {
  const result = compareAgentOfferToQuote(
    { status: "challenge_available", payment: { ...terms } },
    { status: "quoted", payment: { ...terms } },
  );
  assert.equal(result.status, "matched_read_only");
  assert.equal(result.matchedFields.length, 7);
});

test("A2A coordinator blocks recipient, amount, network, asset, and expiry drift", async (context) => {
  const mutations = [
    ["recipient", (value) => { value.payTo = "attacker-wallet"; }],
    ["amount", (value) => { value.amountMicroCcd = "1000001"; }],
    ["network", (value) => { value.network = "ccd:mainnet"; }],
    ["asset", (value) => { value.asset = "OTHER"; }],
    ["expiry", (value) => { value.maxTimeoutSeconds = 300; }],
    ["sponsor", (value) => { value.feePayer = "other-sponsor"; }],
  ];
  for (const [name, mutate] of mutations) {
    await context.test(name, () => {
      const offered = { ...terms };
      mutate(offered);
      assert.deepEqual(compareAgentOfferToQuote(
        { status: "challenge_available", payment: offered },
        { status: "quoted", payment: { ...terms } },
      ), { status: "blocked", reason: "payment_terms_mismatch", mismatches: [name === "recipient" ? "payTo" : name === "amount" ? "amountMicroCcd" : name === "expiry" ? "maxTimeoutSeconds" : name === "sponsor" ? "feePayer" : name] });
    });
  }
});

test("A2A coordinator blocks absent or unsuccessful quotes and incomplete requirements", () => {
  assert.equal(compareAgentOfferToQuote({ status: "challenge_available", payment: terms }, { status: "blocked" }).status, "blocked");
  assert.equal(compareAgentOfferToQuote({ status: "challenge_available" }, { status: "quoted", payment: terms }).reason, "payment_terms_missing");
});
