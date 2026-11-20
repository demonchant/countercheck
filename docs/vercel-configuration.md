# Vercel guest demo and Render buyer API

The hosted buyer app is [countercheck-six.vercel.app](https://countercheck-six.vercel.app/). Its Vercel functions proxy read-only and buyer actions to `https://countercheck-1-lecq.onrender.com`; the seller challenge service is `https://countercheck-seller-1146.onrender.com`.

## Vercel environment variables

In the Vercel project that owns the buyer app, configure these server-side Production variables:

| Name | Value |
|---|---|
| `COUNTERCHECK_API_ORIGIN` | `https://countercheck-1-lecq.onrender.com` with no path or trailing route. |
| `COUNTERCHECK_API_TOKEN` | The same private secret as Render's `BUYER_API_TOKEN`; use at least 32 characters. |
| `COUNTERCHECK_API_PROXY_ENABLED` | `true` |
| `COUNTERCHECK_PUBLIC_PURCHASES_ENABLED` | Keep unset or `false` for a read-only hosted demo. Set `true` only when anonymous Testnet purchases are intended. |

No Clerk account, signing key, or user allowlist is required. The Vercel proxy uses the private API token to sign an HttpOnly guest-session cookie and generates the buyer/session identity header itself. It never returns the API token to the browser. The cookie scopes quotes, approvals, and receipt history to one browser session; it does not identify a person or prevent someone from opening another guest session.

`GET /api/demo-seller` returns only the configured public seller badge through the Vercel-to-buyer-API proxy. The badge is public identity data. Buyer API credentials and account settings stay server-side.

## Anonymous Testnet payment boundary

When `COUNTERCHECK_PUBLIC_PURCHASES_ENABLED=true` and Render permits payment/settlement, **any visitor to the hosted site can initiate a Testnet purchase**. They must still review and explicitly approve the exact transaction digest in the page. All visitors use the same configured Render buyer account. The 1 CCD ceiling is per transaction, not an aggregate spending limit; the guest cookie is not an access-control or anti-abuse boundary.

Leave the Vercel switch off unless public anonymous payments are intended and the shared buyer/sponsor accounts and balances have been reviewed. The app then displays `TESTNET PAYMENTS LOCKED`; local loopback mode remains separately controlled by the local demo launcher.

## Render buyer API

Keep `BUYER_API_TOKEN` configured and private. The buyer API must retain the intended Testnet buyer, seller and sponsor configuration. For hosted settlement, `PAYMENTS_ENABLED` and facilitator settlement must also be enabled in Render. The Vercel public-purchase switch is an additional independent gate.

## Apply and verify

After changing Vercel variables, redeploy the production deployment so the functions receive them. The Git-connected project also builds after a repository push.

- `GET /api/session` creates or reuses the signed guest-browser session and reports whether the Vercel purchase switch is on.
- `GET /api/demo-seller` returns the configured seller badge or a specific missing-configuration error.
- `GET /api/status` reports the buyer API's readiness, with public purchase availability enabled only when the Vercel switch and Render buyer/settlement configuration both permit it.
- Quote, review, approval, purchase, and receipt requests carry a server-generated guest-session binding. The buyer API rejects a quote or approval used from a different session.

Never put buyer API tokens or Concordium signing keys in browser variables, source code, screenshots, logs, or a commit. The source change does not establish a new Vercel deployment or prove anonymous purchases work live.
