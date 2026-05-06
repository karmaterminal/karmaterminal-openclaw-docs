# SWIM 39 — volatile-purge edition (ronan's swim)

**Status**: ACTIVE — CHARTER posting; pre-swim gate fires next.
**Driver**: Ronan 🌊 (helm, setup, row-calls, findings → SWIM/ factory)
**Roles** (per `SWIM/FORMAL-SWIM-RUNBOOK.md` §2 fixed roles):

- **SUT**: Silas 🌫 (urudyne canary; already on candidate-equivalent posture per #473 evidence pins)
- **Driver / test admin**: Ronan 🌊
- **Deployer / build handler**: Cael 🩸
- **Monitor / infra**: Elliott 🌻
- **Adjudicator**: figs (group decides advance; figs explicitly NOT manufactured-gate per the same canon as SWIM 38)

**Project board**: <https://github.com/orgs/karmaterminal/projects/62> (SWIM 39, created by 🩸 2026-04-30 ~19:55 PDT)

**Primary umbrella issue**: `karmaterminal/openclaw#473` — *swim-39/A — purge legacy volatile Map continuation substrate (TaskFlow sqlite unconditional)*

**SUT candidate (proposed)**: Silas's posture artifact `0a960498dccbba3b0ed2ef64ecd8cd2cc9368e1b` (PR #469 head; SWIM 38 SUT) — already verified zero gate symbols + sqlite path unconditional. Fleet-extension is the SWIM 39 acceptance bar.
**Baseline**: `feature/context-pressure-squashed @ 90db3699` (frozen per TOOLS.md invariant).

## Goal

Verify the **post-volatile-purge state** required by `openclaw#473` against the deployed fleet, and certify the operational substrate for the 2026.4.24 ship:

> *one substrate, fewer weird paths, restart-resistant by construction* — figs (via 🩸 msg `1499558973550886942`)

This swim is the runtime certification that closes #473's acceptance gates as fleet-deployed bytes, and the in-vivo data-collection pass for the post-SWIM-38 issue cluster (`openclaw#474` cooldown-arming, `#475` blocked-state observability, `#476` write-tool clobber).

## The actual swim

Per `SWIM/FORMAL-SWIM-RUNBOOK.md` §1: **the swim IS the sequenced deploy of the candidate to the fleet (or the SUT) with traces visible + behavioral matrix exercised against #473's acceptance criteria.** Not a doc audit. The deploy + matrix are the case.

## Substrate decision

**Runtime axis** (what SWIM 39 proves about deployed bytes): SUT = Silas's `0a960498dccbba3b0ed2ef64ecd8cd2cc9368e1b` posture, then fleet-extension to Cael / Elliott / Ronan via `deploy-gateway.yml` per-prince invocation. The lineage axis remains the deferred SWIM-38 (a) vs (b) decision; SWIM 39 is **lineage-neutral** since the runtime bytes are tree-equivalent across both lineage shapes.

**Acceptance translates to verifiable rows**:

1. **Zero gate symbols** — grep dist on each of 4 hosts → 0 matches for `taskFlowDelegates` strict-equality
2. **Sqlite-unconditional read/write** — runtime probe: cap-check, arm, drain all hit `~/.openclaw/flows/registry.sqlite`; volatile-Map fallback absent
3. **Queue introspection** — `pendingDelegateCount` reports as `pending:N, staged:M` split (telemetry surface check)
4. **Non-destructive cancel/drain tooling** — exercise tool surface end-to-end (issue, dispatch, cancel one queued row, verify status preserved)
5. **Static allowlist guard-test** — `pnpm test` invocation against the relevant guard-test file passes on each host (CI-required check)

## Pre-swim gate (HARD prereqs to row-1)

Per `SWIM/RUNBOOK-deploy-to-self.md` 4-clause safe shape:

1. **CHARTER posted** (this file, on `karmaterminal/openclaw-bootstrap` branch `swim-39/prep-review`; live byte source is the branch head until PR #828 admin-merges to main, at which point main becomes live source) — byte-checkable
2. **Substrate locked** — Silas posture artifact `0a960498dc...` named, tree-equivalence to Cael's pending dist-rebuild documented; fleet-deploy plan named per host
3. **Deployer + monitor confirm**:
   - 🩸 confirm dispatch route to all 4 hosts (cross-prince guard: needs `karmafeast` switch OR per-prince self-dispatch)
   - 🌫 confirm canary box ready, workspace clear, last build-info snapshotted; baseline gate-symbol-zero state preserved
   - 🌻 monitor surfaces live: journal, session-store, delivery_queue, continuation signal/guard, OTEL if reachable
4. **First row file landed** (`rows/row-01-pre-swim-gate.md`) with explicit pass criteria

**Pre-swim gate is fired by `rows/row-01-pre-swim-gate.md` PASS, not by ad-hoc ack.**

## Matrix scope

Inheriting from `SWIM/FORMAL-SWIM-RUNBOOK.md` §4 declared blocks + #473-specific OVERLAY:

- **Block A** (TC1-TC4): infra reachability — adapt to swim-39 candidate per host
- **Block B** (F1-F8): behavioral, continuation surface — verify `continue_work` / `continue_delegate` / `silent-wake` / back-to-back / two-hop / post-compaction
- **Block C** (P1-P7): port-specific (cap split-count telemetry; non-destructive cancel; sqlite-unconditional path probes)
- **Block D** (R1-R5): regression/recovery — gateway restart durability; multi-prince simultaneous activity; **NEW: cooldown-arming probe per #474 hypothesis**
- **Block E** (V1-V3): validation — `pnpm install && pnpm tsgo` (per `openclaw-ci.yml` invariant) + guard-test allowlist row + full vitest baseline

### #473-specific extension rows (OVERLAY)

- **OV-1**: dist gate-symbol grep on each of 4 hosts — count must be 0
- **OV-2**: sqlite-unconditional probe per cap-check / arm / drain code path (each emits a sqlite query under load)
- **OV-3**: `pendingDelegateCount` split-count surface verification (`pending:N, staged:M` shape)
- **OV-4**: Non-destructive cancel single-row exercise (queue → cancel → status preserved)
- **OV-5**: Schema-removal verification — `taskFlowDelegates` field absent from config schema; presence is a fail
- **OV-6**: **Cooldown-arming hypothesis probe (#474)** — induce summarization failure, verify cooldown does NOT latch on attempt-start
- **OV-7**: **`livenessState:"blocked"` channel-surfacing probe (#475)** — induce blocked state, verify channel-visibility
- **OV-8**: **`write` tool clobber non-determinism probe (#476)** — controlled multi-host write probe with size/path/concurrency variation; mechanism byte-walk (🌻+🌫 pair)

### Layer order (per swim-37 / swim-38 OVERLAY pattern)

1. **Static layer** — descriptor / source / vitest harness on candidate BEFORE deploy
2. **Live-runtime layer** — in-process behavior on each host after deploy
3. **Post-deploy smoke** — registry/transport surfaces + OTEL if available

Full row matrix lands in `rows/` files as the swim progresses; CASES.md + OVERLAY.md follow swim-37/38 pattern.

## Greenlight criteria

Per `SWIM/FORMAL-SWIM-RUNBOOK.md` §9:

- All declared rows have explicit verdict (PASS / FAIL / DEFERRED-with-justification)
- Static-layer rows: 100% PASS
- Live-runtime: ≥95% PASS; FAIL must be triaged with row-issue link
- Post-deploy smoke: 100% PASS or hard rollback
- All 5 #473 acceptance criteria byte-verified across all 4 hosts
- 4/4 cohort concurrence on "advance" via `#sprites-of-thornfield` (group decides, NOT figs-gated)

## Roll-back trigger

- Gateway PID dies on any host post-deploy and does not auto-restart within 60s
- Any post-deploy smoke row FAIL on any host
- 4/4 cohort concurrence on "abort"

Roll-back: `deploy-gateway.yml ref=<host last-known-good>` per `SWIM/RUNBOOK-deploy-to-self.md`.

## Source material (drafts → row-tracking)

Drafts collected on this branch (`swim-39/prep-review`) at `swims/swim-39/prep/drafts/` feed the swim as follows:

| Draft | SWIM 39 role |
|---|---|
| `cooldown-arming.md` | OV-6 row source + #474 body |
| `blocked-state-observability.md` | OV-7 row source + #475 body |
| `826-close-of-record-material.md` | SWIM 38 carry-forward, informs Block D regression rows |
| `issue-audit-20260430-1900.md` | inheritance map + dedupe canon (🩸's audit) |
| `stale-row-observability.md` | OV-4 evidence base (cancel/drain probe) |
| `stale-row-comment-{openclaw-472,bootstrap-823}.md` | issue-comment material, not row source |
| `transcript-attractor-corollary.md` | discipline doc; informs `charter.md` process-guard section |

The `swim-39/prep/charter.md` (🌊) + `charter-index.md` (🌻) + `swim39-action-state.md` (🩸) on this branch remain operational scaffolds for the SWIM-39 prep period; they merge into the `swims/swim-39-volatile-purge/` directory or are closed-of-record at swim greenlight.

## Filed inheritance and new issues (per 🩸's project setup, 2026-04-30 ~19:55 PDT)

**New `karmaterminal/openclaw` issues:**

- `#474` — compaction cooldown should arm on success, not attempt-start; failed summarization runs latch sessions out of relief (OV-6)
- `#475` — `livenessState:"blocked"` not channel-surfaced when compaction failure cascades (OV-7)
- `#476` — `write` tool reports append-like success while overwriting; non-deterministic across cohort and within-session (OV-8)

**Inheritance** (already on project board #62, no re-file):

- `openclaw#365`, `#472`, `#473` (umbrella), `#439`, `#440`, `#441`
- `openclaw-bootstrap#819`, `#823`, `#825`, `#826`

## Async followups (NOT blocking greenlight)

- TOOLS.md retry (resolver-trap + set-diff classifier + first-fired-wins + manufactured-gate poison-shape + write-clobber discipline)
- `PRESENT-FOR-GREENLIGHT.md` + 9-step canonical-release-lifecycle
- Canonical-continuation two-liner before ship `2026.4.24`
- Lineage-shape decision (a) vs (b) carry-forward from SWIM 38 — group decides post-swim
- Write-tool structural-prevention (refuse `write` to `memory/YYYY-MM-DD.md` paths) → tracked under `openclaw#476`

## Provenance

- figs framing: msg `1499558973550886942` ("one substrate, fewer weird paths, restart-resistant by construction")
- 🌻 scope shape: msg `1499559709076652062`
- 🩸 +1 with one-guardrail: msg `1499559940329701607`
- figs frame-error catch (this swim): "why have we not yet produced swim 39 gh project and items? are you at a point to do that? we seem confused over document assembly?" (Discord msg, ~2026-04-30 19:55 PDT)
- 🩸 project + issues filed: msg `1499606114277261422` (2026-04-30 19:59 PDT)
- Project board: <https://github.com/orgs/karmaterminal/projects/62>
- Primary umbrella: <https://github.com/karmaterminal/openclaw/issues/473>

## Loop-detection rule (newly banked, this swim)

Per tonight's incident (~30min URL-canonicalization loop after substrate stabilized at `253a111`):

> If the last commit on the active SWIM branch is >15min old AND the cohort is still posting URL/SHA corrections about it, **STOP NARRATING, START AUTHORING.** Activity-without-artifact-advance is a loop, not progress.

Driver enforces.
