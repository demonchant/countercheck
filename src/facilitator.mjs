import { AccountAddress } from "@concordium/web-sdk";
import { ExactConcordiumScheme } from "@x402/concordium/exact/facilitator";
import {
  CONCORDIUM_TESTNET_CAIP2,
  getConcordiumGrpcUrl,
  parseGrpcUrl,
  toConcordiumFacilitatorSigner,
} from "@x402/concordium";
import { x402Facilitator } from "@x402/core/facilitator";
import { createFacilitatorApi, sponsorBalanceToMicroCcd } from "./facilitator-core.mjs";
import { facilitatorConfig as config } from "./facilitator-config.mjs";
import { createSettlementStore } from "./facilitator-store.mjs";
import { createFacilitatorServer } from "./facilitator-server.mjs";

function requireConfiguration() {
  const missing = [];
  if (!config.buyerAddress) missing.push("CCD_ACCOUNT_ADDRESS");
  if (!config.sellerPayTo) missing.push("SELLER_PAY_TO");
  if (!config.sponsorAddress) missing.push("CCD_FACILITATOR_ADDRESS");
  if (!config.sponsorPrivateKey) missing.push("CCD_FACILITATOR_PRIVATE_KEY");
  if (!config.apiToken || config.apiToken.length < 32) missing.push("FACILITATOR_API_TOKEN (at least 32 characters)");
  if (missing.length) throw new Error(`Missing facilitator configuration: ${missing.join(", ")}`);
  if (!/^[0-9a-f]{64}$/iu.test(config.sponsorPrivateKey)) {
    throw new Error("CCD_FACILITATOR_PRIVATE_KEY must be a 32-byte hex Ed25519 key from the supported account export.");
  }
  try {
    AccountAddress.fromBase58(config.buyerAddress);
    AccountAddress.fromBase58(config.sellerPayTo);
    AccountAddress.fromBase58(config.sponsorAddress);
  } catch {
    throw new Error("A configured buyer, seller, or sponsor address is not a valid Concordium account address.");
  }
}

requireConfiguration();
if (config.network !== CONCORDIUM_TESTNET_CAIP2) throw new Error("Refusing to start outside Concordium Testnet.");

const [grpcHost, grpcPort] = parseGrpcUrl(getConcordiumGrpcUrl(CONCORDIUM_TESTNET_CAIP2));
const signer = toConcordiumFacilitatorSigner(config.sponsorAddress, config.sponsorPrivateKey, {
  host: grpcHost,
  port: grpcPort,
  useTls: true,
  network: CONCORDIUM_TESTNET_CAIP2,
});
if (signer.getNetwork() !== CONCORDIUM_TESTNET_CAIP2 || signer.getAddress() !== config.sponsorAddress) {
  throw new Error("Facilitator signer configuration does not match the configured Testnet sponsor.");
}

const scheme = new ExactConcordiumScheme({
  signer,
  requireFinalization: true,
  finalizationTimeoutMs: 60_000,
  maxExpiryOffsetSeconds: 300,
});
const protocol = new x402Facilitator().register(CONCORDIUM_TESTNET_CAIP2, scheme);
const api = createFacilitatorApi({
  scheme: protocol,
  store: createSettlementStore(config.storePath),
  policy: config,
  getSponsorAvailableMicroCcd: async () => sponsorBalanceToMicroCcd(await signer.getAccountInfo(config.sponsorAddress)),
  // Read the finalized block summary again so the API only reports success when
  // the chain summary itself confirms the authorized sender, recipient, amount, and asset.
  getFinalizedTransactionInfo: async (transaction) => signer.waitForFinalization(transaction, 60_000),
});
const server = createFacilitatorServer({ api, config });
server.headersTimeout = 10_000;
server.requestTimeout = 35_000;
server.keepAliveTimeout = 5_000;
server.listen(config.port, config.host, () => {
  console.log(`Countercheck Concordium Testnet facilitator listening at http://${config.host}:${config.port}`);
  console.log(`Settlement is ${config.settlementEnabled ? "enabled by explicit local configuration" : "disabled"}. No signing or broadcast occurs until an authenticated /settle request while enabled.`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
