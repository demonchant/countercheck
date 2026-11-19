import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { allowedBuyerApiRoute, handleBuyerApiProxy, resolveBuyerApiOrigin } from "../src/vercel-api-proxy.mjs";

test("Vercel proxy permits only the UI's explicit buyer API routes", () => {
  assert.equal(allowedBuyerApiRoute("GET", "/api/status"), true);
  assert.equal(allowedBuyerApiRoute("GET", "/api/receipts"), true);
  assert.equal(allowedBuyerApiRoute("POST", "/api/approve"), true);
  assert.equal(allowedBuyerApiRoute("DELETE", "/api/approve"), false);
  assert.equal(allowedBuyerApiRoute("POST", "/api/admin"), false);
  assert.equal(allowedBuyerApiRoute("POST", "/api/approve?x=1"), false);
});

test("Vercel production proxy accepts only a clean HTTPS upstream origin", () => {
  assert.equal(resolveBuyerApiOrigin("https://countercheck-api.example.test"), "https://countercheck-api.example.test");
  for (const value of ["http://countercheck-api.example.test", "https://user:pass@example.test", "https://example.test/path", "https://example.test/?token=x"]) {
    assert.throws(() => resolveBuyerApiOrigin(value));
  }
  assert.equal(resolveBuyerApiOrigin("http://127.0.0.1:4173", { vercel: false }), "http://127.0.0.1:4173");
});

test("Vercel proxy sends its bearer only to the configured buyer API and returns its JSON response", async (context) => {
  const secret = "api-test-token-" + "a".repeat(32);
  let receivedAuthorization = "";
  const upstream = createServer((request, response) => {
    receivedAuthorization = request.headers.authorization || "";
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ project: "Countercheck", paymentEnabled: false }));
  });
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve())));
  const result = { status: 0, headers: {}, body: "" };
  const response = {
    writeHead(status, headers) { result.status = status; result.headers = headers; },
    end(body) { result.body = Buffer.isBuffer(body) ? body.toString() : String(body); },
  };
  const address = upstream.address();
  await handleBuyerApiProxy({ method: "GET", url: "/api/status", headers: {} }, response, {
    COUNTERCHECK_API_PROXY_ENABLED: "true",
    COUNTERCHECK_API_ORIGIN: `http://127.0.0.1:${address.port}`,
    COUNTERCHECK_API_TOKEN: secret,
    VERCEL: "0",
  });
  assert.equal(result.status, 200);
  assert.equal(result.headers["cache-control"], "no-store");
  assert.equal(receivedAuthorization, `Bearer ${secret}`);
  assert.deepEqual(JSON.parse(result.body), { project: "Countercheck", paymentEnabled: false });
});
