# SWIM Case Registry — CATALOG v1

This is the canonical case registry for the FULL continuation swim charter (`SWIM/FULL-SWIM-CHARTER.md`).

Every FULL swim charter must name the registry version it elects against and disposition every active case (in scope / required / deferred / omitted with reason). Per `SWIM/CASE-REGISTRY-RULES.md`: a case missing entirely from a swim's disposition manifest makes that swim NOT-FULL by construction.

## Registry version

- **Current version**: `v1`
- **Established**: 2026-05-06
- **Seed source**: `swims/swim-34-formal-matrix/ROWS.md` (45-row historical board including A0 + A0.2 preconditions) mapped through `swims/FULL-SWIM-CROSSWALK.md` onto the 8-family modern charter
- **Author**: Ronan 🌊 from ronan-seat against the cohort-cosigned substrate stack (PR #908 + PR #929)
- **Anti-flattening note**: this v1 catalog seeds from `swim-34` matrix only. Extension cases (cross-session targeted return, multi-recipient, fanout, OTel trace-parent stitching, request_compaction lifecycle, post-compaction successor proof) belong in v1 as `new` lifecycle status with explicit provenance, not in a future registry version. See per-case files for `new` cases sourced post-`swim-34`.

## Lifecycle status legend

Per `SWIM/CASE-REGISTRY-RULES.md`:

- `active` — must appear on every FULL board unless explicitly elected out
- `deferred` — declared on the board, executed later; counts toward NOT-FULL if left here at close
- `deprecated` — feature promise removed; tombstone with reason
- `superseded-by <id>` — replaced by a narrower / better case
- `split <ids>` — one old case hid multiple claims; tombstone with replacement pointer
- `merged <id>` — real coverage duplication folded into one
- `lost` — known to have existed; evidence too thin to rebuild yet (carries confidence tag)
- `new` — added since last cycle; declared with family + claim + evidence class + provenance

## Evidence-class legend

- `repo-test` — semantic correctness provable by unit/integration tests in-repo
- `live-row` — lifecycle truth requires live runtime exercise on a real host
- `cross-seat` — recipient-side proof from a non-driver seat is required
- `deploy` — bytes-on-host verification + post-deploy continuity required

A case can require multiple evidence classes (e.g. `live-row + cross-seat` for cross-session targeted return).

## Family map

Per `SWIM/FULL-SWIM-CHARTER.md` §3, the 8 required families are:

- **Turns** — core self-election behavior
- **Delegates** — all major delegate modes and their lifecycles
- **Guards** — continuation boundaries and fallback/denial behavior
- **Routes** — where work lands, and proof that it landed where claimed
- **Recovery** — context-pressure / compaction / restart / successor truth
- **Rollout** — release-facing real-host continuity
- **Observability** — runtime forced to agree with receipts
- **Contamination / interpretation truth** — swim itself stays truthful enough to notice

Per `swims/FULL-SWIM-CROSSWALK.md`, historical block taxonomy maps as:

- **A** Infrastructure → Turns + Guards + Observability (split per case)
- **B** Behavioral F-series → Delegates + Turns
- **C** Port/candidate-specific → Routes + Observability + Guards
- **D** Regression/recovery → Recovery + Rollout
- **E** Validation suite → Rollout-supporting (not FULL-defining alone)
- **X** Extension rows → Guards + Observability + Routes + public-surface claims

## Case index

Cases live as individual files under `SWIM/cases/<case-id>.md`. The id-shape is `<family-prefix>-<3-digit>` for new cases, or carries the historical id (`A1`, `B7`, `X5`, etc.) for swim-34-seeded cases preserved verbatim.

### Active (swim-34 seeded)

#### Family — Turns (election/persistence prerequisites from A series)

- [`A1`](cases/A1.md) — flow registry + per-agent sessions persistence across restart
- [`A4`](cases/A4.md) — TaskFlow delegate-store lifecycle (create → read → consume → expire)
- [`A5`](cases/A5.md) — timer arm / disarm / dispose (no leaks, no double-fire)
- [`B1`](cases/B1.md) — F1 clean `continue_work` (no inbound noise)
- [`B2`](cases/B2.md) — F2 noisy `continue_work` (inbound during reservation)

#### Family — Delegates (B series + delegate-specific A/C)

- [`A3`](cases/A3.md) — `delegatePendingFlags` derivation from TaskFlow (post-Bug-A)
- [`B3`](cases/B3.md) — F3 clean `continue_delegate` (quiet room)
- [`B4`](cases/B4.md) — F4 noisy `continue_delegate` (inbound during delay)
- [`B5`](cases/B5.md) — F5 silent-wake via `continue_delegate`
- [`B6`](cases/B6.md) — F6 back-to-back scheduling (two delegates in same turn)
- [`B7`](cases/B7.md) — F7 subagent-announce path — ghost-wake / stale-wake
- [`B8`](cases/B8.md) — F8 post-compaction delegate survival
- [`X10`](cases/X10.md) — textless-turn / tool-only delegate consumption
- [`X11`](cases/X11.md) — silent-return trust boundary
- [`X13`](cases/X13.md) — chained-delegate permutations at depth 3 / 5 / 10
- [`X14`](cases/X14.md) — simultaneous delegate completion / announce-back ordering
- [`X15`](cases/X15.md) — future-intent / delayed scheduling

#### Family — Guards (chain/width caps, denial, generation drift)

- [`A2`](cases/A2.md) — `continuationChainCount` / `continuationChainTokens` accounting
- [`X3`](cases/X3.md) — `NO_REPLY` coexistence with continuation tools
- [`X4`](cases/X4.md) — `HEARTBEAT_OK` coexistence when heartbeat seat active
- [`X6`](cases/X6.md) — generation-guard drift / preemption behavior
- [`X7`](cases/X7.md) — max chain boundary — probe past declared cap
- [`X8`](cases/X8.md) — max delegates per turn — boundary exploration
- [`X9`](cases/X9.md) — hot-reload vs restart requirement for config changes

#### Family — Routes (delivery target resolution and recipient-side proof)

- [`C1`](cases/C1.md) — P1 structured wake markers observable on the wire
- [`C2`](cases/C2.md) — P2 pending-flag lifecycle (arm → fire → clear)
- [`C7`](cases/C7.md) — P7 announce-delivery memoization (no double-fire)

#### Family — Recovery (context-pressure / compaction / restart / successor)

- [`B8`](cases/B8.md) — F8 post-compaction delegate survival (also Delegates)
- [`C3`](cases/C3.md) — P3 timer disposal on generation change
- [`D1`](cases/D1.md) — R1 boot-time stall check
- [`D3`](cases/D3.md) — R3 compaction recovery (trigger threshold + delegate survives)
- [`D4`](cases/D4.md) — R4 gateway restart recovery (peer-restart, not self)
- [`X5`](cases/X5.md) — `request_compaction` guard / reachability / threshold behavior

#### Family — Rollout (real-host live continuity, validation supporting)

- [`A0`](cases/A0.md) — fleet feature-flag parity (precondition gate)
- [`A0.2`](cases/A0.2.md) — post-deploy log enumeration & categorization (precondition)
- [`D2`](cases/D2.md) — R2 memory growth over 1h idle + light inbound
- [`D5`](cases/D5.md) — R5 multi-prince simultaneous activity (fleet under cross-load)
- [`E1`](cases/E1.md) — V1 `pnpm build` green
- [`E2`](cases/E2.md) — V2 check / lint / type-check green
- [`E3`](cases/E3.md) — V3 full test suite green

#### Family — Guards / Routes (resource and load bounds)

- [`C4`](cases/C4.md) — P4 cache bounds under long chain (N=50 hops)
- [`C5`](cases/C5.md) — P5 CPU bound under permutation load
- [`C6`](cases/C6.md) — P6 memory bound under 100-turn chain

#### Family — Observability (tool visibility + scoreboard truth)

- [`X1`](cases/X1.md) — public continuation tool visibility matrix (across session kinds)
- [`X2`](cases/X2.md) — main-session vs delegate vs leaf tool visibility

#### Family — Contamination / interpretation truth

- [`X12`](cases/X12.md) — blind enrichment accuracy / contamination resistance

### New (post-swim-34 seams; sourced 2026-05-06 from RFC + cohort substrate work)

- [`N001`](cases/N001.md) — cross-session targeted `continue_delegate` return (`targetSessionKey`)
- [`N002`](cases/N002.md) — multi-recipient `continue_delegate` return (`targetSessionKeys`)
- [`N003`](cases/N003.md) — fanout-mode `tree` return (resolved-ancestor recipient set)
- [`N004`](cases/N004.md) — fanout-mode `all` return (all-known-sessions recipient set)
- [`N005`](cases/N005.md) — chain-budget anti-flood: per-completion fan-out consumes 1 chain-step regardless of recipient count
- [`N006`](cases/N006.md) — OTel trace-context (`traceparent`) propagation across queue boundary
- [`N007`](cases/N007.md) — OTel trace-context preserved through restart-replay path
- [`N008`](cases/N008.md) — `request_compaction` success path with cooldown arming + diagnostic count
- [`N009`](cases/N009.md) — `request_compaction` failure path (`[system:compaction-failed]` system event + staged-delegate residue)
- [`N010`](cases/N010.md) — post-compaction successor receives correct state, not stale ghost state

### Lost (named-but-thin from archaeology; cannot anchor a FULL board until migrated)

Per `swims/MISSING-SWIMS-LEDGER.md`, swims 11–30 (except 31), plus 32–33, exist as named-only / carried-forward shadows. Catalog does not yet carry per-case entries from those eras; the missing-swims ledger is the authoritative tombstone for them at the swim-level until evidence migrates.

### Deferred / Deprecated / Superseded

(none yet at v1)

## Charter coupling

A FULL swim charter must:

1. name `registry-version: v1` (or whatever version it elects against)
2. include every `active` case in its disposition manifest with one of: `in-scope-required`, `in-scope-optional`, `deferred-with-reason`, `omitted-with-reason`
3. close every required row with a verdict per `FULL-SWIM-CHARTER.md` §6
4. publish the scoreboard rolling all 8 families per `FULL-SWIM-CHARTER.md` §7
5. omit `lost` cases from the disposition manifest unless evidence migrates first
