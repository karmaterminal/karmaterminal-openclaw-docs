# SWIM-39 CASES

**Scope:** matrix-row inventory for SWIM-39 `volatile-purge`. Keyed to `swims/swim-39-volatile-purge/CHARTER.md` matrix scope and `karmaterminal/openclaw#473` acceptance criteria.

Each case is a planned row file under `swims/swim-39-volatile-purge/rows/`. Verdict (PASS / FAIL / DEFERRED / FINDING / INVALIDATED) lives in the per-row file once executed; this inventory tracks scope + ownership only.

---

## Block A — Infrastructure (TC1–TC4)

Per `SWIM/FORMAL-SWIM-RUNBOOK.md` §4 Block A.

| Row | Title | Owner | Source |
|---|---|---|---|
| TC1 | Session-key normalization across 4 hosts | 🌫 SUT × 4 | FORMAL §4 A |
| TC2 | Override persistence / stale state checks | 🌫 SUT × 4 | FORMAL §4 A |
| TC3 | Delegate delivery sanity (in-process emit + cohort cross-host) | 🌫 SUT × 4 | FORMAL §4 A |
| TC4 | `sessions.json` update persistence (restart-durable) | 🌫 SUT × 4 | FORMAL §4 A |

## Block B — Behavioral F-series (F1–F8)

| Row | Title | Owner | Source |
|---|---|---|---|
| F1 | Clean `continue_work` (no concurrent activity) | 🌫 SUT × 4 | FORMAL §4 B |
| F2 | Noisy `continue_work` (concurrent inbound + delegate fire) | 🌫 SUT × 4 | FORMAL §4 B |
| F3 | Clean `continue_delegate` (single, fire + return) | 🌫 SUT × 4 | FORMAL §4 B |
| F4 | Noisy `continue_delegate` (parallel fan-out + cap pressure) | 🌫 SUT × 4 | FORMAL §4 B |
| F5 | Silent-wake behavior (silent-wake mode → wake-on-return) | 🌫 SUT × 4 | FORMAL §4 B |
| F6 | Back-to-back scheduling (delay 5s → fire → delay 5s → fire) | 🌫 SUT × 4 | FORMAL §4 B |
| F7 | Two-hop / ghost-wake / stale-wake | 🌫 SUT × 4 | FORMAL §4 B |
| F8 | Post-compaction delegate behavior | 🌫 SUT × 4 | FORMAL §4 B |

## Block C — Port-specific / candidate-specific (P1–P7)

| Row | Title | Owner | Source |
|---|---|---|---|
| P1 | Structured wake markers (canonical wake-id present) | 🌫 SUT × 4 | FORMAL §4 C |
| P2 | Pending-flag lifecycle (arm → fire → drain) | 🌫 SUT × 4 | FORMAL §4 C |
| P3 | Timer disposal (no zombie timers post-fire) | 🌫 SUT × 4 | FORMAL §4 C |
| P4 | Cache / CPU / memory boundedness (24h soak) | 🌫 SUT × 4 | FORMAL §4 C |
| P5 | Announce-delivery memoization (no double-announce) | 🌫 SUT × 4 | FORMAL §4 C |
| P6 | Cap split-count telemetry (`pending:N, staged:M`) | 🌫 SUT × 4 | OVERLAY OV-3 |
| P7 | Non-destructive cancel/drain via tooling | 🌫 SUT × 4 | OVERLAY OV-4 + #472 |

## Block D — Regression / recovery (R1–R5)

| Row | Title | Owner | Source |
|---|---|---|---|
| R1 | Boot-time stall (cold start under load) | 🌫 SUT × 4 | FORMAL §4 D |
| R2 | Memory growth (24h soak baseline vs candidate) | 🌫 SUT × 4 | FORMAL §4 D |
| R3 | Compaction recovery (post-#474 fix verification) | 🌫 SUT × 4 | FORMAL §4 D + OV-6 |
| R4 | Gateway restart recovery (sqlite-substrate durability) | 🌫 SUT × 4 | FORMAL §4 D |
| R5 | Multi-prince simultaneous activity (cross-host queue contention) | 🌫 SUT × 4 | FORMAL §4 D |
| R6 | Stale-row recovery / observability (cancel-only path) | 🌫 SUT × 4 | inheritance #823 + drafts/stale-row-observability |

## Block E — Validation (V1–V3)

| Row | Title | Owner | Source |
|---|---|---|---|
| V1 | Build (`pnpm install && pnpm tsgo` per `openclaw-ci.yml`) | 🩸 deployer | FORMAL §4 E |
| V2 | Lint / type validation (zero new errors vs baseline) | 🩸 deployer | FORMAL §4 E |
| V3 | Vitest baseline (full suite or agreed slice) | 🩸 deployer | FORMAL §4 E |
| V4 | Static allowlist guard-test for session-keyed Maps | 🩸 deployer | OVERLAY OV-5 + #441 |

## OVERLAY — #473-specific (OV-1..OV-8)

See `OVERLAY.md` for full row scope. Inventory-only here:

| Row | Title | Owner | Source |
|---|---|---|---|
| OV-1 | Dist gate-symbol grep per host (zero matches) | 🩸 deployer | #473 AC #1 |
| OV-2 | Sqlite-unconditional read/write probe | 🌫 SUT | #473 AC #2 |
| OV-3 | `pendingDelegateCount` split-count surface | 🌫 SUT | #473 AC #3 (= P6) |
| OV-4 | Non-destructive cancel/drain tooling exercise | 🌫 SUT | #473 AC #4 (= P7) |
| OV-5 | Static allowlist guard-test promotion to required CI | 🩸 deployer | #473 AC #5 (= V4) |
| OV-6 | Cooldown-arming hypothesis probe | 🌫 SUT × 4 | #474 |
| OV-7 | `livenessState:"blocked"` channel-surfacing probe | 🌻 monitor + 🌫 SUT | #475 |
| OV-8 | `write` tool clobber non-determinism probe (multi-host) | 🌻 monitor + 🌫 SUT × 4 | #476 |

## Block X — Process / tooling (no FORMAL precedent; novel for SWIM 39)

| Row | Title | Owner | Source |
|---|---|---|---|
| X1 | Loop-detection drill (CHARTER §"Loop-detection rule") | 🌊 driver | this-swim-only |

---

## Pre-swim gate row

| Row | Title | Owner | Source |
|---|---|---|---|
| 01 | Pre-swim gate (items A–H + cohort confirms) | 🌊 driver | FORMAL §3 |

This is the gate that fires all behavioral rows. See `rows/row-01-pre-swim-gate.md`.

---

## Greenlight criteria summary

Per CHARTER + FORMAL §9:

- All declared rows have explicit verdict
- Static-layer rows: 100% PASS
- Live-runtime: ≥95% PASS; FAILs triaged with row-issue link
- Post-deploy smoke: 100% PASS or hard rollback
- All 5 #473 acceptance criteria byte-verified across 4 hosts
- 4/4 cohort concurrence on advance

## Total row count

- Block A: 4 rows
- Block B: 8 rows
- Block C: 7 rows (P6/P7 dual-tagged with OV-3/OV-4 — single execution, dual citation)
- Block D: 6 rows (R6 added for stale-row inheritance)
- Block E: 4 rows (V4 added for OV-5)
- OVERLAY: 8 rows (OV-3/OV-4/OV-5 dual-tagged with P6/P7/V4 above)
- Block X: 1 row
- Pre-swim gate: 1 row

**Total unique rows: 32** (matches FORMAL §4 "28 core minimum" + 4 swim-specific extension rows).

🌊
