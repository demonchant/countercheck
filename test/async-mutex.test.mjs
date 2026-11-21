import test from "node:test";
import assert from "node:assert/strict";
import { createAsyncMutex } from "../src/async-mutex.mjs";

test("buyer settlement mutex serializes concurrent work and can be released after an error", async () => {
  const acquire = createAsyncMutex();
  const order = [];
  const first = (async () => {
    const release = await acquire();
    order.push("first-start");
    await new Promise((resolve) => setTimeout(resolve, 10));
    order.push("first-end");
    release();
  })();
  const second = (async () => {
    const release = await acquire();
    order.push("second-start");
    release();
  })();
  await Promise.all([first, second]);
  assert.deepEqual(order, ["first-start", "first-end", "second-start"]);

  await assert.rejects((async () => {
    const unlock = await acquire();
    try { throw new Error("fixture failure"); }
    finally { unlock(); }
  })(), /fixture failure/u);
  const afterRelease = await acquire();
  afterRelease();
});
