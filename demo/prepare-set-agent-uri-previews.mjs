import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const repo = new URL("../", import.meta.url);
const cards = [
  { label: "buyer", file: "countercheck-buyer-1147.json", badge: "JyP9WD3R9D4tgxwjcy8jc", tokenId: 1147 },
  { label: "seller", file: "countercheck-seller-1146.json", badge: "JyP9WBwwDBZxrqhuqHWPt", tokenId: 1146 },
];
const commit = "3ca4f3b6398cede158c8196ff4b118029820b986";
const registryEvidence = JSON.parse(await readFile(new URL("../evidence/registry-readonly-2026-11-12.json", import.meta.url), "utf8"));

const updates = [];
for (const card of cards) {
  const observation = registryEvidence.observations.find((item) => item.label === card.label);
  if (!observation) throw new Error(`Missing current Registry owner for ${card.label}.`);
  const path = `agent-cards/${card.file}`;
  const localBytes = await readFile(new URL(`../${path}`, import.meta.url));
  const cardUri = `https://raw.githubusercontent.com/demonchant/countercheck/${commit}/${path}`;
  const hostedResponse = await fetch(cardUri, { signal: AbortSignal.timeout(15_000) });
  if (!hostedResponse.ok) throw new Error(`${card.label} pinned public Agent Card returned HTTP ${hostedResponse.status}.`);
  const hostedBytes = Buffer.from(await hostedResponse.arrayBuffer());
  const localHash = createHash("sha256").update(localBytes).digest("hex");
  const hostedHash = createHash("sha256").update(hostedBytes).digest("hex");
  if (!localBytes.equals(hostedBytes) || localHash !== hostedHash) throw new Error(`${card.label} local and pinned public card bytes differ.`);

  const builderUrl = new URL(`/v1/build-set-agent-uri/${card.badge}`, "https://agent-registry-mcp.concordium.com");
  builderUrl.searchParams.set("metadata_hash_hex", hostedHash);
  builderUrl.searchParams.set("agent_uri", cardUri);
  builderUrl.searchParams.set("sender", observation.agentRecord.owner_account);
  const builderResponse = await fetch(builderUrl, { signal: AbortSignal.timeout(15_000) });
  const builderBody = await builderResponse.json();
  if (!builderResponse.ok) throw new Error(`${card.label} Registry builder returned HTTP ${builderResponse.status}.`);
  if (builderBody.network !== "testnet"
    || builderBody.contract_address?.index !== 12802
    || builderBody.contract_address?.subindex !== 0
    || builderBody.receive_name !== "CIS-8004.setAgentURI"
    || builderBody.sender !== observation.agentRecord.owner_account) {
    throw new Error(`${card.label} builder response does not match the observed owner and Testnet CIS-8004 contract.`);
  }
  updates.push({
    agent: card.label,
    badge: card.badge,
    tokenId: card.tokenId,
    currentStatus: observation.checkBadge.body.on_chain.status,
    currentAgentUri: observation.checkBadge.body.on_chain.agent_uri,
    currentOnChainHash: observation.checkBadge.body.on_chain.metadata_hash_hex,
    proposedAgentUri: cardUri,
    publicHttpStatus: hostedResponse.status,
    servedByteLength: hostedBytes.length,
    proposedSha256: hostedHash,
    requiredSigner: observation.agentRecord.owner_account,
    registryBuilderHttpStatus: builderResponse.status,
    unsignedRegistryBuilderResponse: builderBody,
  });
}

const output = {
  provenance: "OBSERVED_REGISTRY_BUILDER_RESPONSE",
  preparedAtUtc: new Date().toISOString(),
  network: "testnet",
  action: "Prepared unsigned CIS-8004 setAgentURI parameter previews only; no account transaction was signed or submitted",
  sourceCommit: commit,
  updates,
  caveat: "These previews pin the current published Agent Card bytes. Rebuild them if final card content or public URI changes.",
};
const outputPath = new URL("../evidence/set-agent-uri-previews-2026-11-12.json", import.meta.url);
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: "w" });
for (const update of updates) {
  console.log(JSON.stringify({
    agent: update.agent,
    network: update.unsignedRegistryBuilderResponse.network,
    contract: update.unsignedRegistryBuilderResponse.contract_address,
    entrypoint: update.unsignedRegistryBuilderResponse.receive_name,
    tokenId: update.tokenId,
    agentUri: update.proposedAgentUri,
    sha256: update.proposedSha256,
    signer: update.requiredSigner,
    suggestedEnergy: update.unsignedRegistryBuilderResponse.suggested_energy,
    parameterHex: update.unsignedRegistryBuilderResponse.parameter_hex,
  }));
}
console.log(`Saved unsigned update previews: ${outputPath.pathname}`);
