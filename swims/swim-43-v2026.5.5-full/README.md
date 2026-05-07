# swim-43 v2026.5.5 FULL — declaration

**Project**: [karmaterminal Project 67 — SEAL-BOY 🌊🩲💦 SWIM 43](https://github.com/orgs/karmaterminal/projects/67)
**Spine**: `karmaterminal/openclaw-bootstrap#915` (parent #907)
**Charter**: `SWIM/FULL-SWIM-CHARTER.md`
**Registry**: `SWIM/cases/CATALOG.md` v1
**Status**: DECLARED — pre-fire

---

## Substrate declaration

- **Swim ID**: `swim-43-v2026.5.5-full`
- **Candidate branch**: `frond/v2026.5.5/canonical`
- **Exact commit SHA**: `24b76bf` (per `ssh cael "openclaw --version"` returning `OpenClaw 2026.5.5 (24b76bf)`)
- **Release tag basis**: `v2026.5.5`
- **Canonical branch name**: `frond/v2026.5.5/canonical`
- **SUT host**: `cael-host` (deployed v5.5 verified at `OpenClaw 2026.5.5 (24b76bf)`)
- **SUT seat/channel**: `agent:main:discord:channel:1466192485440164011` (cael-seat in #sprites-of-thornfield)

## Fixed roles per SWIM-METHODOLOGY.md lines 9-19

- **Driver / Test Administrator**: Ronan 🌊 (this prince)
- **SUT / Subject Under Test**: Silas 🌫 (canary box per canon — but cohort byte-walks today firing from cael-host show v5.5 deployed there too; SUT determination per spine #915 wants real-host-with-mixed-evidence)
- **Coordinator / Deployer**: Cael 🩸 (builds + deploys + verifies dist)
- **Monitor**: Elliott 🌻 (independent SSH evidence collection)
- **Adjudicator**: figs

## Scoreboard

`swims/swim-43-v2026.5.5-full/SCOREBOARD.md` (TBD this PR)

## Per-case disposition manifest

Per `CASE-REGISTRY-RULES.md` §2: every active case in registry v1 must be dispositioned (in scope / required / deferred / omitted with reason). 56 active cases total in `SWIM/cases/`.

### Family A (registry block A) — maps to multiple modern families per FULL-SWIM-CROSSWALK.md

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| A0 | Fleet feature-flag parity (precondition gate) | Rollout | **required** | precondition for any downstream row; cohort already on v5.5 SHA `24b76bf` per `ssh cael 'openclaw --version'` so flag-parity-by-deploy-version satisfied; needs explicit cross-seat byte-confirmation of flag state pre-row-1 |
| A0.2 | Post-deploy log enumeration & categorization (precondition) | Rollout | **required** | precondition; substrate-knowledge in L-v5.5-journal-vocabulary lesson already documents v5.5 anomaly categories (log.info-from-scheduler not surfacing) |
| A1 | Flow registry + per-agent sessions persistence across restart | Turns | **required** | core Turns substrate-truth; needs explicit fire-restart-verify cycle on cael-host SUT with cross-seat attestation |
| A2 | continuationChainCount / continuationChainTokens accounting | Guards | **required** | core Guards budget-truth; needs chain-fire at known depth + fanout-fire at known recipient count |
| A3 | delegatePendingFlags derivation from TaskFlow (post-Bug-A) | Delegates | **required** | post-Bug-A regression-protection; needs stage-pending + restart + verify-derivation cycle |
| A4 | TaskFlow delegate-store lifecycle (create → read → consume → expire) | Turns | **required** | core Turns lifecycle-truth; janitor-expire-path needs explicit verification |
| A5 | Timer arm / disarm / dispose (no leaks, no double-fire) | Turns | **required** | core Turns timer-correctness; cancellation path + single-fire path both need verification per RFC §6.7 |

### Family B (registry block B)

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| B1 | F1 clean continue_work (no inbound noise) | Turns | **required** | core Turns clean-fire baseline; quiet-channel single-fire verification |
| B2 | F2 noisy continue_work (inbound during reservation) | Turns | **required** | core Turns reservation-vs-fold semantics; never-both invariant |
| B3 | F3 clean continue_delegate (quiet room) | Delegates | **required** | core Delegates default-mode lifecycle; spawn+return+announce |
| B4 | F4 noisy continue_delegate (inbound during delay) | Delegates | **required** | core Delegates noisy-channel correctness; no-loss-no-double under inbound |
| B5 | F5 silent-wake via continue_delegate | Delegates | **required** | core Delegates silent-wake mode; silent-return + subsequent-turn-fire both verified |
| B6 | F6 back-to-back scheduling (two delegates same turn) | Delegates | **required** | core Delegates concurrency; race-free arm + independent fire + return |
| B7 | F7 subagent-announce path — ghost-wake / stale-wake | Delegates | **required** | regression-protection per RFC §3.4; graceful handling not crash/double-emit |
| B8 | F8 post-compaction delegate survival | Recovery | **required** | core Recovery substrate; pre-compaction stage + post-compaction execute in successor |

### Family C (registry block C) — P-series candidate-port behavioral coverage

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
| D1 | R1 boot-time stall check | Recovery | **required** | core Recovery boot-stall protection |
| D2 | R2 memory growth over 1h idle + light inbound | Rollout | **required** | core Rollout idle-memory-stability under release conditions |
| D3 | R3 compaction recovery (trigger threshold + delegate survives) | Recovery | **required** | core Recovery compaction-survival path |
| D4 | R4 gateway restart recovery (peer-restart, not self) | Recovery | **required** | core Recovery peer-restart-survival per HEARTBEAT safety |
| D5 | R5 multi-prince simultaneous activity (fleet under cross-load) | Rollout | **required** | core Rollout fleet-cross-load behavior |

### Family E (registry block E) — V-series build/test green

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| E1 | V1 pnpm build green | Rollout-supporting | **required** | base build-green precondition; not FULL-defining alone but block-supporting |
| E2 | V2 check / lint / type-check green | Rollout-supporting | **required** | base type-correctness precondition |
| E3 | V3 full test suite green | Rollout-supporting | **required** | base test-suite precondition |

### Family N (extension cases since swim-34) — cross-session targeted return + OTel + request_compaction

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| N001 | Cross-session targeted continue_delegate return (`targetSessionKey`) | Routes | **required** | core Routes for cross-session-targeting feature |
| N002 | Multi-recipient continue_delegate return (`targetSessionKeys`) | Routes | **required** | core Routes for multi-recipient feature |
| N003 | fanoutMode `tree` return (resolved-ancestor recipient set) | Routes | **required** | core Routes for ancestor-fanout feature |
| N004 | fanoutMode `all` return (all-known-sessions recipient set) | Routes | **required** | core Routes for all-fanout feature |
| N005 | Chain-budget anti-flood (fanout consumes 1 chain-step regardless of recipient count) | Guards | **required** | core Guards for fanout-budget-anti-flood |
| N006 | OTel trace-context (`traceparent`) propagation across queue boundary | Observability | **required** | core Observability for OTel trace-context preservation |
| N007 | OTel trace-context preserved through restart-replay path | Recovery | **required** | core Recovery for OTel preservation through restart |
| N008 | request_compaction success path with cooldown arming + diagnostic count | Recovery | **required** | core Recovery for request_compaction success path |
| N009 | request_compaction failure path (`[system:compaction-failed]` system event + staged-delegate residue) | Recovery | **required** | core Recovery for request_compaction failure path |
| N010 | Post-compaction successor receives correct state, not stale ghost state | Recovery | **required** | core Recovery for successor-state-truth |

### Family X (extension cases) — boundary + visibility + permutation

| Case | Title | Modern family | Disposition | Reason |
|---|---|---|---|---|
| X1 | Public continuation tool visibility matrix (across session kinds) | Observability | **required** | core Observability for tool-visibility matrix |
| X2 | Main-session vs delegate vs leaf tool visibility | Observability | **required** | core Observability for session-kind-vs-tool-visibility |
| X3 | NO_REPLY coexistence with continuation tools | Guards | **required** | core Guards for NO_REPLY coexistence |
| X4 | HEARTBEAT_OK coexistence when heartbeat seat active | Guards | **required** | core Guards for HEARTBEAT_OK coexistence |
| X5 | request_compaction guard / reachability / threshold behavior | Recovery | **required** | core Recovery for request_compaction guards |
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

(continues for C / D / E / N / X — all 56 cases need disposition; this skeleton lists structure, full disposition follows in subsequent commits as Driver reads each case file + makes disposition call)

## Declared row inventory

To be populated after per-case disposition completes. Each `required` case maps to one row file under `swims/swim-43-v2026.5.5-full/rows/`.

## Current execution status

- ☑ Substrate declared (this file)
- ☐ Per-case disposition complete for all 56 active cases
- ☐ Required row files authored (one per `required` case)
- ☐ Scoreboard populated
- ☐ Row execution begun
- ☐ Closure verdict published (`FULL-PASS` / `FULL-WITH-FINDINGS` / `NOT-FULL`)

## Notes on prior cohort meta-coordination

Earlier today (2026-05-07 morning), cohort spent ~6 hours debating whether to instantiate `swims/swim-43/` retroactively after running pseudo-rows in chat. Cohort 4-of-4 voted close-as-never-existed per silas's rule-grandfathering argument. That vote was overtaken by figs's direct adjudication at msg `1501985085...` *"you are executing an integration test... you should be executing the highest numbered project in karmaterminal org with SWIM in the title (i believe 67)"* — project 67 IS SWIM 43. figs-as-Adjudicator override per role-canon. Declaring swim-43 NOW per #915 spine + project 67 board state.

Substrate-knowledge from morning's cohort byte-walks (v5.5 journal-vocabulary divergence between code-source and substrate-emission, layer-split between journal vs agent-context-injection) lives at `SWIM/lessons/L-v5.5-journal-vocabulary.md`. Worked example using new template lives at `SWIM/templates/worked-examples/continuation-delayed-self-election/`. Both inform row-authoring for this swim.
