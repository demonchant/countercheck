const $ = (selector) => document.querySelector(selector);
const badgeInput = $("#badge");
const verifyButton = $("#verify");
const quoteButton = $("#quote");
const tryFailureButton = $("#try-failure");
const loadDemoSellerButton = $("#load-demo-seller");
const quotePanel = $("#quote-panel");
const verificationResult = $("#verification-result");
const registryState = $("#registry-state");
const announcer = $("#announcer");
const sessionState = $("#session-state");
const localDemo = ["127.0.0.1", "localhost", "[::1]"].includes(window.location.hostname);
let currentVerification = null;
let currentQuote = null;
let buyerSession = { configured: localDemo, purchasesEnabled: localDemo };

function canStartQuote() {
  return currentVerification?.status === "verified" && buyerSession.purchasesEnabled;
}

function updateQuoteAvailability() {
  quoteButton.disabled = !canStartQuote();
}

async function initializeBuyerSession() {
  if (localDemo) {
    sessionState.textContent = "LOCAL TESTNET DEMO";
    return;
  }
  try {
    const response = await fetch("/api/session", { cache: "no-store" });
    const session = await response.json();
    if (!response.ok || session.guestSession !== true) throw new Error(session.error || "Guest session could not be started.");
    const statusResponse = await fetch("/api/status", { cache: "no-store" });
    const status = statusResponse.ok ? await statusResponse.json() : {};
    buyerSession = {
      configured: true,
      purchasesEnabled: session.purchasesEnabled === true && status.publicPurchasesEnabled === true && status.paymentEnabled === true,
    };
    sessionState.textContent = "PUBLIC GUEST SESSION";
  } catch {
    buyerSession = { configured: false, purchasesEnabled: false };
    sessionState.textContent = "DEMO SESSION UNAVAILABLE";
  }
  updateQuoteAvailability();
}

async function requestHeaders(path, initial = {}) {
  return { ...initial };
}
async function api(path, body) {
  const headers = await requestHeaders(path, { "content-type": "application/json", "x-countercheck-request": "1" });
  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

function announce(message) { announcer.textContent = message; }

function setState(status, text) {
  registryState.dataset.status = status;
  registryState.className = `state-chip state-${status}`;
  registryState.lastElementChild.textContent = text;
}

function setStep(key, state) {
  const step = document.querySelector(`[data-step="${key}"]`);
  if (!step) return;
  step.classList.toggle("is-current", state === "current");
  step.classList.toggle("is-done", state === "done");
  step.querySelector(".step-mark").textContent = state === "done" ? "✓" : state === "current" ? "·" : "—";
}

function clearQuote() {
  currentQuote = null;
  quotePanel.hidden = true;
  quotePanel.replaceChildren();
  updateQuoteAvailability();
}

function renderVerification(result) {
  currentVerification = result;
  verificationResult.hidden = false;
  verificationResult.dataset.status = result.status;
  verificationResult.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = result.status === "verified" ? "Verified for this check" : `Check ${result.status.replaceAll("-", " ")}`;
  const description = document.createElement("span");
  description.textContent = result.message || "The Registry did not return a verifiable result.";
  verificationResult.append(title, description);
  if (result.checkedAt && Number.isFinite(Date.parse(result.checkedAt))) {
    const checkedAt = document.createElement("small");
    checkedAt.className = "help";
    checkedAt.textContent = `Checked ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(result.checkedAt))} (this session)`;
    verificationResult.append(checkedAt);
  }
  if (result.onchainWallet) {
    const wallet = document.createElement("p");
    wallet.className = "help";
    wallet.textContent = `Registered agentWallet: ${result.onchainWallet}`;
    verificationResult.append(wallet);
  }
  if (result.evidenceUrl) {
    const link = document.createElement("a");
    link.href = result.evidenceUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open Registry response ↗";
    verificationResult.append(link);
  }
  const verified = result.status === "verified";
  setState(verified ? "verified" : "error", verified ? "Seller verified" : "Payment blocked");
  updateQuoteAvailability();
  setStep("verify", verified ? "done" : "current");
  setStep("policy", verified ? "current" : "idle");
  setStep("pay", "idle");
  setStep("receipt", "idle");
  clearQuote();
  announce(`${title.textContent}. ${description.textContent}`);
}

verifyButton.addEventListener("click", async () => {
  const badge = badgeInput.value.trim();
  verifyButton.disabled = true;
  clearQuote();
  verificationResult.hidden = false;
  verificationResult.dataset.status = "checking";
  verificationResult.textContent = "Checking the live testnet Registry and Agent Card…";
  setState("checking", "Checking Registry");
  announce("Checking the live testnet Registry and Agent Card.");
  try {
    renderVerification(await api("/api/verify", { badge }));
  } catch {
    renderVerification({ status: "unavailable", message: "The Registry request failed. No payment is available until it succeeds." });
  } finally {
    verifyButton.disabled = false;
  }
});

tryFailureButton.addEventListener("click", () => {
  badgeInput.value = "demo-invalid-seller";
  verifyButton.click();
});

loadDemoSellerButton.addEventListener("click", async () => {
  loadDemoSellerButton.disabled = true;
  try {
    const response = await fetch("/api/demo-seller", { cache: "no-store", headers: { "x-countercheck-request": "1" } });
    const profile = await response.json();
    if (!response.ok) {
      const reason = profile.error === "demo_seller_not_configured"
        ? "No demo seller badge is configured in the buyer API. Configure SELLER_BADGE there and restart the service."
        : profile.error || `Seller configuration request failed (${response.status}).`;
      throw new Error(reason);
    }
    badgeInput.value = profile.badge;
    verifyButton.click();
  } catch (error) {
    verificationResult.hidden = false;
    verificationResult.dataset.status = "unavailable";
    verificationResult.textContent = error.message || "The configured seller could not be loaded.";
    quoteButton.disabled = true;
  } finally {
    loadDemoSellerButton.disabled = false;
  }
});

function formatMicroCcd(value) {
  const amount = BigInt(value);
  const whole = amount / 1_000_000n;
  const fractional = (amount % 1_000_000n).toString().padStart(6, "0").replace(/0+$/u, "");
  return `${whole}${fractional ? `.${fractional}` : ""} CCD`;
}

function quoteFields(payment, spendCap) {
  const values = [
    ["Network", "Concordium testnet"],
    ["Asset", payment.asset],
    ["Amount", `${formatMicroCcd(payment.amountMicroCcd)} (${payment.amountMicroCcd} microCCD)`],
    ["Recipient", payment.payTo],
    ["Network fee", `Sponsored by ${payment.feePayer}`],
    ["Quote expires", `${payment.maxTimeoutSeconds} seconds after payment begins`],
    ["Spend ceiling", `${formatMicroCcd(spendCap)} (${spendCap} microCCD)`],
  ];
  const grid = document.createElement("div");
  grid.className = "quote-grid";
  for (const [label, value] of values) {
    const key = document.createElement("span"); key.textContent = label;
    const item = document.createElement("span"); item.textContent = value;
    grid.append(key, item);
  }
  return grid;
}

function transactionReviewFields(review) {
  const values = [
    ["Network", review.network],
    ["Buyer sender", review.sender],
    ["Seller recipient", review.recipient],
    ["Payment", `${formatMicroCcd(review.amountMicroCcd)} (${review.amountMicroCcd} microCCD)`],
    ["Asset", `Native ${review.asset}`],
    ["Sponsor / fee payer", review.feePayer],
    ["Nonce", review.nonce],
    ["Expiry", review.transactionExpiry],
    ["Energy estimate", `${review.energy} NRG`],
    ["Estimated fee", `${formatMicroCcd(review.feeMicroCcd)} (${review.feeMicroCcd} microCCD)`],
    ["Buyer available balance", `${formatMicroCcd(review.buyerAvailableBalanceMicroCcd)} (${review.buyerAvailableBalanceMicroCcd} microCCD)`],
    ["Sponsor available balance", `${formatMicroCcd(review.sponsorAvailableBalanceMicroCcd)} (${review.sponsorAvailableBalanceMicroCcd} microCCD)`],
    ["Required signer threshold", `Account ${review.requiredSignatures.accountThreshold}-of-1; credential ${review.requiredSignatures.credentialThreshold}-of-1`],
    ["Buyer key check", review.requiredSignatures.signerKeyMatchesOnChain ? "Configured signer matches on-chain key" : "Not verified"],
    ["Signing digest", review.signingDigest],
  ];
  const grid = document.createElement("div");
  grid.className = "quote-grid";
  for (const [label, value] of values) {
    const key = document.createElement("span"); key.textContent = label;
    const item = document.createElement("span"); item.textContent = value;
    grid.append(key, item);
  }
  const payloadTitle = document.createElement("strong");
  payloadTitle.textContent = "Exact unsigned transaction payload";
  const payload = document.createElement("pre");
  payload.className = "response-preview";
  payload.textContent = JSON.stringify(review.transaction, null, 2);
  return [grid, payloadTitle, payload];
}

async function prepareReview(quoteId) {
  const pending = document.createElement("p"); pending.className = "help"; pending.textContent = "Preparing a fresh Testnet transaction review…";
  quotePanel.append(pending);
  const prepared = await api("/api/prepare", { quoteId });
  if (prepared.status !== "review_ready") throw new Error(prepared.message || "Transaction review is unavailable.");
  quotePanel.querySelector('[data-review-trigger="true"]')?.remove();
  pending.remove();
  for (const item of transactionReviewFields(prepared.review)) quotePanel.append(item);
  const expiry = document.createElement("p"); expiry.className = "help";
  expiry.textContent = `This review expires at ${prepared.reviewExpiresAt}. Any changed nonce, fee, balance, challenge, identity or payload requires a new review.`;
  quotePanel.append(expiry);
  const notice = document.createElement("p"); notice.className = "help";
  notice.textContent = "Approval only records consent to this digest. A separate action below signs this exact 1 CCD Testnet transaction and requests the paid resource.";
  quotePanel.append(notice);
  const actions = document.createElement("div"); actions.className = "quote-actions";
  const approve = document.createElement("button"); approve.className = "button button-dark"; approve.type = "button"; approve.textContent = "Approve this exact transaction";
  const cancel = document.createElement("button"); cancel.className = "button button-outline"; cancel.type = "button"; cancel.textContent = "Cancel review";
  actions.append(approve, cancel); quotePanel.append(actions);
  approve.addEventListener("click", async () => {
    approve.disabled = true; cancel.disabled = true;
    announce("Rechecking the exact transaction before recording approval.");
    try {
      const result = await api("/api/approve", { reviewId: prepared.reviewId, signingDigest: prepared.review.signingDigest });
      quotePanel.replaceChildren();
      const status = document.createElement("p");
      status.className = result.status === "approved_unsubmitted" ? "help" : "quote-error";
      status.textContent = result.message || "The review could not be approved.";
      quotePanel.append(status);
      if (result.status === "approved_unsubmitted") {
        const payNotice = document.createElement("p");
        payNotice.className = "help";
        payNotice.textContent = "The next action transfers exactly 1 CCD to the reviewed seller on Testnet. The sponsor pays the network fee.";
        quotePanel.append(payNotice);
        const pay = document.createElement("button");
        pay.className = "button button-dark";
        pay.type = "button";
        pay.textContent = "Sign, pay 1 CCD, and get resource";
        quotePanel.append(pay);
        pay.addEventListener("click", async () => {
          pay.disabled = true;
          status.className = "help";
          status.textContent = "Signing the reviewed digest, submitting through the facilitator, and waiting for finalized Testnet settlement…";
          announce(status.textContent);
          setStep("pay", "current");
          try {
            const purchase = await api("/api/purchase", { approvalId: result.approvalId, signingDigest: result.signingDigest });
            quotePanel.replaceChildren();
            const outcome = document.createElement("p");
            outcome.className = purchase.status === "paid_and_finalized" ? "help" : "quote-error";
            outcome.textContent = purchase.message || "The seller did not confirm settlement.";
            quotePanel.append(outcome);
            if (purchase.status === "paid_and_finalized") {
              setStep("pay", "done");
              setStep("receipt", "done");
              const receipt = document.createElement("dl");
              receipt.className = "quote-grid";
              for (const [label, value] of [["Result", "Paid resource delivered"], ["Network", "Concordium Testnet"], ["Transaction", purchase.transactionHash], ["Amount", "1 CCD"], ["Receipt", purchase.receipt?.id || "Recorded locally"]]) {
                const key = document.createElement("dt"); key.textContent = label;
                const item = document.createElement("dd"); item.textContent = value;
                receipt.append(key, item);
              }
              quotePanel.append(receipt);
              if (purchase.resource) {
                const title = document.createElement("strong"); title.textContent = "Seller paid response";
                const resource = document.createElement("pre"); resource.className = "response-preview"; resource.textContent = JSON.stringify(purchase.resource, null, 2);
                quotePanel.append(title, resource);
              }
              if (purchase.explorerUrl) {
                const link = document.createElement("a"); link.href = purchase.explorerUrl; link.target = "_blank"; link.rel = "noreferrer"; link.textContent = "View finalized transaction on Testnet explorer";
                quotePanel.append(link);
              }
              refreshReceipts();
            } else {
              setStep("pay", "current");
              const stop = document.createElement("p"); stop.className = "help"; stop.textContent = "This approval cannot be retried. Check the facilitator and Testnet transaction status before preparing another review.";
              quotePanel.append(stop);
              if (purchase.transaction) {
                const tx = document.createElement("p"); tx.className = "help"; tx.textContent = `Reported transaction: ${purchase.transaction}`; quotePanel.append(tx);
              }
            }
            announce(outcome.textContent);
          } catch (error) {
            quotePanel.replaceChildren();
            const failure = document.createElement("p"); failure.className = "quote-error"; failure.textContent = error.message || "Purchase result could not be confirmed. Check Testnet before preparing another review.";
            quotePanel.append(failure);
            announce(failure.textContent);
          }
        });
      }
      if (result.status === "review_changed") {
        const refresh = document.createElement("button"); refresh.className = "button button-outline"; refresh.type = "button"; refresh.textContent = "Prepare a fresh review";
        refresh.addEventListener("click", async () => {
          quotePanel.replaceChildren();
          try { await prepareReview(currentQuote.quoteId); }
          catch (error) { quotePanel.textContent = error.message || "Fresh review failed."; }
        });
        quotePanel.append(refresh);
      }
      announce(status.textContent);
    } catch (error) {
      quotePanel.textContent = error.message || "The approval check failed. No payment was sent.";
      announce("Approval check failed. No payment was sent.");
    }
  });
  cancel.addEventListener("click", () => {
    clearQuote();
    announce("Transaction review cancelled. No signing or submission occurred.");
  });
}

quoteButton.addEventListener("click", async () => {
  quoteButton.disabled = true;
  quotePanel.hidden = false;
  quotePanel.textContent = "Rechecking seller and reading the seller's live x402 quote…";
  announce("Reading the seller's payment requirements.");
  setStep("policy", "current");
  try {
    const result = await api("/api/quote", {});
    quotePanel.replaceChildren();
    if (result.status !== "quoted") {
      const error = document.createElement("p"); error.className = "quote-error"; error.textContent = result.message || "No quote is available.";
      quotePanel.append(error);
      if (Array.isArray(result.missing) && result.missing.length) {
        const pending = document.createElement("p"); pending.className = "help"; pending.textContent = `Missing local configuration: ${result.missing.join(", ")}`;
        quotePanel.append(pending);
      }
      setStep("policy", "current");
      announce(error.textContent);
      return;
    }
    currentQuote = result;
    if (result.checkedAt && Number.isFinite(Date.parse(result.checkedAt))) {
      const checkedAt = document.createElement("p");
      checkedAt.className = "help";
      checkedAt.textContent = `Fresh Registry and seller challenge checks: ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(result.checkedAt))} (this session).`;
      quotePanel.append(checkedAt);
    }
    const identities = document.createElement("p");
    identities.className = "help";
    identities.textContent = `Buyer and seller badges both passed live checks. Buyer payment wallet: ${result.verification.buyer.onchainWallet}; seller payment wallet: ${result.verification.seller.onchainWallet}.`;
    quotePanel.append(identities);
    quotePanel.append(quoteFields(result.payment, result.spendCapMicroCcd));
    const warning = document.createElement("p"); warning.className = "help";
    warning.textContent = result.paymentEnabled ? "This is a live quote. After exact transaction review and approval, a separate action signs and pays 1 CCD on Testnet; the sponsor pays the network fee." : "This is a live, non-binding quote. Payment is disabled in the current local configuration.";
    quotePanel.append(warning);
    const reviewButton = document.createElement("button");
    reviewButton.className = "button button-outline";
    reviewButton.type = "button";
    reviewButton.dataset.reviewTrigger = "true";
    reviewButton.textContent = "Prepare unsigned transaction review";
    reviewButton.addEventListener("click", async () => {
      reviewButton.disabled = true;
      reviewButton.textContent = "Preparing review…";
      try {
        await prepareReview(result.quoteId);
      } catch (error) {
        const failure = document.createElement("p");
        failure.className = "quote-error";
        failure.textContent = error.message || "Fresh transaction review could not be prepared. No payment was made.";
        quotePanel.append(failure);
        announce(failure.textContent);
        reviewButton.remove();
      }
    });
    quotePanel.append(reviewButton);
    setStep("policy", "done");
    setStep("pay", "current");
    announce(`Live quote received for ${formatMicroCcd(result.payment.amountMicroCcd)}. No payment was made.`);
  } catch {
    quotePanel.textContent = "The seller quote could not be read. No payment was made.";
    setStep("policy", "current");
  } finally {
  updateQuoteAvailability();
  }
});

function renderPurchase(result) {
  quotePanel.replaceChildren();
  quotePanel.hidden = false;
  const message = document.createElement("p"); message.className = result.status === "unresolved" ? "quote-error" : "help"; message.textContent = result.message;
  quotePanel.append(message);
  if (result.responsePreview) {
    const pre = document.createElement("pre"); pre.className = "response-preview"; pre.textContent = result.responsePreview; quotePanel.append(pre);
  }
  setStep("pay", result.status === "settlement-reported-chain-check-pending" ? "done" : "current");
  setStep("receipt", "current");
  announce(result.message);
  refreshReceipts();
}

function safeRecordText(value) { return typeof value === "string" ? value : ""; }

async function refreshReceipts() {
  const container = $("#receipts");
  try {
    const response = await fetch("/api/receipts", {
      cache: "no-store",
      headers: await requestHeaders("/api/receipts", { "x-countercheck-request": "1" }),
    });
    const payload = await response.json();
    const records = Array.isArray(payload.records) ? payload.records : [];
    $("#receipt-count").textContent = `${records.length} ${records.length === 1 ? "record" : "records"}`;
    container.replaceChildren();
    if (!records.length) {
      const empty = document.createElement("p"); empty.className = "empty-state"; empty.textContent = "No finalized paid receipts have been recorded in this local session."; container.append(empty); return;
    }
    for (const record of records) {
      const row = document.createElement("article"); row.className = "receipt-row";
      const status = document.createElement("span"); status.className = "receipt-status"; status.textContent = safeRecordText(record.status).replaceAll("-", " ");
      const detail = document.createElement("div"); detail.className = "receipt-detail";
      const time = document.createElement("b"); time.textContent = new Date(record.timestamp).toLocaleString(); detail.append(time);
      const facts = [record.asset && `${record.amountMicroCcd} ${record.asset} atomic units`, record.transactionHash && `tx ${record.transactionHash}`, record.responseDigest && `response sha256 ${record.responseDigest}`].filter(Boolean).join(" · ");
      if (facts) { const line = document.createElement("div"); line.textContent = facts; detail.append(line); }
      const link = record.explorerUrl ? document.createElement("a") : document.createElement("span");
      link.className = "receipt-link";
      if (record.explorerUrl) { link.href = record.explorerUrl; link.target = "_blank"; link.rel = "noreferrer"; link.textContent = "Check explorer ↗"; }
      else link.textContent = "No chain reference";
      row.append(status, detail, link); container.append(row);
    }
  } catch {
    $("#receipt-count").textContent = localDemo ? "Unavailable" : "Guest session unavailable";
  }
}

async function loadStatus() {
  try {
    const response = await fetch("/api/status", {
      cache: "no-store",
      headers: { "x-countercheck-request": "1" },
    });
    const status = await response.json();
    const tag = $("#payment-mode");
    if (!localDemo) {
      tag.textContent = status.paymentEnabled && status.publicPurchasesEnabled
        ? "PUBLIC TESTNET PURCHASES ON"
        : "TESTNET PAYMENTS LOCKED";
      return;
    }
    tag.textContent = status.paymentEnabled
      ? (status.paymentReady && status.settlementEnabled ? "TESTNET SETTLEMENT ON" : status.paymentReady ? "BUYER ON · SETTLEMENT OFF" : "CONFIG INCOMPLETE · PAYMENT BLOCKED")
      : (status.paymentReady ? "REVIEW ONLY · PAYMENT OFF" : "PAYMENTS OFF");
  } catch {
    $("#payment-mode").textContent = "STATUS UNAVAILABLE";
  }
}

void (async () => {
  await initializeBuyerSession();
  await Promise.all([loadStatus(), refreshReceipts()]);
})();
