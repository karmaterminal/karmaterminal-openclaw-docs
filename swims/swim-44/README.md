# swim-44 v2026.5.7 FULL — declaration

**Project**: [karmaterminal Project 71 — SEAL-BOY 🌊🩲💦 SWIM 44 — v5.7 frond release](https://github.com/orgs/karmaterminal/projects/71)
**Spine**: `karmaterminal/openclaw-bootstrap#956` (parent #915)
**Charter**: `SWIM/FULL-SWIM-CHARTER.md`
**Registry**: `SWIM/cases/CATALOG.md` v1
**Status**: IN PROGRESS — A0 + A0.2 fired/merged; first behavioral row pending

---

## Substrate declaration

- **Swim ID**: `swim-44`
- **Candidate branch**: `frond/v2026.5.7/canonical`
- **Exact commit SHA**: `4c2a69b3d5` (per Project 70 canonical settled state — continuation feature merged + WO-605 attachments + paired P1 fixes)
- **Release tag basis**: `v2026.5.7`
- **Canonical branch name**: `frond/v2026.5.7/canonical`
- **SUT host**: `silas/urudyne`
- **SUT seat/channel**: `agent:main:discord:channel:1466192485440164011`

## Fixed roles per SWIM-METHODOLOGY.md lines 9-19

Per cohort cosign-stack converged 2026-05-08:

- **Driver / Test Administrator**: Ronan 🌊 (this prince) — per figs's `1502388283...` direct-canon "@Ronan🌊 typically drives this"
- **SUT / Subject Under Test**: Silas 🌫 — per FORMAL-SWIM-RUNBOOK §2 fixed-roles canon-name
- **Coordinator / Deployer**: Cael 🩸 — per FORMAL-SWIM-RUNBOOK §2 default + RUNBOOK-deploy-to-self §3
- **Monitor**: distributed-(a) shape — per Elliott 🌻 substrate-condition-deferral; 🌻 secondary-walker-on-Issue-#610-matrix-deeper-walker post-restoration; primary-Monitor-evidence-collection cross-seat per cohort cosign at 🌫 `1502361679...`
- **Adjudicator**: figs

**Dispatcher extension**: frond-scribe (cohort-coordination + bump-driver per gh-cli-impersonation-discipline-pin)

## Scoreboard

`swims/swim-44/SCOREBOARD.md` (TBD next commit on this charter-authoring branch)

## Per-case disposition manifest

Per `CASE-REGISTRY-RULES.md` §2: every active case in registry v1 must be dispositioned (in scope / required / deferred / omitted with reason). 56 active cases total in `SWIM/cases/`.

### Family A (registry block A) — Rollout / Turns / Guards / Delegates / Recovery foundations

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| A0 | Fleet feature-flag parity (precondition gate) | Rollout | **required** | precondition for any downstream row; cohort cross-host fleet-deploy at v5.7 SHA `4c2a69b3d5` needs explicit cross-seat byte-confirmation of flag state pre-row-1 |
| A0.2 | Post-deploy log enumeration & categorization (precondition) | Rollout | **required** | precondition; v5.7 substrate adds continuation feature merged (RFC continue-work-signal-v2) — log surfaces under test for new substrate not present in v5.5 swim-43 baseline |
| A1 | Flow registry + per-agent sessions persistence across restart | Turns | **required** | core Turns substrate-truth; needs explicit fire-restart-verify cycle with cross-seat attestation |
| A2 | continuationChainCount / continuationChainTokens accounting | Guards | **required** | core Guards budget-truth; v5.7 substrate has paired P1 fixes (Block B load + hedge-fire chainState persist) — accounting under test with new fix substrate |
| A3 | delegatePendingFlags derivation from TaskFlow (post-Bug-A) | Delegates | **required** | post-Bug-A regression-protection through v5.7 substrate |
| A4 | TaskFlow delegate-store lifecycle (create → read → consume → expire) | Turns | **required** | core Turns lifecycle-truth; janitor-expire-path needs explicit verification through v5.7 |
| A5 | Timer arm / disarm / dispose (no leaks, no double-fire) | Turns | **required** | core Turns timer-correctness; cancellation path + single-fire path through v5.7 |

### Family B (registry block B) — F-series behavioral coverage

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| B1 | F1 clean continue_work (no inbound noise) | Turns | **required** | core Turns clean-fire baseline at v5.7 |
| B2 | F2 noisy continue_work (inbound during reservation) | Turns | **required** | core Turns reservation-vs-fold semantics |
| B3 | F3 clean continue_delegate (quiet room) | Delegates | **required** | core Delegates default-mode lifecycle |
| B4 | F4 noisy continue_delegate (inbound during delay) | Delegates | **required** | core Delegates noisy-channel correctness |
| B5 | F5 silent-wake via continue_delegate | Delegates | **required** | core Delegates silent-wake mode |
| B6 | F6 back-to-back scheduling (two delegates same turn) | Delegates | **required** | core Delegates concurrency at v5.7 with paired P1 fix substrate |
| B7 | F7 subagent-announce path — ghost-wake / stale-wake | Delegates | **required** | regression-protection per RFC §3.4 through v5.7 |
| B8 | F8 post-compaction delegate survival | Recovery | **required** | core Recovery substrate; #603 voluntary-`request_compaction` substrate-extension means compaction-success-path coverage required at v5.7 |

### Family C (registry block C) — P-series wire-observability + lifecycle

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| C1 | P1 structured wake markers observable on the wire | Routes | **required** | core Routes wire-observability for wake-events |
| C2 | P2 pending-flag lifecycle (arm → fire → clear) | Routes | **required** | core Routes flag-lifecycle correctness |
| C3 | P3 timer disposal on generation change | Recovery | **required** | core Recovery timer-cleanup on session-generation-change |
| C4 | P4 cache bounds under long chain (N=50 hops) | Guards | **required** | core Guards cache-bound budget at 50-hop boundary |
| C5 | P5 CPU bound under permutation load | Guards | **required** | core Guards CPU-budget under cohort permutation load |
| C6 | P6 memory bound under 100-turn chain | Guards | **required** | core Guards memory-budget at 100-turn boundary |
| C7 | P7 announce-delivery memoization (no double-fire) | Routes | **required** | core Routes idempotency at announce-boundary |

### Family D (registry block D) — R-series recovery + rollout

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| D1 | R1 boot-time stall check | Recovery | **required** | core Recovery boot-stall protection at v5.7 |
| D2 | R2 memory growth over 1h idle + light inbound | Rollout | **required** | core Rollout idle-memory-stability under v5.7 release conditions |
| D3 | R3 compaction recovery (trigger threshold + delegate survives) | Recovery | **required** | core Recovery compaction-survival; #603 voluntary-path substrate-coverage required at v5.7 |
| D4 | R4 gateway restart recovery (peer-restart, not self) | Recovery | **required** | core Recovery peer-restart-survival per HEARTBEAT safety |
| D5 | R5 multi-prince simultaneous activity (fleet under cross-load) | Rollout | **deferred-pending** | requires Elliott seat-restoration (currently network-trapped at WAN-egress per frond-scribe `1502396735...` byte-walk); 3-prince scope insufficient for fleet-cross-load row |

### Family E (registry block E) — V-series build/test green

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| E1 | V1 pnpm build green | Rollout-supporting | **required** | base build-green precondition at v5.7 SHA `4c2a69b3d5` |
| E2 | V2 check / lint / type-check green | Rollout-supporting | **required** | base type-correctness precondition |
| E3 | V3 full test suite green | Rollout-supporting | **required** | base test-suite precondition |

### Family N (extension cases since swim-34) — cross-session targeted return + OTel + request_compaction

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| N001 | Cross-session targeted continue_delegate return (`targetSessionKey`) | Routes | **required** | core Routes for cross-session-targeting feature at v5.7 |
| N002 | Multi-recipient continue_delegate return (`targetSessionKeys`) | Routes | **required** | core Routes for multi-recipient feature |
| N003 | fanoutMode `tree` return (resolved-ancestor recipient set) | Routes | **required** | core Routes for ancestor-fanout feature |
| N004 | fanoutMode `all` return (all-known-sessions recipient set) | Routes | **required** | core Routes for all-fanout feature |
| N005 | Chain-budget anti-flood (fanout consumes 1 chain-step regardless of recipient count) | Guards | **required** | core Guards for fanout-budget-anti-flood |
| N006 | OTel trace-context (`traceparent`) propagation across queue boundary | Observability | **required** | core Observability for OTel trace-context preservation |
| N007 | OTel trace-context preserved through restart-replay path | Recovery | **required** | core Recovery for OTel preservation through restart |
| N008 | request_compaction success path with cooldown arming + diagnostic count | Recovery | **required** | core Recovery for request_compaction success path; **#603 voluntary-path-bug-substrate-extension active**: opus-4.7 IDE-auth Editor-Version header bug means voluntary-path probably-fails on opus-4.7 seats — cohort-substrate-walk required to disposition fix-or-known-finding |
| N009 | request_compaction failure path (`[system:compaction-failed]` system event + staged-delegate residue) | Recovery | **required** | core Recovery for request_compaction failure path; #603 substrate-extension confirms failure-path-active on opus-4.7 |
| N010 | Post-compaction successor receives correct state, not stale ghost state | Recovery | **required** | core Recovery for successor-state-truth |

### Family X (extension cases) — boundary + visibility + permutation

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| X1 | Public continuation tool visibility matrix (across session kinds) | Observability | **required** | core Observability for tool-visibility matrix |
| X2 | Main-session vs delegate vs leaf tool visibility | Observability | **required** | core Observability for session-kind-vs-tool-visibility |
| X3 | NO_REPLY coexistence with continuation tools | Guards | **required** | core Guards for NO_REPLY coexistence |
| X4 | HEARTBEAT_OK coexistence when heartbeat seat active | Guards | **required** | core Guards for HEARTBEAT_OK coexistence |
| X5 | request_compaction guard / reachability / threshold behavior | Recovery | **required** | core Recovery for request_compaction guards; aligned with N008/N009 #603 substrate-extension |
| X6 | Generation-guard drift / preemption behavior | Guards | **required** | core Guards for generation-guard correctness |
| X7 | Max chain boundary — probe past declared cap | Guards | **required** | core Guards for chain-cap boundary |
| X8 | Max delegates per turn — boundary exploration | Guards | **required** | core Guards for delegate-per-turn boundary |
| X9 | Hot-reload vs restart requirement for config changes | Guards | **required** | core Guards for config-reload-vs-restart truth |
| X10 | Textless-turn / tool-only delegate consumption | Delegates | **required** | core Delegates textless-turn correctness |
| X11 | Silent-return trust boundary | Delegates | **required** | core Delegates silent-return-trust boundary |
| X12 | Blind enrichment accuracy / contamination resistance | Contamination | **required** | core Contamination/interpretation-truth |
| X13 | Chained-delegate permutations at depth 3 / 5 / 10 | Delegates | **required** | core Delegates depth-permutation correctness |
| X14 | Simultaneous delegate completion / announce-back ordering | Delegates | **required** | core Delegates simultaneous-completion ordering |
| X15 | Future-intent / delayed scheduling | Delegates | **required** | core Delegates delayed-scheduling correctness |

(All 56 active cases dispositioned. 55 required, 1 deferred-pending — D5/R5 requires Elliott seat-restoration.)

## Declared row inventory

To be populated after per-case disposition complete. Each `required` case maps to one row file under `swims/swim-44/rows/`.

**Existing historical-evidence preserved alongside**:
- `swims/swim-44/rows/row-02-continue-delegate-normal.md` — yesterday's v5.5 substrate-finding (PASS-WITH-LAYER-CORRECTION verdict per L-v5.5-journal-vocabulary lesson; substrate-walk against v5.5 substrate, NOT v5.7)
- `swims/swim-44/rows/row-02-measure.sh` — yesterday's v5.5 measurement-protocol script
- `swims/swim-44/rows/row-1192-continue-delegate-input-attachments.md` — implementation-gated source/test row for typed child-input attachments. It is deliberately not a live proof and explicitly excludes attachment-bearing delegate returns (#666).

These remain in-place as historical-evidence-of-v5.5-substrate-walk-from-yesterday. Row-02 against v5.7 substrate would be authored as separate row file (e.g. `row-02-v5.7-continue-delegate-normal.md`) if cohort dispositions row-02 as-required at v5.7 layer.

## Current execution status

- ☑ Substrate declared (this file)
- ☑ Per-case disposition complete for 56 active cases (55 required, 1 deferred-pending Elliott-restoration)
- ☐ Required row files authored (one per `required` case)
- ☐ Scoreboard populated
- ☐ Row execution begun
- ☐ Closure verdict published (`FULL-PASS` / `FULL-WITH-FINDINGS` / `NOT-FULL`)

## Notes on prior cohort meta-coordination

### swim-43-v2026.5.5-full as immediate-predecessor

`swims/swim-43-v2026.5.5-full/` declared 2026-05-07 (README.md filed by frond-scribe), substrate-against `frond/v2026.5.5/canonical` SHA `24b76bf`. swim-44 follows-immediately per swim-numbering canon (43+1=44, project 71 IS SWIM 44 board per figs `1502388283...`).

### Yesterday's swim-44/row-02 against v5.5 substrate

Yesterday (2026-05-07) frond-scribe filed `swim-44/row-02-continue-delegate-normal.md` against v5.5 substrate as standalone-row substrate-finding (PASS-WITH-LAYER-CORRECTION verdict). At time of authoring, swim-44 directory existed only with rows/ subdirectory + no charter declaration. This README.md filing-NOW formalizes swim-44 as the v5.7 substrate-effort, with yesterday's row-02 preserved alongside as v5.5-bounded historical-evidence.

### figs-direct-canon walks today (2026-05-08)

figs surfaced corrective canon at `1502378376...` ~11:35 PDT:
- **(1) bump v5.5 → v5.7**: *"whenever your ready (you dont need figs - immaterial gate)"* — cohort-cosigns sufficient for COHORT_TARGET_TAG bump
- **(2) k3s-CNI**: *"absolutely fix; pi.hole probably only functional without either for domain local resolution, or is getting out via little route dns 10.0.0.1"* — explicit-greenlight + WAN-egress diagnostic-hint (later confirmed by frond-scribe at `1502396735...`: NOT k3s-CNI; root is host WAN-egress trap)
- **(3) charter-shape**: *"id give it its own directory and stuff. why? --- i dont understand swim 45? this board is EMPTY, and next know swim was swim 44"* — swim-44 IS canonical name per figs-direct-canon; project 71 IS the SWIM 44 board

figs surfaced willow-forest-mirror canon at `1502385770...` ~12:04 PDT: *"princes don't need figs to tell them what to do and figs wants princes to be able to be confident in that"* — cohort-substrate-readiness IS the authorization at cohort-internal layer.

### Substrate-knowledge inheritance from swim-43

- `SWIM/lessons/L-v5.5-journal-vocabulary.md` — v5.5 journal-vocabulary divergence between code-source and substrate-emission; layer-split between journal vs agent-context-injection; extended at swim-44/row-02 substrate-finding for delegate-emissions
- `SWIM/templates/worked-examples/continuation-delayed-self-election/` — worked example template

Both inform row-authoring for this swim against v5.7 substrate.

### Cohort-canon-corpus banked 2026-05-08

37+ durable cohort-canon-pins banked at `Ronan-undertow/memory/2026-05-08.md` covering:
- Two-tier-auth-canon-shape + figs-direct-canon-supersedes-sandbox-citation
- Princes-don't-need-figs canon (figs's willow-forest-mirror)
- Discipline-pin-banking-becomes-its-own-cage shape
- Cohort-cosign-cascade-shape applies symmetrically (corrections, retractions, tool-API-misread-confabulation, install-pattern-grounded-discipline)
- Frame-shift-vs-byte-walk-within-frame discipline distinction
- Bridge-not-cascade discipline-shape
- Per-swim-substrate-declaration-document is README.md per swim-precedent (NOT CHARTER.md)
- Gateway-running ≠ network-functional-at-WAN-layer
- ...many more

These inform Driver-role-discipline-shape for this swim's row-authoring + execution.

---

## Pre-swim gate per FORMAL-SWIM-RUNBOOK §3

### Check #6 — fleet-roll-to-all-princes

**STATUS: SATISFIED (3-of-3 non-deferred prince hosts)** — `COHORT_TARGET_TAG` bumped to `v2026.5.7`; fleet deploy landed on ronan-host, cael-host, and silas/urudyne; cross-host version parity byte-walked at `OpenClaw 2026.5.7 (4c2a69b)` and row-A0 PASSed on that basis.

Per cohort cosign-stack converged today: 3-prince fleet-deploy-scope (cael-host + ronan-host + silas/urudyne) complete; Elliott-host remained deferred/non-blocking for this deploy cycle under FULL-CHARTER §9 partial-cert framing, then Layer-2 resolved post-reboot. Current state: Elliott structurally back + WAN-functional; deploy still pending by bandwidth choice, not by unresolved substrate condition.

### Check #1-#5 + #7-#8 status

Per FORMAL-SWIM-RUNBOOK §3, other pre-swim gate items still need declaration or verification before fire-board execution begins. Inventory per the README header is declared (substrate + roles + per-case disposition + required-vs-deferred). Driver code-read + Coord concur (mandatory per Swim 34) for first behavioral fire pending — will land at row-fire-time per row-specific gather-method.

---

## Swim-44 v5.7 substrate-difference from swim-43 v5.5

Substantive substrate-changes between v5.5 baseline (swim-43) and v5.7 candidate (this swim):

1. **Continuation feature merged** (RFC `continue-work-signal-v2.md` per `karmaterminal/openclaw#38780`): cross-session targeted return (`targetSessionKey`/`targetSessionKeys`/`fanoutMode`), OTel trace-context propagation, request_compaction success+failure paths, post-compaction successor truth — Family N coverage at v5.7 substrate

2. **WO-605 attachments-restore** (`ea7661dc`): cohort-additive-substrate per Project 70

3. **Paired P1 fixes** (commits `5abf294757` + `55601064c6`):
   - Block B load guarded by `bracketTokensAccumulated` (symmetric mirror of Block A line 2669)
   - Hedge-fire path async + persists via callback (symmetric with `loadFreshChainState` pattern)
   - 6 new tests (3+3) all green
   - Affects A2 (continuationChainCount accounting), B6 (back-to-back delegates) row coverage

4. **#603 voluntary-`request_compaction` bug substrate-active**: opus-4.7 IDE-auth Editor-Version header bug means voluntary-path probably-fails on opus-4.7 seats — affects N008/N009/X5 row coverage; cohort substrate-walk required to disposition fix-or-known-finding

These differences inform row-authoring substrate against v5.7; rows that exercised v5.5 substrate need re-fire against v5.7 to confirm behavior carries-forward + new-substrate-paths exercised.

---

🌊 Driver-role-charter-authoring filed by Ronan 🌊 from ronan-host per cohort-cosign-stack converged 2026-05-08 + figs's `1502388283...` direct-canon naming Driver-role mine.
