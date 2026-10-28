/**
 * PR #124337 upgrade / data-model compatibility harness.
 *
 *   node --import <tree>/scripts/tsx.mjs upgrade-124337.mts --tree <tree> --run <dir> --mode seed|drain
 *
 * Every queue and drain call uses <tree>'s own production code (src/channels/message),
 * imported by path, over the durable SQLite ingress table in <run>/state.
 *
 * seed (run with the STABLE tree): writes the persisted states a stable install leaves:
 *   ev-pending          pending, never claimed
 *   ev-released         claimed+released twice with last_error (attempts=2)
 *   ev-abandoned-over   abandoned by stable's real drain until attempts > maxAttempts (stable never bounds it)
 *   ev-abandoned-under  abandoned once by stable's real drain (attempts=1)
 *   ev-cancel           claimed+released twice with last_error (attempts=2); cancelled later at the reader
 *   ev-dead             claimed, then failed (dead-lettered)
 *   ev-owner            claimed by an owner that then exits (dead-owner claim)
 *
 * drain (run with either tree, fresh process, same policy for both): recovers stale claims,
 * then runs a scripted dispatcher for a fixed number of passes:
 *   ev-pending, ev-released, ev-owner: complete
 *   ev-abandoned-over: deferred, then onAbandoned (every time)
 *   ev-abandoned-under: deferred + onAbandoned the first time, complete after
 *   ev-cancel: deferred + onCancelled the first time, complete after
 *   ev-dead: must never be dispatched
 * Each dispatch logs the claim's persisted retry facts as the reader sees them.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const TREE = path.resolve(arg("--tree") ?? "");
const RUN = path.resolve(arg("--run") ?? "");
const MODE = arg("--mode");
const STATE = path.join(RUN, "state");
for (const dir of [STATE, path.join(RUN, "home"), path.join(RUN, "tmp")]) {
  mkdirSync(dir, { recursive: true });
}
Object.assign(process.env, {
  HOME: path.join(RUN, "home"),
  TMPDIR: path.join(RUN, "tmp"),
  OPENCLAW_STATE_DIR: STATE,
  OPENCLAW_CONFIG_PATH: path.join(RUN, "openclaw.json"),
  OPENCLAW_PROFILE: "proof124337",
});
const sha = execFileSync("git", ["-C", TREE, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
console.log(`[${MODE}] tree ${sha}`);

// Same policy for writer, control and reader: ClawSweeper's example bound, fast backoff.
const retryPolicy = { maxAttempts: 3, deadLetterMinAgeMs: 0, baseMs: 1, maxMs: 5 };
const CHANNEL = { channelId: "telegram", accountId: "default" };

const { createChannelIngressQueue } = await import(
  pathToFileURL(path.join(TREE, "src/channels/message/ingress-queue.ts")).href
);
const { createChannelIngressDrain } = await import(
  pathToFileURL(path.join(TREE, "src/channels/message/ingress-drain.ts")).href
);
const queue = createChannelIngressQueue({ ...CHANNEL, stateDir: STATE });

type Claim = {
  id: string;
  attempts?: number;
  lastError?: string;
  lastAttemptAt?: number;
  claim?: { owner?: string };
};
type Lifecycle = { onAbandoned: () => unknown; onCancelled?: () => unknown };
const facts = (c: Claim) =>
  JSON.stringify({ attempts: c.attempts ?? null, lastError: c.lastError ?? null });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runDrain(
  label: string,
  passes: number,
  script: (claim: Claim, n: number) => "complete" | "abandon" | "cancel",
) {
  const seen = new Map<string, number>();
  const drain = createChannelIngressDrain({
    queue,
    retryPolicy,
    deriveLaneKey: (record: { id: string }) => record.id,
    onLog: (message: string) => console.log(`[${label}] log ${message}`),
    dispatchClaimedEvent: async (claim: Claim, lifecycle: Lifecycle) => {
      const n = (seen.get(claim.id) ?? 0) + 1;
      seen.set(claim.id, n);
      const action = script(claim, n);
      console.log(`[${label}] dispatch ${claim.id} #${n} sees ${facts(claim)} -> ${action}`);
      if (action === "complete") {
        return { kind: "completed" as const };
      }
      // A deferred turn that never owns the reply lane, settled from outside the dispatch.
      setTimeout(() => {
        void (action === "cancel" && lifecycle.onCancelled
          ? lifecycle.onCancelled()
          : lifecycle.onAbandoned());
      }, 5);
      return { kind: "deferred" as const };
    },
  });
  const recovered = await drain.recoverStaleClaims();
  console.log(`[${label}] recoverStaleClaims=${recovered}`);
  for (let pass = 0; pass < passes; pass++) {
    await drain.drainOnce();
    await drain.waitForIdle();
    await sleep(40);
  }
  await drain.waitForIdle();
  drain.dispose();
  console.log(`[${label}] dispatch counts ${JSON.stringify(Object.fromEntries(seen))}`);
}

if (MODE === "seed") {
  const base = Date.now() - 60_000;
  // Rows stable's own drain abandons, alone in the queue so nothing else is claimed.
  // ev-abandoned-over goes through several passes first; ev-abandoned-under joins
  // for exactly one pass, so it is abandoned once.
  await queue.enqueue("ev-abandoned-over", { text: "over" }, { receivedAt: base, laneKey: "ev-abandoned-over" });
  await runDrain("seed-drain-1", 5, () => "abandon");
  await queue.enqueue("ev-abandoned-under", { text: "under" }, { receivedAt: base + 1, laneKey: "ev-abandoned-under" });
  await runDrain("seed-drain-2", 1, () => "abandon");
} else if (MODE === "seed-rest") {
  const base = Date.now() - 50_000;
  const ids = ["ev-pending", "ev-released", "ev-cancel", "ev-dead", "ev-owner"];
  for (const [i, id] of ids.entries()) {
    await queue.enqueue(id, { text: id }, { receivedAt: base + i, laneKey: id });
  }
  for (const id of ["ev-released", "ev-cancel"]) {
    for (let k = 0; k < 2; k++) {
      const c = await queue.claim(id);
      if (!c) throw new Error(`could not claim ${id}`);
      await queue.release(c, { lastError: "stable-era delivery failure" });
    }
    console.log(`[seed-rest] ${id}: claimed and released twice with last_error`);
  }
  const dead = await queue.claim("ev-dead");
  if (!dead) throw new Error("could not claim ev-dead");
  await queue.fail(dead, { reason: "stable-era-dead-letter", message: "seeded by the stable tree" });
  console.log("[seed-rest] ev-dead: claimed, failed (dead-letter)");
  const held = await queue.claim("ev-owner", { ownerId: "stable-owner-that-died" });
  if (!held) throw new Error("could not claim ev-owner");
  console.log("[seed-rest] ev-owner: claimed and left held; this process exits as a dead owner");
  process.exit(0);
} else if (MODE === "drain") {
  await runDrain("drain", 12, (claim, n) => {
    switch (claim.id) {
      case "ev-abandoned-over":
        return "abandon";
      case "ev-abandoned-under":
        return n === 1 ? "abandon" : "complete";
      case "ev-cancel":
        return n === 1 ? "cancel" : "complete";
      case "ev-dead":
        throw new Error("a dead-lettered row was dispatched");
      default:
        return "complete";
    }
  });
} else {
  throw new Error(`unknown --mode ${MODE}`);
}
process.exit(0);
