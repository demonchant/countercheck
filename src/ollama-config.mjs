const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Resolve the model endpoint without silently sending prompts to a remote host. */
export function resolveOllamaBaseUrl(rawUrl = "http://127.0.0.1:11434", allowRemote = "false") {
  if (allowRemote !== "true" && allowRemote !== "false") {
    throw new Error("OLLAMA_ALLOW_REMOTE must be exactly true or false.");
  }

  let url;
  try { url = new URL(rawUrl); }
  catch { throw new Error("OLLAMA_URL must be a valid HTTP(S) origin."); }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("OLLAMA_URL must be a clean HTTP(S) origin without credentials, path, query, or fragment.");
  }

  const loopback = LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
  if (!loopback && allowRemote !== "true") {
    throw new Error("Remote Ollama hosts are blocked. Set OLLAMA_ALLOW_REMOTE=true only when sending prompts to that host is intended.");
  }
  if (!loopback && url.protocol !== "https:") {
    throw new Error("Remote Ollama hosts must use HTTPS to protect prompts in transit.");
  }
  return url.origin;
}
