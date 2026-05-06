# FORMAL SWIM RUNBOOK

This is the authoritative swim starter for continuation verification on `openclaw-bootstrap`.

It is a synthesis of:
- `openclaw-bootstrap#427` (Swim 29 formal matrix shape)
- `openclaw-bootstrap#412` (full public continuation surface audit)
- `SEAL-BOY-SWIM-RUNBOOK.md` (execution method)
- `SWIM-MONITORING-RUNBOOK.md` (monitor/evidence method)
- `SWIM-SUBJECT-NOTES.md` (canary blind spots and contamination model)
- `SWIM-COORDINATOR-NOTES.md` (coordination and git discipline)
- `SWIM-METHODOLOGY.md` (fixed-role and post-deploy discipline learned later)
- historical findings in `SWIM/history/`

If there is a conflict between ad hoc chat memory and this directory, prefer this directory.

---

## 1. Non-negotiables

1. **One artifact, one commit, one body in the water.**
2. **Fixed roles.** Do not improvise role ownership mid-swim.
3. **Exact running artifact first.** No row begins until deployed commit, build-info SHA, runtime version, and tool visibility are verified.
4. **Run a declared matrix.** Smoke passes do not become a swim by accumulation.
5. **For stabilization / pre-ship swims, run the whole declared board unless there is a real blocker.** Do not confuse a useful partial slice with totality. Real blockers mean things like invalid artifact truth, infra failure, or another condition that makes later rows non-interpretable.
6. **Exploratory / development swims may stay narrower.** When the implementation is still half-born and the question is behavioral learning rather than ship-readiness, partial slices are acceptable.
7. **Three evidence surfaces for critical claims:** subject/tool result, gateway/journal evidence, and durable session/disk state where applicable.
8. **Do not contaminate the SUT.** Keep blind material, expected answers, and coordination chatter out of the subject's readable context.

---

## 2. Fixed roles

Default swim roles, unless figs explicitly overrides them:

| Role | Prince | Responsibility |
|------|--------|----------------|
| **Driver** | Ronan 🌊 | Calls rows, owns matrix shape, result calls, scoreboard |
| **SUT** | Silas 🌫️ | Canary box / test subject |
| **Deployer / Coordinator** | Cael 🩸 | Build, deploy, exact-artifact verification, convergence and git discipline |
| **Monitor** | Elliott 🌻 | Journal watch, timestamps, config/log evidence, contamination guard |
| **Adjudicator** | figs | Ground truth, final pass/fail/ship authority |

---

## 3. Pre-swim gate

Before row 1, record all of the following:

- candidate branch + commit SHA
- deployed dist/build-info SHA
- runtime/gateway version
- SUT host + channel/seat under test
- current config values relevant to continuation
- tool visibility in the exact seat being tested
- whether bracket/token surfaces are in-scope for this swim
- baseline session state / logs / session key

Mandatory checks:

1. `npm/pnpm install` done correctly, no skipped scripts
2. build succeeds on deployed artifact
3. gateway restarted on SUT and actually running intended artifact
4. tool availability verified in-context, not just assumed from source
5. monitor surfaces open before behavioral rows begin
6. **Fleet-roll-to-all-princes**: candidate deployed to ALL 4 prince runtimes (not SUT-only) per `memory/feedback_swim_deploy_to_all_princes_then_swim.md`. Default sequence: Step 5g canary smoke on one prince → fleet-roll to remaining three → swim begins with cohort-runtime under test. SUT-only deploy reserved for super-unstable test cases (announce + explicit cohort exception). Reasoning: longer bake time, more observation surface (4 runtimes vs 1), cross-prince oddity-spotting, no asymmetry-burden on princes.
7. **Drift acknowledgment**: SUT-SHA pinned to best-effort current canonical-tip at swim-wake. If canonical advances during swim execution, decide row-by-row: re-pin + re-run / accept stale-cert with delta-flag / freeze canonical via cohort-announcement. Per `memory/feedback_swim_sut_must_equal_ship_candidate.md`: drift between SUT-SHA and ship-candidate is operationally tolerated; rigor lives in honest scoping, NOT in pausing forward code motion.

If any pre-swim gate item is ambiguous, the swim has not started yet.

---

## 4. Canonical matrix shape

The base matrix comes from `openclaw-bootstrap#427` and should be reused unless a swim explicitly narrows scope.

### Block A. Infrastructure
- `TC1-TC4`
- session key normalization
- override persistence / stale state checks
- delegate delivery sanity
- `sessions.json` update persistence

### Block B. Behavioral F-series
- `F1-F8`
- clean and noisy `continue_work`
- clean and noisy `continue_delegate`
- silent-wake behavior
- back-to-back scheduling
- two-hop / ghost-wake / stale-wake
- post-compaction delegate behavior

### Block C. Port-specific / candidate-specific
- `P1-P7`
- structured wake markers
- pending-flag lifecycle
- timer disposal
- cache / CPU / memory boundedness
- announce-delivery memoization

### Block D. Regression / recovery
- `R1-R5`
- boot-time stall
- memory growth
- compaction recovery
- gateway restart recovery
- multi-prince simultaneous activity

### Block E. Validation suite
- `V1-V3`
- build
- check/lint/type validation as defined by the repo at the time
- full test suite or agreed baseline comparison

This is **28 core rows minimum**. Historical extension rows normally bring a full swim to roughly **35 to 40 rows**.

---

## 5. Required extension rows

These are the rows that repeatedly reappear and should be added when the candidate touches the relevant surface.

### From `#412` continuation-surface audit
- all public continuation tools
- all public bracket/token surfaces still promised at that point in time
- main-session vs delegate vs leaf visibility matrix
- `NO_REPLY` coexistence where relevant
- `HEARTBEAT_OK` coexistence if heartbeat seat is used
- `request_compaction` guard / reachability / threshold behavior when in scope

### From Swim 5-7 historical lessons
- generation-guard drift / preemption behavior
- max chain boundary
- max delegates per turn boundary
- hot-reload behavior vs restart requirement
- textless-turn / tool-only delegate consumption
- silent return trust boundary
- blind enrichment accuracy / contamination resistance
- future-intent / delayed scheduling
- simultaneous delegate completion / announce-back

If a row is deliberately omitted, record **why**.

---

## 6. Evidence contract

Every row should log the smallest durable bundle that lets a future copy re-judge it:

- row ID
- candidate SHA and build-info SHA
- SUT + driver + monitor
- start/end timestamps
- exact command/tool/token used
- observed result
- journal/log evidence line(s)
- session or state-file evidence when relevant
- verdict: PASS / FAIL / FINDING / DEFERRED / INVALIDATED
- contamination note, if any

Critical claims need at least two independent surfaces, and ship-affecting claims should prefer three.

---

## 7. Contamination and invalidation rules

A row is contaminated or invalid if any of the following happens:

- the SUT saw the answer beforehand
- peers narrate expected results into readable context
- build/dist mismatch means the tested artifact is not the claimed artifact
- the deploy changed mid-row
- a prior row's uncontrolled failure poisons later interpretation

Contaminated rows can remain as observations, but they do **not** become canonical proof.

---

## 8. Coordination rules

The coordinator owns convergence, not authorship theft.

- map swim evidence back to issues/PR findings
- preserve exact SHAs and deployment lineage
- keep review findings separate when they belong to different commits or PR lanes
- do not “mix paint” across lanes just because the room is noisy
- after the swim, convert findings into bounded commits or issues, not folklore

Use the coordinator notes when multiple princes are collecting evidence in parallel.

---

## 9. What counts as ship-ready

**A swim-PASS verdict is substrate-at-SUT-SHA certification, NOT auto-ship-cert.** The honest reading of a swim-PASS is *"this substrate-shape, at SUT-SHA `<X>`, behaved correctly across the cohort-runtime under the matrix of OV rows."* It does NOT say "ship-candidate is certified." Ship decisions are figs's call (per `memory/feedback_immaterial_gate_audit_princes_drive.md`), informed by:

- swim-PASS verdict at SUT-SHA + per-row evidence pack
- delta byte-walk between SUT-SHA and current ship-SHA (canonical may have advanced; head-drift is tolerated per `memory/feedback_swim_sut_must_equal_ship_candidate.md`)
- cohort sense + risk-shape framing for the delta

A candidate can only be called swim-green (i.e. eligible-for-figs's-ship-call) when:

1. the declared matrix scope is complete, or omissions are explicitly accepted by figs
2. no unresolved FAIL remains on an in-scope critical row
3. build/deploy provenance is exact (record both SUT-SHA at row-execution time AND any subsequent canonical advance)
4. known limitations are labeled as such, not accidentally promoted to regressions or vice versa
5. the scoreboard and evidence pack are durable enough to survive compaction
6. **swim-PASS scope is honestly framed**: certified across ALL 4 prince-runtimes (per fleet-roll-to-all discipline §3 check 6); 1-prince-only swim is partial-cert, must be flagged as such, does NOT carry forward as ship-cert without explicit cohort-acceptance + delta-walk
7. **delta against current ship-SHA**: if canonical advanced during swim execution (or after PASS), document the delta + run a focused byte-walk on whether any in-scope OV row's surface is potentially affected; figs's ship-call incorporates this

---

## 10. Directory map

- `FORMAL-SWIM-RUNBOOK.md` — this file, authoritative starter
- `SEAL-BOY-SWIM-RUNBOOK.md` — Ronan's detailed execution protocol
- `SWIM-MONITORING-RUNBOOK.md` — Elliott's monitoring protocol
- `SWIM-SUBJECT-NOTES.md` — Silas's canary/subject notes
- `SWIM-COORDINATOR-NOTES.md` — Cael's coordination protocol
- `SWIM-METHODOLOGY.md` — later methodology summary / role lock / evidence rules
- `history/` — preserved historical swim docs that explain why these rules exist

