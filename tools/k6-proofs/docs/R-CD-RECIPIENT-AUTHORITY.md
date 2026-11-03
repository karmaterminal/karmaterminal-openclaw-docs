# R-CD-RECIPIENT-AUTHORITY: live recipient-authority row at j12

Status: **catalogued, every case MISSING, never fired, in no corpus.** Bound issue:
karmaterminal/karmaterminal-openclaw-docs#536. Pinned product: j12, karmaterminal/openclaw
`352f56029dc95c60149ab4aaa127226a861d0b3d`.

🌊's ruling (room msg 1567077062139838485, 2026-11-03): make R-CD-RECIPIENT-AUTHORITY a live,
isolated-gateway row at pinned j12, separate from his supervised-restart row. Keep every case
MISSING until an owner runs it. Use the public RPCs actually available at j12, and observe both the
refusal reason and the absence of target adoption, ack and final effect, including replay. The old
fixture matrix is history, not j12 proof.

- [What it proves, and what it does not](#what-it-proves-and-what-it-does-not)
- [Its own row](#its-own-row)
- [The product path at j12](#the-product-path-at-j12)
- [The cases](#the-cases)
- [What ClawSweeper asked for, case by case](#what-clawsweeper-asked-for-case-by-case)
- [Verdict rules](#verdict-rules)
- [Operator procedure](#operator-procedure)
- [Files](#files)

## What it proves, and what it does not

On one disposable gateway at j12, started by the row's own control, a delegate return targeted at
another session (`continue_delegate` with `targetSessionKey`, from a real model turn, the R-CD-4
shape) is:

- adopted and acknowledged exactly once by its target while the target's authority is unchanged,
  including across `sessions.reset`;
- refused, with the product's own reason and with no adoption, acknowledgement, wake or final
  effect, when the target is not addressable (the cross-session policy), when its authority is
  revoked (visibility narrowed, member removed, owner changed) or when its key is reassigned
  (deleted and recreated), between dispatch and return, and when the refused return is replayed
  across a supervised restart.

It does not prove:

- **A refusal reason at the enqueue, wake or prompt boundary.** j12 emits none there (see the
  table below). The row reaches the boundary that does log one, the durable replay, by parking a
  silent return before the transition. A wake-mode return that goes stale before it is routed is
  refused silently, and this row does not claim that path has a reason.
- **"Settled as refused" from the delivery record.** j12 settles an adopted row and a refused row
  the same way (`recovered`). The row reads refusal from the reason and the absence of adoption, not
  from the record.
- **A per-target addressability check.** j12 has none: the binding is captured for any key, existing
  session or not. "Unauthorized" here is the `crossSessionTargeting` policy, the only admission
  refusal j12 has.
- **The supervised-restart claim.** That is `R-CD-RETURN-COVENANT-AUTHORITY`'s. `replay-restart`
  uses the same supervised branch to replay a parked return; it never reads or feeds that row.
- **Multi-recipient fanout, cross-agent recipients, the bracket-token form, explicit revocation.**
  `tree`/`all` fanout and recipients of another agent are outside the cases; the token form is not
  driven (R-CD-TOKEN covers targeted bracket returns); j12 has no explicit revocation API.
- **Fresh install or upgrade.** Proposed separately (docs#619, `R-CD-FRESH-INSTALL`).
- **Anything until an owner runs it.** No case here has run.

## Its own row

- `R-CD-RETURN-COVENANT-AUTHORITY` (docs#615) is 🌊's supervised disposable real-restart control: the
  epoch survives a real restart. It delivers no return.
- `R-CD-RECIPIENT-AUTHORITY-MATRIX` (docs#549) is the process-local fixture matrix, capped at
  `PARTIAL-candidate`. Its product seam was cut to fork-only before j12, so it cannot run there. It
  is history.
- This row is a live gateway invocation at j12. It reads none of their receipts and feeds neither
  verdict, and neither feeds this one.

## The product path at j12

Byte-read with `git show` / `git grep` at `352f56029dc9`. The scenario header
(`scenarios/r-cd-recipient-authority.js`) carries the same map.

### What changes a recipient's authority

Authority is one UUID epoch per logical session key in `session_recipient_authority` (per-agent
database). A captured binding is current only while the stored epoch equals it
(`src/config/sessions/session-recipient-authority-types.ts:87-92`).

| Public RPC | Effect on the target's epoch | Path at j12 |
|---|---|---|
| `continue_delegate` (model turn), capture | insert-if-absent for any key, before the `scheduled` toolResult | `continue-delegate-tool.ts:424-449`, `delegate-flow-store.ts:426-437`, `session-recipient-authority.worker.ts:35-50` |
| `sessions.delete` | advances (every deletion owner); the epoch row outlives the session, so `sessions.create` of the same key keeps the advanced epoch | `session-accessor.sqlite-entry-store.ts:56-69`, `server-methods/sessions-delete.ts:589` |
| `session.visibility.set` (narrowing) | advances, for every writer; rank shared > suggest > read-only > draft | `session-accessor.sqlite-entry-mutation.ts:119-136`, `sessions-sharing.ts:527-610`, `session-recipient-authority-types.ts:66-99` |
| `session.members.remove` | advances | `session-sharing-store.native.ts:150-195`, `sessions-sharing.ts:337-423, 616` |
| `sessions.assignOwner` (owner changes) | advances; refuses a caller that is neither an agent runtime nor a human profile, so only the agent's `sessions` tool `assign_owner` can drive it here | `session-accessor.sqlite-owner.ts:158-182`, `sessions-mutations.ts:343-470` (`:362-374`), `agents/tools/sessions-tool.ts:384-419` |
| `sessions.reset` | **none**: rotates the session in place; only an incognito reset deletes | `sessions-mutations.ts:593-678`, `gateway/session-reset-service.ts:651-737, 751, 1032-1043` |
| `config.patch` `agents.defaults.continuation.crossSessionTargeting` | none; it is the admission policy, default disabled, read at each decision, reloaded hot | `continuation/config.ts:84-92, 128-129`, `server-methods/config.ts:798-850`, `config-reload.prepared-model-runtime.test.ts:74-96` |

Sharing mutations need the session owner or `operator.admin` (`sessions-sharing-authority.ts:144-156`);
a loopback backend client with the shared token keeps the scopes it asks for
(`ws-connection/connect-auth.ts:286-296`, `handshake-auth-helpers.ts:165-187`).
`session.members.add` accepts only a known identity (`sessions-sharing.ts:347-361`).

### Where a targeted return is bound, checked, enqueued, woken and adopted, and what a refusal leaves

| Boundary | Path at j12 | On a stale or unauthorized return | Observable reason |
|---|---|---|---|
| Admission (tool) | `continue-delegate-tool.ts:353-362` | ToolInputError, nothing accepted | the toolResult text: "cross-session continuation targeting is disabled ..." |
| Dispatch | `continuation/delegate-dispatch.ts:267-290` | custody failed, owner notice, no child | log `[continuation:delegate-rejected] policy.cross_session_targeting ... session=<dispatcher>`; `continuation.disabled` span with `disabledReason` |
| Routing | `subagent-announce.continuation-return.ts:104-212` | admits the current recipients only | `[continuation:targeted-return] Delivered to <keys> from <child>` (`:194-201`), an **empty** list when every recipient was refused |
| Enqueue, before the row | `continuation/targeting.ts:240-254` | skipped, no row | **none** |
| Enqueue, after the row | `targeting.ts:278-319, 329-346` | row acknowledged, queued event removed | **none** |
| Wake handoff | `continuation-wake.ts:127-238` | `settleStaleSystemEventAuthority` retires it (`session-system-event-adoption.ts:113-134`) | **none** |
| Prompt drain | `reply/session-system-events.ts:153-211` | settled before formatting | **none** |
| Durable replay (45-75 s pending sweep, boot recovery) | `server-restart-sentinel-delivery.ts:226-243, 271-290`; sweep `session-delivery-queue-runtime.ts:52-66, 143-149`; boot `server-restart-sentinel.ts:80-97, 138-153` | skipped, then settled | log `session event delivery skipped: recipient authority changed` (`sessionKey`, `queueId`), or `... wake skipped: ...` |
| Settlement | `session-delivery-queue-recovery.ts:149-156`, `session-delivery-queue-storage.ts:601-622` | `recovered`, then a completed tombstone, for adopted and refused alike | none distinguishes a refusal |
| Adoption | `session-system-event-adoption.ts:49-79` (`__openclaw.sessionDeliveryAckIds`) | n/a | `chat.history` hides the wake's own rows, so adoption is read from the primed target's `TARGET-ACK` |

## The cases

Each case is its own signed receipt, in this order, on one gateway the control started.
`replay-restart` replaces that gateway, so it runs last.

| Case | Transition (public RPC) | Mode | Refused at | Reason it must show | Absence it must show |
|---|---|---|---|---|---|
| `allowed` | none | silent-wake | n/a | n/a | n/a: exactly one `TARGET-ACK <nonce>` from a non-priming target run; none in the parent; epoch unchanged |
| `allowed-across-reset` | `sessions.reset` after capture, then re-prime | silent-wake | n/a | n/a | as `allowed`, and the epoch unchanged by the reset |
| `unauthorized-admission` | `config.patch` policy disabled before dispatch, then restored | silent-wake | admission | the continue_delegate policy error | no child, no target ack, no woken target run, no parent landing |
| `unauthorized-dispatch` | `config.patch` policy disabled after the `scheduled` result, then restored | silent-wake | dispatch | `[continuation:delegate-rejected] policy.cross_session_targeting` for the dispatcher | as above |
| `revoked-visibility` | `session.visibility.set` to `read-only` after the return parked | silent | durable replay | `recipient authority changed` for the target | no ack, no woken run, no return marker, a probe turn that drained without adopting, no parent landing |
| `revoked-membership` | `session.members.add` before dispatch, `session.members.remove` after the return parked | silent | durable replay | as above | as above |
| `revoked-owner` | the `sessions` tool `assign_owner` (agent `main`) from an operator session, after the return parked | silent | durable replay | as above | as above |
| `reassigned` | `sessions.delete` then `sessions.create` of the same key, after the return parked | silent | durable replay | as above | as above |
| `replay-restart` | `session.visibility.set` after the return parked, then a supervised restart before the sweep | silent | boot replay on the replacement | as above, from the replacement generation, after the restart | as above, on the replacement |

"Parked" means the router's `Delivered to <target>` line precedes the transition: the return was
admitted while current and sits un-adopted (mode silent does not wake). The control samples the
epoch every 500 ms: captured after the `scheduled` toolResult and strictly before the transition,
again after it, and at the end.

## What ClawSweeper asked for, case by case

ClawSweeper's standing review on openclaw/openclaw#129388 (comment 5442236054) asks for
"allowed-recipient and revoked/reassigned-recipient proof, including restart replay", and under
Security: "allowed delivery and rejection after revocation or reassignment still need evidence
through prompt adoption, wake, and restart replay". The mapping on docs#536 (comment 6597622114)
lists the items.

| ClawSweeper item | Cases |
|---|---|
| Real behavior proof: allowed vs revoked/reassigned recipients, incl. restart replay, through adoption, wake, final effects | `allowed`, `revoked-visibility`, `revoked-membership`, `revoked-owner`, `reassigned`, `replay-restart` |
| Security: prove stale recipient rejection before final effects | every refusal case: the reason and no adoption, ack, wake or final effect |
| P1: durable returns outliving admission; rejection unproven at prompt, wake, delivery, restart replay | `unauthorized-dispatch` (accepted, then refused at dispatch); the revoked and reassigned cases (refused at durable replay, then no adoption at the probe's prompt drain); `replay-restart` (refused at boot replay) |
| P1: accepted-child survival, reset | `allowed-across-reset` (reset is not an authority edge at j12) |
| Unauthorized recipient | `unauthorized-admission`, `unauthorized-dispatch`: the only admission refusal j12 has |
| Not answered here | rejection reasons at enqueue, wake and prompt (j12 emits none); compaction, session-id rollover and late materialization; fresh install and upgrade |

## Verdict rules

`lib/recipient-authority-row.mjs` grades each case record, and the row from all of them:

- A record that is not this row's, names another candidate than j12, lacks a gate (j12 build, isolated
  state, model sign-in, cross-session policy enabled, gateway started by the control), whose listener
  was not the control's own process throughout, or whose evidence is not bound to the control's run
  is **MISSING-candidate**, and nothing else about it is judged.
- A contradiction is **FAIL-candidate**: a refused return acknowledged, woken or repeated in the
  target, a return in the parent, an unauthorized delegate spawned or accepted, an allowed return
  routed but never acknowledged or acknowledged twice, or `sessions.reset` advancing the epoch.
- A missing or untyped observation is **MISSING-candidate**. A refusal case without its product
  reason, or without the observed absence (transcripts read, probe turn answered, every target row
  attributable to a run), is MISSING, never PASS. So is a revoked case whose return was not parked
  before the transition, or whose transition did not advance the epoch.
- A residual condition is **PARTIAL-candidate**: a policy change not restored, cleanup incomplete,
  or a fired delegate's Tempo trace not correlated (`trace-receipt-pending`).
- The row is the minimum over all nine cases. A case without a verified receipt is MISSING, so the
  row is MISSING until every case runs. Receipts from different runs are MISSING, and an unverified
  receipt or two disagreeing receipts of one case cap it at PARTIAL.

## Operator procedure

For the owner who runs it on an isolated proof gateway after j12 deploys. Never against a live seat.

1. **Stage j12.** Build a validated stage-only runtime at `352f56029dc95c60149ab4aaa127226a861d0b3d`
   (its `dist/build-info.json` commit must be j12) on your own architecture.
2. **Set up the isolated gateway** with frond-scribe `scripts/proof-gw/composite-launcher.sh`:
   `setup <j12> <j12>`, then `login` and `login-finish` (or `adopt-auth` from a previous isolated
   gateway). Its `receipts/isolated-auth-status.json` must show an OpenAI profile under its own state.
3. **Enable continuation and cross-session targeting** in that gateway's own `openclaw.json`
   (`agents.defaults.continuation.enabled: true`, `crossSessionTargeting: "enabled"`). The control
   refuses a disabled policy; it never edits the file itself, and the unauthorized cases change the
   policy only through `config.patch` and restore it.
4. **Stop it**: `composite-launcher.sh stop <j12> <j12>`. The control refuses a running unit or a
   busy port, and starts the gateway itself.
5. **Make an observer key** outside `$HOME/proof-gw`, mode 0600, at least 32 characters. The gateway
   never sees it.
6. **Run the control** from a clean docs checkout at the reviewed docs SHA, with k6 v2.0.0 on PATH:

   ```bash
   node tools/k6-proofs/scripts/run-recipient-authority-row.mjs \
     --proof-gw-dir "$HOME/proof-gw/comp-352f5602" \
     --stage-dir <j12-stage> \
     --candidate 352f56029dc95c60149ab4aaa127226a861d0b3d \
     --docs-sha <40-hex docs SHA> \
     --artifact-dir "$HOME/proof-runs/rra-<UTC>/public" \
     --observer-key-file <key> --seat <seat> --json
   ```

   `--cases a,b` runs a subset (always in the table's order). Timing can be tuned through
   `OPENCLAW_RCD_RA_DELAY_SECONDS` (30), `_PARK_MS` (15000), `_SWEEP_WAIT_MS` (160000, two sweep
   periods), `_WINDOW_MS`, `_POLL_MS`, `_BOOT_WAIT_MS`, `_DUPLICATE_WAIT_MS`, `_SAMPLE_GAP_MS`.
   A refusal prints the refusal JSON and exits 2 before anything starts.
7. **Collect each fired delegate's trace** with `collect-continuation-trace.mjs --run-dir
   <artifact-dir>.private/<case> --manifest tools/k6-proofs/manifests/r-cd-recipient-authority.json
   --seat <seat>` (the case's `evidence.jsonl` is there), and copy `continuation-trace-correlation.json`
   and the public trace into `<artifact-dir>/<case>/`.
8. **Grade the row**: `node tools/k6-proofs/scripts/run-recipient-authority-row.mjs --grade-row
   <artifact-dir> --observer-key-file <key>`. Exit 0 only for PASS-candidate.
9. **Publish the public directory only**, copied to
   `PROOFS/352f56029dc95c60149ab4aaa127226a861d0b3d/R-CD-RECIPIENT-AUTHORITY/<seat>/authority-row-<UTC>/`.
   The artifact directory lives outside the repository because `<artifact-dir>.private` sits beside
   it: raw evidence, gateway logs and session keys, never part of the corpus. Folding is a reviewed
   coordinator step at j12.
10. **Shred** with `composite-launcher.sh shred` when the review no longer needs the state.

If a case is MISSING for a setup reason (no member identity to add for `revoked-membership`, a model
that never made the call, a return the sweep refused before a restart), rerun that case with
`--cases`. Each run is a new run id, so the row needs every case from one run.

## Files

| File | Role |
|---|---|
| `manifests/r-cd-recipient-authority.json` | the row manifest (orchestration-required, `disposable-real-process`, cases, receipts) |
| `scenarios/r-cd-recipient-authority.js` | the k6 case driver, with the j12 path map; refuses outside the control |
| `scripts/run-recipient-authority-row.mjs` | the control: gates, harness-owned gateway, log and epoch capture, restart, signed receipts, `--grade-row` |
| `lib/recipient-authority-row.mjs` | the case table, reason matchers, transcript observation and verdict rules |
| `scripts/__tests__/recipient-authority-row.test.mjs` | registration, guard, verdict, gates, signed receipts |
| `tests/recipient-authority-dry-run.test.mjs` | the case driver under `k6-node-runtime` against a j12-shaped scripted gateway |
