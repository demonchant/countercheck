import { settlementKey } from "./facilitator-store.mjs";

const TESTNET = "ccd:4221332d34e1694168c2a0c0b3fd0f27";

function responseFailure(network, errorReason, payer = "", transaction = "") {
  return { success: false, errorReason, errorMessage: "Settlement was not confirmed.", transaction, network, payer };
}

function sameRequirements(accepted, required) {
  return accepted && required
    && accepted.scheme === required.scheme
    && accepted.network === required.network
    && accepted.asset === required.asset
    && accepted.amount === required.amount
    && accepted.payTo === required.payTo
    && accepted.maxTimeoutSeconds === required.maxTimeoutSeconds
    && accepted.extra?.feePayer === required.extra?.feePayer;
}

export function validateFacilitatorRequest(paymentPayload, paymentRequirements, policy) {
  if (!paymentPayload || typeof paymentPayload !== "object" || !paymentRequirements || typeof paymentRequirements !== "object") {
    return { ok: false, reason: "invalid_request" };
  }
  if (paymentPayload.x402Version !== 2 || !sameRequirements(paymentPayload.accepted, paymentRequirements)) {
    return { ok: false, reason: "requirements_mismatch" };
  }
  if (paymentRequirements.scheme !== "exact" || paymentRequirements.network !== TESTNET || policy.network !== TESTNET) {
    return { ok: false, reason: "unsupported_network_or_scheme" };
  }
  if (!Number.isInteger(paymentRequirements.maxTimeoutSeconds) || paymentRequirements.maxTimeoutSeconds <= 0 || paymentRequirements.maxTimeoutSeconds > 300) {
    return { ok: false, reason: "invalid_expiry_policy" };
  }
  if (!policy.sponsorAddress || paymentRequirements.extra?.feePayer !== policy.sponsorAddress) {
    return { ok: false, reason: "fee_payer_mismatch" };
  }
  if (paymentRequirements.asset !== "CCD") return { ok: false, reason: "unsupported_asset" };
  if (!policy.sellerPayTo || paymentRequirements.payTo !== policy.sellerPayTo) {
    return { ok: false, reason: "recipient_mismatch" };
  }
  if (!policy.buyerAddress) return { ok: false, reason: "buyer_not_configured" };
  if (!/^[1-9]\d*$/u.test(paymentRequirements.amount || "")) return { ok: false, reason: "invalid_amount" };
  const amount = BigInt(paymentRequirements.amount);
  if (amount > BigInt(policy.maxAmountMicroCcd)) return { ok: false, reason: "amount_over_policy_limit" };

  const tx = paymentPayload.payload?.signedTransaction;
  const sponsor = tx?.header?.sponsor?.address ?? tx?.header?.sponsor?.account;
  if (!tx || tx.version !== 1 || tx.header?.sender !== policy.buyerAddress || sponsor !== policy.sponsorAddress) {
    return { ok: false, reason: "transaction_party_mismatch" };
  }
  if (tx.payload?.type !== "transfer" || tx.payload?.toAddress !== policy.sellerPayTo || tx.payload?.amount !== paymentRequirements.amount) {
    return { ok: false, reason: "transaction_transfer_mismatch" };
  }
  return { ok: true, transaction: tx, payer: tx.header.sender };
}

function availableMicroCcd(info) {
  const amount = info?.accountAvailableBalance ?? info?.accountAmount;
  const raw = amount?.microCcdAmount ?? amount;
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "string" && /^\d+$/u.test(raw)) return BigInt(raw);
  if (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) return BigInt(raw);
  throw new Error("Sponsor balance is unavailable.");
}

export function createFacilitatorApi({ scheme, store, policy, getSponsorAvailableMicroCcd, getFinalizedTransactionInfo }) {
  if (!scheme || !store || !policy) throw new Error("Facilitator dependencies are required.");

  async function verify(paymentPayload, paymentRequirements) {
    const checked = validateFacilitatorRequest(paymentPayload, paymentRequirements, policy);
    if (!checked.ok) return { isValid: false, invalidReason: checked.reason, payer: checked.payer || "" };
    try {
      return await scheme.verify(paymentPayload, paymentRequirements);
    } catch {
      return { isValid: false, invalidReason: "verification_unavailable", payer: checked.payer };
    }
  }

  async function settle(paymentPayload, paymentRequirements) {
    const checked = validateFacilitatorRequest(paymentPayload, paymentRequirements, policy);
    if (!checked.ok) return responseFailure(policy.network, checked.reason, checked.payer || "");
    if (!policy.settlementEnabled) return responseFailure(policy.network, "settlement_disabled", checked.payer);

    const key = settlementKey(paymentPayload);
    let existing;
    try { existing = store.get(key); }
    catch { return responseFailure(policy.network, "replay_store_unavailable", checked.payer); }
    if (existing?.status === "finalized" && existing.response?.success === true) return existing.response;
    if (existing) return responseFailure(policy.network, "duplicate_or_unresolved_settlement", checked.payer, existing.transaction || "");

    const verified = await verify(paymentPayload, paymentRequirements);
    if (!verified.isValid) return responseFailure(policy.network, verified.invalidReason || "verification_failed", checked.payer);

    let sponsorBalance;
    try {
      sponsorBalance = BigInt(await getSponsorAvailableMicroCcd());
    } catch {
      return responseFailure(policy.network, "sponsor_balance_unavailable", checked.payer);
    }
    if (sponsorBalance < BigInt(policy.minSponsorBalanceMicroCcd)) {
      return responseFailure(policy.network, "insufficient_sponsor_reserve", checked.payer);
    }

    const metadata = {
      requestDigest: key,
      network: policy.network,
      scheme: paymentRequirements.scheme,
      buyer: checked.payer,
      sponsor: policy.sponsorAddress,
      payTo: paymentRequirements.payTo,
      amountMicroCcd: paymentRequirements.amount,
      verification: "valid",
      sponsorAvailableMicroCcd: sponsorBalance.toString(),
      sponsorMinimumReserveMicroCcd: policy.minSponsorBalanceMicroCcd,
      status: "claimed",
    };
    let claim;
    try { claim = store.claim(key, metadata); }
    catch { return responseFailure(policy.network, "replay_store_unavailable", checked.payer); }

    if (!claim.claimed) {
      const prior = claim.record;
      if (prior?.status === "finalized" && prior.response?.success === true) return prior.response;
      return responseFailure(policy.network, "duplicate_or_unresolved_settlement", checked.payer, prior?.transaction || "");
    }

    try {
      const result = await scheme.settle(paymentPayload, paymentRequirements);
      if (result?.success === true && result.network === policy.network && typeof result.transaction === "string" && result.transaction) {
        let finalizedInfo;
        try {
          if (typeof getFinalizedTransactionInfo !== "function") throw new Error("finalization_details_unavailable");
          finalizedInfo = await getFinalizedTransactionInfo(result.transaction);
        } catch {
          store.update(key, {
            status: "unresolved",
            transaction: result.transaction,
            failureCode: "finalization_details_unavailable",
          });
          return responseFailure(policy.network, "finalization_details_unavailable", checked.payer, result.transaction);
        }

        const matchesAuthorizedPayment = finalizedInfo?.status === "finalized"
          && finalizedInfo.sender === checked.payer
          && finalizedInfo.recipient === paymentRequirements.payTo
          && finalizedInfo.amount === paymentRequirements.amount
          && finalizedInfo.asset === "CCD";
        if (!matchesAuthorizedPayment) {
          store.update(key, {
            status: "unresolved",
            transaction: result.transaction,
            failureCode: "finalized_details_mismatch",
          });
          return responseFailure(policy.network, "finalized_details_mismatch", checked.payer, result.transaction);
        }

        const finalized = { ...result, payer: checked.payer };
        store.update(key, {
          status: "finalized",
          transaction: result.transaction,
          response: finalized,
          finalizedAt: new Date().toISOString(),
        });
        return finalized;
      }
      const confirmedFailure = result?.errorReason === "on_chain_failed"
        || (typeof result?.errorReason === "string" && result.errorReason.startsWith("finalization_failed:") && result.errorReason.endsWith("failed on-chain"));
      store.update(key, {
        status: confirmedFailure ? "failed" : "unresolved",
        transaction: result?.transaction || "",
        failureCode: confirmedFailure ? "transaction_failed" : (typeof result?.errorReason === "string" ? result.errorReason.split(":", 1)[0].slice(0, 80) : "settlement_failed"),
      });
      return responseFailure(policy.network, confirmedFailure ? "transaction_failed" : "settlement_unresolved", checked.payer, result?.transaction || "");
    } catch {
      try { store.update(key, { status: "unresolved", failureCode: "settlement_outcome_unknown" }); } catch { /* Keep the original claim as a replay barrier. */ }
      return responseFailure(policy.network, "settlement_unresolved", checked.payer);
    }
  }

  return Object.freeze({
    getSupported() { return { kinds: [{ x402Version: 2, scheme: "exact", network: TESTNET, extra: { feePayer: policy.sponsorAddress } }], extensions: [], signers: { [TESTNET]: [policy.sponsorAddress] } }; },
    verify,
    settle,
  });
}

export function sponsorBalanceToMicroCcd(info) {
  return availableMicroCcd(info);
}
