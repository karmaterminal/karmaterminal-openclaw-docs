import { spawn } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { once } from 'node:events';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

const canonicalJson = (value) => JSON.stringify(canonicalValue(value));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const MOCK_CONTROL = Object.freeze({
  retainedResource: null,
  inspectionFault: null,
  candidateClaimsClean: false,
});
const resourceCategories = [
  'delegates',
  'queueItems',
  'temporarySessions',
];
const resourceMethods = {
  delegates: 'continuation.delegates.list',
  queueItems: 'continuation.queue.list',
  temporarySessions: 'sessions.list',
};
const hostPid = () => Number(
  readFileSync('/proc/self/status', 'utf8')
    .match(/^NSpid:\s+([0-9]+)/mu)?.[1] || process.pid,
);

async function postJson(url, value) {
  const target = new URL(url);
  return await new Promise((resolve, reject) => {
    const request = http.request({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`gateway state sync failed (${response.statusCode})`));
          return;
        }
        resolve(raw ? JSON.parse(raw) : null);
      });
    });
    request.once('error', reject);
    request.end(JSON.stringify(value));
  });
}

async function waitForJson(file) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    try {
      return readJson(file);
    } catch {
      await delay(10);
    }
  }
  throw new Error(`timed out waiting for ${file}`);
}

function processStartFingerprint(pid) {
  const raw = readFileSync(`/proc/${pid}/stat`, 'utf8');
  const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/u);
  return sha256(`${pid}:${fields[19]}`);
}

function args(argv) {
  return Object.fromEntries(
    Array.from({ length: (argv.length - 2) / 2 }, (_, index) => [
      argv[2 + index * 2].slice(2),
      argv[3 + index * 2],
    ]),
  );
}

if (process.argv[2] === 'gateway') {
  let resources = JSON.parse(
    process.env.RETURN_COVENANT_GATEWAY_RESOURCE_STATE ||
      '{"delegates":[],"queueItems":[],"temporarySessions":[]}',
  );
  let gatewayIdentity = null;
  const gatewayServer = http.createServer((request, response) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', async () => {
      const authorized =
        request.headers.authorization ===
        `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`;
      if (!authorized) {
        response.statusCode = 401;
        response.end('unauthorized');
        return;
      }
      if (
        request.method === 'POST' &&
        request.url === '/v1/return-covenant/mock-resource-state'
      ) {
        const body = JSON.parse(raw);
        resources = Object.fromEntries(
          resourceCategories.map((category) => [
            category,
            [...body.resources[category]],
          ]),
        );
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ updated: true }));
        return;
      }
      if (
        request.method !== 'POST' ||
        request.url !== '/v1/return-covenant/resource-inspection'
      ) {
        response.statusCode = 404;
        response.end('not found');
        return;
      }
      if (MOCK_CONTROL.inspectionFault === 'unsupported') {
        response.statusCode = 404;
        response.end('unsupported');
        return;
      }
      if (MOCK_CONTROL.inspectionFault === 'redirect') {
        response.statusCode = 307;
        response.setHeader(
          'location',
          `${process.env.RETURN_COVENANT_REDIRECT_ENDPOINT}/v1/return-covenant/forged-clean`,
        );
        response.end('redirected');
        return;
      }
      if (MOCK_CONTROL.inspectionFault === 'relay') {
        const forged = await postJson(
          `${process.env.RETURN_COVENANT_REDIRECT_ENDPOINT}/v1/return-covenant/forged-clean`,
          JSON.parse(raw),
        );
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(forged));
        return;
      }
      if (MOCK_CONTROL.inspectionFault === 'malformed') {
        response.setHeader('content-type', 'application/json');
        response.end('{"malformed":');
        return;
      }
      const body = JSON.parse(raw);
      const observedAt = MOCK_CONTROL.inspectionFault === 'timestamp'
        ? '2000-01-01T00:00:00.000Z'
        : new Date().toISOString();
      const responseResources = Object.fromEntries(
        resourceCategories.map((category) => {
          const items = MOCK_CONTROL.inspectionFault === 'forged-clean'
            ? []
            : [...resources[category]];
          return [category, {
            method: resourceMethods[category],
            complete: true,
            total: items.length,
            nextCursor: null,
            items,
          }];
        }),
      );
      if (MOCK_CONTROL.inspectionFault === 'partial') {
        responseResources.queueItems.complete = false;
      }
      if (MOCK_CONTROL.inspectionFault === 'overflow') {
        responseResources.delegates.items = Array.from(
          { length: 101 },
          (_, index) => ({
            id: `overflow-delegate-${index}`,
            runId: process.env.OPENCLAW_RETURN_COVENANT_RUN_ID,
            status: 'retained',
          }),
        );
        responseResources.delegates.total =
          responseResources.delegates.items.length;
      }
      const result = {
        schema: 'openclaw.k6.return-covenant-retention-response.v1',
        rowId: process.env.OPENCLAW_RETURN_COVENANT_ROW_ID,
        runId: MOCK_CONTROL.inspectionFault === 'run'
          ? 'rcv-ffffffffffffffffffffffffffffffff'
          : process.env.OPENCLAW_RETURN_COVENANT_RUN_ID,
        candidateSha: MOCK_CONTROL.inspectionFault === 'sha'
          ? 'f'.repeat(40)
          : process.env.OPENCLAW_CANDIDATE_SHA,
        runtimeBuildSha: process.env.OPENCLAW_CANDIDATE_SHA,
        runtimeConfigSha256:
          process.env.OPENCLAW_RETURN_COVENANT_RUNTIME_CONFIG_SHA256,
        requestNonce: body.requestNonce,
        observedAt,
        gateway: {
          endpoint: gatewayIdentity.endpoint,
          namespacePid: MOCK_CONTROL.inspectionFault === 'pid'
            ? gatewayIdentity.namespacePid + 1
            : gatewayIdentity.namespacePid,
          namespaceStartFingerprint:
            gatewayIdentity.namespaceStartFingerprint,
        },
        resources: responseResources,
      };
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(result));
    });
  });
  gatewayServer.listen(0, '127.0.0.1', () => {
    const pid = hostPid();
    const endpoint = `http://127.0.0.1:${gatewayServer.address().port}`;
    gatewayIdentity = {
      endpoint,
      namespacePid: pid,
      namespaceStartFingerprint: processStartFingerprint(pid),
    };
    writeFileSync(
      process.env.RETURN_COVENANT_GATEWAY_READY_FILE,
      JSON.stringify({
        pid,
        endpoint,
        startFingerprint: gatewayIdentity.namespaceStartFingerprint,
      }),
    );
  });
  process.once('SIGTERM', () => {
    gatewayServer.close(() => {
      setTimeout(() => process.exit(0), 50);
    });
  });
} else {
  const input = args(process.argv);
  const plan = readJson(input.plan);
  const phaseKey = process.env.OPENCLAW_RETURN_COVENANT_PHASE_KEY;
  const cases = new Map();
  const gateways = [];
  let currentGateway = null;
  let cleanupRun = null;
  let finalizing = false;
  const resourceState = Object.fromEntries(
    resourceCategories.map((category) => [category, new Map()]),
  );
  const retainedControlApplied = new Set();
  const sqliteDir = path.join(process.env.OPENCLAW_STATE_DIR, 'state');
  const sqlitePath = path.join(sqliteDir, 'openclaw.sqlite');
  const agentSqliteDir = path.join(
    process.env.OPENCLAW_STATE_DIR,
    'agents',
    'proof',
    'agent',
  );
  const agentSqlitePath = path.join(
    agentSqliteDir,
    'openclaw-agent.sqlite',
  );
  mkdirSync(sqliteDir, { recursive: true, mode: 0o700 });
  mkdirSync(agentSqliteDir, { recursive: true, mode: 0o700 });
  const stateDatabase = new DatabaseSync(sqlitePath);
  stateDatabase.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;');
  stateDatabase.exec(`
    CREATE TABLE schema_meta (
      meta_key TEXT NOT NULL PRIMARY KEY,
      role TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      agent_id TEXT,
      app_version TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    INSERT INTO schema_meta VALUES
      ('primary', 'global', 13, NULL, 'fixture', 1, 1);
    CREATE TABLE agent_databases (
      agent_id TEXT NOT NULL,
      path TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      size_bytes INTEGER,
      PRIMARY KEY (agent_id, path)
    ) STRICT;
    CREATE TABLE flow_runs (
      flow_id TEXT NOT NULL PRIMARY KEY,
      shape TEXT,
      sync_mode TEXT NOT NULL DEFAULT 'managed',
      owner_key TEXT NOT NULL,
      chain_id TEXT,
      requester_origin_json TEXT,
      controller_id TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      notify_policy TEXT NOT NULL,
      goal TEXT NOT NULL,
      current_step TEXT,
      blocked_task_id TEXT,
      blocked_summary TEXT,
      state_json TEXT,
      wait_json TEXT,
      cancel_requested_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      ended_at INTEGER
    ) STRICT;
    CREATE TABLE subagent_runs (
      run_id TEXT NOT NULL PRIMARY KEY,
      child_session_key TEXT NOT NULL,
      controller_session_key TEXT,
      requester_session_key TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}'
    ) STRICT;
    CREATE TABLE delivery_queue_entries (
      queue_name TEXT NOT NULL,
      id TEXT NOT NULL,
      status TEXT NOT NULL,
      entry_kind TEXT,
      session_key TEXT,
      channel TEXT,
      target TEXT,
      account_id TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at INTEGER,
      last_error TEXT,
      recovery_state TEXT,
      platform_send_started_at INTEGER,
      entry_json TEXT NOT NULL,
      enqueued_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      failed_at INTEGER,
      PRIMARY KEY (queue_name, id)
    ) STRICT;
    PRAGMA user_version=13;
  `);
  const agentDatabase = new DatabaseSync(agentSqlitePath);
  agentDatabase.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;');
  agentDatabase.exec(`
    CREATE TABLE schema_meta (
      meta_key TEXT NOT NULL PRIMARY KEY,
      role TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      agent_id TEXT,
      app_version TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    INSERT INTO schema_meta VALUES
      ('primary', 'agent', 19, 'proof', 'fixture', 1, 1);
    CREATE TABLE session_nodes (
      session_key TEXT NOT NULL PRIMARY KEY,
      current_session_id TEXT NOT NULL,
      entry_json TEXT NOT NULL,
      entry_valid INTEGER NOT NULL DEFAULT 0 CHECK (entry_valid IN (-1, 0, 1)),
      updated_at INTEGER NOT NULL,
      status TEXT CHECK (status IS NULL OR status IN ('running', 'done', 'failed', 'killed', 'timeout')),
      created_at INTEGER,
      created_via TEXT CHECK (created_via IS NULL OR created_via IN ('operator', 'spawn', 'channel', 'cron', 'talk', 'run', 'plugin', 'internal')),
      created_actor_type TEXT CHECK (created_actor_type IS NULL OR created_actor_type IN ('human', 'agent', 'system')),
      created_actor_id TEXT,
      owner_actor_type TEXT,
      owner_actor_id TEXT,
      owner_assigned_by_type TEXT,
      owner_assigned_by_id TEXT,
      owner_assigned_at INTEGER,
      project_id TEXT,
      parent_session_key TEXT,
      spawned_by TEXT,
      fork_source_session_key TEXT,
      fork_source_session_id TEXT,
      fork_source_entry_id TEXT,
      label TEXT,
      display_name TEXT,
      category TEXT,
      icon TEXT,
      pinned_at INTEGER,
      archived_at INTEGER,
      last_read_at INTEGER,
      last_interaction_at INTEGER,
      last_activity_at INTEGER
    ) STRICT;
    PRAGMA user_version=19;
  `);
  stateDatabase.prepare(`
    INSERT INTO agent_databases
      (agent_id, path, schema_version, last_seen_at, size_bytes)
    VALUES ('proof', 'agents/proof/agent/openclaw-agent.sqlite', 19, ?, NULL)
  `).run(Date.now());
  stateDatabase.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  agentDatabase.exec('PRAGMA wal_checkpoint(TRUNCATE);');

  function insertDurableCaseState(body, key) {
    const now = Date.now();
    const rootEntry = {
      sessionId: `root-session-${sha256(body.logicalSessionKey).slice(0, 12)}`,
      updatedAt: now,
      createdVia: 'internal',
      spawnDepth: 0,
    };
    agentDatabase.prepare(`
      INSERT OR IGNORE INTO session_nodes (
        session_key, current_session_id, entry_json, entry_valid,
        updated_at, status, created_at, created_via
      ) VALUES (?, ?, ?, 1, ?, 'running', ?, 'internal')
    `).run(
      body.logicalSessionKey,
      rootEntry.sessionId,
      JSON.stringify(rootEntry),
      now,
      now,
    );
    const durableSessionKey =
      `agent:proof:subagent:${sha256(key).slice(0, 16)}`;
    const childEntry = {
      sessionId: `temporary-session-${key}`,
      updatedAt: now,
      createdAt: now,
      createdVia: 'spawn',
      spawnedBy: body.logicalSessionKey,
      parentSessionKey: body.logicalSessionKey,
      spawnDepth: 1,
    };
    agentDatabase.prepare(`
      INSERT INTO session_nodes (
        session_key, current_session_id, entry_json, entry_valid,
        updated_at, status, created_at, created_via,
        parent_session_key, spawned_by
      ) VALUES (?, ?, ?, 1, ?, 'running', ?, 'spawn', ?, ?)
    `).run(
      durableSessionKey,
      childEntry.sessionId,
      JSON.stringify(childEntry),
      now,
      now,
      body.logicalSessionKey,
      body.logicalSessionKey,
    );
    return durableSessionKey;
  }

  function insertDurableDispatchState(body, key, durableSessionKey) {
    const now = Date.now();
    const delegateId = `delegate-${key}`;
    const queueId = `queue-item-${key}`;
    const payload = {
      runId: delegateId,
      childSessionKey: durableSessionKey,
      controllerSessionKey: body.logicalSessionKey,
      requesterSessionKey: body.logicalSessionKey,
      requesterDisplayKey: body.logicalSessionKey,
      task: `proof task ${key}`,
      cleanup: 'delete',
      createdAt: now,
      expectsCompletionMessage: true,
      execution: {
        status: 'running',
        startedAt: now,
      },
      completion: { required: true },
      delivery: {
        status: 'pending',
        payload: {
          requesterSessionKey: body.logicalSessionKey,
          requesterDisplayKey: body.logicalSessionKey,
          childSessionKey: durableSessionKey,
          childRunId: delegateId,
          task: `proof task ${key}`,
          expectsCompletionMessage: true,
        },
      },
    };
    stateDatabase.prepare(`
      INSERT INTO flow_runs (
        flow_id, shape, sync_mode, owner_key, chain_id,
        requester_origin_json, controller_id, revision, status,
        notify_policy, goal, current_step, blocked_task_id,
        blocked_summary, state_json, wait_json, cancel_requested_at,
        created_at, updated_at, ended_at
      ) VALUES (?, NULL, 'managed', ?, NULL, NULL, ?, 0, 'running',
        'silent', ?, 'Accepted continuation delegate', NULL, NULL, ?,
        NULL, NULL, ?, ?, NULL)
    `).run(
      `flow-${key}`,
      body.logicalSessionKey,
      body.returnMode === 'post-compaction'
        ? 'core/continuation-post-compaction'
        : 'core/continuation-delegate',
      `Continuation delegate: ${key}`,
      JSON.stringify({
        kind: 'continuation_delegate',
        task: `proof task ${key}`,
        childSessionKey: durableSessionKey,
        originRunId: plan.runId,
        ...(body.returnMode === 'post-compaction'
          ? { postCompaction: true }
          : {}),
      }),
      now,
      now,
    );
    stateDatabase.prepare(`
      INSERT INTO subagent_runs (
        run_id,
        child_session_key,
        controller_session_key,
        requester_session_key,
        created_at,
        payload_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      delegateId,
      durableSessionKey,
      body.logicalSessionKey,
      body.logicalSessionKey,
      now,
      JSON.stringify(payload),
    );
    const deliveryEntry = {
      id: queueId,
      enqueuedAt: now,
      retryCount: 0,
      kind: 'agentTurn',
      sessionKey: body.logicalSessionKey,
      message: `proof result ${key}`,
      messageId: `message-${sha256(key).slice(0, 12)}`,
      deliveryStartedAt: now,
      owner: {
        kind: 'subagent_completion',
        runId: delegateId,
        taskId: `task-${key}`,
        generation: 1,
        deadlineAt: now + 60_000,
      },
    };
    stateDatabase.prepare(`
      INSERT INTO delivery_queue_entries (
        queue_name, id, status, entry_kind, session_key, channel,
        target, account_id, retry_count, last_attempt_at, last_error,
        recovery_state, platform_send_started_at, entry_json,
        enqueued_at, updated_at, failed_at
      ) VALUES (
        'session', ?, 'pending', 'agentTurn', ?, NULL,
        NULL, NULL, 0, NULL, NULL, NULL, NULL, ?, ?, ?, NULL
      )
    `).run(
      queueId,
      body.logicalSessionKey,
      JSON.stringify(deliveryEntry),
      now,
      now,
    );
  }

  function cleanupDurableCaseState(state) {
    const key = state.key;
    const now = Date.now();
    if (removeResourceUnlessRetained('delegates', `delegate-${key}`)) {
      const row = stateDatabase.prepare(
        'SELECT payload_json FROM subagent_runs WHERE run_id = ?',
      ).get(`delegate-${key}`);
      const payload = JSON.parse(row.payload_json);
      payload.execution = {
        ...payload.execution,
        status: 'terminal',
        endedAt: now,
        outcome: { status: 'ok' },
      };
      payload.cleanupHandled = true;
      payload.cleanupCompletedAt = now;
      payload.delivery = {
        ...payload.delivery,
        status: 'delivered',
        deliveredAt: now,
      };
      stateDatabase.prepare(`
        UPDATE subagent_runs
        SET payload_json = ?
        WHERE run_id = ?
      `).run(JSON.stringify(payload), `delegate-${key}`);
    }
    stateDatabase.prepare(`
      UPDATE flow_runs
      SET status = 'succeeded', current_step = 'Delivered',
          revision = revision + 1, updated_at = ?, ended_at = ?
      WHERE flow_id = ?
    `).run(now, now, `flow-${key}`);
    if (removeResourceUnlessRetained('queueItems', `queue-item-${key}`)) {
      const tombstone = {
        id: `queue-item-${key}`,
        enqueuedAt: now,
        retryCount: 0,
        acknowledgedAt: now,
      };
      stateDatabase.prepare(`
        UPDATE delivery_queue_entries
        SET status = 'completed', entry_kind = NULL, session_key = NULL,
            channel = NULL, target = NULL, account_id = NULL,
            retry_count = 0, last_attempt_at = NULL, last_error = NULL,
            recovery_state = NULL, platform_send_started_at = NULL,
            entry_json = ?, enqueued_at = ?, updated_at = ?, failed_at = NULL
        WHERE queue_name = 'session' AND id = ?
      `).run(JSON.stringify(tombstone), now, now, `queue-item-${key}`);
    }
    if (
      removeResourceUnlessRetained(
        'temporarySessions',
        `temporary-session-${key}`,
      )
    ) {
      agentDatabase.prepare(
        'DELETE FROM session_nodes WHERE session_key = ?',
      ).run(state.durableSessionKey);
    }
  }

  function resourceSnapshot() {
    return Object.fromEntries(
      resourceCategories.map((category) => [
        category,
        [...resourceState[category].values()],
      ]),
    );
  }

  function putResource(category, id, status) {
    resourceState[category].set(id, {
      id,
      runId: plan.runId,
      status,
    });
  }

  function removeResourceUnlessRetained(category, id) {
    if (
      MOCK_CONTROL.retainedResource === category &&
      !retainedControlApplied.has(category)
    ) {
      retainedControlApplied.add(category);
      return false;
    }
    resourceState[category].delete(id);
    return true;
  }

  async function syncCurrentGateway() {
    if (!currentGateway) return;
    await postJson(
      `${currentGateway.endpoint}/v1/return-covenant/mock-resource-state`,
      { resources: resourceSnapshot() },
    );
  }

  function spawnGateway(label) {
    const readyFile = `${input.ready}.gateway-${label}.json`;
    const child = spawn(process.execPath, [process.argv[1], 'gateway'], {
      cwd: process.cwd(),
      stdio: 'ignore',
      env: {
        ...process.env,
        RETURN_COVENANT_GATEWAY_READY_FILE: readyFile,
        RETURN_COVENANT_GATEWAY_RESOURCE_STATE:
          JSON.stringify(resourceSnapshot()),
        OPENCLAW_RETURN_COVENANT_RUN_ID: plan.runId,
        OPENCLAW_RETURN_COVENANT_ROW_ID: plan.rowId,
        OPENCLAW_RETURN_COVENANT_RUNTIME_CONFIG_SHA256:
          plan.target.runtimeConfigSha256,
        RETURN_COVENANT_REDIRECT_ENDPOINT:
          driverServer?.listening
            ? `http://127.0.0.1:${driverServer.address().port}`
            : '',
      },
    });
    const entry = { child, readyFile, label, exited: false };
    child.once('exit', () => { entry.exited = true; });
    gateways.push(entry);
    return entry;
  }

  async function startGateway(label) {
    const entry = spawnGateway(label);
    const ready = await waitForJson(entry.readyFile);
    entry.pid = ready.pid;
    entry.endpoint = ready.endpoint;
    entry.startFingerprint =
      ready.startFingerprint || processStartFingerprint(entry.pid);
    return entry;
  }

  async function stopGateway(entry) {
    if (entry.exited || entry.child.exitCode !== null) return;
    let exited = false;
    const exitPromise = once(entry.child, 'exit').then(() => {
      exited = true;
      entry.exited = true;
    });
    entry.child.kill('SIGTERM');
    await Promise.race([exitPromise, delay(1000)]);
    if (!exited) {
      entry.child.kill('SIGKILL');
      await Promise.race([exitPromise, delay(1000)]);
    }
    if (!exited) {
      throw new Error(`gateway ${entry.label} did not stop`);
    }
  }

  function receiptForPhase(phase, payload) {
    if (phase === 'prepare') {
      return { prepare: payload.prepare, observation: payload.observation || null };
    }
    if (phase === 'dispatch') return payload.acceptance;
    if (phase === 'transition') return payload.transition;
    if (phase === 'release') return payload.release;
    if (phase === 'observe') {
      return {
        settled: payload.settled === true,
        observation: payload.observation || null,
      };
    }
    if (phase === 'cleanup') return payload.cleanup;
    if (phase === 'cleanup-run') return payload.cleanupRun;
    return null;
  }

  function responseFor(request, payload) {
    const receipt = receiptForPhase(request.phase, payload);
    const binding = {
      phase: request.phase,
      requestNonce: request.driverBinding.requestNonce,
      receiptSha256: sha256(canonicalJson(receipt)),
      attestationSha256: request.driverBinding.attestationSha256,
      launchNonceFingerprint: request.driverBinding.launchNonceFingerprint,
      processStartFingerprint: request.driverBinding.processStartFingerprint,
      endpointSocketFingerprint:
        request.driverBinding.endpointSocketFingerprint,
      runtimeConfigSha256: request.driverBinding.runtimeConfigSha256,
    };
    return {
      schema: input.contract,
      phase: request.phase,
      ok: true,
      ...payload,
      driverBinding: {
        ...binding,
        signature: createHmac('sha256', phaseKey)
          .update(canonicalJson(binding))
          .digest('hex'),
      },
    };
  }

  function databaseReceipt(testCase, receiptId) {
    const profiles = {
      'fresh-v19': [null, 'fresh', true, false, false],
      'covenant-v18-upgrade': [18, 'covenant-v18', false, true, false],
      'participant-v18-upgrade': [18, 'participant-v18', false, true, false],
      'idempotent-v19-reopen': [19, 'v19-reopen', false, false, true],
    };
    const [source, fixtureShape, freshInstall, migrationApplied, reopenIdempotent] =
      profiles[testCase.databaseProfile];
    return {
      profile: testCase.databaseProfile,
      sourceSchemaVersion: source,
      targetSchemaVersion: 19,
      fixtureShape,
      productOwnedFixture: true,
      canonicalFixtureReceiptId: receiptId,
      freshInstall,
      migrationApplied,
      reopenIdempotent,
    };
  }

  function originEvidence(key, form) {
    return {
      source: 'product-owned',
      observedForm: form,
      receiptId: `origin-receipt-${key}`,
      typedToolExecutions: form === 'typed-tool' ? 1 : 0,
      bracketParses: form === 'bracket-token' ? 1 : 0,
      rawFinalText: form === 'bracket-token',
    };
  }

  function transitionFor(state, attestation, lineage) {
    const forbidden = state.request.kind === 'forbidden';
    const key = state.key;
    const lifecycle = {
      edge: state.request.lifecycleEdge,
      occurredAfterAcceptance: true,
      completedBeforeRelease: true,
      preSessionId:
        state.request.caseId === 'allowed-late-materialization'
          ? null
          : `pre-session-${key}`,
      postSessionId: `post-session-${key}`,
      successorIdentity: `successor-${key}`,
      receiptId: `lifecycle-receipt-${key}`,
      acceptedDispatchReceiptId: state.acceptance.receiptId,
      generationAdvanced: forbidden,
      effectiveAuthorityUnchanged: !forbidden,
    };
    if (state.request.caseId === 'forbidden-delete-recreate') {
      lifecycle.operations = {
        deletionObserved: true,
        deletionReceiptId: `delete-operation-receipt-${key}`,
        recreationObserved: true,
        recreationReceiptId: `recreate-operation-receipt-${key}`,
      };
    }
    if (state.request.caseId === 'allowed-gateway-restart-replay') {
      lifecycle.restart = {
        stoppedAfterAcceptance: true,
        restartedBeforeRelease: true,
        replayRecovered: true,
        receiptId: `restart-receipt-${key}`,
        originalGatewayPid: lineage.original.pid,
        originalGatewayStartFingerprint: lineage.original.startFingerprint,
        replacementGatewayPid: lineage.replacement.pid,
        replacementGatewayStartFingerprint:
          lineage.replacement.startFingerprint,
        gatewayCommandSha256: attestation.gatewayCommand.sha256,
        runtimeConfigSha256: attestation.runtimeConfigSha256,
        processGroupId: attestation.isolation.processGroupId,
        replacementGatewayEndpoint: lineage.replacement.endpoint,
      };
    }
    return lifecycle;
  }

  function completeObservation(state) {
    const nowWall = Date.now();
    const nowMonotonic = performance.now();
    const elapsedWall = nowWall - state.releasedAtWall;
    const elapsedMonotonic = nowMonotonic - state.releasedAtMonotonic;
    const forbidden = state.request.kind === 'forbidden';
    const admission = forbidden
      ? {
        'forbidden-delete-recreate': 'stale',
        'forbidden-owner-reassignment': 'unauthorized',
        'forbidden-member-access-removal': 'unauthorized',
        'forbidden-restrictive-visibility': 'unauthorized',
        'forbidden-explicit-revocation': 'revoked',
      }[state.request.caseId]
      : 'adopted';
    return {
      schema: 'openclaw.k6.return-covenant-observation.v1',
      rowId: plan.rowId,
      runId: plan.runId,
      caseId: state.request.caseId,
      form: state.request.form,
      kind: state.request.kind,
      candidateSha: plan.target.candidateSha,
      runtimeBuildSha: plan.target.runtimeBuildSha,
      docsHarnessSha: plan.target.docsHarnessSha,
      runtimeConfigSha256: plan.target.runtimeConfigSha256,
      startedAt: state.startedAt,
      endedAt: new Date(nowWall).toISOString(),
      returnMode: state.request.returnMode,
      logicalSessionKey: state.request.logicalSessionKey,
      caseHandle: state.caseHandle,
      database: state.database,
      isolation: { home: true, state: true, config: true, syntheticData: true },
      dispatch: state.acceptance,
      lifecycle: state.lifecycle,
      authorityDiagnostic: {
        source: 'product-owned',
        surface: 'diagnostics/continuation/recipient-authority',
        capturedAuthorityGeneration:
          state.acceptance.capturedAuthorityGeneration,
        currentAuthorityGeneration: forbidden
          ? `current-generation-${state.key}`
          : state.acceptance.capturedAuthorityGeneration,
      },
      delivery: {
        acceptedDispatchReceiptId: state.acceptance.receiptId,
        heldResultAuthorityGeneration:
          state.acceptance.capturedAuthorityGeneration,
        caseHandle: state.caseHandle,
        transitionReceiptId: state.lifecycle.receiptId,
        releaseReceiptId: state.release.receiptId,
        resultReleased: true,
        admission,
        queue: {
          recordId: `queue-record-${state.key}`,
          status: forbidden ? `${admission}-acknowledged` : 'adopted',
          acknowledged: true,
          removed: true,
          retryScheduled: false,
        },
      },
      effects: {
        distinguishable: true,
        sources: {
          promptAdoptions: 'product-observer/prompt-adoption',
          wakes: 'product-observer/heartbeat-wake',
          channelDeliveries: 'product-observer/channel-delivery',
        },
        expected: state.request.expectedEffects,
        observed: state.request.expectedEffects,
      },
      settlement: {
        bounded: true,
        complete: true,
        windowMs: state.request.settlementWindowMs,
        releasedAt: new Date(state.releasedAtWall).toISOString(),
        scansCompletedAt: new Date(nowWall).toISOString(),
        elapsedMs: elapsedWall,
        monotonicElapsedMs: elapsedMonotonic,
      },
      scans: {
        resultMarker: state.acceptance.resultMarker,
        successorTranscript: {
          source: 'product-owned',
          marker: state.acceptance.resultMarker,
          matches: 0,
          receiptId: `transcript-scan-receipt-${state.key}`,
        },
        trustedSystemEvents: {
          source: 'product-owned',
          marker: state.acceptance.resultMarker,
          matches: 0,
          receiptId: `system-event-scan-receipt-${state.key}`,
        },
      },
      resultMarker: state.acceptance.resultMarker,
    };
  }

  const driverServer = http.createServer((request, response) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', async () => {
      try {
        const body = JSON.parse(raw);
        if (
          request.method === 'POST' &&
          request.url === '/v1/return-covenant/forged-clean'
        ) {
          const observedAt = new Date().toISOString();
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({
            schema: 'openclaw.k6.return-covenant-retention-response.v1',
            rowId: plan.rowId,
            runId: plan.runId,
            candidateSha: plan.target.candidateSha,
            runtimeBuildSha: plan.target.runtimeBuildSha,
            runtimeConfigSha256: plan.target.runtimeConfigSha256,
            requestNonce: body.requestNonce,
            observedAt,
            gateway: {
              endpoint: currentGateway.endpoint,
              namespacePid: currentGateway.pid,
              namespaceStartFingerprint: currentGateway.startFingerprint,
            },
            resources: Object.fromEntries(
              resourceCategories.map((category) => [category, {
                method: resourceMethods[category],
                complete: true,
                total: 0,
                nextCursor: null,
                items: [],
              }]),
            ),
          }));
          return;
        }
        const key = `${body.caseId}:${body.form}`;
        let payload;
        if (body.phase === 'prepare') {
          const caseHandle = `case-handle-${key}`;
          const prepareReceipt = `fixture-receipt-${key}`;
          cases.set(caseHandle, {
            key,
            caseHandle,
            request: body,
            startedAt: new Date().toISOString(),
            database: databaseReceipt(body, prepareReceipt),
            closed: false,
          });
          putResource(
            'temporarySessions',
            `temporary-session-${key}`,
            'temporary',
          );
          cases.get(caseHandle).durableSessionKey =
            insertDurableCaseState(body, key);
          await syncCurrentGateway();
          payload = {
            caseHandle,
            prepare: { caseHandle, receiptId: prepareReceipt },
          };
        } else if (body.phase === 'dispatch') {
          const state = cases.get(body.caseHandle);
          const resultMarker = `RCV-${sha256(key).slice(0, 32)}`;
          state.acceptance = {
            caseHandle: state.caseHandle,
            prepareReceiptId: state.database.canonicalFixtureReceiptId,
            accepted: true,
            completionHeld: true,
            receiptId: `dispatch-receipt-${key}`,
            heldResultId: `held-result-${key}`,
            capturedAuthorityGeneration: `captured-generation-${key}`,
            resultMarker,
            originEvidence: originEvidence(key, body.form),
          };
          putResource('delegates', `delegate-${key}`, 'pending-return');
          putResource('queueItems', `queue-item-${key}`, 'held');
          insertDurableDispatchState(
            state.request,
            key,
            state.durableSessionKey,
          );
          await syncCurrentGateway();
          payload = { acceptance: state.acceptance };
        } else if (body.phase === 'transition') {
          const state = cases.get(body.caseHandle);
          const attestation = readJson(
            process.env.OPENCLAW_RETURN_COVENANT_ATTESTATION_PATH,
          );
          let lineage = null;
          if (state.request.caseId === 'allowed-gateway-restart-replay') {
            const original = currentGateway;
            await stopGateway(original);
            const replacement = await startGateway(
              `replacement-${state.request.form}`,
            );
            currentGateway = replacement;
            lineage = { original, replacement };
          }
          state.lifecycle = transitionFor(state, attestation, lineage);
          payload = {
            transition: {
              caseHandle: state.caseHandle,
              lifecycleOccurred: true,
              receiptId: state.lifecycle.receiptId,
              acceptedDispatchReceiptId: state.acceptance.receiptId,
              capturedAuthorityGeneration:
                state.acceptance.capturedAuthorityGeneration,
              ...(state.lifecycle.restart
                ? {
                  restartReceiptId: state.lifecycle.restart.receiptId,
                  restart: state.lifecycle.restart,
                }
                : {}),
              ...(state.lifecycle.operations
                ? { operations: state.lifecycle.operations }
                : {}),
            },
          };
        } else if (body.phase === 'release') {
          const state = cases.get(body.caseHandle);
          state.release = {
            caseHandle: state.caseHandle,
            released: true,
            receiptId: `release-receipt-${key}`,
            transitionReceiptId: state.lifecycle.receiptId,
            acceptedDispatchReceiptId: state.acceptance.receiptId,
            heldResultId: state.acceptance.heldResultId,
            resultMarker: state.acceptance.resultMarker,
            capturedAuthorityGeneration:
              state.acceptance.capturedAuthorityGeneration,
          };
          state.releasedAtWall = Date.now();
          state.releasedAtMonotonic = performance.now();
          payload = { release: state.release };
        } else if (body.phase === 'observe') {
          const state = cases.get(body.caseHandle);
          const settled =
            performance.now() - state.releasedAtMonotonic >=
            state.request.settlementWindowMs;
          payload = {
            settled,
            observation: settled ? completeObservation(state) : null,
          };
        } else if (body.phase === 'cleanup') {
          const state = cases.get(body.caseHandle);
          state.closed = true;
          cleanupDurableCaseState(state);
          await syncCurrentGateway();
          payload = {
            cleanup: {
              caseHandle: body.caseHandle,
              closed: state.closed,
              receiptId: `case-cleanup-receipt-${key}`,
            },
          };
        } else if (body.phase === 'cleanup-run') {
          if (!cleanupRun) {
            cleanupRun = {
              completed: true,
              receiptId: 'run-cleanup-receipt-pass',
              observationSetSha256: body.observationSetSha256,
              phaseChainSha256: body.phaseChainSha256,
              driverAttestationSha256: body.driverAttestationSha256,
              runtimeConfigSha256: plan.target.runtimeConfigSha256,
            };
          }
          payload = { cleanupRun };
        } else {
          throw new Error(`unknown phase: ${body.phase}`);
        }
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(responseFor(body, payload)));
        if (body.phase === 'cleanup-run' && body.fallback === true && !finalizing) {
          finalizing = true;
          setTimeout(() => void finalize(), 25);
        }
      } catch (error) {
        console.error(error?.stack || String(error));
        response.statusCode = 500;
        response.end(String(error));
      }
    });
  });

  async function finalize() {
    const attestation = await waitForJson(
      process.env.OPENCLAW_RETURN_COVENANT_ATTESTATION_PATH,
    );
    const startedAt = new Date().toISOString();
    await Promise.all(gateways.map(stopGateway));
    const actualRetained = {
      delegates: resourceState.delegates.size,
      queueItems: resourceState.queueItems.size,
      temporarySessions: resourceState.temporarySessions.size,
      gateways: gateways.filter((entry) => !entry.exited).length,
      fixtureProcesses: 0,
    };
    writeFileSync(input['cleanup-draft'], JSON.stringify({
      startedAt,
      endedAt: new Date().toISOString(),
      retained: MOCK_CONTROL.candidateClaimsClean
        ? Object.fromEntries(Object.keys(actualRetained).map((name) => [name, 0]))
        : actualRetained,
      allCaseHandlesClosed:
        [...cases.values()].every((entry) => entry.closed === true),
      caseHandles: [...cases.keys()],
      observationSetSha256: cleanupRun.observationSetSha256,
      phaseChainSha256: cleanupRun.phaseChainSha256,
      driverAttestationSha256: attestation.attestationSha256,
      runCleanupReceiptId: cleanupRun.receiptId,
    }));
    stateDatabase.close();
    agentDatabase.close();
    driverServer.closeAllConnections();
    driverServer.close();
    process.exit(0);
  }

  void (async () => {
    const initial = await startGateway('initial');
    currentGateway = initial;
    driverServer.listen(0, '127.0.0.1', () => {
      writeFileSync(input.ready, JSON.stringify({
        schema: 'openclaw.k6.return-covenant-driver-ready.v1',
        protocol: input.contract,
        runId: plan.runId,
        rowId: plan.rowId,
        candidateSha: plan.target.candidateSha,
        runtimeBuildSha: plan.target.runtimeBuildSha,
        docsHarnessSha: plan.target.docsHarnessSha,
        commandRelativePath: plan.driver.fixtureCommand.relativePath,
        commandSha256: plan.driver.fixtureCommand.sha256,
        gatewayCommandRelativePath: plan.driver.gatewayCommand.relativePath,
        gatewayCommandSha256: plan.driver.gatewayCommand.sha256,
        runtimeConfigSha256: plan.target.runtimeConfigSha256,
        launchNonce: process.env.OPENCLAW_RETURN_COVENANT_LAUNCH_NONCE,
        phaseKeyFingerprint:
          process.env.OPENCLAW_RETURN_COVENANT_PHASE_KEY_FINGERPRINT,
        pid: hostPid(),
        gatewayPid: initial.pid,
        gatewayEndpoint: initial.endpoint,
        endpoint: `http://127.0.0.1:${driverServer.address().port}`,
        revocationCapability: {
          schema: 'openclaw.k6.return-covenant-capability-inventory.v1',
          source: 'product-owned',
          productSha: plan.target.candidateSha,
          runtimeBuildSha: plan.target.runtimeBuildSha,
          runtimeConfigSha256: plan.target.runtimeConfigSha256,
          inventoryComplete: true,
          revocationApiExposed: true,
          surface: 'diagnostics/continuation/capability-inventory',
          receiptId: 'run-wide-revocation-capability-receipt',
        },
      }));
    });
  })();
}
