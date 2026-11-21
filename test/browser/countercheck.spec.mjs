import { test, expect } from "@playwright/test";

const badgeFixture = "test-fixture-badge-not-a-real-registry-id";

test("home page loads in Testnet mode with payment actions disabled", async ({ page, request }) => {
  const response = await page.goto("/");
  expect(response.status()).toBe(200);
  const [scriptResponse, styleResponse] = await Promise.all([
    request.get("/app.js?v=countercheck-demo-session-20261120"),
    request.get("/app.css?v=countercheck-demo-session-20261120"),
  ]);
  expect(scriptResponse.status()).toBe(200);
  expect(styleResponse.status()).toBe(200);
  expect(scriptResponse.headers()["content-type"]).toContain("javascript");
  expect(styleResponse.headers()["content-type"]).toContain("text/css");
  await expect(page.getByRole("heading", { name: /before an agent pays/i })).toBeVisible();
  await expect(page.getByText("Concordium / Testnet", { exact: true })).toBeVisible();
  await expect(page.locator("#payment-mode")).toHaveText("PAYMENTS OFF");
  await expect(page.getByRole("button", { name: /check the live request/i })).toBeDisabled();

  const statusResponse = await request.get("/api/status", {
    headers: { Origin: "http://127.0.0.1:4179", "x-countercheck-request": "1" },
  });
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
  await page.getByLabel("Concordium agent badge").fill(badgeFixture);
  await page.getByRole("button", { name: /check seller/i }).click();

  await expect(page.locator("#verification-result")).toContainText("Registry unavailable");
  await expect(page.getByRole("button", { name: /check the live request/i })).toBeDisabled();
  await expect(page.locator('[data-step="verify"]')).toHaveClass(/is-current/);
});

test("a simulated seller mismatch is shown without enabling a quote", async ({ page }) => {
  await page.route("**/api/verify", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ status: "seller-mismatch", message: "Badge does not match the locally configured seller." }),
  }));

  await page.goto("/");
  await page.getByLabel("Concordium agent badge").fill(badgeFixture);
  await page.getByRole("button", { name: /check seller/i }).click();

  await expect(page.locator("#verification-result")).toContainText("seller mismatch");
  await expect(page.getByRole("button", { name: /check the live request/i })).toBeDisabled();
});

test("verification shows each Registry fact and explains the card hash boundary", async ({ page }) => {
  await page.route("**/api/verify", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: "payee-mismatch",
      message: "The registered wallet does not match the configured recipient.",
      active: true,
      cardMatches: true,
      recipientMatches: false,
      onchainWallet: "registered-wallet-fixture",
      checkedAt: "2026-11-21T10:00:00.000Z",
    }),
  }));

  await page.goto("/");
  await page.getByLabel("Concordium agent badge").fill(badgeFixture);
  await page.getByRole("button", { name: /check seller/i }).click();

  const result = page.locator("#verification-result");
  await expect(result).toContainText("PASS · Registry badge active");
  await expect(result).toContainText("PASS · Agent Card bytes match the Registry-pinned hash");
  await expect(result).toContainText("BLOCK · Registered wallet matches the configured recipient");
  await expect(result).toContainText("does not prove that the card describes the currently running endpoint");
  await expect(page.getByRole("button", { name: /check the live request/i })).toBeDisabled();
});

test("a mocked 1 CCD read-only quote shows sponsor and spend details without a purchase action", async ({ page }) => {
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
      checkedAt: "2026-11-20T12:00:00.000Z",
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
  await page.getByLabel("Concordium agent badge").fill(badgeFixture);
  await page.getByRole("button", { name: /check seller/i }).click();
  await expect(page.getByRole("button", { name: /check the live request/i })).toBeEnabled();
  await page.getByRole("button", { name: /check the live request/i }).click();

  await expect(page.locator("#quote-panel")).toContainText("1 CCD");
  await expect(page.locator("#quote-panel")).toContainText("sponsor-wallet-fixture");
  await expect(page.locator("#quote-panel")).toContainText("non-binding quote");
  await expect(page.getByRole("button", { name: /prepare unsigned transaction review/i })).toHaveCount(0);
  expect(purchaseEndpointCalled).toBe(false);
});

test("local API rejects unmarked requests", async ({ request }) => {
  const response = await request.post("/api/verify", {
    headers: { "content-type": "application/json" },
    data: { badge: badgeFixture },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: "local_origin_required" });
});
