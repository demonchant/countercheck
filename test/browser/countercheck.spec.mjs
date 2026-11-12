import { test, expect } from "@playwright/test";

const badgeFixture = "test-fixture-badge-not-a-real-registry-id";

test("home page loads in Testnet mode with payment actions disabled", async ({ page, request }) => {
  const response = await page.goto("/");
  expect(response.status()).toBe(200);
  const [scriptResponse, styleResponse] = await Promise.all([
    request.get("/assets/app.js"),
    request.get("/assets/app.css"),
  ]);
  expect(scriptResponse.status()).toBe(200);
  expect(styleResponse.status()).toBe(200);
  expect(scriptResponse.headers()["content-type"]).toContain("javascript");
  expect(styleResponse.headers()["content-type"]).toContain("text/css");
  await expect(page.getByRole("heading", { name: /know who stands behind it/i })).toBeVisible();
  await expect(page.getByText("Concordium testnet", { exact: true })).toBeVisible();
  await expect(page.locator("#payment-mode")).toHaveText("PAYMENTS OFF");
  await expect(page.getByRole("button", { name: /get payment quote/i })).toBeDisabled();

  const statusResponse = await request.get("/api/status");
  expect(statusResponse.status()).toBe(200);
  const status = await statusResponse.json();
  expect(status.network).toBe("ccd:4221332d34e1694168c2a0c0b3fd0f27");
  expect(status.paymentEnabled).toBe(false);
  expect(status).not.toHaveProperty("privateKey");
  expect(status).not.toHaveProperty("sponsorPrivateKey");
});

test("a simulated Registry outage fails closed and leaves quote disabled", async ({ page }) => {
  await page.route("**/api/verify", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ status: "unavailable", message: "Registry unavailable (browser test fixture)." }),
  }));

  await page.goto("/");
  await page.getByLabel("Seller's Concordium badge").fill(badgeFixture);
  await page.getByRole("button", { name: /check badge/i }).click();

  await expect(page.locator("#verification-result")).toContainText("Registry unavailable");
  await expect(page.getByRole("button", { name: /get payment quote/i })).toBeDisabled();
  await expect(page.locator('[data-step="verify"]')).toHaveClass(/is-current/);
});

test("a simulated seller mismatch is shown without enabling a purchase quote", async ({ page }) => {
  await page.route("**/api/verify", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ status: "seller-mismatch", message: "Badge does not match the locally configured seller." }),
  }));

  await page.goto("/");
  await page.getByLabel("Seller's Concordium badge").fill(badgeFixture);
  await page.getByRole("button", { name: /check badge/i }).click();

  await expect(page.locator("#verification-result")).toContainText("seller mismatch");
  await expect(page.getByRole("button", { name: /get payment quote/i })).toBeDisabled();
});

test("a mocked 1 CCD read-only quote displays sponsor and spend details without a purchase button", async ({ page }) => {
  let purchaseEndpointCalled = false;
  await page.route("**/api/verify", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ status: "verified", message: "Browser-test fixture only; not a live Registry result." }),
  }));
  await page.route("**/api/quote", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: "quoted",
      quoteId: "browser-test-quote-only",
      verification: {
        buyer: { onchainWallet: "buyer-wallet-fixture" },
        seller: { onchainWallet: "seller-wallet-fixture" },
      },
      payment: {
        network: "ccd:4221332d34e1694168c2a0c0b3fd0f27",
        asset: "CCD",
        amountMicroCcd: "1000000",
        payTo: "seller-wallet-fixture",
        feePayer: "sponsor-wallet-fixture",
        maxTimeoutSeconds: 60,
      },
      spendCapMicroCcd: "1000000",
      paymentEnabled: false,
    }),
  }));
  await page.route("**/api/purchase", async (route) => {
    purchaseEndpointCalled = true;
    await route.fulfill({ status: 500, body: "Purchase endpoint must not run in this test." });
  });

  await page.goto("/");
  await page.getByLabel("Seller's Concordium badge").fill(badgeFixture);
  await page.getByRole("button", { name: /check badge/i }).click();
  await expect(page.getByRole("button", { name: /get payment quote/i })).toBeEnabled();
  await page.getByRole("button", { name: /get payment quote/i }).click();

  await expect(page.locator("#quote-panel")).toContainText("1 CCD");
  await expect(page.locator("#quote-panel")).toContainText("sponsor-wallet-fixture");
  await expect(page.locator("#quote-panel")).toContainText("Read-only quote preview");
  await expect(page.getByRole("button", { name: /confirm one purchase/i })).toHaveCount(0);
  expect(purchaseEndpointCalled).toBe(false);
});

test("local API rejects cross-origin or unmarked requests", async ({ request }) => {
  const response = await request.post("/api/verify", {
    headers: { "content-type": "application/json" },
    data: { badge: badgeFixture },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: "This local action is allowed only from the Countercheck page on loopback." });
});
