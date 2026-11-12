# Evidence index

No testnet transaction, deployment, screenshot, video, user interview, or portal receipt exists as of 11 November 2026.

| Evidence | Provenance/status | What it proves | What it does not prove |
|---|---|---|---|
| Official event article: https://www.concordium.com/article/concordium-trusted-agents-hackathon-encode-club | `OFFICIAL` / `VERIFIED` for published facts; retrieved 11 Nov 2026 | Public eligibility summary, testnet requirement, event dates, submission artifacts and judging prose. | Full Encode legal terms, exact portal fields or user registration state. |
| Official Registry, CIS-8004 and MCP docs linked in docs/dependency-audit.md | `OFFICIAL` / `VERIFIED` for docs as retrieved 11 Nov 2026 | Intended API/standard capabilities and key custody boundary. | This project's actual live service call or testnet contract availability. |
| `Invoke-RestMethod` GET to Registry MCP `/healthz` | `OBSERVED` / `BLOCKED`, 11 Nov 2026, current local environment | Request failed with WebException during TLS receive. | Does not prove Concordium endpoint is down. |
| x402 issue #2332 and agentic-commerce issue #450 | `THIRD-PARTY REPORTED` / `OBSERVED` issue text, retrieved 11 Nov 2026 | Individual developers proposed post-payment action evidence and pre-payment payee checks. | Prevalence, actual losses, market size, buyer willingness to pay or consensus. |
| Source code in `src/` and `public/` | `OBSERVED` / `IMPLEMENTED / UNVERIFIED` | Local source for intended verification/payment/persistence flow. | Installability, runtime behavior, API compatibility, testnet behavior or UI verification. |
| Local JSONL receipt when first created | Future `OBSERVED` artifact | Whatever its recorded source data and digests actually contain. | Independent chain state, immutable history, truth of an agent's behavior, legal compliance. |

## Add real run artifacts later

For each actual testnet run, add a redacted text record with: source revision, UTC time, network CAIP-2, registry request and response schema (no secrets), seller/buyer badge identifiers, quote amount/asset/payee/expiry, explicit signer approval, transaction hash, CCDExplorer link, independently read sender/recipient/amount/finality, response digest, unresolved/error behavior and limitations. Never include keys, identity documents or full sensitive request/response bodies.
