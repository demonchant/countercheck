import test from "node:test";
import assert from "node:assert/strict";
import { renderResourceUrl, resolveSellerResourceUrl, sellerListenConfig } from "../src/seller-resource-config.mjs";

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
