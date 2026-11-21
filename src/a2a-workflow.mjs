const PAYMENT_FIELDS = ["scheme", "network", "asset", "amountMicroCcd", "payTo", "maxTimeoutSeconds", "feePayer"];

/** Compare an untrusted seller A2A offer with Countercheck's independently checked quote. */
export function compareAgentOfferToQuote(offer, quote) {
  if (offer?.status !== "challenge_available" || quote?.status !== "quoted") {
    return { status: "blocked", reason: "seller_offer_or_buyer_quote_unavailable" };
  }
  if (!offer.payment || !quote.payment) return { status: "blocked", reason: "payment_terms_missing" };
  const mismatches = PAYMENT_FIELDS.filter((field) => offer.payment[field] === undefined
    || quote.payment[field] === undefined
    || offer.payment[field] !== quote.payment[field]);
  if (mismatches.length) return { status: "blocked", reason: "payment_terms_mismatch", mismatches };
  return { status: "matched_read_only", matchedFields: PAYMENT_FIELDS };
}
