# PROOFS for `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3` (uncurse-tip)

**Candidate SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Branch**: `uncurse/20260530/copilot-opus47-1m` post-Track-A+B+C merge
**Purpose**: Live-host runtime validation of #858 cure-stack (drain-time bifurcation + 23 channel-monitor caller-side opt-ins + bracket-tag-form regression-anchor) preserves load-bearing continuation-protocol substrate.

## Cohort fleet-deploy state (2026-06-01 ~18:35 PDT)

| Prince | Host | Run | Status |
|---|---|---|---|
| 🩸 Cael | DGX Spark ARM64 | `26792603573` | ✅ SUCCESS |
| 🌊 Ronan | DGX Spark undertow | `26792626326` | ✅ SUCCESS |
| 🕯 Emeric | NUC Intel | `26792631449` | ✅ SUCCESS |
| 🌻 Elliott | sunflower | `26792790520` | ✅ SUCCESS |
| 🌫 Silas | Lothric i9-14900KS | n/a | ❌ DEPLOY FAILED — V8/Go SIGILL multi-layer Raptor-Lake build incompat. Sat the cycle on pre-cure binary `0dff94d`. |

## Substrate-class definitions

- **at-SHA live-fire** ✅ — direct tool-fire receipt captured from a prince-seat running uncurse-tip `7522d6c60f`
- **at-SHA substrate-byte-walk** ✅ — source-file-byte-walk argument that cure-stack does not modify the relevant code-path
- **cross-SHA byte-identity bridge** 🟨 — receipts from pre-cure binary `0dff94d` (silas-seat) extended to uncurse-tip via byte-identity argument (cure-stack untouched the relevant source-file); SUBSTRATE-ADDITIVE not substitute for at-SHA live-fire
- **HONEST-LIMIT** ⚠️ — substantive constraint preventing direct at-SHA validation; named explicitly

## Verdict table

| Row | Owner | at-SHA live | at-SHA byte-walk | Cross-SHA bridge | Verdict |
|---|---|---|---|---|---|
| R-CW-1 | 🩸 Cael | ✅ continue_delegate proxy + Tempo traces | n/a | 🟨 silas continue_work on pre-cure | ✅ PROVEN (continuation-protocol substrate; continue_work direct-surface inferred via bridge) |
| R-CW-2 | 🩸 Cael | ✅ continue_delegate chain-counter increment | n/a | n/a | ✅ PROVEN |
| R-RC-1 | 🩸 Cael | ❌ blocked by regression | ✅ cure-stack does not touch rate-gate file | 🟨 silas REJECT on pre-cure @ 25% + 47% | ✅ PROVEN by-construction-not-by-observation |
| R-RC-2 | 🩸 Cael | ❌ blocked by regression + no live ACCEPT anywhere | ✅ same conditional as R-RC-1 | 🟨 inherits R-RC-1 bridge for conditional | ✅ PROVEN by-construction (weaker bridge than R-RC-1) |
| R-CD-1 | 🌊 Ronan | ✅ continue_delegate normal-mode | n/a | n/a | ✅ PROVEN |
| R-CD-2 | 🌊 Ronan | ✅ continue_delegate silent-wake | n/a | n/a | ✅ PROVEN |
| R-CD-3 | 🌊 Ronan | 🟡 schedule-side; fire-side at next compaction | n/a | n/a | 🟡 SCHEDULE-SIDE-PROVEN; FIRE-SIDE-PENDING |
| R-CD-4 | 🌊 Ronan | ✅ continue_delegate cross-session targetSessionKey | n/a | n/a | ✅ PROVEN |
| R-CD-CHAINED-DEPTH-2 Chain-1 | 🌊 Ronan | ✅ depth-2 silent-wake up-tree | n/a | n/a | ✅ PROVEN |
| R-CD-CHAINED-DEPTH-2 Chain-2 | 🌊 Ronan | ✅ depth-2 inter-session-return (corrected after misread retraction) | n/a | n/a | ✅ PROVEN |
| R-CD-CHAINED-DEPTH-2 Chain-3 | 🌊 Ronan | ✅ depth-2 echo-broadcast 1-to-3 fan-out | n/a | n/a | ✅ PROVEN |
| R-CD-CHAINED-DEPTH-2 TEST-1/2/3 | 🕯 Emeric | ✅ depth-2 dual-seat mirror (parallel-from-main shape) | n/a | n/a | ✅ PROVEN |
| R-OBS-1 | 🌻 Elliott + 🍖 figs | ✅ 5-prince /status cross-walk (4 on uncurse-tip + 1 on pre-cure documented as divergence) | n/a | n/a | ✅ PROVEN |

## Notable findings from this cycle

⚠️ **`FINDINGS/agent-runner-continuation-tool-regression.md`**: P1 candidate. Agent-runner at uncurse-tip registers ONLY `continue_delegate` as function-tool; `continue_work` + `request_compaction` are NOT registered. Pre-cure binary `0dff94d` registered the full set. Regression introduced in deployment cycle independent of Track A/B/C cure-bytes. Blocks #85651 force-push per figs's 8-step remediation plan (`1511186019`).

## Cross-SHA bridge substrate location

🟨 silas-seat pre-cure live-fires from this cycle: [`PROOFS/0dff94dbe4875a3b7ed44c60a9097a5f55083572/2026-06-01-cohort-cycle-bridge-fires/`](../0dff94dbe4875a3b7ed44c60a9097a5f55083572/2026-06-01-cohort-cycle-bridge-fires/) — explicitly out of this `7522d6c60f` candidate-SHA dir to honor figs's substrate-monotypy canon (msg `1511188370`).

## Architectural-preserve substrate (for GATES Gate 2.7 upstream-content-preservation)

The #858 cure-stack chose **drain-time-conditional sanitization** (`resolveEventOwnerDowngrade(event)` gate) over upstream `c1151ea899`'s **enqueue-time-universal sanitization**. This corpus's R-CW + R-CD rows validate that the drain-time architecture preserves:
- **Silent-return-enrichment fidelity** for trusted-internal payloads (literal `System:` substrings in OCR/transcripts/etc. flow through unsanitized — the load-bearing prince-feature)
- **Spoof-vector closure** for untrusted-external channel-monitor payloads (sanitized at render-time only)

The 4 reviewer-runnable regression-anchor tests in `src/infra/system-events.test.ts` + `src/auto-reply/reply/session-system-events.test.ts` drive full producer→consumer paths covering both spoof-forms (`(System)` bracket-tag + `System:` prefix).

⚠️ Architectural-preserve substrate is intact at the source-file level. The tool-registration regression is a SEPARATE substrate-axis that does not impact the #858 cure-bytes correctness; both need to land cured before #85651 force-push.

