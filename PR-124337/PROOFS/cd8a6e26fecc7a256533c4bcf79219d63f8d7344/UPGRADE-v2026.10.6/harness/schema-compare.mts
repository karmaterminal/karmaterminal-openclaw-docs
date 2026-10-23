/** Print the live channel_ingress_events DDL and user_version of each run's state (read from copies). */
import { copyFileSync, existsSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
for (const run of process.argv.slice(2)) {
  const src = path.join(run, "state", "state", "openclaw.sqlite");
  const dir = mkdtempSync(path.join(os.tmpdir(), "schema-124337-"));
  for (const s of ["", "-wal", "-shm"]) if (existsSync(src + s)) copyFileSync(src + s, path.join(dir, "db" + s));
  const db = new DatabaseSync(path.join(dir, "db"), { readOnly: true });
  const ddl = db.prepare("SELECT group_concat(sql, ';\n') AS s FROM (SELECT sql FROM sqlite_master WHERE tbl_name='channel_ingress_events' AND sql IS NOT NULL ORDER BY type, name)").get() as { s: string };
  const uv = db.prepare("PRAGMA user_version").get() as { user_version: number };
  console.log(`### ${path.basename(run)} user_version=${uv.user_version}\n${ddl.s}`);
  db.close();
}
