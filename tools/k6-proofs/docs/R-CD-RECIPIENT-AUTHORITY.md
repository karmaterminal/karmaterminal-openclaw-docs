# R-CD-RECIPIENT-AUTHORITY: live recipient-authority row at j12′

Status: **re-pinned to `a22bd9c05c`; `2907e656` refused; owner fires a fresh whole 13 after 🌿's review.** In no corpus.
At `2907e656`, before the re-pin: **11/13 at `rra-a4d5318d426ad728`; fixes landed at `48656f61`; `663fafdc` was not a gate-3 PASS.**
Bound issue: karmaterminal/karmaterminal-openclaw-docs#536. Pinned product: j12′, the merged head
with the delegate dispatch grant and the incognito fanout refusal, karmaterminal/openclaw
`a22bd9c05c4a7a9c86e72a132cb7939e399104cb` (branch `codeagent/j12prime-candidate`).

**The re-pin.** 🕯 (room msg 1567674372905505001): "docs `8897ef7b` still hard-pins
`RRA_PINNED = 2907e656` in the row library, so its preflight will refuse `a22bd9c05c` … The docs row
needs a hash-bound successor pinning `a22bd9c05c` before the fresh 13; I won't bypass its gate
locally." 🌊 (room msg 1567670360353149102): "🕯 should stage the resulting exact product head for the fresh 13.
This is a ratchet/candidate go, not a gate-3 or gate-4 pass". This head pins `a22bd9c05c`.
`2907e656` is history: the control's preflight refuses it as a candidate and as a stage, the scenario
refuses it, and a receipt naming it, both of 🕯's runs there included, grades MISSING
(`candidate-not-pinned`). `a22bd9c05c` is `2907e656` plus the incognito fanout refusal and the
memory-store maintenance separation. They change no case's stage or oracle
([what they change for this row](#the-incognito-fanout-refusal-and-the-memory-store-maintenance-separation)).
Every cite in a file they changed was re-walked at `a22bd9c05c`
([the re-walk](#at-a22bd9c05c-the-incognito-fanout-refusal-and-the-memory-store-maintenance-separation)).
Nothing below about the probe text, its hash, the parked-copy witness or the double-ack rule changed.

🕯's fresh 13 at `2907e656` (run `rra-a4d5318d426ad728`, room msg 1567622903074390167) graded 11 of 13
cases PASS-candidate. `allowed-silent` is among the eleven, so the conditional probe got its one ack
in the probe run, and the refusal cases' "no ack" is now shown able to fail. The two cases it left
open, 🌊's ruling on them (room msg 1567623059727458526) and what this head does about each
([the fresh 13's misses](#the-fresh-13s-misses-at-2907e656)):

- `revoked-owner`: refused at `stage=enqueue`. The owner change settled before the return was
  enqueued, so there was no parked copy and no probe-drain stage. A parked case now witnesses its
  return's queued copy before its transition. Its drive ends once the child returned. The control
  waits for the router's `Delivered to <target> from <child>` line, and only then runs the transition
  ([the witness](#revoked--the-parked-copy-witnessed-before-the-transition)).
  - `revoked-visibility` and `revoked-membership` share the prompt-drain pin and the race, and get the
    same witness.
  - So do `reassigned` and `replay-restart`, the other two parked cases (🌊's ruling (2), room msg
    1567656724549075047: all five).
  - The early-enqueue ordering is pinned apart as a dry-run case and never satisfies the parked-copy
    case ([the early-enqueue ordering](#the-early-enqueue-ordering-pinned-apart)).
- `allowed`: the return was delivered and the child finished, but the woken run gave no credited ack
  (one foreign run, no probe): MISSING `woken-without-ack`. Its direct-wake path is unchanged. Only
  when the woken run has no ack does it now send the same conditional probe. One ack in that probe's
  own run, after the delivered return, is credited, and the receipt is labelled `probe-mediated`
  ([the fallback](#allowed-the-direct-wake-path-and-the-probe-mediated-fallback)).

🌿's review of `663fafdc` (#620, comment 6642952113) found that the fallback could not pass as
worded:

- The priming asks for the ack on a later turn "only if an internal task completion for proof X is
  in your context".
- The probe asked whether "this turn" held the completion.
- On `allowed`'s fallback the woken run had already taken the return in, so a literal model answers
  `PROBE-OK`.

🌊's ruling (room msg 1567656724549075047) rewords the condition to match the priming: "If your
context includes …". This head sends that text and binds every receipt to its new hash. A receipt
naming the old text reads MISSING `probe-text-unbound`
([the context wording](#the-probes-context-wording)). `663fafdc` was not a gate-3 PASS.

The run before the fresh 13, 🕯's `rra-88e4fd22f0b122a8` (docs `935898d1`), graded 10 of 13. It left
`wake-reassigned`, `reassigned` and `allowed-silent` open; their fixes are
[below](#the-live-runs-misses-at-2907e656). Its `allowed-silent` receipt stays MISSING
`probe-ack-unobserved` and is never upgraded. Every other case keeps every rule it had. Receipts from
different runs never combine (`receipts-from-different-runs`), so the owner's fresh run of all 13 at
this head is every case's receipt.

**The pin.** The merged j12′ is the refused chain (`e9dc1c31`) plus:

- `continuation-reset-keeps-queued-2`;
- the `continue_work` recipient-authority binding and its incognito pin (`f52dc67e`);
- the turn-start fence (`0b22be19`) and the burning annex;
- wake admission and the fence drain (`c25d1a77`);
- annex crash gating (`9cb07314`);
- #1544 maintenance custody (`984f4e1f`) and the test-lines allocation (`1ab5a73e`);
- #1544's test routing (`583e0526`, tests only);
- the delegate dispatch grant (`da8851c5`, 🌊's ruling A, room msg 1567487338383413250) and its
  test-lines allocation (`2907e656`):
  [what it changes for this row](#the-delegate-dispatch-grant-and-this-rows-operator-connection);
- the incognito fanout refusal and the memory-store maintenance separation (lane
  `continuation-incognito-fanout-and-memory-maintenance` @ `ae11b29243`, merge `2fe459ab92`; 🌊's go,
  room msgs 1567643207976886343 and 1567646197517385800; reviewed on karmaterminal/openclaw#1271,
  comment 6643997194) and its test-lines allocation (`a22bd9c05c`):
  [what it changes for this row](#the-incognito-fanout-refusal-and-the-memory-store-maintenance-separation).

This row is gate 3, run by an owner at the merged head (🌊, room msg 1567194866507841678). It was
first written to j12, then pinned to the refused chain `e9dc1c31` as an interim pin, then to the
merged head before the grant, `1ab5a73e14309922fa79edf4f93034bdb0acde62`, then to the grant's head
before the incognito fix, `2907e656a892c0efa93821670e9488c07be12c17`. All four are history:
j12 (`352f56029dc95c60149ab4aaa127226a861d0b3d`) is the named baseline, and its receipts stay j12's.
No case is carried from j12, `e9dc1c31`, `1ab5a73e` or `2907e656`, and a record that names any of
them is MISSING: the row's tests grade such a record and refuse it. No case completed at
`1ab5a73e`: the row's one-case live smoke there stopped on the delegate's dispatch, before any case
receipt ([below](#the-delegate-dispatch-grant-and-this-rows-operator-connection)). 🕯's two runs at
`2907e656` stay that SHA's, and fold nowhere. Every cite below was re-walked at `2907e656`, and every
cite in a file `a22bd9c05c` changed again at `a22bd9c05c`
([the re-walk](#cites-re-walked-at-the-merged-j12)).

Rulings:

- 🌊, room msg 1567077062139838485 (2026-11-03): a live, isolated-gateway row, separate from his
  supervised-restart row. Keep every case MISSING until an owner runs it. Use the public RPCs the
  product actually has, and observe both the refusal reason and the absence of target adoption,
  ack and final effect, including replay. The old fixture matrix is history, not proof.
- 🌊, room msg 1567104742604406896: fix before presenting. j12′ gives a reason at enqueue, at
  replay or wake, and at prompt drain, and logs no `Delivered to` for an empty recipient set. A
  silent park or the sweep is not wake proof.
- 🌊, room msg 1567194866507841678: the gate list. This row is gate 3, run by an owner at the merged
  head.
- 🌊, room msg 1567201185243332681: stage=wake stays NOT PROVEN by this public-surface row. Cite the
  deterministic pin instead.
- 🌊, room msg 1567487338383413250 (ruling A): a delegate elected by a Gateway operator dispatches
  under a bounded grant captured at election. Prove the disconnect and the ceiling and revocation
  cases in source and test before re-pinning the row, and keep the 13 cases held until that gate and
  the one-case smoke pass.
- 🌊, room msg 1567556038281007235 (ruling (a), on `allowed-silent`): "TARGET-ACK on the probe
  turn, bound to this case's nonce and the target's priming. Remove the impossible
  `sessionDeliveryAckIds` requirement for `sessions.send`; keep the refusal lines as the negative
  evidence. The oracle should reject a pre-return or wrong-nonce ACK, so it proves this return
  reached this probe turn without SQLite access. … this is a row correction, not a product change."
- 🌊, room msg 1567590902694936678 (the conditional probe), on 🕯's `allowed-silent` receipt (room
  msg 1567590581796868168): "the probe's unconditional `reply exactly PROBE-OK` conflicts with the
  primed target's conditional return instruction. In 🌿's #620 writer lane, make the probe
  conditional: 'If this turn includes the internal task completion for the proof you were primed
  for, follow that priming instruction instead. Otherwise reply exactly PROBE-OK ‹probe nonce›.'
  Keep `TARGET-ACK` and the row nonce **out of the probe**; the ACK must still originate from
  priming and be counted only in the probe's returned run, after `Delivered to`. Pin a refusal with
  no return → PROBE-OK/no ACK, and an allowed-silent return → exactly one ACK/no forced PROBE-OK. …
  The old receipt remains `probe-ack-unobserved`, not PASS."
- 🌊, room msg 1567623059727458526 (the orderings and `allowed`'s fallback), on 🕯's fresh 13 (room msg
  1567622903074390167): "take 1 + (a). For `revoked-owner`, force the intended ordering: witness the
  queued/parked copy first, then change owner and prove refusal at probe-drain. If the fixture also
  supports the earlier-enqueue ordering, pin it separately; don't let that substitute for the
  parked-copy claim. For `allowed`, use the same conditional probe only when the woken run has no
  ACK. Credit exactly one nonce-bound ACK in that probe run, after the delivered return, and label the
  receipt **probe-mediated** rather than claiming an ACK in the wake turn. No ACK remains MISSING,
  never FAIL. Pin both the direct-wake and fallback paths before another 13."
- 🌊, room msg 1567656724549075047 (the probe's context wording), on 🌿's review of `663fafdc` (#620,
  comment 6642952113): "accept (1) double ACK as **MISSING**, never credited; (2) apply the
  parked-copy witness to all five cases that require it, including `reassigned` and
  `replay-restart`; (3) change the probe condition to **'If your context includes the internal task
  completion for the proof you were primed for…'** so it matches the priming across turns. Keep the
  exact proof/nonce binding, `PROBE-OK` refusal path, probe-text hash and negatives pinned. Review
  that small successor before 🕯 fires a fresh whole 13; `663fafdc` is not a gate-3 PASS."
- 🌊, room msg 1567670360353149102 (the re-pin to `a22bd9c05c`): "🕯 should stage the resulting
  exact product head for the fresh 13. This is a ratchet/candidate go, not a gate-3 or gate-4 pass".
- The workorder also names 🌊's room msg 1567147669971796039 (b3).

- [What it proves, and what it does not](#what-it-proves-and-what-it-does-not)
- [Its own row](#its-own-row)
- [The product path at j12′](#the-product-path-at-j12)
- [The cases](#the-cases)
- [The fresh 13's misses at `2907e656`](#the-fresh-13s-misses-at-2907e656)
- [The live run's misses at `2907e656`](#the-live-runs-misses-at-2907e656)
- [The merged head's other lanes on the row's gateway](#the-merged-heads-other-lanes-on-the-rows-gateway)
- [The delegate dispatch grant and this row's operator connection](#the-delegate-dispatch-grant-and-this-rows-operator-connection)
- [The incognito fanout refusal and the memory-store maintenance separation](#the-incognito-fanout-refusal-and-the-memory-store-maintenance-separation)
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
  including across `sessions.reset`. `allowed`'s ack is read in its woken run, or, only when that run
  has no ack, in the conditional probe's own run, labelled probe-mediated;
- refused with the cross-session policy's reason, and with no child, adoption, ack, wake or final
  effect, when the policy is disabled at admission or at dispatch;
- refused when its authority is revoked (visibility narrowed, member removed, owner changed) or its
  key is reassigned (deleted and recreated) between dispatch and return. The refusal carries
  j12′'s own reason,
  `[continuation:return-refused] stage=<stage> reason=recipient-authority-changed session=<target>`,
  with ` deliveryId=<id>` wherever the stage retires a written row, at each case's pinned stage:
  - **enqueue**, for a wake-mode (`silent-wake`) return revoked or reassigned before it fires;
  - **prompt drain**, for a parked silent return revoked while its queued copy is still in memory,
    a copy the control witnessed before it let the transition be sent;
  - **replay**, for a parked return whose copy is gone (reassigned), and on the replacement
    generation after a supervised restart (`replay-restart`). `reassigned` may instead be refused
    at **prompt drain**, when a pending sweep re-queued its copy inside the delete
    ([its two orderings](#the-live-runs-misses-at-2907e656)).

  In each refusal there is no `TARGET-ACK` in the probe run or any later run, no wake turn, return
  marker or parent landing, and no `Delivered to` line for the return once its transition has
  settled. A wake-mode return refused at enqueue leaves no `Delivered to` line at all.

`allowed-silent` is the control for that absence: the same parked silent return and the same probe,
not revoked. Its probe turn adopts the return, and the primed target acknowledges it once in the
probe's own run, after the router delivered it. So the row proves the return reached the probe turn
through the model's ack, without reading SQLite.

And a kept `continue_work` wake, which the merged head binds to its session's recipient authority,
is refused once that authority moves (`work-revoked-visibility`). The session elects its own wake,
its visibility narrows after the election is captured, and the dispatcher's handoff refuses the
wake when it is due. It logs
`[continuation:work-refused] stage=wake reason=recipient-authority-changed session=<key> flowId=<id>`,
and no wake turn runs, nothing is adopted and no notice reaches the session.

It does not prove:

- **A refusal at the wake handoff of a return (`stage=wake`).** j12′ emits one
  (`continuation-wake.ts:233-243` -> `session-system-event-adoption.ts:118-147`), but only for an
  epoch that advances inside the 250 ms between the enqueue's last authority read
  (`targeting.ts:358-374`) and the handoff's read (`continuation-wake.ts:41, 106, 163-171`). A public
  RPC cannot be landed inside that window on purpose. The wake-mode cases revoke while the delegate
  waits to fire, so the router refuses them first, at enqueue. A case that raced the window would
  sometimes be refused at enqueue and sometimes adopted while still current, and could pin no stage.
  **Covered instead, deterministically and not live,** by the product's own pin:
  `src/auto-reply/continuation/continuation-wake.test.ts:654` asserts
  `[continuation:return-refused] stage=wake reason=recipient-authority-changed …` in the test at
  `:633`, "refuses a return whose recipient authority an owner change advanced". The pin was
  re-verified at the merged head with `oc-focused --revert-proof` against j12 `352f5602`:
  - **PROVEN**: GREEN 19 passed (19), RED 1 failed | 18 passed (19), the one red being that test;
  - run in a detached worktree at `1ab5a73e`, with deps linked from `openclaw-j12-deps`
    (`pnpm-lock.yaml` sha256 `a4623b23…` equal);
  - config `test/vitest/vitest.infra.config.ts`; 66 source paths reverted, 72 test-side paths kept.

  Neither the test file nor `continuation-wake.ts` changed from `e9dc1c31`, nor from `1ab5a73e` to
  `2907e656` to `a22bd9c05c`; the pin was re-run at neither. That is test proof of the wake-stage
  refusal, **not live proof** (🌊, room msg 1567201185243332681).
- **An enqueue refusal that names a row.** Same reason: `targeting.ts:343-347` and `:369-374`
  refuse a row only when the epoch advances between the router's reads, a window of the same kind.
  The wake-mode cases pin the first read (`:277-280`), which refuses before any row.
- **A kept `continue_work` wake refused at replay or adoption, by any other transition, or allowed.**
  `work-revoked-visibility` pins `stage=wake` with a visibility narrowing on a live gateway. The
  replay sweep runs only at custody boot (`custody-boot.ts:114-121`). The adoption check refuses a
  wake only when the handoff could not read the authority (`work-recipient-authority.ts:116-124`)
  or the authority moved after the handoff's read (`work-recipient-authority.reset.test.ts:316-334`).
  That window is the claim-to-turn span, and the case's transition settles long before the wake is
  due. A Gateway delete cancels the wake instead of refusing it. An owner change needs a second model
  turn, and a member removal needs a known identity. No case elects an allowed `continue_work` wake,
  so the row has no positive control of its own showing that a work wake turn's rows appear in
  `chat.history`. The case's absence rests on the product line, which is logged only after the
  record failed (`work-recipient-authority.ts:133-141`), on a failed record never being claimed
  again (`work-store.ts:226, 260`), and on the same transcript projection that shows the allowed
  cases' woken runs. These are covered by unit pins instead, deterministic and not live:
  - `src/auto-reply/continuation/work-recipient-authority.reset.test.ts`: every handover (owner
    change, visibility narrowing, member removal, delete and recreate) at the wake and replay
    stages, for bound and unbound records (`:270-288`); the Gateway delete cancelling the wake
    (`:290`); the adoption boundary (`:308-374`); a same-owner `/new` and `/reset` keeping the
    bound wake (`:246-266`); and an unbound wake (`:376-406`);
  - `src/auto-reply/continuation/work-recipient-authority.incognito.test.ts`: the incognito pin from
    `f52dc67e` (`:235`, an incognito election fails visibly and elects nothing) and the bound
    control (`:285`).
- **The incognito fanout refusal and the memory-store maintenance separation.** They are proven by
  the product's unit pins, not by this row:
  - `src/auto-reply/continuation/delegate-recipient-authority.incognito.test.ts`: an incognito
    election refused and nothing left, `post-compaction` with no fanout, `tree` and `all`, and
    `normal` `tree` and `all` (`:58-76`); a durable session's `post-compaction` `tree` and `all`
    fanout still elected and delivered (`:78-104`);
  - `src/config/sessions/session-actor-memory.test.ts`: an incognito memory store's maintenance keeps
    a live custody owner past the entry cap without opening the ambient state database (`:458`);
  - `src/agents/subagents/registry/subagent-registry-maintenance.test.ts`: continuation rows read from
    the maintained store's state root, never the ambient one (`:159`), and a memory store's live
    custody owners kept without reading rows or awaiting readiness (`:167`).

  Every case's sessions live in the gateway's durable store, and every delegate case elects one
  explicit `targetSessionKey`, never a fanout, so no case reaches either path
  ([what they change for this row](#the-incognito-fanout-refusal-and-the-memory-store-maintenance-separation)).
- **The grant's refusals.** Revocation (a revoked device), a narrowed scope ceiling, a grant used
  under another session, expiry and a restart are proven by the product's unit pins in
  `src/agents/subagents/spawn/subagent-spawn.continuation-operator-grant.test.ts` (`:387`, `:398`,
  `:409`, `:435`, `:446`; the disconnect at `:320`). The grant's lane revert-proved them (7 RED
  against `1ab5a73e`). This row cannot drive them: no case revokes the elector's device, narrows its
  scopes, copies a grant to another session or waits out its hour. Its cases only spawn under a
  grant that holds. That its own shared-token owner client gets one is read from the bytes, not
  pinned. Nor does a PASS show that a spawn used the grant: the row reads nothing that tells a
  grant spawn from one under its still-open connection
  ([the grant](#the-delegate-dispatch-grant-and-this-rows-operator-connection)).
- **"Settled as refused" from the record.** j12′ retires a refused row as a bounded `failed`
  receipt, never `recovered` (`return-refusal.ts:53-66`; the sweep's settlement,
  `session-delivery-queue-recovery.ts:161-180, 208-213`). But no public surface reads that receipt:
  the gateway health's failed count leaves it out on purpose (`delivery-queue-sqlite.kernel.ts:397-429`,
  the filter at `:413-420`, surfaced by `gateway/health/collector.ts:640-654`), and the receipt
  lookup has internal callers only. The row never reads SQLite for it. Refusal is read from the
  reason line and the absence of adoption. A refused work record fails with
  `failureReason` `recipient-authority-changed` (`work-store.ts:639-655`); no public surface reads
  that either.
- **The delivery id's derivation.** The id is `sha256` of
  `continuation-return:v1:<child>:<childRunId>:<target>`
  (`announce-idempotency.ts:11-16`, `subagent-announce.continuation-return.ts:174`,
  `targeting.ts:291`, `session-delivery-queue-storage.ts:275-280`). The child run id the announce
  uses is not on a surface the row can read with certainty, so the row does not recompute it. It
  binds the line's id to the case another way: the line names the case's own disposable target,
  which only this case's return ever reaches, and every line for that target names the same row.
  The receipt publishes the id as SHA-256 only, and a work refusal's `flowId` too.
- **A per-target addressability check.** j12′ has none, as j12 had none: the binding is captured
  for any key, existing session or not (`session-recipient-authority.worker.ts:36-56`).
  "Unauthorized" here is the `crossSessionTargeting` policy, the only admission refusal j12′ has.
- **Refusal telemetry.** j12′ counts a refusal on `continuation.queue.drain`
  (`queue.refused_count`, `refusal.reason`, with no session identity; a refused `continue_work`
  wake too, `work-recipient-authority.ts:142-148`). It also counts one on
  `continuation.queue.fanout` (`fanout.refused_count`, `refusal.reason`, and 12-hex SHA-256
  prefixes of the recipient keys), but only for a fanout mode or several recipients, which no case
  drives (`targeting.ts:413-427`; `continuation-tracer.ts:178-204`, the hashes at `:194-197` and
  `:1000-1010`). The control collects no spans, so the row claims none.
- **The supervised-restart claim.** That is `R-CD-RETURN-COVENANT-AUTHORITY`'s. `replay-restart`
  uses the same supervised branch to replay a parked return; it never reads or feeds that row.
- **Multi-recipient fanout, cross-agent recipients, the bracket-token form, explicit revocation.**
  `tree`/`all` fanout and recipients of another agent are outside the cases. The token form is not
  driven (R-CD-TOKEN covers targeted bracket returns). j12′ has no explicit revocation API.
- **Fresh install or upgrade.** Proposed separately (docs#619, `R-CD-FRESH-INSTALL`).
- **Session maintenance that evicts a row session.** At its defaults (`store-maintenance.ts:26-34`)
  maintenance cannot reach any row session in a run
  ([below](#the-merged-heads-other-lanes-on-the-rows-gateway)). The row does not prove what a
  lowered `session.maintenance` would do.
- **Anything an owner has not run at the docs head.** 🕯's two runs, `rra-88e4fd22f0b122a8` (docs
  `935898d1`, 10/13 PASS-candidate) and the fresh 13 `rra-a4d5318d426ad728` (11/13), are folded
  nowhere. Both ran at `2907e656`, which this head refuses, so neither is carried to `a22bd9c05c`.
  The row passes only from one run of all thirteen cases at the pin.
- **The early-enqueue ordering as a row claim.** A revoked case's transition that lands before its
  return is enqueued is refused at `stage=enqueue` with no row. That is the product's correct refusal,
  and it is pinned only as a dry-run case of its own, never as the revoked case
  ([the early-enqueue ordering](#the-early-enqueue-ordering-pinned-apart)).
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

Byte-read with `git show` / `git grep` at `2907e656`. Files unchanged since `e9dc1c31` are cited at
their lines there; the six the merge changed by `1ab5a73e`, and the five the grant changed by
`2907e656`, are cited at their new lines. Of the files `a22bd9c05c` changed, the row cites three; they
were re-read at `a22bd9c05c`, and two cites moved. Every other cited file is byte-identical from
`2907e656` to `a22bd9c05c` ([the re-walk](#cites-re-walked-at-the-merged-j12)). The scenario header
(`scenarios/r-cd-recipient-authority.js`) carries the same map.

### What changes a recipient's authority

Authority is one UUID epoch per logical session key in `session_recipient_authority` (per-agent
database). A captured binding is current only while the stored epoch equals it
(`src/config/sessions/session-recipient-authority-types.ts:96-101`). While a gateway runs, only five
sites write an epoch: the four advances below and the first capture
(`session-accessor.sqlite-recipient-authority.ts:17-37` and its callers). Two more insert a row, and
neither runs during a case: the legacy import (`src/state/openclaw-agent-db-session-migrations.ts:403-417`)
and doctor's canonical-key repair (`src/commands/doctor-session-recipient-authority-repair.ts:68-78`).

| Public RPC | Effect on the target's epoch | Path at j12′ |
|---|---|---|
| `continue_delegate` (model turn), capture | insert-if-absent for any key, before the `scheduled` toolResult | `continue-delegate-tool.ts:424-449`, `delegate-flow-store.ts:432-452` (the binding at `:435-442`), `session-recipient-authority.worker.ts:36-56` |
| `continue_work` (model turn), capture | insert-if-absent for the electing session, **after** the `scheduled` toolResult: the tool only queues the request, and the turn schedules the election after its attempt, capturing first | `continue-work-tool.ts:84-110`, `agent-runner-embedded-candidate.ts:222-224`, `agent-runner-continuation-signal.ts:467` -> `work-dispatch.ts:662-668` -> `work-operator-continuation.ts:34-52` -> `work-recipient-authority.ts:63-67` |
| `sessions.delete` | advances (every deletion owner); the epoch row outlives the session, so `sessions.create` of the same key keeps the advanced epoch. It also consumes the session's queued events and cancels its own custody | `session-accessor.sqlite-entry-store.ts:56-69`, `server-methods/sessions-delete.ts:589`; queued events: `sessions-delete.ts:454-470` -> `session-lifecycle-cleanup.ts:74-92` (reason `delete`, `:90`) -> `session-reset-runtime-cleanup.ts:77-93` -> `session-reset-runtime-state.ts:11-51` -> `session-reset-cleanup.ts:149-227` (custody cancelled at `:171-175`, events consumed at `:202-203`) |
| `session.visibility.set` (narrowing) | advances, for every writer; rank shared > suggest > read-only > draft | `session-accessor.sqlite-entry-mutation.ts:119-136`, `sessions-sharing.ts:527-610`, `session-recipient-authority-types.ts:75-108` |
| `session.members.remove` | advances | `session-sharing-store.native.ts:150-195`, `sessions-sharing.ts:337-423, 616` |
| `sessions.assignOwner` (owner changes) | advances. It refuses a caller that is neither an agent runtime nor a human profile, so only the agent's `sessions` tool `assign_owner` can drive it here | `session-accessor.sqlite-owner.ts:158-182`, `sessions-mutations.ts:343-518` (`:362-374`), `agents/tools/sessions-tool.ts:384-419` |
| `sessions.reset` | **none**: rotates the session in place; only an incognito reset deletes. At j12′ its runtime cleanup ends only the replaced head's own custody and keeps its queued elections | `sessions-mutations.ts:593-678`, `gateway/session-reset-service.ts:651-741, 751, 1032-1043`; cleanup reason at `:560-566` -> `session-reset-cleanup.ts:171-175` (`retireReplacedHeadContinuations`) |
| `config.patch` `agents.defaults.continuation.crossSessionTargeting` | none; it is the admission policy, default disabled, read at each decision, reloaded hot | `continuation/config.ts:84-92, 128-129`, `server-methods/config.ts:798-980`, `config-reload.prepared-model-runtime.test.ts:74-96` |

Sharing mutations need the session owner or `operator.admin` (`sessions-sharing-authority.ts:144-156`).
A loopback backend client with the shared token keeps the scopes it asks for
(`ws-connection/connect-auth.ts:286-296`, `handshake-auth-helpers.ts:165-187`).
`session.members.add` accepts only a known identity (`sessions-sharing.ts:347-361`).

### Where a targeted return is bound, checked, enqueued, woken and adopted, and what a refusal leaves

Every refusal of a return goes through one reporter
(`src/auto-reply/continuation/return-refusal.ts:16-36`, subsystem `continuation/return-refused`).
It logs `[continuation:return-refused] stage=<stage> reason=recipient-authority-changed
session=<key>[ deliveryId=<id>]`. On the console that line follows the
`[continuation/return-refused]` tag (`src/logging/subsystem.ts:158-194`), and the structured file log
keeps `stage`, `reason`, `sessionKey` and `deliveryId` as fields beside the message
(`return-refusal.ts:33-35`; `subsystem.ts:317-330`). A written row is retired as a bounded `failed`
receipt (`return-refusal.ts:53-66`).

| Boundary | Path at j12′ | On a stale or unauthorized return | Observable reason |
|---|---|---|---|
| Admission (tool) | `continue-delegate-tool.ts:353-362` | ToolInputError, nothing accepted | the toolResult text: "cross-session continuation targeting is disabled ..." |
| Dispatch | `continuation/delegate-dispatch.ts:268-291`, before the spawn's grant is restored (`:449-484`) | custody failed, owner notice, no child | log `[continuation:delegate-rejected] policy.cross_session_targeting ... session=<dispatcher>`; `continuation.disabled` span with `disabledReason` |
| Routing | `subagent-announce.continuation-return.ts:98-215` | delivers to the current recipients only; wakes them unless the mode is silent (`:175`) | `[continuation:targeted-return] Delivered to <keys> from <child>` names only delivered recipients, and is **not logged at all** when every recipient was refused (`:189-203`) |
| Enqueue, before the row | `continuation/targeting.ts:277-280` (reporter `:261-276`) | refused, no row, no wake | `stage=enqueue`, **no** `deliveryId` |
| Enqueue, after the row | `targeting.ts:313-347`, `358-374` (refused at `:343-347`, `:369-374`); a current return queues an adoption-scoped event (`:322-341`) and requests a wake (`:395-403`) | row retired as a `failed` receipt, queued event removed | `stage=enqueue deliveryId=<row>` |
| Wake handoff | `continuation-wake.ts:127-256`; 250 ms after the request (`:41`, `:106`); authority read `:163-171` | `settleStaleSystemEventAuthority` retires it (`:233-243` -> `session-system-event-adoption.ts:118-147`) | `stage=wake deliveryId=<row>` |
| Prompt drain | `reply/session-system-events.ts:192-207`; final adoption re-checks under writer admission (`session-system-event-adoption.ts:191-211, 248-270`) | refused before formatting | `stage=prompt-drain deliveryId=<row>` |
| Durable replay (45-75 s pending sweep, boot recovery) | `server-restart-sentinel-delivery.ts:263-281, 307-329` -> `refuseStaleAuthorityReplay` (`server-restart-sentinel-delivery.ts:50-76`); sweep `session-delivery-queue-runtime.ts:52-66, 143-160`; boot `server-restart-sentinel.ts:80-97, 138-153` | **defers** while the row has a queued copy in memory (`server-restart-sentinel-delivery.ts:61-65`); otherwise refused and dead-lettered with its receipt kept (`server-restart-sentinel-delivery.ts:72-75`) | `stage=replay deliveryId=<row>` (`server-restart-sentinel-delivery.ts:66-71`), plus the sweep's `dead-letter decision for entry <row>` warn (`session-delivery-queue-recovery.ts:164-166`) |
| Settlement | `session-delivery-queue-recovery.ts:152-215` | refused: `moved-to-failed` with a bounded receipt (`:161-180, 208-213`); adopted: `recovered` (`:156-160`) | none public: health's failed count excludes the receipt (`delivery-queue-sqlite.kernel.ts:397-429`) |
| Adoption | the turn input carries the ids (`managed-delivery-turn-lifecycle.ts:107-111`), written to the row as `__openclaw.sessionDeliveryAckIds` (`src/sessions/user-turn-transcript.metadata.ts:102-104`); read back at `session-system-event-adoption.ts:53-71`. A `sessions.send` turn stages its input before the drain (`chat-send-input-dispatch.ts:330-350`), its recorder refuses the ids (`user-turn-transcript.ts:130-140`), and it adopts without a receipt (`session-system-event-adoption.ts:287-296`) | n/a | `chat.history` hides the wake's own rows, and no `sessions.send` row carries the marker, so every adoption is read from the primed target's `TARGET-ACK`: a wake's in its own run, the probe turn's in the probe run ([below](#allowed-silent-the-probe-runs-target-ack)) |

### Where a kept `continue_work` wake is bound, checked and refused

A refused kept wake has its own reporter: `return-refusal.ts:38-46`, subsystem
`continuation/work-refused`. It logs `[continuation:work-refused] stage=<replay|wake|adoption>
reason=<recipient-authority-changed|recipient-authority-unverifiable> session=<key> flowId=<id>` on
the console behind the `[continuation/work-refused]` tag, with the same fields in the file log
(`:45`). `recipient-authority-unverifiable` is only for a record elected before the binding existed
(`work-recipient-authority.ts:69-93`); a bound one is refused as changed.

| Boundary | Path at j12′ | On a stale binding | Observable reason |
|---|---|---|---|
| Election (capture) | `work-dispatch.ts:631-740`; the capture at `:662-665` precedes `electedAt` (`:667`) and the due time (`:668`); an election inside its turn is anchored to the turn's finalization (`work-store.ts:315-365`) | a failed capture elects nothing | none |
| Replay (custody boot) | `custody-boot.ts:114-121` -> `work-recipient-authority.ts:159-171` | refused before startup recovery drives it | `stage=replay` |
| Wake handoff | the work timer drives the dispatcher with no busy check first (`work-dispatch.ts:169-199`), which claims the due record (`work-store.ts:213-313`) and refuses a stale binding at `work-dispatch.ts:529` -> `work-recipient-authority.ts:102-152`, before the busy, fold and grant branches (`work-dispatch.ts:573-627`) | the record fails with no notice (`work-recipient-authority.ts:133-141` -> `work-store.ts:639-655`) and its custody is released; it is never claimed again (`work-store.ts:226, 260`) | `stage=wake` |
| Adoption | `work-dispatch-execution.ts:267, 450`, before the turn-start fence (`:270-276`) and the fold note | refused; a stale wake reaches it only when the handoff could not read the authority (`work-recipient-authority.ts:116-124`) or the authority moved after the handoff's read | `stage=adoption` |

## The cases

Each case is its own signed receipt, in this order, on one gateway the control started.
`replay-restart` replaces that gateway, so it runs last.

| Case | Transition (public RPC) | Mode | Refused at | Reason it must show | Absence it must show |
|---|---|---|---|---|---|
| `allowed` | none | silent-wake | n/a | n/a | n/a. **Direct wake:** exactly one `TARGET-ACK <nonce>` in the woken run (a non-priming, non-probe run), the receipt labelled `direct-wake`. **Probe-mediated fallback**, only when the woken run has no ack: the conditional probe, and exactly one `TARGET-ACK <nonce>` in that probe's own run, sent after `Delivered to <target> from <child>`, none in a wake turn, the receipt labelled `probe-mediated` ([the fallback](#allowed-the-direct-wake-path-and-the-probe-mediated-fallback)). Either way none in the parent, epoch unchanged |
| `allowed-across-reset` | `sessions.reset` after capture, then re-prime | silent-wake | n/a | n/a | as `allowed`, and the epoch unchanged by the reset |
| `allowed-silent` | none; the silent return parks, then the probe turn adopts it | silent | n/a | n/a | n/a: exactly one `TARGET-ACK <nonce>` in the probe's own run, sent after the router's `Delivered to <target> from <child>` line, none in a priming run, no other-nonce ack, no wake. The child spawned, bound and done, one acceptance, no scenario refusal. The positive control for the refusal cases' absence: it proves the return reached the probe turn, through the model's ack, without SQLite ([the oracle](#allowed-silent-the-probe-runs-target-ack)) |
| `unauthorized-admission` | `config.patch` policy disabled before dispatch, then restored | silent-wake | admission | the continue_delegate policy error | no child, no target ack (the probe run's included), no woken target run, no parent landing |
| `unauthorized-dispatch` | `config.patch` policy disabled after the `scheduled` result, then restored | silent-wake | dispatch | `[continuation:delegate-rejected] policy.cross_session_targeting` for the dispatcher | as above |
| `revoked-visibility` | `session.visibility.set` to `read-only`, sent only once the control witnessed the parked copy: the router's `Delivered to` line for the target from the case's child ([the witness](#revoked--the-parked-copy-witnessed-before-the-transition)) | silent | `stage=prompt-drain`: the sweep defers to the queued copy (`server-restart-sentinel-delivery.ts:61-65`), and the probe turn's drain refuses it (`session-system-events.ts:192-207` -> `session-system-event-adoption.ts:118-147`) | `[continuation:return-refused]` for the target, with a `deliveryId`, after the probe was sent | no `Delivered to` for it once the transition settled, no `TARGET-ACK` in the probe run or any later run, no woken run, no return marker, an answered probe turn, no parent landing |
| `revoked-membership` | `session.members.add` before dispatch, `session.members.remove` once the parked copy was witnessed, as above | silent | `stage=prompt-drain`, as above | as above | as above |
| `revoked-owner` | the `sessions` tool `assign_owner` (agent `main`) from an operator session, once the parked copy was witnessed, as above. Its early-enqueue ordering (🕯's `rra-a4d5318d426ad728`) is a separate dry-run pin, never this case ([pinned apart](#the-early-enqueue-ordering-pinned-apart)) | silent | `stage=prompt-drain`, as above | as above | as above |
| `reassigned` | `sessions.delete` then `sessions.create` of the same key, once the parked copy was witnessed | silent | `stage=replay`: the delete consumes the queued copy (`sessions-delete.ts:454` -> `session-reset-cleanup.ts:202-203`), so the pending sweep refuses the row (`server-restart-sentinel-delivery.ts:271-281` -> `:66-71`). **Or** `stage=prompt-drain`, when a pending sweep replayed the row between that consume and the deletion's epoch commit and re-queued the copy (`server-restart-sentinel-delivery.ts:263-274, 307-314`) ([the two orderings](#reassigned-two-orderings-each-with-its-bytes)) | `[continuation:return-refused]` for the target, with a `deliveryId`: after the transition at `replay`, after the probe was sent at `prompt-drain` | as above |
| `wake-revoked-visibility` | `session.visibility.set` to `read-only` after the `scheduled` result, before the delegate fires | silent-wake | `stage=enqueue`: the router's first authority read refuses it before any row (`targeting.ts:277-280`) | `[continuation:return-refused]` for the target, with **no** `deliveryId`, after the transition | no `Delivered to` line for it at all, and the rest as above: no ack in the probe run or later, no wake turn or final effect |
| `wake-reassigned` | `sessions.delete` then `sessions.create` of the same key, after the `scheduled` result, before the delegate fires | silent-wake | `stage=enqueue`, as above | as above | as above |
| `work-revoked-visibility` | the session elects its own `continue_work` wake (30 s delay); once the election is captured, `session.visibility.set` to `read-only` on that session, before the wake is due | n/a (`continue_work`) | `stage=wake`: the dispatcher's handoff refuses the stale binding (`work-dispatch.ts:529` -> `work-recipient-authority.ts:102-152`) | `[continuation:work-refused] stage=wake reason=recipient-authority-changed` for the session, naming one election, after the transition and before the probe | no wake turn (no assistant run but the electing run and the probe's), an answered probe turn. Adoption into the probe turn is ruled out by the bytes, not a marker: the work line precedes the probe (below the table, its own paragraph after "How absence is observed"); the marker count is a check only |
| `replay-restart` | `session.visibility.set` once the parked copy was witnessed, then a supervised restart before any prompt | silent | `stage=replay` on the replacement: no copy survives the restart, so its boot recovery refuses the row (`server-restart-sentinel.ts:138-153` -> `server-restart-sentinel-delivery.ts:271-281` -> `:66-71`) | as `reassigned`, from the replacement generation, after the restart | as above, on the replacement |

"Parked" means the router's `Delivered to <target>` line precedes the transition: the return was
admitted while current and sits un-adopted (mode silent does not wake). The control saw that line,
from the case's child, before it let the transition be sent: a parked case's drive ends once its child
returned, and its transition runs in a phase of its own that the control starts only on that line
([the witness](#revoked--the-parked-copy-witnessed-before-the-transition)). A wake-mode case is the
opposite: its transition settles before the delegate's delay ends, so its return is never routed.
The control samples the epoch every 500 ms: captured after the `scheduled` toolResult and strictly
before the transition, again after it, and at the end. For `work-revoked-visibility` the capture
follows the `scheduled` toolResult. During a case only the capture and the case's own transition
write that session's row, so the first sample holding it is the capture, and the sample before it,
without the row, bounds it from below.

**One stage per ordering.** Each refused return's stage comes from where its queued copy is when its
epoch advances. The bytes allow exactly one first refusal per case, except `reassigned`, which has
two orderings the harness cannot prevent, each with its own stage and the second with its own
witness line:

- `revoked-visibility`, `revoked-membership`, `revoked-owner`: none of these RPCs touches the
  target's queued events (`sessions-sharing.ts`, `session-accessor.sqlite-owner.ts`), so the sweep
  defers to the copy and only a prompt drain can see it. The disposable target has no turn until
  the probe. Nothing the merge added drains it earlier: wake admission refuses only work wakes, and
  the reset's re-arm and maintenance never touch a return another session owes this one. That
  holds only for a copy queued before the transition, which the control's witness now forces. A
  transition that lands first is refused at `enqueue`, before any row: the early-enqueue ordering,
  pinned apart and never this case's.
- `reassigned`: the delete consumes the copy, so normally no drain can see it and the sweep refuses
  the row (`replay`). At j12′ a delete still cancels the session's own custody and consumes its queued
  events (`session-reset-cleanup.ts:171-175, 202-203`); only `/new` and `/reset` keep queued
  elections. The scenario waits two sweep periods (`OPENCLAW_RCD_RA_SWEEP_WAIT_MS`, 160 s) before its
  probe. A sweep that came later would still refuse at `replay`. The one other ordering, a sweep
  inside the delete, re-queues the copy and leaves `prompt-drain`
  ([below](#reassigned-two-orderings-each-with-its-bytes)).
- `wake-revoked-visibility`, `wake-reassigned`: the epoch has advanced before the child returns,
  so the router's first read refuses it.
- `work-revoked-visibility`: the replay sweep runs only at custody boot, and no restart comes
  between election and wake. The handoff reads the authority right after the claim, before the
  busy, fold, admission and turn-start-fence branches that would run the wake. The claim itself only
  interrupts a record that already carries a fence (`work-store.ts:273-282`), which a wake that never
  started does not. So the first boundary to see the wake is the handoff, and once refused the record
  is failed and seen by no later boundary.
- `replay-restart`: the old generation never prompts the target, and its sweep defers to the copy,
  so the first boundary to see the row is the replacement's boot recovery. Custody boot's new
  `continue_work` replay sweep reads only work records, and the case has none.

The first line naming the target must carry that stage. One later line is possible, and only in
the prompt-drain cases: a `replay` line naming the same row. The pending sweep may load the row
just before the probe's drain retires it. The drain moves the row to `failed` and consumes the
event before it reports (`session-system-event-adoption.ts:125-146`). `refuseStaleAuthorityReplay`
checks only the queued copy (`server-restart-sentinel-delivery.ts:61-71`), so the sweep then reports
the row once more. The lib names this as `laterStages: ['replay']` for those three cases, and for
`reassigned`'s `prompt-drain` ordering (`otherFirstStages`). Any other first stage, any other later
stage, another row, or a row-less line where the stage writes one leaves the case MISSING
(`refusal-stage-mismatch`, `reason-delivery-id-ambiguous`). For
`work-revoked-visibility`, every line must be `stage=wake` and name the one election
(`refusal-stage-mismatch`, `reason-flow-id-ambiguous`).

**How absence is observed.** The target is primed before each case: "On a later turn, only if an
internal task completion for proof <suffix> is in your context, reply exactly `TARGET-ACK <nonce>`"
(the scenario's `prime()`). Nothing else the harness sends names the ack: the probe names neither
the ack nor the row nonce ([the conditional probe](#the-conditional-probe)), and the delegate's task
carries the nonce but never the ack marker. The probe tells a target whose context includes the task
completion to follow its priming instead, and any other to reply `PROBE-OK <probeNonce>`. So an ack
in the probe run is the primed target answering a return that reached its context, and a refused
return, which never reaches the target, leaves the probe run with nothing to ack. The absence is read from the probe run
(`probeAckRows`, bound by the run id `sessions.send` returned for the probe) and from every later
non-priming run (`ackRuns`). `allowed-silent` is the control: the same park and the same probe, where
the ack must show. Without it the row cannot pass, because the refusal cases' "no ack" would be
unproven. A wake turn's own rows stay hidden, so a wake is read from its visible assistant rows (a
woken run that is neither priming nor probe).

The product's adoption marker, `__openclaw.sessionDeliveryAckIds`, is no part of this. No pin writes
it on a `sessions.send` turn's row
([the bytes](#allowed-silent-the-marker-a-sessionssend-turn-never-carries)), so it is 0 whether or
not the probe turn adopted the return. The grade still counts it: a marked row in a refusal case
would be FAIL (`refused-return-adopted`). It is never the evidence of an adoption or of an absence.

For `work-revoked-visibility`, the electing run plays the priming run's part: it is the one run
excluded, because the model may quote its own reason there. Any other assistant run but the
probe's is a wake turn. The wake's reason asks for `RCDRA-WOKE <nonce>`, so a wake that ran would
leave a visible row. That marker is counted nowhere, so a model repeating it in the probe turn
decides nothing. Adoption into the probe turn is ruled out by the bytes, not by a marker: the work
line is logged only after the record failed, a failed record is never claimed again, and the line
must precede the probe (`reason-not-before-probe`).

## The fresh 13's misses at `2907e656`

🕯's fresh 13 (`rra-a4d5318d426ad728`, room msg 1567622903074390167) left two cases open. 🌊's ruling
on both, room msg 1567623059727458526, is quoted in the rulings list above. Each decision below is
read from the bytes at `2907e656`.

### `revoked-*`: the parked copy witnessed before the transition

**What the run showed.** `revoked-owner` was refused at `stage=enqueue`: the owner change settled
before the return was enqueued. The router's first authority read refused it before any row
(`targeting.ts:277-280`), so there was no `Delivered to` line, no parked copy and no probe-drain
stage. The grade read MISSING (`return-not-parked-before-transition`, `refusal-stage-mismatch`),
never FAIL: an enqueue refusal is the product's correct answer to that ordering. The scenario had
waited for the child to be done plus `_PARK_MS`, then sent the owner change. That wait did not
force the ordering: a child done in `sessions.list` is not yet a routed return, and the owner change
is a model turn of its own.

**The witness.** No gateway RPC reads a non-main session's queued system events.

- `peekSystemEventEntries` and `peekSystemEvents` (`src/infra/system-events.ts:717, 737`) are called
  in process: the reset cleanup, hook dispatch, session creation, session-state notices, the plugin
  SDK runtime and the status summary. No file under `src/gateway/server-methods` but a test names
  them.
- The one RPC that returns queued events, `status` (`src/gateway/server-methods/health.ts:131-142` ->
  `src/status/summary.ts:503-514`, returned at `:561`), peeks only each agent's canonical main
  session. A row target is a disposable session, never that one.

So the public surface is the router's console line, the one the row already reads as the park
(`RRA_PARKED_COPY_WITNESS_BYTES`):

- `[continuation:targeted-return] Delivered to <keys> from <child>` is logged only for
  `deliveredSessionKeys` (`subagent-announce.continuation-return.ts:198-203`), through
  `defaultRuntime.log` to the console the control reads (`src/runtime.ts:80-88`);
- `targeting.ts:409` adds the target there only after:
  - the row was written (`:304`);
  - its in-memory copy, carrying the row's ack id, was queued (`:322-341`: `enqueueSystemEvent` at
    `:339`, or already queued, `hasQueuedSystemEventDelivery` at `:340`);
  - the authority was re-read current after the queueing (`:358-375`);
- a return refused at any of those reads (`:277-280`, `:343-347`, `:369-374`), held for a reset
  (`:350`) or held by a full queue (`:380`) never enters it;
- a silent return requests no wake (`subagent-announce.continuation-return.ts:175`,
  `targeting.ts:395`), so the copy stays parked until a turn of the target drains it, and the
  disposable target has no turn until the probe.

So that line, naming the case's target and coming from the case's child, witnesses the parked copy.

**The forced ordering.** The scenario cannot read the gateway's console, so the control gates it:

1. A parked case's drive ends once its child is done (`handoff.ready_for_witness`), before any
   transition.
2. The control waits, up to `OPENCLAW_RCD_RA_WITNESS_WAIT_MS` (120000), for the router's line for
   the case's target from the case's child in its gateway's console since the case began
   (`findParkedCopy`).
3. Only then, only after a drive that recorded no refusal and passed its preflight, and only while
   it still owns the listener, does it run the case's transition phase
   (`OPENCLAW_RCD_RA_PHASE=transition`). That phase carries the drive's state and does the rest: the
   pre-transition read, the transition, the sweep wait, the probe and the final reads, or for
   `replay-restart` the restart handoff. The scenario refuses a transition phase whose drive did not
   hand over, or already sent a transition.

With no line, nothing is changed: no transition phase runs, and the case is MISSING
(`parked-copy-unwitnessed`). The record carries `witness: { parkedCopyAtMs, releasedAtMs }`. For every
parked case the grade requires:

- the witnessed line to be the park line the grade reads (`park.deliveredFromChildAtMs`);
- the release at or after it;
- the transition requested at or after the release.

Otherwise the case is MISSING `parked-copy-unwitnessed`. The witness only adds MISSING. The
ordering premise stays the park line before the transition request, so wherever that holds an ack,
wake or route of the refused return is still FAIL, as at `53c1c192`. Every other rule is unchanged: the park before the transition request,
no route while it was in flight, the epoch advanced, the reason at the pinned stage, and after the
probe for `prompt-drain`.

**Which cases.**

- `revoked-visibility`, `revoked-membership` and `revoked-owner`, as 🌊 ruled: they share the
  prompt-drain pin and the race.
- `reassigned` and `replay-restart`, the other two parked cases. Their claims need the copy queued
  before the transition too: the delete consumes it, and the restart loses it. They hit the same
  race, and their drive is the same code. The witness only adds MISSING, and `reassigned`'s sweep
  witness (`no-sweep-armed-in-transition`) is unchanged.

This re-uses the `reassigned` witness pattern (`732f2fad`, `432e2c3e`): a product console line the
control reads, recorded in the public receipt and required by the grade. What is new is that this one
also gates the scenario: the transition is never sent without it.

Its limits:

- The line shows the copy queued, not still queued at the transition. Nothing drains it before the
  probe: mode silent requests no wake, the pending sweep defers to it
  (`server-restart-sentinel-delivery.ts:61-65`), and nothing the merge added drains a return another
  session owes this one ("One stage per ordering", [above](#the-cases)).
- The control stamps a line when it reads it, never before the product wrote it, so the witness
  errs late, toward MISSING.
- A multi-line entry from another subsystem whose continuation line carries the router's text would
  read as the line: the same residual exposure as the refusal-line matchers.

### The early-enqueue ordering, pinned apart

🌊: "If the fixture also supports the earlier-enqueue ordering, pin it separately; don't let that
substitute for the parked-copy claim." It does: the driver's wake-mode path sends a case's transition
after the `scheduled` result and settles it before the delegate fires. `RRA_EARLY_ENQUEUE_PINS` holds
one pin per revoked case, `revoked-visibility-early-enqueue`, `revoked-membership-early-enqueue` and
`revoked-owner-early-enqueue`, each with its revoked case's transition and mode (`silent`) and its
own bytes:

- the transition commits before the child returns, so the router's first authority read refuses the
  return before any row: `stage=enqueue`, no `deliveryId` (`targeting.ts:277-280`;
  `refuseStaleRecipient` at `:261-276`);
- no `Delivered to` line, because the target never enters `deliveredSessionKeys`
  (`subagent-announce.continuation-return.ts:198-203`; `targeting.ts:409`).

`gradeEarlyEnqueuePin` grades a pin's record by the wake-mode rules: the transition settled before
the fire, the return never routed, the enqueue line with no row after the transition, and the
conditional probe answered `PROBE-OK` with no ack. The pins are dry-run cases only:

- they are not row cases: the manifest's `cases`, `--cases` and `--grade-row` know only the
  thirteen, and the control never runs a pin;
- a pin's record graded as a row case is `unknown-case`. In place of its revoked case's receipt the
  row is MISSING (`case-not-run`);
- relabelled as its revoked case, a pin's record is MISSING `parked-copy-unwitnessed`,
  `return-not-parked-before-transition` and `refusal-stage-mismatch`, with or without a witness
  claimed for it;
- a parked-copy receipt is no pin either (`unknown-case`).

`wake-revoked-visibility` is the same ordering for a visibility narrowing in `silent-wake`, and stays
a row case: its claim is the wake-mode refusal.

### `allowed`: the direct-wake path and the probe-mediated fallback

**What the run showed.** The return was delivered (`Delivered to`) and the child finished, but the
woken run made no credited ack: one foreign run, no probe. MISSING `woken-without-ack`, the model's
miss, never FAIL.

**The direct-wake path, unchanged.** One `TARGET-ACK <nonce>` in the woken run, a non-priming,
non-probe run, gives PASS. A return routed and never woken is still FAIL
(`allowed-return-not-adopted`): that is no wake, not a missing ack. No probe is sent for it, and a
probe or a label in the receipt never changes that FAIL. The
receipt now says which path it took: `ack.path` is `direct-wake`, else MISSING
`direct-wake-label-missing`.

**The fallback**, only when the woken run has no ack:

1. After the wait for the ack (`_WINDOW_MS` plus the delay) and the duplicate-wake wait
   (`_DUPLICATE_WAIT_MS`), the scenario reads the target once more. A woken run with no ack sends the
   probe; an ack, or no woken run, sends nothing. The read is recorded (`ack.fallbackDecision`:
   `decidedAtMs`, `wokenRuns`, `ackRuns`).
2. The probe is the conditional probe every probing case sends, its condition the target's context
   (🌊, room msg 1567656724549075047; [the context wording](#the-probes-context-wording)). It goes
   through the same text test and is named by the same hash (`probeTextSha256`, else
   `probe-text-unbound`).
3. Exactly one ack of the nonce in that probe's own run (`probeAckRows === 1`), with the probe sent
   after the router's `Delivered to` line from the case's child, gives PASS. The receipt is labelled
   `probe-mediated` (`ack.path`), and acks in a wake turn are counted apart (`target.wakeAckRuns`,
   which must be 0). The receipt never claims an ack in the wake turn.

The label is set once the probe has run. A fallback probe the gateway did not start is a scenario
refusal (MISSING), and the receipt keeps `direct-wake`. A receipt labelled `probe-mediated` is read
as the fallback, so it needs the probe to have run (`probe-turn-unobserved`); it never reads as the
direct path.

What it rejects (dry-run pins (f) and (g), and the unit tests):

| Shape | Verdict | Code |
|---|---|---|
| no ack in the probe run either (the model's) | MISSING | `probe-ack-unobserved` |
| an ack in both the wake turn and the fallback | MISSING | `fallback-after-wake-ack`, `duplicate-ack-wake-and-fallback` |
| the probe sent when the woken run had acked, with no woken run, or with no read before it | MISSING | `fallback-not-after-unacked-wake` |
| the probe sent before the delivered return, or no `Delivered to` line from the child | MISSING | `probe-not-after-return`, `return-not-routed-from-child` |
| an ack in a priming run | MISSING | `ack-before-return` |
| a wrong-nonce ack | MISSING | `ack-uncredited` (and `probe-ack-unobserved` when alone) |
| two acks in the probe run | MISSING | `probe-ack-duplicated` |
| a fallback receipt not labelled `probe-mediated`, or labelled with no probe run | MISSING | `probe-mediated-label-missing`; `probe-turn-unobserved` |
| two wake turns that each acked; two woken runs; a return in the parent | FAIL | `duplicate-adoption`; `duplicate-wake`; `return-landed-in-parent` |

An ack in both the wake turn and the probe run is MISSING, not the direct path's `duplicate-adoption`,
and is never credited (🌊's ruling (1), room msg 1567656724549075047). The priming asks for the ack
on any later turn that has the completion in its context, so a model may give both for one adoption.
Two wake turns that each acked are two adoptions, FAIL as before. The row's verdict names the path
for `allowed` (`cases.allowed.ackPaths`).

Its limits:

- The ack is the model's. The probe asks whether the target's context holds the completion, as the
  priming does. On the fallback the wake turn took the return in, so a literal model follows its
  priming and acks in the probe run. At `663fafdc` the probe asked about "this turn" instead, and a
  literal model answered `PROBE-OK`, leaving the case MISSING (`probe-ack-unobserved`). That is
  🌿's finding and pin (h) ([the context wording](#the-probes-context-wording)). A model that
  follows neither sentence still reads MISSING, never FAIL.
- A probe-mediated ack shows that the primed target's model had this proof's completion in its
  context at the probe, after a woken run. It does not show which turn took it in: the row reads no
  adoption marker, and `chat.history` hides the wake's own input rows (the adoption row in
  [the product path](#the-product-path-at-j12)). That is why the receipt says probe-mediated and
  never claims the wake turn's ack.
- `allowed-across-reset` keeps the direct-wake path only. 🌊's fallback is `allowed`'s.

### The pins, at this head and at `53c1c192`

🌊 asked for both of `allowed`'s paths to be pinned before another 13. Every pin below is a dry-run test
through the real case driver (`tests/recipient-authority-dry-run.test.mjs`), with record-level twins in
`scripts/__tests__/recipient-authority-row.test.mjs`. The RED column is those same tests run against
the lib, scenario, control and manifest at `53c1c192`, the head this lane started from.

| Pin | Shape | At this head | At `53c1c192` |
|---|---|---|---|
| (p) parked copy | every parked case sends its transition only in its transition phase, after the control's witness, and passes with it. Without the witness no transition is sent: MISSING `parked-copy-unwitnessed`. A transition phase refuses a drive that did not hand over or already sent a transition | GREEN | RED: the drive sent the transition itself after `_PARK_MS`, with no handoff and no witness, and a parked record with no witness graded PASS |
| (q) enqueue refusal | an enqueue refusal offered as the parked-copy case | MISSING, with `parked-copy-unwitnessed` | RED as a pin: the code did not exist. The verdict was already MISSING (`return-not-parked-before-transition`, `refusal-stage-mismatch`), never PASS |
| (r) early enqueue | each revoked case's early-enqueue ordering is its own pin, graded PASS by its own rules and never the parked-copy case | GREEN | RED: no pin existed |
| (w) direct wake | `allowed`'s woken run acks: PASS, no probe sent, receipt labelled `direct-wake`; never woken is still FAIL with no probe | GREEN | RED on the label only: the verdict was already PASS, and never woken was already FAIL |
| (f) fallback | `allowed`'s woken run gives no ack: one conditional probe; one ack in its own run after the delivered return, none in a wake turn: PASS, labelled `probe-mediated` | GREEN | RED: no probe was sent, MISSING `woken-without-ack` (🕯's shape) |
| (g) fallback negatives | a duplicate across the wake turn and the fallback, a probe the read did not allow, a pre-return, priming or wrong-nonce ack, a doubled ack, a wrong or missing label, another probe text, and no ack at all: each MISSING, never FAIL | GREEN | RED: no probe was sent. At record level, an ack only in a probe run with no label graded PASS, and an ack in a wake turn and a probe run graded FAIL `duplicate-adoption` |

## The live run's misses at `2907e656`

🕯's run (`rra-88e4fd22f0b122a8`, room msgs 1567548452395683961 and 1567548672252579929) left three
cases open and one collector refusal. Each decision below is read from the bytes at `2907e656`.

### `wake-reassigned`: a label collision, fixed

The scenario re-created `reassigned`'s and `wake-reassigned`'s targets under one label,
`k6 R-CD-RECIPIENT-AUTHORITY reassigned <runId>`. One control run mints one run id
(`run-recipient-authority-row.mjs:863`). A label is unique among the agent's sessions
(`session-create-service.ts:722` -> `sessions-patch-display-metadata.ts:52-53`, "label already in
use"). So `wake-reassigned`'s re-create failed before the fire, and its transition was not observed.
The re-create label now names the case: `k6 R-CD-RECIPIENT-AUTHORITY <case> reassigned <runId>`. The
scenario's only other label, at session creation, already named case, run and slot. The dry run now
runs `reassigned` and `wake-reassigned`, and then all thirteen cases, on one session store under one
run id.

### `reassigned`: two orderings, each with its bytes

🕯 observed one refusal line, `stage=prompt-drain`, 121 ms after the probe was sent
(14:25:57.970Z -> 14:25:58.091Z). The delete and create had settled at 14:23:17.969Z, 160 s earlier.
There was no adoption, wake or parent ack, and the epoch had advanced. The public receipt was not
read for this decision; the orderings below are derived from the scenario and the bytes.

The grade's premise holds only when the router's `Delivered to` line came before the delete was
requested and none came while it was in flight (`return-not-parked-before-transition`,
`return-routed-during-transition`). So the copy was queued before the delete.

A return routed after the delete is not queued at all. The router's first authority read refuses it
at `stage=enqueue` with no row (`targeting.ts:277-280`), and its re-checks after the row and the
queue (`:343-347`, `:369-374`) refuse at `enqueue` too. Its line has no `Delivered to`, so the
premise rules out that ordering.

With the copy queued first, the delete runs in this order:

1. It consumes the target's queued events: `sessions-delete.ts:454` -> `session-lifecycle-cleanup.ts:84`
   -> `session-reset-runtime-cleanup.ts:80` -> `session-reset-runtime-state.ts:36` ->
   `session-reset-cleanup.ts:202-203`. The consume and the router's enqueue use the same queue key
   (`resolveSystemEventQueueKey`, `src/infra/system-event-ownership.ts:96-105`).
2. Then it commits the deletion, which advances the epoch inside its transaction:
   `sessions-delete.ts:514` -> `session-accessor.sqlite-entry-store.ts:66-69`.

The pending sweep (every 45-75 s, `session-delivery-queue-runtime.ts:59-66, 143-160`) is the only
thing that re-checks a row whose copy was in memory (`:332-337`). Two orderings follow:

- **`replay`**, the ordering the case pins: no sweep replays the row between steps 1 and 2. The
  first sweep after step 2 finds no copy and a stale epoch, and refuses
  (`server-restart-sentinel-delivery.ts:271-281` -> `:66-71`). That holds whether the sweep comes
  before or after the re-create: the target key names its agent, so a missing entry does not
  dead-letter it (`:207, 229-237`). No later line can follow, because a refused row has no copy for a
  drain.
- **`prompt-drain`**: a sweep replays the row between steps 1 and 2. It reads the epoch as still
  current and re-queues the copy (`server-restart-sentinel-delivery.ts:263-274, 307-314`). After
  step 2, later sweeps defer to that copy (`:61-65`). The target has no turn until the probe, so the
  probe turn's drain is the first boundary to see it stale (`session-system-events.ts:192-207` ->
  `session-system-event-adoption.ts:118-147`). As in the revoked cases, a sweep that loaded the row
  just before the drain retired it may report `replay` once more.

The harness cannot keep a sweep out of that window, but it can see one in it. Nothing else re-arms a
parked row: its own drain leaves it to the sweep (`session-delivery-queue-runtime.ts:332-337`), and
the other schedulers serve other rows (a full queue, a notice, a reset hold) or a restart. Each sweep
that arms rows logs it at info, which reaches the console the control reads:
`[session-delivery-recovery] session delivery: periodic sweep armed <n> pending entr(y|ies) that no
runtime had scheduled`. The source lines:

- the skip and the log, `:466, 480-484`;
- the logger, the gateway's (`server-kernel.ts:36`) child `session-delivery-recovery`
  (`server-runtime-services.ts:441`);
- the console's default level, `info` (`src/logging/console.ts:25-33`), and its tag drops the
  `gateway` prefix (`src/logging/subsystem.ts:62, 106-120`).

A deferral itself logs nothing at the default level (`session-delivery-queue-recovery.ts:181-186`).
So the case accepts both orderings, each with its own rule (`RRA_CASES.reassigned`, `refusedAt` and
`otherFirstStages`):

| First stage | Must come | Later stage | Row | Witness |
|---|---|---|---|---|
| `replay` | after the transition | `replay` only | named on every line | none |
| `prompt-drain` | after the probe was sent (`reason-not-from-probe-drain`) | `replay` only | named on every line | a sweep arming line while the delete was in flight (`record.sweep.armedInTransition`), else MISSING (`no-sweep-armed-in-transition`) |

The witness window runs from the delete's request to the delete's own response, before the create
(`transition.deleteSettledAtMs`, recorded by the scenario). A sweep armed while the create is in
flight reads an epoch the delete already advanced, so it can only refuse. A sweep armed just before
the delete was requested does not count either. Both are conservative: such a case is MISSING and
re-run, never PASS.

Only a timestamp may precede the console tag, so another subsystem's line that quotes the sweep's
line does not count. One residual exposure is shared with the refusal-line matchers: the control
splits the console on newlines. So a multi-line entry from another subsystem whose continuation line
begins with the exact tag and message would still read as a sweep. The structured file log would
close that; the control does not read it today. Every other first stage, a `prompt-drain` after a `replay`, an `enqueue` or `wake`
line, a row-less line, and every premise and absence rule still leave the case MISSING or FAIL as
before. A repeat of the first stage's own line is not told apart, as for the revoked cases (the
record keeps distinct stages, not their order).

Neither ordering is a product defect: in both, the refusal carries j12′'s reason and precedes any
adoption. A `prompt-drain` line with no sweep inside the delete matches no ordering in the bytes. It
would mean the delete left its copy, which is a product question, and the case leaves it MISSING
for 🌊.

### `allowed-silent`: the marker a `sessions.send` turn never carries

🕯 observed `adoptedDeliveryRows=0` and `foreignRuns=0`. The child was spawned, bound and done, the
router logged `Delivered to` at 14:07:06.290Z, and the probe sent at 14:07:22.928Z replied.

The bytes say this is the product's behaviour for this shape, at every pin, not a harness read
fault. The probe is a `sessions.send`, which runs as a gateway chat send
(`sessions-messaging.ts:155-175`). Such a send stages or persists the operator's input before
dispatch (`chat-send-input-dispatch.ts:330-350`, `386-389`). It hands that recorder to the reply
(`chat-send-agent-dispatch.ts:407`), which uses it instead of building its own
(`get-reply-run-execute.ts:347-348`).

When the probe turn's drain adopts the parked return:

1. The staged recorder refuses the return's ack ids (`src/sessions/user-turn-transcript.ts:130-140`).
2. Adoption runs with `adoptedWithoutReceipt` (`session-system-event-adoption.ts:287-296`).
3. Settlement acks the row anyway (`:92`).

No row ever carries `__openclaw.sessionDeliveryAckIds` for this shape, though chat.history would keep
it (`chat-display-projection.sanitize.ts:442-475` strips only named private keys). The product pins it:
`src/auto-reply/continuation/continuation-wake.test.ts:878-920` ("reports a return adopted without a
durable receipt as unknown, though its model saw it") asserts
`not.toHaveProperty("sessionDeliveryAckIds")` (`:917`) and consumption `unknown` (`:918`). The same
test is at j12 `352f5602` `:848-890`.

Every file named here is byte-identical at `1ab5a73e`. Four of them differ at j12, none in a way
that matters here:

- `session-system-event-adoption.ts` already had `adoptedWithoutReceipt` at j12 (`:282`, `:88`);
- `continuation-wake.test.ts` already had the same test at j12;
- `subagent-announce.continuation-return.ts` and `targeting.ts`: a silent return still requests no
  wake at j12 (`:175` and `:366`).

The rest are byte-identical at j12 as well: `sessions-messaging.ts`, `chat-send-input-dispatch.ts`,
`chat-send-agent-dispatch.ts`, `get-reply-run-execute.ts`, `src/sessions/user-turn-transcript.ts`,
`user-turn-transcript.metadata.ts` and `chat-display-projection.sanitize.ts`.

The delegate dispatch grant touches no return, adoption or chat-send file. The silent mode requests
no wake (`subagent-announce.continuation-return.ts:175`, `targeting.ts:395`).

So `adoptedDeliveryRows=0` is the correct product result, and `allowed-silent` could not pass as
written. The refusal cases' "no marker" observation showed nothing either way. Each still binds its
refusal to the row through the product's reason line, which the drain logs only after it retired the
row (`session-system-event-adoption.ts:125-146`).

This lane posted the choice as a TROUBLE. 🌊 ruled (a), room msg 1567556038281007235: "TARGET-ACK
on the probe turn, bound to this case's nonce and the target's priming. Remove the impossible
`sessionDeliveryAckIds` requirement for `sessions.send`; keep the refusal lines as the negative
evidence. The oracle should reject a pre-return or wrong-nonce ACK, so it proves this return reached
this probe turn without SQLite access. … this is a row correction, not a product change."

### `allowed-silent`: the probe run's `TARGET-ACK`

The oracle, from the bytes at `2907e656`:

- **The probe run.** `sessions.send` answers with the run id of the turn it started, which is the
  send's idempotency key (`chat-send-session.ts:225`; the answer `{ runId, status: "started" }`,
  `chat-send-input-dispatch.ts:556-559, 573`). The probe's
  key is `R-CD-RECIPIENT-AUTHORITY-PROBE-<probeNonce>`, which no priming key can equal, and the
  observation also drops a probe run id that names a priming run. The probe run's rows are the target's
  assistant rows stamped with that run id (`__openclaw.runId`, read by `messageRunId`). 🕯's run
  already bound `PROBE-OK` this way.
- **The return reached the target first.** The anchor is the router's line
  `[continuation:targeted-return] Delivered to <target> from <child>`
  (`subagent-announce.continuation-return.ts:199-203`), naming this case's target among its
  recipients and this case's child as its source: `park.deliveredFromChildAtMs`, the child being the
  session `sessions.list` shows spawned by the case's parent, with a user row carrying the case's
  task marker. The router logs it only for a key in `deliveredSessionKeys`. `targeting.ts:409` adds a
  key there only after the return's in-memory event, carrying the row's ack id, was queued under a
  current authority (`:313-341`, `enqueueSystemEvent` at `:339`) and the authority was re-read as
  still current (`:356-375`). A silent return requests no wake (`subagent-announce.continuation-return.ts:175`,
  `targeting.ts:395-403`), so the target's next turn is the first to drain it: its admission adopts
  the prepared drain (`get-reply-run-admission.ts:235` -> `adoptPreparedSystemEvents`,
  `session-system-event-adoption.ts:277-314`), after the drain's stale pre-filter
  (`session-system-events.ts:192-207`) found it current. The product
  pins that such a turn's model sees the return though no row names it
  (`continuation-wake.test.ts:878-920`; the inbound context at `:911`, no marker at `:917`). The probe
  must be sent after that line (`probeSentAtMs > deliveredFromChildAtMs`). The control stamps a log
  line when it reads it (`run-recipient-authority-row.mjs:356`), never earlier than the product wrote
  it, so the comparison errs toward MISSING.
- **The child's completion is required too, but is not the anchor.** A child that completed proves
  nothing about routing; the `Delivered to` line does.

PASS-candidate needs all of:

- exactly one row in the probe run carrying `TARGET-ACK <rowNonce>` (`probeAckRows === 1`; a
  `heartbeat_respond` receipt in that run counts as one);
- the probe sent after the `Delivered to` line from the child;
- no ack in a priming run (`primingAckRows === 0`, text or any `heartbeat_respond` call), and no ack
  in any other run that the case cannot credit (`uncreditedAckRows === 0`): an ack marker, as text
  or in a `heartbeat_respond` call, followed by another nonce or none or in a row that quotes the
  harness prompt, or an exact ack in a `heartbeat_respond` call that no accepted result of its own
  run binds. Heartbeat acks are counted per call;
- no woken run: no assistant run but the priming runs and the probe's (`foreignRuns === 0`);
- the rest of the chain, as before: the child spawned, bound and done, one accepted dispatch of mode
  `silent` and no other `continue_delegate` call, no scenario refusal, the target primed, the epoch
  unchanged, no ack in the parent, cleanup and the trace.

The `adoptedDeliveryRows` requirement is gone for this probe shape. The count stays in the record as a
contradiction check: two marked rows would still be FAIL (`duplicate-adoption`).

What it rejects, each pinned by a dry-run negative in `tests/recipient-authority-dry-run.test.mjs`:

| Shape | Verdict | Code |
|---|---|---|
| no ack in the probe run (the model's miss) | MISSING | `probe-ack-unobserved` |
| a marked probe row with no ack (a product no pin is) | MISSING | `probe-ack-unobserved` |
| pre-return: the probe sent before (or with no) `Delivered to` line from the child | MISSING | `probe-not-after-return`, `return-not-routed-from-child` |
| an ack before any return, in a priming run | MISSING | `ack-before-return` |
| an ack with another nonce (or none, or in a row quoting the harness prompt), alone or beside the right one | MISSING | `ack-uncredited` (and `probe-ack-unobserved` when alone) |
| an exact ack through a `heartbeat_respond` call the turn refused | MISSING | `ack-uncredited`, `probe-ack-unobserved` |
| two ack rows in the probe run | MISSING | `probe-ack-duplicated` |
| an ack in a foreign (woken) run | FAIL | `silent-return-woke-target` |
| acks in a foreign run and the probe run | FAIL | `duplicate-adoption`, `silent-return-woke-target` |

**Its limits.** The ack is model-mediated:

- A model that does not give it reads MISSING (`probe-ack-unobserved`), never FAIL. The ack depends
  on the model applying its priming's instruction on the probe turn. The probe at `4f86dd78` asked
  only for `PROBE-OK <probeNonce>`, and that won: 🕯's receipt has the probe answered and no ack. 🌊
  then reworded the probe for every case ([the conditional probe](#the-conditional-probe)). It is
  still the same stimulus every refusal case gets, and it still names neither the ack nor the nonce.
- A model that acks unconditionally would also ack in the refusal cases' probe runs and fail them
  (`refused-return-adopted`), where the product refused correctly. The refusal lines, read first,
  show such a FAIL for what it is. An ack in the priming run, before anything was dispatched, leaves
  `allowed-silent` MISSING for the same reason. A refusal case reads only the probe run and later
  runs, because the priming instruction quotes the ack and a model may echo it there.
- The ack shows the return was in the probe turn's context. That the probe turn's own drain put it
  there rests on two things: the bytes (a silent return requests no wake) and `foreignRuns === 0`.
  `chat.history` hides an assistant row that is only a heartbeat acknowledgement
  (`chat-display-projection.history.ts:380-390, 438`), so a wrong wake that adopted the return and
  replied only that would leave no foreign run, and the probe would still see the return. The priming
  asks that later turn for the ack too, so a model that follows it would show a woken run.
- It does not show the row settled; no public surface reads that
  ([above](#the-product-path-at-j12)).
- 🕯's run had no ack in `allowed-silent`'s probe run. Its receipt reads `probe_ran: true`,
  `probeReplied: true` and `target_obs.ackRuns: 0` (room msg 1567590581796868168), and it stays
  MISSING `probe-ack-unobserved`.

### The conditional probe

🌊's ruling, room msg 1567590902694936678, is quoted in the rulings list above: "the probe's
unconditional `reply exactly PROBE-OK` conflicts with the primed target's conditional return
instruction". The priming asks for `TARGET-ACK <nonce>` only on a later turn whose context holds
this proof's task completion. The probe asked every turn for `PROBE-OK <probeNonce>` and nothing else,
and on `allowed-silent`'s turn that won.

Every case that probes now sends this text (`rraProbeText` in `lib/recipient-authority-row.mjs`),
the same but for its own nonce:

```text
[k6-proof-harness] R-CD-RECIPIENT-AUTHORITY probe <probeNonce>: If your context includes the internal task completion for the proof you were primed for, follow that priming instruction instead. Otherwise reply exactly PROBE-OK <probeNonce>.
```

- **The wording.** After the header, the text is 🌊's two sentences, word for word, with the probe's
  own nonce in `PROBE-OK ‹probe nonce›`. The condition is worded as room msg 1567656724549075047
  rules, asking about the target's context as the priming does
  ([the context wording](#the-probes-context-wording)). `Otherwise reply exactly PROBE-OK ‹probe
  nonce›.` is room msg 1567590902694936678's.
- **The header.** The header is the one the probe had before. Its `[k6-proof-harness]` tag matters:
  `hasExactSentinelText` credits no sentinel in text that carries it, so a model that echoes the
  probe is never credited with its `PROBE-OK`. The header names the row and the probe nonce, never
  the ack or the row nonce.
- **Which cases probe.** `allowed-across-reset` reads the wake's own ack and sends no probe.
  `allowed` does the same, and sends one only on its fallback, when its woken run has no ack
  ([the fallback](#allowed-the-direct-wake-path-and-the-probe-mediated-fallback)). Every other case
  sends exactly one: a parked case from its transition phase, `replay-restart` from its observe
  phase.
- **The text test.** `rraProbeTextProblems` refuses a probe that:
  - names the ack (`TARGET-ACK` in any case, or `RRA_ACK_MARKER`);
  - names the row nonce, or the proof id the priming names (its last 16 characters);
  - lacks `PROBE-OK <probeNonce>`;
  - is not exactly that text.

  The scenario runs the text test before it sends, and a probe that fails it is never sent: the case
  records a refusal and reads MISSING.
- **The receipt names it.** The scenario hashes the text it sent, with its nonce written
  `<probeNonce>` (`probe_text_sha256`), and the control carries the hash into the record as
  `target.probeTextSha256`. The grade needs it to equal `RRA_PROBE_TEXT_SHA256`, the hash of the text
  above, for every case whose probe ran; otherwise MISSING `probe-text-unbound`. `--docs-sha` is the
  operator's word, so without this a receipt would not show which probe it sent. The binding only
  adds MISSING: a contradiction is still FAIL.

How the probe's reply is graded. One of two answers counts, never both:

| Case | What the target's context holds at the probe | PASS needs | Otherwise |
|---|---|---|---|
| each delegate refusal | no return | `PROBE-OK <probeNonce>` in the probe run, and no `TARGET-ACK` in it or later | an ack, with or without `PROBE-OK`: FAIL `refused-return-adopted`; no `PROBE-OK`, or one with another nonce: MISSING `probe-turn-unobserved` |
| `work-revoked-visibility` | no return, no priming | `PROBE-OK <probeNonce>`, and no wake turn | no `PROBE-OK`, or one with another nonce: MISSING `probe-turn-unobserved`. An ack is not graded here: the session is never primed |
| `allowed-silent` | the return, drained by that turn | exactly one `TARGET-ACK <nonce>` in the probe run, after `Delivered to` from its child ([the oracle](#allowed-silent-the-probe-runs-target-ack), unchanged) | `PROBE-OK` alone: MISSING `probe-ack-unobserved`, the old run's shape. `PROBE-OK` beside the ack is neither required nor refused |
| `allowed`, on its fallback only | the return's completion, adopted by its woken run, which gave no ack | exactly one `TARGET-ACK <nonce>` in the probe run, after `Delivered to` from its child, none in a wake turn, labelled `probe-mediated` ([the fallback](#allowed-the-direct-wake-path-and-the-probe-mediated-fallback)) | `PROBE-OK` alone: MISSING `probe-ack-unobserved`. `PROBE-OK` beside the ack is neither required nor refused |

The ACK oracle is the one `4f86dd78` set, unchanged. The grade's only addition is the binding above,
which can only add MISSING. A `PROBE-OK` naming another nonce, the row nonce included, is credited
to no case.

**The old receipt.** 🕯's `allowed-silent` receipt (`rra-88e4fd22f0b122a8`) stays
`probe-ack-unobserved` and is never upgraded:

- its counts are that shape: the probe answered `PROBE-OK` (`probeReplied: true`) and no run acked
  (`ackRuns: 0`). A probe run with no ack grades MISSING `probe-ack-unobserved`, at `4f86dd78` and at
  this head;
- as sealed it reads MISSING for more than that. The control at docs `935898d1` sealed no
  `probeAckRows`, `primingAckRows` or `uncreditedAckRows`, and the grade has needed them since
  `8b3b68b7` (`transcript-not-read`). It sealed no probe hash either (`probe-text-unbound`). Either
  way it is never PASS;
- the receipt names the docs head that sent the unconditional probe;
- the row grades one run's receipts together (`receipts-from-different-runs`), so none of that run's
  receipts joins a run at the new head.

The rest of that run re-grades the same way (`--grade-row` grades each receipt again).

- Its twelve delegate receipts lack those three counts, so every head since `8b3b68b7` reads them
  MISSING `transcript-not-read`.
- At this head, every receipt whose probe ran also reads `probe-text-unbound`.
- `wake-reassigned`'s probe never ran: its re-create failed, and the scenario then skips the probe.

Its 10/13 is that run's grade at its own docs head, and the fresh 13 replaces it.

The pins, as dry-run tests through the real case driver (`tests/recipient-authority-dry-run.test.mjs`).
The scripted model reads the probe it is sent. An unconditional `PROBE-OK` wins over its priming, as
in 🕯's run. 🌊's condition, read literally, hands a target whose context holds the return back to
the priming ([the context wording](#the-probes-context-wording)). Before the conditional-probe lane
that model answered the ack and `PROBE-OK` in one row whatever the probe said, which is why the dry
run passed `allowed-silent` while the live run could not.

| Pin | Shape | At this head | At `4f86dd78` |
|---|---|---|---|
| (a) | every refusal case, no return: the conditional probe, answered `PROBE-OK <probeNonce>`, no ack | PASS-candidate | RED: the case's grade was PASS there too, but its probe was the unconditional text |
| (b) | `allowed-silent`, the return in the probe turn: exactly one ack, no `PROBE-OK` | PASS-candidate | RED: MISSING `probe-ack-unobserved`, 🕯's shape |
| (c) | `allowed-silent` answered `PROBE-OK` only | MISSING `probe-ack-unobserved` | the same; a pin of the old run's shape, new here |
| (d) | `PROBE-OK` with another probe's nonce, or the row nonce: every refusal case, and `allowed-silent` | MISSING (`probe-turn-unobserved`; `probe-ack-unobserved`) | the same; a pin, new here |
| (e) | every probing case sends one text, 🌊's wording with its own nonce, which passes the text test, and its receipt names it by hash; that text with `TARGET-ACK`, `RRA_ACK_MARKER`, the row nonce or its proof id added fails it | passes | RED: the probe was the unconditional text; the text test and the hash are new |

The unit tests in `scripts/__tests__/recipient-authority-row.test.mjs` pin three things:

- the text test's codes, and the hash against `node:crypto`;
- the grade of each answer at record level, 🕯's receipt included: its counts, the same with no hash,
  and the shape the `935898d1` control sealed;
- the binding: an unbound probe, or the unconditional one, is MISSING `probe-text-unbound` in every
  probing case. A contradiction is still FAIL when unbound: an acked refusal, a woken
  `allowed-silent` and a woken `work-revoked-visibility`.

With the binding's three grade lines removed, an unbound `allowed-silent` receipt grades PASS and
those pins go RED.

Its limits:

- The ack is still the model's. A model that follows neither sentence reads MISSING, as before.
- A model that acks with no return in its context fails a refusal case (`refused-return-adopted`). The
  refusal line, read first, shows such a FAIL for what it is.
- The dry run's model shows what the driver sends and how each answer grades. It is not evidence that
  a real model follows the condition. The owner's run at the new head is.

### The probe's context wording

🌊's ruling, room msg 1567656724549075047, is quoted in the rulings list above. It answers 🌿's
review of `663fafdc` (#620, comment 6642952113).

From the conditional-probe lane (the text from `b822d7c5`, bound by hash from `153d547d`, head
`53c1c192`) to `663fafdc`, the two instructions asked different things:

- the priming: "On a later turn, only if an internal task completion for proof <suffix> is **in your
  context**, reply exactly `TARGET-ACK <nonce>`" (the scenario's `prime()`);
- the probe: "If **this turn** includes the internal task completion for the proof you were primed
  for, follow that priming instruction instead."

They agree where the probe turn drained the return itself (`allowed-silent`) and where nothing
reached the target (every refusal). They part on `allowed`'s fallback. Its woken run already took the
return in, so the completion is in the target's context but not in "this turn". A literal model
answers `PROBE-OK`, and the case stays MISSING `probe-ack-unobserved` however correct the product.

The condition now asks what the priming asks. Only that sentence and the hash changed:

| | the conditional-probe lane to `663fafdc` | this head |
|---|---|---|
| `RRA_PROBE_CONDITION` | `If this turn includes the internal task completion for the proof you were primed for, follow that priming instruction instead.` | `If your context includes the internal task completion for the proof you were primed for, follow that priming instruction instead.` |
| `RRA_PROBE_TEXT_SHA256` | `d6187455fe5d61ff33f4255e6ece5e65fde4cd67d0d452703c4262892292b8cf` | `509c3febd79eac28a443041501ad1c23efb1f72d26772ede0b7f1d8e0e294512` |

- **The hash.** It is computed by `node:crypto` from `rraProbeText('<probeNonce>')`, never written by
  hand, and the unit test pins it so. The old text, hashed the same way, gives `d6187455…`.
- **Unchanged:**
  - the rest of the text: the header and `Otherwise reply exactly PROBE-OK <probeNonce>.` with the
    probe's own nonce. It still names no `TARGET-ACK`, `RRA_ACK_MARKER`, row nonce or proof id, and
    every probing case still sends the same text;
  - the binding (`probeTextSha256`, else `probe-text-unbound`) and the `PROBE-OK` refusal path;
  - the ACK oracle: exactly one nonce-bound ack in the probe's own run, after `Delivered to`;
  - every negative.

How each case reads the new condition:

| Case | The target's context at the probe | A literal model answers |
|---|---|---|
| each refusal | no return | `PROBE-OK <probeNonce>` |
| `allowed-silent` | the return, drained by the probe turn | the ack |
| `allowed`, on its fallback | the return, taken in by its woken run | the ack, in the probe run |
| `allowed` on its direct path, `allowed-across-reset` | no probe is sent | n/a |

**Old receipts.** A receipt sealed by a run that sent the "this turn" text names `d6187455…`. At this
head it reads MISSING `probe-text-unbound`, never PASS, and a contradiction in it is still FAIL. That
includes every receipt of 🕯's fresh 13 `rra-a4d5318d426ad728` whose probe ran: it sent that text,
the conditional probe of its time. A run's receipts are graded together
(`receipts-from-different-runs`), so the owner's fresh whole 13 at this head is every case's receipt.

**The scripted model.** The dry run's primed model now reads the condition literally:

- "your context" holds a completion that any turn took in;
- "this turn" holds only one that the probe turn's own drain adopted.

Until `663fafdc` it read both wordings as "in context". That is why pin (f) passed there although a
literal model could not. Pin (h) drives `allowed`'s fallback through the real case driver:

- at this head its probe is acked in its own run: PASS-candidate, labelled `probe-mediated`;
- with the probe reworded on the wire to the "this turn" text, the model answers `PROBE-OK`: MISSING
  `probe-ack-unobserved`. Sealed with that text's hash, the receipt is also `probe-text-unbound`;
- every refusal case and `allowed-silent` answer the same under either wording.

**The pins, RED before the fix and GREEN at this head.** This head's two test files were run three
ways:

- against the lib, scenario and docs at `663fafdc`;
- at this head with only `RRA_PROBE_CONDITION` and `RRA_PROBE_TEXT_SHA256` reverted, which gives the
  same REDs;
- at this head.

The fix itself landed at `48656f61`. Its own test files give the same REDs and GREENs. This head's
registration test also needs the status line, which landed after `48656f61`, so this head's files
read `48656f61` as 52 of 53.

| Test | At `663fafdc`, and at this head with the two constants reverted | At this head |
|---|---|---|
| dry run (h) | RED: `allowed`'s fallback is MISSING `probe-ack-unobserved`, because the literal model answered the "this turn" probe `PROBE-OK` | GREEN |
| dry run (f) | RED: the fallback's probe is the "this turn" text | GREEN |
| dry run (g) | RED: the fallback's probe is answered `PROBE-OK`, so its shape "an ack in both the wake turn and the fallback" reads `probe-ack-unobserved` instead of `duplicate-ack-wake-and-fallback` | GREEN |
| dry run (a), (e) | RED: every probe is the "this turn" text | GREEN |
| unit: the probe text | RED: `RRA_PROBE_CONDITION` is the "this turn" wording | GREEN |
| unit: the "this turn" probe is another probe | RED: its hash is `RRA_PROBE_TEXT_SHA256`, so its receipts would grade PASS | GREEN |
| unit: the row is registered | RED: at `663fafdc` the docs predate this lane, so the status line fails first; with the constants reverted the lib's condition is not the docs' | GREEN |

Every other test passes all three ways: 32 of the dry run's 37 and 50 of the unit file's 53. At
`663fafdc` with its own tests the dry run was 36/36, because its model read "this turn" as "in
context" and so (f) passed there.

### The refusal cases' absence: no ack in the probe run

This is the delegate refusal cases' absence. `work-revoked-visibility` has no return to ack and no
priming; its absence is no wake turn, and the bytes rule out adoption into its probe turn
([above](#the-cases)). The same priming and the same probe make the delegate refusal cases' absence
real. A refused return never reaches the target, so the target has nothing to ack: an ack of the
nonce in the probe run (`probeAckRows`) or any later run (`ackRuns`) is FAIL
(`refused-return-adopted`), and an ack the case cannot credit (another nonce, none, a row quoting the harness prompt, or a
`heartbeat_respond` call no accepted result binds) leaves the absence unread, so the case is MISSING
(`ack-uncredited`). A model that echoes its priming prompt in the probe turn never reads PASS: a verbatim echo carries
the harness marker and reads MISSING, and a paraphrase that types the exact ack reads FAIL. The refusal line stays the primary evidence, as 🌊 ruled. The dry run pins an
ack in each delegate refusal case's probe run, with no marker on the row and with or without
`PROBE-OK` beside it, as FAIL, and the same probe answered `PROBE-OK <probeNonce>` with no ack as
PASS.

### The collector and each case's mode

`collect-continuation-trace.mjs` refused every silent case with `evidence delegate_mode mismatch:
expected silent-wake, got silent`. It compared the case's evidence with the manifest's default mode,
though the manifest lists both in `invocation.modes`. `traceContract` now takes each case's mode from
its own evidence when the row declares `invocation.modes`. It refuses evidence with no mode or a mode
the list does not name, and a row with one mode keeps the mismatch check. The manifest checker
refuses a malformed `invocation.modes`, and the row test binds the list to the case table. No owner
edits a manifest copy again. On the grade's side, a case's trace counts only from a correlation receipt
whose recorded `delegate.mode` is the mode the case dispatched (`traceCorrelationMatches`).

## The merged head's other lanes on the row's gateway

The six lanes merged after `e9dc1c31` were checked for any change to a case's outcome or oracle on
the row's isolated gateway. None changes one; the setup below rules out the one that could.

- **keeps-queued-2 (`/new` and `/reset` keep queued elections).** The reset's runtime cleanup now
  ends only the replaced head's custody (`retireReplacedHeadContinuations`,
  `session-reset-cleanup.ts:171-175`; reason passed at `session-reset-service.ts:560-566`) and re-arms
  what it kept (`session-reset-continuation-retention.ts`, `rearmKeptContinuations`). Both read
  custody by `ownerSessionKey`, and a row target owns none: the delegate's custody is the parent's.
  So `allowed-across-reset` is unchanged: no epoch writer is on the reset path, the return is still
  adopted by the re-primed successor, and its oracle (epoch unchanged, one ack) holds. A delete is
  unchanged (`cancelSessionContinuations`, queued events consumed), so `reassigned` and
  `wake-reassigned` keep their stages.
- **The turn-start fence (`0b22be19`).** It is written only for a claimed `continue_work` wake that
  passed the handoff and adoption checks (`work-dispatch-execution.ts:266-276`,
  `work-store.ts:97-146`). No delegate case elects a work wake, and `work-revoked-visibility`'s wake
  is refused at the handoff before any fence. It changes no case.
- **Wake admission (a busy session refuses a work wake, `c25d1a77`).** Reply admission refuses only
  `continuationTrigger === "work-wake"` (`get-reply-run-admission.ts:513-522`). That trigger is set
  only by the work dispatcher (`work-dispatch-execution.ts:327`) and by a generated-media completion
  the row never drives. A delegate return wakes as `delegate-return`, and a probe is an ordinary
  `sessions.send`, so the probe turn can make no case's wake refused. The only work wake in the row
  is refused at the handoff first (`work-dispatch.ts:529`), whether or not its session is busy. Its
  probe is still sent only after the wake was due: while any turn of that session is active, the
  anchor is not finalized (`work-store.ts:329-334`), so an early probe could only move the refusal
  after the probe (MISSING, never FAIL).
- **#1544 maintenance custody (`984f4e1f`).** Session-store maintenance now preserves every
  session that holds live custody (`subagent-registry-maintenance.ts:52-75` at `a22bd9c05c`, which
  reads it from the maintained store's own state root;
  [below](#the-incognito-fanout-refusal-and-the-memory-store-maintenance-separation)): an election's owner,
  an admitted child's requester and bound recipients, and any session a pending continuation row is
  addressed to (`session-delivery-queue-storage.ts:687-706`). At its defaults (`enforce`,
  `maxEntries` 5000, `pruneAfter` 30 days, a 10 GiB disk budget, `store-maintenance.ts:26-34`)
  maintenance cannot evict a row session: a fresh isolated state holds a few dozen entries, and a
  run lasts under an hour. With a lowered `session.maintenance`, a session that holds no custody at
  the time (a target before its child is admitted, a target after its row settled, an ops session)
  could be evicted. That deletion would advance its epoch. Every such case fails a premise (an
  allowed case `epoch-advanced-premise-broken`, a parked case `refusal-stage-mismatch`) and is
  MISSING, never FAIL. **Pinned setup:** the operator procedure leaves `session.maintenance` at its
  defaults.
- **The burning annex and annex crash gating (`9cb07314`).** They change how a reset's kept
  delegates are re-armed and how claims a crash left unresolved end
  (`delegate-dispatch-recovery.ts`, `rearmPendingContinuationDelegates`), both keyed by the owner
  session. No case resets a parent or crashes a gateway (`replay-restart` is a supervised restart
  after the delegate fired).

## The delegate dispatch grant and this row's operator connection

**What `1ab5a73e` did.** Ten cases fire a timed `continue_delegate` that a model turn elects from the
k6 client's `sessions.send`. The other three fire none that spawns: `unauthorized-admission` is
refused at the tool, `unauthorized-dispatch` by the policy at dispatch, and `work-revoked-visibility`
elects no delegate. The k6 client is a Gateway operator connection: the proof gateway's shared
token over loopback, with no device (`composite-launcher.sh` sets `gateway.auth` mode `token`),
admitted as the Gateway owner (`connect-session.ts:216-220, 360-367, 377-378`; profile
`gateway-owner`, `operator-run-authority.ts:329-355`). At `1ab5a73e` a delegate's spawn ran under the
request scope that armed its timer, the k6 client's own request, and re-read that request's
authority when the delegate fired (`delegate-dispatch.ts:449` -> `subagent-spawn-gateway.ts:323-326,
179-197` -> `server-plugin-in-process-authority.ts:336-340, 703-714` ->
`operator-run-authority.ts:358-359`, the path the grant lane's red reproduction takes with a
paired-device operator). So every delegate the row fires needed the k6 connection's authority still
current when it fired. The row's one-case live smoke (🕯, emeric, at `1ab5a73e`)
stopped on the delegate's dispatch: `continuation.delegate.dispatch` ERROR "Gateway caller authority
is no longer active." ×4. It wrote no case receipt. The smoke's report reads it as the k6 operator's
connection having closed before the timed delegate fired. The grant's lane (merge `12617a330d`) reads
it as "a timed delegate re-checked the electing operator's live connection".

Three things about that smoke are not settled by the bytes:

- The scenario holds one connection per case and closes it only when the case ends
  (`finish()` in `scenarios/r-cd-recipient-authority.js`), after its final reads. In a case
  that runs to its end, the connection outlives the fire. It closes earlier only on a scenario
  refusal, a socket error or the 885 s window.
- For this owner client, a fully processed socket close makes the capture return no authority
  (`operator-run-authority.ts:339, 352`) rather than throw at `:358-359`.
- The message is thrown at several sites, among them `operator-run-authority.ts:359, 529` and
  `operator-invocation-authority.ts:144`.

Which path the smoke took is for its own log to say.

**What `2907e656` changes** (`da8851c5`, 🌊's ruling A, room msg 1567487338383413250):

- **Capture at election.** The `continue_delegate` tool's enqueue (`continue-delegate-tool.ts:434` ->
  `delegate-store.ts:205-224` -> **`delegate-flow-store.ts:443-451` ->
  `delegate-dispatch-grant.ts:48-79`**) captures the grant in the same step as the recipient-authority
  binding, before the record and before the `scheduled` toolResult. It holds:
  - the electing operator's durable source (`operator-run-recovery-source.ts:13-52`): principal,
    scopes intersected with the elector's, device, profile, role and auth policy, and no credential
    bytes (`operator-run-authority.ts:631-691`);
  - the owner session;
  - `expiresAt`, the due time plus one hour (`delegate-dispatch-grant.ts:35, 71-75`).

  The tool inherits its run's admitted operator (`operator-invocation-authority.ts:90-117`). On the
  bytes, this row's owner client yields a grant: token auth, a defined shared generation and no device
  pass `operator-run-authority.ts:642-660`, and an owner's access grant is `null`, not absent
  (`:572-575`).
- **Restore at dispatch.** After the policy check (`delegate-dispatch.ts:268-291`) and the spawn fence
  (`:437-448`), the spawn runs under the grant (**`delegate-dispatch.ts:449-484` ->
  `delegate-dispatch-grant.ts:85-141`**). The restore throws before the spawn (`:97-108, 120-121`),
  and dispatch fails the delegate terminally with an owner notice and no child
  (`delegate-dispatch.ts:565-596`). It logs `[continuation:delegate-spawn-failed] error=Continuation
  delegate operator dispatch grant <reason>` (`:585`). This happens when the grant:
  - belongs to another session;
  - has expired;
  - has no Gateway to restore it on;
  - names a source that the operator-recovery owner (`operator-run-recovery.ts`) refuses: a revoked
    device, a changed profile or role, narrowed scopes, or a changed auth method or shared
    generation.

  Otherwise the child spawns under the restored authority, in a fresh scope. That scope reads
  neither the electing connection nor the scope that armed the timer (`:123-137`).

**What it changes for this row.** The row now depends on the grant to spawn. On the bytes, each of
the ten firing cases captures a grant for the k6 owner and spawns its child under it, so the spawn
no longer needs the k6 connection's authority to be current at the fire, which is where the smoke
stopped. The row cannot see which authority a spawn used. A delegate captured without a grant (an
unretainable source logs `[continuation:delegate-grant-unavailable]`,
`delegate-dispatch-grant.ts:63-69`, which the row does not grade) would dispatch under the k6
connection as at `1ab5a73e` (`:94-95`). In a case that runs to its end, that connection is still
open. So a PASS shows that the delegates spawned, not that the grant spawned them.

**No case's expected stage or oracle changes.** Re-derived from the bytes:

- The binding is captured as before, in the same step and still before the `scheduled` result
  (`delegate-flow-store.ts:432-452`), so every capture sample and transition order holds. A failed
  grant capture commits no record and gives no `scheduled` result: MISSING, never FAIL.
- The policy refusals come before any grant. `unauthorized-admission` is refused at the tool
  (`continue-delegate-tool.ts:353-362`), and `unauthorized-dispatch` at `delegate-dispatch.ts:268-291`,
  which restores no grant. Each keeps its line.
- The grant governs the spawn, and with it, by inference, the child's run, which carries the restored
  authority (`delegate-dispatch-grant.ts:125-129`). It does not touch the return's path. Routing,
  enqueue, wake, prompt drain, replay and settlement are byte-identical to `1ab5a73e`, so every
  refused return keeps its stage, its line and its absence.
- No case's transition reaches the elector's grant. Visibility, membership, owner, delete and
  recreate, and reset change the target session's recipient authority, not the owner's device,
  profile, role, scopes or token. The only config write while a delegate is pending is
  `unauthorized-dispatch`'s `config.patch`, and the policy refuses that delegate before the grant is
  read.
- Every delegate fires well inside its hour: a 30 s delay, in a scenario window of 900 s.
- `replay-restart`'s delegate fires before the restart, so boot recovery restores no grant.
  `work-revoked-visibility` elects a `continue_work` wake, which carries no delegate grant.
- A refused grant leaves no child, so it can only make a case MISSING, never PASS or FAIL. An allowed
  or parked case then lacks its bound child (`child-not-bound`), and a wake-mode case lacks its
  refusal line.

**Not pinned for this row's client shape.** The grant's unit pins
(`src/agents/subagents/spawn/subagent-spawn.continuation-operator-grant.test.ts`) elect through a
paired-device operator with a named profile (`:159-194`), not a shared-token owner. No product test
captures a grant from a WebSocket owner or restores one as `gateway-owner`. Capture also has to pass
a model-policy snapshot and a decode (`operator-run-authority.ts:661-664`;
`operator-run-recovery-source.ts:46-51`). Restore as `gateway-owner` needs that profile's identity
and its resident catalog row (`operator-run-recovery.ts:216, 327-330`). That this row's client gets
a grant is read from the bytes above. The one-case smoke at `2907e656` will be the first run of that
shape.

## The incognito fanout refusal and the memory-store maintenance separation

**What `a22bd9c05c` changes.** It is `2907e656` plus the lane
`continuation-incognito-fanout-and-memory-maintenance` @ `ae11b29243` (merge `2fe459ab92`; 🌊's go,
room msgs 1567643207976886343 and 1567646197517385800; reviewed on karmaterminal/openclaw#1271,
comment 6643997194) and its test-lines allocation. Its non-test product files are
`subagent-registry-maintenance.ts`, `recipient-authority-binding.ts`, `work-store.ts`,
`session-accessor.ts`, `session-sharing-store.async.ts` and `store-maintenance-preserve.ts`. It does
three things:

- **The incognito fanout refusal.** `createContinuationRecipientAuthorityBinding`
  (`recipient-authority-binding.ts:57-78`) refuses a `tree` or `all` fanout election whose requester is
  incognito, before any record exists (`:64-69`). It calls `assertSessionRecipientAuthorityOwner`
  (`session-sharing-store.async.ts:591-600`, exported at `session-accessor.ts:188-191`). That throws
  the default return's own refusal, "Incognito collaboration command requires its dedicated owner"
  (`session-sharing-store.async.ts:56-57`, the capture's at `:68`), when the requester's storage
  owner is a memory owner. That owner exists only for an incognito key
  (`agent:<id>:(dashboard|subagent|internal-session-effects):incognito-…`,
  `packages/session-url-contract/src/session-key.ts:6-13`) or an explicit incognito store
  (`session-actor-storage-binding.ts:119-135`). The binding is its only caller, and the delegate's
  enqueue is the binding's only caller (`delegate-flow-store.ts:437-442`). The explicit-target path
  (`recipient-authority-binding.ts:70-77`) is the old `:66-73`, byte for byte.
- **The memory-store maintenance separation.** `prepareSessionMaintenancePreservation` now hands each
  provider the maintained store's state environment and whether it is an incognito memory store
  (`store-maintenance-preserve.ts:76-83`, `:109`). On a memory store, the continuation custody provider
  (`subagent-registry-maintenance.ts:52-75`) reads no pending rows and waits on no custody readiness
  (`:58-66`). It keeps only the live owners (`:67-70`).
- **Custody read from the maintained store's root.** On any other store, the provider reads pending
  rows, readiness and live owners from that store's `env` (`:60`, `:65`, `:68`;
  `work-store.ts:827-828`), not from the process's ambient root.

**What it changes for this row: no case's stage or oracle.** Read from the bytes, case by case:

| Case | Through the fix | Stage and oracle at `a22bd9c05c` |
|---|---|---|
| `allowed`, `allowed-across-reset`, `allowed-silent` | a durable parent elects one `continue_delegate` with `targetSessionKey` set to a durable target, so the binding takes the explicit-target path (`recipient-authority-binding.ts:70-77`), not the fanout branch | unchanged: adopted and acknowledged once, the epoch unchanged (by the reset too) |
| `unauthorized-admission` | refused at the tool (`continue-delegate-tool.ts:353-362`) before any enqueue, so it never reaches the binding | unchanged: the policy error, no child |
| `unauthorized-dispatch` | accepted and bound on the explicit-target path, then refused at dispatch (`delegate-dispatch.ts:268-291`, unchanged) | unchanged: `[continuation:delegate-rejected]`, no child |
| `revoked-visibility`, `revoked-membership`, `revoked-owner`, `reassigned`, `replay-restart` | bound on the explicit-target path. The park, the witness line and the refusal run through files `a22bd9c05c` did not change (`subagent-announce.continuation-return.ts`, `targeting.ts`, `session-system-events.ts`, `session-system-event-adoption.ts`, `server-restart-sentinel-delivery.ts`, `session-reset-cleanup.ts`) | unchanged: `stage=prompt-drain`, or `stage=replay` (`reassigned` may be either; `replay-restart` on the replacement), and the same absence |
| `wake-revoked-visibility`, `wake-reassigned` | bound on the explicit-target path, refused at the router's first read (`targeting.ts:277-280`, unchanged) | unchanged: `stage=enqueue`, no `deliveryId`, no `Delivered to` |
| `work-revoked-visibility` | a `continue_work` election binds through `work-operator-continuation.ts:34-52` -> `work-recipient-authority.ts:63-67`, never through `createContinuationRecipientAuthorityBinding`. The handoff refusal (`work-dispatch.ts:529` -> `work-recipient-authority.ts:102-152`) is in unchanged files. The `work-store.ts` lines it rests on are byte-identical: the claim (`:213-313`), the failed record never claimed again (`:226, 260`) and the failure (`:639-655`). Only `listLiveContinuationCustodyOwners` (`:827-828`) changed | unchanged: `stage=wake`, one election, no wake turn |

No case reaches either half of the fix:

- **The fanout refusal.** Every delegate case elects one explicit `targetSessionKey`. The tool
  refuses a `fanoutMode` beside one (`continue-delegate-tool.ts:328-334`), and the scenario credits
  only a dispatch whose arguments carry the case's own target (`findDelegateDispatch`). Any other
  delegate call is a deviation, MISSING, as before. No row key is incognito: the scenario creates
  `agent:main:r-cd-ra-<kind>-<nonce>` with `sessions.create` and no incognito flag.
- **The maintenance separation.** On the row's gateway every maintained store is in the gateway's
  durable store, under the isolated state root the control starts it with (`OPENCLAW_STATE_DIR`). A
  store's `env` is that process environment with its state root resolved
  (`session-accessor.sqlite-scope.ts:352-362`), so the root the provider now reads is the one it read
  at `2907e656`. `memory` is false, because the store is not the incognito database
  (`openclaw-agent-db.paths.ts:69-85`), so it still reads rows and readiness. The sessions it
  protects are unchanged, and at the defaults maintenance reaches no row session anyway
  ([above](#the-merged-heads-other-lanes-on-the-rows-gateway)).

The fix is proven by the product's unit pins, not by this row (under "does not prove").

## Cites re-walked at the merged j12′

### At `a22bd9c05c`, the incognito fanout refusal and the memory-store maintenance separation

Every product file the row cites (this doc, the scenario header, the lib, the control, the tests and
the manifest, at docs `8897ef7b`) was checked against `git diff --name-only 2907e656 a22bd9c05c`.
Every cite in a changed file was re-read at `a22bd9c05c` in a detached worktree. The fix changed six
non-test product files. The row cites three of them:

| File | Cite (at `2907e656`) | At `a22bd9c05c` | What it affects |
|---|---|---|---|
| `src/auto-reply/continuation/recipient-authority-binding.ts` | `:56-74` (scenario header, section 2: the binding captured before the custody record) | **moved** to `:57-78` by an import (`:4`) and the fanout refusal (`:64-69`). The explicit-target capture the row reads, `:70-77`, is the old `:66-73`, unchanged in meaning. The function **gained** the incognito fanout refusal | none: no case elects a fanout, and no row session is incognito |
| `src/agents/subagents/registry/subagent-registry-maintenance.ts` | `:47-65` (#1544: maintenance preserves every session that holds live custody) | **moved and changed in meaning** to `:52-75`. On a durable store it preserves the same holders, now read from the maintained store's root (`:60`, `:65`, `:68`). On a memory store it keeps the live owners only (`:58-66`) | none: the row's stores are durable and in the gateway's own root, and the setup pin (maintenance at its defaults) stands |
| `src/auto-reply/continuation/work-store.ts` | `:97-146`, `:213-313`, `:226, 260`, `:273-282`, `:315-365`, `:329-334`, `:335-345`, `:639-655`: 15 cites, 4 in the scenario header, 2 in the lib and 9 here | **unchanged**. The file changed only at `:821-828` (`listLiveContinuationCustodyOwners` takes an `env`), after every cited line, and each cited range is byte-identical | none |

The row had no cite to re-walk in the other three non-test files the fix changed:
`session-accessor.ts`, `session-sharing-store.async.ts` and `store-maintenance-preserve.ts`. The
`session-accessor.sqlite-*.ts` files the row cites are other, unchanged files. On the test side the
fix added three unit-pin files (`delegate-recipient-authority.incognito.test.ts`,
`session-actor-memory.test.ts`, `subagent-registry-maintenance.test.ts`), the test-lines allocation
and one Vitest routing line. The row cited none of them, and now cites the unit pins under "does not
prove". The fix's own lines are cited in
[its section](#the-incognito-fanout-refusal-and-the-memory-store-maintenance-separation).

Every other product file the row cites is byte-identical from `2907e656` to `a22bd9c05c`, so its
cites stand as re-walked at `2907e656` and were skipped. Among them are `targeting.ts`,
`continuation-wake.ts`, `continue-delegate-tool.ts`, `delegate-flow-store.ts`, `delegate-dispatch.ts`,
`work-dispatch.ts`, `work-recipient-authority.ts`, `subagent-announce.continuation-return.ts`,
`server-restart-sentinel-delivery.ts` and `session-reset-cleanup.ts`. The sections that read bytes at
`2907e656` stand for the same reason ([the fresh 13's misses](#the-fresh-13s-misses-at-2907e656),
[the live run's misses](#the-live-runs-misses-at-2907e656)).

### At `2907e656`, the delegate dispatch grant

Every product file this doc, the scenario header, the lib, the control, the tests and the manifest
cite was diffed from `1ab5a73e` to `2907e656` (`git diff`), and every cite in a changed file was
re-read with `git show`. The grant changed twelve non-test product files. Five of them are cited
here; the rest of the cited files are byte-identical, so their cites stand as re-walked at
`1ab5a73e` ([below](#from-e9dc1c31-to-1ab5a73e)). On the test side only the grant's new unit pins
(`subagent-spawn.continuation-operator-grant.test.ts`), the test-lines allocation and #1544's test
routing changed. The row had no cite in any of them at `1ab5a73e`, and it now cites the grant's unit
pins under "does not prove".

| File | Cite (at `1ab5a73e`) | At `2907e656` | What it affects |
|---|---|---|---|
| `src/auto-reply/continuation/custody-boot.ts` | `:107-114` (the `continue_work` replay sweep runs only at custody boot) | **moved** to `:114-121`; unchanged in meaning. The file now hands the booting Gateway to delegate recovery so a recovered operator delegate can restore its grant (`:66-67`, `:85-87`, `:92`, `:105`) | nothing: no case restarts with a pending delegate (`replay-restart` restarts after its delegate fired) and `work-revoked-visibility` restarts nothing |
| `src/auto-reply/continuation/delegate-flow-store.ts` | `:426-437` (the binding is captured before the custody record exists) | **moved and changed in meaning** to `:432-452`: the binding is still captured first (`:435-442`), and the same step now captures the electing operator's dispatch grant (`:443-451`, `pending` delegates only), so a failed grant capture, like a failed binding capture, commits no record. `createdAt` moved up to `:431` for the grant's due time | the `scheduled` toolResult still follows both captures (`continue-delegate-tool.ts:434-449`), so every case's capture sample and transition order holds. A failed capture gives no `scheduled` result: MISSING (`continue_delegate was not accepted`), never FAIL |
| `src/auto-reply/continuation/delegate-dispatch.ts` | `:267-290` (the policy rejection at dispatch), and the lib's `:267-277` | **moved** by one line (an import at `:32`) to `:268-291` and `:268-278`; unchanged in meaning. The file **gained** the spawn under the grant (`:449-484`), after the policy check and the spawn fence (`:437-448`) | `unauthorized-dispatch`: none; the policy refuses before any grant is restored, with the same line and no child |
| `src/auto-reply/continuation/delegate-store.ts` | `:204-218` (`enqueuePendingDelegate`) | **moved** to `:205-224`; it gained an `electingOperatorAuthority` option (`:208-211`, passed on at `:222`) | none: the `continue_delegate` tool passes no elector (`continue-delegate-tool.ts:434`), so its grant is captured from the tool call's own operator |
| `src/auto-reply/reply/agent-runner-continuation-signal.ts` | `:463` (the turn schedules the `continue_work` election after its attempt) | **moved** to `:467`; unchanged in meaning. The file changed only in the bracket-token delegate's enqueue (`:251-274`), which now passes the run's admitted operator as the elector (`:273`) | none: the row drives no token form, and `work-revoked-visibility`'s election path is unchanged |
| `src/auto-reply/continuation/types.ts` | **not cited** by the row (`session-recipient-authority-types.ts`, which it cites, is another, unchanged file) | the file gained `PendingContinuationDelegate.dispatchGrant` and `ContinuationDelegateDispatchGrant` (`:129-140`) | none |

The row had no cite at `1ab5a73e` to re-walk in the other six non-test files the grant changed:
`subagent-announce.continuation.runtime.ts` (a sub-agent's own delegates spawn under their grant),
`delegate-dispatch-contract.ts`, `delegate-dispatch-grant.ts` (new),
`delegate-dispatch-hedge.ts`, `delegate-flow-state.ts` and `server-runtime-services.ts`. The grant's
own lines are now cited in
[its section](#the-delegate-dispatch-grant-and-this-rows-operator-connection).

### From `e9dc1c31` to `1ab5a73e`

Every `path:line` cite in this doc, the scenario header and the lib was re-read at `1ab5a73e` with
`git show` / `git grep`. Only six cited files changed from `e9dc1c31`:

- `return-refusal.ts`
- `session-reset-cleanup.ts`
- `session-recipient-authority-types.ts`
- `session-recipient-authority.worker.ts`
- `session-reset-service.ts`
- `session-delivery-queue-storage.ts`

The rest are byte-identical. The re-read also found ranges in unchanged files that never covered
their claim; those are corrected here and marked as such.

| Cite (at `e9dc1c31`) | At `1ab5a73e` | What it affects |
|---|---|---|
| `return-refusal.ts:15-29` (reporter), `:16`, `:18`, `:20-29`, `:26-28`, `:28`, `:15` | **moved** to `:16-36`, `:17`, `:24`, `:27-36`, `:33-35`, `:35`, `:16`; the line, its subsystem and its fields are unchanged | nothing: the matcher reads the same line. The file **gained** the `continue_work` reporter `:38-46` (subsystem `continuation/work-refused`), which the new case reads |
| `return-refusal.ts:36-49` (failed receipt) | **moved** to `:53-66` | nothing |
| `session-reset-cleanup.ts:146-196`, consumed at `:194-196` | **moved** to `:149-227`, consumed at `:202-203`; **changed in meaning** for `/new` and `/reset`: they end only the replaced head's custody (`:171-175`) | `allowed-across-reset`: none (the target owns no custody; no epoch writer). `reassigned`, `wake-reassigned`: none (a delete still cancels and consumes) |
| `session-reset-service.ts:651-737, 751, 1032-1043` | **unchanged** lines; the incognito block runs to `:741` (range corrected). The file changed at `:392` and `:560-566`: the cleanup takes the entry and the reason `delete` for an incognito reset | `allowed-across-reset`: none; rotation is still `resetSessionEntryLifecycle` with no epoch writer |
| `sessions-mutations.ts:593-678` (`sessions.reset`) | **unchanged** | none |
| `session-reset-runtime-state.ts:11-51` | **unchanged**; it passes the cleanup reason through (`:36-43`) | none |
| `targeting.ts:319-321, 348-356` (reset hold) | **unchanged** | none |
| `server-restart-sentinel-delivery.ts:238-262` (reset hold at replay) | **unchanged** | none |
| `session-recipient-authority-types.ts:87-92` (match), `:66-99` (rank) | **moved** to `:96-101`, `:75-108`; the row type gained `createdAt`/`updatedAt` (`:66-73`) for unbound work records | none for returns: `withCurrentSessionRecipientAuthority` now wraps the verdict reader with the same rule (`session-recipient-authority-current.ts:174-187`) |
| `session-recipient-authority.worker.ts:35-50` (capture) | **moved** to `:36-56`; the read returns the row's write times | none |
| `session-delivery-queue-storage.ts:274-279` (row id) | **moved** to `:275-280` | none |
| `sessions-mutations.ts:343-470` (`sessions.assignOwner`) | unchanged file; range **corrected** to `:343-518` (the writer call is at `:473-486`) | none |
| `server-methods/config.ts:798-850` (`config.patch`) | unchanged file; range **corrected** to `:798-980` (the write is at `:955-979`) | none |
| `session-delivery-queue-runtime.ts:143-149` (sweep) | unchanged file; range **corrected** to `:143-160` (the 45-75 s delay is at `:150-151`) | none |
| `register-restart-handoff.ts:42-61` | unchanged file; range **corrected** to `:41-74` (the consume call is at `:62`) | none |
| `targeting.ts:395-403` ("queues an event and requests a wake") | unchanged file; **corrected**: the event is queued at `:322-341`, the wake requested at `:395-403` | none |
| `managed-delivery-turn-lifecycle.ts:107-111` ("writes the marker") | unchanged file; **corrected**: it builds the turn input; the marker is written by `src/sessions/user-turn-transcript.metadata.ts:102-104` | none |
| `continuation-tracer.ts:178-204` ("with no session identity") | unchanged file; **corrected**: the drain span has none, the fanout span carries 12-hex SHA-256 prefixes of recipient keys (`:194-197`, `:1000-1010`) | none: no case drives a fanout span and the control collects none |
| bare `:61-65`, `:66-71`, `:72-75` in the durable-replay row; bare `:436-449` in the scenario header | they resolved to the wrong file; now named (`server-restart-sentinel-delivery.ts`, `continue-delegate-tool.ts`) | none |
| `continuation-wake.test.ts:654` (stage=wake pin) | **unchanged**; re-proven at `1ab5a73e` (above) | none |
| every other cite | **unchanged** (file byte-identical since `e9dc1c31`, lines re-read) | none |
| `continue_work` | the row cited none at `e9dc1c31`; it now cites the binding (the tables above) and drives one case | `work-revoked-visibility` |

## What ClawSweeper asked for, case by case

ClawSweeper's standing review on openclaw/openclaw#129388 (comment 5442236054) asks for
"allowed-recipient and revoked/reassigned-recipient proof, including restart replay", and under
Security: "allowed delivery and rejection after revocation or reassignment still need evidence
through prompt adoption, wake, and restart replay". The map on docs#536 (comment 6597622114) lists
the items. Its update (comment 6599896374) records the j12 finding behind j12′: a wake-path refusal
had no reason to observe. It also records that the row re-anchors to j12′, where the wake-mode
refusal becomes provable.

| ClawSweeper item | Cases |
|---|---|
| Real behavior proof: allowed vs revoked/reassigned recipients, incl. restart replay, through adoption, wake, final effects | `allowed`, `revoked-visibility`, `revoked-membership`, `revoked-owner`, `reassigned`, `wake-revoked-visibility`, `wake-reassigned`, `replay-restart` |
| Security: prove stale recipient rejection before final effects | every refusal case: the reason at its pinned stage and no adoption, ack, wake or final effect. `work-revoked-visibility` answers it for the other durable election j12′ binds, a kept `continue_work` wake (no ClawSweeper item names `continue_work`, so it is listed here and claimed for no returns item) |
| P1: durable returns outliving admission; rejection unproven at prompt, wake, delivery, restart replay | prompt: `revoked-visibility`, `revoked-membership`, `revoked-owner` (`stage=prompt-drain`); wake: `wake-revoked-visibility`, `wake-reassigned` (a wake-mode return refused at `stage=enqueue`, never woken, no `Delivered to`); delivery: `reassigned` (`stage=replay` by the sweep), `unauthorized-dispatch` (accepted, then refused at dispatch); restart replay: `replay-restart` (`stage=replay` on the replacement) |
| P1: accepted-child survival, reset | `allowed-across-reset` (reset is not an authority edge at j12′; re-derived at the merged head, where a reset keeps queued elections) |
| Allowed delivery through prompt adoption | `allowed-silent` (adopted by the probe turn's drain, read from the primed target's `TARGET-ACK` in the probe run), `allowed` and `allowed-across-reset` (adopted by the wake; `allowed`'s ack read in its woken run, or on its fallback in the probe's own run, labelled probe-mediated) |
| Unauthorized recipient | `unauthorized-admission`, `unauthorized-dispatch`: the only admission refusal j12′ has |
| Not answered here | a return refused at the wake handoff itself (`stage=wake`, see "does not prove"); a kept wake refused at replay or adoption, or by another handover; "settled as refused" from the record (no public reader); compaction, session-id rollover and late materialization; fresh install and upgrade |

## Verdict rules

`lib/recipient-authority-row.mjs` grades each case record, and the row from all of them:

- A record that is not this row's, names another candidate than j12′ at `a22bd9c05c` (j12, the
  interim `e9dc1c31`, the pre-grant `1ab5a73e` and the grant's head `2907e656` included), lacks a gate (j12′ build, isolated
  state, model sign-in, cross-session policy enabled, gateway started by the control), whose
  listener was not the control's own process at every 500 ms sample and case boundary, or whose
  evidence is not bound to the control's run is **MISSING-candidate**, and nothing else about it is
  judged. So is a case whose scenario recorded
  any refusal or whose methods were not all advertised.
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
- A parked case without the control's witness of its queued copy before the transition is MISSING
  (`parked-copy-unwitnessed`, 🌊, room msg 1567623059727458526). The witness is `record.witness`: the
  router's `Delivered to` line from the case's child, the same line read as the park, then the
  release, then the transition. It only adds MISSING: wherever the park before the transition request
  holds, a contradiction is still FAIL. An enqueue refusal never satisfies a
  parked case. The early-enqueue ordering is graded only as its own dry-run pin
  (`gradeEarlyEnqueuePin`), never as a row case.
- A contradiction is **FAIL-candidate**: a refused return acknowledged (in the probe run or any
  later run), marked adopted by the product, woken, repeated in the target, or logged `Delivered to`
  once its transition had settled (the target named, or j12's empty list from its child); an allowed
  wake-mode return routed but never woken; a return in the parent; an unauthorized delegate spawned or
  accepted; an allowed return adopted twice; a silent `allowed-silent` return that woke the target;
  or `sessions.reset` advancing the epoch. A woken target that never typed the exact ack is MISSING
  (`woken-without-ack`): the miss may be the model's.
- `allowed` passes on one ack in its woken run, labelled `direct-wake`. Only after a woken run with
  no ack does it send the conditional probe, and then it passes on exactly one ack in that probe's
  own run, after the delivered return, with none in a wake turn, labelled `probe-mediated` (🌊, room
  msg 1567623059727458526). No ack on either path is MISSING, never FAIL. An ack in both the wake turn
  and the fallback, a probe the read before it did not allow, an ack before the delivered return or
  with another nonce, and a receipt whose label is not its path are MISSING
  ([the fallback](#allowed-the-direct-wake-path-and-the-probe-mediated-fallback)).
- `allowed-silent` is decided by the primed target's ack in the probe run (🌊's ruling (a)): exactly
  one `TARGET-ACK <nonce>` row in the run `sessions.send` started for the probe, sent after the
  router's `Delivered to` line naming the target from the case's child. The ack is the model's, so
  each way it can be wrong is MISSING, never FAIL: none (`probe-ack-unobserved`), two in the probe run
  (`probe-ack-duplicated`), an ack outside priming the case cannot credit (`ack-uncredited`), one in
  a priming run (`ack-before-return`), or a probe sent before that line or with no such line
  (`probe-not-after-return`, `return-not-routed-from-child`). The product's marker is not required,
  and neither is `PROBE-OK`: the probe tells a target whose context holds the return to follow its
  priming instead.
- Every case that probes sends the same conditional probe (🌊, room msg 1567590902694936678;
  [the conditional probe](#the-conditional-probe)), its condition the target's context, as the
  priming's is (🌊, room msg 1567656724549075047; [the context wording](#the-probes-context-wording)).
  A text that fails the text test is never sent. Its reply is graded as one of two answers, never both: a refusal needs
  `PROBE-OK <probeNonce>` and no ack, and `allowed-silent` needs the ack. A `PROBE-OK` naming another
  nonce is never credited. A probe that ran must be named in the receipt by its text's hash, or the
  case is MISSING (`probe-text-unbound`); a contradiction is still FAIL.
- A delegate refusal case's ack it cannot credit leaves its absence unread: MISSING
  (`ack-uncredited`).
- A missing or untyped observation is **MISSING-candidate**. A refusal case without its product
  reason, or without the observed absence (transcripts read, router lines read, probe turn answered,
  every target row attributable to a run), is MISSING, never PASS. For a refused return the reason
  is j12′'s line naming the case's target with j12′'s one reason on every line
  (`refusal-reason-mismatch`). Its first line must carry the case's pinned stage, or for
  `reassigned` its one other first stage (`prompt-drain`), and a later line only a stage the bytes
  name for the same row after that first one (`refusal-stage-mismatch`). It must name a row exactly
  when that stage writes one (`refusal-delivery-id-mismatch`): every line names the same one row,
  or no line names any (`reason-delivery-id-ambiguous`). It must come after the transition, after
  the probe was sent for any `prompt-drain` first line, and from the replacement after the restart for
  `replay-restart`. j12's lines are no reason. So is a revoked
  case whose return was not parked before the transition, or whose transition did not advance the
  epoch.
- `work-revoked-visibility` has its own rules (`gradeWorkRefusalCase`), after the same gates:
  - **MISSING**, never FAIL, when its premise fails: no electing run recorded, another
    `continue_work` or a `continue_delegate` call, no capture seen in the store
    (`capture-unobserved`) or none before the transition (`capture-not-before-transition`), a
    transition that settled after the earliest due time (the sample before the capture plus the
    reported delay less one second, `transition-not-before-wake`), an epoch the transition did not
    advance, or a wake turn already before the transition;
  - **MISSING** without its reason: j12′'s work line for the session after the transition, at
    `stage=wake` on every line, with `recipient-authority-changed` (an unbound record's
    `recipient-authority-unverifiable` is not this case's), naming one election, logged before the
    probe was sent; or without an answered probe;
  - **FAIL** once the premise holds: a wake turn (`target-woken`) or an adoption marker
    (`refused-work-adopted`). It fires nothing, so it owes no trace.
- A residual condition is **PARTIAL-candidate**: a policy change not restored, cleanup incomplete,
  or a fired delegate's Tempo trace not correlated (`trace-receipt-pending`). The trace counts only
  from a `continuation-trace-correlation.json` of this row whose reason hash and length are the
  case's, whose recorded `delegate.mode` is the mode the case dispatched, and whose `traceJson`
  names its own `traceId`. The collector does not sign it, so the fold
  review checks the trace file itself.
- The row is the minimum over all thirteen cases. A case without a verified receipt is MISSING, so
  the row is MISSING until every case runs. Receipts from different runs are MISSING, and an
  unverified receipt or two disagreeing receipts of one case cap it at PARTIAL.

## Operator procedure

For the owner who runs it on an isolated proof gateway at the merged j12′, `a22bd9c05c`. Never
against a live seat, and never at the grant's head `2907e656`, the pre-grant `1ab5a73e` or the
interim `e9dc1c31`.

1. **Stage j12′.** Build a validated stage-only runtime at `a22bd9c05c4a7a9c86e72a132cb7939e399104cb`
   (its `dist/build-info.json` commit must be j12′) on your own architecture.
2. **Set up the isolated gateway** with frond-scribe `scripts/proof-gw/composite-launcher.sh`:
   `setup a22bd9c05c4a7a9c86e72a132cb7939e399104cb a22bd9c05c4a7a9c86e72a132cb7939e399104cb`, then
   `login` and `login-finish` (or `adopt-auth` from a previous isolated gateway). It lives at
   `$HOME/proof-gw/comp-a22bd9c0`. Its `receipts/isolated-auth-status.json` must show an OpenAI
   profile under its own state.
3. **Enable continuation and cross-session targeting** in that gateway's own `openclaw.json`
   (`agents.defaults.continuation.enabled: true`, `crossSessionTargeting: "enabled"`), and leave
   `gateway.reload.mode` anything but `off`: with reload off, `config.patch` saves the policy without
   applying it (`config-write-flow.ts:214-226`). The control refuses a disabled policy and reload
   off. It never edits the file itself, and the unauthorized cases change the policy only through
   `config.patch` and restore it. **Leave `session.maintenance` at its defaults**: a lowered entry
   cap, prune age or disk budget could evict a row session that holds no custody
   ([above](#the-merged-heads-other-lanes-on-the-rows-gateway)).
4. **Stop it**: `composite-launcher.sh stop a22bd9c05c4a7a9c86e72a132cb7939e399104cb
   a22bd9c05c4a7a9c86e72a132cb7939e399104cb`. The control refuses a running unit or a busy port, and
   starts the gateway itself.
5. **Make an observer key** outside `$HOME/proof-gw`, mode 0600, at least 32 characters. The gateway
   never sees it.
6. **Run the control** from a clean docs checkout at the reviewed docs SHA, with k6 v2.0.0 on PATH:

   ```bash
   node tools/k6-proofs/scripts/run-recipient-authority-row.mjs \
     --proof-gw-dir "$HOME/proof-gw/comp-a22bd9c0" \
     --stage-dir <j12′-stage> \
     --candidate a22bd9c05c4a7a9c86e72a132cb7939e399104cb \
     --docs-sha <40-hex docs SHA> \
     --artifact-dir "$HOME/proof-runs/rra-<UTC>/public" \
     --observer-key-file <key> --seat <seat> --json
   ```

   `--cases a,b` runs a subset (always in the table's order). Timing can be tuned through
   `OPENCLAW_RCD_RA_DELAY_SECONDS` (30), `_PARK_MS` (15000), `_SWEEP_WAIT_MS` (160000, two sweep
   periods), `_WINDOW_MS`, `_POLL_MS`, `_BOOT_WAIT_MS`, `_DUPLICATE_WAIT_MS`, `_SAMPLE_GAP_MS`
   (2000, also the wake-mode cases' wait before their transition, which must stay well inside the
   delay), `_CAPTURE_WAIT_MS` (8000, `work-revoked-visibility`'s wait after its `scheduled`
   result for the election's capture, which must also stay well inside the delay),
   `_PROBE_SETTLE_MS` (10000, the wait after the probe run's first answer before the final read, so a
   later ack row of that run is counted) and the control's own `_WITNESS_WAIT_MS` (120000, its wait
   for a parked case's witness; with none, no transition is sent and the case is MISSING). A refusal
   prints the refusal JSON and exits 2 before anything starts. The control reads the gateway's
   console, where the router's line and both refusal lines land at their default levels. A parked
   case runs as two k6 phases, drive and transition, and the control starts the transition only once
   that console shows the router's `Delivered to` line for the case's target from its child.
7. **Collect each fired delegate's trace** with `collect-continuation-trace.mjs --run-dir
   <artifact-dir>.private/<case> --manifest tools/k6-proofs/manifests/r-cd-recipient-authority.json
   --seat <seat>` (the case's `evidence.jsonl` is there), and copy `continuation-trace-correlation.json`
   and the public trace into `<artifact-dir>/<case>/`. Use the committed manifest as it is. The
   collector takes each case's mode (`silent-wake` or `silent`) from its own evidence, because the
   manifest lists both in `invocation.modes`. Never collect from an edited copy. The unauthorized
   cases and `work-revoked-visibility` fire nothing and owe none.
8. **Grade the row**: `node tools/k6-proofs/scripts/run-recipient-authority-row.mjs --grade-row
   <artifact-dir> --observer-key-file <key>`. Exit 0 only for PASS-candidate.
9. **Publish the public directory only**, copied to
   `PROOFS/a22bd9c05c4a7a9c86e72a132cb7939e399104cb/R-CD-RECIPIENT-AUTHORITY/<seat>/authority-row-<UTC>/`.
   The artifact directory lives outside the repository
   because `<artifact-dir>.private` sits beside it: raw evidence, gateway logs, session keys,
   delivery ids and flow ids, never part of the corpus. Folding is a reviewed coordinator step at j12′.
10. **Shred** with `composite-launcher.sh shred` when the review no longer needs the state.

If a case is MISSING for a setup reason, fix the setup and rerun the whole row. Examples: no member
identity to add for `revoked-membership`, a model that never made the call, a wake-mode transition
that settled after the fire, or a `continue_work` capture not seen before its transition. Each run
is a new run id, and the row needs every case from one run: receipts from different runs grade it
MISSING (`receipts-from-different-runs`). `--cases` runs a subset for diagnosis only.

## Files

| File | Role |
|---|---|
| `manifests/r-cd-recipient-authority.json` | the row manifest (orchestration-required, `disposable-real-process`, the merged pin, cases, receipts) |
| `scenarios/r-cd-recipient-authority.js` | the k6 case driver, with the j12′ path map; refuses outside the control |
| `scripts/run-recipient-authority-row.mjs` | the control: gates, harness-owned gateway, log and epoch capture, the parked copy's witness before a parked case's transition phase, restart, signed receipts, `--grade-row` |
| `lib/recipient-authority-row.mjs` | the case table with each stage's bytes, the parked-copy witness's bytes, the early-enqueue pins, the j12′ reason matchers, the probe text with its text test and pinned hash, transcript observation and verdict rules (`allowed`'s two paths included) |
| `scripts/__tests__/recipient-authority-row.test.mjs` | registration, guard, every former pin (`e9dc1c31`, `1ab5a73e`, `2907e656`) refused by the grade, the control's preflight and `--grade-row`, verdict, stages, j12-line and `Delivered to` negatives, the `continue_work` case, the probe's text test and the grade of each probe answer, the "this turn" probe's receipts read `probe-text-unbound`, the parked-copy witness, the early-enqueue pins, `allowed`'s direct-wake and probe-mediated paths, the control's release on the router's line, gates, signed receipts |
| `tests/recipient-authority-dry-run.test.mjs` | the case driver under `k6-node-runtime` against a j12′-shaped scripted gateway, one case or all thirteen on one session store under one run id. It refuses `2907e656` as a candidate before it sends a frame. Its probe turn writes no marker, and its primed model reads the probe literally (an unconditional `PROBE-OK` wins over the priming; 🌊's condition hands a target whose context holds the return back to it, where "this turn" would hand back only a return the probe turn drained). It has a negative for each ack `allowed-silent` and the refusal cases reject, the conditional probe's pins (a)-(e), 🌊's ordering ruling's pins: (p) the parked-copy witness, (q) an enqueue refusal failing the parked-copy case, (r) the early-enqueue pins, (w) `allowed`'s direct-wake path, (f) its fallback and (g) the fallback's negatives, and (h) the fallback under the context wording and under the old "this turn" wording |
| `scripts/collect-continuation-trace.mjs` (shared) | collects a fired delegate's Tempo trace under the case's own mode (`invocation.modes`); tests in `scripts/__tests__/collect-continuation-trace.test.mjs` |
