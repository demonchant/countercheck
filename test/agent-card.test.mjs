import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { AgentCard } from "@a2a-js/sdk";

const cards = [
  { file: "countercheck-buyer-1147.json", interfacePath: "/a2a/buyer/v1", serviceNames: ["A2A"] },
  { file: "countercheck-seller-1146.json", interfacePath: "/a2a/seller/v1", serviceNames: ["A2A", "x402"] },
];

for (const expected of cards) {
  test(`${expected.file} parses as a Concordium-compatible A2A v1 card from exact file bytes`, async () => {
    const bytes = await readFile(new URL(`../agent-cards/${expected.file}`, import.meta.url));
    const card = JSON.parse(bytes.toString("utf8"));
    const hash = createHash("sha256").update(bytes).digest("hex");
    const parsed = AgentCard.fromJSON(card);

    assert.equal(hash.length, 64);
    assert.equal(card.type, "https://eips.ethereum.org/EIPS/eip-8004#registration-v1");
    assert.equal("url" in card, false, "A2A v1 card must not use the removed top-level url endpoint field");
    assert.equal(parsed.supportedInterfaces.length, 1);
    assert.equal(parsed.supportedInterfaces[0].protocolBinding, "JSONRPC");
    assert.equal(parsed.supportedInterfaces[0].protocolVersion, "1.0");
    assert.equal(new URL(parsed.supportedInterfaces[0].url).pathname, expected.interfacePath);
    assert.deepEqual(card.services.map((service) => service.name).sort(), expected.serviceNames.sort());
    assert.equal(card.registrations[0].agentRegistry, "ccd:4221332d34e1694168c2a0c0b3fd0f27:12802.0");
    assert.equal(card.active, false, "Do not advertise active service before public deployment checks pass");
  });
}

test("seller card does not claim x402 payment fulfillment while settlement is disabled", async () => {
  const card = JSON.parse(await readFile(new URL("../agent-cards/countercheck-seller-1146.json", import.meta.url), "utf8"));
  assert.equal(card.x402Support, false);
  assert.match(card.description, /Paid fulfillment is unavailable while facilitator settlement is disabled/u);
  assert.match(card.services.find((service) => service.name === "x402").endpoint, /\/resource$/u);
});
