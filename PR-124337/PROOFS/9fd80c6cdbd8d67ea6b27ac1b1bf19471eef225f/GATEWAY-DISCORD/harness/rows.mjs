// Prints channel_ingress_events rows of an isolated proof state dir. Reads a copy (db + wal + shm),
// so the live Gateway's database is never opened by this process.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.argv[2];
const found = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(sqlite|db)$/u.test(e.name)) found.push(p);
  }
};
walk(root);
for (const file of found) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rows-"));
  const copy = path.join(tmp, "s.db");
  for (const suffix of ["", "-wal", "-shm"]) {
    if (fs.existsSync(file + suffix)) fs.copyFileSync(file + suffix, copy + suffix);
  }
  try {
    const db = new DatabaseSync(copy);
    const has = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='channel_ingress_events'").get();
    if (!has) continue;
    const rows = db
      .prepare("SELECT event_id, status, attempts, last_error, failed_reason, payload_json FROM channel_ingress_events ORDER BY received_at")
      .all();
    for (const r of rows) {
      let content = "";
      try {
        const p = JSON.parse(r.payload_json);
        const m = r.payload_json.match(/(?:HOLD|MSG)-[A-Z0-9-]+/u); content = m ? m[0] : "";
      } catch {}
      console.log(
        [path.relative(root, file), String(r.event_id).replace(/\d{19}/gu, (m) => `#${m.slice(-2)}`), content, r.status, `attempts=${r.attempts}`, `last_error=${r.last_error ?? ""}`, `failed_reason=${r.failed_reason ?? ""}`].join("\t"),
      );
    }
    db.close();
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
