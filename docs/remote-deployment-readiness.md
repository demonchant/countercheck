# Remote deployment readiness

**Reviewed:** 19 November 2026  
**Remote services/deployments verified from this workspace:** no
**Local Testnet workflow:** one successful configured run, recorded in [`../evidence/live-e2e-2026-11-19.json`](../evidence/live-e2e-2026-11-19.json)

## Current state

- A public Render URL was checked on 12 November and returned HTTP 502 with `x-render-routing: no-deploy`; see [`../evidence/render-public-check-2026-11-12.json`](../evidence/render-public-check-2026-11-12.json). No later public deployment verification is recorded.
- The project owner supplied `https://countercheck-seller-1146.onrender.com` for the seller and `https://countercheck-red.vercel.app/` for the buyer web app. These URLs are recorded in the deployment guide; they have not been verified from this workspace. The Vercel buyer API proxy needs the separate Render `countercheck-buyer-api` service origin, not the seller URL or the Vercel site URL.
- `render.yaml` contains a challenge-only seller service configuration. It does not establish a deployed seller endpoint or paid fulfillment.
- The buyer app and facilitator are single-operator, loopback-oriented. `src/vercel-api-proxy.mjs` injects an upstream bearer token but does not authenticate each visitor. The proxy now hard-blocks `POST /api/purchase` with `403 individual_authorization_required`; local loopback Testnet payment remains available through the separate explicit UI action. Do not remove this public block until per-user authentication and authorization have been implemented and reviewed.
- Payment and settlement flags default off. Do not enable remote buyer payment until individual user authentication, per-user approval, scoped permissions, and a security review are implemented.
- The 19 November local run does not establish a public deployment, production readiness, or multi-instance replay safety.

## Work required before any public buyer deployment

1. Implement a real user identity and authorization boundary; a shared upstream bearer token is not visitor authentication.
2. Move signing to a policy-limited managed signer with explicit per-user consent. Keep buyer and sponsor authority separate.
3. Use durable shared idempotency/replay protection and resolve concurrent or ambiguous submissions across instances.
4. Configure private service networking, rate limits, observability, retention/access controls, backup and recovery.
5. Keep the buyer UI/API private until the above controls are reviewed. Test remote seller challenge-only behavior separately from paid fulfillment.
6. Verify the exact deployed revision, public routes, configuration, external Registry reads, and chain postconditions from a cold browser.

## External prerequisites

- Access to the Vercel and Render projects, current plans, domains, regions and service settings.
- Access to the Vercel and Render projects to confirm their deployed revisions and settings; this repository update does not perform a deployment.
- Non-secret seller/sponsor public addresses for any challenge-only seller. Buyer and sponsor private keys must not be entered in public hosting templates.
- Separate authorization for deployment, public release, spending, or submission. None of those actions was performed in this review.

See [`deployment.md`](deployment.md) for local run instructions and operational limits.
