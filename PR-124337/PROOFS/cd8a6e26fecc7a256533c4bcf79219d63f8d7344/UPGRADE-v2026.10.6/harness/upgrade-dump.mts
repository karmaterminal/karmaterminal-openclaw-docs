/**
 * Dump every telegram ingress row in <run>/state, one line per row.
 * It reads a fresh copy of the database files (db, -wal, -shm) in plain read-only mode,
 * so the dump never writes to the run's own state.
 *   node upgrade-dump.mts --run <dir> --label <label>
 */
import { copyFileSync, existsSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const arg = (name: string) => process.argv[process.argv.indexOf(name) + 1];
const RUN = path.resolve(arg("--run") ?? "");
const label = arg("--label") ?? "dump";
const src = path.join(RUN, "state", "state", "openclaw.sqlite");
const dir = mkdtempSync(path.join(os.tmpdir(), "dump-124337-"));
for (const suffix of ["", "-wal", "-shm"]) {
  if (existsSync(src + suffix)) {
    copyFileSync(src + suffix, path.join(dir, "openclaw.sqlite" + suffix));
  }
}
const db = new DatabaseSync(path.join(dir, "openclaw.sqlite"), { readOnly: true, timeout: 10_000 });
const cols = (db.prepare("PRAGMA table_info(channel_ingress_events)").all() as Array<{ name: string }>).map(
  (c) => c.name,
);
console.log(`[${label}] columns: ${cols.join(",")}`);
const rows = db
  .prepare(
    `SELECT event_id, status, attempts, last_error, last_attempt_at, failed_reason, failed_at, completed_at, claimed_at,
            claim_owner, received_at, updated_at
       FROM channel_ingress_events WHERE channel_id='telegram' AND account_id='default'
       ORDER BY event_id`,
  )
  .all() as Array<Record<string, unknown>>;
for (const r of rows) {
  console.log(`[${label}] ${JSON.stringify(r)}`);
}
console.log(`[${label}] total=${rows.length}`);
db.close();
