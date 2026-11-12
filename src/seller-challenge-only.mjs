/**
 * A no-key x402 facilitator capability used only to serve public payment
 * challenges. It never verifies, signs, submits, or claims a paid result.
 */
export function createChallengeOnlyFacilitator({ network, sponsorAddress }) {
  if (typeof network !== "string" || !network.startsWith("ccd:")) throw new Error("A Concordium network is required.");
  if (typeof sponsorAddress !== "string" || sponsorAddress.length < 8) throw new Error("A configured sponsor address is required.");

  return {
    async getSupported() {
      return {
        kinds: [{ x402Version: 2, scheme: "exact", network, extra: { feePayer: sponsorAddress } }],
        extensions: [],
        signers: { [network]: [sponsorAddress] },
      };
    },
    async verify() {
      return { isValid: false, invalidReason: "settlement_disabled", payer: "" };
    },
    async settle() {
      return {
        success: false,
        errorReason: "settlement_disabled",
        errorMessage: "Paid fulfillment is disabled for this challenge-only endpoint.",
        transaction: "",
        network,
        payer: "",
      };
    },
  };
}

export function hasPaymentAuthorization(headers) {
  return typeof headers?.["payment-signature"] === "string"
    || typeof headers?.["x-payment"] === "string";
}
