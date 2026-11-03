# R-CD-RECIPIENT-AUTHORITY-MATRIX: recipient-authority matrix

Status: **catalogued, capped at `PARTIAL-candidate`, not executable at j12, never fired, in
no corpus.** Bound issue: karmaterminal/karmaterminal-openclaw-docs#536.

This row proves one thing about delegate returns. A return is bound to its recipient's authority
generation when the delegate is accepted. It may reach the recipient's prompt, wake it and
deliver to its channel only while that generation is still current. The generation is one UUID
epoch per logical session key, kept in `session_recipient_authority` in the per-agent database.

The matrix runs 12 lifecycle cases. Each case fires once as a typed `continue_delegate` call
and once as a terminal `[[CONTINUE_DELEGATE: ...]]` token. The driver holds each accepted result
across the case's lifecycle edge and then releases it. One signed observer receipt binds all 24
observations, so no observation can be split off or spliced in from another run.

- [Its own row, beside the restart control](#its-own-row-beside-the-restart-control)
- [The product path at j12](#the-product-path-at-j12)
- [The cases at j12](#the-cases-at-j12)
- [What ClawSweeper asked for, and which case answers it](#what-clawsweeper-asked-for-and-which-case-answers-it)
- [Verdict cap and trace receipts](#verdict-cap-and-trace-receipts)
- [What executing it needs](#what-executing-it-needs)

## Its own row, beside the restart control

docs#615 made `R-CD-RETURN-COVENANT-AUTHORITY` the supervised disposable real-restart control
([`R-CD-RETURN-COVENANT-RESTART-CONTROL.md`](R-CD-RETURN-COVENANT-RESTART-CONTROL.md)). Its
claim is narrow: across a real restart on the supervised branch the fleet runs, the recipient's
epoch stays present and unchanged at every sample, and the failure text survives. It delivers no
delegate return across the restart.

docs#549 had folded this matrix into that same row id. Under 🌊's ruling (2026-10-31), the matrix
is now a row of its own:

- It has its own manifest (`manifests/r-cd-recipient-authority-matrix.json`), pipeline entry,
  README row and this document.
- Its receipts never feed `R-CD-RETURN-COVENANT-AUTHORITY`'s verdict, and that row's receipts
  never feed this one.
- The restart control's manifest, scenario, scripts, verdict rule and document are unchanged by
  this row.

**The matrix's `allowed-gateway-restart-replay` edge is not evidence for the supervised-restart
claim.** The two overlap only in that both observe an epoch outliving a process. That edge did
none of what the supervised branch does:

- It sent no `gateway.restart.request`.
- It took no run-loop restart branch and wrote no restart handoff.
- It had no supervisor.

Instead, at P89 the driver sent SIGTERM to its own fixture-hosted gateway and started another
(`return-covenant-fixture/gateway.ts:71-88`, `fixture-gateway.ts:18-81` at `3821eaef`). The
replay was the driver's own drain through the product's `deliverQueuedSessionDeliveryCore`. The
edge stays in the matrix because it is the only case that carries a delegate return across a
process replacement and on to prompt adoption. It answers a different question from the restart
control.

## The product path at j12

The product to be presented is j12, karmaterminal/openclaw
`352f56029dc95c60149ab4aaa127226a861d0b3d` (`codeagent/absorb-8083-j12`). The harness was
written against P89 `3821eaef72677c78f450ae9956cb582a22ba4cba` (2026-09-18).

**No case executes at j12.** openclaw `2a8566340ddf8572dd974fc6a510fed0907dfe8a`
(2026-10-02, "move the return-covenant fixture harness to fork-only", openclaw#1418) removed the
seam the matrix drives:

- `scripts/return-covenant-fixture-driver.mjs`;
- the return-covenant fixture module;
- the gateway extra-handler seam the module ran in.

`git grep` at j12 finds no return-covenant bytes. The launcher requires the plan's fixture command
to be a tracked blob at the candidate, so a j12 plan is refused before any process starts. No case
can pass at j12 without reaching its path, because none can run.

The header of [`contracts/return-covenant-authority/scenario.js`](../contracts/return-covenant-authority/scenario.js)
anchors every case at j12 with `path:line`: where the return is bound, checked, refused or
adopted, and what each outcome leaves. In summary:

- **Bound** at acceptance, for both forms, before the delegate's custody record exists
  (`delegate-flow-store.ts:426-437`). The binding is an insert-if-absent capture of the recipient's
  epoch (`session-recipient-authority.worker.ts:35-50`).
- **Checked** by one predicate: the captured epoch equals the stored one
  (`session-recipient-authority-types.ts:87-92`). The read runs in the session sharing worker, and
  the decision runs under the agent database writer admission (openclaw#1432). The check runs at
  each of these points:
  - before and after the durable row is written, and after the event is queued (`targeting.ts`);
  - at the wake handoff (`continuation-wake.ts:163-228`);
  - at the prompt drain and at final prompt adoption;
  - at durable replay (`server-restart-sentinel-delivery.ts:226-243, 269-290`).
- **Refused** with one product refusal, not three. `targeting.ts:284` calls it `stale`, and the
  replay path calls it `stale-authority`. A refused return either writes no row, or its row is
  acknowledged and retired and its queued event removed. Nothing reaches a prompt, a wake or a
  channel.
- **Adopted** as an adoption-scoped managed system event. One continuation wake turn adopts it
  (the wake that replaced upstream's retired `requestHeartbeatNow`), or the next prompt drain
  does. Its row is acknowledged only after that adoption.

The epoch advances only at four product sites, plus its first capture:

- deletion (`session-accessor.sqlite-entry-store.ts:56-69`);
- owner change (`session-accessor.sqlite-owner.ts:180-182`);
- visibility narrowing, for every writer (`session-accessor.sqlite-entry-mutation.ts:119-136`);
- member removal (`session-sharing-store.native.ts:180-182`).

j12 has no recipient-authority revocation API.

The matrix's `stale`, `unauthorized` and `revoked` labels name which edge advanced the epoch. They
are not product refusal reasons: the P89 driver set them from the case id
(`case-lifecycle.ts:415-421` at `3821eaef`).

## The cases at j12

Status `seam absent` means the case cannot run at j12, for the reason above. The "P89 gap" column
records where the P89 driver reached something other than the path the product now uses. A
restored seam must close each gap, or that case still does not reach its path.

| Case | Label | j12 edge path | Relation | Final effects | j12 status | P89 gap |
|---|---|---|---|---|---|---|
| `allowed-ordinary-new` | adopted | `/new` through reply-session init or Gateway `sessions.reset`, both with reset retention (`session-reset-retention.ts`) | captured = current | the mode's prompt, wake and channel counts | seam absent | The driver called `resetSessionEntryLifecycle` directly and bypassed reset retention (new since F4, 2026-10-21). |
| `allowed-ordinary-reset` | adopted | as `/new`, reason `reset` | captured = current | as configured | seam absent | as `/new` |
| `allowed-provider-fallback` | adopted | the run's model fallback, which writes no epoch | captured = current | as configured | seam absent | The driver modelled fallback as a session-entry model patch. That shows the patch writer keeps the epoch, not that a real fallback run delivers. |
| `allowed-compaction` | adopted | a post-compaction delegate staged and released with its binding | captured = current | as configured | seam absent | none found |
| `allowed-gateway-restart-replay` | adopted | durable row replay through `deliverQueuedSessionDeliveryCore` | captured = current | as configured, no duplicate | seam absent | A fixture SIGTERM and respawn plus the driver's own drain; no supervised restart (see above). |
| `allowed-session-id-rollover` | adopted | an implicit reply-session rollover with inert retention hooks | captured = current | as configured | seam absent | The driver wrote the new session ID through the accessor, not the rollover flow. |
| `allowed-late-materialization` | adopted | first capture creates the epoch; materializing writes none | captured = current | exactly one adoption | seam absent | Holds only if the materializing write does not narrow visibility below `shared`. |
| `forbidden-delete-recreate` | stale | `sessions.delete` advances the epoch in the deleting transaction, and the recreated key keeps the advanced epoch | captured != current | zero; row acknowledged | seam absent | none found |
| `forbidden-owner-reassignment` | unauthorized | `sessions.assignOwner` advances it when the owner changes | captured != current | zero; row acknowledged | seam absent | none found |
| `forbidden-member-access-removal` | unauthorized | `session.members.remove` advances it | captured != current | zero; row acknowledged | seam absent | none found |
| `forbidden-restrictive-visibility` | unauthorized | any writer narrowing visibility advances it | captured != current | zero; row acknowledged | seam absent | At P89 only the Gateway method advanced, so the driver added its own advance. At j12 the writer advances on its own, so a restored driver must not. |
| `forbidden-explicit-revocation` | revoked | none: no revocation API at j12 | n/a | n/a | seam absent; only `not-exposed` is creditable | The driver claimed an exposed revocation API from a `test-runtime/` surface and advanced the epoch itself. The resolver now refuses that (`revocation-capability-mismatch`). |

Two more gaps apply to every case:

- **Database profiles.** The plan's profiles are fresh v19, covenant v18 upgrade, participant
  v18 upgrade and idempotent v19 reopen. The retention inspector's pins are global v15 and
  per-agent v19. Both are product `0ed59cb6`'s. At j12 the stores are per-agent schema 40 and
  global schema 36 (openclaw#1484 moved recipient authority onto upstream's schema 39). A j12
  store would fail closed as `unverified-resource-retention`, never a false PASS, but no case can
  pass until the profiles and pins are re-anchored.
- **Effect source names.** The effect counters' source names (`heartbeat-wake`) are synthetic
  labels in the test fixtures. At j12 the wake is the continuation wake handoff.

## What ClawSweeper asked for, and which case answers it

ClawSweeper's standing review on openclaw/openclaw#129388 (comment 5442236054, reviewed head
`e7639581`) rates proof confidence 3/6. It asks for:

> allowed-recipient and revoked/reassigned-recipient proof, including restart replay

and, under Security:

> allowed delivery and rejection after revocation or reassignment still need evidence through
> prompt adoption, wake, and restart replay.

Each part of the ask maps to these cases. "Refused before final effects" means: zero prompt
adoption, zero wake, zero channel delivery, no residual result marker in the successor transcript
or trusted system events, and the durable row acknowledged with no retry.

- **Allowed delivery.** The seven `allowed-*` cases. Each must adopt exactly once and produce its
  return mode's prompt, wake and channel counts: `normal` is 1/1/1, `silent` 1/0/0,
  `silent-wake` and `post-compaction` 1/1/0. `allowed-ordinary-reset` and
  `allowed-session-id-rollover` (both `normal` in the synthetic plan) carry the full chain,
  prompt adoption to wake to channel delivery.
- **Unauthorized.** `forbidden-owner-reassignment`, `forbidden-member-access-removal` and
  `forbidden-restrictive-visibility`, each refused before final effects.
- **Revoked.** The product has no explicit revocation API at j12, so
  `forbidden-explicit-revocation` can only be `not-exposed`, backed by the product's capability
  receipt. Revocation of access exists in the product as member removal and visibility narrowing
  (the product's own comments call both revoking). So the revocation proof is
  `forbidden-member-access-removal` and `forbidden-restrictive-visibility`, which the matrix
  labels `unauthorized`.
- **Reassigned.** `stale` is the reassigned recipient: `forbidden-delete-recreate` gives the same
  logical key to a new session generation after deletion. `forbidden-owner-reassignment` is the
  reassigned owner. Session-id rollover and ordinary `/new` and `/reset` are not reassignment: the
  logical recipient and its epoch carry over, so they are allowed edges and must adopt.
- **Replay.** `allowed-gateway-restart-replay`: the held return's durable row outlives the process
  and is replayed through `deliverQueuedSessionDeliveryCore`, then adopted exactly once with no
  duplicate.
- **Not covered**, even when the matrix runs:
  - **Nothing at j12.** The product seam is absent, so the matrix gives no evidence about the
    presented product until a seam returns at an exact candidate.
  - **Rejection after restart replay.** No case takes a refused return across a restart. The
    product's replay check (`server-restart-sentinel-delivery.ts:234-243`) is unexercised, though
    ClawSweeper's Security item asks for exactly this.
  - **Explicit revocation.** No product API exists to test.
  - **The supervised restart branch.** That is `R-CD-RETURN-COVENANT-AUTHORITY`'s claim, not this
    row's.
  - **A real gateway invocation.** The matrix is process-local with synthetic recipients and a
    synthetic channel: no model turn, no real channel delivery. It is capped at
    `PARTIAL-candidate`.
  - **The j12 reset-retention flow for `/new` and `/reset`.** Covered only once a restored seam
    drives the product reset flows.
  - **Multi-recipient fanout and cross-agent recipients.** `tree` and `all` fanout and recipients
    owned by another agent are outside the matrix.
  - **Trace evidence.** The Tempo trace receipts are owed and can never be produced in the
    sandbox.

## Verdict cap and trace receipts

The matrix's only producer is a process-local launcher and product-owned fixture driver. That is
not an external gateway invocation, so under 🌊's ruling on docs#616 (Discord 1565925290008387728)
the manifest declares `verdictCap` with `rowCap: PARTIAL-candidate`. A signed matrix
`PASS-candidate` is behavioral only, and the row verdict is the minimum of that verdict and the
cap. Lifting the cap needs a superseding authority receipt from a different artifact class,
adopted by an explicit method change; none is adopted.

The row fires `continue_delegate`, so under #600 it owes `tempo-trace-json` and
`continuation-trace-correlation`. The sandbox runs with an unshared network namespace and exports
no spans, so these receipts stay pending on every run. They decide review completeness, never the
verdict. The manifest names `invocation.mode: normal` only because the trace rule needs one
attribution key. The plan fires all four delegate modes, so a live trace collection would need a
per-case collector.

The manifest is `orchestration-required`, so `live-run-guard.mjs`, `run-proof.sh` and
`run-proofs.sh` all refuse it. docs#536 authorizes no live acceptance fire until the final
successor is mergeable, exact-head CI-clean, reviewed and deployed fleet-wide.

## What executing it needs

These are decisions for the cohort; this row does not make them.

1. **A product seam at the presented SHA**, or an explicit decision to fire at a fork-full SHA
   that still carries it, and to accept that the evidence is about that SHA, not j12.
2. **Database profiles and retention-inspector pins re-anchored** to the product's current schema
   line (per-agent 40 and global 36 at j12), with the fresh-database drift control rerun against
   that product.
3. **A restored driver that drives each edge through the product path the table names:**
   - the reset flows for `/new` and `/reset`;
   - the rollover flow;
   - the product's own visibility-narrowing advance, with no driver-side advance;
   - `not-exposed` for explicit revocation unless the product adds an API.
4. **A refused-return-after-restart case**, if ClawSweeper's Security item is to be answered
   completely.
5. **Review of the restored seam and of this harness at the final docs SHA**, then a fire
   authorized under docs#536. Folding into a corpus is a separate, reviewed coordinator step.

The launcher, sandbox, runtime artifact and signed-observer contract are in
[`RETURN-COVENANT-AUTHORITY-HARNESS.md`](RETURN-COVENANT-AUTHORITY-HARNESS.md).
