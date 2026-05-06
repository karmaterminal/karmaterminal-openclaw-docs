# SWIM 37 — `feature/context-pressure-squashed` pre-ship validation

**Status**: ACTIVE — scaffold landing on main, deploy gate pending OTEL preflight + 4/4 cohort concurrence on candidate ref.
**Driver**: Ronan 🌊 (case-ledger), Elliott 🌻 (scaffold + deploy-orchestration)
**Cohort**: Silas 🌫 (SUT / urudyne), Cael 🩸 (cross-checker + coordinator-notes), Ronan 🌊 (FORMAL/ROWS), Elliott 🌻 (MONITORING)
**Candidate**: `karmaterminal/openclaw:feature/context-pressure-squashed`
**Baseline tag**: `v2026.4.21`
**Companion (full receipts)**: `karmaterminal/openclaw:RELEASE-HIGHLIGHTS-2026-04-28.md` on `ronan/release-highlights-merge-2026-04-28` @ `b18fb9ee2e0`

## Goal

Pre-ship validation of `feature/context-pressure-squashed` against `v2026.4.21` baseline. Per `SWIM/FORMAL-SWIM-RUNBOOK.md` §1.5: stabilization/pre-ship swims run the **whole declared board** unless a real blocker exists.

## The actual swim is the deploy

Per figs's directive 2026-04-28 ~09:15 PDT (channel `1466192485440164011`) and cave-redirect at msg `1498734266794639410`: **the swim IS the sequenced deploy of the candidate to all 4 princes with traces visible in the collector.** Not a doc, not a charter, not a comprehensiveness-audit. The audit became the cage; the deploy is the case.

Cohort cut accepted at `1498734952936636527` (🌻 pitch) → `1498735179018010747` (🩸 +1) → 🌊 implicit by-keep-shipping → 🌫 implicit by-keep-shipping (`4766133` SEAL-BOY shard pushed).

## Pre-deploy preflight gate (HARD prereqs to step-1)

Per 🌊 empirical finding (msg `1498738720805753033`) **+ 🌫️ keypath-correction (msg `1498748407014232085`)**: deployed dist `2026.4.22` predates the top-level `diagnostics` schema key (added in `src/config/zod-schema.ts:285` of `OpenClawSchema` post-`2026.4.22`). **Keypath is `diagnostics.otel.endpoint` (top-level), NOT `agents.defaults.diagnostics.otel.endpoint`** — byte-verified against `90db3699:src/config/zod-schema.ts:285`. **Config-set with new schema CANNOT run pre-deploy** — it fails with `Unrecognized key: "diagnostics"`. This empirically validates F26 (deploy-first-then-swim) and F28 (config-preflight runs on deployed dist).

**Re-ordered gate** (per-prince, applied at each fan-out step):

### Phase A — PRE-DEPLOY (door-only, no config-set)

1. **OTEL door-check** from this prince:
   ```
   # tightened per 🩸 cael-box check (msg 1498739382020997290): bare GET=405, bare POST=415 — false-pass risk
   # door-check MUST be POST + JSON Content-Type + empty-trace body; expect 200 + {"partialSuccess":{}}
   curl -sS -X POST -H 'Content-Type: application/json' --data '{}' \
     http://elliott.dandelion.cult:4318/v1/traces
   # 4/4 door reachability confirmed: elliott + urudyne + ronan + cael (2026-04-28 ~10:35 PDT)
   ```
   Expect `200`. Verified door 09:46 PDT from elliott + urudyne + ronan-box (🌊 10:32 PDT).
2. **Integration tip (regenerable)** present in CHARTER.md (this file, below) — byte-checkable per merge; replaces the toxic "frozen SHA" pattern that caused the 2026-04-28 cohort cascade.

### Phase B — DEPLOY (this prince)

3. Fire `deploy-gateway.yml` workflow against this prince with `ref=feature/context-pressure-squashed` (resolves to frozen SHA above).
4. Wait for workflow success + new dist active (`openclaw --version` reports new SHA).
5. Append `<prince>: <old-sha-or-version> → <new-sha-or-version> @ <ISO-8601-PDT> [pid=<pid>]` to `swims/swim-37/DEPLOY-LEDGER.md`.

### Phase C — POST-DEPLOY (config-set + signal-check, against new dist)

6. **Config-set** (now safe, schema is current):
   ```
   openclaw config set diagnostics.otel.endpoint http://elliott.dandelion.cult:4318
   ```
7. **`openclaw config validate`** → expect exit 0.
8. **OTEL signal-check** — emit one real trace + verify it lands in collector:
   ```
   openclaw diag otel emit --service swim-37-preflight --span preflight-$(hostname)-$(date +%s)
   curl -sS http://elliott.dandelion.cult:13133/  # collector health
   # AND grep last 60s of collector log for the emitted span name
   ```
   Expect: span visible in collector within 30s of emit.
9. **Heartbeat post** in `#sprites-of-thornfield` from this prince confirming Phase C green.

### Phase D — GATE TO NEXT PRINCE

10. `pgrep -f openclaw` on this prince → must be alive (capture PID into ledger if not already).
11. Cohort cross-read of ledger entry + heartbeat. **Any abort signal halts fan-out.**
12. Next prince begins Phase A.

## Deploy fan-out

Per Apr 22 fleet-deploy shape: **cael → ronan → silas → elliott**. Self-deploy via GitHub Actions workflow `deploy-gateway.yml` from `karmaterminal/openclaw-bootstrap`. **NEVER self-SIGTERM** (Apr 20 lesson, my own failure mode).

Each prince executes Phases A→B→C→D from the gate above before next prince begins. See gate for command details.

```
gh workflow run deploy-gateway.yml \
  --repo karmaterminal/openclaw-bootstrap \
  -f target_prince=<self> \
  -f ref=feature/context-pressure-squashed \
  -f reason='swim-37 pre-ship validation'
```

Abort on any phase failure. Roll back via the workflow's snapshot mechanism (handled by `deploy.sh` — see `~/.openclaw/workspace/openclaw-bootstrap/deploy/openclaw_from_karmaterminal_fork/deploy.sh`).

Abort on any step failure. Roll back via the workflow's snapshot mechanism (handled by `deploy.sh` — see `~/.openclaw/workspace/openclaw-bootstrap/deploy/openclaw_from_karmaterminal_fork/deploy.sh`).

## Integration tip (regenerable, not frozen)

```
INTEGRATION_BRANCH: cael/325-canonical2
INTEGRATION_TIP:    29e556eb11de7ee7de9e4dadda8bdb2baf3a5dab  (last bumped 2026-04-28T21:08Z, PR #421)
BASE_TAG:           v2026.4.24 (cbcfdf62c7)
REPO:               karmaterminal/openclaw
workflow_ref:       karmaterminal/openclaw-bootstrap/.github/workflows/deploy-gateway.yml (id 263819832)
```

### Byte-check before trusting this section

```
git fetch --prune origin
git rev-parse origin/cael/325-canonical2   # must equal INTEGRATION_TIP above
gh pr list --repo karmaterminal/openclaw --base cael/325-canonical2 --state merged --limit 100
```

If `git rev-parse` does not match `INTEGRATION_TIP`, **trust the byte, not this CHARTER.** Bump the field, append to DEPLOY-LEDGER, and announce in channel.

### Why "frozen candidate" is gone

This swim originally pinned `90db3699ccf3b6c7973dd3fdd9d489c8b507ff3f` on `feature/context-pressure-squashed` (🌊 msg 1498738720805753033, 2026-04-28T10:32-07:00). On 2026-04-28 the cohort discovered that pin was **stale by 51 PRs** — the actual swim-37 wire (continuation primitives, OTEL spans, SDQ persistence, chain-budget, lich, heartbeat harness) had merged into `cael/325-canonical2` on `v2026.4.24` base, while the project README still named `90db3699`. Four princes deployed against the stale pin from a compaction summary that faithfully preserved a load-bearing-doc-gone-wrong. The cure is not vigilance; it is **derived anchors that compaction cannot preserve as text** because they regenerate from `git rev-parse`. Hence: regenerable INTEGRATION_TIP, byte-check inline, every-merge-bumps-the-field. See cohort post-mortem 2026-04-28 21:25Z.

## Lineage

Swim-37 = **base canonical ∪ prior-swim history ∪ swim-37 delta**.

- **Base canonical**: `SWIM/FORMAL-SWIM-RUNBOOK.md` §4 (Block A `TC1-TC4` infra, Block B `F1-F8` behavioral, Block C `P1-P7` port-specific, Block D `R1-R5` regression/recovery, Block E `V1-V3` validation) + extension rows from `openclaw-bootstrap#427` (formal matrix shape) and `#412` (full continuation public-surface audit).
- **Prior swims (1–36, do not re-author)**:
  - `swims/swim-34-formal-matrix/ROWS.md` — A0–A5, B1–B8, C1–C7, D1–D5, E1–E3, X1–X15 (~50 rows)
  - `swims/swim-34-staleness/`, `swims/swim-35-stabilization/ROWS.md`, `swims/swim-36/charter.md`
  - `SWIM/history/` — SWIM5/6/7/31 historical anchors
  - `gh issue list --search "swim in:title"` — ~60 row-issues
- **Delta**: `CASES.md` in this dir (39 rows specific to `feature/context-pressure-squashed` since `v2026.4.21`).

## Open figs Qs (not blocking deploy)

- **X1**: echo-to-multiple-channels semantics, gates E6.3
- **C1**: chain-returns-to-root spec-or-current, gates E6.2
- **B5**: SUT confirm + bypass-fix order

## Async followups (do NOT block the deploy)

- `lessons/swim-37-entry-gate-postmortem-2026-04-28.md` (🌊, F21 cohort-pattern not character)
- `SWIM/CROSS-SEAT-PROTOCOL.md` (D13 from canary-prep dogfood)
- `SWIM/GLOSSARY.md` (R21 from RD-fold)
- `SWIM/FLEET-INFRA.md` (R23 step 2 — endpoints/hostnames/ports as cohort-shared canon, not private memory)
- `RELEASE-HIGHLIGHTS-2026-04-28.md` strip-and-reference cleanup
- Comprehensiveness audit shards (PR #728) → 4/4 stamp by reads-not-acks

## Provenance

- 09:13 PDT cohort convergence on `swims/swim-37/` location (figs `1498714597740249169` + `1498714658108870717`; 🌫 `1498714753529417898`; 🌻 `1498714778489847859`; 🩸 `1498714851629990080`)
- 09:17 PDT PR #727 closed by 🌊; ref branch `ronan/swim-37-overlay-2026-04-28` HEAD `cde8a5e` retained as raw cross-walk material
- 10:14 PDT figs cave-redirect (msg `1498734266794639410`): "you promised 'were ready to swim, machine boy' last night and youve forgotten what a swim IS"
- 10:17 PDT cohort cut-to-swim: 🌻 pitch `1498734952936636527` + 🩸 +1 `1498735179018010747`; 🌊 + 🌫 implicit by ship-mode

## Companion artifacts (in repo)

- `swims/swim-37/CASES.md` — 39-row delta ledger (cherry-picked from `cde8a5e` via `3f63843`)
- `swims/swim-37/charter.md` — original 🌊 charter (preserved alongside this CHARTER.md for provenance; merge follow-up)
- `karmaterminal/openclaw:RELEASE-HIGHLIGHTS-2026-04-28.md` — full receipts (PR #56 cross-walk, config-bits enumeration, methodology, commit-delta walk, RFC anchors)

## OVERLAY relationship

`OVERLAY.md` peer-file is the per-swim-37 binding of base+prior+delta into the executable test plan. See `OVERLAY.md` in this dir.
