import test from "node:test";
import assert from "node:assert/strict";
import { renderResourceUrl, resolveBuyerSellerResourceUrl, resolveFacilitatorUrl, resolveSellerResourceUrl, sellerListenConfig } from "../src/seller-resource-config.mjs";
import { resolveFacilitatorListenConfig } from "../src/facilitator-config.mjs";
import { createBuyerApiAuthorizer, resolveBuyerApiRuntime } from "../src/api-auth.mjs";

test("local seller uses the loopback facilitator by default", () => {
  assert.equal(resolveFacilitatorUrl(""), "http://127.0.0.1:4180");
});

test("Render seller accepts only a private facilitator host and port", () => {
  assert.equal(resolveFacilitatorUrl("countercheck-facilitator:4180", { render: true }), "http://countercheck-facilitator:4180");
  for (const value of ["", "127.0.0.1:4180", "facilitator.onrender.com:4180", "https://facilitator.internal:4180", "facilitator.internal:80", "facilitator.internal/path:4180"]) {
    assert.throws(() => resolveFacilitatorUrl(value, { render: true }));
  }
});

test("facilitator binds loopback locally and requires durable private Render configuration", () => {
  assert.deepEqual(resolveFacilitatorListenConfig({ render: false }), { host: "127.0.0.1", privateDeployment: false });
  assert.deepEqual(resolveFacilitatorListenConfig({
    render: true,
    privateService: true,
    configuredHost: "0.0.0.0",
    storePath: "/var/data/facilitator-settlements",
  }), { host: "0.0.0.0", privateDeployment: true });
  for (const invalid of [
    { render: true, privateService: false, configuredHost: "0.0.0.0", storePath: "/var/data/settlements" },
    { render: true, privateService: true, externalUrl: "https://public.onrender.com", configuredHost: "0.0.0.0", storePath: "/var/data/settlements" },
    { render: true, privateService: true, configuredHost: "127.0.0.1", storePath: "/var/data/settlements" },
    { render: true, privateService: true, configuredHost: "0.0.0.0", storePath: "./data/settlements" },
    { render: true, privateService: true, configuredHost: "0.0.0.0", storePath: "/var/data/../etc/settlements" },
  ]) assert.throws(() => resolveFacilitatorListenConfig(invalid));
});

test("buyer API binds to loopback locally and requires bearer auth when deployed", () => {
  assert.deepEqual(resolveBuyerApiRuntime(), { host: "127.0.0.1", remote: false });
  assert.throws(() => resolveBuyerApiRuntime({ render: true, host: "0.0.0.0", apiToken: "short" }), /BUYER_API_TOKEN/u);
  assert.throws(() => resolveBuyerApiRuntime({ render: true, host: "127.0.0.1", apiToken: "a".repeat(40) }), /0\.0\.0\.0/u);
  assert.deepEqual(resolveBuyerApiRuntime({ render: true, host: "0.0.0.0", apiToken: "a".repeat(40) }), { host: "0.0.0.0", remote: true });
  const local = createBuyerApiAuthorizer({ port: 4173 });
  assert.equal(local({ headers: { host: "127.0.0.1:4173", origin: "http://127.0.0.1:4173", "x-countercheck-request": "1" } }), true);
  assert.equal(local({ headers: { host: "127.0.0.1:4173", origin: "http://attacker.example", "x-countercheck-request": "1" } }), false);
  const remote = createBuyerApiAuthorizer({ remote: true, port: 10000, token: "a".repeat(40) });
  assert.equal(remote({ headers: { authorization: `Bearer ${"a".repeat(40)}` } }), true);
  assert.equal(remote({ headers: { authorization: `Bearer ${"b".repeat(40)}` } }), false);
  assert.equal(remote({ headers: {} }), false);
});

test("seller challenge defaults to the loopback resource URL", () => {
  assert.equal(
    resolveSellerResourceUrl({ publicUrl: "", host: "127.0.0.1", port: 4191 }),
    "http://127.0.0.1:4191/resource",
  );
});

test("seller challenge can advertise a clean HTTPS reverse-proxy URL", () => {
  assert.equal(
    resolveSellerResourceUrl({ publicUrl: "https://seller.example.test/resource", host: "127.0.0.1", port: 4191 }),
    "https://seller.example.test/resource",
  );
});

test("seller challenge derives the HTTPS resource URL from Render's assigned service origin", () => {
  assert.equal(
    resolveSellerResourceUrl({ publicUrl: "", renderExternalUrl: "https://countercheck-seller.onrender.com", port: 10000 }),
    "https://countercheck-seller.onrender.com/resource",
  );
});

test("buyer quote configuration can derive the same resource URL from Render's assigned HTTPS origin", () => {
  assert.equal(renderResourceUrl("https://countercheck-zid6.onrender.com"), "https://countercheck-zid6.onrender.com/resource");
  assert.equal(renderResourceUrl(""), "");
  for (const value of ["http://countercheck.onrender.com", "https://countercheck.onrender.com/path", "https://u:p@countercheck.onrender.com"]) {
    assert.throws(() => renderResourceUrl(value), /HTTPS origin/u);
  }
});

test("deployed buyer API resolves a verified seller origin to the x402 resource path", () => {
  assert.equal(resolveBuyerSellerResourceUrl({ configuredUrl: "", renderExternalUrl: "https://countercheck-seller.onrender.com", render: true }), "https://countercheck-seller.onrender.com/resource");
  assert.equal(resolveBuyerSellerResourceUrl({ configuredUrl: "https://seller.example.test/resource", render: true }), "https://seller.example.test/resource");
  assert.equal(resolveBuyerSellerResourceUrl({ configuredUrl: "http://127.0.0.1:4191/resource" }), "http://127.0.0.1:4191/resource");
  assert.throws(() => resolveBuyerSellerResourceUrl({ configuredUrl: "http://seller.example.test/resource", render: true }), /HTTPS/u);
});

test("seller public URL rejects non-loopback cleartext and non-resource paths", () => {
  for (const publicUrl of [
    "http://seller.example.test/resource",
    "https://seller.example.test/",
    "https://seller.example.test/resource?redirect=https://example.test",
    "https://user:pass@seller.example.test/resource",
  ]) {
    assert.throws(() => resolveSellerResourceUrl({ publicUrl, host: "127.0.0.1", port: 4191 }));
  }
});

test("Render listens only on its assigned port and public interface", () => {
  assert.deepEqual(
    sellerListenConfig({ render: true, configuredHost: "127.0.0.1", configuredPort: "4190", platformPort: "10000" }),
    { host: "0.0.0.0", port: 10000 },
  );
});

test("outside Render the seller refuses non-loopback binds", () => {
  assert.throws(() => sellerListenConfig({ render: false, configuredHost: "0.0.0.0", configuredPort: "4190" }), /loopback/u);
});
