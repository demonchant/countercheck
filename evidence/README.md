# Testnet evidence

Countercheck completed one configured end-to-end purchase on Concordium Testnet on 19 November 2026. The run rejected a mismatched seller, checked the configured seller and payment request, prepared and approved the exact transaction, settled 1 CCD, checked finality and transaction details through a second gRPC read, and received the paid resource.

The transaction is [available in CCDScan Testnet](https://testnet.ccdscan.io/?d=transaction&dsh=71b36427263821b76278df9fce399ea8881b5ad342da95f476e2f5c4dbbb5147). The explorer was not independently inspected during the recording. The sanitized run record is [`live-e2e-2026-11-19.json`](live-e2e-2026-11-19.json).

This is evidence of one configured Testnet run. It does not establish production readiness, general reliability, multi-user authorization, or buyer demand. Public buyer payments remain disabled.

The [20 November read-only Registry/card audit](registry-live-audit-2026-11-20.json) explains the earlier hash discrepancy. The buyer's current card matches its pinned URI; the seller's current card does not match the older endpoint card pinned by the Registry. No on-chain metadata update was made.

The [20 November hosted deployment check](live-deployment-readonly-2026-11-20.json) confirms the Vercel page/API and Render buyer/seller read-only endpoints responded. Purchase and settlement flags were off; this was not a hosted purchase test.

The [21 November local security regression run](security-regression-2026-11-21.json) records 131 passing Node tests, 6 passing Playwright tests, JavaScript syntax checks, and the buyer-side finality, remote-Ollama, and Registry-facts UI safeguards. The new buyer-side finality path is verified with SDK fixtures only; no new Testnet payment or production check was performed.

The [21 November interoperability/recovery run](agent-production-regression-2026-11-21.json) records the final A2A discovery test, bounded durable dispatch-intent log, and combined local test results. It proves local protocol compatibility and storage behavior only; it does not establish an external-agent pilot, a fresh live payment, production readiness, or event eligibility.
