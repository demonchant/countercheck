# Agent Card integrity and Registry update previews

**Registry observations:** 12 November 2026, Testnet only. No card was published and no Registry transaction was signed or submitted in that review.

## Current candidate revision status

The cards remain candidates; their endpoint bytes have not been fetched from a deployed service or published at a commit-pinned URL. The project owner supplied `https://countercheck-seller-1146.onrender.com` for the seller after the 12 November review. Current repository card bytes are buyer 3,424 bytes / SHA-256 `7ef2184dfab624b7afebf0ae7507062ef587c66504702896438b77d5da2b7acb`, seller 3,234 bytes / SHA-256 `74712f093aeb6804ded21d975b2a3fff2e8eca97e2b3441cff1105b211586519`. Both set `active=false`; seller `x402Support=false` because the new public deployment is not verified. The local Testnet payment run did not publish these card bytes or update their Registry records. Do not use these local hashes to build a Registry update without an authorized card/URI reconciliation.

The earlier unsigned previews below are superseded. They refer to the previous card bytes and must not be signed. After Render externally serves `/resource` and both A2A endpoints, set card activity fields to match observed service behavior, publish the final bytes, fetch the immutable URLs, compare exact bytes, hash the responses, and build new previews from a fresh Registry owner read.

## What the reads establish

| Agent | Token | Registration time | Current owner / `agentWallet` | On-chain `agent_uri` | On-chain metadata hash |
|---|---:|---|---|---|---|
| Buyer | 1147 | 2026-11-12 02:32:59 UTC | `3phKp6hd4vJU3WHexeVrc7mrkFbx3S9UtAxxsPEwE7S6rmNq7x` | `null` | `289c7e7f4d3c891fa56963da7bf199ce872ab52228abf692c376d3a637a97d53` |
| Seller | 1146 | 2026-11-12 02:14:09 UTC | `44khdNXk2yBn8PvJYFYNsKuZrV8oUvdHo23bL6dA7YyEYGkEF7` | `null` | `fc0f1a6e90f7f5d60f06159e4a34638331bd200b31de8bd9e8bfe169c3a2f858` |

Both cards are Active, but Registry verification is false because no public card URI is anchored. The buyer wallet matches the configured buyer account; the seller wallet matches the configured seller recipient.

At the time of the 12 November review, the local JSON files and GitHub `main` raw responses were byte-for-byte identical. Their exact served-byte hashes at that time were:

| Card | Current public URL | Bytes | SHA-256 |
|---|---|---:|---|
| Buyer #1147 | `https://raw.githubusercontent.com/demonchant/countercheck/main/agent-cards/countercheck-buyer-1147.json` | 2,915 | `af92a669f19f9a9ee942ce97b9791a0e592cbcacde096332a2e230cb05627e89` |
| Seller #1146 | `https://raw.githubusercontent.com/demonchant/countercheck/main/agent-cards/countercheck-seller-1146.json` | 2,167 | `98dc0eab2eee124c3af8103d0c8bf502744c41ff5d13f048c42e214b358089b0` |

The current public history returned one commit for each card: `3ca4f3b6398cede158c8196ff4b118029820b986`, dated 2026-11-12 03:47:30 UTC (“Publish Concordium Agent Cards”). Both agents were registered earlier that day. The current published hashes differ from the hashes already present at registration. The public path history contains no card version matching either on-chain hash. Therefore the exact finding is: the cards published after registration are not the bytes represented by the on-chain hashes. The earlier hash preimages and their source are unknown; there is no evidence to say which prior copy was authoritative or why those particular bytes were hashed.

The raw bytes, history result and Registry observations are preserved in [`evidence/agent-card-integrity-2026-11-12.json`](../evidence/agent-card-integrity-2026-11-12.json). Do not describe this as a local-vs-GitHub mismatch: those two copies currently match.

## Recommended card scope and URI policy

The field-level schema review, current A2A/Registry endpoint distinction, and deployment blockers are documented in [`docs/agent-card-service-audit.md`](agent-card-service-audit.md). The final cards cannot be selected until their real public interface URLs exist.

- Keep the Concordium Testnet token address, owner, `agentWallet`, contract coordinates, registration ID, and verification link consistent with the fresh Registry read.
- Keep the buyer card explicit that payments are disabled by default. The local product now displays and signs only a digest-bound reviewed transaction in the one captured Testnet flow; public card claims must remain limited to the actual deployed endpoint state.
- Replace the seller's stale “no resource API is configured” description with: **“Concordium Testnet seller identity for Countercheck's opt-in loopback x402 v2 exact resource. When locally enabled, it serves a 1 CCD native CCD challenge using the configured Testnet seller recipient and sponsor. No public resource endpoint is deployed; settlement is disabled by default.”** Do not publish the loopback URL as a service available to remote agents.
- Keep `services` empty until a reachable public service exists. Neither card currently has a public A2A/HTTP agent endpoint; both top-level `url` fields point to the card JSON itself. Do not present these cards as callable A2A endpoints. Correct the endpoint/schema when an actual A2A service is available, or keep the document clearly limited to Registry identity metadata.
- The embedded `/v1/badge-check/{badge}` URL is a documented permanent alias, so it does not need changing for this Testnet repair.
- After card content is final, publish immutable versioned bytes and use a commit-pinned URI rather than mutable `main`. Hash the exact response bytes from that URI, then rebuild the Registry preview. Publishing is an external action and has not been performed here.

## Historical unsigned `setAgentURI` parameter previews — superseded

The hosted Registry builder returned HTTP 200 for these previews at the time. They use the previous card bytes, previous immutable URLs and previous hashes; they are not valid previews for the current candidate cards.

| Agent | Pinned URI | Required owner signer | Suggested energy |
|---|---|---|---:|
| Buyer #1147 | `https://raw.githubusercontent.com/demonchant/countercheck/3ca4f3b6398cede158c8196ff4b118029820b986/agent-cards/countercheck-buyer-1147.json` | `3phKp6hd4vJU3WHexeVrc7mrkFbx3S9UtAxxsPEwE7S6rmNq7x` | 30,000 |
| Seller #1146 | `https://raw.githubusercontent.com/demonchant/countercheck/3ca4f3b6398cede158c8196ff4b118029820b986/agent-cards/countercheck-seller-1146.json` | `44khdNXk2yBn8PvJYFYNsKuZrV8oUvdHo23bL6dA7YyEYGkEF7` | 30,000 |

The full historical builder responses, including `parameter_json` and `parameter_hex`, remain in [`evidence/set-agent-uri-previews-2026-11-12.json`](../evidence/set-agent-uri-previews-2026-11-12.json). They are parameter previews, not signed account transactions; suggested energy is **not** a live fee quote. Rebuild previews only after the public service and final immutable card bytes are verified. The owner or an approved operator must review, sign and submit each update; no such action occurred here.
