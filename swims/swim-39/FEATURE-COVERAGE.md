# SWIM-39 FEATURE-COVERAGE

**Scope:** maps `karmaterminal/openclaw#473` acceptance criteria + post-SWIM-38 issue cluster (`#474`/`#475`/`#476`) to SWIM-39 matrix rows. Owner: 🌊 driver.

This file answers "what does SWIM-39 actually prove?" by mapping each external acceptance bar to the row(s) that verify it. Greenlight requires every external bar to map to ≥1 PASS row.

---

## #473 acceptance criteria → row map

| #473 AC | Row(s) | Cross-host requirement |
|---|---|---|
| #1: Zero `taskFlowDelegates` gate symbols in deployed dist, fleet-wide | OV-1 | 4 hosts × PASS |
| #2: Sqlite-unconditional read/write paths (cap-check, arm, drain) | OV-2 | 4 hosts × PASS |
| #3: Queue introspection surface (`pendingDelegateCount` split as `pending:N, staged:M`) | OV-3 (= P6) | 4 hosts × PASS |
| #4: Non-destructive cancel/drain tooling | OV-4 (= P7); also #472 inheritance | 4 hosts × PASS |
| #5: Static allowlist guard-test promotion to required CI | OV-5 (= V4); also #441 inheritance | 1× CI green |

## Post-SWIM-38 issue cluster → row map

| Issue | Row | Verdict shape |
|---|---|---|
| #474 cooldown-arming | OV-6 | reproduce + characterization → fix-PR if FAIL |
| #475 livenessState:"blocked" channel-surfacing | OV-7 | reproduce + characterization → fix-PR if FAIL |
| #476 write-tool clobber non-determinism | OV-8 | characterization complete; mechanism hypothesis published |

## Inheritance issues → row coverage

| Issue | Row(s) | Notes |
|---|---|---|
| #365 (taskFlowDelegates gate purge umbrella) | OV-1 + OV-2 | covered by #473 acceptance bars |
| #472 (queue introspection / cancel / drain) | OV-4 (= P7) | folds first-class into #473 AC #4 |
| #439 (delegatePendingFlags Map) | OV-2 + OV-5 (V4) | volatile-Map purge + guard-test |
| #440 (lastFiredBand Map) | OV-2 + OV-5 (V4) | volatile-Map purge + guard-test |
| #441 (static allowlist guard-test) | OV-5 (= V4) | direct |
| openclaw-bootstrap#823 (post-compaction shards re-armed/persisted no TTL) | R6 + OV-2 | stale-row-recovery row + sqlite-substrate verify |
| openclaw-bootstrap#825 (compactionCount writer-attribution) | (out-of-scope SWIM-39 per CHARTER §"Async followups"); inheritance-only on Project #62 | not row-covered |
| openclaw-bootstrap#826 (cap = pending-queued count) | (out-of-scope SWIM-39 per CHARTER §"Async followups"); inheritance-only on Project #62 | not row-covered |

---

## Coverage gap analysis

Per CHARTER §"Greenlight criteria":

- All 5 #473 acceptance criteria → row-covered ☑
- All 3 post-SWIM-38 cluster issues → row-covered ☑
- All inheritance issues marked row-covered or explicitly out-of-scope (Project #62 holds them either way)

**Verdict shape**: any row marked FAIL that maps to a #473 AC blocks greenlight. Rows mapping to #474/#475/#476 may show FAIL (becomes characterization receipt + fix-PR trigger) without blocking SWIM-39 greenlight, since those issues are post-SWIM-38 cluster being characterized FOR fix, not pre-#473 acceptance.

This distinction matters: SWIM-39 is the ship gate for #473's substrate purge. The #474/#475/#476 cluster is characterized in-vivo so fix work can land on a substrate where #473 has already passed.

---

## Out-of-scope (per CHARTER §"Async followups")

These are deliberately NOT row-covered in SWIM-39. Tracked separately:

- TOOLS.md retry
- `PRESENT-FOR-GREENLIGHT.md` + 9-step lifecycle
- Canonical-continuation two-liner before ship
- Lineage-shape decision (a) vs (b) carry-forward from SWIM-38
- Cap-design RFC (currently-firing vs scheduled-future-fire)
- A4a fire-window monitor

🌊
