/**
 * Real-behaviour proof harness for openclaw/openclaw#124337.
 *
 * Drives the PRODUCTION channel-ingress boundary end to end, with no vitest and
 * no mocks of the modules under test:
 *
 *   transport raw event
 *     -> createChannelIngressMonitor (what channel plugins call; owns admit + drain)
 *       -> createChannelIngressQueue (real SQLite durable queue in a temp state dir)
 *       -> createChannelIngressDrain (claim, lifecycle, retry disposition)
 *         -> bindIngressLifecycleToReplyOptions + fanInChannelIngressLifecycles
 *           + createInboundDebouncer (the channel handoff shape, e.g. Discord/WhatsApp)
 *             -> enqueueFollowupRun (the real reply/followup queue, session busy)
 *               -> terminal lifecycle (clearFollowupQueue on gateway restart-drain,
 *                  or queue-cap rejection) -> drain settles the SQLite row.
 *
 * What is NOT production here (stated honestly):
 *   - there is no gateway HTTP/WebSocket server and no real transport socket;
 *   - the channel plugin itself is a 40-line stand-in (inspect/codec/deliver),
 *     configured like extensions/sms/src/ingress-spool.ts;
 *   - the agent turn is a stub: it adopts through the production helper
 *     admitFollowupRunLifecycle (what followup-turn-admission.ts calls) and
 *     then completes; no model is called;
 *   - "session busy" is modelled exactly as agent-runner-run.ts does it:
 *     enqueueFollowupRun(..., restartIfIdle = false) while a run owns the lane;
 *   - the retry policy is the plugin-level override shape (Discord passes
 *     deadLetterMinAgeMs: 0); maxAttempts is lowered to 3 and backoff to 0 so
 *     the proof finishes in seconds.
 *
 * Usage:
 *   node --import <tree>/scripts/tsx.mjs boundary-proof.mts \
 *        --tree <repo tree> --state <state dir> --phase A1|A2|B [--max-polls N]
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

type Args = { tree: string; state: string; phase: "A1" | "A2" | "B"; maxPolls: number };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const tree = get("--tree");
  const state = get("--state");
  const phase = get("--phase") as Args["phase"] | undefined;
  if (!tree || !state || !phase || !["A1", "A2", "B"].includes(phase)) {
    throw new Error("usage: --tree <repo> --state <dir> --phase A1|A2|B [--max-polls N]");
  }
  return { tree, state, phase, maxPolls: Number(get("--max-polls") ?? 40) };
}

const args = parseArgs();
const t0 = Date.now();
const log = (tag: string, message: string) => {
  const ms = String(Date.now() - t0).padStart(5, " ");
  console.log(`+${ms}ms [${tag}] ${message}`);
};

const mod = (rel: string) => import(pathToFileURL(path.join(args.tree, "src", rel)).href);

// ---- production modules ------------------------------------------------------
const { createChannelIngressQueue } = await mod("channels/message/ingress-queue.ts");
const { createChannelIngressMonitor } = await mod("channels/message/ingress-monitor.ts");
const { bindIngressLifecycleToReplyOptions } = await mod(
  "channels/message/ingress-drain-lifecycle.ts",
);
const { fanInChannelIngressLifecycles } = await mod("plugin-sdk/channel-ingress-runtime.ts");
const { createInboundDebouncer } = await mod("auto-reply/inbound-debounce.ts");
const replyQueue = await mod("auto-reply/reply/queue.ts");
const { clearFollowupQueue } = await mod("auto-reply/reply/queue/state.ts");
const { markGatewayRestartDraining } = await mod("process/gateway-work-admission.ts");

const {
  enqueueFollowupRun,
  scheduleFollowupDrain,
  admitFollowupRunLifecycle,
  completeFollowupRunLifecycle,
} = replyQueue;

// ---- fixed identities --------------------------------------------------------
const CHANNEL_ID = "proofchan";
const ACCOUNT_ID = "acct";
const LANE = "chat:lane-1";
const SESSION_KEY = `agent:main:${CHANNEL_ID}:direct:lane-1`;
// Plugin-level override shape (cf. extensions/discord/src/monitor/ingress.ts uses
// deadLetterMinAgeMs: 0). Lowered ceilings so the trace finishes in seconds.
// Scenario B keeps a 150 ms retry backoff so each attempt is observable as a
// separate claim and the lane can be freed between attempts.
const RETRY_POLICY =
  args.phase === "B"
    ? { maxAttempts: 3, deadLetterMinAgeMs: 0, baseMs: 150, maxMs: 150 }
    : { maxAttempts: 3, deadLetterMinAgeMs: 0, baseMs: 0, maxMs: 0 };
const POLL_MS = 50;

type RawEvent = { id: string; text: string };
type StoredPayload = { version: 1; raw: RawEvent };

// ---- observation: production reads + raw SQLite -----------------------------
function findSqlite(dir: string): string | undefined {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      const nested = findSqlite(full);
      if (nested) {
        return nested;
      }
    } else if (/\.(db|sqlite)$/u.test(name)) {
      return full;
    }
  }
  return undefined;
}

function dumpRows(label: string) {
  const file = findSqlite(args.state);
  if (!file) {
    log("sqlite", `${label}: no database file under state dir`);
    return;
  }
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = db
      .prepare(
        `SELECT event_id, lane_key, status, attempts, last_error, failed_reason
           FROM channel_ingress_events
          WHERE channel_id = ? AND account_id = ?
          ORDER BY received_at ASC`,
      )
      .all(CHANNEL_ID, ACCOUNT_ID) as Array<Record<string, unknown>>;
    log(
      "sqlite",
      `${label}: ${rows
        .map(
          (r) =>
            `{${r.event_id} status=${r.status} attempts=${r.attempts} last_error=${r.last_error ?? "null"} failed_reason=${r.failed_reason ?? "null"}}`,
        )
        .join(" ")}`,
    );
  } finally {
    db.close();
  }
}

// ---- the channel stand-in ----------------------------------------------------
const queue = createChannelIngressQueue({
  channelId: CHANNEL_ID,
  accountId: ACCOUNT_ID,
  stateDir: args.state,
  now: () => Date.now(),
});

type Lifecycle = Parameters<typeof bindIngressLifecycleToReplyOptions>[0];
const dispatched: string[] = [];
const flushErrors: unknown[] = [];

// Queue settings per phase. A: plain followup queue. B: cap 1 + drop "new" so a
// durable turn that arrives while the lane is full is rejected before admission
// (enqueue.ts "queue-cap-new" -> completeFollowupRunLifecycle(run) -> onAbandoned).
const QUEUE_SETTINGS =
  args.phase === "B"
    ? ({ mode: "followup", debounceMs: 0, cap: 1, dropPolicy: "new" } as const)
    : ({ mode: "followup", debounceMs: 0, cap: 10, dropPolicy: "summarize" } as const);

const makeRun = (raw: RawEvent, lifecycle?: Lifecycle) => {
  const bound = lifecycle ? bindIngressLifecycleToReplyOptions(lifecycle) : undefined;
  return {
    prompt: raw.text,
    messageId: raw.id,
    enqueuedAt: Date.now(),
    originatingChannel: CHANNEL_ID,
    originatingTo: "direct:lane-1",
    turnAdoptionLifecycle: bound?.turnAdoptionLifecycle,
    abortSignal: bound?.turnAdoptionLifecycle.abortSignal,
    run: {
      agentId: "main",
      agentDir: args.state,
      sessionId: "sess-proof",
      sessionFile: path.join(args.state, "session.json"),
      workspaceDir: args.state,
      config: {},
      provider: "stub",
      model: "stub-model",
      timeoutMs: 10_000,
      blockReplyBreak: "text_end",
    },
  };
};

// The agent turn stub for a drained followup: adopt through the production
// helper (followup-turn-admission.ts:158 does exactly this), then complete the
// way followup-runner.ts does for a consumed turn.
// A run whose abort signal already fired is skipped the way followup-turn-admission
// does (isFollowupRunAborted -> "skipped"); the queue has settled its lifecycle.
let sessionBusy = args.phase !== "A2";
const agentTurn = async (run: any) => {
  if (run.abortSignal?.aborted || run.queueAbortSignal?.aborted) {
    log("agent", `followup ${run.messageId ?? "(no id)"} already aborted; skipped`);
    return;
  }
  log("agent", `turn started for message ${run.messageId ?? "(no id)"}`);
  await admitFollowupRunLifecycle(run);
  log("agent", `adopted ${run.messageId ?? "(no id)"}; ingress claim completed`);
  completeFollowupRunLifecycle(run);
  log("agent", `reply delivered for ${run.messageId ?? "(no id)"}`);
};

// Per-session inbound debouncer + fan-in: the Discord / WhatsApp handoff shape.
const debouncer = createInboundDebouncer<{ key: string; raw: RawEvent; lifecycle: Lifecycle }>({
  debounceMs: 0,
  buildKey: (entry) => entry.key,
  onFlush: (entries, createFlush) => {
    const fanned = fanInChannelIngressLifecycles(entries.map((entry) => entry.lifecycle));
    return createFlush({
      lifecycle: fanned.lifecycle,
      dispatch: async (admissionLifecycle: Lifecycle) => {
        const raw = entries[entries.length - 1]!.raw;
        dispatched.push(raw.id);
        const run = makeRun(raw, admissionLifecycle);
        // agent-runner-run.ts: while a run owns the lane the inbound turn is
        // enqueued with restartIfIdle=false and waits for admission.
        const enqueued = enqueueFollowupRun(
          SESSION_KEY,
          run,
          QUEUE_SETTINGS,
          "message-id",
          agentTurn,
          !sessionBusy,
        );
        log(
          "reply-queue",
          `enqueueFollowupRun(${raw.id}) -> ${enqueued} (session ${sessionBusy ? "busy" : "idle"}, cap=${QUEUE_SETTINGS.cap}, dropPolicy=${QUEUE_SETTINGS.dropPolicy})`,
        );
      },
    });
  },
  onError: (err) => flushErrors.push(err),
});

const monitor = createChannelIngressMonitor<RawEvent, RawEvent, StoredPayload>({
  queue,
  inspect: (raw) => ({ eventId: raw.id, laneKey: LANE }),
  payload: {
    version: 1,
    serialize: (raw) => raw,
    deserialize: (body) => body,
    encode: ({ body }) => ({ version: 1, raw: body }),
    decode: (payload) => ({ version: payload.version, body: payload.raw }),
    createClaimError: (kind) => new Error(`proof claim error: ${kind}`),
  },
  deliver: async (raw, lifecycle) => {
    log("monitor", `deliver(${raw.id}) claimed on lane ${LANE}`);
    await debouncer.enqueue({ key: SESSION_KEY, raw, lifecycle });
  },
  pollIntervalMs: POLL_MS,
  retention: "standard",
  drain: {
    retryPolicy: RETRY_POLICY,
    onLog: (message: string) => log("drain-log", message),
  },
  deferredClaims: "manual",
  waitForDeliveryIdleOnStop: false,
  createStoppedError: () => new Error("proof ingress stopped."),
  onError: (error) => log("monitor-error", String(error)),
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pendingAttempts = async () =>
  (await queue.listPending()).map((row: any) => `${row.id}:attempts=${row.attempts}`).join(",");

log("env", `node ${process.version} tree=${args.tree} phase=${args.phase}`);
log(
  "env",
  `retryPolicy=${JSON.stringify(RETRY_POLICY)} queueSettings=${JSON.stringify(QUEUE_SETTINGS)}`,
);

// ============================================================================
if (args.phase === "A1") {
  // Scenario A, process 1 ("gateway up, session busy"): a message is admitted,
  // claimed, deferred into the followup queue behind the busy session, then the
  // gateway stops: markGatewayRestartDraining aborts the restart-drain signal,
  // which drain.ts clears every followup queue through (clearFollowupQueue).
  monitor.start();
  const admitted = await monitor.admit({ id: "msg-1", text: "hello while busy" });
  log("monitor", `admit(msg-1) -> ${admitted.kind}/${admitted.queueResult?.kind ?? "?"}`);
  await monitor.waitForIdle();
  await sleep(POLL_MS * 2);
  log("queue", `claims=${(await queue.listClaims()).map((c: any) => c.id).join(",")} pending=[${await pendingAttempts()}]`);
  dumpRows("before stop");

  log("gateway", `markGatewayRestartDraining("stop (proof)") -- gateway stop`);
  markGatewayRestartDraining("stop (proof)");
  await sleep(POLL_MS * 4);
  await monitor.stop();
  await sleep(POLL_MS * 2);

  log("queue", `claims=${(await queue.listClaims()).map((c: any) => c.id).join(",")} pending=[${await pendingAttempts()}] failed=[${(await queue.listFailed()).map((f: any) => `${f.id}:${f.reason}`).join(",")}]`);
  dumpRows("after stop");
  log("result", `dispatched=${JSON.stringify(dispatched)} flushErrors=${flushErrors.length}`);
  const [row] = await queue.listPending();
  const verdict =
    row && row.id === "msg-1" && row.attempts === 0 && !row.lastError
      ? "cancellation was budget-free (attempts unchanged = 0, no lastError)"
      : `cancellation CHARGED the row (attempts=${row?.attempts} lastError=${row?.lastError})`;
  log("verdict", `A1: ${verdict}`);
  process.exit(0);
}

// ============================================================================
if (args.phase === "A2") {
  // Scenario A, process 2 ("gateway restarted, session idle"): the same state
  // dir; the pending row must be redelivered and reach the agent turn.
  dumpRows("at restart");
  monitor.start();
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    await sleep(POLL_MS * 2);
    const pending = await queue.listPending();
    const claims = await queue.listClaims();
    if (pending.length === 0 && claims.length === 0) {
      break;
    }
  }
  await monitor.waitForIdle();
  await monitor.stop();
  dumpRows("after restart drain");
  log("result", `dispatched=${JSON.stringify(dispatched)} flushErrors=${flushErrors.length}`);
  const pending = await queue.listPending();
  const failed = await queue.listFailed();
  const verdict =
    dispatched.includes("msg-1") && pending.length === 0 && failed.length === 0
      ? "msg-1 redelivered after restart, adopted, completed"
      : `msg-1 NOT delivered (pending=${pending.length} failed=${failed.length})`;
  log("verdict", `A2: ${verdict}`);
  process.exit(0);
}

// ============================================================================
// Scenario B: genuine pre-adoption abandonment. The session is busy and its
// followup queue is at cap (cap 1, dropPolicy "new"): a blocker turn from a
// non-durable source already waits. Every durable delivery is rejected at the
// cap before admission -> onAbandoned -> drain settles the claim.
{
  const blocker = makeRun({ id: "blocker", text: "earlier queued turn (non-durable source)" });
  const blocked = enqueueFollowupRun(SESSION_KEY, blocker, QUEUE_SETTINGS, "none", agentTurn, false);
  log("reply-queue", `pre-filled session queue with blocker -> ${blocked} (session busy)`);

  monitor.start();
  for (const id of ["msg-1", "msg-2"]) {
    const admitted = await monitor.admit({ id, text: `durable ${id}` });
    log("monitor", `admit(${id}) -> ${admitted.kind}/${admitted.queueResult?.kind ?? "?"} lane=${LANE}`);
  }

  // Observe the lane head burning its budget, one poll at a time.
  let polls = 0;
  let laneFreed = false;
  let lastSnapshot = "";
  while (polls < args.maxPolls) {
    polls += 1;
    await sleep(POLL_MS * 3);
    const pending = await queue.listPending();
    const failed = await queue.listFailed();
    const snapshot = `pending=[${pending.map((r: any) => `${r.id}:attempts=${r.attempts}`).join(",")}] failed=[${failed.map((f: any) => `${f.id}:${f.reason}/${f.message}`).join(",")}] dispatched=${dispatched.length}`;
    if (snapshot !== lastSnapshot) {
      log("queue", `poll ${polls}: ${snapshot}`);
      lastSnapshot = snapshot;
    }
    const headFailed = failed.some((f: any) => f.id === "msg-1");
    const nextDispatched = dispatched.includes("msg-2");
    if (headFailed && nextDispatched && !laneFreed) {
      // The next row in the lane has been dispatched. Now the busy session
      // finishes: its queue drains (the blocker runs), which frees the cap so
      // msg-2's next delivery is accepted and adopted.
      laneFreed = true;
      log("gateway", "busy session finished -> scheduleFollowupDrain drains the blocker; session idle");
      scheduleFollowupDrain(SESSION_KEY, agentTurn);
      sessionBusy = false;
    }
    if (laneFreed && pending.length === 0 && (await queue.listClaims()).length === 0) {
      break;
    }
    // Control trees never dead-letter; stop once the head is well past the ceiling.
    const head = pending.find((r: any) => r.id === "msg-1");
    if (head && head.attempts >= RETRY_POLICY.maxAttempts * 2) {
      log("queue", `head msg-1 at attempts=${head.attempts} (> maxAttempts=${RETRY_POLICY.maxAttempts}); stopping observation`);
      break;
    }
  }
  await monitor.stop();
  dumpRows("end of scenario B");
  const pending = await queue.listPending();
  const failed = await queue.listFailed();
  log("result", `dispatched=${JSON.stringify(dispatched)} flushErrors=${flushErrors.length}`);
  const dead = failed.find((f: any) => f.id === "msg-1");
  const verdict = dead
    ? `msg-1 dead-lettered reason=${dead.reason} message=${dead.message} attempts=${dead.attempts}; msg-2 ${dispatched.includes("msg-2") ? "dispatched" : "NOT dispatched"}; msg-2 final=${pending.some((r: any) => r.id === "msg-2") ? "pending" : failed.some((f: any) => f.id === "msg-2") ? "failed" : "completed"}`
    : `msg-1 NEVER dead-lettered (pending attempts=${pending.find((r: any) => r.id === "msg-1")?.attempts}); msg-2 ${dispatched.includes("msg-2") ? "dispatched" : "NOT dispatched (lane blocked)"}`;
  log("verdict", `B: ${verdict}`);
  process.exit(0);
}
