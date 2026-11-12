const $ = (selector) => document.querySelector(selector);
const badgeInput = $("#badge");
const verifyButton = $("#verify");
const quoteButton = $("#quote");
const quotePanel = $("#quote-panel");
const verificationResult = $("#verification-result");
const registryState = $("#registry-state");
const announcer = $("#announcer");
let currentVerification = null;
let currentQuote = null;

async function api(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-countercheck-request": "1" },
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
  quoteButton.disabled = !currentVerification || currentVerification.status !== "verified";
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
  quoteButton.disabled = !verified;
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
    const identities = document.createElement("p");
    identities.className = "help";
    identities.textContent = `Buyer and seller badges both passed live checks. Buyer payment wallet: ${result.verification.buyer.onchainWallet}; seller payment wallet: ${result.verification.seller.onchainWallet}.`;
    quotePanel.append(identities);
    quotePanel.append(quoteFields(result.payment, result.spendCapMicroCcd));
    const warning = document.createElement("p"); warning.className = "help";
    warning.textContent = result.paymentEnabled
      ? "The agent will pay this service amount. Sponsorship only covers the Concordium network fee. Confirming authorizes one request; an uncertain result must be reconciled before retry."
      : "Read-only quote preview. Payments are disabled in the local operator configuration; no purchase can be confirmed.";
    quotePanel.append(warning);
    setStep("policy", "done");
    if (result.paymentEnabled) {
      const actions = document.createElement("div"); actions.className = "quote-actions";
      const confirm = document.createElement("button"); confirm.className = "button button-dark"; confirm.type = "button"; confirm.textContent = "Confirm one purchase";
      const cancel = document.createElement("button"); cancel.className = "button button-outline"; cancel.type = "button"; cancel.textContent = "Cancel";
      actions.append(confirm, cancel); quotePanel.append(actions);
      setStep("pay", "current");
      confirm.addEventListener("click", async () => {
        confirm.disabled = true; cancel.disabled = true;
        confirm.textContent = "Reconciling payment…";
        announce("Purchase authorized. Waiting for the paid response and payment evidence.");
        try {
          const paid = await api("/api/purchase", { quoteId: currentQuote.quoteId });
          renderPurchase(paid);
        } catch {
          renderPurchase({ status: "unresolved", message: "The request outcome is unclear. Check the sender account and explorer before retrying." });
        }
      });
      cancel.addEventListener("click", () => { clearQuote(); quotePanel.hidden = true; setStep("pay", "idle"); announce("Purchase cancelled. No payment was made."); });
    } else {
      setStep("pay", "idle");
      announce("Read-only quote ready. Payments are disabled in the local operator configuration.");
    }
  } catch {
    quotePanel.textContent = "The seller quote could not be read. No payment was made.";
    setStep("policy", "current");
  } finally {
    quoteButton.disabled = !currentVerification || currentVerification.status !== "verified";
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
    const response = await fetch("/api/receipts", { cache: "no-store" });
    const payload = await response.json();
    const records = Array.isArray(payload.records) ? payload.records : [];
    $("#receipt-count").textContent = `${records.length} ${records.length === 1 ? "record" : "records"}`;
    container.replaceChildren();
    if (!records.length) {
      const empty = document.createElement("p"); empty.className = "empty-state"; empty.textContent = "A receipt appears here only after an attempted purchase. No activity is preloaded."; container.append(empty); return;
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
    $("#receipt-count").textContent = "Unavailable";
  }
}

async function loadStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const status = await response.json();
    const tag = $("#payment-mode");
    tag.textContent = status.paymentReady ? "PAYMENTS CONFIGURED" : "PAYMENTS OFF";
    if (status.paymentEnabled && !status.paymentReady) tag.textContent = "PAYMENT CONFIG INCOMPLETE";
  } catch {
    $("#payment-mode").textContent = "STATUS UNAVAILABLE";
  }
}

void loadStatus();
void refreshReceipts();
