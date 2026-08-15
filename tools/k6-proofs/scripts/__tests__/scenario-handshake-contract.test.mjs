import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const scenariosDir = path.join(repoRoot, 'tools/k6-proofs/scenarios');

/**
 * Read-only inventory rows whose open handler is an ordered request *sequence*,
 * not a single handshake guard. Converting them would reorder their probes for
 * no gain, so they are deliberately excluded and named here rather than being
 * silently inconsistent. Severable follow-up, not an oversight.
 */
const HANDSHAKE_EXEMPT = new Set([
  'preflight.js',
  'r-config-defaults.js',
  'r-config-intersession.js',
]);

const scenarios = readdirSync(scenariosDir)
  .filter((file) => file.endsWith('.js'))
  .sort()
  .map((file) => ({ file, source: readFileSync(path.join(scenariosDir, file), 'utf8') }));

const websocketRows = scenarios.filter(({ source }) => source.includes("from '../lib/gateway-ws.js'"));

test('the scenario catalog is non-empty and includes the websocket proof rows', () => {
  assert.ok(scenarios.length >= 30, `expected the full catalog, found ${scenarios.length}`);
  assert.ok(websocketRows.length >= 20, `expected the websocket rows, found ${websocketRows.length}`);
});

test('no scenario reintroduces the inline disposable-key derivation', () => {
  const offenders = scenarios
    .filter(({ source }) => /toLowerCase\(\)\.replace\(\/\[\^a-z0-9-\]\/g/.test(source))
    .map(({ file }) => file);
  assert.deepEqual(offenders, [], 'session and task names must come from lib/proof-session.js');
});

test('no scenario reintroduces an inline redacted-event push', () => {
  const offenders = scenarios
    .filter(({ source }) => source.includes('evidence.redacted_events.push('))
    .map(({ file }) => file);
  assert.deepEqual(offenders, [], 'evidence records must go through recordClassifiedEvent');
});

test('every websocket proof row starts on the tracked connect acknowledgement', () => {
  for (const { file, source } of websocketRows) {
    if (HANDSHAKE_EXEMPT.has(file)) continue;
    assert.ok(
      source.includes("from '../lib/proof-session.js'"),
      `${file} must import the shared session helpers`,
    );
    assert.ok(
      /new GatewayHandshake\(\{/.test(source),
      `${file} must construct a GatewayHandshake`,
    );
    assert.ok(
      /handshake\.begin\(socket, token\)/.test(source),
      `${file} must send its connect through the tracked handshake`,
    );
    assert.ok(
      /handshake\.observe\(classified\)/.test(source),
      `${file} must offer classified frames to the handshake`,
    );
    assert.ok(
      !/socket\.send\(connectFrame\(/.test(source),
      `${file} must not send an untracked connect frame; the ack would be uncorrelatable`,
    );
  }
});

test('the handshake fallback preserves the original guard budget, never extends it', () => {
  for (const { file, source } of websocketRows) {
    if (HANDSHAKE_EXEMPT.has(file)) continue;
    const match = source.match(/fallbackMs:\s*(\d+)/);
    assert.ok(match, `${file} must declare an explicit handshake fallback`);
    const fallbackMs = Number(match[1]);
    assert.ok(
      fallbackMs > 0 && fallbackMs <= 500,
      `${file} fallback ${fallbackMs}ms exceeds the 500ms guard the row used before`,
    );
  }
});

test('no proof row waits on a fixed sleep for a response it already receives', () => {
  // The connect guard was the last fixed sleep standing in for an observable
  // response. Any new `socket.setTimeout(..., <=500)` inside an open handler
  // would be that same race returning.
  for (const { file, source } of websocketRows) {
    if (HANDSHAKE_EXEMPT.has(file)) continue;
    const open = source.match(/socket\.on\('open',[\s\S]{0,400}?\n\s*\}\);/);
    assert.ok(open, `${file} must have a recognizable open handler`);
    assert.ok(
      !/socket\.setTimeout\(/.test(open[0]),
      `${file} open handler must not re-arm a fixed pre-dispatch delay`,
    );
  }
});

test('exempt rows are read-only inventory rows, not proof rows', () => {
  for (const file of HANDSHAKE_EXEMPT) {
    const scenario = scenarios.find((entry) => entry.file === file);
    assert.ok(scenario, `${file} is listed exempt but is not in the catalog`);
    assert.ok(
      !/sessions\.send/.test(scenario.source),
      `${file} dispatches a turn and therefore cannot stay handshake-exempt`,
    );
  }
});
