import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredDepth, evaluateTarget, fingerprint } from './target-readiness.mjs';

const ws = 'ws://127.0.0.1:19893';
const ready = () => ({ wsUrl: ws, expectedFingerprint: fingerprint(ws), observedDepth: 5, requiredDepth: 2, expectedDepth: 5, rpcReachable: true });
test('A: target depth is authoritative over runner state', () => assert.equal(evaluateTarget(ready()).pass, true));
test('B: unknown target depth fails before row traffic', () => assert.ok(evaluateTarget({ ...ready(), observedDepth: null }).notes.includes('configured-depth-unknown')));
test('C: insufficient target depth fails before row traffic', () => assert.ok(evaluateTarget({ ...ready(), observedDepth: 1 }).notes.includes('configured-depth-insufficient')));
test('D: wrong target fingerprint fails before row traffic', () => assert.ok(evaluateTarget({ ...ready(), expectedFingerprint: fingerprint('ws://127.0.0.1:19894') }).notes.includes('gateway-fingerprint-mismatch')));
test('only explicit target config depth counts', () => {
  assert.equal(configuredDepth({ config: { agents: { defaults: { subagents: { maxSpawnDepth: 5 } } } } }), 5);
  assert.equal(configuredDepth({ config: { agents: {} } }), null);
});
