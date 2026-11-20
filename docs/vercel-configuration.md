# Vercel and Render configuration

The project owner supplied these public URLs:

- Buyer web app: <https://countercheck-six.vercel.app/>
- Seller challenge service: <https://countercheck-seller-1146.onrender.com>

The buyer app, buyer API health route, and seller challenge route were checked on 20 November 2026. This does not verify public payments or production readiness.

## Vercel environment variables

In Vercel, open the project that owns `countercheck-six.vercel.app` (the linked project is `countercheck`), then **Settings → Environment Variables**. Add these server-side variables for the **Production** environment:

| Name | Value |
|---|---|
| `COUNTERCHECK_API_ORIGIN` | `https://countercheck-1-lecq.onrender.com` for the current buyer API. Enter only the HTTPS origin, with no path or trailing route. Do not use the seller URL or Vercel URL. |
| `COUNTERCHECK_API_TOKEN` | The exact same secret as Render's `BUYER_API_TOKEN` for `countercheck-buyer-api`. Keep it private and at least 32 characters. |
| `COUNTERCHECK_API_PROXY_ENABLED` | `true` |

In the Render `countercheck-buyer-api` service, use the generated `BUYER_API_TOKEN` as Vercel's `COUNTERCHECK_API_TOKEN`. Never put the token in frontend variables (such as `NEXT_PUBLIC_*`), source code, chat, or a commit. The seller service at `countercheck-seller-1146.onrender.com` only provides the seller resource and seller A2A interface.

After saving the variables, redeploy the Vercel production deployment so the serverless function receives them. Vercel environment changes do not update an already-built deployment.

## Payment boundary

Enabling the proxy makes the configured buyer API routes available through the server-side Vercel function. The proxy keeps the Render bearer token server-side. Public `POST /api/purchase` remains hard-blocked with `403 individual_authorization_required`; this setting does not add per-user login or individual authorization and does not enable buyer payment. Keep Render `PAYMENTS_ENABLED=false` and facilitator settlement disabled for this public demo until the individual authorization design is implemented and reviewed.
