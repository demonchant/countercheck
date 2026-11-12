import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./config.mjs";

const filePath = resolve(config.auditPath);

function digest(record) {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

function previousHash() {
  try {
    const contents = readFileSync(filePath, "utf8");
    if (!contents.trim()) return null;
    const lines = contents.trim().split(/\r?\n/u);
    const previous = JSON.parse(lines.at(-1));
    if (typeof previous.recordHash !== "string" || !verifyChain(contents)) throw new Error("Receipt log integrity check failed; refusing to append.");
    return previous.recordHash;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function verifyChain(contents) {
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

export function appendAudit(fields) {
  const record = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    previousHash: previousHash(),
    ...fields,
  };
  record.recordHash = digest(record);
  mkdirSync(dirname(filePath), { recursive: true });
  appendFileSync(filePath, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
  return record;
}

export function recentAudit(limit = 10) {
  try {
    const contents = readFileSync(filePath, "utf8");
    if (!verifyChain(contents)) throw new Error("Receipt log integrity check failed.");
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
