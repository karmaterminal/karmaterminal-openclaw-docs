import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  lstat,
  open,
  readdir,
  realpath,
} from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { canonicalJson } from './canonical-json.mjs';

export const RETURN_COVENANT_STORE_OBSERVATION_SCHEMA =
  'openclaw.k6.return-covenant-store-observation.v1';

const MAX_STORE_BYTES = 4 * 1024 * 1024;
const MAX_RESOURCE_COUNT = 100;
const CONTINUATION_CONTROLLERS = new Set([
  'core/continuation-delegate',
  'core/continuation-post-compaction',
  'core/continuation-work',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function pathWithin(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function inspectRegularFile(file, root, maxBytes = MAX_STORE_BYTES) {
  const [rootReal, info, fileReal] = await Promise.all([
    realpath(root),
    lstat(file),
    realpath(file),
  ]);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    fileReal !== file ||
    !pathWithin(fileReal, rootReal) ||
    info.size < 1 ||
    info.size > maxBytes
  ) {
    throw new Error(`retention store is not a bounded contained regular file: ${file}`);
  }
  return { info, fileReal };
}

async function readBoundedJson(file, root) {
  const before = await inspectRegularFile(file, root);
  const handle = await open(
    file,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.dev !== before.info.dev ||
      opened.ino !== before.info.ino
    ) {
      throw new Error(`retention store changed before read: ${file}`);
    }
    const bytes = await handle.readFile();
    const after = await lstat(file);
    if (
      bytes.length > MAX_STORE_BYTES ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.mtimeMs !== opened.mtimeMs
    ) {
      throw new Error(`retention store changed during read: ${file}`);
    }
    return {
      value: JSON.parse(bytes.toString('utf8')),
      source: {
        pathFingerprint: sha256(before.fileReal),
        dev: String(opened.dev),
        ino: String(opened.ino),
        size: opened.size,
        mtimeMs: opened.mtimeMs,
        sha256: sha256(bytes),
      },
    };
  } finally {
    await handle.close();
  }
}

async function findSessionStores(statePath) {
  const agentsPath = path.join(statePath, 'agents');
  const agents = await readdir(agentsPath, { withFileTypes: true });
  const stores = [];
  for (const agent of agents) {
    if (!agent.isDirectory() || agent.isSymbolicLink()) continue;
    const file = path.join(agentsPath, agent.name, 'sessions', 'sessions.json');
    try {
      await inspectRegularFile(file, statePath);
      stores.push(file);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  if (stores.length === 0 || stores.length > 128) {
    throw new Error('isolated session-store inventory is missing or over limit');
  }
  return stores.toSorted();
}

function requireColumns(db, table, expected) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  const names = new Set(rows.map((row) => row.name));
  if (expected.some((name) => !names.has(name))) {
    throw new Error(`${table} does not expose the canonical retention columns`);
  }
  return rows.map((row) => ({
    name: row.name,
    type: row.type,
    notnull: row.notnull,
    pk: row.pk,
  }));
}

function relevantSessionKeys(plan) {
  return new Set(plan.cases.map((entry) => entry.logicalSessionKey));
}

function isRelevantSubagent(row, keys, runPrefix) {
  return [
    row.requester_session_key,
    row.controller_session_key,
    row.child_session_key,
  ].some((value) =>
    keys.has(value) ||
    (typeof value === 'string' && value.includes(runPrefix)));
}

function retainedSubagent(row) {
  return row.ended_at === null ||
    row.cleanup_handled !== 1 ||
    row.pending_final_delivery === 1;
}

function boundedResources(resources) {
  return Object.values(resources).every((entries) =>
    Array.isArray(entries) && entries.length <= MAX_RESOURCE_COUNT);
}

export async function inspectReturnCovenantDurableStores({
  plan,
  evidence,
  statePath,
  runtimeAlive,
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
  try {
    const stateReal = await realpath(statePath);
    const databasePath = path.join(stateReal, 'state', 'openclaw.sqlite');
    const before = await inspectRegularFile(
      databasePath,
      stateReal,
      128 * 1024 * 1024,
    );
    const db = new DatabaseSync(databasePath, { readOnly: true });
    let flowSchema;
    let subagentSchema;
    let flowRows;
    let subagentRows;
    try {
      db.exec('BEGIN');
      flowSchema = requireColumns(db, 'flow_runs', [
        'flow_id',
        'owner_key',
        'controller_id',
        'status',
        'state_json',
      ]);
      subagentSchema = requireColumns(db, 'subagent_runs', [
        'run_id',
        'child_session_key',
        'controller_session_key',
        'requester_session_key',
        'ended_at',
        'cleanup_handled',
        'pending_final_delivery',
      ]);
      flowRows = db.prepare(`
        SELECT flow_id, owner_key, controller_id, status, state_json
        FROM flow_runs
        ORDER BY created_at ASC, flow_id ASC
      `).all();
      subagentRows = db.prepare(`
        SELECT
          run_id,
          child_session_key,
          controller_session_key,
          requester_session_key,
          ended_at,
          cleanup_handled,
          pending_final_delivery
        FROM subagent_runs
        ORDER BY created_at ASC, run_id ASC
      `).all();
      db.exec('COMMIT');
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // The original read failure remains authoritative.
      }
      throw error;
    } finally {
      db.close();
    }
    const after = await lstat(databasePath);
    if (
      after.dev !== before.info.dev ||
      after.ino !== before.info.ino
    ) {
      throw new Error('isolated SQLite store changed identity during observation');
    }

    const keys = relevantSessionKeys(plan);
    const runPrefix = plan.runId;
    const relevantSubagents = subagentRows.filter((row) =>
      isRelevantSubagent(row, keys, runPrefix));
    const delegates = relevantSubagents
      .filter(retainedSubagent)
      .map((row) => ({
        id: row.run_id,
        childSessionKey: row.child_session_key,
        requesterSessionKey: row.requester_session_key,
        controllerSessionKey: row.controller_session_key,
        endedAt: row.ended_at,
        cleanupHandled: row.cleanup_handled,
        pendingFinalDelivery: row.pending_final_delivery,
      }));
    const queueItems = flowRows
      .filter((row) =>
        keys.has(row.owner_key) &&
        CONTINUATION_CONTROLLERS.has(row.controller_id) &&
        (row.status === 'queued' || row.status === 'running'))
      .map((row) => ({
        id: row.flow_id,
        ownerKey: row.owner_key,
        controllerId: row.controller_id,
        status: row.status,
        stateSha256: sha256(row.state_json || ''),
      }));

    const childSessionKeys = new Set(
      relevantSubagents.map((row) => row.child_session_key),
    );
    const sessionSources = [];
    const temporarySessions = [];
    for (const file of await findSessionStores(stateReal)) {
      const store = await readBoundedJson(file, stateReal);
      if (
        !store.value ||
        typeof store.value !== 'object' ||
        Array.isArray(store.value)
      ) {
        throw new Error(`isolated session store has an invalid shape: ${file}`);
      }
      sessionSources.push(store.source);
      for (const [sessionKey, entry] of Object.entries(store.value)) {
        if (
          keys.has(sessionKey) ||
          childSessionKeys.has(sessionKey) ||
          sessionKey.includes(runPrefix)
        ) {
          temporarySessions.push({
            id: sessionKey,
            entrySha256: sha256(canonicalJson(entry)),
            storePathFingerprint: store.source.pathFingerprint,
          });
        }
      }
    }
    const resources = { delegates, queueItems, temporarySessions };
    if (
      !boundedResources(resources) ||
      Object.values(resources).some((entries) =>
        new Set(entries.map((entry) => entry.id)).size !== entries.length)
    ) {
      throw new Error('isolated retention resource inventory exceeded its bound');
    }
    const observedAt = new Date().toISOString();
    const source = {
      sqlite: {
        pathFingerprint: sha256(databasePath),
        dev: String(after.dev),
        ino: String(after.ino),
        size: after.size,
        mtimeMs: after.mtimeMs,
        schemaSha256: sha256(canonicalJson({
          flow_runs: flowSchema,
          subagent_runs: subagentSchema,
        })),
      },
      sessionStores: sessionSources,
    };
    return {
      schema: RETURN_COVENANT_STORE_OBSERVATION_SCHEMA,
      status: 'observed',
      failureReason: null,
      source: 'docs-owned-isolated-durable-store-reader',
      runtimeAlive,
      requestedAt,
      observedAt,
      identity,
      resources,
      sourceBinding: source,
      rawSnapshotSha256: sha256(canonicalJson({
        identity,
        resources,
        source,
      })),
    };
  } catch (error) {
    return {
      schema: RETURN_COVENANT_STORE_OBSERVATION_SCHEMA,
      status: 'unverified-resource-retention',
      failureReason: String(error?.message || error).slice(0, 500),
      source: 'docs-owned-isolated-durable-store-reader',
      runtimeAlive,
      requestedAt,
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
