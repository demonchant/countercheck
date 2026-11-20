# Vercel, Clerk, and Render configuration

The hosted buyer app is [countercheck-six.vercel.app](https://countercheck-six.vercel.app/). The separate buyer API is `https://countercheck-1-lecq.onrender.com`; the seller challenge service is `https://countercheck-seller-1146.onrender.com`.

Hosted Testnet purchase requests require a valid Clerk session, a Clerk user ID on the explicit buyer allowlist, a same-session quote/review/approval, and the Vercel Testnet purchase switch. All settings default to blocked. The Render buyer API still uses the one configured Testnet buyer account, so allowlisted people share that account and its balance.

## Create and configure Clerk

1. Create a Clerk application at [dashboard.clerk.com](https://dashboard.clerk.com/) and enable the sign-in methods you want to accept.
2. In **API keys**, copy the **Publishable key** and the **JWT public key**. Keep the secret key private; this integration verifies Clerk session JWTs with the public key and does not need the Clerk secret key.
3. In **Users**, copy the Clerk user ID for each person allowed to authorize the demo buyer. Add only those IDs to Vercel's `COUNTERCHECK_ALLOWED_USER_IDS`, separated by commas. An authenticated but unlisted user cannot request a quote, review, approval, purchase, or receipt history.
4. Keep public sign-up restricted if you want only invited demo buyers to use the app. Creating a Clerk account alone does not authorize a purchase.

## Vercel environment variables

In the Vercel project that owns `countercheck-six.vercel.app` (the linked project is `countercheck`), open **Settings → Environment Variables**. Add these to **Production**:

| Name | Value |
|---|---|
| `CLERK_PUBLISHABLE_KEY` | The Clerk Publishable key (`pk_...`). This is public configuration, but set it as a server environment variable so the app can return it only from `/api/auth-config`. |
| `CLERK_JWT_KEY` | The Clerk Dashboard's JWT public key in PEM form. Never use the private signing key. |
| `CLERK_AUTHORIZED_PARTIES` | `https://countercheck-six.vercel.app` |
| `COUNTERCHECK_ALLOWED_USER_IDS` | Comma-separated Clerk user IDs that may use the buyer workflow. No default users are authorized. |
| `COUNTERCHECK_PUBLIC_PURCHASES_ENABLED` | `true` only when you intend to permit the configured Testnet purchase. Omitted or `false` keeps hosted purchases blocked. |
| `COUNTERCHECK_API_ORIGIN` | `https://countercheck-1-lecq.onrender.com` with no path or trailing route. |
| `COUNTERCHECK_API_TOKEN` | The exact same secret as Render's `BUYER_API_TOKEN` for `countercheck-buyer-api`. Keep it private and at least 32 characters. |
| `COUNTERCHECK_API_PROXY_ENABLED` | `true` |

The Vercel proxy verifies the signed Clerk token, checks its authorized party, enforces the allowlist, and sends a server-created user/session binding to the buyer API. The browser cannot choose that identity header. The buyer API binds quote, transaction review, approval, and purchase to the same session. Receipt history is filtered to the authorizing session.

## Render buyer API

In the separate Render `countercheck-buyer-api` service, keep `BUYER_API_TOKEN` configured and private. Its service must keep the existing Testnet seller, buyer, sponsor, and account settings. For an actual hosted payment, `PAYMENTS_ENABLED` and facilitator settlement must also be enabled in Render after reviewing the Testnet account and balances. Vercel's `COUNTERCHECK_PUBLIC_PURCHASES_ENABLED` is an additional independent gate; both sides must permit the transaction.

The seller service only serves the seller resource and seller A2A interface. It does not provide Clerk sign-in or buyer authorization.

## Apply and verify

After changing Vercel environment variables, redeploy the production deployment so the functions receive them. The Git-connected Vercel project will also build automatically after a repository push.

- `GET /api/auth-config` returns whether the non-secret Clerk frontend configuration is ready; it never returns the JWT key or allowed user list.
- After signing in, `GET /api/session` shows whether the signed-in Clerk account is individually authorized. Its `userId` can be used to add that account to the allowlist.
- `GET /api/status` reports the public purchase gate. It is enabled only when Clerk verification, at least one allowed user, the Vercel purchase switch, and the Render buyer payment configuration all permit it.
- Without an authorized Clerk session, quote/review/approval/purchase calls are rejected. A purchase call also requires the same session that created and approved its exact transaction digest.

Never put Clerk JWT keys, buyer API tokens, or Concordium signing keys in browser variables, source code, chat, or a commit.
