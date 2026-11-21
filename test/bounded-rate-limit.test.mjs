import test from "node:test";
import assert from "node:assert/strict";
import { createBoundedWindowLimiter } from "../src/bounded-rate-limit.mjs";

test("bounded window limiter expires a window and caps distinct-key memory", () => {
  const limiter = createBoundedWindowLimiter({ limit: 2, windowMs: 100, maxEntries: 3 });
  assert.equal(limiter.allow("one", 0), true);
  assert.equal(limiter.allow("one", 1), true);
  assert.equal(limiter.allow("one", 2), false);
  assert.equal(limiter.allow("one", 100), true);
  for (let index = 0; index < 20; index += 1) limiter.allow(`remote-${index}`, 101 + index);
  assert.equal(limiter.size, 3);
});

test("bounded window limiter treats a backwards clock as a fresh window", () => {
  const limiter = createBoundedWindowLimiter({ limit: 1, windowMs: 100, maxEntries: 2 });
  assert.equal(limiter.allow("client", 100), true);
  assert.equal(limiter.allow("client", 99), true);
});
