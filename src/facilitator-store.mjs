import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function settlementKey(paymentPayload) {
  return createHash("sha256").update(canonicalJson(paymentPayload)).digest("hex");
}

export function createSettlementStore(directory) {
  const root = resolve(directory);
  function fileFor(key) {
    if (!/^[0-9a-f]{64}$/u.test(key)) throw new Error("Invalid settlement key.");
    return join(root, `${key}.json`);
  }
  function read(key) {
    try { return JSON.parse(readFileSync(fileFor(key), "utf8")); }
    catch (error) {
      if (error.code === "ENOENT") return null;
      throw new Error("Settlement replay store is unreadable; refusing to settle.");
    }
  }
  return Object.freeze({
    claim(key, details) {
      mkdirSync(root, { recursive: true });
      const file = fileFor(key);
      const record = { key, status: "claimed", createdAt: new Date().toISOString(), ...details };
      try {
        writeFileSync(file, `${JSON.stringify(record)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
        return { claimed: true, record };
      } catch (error) {
        if (error.code === "EEXIST") return { claimed: false, record: read(key) };
        throw error;
      }
    },
    get: read,
    update(key, fields) {
      const file = fileFor(key);
      const prior = read(key);
      if (!prior) throw new Error("Settlement claim disappeared; refusing to continue.");
      const next = { ...prior, ...fields, updatedAt: new Date().toISOString() };
      const temporary = `${file}.${randomUUID()}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(next)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
      renameSync(temporary, file);
      return next;
    },
  });
}
