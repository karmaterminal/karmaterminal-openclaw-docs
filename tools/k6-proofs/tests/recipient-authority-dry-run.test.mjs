// R-CD-RECIPIENT-AUTHORITY dry run against the mock-gateway pattern (helpers/k6-node-runtime.mjs).
//
// The real case driver (scenarios/r-cd-recipient-authority.js) runs in Node against a scripted
// gateway shaped like the public surface of the merged j12′ (a22bd9c05c): hello-ok, sessions.*,
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
import * as control from '../scripts/run-recipient-authority-row.mjs';
import { RRA_CASES, RRA_CASE_IDS, RRA_J12, RRA_PINNED, RRA_ROW, gradeRecipientAuthorityCase, scenarioMethodsFor } from '../lib/recipient-authority-row.mjs';
import * as rowLib from '../lib/recipient-authority-row.mjs';
import { runK6Scenario } from './helpers/k6-node-runtime.mjs';

// What 🌊's ordering ruling (room msg 1567623059727458526) added is read through the namespace, so this
// file still loads against a lib without it and each new pin fails on its own assertion. So is the
// control's capture gate for work-revoked-visibility (docs#620, pins (o1)-(o4)).
const specOf = (caseId) => rowLib.rraCaseSpec?.(caseId) ?? RRA_CASES[caseId];
const EARLY_PINS = rowLib.RRA_EARLY_ENQUEUE_PINS ?? {};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN = 'rra-0123456789abcdef';
const CHILD = 'agent:main:subagent:continuation-rra-child';
const FLOW = '6f1e2d3c-0000-4000-8000-00000000f10e';
const ALL_METHODS = [...new Set([...RRA_CASE_IDS, ...Object.keys(EARLY_PINS)].flatMap((caseId) => scenarioMethodsFor(caseId)))];

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const say = (text, runId) => ({ role: 'assistant', content: [{ type: 'text', text }], __openclaw: { runId } });
const toolCall = (id, name, args, runId) => ({ role: 'assistant', content: [{ type: 'toolCall', id, name, arguments: args }], __openclaw: { runId } });
const toolResult = (id, name, payload, runId, isError = false) => ({
  role: 'toolResult', toolCallId: id, toolName: name, isError,
  content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }], __openclaw: { runId },
});

// 🌊's conditional probe (room msg 1567590902694936678), its condition worded as room msg
// 1567656724549075047 rules, quoted here rather than imported, so the driver's text is pinned to the
// ruling itself. The driver keeps its harness header before it.
const PROBE_CONDITION = 'If your context includes the internal task completion for the proof you were primed for, follow that priming instruction instead.';
// The condition from the conditional-probe lane (b822d7c5, head 53c1c192) to 663fafdc, as room msg
// 1567590902694936678 first worded it. The scripted model reads it literally; only pin (h) sends it.
const THIS_TURN_CONDITION = 'If this turn includes the internal task completion for the proof you were primed for, follow that priming instruction instead.';
const probeTextFor = (probeNonce) => `[k6-proof-harness] ${RRA_ROW} probe ${probeNonce}: ${PROBE_CONDITION} Otherwise reply exactly PROBE-OK ${probeNonce}.`;
// work-revoked-visibility's own probe (🌊's ruling (a), room msg 1567736961190596741), as docs#620's
// workorder words it, quoted here rather than imported, and its hash from that text.
const workProbeTextFor = (probeNonce) => `[k6-proof-harness] ${RRA_ROW} probe ${probeNonce}: Reply exactly PROBE-OK ${probeNonce}.`;
const slotHash = (text) => createHash('sha256').update(text).digest('hex');
const WORK_PROBE_SHA256 = slotHash(workProbeTextFor('<probeNonce>'));
const SHARED_PROBE_SHA256 = slotHash(probeTextFor('<probeNonce>'));
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
 * The primed model reads the probe it was sent. With the return in its context, 🌊's conditional
 * probe hands the turn back to the priming: the ack alone, no PROBE-OK. An unconditional `reply exactly
 * PROBE-OK` wins over the priming instead: PROBE-OK and no ack, as 🕯's run rra-88e4fd22f0b122a8
 * showed (allowed-silent: probe_ran true, probeReplied true, target_obs.ackRuns 0; room msg
 * 1567590581796868168). With no return, either probe is answered PROBE-OK <the nonce it names>.
 * Before the conditional probe this model answered the ack and PROBE-OK in one row whatever the
 * probe said, which is why the dry run passed allowed-silent while the live run could not.
 * `probeAck` overrides the model's answer: 'ack' (one row: the ack and PROBE-OK), 'ack-only' (the
 * ack alone), 'none' (PROBE-OK only), 'wrong-nonce' (the ack with the probe's nonce), 'twice' (two
 * ack rows), 'heartbeat-refused' (the ack through a heartbeat_respond call the turn refuses, then
 * PROBE-OK), 'probe-ok-other' (PROBE-OK with another probe's nonce), 'probe-ok-row-nonce' (PROBE-OK
 * with the row nonce), 'silent' (no row in the probe run), 'woke' (one row: the continue_work reason's
 * `RCDRA-WOKE <nonce>` and PROBE-OK), 'woke-only' (`RCDRA-WOKE <nonce>` alone). `probeMarker`, and
 * `adoptOnProbe` by default, put the marker on the probe row: a product no pin is, kept so the
 * marker check stays covered. `markerOnly` keeps the old meaning: the marker and no ack.
 * `primingAck` adds an ack row to the priming run; `wakeAck` a woken run that acks before the probe.
 *
 * allowed's wake (🌊's ruling, room msg 1567623059727458526): `ack: 'wake'` is a woken run that acks
 * (the direct path), `'wake-no-ack'` a woken run that answers without the ack (🕯's rra-a4d5318d426ad728
 * shape), `'none'` no wake at all. After a woken run, the return's completion is in the model's
 * context but not in the probe's turn. `lateWakeAck` puts the woken run's ack in the transcript only
 * once the fallback probe has been sent.
 *
 * The model reads the probe's condition literally (🌿's review on #620, comment 6642952113). "If your
 * context includes" (room msg 1567656724549075047) holds a completion that any turn took in: the
 * probe turn's own drain, or allowed's woken run before it. "If this turn includes", the condition
 * through 663fafdc, holds only one that this turn's drain adopted, so on allowed's fallback
 * it is answered PROBE-OK. Until 663fafdc this model read both wordings as "in context", which is
 * why the dry run passed allowed's fallback while a literal model could not.
 *
 * The continue_work case's session is primed by its election alone, whose instruction ends "perform
 * the call, then no other action". "If your context includes" hands that session's turn back to the
 * election, and the model stays silent: both whole 13s at that wording (rra-eaa61a458beaf344 at docs
 * 8bf9baf9, rra-3dd1c2a556ae087f at docs 93a93786) left the case's probe unanswered, while the
 * "this turn" wording, which no turn of it meets, was answered (rra-a4d5318d426ad728; 🌿's
 * classification on #620, comment 6648556457). Its own unconditional probe asks for PROBE-OK alone.
 * Until docs#620's work-probe lane this model answered PROBE-OK to every probe in that case, which is
 * why the dry run passed it while both live runs could not.
 */
function gatewayFor(world, sessions = {}) {
  const spec = specOf(world.caseId);
  const push = (key, message) => {
    sessions[key] ??= { messages: [] };
    sessions[key].messages.push(message);
  };
  let policy = 'enabled';
  let nonce = null;
  let parentKey = null;
  let primes = 0;
  let ackDue = false;
  let woken = false;
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
          // The primed model acks it in the probe run only when the probe's condition, read
          // literally, hands the turn back to its priming. After allowed's woken run the completion
          // is already in its context, but not in this turn.
          const drained = world.adoptOnProbe || (spec.probeAdopts && childSpawned);
          const inContext = drained || woken;
          const marker = world.probeMarker ?? world.adoptOnProbe === true;
          const handsBack = message.includes(PROBE_CONDITION) ? inContext : message.includes(THIS_TURN_CONDITION) ? drained : false;
          // The continue_work session's context holds its election, which the context condition hands
          // the turn back to: "no other action".
          const backToElection = spec.tool === 'continue_work' && message.includes(PROBE_CONDITION);
          const answer = world.probeAck ?? (backToElection ? 'silent' : handsBack && !world.markerOnly ? 'ack-only' : 'none');
          // A silent return that woke the target anyway, and whose wake acked it.
          if (world.wakeAck) push(p.key, say(`TARGET-ACK ${nonce}`, 'run-wake'));
          // allowed's woken run's ack, seen only after the fallback decision.
          if (world.lateWakeAck) push(p.key, say(`TARGET-ACK ${nonce}`, 'run-wake'));
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
          else if (answer === 'silent') {
            // The model stays silent: no row in the probe run.
          } else if (answer === 'woke') push(p.key, say(`RCDRA-WOKE ${nonce}\nPROBE-OK ${probe[1]}`, 'run-probe'));
          else if (answer === 'woke-only') push(p.key, say(`RCDRA-WOKE ${nonce}`, 'run-probe'));
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
        // The woken target acknowledges once its current head was primed after the dispatch, or with
        // 'wake-no-ack' answers its wake without the ack.
        if (ackDue && p.sessionKey !== parentKey && sessions[p.sessionKey]?.messages.some((m) => /TARGET-READY/.test(m.content?.[0]?.text || '')) && primes >= (spec.reprime ? 2 : 1)) {
          push(p.sessionKey, say(world.ack === 'wake-no-ack' ? 'Noted: the delegate finished.' : `TARGET-ACK ${nonce}`, 'run-wake'));
          ackDue = false;
          woken = true;
        }
        return ok({ messages: sessions[p.sessionKey]?.messages || [] });
      }
      default: return [{ type: 'res', id: frame.id, ok: false, error: { code: 'INVALID_REQUEST', message: `unknown method: ${frame.method}` } }];
    }
  };
}

async function fire(caseId, world = {}, { phase = 'drive', state = null, env = {}, gateway = gatewayFor({ caseId, ...world }), clockStart = 1_800_000_000_000 } = {}) {
  // Wall-clock stamps the scenario takes must order like the virtual timers it schedules; a later
  // phase of the same case starts its clock where the control's own step left it.
  const realNow = Date.now;
  let clock = clockStart;
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
    return { evidence: records[0], frames, log, clock };
  } finally {
    Date.now = realNow;
  }
}

const CLOCK_START = 1_800_000_000_000;
/** The epoch the continue_work election captures, and the one its transition advances it to. */
const WORK_CAPTURED_EPOCH = '11111111-1111-4111-8111-111111111111';
const WORK_ADVANCED_EPOCH = '22222222-2222-4222-8222-222222222222';

/**
 * work-revoked-visibility's capture gate as the control runs it (run-recipient-authority-row.mjs,
 * awaitWorkCapture: the read and the release decided at it), on a scripted store: the control's sampler reads the
 * session_recipient_authority table every 500 ms from the case's start, and the session's row first
 * appears `captureAfterMs` after the scenario read the `scheduled` result (null: never). The control's
 * clock starts where the drive ended and moves only while it waits. Returns the gate as the record
 * takes it, the sampled timeline, the clock, and how many times the control read the store.
 */
async function gateCapture(drive, { captureAfterMs = 6_000, startAt }) {
  const key = drive.keys.target;
  const capturedAtMs = drive.dispatch.observed_at_ms;
  const captureAt = captureAfterMs === null ? Infinity : capturedAtMs + captureAfterMs;
  const timeline = [];
  let clock = startAt;
  let nextSample = CLOCK_START;
  const sample = () => {
    for (; nextSample <= clock; nextSample += 500) {
      timeline.push({ atMs: nextSample, state: 'read', rows: nextSample >= captureAt ? [{ session_key: key, epoch: WORK_CAPTURED_EPOCH }] : [] });
    }
  };
  sample();
  let reads = 0;
  const platform = {
    now: () => {
      reads += 1;
      return clock;
    },
    sleep: async (ms) => {
      clock += ms;
      sample();
    },
  };
  // The control's own read and release decision; the gateway is the control's own throughout.
  const captureGate = await control.awaitWorkCapture({
    timeline,
    key,
    sinceMs: CLOCK_START,
    deadlineAtMs: rowLib.rraWorkCaptureDeadline({ capturedAtMs, resultDelaySeconds: drive.dispatch.result_delay_seconds }),
    platform,
    release: () => true,
  });
  return { captureGate, timeline, now: clock, reads };
}

/**
 * One case as the control runs it: the drive phase; for a parked case that hands over, the control's
 * witness of the parked copy (the router's Delivered to line for the target from the child, logged
 * 100 ms after the drive ended) and then the transition phase it releases; for the continue_work case
 * that hands over, the control's read of the capture in the store (gateCapture; `capture` its options)
 * and then the transition phase it releases; for replay-restart, the observe phase after the restart.
 * `witness: false` is a control that never saw the line: no transition phase runs. Every phase's
 * frames, in order, with the phase that sent them.
 */
async function runCase(caseId, world = {}, { gateway = gatewayFor({ caseId, ...world }), witness: seen = true, capture = {} } = {}) {
  const ran = await fire(caseId, world, { gateway });
  const drive = ran.evidence;
  const frames = ran.frames.map((frame) => ({ ...frame, phase: 'drive' }));
  let now = ran.clock;
  let transition = null;
  let witness = null;
  let captureGate = null;
  let storeTimeline = null;
  if (drive.handoff?.ready_for_witness) {
    witness = seen ? { parkedCopyAtMs: now + 100, releasedAtMs: now + 200 } : { parkedCopyAtMs: null, releasedAtMs: null };
    if (seen) {
      const next = await fire(caseId, world, { phase: 'transition', state: drive, gateway, clockStart: now + 1_000 });
      transition = next.evidence;
      frames.push(...next.frames.map((frame) => ({ ...frame, phase: 'transition' })));
      now = next.clock;
    }
  }
  let storeReads = 0;
  if (drive.handoff?.ready_for_capture) {
    const gated = await gateCapture(drive, { ...capture, startAt: now });
    ({ captureGate, now, reads: storeReads } = gated);
    storeTimeline = gated.timeline;
    if (captureGate.releasedAtMs !== null) {
      const next = await fire(caseId, world, { phase: 'transition', state: drive, gateway, clockStart: now + 1_000 });
      transition = next.evidence;
      frames.push(...next.frames.map((frame) => ({ ...frame, phase: 'transition' })));
      now = next.clock;
    }
  }
  const handed = transition ?? drive;
  let observe = null;
  if (specOf(caseId).restart && handed.handoff?.ready_for_restart) {
    const next = await fire(caseId, world, { phase: 'observe', state: handed, gateway, clockStart: now + 1_000 });
    observe = next.evidence;
    frames.push(...next.frames.map((frame) => ({ ...frame, phase: 'observe' })));
  }
  return { drive, transition, observe, final: observe ?? transition ?? drive, frames, witness, captureGate, storeTimeline, storeReads };
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
 * captureLate (the session's authority row first appears after the transition was requested),
 * storeTimeline (the store as the control's capture gate sampled it, gateCapture). A kept wake whose
 * transition was never sent is refused by nothing: no work line.
 * sweepInTransition: the pending sweep's arming line while the delete was in flight
 * ('after-delete': after the delete's response, while the create was in flight).
 * routedAfterProbe: the router's Delivered to line lands only after the probe was sent;
 * routedFrom: the source that line names, in place of the case's child.
 * witness: the control's witness of a parked case's copy ({ parkedCopyAtMs }): the Delivered to line
 * is logged then. enqueueInstead: the transition beat the return, so the router refused it at enqueue
 * with no row and logged no Delivered to line (the early-enqueue ordering).
 * `driven` is the evidence that holds the case's transition: the transition phase's for a parked case.
 */
function harnessFor(caseId, driven, final, { reason = true, stage = null, j12Reason = false, routedAfter = false, emptyListAfter = false, workReason = 'recipient-authority-changed', workAfterProbe = false, returnLineInstead = false, secondFlow = false, captureLate = false, storeTimeline = null, sweepInTransition = false, routedAfterProbe = false, routedFrom = CHILD, witness = null, enqueueInstead = false } = {}) {
  const spec = specOf(caseId);
  const { target, parent } = driven.keys;
  const transition = driven.transition || {};
  const capturedAt = driven.dispatch?.observed_at_ms ?? 1;
  const transitionAt = transition.requested_at_ms ?? capturedAt + 5;
  const settledAt = transition.settled_at_ms ?? transitionAt + 1;
  const restartedAtMs = spec.restart ? settledAt + 5 : null;
  const durable = spec.family === 'refusal' && spec.expectChild !== false;
  const logEntries = [];
  // A parked or allowed return is routed while current: before the transition, when the control saw
  // it. A wake-mode refusal is refused by the router itself, which logs no Delivered to line.
  if (spec.expectChild !== false && spec.timing !== 'before-return' && !enqueueInstead) {
    const routedAt = routedAfterProbe ? final.probe_sent_at_ms + 1 : Number.isFinite(witness?.parkedCopyAtMs) ? witness.parkedCopyAtMs : transitionAt - 1;
    logEntries.push({ atMs: routedAt, text: `[continuation:targeted-return] Delivered to ${target} from ${routedFrom}`, generation: 0 });
  }
  if (reason && spec.reasonKind === 'dispatch-policy') {
    logEntries.push({ atMs: transitionAt + 3, text: `[continuation:delegate-rejected] policy.cross_session_targeting task=RCDRA session=${parent}`, generation: 0 });
  }
  if (reason && spec.reasonKind === 'return-refused') {
    const refusedAt = enqueueInstead ? 'enqueue' : stage ?? spec.refusedAt;
    // Where j12′ refuses it: the probe's drain, the sweep after the transition, the router after
    // it, or the replacement's boot replay.
    const atMs = spec.restart && !enqueueInstead ? restartedAtMs + 3 : refusedAt === 'prompt-drain' ? final.probe_sent_at_ms + 3 : settledAt + 3;
    const deliveryId = (spec.deliveryId && !enqueueInstead) || refusedAt !== 'enqueue' ? ` deliveryId=${DELIVERY_ID}` : '';
    const text = j12Reason
      ? `2026-11-03T08:00:00.000Z [gateway/restart-sentinel] session event delivery skipped: recipient authority changed sessionKey=${target} queueId=q-1`
      : consoleLine('continuation/return-refused', `[continuation:return-refused] stage=${refusedAt} reason=recipient-authority-changed session=${target}${deliveryId}`);
    logEntries.push({ atMs, text, generation: spec.restart ? 1 : 0 });
  }
  if (reason && spec.reasonKind === 'work-refused' && Number.isFinite(transition.requested_at_ms)) {
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
  const e1 = WORK_CAPTURED_EPOCH;
  const e2 = WORK_ADVANCED_EPOCH;
  if (spec.tool === 'continue_work') {
    // The election is captured after its scheduled result: the session's row first appears then, in
    // the store the control's gate sampled before it released the transition (without a gate, a drive
    // that handed nothing over, just before the transition), or, captureLate, only after the
    // transition was requested. The transition advances it; one never sent advances nothing.
    const sampled = storeTimeline ?? [
      { atMs: capturedAt - 1, state: 'read', rows: [] },
      { atMs: transitionAt - 1, state: 'read', rows: [{ session_key: target, epoch: e1 }] },
    ];
    const timeline = [
      ...(captureLate ? sampled.map((sample) => ({ ...sample, rows: [] })) : sampled),
      ...(Number.isFinite(transition.requested_at_ms)
        ? [
            { atMs: settledAt, state: 'read', rows: [{ session_key: target, epoch: e2 }] },
            { atMs: settledAt + 1_000, state: 'read', rows: [{ session_key: target, epoch: e2 }] },
          ]
        : []),
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

async function grade(caseId, world = {}, harnessOptions = {}, gateway = gatewayFor({ caseId, ...world })) {
  // One scripted store for every phase: the replacement generation serves the same state.
  const { capture, ...harness } = harnessOptions;
  const { drive, transition, observe, final, frames, witness, captureGate, storeTimeline, storeReads } = await runCase(caseId, world, { gateway, witness: harness.witness !== false, capture });
  if (specOf(caseId).restart && harness.witness !== false) assert.equal((transition ?? drive).handoff?.ready_for_restart, true, 'the case hands over for the restart');
  const driven = transition ?? drive;
  const record = assembleCaseRecord({
    caseId,
    runId: RUN,
    docsSha: 'd'.repeat(40),
    gates: { candidatePinned: true, buildInfoCommit: RRA_PINNED, stateIsolated: true, modelSignIn: true, crossSessionTargetingEnabled: true, gatewayStartedByHarness: true },
    evidence: drive,
    transitionEvidence: transition,
    observeEvidence: observe,
    witness,
    captureGate,
    ...harnessFor(caseId, driven, final, { ...harness, witness, storeTimeline }),
    cleanup: { gatewayStopped: true, residue: false },
    startedAtMs: 1,
  });
  if (specOf(caseId).expectChild !== false) record.trace = { correlated: true };
  return { drive, transition, observe, final, frames, record, captureGate, storeReads, graded: gradeRecipientAuthorityCase(record) };
}

test('dry run: every case drives its public surfaces and grades PASS-candidate against a j12′-shaped gateway', async () => {
  for (const caseId of RRA_CASE_IDS) {
    const { drive, record, graded } = await grade(caseId, { ack: 'wake' });
    assert.deepEqual(record.scenario.refusals, [], `${caseId}: ${record.scenario.refusals}`);
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
    const { drive, transition, frames } = await runCase(caseId, {}, { gateway: gatewayFor({ caseId }, store) });
    // reassigned's delete and re-create run in its transition phase, after the witness.
    const evidence = transition ?? drive;
    assert.equal(evidence.control_run_id, RUN, caseId);
    assert.equal(evidence.transition.error, null, `${caseId}: ${evidence.transition.error}`);
    assert.equal(evidence.transition.ok, true, caseId);
    assert.deepEqual([...drive.refusals, ...(transition?.refusals ?? [])], [], `${caseId}: ${evidence.refusals}`);
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
    const { drive, transition, observe, frames } = await runCase(caseId, { ack: 'wake' }, { gateway: gatewayFor({ caseId, ack: 'wake' }, store) });
    const refusals = [drive, transition, observe].filter(Boolean).flatMap((phase) => phase.refusals);
    assert.deepEqual(refusals, [], `${caseId}: ${refusals}`);
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
    const { frames } = await runCase(caseId, { ack: 'wake' });
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

test('dry run: (a) a refusal with no return is sent its probe, answers PROBE-OK <probe nonce> and no ack, and passes: the conditional probe for a delegate case, its own for the work case', async () => {
  for (const caseId of refusalCases) {
    const { final, frames, record, graded } = await grade(caseId);
    assert.deepEqual([record.target.probeReplied, record.target.probeAckRows, record.target.ackRuns], [true, 0, 0], caseId);
    assert.deepEqual(graded, { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] }, caseId);
    // A delegate refusal gets the same stimulus allowed-silent gets: nothing in its probe asks for
    // PROBE-OK unconditionally (at 4f86dd78 it did). work-revoked-visibility has no return to hand back,
    // and gets its own unconditional probe (🌊's ruling (a), room msg 1567736961190596741).
    const expected = RRA_CASES[caseId].tool === 'continue_work' ? workProbeTextFor(final.probe_nonce) : probeTextFor(final.probe_nonce);
    assert.deepEqual(probeFrames(frames).map((frame) => frame.params.message), [expected], caseId);
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

test('dry run: (e) every delegate case that probes sends one probe text, 🌊\'s wording with its own nonce, the work case its own, and each text test refuses one naming TARGET-ACK or the row nonce', async () => {
  // The text test and the receipt's binding are new with the conditional probe; the rest of this
  // file needs nothing new. The work probe's text test is read through the namespace (🌊's ruling (a),
  // room msg 1567736961190596741).
  const { RRA_PROBE_TEXT_SHA256, rraProbeTextProblems } = await import('../lib/recipient-authority-row.mjs');
  const texts = new Set();
  const workTexts = new Set();
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
    const work = RRA_CASES[caseId].tool === 'continue_work';
    assert.deepEqual(sent, [work ? workProbeTextFor(final.probe_nonce) : probeTextFor(final.probe_nonce)], caseId);
    const [text] = sent;
    (work ? workTexts : texts).add(text.replaceAll(final.probe_nonce, '<probe nonce>'));
    const rowNonce = drive.nonce;
    const options = { rowNonce, probeNonce: final.probe_nonce };
    if (work) {
      // The work probe's own text test: no ack, row nonce, proof id, condition or the reason's marker.
      const workProblems = (value) => rowLib.rraWorkProbeTextProblems?.(value, options) ?? ['no-work-text-test'];
      assert.deepEqual(workProblems(text), [], caseId);
      for (const [label, bad, code] of [
        ['the ack marker', `${text} TARGET-ACK`, 'probe-names-ack'],
        ['the ack marker, lower case', text.replace('Reply exactly', 'target-ack: Reply exactly'), 'probe-names-ack'],
        ['the ack constant', `${text} RRA_ACK_MARKER`, 'probe-names-ack'],
        ['the row nonce', `${text} ${rowNonce}`, 'probe-names-row-nonce'],
        ['the proof id', `${text} proof ${rowNonce.slice(-16)}`, 'probe-names-row-nonce'],
        ['the shared condition', text.replace('Reply exactly', `${PROBE_CONDITION} Otherwise reply exactly`), 'probe-names-condition'],
        ['the "this turn" condition', text.replace('Reply exactly', `${THIS_TURN_CONDITION} Otherwise reply exactly`), 'probe-names-condition'],
        ['the reason\'s marker', `${text} RCDRA-WOKE`, 'probe-names-wake-marker'],
        ['the shared probe', probeTextFor(final.probe_nonce), 'probe-names-condition'],
        ['the probe at 4f86dd78', `[k6-proof-harness] ${RRA_ROW} probe ${final.probe_nonce}: reply exactly PROBE-OK ${final.probe_nonce}.`, 'probe-not-work-wording'],
      ]) {
        assert.ok(workProblems(bad).includes(code), `${caseId} ${label}: ${workProblems(bad)}`);
      }
      // The shared text test refuses the work probe, so neither text passes for the other.
      assert.deepEqual(rraProbeTextProblems(text, options), ['probe-not-conditional-wording'], caseId);
      continue;
    }
    assert.deepEqual(rraProbeTextProblems(text, options), [], caseId);
    for (const [label, bad, code] of [
      ['the ack marker', `${text} TARGET-ACK`, 'probe-names-ack'],
      ['the ack marker, lower case', text.replace('priming instruction', 'target-ack instruction'), 'probe-names-ack'],
      ['the ack constant', `${text} RRA_ACK_MARKER`, 'probe-names-ack'],
      ['the row nonce', `${text} ${rowNonce}`, 'probe-names-row-nonce'],
      ['the proof id the priming names', text.replace('the proof you were primed for', `proof ${rowNonce.slice(-16)}`), 'probe-names-row-nonce'],
      ['the probe at 4f86dd78', `[k6-proof-harness] ${RRA_ROW} probe ${final.probe_nonce}: reply exactly PROBE-OK ${final.probe_nonce}.`, 'probe-not-conditional-wording'],
      ['the work probe', workProbeTextFor(final.probe_nonce), 'probe-not-conditional-wording'],
    ]) {
      assert.ok(rraProbeTextProblems(bad, options).includes(code), `${caseId} ${label}: ${rraProbeTextProblems(bad, options)}`);
    }
  }
  assert.equal(texts.size, 1, [...texts].join('\n'));
  assert.deepEqual([...workTexts], [workProbeTextFor('<probe nonce>')]);
  // Each receipt names the probe it sent, by the text's hash with its nonce as the slot; a case that
  // sends no probe names none.
  for (const { caseId, final, sent, record } of receipts) {
    if (sent.length === 0) {
      assert.equal(record.target.probeTextSha256, null, caseId);
      continue;
    }
    const work = RRA_CASES[caseId].tool === 'continue_work';
    assert.equal(record.target.probeTextSha256, work ? WORK_PROBE_SHA256 : RRA_PROBE_TEXT_SHA256, caseId);
    if (work) assert.equal(record.target.probeTextSha256, rowLib.RRA_WORK_PROBE_TEXT_SHA256, caseId);
    assert.equal(record.target.probeTextSha256, createHash('sha256').update(sent[0].replaceAll(final.probe_nonce, '<probeNonce>')).digest('hex'), caseId);
  }
});

/*
 * 🌊's ruling, room msg 1567623059727458526, on 🕯's fresh 13 (rra-a4d5318d426ad728: revoked-owner refused
 * at enqueue, its owner change settled before the return was enqueued; allowed woken without an ack):
 * "For `revoked-owner`, force the intended ordering: witness the queued/parked copy first, then change
 * owner and prove refusal at probe-drain. If the fixture also supports the earlier-enqueue ordering,
 * pin it separately; don't let that substitute for the parked-copy claim. For `allowed`, use the same
 * conditional probe only when the woken run has no ACK. Credit exactly one nonce-bound ACK in that probe
 * run, after the delivered return, and label the receipt probe-mediated rather than claiming an ACK in
 * the wake turn. No ACK remains MISSING, never FAIL. Pin both the direct-wake and fallback paths before
 * another 13." Pins (p)-(g).
 */
const parkedCases = RRA_CASE_IDS.filter((caseId) => RRA_CASES[caseId].timing === 'parked');
const revokedCases = ['revoked-visibility', 'revoked-membership', 'revoked-owner'];
// A frame that applies a case's authority transition: an RPC, or the owner change's model turn.
const isTransitionFrame = (frame) => frame.type === 'req' && (
  ['session.visibility.set', 'session.members.remove', 'sessions.delete'].includes(frame.method) ||
    (frame.method === 'sessions.send' && String(frame.params?.message).includes('assign_owner')));
const sorted = (values) => [...values].sort();

test('dry run: (p) a parked case sends its transition only once the control witnessed its return\'s queued copy, and passes only with that witness', async () => {
  assert.deepEqual(parkedCases, ['revoked-visibility', 'revoked-membership', 'revoked-owner', 'reassigned', 'replay-restart']);
  for (const caseId of parkedCases) {
    const { drive, transition, frames, record, graded } = await grade(caseId);
    // The drive ends once the child returned, sending no transition, and hands over for the witness.
    assert.deepEqual(drive.handoff, { ready_for_witness: true }, caseId);
    assert.equal(drive.transition.requested_at_ms, null, caseId);
    assert.deepEqual(frames.filter((frame) => frame.phase === 'drive' && isTransitionFrame(frame)), [], `${caseId}: no transition in the drive`);
    // The transition phase sends it, after the control's release.
    assert.ok(transition, caseId);
    assert.ok(frames.some((frame) => frame.phase === 'transition' && isTransitionFrame(frame)), caseId);
    assert.ok(record.witness.parkedCopyAtMs <= record.witness.releasedAtMs && record.witness.releasedAtMs <= record.transition.requestedAtMs, `${caseId}: ${JSON.stringify([record.witness, record.transition])}`);
    // The witness is the line the grade reads as the park: the router's, for the target, from the child.
    assert.equal(record.witness.parkedCopyAtMs, record.park.deliveredFromChildAtMs, caseId);
    assert.deepEqual(graded, { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] }, caseId);
    // A control that never saw the line releases nothing: no transition is sent, and the case is MISSING.
    const unseen = await grade(caseId, {}, { witness: false });
    assert.equal(unseen.transition, null, caseId);
    assert.deepEqual(unseen.frames.filter(isTransitionFrame), [], `${caseId}: no transition without the witness`);
    assert.equal(unseen.graded.verdict, 'MISSING-candidate', caseId);
    assert.ok(unseen.graded.missing.includes('parked-copy-unwitnessed'), `${caseId}: ${unseen.graded.missing}`);
    assert.deepEqual(unseen.graded.contradictions, [], caseId);
  }
  // A transition phase continues only a drive that handed over before any transition (review finding).
  for (const state of [{}, { handoff: { ready_for_witness: true }, transition: { requested_at_ms: 1_800_000_000_500 } }, { transition: { requested_at_ms: null } }]) {
    const { evidence, frames } = await fire('revoked-owner', {}, { phase: 'transition', state });
    assert.ok(evidence.refusals.some((refusal) => refusal.includes('continues only a drive that handed over')), `${JSON.stringify(state)}: ${evidence.refusals}`);
    assert.equal(frames.length, 0, JSON.stringify(state));
  }
  // Only a parked case, and the continue_work case gated on its capture (pins (o1)-(o4)), has a
  // transition phase.
  for (const caseId of RRA_CASE_IDS.filter((id) => !parkedCases.includes(id) && RRA_CASES[id].timing !== 'before-wake')) {
    const { evidence, frames } = await fire(caseId, {}, { phase: 'transition', state: {} });
    assert.ok(evidence.refusals.some((refusal) => refusal.includes('only a parked or a before-wake case has a transition phase')), `${caseId}: ${evidence.refusals}`);
    assert.equal(frames.length, 0, caseId);
  }
});

test('dry run: (q) an enqueue refusal fails the parked-copy case: MISSING, never PASS', async () => {
  for (const caseId of revokedCases) {
    // The transition beat the return: the router refused it at enqueue with no row and logged no
    // Delivered to line (🕯's revoked-owner in rra-a4d5318d426ad728).
    const { record, graded } = await grade(caseId, {}, { enqueueInstead: true });
    assert.deepEqual([record.reason.stage, record.reason.deliveryIdHash, record.park.deliveredToTargetAtMs], ['enqueue', null, null], caseId);
    assert.equal(graded.verdict, 'MISSING-candidate', `${caseId}: ${JSON.stringify(graded)}`);
    for (const code of ['parked-copy-unwitnessed', 'return-not-parked-before-transition', 'refusal-stage-mismatch', 'refusal-delivery-id-mismatch']) {
      assert.ok(graded.missing.includes(code), `${caseId} ${code}: ${graded.missing}`);
    }
    assert.deepEqual(graded.contradictions, [], caseId);
  }
});

test('dry run: (r) the early-enqueue ordering is its own pin with its own bytes, and never satisfies the parked-copy case', async () => {
  assert.deepEqual(Object.keys(EARLY_PINS), revokedCases.map((caseId) => `${caseId}-early-enqueue`), 'one pin per revoked case');
  for (const [pinId, pin] of Object.entries(EARLY_PINS)) {
    const parked = RRA_CASES[pin.pinOf];
    assert.deepEqual([pin.refusedAt, pin.deliveryId, pin.timing, pin.mode, pin.transition, pin.ordering], ['enqueue', false, 'before-return', parked.mode, parked.transition, 'early-enqueue'], pinId);
    assert.match(pin.refusedAtBytes, /targeting\.ts:277-280/u, pinId);
    assert.ok(!RRA_CASE_IDS.includes(pinId), `${pinId} is not a row case`);
    const { drive, frames, record } = await grade(pinId);
    assert.deepEqual(drive.refusals, [], `${pinId}: ${drive.refusals}`);
    // One phase: the transition is sent after the scheduled result and settles before the delegate fires.
    assert.equal(drive.handoff, undefined, pinId);
    assert.ok(frames.some((frame) => frame.phase === 'drive' && isTransitionFrame(frame)), pinId);
    assert.ok(drive.transition.settled_at_ms - drive.dispatch.observed_at_ms < drive.dispatch.result_delay_seconds * 1000, pinId);
    assert.deepEqual([record.reason.stage, record.reason.deliveryIdHash, record.park.deliveredToTargetAtMs, record.witness], ['enqueue', null, null, null], pinId);
    assert.deepEqual(rowLib.gradeEarlyEnqueuePin(record), { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] }, pinId);
    // Not a row case's receipt: the row's grade does not know it.
    assert.deepEqual(gradeRecipientAuthorityCase(record).missing, ['unknown-case'], pinId);
    // Offered as its revoked case's receipt, its shape fails the parked-copy oracle, with or without a
    // witness claimed for it.
    for (const witness of [null, { parkedCopyAtMs: record.transition.requestedAtMs - 1, releasedAtMs: record.transition.requestedAtMs - 1 }]) {
      const offered = gradeRecipientAuthorityCase({ ...record, case: pin.pinOf, witness });
      assert.equal(offered.verdict, 'MISSING-candidate', `${pinId} as ${pin.pinOf}: ${JSON.stringify(offered)}`);
      for (const code of ['parked-copy-unwitnessed', 'return-not-parked-before-transition', 'refusal-stage-mismatch']) assert.ok(offered.missing.includes(code), `${pinId} ${code}: ${offered.missing}`);
      assert.deepEqual(offered.contradictions, [], pinId);
    }
    // And the pin's grade is not the parked case's: a parked-copy receipt is no early-enqueue pin.
    const parkedRun = await grade(pin.pinOf);
    assert.deepEqual(rowLib.gradeEarlyEnqueuePin(parkedRun.record).missing, ['unknown-case'], pin.pinOf);
  }
});

test('dry run: (w) allowed\'s direct-wake path: one ack in its woken run passes, no probe is sent, and the receipt says direct-wake', async () => {
  const { frames, record, graded } = await grade('allowed', { ack: 'wake' });
  assert.deepEqual(probeFrames(frames), [], 'a woken run that acked gets no fallback probe');
  assert.deepEqual(record.ack, { path: 'direct-wake', fallbackDecision: null });
  assert.deepEqual([record.target.ackRuns, record.target.wakeAckRuns, record.target.foreignRuns, record.target.probeRan], [1, 1, 1, false]);
  assert.deepEqual(graded, { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] });
  // Its oracle is unchanged: routed and never woken is still FAIL, and no fallback probe is sent for it.
  const never = await grade('allowed', { ack: 'none' });
  assert.deepEqual(probeFrames(never.frames), []);
  assert.deepEqual(never.record.ack.path, 'direct-wake');
  assert.deepEqual([never.record.ack.fallbackDecision?.wokenRuns, never.record.ack.fallbackDecision?.ackRuns], [0, 0], 'the read that sent no probe');
  assert.equal(never.graded.verdict, 'FAIL-candidate');
  assert.deepEqual(never.graded.contradictions, ['allowed-return-not-adopted']);
});

test('dry run: (f) allowed\'s fallback: only after a woken run with no ack, the conditional probe, and one ack in its own run after the delivered return, labelled probe-mediated', async () => {
  const { final, frames, record, graded } = await grade('allowed', { ack: 'wake-no-ack' });
  // The same probe every probing case sends, once.
  assert.deepEqual(probeFrames(frames).map((frame) => frame.params.message), [probeTextFor(final.probe_nonce)]);
  assert.equal(record.target.probeTextSha256, rowLib.RRA_PROBE_TEXT_SHA256);
  // The read that sent it: a woken run, no ack.
  assert.equal(record.ack.path, 'probe-mediated');
  assert.deepEqual([record.ack.fallbackDecision.wokenRuns, record.ack.fallbackDecision.ackRuns], [1, 0]);
  assert.ok(record.ack.fallbackDecision.decidedAtMs <= record.target.probeSentAtMs);
  // The ack is the probe run's, never the wake turn's.
  assert.deepEqual(
    [record.target.probeAckRows, record.target.wakeAckRuns, record.target.ackRuns, record.target.foreignRuns, record.target.uncreditedAckRows, record.target.primingAckRows],
    [1, 0, 1, 1, 0, 0],
  );
  assert.ok(record.park.deliveredFromChildAtMs < record.target.probeSentAtMs, 'after the delivered return');
  assert.deepEqual(graded, { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] });
  // At 53c1c192 this woken run without an ack graded MISSING woken-without-ack, with no probe. At
  // 663fafdc the literal model answered its "this turn" probe PROBE-OK: pin (h).
});

test('dry run: (g) allowed\'s fallback refuses a duplicate, a probe after a wake ack, a pre-return or wrong-nonce ack and an unlabelled receipt; no ack is MISSING, never FAIL', async () => {
  for (const [label, world, options, change, missingCodes] of [
    ['no ack in the fallback either', { probeAck: 'none' }, {}, null, ['probe-ack-unobserved']],
    ['an ack in both the wake turn and the fallback', { lateWakeAck: true }, {}, null, ['duplicate-ack-wake-and-fallback', 'fallback-after-wake-ack']],
    ['the probe sent when the woken run already acked', {}, {}, (r) => { r.ack.fallbackDecision.ackRuns = 1; }, ['fallback-not-after-unacked-wake']],
    ['the probe sent with no woken run', {}, {}, (r) => { r.ack.fallbackDecision.wokenRuns = 0; }, ['fallback-not-after-unacked-wake']],
    ['no read before the probe', {}, {}, (r) => { r.ack.fallbackDecision = null; }, ['fallback-not-after-unacked-wake']],
    ['the fallback ack before the delivered return', {}, { routedAfterProbe: true }, null, ['probe-not-after-return']],
    ['a fallback ack with no Delivered to line from the child', {}, { routedFrom: 'agent:main:subagent:continuation-other' }, null, ['return-not-routed-from-child']],
    ['an ack in the priming run', { primingAck: true }, {}, null, ['ack-before-return']],
    ['a wrong-nonce ack', { probeAck: 'wrong-nonce' }, {}, null, ['ack-uncredited', 'probe-ack-unobserved']],
    ['two acks in the probe run', { probeAck: 'twice' }, {}, null, ['probe-ack-duplicated']],
    ['the receipt claims the wake turn\'s ack', {}, {}, (r) => { r.ack.path = 'direct-wake'; }, ['probe-mediated-label-missing']],
    ['the receipt names no path', {}, {}, (r) => { r.ack.path = null; }, ['probe-mediated-label-missing']],
    ['another probe\'s text', {}, {}, (r) => { r.target.probeTextSha256 = null; }, ['probe-text-unbound']],
  ]) {
    const { record } = await grade('allowed', { ack: 'wake-no-ack', ...world }, options);
    if (change) change(record);
    const graded = gradeRecipientAuthorityCase(record);
    assert.equal(graded.verdict, 'MISSING-candidate', `${label}: ${JSON.stringify(graded)}`);
    assert.deepEqual(sorted(graded.missing), sorted(missingCodes), `${label}: ${JSON.stringify(graded)}`);
    assert.deepEqual(graded.contradictions, [], label);
  }
  // A direct-wake receipt labelled probe-mediated claims a probe that never ran: never PASS.
  const direct = await grade('allowed', { ack: 'wake' });
  direct.record.ack.path = 'probe-mediated';
  const claimed = gradeRecipientAuthorityCase(direct.record);
  assert.equal(claimed.verdict, 'MISSING-candidate', JSON.stringify(claimed));
  assert.ok(claimed.missing.includes('probe-turn-unobserved'), claimed.missing.join());
  // A fallback probe the gateway did not start is a scenario refusal, and the receipt keeps the
  // direct-wake label: no probe-mediated ack is claimed (review finding).
  const gateway = gatewayFor({ caseId: 'allowed', ack: 'wake-no-ack' });
  const refusingProbe = (frame) => (frame.method === 'sessions.send' && String(frame.params?.idempotencyKey).startsWith(`${RRA_ROW}-PROBE-`)
    ? [{ type: 'res', id: frame.id, ok: false, error: { code: 'UNAVAILABLE', message: 'busy' } }]
    : gateway(frame));
  const { record } = await grade('allowed', { ack: 'wake-no-ack' }, {}, refusingProbe);
  assert.ok(record.scenario.refusals.includes('fallback probe turn not accepted with a run id'), record.scenario.refusals.join());
  assert.equal(record.ack.path, 'direct-wake');
  assert.equal(gradeRecipientAuthorityCase(record).verdict, 'MISSING-candidate');
});

/*
 * 🌊's ruling, room msg 1567656724549075047: "(3) change the probe condition to **'If your context
 * includes the internal task completion for the proof you were primed for…'** so it matches the
 * priming across turns." 🌿's finding (#620, comment 6642952113): on allowed's fallback the woken run
 * already took the return in, so it is in the target's context but not in "this turn", and a literal
 * model answers PROBE-OK. Pin (h).
 */
// The driver's probe as a gateway at 663fafdc's text would read it: its condition reworded on the wire.
const thisTurnOnTheWire = (gateway) => (frame) => (frame?.type === 'req' && frame.method === 'sessions.send' && String(frame.params?.idempotencyKey).startsWith(`${RRA_ROW}-PROBE-`)
  ? gateway({ ...frame, params: { ...frame.params, message: String(frame.params.message).replace(PROBE_CONDITION, THIS_TURN_CONDITION) } })
  : gateway(frame));
// What a receipt sealed at 663fafdc names: the "this turn" text's hash, its nonce written as the slot.
const THIS_TURN_SHA256 = createHash('sha256').update(`[k6-proof-harness] ${RRA_ROW} probe <probeNonce>: ${THIS_TURN_CONDITION} Otherwise reply exactly PROBE-OK <probeNonce>.`).digest('hex');

test('dry run: (h) allowed\'s fallback probe asks about the target\'s context, as the priming does: a literal model acks it, and 663fafdc\'s "this turn" probe is answered PROBE-OK, never PASS', async () => {
  // At this head: the woken run took the completion in, and the probe hands the target's context
  // back to the priming. The literal model acks in the probe's own run.
  const { frames, record, graded } = await grade('allowed', { ack: 'wake-no-ack' });
  assert.deepEqual(graded, { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] });
  assert.deepEqual([record.ack.path, record.target.probeAckRows, record.target.wakeAckRuns, record.target.probeReplied], ['probe-mediated', 1, 0, false]);
  const sent = probeFrames(frames).map((frame) => frame.params.message);
  assert.equal(sent.length, 1);
  assert.ok(sent[0].includes(PROBE_CONDITION) && !sent[0].includes(THIS_TURN_CONDITION), sent[0]);
  assert.notEqual(rowLib.RRA_PROBE_TEXT_SHA256, THIS_TURN_SHA256, 'the "this turn" text is another probe');
  // The same driver, its probe reworded to 663fafdc's condition: the completion is in the target's
  // context but not in this turn, so the literal model answers PROBE-OK and acks nothing.
  const old = await grade('allowed', { ack: 'wake-no-ack' }, {}, thisTurnOnTheWire(gatewayFor({ caseId: 'allowed', ack: 'wake-no-ack' })));
  assert.deepEqual([old.record.ack.path, old.record.target.probeAckRows, old.record.target.probeReplied], ['probe-mediated', 0, true]);
  assert.deepEqual(old.graded, { verdict: 'MISSING-candidate', missing: ['probe-ack-unobserved'], contradictions: [], partial: [] });
  // Sealed as a run at 663fafdc sealed it, naming the "this turn" text's hash: unbound as well.
  old.record.target.probeTextSha256 = THIS_TURN_SHA256;
  const sealed = gradeRecipientAuthorityCase(old.record);
  assert.deepEqual([sealed.verdict, sorted(sealed.missing), sealed.contradictions], ['MISSING-candidate', sorted(['probe-ack-unobserved', 'probe-text-unbound']), []]);
  // Every other probing case answers alike under either wording: a refusal's target holds no return
  // in its context (PROBE-OK, no ack); allowed-silent's probe turn drained its return (the ack).
  for (const caseId of [...refusalCases, 'allowed-silent']) {
    const now = await grade(caseId);
    const then = await grade(caseId, {}, {}, thisTurnOnTheWire(gatewayFor({ caseId })));
    const answer = ({ record: r }) => [r.target.probeAckRows, r.target.probeReplied, r.target.ackRuns];
    assert.deepEqual(answer(then), answer(now), caseId);
    assert.deepEqual(answer(now), caseId === 'allowed-silent' ? [1, false, 1] : [0, true, 0], caseId);
    assert.equal(now.graded.verdict, 'PASS-candidate', `${caseId}: ${JSON.stringify(now.graded)}`);
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
  // Every phase's frames: the drive elects, the transition phase the control released narrows and probes.
  const { drive: elected, frames } = await runCase(workCase, {});
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
  const { drive, final, record, graded } = await grade(workCase, {});
  assert.equal(drive.dispatch.status, 'scheduled');
  assert.equal(drive.dispatch.result_delay_seconds, 30);
  assert.deepEqual(drive.priming_run_ids, ['run-e'], 'the electing run is the one run excluded');
  assert.deepEqual(final.priming_run_ids, ['run-e'], 'and stays the one run excluded in the transition phase');
  assert.equal(final.other_work_calls, 0);
  assert.equal(final.other_delegate_calls, 0);
  assert.ok(final.transition.requested_at_ms > drive.dispatch.observed_at_ms, 'the transition follows the scheduled result');
  assert.ok(final.probe_sent_at_ms > final.transition.settled_at_ms, 'the probe follows the transition');
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
  const { final, graded: elected } = await grade(workCase, { workWake: true, wakeElects: true });
  assert.equal(final.other_work_calls, 0, 'only the electing and probe runs are counted');
  assert.equal(elected.verdict, 'FAIL-candidate', JSON.stringify(elected));
  assert.ok(elected.contradictions.includes('target-woken'));
});

test('dry run: an election in the probe turn is a model deviation: MISSING, never FAIL', async () => {
  const { final, graded } = await grade(workCase, { workWake: true, probeElects: true });
  assert.equal(final.other_work_calls, 1);
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

/*
 * docs#620: 🕯's whole 13 at a22bd9c05c (run rra-eaa61a458beaf344, docs 8bf9baf9), work-revoked-visibility's
 * public receipt: `dispatch.accepted: true, status: scheduled, capturedAtMs: 1793839272167,
 * resultDelaySeconds: 30`; `transition: session.visibility.set, ok: true, requestedAtMs: 1793839280186,
 * settledAtMs: 1793839282354`; `epochs: captured = afterTransition = final = ff5b4d9f…, capturedAfterMs:
 * 1793839281828, capturedByMs: 1793839282419`; `target: probeRan true, probeReplied false, foreignRuns 1`.
 * Grade: MISSING with capture-not-before-transition, transition-did-not-advance-epoch,
 * refusal-reason-not-observed, probe-turn-unobserved. The first readable sample holding the session's
 * authority row came after the transition request: the control's fixed wait could not force the order.
 * Pins (o1)-(o4): the control's capture gate makes that order happen, and changes no oracle.
 */
const RRA_EAA61 = Object.freeze({
  capturedAtMs: 1793839272167,
  requestedAtMs: 1793839280186,
  settledAtMs: 1793839282354,
  capturedAfterMs: 1793839281828,
  capturedByMs: 1793839282419,
});
const isNarrowing = (frame) => frame.type === 'req' && frame.method === 'session.visibility.set';
// The deadline the work case's own scheduled result sets: capturedAtMs + (30 - 10) s.
const workDeadline = (drive) => drive.dispatch.observed_at_ms + (30 - 10) * 1000;

test('dry run: (o1) a capture that lands after the scheduled result and before the deadline: the control waits, then transitions after capturedByMs, and the case passes', async () => {
  for (const captureAfterMs of [1_000, 6_000, 12_000, 19_000]) {
    const { drive, transition, frames, record, captureGate, storeReads, graded } = await grade(workCase, {}, { capture: { captureAfterMs } });
    // The drive ends at the scheduled result, narrowing nothing, and hands over for the capture.
    assert.deepEqual(frames.filter((frame) => frame.phase === 'drive' && isNarrowing(frame)), [], `${captureAfterMs}: no transition in the drive`);
    assert.equal(drive.transition.requested_at_ms, null, `${captureAfterMs}`);
    assert.deepEqual(drive.handoff, { ready_for_capture: true }, `${captureAfterMs}`);
    assert.equal(typeof control.awaitWorkCapture, 'function', 'the control reads the capture before it releases the transition');
    assert.equal(rowLib.RRA_WORK_CAPTURE_MARGIN_SECONDS, 10);
    // The capture lands after the scheduled result was read, before the deadline that result sets.
    assert.equal(captureGate.deadlineAtMs, workDeadline(drive), `${captureAfterMs}`);
    assert.ok(captureGate.capturedAfterMs >= drive.dispatch.observed_at_ms, `${captureAfterMs}: a row-less sample after the result`);
    assert.ok(captureGate.capturedByMs >= drive.dispatch.observed_at_ms + captureAfterMs && captureGate.capturedByMs <= captureGate.deadlineAtMs, `${captureAfterMs}: ${JSON.stringify(captureGate)}`);
    // The control waited: it read the store until the row was there, and released no earlier.
    assert.ok(storeReads > 1, `${captureAfterMs}: ${storeReads} reads`);
    assert.ok(captureGate.capturedByMs <= captureGate.releasedAtMs && captureGate.releasedAtMs <= captureGate.deadlineAtMs, `${captureAfterMs}: ${JSON.stringify(captureGate)}`);
    // Then the transition phase it released narrows the session, after the capture.
    assert.ok(transition, `${captureAfterMs}: the transition phase ran`);
    assert.deepEqual(frames.filter(isNarrowing).map((frame) => frame.phase), ['transition'], `${captureAfterMs}`);
    assert.ok(record.transition.requestedAtMs > record.captureGate.releasedAtMs && record.captureGate.releasedAtMs >= record.epochs.capturedByMs, `${captureAfterMs}: ${JSON.stringify([record.captureGate, record.transition])}`);
    // The gate read the capture the grade reads, from the same store.
    assert.deepEqual(
      [record.captureGate.captured, record.captureGate.capturedAfterMs, record.captureGate.capturedByMs],
      [record.epochs.captured, record.epochs.capturedAfterMs, record.epochs.capturedByMs],
      `${captureAfterMs}`,
    );
    assert.equal(record.epochs.captured, createHash('sha256').update(WORK_CAPTURED_EPOCH).digest('hex'), `${captureAfterMs}: the epoch leaves hashed`);
    assert.ok(!JSON.stringify(record).includes(WORK_CAPTURED_EPOCH), `${captureAfterMs}: never raw`);
    assert.notEqual(record.epochs.afterTransition, record.epochs.captured, `${captureAfterMs}: the transition advanced it`);
    assert.deepEqual(graded, { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] }, `${captureAfterMs}`);
  }
});

test('dry run: (o2) a capture never readable by the deadline: no transition is sent, MISSING capture-unread-before-transition, never FAIL', async () => {
  for (const [label, captureAfterMs] of [['never', null], ['only after the deadline', 25_000]]) {
    const { drive, transition, frames, record, captureGate, graded } = await grade(workCase, {}, { capture: { captureAfterMs } });
    assert.deepEqual(frames.filter(isNarrowing), [], `${label}: no transition is sent`);
    assert.deepEqual(drive.handoff, { ready_for_capture: true }, label);
    assert.equal(typeof control.awaitWorkCapture, 'function', 'the control reads the capture before it releases the transition');
    // The control waited out the deadline, read no capture, and released nothing.
    assert.equal(captureGate.deadlineAtMs, workDeadline(drive), label);
    assert.deepEqual([captureGate.captured, captureGate.capturedByMs, captureGate.releasedAtMs], [null, null, null], label);
    assert.equal(transition, null, `${label}: no transition phase`);
    assert.deepEqual([record.transition.ok, record.transition.requestedAtMs, record.transition.settledAtMs], [null, null, null], label);
    // The control's hold for a wake still current is pinned through runRecipientAuthorityRow (row test).
    assert.deepEqual(record.captureGate, { deadlineAtMs: workDeadline(drive), captured: null, capturedAfterMs: null, capturedByMs: null, releasedAtMs: null, heldUntilMs: null }, label);
    assert.equal(graded.verdict, 'MISSING-candidate', `${label}: ${JSON.stringify(graded)}`);
    assert.ok(graded.missing.includes('capture-unread-before-transition'), `${label}: ${graded.missing}`);
    assert.deepEqual(graded.contradictions, [], label);
    // The case's other receipts are kept: the accepted election and its delay, the electing run, the run.
    assert.deepEqual(
      [record.dispatch.accepted, record.dispatch.status, record.dispatch.capturedAtMs, record.dispatch.resultDelaySeconds, record.target.primed, record.scenario.controlRunId, record.scenario.preflightOk],
      [true, 'scheduled', drive.dispatch.observed_at_ms, 30, true, RUN, true],
      label,
    );
  }
  // A scheduled result with no delay sets no deadline: the control reads once and sends nothing,
  // even with the capture already in the store.
  const { drive } = await runCase(workCase, {}, { capture: { captureAfterMs: 0 } });
  // With none ever there, the control reads until its first check past the deadline, and no longer.
  const waited = await gateCapture(drive, { captureAfterMs: null, startAt: drive.dispatch.observed_at_ms + 100 });
  assert.ok(waited.now > waited.captureGate.deadlineAtMs && waited.now <= waited.captureGate.deadlineAtMs + 250, `${waited.now} vs ${waited.captureGate.deadlineAtMs}`);
  assert.equal(waited.reads, Math.floor((waited.now - drive.dispatch.observed_at_ms - 100) / 250) + 1);
  const noDelay = await gateCapture({ ...drive, dispatch: { ...drive.dispatch, result_delay_seconds: null } }, { captureAfterMs: -1_000, startAt: drive.dispatch.observed_at_ms + 500 });
  assert.deepEqual([noDelay.captureGate.deadlineAtMs, noDelay.captureGate.releasedAtMs, noDelay.reads], [null, null, 1]);
  assert.ok(noDelay.captureGate.capturedByMs !== null, 'the capture was readable, and still nothing is released');
});

test('dry run: (o3) a receipt shaped like rra-eaa61a458beaf344, its transition before its capture, still grades MISSING capture-not-before-transition, and its probe now reads unbound', async () => {
  const { drive } = await runCase(workCase, {});
  const key = drive.keys.target;
  const t = RRA_EAA61;
  // The 8bf9baf9 control's one phase: the drive narrowed the session 8 s after the scheduled result.
  const evidence = {
    ...drive,
    handoff: undefined,
    dispatch: { ...drive.dispatch, status: 'scheduled', accepted: true, observed_at_ms: t.capturedAtMs, result_delay_seconds: 30 },
    transition: { method: 'session.visibility.set', ok: true, requested_at_ms: t.requestedAtMs, settled_at_ms: t.settledAtMs, error: null },
    pre_transition_obs: { ackRuns: 0, probeAckRows: 0, primingAckRows: 0, uncreditedAckRows: 0, foreignRuns: 0, unattributedAssistantRows: 0, returnMarkerRows: 0, probeReplied: false, adoptedDeliveryRows: 0 },
    probe_ran: true,
    probe_sent_at_ms: t.settledAtMs + 45_000,
    probe_text_sha256: rowLib.RRA_PROBE_TEXT_SHA256,
    target_obs: { ackRuns: 0, wakeAckRuns: 0, probeAckRows: 0, primingAckRows: 0, uncreditedAckRows: 0, foreignRuns: 1, unattributedAssistantRows: 0, returnMarkerRows: 0, probeReplied: false, adoptedDeliveryRows: 0 },
    other_work_calls: 0,
    other_delegate_calls: 0,
  };
  // The store as the control sampled it: no row until after the transition request, then one epoch,
  // unchanged to the end.
  const epoch = 'ff5b4d9f-0000-4000-8000-0000000000aa';
  const timeline = [
    ...Array.from({ length: 20 }, (_, i) => ({ atMs: t.capturedAfterMs - (20 - i) * 500, state: 'read', rows: [] })),
    { atMs: t.capturedAfterMs, state: 'read', rows: [] },
    { atMs: t.capturedByMs, state: 'read', rows: [{ session_key: key, epoch }] },
    { atMs: t.capturedByMs + 500, state: 'read', rows: [{ session_key: key, epoch }] },
  ];
  const gates = { candidatePinned: true, buildInfoCommit: RRA_PINNED, stateIsolated: true, modelSignIn: true, crossSessionTargetingEnabled: true, gatewayStartedByHarness: true };
  const assemble = (captureGate) => assembleCaseRecord({
    caseId: workCase, runId: RUN, docsSha: 'd'.repeat(40), gates, evidence, captureGate, logEntries: [], timeline,
    generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }], cleanup: { gatewayStopped: true, residue: false }, startedAtMs: t.capturedAtMs - 30_000,
  });
  const record = assemble(null);
  assert.deepEqual(
    [record.dispatch.accepted, record.dispatch.status, record.dispatch.capturedAtMs, record.dispatch.resultDelaySeconds, record.transition.ok, record.transition.requestedAtMs, record.transition.settledAtMs],
    [true, 'scheduled', t.capturedAtMs, 30, true, t.requestedAtMs, t.settledAtMs],
  );
  assert.deepEqual([record.epochs.capturedAfterMs, record.epochs.capturedByMs], [t.capturedAfterMs, t.capturedByMs]);
  assert.ok(record.epochs.captured === record.epochs.afterTransition && record.epochs.afterTransition === record.epochs.final, JSON.stringify(record.epochs));
  assert.deepEqual([record.target.probeRan, record.target.probeReplied, record.target.foreignRuns], [true, false, 1]);
  assert.equal(record.captureGate ?? null, null, 'the 8bf9baf9 control had no gate');
  // The capture order's oracle is unchanged: these four codes. The receipt now also reads
  // probe-text-unbound, because it named the shared conditional probe (509c3feb…), never the work
  // probe (🌊's ruling (a), room msg 1567736961190596741; pin (w2)), and transcript-not-read, because
  // it predates the probe run's RCDRA-WOKE count (probeWokeRows; pin (w5)).
  const captureOrder = ['capture-not-before-transition', 'transition-did-not-advance-epoch', 'refusal-reason-not-observed', 'probe-turn-unobserved'];
  const expected = { verdict: 'MISSING-candidate', missing: ['transcript-not-read', ...captureOrder, 'probe-text-unbound'], contradictions: [], partial: [] };
  assert.deepEqual(gradeRecipientAuthorityCase(record), expected);
  const withWorkProbe = { ...record, target: { ...record.target, probeTextSha256: WORK_PROBE_SHA256, probeWokeRows: 0 } };
  assert.deepEqual(gradeRecipientAuthorityCase(withWorkProbe), { ...expected, missing: captureOrder }, 'with the work probe\'s two additions, the four codes it read at 8bf9baf9');
  // A gate that claims a release never stands in for the store's order: the same grade.
  const claimed = assemble({ deadlineAtMs: t.capturedAtMs + 20_000, captured: record.epochs.captured, capturedAfterMs: t.capturedAfterMs, capturedByMs: t.capturedByMs, releasedAtMs: t.requestedAtMs - 1 });
  assert.deepEqual(gradeRecipientAuthorityCase(claimed), expected);
});

test('dry run: (o4) a wake turn that ran after the gated transition still grades FAIL', async () => {
  for (const world of [{ workWake: true }, { workWake: true, wakeElects: true }]) {
    const { record, graded } = await grade(workCase, world);
    // The control read the capture, then released the transition: the premise holds.
    assert.ok(record.captureGate, `${JSON.stringify(world)}: the control gated the transition`);
    assert.ok(record.captureGate.capturedByMs <= record.captureGate.releasedAtMs && record.captureGate.releasedAtMs < record.transition.requestedAtMs, JSON.stringify(record.captureGate));
    assert.equal(record.target.foreignRuns, 1, JSON.stringify(world));
    assert.equal(graded.verdict, 'FAIL-candidate', `${JSON.stringify(world)}: ${JSON.stringify(graded)}`);
    assert.deepEqual(graded.contradictions, ['target-woken'], JSON.stringify(world));
    assert.deepEqual(graded.missing, [], JSON.stringify(world));
  }
});

test('dry run: the continue_work case\'s transition phase continues only a drive that handed over for the capture', async () => {
  for (const state of [{}, { handoff: { ready_for_witness: true }, transition: { requested_at_ms: null } }, { handoff: { ready_for_capture: true }, transition: { requested_at_ms: 1_800_000_000_500 } }]) {
    const { evidence, frames } = await fire(workCase, {}, { phase: 'transition', state });
    assert.ok(evidence.refusals.some((refusal) => refusal.includes('continues only a drive that handed over')), `${JSON.stringify(state)}: ${evidence.refusals}`);
    assert.equal(frames.length, 0, JSON.stringify(state));
  }
});

/*
 * 🌊's ruling (a), room msg 1567736961190596741: "Rule **(a)** for `work-revoked-visibility`: give that
 * case a separate hash-bound, unconditional `PROBE-OK ‹nonce>` instruction. Its election priming says
 * 'no other action,' and a work wake has no task completion, so the shared conditional is the wrong
 * probe for this case. Keep the existing nonce, timing, wrong/replay/duplicate negatives and the refusal
 * oracle unchanged." 🕯's rra-3dd1c2a556ae087f (docs 93a93786): this case proved its product claims, but
 * `probeReplied: false` (🌿's classification on #620, comment 6648556457). Pins (w1)-(w5).
 */
// The driver's work probe as a gateway at 93a93786 would have read it: the shared conditional text on
// the wire, with the same probe nonce.
const sharedOnTheWire = (gateway) => (frame) => {
  if (frame?.type !== 'req' || frame.method !== 'sessions.send' || !String(frame.params?.idempotencyKey).startsWith(`${RRA_ROW}-PROBE-`)) return gateway(frame);
  const probeNonce = /probe (\S+):/.exec(String(frame.params.message))[1];
  return gateway({ ...frame, params: { ...frame.params, message: probeTextFor(probeNonce) } });
};
const THIS_TURN_PROBE_SHA256 = slotHash(`[k6-proof-harness] ${RRA_ROW} probe <probeNonce>: ${THIS_TURN_CONDITION} Otherwise reply exactly PROBE-OK <probeNonce>.`);
const UNCONDITIONAL_4F86_SHA256 = slotHash(`[k6-proof-harness] ${RRA_ROW} probe <probeNonce>: reply exactly PROBE-OK <probeNonce>.`);

test('dry run: (w1) the work case is sent its own unconditional probe, answers PROBE-OK <probe nonce>, and passes with every product claim shown', async () => {
  const { drive, final, frames, record, graded } = await grade(workCase);
  // Exactly the ruled text, once, from the transition phase, after the narrowing and the wake's due time.
  const sent = probeFrames(frames);
  assert.deepEqual(sent.map((frame) => [frame.phase, frame.params.message]), [['transition', workProbeTextFor(final.probe_nonce)]]);
  // Its nonce is the probe nonce the scenario mints, as before, never the row nonce. Its timing, the
  // delay and _PARK_MS after the narrowing, is pinned on the scenario's source (row test).
  assert.match(final.probe_nonce, /^RCDRA-PROBE-/u);
  assert.notEqual(final.probe_nonce, drive.nonce);
  assert.ok(final.probe_sent_at_ms > final.transition.settled_at_ms, 'the probe follows the narrowing');
  // The receipt names it by its own hash.
  assert.equal(record.target.probeTextSha256, WORK_PROBE_SHA256);
  assert.notEqual(WORK_PROBE_SHA256, SHARED_PROBE_SHA256);
  // The product claims: the capture before the transition, the epoch advanced, the work line at
  // stage=wake before the probe, no wake run, no adoption, and the reason's marker not in the probe run.
  assert.ok(record.captureGate.capturedByMs <= record.captureGate.releasedAtMs && record.epochs.capturedByMs < record.transition.requestedAtMs, JSON.stringify([record.captureGate, record.epochs]));
  assert.notEqual(record.epochs.afterTransition, record.epochs.captured);
  assert.deepEqual([record.reason.kind, record.reason.stage, record.reason.distinctFlowIds], ['work-refused', 'wake', 1]);
  assert.ok(record.reason.observedAtMs < record.target.probeSentAtMs);
  assert.deepEqual(
    [record.target.probeRan, record.target.probeReplied, record.target.foreignRuns, record.target.ackRuns, record.target.adoptedDeliveryRows, record.target.probeWokeRows],
    [true, true, 0, 0, 0, 0],
  );
  assert.deepEqual(graded, { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] });
});

test('dry run: (w2) the work case under the shared conditional probe: the model stays silent, and a receipt naming that probe, the "this turn" one or 4f86dd78\'s is MISSING probe-text-unbound', async () => {
  // The shared conditional text on the wire: its condition hands the session back to its election's
  // "no other action", and the model stays silent, 🕯's rra-3dd1c2a556ae087f shape.
  const shared = await grade(workCase, {}, {}, sharedOnTheWire(gatewayFor({ caseId: workCase })));
  assert.deepEqual([shared.record.target.probeRan, shared.record.target.probeReplied, shared.record.target.foreignRuns, shared.record.target.adoptedDeliveryRows], [true, false, 0, 0]);
  assert.deepEqual(shared.graded, { verdict: 'MISSING-candidate', missing: ['probe-turn-unobserved'], contradictions: [], partial: [] });
  // Sealed as the 93a93786 driver sealed it, naming the shared probe's hash: unbound as well.
  const sealed = gradeRecipientAuthorityCase({ ...shared.record, target: { ...shared.record.target, probeTextSha256: SHARED_PROBE_SHA256 } });
  assert.deepEqual([sealed.verdict, sorted(sealed.missing), sealed.contradictions], ['MISSING-candidate', sorted(['probe-turn-unobserved', 'probe-text-unbound']), []]);
  // A receipt that answered PROBE-OK but names another probe than its own is unbound: the shared
  // conditional, the "this turn" one and the unconditional one before 🌊's first ruling.
  const { record } = await grade(workCase);
  assert.equal(gradeRecipientAuthorityCase(record).verdict, 'PASS-candidate');
  for (const [label, hash] of [['shared', SHARED_PROBE_SHA256], ['this turn', THIS_TURN_PROBE_SHA256], ['4f86dd78', UNCONDITIONAL_4F86_SHA256], ['none', null]]) {
    const unbound = gradeRecipientAuthorityCase({ ...record, target: { ...record.target, probeTextSha256: hash } });
    assert.deepEqual(unbound, { verdict: 'MISSING-candidate', missing: ['probe-text-unbound'], contradictions: [], partial: [] }, label);
  }
  assert.equal(new Set([WORK_PROBE_SHA256, SHARED_PROBE_SHA256, THIS_TURN_PROBE_SHA256, UNCONDITIONAL_4F86_SHA256]).size, 4, 'four distinct probes');
});

test('dry run: (w3) a delegate case\'s receipt naming the work probe is MISSING probe-text-unbound', async () => {
  // Every delegate case that probes, and allowed on its fallback, sends the shared probe and passes
  // bound to it; named by the work probe's hash instead, it is unbound.
  for (const [label, caseId, world] of [...delegateRefusalCases.map((id) => [id, id, {}]), ['allowed-silent', 'allowed-silent', {}], ['allowed, probe-mediated', 'allowed', { ack: 'wake-no-ack' }]]) {
    const { record, graded } = await grade(caseId, world);
    assert.equal(record.target.probeTextSha256, SHARED_PROBE_SHA256, label);
    assert.equal(graded.verdict, 'PASS-candidate', `${label}: ${JSON.stringify(graded)}`);
    const unbound = gradeRecipientAuthorityCase({ ...record, target: { ...record.target, probeTextSha256: WORK_PROBE_SHA256 } });
    assert.deepEqual(unbound, { verdict: 'MISSING-candidate', missing: ['probe-text-unbound'], contradictions: [], partial: [] }, label);
  }
});

test('dry run: (w4) the work probe unanswered is MISSING probe-turn-unobserved, never FAIL', async () => {
  for (const probeAck of ['silent', 'probe-ok-other', 'probe-ok-row-nonce']) {
    const { final, frames, record, graded } = await grade(workCase, { probeAck });
    assert.deepEqual(probeFrames(frames).map((frame) => frame.params.message), [workProbeTextFor(final.probe_nonce)], probeAck);
    assert.equal(record.target.probeTextSha256, WORK_PROBE_SHA256, probeAck);
    assert.deepEqual([record.target.probeRan, record.target.probeReplied], [true, false], probeAck);
    assert.deepEqual(graded, { verdict: 'MISSING-candidate', missing: ['probe-turn-unobserved'], contradictions: [], partial: [] }, probeAck);
  }
});

test('dry run: (w5) the reason\'s RCDRA-WOKE in the work probe\'s run is FAIL, with or without PROBE-OK beside it; a wake turn stays FAIL as before', async () => {
  for (const probeAck of ['woke', 'woke-only']) {
    const { record, graded } = await grade(workCase, { probeAck });
    assert.equal(record.target.probeTextSha256, WORK_PROBE_SHA256, probeAck);
    assert.deepEqual([record.target.probeWokeRows, record.target.probeReplied, record.target.foreignRuns], [1, probeAck === 'woke', 0], probeAck);
    assert.equal(graded.verdict, 'FAIL-candidate', `${probeAck}: ${JSON.stringify(graded)}`);
    assert.deepEqual(graded.contradictions, ['refused-work-adopted'], probeAck);
    // With PROBE-OK beside it, nothing else is missing.
    if (probeAck === 'woke') assert.deepEqual(graded.missing, [], probeAck);
  }
  // A wake turn that answered the reason in a run of its own is the wake itself (o4): the probe run
  // holds no marker, and the contradiction is the wake's alone.
  const woken = await grade(workCase, { workWake: true });
  assert.deepEqual([woken.record.target.probeWokeRows, woken.record.target.foreignRuns], [0, 1]);
  assert.deepEqual([woken.graded.verdict, woken.graded.contradictions], ['FAIL-candidate', ['target-woken']]);
});

test('dry run: outside the control the scenario refuses before it sends a frame', async () => {
  // 2907e656 is the grant's head, the row's pin until a22bd9c05c: history, refused like any other SHA.
  for (const env of [{ OPENCLAW_RCD_RA_RUN: '' }, { OPENCLAW_CANDIDATE_SHA: 'f15237ec921879d918482cdf372b0718d4c1aab9' }, { OPENCLAW_CANDIDATE_SHA: '2907e656a892c0efa93821670e9488c07be12c17' }, { OPENCLAW_RCD_RA_CASE: 'stale' }, { OPENCLAW_RCD_RA_PHASE: 'observe' }]) {
    const { evidence, frames } = await fire('revoked-visibility', {}, { env });
    assert.ok(evidence.refusals.length > 0, JSON.stringify(env));
    if (env.OPENCLAW_CANDIDATE_SHA) assert.deepEqual(evidence.refusals, ['candidate is not j12′'], JSON.stringify(env));
    assert.equal(frames.length, 0, JSON.stringify(env));
  }
});
