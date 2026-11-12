import test from "node:test";
import assert from "node:assert/strict";
import { x402ResourceServer } from "@x402/core/server";
import { x402HTTPResourceServer } from "@x402/core/http";
import { ExactConcordiumScheme } from "@x402/concordium/exact/server";
import { createChallengeOnlyFacilitator } from "../src/seller-challenge-only.mjs";
import { parseChallenge } from "../src/payment.mjs";

const network = "ccd:4221332d34e1694168c2a0c0b3fd0f27";
const seller = "44khdNXk2yBn8PvJYFYNsKuZrV8oUvdHo23bL6dA7YyEYGkEF7";
const sponsor = "4izZERn99ZDyiJ1PjBisVvaHMRNXZ2iZeKfwzd3Qxk6jfQMgY1";
const publicResource = "https://countercheck-zid6.onrender.com/resource";

test("x402 SDK generates a real v2 exact 1 CCD challenge for Testnet in challenge-only mode", async () => {
  // This exercises the installed x402 server implementation in-process. It is a test, not evidence of a public/live deployment.
  const server = new x402ResourceServer(createChallengeOnlyFacilitator({ network, sponsorAddress: sponsor }))
    .register(network, new ExactConcordiumScheme());
  const http = new x402HTTPResourceServer(server, {
    "GET /resource": {
      accepts: {
        scheme: "exact",
        network,
        payTo: seller,
        price: { amount: "1000000", asset: "CCD" },
        maxTimeoutSeconds: 60,
      },
      resource: publicResource,
      description: "Countercheck Testnet x402 v2 challenge; paid fulfillment is disabled.",
      mimeType: "application/json",
    },
  });
  await http.initialize();
  const context = {
    adapter: {
      getHeader: () => undefined,
      getMethod: () => "GET",
      getPath: () => "/resource",
      getUrl: () => publicResource,
      getAcceptHeader: () => "application/json",
      getUserAgent: () => "countercheck-test",
      getBody: () => undefined,
    },
    path: "/resource",
    method: "GET",
  };
  const response = await http.processHTTPRequest(context);
  assert.equal(response.type, "payment-error");
  assert.equal(response.response.status, 402);
  const challenge = parseChallenge(new Response(null, { status: 402, headers: response.response.headers }), {
    network,
    asset: "CCD",
    sellerPayTo: seller,
    sponsorAddress: sponsor,
    maxSpendMicroCcd: "1000000",
  });
  assert.equal(challenge.error, undefined);
  assert.equal(challenge.payload.x402Version, 2);
  assert.equal(challenge.summary.scheme, "exact");
  assert.equal(challenge.summary.network, network);
  assert.equal(challenge.summary.asset, "CCD");
  assert.equal(challenge.summary.amountMicroCcd, "1000000");
  assert.equal(challenge.summary.payTo, seller);
  assert.equal(challenge.summary.feePayer, sponsor);
  assert.equal(challenge.summary.maxTimeoutSeconds, 60);
});
