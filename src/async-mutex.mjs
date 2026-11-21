/** A process-local async mutex. It does not coordinate separate app instances. */
export function createAsyncMutex() {
  let tail = Promise.resolve();
  return async function acquire() {
    const previous = tail;
    let release;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    return release;
  };
}
