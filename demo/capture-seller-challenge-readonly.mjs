import { writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";

const endpoint = process.env.SELLER_RESOURCE_URL || "http://127.0.0.1:4191/resource";
const response = await new Promise((resolve, reject) => {
  const request = httpRequest(endpoint, { method: "GET", headers: { accept: "application/json" }, timeout: 10_000 }, (incoming) => {
    incoming.resume();
    incoming.on("end", () => resolve({ status: incoming.statusCode, headers: incoming.headers }));
  });
  request.on("timeout", () => request.destroy(new Error("Seller resource request timed out.")));
  request.on("error", reject);
  request.end();
});
const encoded = response.headers["payment-required"];
if (response.status !== 402 || typeof encoded !== "string") throw new Error(`Expected an actual HTTP 402 with PAYMENT-REQUIRED; received HTTP ${response.status}.`);

let challenge;
try { challenge = JSON.parse(encoded); }
catch { challenge = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); }
const requirement = challenge.accepts?.find((item) => item.scheme === "exact");
if (challenge.x402Version !== 2 || !requirement) throw new Error("Observed response is not an x402 v2 exact challenge.");

const evidence = {
  provenance: "OBSERVED",
  observedAtUtc: new Date().toISOString(),
  method: "GET",
  endpoint,
  httpStatus: response.status,
  action: "Read-only challenge fetch; no PAYMENT-SIGNATURE was sent",
  challenge,
};
const output = new URL("../evidence/seller-challenge-refresh-2026-11-12.json", import.meta.url);
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "w" });

console.log(JSON.stringify({
  provenance: evidence.provenance,
  httpStatus: response.status,
  x402Version: challenge.x402Version,
  scheme: requirement.scheme,
  network: requirement.network,
  asset: requirement.asset,
  amount: requirement.amount,
  payTo: requirement.payTo,
  maxTimeoutSeconds: requirement.maxTimeoutSeconds,
  feePayer: requirement.extra?.feePayer,
  signatureSent: false,
  output: output.pathname,
}));
