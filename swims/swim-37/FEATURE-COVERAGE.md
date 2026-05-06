# SWIM 37 — FEATURE COVERAGE MAP

**Purpose** (per figs `1498738730171633976` + 🩸 `1498738802280108094`): make the 39-row delta ledger **readable as a feature map by title alone**. If the title doesn't tell you what it tests, fix the title. If a feature surface has no row, surface the gap.

**Method**: list openclaw's user-facing feature surfaces (left column), map CASES.md row IDs that exercise each surface (right column), call out gaps explicitly.

---

## What I'm assembling (the answer to figs's "know what you're doing")

**🩸 cohort-canonical (msg `1498739496760639661`):**

> *"Swim-37 is testing that OpenClaw's integrated surface behaves as one system under a real candidate deploy, not as disconnected promises in docs or source. Concretely: continuation/delegation flows, config/schema evolution, OTEL observability, deploy lifecycle, and the live runtime/tool surface have to survive contact with each other across the cohort boxes. If the case titles don't let us see that feature-map at a glance, then we're still assembling the swim rather than ready to run it."*

**🌻 (corpus-assembly framing, complementary):**

> "I'm assembling a concrete integration-test corpus for openclaw as a whole system: a readable execution surface that maps the feature set by title, lets the cohort know what we're testing before we test it, observes receipts in the gh project + OTEL + ledger + DEPLOY-LEDGER, and ships or rolls back on evidence — so each future swim is lighter than the last instead of Herculean."

**🌫️ (msg `1498739551223550145`):**

> *"Swim-37 tests the context-pressure continuation featureset end-to-end on live princes: (1) gateway-emitted OTEL traces actually reach `elliott.dandelion.cult:4318` collector under real workload (not just curl 200); (2) `continue_work` / `continue_delegate` / `request_compaction` tool dispatch survives the deploy-via-`deploy-gateway.yml` self-deploy path across all 4 boxes (cael→ronan→silas→elliott fan-out, no SIGTERM-loops); (3) candidate dist boots clean against each prince's existing `~/.openclaw/openclaw.json` without strict-schema reject (D15/RD7(c) preflight is the gate). Adjacent surface exercised by the act of deploying: post-compaction delegate handoff (#413 family) when a freshly-deployed prince hits its first compaction with new code in flight, and volitional compaction Trigger E under post-deploy churn. NOT in scope: cohort governance shape, audit-doc shape, role-topology — doc-track, not runtime-track."*

**🌊 (msg `1498748208288104520` + sharpened restate `1498751272172654754`):**

> *"**Frozen `90db3699` is a coherent featureset**: continuation primitives (`continue_work`/`continue_delegate`/`request_compaction`) + bracket-fallback parity emit chained OTEL spans to `elliott:4318`; SDQ enforces idempotent taskHash + chain-budget across delegate fan-out; cross-session routing + drain/permission survive deploy-time SIGTERM and re-stitch via post-compaction handoff. **Receipts** = Project #58 issue verdicts + collector trace-tree by `service.name=<prince>-prince AND trace.label=swim-37/<prince>/<ts>` + DEPLOY-LEDGER append + casefile diff. **Out-of-scope** = MCP / channels / sub-agents / auth / build provenance (base+prior swims own)."*

🩸's frames the *what under test*; 🌻's frames the *means of testing*; 🌫️'s adds the *concrete test sub-clauses + adjacent-surface + out-of-scope*; 🌊's pins the *frozen-SHA + receipt-surfaces explicitly*. All four load-bearing. **4/4 cohort lock on step-1.**

Swim-37 specifically: pre-ship validation of the swim-37 wire (51 PRs) against `v2026.4.24` baseline. Integration tip `cael/325-canonical2 @ 29e556eb11` (regenerable; see CHARTER §"Integration tip"). The earlier `feature/context-pressure-squashed @ 90db3699` pin is historical — the work moved to canonical2 by 2026-04-28; deploy-time references must use the live integration tip.

---

## Feature surface → row mapping

### 1. Continuation primitives (the headline feature)

| Surface | Row(s) | Layer |
|---|---|---|
| `continue_work(N)` end-to-end | E1.1 | live-runtime |
| `silent-wake` round-trip + heartbeat wake | E1.2, E5.1 | live-runtime |
| `post-compaction` shard release | E1.3, E2.4 | live-runtime |
| `request_compaction()` rate-limit + threshold | E1.4 | live-runtime |
| Multi-call fan-out one-turn | E1.5 | live-runtime |
| `sessions_yield` | **GAP** — no row | — |
| Bracket `CONTINUE_WORK` / `CONTINUE_DELEGATE` parity | B1, B2, B3, B4, B5 | live-runtime |

**Coverage**: strong on tool-form primitives + bracket fallback. **Gap**: `sessions_yield` has no explicit row. Action: add **E1.6** (sessions_yield in chain — assert clean termination, no zombie heartbeat).

### 2. OTEL / diagnostics (the receipts surface)

| Surface | Row(s) | Layer |
|---|---|---|
| Chain trail single-chain | E2.1 | live-runtime |
| `continuation.disabled` reason enum | E2.2 | live-runtime |
| `queue.drain` once-per-cycle | E2.3 | live-runtime |
| `compaction.released` once-per-seam | E2.4 | live-runtime |
| Collector receives end-to-end | E2.5 | post-deploy smoke |
| `heartbeat` span standalone | E5.2 | live-runtime |
| OTEL config — protocol gate | D-cfg.otel-protocol-hard-gate | live-runtime |
| OTEL config — captureContent redaction | D-cfg.otel-captureContent | live-runtime |

**Coverage**: complete on the public OTEL surface for continuation. Trace-tree reconstructable end-to-end is the load-bearing assertion (E2.5 + E2.1 together).

### 3. Session Delivery Queue (SDQ)

| Surface | Row(s) | Layer |
|---|---|---|
| Restart-survival (delayed delegate) | E3.1 | live-runtime |
| Idempotency via taskHash | E3.2 | live-runtime |
| Failed-TTL prune | E3.3 | live-runtime |
| queueDir soft-cap (loud reject) | E3.4 | live-runtime |
| SDQ retry keys hot-reload | D-cfg.sdq-retry-not-hot-reloadable | live-runtime |

**Coverage**: complete on the durable-queue surface.

### 4. Chain budget

| Surface | Row(s) | Layer |
|---|---|---|
| UUIDv7 monotonicity | E4.1 | live-runtime |
| `maxChainLength` cap (boundary `>` not `>=`) | E4.2 | live-runtime |
| `costCapTokens` mid-step enforcement | E4.3 | live-runtime |

**Coverage**: complete on the cap surface.

### 5. Cross-session / routing

| Surface | Row(s) | Layer |
|---|---|---|
| `targetSessionKey` cross-session delivery | E6.1 | live-runtime |
| Chain-returns-to-root (depth-3 leaf → root) | E6.2 | live-runtime (pending figs C1) |
| Echo-to-multiple-channels | E6.3 | live-runtime (pending figs X1) |
| Invalid `targetSessionKey` → ToolInputError | E6.4 | live-runtime |
| Descriptor-content regression guard | E6.5 | static |

**Coverage**: complete on the routing surface; 2 rows blocked on figs Qs.

### 6. Drain / permission gating

| Surface | Row(s) | Layer |
|---|---|---|
| Default-allow `continue_delegate` | E7.1 | live-runtime |
| Explicit-block via opt-out | E7.2 | live-runtime |

**Coverage**: complete on the per-agent gating surface.

### 7. Tool registry (the "is it actually wired" smoke)

| Surface | Row(s) | Layer |
|---|---|---|
| Tools registered in live gateway | D-tools.continue-delegate-registered | post-deploy smoke |

**Coverage**: present (figs's 08:54 PDT flag captured). **Action**: confirm row title says "post-deploy live tool-registry probe" cleanly.

### 8. Static guards (vitest harness, no deploy)

| Surface | Row(s) | Layer |
|---|---|---|
| Rebase classification tracer | E9 | static |
| Swim-37 harness scaffold | E10 | static |
| Descriptor-content (shape, also routing) | E6.5 | static |

**Coverage**: complete on static-precheck surface.

### 9. Config schema (the "what zod accepts" surface)

| Surface | Row(s) | Layer |
|---|---|---|
| `taskFlowDelegates` purge license | D-cfg.taskflow-unconditional | live-runtime |
| `generationGuardTolerance` removed | TC-no-genguard | live-runtime |

**Coverage**: covers the two removed/changing keys. **Gap**: no row for the new top-level `diagnostics` key (the very key we're enabling for OTEL; keypath is `diagnostics.otel.endpoint`, byte-verified at `90db3699:src/config/zod-schema.ts:285` per 🌫️'s catch). Action: add **D-cfg.diagnostics-key-validates** (post-deploy: assert config-set + validate green against new schema; ties directly to F26/F28 the swim is empirically validating).

---

## Surfaces NOT in scope for this overlay (handled by base + prior swims)

| Surface | Where covered |
|---|---|
| MCP plugin lifecycle | base canonical FORMAL §4 Block A (TC1-TC4 infra) |
| Channel adapters (discord, signal, etc.) | swim-34 X1-X15 + swim-36 surface E |
| Sub-agent runtime (sessions_spawn) | swim-36 surface A + per-agent test |
| Auth / permissions | swim-36 surfaces |
| Build/version provenance | swim-37 greenlight criterion #4 (CHARTER) |

These are explicitly **base + prior coverage**, not deferred-as-gap. The 39-row delta is `feature/context-pressure-squashed`-specific; the base+prior is the 50+row swim-34 + swim-35 + swim-36 corpus that runs as the `whole declared board` per FORMAL §1.5.

---

## Gaps surfaced by this exercise (action items)

1. **E1.6 (NEW)**: `sessions_yield` clean termination — no zombie heartbeat, chain.id closes
2. **D-cfg.diagnostics-key-validates (NEW)**: new schema key accepted post-deploy (validates F26/F28 motivator)
3. **Title polish on D-tools.continue-delegate-registered**: clarify "post-deploy live tool-registry probe"

These are small, additive. 🌊 to triage as part of gh project setup; 🌻 will draft the two new row stubs in a follow-up commit on `elliott/swim-37-scaffold-2026-04-28`.

---

## What this map means in practice

A new prince (or future-you, post-compaction) lands on this file and reads down the left column. By the time they hit the bottom they know:

- the 9 feature surfaces openclaw-as-a-system exposes around continuation
- which rows test each
- what layer (static / live-runtime / post-deploy smoke) each row runs at
- where the gaps are and what's claimed-elsewhere vs. genuinely-uncovered

That is the readable execution surface figs asked for. The gh project (🌊's F29) becomes the live status overlay on this same map: each row a project issue, status column = layer, current verdict in the issue body.

---

## Provenance

- figs directive `1498738730171633976` (10:32 PDT): "test cases lay them out, read them, by title alone they should map across the feature offerings"
- 🩸 ack `1498738802280108094` (10:32 PDT): "lay out the swim cases by title so the feature map is visible at a glance"
- 🌻 commit (pending) on `elliott/swim-37-scaffold-2026-04-28`
