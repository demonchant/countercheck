import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const cards = [
  { label: "buyer", file: "countercheck-buyer-1147.json" },
  { label: "seller", file: "countercheck-seller-1146.json" },
];
const repo = "https://api.github.com/repos/demonchant/countercheck";
const sourceCommit = "3ca4f3b6398cede158c8196ff4b118029820b986";
const registryEvidence = JSON.parse(await readFile(new URL("../evidence/registry-readonly-2026-11-12.json", import.meta.url), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const results = [];

for (const card of cards) {
  const path = `agent-cards/${card.file}`;
  const localBytes = await readFile(new URL(`../${path}`, import.meta.url));
  const currentUrl = `https://raw.githubusercontent.com/demonchant/countercheck/main/${path}`;
  const currentResponse = await fetch(currentUrl, { signal: AbortSignal.timeout(15_000) });
  const currentBytes = Buffer.from(await currentResponse.arrayBuffer());
  if (!currentResponse.ok) throw new Error(`Current public ${card.label} card returned HTTP ${currentResponse.status}.`);
  const historyResponse = await fetch(`${repo}/commits?path=${encodeURIComponent(path)}&per_page=100`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "countercheck-readonly-audit" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!historyResponse.ok) throw new Error(`GitHub commit-history request failed with HTTP ${historyResponse.status}.`);
  const history = await historyResponse.json();
  const versions = [];
  for (const commit of history) {
    const commitUrl = `https://raw.githubusercontent.com/demonchant/countercheck/${commit.sha}/${path}`;
    const response = await fetch(commitUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) continue;
    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = sha256(bytes);
    const registry = registryEvidence.observations.find((item) => item.label === card.label);
    versions.push({
      commit: commit.sha,
      committedAt: commit.commit.author.date,
      message: commit.commit.message.split(/\r?\n/u, 1)[0],
      url: commitUrl,
      sha256: hash,
      matchesCurrentOnChainHash: hash === registry?.checkBadge.body.on_chain?.metadata_hash_hex,
    });
  }
  const registry = registryEvidence.observations.find((item) => item.label === card.label);
  results.push({
    label: card.label,
    badge: registry.badge,
    registrationTimestamp: registry.agentRecord.registered_at,
    owner: registry.agentRecord.owner_account,
    agentWallet: registry.agentWallet.agent_wallet,
    agentUri: registry.checkBadge.body.on_chain.agent_uri,
    onChainHash: registry.checkBadge.body.on_chain.metadata_hash_hex,
    local: { bytes: localBytes.length, sha256: sha256(localBytes) },
    currentPublic: { url: currentUrl, httpStatus: currentResponse.status, bytes: currentBytes.length, sha256: sha256(currentBytes), matchesLocalBytes: localBytes.equals(currentBytes) },
    commitHistoryHttpStatus: historyResponse.status,
    commitVersionsExamined: versions,
  });
}

const output = {
  provenance: "OBSERVED_PUBLIC_GITHUB_AND_SAVED_TESTNET_REGISTRY_READS",
  observedAtUtc: new Date().toISOString(),
  historyApi: `${repo}/commits?path={card_path}&per_page=100`,
  sourceCommit,
  actions: "Public GET only; no GitHub write or Registry transaction",
  results,
  conclusion: "The local files match the current public raw copies. Their observed hashes do not match the on-chain hashes. No matching version was found in the returned public path history; the original hash preimages remain unknown.",
};
const outputPath = new URL("../evidence/agent-card-integrity-2026-11-12.json", import.meta.url);
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: "w" });
for (const result of results) console.log(JSON.stringify({
  agent: result.label,
  registeredAt: result.registrationTimestamp,
  publicCommitCount: result.commitVersionsExamined.length,
  publicCardMatchesLocal: result.currentPublic.matchesLocalBytes,
  localPublicHash: result.currentPublic.sha256,
  onChainHash: result.onChainHash,
  publicHistoryHasAnchor: result.commitVersionsExamined.some((version) => version.matchesCurrentOnChainHash),
}));
console.log(`Saved card provenance evidence: ${outputPath.pathname}`);
