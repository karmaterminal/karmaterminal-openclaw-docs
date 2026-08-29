import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { canonicalJson } from './canonical-json.mjs';
import {
  inspectProcessLoopbackListeners,
} from './return-covenant-driver-attestation.mjs';

export const RETURN_COVENANT_STORE_OBSERVATION_SCHEMA =
  'openclaw.k6.return-covenant-store-observation.v1';
export const RETURN_COVENANT_PRODUCT_STORE_CONTRACT_SHA =
  '0109521b0c2b8a2c81c9f901789a81c5316074a7';

const MAX_DATABASE_BYTES = 128 * 1024 * 1024;
const MAX_SIDECAR_BYTES = 256 * 1024 * 1024;
const MAX_RESOURCE_COUNT = 100;
const MAX_AGENT_DATABASES = 128;
const PROCESS_QUIESCE_TIMEOUT_MS = 2_000;
const PROCESS_QUIESCE_POLL_MS = 10;
const OPEN_DIRECTORY_FLAGS =
  fsConstants.O_RDONLY |
  fsConstants.O_NOFOLLOW |
  (fsConstants.O_DIRECTORY ?? 0);
const OPEN_FILE_FLAGS = fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW;
const FLOW_STATUSES = new Set([
  'queued',
  'running',
  'waiting',
  'blocked',
  'succeeded',
  'failed',
  'cancelled',
  'lost',
]);
const FLOW_SYNC_MODES = new Set(['task_mirrored', 'managed']);
const TERMINAL_FLOW_STATUSES = new Set([
  'succeeded',
  'failed',
  'cancelled',
  'lost',
]);
const SUBAGENT_EXECUTION_STATUSES = new Set([
  'queued',
  'running',
  'interrupted',
  'terminal',
]);
const SUBAGENT_DELIVERY_STATUSES = new Set([
  'not_required',
  'pending',
  'in_progress',
  'delivered',
  'failed',
  'suspended',
  'discarded',
]);
const SUBAGENT_DELIVERY_DISPOSITIONS = new Set([
  'delivered',
  'session_queued',
  'intentional_non_delivery',
  'retryable',
  'ambiguous',
  'permanent_failure',
]);
const DELIVERY_QUEUE_STATUSES = new Set(['pending', 'failed', 'completed']);
const DELIVERY_QUEUE_RECOVERY_STATES = new Set([
  'producer_claimed',
  'send_attempt_started',
  'unknown_after_send',
  'settlement_pending',
  'completed_permanent',
  'completed_bounded',
]);
const SESSION_STATUSES = new Set([
  'running',
  'done',
  'failed',
  'killed',
  'timeout',
]);
const SESSION_CREATED_VIA = new Set([
  'operator',
  'spawn',
  'channel',
  'cron',
  'talk',
  'run',
  'plugin',
  'internal',
]);
const REQUIRED_GLOBAL_COLUMNS = Object.freeze({
  schema_meta: [
    'meta_key',
    'role',
    'schema_version',
    'agent_id',
    'app_version',
    'created_at',
    'updated_at',
  ],
  agent_databases: [
    'agent_id',
    'path',
    'schema_version',
    'last_seen_at',
    'size_bytes',
  ],
  delivery_queue_entries: [
    'queue_name',
    'id',
    'status',
    'entry_kind',
    'session_key',
    'channel',
    'target',
    'account_id',
    'retry_count',
    'last_attempt_at',
    'last_error',
    'recovery_state',
    'platform_send_started_at',
    'entry_json',
    'enqueued_at',
    'updated_at',
    'failed_at',
  ],
  subagent_runs: [
    'run_id',
    'child_session_key',
    'controller_session_key',
    'requester_session_key',
    'created_at',
    'payload_json',
  ],
  flow_runs: [
    'flow_id',
    'shape',
    'sync_mode',
    'owner_key',
    'chain_id',
    'requester_origin_json',
    'controller_id',
    'revision',
    'status',
    'notify_policy',
    'goal',
    'current_step',
    'blocked_task_id',
    'blocked_summary',
    'state_json',
    'wait_json',
    'cancel_requested_at',
    'created_at',
    'updated_at',
    'ended_at',
  ],
});
const REQUIRED_AGENT_COLUMNS = Object.freeze({
  schema_meta: REQUIRED_GLOBAL_COLUMNS.schema_meta,
  session_nodes: [
    'session_key',
    'current_session_id',
    'entry_json',
    'entry_valid',
    'updated_at',
    'status',
    'created_at',
    'created_via',
    'created_actor_type',
    'created_actor_id',
    'owner_actor_type',
    'owner_actor_id',
    'owner_assigned_by_type',
    'owner_assigned_by_id',
    'owner_assigned_at',
    'project_id',
    'parent_session_key',
    'spawned_by',
    'fork_source_session_key',
    'fork_source_session_id',
    'fork_source_entry_id',
    'label',
    'display_name',
    'category',
    'icon',
    'pinned_at',
    'archived_at',
    'last_read_at',
    'last_interaction_at',
    'last_activity_at',
  ],
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function pathWithin(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function statIdentity(info) {
  return {
    dev: String(info.dev),
    ino: String(info.ino),
    size: Number(info.size),
    mode: Number(info.mode & 0o7777n),
    mtimeNs: String(info.mtimeNs),
  };
}

function sameIdentity(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

async function openBoundPath(
  pathname,
  rootReal,
  kind,
  maxBytes,
  allowEmpty = false,
) {
  const lexicalPath = path.resolve(pathname);
  const [resolved, pathInfo] = await Promise.all([
    realpath(lexicalPath),
    lstat(lexicalPath, { bigint: true }),
  ]);
  const isExpectedKind =
    kind === 'directory' ? pathInfo.isDirectory() : pathInfo.isFile();
  if (
    resolved !== lexicalPath ||
    !pathWithin(resolved, rootReal) ||
    pathInfo.isSymbolicLink() ||
    !isExpectedKind ||
    (
      kind === 'file' &&
      (
        pathInfo.size < (allowEmpty ? 0n : 1n) ||
        pathInfo.size > BigInt(maxBytes)
      )
    )
  ) {
    throw new Error(`retention source is not a canonical bounded ${kind}: ${pathname}`);
  }
  const handle = await open(
    lexicalPath,
    kind === 'directory' ? OPEN_DIRECTORY_FLAGS : OPEN_FILE_FLAGS,
  );
  try {
    const openedInfo = await handle.stat({ bigint: true });
    if (
      (kind === 'directory' ? !openedInfo.isDirectory() : !openedInfo.isFile()) ||
      !sameIdentity(statIdentity(pathInfo), statIdentity(openedInfo))
    ) {
      throw new Error(`retention source changed before open: ${pathname}`);
    }
    return {
      handle,
      pathname: lexicalPath,
      identity: statIdentity(openedInfo),
      kind,
    };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function openOptionalBoundFile(pathname, rootReal, maxBytes) {
  try {
    return await openBoundPath(pathname, rootReal, 'file', maxBytes, true);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { handle: null, pathname: path.resolve(pathname), identity: null, kind: 'file' };
    }
    throw error;
  }
}

async function revalidateOpenedPath(opened, rootReal) {
  if (!opened.handle) {
    try {
      await lstat(opened.pathname);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    throw new Error(`retention sidecar appeared during snapshot: ${opened.pathname}`);
  }
  const [resolved, pathInfo, handleInfo] = await Promise.all([
    realpath(opened.pathname),
    lstat(opened.pathname, { bigint: true }),
    opened.handle.stat({ bigint: true }),
  ]);
  if (
    resolved !== opened.pathname ||
    !pathWithin(resolved, rootReal) ||
    pathInfo.isSymbolicLink() ||
    !sameIdentity(opened.identity, statIdentity(pathInfo)) ||
    !sameIdentity(opened.identity, statIdentity(handleInfo))
  ) {
    throw new Error(`retention source changed during snapshot: ${opened.pathname}`);
  }
}

async function copyOpenedFile(opened, targetPath) {
  if (!opened.handle) return null;
  const bytes = await opened.handle.readFile();
  if (bytes.length !== opened.identity.size) {
    throw new Error(`retention source size changed during snapshot: ${opened.pathname}`);
  }
  await writeFile(targetPath, bytes, { flag: 'wx', mode: 0o600 });
  return {
    ...opened.identity,
    sha256: sha256(bytes),
  };
}

async function closeOpenedPaths(openedPaths) {
  await Promise.all(openedPaths.flatMap((entry) =>
    entry.handle ? [entry.handle.close()] : []));
}

async function snapshotSqliteFiles({
  databasePath,
  destinationDirectory,
  rootReal,
  openedPaths,
  testHooks,
}) {
  const databaseDirectory = await openBoundPath(
    path.dirname(databasePath),
    rootReal,
    'directory',
  );
  openedPaths.push(databaseDirectory);
  const database = await openBoundPath(
    databasePath,
    rootReal,
    'file',
    MAX_DATABASE_BYTES,
  );
  openedPaths.push(database);
  const wal = await openOptionalBoundFile(
    `${databasePath}-wal`,
    rootReal,
    MAX_SIDECAR_BYTES,
  );
  openedPaths.push(wal);
  const shm = await openOptionalBoundFile(
    `${databasePath}-shm`,
    rootReal,
    MAX_SIDECAR_BYTES,
  );
  openedPaths.push(shm);
  await testHooks?.afterSourceOpen?.({
    databasePath,
    databaseIdentity: database.identity,
  });
  await mkdir(destinationDirectory, { mode: 0o700 });
  const snapshotDatabasePath = path.join(
    destinationDirectory,
    path.basename(databasePath),
  );
  const source = {
    database: await copyOpenedFile(database, snapshotDatabasePath),
    wal: await copyOpenedFile(wal, `${snapshotDatabasePath}-wal`),
    shm: await copyOpenedFile(shm, `${snapshotDatabasePath}-shm`),
  };
  await Promise.all([
    revalidateOpenedPath(databaseDirectory, rootReal),
    revalidateOpenedPath(database, rootReal),
    revalidateOpenedPath(wal, rootReal),
    revalidateOpenedPath(shm, rootReal),
  ]);
  return {
    snapshotDatabasePath,
    binding: {
      pathFingerprint: sha256(databasePath),
      source,
      snapshotSha256: sha256(canonicalJson(source)),
    },
  };
}

function requireExactTable(db, table, expectedColumns) {
  const object = db.prepare(
    'SELECT type, sql FROM sqlite_schema WHERE name = ?',
  ).get(table);
  if (
    object?.type !== 'table' ||
    typeof object.sql !== 'string' ||
    !/\)\s*STRICT\s*$/iu.test(object.sql)
  ) {
    throw new Error(`${table} is not a canonical STRICT SQLite table`);
  }
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  const names = rows.map((row) => row.name);
  if (canonicalJson(names) !== canonicalJson(expectedColumns)) {
    throw new Error(`${table} does not expose the exact product columns`);
  }
  return {
    objectType: object.type,
    createSqlSha256: sha256(object.sql),
    columns: rows.map((row) => ({
      name: row.name,
      type: row.type,
      notnull: row.notnull,
      pk: row.pk,
    })),
  };
}

function requireDatabaseIntegrity(db, expectedVersion, expectedOwner) {
  const integrity = db.prepare('PRAGMA integrity_check').get();
  if (integrity?.integrity_check !== 'ok') {
    throw new Error('retention snapshot failed SQLite integrity_check');
  }
  const version = Number(db.prepare('PRAGMA user_version').get()?.user_version);
  if (version !== expectedVersion) {
    throw new Error(`retention snapshot has unexpected schema version ${version}`);
  }
  const owner = db.prepare(
    "SELECT role, schema_version, agent_id FROM schema_meta WHERE meta_key = 'primary'",
  ).get();
  if (
    owner?.role !== expectedOwner.role ||
    Number(owner?.schema_version) !== expectedVersion ||
    (owner?.agent_id ?? null) !== expectedOwner.agentId
  ) {
    throw new Error('retention snapshot has an invalid database owner');
  }
}

function parseJsonRecord(raw, label) {
  const value = parseJsonValue(raw, label);
  if (!isRecord(value)) {
    throw new Error(`${label} is not a JSON object`);
  }
  return value;
}

function parseJsonValue(raw, label) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  return value;
}

function optionalString(value, label) {
  if (value === undefined || value === null) return null;
  if (!nonEmptyString(value)) throw new Error(`${label} is not a non-empty string`);
  return value.trim();
}

function optionalStringArray(value, label) {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.some((entry) => !nonEmptyString(entry))
  ) {
    throw new Error(`${label} is not an array of non-empty strings`);
  }
  return value.map((entry) => entry.trim());
}

function validateOptionalTimestamp(value, label) {
  if (value !== undefined && (!finiteNumber(value) || value < 0)) {
    throw new Error(`${label} is not a non-negative timestamp`);
  }
}

function decodeSubagentRow(row) {
  if (
    !nonEmptyString(row.run_id) ||
    !nonEmptyString(row.child_session_key) ||
    !nonEmptyString(row.requester_session_key) ||
    (row.controller_session_key !== null &&
      !nonEmptyString(row.controller_session_key))
  ) {
    throw new Error('subagent_runs contains malformed indexed identity');
  }
  const payload = parseJsonRecord(row.payload_json, 'subagent_runs.payload_json');
  const execution = payload.execution;
  const completion = payload.completion;
  const delivery = payload.delivery;
  if (
    !isRecord(execution) ||
    !SUBAGENT_EXECUTION_STATUSES.has(execution.status) ||
    !isRecord(completion) ||
    typeof completion.required !== 'boolean' ||
    !isRecord(delivery) ||
    !SUBAGENT_DELIVERY_STATUSES.has(delivery.status) ||
    'handoffLeaseId' in delivery ||
    'handoffLeasedAt' in delivery ||
    'handoffInjectedAt' in delivery
  ) {
    throw new Error('subagent_runs.payload_json is not a canonical subagent record');
  }
  for (const [value, label] of [
    [execution.endedAt, 'execution.endedAt'],
    [payload.cleanupCompletedAt, 'cleanupCompletedAt'],
    [delivery.suspendedAt, 'delivery.suspendedAt'],
  ]) {
    validateOptionalTimestamp(value, `subagent_runs.payload_json.${label}`);
  }
  if (
    payload.cleanup !== undefined &&
    payload.cleanup !== 'delete' &&
    payload.cleanup !== 'keep'
  ) {
    throw new Error('subagent_runs.payload_json.cleanup is unknown');
  }
  if (
    payload.expectsCompletionMessage !== undefined &&
    typeof payload.expectsCompletionMessage !== 'boolean'
  ) {
    throw new Error(
      'subagent_runs.payload_json.expectsCompletionMessage is malformed',
    );
  }
  if (
    payload.suppressCompletionDelivery !== undefined &&
    typeof payload.suppressCompletionDelivery !== 'boolean'
  ) {
    throw new Error(
      'subagent_runs.payload_json.suppressCompletionDelivery is malformed',
    );
  }
  if (
    delivery.disposition !== undefined &&
    !SUBAGENT_DELIVERY_DISPOSITIONS.has(delivery.disposition)
  ) {
    throw new Error('subagent_runs.payload_json.delivery.disposition is unknown');
  }
  const effectiveDeliveryStatus =
    payload.expectsCompletionMessage === false ? 'not_required' : delivery.status;
  const deliveryPayload = delivery.payload;
  if (
    deliveryPayload !== undefined &&
    !isRecord(deliveryPayload)
  ) {
    throw new Error('subagent_runs.payload_json.delivery.payload is malformed');
  }
  const suspended =
    effectiveDeliveryStatus === 'suspended' &&
    finiteNumber(delivery.suspendedAt);
  const requiredDelivery =
    payload.expectsCompletionMessage === true &&
    payload.suppressCompletionDelivery !== true &&
    completion.required === true &&
    isRecord(deliveryPayload) &&
    (
      suspended ||
      effectiveDeliveryStatus === 'in_progress' ||
      (
        effectiveDeliveryStatus === 'pending' &&
        delivery.disposition !== 'ambiguous' &&
        delivery.disposition !== 'intentional_non_delivery' &&
        delivery.disposition !== 'permanent_failure'
      )
    );
  if (
    effectiveDeliveryStatus === 'suspended' &&
    !finiteNumber(delivery.suspendedAt)
  ) {
    throw new Error(
      'subagent_runs.payload_json suspended delivery lacks suspendedAt',
    );
  }
  const childSessionKeys = new Set([row.child_session_key.trim()]);
  if (isRecord(deliveryPayload)) {
    const deliveryChild = optionalString(
      deliveryPayload.childSessionKey,
      'subagent_runs.payload_json.delivery.payload.childSessionKey',
    );
    if (deliveryChild) childSessionKeys.add(deliveryChild);
  }
  for (const [value, label] of [
    [payload.continuationTargetSessionKey, 'continuationTargetSessionKey'],
    [payload.swarmRequesterSessionKey, 'swarmRequesterSessionKey'],
  ]) {
    const key = optionalString(value, `subagent_runs.payload_json.${label}`);
    if (key) childSessionKeys.add(key);
  }
  for (const key of optionalStringArray(
    payload.continuationTargetSessionKeys,
    'subagent_runs.payload_json.continuationTargetSessionKeys',
  )) {
    childSessionKeys.add(key);
  }
  for (const key of optionalStringArray(
    payload.swarmWaitOwnerSessionKeys,
    'subagent_runs.payload_json.swarmWaitOwnerSessionKeys',
  )) {
    childSessionKeys.add(key);
  }
  return {
    payload,
    effectiveDeliveryStatus,
    requiredDelivery,
    retained:
      execution.status !== 'terminal' ||
      !finiteNumber(payload.cleanupCompletedAt) ||
      requiredDelivery ||
      isRecord(payload.requesterSettleWake) ||
      isRecord(payload.killReconciliation) ||
      isRecord(payload.killIntent) ||
      isRecord(payload.acceptedSteerDispatch) ||
      isRecord(payload.acceptedSpawnRollback) ||
      isRecord(execution.restartRecovery) ||
      payload.terminalOwner === 'interrupted-recovery' ||
      (
        payload.collect === true &&
        !isRecord(payload.collectorCompletion)
      ),
    childSessionKeys,
  };
}

function isRetainedFlow(row, state) {
  if (
    !nonEmptyString(row.flow_id) ||
    !nonEmptyString(row.owner_key) ||
    !FLOW_SYNC_MODES.has(row.sync_mode) ||
    !FLOW_STATUSES.has(row.status) ||
    (row.controller_id !== null && !nonEmptyString(row.controller_id))
  ) {
    throw new Error('flow_runs contains unknown or malformed lifecycle state');
  }
  if (row.controller_id === 'core/continuation-work') {
    if (
      !isRecord(state) ||
      state.kind !== 'continuation_work' ||
      !nonEmptyString(state.sessionKey) ||
      state.sessionKey.trim() !== row.owner_key.trim()
    ) {
      throw new Error('continuation work flow has malformed state_json');
    }
    return (
      row.cancel_requested_at === null &&
      (row.status === 'queued' || row.status === 'running') &&
      state.succeeded === undefined
    );
  }
  if (
    row.controller_id === 'core/continuation-delegate' ||
    row.controller_id === 'core/continuation-post-compaction'
  ) {
    if (
      !isRecord(state) ||
      state.kind !== 'continuation_delegate' ||
      !nonEmptyString(state.task)
    ) {
      throw new Error('continuation delegate flow has malformed state_json');
    }
    if (
      row.controller_id === 'core/continuation-post-compaction' &&
      state.postCompaction !== true
    ) {
      throw new Error('post-compaction flow lacks its canonical state marker');
    }
    return (
      row.cancel_requested_at === null &&
      (row.status === 'queued' || row.status === 'running')
    );
  }
  if (TERMINAL_FLOW_STATUSES.has(row.status)) return false;
  if (row.status === 'blocked' && row.ended_at !== null) return false;
  return true;
}

function decodeDeliveryQueueRow(row) {
  if (
    !nonEmptyString(row.queue_name) ||
    !nonEmptyString(row.id) ||
    !DELIVERY_QUEUE_STATUSES.has(row.status) ||
    !Number.isSafeInteger(Number(row.retry_count)) ||
    Number(row.retry_count) < 0 ||
    !Number.isSafeInteger(Number(row.enqueued_at)) ||
    Number(row.enqueued_at) < 0
  ) {
    throw new Error('delivery_queue_entries contains malformed lifecycle state');
  }
  if (
    row.recovery_state !== null &&
    !DELIVERY_QUEUE_RECOVERY_STATES.has(row.recovery_state)
  ) {
    throw new Error('delivery_queue_entries contains an unknown recovery state');
  }
  const entry = parseJsonRecord(
    row.entry_json,
    'delivery_queue_entries.entry_json',
  );
  if (
    entry.id !== row.id ||
    Number(entry.enqueuedAt) !== Number(row.enqueued_at) ||
    Number(entry.retryCount) !== Number(row.retry_count) ||
    (entry.recoveryState ?? null) !== row.recovery_state ||
    (entry.platformSendStartedAt ?? null) !== row.platform_send_started_at
  ) {
    throw new Error('delivery_queue_entries indexed fields differ from entry_json');
  }
  for (const [value, label] of [
    [entry.deliveryStartedAt, 'deliveryStartedAt'],
    [entry.platformSendStartedAt, 'platformSendStartedAt'],
  ]) {
    validateOptionalTimestamp(value, `delivery_queue_entries.${label}`);
  }
  if (
    row.platform_send_started_at !== null &&
    (!finiteNumber(row.platform_send_started_at) ||
      row.platform_send_started_at < 0)
  ) {
    throw new Error(
      'delivery_queue_entries.platform_send_started_at is malformed',
    );
  }
  const attemptOwned =
    finiteNumber(entry.deliveryStartedAt) ||
    finiteNumber(entry.platformSendStartedAt) ||
    row.platform_send_started_at !== null ||
    (
      nonEmptyString(entry.platformSendAttemptId) &&
      (
        row.recovery_state === 'send_attempt_started' ||
        row.recovery_state === 'unknown_after_send'
      )
    );
  const retained =
    row.status === 'pending' ||
    (row.status === 'failed' && row.recovery_state === 'settlement_pending');
  if (!retained && attemptOwned) {
    throw new Error('terminal delivery_queue_entries row retains attempt ownership');
  }
  return { entry, retained, attemptOwned };
}

function collectFlowSessionKeys(state, keys) {
  if (!isRecord(state)) return;
  for (const [value, label] of [
    [state.sessionKey, 'sessionKey'],
    [state.childSessionKey, 'childSessionKey'],
    [state.targetSessionKey, 'targetSessionKey'],
  ]) {
    const key = optionalString(value, `flow_runs.state_json.${label}`);
    if (key) keys.add(key);
  }
  for (const key of optionalStringArray(
    state.targetSessionKeys,
    'flow_runs.state_json.targetSessionKeys',
  )) {
    keys.add(key);
  }
}

function collectQueueSessionKeys(row, entry, keys) {
  for (const [value, label] of [
    [row.session_key, 'session_key'],
    [entry.sessionKey, 'entry_json.sessionKey'],
    [entry.targetSessionKey, 'entry_json.targetSessionKey'],
  ]) {
    const key = optionalString(value, `delivery_queue_entries.${label}`);
    if (key) keys.add(key);
  }
  for (const key of optionalStringArray(
    entry.targetSessionKeys,
    'delivery_queue_entries.entry_json.targetSessionKeys',
  )) {
    keys.add(key);
  }
}

function isTemporarySessionEntry(entry, sessionKey, runBoundSessionKeys) {
  const spawnedBy = optionalString(entry.spawnedBy, 'session_nodes.entry_json.spawnedBy');
  const parentSessionKey = optionalString(
    entry.parentSessionKey,
    'session_nodes.entry_json.parentSessionKey',
  );
  const createdVia = entry.createdVia;
  if (createdVia !== undefined && !SESSION_CREATED_VIA.has(createdVia)) {
    throw new Error('session_nodes.entry_json.createdVia is unknown');
  }
  if (
    entry.spawnDepth !== undefined &&
    (
      !Number.isSafeInteger(entry.spawnDepth) ||
      entry.spawnDepth < 0
    )
  ) {
    throw new Error('session_nodes.entry_json.spawnDepth is malformed');
  }
  if (entry.incognito !== undefined) {
    throw new Error('persistent session_nodes entry cannot be incognito');
  }
  const spawned =
    createdVia === 'spawn' ||
    entry.spawnDepth > 0 ||
    spawnedBy !== null;
  const runBound =
    runBoundSessionKeys.has(sessionKey) ||
    (spawnedBy !== null && runBoundSessionKeys.has(spawnedBy)) ||
    (parentSessionKey !== null && runBoundSessionKeys.has(parentSessionKey));
  return spawned && runBound;
}

function inspectGlobalDatabase(snapshotDatabasePath) {
  const db = new DatabaseSync(snapshotDatabasePath, { readOnly: true });
  try {
    db.exec('BEGIN');
    const schema = Object.fromEntries(
      Object.entries(REQUIRED_GLOBAL_COLUMNS).map(([table, columns]) => [
        table,
        requireExactTable(db, table, columns),
      ]),
    );
    requireDatabaseIntegrity(db, 13, { role: 'global', agentId: null });
    const agentDatabases = db.prepare(`
      SELECT agent_id, path, schema_version, last_seen_at, size_bytes
      FROM agent_databases
      ORDER BY agent_id ASC, path ASC
    `).all();
    const flowRows = db.prepare(`
      SELECT
        flow_id, shape, sync_mode, owner_key, chain_id,
        requester_origin_json, controller_id, revision, status,
        notify_policy, goal, current_step, blocked_task_id,
        blocked_summary, state_json, wait_json, cancel_requested_at,
        created_at, updated_at, ended_at
      FROM flow_runs
      ORDER BY created_at ASC, flow_id ASC
    `).all();
    const subagentRows = db.prepare(`
      SELECT
        run_id, child_session_key, controller_session_key,
        requester_session_key, created_at, payload_json
      FROM subagent_runs
      ORDER BY created_at ASC, run_id ASC
    `).all();
    const deliveryRows = db.prepare(`
      SELECT
        queue_name, id, status, entry_kind, session_key, channel,
        target, account_id, retry_count, last_attempt_at, last_error,
        recovery_state, platform_send_started_at, entry_json,
        enqueued_at, updated_at, failed_at
      FROM delivery_queue_entries
      ORDER BY enqueued_at ASC, queue_name ASC, id ASC
    `).all();
    db.exec('COMMIT');
    return { agentDatabases, deliveryRows, flowRows, schema, subagentRows };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Preserve the original read failure.
    }
    throw error;
  } finally {
    db.close();
  }
}

function inspectAgentDatabase(
  snapshotDatabasePath,
  expectedAgentId,
  runBoundSessionKeys,
) {
  const db = new DatabaseSync(snapshotDatabasePath, { readOnly: true });
  try {
    db.exec('BEGIN');
    const schema = Object.fromEntries(
      Object.entries(REQUIRED_AGENT_COLUMNS).map(([table, columns]) => [
        table,
        requireExactTable(db, table, columns),
      ]),
    );
    requireDatabaseIntegrity(db, 19, {
      role: 'agent',
      agentId: expectedAgentId,
    });
    const rows = db.prepare(`
      SELECT
        session_key, current_session_id, entry_json, entry_valid,
        updated_at, status, created_via, parent_session_key, spawned_by
      FROM session_nodes
      ORDER BY session_key ASC
    `).all();
    const temporarySessions = [];
    for (const row of rows) {
      if (
        !nonEmptyString(row.session_key) ||
        !nonEmptyString(row.current_session_id) ||
        row.entry_valid !== 1 ||
        !Number.isSafeInteger(Number(row.updated_at)) ||
        (row.status !== null && !SESSION_STATUSES.has(row.status))
      ) {
        throw new Error('session_nodes contains malformed canonical identity');
      }
      const entry = parseJsonRecord(row.entry_json, 'session_nodes.entry_json');
      if (
        entry.sessionId !== row.current_session_id ||
        entry.updatedAt !== Number(row.updated_at)
      ) {
        throw new Error('session_nodes identity differs from entry_json');
      }
      const spawnedBy = optionalString(
        entry.spawnedBy,
        'session_nodes.entry_json.spawnedBy',
      );
      const parentSessionKey = optionalString(
        entry.parentSessionKey,
        'session_nodes.entry_json.parentSessionKey',
      );
      if (
        (row.spawned_by ?? null) !== spawnedBy ||
        (row.parent_session_key ?? null) !==
          (parentSessionKey ?? spawnedBy)
      ) {
        throw new Error('session_nodes lineage projections differ from entry_json');
      }
      if (isTemporarySessionEntry(entry, row.session_key, runBoundSessionKeys)) {
        temporarySessions.push({
          id: `${expectedAgentId}:${row.session_key}`,
          agentId: expectedAgentId,
          sessionKey: row.session_key,
          sessionId: row.current_session_id,
          spawnedBy,
          parentSessionKey,
          spawnDepth: entry.spawnDepth ?? null,
          entrySha256: sha256(canonicalJson(entry)),
        });
      }
    }
    db.exec('COMMIT');
    return { schema, temporarySessions };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Preserve the original read failure.
    }
    throw error;
  } finally {
    db.close();
  }
}

function canonicalAgentDatabasePath(stateRoot, agentId) {
  return path.join(
    stateRoot,
    'agents',
    agentId,
    'agent',
    'openclaw-agent.sqlite',
  );
}

async function snapshotCanonicalStores({
  statePath,
  snapshotPath,
  testHooks,
}) {
  const stateRoot = path.resolve(statePath);
  const rootReal = await realpath(stateRoot);
  if (rootReal !== stateRoot) {
    throw new Error('isolated state root is not a canonical no-follow path');
  }
  await mkdir(snapshotPath, { mode: 0o700 });
  const snapshotReal = await realpath(snapshotPath);
  const snapshotInfo = await lstat(snapshotReal);
  if (
    snapshotReal !== path.resolve(snapshotPath) ||
    !snapshotInfo.isDirectory() ||
    snapshotInfo.isSymbolicLink() ||
    pathWithin(snapshotReal, rootReal) ||
    pathWithin(rootReal, snapshotReal)
  ) {
    throw new Error('launcher snapshot root is not canonical');
  }
  const openedPaths = [];
  try {
    const stateRootDirectory = await openBoundPath(
      stateRoot,
      rootReal,
      'directory',
    );
    const stateDirectory = await openBoundPath(
      path.join(stateRoot, 'state'),
      rootReal,
      'directory',
    );
    openedPaths.push(stateRootDirectory, stateDirectory);
    const globalSnapshot = await snapshotSqliteFiles({
      databasePath: path.join(stateRoot, 'state', 'openclaw.sqlite'),
      destinationDirectory: path.join(snapshotReal, 'global'),
      rootReal,
      openedPaths,
      testHooks,
    });
    const global = inspectGlobalDatabase(globalSnapshot.snapshotDatabasePath);
    if (
      global.agentDatabases.length < 1 ||
      global.agentDatabases.length > MAX_AGENT_DATABASES
    ) {
      throw new Error('canonical agent database registry is missing or over limit');
    }
    const agentsDirectory = await openBoundPath(
      path.join(stateRoot, 'agents'),
      rootReal,
      'directory',
    );
    openedPaths.push(agentsDirectory);
    const directoryEntries = await readdir(
      path.join(stateRoot, 'agents'),
      { withFileTypes: true },
    );
    if (
      directoryEntries.some((entry) =>
        !entry.isDirectory() || entry.isSymbolicLink()) ||
      directoryEntries.length !== global.agentDatabases.length
    ) {
      throw new Error('isolated agent database layout differs from its registry');
    }
    const registeredAgentIds = global.agentDatabases.map((row) => row.agent_id);
    if (
      registeredAgentIds.some((agentId) => !nonEmptyString(agentId)) ||
      new Set(registeredAgentIds).size !== registeredAgentIds.length ||
      canonicalJson(directoryEntries.map((entry) => entry.name).toSorted()) !==
        canonicalJson([...registeredAgentIds].toSorted())
    ) {
      throw new Error('isolated agent database registry has ambiguous owners');
    }
    const agentSnapshots = [];
    for (const [index, row] of global.agentDatabases.entries()) {
      if (
        Number(row.schema_version) !== 19 ||
        !Number.isSafeInteger(Number(row.last_seen_at)) ||
        (row.size_bytes !== null && !Number.isSafeInteger(Number(row.size_bytes)))
      ) {
        throw new Error('agent_databases contains malformed registry metadata');
      }
      const expectedPath = canonicalAgentDatabasePath(stateRoot, row.agent_id);
      const expectedStoredPath = path.relative(stateRoot, expectedPath);
      if (row.path !== expectedStoredPath) {
        throw new Error('agent_databases contains a noncanonical database locator');
      }
      const agentDirectory = await openBoundPath(
        path.join(stateRoot, 'agents', row.agent_id),
        rootReal,
        'directory',
      );
      const databaseDirectory = await openBoundPath(
        path.dirname(expectedPath),
        rootReal,
        'directory',
      );
      openedPaths.push(agentDirectory, databaseDirectory);
      const snapshot = await snapshotSqliteFiles({
        databasePath: expectedPath,
        destinationDirectory: path.join(snapshotReal, `agent-${index}`),
        rootReal,
        openedPaths,
        testHooks,
      });
      agentSnapshots.push({
        agentId: row.agent_id,
        ...snapshot,
      });
    }
    await Promise.all(openedPaths.map((entry) =>
      revalidateOpenedPath(entry, rootReal)));
    return {
      global,
      globalSnapshot,
      agentSnapshots,
      directoryBinding: {
        stateRoot: stateRootDirectory.identity,
        state: stateDirectory.identity,
        agents: agentsDirectory.identity,
      },
    };
  } finally {
    await closeOpenedPaths(openedPaths);
  }
}

async function readProcessStat(pid) {
  let handle;
  try {
    handle = await open(
      `/proc/${pid}/stat`,
      OPEN_FILE_FLAGS,
    );
    const raw = await handle.readFile({ encoding: 'utf8' });
    const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/u);
    return {
      pid,
      state: fields[0],
      processGroupId: Number(fields[2]),
      startFingerprint: fields[19] ? sha256(`${pid}:${fields[19]}`) : null,
    };
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ESRCH') return null;
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}

async function processGroupSnapshot(processGroupId) {
  const members = [];
  for (const entry of await readdir('/proc')) {
    if (!/^[0-9]+$/u.test(entry)) continue;
    const observation = await readProcessStat(Number(entry));
    if (observation?.processGroupId === processGroupId) {
      members.push(observation);
    }
  }
  return members.toSorted((left, right) => left.pid - right.pid);
}

function signalProcessGroup(processGroupId, signal) {
  try {
    process.kill(-processGroupId, signal);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

async function waitForStoppedProcessGroup(processGroupId) {
  const deadline = Date.now() + PROCESS_QUIESCE_TIMEOUT_MS;
  let previous = null;
  while (Date.now() < deadline) {
    const members = await processGroupSnapshot(processGroupId);
    const fingerprint = sha256(canonicalJson(members));
    if (
      members.length > 0 &&
      members.every((entry) => entry.state === 'T' || entry.state === 't') &&
      previous === fingerprint
    ) {
      return members;
    }
    previous =
      members.every((entry) => entry.state === 'T' || entry.state === 't')
        ? fingerprint
        : null;
    await new Promise((resolve) => setTimeout(resolve, PROCESS_QUIESCE_POLL_MS));
  }
  throw new Error('isolated process group did not reach a stable stopped state');
}

async function sampleRuntimeBinding(runtimeProcess) {
  const [driver, gateway, members] = await Promise.all([
    readProcessStat(runtimeProcess.driver.pid),
    readProcessStat(runtimeProcess.gateway.pid),
    processGroupSnapshot(runtimeProcess.processGroupId),
  ]);
  let listeners = [];
  if (gateway?.startFingerprint === runtimeProcess.gateway.startFingerprint) {
    listeners = await inspectProcessLoopbackListeners(runtimeProcess.gateway.pid);
  }
  return {
    driverStartFingerprint: driver?.startFingerprint ?? null,
    gatewayStartFingerprint: gateway?.startFingerprint ?? null,
    gatewaySocketFingerprint:
      listeners.length > 0 ? sha256(canonicalJson(listeners)) : null,
    gatewayEndpointOwned: listeners.some((entry) =>
      entry.endpoint === runtimeProcess.gateway.endpoint),
    processGroupMembers: members.map((entry) => ({
      pidFingerprint: sha256(String(entry.pid)),
      startFingerprint: entry.startFingerprint,
      state: entry.state,
    })),
  };
}

function runtimeSampleMatches(sample, runtimeProcess, expectedAlive) {
  if (!expectedAlive) {
    return (
      sample.driverStartFingerprint === null &&
      sample.gatewayStartFingerprint === null &&
      sample.gatewaySocketFingerprint === null &&
      sample.gatewayEndpointOwned === false &&
      sample.processGroupMembers.length === 0
    );
  }
  return (
    sample.driverStartFingerprint === runtimeProcess.driver.startFingerprint &&
    sample.gatewayStartFingerprint === runtimeProcess.gateway.startFingerprint &&
    sample.gatewaySocketFingerprint === runtimeProcess.gateway.socketFingerprint &&
    sample.gatewayEndpointOwned === true &&
    sample.processGroupMembers.some((entry) =>
      entry.pidFingerprint === sha256(String(runtimeProcess.driver.pid)) &&
      entry.startFingerprint === runtimeProcess.driver.startFingerprint) &&
    sample.processGroupMembers.some((entry) =>
      entry.pidFingerprint === sha256(String(runtimeProcess.gateway.pid)) &&
      entry.startFingerprint === runtimeProcess.gateway.startFingerprint) &&
    sample.processGroupMembers.every((entry) =>
      entry.state === 'T' || entry.state === 't')
  );
}

function initialRuntimeObservation(runtimeProcess, expectedAlive) {
  return {
    driverPidFingerprint: Number.isInteger(runtimeProcess?.driver?.pid)
      ? sha256(String(runtimeProcess.driver.pid))
      : null,
    gatewayPidFingerprint: Number.isInteger(runtimeProcess?.gateway?.pid)
      ? sha256(String(runtimeProcess.gateway.pid))
      : null,
    processGroupFingerprint: Number.isInteger(runtimeProcess?.processGroupId)
      ? sha256(String(runtimeProcess.processGroupId))
      : null,
    expectedDriverStartFingerprint:
      runtimeProcess?.driver?.startFingerprint ?? null,
    expectedGatewayStartFingerprint:
      runtimeProcess?.gateway?.startFingerprint ?? null,
    expectedGatewaySocketFingerprint:
      runtimeProcess?.gateway?.socketFingerprint ?? null,
    expectedGatewayEndpoint: runtimeProcess?.gateway?.endpoint ?? null,
    expectedAlive,
    before: null,
    after: null,
    quiescence: {
      required: expectedAlive,
      stoppedAt: null,
      resumedAt: null,
      membersStopped: null,
    },
    shutdownSettledAt: runtimeProcess?.shutdownSettledAt ?? null,
    matched: false,
  };
}

function assertRuntimeProcessInput(runtimeProcess, expectedAlive) {
  if (
    !Number.isInteger(runtimeProcess?.processGroupId) ||
    runtimeProcess.processGroupId < 2 ||
    !Number.isInteger(runtimeProcess?.driver?.pid) ||
    runtimeProcess.driver.pid < 2 ||
    !/^[a-f0-9]{64}$/u.test(runtimeProcess.driver.startFingerprint || '') ||
    !Number.isInteger(runtimeProcess?.gateway?.pid) ||
    runtimeProcess.gateway.pid < 2 ||
    !/^[a-f0-9]{64}$/u.test(runtimeProcess.gateway.startFingerprint || '') ||
    !/^[a-f0-9]{64}$/u.test(runtimeProcess.gateway.socketFingerprint || '') ||
    !/^http:\/\/127\.0\.0\.1(?::[0-9]+)?$/u.test(
      runtimeProcess.gateway.endpoint || '',
    ) ||
    (
      !expectedAlive &&
      Number.isNaN(Date.parse(runtimeProcess?.shutdownSettledAt || ''))
    )
  ) {
    throw new Error('trusted runtime process binding is incomplete');
  }
}

function buildResources(global, agentResults) {
  const delegates = [];
  const queueItems = [];
  const runBoundSessionKeys = new Set();
  for (const row of global.subagentRows) {
    const decoded = decodeSubagentRow(row);
    runBoundSessionKeys.add(row.child_session_key.trim());
    runBoundSessionKeys.add(row.requester_session_key.trim());
    if (row.controller_session_key) {
      runBoundSessionKeys.add(row.controller_session_key.trim());
    }
    for (const key of decoded.childSessionKeys) runBoundSessionKeys.add(key);
    if (decoded.retained) {
      delegates.push({
        id: row.run_id,
        childSessionKey: row.child_session_key,
        requesterSessionKey: row.requester_session_key,
        controllerSessionKey: row.controller_session_key,
        executionStatus: decoded.payload.execution.status,
        cleanupCompletedAt: decoded.payload.cleanupCompletedAt ?? null,
        deliveryStatus: decoded.effectiveDeliveryStatus,
        requiredDelivery: decoded.requiredDelivery,
        payloadSha256: sha256(row.payload_json),
      });
    }
  }
  for (const row of global.flowRows) {
    let state = null;
    if (row.state_json !== null) {
      state = parseJsonValue(row.state_json, 'flow_runs.state_json');
    }
    runBoundSessionKeys.add(row.owner_key.trim());
    collectFlowSessionKeys(state, runBoundSessionKeys);
    if (isRetainedFlow(row, state)) {
      queueItems.push({
        id: `flow:${row.flow_id}`,
        source: 'flow_runs',
        ownerKey: row.owner_key,
        controllerId: row.controller_id,
        syncMode: row.sync_mode,
        status: row.status,
        endedAt: row.ended_at,
        stateSha256: sha256(row.state_json ?? 'null'),
      });
    }
  }
  for (const row of global.deliveryRows) {
    const decoded = decodeDeliveryQueueRow(row);
    collectQueueSessionKeys(row, decoded.entry, runBoundSessionKeys);
    if (decoded.retained) {
      queueItems.push({
        id: `delivery:${row.queue_name}:${row.id}`,
        source: 'delivery_queue_entries',
        queueName: row.queue_name,
        status: row.status,
        recoveryState: row.recovery_state,
        sessionKey: row.session_key,
        attemptOwned: decoded.attemptOwned,
        entrySha256: sha256(row.entry_json),
      });
    }
  }
  const inspectedAgents = agentResults.map((result) => ({
    result,
    inspection: inspectAgentDatabase(
      result.snapshotDatabasePath,
      result.agentId,
      runBoundSessionKeys,
    ),
  }));
  const temporarySessions = inspectedAgents.flatMap(({ result, inspection }) =>
    inspection.temporarySessions.map((entry) => ({
      ...entry,
      storePathFingerprint: result.binding.pathFingerprint,
    })));
  return {
    resources: { delegates, queueItems, temporarySessions },
    agentSchemas: inspectedAgents.map(({ inspection }) => inspection.schema),
  };
}

function boundedResources(resources) {
  return Object.values(resources).every((entries) =>
    Array.isArray(entries) &&
    entries.length <= MAX_RESOURCE_COUNT &&
    new Set(entries.map((entry) => entry.id)).size === entries.length);
}

function buildSourceBinding(snapshot, agentSchemas) {
  return {
    method: 'quiesced-opened-file-set-v1',
    productStoreContractSha: RETURN_COVENANT_PRODUCT_STORE_CONTRACT_SHA,
    directoryIdentities: snapshot.directoryBinding,
    databases: [
      {
        kind: 'global',
        agentId: null,
        ...snapshot.globalSnapshot.binding,
        schemaSha256: sha256(canonicalJson(snapshot.global.schema)),
      },
      ...snapshot.agentSnapshots.map((entry, index) => ({
        kind: 'agent',
        agentId: entry.agentId,
        ...entry.binding,
        schemaSha256: sha256(canonicalJson(agentSchemas[index])),
      })),
    ],
  };
}

export async function inspectReturnCovenantDurableStores({
  plan,
  evidence,
  statePath,
  snapshotPath,
  runtimeProcess,
  expectedRuntimeAlive,
  testHooks,
}) {
  const requestedAt = new Date().toISOString();
  const identity = {
    rowId: plan.rowId,
    runId: plan.runId,
    candidateSha: plan.target.candidateSha,
    runtimeBuildSha: plan.target.runtimeBuildSha,
    docsHarnessSha: plan.target.docsHarnessSha,
    runtimeConfigSha256: plan.target.runtimeConfigSha256,
    observationSetSha256: sha256(canonicalJson(evidence.observations)),
    phaseChainSha256: sha256(canonicalJson(evidence.phaseChains)),
    cleanupRunReceiptId: evidence.cleanupRun?.receiptId ?? null,
  };
  const runtimeObservation = initialRuntimeObservation(
    runtimeProcess,
    expectedRuntimeAlive,
  );
  let processGroupStopped = false;
  try {
    assertRuntimeProcessInput(runtimeProcess, expectedRuntimeAlive);
    if (expectedRuntimeAlive) {
      if (!signalProcessGroup(runtimeProcess.processGroupId, 'SIGSTOP')) {
        throw new Error('isolated process group exited before live snapshot');
      }
      processGroupStopped = true;
      const stopped = await waitForStoppedProcessGroup(
        runtimeProcess.processGroupId,
      );
      runtimeObservation.quiescence.stoppedAt = new Date().toISOString();
      runtimeObservation.quiescence.membersStopped = stopped.length;
    }
    runtimeObservation.before = await sampleRuntimeBinding(runtimeProcess);
    if (
      !runtimeSampleMatches(
        runtimeObservation.before,
        runtimeProcess,
        expectedRuntimeAlive,
      )
    ) {
      throw new Error('runtime identity differs before durable-store snapshot');
    }
    const snapshotStartedAt = new Date().toISOString();
    const snapshot = await snapshotCanonicalStores({
      statePath,
      snapshotPath,
      testHooks,
    });
    const global = snapshot.global;
    const { resources, agentSchemas } = buildResources(
      global,
      snapshot.agentSnapshots,
    );
    if (!boundedResources(resources)) {
      throw new Error('isolated retention resource inventory exceeded its bound');
    }
    const sourceBinding = buildSourceBinding(snapshot, agentSchemas);
    const snapshotCompletedAt = new Date().toISOString();
    runtimeObservation.after = await sampleRuntimeBinding(runtimeProcess);
    runtimeObservation.matched =
      runtimeSampleMatches(
        runtimeObservation.after,
        runtimeProcess,
        expectedRuntimeAlive,
      ) &&
      canonicalJson(runtimeObservation.before) ===
        canonicalJson(runtimeObservation.after);
    if (!runtimeObservation.matched) {
      throw new Error('runtime identity changed across durable-store snapshot');
    }
    const observedAt = new Date().toISOString();
    if (processGroupStopped) {
      signalProcessGroup(runtimeProcess.processGroupId, 'SIGCONT');
      processGroupStopped = false;
      runtimeObservation.quiescence.resumedAt = new Date().toISOString();
    }
    return {
      schema: RETURN_COVENANT_STORE_OBSERVATION_SCHEMA,
      status: 'observed',
      failureReason: null,
      source: 'docs-owned-isolated-durable-store-reader',
      runtimeAlive: expectedRuntimeAlive,
      runtimeProcess: runtimeObservation,
      requestedAt,
      snapshotStartedAt,
      snapshotCompletedAt,
      observedAt,
      identity,
      resources,
      sourceBinding,
      rawSnapshotSha256: sha256(canonicalJson({
        identity,
        resources,
        runtimeProcess: runtimeObservation,
        source: sourceBinding,
      })),
    };
  } catch (error) {
    if (processGroupStopped) {
      signalProcessGroup(runtimeProcess?.processGroupId, 'SIGCONT');
      processGroupStopped = false;
      runtimeObservation.quiescence.resumedAt = new Date().toISOString();
    }
    return {
      schema: RETURN_COVENANT_STORE_OBSERVATION_SCHEMA,
      status: 'unverified-resource-retention',
      failureReason: String(error?.message || error).slice(0, 500),
      source: 'docs-owned-isolated-durable-store-reader',
      runtimeAlive: expectedRuntimeAlive,
      runtimeProcess: runtimeObservation,
      requestedAt,
      snapshotStartedAt: null,
      snapshotCompletedAt: null,
      observedAt: new Date().toISOString(),
      identity,
      resources: {
        delegates: null,
        queueItems: null,
        temporarySessions: null,
      },
      sourceBinding: null,
      rawSnapshotSha256: null,
    };
  }
}
