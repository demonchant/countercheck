import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuditLog } from "../src/audit.mjs";

function fixtureLog(context) {
  const directory = mkdtempSync(join(tmpdir(), "countercheck-audit-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "receipts.jsonl");
  return { directory, path, log: createAuditLog(path) };
}

test("audit log durably appends linked dispatch intents and returns them newest first", (context) => {
  const { path, log } = fixtureLog(context);
  const intent = log.append({ status: "settlement-dispatch-intent", transactionHash: "a".repeat(64) }, { durable: true });
  const outcome = log.append({ status: "settlement_unresolved", parentId: intent.id, transactionHash: "a".repeat(64) });
  const records = log.recent(10);
  assert.equal(records.length, 2);
  assert.equal(records[0].id, outcome.id);
  assert.equal(records[0].previousHash, intent.recordHash);
  assert.equal(records[1].status, "settlement-dispatch-intent");
  assert.match(readFileSync(path, "utf8"), /settlement-dispatch-intent/u);
});

test("audit log refuses to append to or report a tampered hash chain", (context) => {
  const { directory, path, log } = fixtureLog(context);
  log.append({ status: "settlement-dispatch-intent", transactionHash: "b".repeat(64) });
  const record = JSON.parse(readFileSync(path, "utf8"));
  record.status = "paid_and_finalized";
  writeFileSync(path, `${JSON.stringify(record)}\n`);
  assert.throws(() => log.recent(), /integrity check failed/u);
  assert.throws(() => log.append({ status: "paid_and_finalized" }), /integrity check failed/u);
});

test("audit log caps disk-backed history and rejects writes before exceeding the configured bound", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "countercheck-audit-cap-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "receipts.jsonl");
  const initialLog = createAuditLog(path, { maxBytes: 4_096 });
  initialLog.append({ status: "settlement-dispatch-intent", transactionHash: "c".repeat(64) });
  const log = createAuditLog(path, { maxBytes: statSync(path).size + 1 });
  assert.throws(() => log.append({ status: "settlement-dispatch-intent", transactionHash: "d".repeat(64) }), /size limit/u);
  assert.equal(log.recent().length, 1);
});
