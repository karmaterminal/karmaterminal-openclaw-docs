/** Read-only dump of every Discord ingress row in <run>/state, one line per row. */
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const i = process.argv.indexOf("--run");
const RUN = path.resolve(process.argv[i + 1] ?? "");
const label = process.argv[process.argv.indexOf("--label") + 1] ?? "dump";
const db = new DatabaseSync(path.join(RUN, "state", "state", "openclaw.sqlite"), { readOnly: true, timeout: 10_000 });
const cols = (db.prepare("PRAGMA table_info(channel_ingress_events)").all() as Array<{ name: string }>).map((c) => c.name);
console.log(`[${label}] columns: ${cols.join(",")}`);
const rows = db
  .prepare(
    `SELECT event_id, status, attempts, updated_at, received_at, failed_reason, last_error, claim_owner, claimed_at, last_attempt_at
       FROM channel_ingress_events WHERE channel_id='discord' AND account_id='default'
       ORDER BY received_at ASC, rowid ASC`,
  )
  .all() as Array<Record<string, unknown>>;
for (const r of rows) {
  console.log(`[${label}] ${JSON.stringify(r)}`);
}
const counts: Record<string, number> = {};
for (const r of rows) counts[String(r.status) + (r.failed_reason ? `:${r.failed_reason}` : "")] = (counts[String(r.status) + (r.failed_reason ? `:${r.failed_reason}` : "")] ?? 0) + 1;
console.log(`[${label}] total=${rows.length} ${JSON.stringify(counts)}`);
db.close();
