import { randomUUID } from "node:crypto";

const base = "http://127.0.0.1:4191";

async function ask(path, text) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "a2a-version": "1.0" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: randomUUID(),
      method: "SendMessage",
      params: {
        message: {
          messageId: randomUUID(),
          role: "ROLE_USER",
          parts: [{ text }],
        },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const envelope = await response.json();
  if (!response.ok || envelope.error) throw new Error(`A2A ${text} failed.`);
  const content = envelope.result?.message?.parts?.map((part) => part.text || "").join("\n");
  if (!content) throw new Error(`A2A ${text} returned no result.`);
  return JSON.parse(content);
}

try {
  const buyer = await ask("/a2a/buyer/v1", "verify_counterparties");
  const quote = await ask("/a2a/buyer/v1", "request_purchase_quote");
  const seller = await ask("/a2a/seller/v1", "get_x402_offer");
  console.log(JSON.stringify({
    buyerAgent: { status: buyer.status, network: buyer.network },
    buyerQuote: { status: quote.status, amountMicroCcd: quote.payment?.amountMicroCcd, asset: quote.payment?.asset },
    sellerAgent: { status: seller.status, amountMicroCcd: seller.payment?.amountMicroCcd, paidFulfillmentAvailable: seller.paidFulfillmentAvailable },
    note: "A2A calls are read-only. They create no signature, approval, settlement, or payment.",
  }, null, 2));
} catch {
  console.error("Read-only A2A tour failed. Confirm that the full local Testnet demo is running.");
  process.exitCode = 1;
}
