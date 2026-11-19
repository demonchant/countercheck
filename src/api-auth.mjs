import { timingSafeEqual } from "node:crypto";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function resolveBuyerApiRuntime({ render = false, host, apiToken = "" } = {}) {
  const configuredHost = host || (render ? "0.0.0.0" : "127.0.0.1");
  if (render) {
    if (configuredHost !== "0.0.0.0") throw new Error("Render buyer API must bind to 0.0.0.0.");
    if (typeof apiToken !== "string" || apiToken.length < 32) throw new Error("Render buyer API requires BUYER_API_TOKEN with at least 32 characters.");
    return Object.freeze({ host: configuredHost, remote: true });
  }
  if (!LOOPBACK_HOSTS.has(configuredHost)) throw new Error("Buyer API must bind to loopback outside Render.");
  return Object.freeze({ host: configuredHost === "localhost" ? "127.0.0.1" : configuredHost, remote: false });
}

function bearerMatches(request, token) {
  if (typeof token !== "string" || token.length < 32) return false;
  const authorization = request.headers.authorization || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expectedBytes = Buffer.from(token);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export function createBuyerApiAuthorizer({ remote = false, port, token = "" } = {}) {
  if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) throw new Error("Buyer API port is invalid.");
  if (remote && (typeof token !== "string" || token.length < 32)) throw new Error("Remote buyer API requires a bearer token of at least 32 characters.");
  const expectedOrigin = `http://127.0.0.1:${Number(port)}`;
  return (request) => {
    if (remote) return bearerMatches(request, token);
    return request.headers.host === `127.0.0.1:${Number(port)}`
      && request.headers.origin === expectedOrigin
      && request.headers["x-countercheck-request"] === "1";
  };
}
