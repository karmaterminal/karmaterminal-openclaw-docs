/**
 * R-CD-RECIPIENT-AUTHORITY: a live, isolated-gateway row (🌊's ruling, room msg
 * 1567077062139838485, 2026-11-03; bound issue karmaterminal/karmaterminal-openclaw-docs#536),
 * re-anchored to j12′, the explicit-refusal successor (🌊's ruling, room msg 1567104742604406896).
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
 * The product path at j12′ (karmaterminal/openclaw a22bd9c05c4a7a9c86e72a132cb7939e399104cb, the
 * merged head: the refused chain, keeps-queued-2, the continue_work authority binding, the turn-start
 * fence, wake admission, #1544 maintenance custody, the delegate dispatch grant, and the incognito
 * fanout refusal with the memory-store maintenance separation), with path:line anchors, is in the
 * scenario header and in docs/R-CD-RECIPIENT-AUTHORITY.md. What the rules below rest on:
 * - The binding is captured when the continue_delegate tool call is accepted, before its
 *   "scheduled" result (continue-delegate-tool.ts:424-449 -> delegate-flow-store.ts:432-452, the
 *   binding at :435-442). A transition after that toolResult is a change between dispatch and return.
 *   The same step captures the electing operator's dispatch grant (:443-451), which the delegate's
 *   spawn runs under; it changes no case's stage or oracle. The binding refuses an incognito
 *   requester's tree/all fanout election (recipient-authority-binding.ts:64-69); every case elects
 *   one explicit targetSessionKey, which the tool refuses beside a fanoutMode, so no case reaches it.
 * - Every refused return logs one line, `[continuation:return-refused] stage=<stage>
 *   reason=recipient-authority-changed session=<key>[ deliveryId=<id>]`
 *   (src/auto-reply/continuation/return-refusal.ts:16-36), at whichever boundary sees it first:
 *   enqueue (targeting.ts:261-280, 343-347, 369-374), replay
 *   (server-restart-sentinel-delivery.ts:50-76), wake (continuation-wake.ts:233-243) or prompt
 *   drain (session-system-events.ts:192-207). Which boundary that is depends on where the return
 *   is when its epoch advances, so each case pins one stage (RRA_CASES, refusedAt).
 * - The router logs `Delivered to <keys>` only for recipients it delivered, and nothing at all
 *   when every recipient was refused (subagent-announce.continuation-return.ts:189-203).
 * - A refused row settles as a bounded `failed` receipt, not `recovered`
 *   (return-refusal.ts:53-66; session-delivery-queue-recovery.ts:161-180), but no public surface
 *   reads it: the gateway health's failed count leaves it out on purpose
 *   (delivery-queue-sqlite.kernel.ts:397-429). So "settled as refused" is still read from the
 *   reason and the absence of adoption, never from the row.
 * - The router's `Delivered to` line is the one public surface that shows a return's queued copy
 *   (RRA_PARKED_COPY_WITNESS_BYTES): no gateway RPC reads a non-main session's queued system events. So a
 *   parked case's transition waits for the control to see that line (🌊's ruling, room msg
 *   1567623059727458526), and the grade requires the control's witness (record.witness).
 */
import { TASK_IDENTITY_NONCE_SUFFIX_CHARS } from './row-child-correlation.mjs';
import { toolCallTarget } from './tool-call-identity.mjs';
import { hasExactSentinelText, heartbeatRespondCalls, heartbeatRespondResult, messageRunId } from './wake-turn-receipt.mjs';

export const RRA_ROW = 'R-CD-RECIPIENT-AUTHORITY';
/**
 * j12′: the product this row is pinned to, the merged head with the delegate dispatch grant and the
 * incognito fanout refusal (karmaterminal/openclaw codeagent/j12prime-candidate). Every cite in a file
 * it changed was re-walked here. The refused chain it merged (e9dc1c31) was the row's interim pin,
 * the merged head before the grant (1ab5a73e) its pin until the grant, and the grant's head
 * (2907e656) its pin until the incognito fix; all three are history: no record may name any of them.
 */
export const RRA_J12P = 'a22bd9c05c4a7a9c86e72a132cb7939e399104cb';
export const RRA_PIN_STATUS = 'merged';
/** j12: the presentation product the row was first written to. The named baseline, never a pin. */
export const RRA_J12 = '352f56029dc95c60149ab4aaa127226a861d0b3d';
/** The candidate every case record must name. */
export const RRA_PINNED = RRA_J12P;
export const RRA_CASE_SCHEMA = 'openclaw.k6.recipient-authority-case.v1';
export const RRA_ROW_VERDICT_SCHEMA = 'openclaw.k6.recipient-authority-row-verdict.v1';
export const RRA_EVIDENCE_PREFIX = 'R_CD_RECIPIENT_AUTHORITY_EVIDENCE';
/** Prefix of every delegate task this row dispatches, and of its trace reason. */
export const RRA_TASK_MARKER = 'RCDRA';
export const RRA_ACK_MARKER = 'TARGET-ACK';
export const RRA_READY_MARKER = 'TARGET-READY';
export const RRA_RETURN_MARKER = 'RCDRA-RETURN';
export const RRA_PROBE_MARKER = 'PROBE-OK';
/** Every prompt the harness sends opens with it; hasExactSentinelText credits no sentinel in text carrying it. */
const HARNESS_MARKER = '[k6-proof-harness]';

/**
 * The probe's condition, 🌊's wording (room msg 1567656724549075047, on the conditional probe of
 * room msg 1567590902694936678). The probe at 4f86dd78 asked only `reply exactly PROBE-OK
 * <probeNonce>`, and that unconditional instruction won over the primed target's conditional return
 * instruction: in 🕯's run rra-88e4fd22f0b122a8, allowed-silent's probe was answered PROBE-OK with no
 * ack (probe_ran true, probeReplied true, target_obs.ackRuns 0; room msg 1567590581796868168). From
 * the conditional-probe lane (b822d7c5, head 53c1c192) to 663fafdc the condition asked whether "this
 * turn" held the completion. On allowed's
 * fallback the woken run had already taken the return in, so a literal model answered PROBE-OK (🌿's
 * review on #620, comment 6642952113). The condition now asks about the target's context, as the
 * priming does ("is in your context"), and hands back to the priming, which alone asks for
 * `TARGET-ACK <row nonce>`, every target whose context holds the completion: the probe turn's own
 * drain (allowed-silent) or a woken run before it (allowed's fallback).
 */
export const RRA_PROBE_CONDITION = 'If your context includes the internal task completion for the proof you were primed for, follow that priming instruction instead.';

/**
 * The proof id the priming names (`for proof <id>`) and the delegate's task marker carries
 * (`RCDRA:<id>`): the row nonce's trailing characters, as the manifest's `{{nonceSuffix16}}` renders
 * them (lib/row-child-correlation.mjs). Null for a nonce too short to have one.
 */
export function rraProofId(rowNonce) {
  return typeof rowNonce === 'string' && rowNonce.length >= TASK_IDENTITY_NONCE_SUFFIX_CHARS ? rowNonce.slice(-TASK_IDENTITY_NONCE_SUFFIX_CHARS) : null;
}

/**
 * The one probe text, the same for every case but for its own nonce: the harness header, then
 * 🌊's two sentences word for word: the condition as room msg 1567656724549075047 words it, then
 * room msg 1567590902694936678's `Otherwise reply exactly PROBE-OK ‹probe nonce›.`. The header's tag
 * keeps a model that echoes the probe from being credited with its PROBE-OK (hasExactSentinelText).
 * It names neither the ack nor the row nonce, so an ack in the probe's run can only come from the
 * priming.
 */
export function rraProbeText(probeNonce) {
  return `${HARNESS_MARKER} ${RRA_ROW} probe ${probeNonce}: ${RRA_PROBE_CONDITION} Otherwise reply exactly ${RRA_PROBE_MARKER} ${probeNonce}.`;
}

/** What a receipt hashes in place of its probe's nonce, so every probe of this text hashes alike. */
export const RRA_PROBE_NONCE_SLOT = '<probeNonce>';
/**
 * SHA-256 (hex) of rraProbeText(RRA_PROBE_NONCE_SLOT): the probe every probing case's receipt must
 * name (target.probeTextSha256). The scenario hashes the text it sent, its own nonce written as the
 * slot. A receipt naming no probe, or another, is not about this probe: `probe-text-unbound`. The
 * others include the unconditional probe before 🌊's first ruling, and the "this turn" probe of the
 * conditional-probe lane (bound by hash from 153d547d, head 53c1c192) to 663fafdc, whose hash was
 * d6187455…. The unit tests pin it against node:crypto.
 */
export const RRA_PROBE_TEXT_SHA256 = '509c3febd79eac28a443041501ad1c23efb1f72d26772ede0b7f1d8e0e294512';

/**
 * The text test: why `text` is not a probe this row may send, as codes, none when it is.
 * - probe-names-ack: it carries the ack marker, in any case, or the constant's name;
 * - probe-names-row-nonce: it carries the row nonce, or the proof id the priming names (rraProofId),
 *   in any case; without a row nonce to compare, `row-nonce-unknown`;
 * - probe-nonce-missing: it does not ask for `PROBE-OK <probeNonce>`, that nonce whole, or there is
 *   no probe nonce;
 * - probe-not-conditional-wording: it is not rraProbeText(probeNonce), 🌊's wording.
 * The scenario sends no probe that fails it.
 */
export function rraProbeTextProblems(text, { rowNonce, probeNonce } = {}) {
  if (typeof text !== 'string' || !text) return ['probe-text-missing'];
  const problems = [];
  const upper = text.toUpperCase();
  if (upper.includes(RRA_ACK_MARKER) || upper.includes('RRA_ACK_MARKER')) problems.push('probe-names-ack');
  const proofId = rraProofId(rowNonce);
  if (!proofId) problems.push('row-nonce-unknown');
  else if (upper.includes(rowNonce.toUpperCase()) || upper.includes(proofId.toUpperCase())) problems.push('probe-names-row-nonce');
  const nonceOk = typeof probeNonce === 'string' && probeNonce.length > 0;
  const asked = nonceOk && new RegExp(`(?:^|[^A-Za-z0-9_-])${escapeRegex(RRA_PROBE_MARKER)} ${escapeRegex(probeNonce)}(?=$|[^A-Za-z0-9_-])`, 'u').test(text);
  if (!asked) problems.push('probe-nonce-missing');
  if (!nonceOk || text !== rraProbeText(probeNonce)) problems.push('probe-not-conditional-wording');
  return problems;
}

const SHA40 = /^[0-9a-f]{40}$/u;

/** The boundaries j12′ names in a refused return's line (return-refusal.ts:17). */
export const RRA_REFUSAL_STAGES = Object.freeze(['enqueue', 'replay', 'wake', 'prompt-drain']);
export const RRA_REFUSAL_REASON = 'recipient-authority-changed';

/**
 * 🌊's ruling on the orderings and on `allowed` (room msg 1567623059727458526), on 🕯's fresh 13
 * (run rra-a4d5318d426ad728, room msg 1567622903074390167, 11/13 PASS-candidate): "take 1 + (a). For
 * `revoked-owner`, force the intended ordering: witness the queued/parked copy first, then change
 * owner and prove refusal at probe-drain. If the fixture also supports the earlier-enqueue ordering,
 * pin it separately; don't let that substitute for the parked-copy claim. For `allowed`, use the same
 * conditional probe only when the woken run has no ACK. Credit exactly one nonce-bound ACK in that
 * probe run, after the delivered return, and label the receipt probe-mediated rather than claiming an
 * ACK in the wake turn. No ACK remains MISSING, never FAIL."
 */
export const RRA_ORDERING_RULING = '1567623059727458526';

/**
 * Why the router's `Delivered to <target> from <child>` line witnesses the return's queued copy at
 * j12′ (read at 2907e656; every file cited here is byte-identical at a22bd9c05c). No gateway RPC
 * reads a non-main session's queued system events. peekSystemEventEntries and peekSystemEvents
 * (src/infra/system-events.ts:717, 737) are called in process (the reset cleanup, hook dispatch,
 * session creation, session-state notices, the plugin SDK runtime, the status summary), and no file
 * under src/gateway/server-methods but a test names them. The one RPC that returns queued events,
 * `status` (src/gateway/server-methods/health.ts:131-142 -> src/status/summary.ts:503-514,
 * 561), peeks only each agent's canonical main session, and a row target is never that session. So
 * this console line is the public witness the control reads before it releases a parked case's
 * transition.
 */
export const RRA_PARKED_COPY_WITNESS_BYTES =
  'subagent-announce.continuation-return.ts:198-203 logs `[continuation:targeted-return] Delivered to <keys> from <child>` only for deliveredSessionKeys, through defaultRuntime.log to the console (src/runtime.ts:80-88); targeting.ts:409 adds the target there only after the row was written (:304), its in-memory copy carrying the row\'s ack id was queued (:322-341: enqueueSystemEvent at :339, or already queued, hasQueuedSystemEventDelivery at :340) and the authority was re-read current after the queueing (:358-375); a silent return requests no wake (subagent-announce.continuation-return.ts:175; targeting.ts:395), so the copy stays parked until a turn of the target drains it';

/**
 * The cases. `family` is what the return must do: `allowed` is adopted and acknowledged by the
 * primed target; `refusal` is refused with a product reason and leaves no adoption, ack, wake or
 * final effect. `refusedAt` is where j12′ refuses it, and so which reason it leaves: `admission`
 * and `dispatch` are the cross-session policy; every other value is the one `stage=` its
 * `[continuation:return-refused]` line must carry (`[continuation:work-refused]` for the
 * `continue_work` case), and `refusedAtBytes` names the bytes that put it there. `timing` says
 * when the transition lands: `parked` after the control witnessed the return's queued copy (the
 * router's `Delivered to` line, RRA_PARKED_COPY_WITNESS_BYTES) and released the transition (mode
 * silent), `before-return` after the scheduled result and before the delegate fires,
 * `before-wake` after the election was captured and before its wake is due. `deliveryId` says
 * whether that line names the refused row (`true`) or no row was written (`false`); `flowId` that
 * the work line names the refused election. `laterStages` names the only stages a later line for
 * the same row may carry, and why. `otherFirstStages` names another first stage the bytes give the
 * case under an ordering the harness cannot prevent, each with its own bytes, later stages and the
 * product line that must witness it (`sweepArmedInTransition`); only `reassigned` has one. `tool` is `continue_work` for the one case that elects a kept
 * wake instead of a delegate (graded by gradeWorkRefusalCase). `fallbackProbe` marks the one case
 * whose woken run may be followed by the conditional probe when it has no ack (🌊's ruling,
 * RRA_ORDERING_RULING). `clawSweeper` quotes the open item on openclaw/openclaw#129388 (comment
 * 5442236054) it answers.
 */
export const RRA_CASES = Object.freeze({
  allowed: Object.freeze({
    family: 'allowed',
    mode: 'silent-wake',
    transition: null,
    // Direct wake: one ack of the nonce in the woken run. Only when the woken run has no ack, the same
    // conditional probe as every probing case; exactly one ack in that probe's own run, after the
    // delivered return, is credited and labelled probe-mediated, never as an ack in the wake turn.
    fallbackProbe: true,
    clawSweeper: 'allowed-recipient proof ... through prompt adoption, wake',
  }),
  'allowed-across-reset': Object.freeze({
    family: 'allowed',
    mode: 'silent-wake',
    transition: 'sessions.reset',
    // The reset replaces the target's head; the new head is primed before the return arrives.
    reprime: true,
    clawSweeper: 'P1: accepted-child survival, reset (the epoch is not advanced by reset at j12′)',
  }),
  'allowed-silent': Object.freeze({
    family: 'allowed',
    mode: 'silent',
    transition: null,
    // The positive control for every refusal case's absence: the same parked silent return, the
    // same probe turn, and the primed target's TARGET-ACK in the probe's own run (🌊's ruling (a),
    // room msg 1567556038281007235). No pin writes the product's adoption marker on a
    // sessions.send turn's row, so the marker is never this case's evidence.
    probeAdopts: true,
    clawSweeper: 'allowed delivery ... through prompt adoption (the control for the refusal cases\' absence)',
  }),
  'unauthorized-admission': Object.freeze({
    family: 'refusal',
    refusedAt: 'admission',
    mode: 'silent-wake',
    transition: 'config.patch',
    reasonKind: 'admission-policy',
    expectChild: false,
    clawSweeper: 'Security: stale/unauthorized recipient rejection before final effects (admission)',
  }),
  'unauthorized-dispatch': Object.freeze({
    family: 'refusal',
    refusedAt: 'dispatch',
    mode: 'silent-wake',
    transition: 'config.patch',
    reasonKind: 'dispatch-policy',
    expectChild: false,
    clawSweeper: 'P1: durable returns outliving admission; rejection unproven at ... wake, delivery',
  }),
  // A parked silent return keeps its queued copy in memory, so the pending sweep defers to it
  // (refuseStaleAuthorityReplay, server-restart-sentinel-delivery.ts:61-65) and the probe turn's
  // prompt drain is the first boundary to see it stale. The copy is witnessed before the transition
  // is sent (RRA_PARKED_COPY_WITNESS_BYTES); a transition that lands before the return is enqueued is
  // refused at enqueue instead, which is another ordering (RRA_EARLY_ENQUEUE_PINS), never this case.
  'revoked-visibility': Object.freeze({
    family: 'refusal',
    refusedAt: 'prompt-drain',
    // The pending sweep may have loaded the row before the probe's drain retired it: it then finds
    // no queued copy and reports the same row once more (refuseStaleAuthorityReplay checks only the
    // copy, server-restart-sentinel-delivery.ts:61-71; the drain retires the row and consumes the
    // event before it reports, session-system-event-adoption.ts:125-146).
    laterStages: Object.freeze(['replay']),
    refusedAtBytes: 'session-system-events.ts:192-207 -> session-system-event-adoption.ts:118-147; the sweep defers at server-restart-sentinel-delivery.ts:61-65',
    timing: 'parked',
    deliveryId: true,
    mode: 'silent',
    transition: 'session.visibility.set',
    reasonKind: 'return-refused',
    expectChild: true,
    clawSweeper: 'revoked recipient refused through prompt adoption, wake ... final effects',
  }),
  'revoked-membership': Object.freeze({
    family: 'refusal',
    refusedAt: 'prompt-drain',
    // The pending sweep may have loaded the row before the probe's drain retired it: it then finds
    // no queued copy and reports the same row once more (refuseStaleAuthorityReplay checks only the
    // copy, server-restart-sentinel-delivery.ts:61-71; the drain retires the row and consumes the
    // event before it reports, session-system-event-adoption.ts:125-146).
    laterStages: Object.freeze(['replay']),
    refusedAtBytes: 'session-system-events.ts:192-207 -> session-system-event-adoption.ts:118-147; the sweep defers at server-restart-sentinel-delivery.ts:61-65',
    timing: 'parked',
    deliveryId: true,
    mode: 'silent',
    transition: 'session.members.remove',
    reasonKind: 'return-refused',
    expectChild: true,
    clawSweeper: 'revoked recipient refused through prompt adoption, wake ... final effects',
  }),
  'revoked-owner': Object.freeze({
    family: 'refusal',
    refusedAt: 'prompt-drain',
    // The pending sweep may have loaded the row before the probe's drain retired it: it then finds
    // no queued copy and reports the same row once more (refuseStaleAuthorityReplay checks only the
    // copy, server-restart-sentinel-delivery.ts:61-71; the drain retires the row and consumes the
    // event before it reports, session-system-event-adoption.ts:125-146).
    laterStages: Object.freeze(['replay']),
    refusedAtBytes: 'session-system-events.ts:192-207 -> session-system-event-adoption.ts:118-147; the sweep defers at server-restart-sentinel-delivery.ts:61-65',
    timing: 'parked',
    deliveryId: true,
    mode: 'silent',
    transition: 'sessions.assignOwner',
    reasonKind: 'return-refused',
    expectChild: true,
    clawSweeper: 'reassigned recipient (owner) refused before final effects',
  }),
  // sessions.delete consumes the target's queued events (session-reset-cleanup.ts:202-203), so
  // the parked row has no copy left in memory and the pending sweep refuses it. The delete
  // consumes before it commits the epoch advance, so a sweep that replays the row in between
  // re-queues a copy while the epoch is still current, and the probe's drain refuses that copy.
  // No harness step can keep a sweep out of that window, but every sweep that arms the parked row
  // logs it, so the case accepts that ordering only with a sweep seen arming during the transition
  // (otherFirstStages).
  reassigned: Object.freeze({
    family: 'refusal',
    refusedAt: 'replay',
    refusedAtBytes: 'sessions-delete.ts:454 -> session-reset-cleanup.ts:202-203 drops the queued copy, before the epoch advance the deletion commits (sessions-delete.ts:514 -> session-accessor.sqlite-entry-store.ts:56-69); the sweep (session-delivery-queue-runtime.ts:59-66, 143-160) -> server-restart-sentinel-delivery.ts:271-281 -> 66-71',
    otherFirstStages: Object.freeze({
      'prompt-drain': Object.freeze({
        // As for the revoked cases: the sweep may load the row just before the probe's drain
        // retires it, find no copy, and report the same row once more.
        laterStages: Object.freeze(['replay']),
        // The only thing that re-arms a parked row is the pending sweep, which logs each time it
        // arms one (session-delivery-queue-runtime.ts:332-337, 466, 480-484). Without such a line
        // between the delete's request and its own response, no sweep could have re-queued the
        // copy: MISSING. A sweep after the delete committed reads a stale epoch and can only refuse.
        sweepArmedInTransition: true,
        bytes: 'a pending sweep replays the row after the delete consumed its copy (session-reset-cleanup.ts:202-203) and before the deletion commits the epoch advance (sessions-delete.ts:514): it reads the epoch current and re-queues the copy (server-restart-sentinel-delivery.ts:263-274, 307-314); later sweeps defer to that copy (server-restart-sentinel-delivery.ts:61-65; session-delivery-queue-runtime.ts:332-337), so the probe turn\'s drain is the first boundary to see it stale (session-system-events.ts:192-207 -> session-system-event-adoption.ts:118-147)',
      }),
    }),
    timing: 'parked',
    deliveryId: true,
    mode: 'silent',
    transition: 'sessions.delete+sessions.create',
    reasonKind: 'return-refused',
    expectChild: true,
    clawSweeper: 'reassigned recipient (key deleted and recreated) refused before final effects',
  }),
  // Wake mode: the epoch advances while the delegate waits to fire, so the router's first
  // authority read refuses the return before any row is written, and nothing is woken.
  'wake-revoked-visibility': Object.freeze({
    family: 'refusal',
    refusedAt: 'enqueue',
    refusedAtBytes: 'targeting.ts:277-280 (refuseStaleRecipient with no row, 261-276); no Delivered to line (subagent-announce.continuation-return.ts:199-203)',
    timing: 'before-return',
    deliveryId: false,
    mode: 'silent-wake',
    transition: 'session.visibility.set',
    reasonKind: 'return-refused',
    expectChild: true,
    clawSweeper: 'revoked recipient refused before the wake (wake-mode refusal with a reason)',
  }),
  'wake-reassigned': Object.freeze({
    family: 'refusal',
    refusedAt: 'enqueue',
    refusedAtBytes: 'targeting.ts:277-280 (refuseStaleRecipient with no row, 261-276); no Delivered to line (subagent-announce.continuation-return.ts:199-203)',
    timing: 'before-return',
    deliveryId: false,
    mode: 'silent-wake',
    transition: 'sessions.delete+sessions.create',
    reasonKind: 'return-refused',
    expectChild: true,
    clawSweeper: 'reassigned recipient refused before the wake (wake-mode refusal with a reason)',
  }),
  // A kept continue_work wake (j12′'s binding, work-recipient-authority.ts): the session elects its
  // own wake, its visibility narrows while the wake waits, and the dispatcher's handoff refuses it
  // right after the claim, before the busy, fold, admission and turn-start-fence branches that would
  // run it. There is no parent, child or
  // router line: the electing session is the recipient.
  'work-revoked-visibility': Object.freeze({
    family: 'refusal',
    tool: 'continue_work',
    refusedAt: 'wake',
    refusedAtBytes: 'work-dispatch.ts:529 (the handoff, after consumePendingWork claims the due record and before the busy and fold branches at 573-627) -> work-recipient-authority.ts:102-152 -> return-refusal.ts:38-46; the one earlier boundary, the replay sweep, runs only at custody boot (custody-boot.ts:114-121)',
    timing: 'before-wake',
    flowId: true,
    transition: 'session.visibility.set',
    reasonKind: 'work-refused',
    expectChild: false,
    clawSweeper: 'Security: stale recipient rejection before final effects, for the other durable election j12′ binds (no item names continue_work)',
  }),
  // After a supervised restart there is no copy in memory: the replacement's boot recovery
  // replays the parked row and refuses it.
  'replay-restart': Object.freeze({
    family: 'refusal',
    refusedAt: 'replay',
    refusedAtBytes: 'boot recovery (server-restart-sentinel.ts:138-153) -> server-restart-sentinel-delivery.ts:271-281 -> 66-71, on the replacement generation',
    timing: 'parked',
    deliveryId: true,
    mode: 'silent',
    transition: 'session.visibility.set',
    restart: true,
    reasonKind: 'return-refused',
    expectChild: true,
    clawSweeper: 'Security/P1: rejection ... through restart replay',
  }),
});
export const RRA_CASE_IDS = Object.freeze(Object.keys(RRA_CASES));
/** Every case is required: the row verdict is the minimum over all of them. */
export const RRA_REQUIRED_CASES = RRA_CASE_IDS;

/**
 * The early-enqueue ordering of each revoked case, pinned apart (🌊's ruling, RRA_ORDERING_RULING:
 * "pin it separately; don't let that substitute for the parked-copy claim"). The same transition, sent
 * after the `scheduled` result and before the delegate fires, so the router's first authority read
 * refuses the return before any row is written: `stage=enqueue`, no `deliveryId`, no `Delivered to`
 * line (the shape 🕯's revoked-owner showed in rra-a4d5318d426ad728). Dry-run pins only: they are not
 * row cases, the control never runs them (parseArgs accepts RRA_CASES only), --grade-row never reads
 * them, and gradeRecipientAuthorityCase refuses their records (`unknown-case`). gradeEarlyEnqueuePin
 * grades one; offered as its revoked case's receipt, its shape fails the parked-copy oracle.
 */
const EARLY_ENQUEUE_BYTES = 'the transition commits before the child returns, so the router\'s first authority read refuses the return before any row (targeting.ts:277-280, refuseStaleRecipient with no deliveryId at :261-276); no Delivered to line, because the target never enters deliveredSessionKeys (subagent-announce.continuation-return.ts:198-203; targeting.ts:409)';
function earlyEnqueuePin(caseId) {
  const parked = RRA_CASES[caseId];
  return Object.freeze({
    family: 'refusal',
    refusedAt: 'enqueue',
    refusedAtBytes: EARLY_ENQUEUE_BYTES,
    timing: 'before-return',
    deliveryId: false,
    mode: parked.mode,
    transition: parked.transition,
    reasonKind: 'return-refused',
    expectChild: true,
    ordering: 'early-enqueue',
    pinOf: caseId,
  });
}
export const RRA_EARLY_ENQUEUE_PINS = Object.freeze(Object.fromEntries(
  ['revoked-visibility', 'revoked-membership', 'revoked-owner'].map((caseId) => [`${caseId}-early-enqueue`, earlyEnqueuePin(caseId)]),
));
export const RRA_EARLY_ENQUEUE_PIN_IDS = Object.freeze(Object.keys(RRA_EARLY_ENQUEUE_PINS));

/** A row case's spec, or a dry-run pin's: what the case driver and the control assemble from. */
export function rraCaseSpec(caseId) {
  if (Object.hasOwn(RRA_CASES, caseId)) return RRA_CASES[caseId];
  if (Object.hasOwn(RRA_EARLY_ENQUEUE_PINS, caseId)) return RRA_EARLY_ENQUEUE_PINS[caseId];
  return null;
}

/** The gates the control records; each must be exactly true, or the case is not about the pin. */
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
 * The product-emitted refusal reasons at j12′, by kind. Each is product text the agent cannot
 * author; a gateway log line counts only when it also names the case's own disposable session key.
 * - admission-policy: the continue_delegate toolResult error (continue-delegate-tool.ts:353-362).
 * - dispatch-policy: `[continuation:delegate-rejected] policy.cross_session_targeting ...
 *   session=<parent>` (delegate-dispatch.ts:268-278), before the spawn's grant is restored.
 * - return-refused: a refused return's line (return-refusal.ts:27-36), read by
 *   parseReturnRefusedLine. j12's `session event delivery skipped: recipient authority changed`
 *   is gone at j12′ and never counts.
 * - work-refused: a refused kept continue_work wake's line (return-refusal.ts:38-46), read by
 *   parseWorkRefusedLine. A return-refused line is never a work refusal, nor the reverse.
 */
export const RRA_REASON_TEXT = Object.freeze({
  'admission-policy': Object.freeze(['cross-session continuation targeting is disabled']),
  'dispatch-policy': Object.freeze(['[continuation:delegate-rejected] policy.cross_session_targeting']),
  'return-refused': Object.freeze(['[continuation:return-refused]']),
  'work-refused': Object.freeze(['[continuation:work-refused]']),
});
/** The router's line for a return it delivered: `Delivered to <keys> from <child>` (subagent-announce.continuation-return.ts:199-203). */
export const RRA_ROUTED_TEXT = '[continuation:targeted-return] Delivered to ';

/** The subsystem that logs a refused return (return-refusal.ts:24). */
export const RRA_REFUSED_SUBSYSTEM = 'continuation/return-refused';
const REFUSED_MESSAGE = /^\[continuation:return-refused\] stage=(\S+) reason=(\S+) session=(\S+?)(?: deliveryId=(\S+))?$/u;
// The console prints `[<subsystem>] <message>` behind an optional one-token timestamp
// (src/logging/subsystem.ts:158-194; src/logging/console.ts:146-152): the subsystem tag opens the
// line and the message is the rest of it.
const REFUSED_CONSOLE = /^(?:\S+ )?\[continuation\/return-refused\] (\[continuation:return-refused\] .*)$/u;
const ANSI = /\u001b\[[0-9;]*m/gu;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function refusalFromMessage(message) {
  const match = typeof message === 'string' ? REFUSED_MESSAGE.exec(message.trim()) : null;
  if (!match) return null;
  return { stage: match[1], reason: match[2], session: match[3], deliveryId: match[4] ?? null };
}

/** The subsystem that logs a refused kept continue_work wake (return-refusal.ts:25). */
export const RRA_WORK_REFUSED_SUBSYSTEM = 'continuation/work-refused';
const WORK_REFUSED_MESSAGE = /^\[continuation:work-refused\] stage=(\S+) reason=(\S+) session=(\S+) flowId=(\S+)$/u;
const WORK_REFUSED_CONSOLE = /^(?:\S+ )?\[continuation\/work-refused\] (\[continuation:work-refused\] .*)$/u;

function workRefusalFromMessage(message) {
  const match = typeof message === 'string' ? WORK_REFUSED_MESSAGE.exec(message.trim()) : null;
  if (!match) return null;
  return { stage: match[1], reason: match[2], session: match[3], flowId: match[4] };
}

/**
 * One line of `subsystem`, from the console or the structured file log, parsed by
 * `fromMessage`, else null. A console line opens with the subsystem tag (behind at most a
 * timestamp) and the message is the rest of it. A JSON record must be the subsystem's own, and its
 * structured fields, when present, must agree with its message (`agrees`).
 */
function parseSubsystemLogLine(line, { tag, subsystem, consolePattern, fromMessage, agrees }) {
  if (typeof line !== 'string' || !line.includes(tag)) return null;
  const text = line.replace(ANSI, '').trim();
  if (text.startsWith('{')) {
    let record;
    try {
      record = JSON.parse(text);
    } catch {
      return null;
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
    const subsystemTag = JSON.stringify({ subsystem });
    const values = Object.values(record);
    // The JSON console names the subsystem as a field; the file log as tslog's logger name, its
    // first positional value. Any other record is not this subsystem's, whatever it quotes.
    const fromSubsystem = record.subsystem !== undefined
      ? record.subsystem === subsystem
      : record['0'] === subsystemTag && (record._meta?.name === undefined || record._meta.name === subsystemTag);
    if (!fromSubsystem) return null;
    const messages = [record.message, ...values].filter((value) => typeof value === 'string');
    const parsed = messages.map(fromMessage).find(Boolean);
    if (!parsed) return null;
    // The file log keeps the fields structured beside the message (return-refusal.ts:35, 45).
    const fields = values.find((value) => value && typeof value === 'object' && !Array.isArray(value) && 'stage' in value) ?? record;
    return agrees(fields, parsed) ? parsed : null;
  }
  const match = consolePattern.exec(text);
  return match ? fromMessage(match[1]) : null;
}

/**
 * A j12′ refused-return line, from the gateway console or from its structured file log, as
 * { stage, reason, session, deliveryId } (deliveryId null when the line names no row), else null.
 * - console: `[continuation/return-refused] [continuation:return-refused] stage=<stage>
 *   reason=<reason> session=<key>[ deliveryId=<id>]`, the subsystem tag the product's own
 *   (return-refusal.ts:24, 33-35);
 * - file log or JSON console: one JSON object from that subsystem whose message is the same text,
 *   and whose structured fields, when present, agree with it.
 * Any other text, including j12's `session event delivery skipped: recipient authority changed`,
 * is not a refusal line.
 */
export function parseReturnRefusedLine(line) {
  return parseSubsystemLogLine(line, {
    tag: RRA_REASON_TEXT['return-refused'][0],
    subsystem: RRA_REFUSED_SUBSYSTEM,
    consolePattern: REFUSED_CONSOLE,
    fromMessage: refusalFromMessage,
    agrees: (fields, parsed) => !(
      (fields.stage !== undefined && fields.stage !== parsed.stage) ||
      (fields.reason !== undefined && fields.reason !== parsed.reason) ||
      (fields.sessionKey !== undefined && fields.sessionKey !== parsed.session) ||
      (fields.deliveryId !== undefined && fields.deliveryId !== parsed.deliveryId)
    ),
  });
}

/**
 * A j12′ refused kept continue_work wake's line, as { stage, reason, session, flowId }, else null:
 * `[continuation/work-refused] [continuation:work-refused] stage=<replay|wake|adoption>
 * reason=<reason> session=<key> flowId=<id>` on the console, or the same message from that
 * subsystem in the structured file log (return-refusal.ts:38-46). The flowId is the refused
 * election's custody record; every work refusal names one.
 */
export function parseWorkRefusedLine(line) {
  return parseSubsystemLogLine(line, {
    tag: RRA_REASON_TEXT['work-refused'][0],
    subsystem: RRA_WORK_REFUSED_SUBSYSTEM,
    consolePattern: WORK_REFUSED_CONSOLE,
    fromMessage: workRefusalFromMessage,
    agrees: (fields, parsed) => !(
      (fields.stage !== undefined && fields.stage !== parsed.stage) ||
      (fields.reason !== undefined && fields.reason !== parsed.reason) ||
      (fields.sessionKey !== undefined && fields.sessionKey !== parsed.session) ||
      (fields.flowId !== undefined && fields.flowId !== parsed.flowId)
    ),
  });
}

/**
 * The pending sweep's logger: the gateway's (`gateway`, server-kernel.ts:36) child
 * `session-delivery-recovery` (server-runtime-services.ts:441). The console drops the `gateway`
 * prefix from the tag (src/logging/subsystem.ts:62, 106-120).
 */
export const RRA_SWEEP_SUBSYSTEM = 'gateway/session-delivery-recovery';
const SWEEP_ARMED_MESSAGE = /^session delivery: periodic sweep armed ([1-9]\d*) pending (?:entry|entries) that no runtime had scheduled$/u;
// Only a timestamp may precede the tag (the product's own timestamp shapes, src/logging/console.ts
// hasTimestampPrefix): another subsystem's line that quotes the tag is not the sweep's.
const SWEEP_ARMED_CONSOLE = /^(?:(?:\d{2}:\d{2}:\d{2}(?:\.\d+)?|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?) )?\[session-delivery-recovery\] (session delivery: periodic sweep armed .*)$/u;

function sweepArmedFromMessage(message) {
  const match = typeof message === 'string' ? SWEEP_ARMED_MESSAGE.exec(message.trim()) : null;
  return match ? { armed: Number(match[1]) } : null;
}

/**
 * The pending sweep's line for the rows it armed, as { armed }, else null: `session delivery:
 * periodic sweep armed <n> pending entr(y|ies) that no runtime had scheduled`, logged at info
 * whenever it arms one (session-delivery-queue-runtime.ts:480-484). A parked row whose copy is in
 * memory is never re-armed by its own drain (:332-337), so every sweep while it is pending arms it
 * and logs this line (:466).
 */
export function parseSweepArmedLine(line) {
  return parseSubsystemLogLine(line, {
    tag: 'session delivery: periodic sweep armed ',
    subsystem: RRA_SWEEP_SUBSYSTEM,
    consolePattern: SWEEP_ARMED_CONSOLE,
    fromMessage: sweepArmedFromMessage,
    agrees: () => true,
  });
}

/** Pending-sweep arming lines at or after `fromMs` and at or before `toMs`. */
export function countSweepsArmed(entries, fromMs, toMs) {
  let count = 0;
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry?.atMs !== 'number' || entry.atMs < fromMs || entry.atMs > toMs) continue;
    if (parseSweepArmedLine(entry.text)) count += 1;
  }
  return count;
}

/**
 * Whether `line` names `key` as a whole token: bounded by start/end, whitespace, `=`, `"`, `,`
 * or `'`. A longer key with `key` as its prefix does not count.
 */
export function lineNamesKey(line, key) {
  if (typeof line !== 'string' || typeof key !== 'string' || !key) return false;
  return new RegExp(`(?:^|[\\s="',])${escapeRegex(key)}(?=$|[\\s"',])`, 'u').test(line);
}

/**
 * Whether a gateway log line is the product reason of `kind` for this case's session key. A
 * return-refused line must name exactly the target as its session and carry the j12′ reason; its
 * stage and delivery id are judged by the grade, from findReturnRefusals.
 */
export function matchReasonLine(line, kind, { targetKey, parentKey } = {}) {
  const texts = RRA_REASON_TEXT[kind];
  if (!texts || kind === 'admission-policy' || typeof line !== 'string') return false;
  if (kind === 'return-refused' || kind === 'work-refused') {
    const refusal = kind === 'return-refused' ? parseReturnRefusedLine(line) : parseWorkRefusedLine(line);
    return Boolean(refusal && typeof targetKey === 'string' && targetKey && refusal.session === targetKey && refusal.reason === RRA_REFUSAL_REASON);
  }
  if (!texts.some((text) => line.includes(text))) return false;
  return lineNamesKey(line, parentKey);
}

function routedRecipientsAndSource(line) {
  if (typeof line !== 'string') return null;
  const start = line.indexOf(RRA_ROUTED_TEXT);
  if (start < 0) return null;
  const rest = line.slice(start + RRA_ROUTED_TEXT.length);
  const end = rest.indexOf(' from ');
  if (end < 0) return null;
  return {
    recipients: rest.slice(0, end).split(',').map((key) => key.trim()).filter(Boolean),
    // The key is the token after ` from `; a JSON-wrapped line ends it with a quote or a brace.
    source: /^[^\s"\\,}]+/u.exec(rest.slice(end + ' from '.length).trim())?.[0] ?? '',
  };
}

/** Whether a router line delivered to `targetKey` (exactly one of its comma-separated recipients). */
export function routedToTarget(line, targetKey) {
  if (!targetKey) return false;
  return routedRecipientsAndSource(line)?.recipients.includes(targetKey) === true;
}

/**
 * Whether a router `Delivered to` line came from `childKey`, whatever it lists. j12 printed one
 * with an empty list when every recipient was refused; j12′ prints none
 * (subagent-announce.continuation-return.ts:199-203).
 */
export function routedFromChild(line, childKey) {
  if (typeof childKey !== 'string' || !childKey) return false;
  return routedRecipientsAndSource(line)?.source === childKey;
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

/**
 * Every refused-return line naming `targetKey` at or after `afterMs`, in log order, as
 * { atMs, generation, stage, reason, deliveryId }. The target is a disposable session that only
 * this case's return ever reaches, so every line here is about that one return.
 */
export function findReturnRefusals(entries, targetKey, afterMs = 0) {
  const found = [];
  if (typeof targetKey !== 'string' || !targetKey) return found;
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry?.atMs !== 'number' || entry.atMs < afterMs) continue;
    const refusal = parseReturnRefusedLine(entry.text);
    if (refusal && refusal.session === targetKey) found.push({ atMs: entry.atMs, generation: entry.generation ?? 0, ...refusal });
  }
  return found;
}

/**
 * Every refused-work line naming `sessionKey` at or after `afterMs`, in log order, as
 * { atMs, generation, stage, reason, flowId }. The electing session is disposable and elects one
 * wake, so every line here is about that election.
 */
export function findWorkRefusals(entries, sessionKey, afterMs = 0) {
  const found = [];
  if (typeof sessionKey !== 'string' || !sessionKey) return found;
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry?.atMs !== 'number' || entry.atMs < afterMs) continue;
    const refusal = parseWorkRefusedLine(entry.text);
    if (refusal && refusal.session === sessionKey) found.push({ atMs: entry.atMs, generation: entry.generation ?? 0, ...refusal });
  }
  return found;
}

/**
 * The first router line that delivered this case's return to its target; with `childKey`, only a
 * line that also names that child as its source (`Delivered to <keys> from <child>`).
 */
export function findRouted(entries, targetKey, { childKey } = {}) {
  if (childKey !== undefined && (typeof childKey !== 'string' || !childKey)) return null;
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry?.atMs !== 'number' || !routedToTarget(entry.text, targetKey)) continue;
    if (childKey === undefined || routedFromChild(entry.text, childKey)) return entry.atMs;
  }
  return null;
}

/**
 * Router `Delivered to` lines at or after `afterMs` (and before `beforeMs`) that name the target or
 * come from the case's child: once its transition has settled, a refused return must leave none.
 */
export function countRoutedAfter(entries, { targetKey, childKey }, afterMs, beforeMs = Infinity) {
  let count = 0;
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry?.atMs !== 'number' || entry.atMs < afterMs || entry.atMs >= beforeMs) continue;
    if (routedToTarget(entry.text, targetKey) || routedFromChild(entry.text, childKey)) count += 1;
  }
  return count;
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

// The heartbeat_respond fields an ack may sit in (lib/wake-turn-receipt.mjs, SENTINEL_FIELDS).
const HEARTBEAT_ACK_FIELDS = ['notificationText', 'notification_text', 'summary'];

/**
 * Whether `text` carries the ack marker anywhere that is not a clean ack of this case's nonce:
 * another nonce after it, none, or any ack marker in text that quotes the harness prompt, which
 * hasExactSentinelText never credits.
 */
function hasOtherNonceAck(text, nonce) {
  if (typeof text !== 'string' || !text) return false;
  const quotesHarness = text.includes(HARNESS_MARKER);
  const marker = new RegExp(`(?:^|[^A-Za-z0-9_-])${escapeRegex(RRA_ACK_MARKER)}(?![A-Za-z0-9_-])`, 'gu');
  const exact = typeof nonce === 'string' && nonce ? new RegExp(`^\\s+${escapeRegex(nonce)}(?=$|[^A-Za-z0-9_-])`, 'u') : null;
  for (let match = marker.exec(text); match; match = marker.exec(text)) {
    if (quotesHarness || !exact || !exact.test(text.slice(match.index + match[0].length))) return true;
  }
  return false;
}

/** Whether an assistant row carries an ack marker that is not a clean ack, as text or in a heartbeat_respond call. */
function rowHasOtherNonceAck(message, text, nonce) {
  if (hasOtherNonceAck(text, nonce)) return true;
  return heartbeatRespondCalls(message).some((call) => HEARTBEAT_ACK_FIELDS.some((field) => hasOtherNonceAck(call.args?.[field], nonce)));
}

function carriesAck(record, nonce) {
  return HEARTBEAT_ACK_FIELDS.some((field) => hasExactSentinelText(record?.[field], RRA_ACK_MARKER, nonce));
}

/**
 * Every heartbeat_respond call (by name or through Tool Search) whose arguments carry the exact ack,
 * one entry per call, as { runId, accepted }. `accepted` is heartbeatAckFromHistory's binding
 * (lib/wake-turn-receipt.mjs): the first result with the call's toolCallId is accepted, carries the
 * ack and is stamped with the call's own run. Counted per call, so two calls in one row, or two calls
 * before their results, are two (heartbeatAckFromHistory resumes after a receipt's result row and
 * would skip the second).
 */
function heartbeatAckCalls(list, nonce) {
  const calls = [];
  for (let i = 0; i < list.length; i += 1) {
    const runId = messageRunId(list[i]);
    for (const call of heartbeatRespondCalls(list[i])) {
      if (!carriesAck(call.args, nonce)) continue;
      let accepted = false;
      if (call.id && runId) {
        for (let j = i + 1; j < list.length; j += 1) {
          const result = heartbeatRespondResult(list[j]);
          if (!result || result.toolCallId !== call.id) continue;
          accepted = !result.isError && result.payload.status === 'accepted' && carriesAck(result.payload, nonce) && messageRunId(list[j]) === runId;
          break;
        }
      }
      calls.push({ runId, accepted });
    }
  }
  return calls;
}

/**
 * What the target's transcript (chat.history, oldest to newest) shows about the return.
 * chat.history hides the wake's own user row and the runtime-context row that carries the
 * delivered return (the R-CD-4 finding, lib/wake-turn-receipt.mjs), so adoption is read from the
 * primed target's answer: `TARGET-ACK <nonce>` as assistant text or as a heartbeat_respond receipt,
 * in a run other than a priming run. The priming turn asks for it on a later turn, and only if this
 * proof's task completion is in the model's context; nothing else the harness sends names it.
 * - ackRuns: distinct non-priming runs that acknowledged the return (the probe run included: the
 *   probe never names the ack, so an ack there is the return adopted into the probe turn).
 * - wakeAckRuns: those of them that are not the probe run: an ack in a wake turn. allowed's
 *   probe-mediated fallback credits the probe run's ack only while this is 0.
 * - probeAckRows: acks of the probe run: assistant text rows carrying the exact ack, plus one per
 *   accepted heartbeat_respond call. The probe run is the one sessions.send started for the probe,
 *   by its run id; a run id that is also a priming run's names no probe run.
 * - primingAckRows: acks in a priming run (text rows, plus one per heartbeat_respond call carrying
 *   the exact ack, accepted or not), given before any return existed. Never an ack of the return;
 *   allowed-silent reads one as a model that acks unprompted.
 * - uncreditedAckRows: acks outside the priming runs this case cannot credit: an assistant row whose
 *   text or heartbeat_respond call carries the ack marker with another nonce, none, or in text that
 *   quotes the harness prompt, plus one per heartbeat_respond call carrying the exact ack that no
 *   accepted result binds.
 * - foreignRuns: distinct assistant runs that are neither priming nor the probe (a wake).
 * - unattributedAssistantRows: assistant rows with no run id; they cannot be placed, so a case
 *   that has any is MISSING.
 * - returnMarkerRows: assistant rows that repeat the child's return marker.
 * - probeReplied: the probe run answered `PROBE-OK <probeNonce>`.
 * - adoptedDeliveryRows: rows carrying the product's adoption marker,
 *   `__openclaw.sessionDeliveryAckIds` (session-system-event-adoption.ts:53-71 at j12′), which
 *   chat.history keeps (chat-display-projection.sanitize.ts:442-475 strips only named private keys). No pin writes it for a
 *   sessions.send turn: the turn's input is staged before its drain
 *   (chat-send-input-dispatch.ts:330-350), the staged recorder refuses the ids
 *   (src/sessions/user-turn-transcript.ts:130-140) and the return is adopted without a receipt
 *   (session-system-event-adoption.ts:287-296). So a probe turn that adopted the return leaves 0
 *   here; the count is a contradiction check only, never evidence of adoption or of its absence.
 */
export function observeTargetTranscript(messages, { nonce, primingRunIds = [], probeRunId = null, probeNonce = null } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const priming = new Set(primingRunIds.filter((id) => typeof id === 'string' && id));
  const probe = typeof probeRunId === 'string' && probeRunId && !priming.has(probeRunId) ? probeRunId : null;
  const ackRuns = new Set();
  const foreignRuns = new Set();
  let unattributedAssistantRows = 0;
  let returnMarkerRows = 0;
  let probeReplied = false;
  let probeAckRows = 0;
  let primingAckRows = 0;
  let uncreditedAckRows = 0;
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
    const acked = hasExactSentinelText(text, RRA_ACK_MARKER, nonce);
    if (priming.has(runId)) {
      if (acked) primingAckRows += 1;
    } else {
      if (runId !== probeRunId) foreignRuns.add(runId);
      if (acked) ackRuns.add(runId);
      if (rowHasOtherNonceAck(message, text, nonce)) uncreditedAckRows += 1;
    }
    if (probe && runId === probe && acked) probeAckRows += 1;
    if (hasExactSentinelText(text, RRA_RETURN_MARKER, nonce)) returnMarkerRows += 1;
    if (probe && runId === probe && probeNonce && hasExactSentinelText(text, RRA_PROBE_MARKER, probeNonce)) {
      probeReplied = true;
    }
  }
  // heartbeat_respond acks, per call. A call with no run id sits in an unattributed row (above).
  for (const call of heartbeatAckCalls(list, nonce)) {
    if (!call.runId) continue;
    if (priming.has(call.runId)) primingAckRows += 1;
    else if (!call.accepted) uncreditedAckRows += 1;
    else {
      // The call and its accepted result in one non-priming run.
      ackRuns.add(call.runId);
      if (probe && call.runId === probe) probeAckRows += 1;
    }
  }
  return {
    ackRuns: ackRuns.size,
    wakeAckRuns: [...ackRuns].filter((runId) => runId !== probeRunId).length,
    probeAckRows,
    primingAckRows,
    uncreditedAckRows,
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
      if (!result) return { status: null, toolCallId: part.id, errorText: null, mode: null, delaySeconds: null };
      const { parsed, text } = parseResultPayload(result);
      if (result.isError === true || !parsed) return { status: 'error', toolCallId: part.id, errorText: text, mode: null, delaySeconds: null };
      // The scheduled result reports what the tool accepted (continue-delegate-tool.ts:436-449), so the
      // delegate's real mode and delay are read here, not assumed from the instruction.
      return {
        status: typeof parsed.status === 'string' ? parsed.status : null,
        toolCallId: part.id,
        errorText: null,
        mode: typeof parsed.mode === 'string' ? parsed.mode : null,
        delaySeconds: typeof parsed.delaySeconds === 'number' ? parsed.delaySeconds : null,
      };
    }
  }
  return null;
}

/**
 * Whether a row counts toward a call count limited to `inRuns`: every row when no limit is given,
 * else a row of one of those runs, or one with no run id (it cannot be placed elsewhere).
 */
function inCountedRun(message, inRuns) {
  if (!Array.isArray(inRuns)) return true;
  const runId = messageRunId(message);
  return !runId || inRuns.includes(runId);
}

/**
 * Every continue_delegate call in a transcript, through Tool Search or not; with `inRuns`, only
 * those of the given runs (and rows with no run id).
 */
export function countDelegateCalls(messages, { inRuns } = {}) {
  let count = 0;
  for (const message of Array.isArray(messages) ? messages : []) {
    if (roleOf(message) !== 'assistant' || !Array.isArray(message.content) || !inCountedRun(message, inRuns)) continue;
    for (const part of message.content) if (toolCallTarget(part)?.name === 'continue_delegate') count += 1;
  }
  return count;
}

/**
 * The case's continue_work election in the electing session's transcript, paired with its
 * toolResult by toolCallId: the tool itself (through Tool Search's dispatch_action when deferred,
 * lib/tool-call-identity.mjs), its reason carrying this case's marker. Returns
 * { status, toolCallId, delaySeconds } or null; status null while no result is recorded, 'error'
 * for an error result. The `scheduled` result is written before the election is captured: the
 * tool only queues the request (continue-work-tool.ts:84-110, agent-runner-embedded-candidate.ts
 * :222-224), and the turn schedules it after the attempt (agent-runner-continuation-signal.ts:467 ->
 * work-dispatch.ts:662-668). So the capture is read from the store, never from this result.
 */
export function findWorkElection(messages, { reasonMarker }) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = 0; i < list.length; i += 1) {
    if (roleOf(list[i]) !== 'assistant' || !Array.isArray(list[i].content)) continue;
    for (const part of list[i].content) {
      const target = toolCallTarget(part);
      if (!target || target.name !== 'continue_work' || typeof part.id !== 'string') continue;
      if (!String(target.args?.reason ?? '').includes(reasonMarker)) continue;
      const result = toolResultFor(list, part.id, i + 1);
      if (!result) return { status: null, toolCallId: part.id, delaySeconds: null };
      const { parsed } = parseResultPayload(result);
      if (result.isError === true || !parsed) return { status: 'error', toolCallId: part.id, delaySeconds: null };
      return {
        status: typeof parsed.status === 'string' ? parsed.status : null,
        toolCallId: part.id,
        delaySeconds: typeof parsed.delaySeconds === 'number' ? parsed.delaySeconds : null,
      };
    }
  }
  return null;
}

/**
 * Every continue_work call in a transcript, through Tool Search or not; with `inRuns`, only those
 * of the given runs (and rows with no run id).
 */
export function countWorkCalls(messages, { inRuns } = {}) {
  let count = 0;
  for (const message of Array.isArray(messages) ? messages : []) {
    if (roleOf(message) !== 'assistant' || !Array.isArray(message.content) || !inCountedRun(message, inRuns)) continue;
    for (const part of message.content) if (toolCallTarget(part)?.name === 'continue_work') count += 1;
  }
  return count;
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
  const spec = rraCaseSpec(caseId);
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
 * - not this row's record, an unknown case, a candidate other than the pin (j12′), a gate not
 *   exactly true, a gateway the harness did not start and own throughout, or k6 evidence not bound
 *   to this run is MISSING, and nothing else about it is judged (it is not evidence about j12′);
 * - a contradiction of the case's claim is FAIL;
 * - an observation that is absent or not of its type is MISSING;
 * - a residual condition (config not restored, cleanup incomplete) is PARTIAL;
 * - otherwise PASS-candidate. A refusal case is PASS only with BOTH the product reason and the
 *   observed absence of ack (in the probe run or any later one), wake and final effect. A refused
 *   return's reason is its j12′ line naming the target, first at the case's pinned stage, naming a
 *   row exactly when that stage writes one; another stage, a j12-only line or two rows is MISSING.
 *   A `Delivered to` line for the return once its transition settled is FAIL; one while it was in
 *   flight is MISSING.
 * - allowed-silent, the control for that absence, is PASS only with exactly one ack of its nonce in
 *   the probe's own run, sent after the router's `Delivered to` line from its child, and none before
 *   (🌊's ruling (a), room msg 1567556038281007235). The ack is the model's, so a missing, doubled or
 *   other-nonce ack is MISSING; a wake turn is FAIL.
 * - Every probing case gets the same conditional probe (rraProbeText; 🌊, room msg
 *   1567590902694936678). Its reply is graded as one of two answers, never both required: a refusal
 *   needs `PROBE-OK <probeNonce>` and no ack; allowed-silent needs the ack, PROBE-OK or not. A probe
 *   that ran must be named by its text's hash (RRA_PROBE_TEXT_SHA256), else MISSING
 *   `probe-text-unbound`.
 * - A parked case (revoked-*, reassigned, replay-restart) holds only with the control's witness of the
 *   return's queued copy before it released the transition (record.witness, the router's `Delivered
 *   to` line from the case's child; 🌊's ruling, RRA_ORDERING_RULING), else MISSING
 *   `parked-copy-unwitnessed`. An enqueue refusal never satisfies it.
 * - allowed passes on one ack in its woken run (direct wake), or, only after a woken run with no ack,
 *   on exactly one ack in the conditional probe's own run, after the delivered return, with the
 *   receipt labelled probe-mediated (record.ack.path). No ack on either path is MISSING, never FAIL.
 */
export function gradeRecipientAuthorityCase(record) {
  return gradeCaseRecord(record, RRA_CASES);
}

/**
 * Grade a dry-run early-enqueue pin's record (RRA_EARLY_ENQUEUE_PINS) by its own spec: the wake-mode
 * rules, with the revoked case's transition and mode. A row case's record is not a pin (`unknown-case`).
 */
export function gradeEarlyEnqueuePin(record) {
  return gradeCaseRecord(record, RRA_EARLY_ENQUEUE_PINS);
}

function gradeCaseRecord(record, specs) {
  const missing = [];
  const contradictions = [];
  const partial = [];
  const result = (verdict) => ({ verdict, missing: [...new Set(missing)], contradictions: [...new Set(contradictions)], partial: [...new Set(partial)] });
  if (!record || typeof record !== 'object' || record.schema !== RRA_CASE_SCHEMA || record.row !== RRA_ROW) {
    missing.push('not-a-case-record');
    return result('MISSING-candidate');
  }
  const spec = typeof record.case === 'string' && Object.hasOwn(specs, record.case) ? specs[record.case] : null;
  if (!spec) {
    missing.push('unknown-case');
    return result('MISSING-candidate');
  }
  if (record.candidateSha !== RRA_PINNED) missing.push('candidate-not-pinned');
  const gates = record.gates ?? {};
  for (const key of RRA_GATE_KEYS) if (gates[key] !== true) missing.push(`gate:${key}`);
  if (gates.buildInfoCommit !== RRA_PINNED) missing.push('gate:buildInfoCommit');
  const generations = Array.isArray(record.gateway?.generations) ? record.gateway.generations : [];
  if (generations.length === 0 || !generations.every((g) => g?.startedByHarness === true && g?.ownedListenerThroughout === true)) {
    missing.push('gateway-not-harness-owned');
  }
  if (typeof record.runId !== 'string' || !record.runId || record.scenario?.controlRunId !== record.runId) {
    missing.push('scenario-not-bound-to-run');
  }
  if (record.scenario?.observeRunId !== undefined && record.scenario.observeRunId !== record.runId) missing.push('scenario-not-bound-to-run');
  if (record.scenario?.transitionRunId !== undefined && record.scenario.transitionRunId !== record.runId) missing.push('scenario-not-bound-to-run');
  if (missing.length) return result('MISSING-candidate');
  if (spec.tool === 'continue_work') return gradeWorkRefusalCase(record, spec);

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
    ['ackRuns', 'probeAckRows', 'primingAckRows', 'uncreditedAckRows', 'foreignRuns', 'unattributedAssistantRows', 'returnMarkerRows', 'adoptedDeliveryRows']
      .every((key) => isCount(target[key])) && isCount(parent.ackRows),
    'transcript-not-read',
  );
  if (counted && target.unattributedAssistantRows > 0) missing.push('unattributable-target-rows');
  need(target.primed === true, 'target-not-primed');
  // A case's claim is about its transition. If the transition RPC did not take effect, whatever the
  // return then did is not evidence either way: no contradiction is judged, the case is MISSING.
  let premise = !spec.transition || (transition.ok === true && isTime(transition.requestedAtMs));
  if (!premise) missing.push('transition-not-observed');
  // The scenario must have run its script as written: a refusal it recorded or a failed preflight
  // leaves nothing to judge.
  if (missing.includes('scenario-refused') || missing.includes('preflight-not-ok')) premise = false;
  // The model must have made exactly the call the case needs. Another continue_delegate call (a retry
  // after the policy error, another target) or an accepted call of another mode or too short a delay
  // tests something else, so it is MISSING, not a product failure.
  const otherCalls = dispatch.otherDelegateCalls;
  if (!isCount(otherCalls)) {
    missing.push('delegate-calls-unread');
    premise = false;
  } else if (otherCalls > 0) {
    missing.push('extra-delegate-calls');
    premise = false;
  }
  // At admission any acceptance, whatever its shape, is the product failing to refuse.
  if (spec.refusedAt !== 'admission' && dispatch.accepted === true && dispatch.resultMode !== spec.mode) {
    missing.push('delegate-shape-mismatch');
    premise = false;
  }
  if (spec.refusedAt === 'dispatch' && dispatch.accepted === true) {
    const fireAfter = Number(dispatch.resultDelaySeconds) * 1000;
    if (!(isTime(transition.requestedAtMs) && isTime(dispatch.capturedAtMs) && fireAfter > transition.requestedAtMs - dispatch.capturedAtMs)) {
      missing.push('policy-change-not-before-fire');
      premise = false;
    }
  }
  // A wake-mode case revokes the target while the delegate waits to fire: the transition must have
  // settled before the fire, and the return must not have been routed before it, or the return was
  // current when the router read its authority and adopting it would be correct.
  if (spec.timing === 'before-return' && dispatch.accepted === true) {
    const fireAfter = Number(dispatch.resultDelaySeconds) * 1000;
    if (!(isTime(transition.settledAtMs) && isTime(dispatch.capturedAtMs) && fireAfter > transition.settledAtMs - dispatch.capturedAtMs)) {
      missing.push('transition-not-before-fire');
      premise = false;
    }
    const routedAt = record.park?.deliveredToTargetAtMs;
    if (isTime(routedAt) && isTime(transition.requestedAtMs) && routedAt < transition.requestedAtMs) {
      missing.push('return-routed-before-transition');
      premise = false;
    }
  }
  if (spec.family === 'refusal' && spec.expectChild !== false) {
    // A parked case is about a return routed before its transition was requested. One routed later
    // was read while current or while the transition was in flight, so its adoption proves nothing.
    if (spec.timing === 'parked') {
      const park = record.park?.deliveredToTargetAtMs;
      if (!(isTime(park) && isTime(transition.requestedAtMs) && park < transition.requestedAtMs)) {
        missing.push('return-not-parked-before-transition');
        premise = false;
      }
      // 🌊's ruling (RRA_ORDERING_RULING): witness the parked copy first, then change. The control
      // released the transition only once it had seen the router's `Delivered to` line for this target
      // from this case's child (RRA_PARKED_COPY_WITNESS_BYTES), the same line the grade reads as the
      // park; the transition was requested after that release. Without it the case shows another
      // ordering or none (a transition before the enqueue is refused at enqueue): MISSING. The witness
      // only adds MISSING. The ordering premise stays the park before the transition request (above),
      // so wherever that holds a contradiction is still FAIL, as before the witness.
      const witness = record.witness ?? {};
      if (!(isTime(witness.parkedCopyAtMs) && witness.parkedCopyAtMs === record.park?.deliveredFromChildAtMs &&
        isTime(witness.releasedAtMs) && witness.parkedCopyAtMs <= witness.releasedAtMs &&
        isTime(transition.requestedAtMs) && witness.releasedAtMs <= transition.requestedAtMs)) {
        missing.push('parked-copy-unwitnessed');
      }
    }
    // A router line while the transition RPC was in flight may have read the epoch before it
    // committed: neither a refusal nor a contradiction.
    const routedDuring = record.routing?.duringTransition;
    if (!isCount(routedDuring)) {
      missing.push('routing-unread');
      premise = false;
    } else if (routedDuring > 0) {
      missing.push('return-routed-during-transition');
      premise = false;
    }
  }
  // A revoked or reassigned return must still be parked un-adopted when the transition lands.
  if (spec.family === 'refusal' && spec.expectChild !== false) {
    const before = record.preTransition ?? {};
    if (!['ackRuns', 'foreignRuns', 'adoptedDeliveryRows'].every((key) => isCount(before[key]))) {
      missing.push('pre-transition-unread');
      premise = false;
    } else if (before.ackRuns + before.foreignRuns + before.adoptedDeliveryRows > 0) {
      missing.push('return-not-parked-unadopted');
      premise = false;
    }
  }
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
    const adopted = counted && (target.ackRuns > 0 || target.adoptedDeliveryRows > 0);
    if (isHash(epochs.captured)) {
      if (!isHash(epochs.final)) missing.push('final-epoch-unread');
      else if (epochs.final !== epochs.captured) {
        if (adopted) contradict('adopted-after-epoch-advance');
        else missing.push('epoch-advanced-premise-broken');
      }
    }
    // allowed's probe-mediated fallback (🌊's ruling, RRA_ORDERING_RULING): the conditional probe ran
    // after its woken run had no ack. Its ack is the probe run's, never the wake turn's, so the direct
    // path's rules do not read it.
    const fallback = spec.fallbackProbe === true && (target.probeRan === true || record.ack?.path === 'probe-mediated');
    if (counted) {
      if (parent.ackRows > 0) contradict('return-landed-in-parent');
      // Only allowed's fallback probe, once it ran, puts an ack in a run that is not a wake turn and
      // is graded apart; a label alone never does, and every other case keeps this rule.
      if (!(spec.fallbackProbe === true && target.probeRan === true) && target.ackRuns > 1) contradict('duplicate-adoption');
      if (target.foreignRuns > 1) contradict('duplicate-wake');
      if (!spec.probeAdopts && target.ackRuns === 0 && routed && target.unattributedAssistantRows === 0) {
        // Routed and never woken is the product's, probe or no probe; woken without the exact ack may be
        // the model's, which the fallback reads instead.
        if (target.foreignRuns === 0) contradict('allowed-return-not-adopted');
        else if (!fallback) missing.push('woken-without-ack');
      }
      if (target.adoptedDeliveryRows > 1) contradict('duplicate-adoption');
    }
    if (spec.fallbackProbe) {
      const ack = record.ack ?? {};
      if (!fallback) {
        // The direct-wake path, its oracle unchanged: one ack in the woken run. The receipt says so.
        need(ack.path === 'direct-wake', 'direct-wake-label-missing');
      } else {
        // The receipt claims no ack in the wake turn: it is labelled probe-mediated, and its probe ran.
        need(ack.path === 'probe-mediated', 'probe-mediated-label-missing');
        need(target.probeRan === true, 'probe-turn-unobserved');
        // Sent only when the woken run had no ack: the scenario's read before the probe shows a woken
        // run and no ack, and the final read still shows that run.
        const decision = ack.fallbackDecision ?? {};
        need(
          isTime(decision.decidedAtMs) && isCount(decision.wokenRuns) && decision.wokenRuns >= 1 && decision.ackRuns === 0 &&
            isTime(target.probeSentAtMs) && decision.decidedAtMs <= target.probeSentAtMs && !(counted && target.foreignRuns === 0),
          'fallback-not-after-unacked-wake',
        );
        // The same conditional probe every probing case sends, named by its hash.
        need(target.probeTextSha256 === RRA_PROBE_TEXT_SHA256, 'probe-text-unbound');
        // After the delivered return: the router's line naming the target from this case's child.
        const deliveredAt = record.park?.deliveredFromChildAtMs;
        if (need(isTime(deliveredAt), 'return-not-routed-from-child')) {
          need(isTime(target.probeSentAtMs) && target.probeSentAtMs > deliveredAt, 'probe-not-after-return');
        }
        if (counted && need(isCount(target.wakeAckRuns), 'transcript-not-read')) {
          // Exactly one ack of the nonce in the probe's own run. The ack is the model's: none, two, or
          // one it cannot credit is MISSING, never FAIL.
          if (target.probeAckRows === 0) missing.push('probe-ack-unobserved');
          if (target.probeAckRows > 1) missing.push('probe-ack-duplicated');
          if (target.uncreditedAckRows > 0) missing.push('ack-uncredited');
          if (target.primingAckRows > 0) missing.push('ack-before-return');
          // An ack in a wake turn means the fallback was not the woken run's only ack: the probe was
          // not allowed, and an ack in both is a duplicate. The priming asks for the ack on any later
          // turn that holds the completion, so a model may give both for one adoption: MISSING.
          if (target.wakeAckRuns > 0) missing.push('fallback-after-wake-ack');
          if (target.wakeAckRuns > 0 && target.probeAckRows > 0) missing.push('duplicate-ack-wake-and-fallback');
          // Two wake turns that each acked are two adoptions, as on the direct path.
          if (target.wakeAckRuns > 1) contradict('duplicate-adoption');
        }
      }
    }
    if (spec.probeAdopts) {
      // 🌊's ruling (a), room msg 1567556038281007235: the probe turn's adoption is read from the
      // primed target's TARGET-ACK in the probe's own run. The product's marker is not evidence: no
      // pin writes it on a sessions.send turn's row (observeTargetTranscript, adoptedDeliveryRows).
      // The probe's PROBE-OK is never required here: the conditional probe (rraProbeText, room msgs
      // 1567590902694936678 and 1567656724549075047) tells a target whose context holds the return,
      // here drained by the probe turn itself, to follow its priming instead.
      need(child.spawned === true, 'child-spawn-unobserved');
      need(target.probeRan === true, 'probe-turn-unobserved');
      if (target.probeRan === true) need(target.probeTextSha256 === RRA_PROBE_TEXT_SHA256, 'probe-text-unbound');
      // The return reached the target at the router's `Delivered to` line naming it and coming from
      // this case's child (subagent-announce.continuation-return.ts:199-203). The router logs it only
      // for a recipient whose event is queued in memory, carrying the row's ack id, and still current
      // (targeting.ts:313-341, 356-375, 409). A silent return wakes no one (:395-403), so the target's
      // next turn drains it and its model sees it (continuation-wake.test.ts:878-920, at :911). A probe
      // sent before that line started a turn that could not drain it, so its ack proves nothing.
      const deliveredAt = record.park?.deliveredFromChildAtMs;
      if (need(isTime(deliveredAt), 'return-not-routed-from-child')) {
        need(isTime(target.probeSentAtMs) && target.probeSentAtMs > deliveredAt, 'probe-not-after-return');
      }
      if (counted) {
        // Exactly one ack of this case's nonce, in the probe run. The ack is the model's: a model that
        // does not give it, gives it twice in one turn or gives another nonce is MISSING, never FAIL.
        if (target.probeAckRows === 0) missing.push('probe-ack-unobserved');
        if (target.probeAckRows > 1) missing.push('probe-ack-duplicated');
        if (target.uncreditedAckRows > 0) missing.push('ack-uncredited');
        // An ack before any return existed: the model acks unprompted, and its probe ack proves nothing.
        if (target.primingAckRows > 0) missing.push('ack-before-return');
        // The silent return must not have woken the target: any run but priming and the probe's is FAIL,
        // an ack there included (and an ack in two runs is duplicate-adoption, above).
        if (target.foreignRuns > 0) contradict('silent-return-woke-target');
      }
    }
  } else {
    if (spec.refusedAt === 'admission') {
      need(dispatch.accepted === false && dispatch.status === 'error', 'admission-not-refused');
      if (dispatch.accepted === true) contradict('unauthorized-dispatch-accepted');
    } else {
      need(dispatch.accepted === true && dispatch.status === 'scheduled' && isTime(dispatch.capturedAtMs), 'dispatch-not-accepted');
    }
    if (spec.refusedAt === 'dispatch' && isTime(transition.requestedAtMs) && isTime(dispatch.capturedAtMs)) {
      need(transition.requestedAtMs > dispatch.capturedAtMs, 'policy-not-changed-after-capture');
    }
    if (spec.expectChild === false) {
      if (child.spawned === true) contradict('refused-delegate-spawned');
      else need(child.spawned === false, 'child-spawn-unobserved');
    } else {
      need(child.bound === true && child.done === true, 'child-not-bound');
      // j12′ logs `Delivered to` only for recipients it delivered, and nothing when every recipient
      // was refused: once the transition has settled, this return may leave no router line naming
      // the target or coming from its child, j12's empty-list line included.
      const routedAfter = record.routing?.afterTransition;
      if (need(isCount(routedAfter), 'routing-unread') && routedAfter > 0) contradict('refused-return-routed');
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
    const reasonAfter = spec.refusedAt === 'admission' ? 0 : transition.requestedAtMs;
    const reasonSeen = need(
      reason !== null && reason.kind === spec.reasonKind && (spec.refusedAt === 'admission' || (isTime(reason.observedAtMs) && reason.observedAtMs > reasonAfter)),
      'refusal-reason-not-observed',
    );
    if (reasonSeen && spec.reasonKind === 'return-refused') {
      // j12′ has one reason (return-refusal.ts:16); every line for this return must carry it.
      const texts = Array.isArray(reason.reasonTexts) ? reason.reasonTexts : [];
      need(texts.length > 0 && texts.every((text) => text === RRA_REFUSAL_REASON), 'refusal-reason-mismatch');
      // One stage per ordering, from the j12′ bytes (RRA_CASES, refusedAtBytes and otherFirstStages):
      // the first line carries the pinned stage, or another first stage the bytes name for the case,
      // and a later line only a stage the bytes name for the same row after that first one.
      const stages = Array.isArray(reason.stages) ? reason.stages : [];
      const ordering = reason.stage === spec.refusedAt
        ? { laterStages: spec.laterStages ?? [] }
        : (Object.hasOwn(spec.otherFirstStages ?? {}, reason.stage) ? spec.otherFirstStages[reason.stage] : null);
      const allowed = new Set([reason.stage, ...(ordering?.laterStages ?? [])]);
      need(ordering !== null && stages.length > 0 && stages.every((stage) => allowed.has(stage)), 'refusal-stage-mismatch');
      // A boundary that retires a written row names it; the router's first read refuses before any row.
      need(isHash(reason.deliveryIdHash) === spec.deliveryId, 'refusal-delivery-id-mismatch');
      // The disposable target receives only this case's return: exactly its one row, on every line,
      // or none at all where the stage writes none.
      need(
        isCount(reason.distinctDeliveryIds) && reason.distinctDeliveryIds === (spec.deliveryId ? 1 : 0) &&
          (!spec.deliveryId || reason.linesWithoutDeliveryId === 0),
        'reason-delivery-id-ambiguous',
      );
      // A prompt-drain refusal, pinned or the case's other ordering, comes from the probe turn's drain.
      if (spec.refusedAt === 'prompt-drain' || reason.stage === 'prompt-drain') {
        need(isTime(target.probeSentAtMs) && reason.observedAtMs > target.probeSentAtMs, 'reason-not-from-probe-drain');
      }
      // The other ordering holds only if the product line that makes it possible was seen: a sweep
      // that armed the parked row while the delete was in flight (record.sweep, from the control).
      if (ordering?.sweepArmedInTransition === true) {
        const armed = record.sweep?.armedInTransition;
        need(isCount(armed) && armed > 0, 'no-sweep-armed-in-transition');
      }
    }
    // With no return in its context, the conditional probe is answered `PROBE-OK <probeNonce>`: that
    // answer, from the probe's own run, shows the turn whose drain the absence is read after. The
    // receipt must name that probe: under another (the unconditional one) the absence of an ack was
    // never shown able to fail. Unbound, a case is never PASS; a contradiction is still FAIL.
    need(target.probeRan === true && target.probeReplied === true, 'probe-turn-unobserved');
    if (target.probeRan === true) need(target.probeTextSha256 === RRA_PROBE_TEXT_SHA256, 'probe-text-unbound');
    if (counted) {
      // The absence: no ack of this case's nonce in the probe run (probeAckRows) or any later run
      // (ackRuns). The primed target acks a return that reaches its turn, as allowed-silent shows on
      // the same probe; a refused return never reaches it. The product's marker is never written for
      // a sessions.send probe, so its count stays a contradiction check, never the absence's evidence.
      if (target.ackRuns > 0 || target.probeAckRows > 0 || target.adoptedDeliveryRows > 0) contradict('refused-return-adopted');
      // An ack-shaped reply with another nonce leaves that absence unread.
      if (target.uncreditedAckRows > 0) missing.push('ack-uncredited');
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
 * Grade the continue_work case (RRA_CASES[*].tool), once its record passed the row's gates. The
 * session elects its own kept wake, so:
 * - the electing run is the one run the transcript observation excludes (it may quote its own
 *   reason); any other assistant run but the probe's is a wake turn;
 * - there is no parent, child, router line or trace: the wake never fires;
 * - the capture comes after the `scheduled` toolResult (findWorkElection), so it is read from the
 *   store. During a case only the capture and the case's own transition write this session's
 *   authority row (session-accessor.sqlite-recipient-authority.ts:17-37 and its callers; the legacy
 *   import and doctor's repair insert rows only outside a run), so the first sample holding the row
 *   is the capture, and the last sample without it bounds the capture from below;
 * - the wake is due no earlier than the election plus its delay (work-dispatch.ts:667-668; an
 *   anchored wake's anchor is a later dispatcher pass, and an overdue one matures at that pass,
 *   work-store.ts:335-345), so a transition that settled before that bound preceded the handoff;
 * - the reason is j12′'s `[continuation:work-refused]` line for this session at stage=wake, naming
 *   one election. The handoff fails the record before it reports (work-recipient-authority.ts
 *   :133-141), and a failed record is never driven again (work-store.ts:226, 260), so a line logged
 *   before the probe was sent leaves the probe turn nothing to adopt.
 * A deviation by the model or the setup is MISSING; a wake turn once the premise holds is FAIL.
 */
function gradeWorkRefusalCase(record, spec) {
  const missing = [];
  const contradictions = [];
  const partial = [];
  const result = (verdict) => ({ verdict, missing: [...new Set(missing)], contradictions: [...new Set(contradictions)], partial: [...new Set(partial)] });
  const need = (ok, code) => {
    if (!ok) missing.push(code);
    return ok;
  };
  // A premise that does not hold leaves the case unjudged: no contradiction is recorded.
  let premise = true;
  const unless = (ok, code) => {
    if (!ok) {
      missing.push(code);
      premise = false;
    }
    return ok;
  };
  const dispatch = record.dispatch ?? {};
  const target = record.target ?? {};
  const transition = record.transition ?? {};
  const epochs = record.epochs ?? {};
  const reason = record.reason ?? null;
  const before = record.preTransition ?? {};

  unless(Array.isArray(record.scenario?.refusals) && record.scenario.refusals.length === 0, 'scenario-refused');
  unless(record.scenario?.preflightOk === true, 'preflight-not-ok');
  const counted = need(
    ['ackRuns', 'foreignRuns', 'unattributedAssistantRows', 'returnMarkerRows', 'adoptedDeliveryRows'].every((key) => isCount(target[key])),
    'transcript-not-read',
  );
  if (counted && target.unattributedAssistantRows > 0) missing.push('unattributable-target-rows');
  // The electing run plays the priming run's part: without its id, the model's own echo of the
  // reason could not be told from a wake turn.
  need(target.primed === true, 'electing-run-unrecorded');
  unless(transition.ok === true && isTime(transition.requestedAtMs) && isTime(transition.settledAtMs), 'transition-not-observed');
  // Exactly the one election: another continue_work, or a continue_delegate, tests something else.
  for (const [key, code] of [['otherWorkCalls', 'extra-work-calls'], ['otherDelegateCalls', 'extra-delegate-calls']]) {
    if (unless(isCount(dispatch[key]), 'delegate-calls-unread')) unless(dispatch[key] === 0, code);
  }
  need(dispatch.accepted === true && dispatch.status === 'scheduled' && isTime(dispatch.capturedAtMs), 'election-not-accepted');
  const captureSeen = unless(
    isTime(epochs.capturedAfterMs) && isTime(epochs.capturedByMs) && epochs.capturedAfterMs < epochs.capturedByMs && isHash(epochs.captured),
    'capture-unobserved',
  );
  if (captureSeen) unless(isTime(transition.requestedAtMs) && epochs.capturedByMs < transition.requestedAtMs, 'capture-not-before-transition');
  // The reported delay is rounded to whole seconds (continue-work-tool.ts:99-100): one is held back.
  const earliestWakeMs = isTime(epochs.capturedAfterMs) && Number.isFinite(dispatch.resultDelaySeconds)
    ? epochs.capturedAfterMs + (dispatch.resultDelaySeconds - 1) * 1000
    : NaN;
  unless(isTime(transition.settledAtMs) && transition.settledAtMs < earliestWakeMs, 'transition-not-before-wake');
  if (unless(isHash(epochs.captured) && isHash(epochs.afterTransition), 'epochs-unread')) {
    unless(epochs.afterTransition !== epochs.captured, 'transition-did-not-advance-epoch');
  }
  if (unless(['ackRuns', 'foreignRuns', 'adoptedDeliveryRows'].every((key) => isCount(before[key])), 'pre-transition-unread')) {
    unless(before.ackRuns + before.foreignRuns + before.adoptedDeliveryRows === 0, 'wake-ran-before-transition');
  }
  const contradict = (code) => {
    if (premise) contradictions.push(code);
  };

  const reasonSeen = need(
    reason !== null && reason.kind === spec.reasonKind && isTime(reason.observedAtMs) &&
      isTime(transition.requestedAtMs) && reason.observedAtMs > transition.requestedAtMs,
    'refusal-reason-not-observed',
  );
  if (reasonSeen) {
    // A bound election is refused for one reason; `recipient-authority-unverifiable` is an unbound one's.
    const texts = Array.isArray(reason.reasonTexts) ? reason.reasonTexts : [];
    need(texts.length > 0 && texts.every((text) => text === RRA_REFUSAL_REASON), 'refusal-reason-mismatch');
    // Refused at the handoff, the record is failed: no later boundary sees it, so every line is that one.
    const stages = Array.isArray(reason.stages) ? reason.stages : [];
    need(reason.stage === spec.refusedAt && stages.length > 0 && stages.every((stage) => stage === spec.refusedAt), 'refusal-stage-mismatch');
    need(isHash(reason.flowIdHash) && reason.distinctFlowIds === 1, 'reason-flow-id-ambiguous');
    need(isTime(target.probeSentAtMs) && reason.observedAtMs < target.probeSentAtMs, 'reason-not-before-probe');
  }
  need(target.probeRan === true && target.probeReplied === true, 'probe-turn-unobserved');
  if (target.probeRan === true) need(target.probeTextSha256 === RRA_PROBE_TEXT_SHA256, 'probe-text-unbound');
  if (counted) {
    if (target.foreignRuns > 0) contradict('target-woken');
    if (target.adoptedDeliveryRows > 0) contradict('refused-work-adopted');
  }
  if (record.cleanup?.gatewayStopped !== true || record.cleanup?.residue !== false) partial.push('cleanup-incomplete');
  if (contradictions.length) return result('FAIL-candidate');
  if (missing.length) return result('MISSING-candidate');
  if (partial.length) return result('PARTIAL-candidate');
  return result('PASS-candidate');
}

/**
 * Whether a collect-continuation-trace.mjs receipt (continuation-trace-correlation.json) belongs to
 * this case: the continuation schema, this row, the reason fingerprint the case dispatched, and the
 * delegate mode it dispatched (the collector records the mode it matched the trace by).
 */
export function traceCorrelationMatches(record, correlation) {
  const dispatch = record?.dispatch ?? {};
  return Boolean(
    correlation && typeof correlation === 'object' &&
      correlation.schema === 'openclaw.k6.continuation-trace-correlation.v1' &&
      correlation.row === RRA_ROW &&
      typeof dispatch.delegateMode === 'string' && correlation.delegate?.mode === dispatch.delegateMode &&
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
 *   MISSING, as it must stay until an owner runs it at j12′);
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
    const records = verified.filter((record) => record?.case === caseId);
    const graded = records.map((record) => gradeRecipientAuthorityCase(record));
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
    // Which path credited allowed's ack: the row's summary says probe-mediated where it was.
    if (RRA_CASES[caseId].fallbackProbe) cases[caseId].ackPaths = [...new Set(records.map((record) => record.ack?.path ?? null))];
    if (caseVerdict !== 'PASS-candidate') lower(caseVerdict, `${caseId}:${caseVerdict}`);
  }
  return { schema: RRA_ROW_VERDICT_SCHEMA, row: RRA_ROW, candidateSha: RRA_PINNED, pinStatus: RRA_PIN_STATUS, verdict, cases, notes };
}

/* ------------------------------------------------------------------------------------ */
/* Gates (pure)                                                                          */
/* ------------------------------------------------------------------------------------ */

/**
 * The model sign-in gate over `openclaw models status --json` run against the isolated state
 * (src/commands/models/list.status-command.ts:1081-1122 at j12′): the auth store must live under the
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
  // With reload off, config.patch persists the policy without applying it and still answers ok
  // (src/gateway/server-methods/config-write-flow.ts:214-226), so an unauthorized case would test a
  // policy that never took effect.
  if (config?.gateway?.reload?.mode === 'off') {
    refusals.push({ code: 'config-reload-off', detail: 'gateway.reload.mode is "off"; config.patch would not apply the policy' });
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
