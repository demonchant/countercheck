const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Resolve the x402 facilitator API base URL without allowing public URLs in Render. */
export function resolveFacilitatorUrl(configuredUrl, { render = false } = {}) {
  const value = configuredUrl || (render ? "" : "http://127.0.0.1:4180");
  if (!value) throw new Error("FACILITATOR_URL must reference the private facilitator service on Render.");
  const candidate = value.includes("://") ? value : `http://${value}`;
  let parsed;
  try { parsed = new URL(candidate); }
  catch { throw new Error("FACILITATOR_URL must be a valid absolute URL or Render host:port value."); }

  if (parsed.protocol !== "http:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("FACILITATOR_URL must be a clean HTTP origin without credentials, path, query, or fragment.");
  }

  if (render) {
    if (LOOPBACK_HOSTS.has(parsed.hostname) || parsed.hostname.toLowerCase().endsWith(".onrender.com")) {
      throw new Error("Render seller must use the facilitator's private-network hostname, not loopback or a public URL.");
    }
  } else if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error("Outside Render, FACILITATOR_URL must use loopback.");
  }

  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("FACILITATOR_URL must include a valid port.");
  return parsed.origin;
}

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

/** Resolve the seller's public HTTPS resource URL used by the buyer API. */
export function resolveBuyerSellerResourceUrl({ configuredUrl, renderExternalUrl, render = false }) {
  let value = configuredUrl || "";
  if (render && !value && renderExternalUrl) value = renderResourceUrl(renderExternalUrl);
  if (!value) return "";
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new Error("SELLER_RESOURCE_URL must be a valid absolute URL."); }
  if (render && parsed.protocol === "https:" && parsed.pathname === "/" && !parsed.search && !parsed.hash && !parsed.username && !parsed.password) {
    parsed.pathname = "/resource";
  }
  const localHttp = parsed.protocol === "http:" && LOOPBACK_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== "https:" && !localHttp) throw new Error("SELLER_RESOURCE_URL must use HTTPS (HTTP is allowed only for loopback development).");
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/resource") {
    throw new Error("SELLER_RESOURCE_URL must be a clean /resource URL without credentials, query, or fragment.");
  }
  if (render && localHttp) throw new Error("Render buyer API cannot use a loopback seller resource URL.");
  return parsed.toString();
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
