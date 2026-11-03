// R-CD-RECIPIENT-AUTHORITY dry run against the mock-gateway pattern (helpers/k6-node-runtime.mjs).
//
// The real case driver (scenarios/r-cd-recipient-authority.js) runs in Node against a scripted
// gateway shaped like j12's public surface: hello-ok, sessions.*, session.visibility.set,
// session.members.*, config.get/patch, chat.history with Tool Search dispatch_action rows. The
// control's own assembleCaseRecord then joins the evidence with scripted gateway log lines and an
// epoch timeline, and lib/recipient-authority-row.mjs grades it. No gateway, no model, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { assembleCaseRecord } from '../scripts/run-recipient-authority-row.mjs';
import { RRA_CASES, RRA_CASE_IDS, RRA_J12, RRA_ROW, gradeRecipientAuthorityCase, scenarioMethodsFor } from '../lib/recipient-authority-row.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN = 'rra-0123456789abcdef';
const CHILD = 'agent:main:subagent:continuation-rra-child';
const ALL_METHODS = [...new Set(RRA_CASE_IDS.flatMap((caseId) => scenarioMethodsFor(caseId)))];

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId } });
const toolCall = (id, name, args, runId) => ({ role: 'assistant', content: [{ type: 'toolCall', id, name, arguments: args }], __openclaw: { runId } });
const toolResult = (id, name, payload, runId, isError = false) => ({
  role: 'toolResult', toolCallId: id, toolName: name, isError,
  content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }], __openclaw: { runId },
});

/**
 * A scripted j12-shaped gateway. world: { caseId, ack: 'wake'|'none', adoptOnProbe, noIdentity }.
 * Allowed cases get the woken target's ack after their (last) priming; refused cases spawn a child
 * only when the delegate would have fired.
 */
function gatewayFor(world) {
  const spec = RRA_CASES[world.caseId];
  const sessions = {};
  const push = (key, message) => {
    sessions[key] ??= { messages: [] };
    sessions[key].messages.push(message);
  };
  let policy = 'enabled';
  let nonce = null;
  let parentKey = null;
  let primes = 0;
  let ackDue = false;
  let childSpawned = false;
  return (frame) => {
    if (frame?.type !== 'req') return [];
    const p = frame.params || {};
    const ok = (payload) => [{ type: 'res', id: frame.id, ok: true, payload }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: ALL_METHODS } });
      case 'sessions.create': sessions[p.key] = { messages: [] }; return ok({ key: p.key });
      // The sharing methods' params are closed objects keyed by sessionKey at j12
      // (packages/gateway-protocol/src/schema/sessions-sharing.ts:29-37, 62, 115-120).
      case 'session.members.list': case 'session.members.add': case 'session.members.remove': case 'session.visibility.set': {
        if (typeof p.sessionKey !== 'string' || 'key' in p) {
          return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `invalid ${frame.method} params: unexpected property` } }];
        }
        if (frame.method === 'session.members.list') return ok({ sessionKey: p.sessionKey, identities: world.noIdentity ? [] : [{ type: 'agent', id: 'main' }] });
        return ok({ ok: true, sessionKey: p.sessionKey });
      }
      case 'sessions.delete': return ok({ ok: true });
      case 'sessions.reset': sessions[p.key] = { messages: [] }; return ok({ ok: true, key: p.key });
      case 'config.get': return ok({ hash: 'config-hash-1' });
      case 'config.patch': {
        if (world.patchFails) return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: 'config base hash required; re-run config.get and retry' } }];
        policy = JSON.parse(p.raw).agents.defaults.continuation.crossSessionTargeting;
        return ok({ ok: true });
      }
      case 'sessions.send': {
        const message = String(p.message || '');
        const priming = /priming (\S+)\./.exec(message);
        if (priming) {
          nonce = priming[1];
          const runId = `run-prime-${primes++}`;
          push(p.key, user(message));
          push(p.key, say(`TARGET-READY ${nonce}`, runId));
          return ok({ runId });
        }
        const probe = /probe (\S+):/.exec(message);
        if (probe) {
          // A parked return adopted into the probe turn: the product's marker on the visible user row
          // (managed-delivery-turn-lifecycle.ts:107-111) and the primed target's ack in the probe run.
          const adopts = world.adoptOnProbe || (spec.probeAdopts && childSpawned);
          push(p.key, { ...user(message), __openclaw: { runId: 'run-probe', ...(adopts ? { sessionDeliveryAckIds: ['q-1'] } : {}) } });
          push(p.key, say(adopts && !world.markerOnly ? `TARGET-ACK ${nonce}` : `PROBE-OK ${probe[1]}`, 'run-probe'));
          return ok({ runId: 'run-probe' });
        }
        if (message.includes('assign_owner')) {
          const sessionKey = /sessionKey:"([^"]+)"/.exec(message)[1];
          push(p.key, toolCall('o1', 'dispatch_action', { id: 'openclaw:core:sessions', args: { action: 'assign_owner', sessionKey, ownerType: 'agent', ownerId: 'main' } }, 'run-ops'));
          push(p.key, toolResult('o1', 'dispatch_action', { status: 'updated' }, 'run-ops'));
          return ok({ runId: 'run-ops' });
        }
        const task = /task:"([\s\S]*?)", mode:/.exec(message)[1];
        const mode = /mode:"([^"]+)"/.exec(message)[1];
        const targetSessionKey = /targetSessionKey:"([^"]+)"/.exec(message)[1];
        parentKey = p.key;
        push(p.key, toolCall('c1', 'dispatch_action', { id: 'openclaw:core:continue_delegate', args: { task, mode, delaySeconds: 30, targetSessionKey } }, 'run-d'));
        if (policy === 'disabled') {
          push(p.key, toolResult('c1', 'dispatch_action', 'cross-session continuation targeting is disabled by agents.defaults.continuation.crossSessionTargeting. Use the default return target.', 'run-d', true));
          return ok({ runId: 'run-d' });
        }
        push(p.key, toolResult('c1', 'dispatch_action', { status: 'scheduled', mode }, 'run-d'));
        if (spec.expectChild !== false) {
          childSpawned = true;
          sessions[CHILD] = { messages: [user(`[Subagent Task]\n\n${task}`)] };
        }
        ackDue = spec.family === 'allowed' && !spec.probeAdopts && world.ack !== 'none';
        return ok({ runId: 'run-d' });
      }
      case 'sessions.list':
        return ok({ sessions: p.spawnedBy === parentKey && childSpawned ? [{ key: CHILD, spawnedBy: parentKey, status: 'done' }] : [] });
      case 'chat.history': {
        // The woken target acknowledges once its current head was primed after the dispatch.
        if (ackDue && p.sessionKey !== parentKey && sessions[p.sessionKey]?.messages.some((m) => /TARGET-READY/.test(m.content?.[0]?.text || '')) && primes >= (spec.reprime ? 2 : 1)) {
          push(p.sessionKey, say(`TARGET-ACK ${nonce}`, 'run-wake'));
          ackDue = false;
        }
        return ok({ messages: sessions[p.sessionKey]?.messages || [] });
      }
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(caseId, world = {}, { phase = 'drive', state = null, env = {}, gateway = gatewayFor({ caseId, ...world }) } = {}) {
  // Wall-clock stamps the scenario takes must order like the virtual timers it schedules.
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => (clock += 10);
  try {
    const { log, frames } = await runK6Scenario({
      scenarioPath: path.join(root, 'scenarios', 'r-cd-recipient-authority.js'),
      gateway,
      env: {
        OPENCLAW_ROW_MANIFEST: path.join(root, 'manifests', 'r-cd-recipient-authority.json'),
        OPENCLAW_GATEWAY_TOKEN: 'disposable-gateway-token-0123456789',
        OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:1',
        OPENCLAW_CANDIDATE_SHA: RRA_J12,
        OPENCLAW_RCD_RA_CASE: caseId,
        OPENCLAW_RCD_RA_RUN: RUN,
        OPENCLAW_RCD_RA_PHASE: phase,
        OPENCLAW_RCD_RA_POLL_MS: '1000',
        OPENCLAW_RCD_RA_WINDOW_MS: '5000',
        ...(state ? { OPENCLAW_RCD_RA_STATE: JSON.stringify(state) } : {}),
        ...env,
      },
    });
    const records = extractEvidence(log).filter((record) => record.row === RRA_ROW);
    assert.equal(records.length, 1, log);
    return { evidence: records[0], frames, log };
  } finally {
    Date.now = realNow;
  }
}

/** What the control would have seen around the case: product log lines, epochs, generations. */
function harnessFor(caseId, drive, { reason = true } = {}) {
  const spec = RRA_CASES[caseId];
  const { target, parent } = drive.keys;
  const transition = drive.transition || {};
  const capturedAt = drive.dispatch?.observed_at_ms ?? 1;
  const transitionAt = transition.requested_at_ms ?? capturedAt + 5;
  const settledAt = transition.settled_at_ms ?? transitionAt + 1;
  const restartedAtMs = spec.restart ? settledAt + 5 : null;
  const durable = spec.family === 'refusal' && spec.expectChild !== false;
  const logEntries = [];
  if (spec.expectChild !== false) logEntries.push({ atMs: transitionAt - 1, text: `[continuation:targeted-return] Delivered to ${target} from ${CHILD}`, generation: 0 });
  if (reason && spec.reasonKind === 'dispatch-policy') {
    logEntries.push({ atMs: transitionAt + 3, text: `[continuation:delegate-rejected] policy.cross_session_targeting task=RCDRA session=${parent}`, generation: 0 });
  }
  if (reason && spec.reasonKind === 'replay-authority-changed') {
    logEntries.push({ atMs: (restartedAtMs ?? settledAt) + 3, text: `session event delivery skipped: recipient authority changed sessionKey=${target} queueId=q-1`, generation: spec.restart ? 1 : 0 });
  }
  const e1 = '11111111-1111-4111-8111-111111111111';
  const e2 = '22222222-2222-4222-8222-222222222222';
  const timeline = [
    { atMs: capturedAt, state: 'read', rows: [{ session_key: target, epoch: e1 }] },
    { atMs: settledAt, state: 'read', rows: [{ session_key: target, epoch: durable ? e2 : e1 }] },
    { atMs: settledAt + 1_000, state: 'read', rows: [{ session_key: target, epoch: durable ? e2 : e1 }] },
  ];
  const generations = [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }];
  if (spec.restart) generations.push({ index: 1, startedByHarness: true, ownedListenerThroughout: true });
  return { logEntries, timeline, generations, restartedAtMs };
}

async function grade(caseId, world = {}, harnessOptions = {}) {
  // One scripted store for both phases: the replacement generation serves the same state.
  const gateway = gatewayFor({ caseId, ...world });
  const { evidence: drive } = await fire(caseId, world, { gateway });
  let observe = null;
  if (RRA_CASES[caseId].restart) {
    assert.equal(drive.handoff?.ready_for_restart, true, 'the drive phase hands over for the restart');
    observe = (await fire(caseId, world, { phase: 'observe', state: drive, gateway })).evidence;
  }
  const record = assembleCaseRecord({
    caseId,
    runId: RUN,
    docsSha: 'd'.repeat(40),
    gates: { candidatePinned: true, buildInfoCommit: RRA_J12, stateIsolated: true, modelSignIn: true, crossSessionTargetingEnabled: true, gatewayStartedByHarness: true },
    evidence: drive,
    observeEvidence: observe,
    ...harnessFor(caseId, drive, harnessOptions),
    cleanup: { gatewayStopped: true, residue: false },
    startedAtMs: 1,
  });
  if (RRA_CASES[caseId].expectChild !== false) record.trace = { correlated: true };
  return { drive, observe, record, graded: gradeRecipientAuthorityCase(record) };
}

test('dry run: every case drives its public surfaces and grades PASS-candidate against a j12-shaped gateway', async () => {
  for (const caseId of RRA_CASE_IDS) {
    const { drive, graded } = await grade(caseId, { ack: 'wake' });
    assert.deepEqual(drive.refusals, [], `${caseId}: ${drive.refusals}`);
    assert.equal(graded.verdict, 'PASS-candidate', `${caseId}: ${JSON.stringify(graded)}`);
    // The trace collector's fingerprint contract (#600): the dispatched task, hashed.
    assert.match(drive.reason_hash, /^[0-9a-f]{16}$/);
    assert.equal(typeof drive.reason_length, 'number');
    assert.equal(drive.delegate_mode, RRA_CASES[caseId].mode);
  }
});

test('dry run: each case sends exactly its transition, never another case\'s', async () => {
  const transitions = ['sessions.reset', 'config.patch', 'session.visibility.set', 'session.members.remove', 'sessions.delete'];
  for (const caseId of RRA_CASE_IDS) {
    const { frames } = await fire(caseId, { ack: 'wake' });
    const sent = new Set(frames.filter((frame) => frame.type === 'req').map((frame) => frame.method));
    const spec = RRA_CASES[caseId];
    for (const method of transitions) {
      const own = spec.transition === method || (spec.transition === 'sessions.delete+sessions.create' && method === 'sessions.delete');
      assert.equal(sent.has(method), own, `${caseId} ${method}`);
    }
    if (spec.transition === 'config.patch') {
      const patches = frames.filter((frame) => frame.method === 'config.patch').map((frame) => JSON.parse(frame.params.raw).agents.defaults.continuation.crossSessionTargeting);
      assert.deepEqual(patches, ['disabled', 'enabled'], `${caseId}: the policy is restored`);
    }
    // The control, never the scenario, restarts the gateway.
    assert.equal(sent.has('gateway.restart.request'), false, caseId);
  }
});

test('dry run: a refused return adopted into the probe turn is FAIL-candidate, with or without the model\'s ack', async () => {
  for (const caseId of ['revoked-visibility', 'reassigned', 'replay-restart']) {
    for (const markerOnly of [false, true]) {
      const { graded } = await grade(caseId, { adoptOnProbe: true, markerOnly });
      assert.equal(graded.verdict, 'FAIL-candidate', `${caseId} markerOnly=${markerOnly}`);
      assert.ok(graded.contradictions.includes('refused-return-adopted'), caseId);
    }
  }
});

test('dry run: a policy patch the gateway rejected stops the case before dispatch and is never FAIL', async () => {
  for (const caseId of ['unauthorized-admission', 'unauthorized-dispatch']) {
    const { drive, graded } = await grade(caseId, { patchFails: true });
    assert.ok(drive.refusals.some((refusal) => refusal.startsWith('config.patch disabled rejected')), drive.refusals.join('\n'));
    assert.equal(graded.verdict, 'MISSING-candidate', caseId);
    assert.deepEqual(graded.contradictions, [], caseId);
  }
});

test('dry run: without the product reason line a refusal case stays MISSING-candidate', async () => {
  for (const caseId of ['unauthorized-dispatch', 'revoked-owner', 'replay-restart']) {
    const { graded } = await grade(caseId, {}, { reason: false });
    assert.equal(graded.verdict, 'MISSING-candidate', caseId);
    assert.ok(graded.missing.includes('refusal-reason-not-observed') || graded.missing.includes('reason-not-from-replacement'), caseId);
  }
});

test('dry run: an allowed return the target never acknowledges is FAIL-candidate', async () => {
  const { graded } = await grade('allowed', { ack: 'none' });
  assert.equal(graded.verdict, 'FAIL-candidate');
  assert.ok(graded.contradictions.includes('allowed-return-not-adopted'));
});

test('dry run: no member identity to add leaves revoked-membership MISSING, never PASS', async () => {
  const { drive, graded } = await grade('revoked-membership', { noIdentity: true });
  assert.ok(drive.refusals.some((refusal) => refusal.startsWith('precondition:')), drive.refusals.join('\n'));
  assert.equal(graded.verdict, 'MISSING-candidate');
});

test('dry run: outside the control the scenario refuses before it sends a frame', async () => {
  for (const env of [{ OPENCLAW_RCD_RA_RUN: '' }, { OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9' }, { OPENCLAW_RCD_RA_CASE: 'stale' }, { OPENCLAW_RCD_RA_PHASE: 'observe' }]) {
    const { evidence, frames } = await fire('revoked-visibility', {}, { env });
    assert.ok(evidence.refusals.length > 0, JSON.stringify(env));
    assert.equal(frames.length, 0, JSON.stringify(env));
  }
});
