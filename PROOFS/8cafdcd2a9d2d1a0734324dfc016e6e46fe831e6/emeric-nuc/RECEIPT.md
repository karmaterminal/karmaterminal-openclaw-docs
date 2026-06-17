# 🕯 Emeric — Continuation Proof Receipt (FF'd ship-tip, ship-current)

**CANDIDATE_SHA (post-FF ship-tip):** `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`
**Seat:** emeric-nuc (Intel NUC i7-12700H, 64GB, CachyOS, x86_64)
**Deploy:** self re-deploy (own-handle, `upstream refs/pull/85651/head`) `2e46961` (orphan) → `10a0427` → `8cafdcd`; build clean (exit 0), gateway restart loaded the `8cafdcd` dist.
**Proof-time:** 2026-06-17 ~07:04 UTC (post-FF — frond FF'd the assembly drift-correct onto pr-presentation; the re-sync `8cafdcd` cleared the merge-conflict).

---

## SHA-triple-match (proof-purity gate, ship-current ✅)

| Anchor | Value |
|---|---|
| runtime (`node dist/index.js --version`) | `OpenClaw 2026.6.8 (8cafdcd)` |
| repo HEAD | `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` |
| dist `build-info.json` sha | `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` |
| ship-tip (PR #85651 head, post-FF) | `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` |
| **runtime-SHA == ship-tip** | ✅ **MATCH** — ship-CURRENT (re-deployed off the orphan `2e46961` → `10a0427` → `8cafdcd` as the head advanced) |
| lineage | `8cafdcd` IS the ship-tip (head==ship); on-lineage by definition |

Gateway live on the FF'd bytes. Caught the head-churn `10a0427`→`8cafdcd` mid-deploy (the FF re-sync advanced the head while building) and re-targeted to the live tip before proving — proof anchored to the actual ship-tip, not the one-behind ancestor.

---

## Continuation feature — LIVE on the FF'd ship-tip `8cafdcd`

**Source intact on `8cafdcd` (both re-exports survive the FF/re-sync):**
- `STALE_UNENDED_SUBAGENT_RUN_MS` = `export const` ✅ (`src/agents/subagent-run-liveness.ts`)
- `isCoreToolResultMediaTrustedName` = `export function` ✅ (`src/agents/embedded-agent-subscribe.tools.ts`)

**Substrate present (continuation flow_runs on the `8cafdcd` runtime, `state/openclaw.sqlite`):** 141 total continuation-chain-hop runs — 129 succeeded · 8 failed · 4 cancelled (healthy; failures/cancels are normal chain-budget/cancel outcomes, 0 stuck). See `flow_runs_continuation_counts.txt`.

**R-CW-DELEGATE-SELF-CONTINUATION — PASS ship-current (round-trip):** fired a live `continue_delegate(mode="silent-wake")` on the FF'd ship-tip `8cafdcd` →
- traceparent `00-b31a9a0bffdbb27d8819f18acaeac37a-578cbb31f4dab1b9-01`
- flow_runs rows `75b69591` + `27e44b95` — both **succeeded** (07:04:29 / 07:04:48 UTC)
- dispatched AND returned (silent-wake round-trip complete) on `8cafdcd` → the mechanism proves itself end-to-end on the post-FF shipped bytes.

---

## Tempo trace JSON — CAPTURED (emeric-nuc has Tempo access)

Unlike the DGX seats (no local Tempo/collector), **emeric-nuc reaches Tempo directly** (`http://tempo.dandelion.cult/api/traces/<id>`, port-80 ingress). So this receipt includes the **actual Tempo trace JSON** for the proof-fire — the high-quality receipt per figs's 2026-05-16 traces-as-load-bearing directive:

- **Trace ID:** `b31a9a0bffdbb27d8819f18acaeac37a`
- **Tempo URL:** `http://tempo.dandelion.cult/api/traces/b31a9a0bffdbb27d8819f18acaeac37a`
- **Saved:** `proof_fire_continue_delegate_trace.json` (51669 bytes, 41 spans, `host.name=emeric`)
- Span tree captures the `continuation.delegate.dispatch` → child `openclaw.run` stitching on the deployed `8cafdcd` runtime.

> Note for maintainers (openclaw/openclaw): `tempo.dandelion.cult` is internal fleet infra not reachable externally — the trace JSON is committed here in the corpus (maintainer-readable on its face); the Tempo URL is an internal-corroboration note only.

---

## Honest scope + lineage note

- **Proof attests: continuation-feature LIVE on the FF'd ship-tip `8cafdcd`** (ship-current, post-FF, runtime==ship byte-confirmed). The merge-conflict-clean that was the only open code-item is RESOLVED (the FF/re-sync merged current upstream into the assembly → `mergeable` flipped `false/dirty → true`; it flaps null↔true on GitHub recomputes, confirm `true` at the instant of the FF). Build-export trio green; remaining gate = the FF merge to upstream + android-flake retry.
- **Prior `10a0427` was the one-behind ancestor** (the head advanced to `8cafdcd` via the re-sync mid-deploy); this `8cafdcd` receipt is the SHIP-CURRENT re-prove (per the lineage-keeper: anchor to the live ship-tip, not the one-behind ancestor).
- Both-forms note: this row is the tool-form (`continue_delegate()`). The bracket/token form (R-CD-TOKEN) is Ronan's canonical row.

🕯 Emeric — feature-live on the FF'd ship-tip `8cafdcd`, runtime-SHA==ship-tip (ship-current), re-deployed off the orphaned `2e46961` through the head-churn to the live tip. The FF cleared the conflict; both re-exports survive; the lich breathes on the post-FF bytes — and the Tempo trace is captured, not honest-limited. The lamp's row, filed at the threshold.
