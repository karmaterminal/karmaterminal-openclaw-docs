# R-CD-RECIPIENT-AUTHORITY: live recipient-authority row at j12′

Status: **catalogued, every case MISSING, never fired, in no corpus.** Bound issue:
karmaterminal/karmaterminal-openclaw-docs#536. Pinned product: j12′, karmaterminal/openclaw
`e9dc1c318a2f73fd01755fc4682fa3349e8a0e94`, **INTERIM**.

**The interim pin.** j12′ is not cut yet. It will merge this refused chain (`e9dc1c31`),
`keeps-queued-2` and the `continue_work` authority binding. This row is gate 3 and runs only after
the merged head is reviewed (🌊, room msg 1567194866507841678). The refusal strings, stages and
failed receipt this row reads are final at `e9dc1c31`, and the later lanes don't touch them. The cites
on the reset path and on `continue_work` change in those lanes and are re-walked at the merged head
([listed below](#cites-re-walked-at-the-merged-j12)). The named baseline is j12,
`352f56029dc95c60149ab4aaa127226a861d0b3d`: the row was first written to it, and j12's receipts
stay j12's. No case is carried from j12.

Rulings:

- 🌊, room msg 1567077062139838485 (2026-11-03): a live, isolated-gateway row, separate from his
  supervised-restart row. Keep every case MISSING until an owner runs it. Use the public RPCs the
  product actually has, and observe both the refusal reason and the absence of target adoption,
  ack and final effect, including replay. The old fixture matrix is history, not proof.
- 🌊, room msg 1567104742604406896: fix before presenting. j12′ gives a reason at enqueue, at
  replay or wake, and at prompt drain, and logs no `Delivered to` for an empty recipient set. A
  silent park or the sweep is not wake proof.
- The workorder also names 🌊's room msg 1567147669971796039 (b3).

- [What it proves, and what it does not](#what-it-proves-and-what-it-does-not)
- [Its own row](#its-own-row)
- [The product path at j12′](#the-product-path-at-j12)
- [The cases](#the-cases)
- [Cites re-walked at the merged j12′](#cites-re-walked-at-the-merged-j12)
- [What ClawSweeper asked for, case by case](#what-clawsweeper-asked-for-case-by-case)
- [Verdict rules](#verdict-rules)
- [Operator procedure](#operator-procedure)
- [Files](#files)

## What it proves, and what it does not

On one disposable gateway at j12′, started by the row's own control, a delegate return targeted at
another session (`continue_delegate` with `targetSessionKey`, from a real model turn, the R-CD-4
shape) is:

- adopted and acknowledged exactly once by its target while the target's authority is unchanged,
  including across `sessions.reset`;
- refused with the cross-session policy's reason, and with no child, adoption, ack, wake or final
  effect, when the policy is disabled at admission or at dispatch;
- refused when its authority is revoked (visibility narrowed, member removed, owner changed) or its
  key is reassigned (deleted and recreated) between dispatch and return. The refusal carries
  j12′'s own reason,
  `[continuation:return-refused] stage=<stage> reason=recipient-authority-changed session=<target>`,
  with ` deliveryId=<id>` wherever the stage retires a written row, at each case's pinned stage:
  - **enqueue**, for a wake-mode (`silent-wake`) return revoked or reassigned before it fires;
  - **prompt drain**, for a parked silent return revoked while its queued copy is still in memory;
  - **replay**, for a parked return whose copy is gone (reassigned), and on the replacement
    generation after a supervised restart (`replay-restart`).

  In each refusal there is no adoption marker, ack, wake turn, return marker or parent landing, and
  no `Delivered to` line for the return once its transition has settled. A wake-mode return refused
  at enqueue leaves no `Delivered to` line at all.

It does not prove:

- **A refusal at the wake handoff (`stage=wake`).** j12′ emits one
  (`continuation-wake.ts:233-243` -> `session-system-event-adoption.ts:118-147`), but only for an
  epoch that advances inside the 250 ms between the enqueue's last authority read
  (`targeting.ts:358-374`) and the handoff's read (`continuation-wake.ts:41, 106, 163-171`). A public
  RPC cannot be landed inside that window on purpose. The wake-mode cases revoke while the delegate
  waits to fire, so the router refuses them first, at enqueue. A case that raced the window would
  sometimes be refused at enqueue and sometimes adopted while still current, and could pin no stage.
- **An enqueue refusal that names a row.** Same reason: `targeting.ts:343-347` and `:369-374`
  refuse a row only when the epoch advances between the router's reads, a window of the same kind.
  The wake-mode cases pin the first read (`:277-280`), which refuses before any row.
- **"Settled as refused" from the record.** j12′ retires a refused row as a bounded `failed`
  receipt, never `recovered` (`return-refusal.ts:36-49`; the sweep's settlement,
  `session-delivery-queue-recovery.ts:161-180, 208-213`). But no public surface reads that receipt:
  the gateway health's failed count leaves it out on purpose (`delivery-queue-sqlite.kernel.ts:397-429`,
  the filter at `:413-420`, surfaced by `gateway/health/collector.ts:640-654`), and the receipt
  lookup has internal callers only. The row never reads SQLite for it. Refusal is read from the
  reason line and the absence of adoption.
- **The delivery id's derivation.** The id is `sha256` of
  `continuation-return:v1:<child>:<childRunId>:<target>`
  (`announce-idempotency.ts:11-16`, `subagent-announce.continuation-return.ts:174`,
  `targeting.ts:291`, `session-delivery-queue-storage.ts:274-279`). The child run id the announce
  uses is not on a surface the row can read with certainty, so the row does not recompute it. It
  binds the line's id to the case another way: the line names the case's own disposable target,
  which only this case's return ever reaches, and every line for that target names the same row.
  The receipt publishes the id as SHA-256 only.
- **A per-target addressability check.** j12′ has none, as j12 had none: the binding is captured
  for any key, existing session or not (`session-recipient-authority.worker.ts:35-50`).
  "Unauthorized" here is the `crossSessionTargeting` policy, the only admission refusal j12′ has.
- **Refusal telemetry.** j12′ counts a refusal on `continuation.queue.drain` (`queue.refused_count`,
  `refusal.reason`) and on `continuation.queue.fanout` (`fanout.refused_count`, `refusal.reason`;
  only for a fanout mode or several recipients, `targeting.ts:413-427`), with no session identity
  (`continuation-tracer.ts:178-204`). The control collects no spans, so the row claims none.
- **The supervised-restart claim.** That is `R-CD-RETURN-COVENANT-AUTHORITY`'s. `replay-restart`
  uses the same supervised branch to replay a parked return; it never reads or feeds that row.
- **Multi-recipient fanout, cross-agent recipients, the bracket-token form, explicit revocation.**
  `tree`/`all` fanout and recipients of another agent are outside the cases. The token form is not
  driven (R-CD-TOKEN covers targeted bracket returns). j12′ has no explicit revocation API.
- **Fresh install or upgrade.** Proposed separately (docs#619, `R-CD-FRESH-INSTALL`).
- **Anything until an owner runs it.** No case here has run.
- **Listener ownership between samples.** The control checks it every 500 ms and at every case
  boundary, not continuously. It stops its gateway's whole process group on success, on error and
  on SIGINT, SIGTERM or SIGHUP, and kills it on any other exit.

## Its own row

- `R-CD-RETURN-COVENANT-AUTHORITY` (docs#615) is 🌊's supervised disposable real-restart control: the
  epoch survives a real restart. It delivers no return.
- `R-CD-RECIPIENT-AUTHORITY-MATRIX` (docs#549) is the process-local fixture matrix, capped at
  `PARTIAL-candidate`. Its product seam was cut to fork-only before j12, so it cannot run there or
  at j12′. It is history.
- This row is a live gateway invocation at j12′. It reads none of their receipts and feeds neither
  verdict, and neither feeds this one.

## The product path at j12′

Byte-read with `git show` / `git grep` at `e9dc1c318a2f`, with the j12 bytes as the baseline. The
files in the first table did not change from j12 to j12′, and each cite was re-read at j12′. The
second table is j12′'s own. The scenario header (`scenarios/r-cd-recipient-authority.js`) carries the
same map.

### What changes a recipient's authority

Authority is one UUID epoch per logical session key in `session_recipient_authority` (per-agent
database). A captured binding is current only while the stored epoch equals it
(`src/config/sessions/session-recipient-authority-types.ts:87-92`).

| Public RPC | Effect on the target's epoch | Path at j12′ |
|---|---|---|
| `continue_delegate` (model turn), capture | insert-if-absent for any key, before the `scheduled` toolResult | `continue-delegate-tool.ts:424-449`, `delegate-flow-store.ts:426-437`, `session-recipient-authority.worker.ts:35-50` |
| `sessions.delete` | advances (every deletion owner); the epoch row outlives the session, so `sessions.create` of the same key keeps the advanced epoch. It also consumes the session's queued events | `session-accessor.sqlite-entry-store.ts:56-69`, `server-methods/sessions-delete.ts:589`; queued events: `sessions-delete.ts:454-470` -> `session-lifecycle-cleanup.ts:74-92` -> `session-reset-runtime-cleanup.ts:77-93` -> `session-reset-runtime-state.ts:11-51` -> `session-reset-cleanup.ts:146-196` (consumed at `:194-196`) |
| `session.visibility.set` (narrowing) | advances, for every writer; rank shared > suggest > read-only > draft | `session-accessor.sqlite-entry-mutation.ts:119-136`, `sessions-sharing.ts:527-610`, `session-recipient-authority-types.ts:66-99` |
| `session.members.remove` | advances | `session-sharing-store.native.ts:150-195`, `sessions-sharing.ts:337-423, 616` |
| `sessions.assignOwner` (owner changes) | advances. It refuses a caller that is neither an agent runtime nor a human profile, so only the agent's `sessions` tool `assign_owner` can drive it here | `session-accessor.sqlite-owner.ts:158-182`, `sessions-mutations.ts:343-470` (`:362-374`), `agents/tools/sessions-tool.ts:384-419` |
| `sessions.reset` | **none**: rotates the session in place; only an incognito reset deletes | `sessions-mutations.ts:593-678`, `gateway/session-reset-service.ts:651-737, 751, 1032-1043` |
| `config.patch` `agents.defaults.continuation.crossSessionTargeting` | none; it is the admission policy, default disabled, read at each decision, reloaded hot | `continuation/config.ts:84-92, 128-129`, `server-methods/config.ts:798-850`, `config-reload.prepared-model-runtime.test.ts:74-96` |

Sharing mutations need the session owner or `operator.admin` (`sessions-sharing-authority.ts:144-156`).
A loopback backend client with the shared token keeps the scopes it asks for
(`ws-connection/connect-auth.ts:286-296`, `handshake-auth-helpers.ts:165-187`).
`session.members.add` accepts only a known identity (`sessions-sharing.ts:347-361`).

### Where a targeted return is bound, checked, enqueued, woken and adopted, and what a refusal leaves

Every refusal of a return goes through one reporter
(`src/auto-reply/continuation/return-refusal.ts:15-29`, subsystem `continuation/return-refused`).
It logs `[continuation:return-refused] stage=<stage> reason=recipient-authority-changed
session=<key>[ deliveryId=<id>]`. On the console that line follows the
`[continuation/return-refused]` tag (`src/logging/subsystem.ts:158-194`), and the structured file log
keeps `stage`, `reason`, `sessionKey` and `deliveryId` as fields beside the message
(`return-refusal.ts:26-28`; `subsystem.ts:317-330`). A written row is retired as a bounded `failed`
receipt (`return-refusal.ts:36-49`).

| Boundary | Path at j12′ | On a stale or unauthorized return | Observable reason |
|---|---|---|---|
| Admission (tool) | `continue-delegate-tool.ts:353-362` | ToolInputError, nothing accepted | the toolResult text: "cross-session continuation targeting is disabled ..." |
| Dispatch | `continuation/delegate-dispatch.ts:267-290` | custody failed, owner notice, no child | log `[continuation:delegate-rejected] policy.cross_session_targeting ... session=<dispatcher>`; `continuation.disabled` span with `disabledReason` |
| Routing | `subagent-announce.continuation-return.ts:98-215` | delivers to the current recipients only; wakes them unless the mode is silent (`:175`) | `[continuation:targeted-return] Delivered to <keys> from <child>` names only delivered recipients, and is **not logged at all** when every recipient was refused (`:189-203`) |
| Enqueue, before the row | `continuation/targeting.ts:277-280` (reporter `:261-276`) | refused, no row, no wake | `stage=enqueue`, **no** `deliveryId` |
| Enqueue, after the row | `targeting.ts:313-347`, `358-374` (refused at `:343-347`, `:369-374`) | row retired as a `failed` receipt, queued event removed | `stage=enqueue deliveryId=<row>` |
| Wake handoff | `continuation-wake.ts:127-256`; 250 ms after the request (`:41`, `:106`); authority read `:163-171` | `settleStaleSystemEventAuthority` retires it (`:233-243` -> `session-system-event-adoption.ts:118-147`) | `stage=wake deliveryId=<row>` |
| Prompt drain | `reply/session-system-events.ts:192-207`; final adoption re-checks under writer admission (`session-system-event-adoption.ts:191-211, 248-270`) | refused before formatting | `stage=prompt-drain deliveryId=<row>` |
| Durable replay (45-75 s pending sweep, boot recovery) | `server-restart-sentinel-delivery.ts:263-281, 307-329` -> `refuseStaleAuthorityReplay` `:50-76`; sweep `session-delivery-queue-runtime.ts:52-66, 143-149`; boot `server-restart-sentinel.ts:80-97, 138-153` | **defers** while the row has a queued copy in memory (`:61-65`); otherwise refused and dead-lettered with its receipt kept (`:72-75`) | `stage=replay deliveryId=<row>` (`:66-71`), plus the sweep's `dead-letter decision for entry <row>` warn (`session-delivery-queue-recovery.ts:164-166`) |
| Settlement | `session-delivery-queue-recovery.ts:152-215` | refused: `moved-to-failed` with a bounded receipt (`:161-180, 208-213`); adopted: `recovered` (`:156-160`) | none public: health's failed count excludes the receipt (`delivery-queue-sqlite.kernel.ts:397-429`) |
| Adoption | `managed-delivery-turn-lifecycle.ts:107-111` writes `__openclaw.sessionDeliveryAckIds`; read back at `session-system-event-adoption.ts:53-71` | n/a | `chat.history` hides the wake's own rows, so a wake's adoption is read from the primed target's `TARGET-ACK`, and a probe turn's from the marker on its visible row (`chat-display-projection.sanitize.ts:442-475`) |

j12's `session event delivery skipped: recipient authority changed` and `... wake skipped ...` lines,
and its empty-list `Delivered to  from <child>` line, are gone at j12′. The row's matcher refuses
them (tests in `scripts/__tests__/recipient-authority-row.test.mjs` and
`tests/recipient-authority-dry-run.test.mjs`).

## The cases

Each case is its own signed receipt, in this order, on one gateway the control started.
`replay-restart` replaces that gateway, so it runs last.

| Case | Transition (public RPC) | Mode | Refused at | Reason it must show | Absence it must show |
|---|---|---|---|---|---|
| `allowed` | none | silent-wake | n/a | n/a | n/a: exactly one `TARGET-ACK <nonce>` from a non-priming target run; none in the parent; epoch unchanged |
| `allowed-across-reset` | `sessions.reset` after capture, then re-prime | silent-wake | n/a | n/a | as `allowed`, and the epoch unchanged by the reset |
| `allowed-silent` | none; the silent return parks, then the probe turn adopts it | silent | n/a | n/a | n/a: the product's adoption marker on the visible probe row and the ack in the probe run, no wake. The positive control for the refusal cases' absence |
| `unauthorized-admission` | `config.patch` policy disabled before dispatch, then restored | silent-wake | admission | the continue_delegate policy error | no child, no target ack, no woken target run, no parent landing |
| `unauthorized-dispatch` | `config.patch` policy disabled after the `scheduled` result, then restored | silent-wake | dispatch | `[continuation:delegate-rejected] policy.cross_session_targeting` for the dispatcher | as above |
| `revoked-visibility` | `session.visibility.set` to `read-only` after the return parked | silent | `stage=prompt-drain`: the sweep defers to the queued copy (`server-restart-sentinel-delivery.ts:61-65`), and the probe turn's drain refuses it (`session-system-events.ts:192-207` -> `session-system-event-adoption.ts:118-147`) | `[continuation:return-refused]` for the target, with a `deliveryId`, after the probe was sent | no `Delivered to` for it once the transition settled, no adoption marker, no ack, no woken run, no return marker, an answered probe turn, no parent landing |
| `revoked-membership` | `session.members.add` before dispatch, `session.members.remove` after the return parked | silent | `stage=prompt-drain`, as above | as above | as above |
| `revoked-owner` | the `sessions` tool `assign_owner` (agent `main`) from an operator session, after the return parked | silent | `stage=prompt-drain`, as above | as above | as above |
| `reassigned` | `sessions.delete` then `sessions.create` of the same key, after the return parked | silent | `stage=replay`: the delete consumes the queued copy (`sessions-delete.ts:454` -> `session-reset-cleanup.ts:194-196`), so the pending sweep refuses the row (`server-restart-sentinel-delivery.ts:271-281` -> `:66-71`) | `[continuation:return-refused]` for the target, with a `deliveryId`, after the transition | as above |
| `wake-revoked-visibility` | `session.visibility.set` to `read-only` after the `scheduled` result, before the delegate fires | silent-wake | `stage=enqueue`: the router's first authority read refuses it before any row (`targeting.ts:277-280`) | `[continuation:return-refused]` for the target, with **no** `deliveryId`, after the transition | no `Delivered to` line for it at all, and the rest as above: no adoption, ack, wake turn or final effect |
| `wake-reassigned` | `sessions.delete` then `sessions.create` of the same key, after the `scheduled` result, before the delegate fires | silent-wake | `stage=enqueue`, as above | as above | as above |
| `replay-restart` | `session.visibility.set` after the return parked, then a supervised restart before any prompt | silent | `stage=replay` on the replacement: no copy survives the restart, so its boot recovery refuses the row (`server-restart-sentinel.ts:138-153` -> `server-restart-sentinel-delivery.ts:271-281` -> `:66-71`) | as `reassigned`, from the replacement generation, after the restart | as above, on the replacement |

"Parked" means the router's `Delivered to <target>` line precedes the transition: the return was
admitted while current and sits un-adopted (mode silent does not wake). A wake-mode case is the
opposite: its transition settles before the delegate's delay ends, so its return is never routed.
The control samples the epoch every 500 ms: captured after the `scheduled` toolResult and strictly
before the transition, again after it, and at the end.

**One stage per case.** Each refused return's stage comes from where its queued copy is when its
epoch advances. The bytes allow exactly one first refusal per case:

- `revoked-visibility`, `revoked-membership`, `revoked-owner`: none of these RPCs touches the
  target's queued events (`sessions-sharing.ts`, `session-accessor.sqlite-owner.ts`), so the sweep
  defers to the copy and only a prompt drain can see it. The disposable target has no turn until
  the probe.
- `reassigned`: the delete consumes the copy, so no drain can see it and the sweep refuses the row.
  The scenario waits two sweep periods (`OPENCLAW_RCD_RA_SWEEP_WAIT_MS`, 160 s) before its probe.
  A sweep that came later would still refuse at `replay`.
- `wake-revoked-visibility`, `wake-reassigned`: the epoch has advanced before the child returns,
  so the router's first read refuses it.
- `replay-restart`: the old generation never prompts the target, and its sweep defers to the copy,
  so the first boundary to see the row is the replacement's boot recovery.

The first line naming the target must carry that stage. One later line is possible, and only in
the prompt-drain cases: a `replay` line naming the same row. The pending sweep may load the row
just before the probe's drain retires it. The drain moves the row to `failed` and consumes the
event before it reports (`session-system-event-adoption.ts:125-146`). `refuseStaleAuthorityReplay`
checks only the queued copy (`server-restart-sentinel-delivery.ts:61-71`), so the sweep then reports
the row once more. The lib names this as `laterStages: ['replay']` for those three cases. Any other
first stage, any other later stage, another row, or a row-less line where the stage writes one
leaves the case MISSING (`refusal-stage-mismatch`, `reason-delivery-id-ambiguous`).

**How absence is observed.** `chat.history` hides the wake's own rows, but it keeps the product's
adoption marker, `__openclaw.sessionDeliveryAckIds`, on a visible row
(`session-system-event-adoption.ts:53-71`; `chat-display-projection.sanitize.ts:442-475` strips only
named private keys). A parked return adopted into the probe turn would put its delivery id on the
probe's row whether or not the model acknowledges it. `allowed-silent` is the control: the same park
and probe, where the marker must show. Without it the row cannot pass, because the refusal cases'
"no marker" would be unproven. A wake turn's own rows stay hidden, so a wake is read from its
visible assistant rows (a woken run that is neither priming nor probe).

## Cites re-walked at the merged j12′

These depend on the reset path or on `continue_work`, which `keeps-queued-2` and the `continue_work`
authority binding change. 🌿 re-walks them at the merged head:

- `allowed-across-reset` and every `sessions.reset` cite: `sessions-mutations.ts:593-678`,
  `session-reset-service.ts:651-737, 751, 1032-1043`, and the reset's consumption of queued events
  (`session-reset-runtime-state.ts:11-51`, `session-reset-cleanup.ts:146-196`, shared with
  `sessions.delete`, so also `reassigned` and `wake-reassigned`).
- The reset hold on a return written while a reset replaces the head: `targeting.ts:319-321, 348-356`
  and the replay's `server-restart-sentinel-delivery.ts:238-262`.
- `continue_work`: the row drives no `continue_work`, and none of its cites are on it. Recheck that
  this still holds once the authority binding lands.

## What ClawSweeper asked for, case by case

ClawSweeper's standing review on openclaw/openclaw#129388 (comment 5442236054) asks for
"allowed-recipient and revoked/reassigned-recipient proof, including restart replay", and under
Security: "allowed delivery and rejection after revocation or reassignment still need evidence
through prompt adoption, wake, and restart replay". The map on docs#536 (comment 6597622114) lists
the items. Its update (comment 6599896374) records the j12 finding behind j12′, that a wake-path
refusal had no reason to observe, and says the row re-anchors to j12′, where the wake-mode refusal
becomes provable.

| ClawSweeper item | Cases |
|---|---|
| Real behavior proof: allowed vs revoked/reassigned recipients, incl. restart replay, through adoption, wake, final effects | `allowed`, `revoked-visibility`, `revoked-membership`, `revoked-owner`, `reassigned`, `wake-revoked-visibility`, `wake-reassigned`, `replay-restart` |
| Security: prove stale recipient rejection before final effects | every refusal case: the reason at its pinned stage and no adoption, ack, wake or final effect |
| P1: durable returns outliving admission; rejection unproven at prompt, wake, delivery, restart replay | prompt: `revoked-visibility`, `revoked-membership`, `revoked-owner` (`stage=prompt-drain`); wake: `wake-revoked-visibility`, `wake-reassigned` (a wake-mode return refused at `stage=enqueue`, never woken, no `Delivered to`); delivery: `reassigned` (`stage=replay` by the sweep), `unauthorized-dispatch` (accepted, then refused at dispatch); restart replay: `replay-restart` (`stage=replay` on the replacement) |
| P1: accepted-child survival, reset | `allowed-across-reset` (reset is not an authority edge at j12′; re-walked at the merged head) |
| Allowed delivery through prompt adoption | `allowed-silent` (adopted by a prompt drain, with the product's marker), `allowed` and `allowed-across-reset` (adopted by the wake) |
| Unauthorized recipient | `unauthorized-admission`, `unauthorized-dispatch`: the only admission refusal j12′ has |
| Not answered here | a refusal at the wake handoff itself (`stage=wake`, see "does not prove"); "settled as refused" from the record (no public reader); compaction, session-id rollover and late materialization; fresh install and upgrade |

## Verdict rules

`lib/recipient-authority-row.mjs` grades each case record, and the row from all of them:

- A record that is not this row's, names another candidate than j12′ (j12 included), lacks a gate
  (j12′ build, isolated state, model sign-in, cross-session policy enabled, gateway started by the
  control), whose listener was not the control's own process at every 500 ms sample and case
  boundary, or whose evidence is not bound to the control's run is **MISSING-candidate**, and
  nothing else about it is judged. So is a case whose scenario recorded any refusal or whose methods
  were not all advertised.
- A transition that did not take effect (its RPC failed, or a revocation left the epoch unchanged)
  is MISSING, and nothing the return then did is judged a contradiction: adopting a still-current
  return is correct.
- So is any deviation by the model or the setup, because it tests something other than the case:
  - another `continue_delegate` call by the parent (a retry after the policy error, another target);
  - an accepted delegate whose mode, read from its own `scheduled` result, is not the case's;
  - an `unauthorized-dispatch` delegate whose delay let it fire before the policy changed;
  - a wake-mode transition that settled after the delegate could fire, or a wake-mode return routed
    before its transition;
  - a parked return not routed before its transition was requested, or any return routed while its
    transition RPC was in flight (`return-routed-during-transition`): the router may have read the
    epoch before it committed, so delivering then is correct;
  - a revoked or reassigned return already acknowledged, woken or marked adopted when the
    transition was sent (the scenario reads the target just before it).
- A contradiction is **FAIL-candidate**: a refused return adopted (the product's marker),
  acknowledged, woken, repeated in the target, or logged `Delivered to` once its transition had
  settled (the target named, or j12's empty list from its child); an allowed wake-mode return routed but never
  woken; a return in the parent; an unauthorized delegate spawned or accepted; an allowed return
  adopted twice; or `sessions.reset` advancing the epoch. A woken target that never typed the exact
  ack is MISSING (`woken-without-ack`): the miss may be the model's. `allowed-silent` is decided by
  the product's marker on the probe row; its model is asked only for `PROBE-OK`.
- A missing or untyped observation is **MISSING-candidate**. A refusal case without its product
  reason, or without the observed absence (transcripts read, router lines read, probe turn answered,
  every target row attributable to a run), is MISSING, never PASS. For a refused return the reason
  is j12′'s line naming the case's target with j12′'s one reason on every line
  (`refusal-reason-mismatch`). Its first line must carry the case's pinned stage, and a later line
  only a stage the bytes name for the same row (`refusal-stage-mismatch`). It must name a row exactly
  when that stage writes one (`refusal-delivery-id-mismatch`): every line names the same one row,
  or no line names any (`reason-delivery-id-ambiguous`). It must come after the transition, after
  the probe was sent for `prompt-drain`, and from the replacement after the restart for
  `replay-restart`. j12's lines are no reason. So is a revoked
  case whose return was not parked before the transition, or whose transition did not advance the
  epoch.
- A residual condition is **PARTIAL-candidate**: a policy change not restored, cleanup incomplete,
  or a fired delegate's Tempo trace not correlated (`trace-receipt-pending`). The trace counts only
  from a `continuation-trace-correlation.json` of this row whose reason hash and length are the
  case's and whose `traceJson` names its own `traceId`. The collector does not sign it, so the fold
  review checks the trace file itself.
- The row is the minimum over all twelve cases. A case without a verified receipt is MISSING, so
  the row is MISSING until every case runs. Receipts from different runs are MISSING, and an
  unverified receipt or two disagreeing receipts of one case cap it at PARTIAL.

## Operator procedure

For the owner who runs it on an isolated proof gateway after j12′ deploys, once the merged j12′
replaces the interim pin. Never against a live seat.

1. **Stage j12′.** Build a validated stage-only runtime at `e9dc1c318a2f73fd01755fc4682fa3349e8a0e94`
   (its `dist/build-info.json` commit must be j12′) on your own architecture.
2. **Set up the isolated gateway** with frond-scribe `scripts/proof-gw/composite-launcher.sh`:
   `setup <j12′> <j12′>`, then `login` and `login-finish` (or `adopt-auth` from a previous isolated
   gateway). Its `receipts/isolated-auth-status.json` must show an OpenAI profile under its own state.
3. **Enable continuation and cross-session targeting** in that gateway's own `openclaw.json`
   (`agents.defaults.continuation.enabled: true`, `crossSessionTargeting: "enabled"`), and leave
   `gateway.reload.mode` anything but `off`: with reload off, `config.patch` saves the policy without
   applying it (`config-write-flow.ts:214-226`). The control refuses a disabled policy and reload
   off. It never edits the file itself, and the unauthorized cases change the policy only through
   `config.patch` and restore it.
4. **Stop it**: `composite-launcher.sh stop <j12′> <j12′>`. The control refuses a running unit or a
   busy port, and starts the gateway itself.
5. **Make an observer key** outside `$HOME/proof-gw`, mode 0600, at least 32 characters. The gateway
   never sees it.
6. **Run the control** from a clean docs checkout at the reviewed docs SHA, with k6 v2.0.0 on PATH:

   ```bash
   node tools/k6-proofs/scripts/run-recipient-authority-row.mjs \
     --proof-gw-dir "$HOME/proof-gw/comp-e9dc1c31" \
     --stage-dir <j12′-stage> \
     --candidate e9dc1c318a2f73fd01755fc4682fa3349e8a0e94 \
     --docs-sha <40-hex docs SHA> \
     --artifact-dir "$HOME/proof-runs/rra-<UTC>/public" \
     --observer-key-file <key> --seat <seat> --json
   ```

   `--cases a,b` runs a subset (always in the table's order). Timing can be tuned through
   `OPENCLAW_RCD_RA_DELAY_SECONDS` (30), `_PARK_MS` (15000), `_SWEEP_WAIT_MS` (160000, two sweep
   periods), `_WINDOW_MS`, `_POLL_MS`, `_BOOT_WAIT_MS`, `_DUPLICATE_WAIT_MS`, `_SAMPLE_GAP_MS`
   (2000, also the wake-mode cases' wait before their transition, which must stay well inside the
   delay). A refusal prints the refusal JSON and exits 2 before anything starts. The control reads
   the gateway's console, where both the router's line and the refused-return line land at their
   default levels.
7. **Collect each fired delegate's trace** with `collect-continuation-trace.mjs --run-dir
   <artifact-dir>.private/<case> --manifest tools/k6-proofs/manifests/r-cd-recipient-authority.json
   --seat <seat>` (the case's `evidence.jsonl` is there), and copy `continuation-trace-correlation.json`
   and the public trace into `<artifact-dir>/<case>/`.
8. **Grade the row**: `node tools/k6-proofs/scripts/run-recipient-authority-row.mjs --grade-row
   <artifact-dir> --observer-key-file <key>`. Exit 0 only for PASS-candidate.
9. **Publish the public directory only**, copied to
   `PROOFS/e9dc1c318a2f73fd01755fc4682fa3349e8a0e94/R-CD-RECIPIENT-AUTHORITY/<seat>/authority-row-<UTC>/`
   (at the merged j12′ SHA once the pin moves). The artifact directory lives outside the repository
   because `<artifact-dir>.private` sits beside it: raw evidence, gateway logs, session keys and
   delivery ids, never part of the corpus. Folding is a reviewed coordinator step at j12′.
10. **Shred** with `composite-launcher.sh shred` when the review no longer needs the state.

If a case is MISSING for a setup reason (no member identity to add for `revoked-membership`, a model
that never made the call, a wake-mode transition that settled after the fire), fix the setup and
rerun the whole row. Each run is a new run id, and the row needs every case from one run: receipts
from different runs grade it MISSING (`receipts-from-different-runs`). `--cases` runs a subset for
diagnosis only.

## Files

| File | Role |
|---|---|
| `manifests/r-cd-recipient-authority.json` | the row manifest (orchestration-required, `disposable-real-process`, interim pin, cases, receipts) |
| `scenarios/r-cd-recipient-authority.js` | the k6 case driver, with the j12′ path map; refuses outside the control |
| `scripts/run-recipient-authority-row.mjs` | the control: gates, harness-owned gateway, log and epoch capture, restart, signed receipts, `--grade-row` |
| `lib/recipient-authority-row.mjs` | the case table with each stage's bytes, the j12′ reason matcher, transcript observation and verdict rules |
| `scripts/__tests__/recipient-authority-row.test.mjs` | registration, guard, verdict, stages, j12-line and `Delivered to` negatives, gates, signed receipts |
| `tests/recipient-authority-dry-run.test.mjs` | the case driver under `k6-node-runtime` against a j12′-shaped scripted gateway |
