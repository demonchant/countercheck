import { createHash, randomUUID } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, statSync, writeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./config.mjs";

function digest(record) {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

function verifyContents(contents) {
  let priorHash = null;
  for (const line of contents.split(/\r?\n/u).filter(Boolean)) {
    const record = JSON.parse(line);
    const recordedHash = record.recordHash;
    const payload = { ...record };
    delete payload.recordHash;
    if (record.previousHash !== priorHash || typeof recordedHash !== "string" || digest(payload) !== recordedHash) return false;
    priorHash = recordedHash;
  }
  return true;
}

export function createAuditLog(path, { maxBytes = 16 * 1024 * 1024 } = {}) {
  const filePath = resolve(path);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError("Audit log maxBytes must be a positive safe integer.");

  function fileSize() {
    try {
      const size = statSync(filePath).size;
      if (size > maxBytes) throw new Error("Receipt log reached its configured size limit; archive it before accepting more actions.");
      return size;
    } catch (error) {
      if (error.code === "ENOENT") return 0;
      throw error;
    }
  }

  function previousHash() {
    try {
      fileSize();
      const contents = readFileSync(filePath, "utf8");
      if (!contents.trim()) return null;
      const lines = contents.trim().split(/\r?\n/u);
      const previous = JSON.parse(lines.at(-1));
      if (typeof previous.recordHash !== "string" || !verifyContents(contents)) throw new Error("Receipt log integrity check failed; refusing to append.");
      return previous.recordHash;
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  function append(fields, { durable = true } = {}) {
    const record = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      previousHash: previousHash(),
      ...fields,
    };
    record.recordHash = digest(record);
    mkdirSync(dirname(filePath), { recursive: true });
    const serialized = `${JSON.stringify(record)}\n`;
    if (fileSize() + Buffer.byteLength(serialized) > maxBytes) {
      throw new Error("Receipt log reached its configured size limit; archive it before accepting more actions.");
    }
    const descriptor = openSync(filePath, "a", 0o600);
    try {
      const bytes = Buffer.from(serialized, "utf8");
      let offset = 0;
      while (offset < bytes.length) offset += writeSync(descriptor, bytes, offset, bytes.length - offset);
      if (durable) fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    return record;
  }

  function recent(limit = 10) {
    try {
      fileSize();
      const contents = readFileSync(filePath, "utf8");
      if (!verifyContents(contents)) throw new Error("Receipt log integrity check failed.");
      return contents
        .split(/\r?\n/u)
        .filter(Boolean)
        .slice(-limit)
        .reverse()
        .map((line) => {
          const record = JSON.parse(line);
          delete record.requestDigest;
          return record;
        });
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  return Object.freeze({ append, recent });
}

const auditLog = createAuditLog(config.auditPath);
export const appendAudit = (...args) => auditLog.append(...args);
export const recentAudit = (...args) => auditLog.recent(...args);
