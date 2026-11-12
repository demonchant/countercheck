const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function renderResourceUrl(renderExternalUrl) {
  if (!renderExternalUrl) return "";
  let platformUrl;
  try { platformUrl = new URL(renderExternalUrl); }
  catch { throw new Error("Render external URL is invalid."); }
  if (platformUrl.protocol !== "https:" || platformUrl.pathname !== "/" || platformUrl.search || platformUrl.hash || platformUrl.username || platformUrl.password) {
    throw new Error("Render external URL must be an HTTPS origin.");
  }
  return new URL("/resource", platformUrl).toString();
}

/**
 * Resolve the URL advertised in the x402 challenge. The HTTP service itself
 * remains loopback-bound locally. Render's HTTPS edge may expose the dedicated
 * seller process; the service advertises Render's assigned HTTPS origin.
 */
export function resolveSellerResourceUrl({ publicUrl, renderExternalUrl, host, port }) {
  const localUrl = `http://127.0.0.1:${port}/resource`;
  if (!publicUrl && renderExternalUrl) {
    publicUrl = renderResourceUrl(renderExternalUrl);
  }
  if (!publicUrl) return localUrl;

  let parsed;
  try { parsed = new URL(publicUrl); }
  catch { throw new Error("SELLER_RESOURCE_PUBLIC_URL must be a valid absolute URL."); }
  const isLocalHttp = parsed.protocol === "http:" && LOOPBACK_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new Error("SELLER_RESOURCE_PUBLIC_URL must use HTTPS (HTTP is allowed only for loopback development).");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/resource") {
    throw new Error("SELLER_RESOURCE_PUBLIC_URL must be a clean /resource URL without credentials, query, or fragment.");
  }
  if (isLocalHttp && parsed.hostname === "localhost") parsed.hostname = "127.0.0.1";
  return parsed.toString();
}

export function sellerListenConfig({ render, configuredHost, configuredPort, platformPort }) {
  if (render) {
    const port = Number(platformPort);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Render PORT is invalid.");
    return { host: "0.0.0.0", port };
  }
  const host = configuredHost || "127.0.0.1";
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(host)) throw new Error("Seller resource must bind to loopback outside Render.");
  const port = Number(configuredPort || "4191");
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("SELLER_RESOURCE_PORT must be an integer from 1024 through 65535");
  return { host: host === "localhost" ? "127.0.0.1" : host, port };
}
