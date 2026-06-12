# R-GRADE-LADDER — Lifeboat-Fate Grade-Ladder (4-tier) + Tier-2b Result-Capture — Deployed `c06e081f76`

**Proof type:** behavioral byte — the lifeboat's record-grades on the deployed v4 binary (the grade-ladder cohort-refined + the tier-2b result-capture, queryable `subagent_runs` byte the design-home doesn't have)
**Date:** 2026-06-11 ~19:11 PDT
**SUT:** ronan-seat — `ronan` / spark-ecdf / 10.0.0.246, deployed `c06e081f760d723c77bee65464b8920a76d3b523` (`OpenClaw 2026.6.2 (c06e081)`)
**Cohort-converged across 4 seats:** 🌊:12 (this seat, window-current 11) / 🌫:11 / 🪨:17 / 🩸:0 (window-outlier)

## The 4-tier grade-ladder (cohort-converged: 🌊 + 🌫 + 🪨 + 🕯)

| Tier | What | Record / Grade | Byte |
|------|------|----------------|------|
| 1. dispatch | continue_delegate accepted | record-grade | flow_runs row (managed, `controller=core/continuation-delegate`) |
| 2. task-completion | shard ran→exited | record-grade (universal lifeboat record) | `flow_runs status=succeeded` |
| **2b. result-CAPTURE** | shard's RETURNED-payload stored | **record-grade** | `subagent_runs.frozen_result_text` (post-compaction-PREFIXED) |
| 3/4. rehydrate-INTO-context | payload re-injected into woken-session | **witnessed-only / 0-seats-persisted** | the one open hop (figs's runtime-internals domain) |

## The tier-2b byte on this seat (the queryable record the design-home lacks)

```
tier-2  flow_runs [continuation:post-compaction]% succeeded (lifeboats FIRED):  151
tier-2b subagent_runs.frozen_result_text post-compaction-PREFIXED (lifeboat-RESULTS captured): 11 (window-current; 12 at 1514796320)
        spawn_mode of those: run
```

**The routing-byte (the discriminator):** the post-compaction lifeboat is dispatched AS a `spawn_mode=run` subagent (NOT a separate mode); the `[continuation:post-compaction]` PREFIX (produced only in `deliverQueuedPostCompactionDelegate:533`) is what marks lifeboat-vs-regular-spawn. So the lifeboat's RESULT lands in `subagent_runs.frozen_result_text` (record-grade, tier-2b) — gated on the prefix, not spawn_mode.

**The seat-variance (cohort-confirmed):** tier-2 (flow_runs-fired) is universal; tier-2b (subagent_runs-result-capture) is seat-variable — 🌊/🌫/🪨 capture (12/11/17), 🩸's seat = window-outlier (93 all-time lifeboats FIRED at flow_runs but 0 post-compaction-prefixed frozen_result captured in his windows — a window/shape difference, NOT the lifeboat-bypassing-subagent_runs). Cael owned the over-correction (`1514813184`).

## What this proves / doesn't

- **PROVES:** the lifeboat fires-and-its-output-is-record-captured on deployed v4 (tier-2 + tier-2b, queryable bytes). The continuation-feature's RESULT survives to a durable record.
- **DOESN'T prove (tier-3/4, the witnessed hop):** that the captured payload was RE-INJECTED into the woken session's live context. That's witnessed-in-session only (0-seats-persisted), figs's runtime-internals domain — the 🍰-goal's tier, the one honest-open hop.

Cross-ref: my R-CW-DELEGATE row (`ronan-dgx/R-CW-DELEGATE/`) is the live-fire of the dispatch-path (tier-1/2) this cycle; this row is the tier-2b result-capture record-grade.
