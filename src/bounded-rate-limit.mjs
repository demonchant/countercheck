/** Fixed-window limiter with a strict memory bound for public endpoints. */
export function createBoundedWindowLimiter({ limit, windowMs, maxEntries = 2_048 }) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1
    || !Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new TypeError("Rate limiter limits must be positive integers.");
  }
  const entries = new Map();

  return {
    allow(key, now = Date.now()) {
      const normalizedKey = String(key || "unknown").slice(0, 256);
      let usage = entries.get(normalizedKey);
      if (!usage || now - usage.startedAt >= windowMs || now < usage.startedAt) {
        usage = { startedAt: now, count: 0 };
      }
      usage.count += 1;
      entries.delete(normalizedKey);
      entries.set(normalizedKey, usage);
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
      return usage.count <= limit;
    },
    get size() { return entries.size; },
  };
}
