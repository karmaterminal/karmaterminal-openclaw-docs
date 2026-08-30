import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const execFileAsync = promisify(execFile);
const PRODUCT_SHA = "6feda9fd71c7cb4701af63ab54264009ce5f6afb";
const PRODUCT_TREE = "7095698b45352f760e79d17e2d9e2bffcfdd7765";
const ROW_A = "A-GENUINE-ABANDONMENT-CEILING";
const ROW_B = "B-MIXED-FANIN-CANCELLATION";
const CHANNEL_ID = "discord";
const ACCOUNT_ID = "proof-124337";
const openclawRoot = path.resolve(requiredText("OPENCLAW_ROOT"));
const resultsRoot = path.resolve(requiredText("OPENCLAW_PR124337_RESULTS_DIR"));
const docsSha = requiredSha("OPENCLAW_PROOF_DOCS_SHA");
const harnessPath = new URL(import.meta.url);
const processStartedAt = new Date().toISOString();
const originalNow = (() => {
  const now = Date.now.bind(Date);
  return () => now();
})();

const { createChannelIngressDrain } = await importRoot(
  "src/channels/message/ingress-drain.ts",
);
const { createChannelIngressQueue } = await importRoot(
  "src/channels/message/ingress-queue.ts",
);
const {
  DEFAULT_INGRESS_RETRY_MAX_ATTEMPTS,
  DEFAULT_INGRESS_RETRY_MAX_MS,
} = await importRoot("src/channels/message/ingress-retry-policy.ts");
const { closeOpenClawStateDatabaseForTest } = await importRoot(
  "src/state/openclaw-state-db.ts",
);
const { closeOpenClawAgentDatabasesForTest } = await importRoot(
  "src/state/openclaw-agent-db.ts",
);
const { replaceSessionEntrySync } = await importRoot(
  "src/config/sessions/session-accessor.sqlite-entry.ts",
);
const { createDiscordMessageHandler } = await importRoot(
  "extensions/discord/src/monitor/message-handler.ts",
);
const { createDiscordMessageDispatcher } = await importRoot(
  "extensions/discord/src/monitor/message-dispatcher.ts",
);
const { createDiscordIngressMonitor } = await importRoot(
  "extensions/discord/src/monitor/ingress.ts",
);

await mkdir(resultsRoot, { recursive: true });
const harnessSha256 = sha256(await readFile(harnessPath));
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicJwk = publicKey.export({ format: "jwk" });
await writeJson(path.join(resultsRoot, "signing-public-key.json"), {
  schema: "openclaw.pr124337.ed25519-public-key.v1",
  generated_at: processStartedAt,
  public_key_jwk: publicJwk,
  scope: "This ephemeral run key authenticates corpus receipt bytes, not a human identity.",
});

let runSummary;
try {
  const identity = await verifyIdentity();
  const rowA = await runGenuineAbandonment(identity);
  const rowB = await runMixedCancellation(identity, rowA);
  runSummary = signedEnvelope({
    schema: "openclaw.pr124337.exact-transport-run.v1",
    verdict: "PASS",
    issue: "openclaw/openclaw#124337",
    product_sha: PRODUCT_SHA,
    product_tree: PRODUCT_TREE,
    docs_harness_sha: docsSha,
    harness_sha256: harnessSha256,
    process: processIdentity(),
    rows: [
      { row: ROW_A, verdict: rowA.verdict },
      { row: ROW_B, verdict: rowB.verdict },
    ],
    transposed_rows: [],
    prior_corpus_disposition: "inspected-not-transposed",
  });
  await writeJson(path.join(resultsRoot, "run-summary.json"), runSummary);
  await writeJson(path.join(resultsRoot, "execution-identity.json"), identity);
} catch (error) {
  runSummary = signedEnvelope({
    schema: "openclaw.pr124337.exact-transport-run.v1",
    verdict: "FAIL",
    issue: "openclaw/openclaw#124337",
    product_sha: PRODUCT_SHA,
    docs_harness_sha: docsSha,
    harness_sha256: harnessSha256,
    process: processIdentity(),
    diagnostic: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
  await writeJson(path.join(resultsRoot, "FAIL.json"), runSummary);
  throw error;
}

console.log(JSON.stringify({
  event: "pr124337-exact-transport-proof",
  verdict: runSummary.payload.verdict,
  productSha: PRODUCT_SHA,
  docsSha,
  harnessSha256,
}));

async function runGenuineAbandonment(identity) {
  const rowDir = path.join(resultsRoot, ROW_A);
  await mkdir(rowDir, { recursive: true });
  const stateDir = await mkdtemp(path.join(tmpdir(), "openclaw-pr124337-discord-a-"));
  const sessionStore = path.join(stateDir, "proof-session.sqlite");
  const nonce = randomUUID();
  const laneChannel = `proof-a-${nonce}`;
  const sessionKey = `agent:main:discord:channel:${laneChannel}`;
  const sessionId = `session-${nonce}`;
  const headId = `head-${nonce}`;
  const followerId = `follower-${nonce}`;
  const rawHead = rawDiscordMessage(headId, laneChannel, "payload-bearing abandoned head");
  const rawFollower = rawDiscordMessage(followerId, laneChannel, "same-lane follower");
  const transport = [];
  const attemptSequence = [];
  const adopted = [];
  let proofNow = 10_000;
  const originalDateNow = Date.now;
  let handler;

  try {
    Date.now = () => proofNow;
    persistSession({ stateDir, sessionStore, sessionKey, sessionId, now: proofNow });
    const queue = createQueue(stateDir, () => proofNow);
    handler = createDiscordMessageHandler({
      ...discordParams({ debounceMs: 0 }),
      client: {},
      testing: {
        createIngressMonitor: (monitorParams) =>
          createDiscordIngressMonitor({ ...monitorParams, queue }),
        preflightDiscordMessage: async (params) => {
          transport.push({
            event: "discord-preflight",
            message_id: params.data.message?.id,
            channel_id: params.data.channel_id,
            route_session_key: sessionKey,
            at: proofNow,
          });
          return preflightContext(params, sessionKey);
        },
        processDiscordMessage: async (ctx) => {
          const id = ctx.message.id;
          transport.push({
            event: "discord-process",
            message_id: id,
            channel_id: laneChannel,
            at: proofNow,
          });
          if (id === headId) {
            ctx.turnAdoptionLifecycle?.onDeferred();
            await ctx.turnAdoptionLifecycle?.onAbandoned();
            const facts = await projectQueueFacts(queue);
            const head = facts.rows.find((row) => row.event_id === headId);
            assert.ok(head, "abandoned head must remain durably visible");
            attemptSequence.push({
              ordinal: attemptSequence.length + 1,
              status: head.status,
              attempts: head.attempts,
              last_error: head.last_error,
              failed_reason: head.failed_reason,
            });
            return;
          }
          proofNow += 1;
          await ctx.turnAdoptionLifecycle?.onAdopted();
          adopted.push(id);
        },
      },
    });

    await handler(rawHead, {});
    proofNow += 1;
    await handler(rawFollower, {});
    await waitFor(async () => {
      proofNow += DEFAULT_INGRESS_RETRY_MAX_MS + 1_000;
      const failed = await queue.listFailed({ limit: "all" });
      return failed.some((row) => row.id === headId) && adopted.includes(followerId);
    }, { timeoutMs: 30_000, intervalMs: 1_050, label: "Discord abandonment ceiling" });
    await handler.deactivate();
    handler = undefined;

    closeOpenClawStateDatabaseForTest();
    closeOpenClawAgentDatabasesForTest();
    const databasePath = path.join(stateDir, "state", "openclaw.sqlite");
    const beforeRestart = readCanonicalState(databasePath, sessionStore);
    assertGenuineTerminalState({
      state: beforeRestart,
      headId,
      followerId,
      sessionKey,
      sessionId,
      attemptSequence,
    });

    const replayed = [];
    const reopenedQueue = createQueue(stateDir, () => proofNow);
    const replacement = createDiscordMessageHandler({
      ...discordParams({ debounceMs: 0 }),
      client: {},
      testing: {
        createIngressMonitor: (monitorParams) =>
          createDiscordIngressMonitor({ ...monitorParams, queue: reopenedQueue }),
        preflightDiscordMessage: async (params) => preflightContext(params, sessionKey),
        processDiscordMessage: async (ctx) => {
          replayed.push(ctx.message.id);
          await ctx.turnAdoptionLifecycle?.onAdopted();
        },
      },
    });
    await sleep(1_250);
    await replacement.deactivate();
    closeOpenClawStateDatabaseForTest();
    closeOpenClawAgentDatabasesForTest();
    const afterRestart = readCanonicalState(databasePath, sessionStore);
    assert.deepEqual(replayed, [], "terminal rows must not replay after reopen");
    assert.deepEqual(
      afterRestart.ingress_rows,
      beforeRestart.ingress_rows,
      "reopen must preserve ingress terminal facts",
    );
    assert.deepEqual(
      afterRestart.session_rows,
      beforeRestart.session_rows,
      "reopen must preserve session terminal facts",
    );

    const payloadHash = sha256(Buffer.from(stableJson(rawHead)));
    const deadLetter = beforeRestart.ingress_rows.find((row) => row.event_id === headId);
    assert.equal(
      deadLetter?.raw_message_sha256,
      payloadHash,
      "dead-letter payload must hash to the admitted Discord message",
    );
    const follower = beforeRestart.ingress_rows.find((row) => row.event_id === followerId);
    const receipt = signedEnvelope({
      schema: "openclaw.pr124337.transport-row.v1",
      row: ROW_A,
      verdict: "PASS",
      invariant:
        "Discord MESSAGE_CREATE genuine abandonment is bounded by the shared drain and cannot poison its FIFO lane.",
      composition_boundary:
        "createDiscordMessageHandler -> createDiscordIngressMonitor -> createChannelIngressDrain -> Discord dispatcher Plugin SDK lifecycle -> reply-lane onAbandoned",
      identity,
      process: processIdentity(),
      route: {
        channel: CHANNEL_ID,
        account_id: ACCOUNT_ID,
        discord_channel_id: laneChannel,
        lane_key: `channel:${laneChannel}`,
        session_key: sessionKey,
        socket: "N/A (process-local Discord gateway-message fixture; no listener opened)",
      },
      payload: { sha256: payloadHash, retained_in_dead_letter: true },
      retry: {
        configured_max_attempts: DEFAULT_INGRESS_RETRY_MAX_ATTEMPTS,
        observed_sequence: attemptSequence,
      },
      dead_letter: deadLetter,
      follower,
      ordering: {
        predicate: "head.received_at < follower.received_at && head.failed_at < follower.completed_at",
        head_received_at: deadLetter.received_at,
        follower_received_at: follower.received_at,
        head_failed_at: deadLetter.failed_at,
        follower_completed_at: follower.completed_at,
        strict: true,
      },
      restart: {
        reopened: true,
        replayed_ids: replayed,
        terminal_state_equal: true,
        ingress_database_sha256_before: beforeRestart.ingress_database_sha256,
        ingress_database_sha256_after: afterRestart.ingress_database_sha256,
        note: "SQLite file bytes may change when reopen checkpoints WAL; canonical rows are the persistence invariant.",
      },
      session: beforeRestart.session_rows[0],
      cleanup: { state_dir_removed_after_projection: true },
    });
    await writeJson(path.join(rowDir, "receipt.json"), receipt);
    await writeJson(path.join(rowDir, "durable-state.json"), beforeRestart);
    await writeJson(path.join(rowDir, "restart-state.json"), afterRestart);
    await writeJson(path.join(rowDir, "transport.json"), transport);
    await writeJson(path.join(rowDir, "payload-projection.json"), {
      message_id_role: "head",
      channel_id: laneChannel,
      payload_sha256: payloadHash,
      content_redacted: true,
    });
    await rm(stateDir, { recursive: true });
    assert.equal(await pathExists(stateDir), false, "row A state directory cleanup failed");
    return { verdict: "PASS", receipt };
  } finally {
    Date.now = originalDateNow;
    if (handler) {
      await handler.deactivate().catch(() => {});
    }
    closeOpenClawStateDatabaseForTest();
    closeOpenClawAgentDatabasesForTest();
    await rm(stateDir, { recursive: true, force: true });
  }
}

async function runMixedCancellation(identity, genuineControl) {
  const rowDir = path.join(resultsRoot, ROW_B);
  await mkdir(rowDir, { recursive: true });
  const stateDir = await mkdtemp(path.join(tmpdir(), "openclaw-pr124337-discord-b-"));
  const sessionStore = path.join(stateDir, "proof-session.sqlite");
  const nonce = randomUUID();
  const sessionKey = `agent:main:discord:channel:proof-b-${nonce}`;
  const sessionId = `session-${nonce}`;
  let clock = 50_000;
  const transport = [];
  let mixedDispatcher;
  let modernDispatcher;

  try {
    persistSession({ stateDir, sessionStore, sessionKey, sessionId, now: clock });
    const mixedQueue = createQueue(stateDir, () => clock, "mixed");
    await mixedQueue.enqueue(
      `modern-${nonce}`,
      { proof: "modern-cancellation" },
      { laneKey: `modern-lane-${nonce}`, receivedAt: 1 },
    );
    await mixedQueue.enqueue(
      `legacy-${nonce}`,
      { proof: "legacy-fallback-cancellation" },
      { laneKey: `legacy-lane-${nonce}`, receivedAt: 2 },
    );

    let releasePreflight;
    const preflightGate = new Promise((resolve) => {
      releasePreflight = resolve;
    });
    let combinedPreflight = false;
    mixedDispatcher = createDiscordMessageDispatcher({
      ...discordParams({ debounceMs: 25 }),
      testing: {
        preflightDiscordMessage: async (params) => {
          combinedPreflight = true;
          transport.push({
            event: "discord-mixed-preflight",
            combined_content_lines: String(params.data.message?.content ?? "").split("\n").length,
            channel_id: params.data.channel_id,
          });
          await preflightGate;
          return preflightContext(params, sessionKey);
        },
        processDiscordMessage: async () => {
          throw new Error("mixed cancellation must stop before processing");
        },
      },
    });
    const mixedDrain = createChannelIngressDrain({
      queue: mixedQueue,
      now: () => clock,
      retryPolicy: { maxAttempts: 3, deadLetterMinAgeMs: 0, baseMs: 0, maxMs: 0 },
      dispatchClaimedEvent: async (event, lifecycle) => {
        lifecycle.onDeferred();
        const routedLifecycle = event.id.startsWith("legacy-")
          ? asLegacyLifecycle(lifecycle)
          : lifecycle;
        await mixedDispatcher(
          dispatcherMessage(event.id, `proof-b-${nonce}`, "proof-author"),
          {},
          { turnAdoptionLifecycle: routedLifecycle },
        );
        return { kind: "deferred" };
      },
    });
    await mixedDrain.drainOnce();
    await waitFor(() => combinedPreflight, {
      timeoutMs: 5_000,
      intervalMs: 10,
      label: "combined Discord debounce preflight",
    });
    const deactivateMixed = mixedDispatcher.deactivate();
    await sleep(10);
    releasePreflight();
    await deactivateMixed;
    mixedDispatcher = undefined;
    await mixedDrain.waitForIdle();
    mixedDrain.dispose();

    const mixedFacts = await projectQueueFacts(mixedQueue);
    assert.deepEqual(
      mixedFacts.rows.map(({ status, attempts, failed_reason }) => ({
        status,
        attempts,
        failed_reason,
      })),
      [
        { status: "pending", attempts: 0, failed_reason: null },
        { status: "pending", attempts: 0, failed_reason: null },
      ],
    );

    const modernQueue = createQueue(stateDir, () => clock, "modern");
    const modernId = `explicit-modern-${nonce}`;
    await modernQueue.enqueue(
      modernId,
      { proof: "explicit-modern-cancellation" },
      { laneKey: `explicit-lane-${nonce}`, receivedAt: 3 },
    );
    modernDispatcher = createDiscordMessageDispatcher({
      ...discordParams({ debounceMs: 60_000 }),
      testing: {
        preflightDiscordMessage: async () => {
          throw new Error("explicit cancellation must stop before preflight");
        },
      },
    });
    const modernDrain = createChannelIngressDrain({
      queue: modernQueue,
      now: () => clock,
      retryPolicy: { maxAttempts: 2, deadLetterMinAgeMs: 0, baseMs: 0, maxMs: 0 },
      dispatchClaimedEvent: async (event, lifecycle) => {
        lifecycle.onDeferred();
        await modernDispatcher(
          dispatcherMessage(event.id, `proof-modern-${nonce}`, "proof-author"),
          {},
          { turnAdoptionLifecycle: lifecycle },
        );
        return { kind: "deferred" };
      },
    });
    await modernDrain.drainOnce();
    await waitFor(async () => (await modernQueue.listClaims()).length === 1, {
      timeoutMs: 5_000,
      intervalMs: 10,
      label: "explicit modern Discord claim",
    });
    await modernDispatcher.deactivate();
    modernDispatcher = undefined;
    await modernDrain.waitForIdle();
    modernDrain.dispose();
    const modernFacts = await projectQueueFacts(modernQueue);
    assert.equal(modernFacts.rows[0]?.status, "pending");
    assert.equal(modernFacts.rows[0]?.attempts, 0);
    assert.equal(modernFacts.rows[0]?.failed_reason, null);

    closeOpenClawStateDatabaseForTest();
    closeOpenClawAgentDatabasesForTest();
    const databasePath = path.join(stateDir, "state", "openclaw.sqlite");
    const durable = readCanonicalState(databasePath, sessionStore);
    assert.equal(durable.session_rows[0]?.session_key, sessionKey);
    assert.equal(durable.ingress_rows.filter((row) => row.status === "failed").length, 0);
    assert.equal(
      durable.ingress_rows.filter((row) => row.payload_sha256 === null).length,
      0,
      "all cancelled payloads must remain durably hashable",
    );

    const receipt = signedEnvelope({
      schema: "openclaw.pr124337.transport-row.v1",
      row: ROW_B,
      verdict: "PASS",
      invariant:
        "Discord mixed legacy/current and explicit current cancellation release claims without recording attempts.",
      composition_boundary:
        "createDiscordMessageDispatcher debounce fan-in -> fanInChannelIngressLifecycles.cancel -> current onCancelled + legacy runIngressCancelCompat(onAbandoned)",
      identity,
      process: processIdentity(),
      route: {
        channel: CHANNEL_ID,
        account_id: ACCOUNT_ID,
        session_key: sessionKey,
        socket: "N/A (process-local Discord dispatcher fixture; no listener opened)",
      },
      mixed_fanin: {
        combined_transport_observed: combinedPreflight,
        capable_attempts: 0,
        legacy_fallback_attempts: 0,
        dead_letters: 0,
        durable_rows: durable.ingress_rows.filter(
          (row) => row.account_id === `${ACCOUNT_ID}-mixed`,
        ),
      },
      explicit_modern: {
        attempts: modernFacts.rows[0]?.attempts,
        dead_letters: modernFacts.rows.filter((row) => row.status === "failed").length,
        durable_row: durable.ingress_rows.find((row) => row.event_id === modernId),
      },
      genuine_abandonment_sibling_control: {
        row: ROW_A,
        verdict: genuineControl.verdict,
        receipt: `../${ROW_A}/receipt.json`,
      },
      session: durable.session_rows[0],
      cleanup: { state_dir_removed_after_projection: true },
    });
    await writeJson(path.join(rowDir, "receipt.json"), receipt);
    await writeJson(path.join(rowDir, "durable-state.json"), durable);
    await writeJson(path.join(rowDir, "transport.json"), transport);
    await rm(stateDir, { recursive: true });
    assert.equal(await pathExists(stateDir), false, "row B state directory cleanup failed");
    return { verdict: "PASS", receipt };
  } finally {
    if (mixedDispatcher) {
      await mixedDispatcher.deactivate().catch(() => {});
    }
    if (modernDispatcher) {
      await modernDispatcher.deactivate().catch(() => {});
    }
    closeOpenClawStateDatabaseForTest();
    closeOpenClawAgentDatabasesForTest();
    await rm(stateDir, { recursive: true, force: true });
  }
}

function discordParams({ debounceMs }) {
  const cfg = {
    channels: {
      discord: { enabled: true, token: "synthetic-proof-token", groupPolicy: "allowlist" },
    },
    messages: { inbound: { debounceMs } },
  };
  return {
    cfg,
    discordConfig: cfg.channels.discord,
    accountId: ACCOUNT_ID,
    token: "synthetic-proof-token",
    runtime: {
      log: (message) => void message,
      error: (message) => void message,
      exit: (code) => {
        throw new Error(`unexpected runtime exit ${code}`);
      },
    },
    botUserId: "proof-bot",
    guildHistories: new Map(),
    historyLimit: 0,
    mediaMaxBytes: 10_000,
    textLimit: 2_000,
    replyToMode: "off",
    dmEnabled: true,
    dmPolicy: "pairing",
    groupDmEnabled: false,
    threadBindings: {},
  };
}

function preflightContext(params, sessionKey) {
  return {
    ...params,
    message: params.data.message,
    route: { sessionKey },
    baseSessionKey: sessionKey,
    messageChannelId: params.data.channel_id,
    messageText: params.data.message?.content ?? "",
    isDirectMessage: false,
    isGroupDm: false,
    isGuildMessage: true,
    inboundEventKind: "message",
    effectiveWasMentioned: false,
    threadChannel: null,
  };
}

function rawDiscordMessage(id, channelId, content) {
  return {
    id,
    channel_id: channelId,
    content,
    author: {
      id: "proof-author",
      username: "proof-user",
      discriminator: "0",
      avatar: null,
      bot: false,
    },
    attachments: [],
    embeds: [],
    mentions: [],
    mention_roles: [],
    mention_everyone: false,
    timestamp: "2026-08-30T12:00:00.000Z",
    edited_timestamp: null,
    components: [],
    pinned: false,
    type: 0,
    tts: false,
  };
}

function dispatcherMessage(id, channelId, authorId) {
  const raw = rawDiscordMessage(id, channelId, "cancellation proof");
  return {
    channel_id: channelId,
    author: { id: authorId },
    message: raw,
  };
}

function asLegacyLifecycle(lifecycle) {
  return {
    abortSignal: lifecycle.abortSignal,
    onAdopted: lifecycle.onAdopted,
    onDeferred: lifecycle.onDeferred,
    onDeferredHeartbeat: lifecycle.onDeferredHeartbeat,
    onAdoptionFinalizing: lifecycle.onAdoptionFinalizing,
    onFailed: lifecycle.onFailed,
    onAbandoned: lifecycle.onAbandoned,
  };
}

function createQueue(stateDir, now, suffix = "primary") {
  return createChannelIngressQueue({
    channelId: CHANNEL_ID,
    accountId: `${ACCOUNT_ID}-${suffix}`,
    stateDir,
    now,
  });
}

function persistSession({ stateDir, sessionStore, sessionKey, sessionId, now }) {
  replaceSessionEntrySync(
    {
      agentId: "main",
      env: { ...process.env, OPENCLAW_STATE_DIR: stateDir },
      sessionKey,
      storePath: sessionStore,
    },
    {
      sessionId,
      updatedAt: now,
      createdAt: now,
      createdVia: "channel",
      createdActor: { type: "human", source: "channel", id: "proof-author" },
      lastChannel: CHANNEL_ID,
    },
  );
}

async function projectQueueFacts(queue) {
  const rows = [
    ...(await queue.listPending({ limit: "all" })),
    ...(await queue.listClaims()),
    ...(await queue.listFailed({ limit: "all" })),
  ];
  return {
    rows: rows
      .map((row) => ({
        event_id: row.id,
        status: "claim" in row ? "claimed" : "reason" in row ? "failed" : "pending",
        attempts: row.attempts,
        last_error: row.lastError ?? row.message ?? null,
        failed_reason: row.reason ?? null,
      }))
      .sort((left, right) => left.event_id.localeCompare(right.event_id)),
  };
}

function readCanonicalState(databasePath, sessionStore) {
  const stateDb = new DatabaseSync(databasePath, { readOnly: true });
  const sessionDb = new DatabaseSync(sessionStore, { readOnly: true });
  try {
    const ingressRows = stateDb
      .prepare(
        `SELECT event_id, channel_id, account_id, status, lane_key, attempts,
                last_attempt_at, last_error, failed_reason, received_at,
                completed_at, failed_at, claim_owner, claimed_at, payload_json,
                CASE WHEN payload_json = 'null' THEN 0 ELSE 1 END AS payload_retained
           FROM channel_ingress_events
          WHERE channel_id = ?
          ORDER BY account_id, received_at, event_id`,
      )
      .all(CHANNEL_ID)
      .map((row) => {
        const { payload_json: payloadJson, ...projected } = row;
        if (payloadJson === "null") {
          return {
            ...projected,
            payload_sha256: null,
            raw_message_sha256: null,
          };
        }
        const payload = JSON.parse(payloadJson);
        return {
          ...projected,
          payload_sha256: sha256(Buffer.from(stableJson(payload))),
          raw_message_sha256:
            payload && typeof payload === "object" && payload.rawMessage
              ? sha256(Buffer.from(stableJson(payload.rawMessage)))
              : null,
        };
      });
    return {
      ingress_database_sha256: sha256(readFileSync(databasePath)),
      session_database_sha256: sha256(readFileSync(sessionStore)),
      ingress_rows: ingressRows,
      session_rows: sessionDb
        .prepare(
          `SELECT session_key, current_session_id AS session_id, status,
                  created_via, created_actor_type, created_actor_id, updated_at
             FROM session_nodes
            ORDER BY session_key`,
        )
        .all(),
    };
  } finally {
    stateDb.close();
    sessionDb.close();
  }
}

function assertGenuineTerminalState({
  state,
  headId,
  followerId,
  sessionKey,
  sessionId,
  attemptSequence,
}) {
  assert.equal(attemptSequence.length, DEFAULT_INGRESS_RETRY_MAX_ATTEMPTS);
  assert.deepEqual(
    attemptSequence.map((fact) => fact.attempts),
    [...Array(DEFAULT_INGRESS_RETRY_MAX_ATTEMPTS - 1).keys()].map((value) => value + 1).concat(
      DEFAULT_INGRESS_RETRY_MAX_ATTEMPTS - 1,
    ),
  );
  const head = state.ingress_rows.find((row) => row.event_id === headId);
  const follower = state.ingress_rows.find((row) => row.event_id === followerId);
  const failedRows = state.ingress_rows.filter((row) => row.status === "failed");
  assert.equal(head?.status, "failed");
  assert.equal(head?.failed_reason, "retry-limit-exceeded");
  assert.equal(head?.last_error, "turn-abandoned");
  assert.equal(head?.payload_retained, 1);
  assert.deepEqual(
    failedRows.map((row) => row.event_id),
    [headId],
    "poison head must be dead-lettered exactly once",
  );
  assert.equal(follower?.status, "completed");
  assert.ok(
    head?.received_at < follower?.received_at,
    "poison head must be admitted before its same-lane follower",
  );
  assert.ok(
    head?.failed_at < follower?.completed_at,
    "same-lane follower must complete strictly after the failed head terminalizes",
  );
  assert.equal(follower?.claim_owner, null);
  assert.equal(state.session_rows[0]?.session_key, sessionKey);
  assert.equal(state.session_rows[0]?.session_id, sessionId);
}

async function verifyIdentity() {
  const checkoutSha = (await git("rev-parse", "HEAD")).trim();
  const tree = (await git("rev-parse", "HEAD^{tree}")).trim();
  assert.equal(checkoutSha, PRODUCT_SHA, "exact product checkout mismatch");
  assert.equal(tree, PRODUCT_TREE, "exact product tree mismatch");
  return {
    checked_at: new Date().toISOString(),
    product_sha: checkoutSha,
    product_tree: tree,
    docs_harness_sha: docsSha,
    harness_sha256: harnessSha256,
    openclaw_root: openclawRoot,
    match: true,
  };
}

function processIdentity() {
  return {
    pid: process.pid,
    started_at: processStartedAt,
    executable: process.execPath,
    node: process.version,
    architecture: process.arch,
  };
}

function signedEnvelope(payload) {
  const bytes = Buffer.from(stableJson(payload));
  return {
    payload,
    signature: {
      algorithm: "Ed25519",
      payload_sha256: sha256(bytes),
      value_base64: sign(null, bytes, privateKey).toString("base64"),
      public_key_path: "signing-public-key.json",
    },
  };
}

async function waitFor(predicate, { timeoutMs, intervalMs, label }) {
  const deadline = originalNow() + timeoutMs;
  let lastError;
  while (originalNow() < deadline) {
    try {
      if (await predicate()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }
  throw new Error(`${label} timed out${lastError ? `: ${String(lastError)}` : ""}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function git(...args) {
  const { stdout } = await execFileAsync("git", ["-C", openclawRoot, ...args]);
  return stdout;
}

async function importRoot(relativePath) {
  return await import(pathToFileURL(path.join(openclawRoot, relativePath)).href);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function pathExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if (error?.code === "EISDIR") {
      return true;
    }
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
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
