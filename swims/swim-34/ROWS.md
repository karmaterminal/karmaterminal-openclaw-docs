# Swim 34 Formal Matrix — Row List

44 rows (A0 added as precondition gate). 3 green from tonight (E1/E2/E3). 41 remaining (A0 + 40).

Walk order: **A0 → A0.2 → A → B → C → D → X**. E already done. A0 AND A0.2 MUST PASS before any other row runs. Stop at block boundaries only if DEFERRED required.

## Authoring-surface audit (2026-04-17, driver=ronan, coord=cael)

Post-A1-triple-rewrite audit per coord call. Each pending row annotated with the on-disk / in-code surface it actually touches. Values:

- **SUT-VERIFIED** — surface confirmed against bytes on SUT this session.
- **LIKELY** — surface is documented in `docs/design/continue-work-signal-v2.md` or already exercised in recent swims; flesh-out should still start with a byte-check but risk of stale-schema surprise is low.
- **NEEDS_AUDIT** — row title references a filename / field / subsystem whose current shape isn't confirmed. Must be verified against bytes + code before flesh-out, not during.

Rationale: A1's first spec was written against `sessions.json` which doesn't exist post-TaskFlow; SUT prereq check revealed the real surface (per-agent jsonl + flow registry) and forced three rewrites. Audit is cheaper than rewrites.

**Byte-check rule (fleet-general, per Cael coord call 2026-04-17):** before finalizing any row procedure, verify surface against bytes on **both driver AND SUT** — not just driver. A1 passed driver byte-check (`f5b3b5f` rewrite) but was still half-wrong because SUT layout differed (per-agent jsonl paths present on both, but surface-count/live-ness differs); Silas's SUT prereq forced the final reshape (`fc33658`). Two-sided byte-check catches this class of drift up front. Applies to all NEEDS_AUDIT rows.

## Block A — Tool & State Invariants (7 rows; A0 + A0.2 are preconditions)

| ID   | Row                                                            | Status  | Surface |
|------|----------------------------------------------------------------|---------|---------|
| A0   | **Fleet feature-flag parity (precondition gate)**              | PASS-with-flags  | SUT-VERIFIED (config flip verified pre-A0.2) |
| A0.2 | **Post-deploy log enumeration & categorization (precondition)**| PASS-with-flags  | SUT-VERIFIED (log capture delivered fleet-wide) |
| A1   | flow registry + per-agent sessions persistence across restart  | **PASS-partial → A1' rerun required** (flow-registry PASS clean; jsonl Tα was tautological under scope; sessionKey map uncovered) | verdict `A1-verdict.md` second amendment; A1' spec to author |
| A2   | `continuationChainCount` / `continuationChainTokens` accounting | pending | NEEDS_AUDIT (field names from continuation-chain code; verify against current shape in `continuation-delegate-store.ts` + `agent-runner.ts`) |
| A3   | `delegatePendingFlags` derivation from TaskFlow (post-Bug-A)   | pending | NEEDS_AUDIT (field name predates TaskFlow refactor; likely renamed or restructured — verify against TaskFlow store schema) |
| A4   | TaskFlow delegate-store lifecycle (create → read → consume → expire) | pending | LIKELY (TaskFlow store is current; flesh against `flows/registry.sqlite` schema + delegate-store module) |
| A5   | Timer arm / disarm / dispose (no leaks, no double-fire)        | pending | LIKELY (timer code exercised in swim-33; well-known surface) |

## Block B — F-Series Behavioral (8 rows)

| ID  | Row                                                            | Status  | Surface |
|-----|----------------------------------------------------------------|---------|---------|
| B1  | F1 clean `continue_work` (no inbound noise)                    | pending | LIKELY (F1 behavior exercised in swim-33/F-STALL) |
| B2  | F2 noisy `continue_work` (inbound during reservation)          | pending | LIKELY (F2 exercised in swim-19/20/21 drift-guard work) |
| B3  | F3 clean `continue_delegate` (quiet room)                      | pending | LIKELY (F3 is current tool, exercised continuously) |
| B4  | F4 noisy `continue_delegate` (inbound during delay)            | pending | LIKELY |
| B5  | F5 silent-wake via `continue_delegate`                         | pending | LIKELY |
| B6  | F6 back-to-back scheduling (two delegates in same turn)        | pending | LIKELY |
| B7  | F7 subagent-announce path — ghost-wake / stale-wake            | pending | SUT-VERIFIED (my commit `b7b570a62e` placed F7 at announce-boundary per RFC §3.4; site known) |
| B8  | F8 post-compaction delegate survival                           | pending | NEEDS_AUDIT (post-compaction hop depends on current compaction flow; verify against `runReplyAgent` / compaction trigger code) |

## Block C — P-Series Candidate-Specific (7 rows)

| ID  | Row                                                            | Status  | Surface |
|-----|----------------------------------------------------------------|---------|---------|
| C1  | P1 structured wake markers observable on the wire              | pending | NEEDS_AUDIT (wake-marker field names — verify current envelope) |
| C2  | P2 pending-flag lifecycle (arm → fire → clear)                 | pending | NEEDS_AUDIT (same family as A3; "pending-flag" may be renamed post-TaskFlow) |
| C3  | P3 timer disposal on generation change                         | pending | LIKELY (swim-19/F-STALL territory) |
| C4  | P4 cache bounds under long chain (N=50 hops)                   | pending | LIKELY (chain cap documented in RFC) |
| C5  | P5 CPU bound under permutation load                            | pending | LIKELY (resource bound; measurement-only) |
| C6  | P6 memory bound under 100-turn chain                           | pending | LIKELY |
| C7  | P7 announce-delivery memoization (no double-fire)              | pending | SUT-VERIFIED (announce-boundary is my F7 placement site) |

## Block D — R-Series Regression (5 rows)

| ID  | Row                                                            | Status  | Surface |
|-----|----------------------------------------------------------------|---------|---------|
| D1  | R1 boot-time stall check                                       | pending | LIKELY (boot sequence instrumented; A0.2 flag #2 OOM will interact here — cross-reference to Silas's upcoming issue) |
| D2  | R2 memory growth over 1h idle + light inbound                  | pending | LIKELY (measurement row) |
| D3  | R3 compaction recovery (trigger threshold + delegate survives) | pending | NEEDS_AUDIT (compaction trigger path — verify current threshold logic) |
| D4  | R4 gateway restart recovery (peer-restart, not self)           | pending | SUT-VERIFIED (same surface as A1 — reuses A1 methodology) |
| D5  | R5 multi-prince simultaneous activity (fleet under cross-load) | pending | LIKELY (fleet behavioral row; no specific filename surface) |

## Block E — V-Series Validation (3 rows, complete)

| ID  | Row                                                            | Status  | Surface |
|-----|----------------------------------------------------------------|---------|---------|
| E1  | V1 `pnpm build` green                                          | **PASS** (tonight, SUT `b7b570a62e`) | n/a |
| E2  | V2 check / lint / type-check green                             | **PASS** (tonight) | n/a |
| E3  | V3 full test suite — 7942 tests, 0 failures                    | **PASS** (tonight) | n/a |

## Block X — Extension Rows (15 rows)

From `#412` continuation-surface audit and Swim 5–7 historical lessons.

| ID  | Row                                                            | Status  | Surface |
|-----|----------------------------------------------------------------|---------|---------|
| X1  | Public continuation tool visibility matrix (across session kinds) | pending | SUT-VERIFIED (P1 regression taught this; I traced REGISTRATION paths) |
| X2  | Main-session vs delegate vs leaf tool visibility                | pending | SUT-VERIFIED (same family as X1) |
| X3  | `NO_REPLY` coexistence with continuation tools                  | pending | LIKELY |
| X4  | `HEARTBEAT_OK` coexistence when heartbeat seat active          | pending | LIKELY |
| X5  | `request_compaction` guard / reachability / threshold behavior  | pending | NEEDS_AUDIT (compaction-request tool current guards) |
| X6  | Generation-guard drift / preemption behavior                    | pending | LIKELY (swim-19/21 territory) |
| X7  | Max chain boundary — probe past declared cap                    | pending | LIKELY |
| X8  | Max delegates per turn — boundary exploration                   | pending | LIKELY |
| X9  | Hot-reload vs restart requirement for config changes            | pending | LIKELY |
| X10 | Textless-turn / tool-only delegate consumption                  | pending | LIKELY |
| X11 | Silent-return trust boundary                                    | pending | LIKELY |
| X12 | Blind enrichment accuracy / contamination resistance            | pending | LIKELY |
| X13 | Chained-delegate permutations at depth 3 / 5 / 10               | pending | LIKELY |
| X14 | Simultaneous delegate completion / announce-back ordering       | pending | LIKELY |
| X15 | Future-intent / delayed scheduling                              | pending | LIKELY |

## NEEDS_AUDIT summary

6 rows flagged for byte/code verification before flesh-out: **A2, A3, B8, C1, C2, D3, X5**. All 6 share a family: field-name or trigger-logic references that predate the TaskFlow refactor or recent rename passes. Each needs a ~5-min byte-check against current code before the driver writes procedure steps. Rest are LIKELY or SUT-VERIFIED and safer to flesh normally (still with a byte-first sanity check).
