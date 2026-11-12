import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFacilitatorApi } from "../src/facilitator-core.mjs";
import { createFacilitatorServer } from "../src/facilitator-server.mjs";
import { createSettlementStore, settlementKey } from "../src/facilitator-store.mjs";
import { ExactConcordiumScheme } from "@x402/concordium/exact/facilitator";
import { x402Facilitator } from "@x402/core/facilitator";
import { facilitatorConfig } from "../src/facilitator-config.mjs";

const network = "ccd:4221332d34e1694168c2a0c0b3fd0f27";
const buyer = "buyer-test-account";
const seller = "seller-test-account";
const sponsor = "sponsor-test-account";
const policy = {
  network,
  buyerAddress: buyer,
  sellerPayTo: seller,
  sponsorAddress: sponsor,
  settlementEnabled: true,
  maxAmountMicroCcd: "1000000",
  minSponsorBalanceMicroCcd: "10000",
};

function request() {
  const paymentRequirements = {
    scheme: "exact",
    network,
    asset: "CCD",
    amount: "125000",
    payTo: seller,
    maxTimeoutSeconds: 300,
    extra: { feePayer: sponsor },
  };
  return {
    paymentPayload: {
      x402Version: 2,
      accepted: structuredClone(paymentRequirements),
      payload: {
        signedTransaction: {
          version: 1,
          header: { sender: buyer, nonce: 4, expiry: Math.floor(Date.now() / 1000) + 120, sponsor: { address: sponsor } },
          payload: { type: "transfer", toAddress: seller, amount: "125000" },
          signatures: { sender: { "0": { "0": "mock-signature" } }, sponsor: {} },
        },
      },
    },
    paymentRequirements,
  };
}

function memoryStore() {
  const records = new Map();
  return {
    records,
    get(key) { return records.get(key) || null; },
    claim(key, details) {
      if (records.has(key)) return { claimed: false, record: records.get(key) };
      const record = { key, ...details, status: "claimed" };
      records.set(key, record);
      return { claimed: true, record };
    },
    update(key, fields) {
      const next = { ...records.get(key), ...fields };
      records.set(key, next);
      return next;
    },
  };
}

function fixture({ verifyResult = { isValid: true, payer: buyer }, settleResult = { success: true, transaction: "a".repeat(64), network, payer: buyer }, finalizedInfo = { status: "finalized", sender: buyer, recipient: seller, amount: "125000", asset: "CCD" }, balance = 50000n, enabled = true } = {}) {
  const calls = { verify: 0, settle: 0 };
  const scheme = {
    async verify() { calls.verify += 1; return verifyResult; },
    async settle() { calls.settle += 1; return settleResult; },
  };
  const store = memoryStore();
  const api = createFacilitatorApi({
    scheme,
    store,
    policy: { ...policy, settlementEnabled: enabled },
    getSponsorAvailableMicroCcd: async () => balance,
    getFinalizedTransactionInfo: async () => finalizedInfo,
  });
  return { api, calls, store };
}

test("successful Testnet settlement finalizes once and records only a receipt", async () => {
  const { api, calls, store } = fixture();
  const { paymentPayload, paymentRequirements } = request();
  const result = await api.settle(paymentPayload, paymentRequirements);
  assert.equal(result.success, true);
  assert.equal(result.network, network);
  assert.equal(result.payer, buyer);
  assert.equal(calls.settle, 1);
  const [record] = store.records.values();
  assert.equal(record.status, "finalized");
  assert.equal(record.amountMicroCcd, "125000");
  assert.equal("signatures" in record, false);
});

test("finalized summary must include exact authorized sender, recipient, CCD amount, and asset", async (context) => {
  for (const [name, finalizedInfo] of [
    ["sender mismatch", { status: "finalized", sender: seller, recipient: seller, amount: "125000", asset: "CCD" }],
    ["sender missing", { status: "finalized", recipient: seller, amount: "125000", asset: "CCD" }],
    ["recipient mismatch", { status: "finalized", sender: buyer, recipient: buyer, amount: "125000", asset: "CCD" }],
    ["recipient missing", { status: "finalized", sender: buyer, amount: "125000", asset: "CCD" }],
    ["amount mismatch", { status: "finalized", sender: buyer, recipient: seller, amount: "125001", asset: "CCD" }],
    ["amount missing", { status: "finalized", sender: buyer, recipient: seller, asset: "CCD" }],
    ["asset mismatch", { status: "finalized", sender: buyer, recipient: seller, amount: "125000", asset: "TOKEN" }],
    ["asset missing", { status: "finalized", sender: buyer, recipient: seller, amount: "125000" }],
  ]) {
    await context.test(name, async () => {
      const { api, store } = fixture({ finalizedInfo });
      const { paymentPayload, paymentRequirements } = request();
      const result = await api.settle(paymentPayload, paymentRequirements);
      assert.equal(result.success, false);
      assert.equal(result.errorReason, "finalized_details_mismatch");
      assert.equal([...store.records.values()][0].status, "unresolved");
    });
  }
});

test("facilitator configuration never exposes the buyer private key and keeps settlement disabled", () => {
  assert.equal("buyerPrivateKey" in facilitatorConfig, false);
  assert.equal("sponsorPrivateKey" in facilitatorConfig, true);
  assert.equal(facilitatorConfig.settlementEnabled, false);
});

test("invalid buyer signature verification prevents sponsor settlement", async () => {
  const { api, calls, store } = fixture({
    verifyResult: { isValid: false, invalidReason: "invalid_sender_signature", payer: buyer },
  });
  const { paymentPayload, paymentRequirements } = request();
  const result = await api.settle(paymentPayload, paymentRequirements);
  assert.equal(result.success, false);
  assert.equal(result.errorReason, "invalid_sender_signature");
  assert.equal(calls.settle, 0);
  assert.equal(store.records.size, 0);
});

test("installed Concordium x402 facilitator advertises v2 exact Testnet and configured fee payer", () => {
  const signer = { getAddress: () => sponsor, getNetwork: () => network };
  const scheme = new ExactConcordiumScheme({ signer });
  const supported = new x402Facilitator().register(network, scheme).getSupported();
  assert.deepEqual(supported.kinds[0], { x402Version: 2, scheme: "exact", network, extra: { feePayer: sponsor } });
});

test("buyer with insufficient funds is refused before settlement", async () => {
  const { api, calls } = fixture({ verifyResult: { isValid: false, invalidReason: "preflight_insufficient_funds", payer: buyer } });
  const { paymentPayload, paymentRequirements } = request();
  const result = await api.settle(paymentPayload, paymentRequirements);
  assert.equal(result.success, false);
  assert.equal(result.errorReason, "preflight_insufficient_funds");
  assert.equal(calls.settle, 0);
});

test("insufficient sponsor reserve refuses before sponsor signing or submission", async () => {
  const { api, calls, store } = fixture({ balance: 9999n });
  const { paymentPayload, paymentRequirements } = request();
  const result = await api.settle(paymentPayload, paymentRequirements);
  assert.equal(result.success, false);
  assert.equal(result.errorReason, "insufficient_sponsor_reserve");
  assert.equal(calls.settle, 0);
  assert.equal(store.records.size, 0);
});

test("wrong recipient, wrong network, and over-cap amount are rejected", async (context) => {
  for (const [name, mutate, reason] of [
    ["recipient", (r) => { r.paymentRequirements.payTo = buyer; r.paymentPayload.accepted.payTo = buyer; }, "recipient_mismatch"],
    ["network", (r) => { r.paymentRequirements.network = "ccd:mainnet"; r.paymentPayload.accepted.network = "ccd:mainnet"; }, "unsupported_network_or_scheme"],
    ["amount", (r) => { r.paymentRequirements.amount = "1000001"; r.paymentPayload.accepted.amount = "1000001"; r.paymentPayload.payload.signedTransaction.payload.amount = "1000001"; }, "amount_over_policy_limit"],
  ]) {
    await context.test(name, async () => {
      const { api, calls } = fixture();
      const value = request();
      mutate(value);
      const result = await api.settle(value.paymentPayload, value.paymentRequirements);
      assert.equal(result.success, false);
      assert.equal(result.errorReason, reason);
      assert.equal(calls.verify, 0);
      assert.equal(calls.settle, 0);
    });
  }
});

test("transaction recipient and amount must match the seller requirements", async () => {
  const { api, calls } = fixture();
  const value = request();
  value.paymentPayload.payload.signedTransaction.payload.amount = "124999";
  const result = await api.settle(value.paymentPayload, value.paymentRequirements);
  assert.equal(result.errorReason, "transaction_transfer_mismatch");
  assert.equal(calls.verify, 0);
});

test("persistent store claims a canonical payload only once across store instances", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "countercheck-facilitator-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const value = request();
  const key = settlementKey(value.paymentPayload);
  const firstStore = createSettlementStore(directory);
  const secondStore = createSettlementStore(directory);
  assert.equal(firstStore.claim(key, { buyer }).claimed, true);
  assert.equal(secondStore.claim(key, { buyer }).claimed, false);
  assert.equal(secondStore.get(key).buyer, buyer);
  firstStore.update(key, { status: "finalized", response: { success: true, network } });
  assert.equal(secondStore.get(key).status, "finalized");
});

test("duplicate payment payload returns prior result without a second settlement", async () => {
  const { api, calls } = fixture();
  const { paymentPayload, paymentRequirements } = request();
  const first = await api.settle(paymentPayload, paymentRequirements);
  const duplicate = await api.settle(paymentPayload, paymentRequirements);
  assert.equal(first.success, true);
  assert.deepEqual(duplicate, first);
  assert.equal(calls.settle, 1);
  assert.equal(calls.verify, 1);
});

test("concurrent duplicate requests claim the payload only once", async () => {
  const { api, calls } = fixture();
  const { paymentPayload, paymentRequirements } = request();
  const results = await Promise.all([
    api.settle(paymentPayload, paymentRequirements),
    api.settle(paymentPayload, paymentRequirements),
  ]);
  assert.equal(results.filter((result) => result.success).length, 1);
  assert.equal(calls.settle, 1);
});

test("a failed on-chain payment is recorded and never resubmitted", async () => {
  const { api, calls, store } = fixture({ settleResult: { success: false, transaction: "b".repeat(64), network, payer: buyer, errorReason: `finalization_failed: Transaction ${"b".repeat(64)} failed on-chain` } });
  const { paymentPayload, paymentRequirements } = request();
  const first = await api.settle(paymentPayload, paymentRequirements);
  const second = await api.settle(paymentPayload, paymentRequirements);
  assert.equal(first.success, false);
  assert.equal(first.errorReason, "transaction_failed");
  assert.equal(second.errorReason, "duplicate_or_unresolved_settlement");
  assert.equal(calls.settle, 1);
  assert.equal([...store.records.values()][0].status, "failed");
});

test("ambiguous transaction result is replay-blocked for reconciliation", async () => {
  const { api, calls, store } = fixture({ settleResult: { success: false, transaction: "c".repeat(64), network, payer: buyer, errorReason: "finalization_timeout" } });
  const { paymentPayload, paymentRequirements } = request();
  const result = await api.settle(paymentPayload, paymentRequirements);
  assert.equal(result.errorReason, "settlement_unresolved");
  assert.equal([...store.records.values()][0].status, "unresolved");
  const retry = await api.settle(paymentPayload, paymentRequirements);
  assert.equal(retry.errorReason, "duplicate_or_unresolved_settlement");
  assert.equal(calls.settle, 1);
});

test("settlement stays disabled unless the explicit setting is enabled", async () => {
  const { api, calls } = fixture({ enabled: false });
  const { paymentPayload, paymentRequirements } = request();
  const result = await api.settle(paymentPayload, paymentRequirements);
  assert.equal(result.errorReason, "settlement_disabled");
  assert.equal(calls.verify, 0);
  assert.equal(calls.settle, 0);
});

test("local HTTP API requires a bearer token for verify and settle", async (context) => {
  const api = {
    getSupported: () => ({ kinds: [{ x402Version: 2, scheme: "exact", network }] }),
    async verify() { return { isValid: true }; },
    async settle() { return { success: false, errorReason: "settlement_disabled", transaction: "", network }; },
  };
  const config = { port: 0, network, settlementEnabled: false, apiToken: "a".repeat(40) };
  const server = createFacilitatorServer({ api, config });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const url = `http://127.0.0.1:${server.address().port}`;
  const supported = await fetch(`${url}/supported`);
  assert.equal(supported.status, 200);
  const unauthorized = await fetch(`${url}/settle`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ x402Version: 2, paymentPayload: {}, paymentRequirements: {} }),
  });
  assert.equal(unauthorized.status, 401);
});
