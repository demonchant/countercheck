import { handleBuyerApiProxy } from "../src/vercel-api-proxy.mjs";

export default async function handler(request, response) {
  return handleBuyerApiProxy(request, response);
}
