import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const execFileAsync = promisify(execFile);
const sourceSha = requiredSha("OPENCLAW_PROOF_SOURCE_SHA");
const compositeSha = requiredSha("OPENCLAW_EXPECTED_COMPOSITE_SHA");
const docsSha = requiredSha("OPENCLAW_PROOF_DOCS_SHA");
const candidateSha = requiredSha("OPENCLAW_DRIFT_CURE_CANDIDATE_SHA");
const seat = requiredText("OPENCLAW_PROOF_SEAT");
const openclawRoot = path.resolve(requiredText("OPENCLAW_ROOT"));
const resultsRoot = path.resolve(requiredText("OPENCLAW_PR124337_RESULTS_DIR"));
const maxAttempts = 3;

const { createChannelIngressDrain } = await importRoot(
  "src/channels/message/ingress-drain.ts",
);
const { createChannelIngressQueue } = await importRoot(
  "src/channels/message/ingress-queue.ts",
);
const { closeOpenClawStateDatabaseForTest } = await importRoot(
  "src/state/openclaw-state-db.ts",
);
const { fanInChannelIngressLifecycles } = await importRoot(
  "src/plugin-sdk/channel-ingress-runtime.ts",
);

await mkdir(resultsRoot, { recursive: true });
const runStartedAt = new Date().toISOString();
const summaries = [];
summaries.push(await runGenuineAbandonment());
summaries.push(await runBudgetFreeCancellation());
summaries.push(await runMixedFanInSeparation());
const runEndedAt = new Date().toISOString();

await writeJson(path.join(resultsRoot, "run-summary.json"), {
  schema: "openclaw.pr124337.proof-run.v1",
  proof_source_sha: sourceSha,
  execution_composite_sha: compositeSha,
  drift_cure_candidate_sha: candidateSha,
  docs_sha: docsSha,
  seat,
  time_window: { started_at: runStartedAt, ended_at: runEndedAt },
  rows: summaries,
  verdict: summaries.every((row) => row.verdict === "PASS-candidate")
    ? "PASS-candidate"
    : "FAIL-candidate",
});

console.log(
  JSON.stringify({
    event: "pr124337-proof-complete",
    sourceSha,
    compositeSha,
    docsSha,
    seat,
    rows: summaries.map(({ row, verdict, nonce }) => ({ row, verdict, nonce })),
  }),
);

async function runGenuineAbandonment() {
  const row = "A-GENUINE-ABANDONMENT";
  const identity = await verifyRuntimeIdentity(row);
  return await withState(row, identity, async ({ queue, nonce, journal, clock }) => {
    const headId = `${nonce}-head`;
    const followerId = `${nonce}-follower`;
    const laneKey = `${nonce}-lane`;
    await queue.enqueue(
      headId,
      { proof: "synthetic-abandonment-head" },
      { laneKey, receivedAt: 1 },
    );
    await queue.enqueue(
      followerId,
      { proof: "synthetic-abandonment-follower" },
      { laneKey, receivedAt: 2 },
    );

    const abandonedAttempts = [];
    const adoptedIds = [];
    const drain = createChannelIngressDrain({
      queue,
      now: clock.now,
      retryPolicy: { maxAttempts, deadLetterMinAgeMs: 0, baseMs: 0, maxMs: 0 },
      onLog: journal.log,
      dispatchClaimedEvent: async (event, lifecycle) => {
        if (event.id === headId) {
          lifecycle.onDeferred();
          abandonedAttempts.push(event.attempts);
          journal.log(`genuine-abandon id=head attempts=${event.attempts}`);
          await lifecycle.onAbandoned();
          return { kind: "deferred" };
        }
        await lifecycle.onAdopted();
        adoptedIds.push(event.id);
        journal.log("follower-adopted");
        return { kind: "completed" };
      },
    });

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await drain.drainOnce();
      await drain.waitForIdle();
      clock.advance();
    }

    const failed = await queue.listFailed({ limit: "all" });
    assert.equal(failed.length, 1);
    assert.equal(failed[0].id, headId);
    assert.equal(failed[0].reason, "retry-limit-exceeded");
    assert.equal(failed[0].message, "turn-abandoned");
    assert.equal(failed[0].attempts, maxAttempts - 1);
    assert.ok(failed[0].payload);
    assert.deepEqual(abandonedAttempts, [0, 1, 2]);
    assert.deepEqual(await queue.listClaims(), []);

    await drain.drainOnce();
    await drain.waitForIdle();
    assert.deepEqual(adoptedIds, [followerId]);
    assert.deepEqual(await queue.listPending({ limit: "all" }), []);
    drain.dispose();

    return {
      verdict: "PASS-candidate",
      cancel_compat_expected: false,
      observations: {
        max_attempts: maxAttempts,
        abandoned_attempts: abandonedAttempts,
        failed: failed.map(projectFailed),
        adopted_ids: ["follower"],
        pending_ids: [],
        claimed_ids: [],
      },
    };
  });
}

async function runBudgetFreeCancellation() {
  const row = "B-BUDGET-FREE-CANCELLATION";
  const identity = await verifyRuntimeIdentity(row);
  return await withState(row, identity, async ({ queue, nonce, journal, clock }) => {
    const eventId = `${nonce}-cancel`;
    await queue.enqueue(
      eventId,
      { proof: "synthetic-cancellation" },
      { laneKey: `${nonce}-lane`, receivedAt: 1 },
    );
    const seed = await queue.claim(eventId, { ownerId: "proof-seed" });
    assert.ok(seed);
    await queue.release(seed, {
      lastError: "prior-proof-failure",
      releasedAt: clock.now(),
    });
    const before = (await queue.listPending({ limit: "all" }))[0];
    assert.ok(before);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      clock.advance();
      let lifecycle;
      const drain = createChannelIngressDrain({
        queue,
        now: clock.now,
        retryPolicy: { maxAttempts: 2, deadLetterMinAgeMs: 0, baseMs: 0, maxMs: 0 },
        onLog: journal.log,
        dispatchClaimedEvent: async (_event, captured) => {
          lifecycle = captured;
          captured.onDeferred();
          return { kind: "deferred" };
        },
      });
      await drain.drainOnce();
      await drain.waitForIdle();
      assert.ok(lifecycle?.onCancelled);
      await lifecycle.onCancelled();
      journal.log(`explicit-cancel cycle=${cycle + 1}`);
      drain.dispose();
    }

    const after = (await queue.listPending({ limit: "all" }))[0];
    assert.ok(after);
    assert.equal(after.attempts, before.attempts);
    assert.equal(after.lastAttemptAt, before.lastAttemptAt);
    assert.equal(after.lastError, before.lastError);
    assert.deepEqual(await queue.listClaims(), []);
    assert.deepEqual(await queue.listFailed({ limit: "all" }), []);

    return {
      verdict: "PASS-candidate",
      cancel_compat_expected: false,
      observations: {
        retry_facts_before: projectPending(before),
        retry_facts_after: projectPending(after),
        cancellation_cycles: 3,
        failed_ids: [],
        claimed_ids: [],
      },
    };
  });
}

async function runMixedFanInSeparation() {
  const row = "C-MIXED-FANIN-SEPARATION";
  const identity = await verifyRuntimeIdentity(row);
  return await withState(row, identity, async ({ stateDir, nonce, journal, clock }) => {
    const cancelQueue = createQueue(stateDir, `${nonce}-cancel`, clock.now);
    const capableId = `${nonce}-capable`;
    const legacyId = `${nonce}-legacy`;
    await cancelQueue.enqueue(
      capableId,
      { proof: "synthetic-capable-cancel" },
      { laneKey: `${nonce}-capable-lane`, receivedAt: 1 },
    );
    await cancelQueue.enqueue(
      legacyId,
      { proof: "synthetic-legacy-cancel" },
      { laneKey: `${nonce}-legacy-lane`, receivedAt: 1 },
    );

    for (let cycle = 0; cycle < maxAttempts; cycle += 1) {
      const captured = new Map();
      const drain = createChannelIngressDrain({
        queue: cancelQueue,
        now: clock.now,
        retryPolicy: { maxAttempts, deadLetterMinAgeMs: 0, baseMs: 0, maxMs: 0 },
        onLog: journal.log,
        dispatchClaimedEvent: async (event, lifecycle) => {
          captured.set(event.id, lifecycle);
          lifecycle.onDeferred();
          return { kind: "deferred" };
        },
      });
      await drain.drainOnce();
      await drain.waitForIdle();
      const capable = captured.get(capableId);
      const legacy = captured.get(legacyId);
      assert.ok(capable);
      assert.ok(legacy);
      await fanInChannelIngressLifecycles([capable, asLegacyLifecycle(legacy)]).cancel();
      journal.log(`mixed-fanin-cancel cycle=${cycle + 1}`);
      drain.dispose();
      clock.advance();
    }

    const cancelledRows = await cancelQueue.listPending({ limit: "all" });
    assert.deepEqual(
      cancelledRows.map((event) => ({ id: event.id, attempts: event.attempts })),
      [
        { id: capableId, attempts: 0 },
        { id: legacyId, attempts: 0 },
      ],
    );
    assert.deepEqual(await cancelQueue.listFailed({ limit: "all" }), []);

    const abandonQueue = createQueue(stateDir, `${nonce}-abandon`, clock.now);
    const poisonId = `${nonce}-poison`;
    const followerId = `${nonce}-follower`;
    const laneKey = `${nonce}-abandon-lane`;
    await abandonQueue.enqueue(
      poisonId,
      { proof: "synthetic-genuine-abandonment" },
      { laneKey, receivedAt: 10 },
    );
    await abandonQueue.enqueue(
      followerId,
      { proof: "synthetic-follower" },
      { laneKey, receivedAt: 11 },
    );
    const adoptedIds = [];
    const abandonDrain = createChannelIngressDrain({
      queue: abandonQueue,
      now: clock.now,
      retryPolicy: { maxAttempts, deadLetterMinAgeMs: 0, baseMs: 0, maxMs: 0 },
      onLog: journal.log,
      dispatchClaimedEvent: async (event, lifecycle) => {
        if (event.id === poisonId) {
          lifecycle.onDeferred();
          await lifecycle.onAbandoned();
          return { kind: "deferred" };
        }
        await lifecycle.onAdopted();
        adoptedIds.push(event.id);
        return { kind: "completed" };
      },
    });
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await abandonDrain.drainOnce();
      await abandonDrain.waitForIdle();
      clock.advance();
    }
    const failed = await abandonQueue.listFailed({ limit: "all" });
    assert.equal(failed.length, 1);
    assert.equal(failed[0].reason, "retry-limit-exceeded");
    assert.equal(failed[0].message, "turn-abandoned");
    await abandonDrain.drainOnce();
    await abandonDrain.waitForIdle();
    assert.deepEqual(adoptedIds, [followerId]);
    abandonDrain.dispose();

    return {
      verdict: "PASS-candidate",
      cancel_compat_expected: {
        capable: false,
        legacy_fallback: true,
        genuine_abandonment: false,
      },
      observations: {
        cancelled_rows: cancelledRows.map(projectPending),
        cancelled_failed_ids: [],
        genuine_abandonment: failed.map(projectFailed),
        adopted_ids: ["follower"],
      },
    };
  });
}

async function withState(row, identity, run) {
  const nonce = randomUUID();
  const startedAt = new Date().toISOString();
  const stateDir = await mkdtemp(path.join(tmpdir(), "openclaw-pr124337-proof-"));
  const rowDir = path.join(resultsRoot, row);
  const journal = createJournal();
  const clock = createClock();
  await mkdir(rowDir, { recursive: true });
  let outcome;
  try {
    const queue = createQueue(stateDir, nonce, clock.now);
    outcome = await run({ stateDir, queue, nonce, journal, clock });
  } finally {
    closeOpenClawStateDatabaseForTest();
  }

  const databasePath = path.join(stateDir, "state", "openclaw.sqlite");
  const databaseBytes = await readFile(databasePath);
  const databaseSha256 = createHash("sha256").update(databaseBytes).digest("hex");
  const durableRows = readDurableRows(databasePath).map(redactDurableRow);
  const endedAt = new Date().toISOString();
  const receipt = {
    schema: "openclaw.pr124337.row-receipt.v1",
    row,
    verdict: outcome.verdict,
    proof_source_sha: sourceSha,
    execution_composite_sha: compositeSha,
    drift_cure_candidate_sha: candidateSha,
    docs_sha: docsSha,
    seat,
    nonce,
    time_window: { started_at: startedAt, ended_at: endedAt },
    identity,
    cancel_compat_expected: outcome.cancel_compat_expected,
    observations: outcome.observations,
    durable_database: {
      format: "SQLite",
      sha256: databaseSha256,
      projected_rows_path: `${row}/durable-state.json`,
      projected_row_count: durableRows.length,
    },
  };
  await writeJson(path.join(rowDir, "receipt.json"), receipt);
  await writeJson(path.join(rowDir, "identity.json"), identity);
  await writeJson(path.join(rowDir, "durable-state.json"), {
    schema: "openclaw.pr124337.durable-state.v1",
    row,
    database_sha256: databaseSha256,
    rows: durableRows,
  });
  await writeFile(path.join(rowDir, "journal.log"), `${journal.lines.join("\n")}\n`);
  await rm(stateDir, { recursive: true, force: true });
  console.log(JSON.stringify({ event: "pr124337-row", row, verdict: outcome.verdict, nonce }));
  return { row, verdict: outcome.verdict, nonce };
}

async function verifyRuntimeIdentity(row) {
  const startedAt = new Date().toISOString();
  const { stdout } = await execFileAsync("git", ["-C", openclawRoot, "rev-parse", "HEAD"]);
  const checkoutSha = stdout.trim();
  const buildInfo = JSON.parse(
    await readFile(path.join(openclawRoot, "dist", "build-info.json"), "utf8"),
  );
  assert.equal(checkoutSha, compositeSha, `${row}: installed checkout mismatch`);
  assert.equal(buildInfo.commit, compositeSha, `${row}: build-info mismatch`);
  return {
    checked_at: startedAt,
    row,
    seat,
    checkout_sha: checkoutSha,
    build_info_commit: buildInfo.commit,
    build_info_version: buildInfo.version,
    expected_composite_sha: compositeSha,
    match: true,
  };
}

function createQueue(stateDir, accountId, now) {
  return createChannelIngressQueue({
    channelId: "proof-124337",
    accountId,
    stateDir,
    now,
  });
}

function createClock() {
  let value = 10_000;
  return {
    now: () => value,
    advance: () => {
      value += 1;
    },
  };
}

function createJournal() {
  const lines = [];
  return {
    lines,
    log(message) {
      if (lines.length < 100) {
        lines.push(`${new Date().toISOString()} ${String(message)}`);
      }
    },
  };
}

function readDurableRows(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return database
      .prepare(
        `SELECT
           event_id AS id,
           status,
           lane_key AS laneKey,
           attempts,
           last_attempt_at AS lastAttemptAt,
           last_error AS lastError,
           failed_reason AS failReason,
           received_at AS receivedAt,
           updated_at AS updatedAt,
           claimed_at AS claimedAt,
           CASE WHEN payload_json = 'null' THEN 0 ELSE 1 END AS payloadRetained
         FROM channel_ingress_events
         WHERE channel_id = 'proof-124337'
         ORDER BY queue_name, received_at, event_id`,
      )
      .all();
  } finally {
    database.close();
  }
}

function redactDurableRow(row) {
  const role = String(row.id).split("-").at(-1);
  return {
    id_role: role,
    status: row.status,
    lane_role: row.laneKey ? String(row.laneKey).split("-").at(-1) : null,
    attempts: row.attempts,
    last_attempt_at: row.lastAttemptAt,
    last_error: row.lastError,
    fail_reason: row.failReason,
    received_at: row.receivedAt,
    updated_at: row.updatedAt,
    claimed_at: row.claimedAt,
    payload_retained: row.payloadRetained === 1,
  };
}

function projectPending(record) {
  return {
    id_role: String(record.id).split("-").at(-1),
    attempts: record.attempts,
    last_attempt_at: record.lastAttemptAt,
    last_error: record.lastError,
  };
}

function projectFailed(record) {
  return {
    id_role: String(record.id).split("-").at(-1),
    attempts: record.attempts,
    reason: record.reason,
    message: record.message,
    payload_retained: record.payload !== undefined,
  };
}

function asLegacyLifecycle(lifecycle) {
  return {
    abortSignal: lifecycle.abortSignal,
    onAdopted: lifecycle.onAdopted,
    onDeferred: lifecycle.onDeferred,
    onAdoptionFinalizing: lifecycle.onAdoptionFinalizing,
    onAbandoned: lifecycle.onAbandoned,
  };
}

async function importRoot(relativePath) {
  return await import(pathToFileURL(path.join(openclawRoot, relativePath)).href);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function requiredText(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function requiredSha(name) {
  const value = requiredText(name);
  if (!/^[0-9a-f]{40}$/.test(value)) {
    throw new Error(`${name} must be a 40-character lowercase SHA`);
  }
  return value;
}
