// R-CD-RECIPIENT-AUTHORITY dry run against the mock-gateway pattern (helpers/k6-node-runtime.mjs).
//
// The real case driver (scenarios/r-cd-recipient-authority.js) runs in Node against a scripted
// gateway shaped like the public surface of the merged j12′ (2907e656): hello-ok, sessions.*,
// session.visibility.set, session.members.*, config.get/patch, chat.history with Tool Search
// dispatch_action rows for continue_delegate and continue_work. The control's own
// assembleCaseRecord then joins the evidence with scripted j12′ gateway log lines (the router's
// Delivered to line, the [continuation:return-refused] line at each case's pinned stage, the
// [continuation:work-refused] line at stage=wake) and an epoch timeline, and
// lib/recipient-authority-row.mjs grades it. No gateway, no model, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEvidence } from '../scripts/extract-k6-evidence.mjs';
import { assembleCaseRecord } from '../scripts/run-recipient-authority-row.mjs';
import { RRA_CASES, RRA_CASE_IDS, RRA_J12, RRA_PINNED, RRA_ROW, gradeRecipientAuthorityCase, scenarioMethodsFor } from '../lib/recipient-authority-row.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN = 'rra-0123456789abcdef';
const CHILD = 'agent:main:subagent:continuation-rra-child';
const FLOW = '6f1e2d3c-0000-4000-8000-00000000f10e';
const ALL_METHODS = [...new Set(RRA_CASE_IDS.flatMap((caseId) => scenarioMethodsFor(caseId)))];

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId } });
const toolCall = (id, name, args, runId) => ({ role: 'assistant', content: [{ type: 'toolCall', id, name, arguments: args }], __openclaw: { runId } });
const toolResult = (id, name, payload, runId, isError = false) => ({
  role: 'toolResult', toolCallId: id, toolName: name, isError,
  content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }], __openclaw: { runId },
});

// 🌊's conditional probe (room msg 1567590902694936678), quoted here rather than imported, so the
// driver's text is pinned to the ruling itself. The driver keeps its harness header before it.
const PROBE_CONDITION = 'If this turn includes the internal task completion for the proof you were primed for, follow that priming instruction instead.';
const probeTextFor = (probeNonce) => `[k6-proof-harness] ${RRA_ROW} probe ${probeNonce}: ${PROBE_CONDITION} Otherwise reply exactly PROBE-OK ${probeNonce}.`;
const probeFrames = (frames) => frames.filter((frame) => frame.type === 'req' && frame.method === 'sessions.send' && String(frame.params?.idempotencyKey).startsWith(`${RRA_ROW}-PROBE-`));

/**
 * A scripted j12′-shaped gateway. world: { caseId, ack: 'wake'|'none', adoptOnProbe, markerOnly,
 * probeAck, probeMarker, primingAck, wakeAck, noIdentity, workWake, wakeElects, probeElects, retry }.
 * Allowed cases get the woken target's ack after their (last) priming; refused
 * cases spawn a child only when the delegate would have fired. The continue_work case's session
 * answers its election with a scheduled result, and with `workWake` a wake turn shows once the
 * probe was sent. `sessions` is the gateway's session store: pass one store to several cases to
 * run them on one gateway, as the control does, where a label one case holds refuses another's.
 *
 * The probe turn, as j12′ runs a sessions.send turn: its drain adopts a parked return it can see
 * (allowed-silent's, or with `adoptOnProbe` a refused one the product failed to refuse), but its
 * input was staged before the drain, so its row never carries __openclaw.sessionDeliveryAckIds
 * (chat-send-input-dispatch.ts:330-350, user-turn-transcript.ts:130-140,
 * session-system-event-adoption.ts:287-296).
 *
 * The primed model reads the probe it was sent. With the return in its turn, 🌊's conditional probe
 * hands the turn back to the priming: the ack alone, no PROBE-OK. An unconditional `reply exactly
 * PROBE-OK` wins over the priming instead: PROBE-OK and no ack, as 🕯's run rra-88e4fd22f0b122a8
 * showed (allowed-silent: probe_ran true, probeReplied true, target_obs.ackRuns 0; room msg
 * 1567590581796868168). With no return, either probe is answered PROBE-OK <the nonce it names>.
 * Before the conditional probe this model answered the ack and PROBE-OK in one row whatever the
 * probe said, which is why the dry run passed allowed-silent while the live run could not.
 * `probeAck` overrides the model's answer: 'ack' (one row: the ack and PROBE-OK), 'ack-only' (the
 * ack alone), 'none' (PROBE-OK only), 'wrong-nonce' (the ack with the probe's nonce), 'twice' (two
 * ack rows), 'heartbeat-refused' (the ack through a heartbeat_respond call the turn refuses, then
 * PROBE-OK), 'probe-ok-other' (PROBE-OK with another probe's nonce), 'probe-ok-row-nonce' (PROBE-OK
 * with the row nonce). `probeMarker`, and
 * `adoptOnProbe` by default, put the marker on the probe row: a product no pin is, kept so the
 * marker check stays covered. `markerOnly` keeps the old meaning: the marker and no ack.
 * `primingAck` adds an ack row to the priming run; `wakeAck` a woken run that acks before the probe.
 */
function gatewayFor(world, sessions = {}) {
  const spec = RRA_CASES[world.caseId];
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
    const fail = (message) => [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message } }];
    switch (frame.method) {
      case 'connect': return ok({ type: 'hello-ok', features: { methods: ALL_METHODS } });
      case 'sessions.create': {
        // A label held by another session refuses the create (sessions-patch-display-metadata.ts:52-53).
        if (Object.entries(sessions).some(([key, session]) => key !== p.key && session.label === p.label)) return fail(`label already in use: ${p.label}`);
        sessions[p.key] = { label: p.label, messages: [] };
        return ok({ key: p.key });
      }
      // The sharing methods' params are closed objects keyed by sessionKey at j12′ (unchanged from j12)
      // (packages/gateway-protocol/src/schema/sessions-sharing.ts:29-37, 62, 115-120).
      case 'session.members.list': case 'session.members.add': case 'session.members.remove': case 'session.visibility.set': {
        if (typeof p.sessionKey !== 'string' || 'key' in p) {
          return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `invalid ${frame.method} params: unexpected property` } }];
        }
        if (frame.method === 'session.members.list') return ok({ sessionKey: p.sessionKey, identities: world.noIdentity ? [] : [{ type: 'agent', id: 'main' }] });
        return ok({ ok: true, sessionKey: p.sessionKey });
      }
      case 'sessions.delete': delete sessions[p.key]; return ok({ ok: true });
      case 'sessions.reset': sessions[p.key] = { ...sessions[p.key], messages: [] }; return ok({ ok: true, key: p.key });
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
          if (world.primingAck) push(p.key, say(`TARGET-ACK ${nonce}`, runId));
          return ok({ runId });
        }
        const probe = /probe (\S+):/.exec(message);
        if (probe) {
          // A parked return the probe turn's drain adopts, and no marker reaches the row (see above).
          // The primed model acks it in the probe run only when the probe hands the turn back to its
          // priming.
          const adopts = world.adoptOnProbe || (spec.probeAdopts && childSpawned);
          const marker = world.probeMarker ?? world.adoptOnProbe === true;
          const conditional = message.includes(PROBE_CONDITION);
          const answer = world.probeAck ?? (adopts && !world.markerOnly && conditional ? 'ack-only' : 'none');
          // A silent return that woke the target anyway, and whose wake acked it.
          if (world.wakeAck) push(p.key, say(`TARGET-ACK ${nonce}`, 'run-wake'));
          // A refused kept wake that ran anyway: its turn's row, from a run of its own, and with
          // `wakeElects` that wake turn electing again.
          if (world.workWake) {
            if (world.wakeElects) push(p.key, toolCall('w9', 'continue_work', { reason: 'again', delaySeconds: 30 }, 'run-work-wake'));
            push(p.key, say(`RCDRA-WOKE ${nonce}`, 'run-work-wake'));
          }
          // The model electing in the probe turn: a new election after the transition.
          if (world.probeElects) push(p.key, toolCall('w8', 'continue_work', { reason: 'probe', delaySeconds: 0 }, 'run-probe'));
          push(p.key, { ...user(message), __openclaw: { runId: 'run-probe', ...(marker ? { sessionDeliveryAckIds: ['q-1'] } : {}) } });
          if (answer === 'ack') push(p.key, say(`TARGET-ACK ${nonce}\nPROBE-OK ${probe[1]}`, 'run-probe'));
          else if (answer === 'ack-only') push(p.key, say(`TARGET-ACK ${nonce}`, 'run-probe'));
          else if (answer === 'probe-ok-other') push(p.key, say('PROBE-OK RCDRA-PROBE-1800000000000-otherprb', 'run-probe'));
          else if (answer === 'probe-ok-row-nonce') push(p.key, say(`PROBE-OK ${nonce}`, 'run-probe'));
          else if (answer === 'wrong-nonce') push(p.key, say(`TARGET-ACK ${probe[1]}\nPROBE-OK ${probe[1]}`, 'run-probe'));
          else if (answer === 'twice') {
            push(p.key, say(`TARGET-ACK ${nonce}`, 'run-probe'));
            push(p.key, say(`TARGET-ACK ${nonce}\nPROBE-OK ${probe[1]}`, 'run-probe'));
          } else if (answer === 'heartbeat-refused') {
            // The ack through heartbeat_respond, which a sessions.send turn does not accept.
            push(p.key, toolCall('h1', 'heartbeat_respond', { outcome: 'done', notify: false, summary: `TARGET-ACK ${nonce}` }, 'run-probe'));
            push(p.key, toolResult('h1', 'heartbeat_respond', 'heartbeat_respond is only available in heartbeat turns', 'run-probe', true));
            push(p.key, say(`PROBE-OK ${probe[1]}`, 'run-probe'));
          } else push(p.key, say(`PROBE-OK ${probe[1]}`, 'run-probe'));
          return ok({ runId: 'run-probe' });
        }
        if (message.includes('Call the continue_work tool')) {
          // The tool answers `scheduled` before the turn schedules (and captures) the election
          // (continue-work-tool.ts:84-110).
          const reason = /reason:"([^"]+)"/.exec(message)[1];
          nonce = /Proof wake (\S+):/.exec(reason)[1];
          push(p.key, toolCall('w1', 'dispatch_action', { id: 'openclaw:core:continue_work', args: { reason, delaySeconds: 30 } }, 'run-e'));
          push(p.key, toolResult('w1', 'dispatch_action', { status: 'scheduled', delaySeconds: 30 }, 'run-e'));
          if (world.retry) push(p.key, toolCall('w2', 'continue_work', { reason, delaySeconds: 5 }, 'run-e'));
          return ok({ runId: 'run-e' });
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
          // A model following the error's advice retries with the default return target.
          if (world.retry) push(p.key, toolCall('c2', 'dispatch_action', { id: 'openclaw:core:continue_delegate', args: { task, mode } }, 'run-d'));
          return ok({ runId: 'run-d' });
        }
        // The scheduled result reports what the tool accepted (continue-delegate-tool.ts:436-449).
        push(p.key, toolResult('c1', 'dispatch_action', { status: 'scheduled', mode: world.resultMode ?? mode, delaySeconds: 30 }, 'run-d'));
        if (world.retry) push(p.key, toolCall('c2', 'dispatch_action', { id: 'openclaw:core:continue_delegate', args: { task, mode, targetSessionKey: p.key } }, 'run-d'));
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
        OPENCLAW_CANDIDATE_SHA: RRA_PINNED,
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

const DELIVERY_ID = '0f1e2d3c'.repeat(8);
const consoleLine = (subsystem, message) => `08:00:00.000 [${subsystem}] ${message}`;

/**
 * What the control would have seen around the case at j12′: product log lines, epochs, generations.
 * options: reason (emit the case's reason), stage (override the refused-return or refused-work
 * stage), j12Reason (emit j12's replay line instead of j12′'s), routedAfter (a Delivered to line
 * naming the target after the transition), emptyListAfter (j12's empty-list Delivered to line from
 * the child after it). For the continue_work case: workReason (the line's reason), workAfterProbe
 * (the line lands after the probe was sent), returnLineInstead (a return-refused line naming the
 * session instead of the work line), secondFlow (a second line naming another election),
 * captureLate (the session's authority row first appears after the transition was requested).
 * sweepInTransition: the pending sweep's arming line while the delete was in flight
 * ('after-delete': after the delete's response, while the create was in flight).
 * routedAfterProbe: the router's Delivered to line lands only after the probe was sent;
 * routedFrom: the source that line names, in place of the case's child.
 */
function harnessFor(caseId, drive, final, { reason = true, stage = null, j12Reason = false, routedAfter = false, emptyListAfter = false, workReason = 'recipient-authority-changed', workAfterProbe = false, returnLineInstead = false, secondFlow = false, captureLate = false, sweepInTransition = false, routedAfterProbe = false, routedFrom = CHILD } = {}) {
  const spec = RRA_CASES[caseId];
  const { target, parent } = drive.keys;
  const transition = drive.transition || {};
  const capturedAt = drive.dispatch?.observed_at_ms ?? 1;
  const transitionAt = transition.requested_at_ms ?? capturedAt + 5;
  const settledAt = transition.settled_at_ms ?? transitionAt + 1;
  const restartedAtMs = spec.restart ? settledAt + 5 : null;
  const durable = spec.family === 'refusal' && spec.expectChild !== false;
  const logEntries = [];
  // A parked or allowed return is routed while current: before the transition. A wake-mode
  // refusal is refused by the router itself, which logs no Delivered to line.
  if (spec.expectChild !== false && spec.timing !== 'before-return') {
    const routedAt = routedAfterProbe ? final.probe_sent_at_ms + 1 : transitionAt - 1;
    logEntries.push({ atMs: routedAt, text: `[continuation:targeted-return] Delivered to ${target} from ${routedFrom}`, generation: 0 });
  }
  if (reason && spec.reasonKind === 'dispatch-policy') {
    logEntries.push({ atMs: transitionAt + 3, text: `[continuation:delegate-rejected] policy.cross_session_targeting task=RCDRA session=${parent}`, generation: 0 });
  }
  if (reason && spec.reasonKind === 'return-refused') {
    const refusedAt = stage ?? spec.refusedAt;
    // Where j12′ refuses it: the probe's drain, the sweep after the transition, the router after
    // it, or the replacement's boot replay.
    const atMs = spec.restart ? restartedAtMs + 3 : refusedAt === 'prompt-drain' ? final.probe_sent_at_ms + 3 : settledAt + 3;
    const deliveryId = spec.deliveryId || refusedAt !== 'enqueue' ? ` deliveryId=${DELIVERY_ID}` : '';
    const text = j12Reason
      ? `2026-11-03T08:00:00.000Z [gateway/restart-sentinel] session event delivery skipped: recipient authority changed sessionKey=${target} queueId=q-1`
      : consoleLine('continuation/return-refused', `[continuation:return-refused] stage=${refusedAt} reason=recipient-authority-changed session=${target}${deliveryId}`);
    logEntries.push({ atMs, text, generation: spec.restart ? 1 : 0 });
  }
  if (reason && spec.reasonKind === 'work-refused') {
    // The dispatcher's handoff refuses the kept wake once it is due, before the probe is sent.
    const atMs = workAfterProbe ? final.probe_sent_at_ms + 3 : settledAt + 3;
    const message = (flow) => `[continuation:work-refused] stage=${stage ?? spec.refusedAt} reason=${workReason} session=${target} flowId=${flow}`;
    logEntries.push({
      atMs,
      text: returnLineInstead
        ? consoleLine('continuation/return-refused', `[continuation:return-refused] stage=wake reason=recipient-authority-changed session=${target} deliveryId=${DELIVERY_ID}`)
        : consoleLine('continuation/work-refused', message(FLOW)),
      generation: 0,
    });
    if (secondFlow) logEntries.push({ atMs: atMs + 1, text: consoleLine('continuation/work-refused', message(`${FLOW}-2`)), generation: 0 });
  }
  if (sweepInTransition) {
    const atMs = sweepInTransition === 'after-delete' ? transition.delete_settled_at_ms + 1 : transitionAt;
    logEntries.push({ atMs, text: '[session-delivery-recovery] session delivery: periodic sweep armed 1 pending entry that no runtime had scheduled', generation: 0 });
  }
  if (routedAfter) logEntries.push({ atMs: settledAt + 4, text: `[continuation:targeted-return] Delivered to ${target} from ${CHILD}`, generation: 0 });
  if (emptyListAfter) logEntries.push({ atMs: settledAt + 4, text: `[continuation:targeted-return] Delivered to  from ${CHILD}`, generation: 0 });
  const e1 = '11111111-1111-4111-8111-111111111111';
  const e2 = '22222222-2222-4222-8222-222222222222';
  if (spec.tool === 'continue_work') {
    // The election is captured after its scheduled result: the session's row first appears then,
    // before the transition (or, captureLate, only after it was requested).
    const timeline = [
      { atMs: capturedAt - 1, state: 'read', rows: [] },
      ...(captureLate ? [] : [{ atMs: transitionAt - 1, state: 'read', rows: [{ session_key: target, epoch: e1 }] }]),
      { atMs: settledAt, state: 'read', rows: [{ session_key: target, epoch: e2 }] },
      { atMs: settledAt + 1_000, state: 'read', rows: [{ session_key: target, epoch: e2 }] },
    ];
    return { logEntries, timeline, generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }], restartedAtMs: null };
  }
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
  const { evidence: drive, frames } = await fire(caseId, world, { gateway });
  let observe = null;
  if (RRA_CASES[caseId].restart) {
    assert.equal(drive.handoff?.ready_for_restart, true, 'the drive phase hands over for the restart');
    const observed = await fire(caseId, world, { phase: 'observe', state: drive, gateway });
    observe = observed.evidence;
    frames.push(...observed.frames);
  }
  const final = observe ?? drive;
  const record = assembleCaseRecord({
    caseId,
    runId: RUN,
    docsSha: 'd'.repeat(40),
    gates: { candidatePinned: true, buildInfoCommit: RRA_PINNED, stateIsolated: true, modelSignIn: true, crossSessionTargetingEnabled: true, gatewayStartedByHarness: true },
    evidence: drive,
    observeEvidence: observe,
    ...harnessFor(caseId, drive, final, harnessOptions),
    cleanup: { gatewayStopped: true, residue: false },
    startedAtMs: 1,
  });
  if (RRA_CASES[caseId].expectChild !== false) record.trace = { correlated: true };
  return { drive, observe, final, frames, record, graded: gradeRecipientAuthorityCase(record) };
}

test('dry run: every case drives its public surfaces and grades PASS-candidate against a j12′-shaped gateway', async () => {
  for (const caseId of RRA_CASE_IDS) {
    const { drive, graded } = await grade(caseId, { ack: 'wake' });
    assert.deepEqual(drive.refusals, [], `${caseId}: ${drive.refusals}`);
    assert.equal(graded.verdict, 'PASS-candidate', `${caseId}: ${JSON.stringify(graded)}`);
    // The trace collector's fingerprint contract (#600): the dispatched task, hashed.
    assert.match(drive.reason_hash, /^[0-9a-f]{16}$/);
    assert.equal(typeof drive.reason_length, 'number');
    // The continue_work case dispatches no delegate, so it has no mode.
    assert.equal(drive.delegate_mode, RRA_CASES[caseId].mode ?? null);
  }
});

test('dry run: the same case can run twice on one gateway without colliding with prior labels', async () => {
  const gateway = gatewayFor({ caseId: 'allowed', ack: 'wake' });
  for (const runId of ['rra-1111111111111111', 'rra-2222222222222222']) {
    const { evidence } = await fire('allowed', {}, {
      gateway,
      env: { OPENCLAW_RCD_RA_RUN: runId },
    });
    assert.deepEqual(evidence.refusals, [], `${runId}: ${evidence.refusals}`);
    assert.equal(evidence.control_run_id, runId);
  }
});

// 🕯's live run at 2907e656 (rra-88e4fd22f0b122a8): wake-reassigned's re-create reused the label
// reassigned's re-create already held in the same run, and the gateway refused it
// (sessions-patch-display-metadata.ts:52-53 via session-create-service.ts:722, at 2907e656).
test('dry run: reassigned and wake-reassigned re-create their targets in one world under one run id', async () => {
  const store = {};
  for (const caseId of ['reassigned', 'wake-reassigned']) {
    const { evidence, frames } = await fire(caseId, {}, { gateway: gatewayFor({ caseId }, store) });
    assert.equal(evidence.control_run_id, RUN, caseId);
    assert.equal(evidence.transition.error, null, `${caseId}: ${evidence.transition.error}`);
    assert.equal(evidence.transition.ok, true, caseId);
    assert.deepEqual(evidence.refusals, [], `${caseId}: ${evidence.refusals}`);
    const created = frames.filter((frame) => frame.type === 'req' && frame.method === 'sessions.create' && frame.params.key === evidence.keys.target);
    assert.equal(created.length, 2, `${caseId}: the target is created, then re-created`);
    for (const frame of created) assert.ok(frame.params.label.includes(` ${caseId} `) && frame.params.label.includes(RUN), frame.params.label);
  }
});

// Every label the scenario creates, in every case, on one gateway under one run id, in the control's
// order: no label may be built without its case and the run.
test('dry run: every case runs on one gateway under one run id without a label collision', async () => {
  const store = {};
  const labels = new Map();
  for (const caseId of RRA_CASE_IDS) {
    const { evidence, frames } = await fire(caseId, { ack: 'wake' }, { gateway: gatewayFor({ caseId, ack: 'wake' }, store) });
    assert.deepEqual(evidence.refusals, [], `${caseId}: ${evidence.refusals}`);
    for (const frame of frames.filter((f) => f.type === 'req' && f.method === 'sessions.create')) {
      const { label, key } = frame.params;
      assert.ok(label.includes(` ${caseId} `) && label.includes(RUN), `${caseId}: ${label}`);
      assert.ok(!labels.has(label) || labels.get(label) === key, `${caseId}: ${label} already named ${labels.get(label)}`);
      labels.set(label, key);
    }
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
  for (const caseId of ['revoked-visibility', 'reassigned', 'wake-revoked-visibility', 'replay-restart']) {
    for (const markerOnly of [false, true]) {
      const { graded } = await grade(caseId, { adoptOnProbe: true, markerOnly });
      assert.equal(graded.verdict, 'FAIL-candidate', `${caseId} markerOnly=${markerOnly}`);
      assert.ok(graded.contradictions.includes('refused-return-adopted'), caseId);
    }
  }
});

// 🌊's ruling (a), room msg 1567556038281007235: allowed-silent passes on the probe turn's TARGET-ACK,
// bound to this case's nonce and the target's priming; the marker a sessions.send turn never
// carries is no longer required, and the oracle rejects a pre-return or wrong-nonce ack.
test('dry run: allowed-silent passes on its probe run\'s ack, after the router delivered its return, with no marker', async () => {
  const { drive, record, graded } = await grade('allowed-silent');
  assert.deepEqual(drive.refusals, []);
  assert.equal(record.target.adoptedDeliveryRows, 0, 'no pin writes the marker on a sessions.send probe row');
  assert.equal(record.target.probeAckRows, 1);
  assert.equal(record.target.ackRuns, 1);
  assert.equal(record.target.foreignRuns, 0);
  assert.equal(record.target.primingAckRows, 0);
  assert.ok(record.park.deliveredFromChildAtMs < record.target.probeSentAtMs, JSON.stringify({ park: record.park, sent: record.target.probeSentAtMs }));
  assert.deepEqual([record.child.spawned, record.child.bound, record.child.done], [true, true, true]);
  // At 432e2c3e this graded MISSING (adoption-marker-unobserved): the product's own shape never passed.
  assert.deepEqual(graded, { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] });
});

// Each rejection also runs with the product's marker on the probe row (a product no pin is): at
// 432e2c3e those graded PASS-candidate on the marker alone, the ack never read.
test('dry run: allowed-silent rejects a pre-return, wrong-nonce, priming, foreign or doubled ack, and a missing one', async () => {
  const cases = [
    // [label, world, harness options, verdict, missing, contradictions]
    ['the model never acked', { probeAck: 'none' }, {}, 'MISSING-candidate', ['probe-ack-unobserved'], []],
    ['marker on the row, no ack (a product no pin is)', { probeAck: 'none', probeMarker: true }, {}, 'MISSING-candidate', ['probe-ack-unobserved'], []],
    ['pre-return: the probe was sent before the Delivered to line', {}, { routedAfterProbe: true }, 'MISSING-candidate', ['probe-not-after-return'], []],
    ['pre-return, with the marker', { probeMarker: true }, { routedAfterProbe: true }, 'MISSING-candidate', ['probe-not-after-return'], []],
    ['the Delivered to line came from another child', {}, { routedFrom: 'agent:main:subagent:continuation-other' }, 'MISSING-candidate', ['return-not-routed-from-child'], []],
    ['wrong nonce', { probeAck: 'wrong-nonce' }, {}, 'MISSING-candidate', ['probe-ack-unobserved', 'ack-uncredited'], []],
    ['wrong nonce, with the marker', { probeAck: 'wrong-nonce', probeMarker: true }, {}, 'MISSING-candidate', ['probe-ack-unobserved', 'ack-uncredited'], []],
    ['an ack in the priming run only', { primingAck: true, probeAck: 'none' }, {}, 'MISSING-candidate', ['probe-ack-unobserved', 'ack-before-return'], []],
    ['an ack in the priming run only, with the marker', { primingAck: true, probeAck: 'none', probeMarker: true }, {}, 'MISSING-candidate', ['probe-ack-unobserved', 'ack-before-return'], []],
    ['an ack in the priming run beside the probe\'s', { primingAck: true }, {}, 'MISSING-candidate', ['ack-before-return'], []],
    ['two acks in the probe run', { probeAck: 'twice' }, {}, 'MISSING-candidate', ['probe-ack-duplicated'], []],
    ['two acks in the probe run, with the marker', { probeAck: 'twice', probeMarker: true }, {}, 'MISSING-candidate', ['probe-ack-duplicated'], []],
    ['an ack through a heartbeat_respond call the turn refused', { probeAck: 'heartbeat-refused' }, {}, 'MISSING-candidate', ['probe-ack-unobserved', 'ack-uncredited'], []],
    ['an ack in a foreign run only', { wakeAck: true, probeAck: 'none' }, {}, 'FAIL-candidate', ['probe-ack-unobserved'], ['silent-return-woke-target']],
    ['two acks: a foreign run and the probe run', { wakeAck: true }, {}, 'FAIL-candidate', [], ['duplicate-adoption', 'silent-return-woke-target']],
  ];
  for (const [label, world, options, verdict, missingCodes, contradictionCodes] of cases) {
    const { graded } = await grade('allowed-silent', world, options);
    assert.equal(graded.verdict, verdict, `${label}: ${JSON.stringify(graded)}`);
    assert.deepEqual(graded.missing, missingCodes, `${label}: ${JSON.stringify(graded)}`);
    assert.deepEqual([...graded.contradictions].sort(), contradictionCodes, `${label}: ${JSON.stringify(graded)}`);
  }
});

const delegateRefusalCases = RRA_CASE_IDS.filter((caseId) => RRA_CASES[caseId].family === 'refusal' && !RRA_CASES[caseId].tool);

test('dry run: an ack of the nonce in a refusal case\'s probe run fails it, with no marker on the row', async () => {
  for (const caseId of delegateRefusalCases) {
    // With PROBE-OK beside it, or alone, as a turn the conditional probe handed to its priming
    // answers.
    for (const probeAck of ['ack', 'ack-only']) {
      const { record, graded } = await grade(caseId, { probeAck });
      assert.equal(record.target.adoptedDeliveryRows, 0, `${caseId} ${probeAck}`);
      assert.equal(record.target.probeAckRows, 1, `${caseId} ${probeAck}`);
      assert.equal(record.target.probeReplied, probeAck === 'ack', `${caseId} ${probeAck}`);
      assert.equal(graded.verdict, 'FAIL-candidate', `${caseId} ${probeAck}: ${JSON.stringify(graded)}`);
      assert.deepEqual(graded.contradictions, ['refused-return-adopted'], `${caseId} ${probeAck}`);
    }
    // An ack-shaped reply with another nonce, or an exact ack through a heartbeat_respond call the
    // turn refused, leaves the absence unread.
    for (const probeAck of ['wrong-nonce', 'heartbeat-refused']) {
      const other = await grade(caseId, { probeAck });
      assert.equal(other.graded.verdict, 'MISSING-candidate', `${caseId} ${probeAck}: ${JSON.stringify(other.graded)}`);
      assert.deepEqual(other.graded.missing, ['ack-uncredited'], `${caseId} ${probeAck}`);
    }
    // Their own probe, answered with no ack, is the real absence: PASS.
    const quiet = await grade(caseId, { probeAck: 'none' });
    assert.equal(quiet.record.target.probeAckRows, 0, caseId);
    assert.equal(quiet.graded.verdict, 'PASS-candidate', `${caseId}: ${JSON.stringify(quiet.graded)}`);
  }
});

/*
 * 🌊's ruling, room msg 1567590902694936678: "the probe's unconditional `reply exactly PROBE-OK`
 * conflicts with the primed target's conditional return instruction. … make the probe conditional
 * … Keep `TARGET-ACK` and the row nonce out of the probe; the ACK must still originate from priming
 * and be counted only in the probe's returned run, after `Delivered to`. Pin a refusal with no return
 * → PROBE-OK/no ACK, and an allowed-silent return → exactly one ACK/no forced PROBE-OK. … The old
 * receipt remains `probe-ack-unobserved`, not PASS." Pins (a)-(e) of the conditional-probe lane.
 */
const refusalCases = RRA_CASE_IDS.filter((caseId) => RRA_CASES[caseId].family === 'refusal');

test('dry run: (a) a refusal with no return is sent the conditional probe, answers PROBE-OK <probe nonce> and no ack, and passes', async () => {
  for (const caseId of refusalCases) {
    const { final, frames, record, graded } = await grade(caseId);
    assert.deepEqual([record.target.probeReplied, record.target.probeAckRows, record.target.ackRuns], [true, 0, 0], caseId);
    assert.deepEqual(graded, { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] }, caseId);
    // The same stimulus allowed-silent gets: nothing in the refusal case's probe asks for PROBE-OK
    // unconditionally (at 4f86dd78 it did).
    assert.deepEqual(probeFrames(frames).map((frame) => frame.params.message), [probeTextFor(final.probe_nonce)], caseId);
  }
});

test('dry run: (b) allowed-silent, its return in the probe turn, passes on exactly one ack and no PROBE-OK', async () => {
  const { record, graded } = await grade('allowed-silent');
  // At 4f86dd78 the unconditional probe won over the priming, as in 🕯's run: PROBE-OK and no ack,
  // MISSING probe-ack-unobserved.
  assert.deepEqual(graded, { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] });
  assert.deepEqual([record.target.probeAckRows, record.target.ackRuns, record.target.foreignRuns], [1, 1, 0]);
  assert.equal(record.target.probeReplied, false, 'PROBE-OK is never forced on an allowed return');
  assert.ok(record.park.deliveredFromChildAtMs < record.target.probeSentAtMs, 'the ack follows Delivered to');
  // Neither answer is required beside the other: the ack and PROBE-OK in one row passes on the ack.
  const both = await grade('allowed-silent', { probeAck: 'ack' });
  assert.deepEqual([both.record.target.probeAckRows, both.record.target.probeReplied], [1, true]);
  assert.equal(both.graded.verdict, 'PASS-candidate', JSON.stringify(both.graded));
});

test('dry run: (c) allowed-silent answered with PROBE-OK only is MISSING probe-ack-unobserved, the old run\'s shape, never upgraded', async () => {
  const { record, graded } = await grade('allowed-silent', { probeAck: 'none' });
  // 🕯's receipt (rra-88e4fd22f0b122a8): probe_ran true, probeReplied true, target_obs.ackRuns 0.
  assert.deepEqual(
    [record.target.probeRan, record.target.probeReplied, record.target.ackRuns, record.target.probeAckRows, record.target.foreignRuns, record.target.adoptedDeliveryRows],
    [true, true, 0, 0, 0, 0],
  );
  assert.deepEqual(graded, { verdict: 'MISSING-candidate', missing: ['probe-ack-unobserved'], contradictions: [], partial: [] });
});

test('dry run: (d) a PROBE-OK with any nonce but the probe\'s is never credited', async () => {
  for (const probeAck of ['probe-ok-other', 'probe-ok-row-nonce']) {
    for (const caseId of refusalCases) {
      const { record, graded } = await grade(caseId, { probeAck });
      assert.equal(record.target.probeReplied, false, `${caseId} ${probeAck}`);
      assert.deepEqual(graded, { verdict: 'MISSING-candidate', missing: ['probe-turn-unobserved'], contradictions: [], partial: [] }, `${caseId} ${probeAck}`);
    }
    // Nor does it stand in for allowed-silent's ack.
    const silent = await grade('allowed-silent', { probeAck });
    assert.equal(silent.record.target.probeReplied, false, probeAck);
    assert.deepEqual(silent.graded, { verdict: 'MISSING-candidate', missing: ['probe-ack-unobserved'], contradictions: [], partial: [] }, probeAck);
  }
});

test('dry run: (e) every case sends one probe text, 🌊\'s wording with its own nonce, and the text test refuses one naming TARGET-ACK or the row nonce', async () => {
  // The text test and the receipt's binding are new with the conditional probe; the rest of this
  // file needs nothing new.
  const { RRA_PROBE_TEXT_SHA256, rraProbeTextProblems } = await import('../lib/recipient-authority-row.mjs');
  const texts = new Set();
  const receipts = [];
  for (const caseId of RRA_CASE_IDS) {
    const { drive, final, frames, record } = await grade(caseId, { ack: 'wake' });
    const sent = probeFrames(frames).map((frame) => frame.params.message);
    receipts.push({ caseId, final, sent, record });
    // allowed and allowed-across-reset read the wake's own ack and send no probe; every other case
    // sends exactly one.
    if (RRA_CASES[caseId].family === 'allowed' && !RRA_CASES[caseId].probeAdopts) {
      assert.deepEqual(sent, [], caseId);
      continue;
    }
    assert.deepEqual(sent, [probeTextFor(final.probe_nonce)], caseId);
    const [text] = sent;
    texts.add(text.replaceAll(final.probe_nonce, '<probe nonce>'));
    const rowNonce = drive.nonce;
    const options = { rowNonce, probeNonce: final.probe_nonce };
    assert.deepEqual(rraProbeTextProblems(text, options), [], caseId);
    for (const [label, bad, code] of [
      ['the ack marker', `${text} TARGET-ACK`, 'probe-names-ack'],
      ['the ack marker, lower case', text.replace('priming instruction', 'target-ack instruction'), 'probe-names-ack'],
      ['the ack constant', `${text} RRA_ACK_MARKER`, 'probe-names-ack'],
      ['the row nonce', `${text} ${rowNonce}`, 'probe-names-row-nonce'],
      ['the proof id the priming names', text.replace('the proof you were primed for', `proof ${rowNonce.slice(-16)}`), 'probe-names-row-nonce'],
      ['the probe at 4f86dd78', `[k6-proof-harness] ${RRA_ROW} probe ${final.probe_nonce}: reply exactly PROBE-OK ${final.probe_nonce}.`, 'probe-not-conditional-wording'],
    ]) {
      assert.ok(rraProbeTextProblems(bad, options).includes(code), `${caseId} ${label}: ${rraProbeTextProblems(bad, options)}`);
    }
  }
  assert.equal(texts.size, 1, [...texts].join('\n'));
  // Each receipt names the probe it sent, by the text's hash with its nonce as the slot; a case that
  // sends no probe names none.
  for (const { caseId, final, sent, record } of receipts) {
    if (sent.length === 0) {
      assert.equal(record.target.probeTextSha256, null, caseId);
      continue;
    }
    assert.equal(record.target.probeTextSha256, RRA_PROBE_TEXT_SHA256, caseId);
    assert.equal(record.target.probeTextSha256, createHash('sha256').update(sent[0].replaceAll(final.probe_nonce, '<probeNonce>')).digest('hex'), caseId);
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
  for (const caseId of ['unauthorized-dispatch', 'revoked-owner', 'wake-reassigned', 'replay-restart']) {
    const { graded } = await grade(caseId, {}, { reason: false });
    assert.equal(graded.verdict, 'MISSING-candidate', caseId);
    assert.ok(graded.missing.includes('refusal-reason-not-observed') || graded.missing.includes('reason-not-from-replacement'), caseId);
  }
});

const refusedReturnCases = RRA_CASE_IDS.filter((caseId) => RRA_CASES[caseId].reasonKind === 'return-refused');

test('dry run: j12\'s reason line alone is no reason at j12′: every refused-return case stays MISSING', async () => {
  for (const caseId of refusedReturnCases) {
    const { graded } = await grade(caseId, {}, { j12Reason: true });
    assert.equal(graded.verdict, 'MISSING-candidate', caseId);
    assert.ok(graded.missing.includes('refusal-reason-not-observed') || graded.missing.includes('reason-not-from-replacement'), `${caseId}: ${graded.missing}`);
  }
});

test('dry run: a refusal at any stage but the pinned one, or the one other its bytes name, is never PASS', async () => {
  for (const caseId of refusedReturnCases) {
    const spec = RRA_CASES[caseId];
    const firstStages = [spec.refusedAt, ...Object.keys(spec.otherFirstStages ?? {})];
    for (const wrong of ['enqueue', 'replay', 'wake', 'prompt-drain'].filter((stage) => !firstStages.includes(stage))) {
      const { graded } = await grade(caseId, {}, { stage: wrong });
      assert.notEqual(graded.verdict, 'PASS-candidate', `${caseId} at ${wrong}`);
      assert.ok(graded.missing.includes('refusal-stage-mismatch'), `${caseId} at ${wrong}: ${JSON.stringify(graded)}`);
    }
  }
});

// 🕯's live run at 2907e656 (rra-88e4fd22f0b122a8): reassigned's one refusal line was the probe turn's
// drain. A sweep that replays the row between the delete's consume and its epoch commit re-queues the
// copy, so the drain refuses it; that sweep logs its arming line while the delete is in flight.
test('dry run: reassigned refused by the probe turn\'s drain grades PASS-candidate only with a sweep seen inside the delete', async () => {
  const { record, graded } = await grade('reassigned', {}, { stage: 'prompt-drain', sweepInTransition: true });
  assert.equal(record.reason.stage, 'prompt-drain');
  assert.ok(record.reason.observedAtMs > record.target.probeSentAtMs);
  assert.deepEqual(record.sweep, { armedInTransition: 1 });
  assert.equal(graded.verdict, 'PASS-candidate', JSON.stringify(graded));
  assert.ok(record.transition.deleteSettledAtMs > record.transition.requestedAtMs && record.transition.deleteSettledAtMs < record.transition.settledAtMs, JSON.stringify(record.transition));
  for (const sweepInTransition of [false, 'after-delete']) {
    const unwitnessed = await grade('reassigned', {}, { stage: 'prompt-drain', sweepInTransition });
    assert.deepEqual(unwitnessed.record.sweep, { armedInTransition: 0 }, String(sweepInTransition));
    assert.equal(unwitnessed.graded.verdict, 'MISSING-candidate', JSON.stringify(unwitnessed.graded));
    assert.deepEqual(unwitnessed.graded.missing, ['no-sweep-armed-in-transition'], String(sweepInTransition));
  }
  // The pinned replay ordering needs none.
  assert.equal((await grade('reassigned', {})).graded.verdict, 'PASS-candidate');
});

test('dry run: a Delivered to line for a refused return after its transition is FAIL-candidate, j12\'s empty list included', async () => {
  for (const caseId of refusedReturnCases) {
    for (const options of [{ routedAfter: true }, { emptyListAfter: true }]) {
      const { graded } = await grade(caseId, {}, options);
      assert.equal(graded.verdict, 'FAIL-candidate', `${caseId} ${JSON.stringify(options)}`);
      assert.ok(graded.contradictions.includes('refused-return-routed'), caseId);
    }
  }
});

test('dry run: a wake-mode case transitions before its delegate fires and never parks a return', async () => {
  for (const caseId of refusedReturnCases.filter((id) => RRA_CASES[id].timing === 'before-return')) {
    const { drive, record } = await grade(caseId, { ack: 'wake' });
    assert.equal(drive.delegate_mode, 'silent-wake', caseId);
    assert.ok(drive.transition.settled_at_ms - drive.dispatch.observed_at_ms < drive.dispatch.result_delay_seconds * 1000, caseId);
    assert.equal(record.park.deliveredToTargetAtMs, null, caseId);
    assert.equal(record.reason.stage, 'enqueue', caseId);
    assert.equal(record.reason.deliveryIdHash, null, caseId);
    assert.equal(drive.probe_ran, true, caseId);
  }
});

test('dry run: a model that retries, or accepts another mode, makes the case MISSING, not FAIL', async () => {
  for (const [caseId, world] of [['unauthorized-admission', { retry: true }], ['revoked-visibility', { retry: true, adoptOnProbe: true }], ['revoked-visibility', { resultMode: 'silent-wake', adoptOnProbe: true }]]) {
    const { graded } = await grade(caseId, world);
    assert.equal(graded.verdict, 'MISSING-candidate', `${caseId} ${JSON.stringify(world)}: ${JSON.stringify(graded)}`);
    assert.deepEqual(graded.contradictions, [], caseId);
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

const workCase = 'work-revoked-visibility';

test('dry run: the continue_work case elects its own wake, narrows its own session after the capture and probes after the refusal', async () => {
  assert.equal(RRA_CASES[workCase].tool, 'continue_work');
  const { evidence: elected, frames } = await fire(workCase, {});
  const sent = frames.filter((frame) => frame.type === 'req');
  const sends = sent.filter((frame) => frame.method === 'sessions.send');
  assert.equal(elected.keys.parent, null, 'the electing session is the recipient: no parent');
  assert.deepEqual([...new Set(sends.map((frame) => frame.params.key))], [elected.keys.target], 'every turn is the electing session\'s');
  assert.ok(sends[0].params.message.includes('Call the continue_work tool'), 'the first turn elects');
  assert.ok(!sends.some((frame) => frame.params.message.includes('continue_delegate')), 'no delegate is dispatched');
  assert.deepEqual(
    sent.filter((frame) => frame.method === 'session.visibility.set').map((frame) => [frame.params.sessionKey, frame.params.visibility]),
    [[elected.keys.target, 'read-only']],
    'the transition narrows the electing session itself',
  );
  assert.deepEqual(sent.filter((frame) => frame.method === 'sessions.create').map((frame) => frame.params.key), [elected.keys.target]);
  const { drive, record, graded } = await grade(workCase, {});
  assert.equal(drive.dispatch.status, 'scheduled');
  assert.equal(drive.dispatch.result_delay_seconds, 30);
  assert.deepEqual(drive.priming_run_ids, ['run-e'], 'the electing run is the one run excluded');
  assert.equal(drive.other_work_calls, 0);
  assert.equal(drive.other_delegate_calls, 0);
  assert.ok(drive.transition.requested_at_ms > drive.dispatch.observed_at_ms, 'the transition follows the scheduled result');
  assert.ok(drive.probe_sent_at_ms > drive.transition.settled_at_ms, 'the probe follows the transition');
  assert.ok(record.epochs.capturedAfterMs < record.epochs.capturedByMs && record.epochs.capturedByMs < record.transition.requestedAtMs, JSON.stringify(record.epochs));
  assert.equal(record.reason.kind, 'work-refused');
  assert.equal(record.reason.stage, 'wake');
  assert.equal(record.reason.distinctFlowIds, 1);
  assert.match(record.reason.flowIdHash, /^[0-9a-f]{64}$/u);
  assert.ok(!JSON.stringify(record).includes(FLOW), 'the flowId is published as SHA-256 only');
  assert.equal(record.routing, null, 'no router line belongs to a kept wake');
  assert.equal(graded.verdict, 'PASS-candidate', JSON.stringify(graded));
});

test('dry run: the continue_work case is never PASS without j12′\'s work-refused line at stage=wake, before the probe, naming one election', async () => {
  for (const [label, options, code] of [
    ['no line', { reason: false }, 'refusal-reason-not-observed'],
    // The analog of j12's line for a return: another reason kind naming the same session.
    ['a return-refused line instead', { returnLineInstead: true }, 'refusal-reason-not-observed'],
    ['stage=replay', { stage: 'replay' }, 'refusal-stage-mismatch'],
    ['stage=adoption', { stage: 'adoption' }, 'refusal-stage-mismatch'],
    ['an unbound election\'s reason', { workReason: 'recipient-authority-unverifiable' }, 'refusal-reason-mismatch'],
    ['logged after the probe was sent', { workAfterProbe: true }, 'reason-not-before-probe'],
    ['a second election', { secondFlow: true }, 'reason-flow-id-ambiguous'],
  ]) {
    const { graded } = await grade(workCase, {}, options);
    assert.equal(graded.verdict, 'MISSING-candidate', `${label}: ${JSON.stringify(graded)}`);
    assert.ok(graded.missing.includes(code), `${label}: ${graded.missing}`);
    assert.deepEqual(graded.contradictions, [], label);
  }
});

test('dry run: a refused kept wake that still ran a turn is FAIL-candidate, the work line notwithstanding', async () => {
  const { graded } = await grade(workCase, { workWake: true });
  assert.equal(graded.verdict, 'FAIL-candidate', JSON.stringify(graded));
  assert.ok(graded.contradictions.includes('target-woken'));
  // Review finding: a call the wrongly run wake turn makes is part of that wake, never a deviation
  // of the electing run, so it cannot turn the FAIL into MISSING.
  const { drive, graded: elected } = await grade(workCase, { workWake: true, wakeElects: true });
  assert.equal(drive.other_work_calls, 0, 'only the electing and probe runs are counted');
  assert.equal(elected.verdict, 'FAIL-candidate', JSON.stringify(elected));
  assert.ok(elected.contradictions.includes('target-woken'));
});

test('dry run: an election in the probe turn is a model deviation: MISSING, never FAIL', async () => {
  const { drive, graded } = await grade(workCase, { workWake: true, probeElects: true });
  assert.equal(drive.other_work_calls, 1);
  assert.equal(graded.verdict, 'MISSING-candidate', JSON.stringify(graded));
  assert.ok(graded.missing.includes('extra-work-calls'));
  assert.deepEqual(graded.contradictions, []);
});

test('dry run: a continue_work capture not seen before the transition, or a second election, is MISSING, never FAIL', async () => {
  for (const [label, world, options, code] of [
    ['capture after the transition', { workWake: true }, { captureLate: true }, 'capture-not-before-transition'],
    ['a retried election', { workWake: true, retry: true }, {}, 'extra-work-calls'],
  ]) {
    const { graded } = await grade(workCase, world, options);
    assert.equal(graded.verdict, 'MISSING-candidate', `${label}: ${JSON.stringify(graded)}`);
    assert.ok(graded.missing.includes(code), `${label}: ${graded.missing}`);
    assert.deepEqual(graded.contradictions, [], `${label}: a wake of a binding the transition did not stale is correct`);
  }
});

test('dry run: outside the control the scenario refuses before it sends a frame', async () => {
  for (const env of [{ OPENCLAW_RCD_RA_RUN: '' }, { OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9' }, { OPENCLAW_RCD_RA_CASE: 'stale' }, { OPENCLAW_RCD_RA_PHASE: 'observe' }]) {
    const { evidence, frames } = await fire('revoked-visibility', {}, { env });
    assert.ok(evidence.refusals.length > 0, JSON.stringify(env));
    assert.equal(frames.length, 0, JSON.stringify(env));
  }
});
