/**
 * Upgrade-compatibility seed for PR #121204. It runs at the STABLE tree, after the
 * recovery harness's phase A has admitted the outage backlog into <run>/state with
 * that same stable tree. With stable's own queue API it moves three rows into the
 * other persisted states a stable install can leave behind:
 *   - claimed, then released with a recorded failure (attempts=1, last_error set)
 *   - claimed, then failed (dead-lettered: status=failed with a reason)
 *   - claimed by an owner that then died (status=claimed, left held)
 * The rest stay pending, as phase A left them.
 *   node --import <tree>/scripts/tsx.mjs upgrade-seed.mts --tree <stable> --run <dir>
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const TREE = path.resolve(arg("--tree") ?? "");
const RUN = path.resolve(arg("--run") ?? "");
const STATE = path.join(RUN, "state");
Object.assign(process.env, {
  HOME: path.join(RUN, "home"),
  TMPDIR: path.join(RUN, "tmp"),
  OPENCLAW_STATE_DIR: STATE,
  OPENCLAW_CONFIG_PATH: path.join(RUN, "openclaw.json"),
  OPENCLAW_PROFILE: "proof121204",
});
const sha = execFileSync("git", ["-C", TREE, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
console.log(`[seed] tree ${sha}`);

const db = new DatabaseSync(path.join(STATE, "state", "openclaw.sqlite"), { readOnly: true });
const ids = (
  db
    .prepare(
      `SELECT event_id FROM channel_ingress_events WHERE channel_id='discord' AND account_id='default'
         AND status='pending' ORDER BY received_at ASC, rowid ASC`,
    )
    .all() as Array<{ event_id: string }>
).map((r) => r.event_id);
db.close();
if (ids.length < 3) {
  throw new Error(`expected at least 3 pending rows from phase A, found ${ids.length}`);
}
const [releasedId, failedId, heldId] = ids;

const { createChannelIngressQueue } = await import(
  pathToFileURL(path.join(TREE, "src/channels/message/ingress-queue.ts")).href
);
const queue = createChannelIngressQueue({ channelId: "discord", accountId: "default", stateDir: STATE });

const released = await queue.claim(releasedId);
if (!released) throw new Error(`could not claim ${releasedId}`);
await queue.release(released, { lastError: "stable-era delivery failure" });
console.log(`[seed] ${releasedId}: claimed, released with last_error (stable)`);

const failed = await queue.claim(failedId);
if (!failed) throw new Error(`could not claim ${failedId}`);
await queue.fail(failed, { reason: "stable-era-dead-letter", message: "seeded by the stable tree" });
console.log(`[seed] ${failedId}: claimed, failed (stable dead-letter)`);

const held = await queue.claim(heldId);
if (!held) throw new Error(`could not claim ${heldId}`);
console.log(`[seed] ${heldId}: claimed and left held; this process now exits as a dead owner`);
process.exit(0);
