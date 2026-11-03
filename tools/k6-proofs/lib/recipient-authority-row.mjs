/**
 * R-CD-RECIPIENT-AUTHORITY: a live, isolated-gateway row at pinned j12 (🌊's ruling, room msg
 * 1567077062139838485, 2026-11-03; bound issue karmaterminal/karmaterminal-openclaw-docs#536).
 *
 * One disposable gateway, started by run-recipient-authority-row.mjs, runs each case as its own
 * receipt. A case drives a real continue_delegate with targetSessionKey from a model turn (the
 * R-CD-4 shape) plus the public gateway RPCs that change the target's recipient authority, and
 * grades from what the product leaves observable. Every case stays MISSING until an owner runs it.
 *
 * This module is the one copy of the case table and the verdict rules. The k6 case driver
 * (scenarios/r-cd-recipient-authority.js), the control (scripts/run-recipient-authority-row.mjs)
 * and the tests share it. Plain ESM with no Node or k6 imports, so k6 can load it.
 *
 * The product path at j12 (karmaterminal/openclaw 352f56029dc95c60149ab4aaa127226a861d0b3d), with
 * path:line anchors, is in the scenario header and in docs/R-CD-RECIPIENT-AUTHORITY.md. What the
 * rules below rest on:
 * - The binding is captured when the continue_delegate tool call is accepted, before its
 *   "scheduled" result (continue-delegate-tool.ts:434 -> delegate-flow-store.ts:426-437). A
 *   transition after that toolResult is a change between dispatch and return.
 * - A stale return refused at enqueue, at the wake handoff or at the prompt drain leaves no reason
 *   (targeting.ts:240-254, 278-346; continuation-wake.ts:163-171, 229-238;
 *   session-system-events.ts:193-210). Only the durable replay logs one
 *   (server-restart-sentinel-delivery.ts:234-243, 271-290). So a revoked or reassigned case parks
 *   a silent return first and is refused at replay; a wake-mode refusal could never be PASS.
 * - Settlement is "recovered" for an adopted and a refused row alike
 *   (session-delivery-queue-recovery.ts:152-156; session-delivery-queue-storage.ts:601-622), so
 *   "settled as refused" is read from the reason and the absence of adoption, never from the row.
 */
import { toolCallTarget } from './tool-call-identity.mjs';
import { hasExactSentinelText, heartbeatAckFromHistory, messageRunId } from './wake-turn-receipt.mjs';

export const RRA_ROW = 'R-CD-RECIPIENT-AUTHORITY';
/** j12: the presentation product this row is pinned to. */
export const RRA_J12 = '352f56029dc95c60149ab4aaa127226a861d0b3d';
export const RRA_CASE_SCHEMA = 'openclaw.k6.recipient-authority-case.v1';
export const RRA_ROW_VERDICT_SCHEMA = 'openclaw.k6.recipient-authority-row-verdict.v1';
export const RRA_EVIDENCE_PREFIX = 'R_CD_RECIPIENT_AUTHORITY_EVIDENCE';
/** Prefix of every delegate task this row dispatches, and of its trace reason. */
export const RRA_TASK_MARKER = 'RCDRA';
export const RRA_ACK_MARKER = 'TARGET-ACK';
export const RRA_READY_MARKER = 'TARGET-READY';
export const RRA_RETURN_MARKER = 'RCDRA-RETURN';
export const RRA_PROBE_MARKER = 'PROBE-OK';

const SHA40 = /^[0-9a-f]{40}$/u;

/**
 * The cases. `family` is what the return must do: `allowed` is adopted and acknowledged by the
 * primed target; `refusal` is refused with a product reason and leaves no adoption, ack, wake or
 * final effect. `boundary` is where j12 refuses it and therefore which reason it leaves.
 * `clawSweeper` quotes the open item on openclaw/openclaw#129388 (comment 5442236054) it answers.
 */
export const RRA_CASES = Object.freeze({
  allowed: Object.freeze({
    family: 'allowed',
    mode: 'silent-wake',
    transition: null,
    clawSweeper: 'allowed-recipient proof ... through prompt adoption, wake',
  }),
  'allowed-across-reset': Object.freeze({
    family: 'allowed',
    mode: 'silent-wake',
    transition: 'sessions.reset',
    // The reset replaces the target's head; the new head is primed before the return arrives.
    reprime: true,
    clawSweeper: 'P1: accepted-child survival, reset (the epoch is not advanced by reset at j12)',
  }),
  'allowed-silent': Object.freeze({
    family: 'allowed',
    mode: 'silent',
    transition: null,
    // The positive control for every refusal case's absence: the same parked silent return, the
    // same probe turn, and the product's adoption marker must show on the visible probe row.
    probeAdopts: true,
    clawSweeper: 'allowed delivery ... through prompt adoption (the control for the refusal cases\' absence)',
  }),
  'unauthorized-admission': Object.freeze({
    family: 'refusal',
    boundary: 'admission',
    mode: 'silent-wake',
    transition: 'config.patch',
    reasonKind: 'admission-policy',
    expectChild: false,
    clawSweeper: 'Security: stale/unauthorized recipient rejection before final effects (admission)',
  }),
  'unauthorized-dispatch': Object.freeze({
    family: 'refusal',
    boundary: 'dispatch',
    mode: 'silent-wake',
    transition: 'config.patch',
    reasonKind: 'dispatch-policy',
    expectChild: false,
    clawSweeper: 'P1: durable returns outliving admission; rejection unproven at ... wake, delivery',
  }),
  'revoked-visibility': Object.freeze({
    family: 'refusal',
    boundary: 'durable-replay',
    mode: 'silent',
    transition: 'session.visibility.set',
    reasonKind: 'replay-authority-changed',
    expectChild: true,
    clawSweeper: 'revoked recipient refused through prompt adoption, wake ... final effects',
  }),
  'revoked-membership': Object.freeze({
    family: 'refusal',
    boundary: 'durable-replay',
    mode: 'silent',
    transition: 'session.members.remove',
    reasonKind: 'replay-authority-changed',
    expectChild: true,
    clawSweeper: 'revoked recipient refused through prompt adoption, wake ... final effects',
  }),
  'revoked-owner': Object.freeze({
    family: 'refusal',
    boundary: 'durable-replay',
    mode: 'silent',
    transition: 'sessions.assignOwner',
    reasonKind: 'replay-authority-changed',
    expectChild: true,
    clawSweeper: 'reassigned recipient (owner) refused before final effects',
  }),
  reassigned: Object.freeze({
    family: 'refusal',
    boundary: 'durable-replay',
    mode: 'silent',
    transition: 'sessions.delete+sessions.create',
    reasonKind: 'replay-authority-changed',
    expectChild: true,
    clawSweeper: 'reassigned recipient (key deleted and recreated) refused before final effects',
  }),
  'replay-restart': Object.freeze({
    family: 'refusal',
    boundary: 'boot-replay',
    mode: 'silent',
    transition: 'session.visibility.set',
    restart: true,
    reasonKind: 'replay-authority-changed',
    expectChild: true,
    clawSweeper: 'Security/P1: rejection ... through restart replay',
  }),
});
export const RRA_CASE_IDS = Object.freeze(Object.keys(RRA_CASES));
/** Every case is required: the row verdict is the minimum over all of them. */
export const RRA_REQUIRED_CASES = RRA_CASE_IDS;

/** The gates the control records; each must be exactly true, or the case is not about j12. */
export const RRA_GATE_KEYS = Object.freeze([
  'candidatePinned',
  'stateIsolated',
  'modelSignIn',
  'crossSessionTargetingEnabled',
  'gatewayStartedByHarness',
]);

export const RRA_VERDICTS = Object.freeze(['PASS-candidate', 'PARTIAL-candidate', 'MISSING-candidate', 'FAIL-candidate']);
const VERDICT_RANK = Object.freeze({ 'FAIL-candidate': 0, 'MISSING-candidate': 1, 'PARTIAL-candidate': 2, 'PASS-candidate': 3 });

export function isSha40(value) {
  return typeof value === 'string' && SHA40.test(value);
}

export function lowerVerdict(a, b) {
  return VERDICT_RANK[a] <= VERDICT_RANK[b] ? a : b;
}

/* ------------------------------------------------------------------------------------ */
/* Product reason lines                                                                  */
/* ------------------------------------------------------------------------------------ */

/**
 * The product-emitted refusal reasons at j12, by kind. Each is product text the agent cannot
 * author; a gateway log line counts only when it also names the case's own disposable session key
 * as a whole token.
 * - admission-policy: the continue_delegate toolResult error (continue-delegate-tool.ts:357-362).
 * - dispatch-policy: `[continuation:delegate-rejected] policy.cross_session_targeting ...
 *   session=<parent>` (delegate-dispatch.ts:267-277).
 * - replay-authority-changed: the durable replay's warn, with sessionKey=<target>
 *   (server-restart-sentinel-delivery.ts:238-241 and 285-288).
 */
export const RRA_REASON_TEXT = Object.freeze({
  'admission-policy': Object.freeze(['cross-session continuation targeting is disabled']),
  'dispatch-policy': Object.freeze(['[continuation:delegate-rejected] policy.cross_session_targeting']),
  'replay-authority-changed': Object.freeze([
    'session event delivery skipped: recipient authority changed',
    'session event delivery wake skipped: recipient authority changed',
  ]),
});
/** The router's line for a return it admitted: `Delivered to <keys> from <child>` (subagent-announce.continuation-return.ts:194-201). */
export const RRA_ROUTED_TEXT = '[continuation:targeted-return] Delivered to ';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether `line` names `key` as a whole token: bounded by start/end, whitespace, `=`, `"`, `,`
 * or `'`. A longer key with `key` as its prefix does not count.
 */
export function lineNamesKey(line, key) {
  if (typeof line !== 'string' || typeof key !== 'string' || !key) return false;
  return new RegExp(`(?:^|[\\s="',])${escapeRegex(key)}(?=$|[\\s"',])`, 'u').test(line);
}

/** Whether a gateway log line is the product reason of `kind` for this case's session key. */
export function matchReasonLine(line, kind, { targetKey, parentKey } = {}) {
  const texts = RRA_REASON_TEXT[kind];
  if (!texts || kind === 'admission-policy' || typeof line !== 'string') return false;
  if (!texts.some((text) => line.includes(text))) return false;
  if (kind === 'dispatch-policy') return lineNamesKey(line, parentKey);
  return lineNamesKey(line, targetKey);
}

/** Whether a router line delivered to `targetKey` (exactly one of its comma-separated recipients). */
export function routedToTarget(line, targetKey) {
  if (typeof line !== 'string' || !targetKey) return false;
  const start = line.indexOf(RRA_ROUTED_TEXT);
  if (start < 0) return false;
  const rest = line.slice(start + RRA_ROUTED_TEXT.length);
  const end = rest.indexOf(' from ');
  if (end < 0) return false;
  return rest.slice(0, end).split(',').map((key) => key.trim()).includes(targetKey);
}

/**
 * The first log entry at or after `afterMs` that is the reason of `kind`.
 * entries: [{ atMs, text, generation }].
 */
export function findReason(entries, kind, keys, afterMs = 0) {
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry?.atMs !== 'number' || entry.atMs < afterMs) continue;
    if (matchReasonLine(entry.text, kind, keys)) return { kind, observedAtMs: entry.atMs, generation: entry.generation ?? 0 };
  }
  return null;
}

/** The first router line that delivered this case's return to its target. */
export function findRouted(entries, targetKey) {
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry?.atMs === 'number' && routedToTarget(entry.text, targetKey)) return entry.atMs;
  }
  return null;
}

/** Whether a continue_delegate toolResult text is the admission policy refusal. */
export function isAdmissionPolicyRefusal(text) {
  return typeof text === 'string' && RRA_REASON_TEXT['admission-policy'].some((reason) => text.includes(reason));
}

/* ------------------------------------------------------------------------------------ */
/* Target transcript                                                                     */
/* ------------------------------------------------------------------------------------ */

function textOf(message) {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content
    .filter((part) => part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
}

function roleOf(message) {
  return String(message?.role || '').toLowerCase();
}

/**
 * What the target's transcript (chat.history, oldest to newest) shows about the return.
 * chat.history hides the wake's own user row and the runtime-context row that carries the
 * delivered return (the R-CD-4 finding, lib/wake-turn-receipt.mjs), so adoption is read from the
 * primed target's answer: `TARGET-ACK <nonce>` as assistant text or as a heartbeat_respond receipt,
 * in a run other than a priming run.
 * - ackRuns: distinct non-priming runs that acknowledged the return (the probe run included: the
 *   probe never names the ack, so an ack there is the return adopted into the probe turn).
 * - foreignRuns: distinct assistant runs that are neither priming nor the probe (a wake).
 * - unattributedAssistantRows: assistant rows with no run id; they cannot be placed, so a case
 *   that has any is MISSING.
 * - returnMarkerRows: assistant rows that repeat the child's return marker.
 * - probeReplied: the probe run answered `PROBE-OK <probeNonce>`.
 * - adoptedDeliveryRows: rows carrying the product's adoption marker,
 *   `__openclaw.sessionDeliveryAckIds` (session-system-event-adoption.ts:49-79 at j12). chat.history
 *   keeps it on a visible row (chat-display-projection.sanitize.ts:442-475 strips only named private
 *   keys), so a parked return adopted into the probe turn shows here even if the model never acks.
 */
export function observeTargetTranscript(messages, { nonce, primingRunIds = [], probeRunId = null, probeNonce = null } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const priming = new Set(primingRunIds.filter((id) => typeof id === 'string' && id));
  const ackRuns = new Set();
  const foreignRuns = new Set();
  let unattributedAssistantRows = 0;
  let returnMarkerRows = 0;
  let probeReplied = false;
  let adoptedDeliveryRows = 0;
  for (const message of list) {
    const ackIds = message?.__openclaw?.sessionDeliveryAckIds;
    if (Array.isArray(ackIds) && ackIds.some((id) => typeof id === 'string' && id)) adoptedDeliveryRows += 1;
    if (roleOf(message) !== 'assistant') continue;
    const runId = messageRunId(message);
    const text = textOf(message);
    if (!runId) {
      unattributedAssistantRows += 1;
      continue;
    }
    if (!priming.has(runId) && runId !== probeRunId) foreignRuns.add(runId);
    if (!priming.has(runId) && hasExactSentinelText(text, RRA_ACK_MARKER, nonce)) ackRuns.add(runId);
    if (hasExactSentinelText(text, RRA_RETURN_MARKER, nonce)) returnMarkerRows += 1;
    if (probeRunId && runId === probeRunId && probeNonce && hasExactSentinelText(text, RRA_PROBE_MARKER, probeNonce)) {
      probeReplied = true;
    }
  }
  // heartbeat_respond acks: the call and its accepted result in one non-priming run.
  let afterIndex = -1;
  for (;;) {
    const receipt = heartbeatAckFromHistory(list, {
      marker: RRA_ACK_MARKER,
      nonce,
      afterIndex,
      excludeRunIds: [...priming],
      requireRunId: true,
    });
    if (!receipt) break;
    ackRuns.add(receipt.runId);
    afterIndex = receipt.index;
  }
  return {
    ackRuns: ackRuns.size,
    foreignRuns: foreignRuns.size,
    unattributedAssistantRows,
    returnMarkerRows,
    probeReplied,
    adoptedDeliveryRows,
  };
}

function toolResultFor(list, toolCallId, fromIndex) {
  for (let j = fromIndex; j < list.length; j += 1) {
    const row = list[j];
    if (roleOf(row) === 'toolresult' && row.toolCallId === toolCallId) return row;
  }
  return null;
}

function parseResultPayload(row) {
  const text = textOf(row);
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { parsed, text };
  } catch {
    // Not JSON: an error text or a plain message.
  }
  return { parsed: null, text };
}

/**
 * The case's continue_delegate call in the dispatching parent's transcript, paired with its
 * toolResult by toolCallId. The call must be the tool itself (through Tool Search's dispatch_action
 * when deferred, lib/tool-call-identity.mjs), carry this case's task marker in its task and name
 * this case's target. Returns { status, toolCallId, errorText } or null:
 * - status 'scheduled': the tool accepted it; the binding was captured before this result;
 * - status 'error': an error result; errorText keeps its text (the admission policy refusal);
 * - status null: the call was made but no result was recorded yet.
 */
export function findDelegateDispatch(messages, { taskMarker, targetSessionKey }) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = 0; i < list.length; i += 1) {
    if (roleOf(list[i]) !== 'assistant' || !Array.isArray(list[i].content)) continue;
    for (const part of list[i].content) {
      const target = toolCallTarget(part);
      if (!target || target.name !== 'continue_delegate' || typeof part.id !== 'string') continue;
      if (!String(target.args?.task ?? '').includes(taskMarker) || target.args?.targetSessionKey !== targetSessionKey) continue;
      const result = toolResultFor(list, part.id, i + 1);
      if (!result) return { status: null, toolCallId: part.id, errorText: null };
      const { parsed, text } = parseResultPayload(result);
      if (result.isError === true || !parsed) return { status: 'error', toolCallId: part.id, errorText: text };
      return { status: typeof parsed.status === 'string' ? parsed.status : null, toolCallId: part.id, errorText: null };
    }
  }
  return null;
}

/**
 * The sessions tool's assign_owner call for `targetSessionKey` in the operator session, paired
 * with its toolResult: { status } ('updated' on success, 'error' otherwise) or null.
 */
export function findOwnerAssignment(messages, targetSessionKey) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = 0; i < list.length; i += 1) {
    if (roleOf(list[i]) !== 'assistant' || !Array.isArray(list[i].content)) continue;
    for (const part of list[i].content) {
      const target = toolCallTarget(part);
      if (!target || target.name !== 'sessions' || typeof part.id !== 'string') continue;
      if (target.args?.action !== 'assign_owner' || target.args?.sessionKey !== targetSessionKey) continue;
      const result = toolResultFor(list, part.id, i + 1);
      if (!result) return null;
      const { parsed } = parseResultPayload(result);
      if (result.isError === true || !parsed) return { status: 'error' };
      return { status: typeof parsed.status === 'string' ? parsed.status : null };
    }
  }
  return null;
}

/** The gateway methods a case's scenario calls; each must be advertised in hello-ok. */
export function scenarioMethodsFor(caseId) {
  const spec = RRA_CASES[caseId];
  if (!spec) return [];
  const methods = ['sessions.create', 'sessions.send', 'sessions.list', 'chat.history'];
  if (spec.transition === 'sessions.reset') methods.push('sessions.reset');
  if (spec.transition === 'config.patch') methods.push('config.get', 'config.patch');
  if (spec.transition === 'session.visibility.set') methods.push('session.visibility.set');
  if (spec.transition === 'session.members.remove') methods.push('session.members.list', 'session.members.add', 'session.members.remove');
  if (spec.transition === 'sessions.delete+sessions.create') methods.push('sessions.delete');
  if (spec.restart) methods.push('gateway.restart.request');
  return methods;
}

/** Whether a dispatching parent's transcript carries the ack (a return that landed in the parent). */
export function countParentAcks(messages, nonce) {
  let count = 0;
  for (const message of Array.isArray(messages) ? messages : []) {
    if (roleOf(message) === 'assistant' && hasExactSentinelText(textOf(message), RRA_ACK_MARKER, nonce)) count += 1;
  }
  return count;
}

/* ------------------------------------------------------------------------------------ */
/* Case verdict                                                                          */
/* ------------------------------------------------------------------------------------ */

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isTime(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isHash(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
}

/**
 * Grade one case record (the control's public receipt body). Returns
 * { verdict, missing, contradictions, partial }. Every rule fails closed:
 * - not this row's record, an unknown case, a candidate other than j12, a gate not exactly true,
 *   a gateway the harness did not start and own throughout, or k6 evidence not bound to this run
 *   is MISSING, and nothing else about it is judged (it is not evidence about j12);
 * - a contradiction of the case's claim is FAIL;
 * - an observation that is absent or not of its type is MISSING;
 * - a residual condition (config not restored, cleanup incomplete) is PARTIAL;
 * - otherwise PASS-candidate. A refusal case is PASS only with BOTH the product reason and the
 *   observed absence of adoption, ack, wake and final effect.
 */
export function gradeRecipientAuthorityCase(record) {
  const missing = [];
  const contradictions = [];
  const partial = [];
  const result = (verdict) => ({ verdict, missing, contradictions, partial });
  if (!record || typeof record !== 'object' || record.schema !== RRA_CASE_SCHEMA || record.row !== RRA_ROW) {
    missing.push('not-a-case-record');
    return result('MISSING-candidate');
  }
  const spec = RRA_CASES[record.case];
  if (!spec) {
    missing.push('unknown-case');
    return result('MISSING-candidate');
  }
  if (record.candidateSha !== RRA_J12) missing.push('candidate-not-j12');
  const gates = record.gates ?? {};
  for (const key of RRA_GATE_KEYS) if (gates[key] !== true) missing.push(`gate:${key}`);
  if (gates.buildInfoCommit !== RRA_J12) missing.push('gate:buildInfoCommit');
  const generations = Array.isArray(record.gateway?.generations) ? record.gateway.generations : [];
  if (generations.length === 0 || !generations.every((g) => g?.startedByHarness === true && g?.ownedListenerThroughout === true)) {
    missing.push('gateway-not-harness-owned');
  }
  if (typeof record.runId !== 'string' || !record.runId || record.scenario?.controlRunId !== record.runId) {
    missing.push('scenario-not-bound-to-run');
  }
  if (record.scenario?.observeRunId !== undefined && record.scenario.observeRunId !== record.runId) missing.push('scenario-not-bound-to-run');
  if (missing.length) return result('MISSING-candidate');

  const need = (ok, code) => {
    if (!ok) missing.push(code);
    return ok;
  };
  const dispatch = record.dispatch ?? {};
  const child = record.child ?? {};
  const target = record.target ?? {};
  const parent = record.parent ?? {};
  const transition = record.transition ?? {};
  const epochs = record.epochs ?? {};
  const reason = record.reason ?? null;

  // The scenario ran to its end: a refusal it recorded (a rejected RPC, a socket error, its window
  // elapsing) or a method hello-ok did not advertise leaves the case unjudged.
  if (!Array.isArray(record.scenario?.refusals) || record.scenario.refusals.length > 0) missing.push('scenario-refused');
  if (record.scenario?.preflightOk !== true) missing.push('preflight-not-ok');
  const counted = need(
    ['ackRuns', 'foreignRuns', 'unattributedAssistantRows', 'returnMarkerRows', 'adoptedDeliveryRows'].every((key) => isCount(target[key])) && isCount(parent.ackRows),
    'transcript-not-read',
  );
  if (counted && target.unattributedAssistantRows > 0) missing.push('unattributable-target-rows');
  need(target.primed === true, 'target-not-primed');
  // A case's claim is about its transition. If the transition RPC did not take effect, whatever the
  // return then did is not evidence either way: no contradiction is judged, the case is MISSING.
  let premise = !spec.transition || (transition.ok === true && isTime(transition.requestedAtMs));
  if (!premise) missing.push('transition-not-observed');
  // A revocation or reassignment holds only once the epoch actually moved: a transition that left it
  // unchanged (a narrowing to a visibility no narrower, say) leaves the return current, and its
  // adoption would be correct.
  if (spec.family === 'refusal' && spec.expectChild !== false) {
    if (!isHash(epochs.captured) || !isHash(epochs.afterTransition)) {
      missing.push('epochs-unread');
      premise = false;
    } else if (epochs.afterTransition === epochs.captured) {
      missing.push('transition-did-not-advance-epoch');
      premise = false;
    }
  }
  const contradict = (code) => {
    if (premise) contradictions.push(code);
  };

  if (spec.family === 'allowed') {
    need(dispatch.accepted === true && dispatch.status === 'scheduled', 'dispatch-not-accepted');
    need(child.bound === true && child.done === true, 'child-not-bound');
    const routed = need(isTime(record.park?.deliveredToTargetAtMs), 'return-not-routed-to-target');
    need(isHash(epochs.captured), 'captured-epoch-unread');
    if (spec.transition && isHash(epochs.captured)) {
      if (!isHash(epochs.afterTransition)) missing.push('epoch-after-transition-unread');
      else if (epochs.afterTransition !== epochs.captured) contradict('epoch-advanced-by-non-edge-transition');
    }
    const adopted = counted && target.ackRuns > 0;
    if (isHash(epochs.captured)) {
      if (!isHash(epochs.final)) missing.push('final-epoch-unread');
      else if (epochs.final !== epochs.captured) {
        if (adopted) contradict('adopted-after-epoch-advance');
        else missing.push('epoch-advanced-premise-broken');
      }
    }
    if (counted) {
      if (parent.ackRows > 0) contradict('return-landed-in-parent');
      if (target.ackRuns > 1) contradict('duplicate-adoption');
      if (target.foreignRuns > 1) contradict('duplicate-wake');
      if (target.ackRuns === 0 && routed && target.unattributedAssistantRows === 0) contradict('allowed-return-not-adopted');
      if (target.adoptedDeliveryRows > 1) contradict('duplicate-adoption');
      if (spec.probeAdopts) {
        // The probe turn must adopt it (the product's marker on the visible row) and the silent
        // return must not have woken the target first.
        need(target.probeRan === true, 'probe-turn-unobserved');
        if (target.adoptedDeliveryRows === 0) missing.push('adoption-marker-unobserved');
        if (target.foreignRuns > 0) contradict('silent-return-woke-target');
      }
    }
  } else {
    if (spec.boundary === 'admission') {
      need(dispatch.accepted === false && dispatch.status === 'error', 'admission-not-refused');
      if (dispatch.accepted === true) contradict('unauthorized-dispatch-accepted');
    } else {
      need(dispatch.accepted === true && dispatch.status === 'scheduled' && isTime(dispatch.capturedAtMs), 'dispatch-not-accepted');
    }
    if (spec.boundary === 'dispatch' && isTime(transition.requestedAtMs) && isTime(dispatch.capturedAtMs)) {
      need(transition.requestedAtMs > dispatch.capturedAtMs, 'policy-not-changed-after-capture');
    }
    if (spec.expectChild === false) {
      if (child.spawned === true) contradict('refused-delegate-spawned');
      else need(child.spawned === false, 'child-spawn-unobserved');
    } else {
      need(child.bound === true && child.done === true, 'child-not-bound');
      const park = record.park?.deliveredToTargetAtMs;
      need(isTime(park) && isTime(transition.requestedAtMs) && park < transition.requestedAtMs, 'return-not-parked-before-transition');
    }
    if (spec.restart) {
      const restarted = record.gateway?.restartedAtMs;
      need(isTime(restarted) && isTime(transition.requestedAtMs) && restarted > transition.requestedAtMs, 'restart-not-after-transition');
      need(
        reason && isTime(reason.observedAtMs) && isTime(restarted) && reason.observedAtMs > restarted && Number(reason.generation) >= 1,
        'reason-not-from-replacement',
      );
      need(generations.length >= 2, 'replacement-generation-unobserved');
    }
    const reasonAfter = spec.boundary === 'admission' ? 0 : transition.requestedAtMs;
    need(
      reason !== null && reason.kind === spec.reasonKind && (spec.boundary === 'admission' || (isTime(reason.observedAtMs) && reason.observedAtMs > reasonAfter)),
      'refusal-reason-not-observed',
    );
    need(target.probeRan === true && target.probeReplied === true, 'probe-turn-unobserved');
    if (counted) {
      if (target.ackRuns > 0 || target.adoptedDeliveryRows > 0) contradict('refused-return-adopted');
      if (target.foreignRuns > 0) contradict('target-woken');
      if (target.returnMarkerRows > 0) contradict('return-reached-target');
      if (parent.ackRows > 0) contradict('return-landed-in-parent');
    }
    if (spec.transition === 'config.patch' && record.config?.restored !== true) partial.push('config-not-restored');
  }
  // A delegate that fired owes its Tempo trace (#600): matched by the reason fingerprint it
  // dispatched, collected per case after the run. Without it the case is review-incomplete.
  if (spec.expectChild !== false && record.trace?.correlated !== true) partial.push('trace-receipt-pending');
  if (record.cleanup?.gatewayStopped !== true || record.cleanup?.residue !== false) partial.push('cleanup-incomplete');

  if (contradictions.length) return result('FAIL-candidate');
  if (missing.length) return result('MISSING-candidate');
  if (partial.length) return result('PARTIAL-candidate');
  return result('PASS-candidate');
}

/**
 * Whether a collect-continuation-trace.mjs receipt (continuation-trace-correlation.json) belongs to
 * this case: the continuation schema, this row, and the reason fingerprint the case dispatched.
 */
export function traceCorrelationMatches(record, correlation) {
  const dispatch = record?.dispatch ?? {};
  return Boolean(
    correlation && typeof correlation === 'object' &&
      correlation.schema === 'openclaw.k6.continuation-trace-correlation.v1' &&
      correlation.row === RRA_ROW &&
      typeof dispatch.reasonHash === 'string' && dispatch.reasonHash.length > 0 &&
      correlation.reason?.hash === dispatch.reasonHash &&
      Number.isSafeInteger(dispatch.reasonLength) && correlation.reason?.length === dispatch.reasonLength &&
      typeof correlation.traceId === 'string' && /^[0-9a-f]{32}$/u.test(correlation.traceId) &&
      correlation.traceJson === `tempo-trace-${correlation.traceId.slice(0, 12)}.json`,
  );
}

/* ------------------------------------------------------------------------------------ */
/* Row verdict                                                                           */
/* ------------------------------------------------------------------------------------ */

/**
 * Grade the row from case receipts: entries [{ record, verified }]. Only verified receipts count.
 * The row starts at PASS-candidate and only moves down:
 * - a required case with no verified receipt is MISSING-candidate (so the row with no receipts is
 *   MISSING, as it must stay until an owner runs it at j12);
 * - receipts from different runs (other gateways) are MISSING: the cases share one gateway;
 * - an unverified receipt, or two receipts of one case that disagree, cap it at PARTIAL-candidate;
 * - each case contributes its own verdict.
 */
export function gradeRecipientAuthorityRow(entries = []) {
  const notes = [];
  let verdict = 'PASS-candidate';
  const lower = (to, note) => {
    verdict = lowerVerdict(verdict, to);
    notes.push(note);
  };
  const verified = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (entry?.verified === true && entry.record) verified.push(entry.record);
    else lower('PARTIAL-candidate', 'unverified-receipt');
  }
  const runIds = new Set(verified.map((record) => record?.runId));
  if (runIds.size > 1) lower('MISSING-candidate', 'receipts-from-different-runs');
  const cases = {};
  for (const caseId of RRA_REQUIRED_CASES) {
    const graded = verified.filter((record) => record?.case === caseId).map((record) => gradeRecipientAuthorityCase(record));
    if (graded.length === 0) {
      cases[caseId] = { verdict: 'MISSING-candidate', missing: ['case-not-run'] };
      lower('MISSING-candidate', `${caseId}:case-not-run`);
      continue;
    }
    const verdicts = new Set(graded.map((entry) => entry.verdict));
    let caseVerdict = graded.map((entry) => entry.verdict).reduce(lowerVerdict);
    if (verdicts.size > 1) {
      caseVerdict = lowerVerdict(caseVerdict, 'PARTIAL-candidate');
      notes.push(`${caseId}:conflicting-receipts`);
    }
    cases[caseId] = { verdict: caseVerdict, receipts: graded.length };
    if (caseVerdict !== 'PASS-candidate') lower(caseVerdict, `${caseId}:${caseVerdict}`);
  }
  return { schema: RRA_ROW_VERDICT_SCHEMA, row: RRA_ROW, candidateSha: RRA_J12, verdict, cases, notes };
}

/* ------------------------------------------------------------------------------------ */
/* Gates (pure)                                                                          */
/* ------------------------------------------------------------------------------------ */

/**
 * The model sign-in gate over `openclaw models status --json` run against the isolated state
 * (src/commands/models/list.status-command.ts:1081-1122 at j12): the auth store must live under the
 * isolated state, no provider in use may lack auth, and the primary model's provider must hold a
 * profile. Returns { ok, refusals }.
 */
export function evaluateModelSignIn(status, { stateDir, primaryModel, pathApi }) {
  const refusals = [];
  const auth = status && typeof status === 'object' ? status.auth : null;
  if (!auth || typeof auth !== 'object') {
    refusals.push({ code: 'model-status-unreadable', detail: 'models status --json returned no auth block' });
    return { ok: false, refusals };
  }
  const store = typeof auth.storePath === 'string' ? auth.storePath : '';
  const relative = store && stateDir ? pathApi.relative(stateDir, store) : '..';
  if (!store || relative.startsWith('..') || pathApi.isAbsolute(relative)) {
    refusals.push({ code: 'model-auth-store-not-isolated', detail: 'the auth store is not under the isolated state directory' });
  }
  if (!Array.isArray(auth.missingProvidersInUse) || auth.missingProvidersInUse.length > 0) {
    refusals.push({ code: 'model-sign-in-missing', detail: 'a provider in use has no sign-in' });
  }
  const provider = typeof primaryModel === 'string' && primaryModel.includes('/') ? primaryModel.slice(0, primaryModel.indexOf('/')) : null;
  const providers = Array.isArray(auth.providers) ? auth.providers : [];
  const entry = provider ? providers.find((candidate) => candidate?.provider === provider) : null;
  if (!entry || !(Number(entry.profiles?.count) >= 1)) {
    refusals.push({ code: 'model-sign-in-missing', detail: `no stored profile for the primary model's provider${provider ? ` ${provider}` : ''}` });
  }
  return { ok: refusals.length === 0, refusals };
}

/**
 * The continuation config gate over the disposable gateway's openclaw.json: continuation enabled
 * and cross-session targeting enabled (the default is disabled, continuation/config.ts:128-129),
 * else the allowed case could never dispatch. The unauthorized cases disable it through config.patch
 * and restore it.
 */
export function evaluateContinuationConfig(config) {
  const continuation = config?.agents?.defaults?.continuation;
  const refusals = [];
  if (continuation?.enabled !== true) refusals.push({ code: 'config-continuation-disabled', detail: 'agents.defaults.continuation.enabled is not true' });
  if (continuation?.crossSessionTargeting !== 'enabled') {
    refusals.push({ code: 'config-cross-session-disabled', detail: 'agents.defaults.continuation.crossSessionTargeting is not "enabled"' });
  }
  return { ok: refusals.length === 0, refusals };
}

/**
 * Whether the listener on the port is the harness's own process: exactly the PID and kernel start
 * ticks the harness recorded when it spawned the gateway. Anything else is a gateway the harness
 * did not start.
 */
export function listenerOwnedBy(listener, generation) {
  return Boolean(
    listener && generation &&
      Number.isSafeInteger(listener.pid) && listener.pid === generation.pid &&
      Number.isSafeInteger(listener.startTicks) && listener.startTicks === generation.startTicks,
  );
}
