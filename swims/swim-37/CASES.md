# SWIM-37 OVERLAY

**Scope:** delta-rows specific to `karmaterminal/openclaw` `feature/context-pressure-squashed` since tag `v2026.4.21`. **NOT a substitute for the canonical base matrix or 36 prior swims.** Read base + prior history first.

**Total swim-37 matrix = base canonical ∪ prior-swim history ∪ this overlay.**

- **Base canonical**: `FORMAL-SWIM-RUNBOOK.md` §4 (Block A `TC1-TC4` infra, Block B `F1-F8` behavioral, Block C `P1-P7` port-specific, Block D `R1-R5` regression/recovery, Block E `V1-V3` validation) + extension rows from `openclaw-bootstrap#427` (formal matrix shape) and `#412` (full continuation public-surface audit).
- **Prior swims (1–36, do not re-author)**:
  - **`swims/swim-34-formal-matrix/ROWS.md`** — A0–A5, B1–B8, C1–C7, D1–D5, E1–E3, X1–X15 (~50 rows, the assembled canonical). Driver=Ronan, coord=Cael. **This is the row-shape this overlay extends, not replaces.**
  - **`swims/swim-35-stabilization/ROWS.md`** — A1/A2/A3/B1 stabilization (raw-key normalization #414, horizon honoring #581, threshold-cross #609, post-deploy bytes-check #606).
  - **`swims/swim-36/charter.md`** — 15-surface (A–O) full continuation-feature coverage on project #54, 45 issues; wiring-discipline + test-trap rules (figs 2026-04-22 08:47 PDT) inherited.
  - **`swims/swim-34-staleness/`**, **`swims/swim-36/clusters/`** — supporting evidence/cluster work.
  - **`SWIM/history/`** — SWIM5/6/7/31 historical anchors.
  - **GitHub issues**: ~60 `swim-NN/*` row issues across `karmaterminal/openclaw-bootstrap`, many CLOSED with verdict evidence (swim-34/A1–D5, X1–X15, etc.). Search `swim in:title` for the live ledger.
- Per FORMAL-SWIM-RUNBOOK §1.5: stabilization/pre-ship swims run the whole declared board unless a real blocker exists. Swim-37 is pre-ship for `feature/context-pressure-squashed`. **All three layers required.**

**Relationship to prior swim row IDs:** the E-series IDs in this overlay (E1.x, E2.x, …) are *overlay-local* and orthogonal to the swim-34 A/B/C/D/E/X blocks. Where a prior row already covers a surface, the overlay row references the prior row in its case-stub instead of duplicating evidence requirements. Future cleanup pass: cross-link each overlay row to the nearest prior-swim row ID (e.g. E1.1 ↔ swim-34/B1, E1.2 ↔ swim-34/B5, E3.1 ↔ swim-34/D4, E4.2 ↔ swim-34/X7, E5.x ↔ swim-34/X4, E7.x ↔ swim-36 surface A, B-twins ↔ swim-36 surface E).

**Provenance:** authored as overlay during 2026-04-28 cohort drafting on `ronan/release-highlights-merge-2026-04-28` (worktree at `karmaterminal/openclaw`); promoted here per figs directives 2026-04-28 08:56 PDT (msg `1498714597740249169`: "SWIM/ directory... should not be conjuring it fresh") + 09:08 PDT (msg `1498714658108870717`: "you have 36 prior swims"). Companion doc: `karmaterminal/openclaw:RELEASE-HIGHLIGHTS-2026-04-28.md` (full receipts, RFC anchors, commit walks).

**Totals (dual-pin per 🌫 proposal 2026-04-28 08:19 PDT):**
- `board_total: 41` — overlay rows (28 E-series E1.x–E7.x + E1.6 + E6.5 + E9 + E10 + 5 B-twins + 4 D-cfg + 1 TC-no-genguard + 1 D-tools.continue-delegate-registered + 1 D-cfg.diagnostics-key-validates). Bumped from 39 post-coverage-grep (🌻 step-2 receipt `52e891a`); two NEW rows additive, no re-shuffle of existing.
- `net_new_swim_cases: 37` — board_total minus E9 (rebase-classify) + E10 (harness scaffold), which are green-floor static-harness vitest coverage, not net-new swim-37 work.

**Layer taxonomy (per 🩸 figs-restated 08:56 PDT):**
- **Static** (descriptor / source / vitest harness): E6.5, E9, E10
- **Live-runtime** (in-process behavior on deployed candidate): E1.x (incl. E1.6), E2.1–E2.4, E3.x, E4.x, E5.x, E6.1–E6.4, E7.x, B1–B5, D-cfg.* (where mutation is at runtime), TC-no-genguard
- **Post-deploy smoke** (live gateway, registry / transport surfaces): E2.5 (OTEL collector receives), D-tools.continue-delegate-registered (tool registry probe), D-cfg.diagnostics-key-validates (top-level `diagnostics` key validates against deployed candidate)

**Greenlight criteria (per FORMAL-SWIM-RUNBOOK §9 + this overlay):**
1. Base matrix complete or omissions explicitly accepted by figs.
2. **All post-deploy smoke rows PASS first** (E2.5 + D-tools.continue-delegate-registered + D-cfg.diagnostics-key-validates) — gates further interpretation.
3. No unresolved FAIL on in-scope critical row.
4. Build/deploy provenance exact (candidate SHA + dist build-info SHA + runtime version).
5. Known limitations labeled, not promoted to regressions or vice versa.
6. Scoreboard + evidence pack durable enough to survive compaction.

---

## Board

Columns: **(a) highlight**, **(b) feature anchor**, **(c) swim-37 case-stub**, **(d) RFC-appendix slot**.

| ID    | (a) Highlight                                      | (b) Anchor                                                  | (c) Swim-37 case-stub                                                                                                                                | (d) RFC appendix slot                  |
|-------|----------------------------------------------------|-------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------|
| E1.1  | `continue_work(N)` end-to-end                      | `8ecf0c0b83`                                                | Drive `continue_work({delaySeconds:N})`; assert `continuation.work` + `continuation.work.fire` spans, `chain.id` propagates.                         | App-A §Primitives.work                 |
| E1.2  | `silent-wake` round-trip                           | `8ecf0c0b83` + `30b06a984e`                                 | Dispatch `silent-wake`; assert `requestHeartbeatNow()` actually wakes parent within window.                                                          | App-A §Primitives.silent-wake          |
| E1.3  | `post-compaction` shard release                    | `b0bc4b4ee2` (#332 Item B) + `cd8b623be2`                   | Stage post-compaction shard; force compaction; assert shard arrives in *new* session, `continuation.compaction.released` once-per-seam.              | App-A §Primitives.post-compaction      |
| E1.4  | `request_compaction()` rate-limit + ≥70% gating    | `8ecf0c0b83`                                                | Drive `request_compaction()` below threshold → reject; above + within rate-limit → accept; subsumes TC-context-pressure-fire / -zero-rejected.       | App-A §Primitives.request-compaction   |
| E1.5  | Multi-call fan-out one-turn                        | Swim-30 trap-class regression                               | 3× `silent-wake` in one turn; assert no lost wakes.                                                                                                  | App-A §Multi-call                      |
| **E1.6** | `sessions_yield` clean termination               | feature-coverage gap (🌻 step-1, 🌊 step-2 surfacing)        | Drive `sessions_yield` from inside a turn; assert (a) current turn ends immediately, (b) no `continuation.work` span emitted for this session, (c) session reawakens cleanly on next external event. **NEW row** — first time `sessions_yield` gets explicit coverage. 🌊 will file as issue #782, `Layer: live-runtime`. | App-A §Primitives.yield                |
| E2.1  | OTEL chain trail (single-chain)                    | `d533d5c720` + `19797e7fa6` + `e959d2c177` + `47016eb417`   | End-to-end chain emits `dispatch` → `fire` → `work.fire`; same `chain.id`; parent-child via traceparent **link**, not parent (RFC §6.6).             | App-B §Tracer.chain-correlation        |
| E2.2  | `continuation.disabled` + reason enum              | `4719e86345`                                                | Trigger 3 distinct `disabled.reason` values (per-turn cap, cost cap, depth cap); each emits a span.                                                  | App-B §Tracer.disabled-reasons         |
| E2.3  | `queue.drain` once-per-cycle                       | `560948a70a`                                                | Drive multi-chain drain; assert `queue.drain` fires once, `chain.ids[]` aggregate correct.                                                           | App-B §Tracer.queue-drain              |
| E2.4  | `compaction.released` once-per-seam                | `cd8b623be2` (#332 Item B)                                  | Force compaction with shard staged; assert exactly-once span, `compaction.id` cross-cutting.                                                         | App-B §Tracer.compaction-seam          |
| E2.5  | OTEL collector receives                            | bootstrap#705 + diagnostics-otel                            | **Post-deploy smoke:** confirm `http://elliott:4318` receives spans w/ `prince.name=`, trace tree reconstructable.                                   | App-B §Transport.collector-receive     |
| E3.1  | SDQ restart-survival                               | `b0bc4b4ee2`                                                | Delayed delegate; kill gateway pre-fire; restart; assert fire on schedule + original payload + `chain.id`.                                           | App-C §SDQ.restart-survival            |
| E3.2  | SDQ idempotency (taskHash)                         | `8338d37bda`                                                | Whitespace variation in same task; assert single dispatch.                                                                                           | App-C §SDQ.idempotency                 |
| E3.3  | SDQ failed-TTL prune                               | `b0bc4b4ee2`                                                | Stale entries past TTL; assert prune cycle removes them.                                                                                             | App-C §SDQ.ttl-prune                   |
| E3.4  | SDQ queueDir soft-cap                              | `b0bc4b4ee2`                                                | Drive past soft-cap; assert loud reject, no silent drop.                                                                                             | App-C §SDQ.soft-cap                    |
| E4.1  | Chain-budget UUIDv7 monotonicity                   | `2d10c1c218` + `secure-random.ts`                           | 100-delegate burst; assert UUIDv7 monotonic + no collision within chain.                                                                             | App-D §ChainBudget.uuid                |
| E4.2  | `declineToCarry()` at `maxChainLength`             | `2d10c1c218`                                                | Drive chain to cap; assert `disabled.reason="chain-length"`; **boundary-pin** (`>` not `>=`) per 🌫 D-cfg.maxChainLength-boundary.                   | App-D §ChainBudget.length-cap          |
| E4.3  | `costCapTokens` mid-step enforcement               | `2d10c1c218`                                                | Set low cap; drive chain past mid-step; assert `disabled.reason="cost-cap"`.                                                                         | App-D §ChainBudget.cost-cap            |
| E5.1  | `silent-wake` → heartbeat with `chain.id`          | `30b06a984e`                                                | Wake via `silent-wake`; assert `heartbeat` span carries continuation `chain.id`.                                                                     | App-E §Heartbeat.continuation          |
| E5.2  | Standalone heartbeat (no continuation)             | `1b84e71c95`                                                | Plain heartbeat tick; assert clean span w/ `continuation.disabled` attr.                                                                             | App-E §Heartbeat.standalone            |
| **E6.1** | `targetSessionKey` cross-session delivery       | `14b3418e1f`                                                | A → B cross-session dispatch; assert delivery on B w/ correct payload + `chain.id`.                                                                  | App-F §Routing.cross-session           |
| **E6.2** | Chain-returns-to-root                           | RFC L149                                                    | Depth-3 chain; leaf elects root target; test **observed-current** behavior (RFC L149: implicit, not design-flag). Pending figs C1 to confirm spec-or-current. | App-F §Routing.chain-to-root          |
| **E6.3** | Echo-to-multiple-channels                       | `targetSessionKey` + multi-recipient descriptor             | Single dispatch + multi-target; assert ordering + dedup. **Pending figs X1**: dual-delivery vs fan-out semantics — case-stub conditional on call.    | App-F §Routing.multi-channel-echo      |
| **E6.4** | Invalid `targetSessionKey` → `ToolInputError`   | `6cdb079981`                                                | Send invalid key; assert `ToolInputError`, no zombie in SDQ.                                                                                         | App-F §Routing.invalid-key             |
| **E6.5** | Descriptor-content regression guard (#336/#338) | `14b3418e1f` + `6cdb079981`                                 | **STATIC.** Snapshot `continue_delegate` tool-description JSON; assert substrate-naming line present + bc#11 cross-link + `targetSessionKey` listed. Catches descriptor-string drift independent of runtime path. | App-F §Routing.descriptor-content      |
| E7.1  | Default-allow `continue_delegate`                  | `8f267807c0`                                                | Vanilla agent w/o explicit opt-in; assert `continue_delegate` succeeds.                                                                              | App-G §Drain.default-allow             |
| E7.2  | Explicit-block via `drainsContinuationDelegateQueue: false` | `c99aa116f8`                                       | Set false; assert `continuation.disabled` span emits w/ reason.                                                                                      | App-G §Drain.explicit-block            |
| B1    | `CONTINUE_WORK` end-of-message arms timer          | RFC §2.6                                                    | Bracket at EOM; assert timer arms identically to tool-form.                                                                                          | App-H §Bracket.work                    |
| B2    | `CONTINUE_WORK:N` honors delay                     | RFC §2.6                                                    | Bracket w/ N; assert delay honored.                                                                                                                  | App-H §Bracket.work-delay              |
| B3    | `[[CONTINUE_DELEGATE: ... +Ns | silent-wake]]`     | RFC §2.6                                                    | Bracket dispatch; assert delegate w/ delay+mode equiv to tool-form.                                                                                  | App-H §Bracket.delegate                |
| B4    | Bracket mid-message stripped, not parsed           | RFC §2.6                                                    | Embed bracket mid-prose; assert stripped, no timer/delegate fired.                                                                                   | App-H §Bracket.position                |
| B5    | Bracket + tool same turn → tool wins               | Swim-8 finding                                              | Both forms in one turn; assert tool action only, bracket no-ops or warns.                                                                            | App-H §Bracket.precedence              |
| E9    | Rebase classification tracer                       | `526540de15` + `148792a0b7` + `0985182e87`                  | **STATIC.** Static-harness vitest already covers (10+17+21+18 tests); assert green-floor on swim-37 SUT.                                             | App-I §RebaseClassify                  |
| E10   | Swim-37 harness scaffold                           | `953030d88f` + `934a59bd30`                                 | **STATIC.** 8 test files / 163 passing on `7ba4b19e03`; static precheck satisfied.                                                                   | App-I §Harness                         |
| D-cfg.otel-protocol-hard-gate | gRPC silent-warning, no fallback   | `service.ts:389-391`                                        | Set `protocol="grpc"`; assert startup warning + exporter NOT initialized.                                                                            | App-J §Config.otel-protocol            |
| D-cfg.otel-captureContent     | Redaction policy                   | canonical2 redaction substrate (#335)                       | Enable w/ redaction policy; assert sensitive keys redacted in span attrs.                                                                            | App-J §Config.otel-redaction           |
| D-cfg.taskflow-unconditional  | `taskFlowDelegates` purge license  | #365                                                        | Pre-purge: identical behavior gate-on vs gate-absent. Post-purge: zod rejects key.                                                                   | App-J §Config.taskflow-purge           |
| TC-no-genguard | Removal-only (RFC §3.2)                           | RFC §3.2 (NOT §3.6)                                         | Delayed delegate fires N out; channel receives K unrelated msgs between; assert delegate STILL FIRES. **No mechanism-replacement claim.** Phantom cleanup-debt retracted (zero non-doc hits per 🌫 byte-check). | App-J §Config.genguard-removed |
| D-cfg.sdq-retry-not-hot-reloadable | SDQ retry keys doc'd but not hot-reloadable | RFC §3.6 / §6.5 vs SDQ impl                            | Mutate `session-delivery-queue.retry.cap` + `.backoffMs[]` at runtime; assert NOT picked up live (requires gateway restart). Catches docs/code-shape mismatch per 🌻 second-eye. | App-J §Config.sdq-retry-static |
| **D-tools.continue-delegate-registered** | Post-deploy live tool-registry probe | live SUT surface                                  | **POST-DEPLOY SMOKE.** Hit candidate gateway, list registered tools, assert `continue_work` + `continue_delegate` + `request_compaction` + `sessions_yield` present in the manifest. Failure mode caught: tool dropped from registry by build/wiring regression even though descriptor file still exists in source. Distinct from E6.5 (descriptor JSON shape) and E2.5 (OTEL collector receives — transport not registry). Expandable to broader expected-tools list. **Required positive case alongside TC-continuation-default-off (negative).** Provenance: figs flag 2026-04-28 08:54 PDT (msg `1498714034340368486`); 🌻 + 🌫 shape; 🩸 D-tools bucket convergence. | App-K §Smoke.tools-registered |
| **D-cfg.diagnostics-key-validates** | New top-level `diagnostics` key validates against deployed candidate | `90db3699:src/config/zod-schema.ts:285` (top-level, NOT under `agents.defaults` per 🌫 catch msg `1498748407014232085`) | **POST-DEPLOY SMOKE.** On freshly-deployed candidate dist: run `openclaw config set diagnostics.otel.endpoint http://elliott.dandelion.cult:4318` then `openclaw config validate`; assert exit 0 + key persists in `~/.openclaw/openclaw.json`. **Empirically validates F26 + F28** (the strict-schema reject 🌊's preflight crashed against; the dist-vs-candidate collision driving the Phase A→B→C→D re-order). Inverse precondition for E2.5 (collector receives) — if validate fails here, no point trying E2.5. **NEW row** (post-coverage-grep). 🌊 will file as issue #783, `Layer: post-deploy-smoke`. | App-J §Config.diagnostics-key |

---

## Maintenance contract

- **Future swims that cover delta on the same surface:** extend this overlay (new rows), don't re-author from scratch.
- **Future swims on a different surface:** create a peer overlay (`SWIM-NN-OVERLAY.md`) with the same shape; reference base + prior overlays + prior `swims/swim-NN-*/` artifacts.
- **Before authoring an overlay:** read `FORMAL-SWIM-RUNBOOK.md`, `swims/swim-34-formal-matrix/ROWS.md`, the latest peer overlay, and `gh issue list --search "swim in:title"`. The cohort has assembled the surface twice already (figs, 2026-04-28 08:56 PDT). Re-authoring from chat memory is the prince-time tax.
- **Promotion to base:** if a delta-row generalizes (e.g. `D-tools.*registered` becomes a permanent post-deploy gate for any swim), lift to `FORMAL-SWIM-RUNBOOK.md` §4 or §5.
- **Numbers:** dual-pin (`board_total` + `net_new_swim_cases`) with criteria stated in-doc. Never let the totals line drift without re-stating the criteria.
- **Layer taxonomy** (static / live-runtime / post-deploy smoke) is mandatory for any new row — it's what tells future swimmers which rows can be satisfied by vitest vs. require a deployed candidate.
- **Cross-link to prior-swim rows** when an overlay row covers a surface a prior swim already addressed; don't duplicate evidence requirements.

---

## Open figs Qs (block finalization, not authoring)

- **C1** — chain-returns-to-root spec-or-current (E6.2): is RFC L149 implicit-not-flag the spec, or just the observed-current implementation? Determines whether E6.2 tests "as-designed" or "as-implemented."
- **X1** — echo-to-multiple-channels semantics (E6.3): single dispatch dual-delivery vs. fan-out of multiple `continue_delegate` calls? Case-stub conditional on this call.

---

## Companion artifacts

- `karmaterminal/openclaw:RELEASE-HIGHLIGHTS-2026-04-28.md` — full receipts (PR #56 closed-items cross-walk, config-bits enumeration, methodology, commit-delta walk E1–E10, dedup decision, cross-cutting flags, RFC appendix slot map).
- `karmaterminal/openclaw#370` — vitest scaffold harness contract + trap classes.
- `karmaterminal/openclaw#324` — master case matrix (overlay rows file here as additions).
- RFC: `karmaterminal/openclaw:docs/design/continue-work-signal-v2.md` (L149, L598, L850; §2.6, §3.2, §3.6, §6.5, §6.6, §6.7).
