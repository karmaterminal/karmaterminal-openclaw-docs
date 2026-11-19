// The ownership record behind the token budget's cutoff (🌊, Discord
// 1573086211386384495): a budgeted row's k6 logs, at creation, the key and
// session id the gateway answered its sessions.create with, tagged with the
// run's private tag. These tests cover the record's shape and parsing, the
// real RequestTracker logging it inside a real scenario (k6 runtime stubbed),
// an unbudgeted run logging nothing, and the public k6.log never carrying it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  OWNERSHIP_MARKER,
  isOwnershipTag,
  ownershipRecordLine,
  parseOwnershipRecords,
} from '../../lib/session-ownership.mjs';
import { recordSessionOwnership } from '../../lib/gateway-ws.js';
import { runK6Scenario } from '../../tests/helpers/k6-node-runtime.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const TAG = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const OTHER_TAG = '0'.repeat(32);
const KEY = 'agent:main:r-cw-1-r-cw-1-1763500000000-abcdef12';
const SESSION_ID = '5f0c2f7e-0d7b-4c39-9d43-3c1f2b8a9e10';
const k6Line = (message) => `time="2026-11-19T00:00:00.000Z" level=info msg=${JSON.stringify(message)} source=console`;

test('a record is written only with a run tag and a session key; its session id is kept or null', () => {
  assert.equal(isOwnershipTag(TAG), true);
  for (const bad of [undefined, '', 'A1B2C3D4E5F60718293A4B5C6D7E8F90', `${TAG}0`, TAG.slice(1)]) assert.equal(isOwnershipTag(bad), false, String(bad));
  assert.equal(ownershipRecordLine(undefined, { key: KEY, sessionId: SESSION_ID }), null, 'no tag: an unbudgeted run logs nothing');
  assert.equal(ownershipRecordLine('not-a-tag', { key: KEY, sessionId: SESSION_ID }), null);
  assert.equal(ownershipRecordLine(TAG, { sessionId: SESSION_ID }), null, 'no key: nothing to own');
  assert.equal(ownershipRecordLine(TAG, null), null);
  assert.equal(ownershipRecordLine(TAG, { key: KEY, sessionId: SESSION_ID, entry: { label: 'k6 R-CW-1 nonce' } }), `${OWNERSHIP_MARKER} ${TAG} {"key":"${KEY}","sessionId":"${SESSION_ID}"}`);
  assert.equal(ownershipRecordLine(TAG, { key: KEY }), `${OWNERSHIP_MARKER} ${TAG} {"key":"${KEY}","sessionId":null}`);
});

test('only a message that starts with the marker and carries the run tag is a record; a foreign tag or a broken record is rejected', () => {
  const log = [
    k6Line(ownershipRecordLine(TAG, { key: KEY, sessionId: SESSION_ID })),
    ownershipRecordLine(TAG, { key: 'agent:main:bare-line', sessionId: 'bare' }),
    k6Line(ownershipRecordLine(OTHER_TAG, { key: 'agent:main:main', sessionId: 'prince' })),
    k6Line(`assistant said: ${ownershipRecordLine(TAG, { key: 'agent:main:main', sessionId: 'prince' })}`),
    k6Line(`${OWNERSHIP_MARKER} ${TAG} {not json`),
    k6Line(`${OWNERSHIP_MARKER} ${TAG} {"sessionId":"no-key"}`),
    k6Line(`${OWNERSHIP_MARKER} ${TAG} {"key":"agent:main:x","sessionId":7}`),
    k6Line('✓ disposable session created: agent:main:x'),
  ].join('\n');
  assert.deepEqual(parseOwnershipRecords(log, TAG), {
    records: [{ key: KEY, sessionId: SESSION_ID }, { key: 'agent:main:bare-line', sessionId: 'bare' }],
    rejected: 4,
  });
  assert.deepEqual(parseOwnershipRecords(log, undefined).records, [], 'without the run tag nothing is a record');
});

test('recordSessionOwnership logs through console only when the run armed a tag', () => {
  const logged = [];
  const original = console.log;
  console.log = (line) => logged.push(line);
  try {
    assert.equal(recordSessionOwnership({ key: KEY, sessionId: SESSION_ID }, {}), null);
    assert.equal(recordSessionOwnership({ key: KEY, sessionId: SESSION_ID }, { OPENCLAW_PROOFS_OWNERSHIP_TAG: TAG }), logged[0]);
  } finally {
    console.log = original;
  }
  assert.equal(logged.length, 1);
  assert.deepEqual(parseOwnershipRecords(logged[0], TAG).records, [{ key: KEY, sessionId: SESSION_ID }]);
});

/** R-CW-1, whose disposable session the gateway answers with `createAnswer`. */
async function fireRcw1({ tag, createAnswer }) {
  const gateway = (frame) => {
    if (frame?.type !== 'req') return [];
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: [] } });
      case 'sessions.create': return [{ type: 'res', id: frame.id, ...createAnswer }];
      case 'sessions.messages.subscribe': return ok({ subscribed: true });
      case 'sessions.send': return ok({ runId: 'run-d' });
      case 'chat.history': return ok({ messages: [], hasMore: false });
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
  const { log } = await runK6Scenario({
    scenarioPath: path.join(root, 'scenarios', 'r-cw-1-tool-schedule-wake.js'),
    gateway,
    env: {
      OPENCLAW_GATEWAY_TOKEN: 'ownership-test-token',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
      OPENCLAW_CANDIDATE_SHA: 'b'.repeat(40),
      OPENCLAW_SEAT_NAME: 'ownership-test',
      OPENCLAW_SESSION_KEY: 'agent:main:main',
      OPENCLAW_CREATE_DISPOSABLE_SESSION: 'true',
      ...(tag ? { OPENCLAW_PROOFS_OWNERSHIP_TAG: tag } : {}),
    },
  });
  return log;
}

test('a real scenario\'s RequestTracker logs one ownership record when its sessions.create is answered', async () => {
  const log = await fireRcw1({ tag: TAG, createAnswer: { ok: true, payload: { ok: true, key: KEY, sessionId: SESSION_ID, entry: { sessionId: SESSION_ID } } } });
  assert.deepEqual(parseOwnershipRecords(log, TAG), { records: [{ key: KEY, sessionId: SESSION_ID }], rejected: 0 });
});

test('an unbudgeted scenario logs no record, and a refused create logs none either', async () => {
  const unbudgeted = await fireRcw1({ tag: null, createAnswer: { ok: true, payload: { ok: true, key: KEY, sessionId: SESSION_ID } } });
  assert.ok(!unbudgeted.includes(OWNERSHIP_MARKER), 'no tag, no record: the unbudgeted k6 output is unchanged');
  const refused = await fireRcw1({ tag: TAG, createAnswer: { ok: false, error: { code: 'INVALID_REQUEST', message: 'invalid key' } } });
  assert.deepEqual(parseOwnershipRecords(refused, TAG), { records: [], rejected: 0 });
});

test('the public k6.log replaces every ownership record, and the tag never survives anywhere in it', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'token-budget-ownership-'));
  try {
    const files = Object.fromEntries(['evidence', 'out', 'lines', 'receipt', 'log', 'logOut'].map((name) => [name, path.join(dir, name)]));
    await writeFile(files.evidence, '{"row":"R-CW-1"}\n');
    await writeFile(files.log, [
      k6Line('✓ disposable session created'),
      k6Line(ownershipRecordLine(TAG, { key: KEY, sessionId: SESSION_ID })),
      k6Line(`${OWNERSHIP_MARKER} ${OTHER_TAG} {"key":"agent:main:main","sessionId":"prince"}`),
      k6Line(`some later line that happens to quote the tag ${TAG}`),
    ].join('\n'));
    await run(process.execPath, [
      path.join(root, 'scripts/sanitize-k6-artifacts.mjs'),
      '--input', files.evidence, '--out', files.out, '--lines-out', files.lines, '--receipt-out', files.receipt,
      '--log-input', files.log, '--log-out', files.logOut,
    ], { env: { PATH: process.env.PATH, OPENCLAW_PROOFS_OWNERSHIP_TAG: TAG } });
    const publicLog = await readFile(files.logOut, 'utf8');
    assert.equal(publicLog.split('\n').filter((line) => line === `${OWNERSHIP_MARKER} <redacted-ownership-record>`).length, 2);
    for (const secret of [TAG, SESSION_ID, 'r-cw-1-1763500000000', 'prince']) assert.ok(!publicLog.includes(secret), `public k6.log carries ${secret}`);
    assert.match(publicLog, /<redacted-ownership-tag>/u);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('review F9: k6\'s JSON log format is read for records, and the sanitizer never publishes one', async () => {
  const jsonLine = (message) => JSON.stringify({ level: 'info', msg: message, source: 'console', time: '2026-11-19T00:00:00Z' });
  const log = [jsonLine(ownershipRecordLine(TAG, { key: KEY, sessionId: SESSION_ID })), jsonLine(`${OWNERSHIP_MARKER} ${OTHER_TAG} {"key":"agent:main:main","sessionId":"prince"}`)].join('\n');
  assert.deepEqual(parseOwnershipRecords(log, TAG), { records: [{ key: KEY, sessionId: SESSION_ID }], rejected: 1 });
  const dir = await mkdtemp(path.join(tmpdir(), 'token-budget-ownership-json-'));
  try {
    const files = Object.fromEntries(['evidence', 'out', 'lines', 'receipt', 'log', 'logOut'].map((name) => [name, path.join(dir, name)]));
    await writeFile(files.evidence, '{"row":"R-CW-1"}\n');
    await writeFile(files.log, log);
    await run(process.execPath, [
      path.join(root, 'scripts/sanitize-k6-artifacts.mjs'),
      '--input', files.evidence, '--out', files.out, '--lines-out', files.lines, '--receipt-out', files.receipt,
      '--log-input', files.log, '--log-out', files.logOut,
    ], { env: { PATH: process.env.PATH } });
    const publicLog = await readFile(files.logOut, 'utf8');
    for (const secret of [SESSION_ID, 'r-cw-1-1763500000000', 'prince', TAG]) assert.ok(!publicLog.includes(secret), `public k6.log carries ${secret}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
