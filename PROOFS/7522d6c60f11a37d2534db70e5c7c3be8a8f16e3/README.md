# PROOFS for `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`

**Candidate SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Branch**: `uncurse/20260530/copilot-opus47-1m` post-Track-A+B+C merge
**Purpose**: Live-host runtime validation of #858 cure-stack (drain-time bifurcation + 23 channel-monitor caller-side opt-ins + bracket-tag-form regression-anchor) preserves load-bearing continuation-protocol substrate.

## Cohort fleet-deploy state (2026-06-01 ~18:35 PDT)

| Prince | Host | Run | Status |
|---|---|---|---|
| 🩸 Cael | DGX Spark ARM64 | `26792603573` | ✅ SUCCESS |
| 🌊 Ronan | DGX Spark undertow | `26792626326` | ✅ SUCCESS |
| 🕯 Emeric | NUC Intel | `26792631449` | ✅ SUCCESS |
| 🌫 Silas | Lothric i9-14900KS | `26792863544` (3rd retry) | retrying with `NODE_OPTIONS=--no-maglev` after V8 SIGILL/SIGSEGV on tsdown |
| 🌻 Elliott | Sunflower | `26792852129` | re-fired with full SHA + correct `bypass_reason` input |

## Verdict table

| Row | Owner | Behavior | Status |
|---|---|---|---|
| R-CW-1 | 🩸 Cael | `continue_work()` wake + deploy-persistence + chain | ✅ PROVEN |
| R-CW-2 | 🩸 Cael | chain-counter accounting | embedded in R-CW-1 |
| R-RC-2 | 🩸 Cael | `request_compaction()` over-threshold ACCEPT | pending |
| R-CD-1 | 🌊 Ronan | `continue_delegate()` schedule → spawn → return | in-flight |
| R-CD-2/3/4 | 🌊 Ronan | silent-wake / post-compaction / cross-session | pending |
| R-CD-CHAINED-DEPTH-2 | 🌊 Ronan | depth-2 chain (up-tree / inter-session / echo) | pending |
| R-RC-1 | 🌫 Silas | `request_compaction()` threshold REJECT | pending (deploy failure) |
| R-CD-CHAINED-DEPTH-2 TEST-1/2/3 | 🌫 Silas (canary) | dual-seat coverage | pending (deploy failure) |
| R-OBS-1 | 🌻 Elliott | external `/status` continuation row 4-prince cross-walk | pending (deploy failure) |

## Architectural-preserve substrate (for GATES Gate 2.7 upstream-content-preservation)

The #858 cure-stack chose **drain-time-conditional sanitization** (`resolveEventOwnerDowngrade(event)` gate) over upstream `c1151ea899`'s **enqueue-time-universal sanitization**. This corpus's R-CW + R-CD rows validate that the drain-time architecture preserves:
- **Silent-return-enrichment fidelity** for trusted-internal payloads (literal `System:` substrings in OCR/transcripts/etc. flow through unsanitized — the load-bearing prince-feature)
- **Spoof-vector closure** for untrusted-external channel-monitor payloads (sanitized at render-time only)

The 4 reviewer-runnable regression-anchor tests in `src/infra/system-events.test.ts` + `src/auto-reply/reply/session-system-events.test.ts` drive full producer→consumer paths covering both spoof-forms (`(System)` bracket-tag + `System:` prefix).

