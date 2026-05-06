# SWIM 40 — v29-substrate-verification (ronan's swim)

**Status**: ACTIVE — CHARTER posting; pre-swim gate fires next.
**Driver**: Ronan 🌊 (swim owner; this charter is figs + frond-scribe prepared, awaiting 🌊 byte-walk-stamp)
**Roles** (per `SWIM/FORMAL-SWIM-RUNBOOK.md` §2 fixed roles; 🌊 confirms exact seat assignments on wake):

- **SUT**: Silas 🌫️ by default canary role; fleet-extension seats TBD by 🌊 at row-01
- **Driver / test admin**: Ronan 🌊
- **Deployer / build handler**: Cael 🩸
- **Monitor / infra**: Elliott 🌻
- **Adjudicator**: figs (group decides advance; figs remains final ship authority per swim canon)

**Project board**: TBD on wake (🌊 creates the swim-40 project board).

**Primary umbrella issue**: [`karmaterminal/openclaw-bootstrap#859`](https://github.com/karmaterminal/openclaw-bootstrap/issues/859) — `swim-40-v29-substrate-verification — TRACKER`.

**SUT candidate**: `frond-scribe/20260429/v3-cohort-fixes @ 7eae057a74` — prince-swim target after Path-B + cohort fixes; quad-axis-locked clean per 2026-05-02 byte-walks.
**Visibility config companion**: `frond-scribe/20260429/v3-visibility-rfc-config @ ae4f09282a`.
**Baseline**: `feature/context-pressure-squashed @ 90db3699` (frozen; same baseline as SWIM 39).

## Goal

Certify v29-line ship-readiness across the migrated SWIM 39 verification rows plus the new visibility-substrate verification rows. The substrate pivot is deliberate: SWIM 39 was bound to the v24/canonical2 volatile-Map-purge verification surface, while the active cohort line moved to v29/v3.

figs's directive anchors the scope:

> *swim-40 will be about the 2026.4.29 line unless something horrific is uncovered*

SWIM 40 therefore rebinds the still-relevant SWIM 39 OV rows to the v29 candidate and adds the visibility-RFC rows that landed on the v3 line.

## The actual swim

Per `SWIM/FORMAL-SWIM-RUNBOOK.md` §1: **the swim IS the sequenced deploy of the candidate to the fleet (or the SUT) with traces visible + behavioral matrix exercised against the declared acceptance rows.** Not a doc audit. The deploy + matrix are the case.

## Substrate decision

**Runtime axis**: v29 candidate line:

- `frond-scribe/20260429/v3-cohort-fixes @ 7eae057a74`
- `frond-scribe/20260429/v3-visibility-rfc-config @ ae4f09282a`

**Lineage axis**: v29-rooted; Path-B home `90ff152548`.

**Baseline axis**: `feature/context-pressure-squashed @ 90db3699`, frozen as in SWIM 39.

## Acceptance rows

These are the swim-40 board rows. The first four are migrate-not-retire rows from SWIM 39; the last three are new visibility-substrate rows.

1. **OV-1 — dist gate-symbol grep on v29 build**: migrated from SWIM 39 OV-1 (`openclaw-bootstrap#830`). Verify zero `taskFlowDelegates` strict-equality gate-shape matches in the v29 deployed dist. frond-scribe byte-walked the v3-cohort-fixes `src/` surface as verified-zero on 2026-05-02; runtime row proves deploy bytes.
2. **OV-2 — `pendingDelegateCount` split-count surface**: migrated from SWIM 39 OV-3 (`openclaw-bootstrap#832`). Verify queue state reports as `pending:N, staged:M` split, not a single number, on v29. Source locations byte-walked for this substrate: `src/status/status-message.ts:17,87`, `src/status/status-text.ts:18,286`, and `src/commands/status.command-report-data.ts:168`.
3. **OV-3 — non-destructive cancel/drain tooling**: migrated from SWIM 39 OV-4 (`openclaw-bootstrap#833`). Verify a single queued row can be cancelled/drained with a guarded `WHERE`, the row is preserved as evidence, no non-target rows mutate, and the gateway remains responsive. Runtime surfaces: `openclaw tasks flow cancel <flow-id>`, `src/commands/doctor-workspace-status.ts`, and `src/tasks/task-executor-policy.ts`.
4. **OV-4 — `livenessState:blocked` channel surfacing**: migrated from SWIM 39 OV-7 (`openclaw-bootstrap#836`). Verify blocked-state becomes channel-visible within the latency budget 🌻 sets for the row. Source locations byte-walked for this substrate: `src/agents/subagent-announce-output.ts:59`, `src/agents/pi-embedded-subscribe.handlers.types.ts:85`, and `src/agents/pi-embedded-subscribe.handlers.lifecycle.ts:61-63`.
5. **OV-5 — four-level visibility enum**: new visibility row. Exercise `self | tree | agent | all` on v29 and assert the expected gate-allow / gate-block matrix per `src/plugin-sdk/session-visibility.ts:187-247`. Cites RFC §5.2 in `continue-work-signal-v2.md` and 🌊's 2026-05-02 04:44Z byte-walk-stamp on `ae4f09282a`.
6. **OV-6 — cross-tree same-agent reach via `visibility=agent`**: new visibility row. Exercise `sessions_send` from a main-DM session to the same agent's Discord-channel-bound session; assert successful delivery under `agent` and forbidden delivery under default `tree`. Cites 🌊's 2026-05-02 04:16Z byte-walk and the visibility resolver at `src/plugin-sdk/session-visibility.ts:60-67`.
7. **OV-7 — ansible `all` default behavior**: new visibility row. Verify `karmaterminal/openclaw-bootstrap#857` propagates fleet config to `~/.openclaw/openclaw.json` as `tools.sessions.visibility=all` once admin-merged, following the `openclaw-config` Ansible role pattern from `#847`; cohort dogfoods all visibility permutations.

## Pre-swim gate (HARD prereqs to behavioral rows)

Per `SWIM/FORMAL-SWIM-RUNBOOK.md` §3, no behavioral row begins until the exact running artifact is recorded:

1. **CHARTER posted** — this file on `karmaterminal/openclaw-bootstrap` branch `frond-scribe/swim-40-board-prep`; main becomes the live source after figs admin-merges the charter PR.
2. **Substrate locked** — `frond-scribe/20260429/v3-cohort-fixes @ 7eae057a74` plus visibility companion `ae4f09282a` named as runtime candidates; `90db3699` baseline remains frozen.
3. **Deployer + monitor confirm**:
   - 🩸 confirms deploy route and exact per-host workflow invocations.
   - 🌫 confirms SUT seat, workspace posture, build-info/runtime version, and tool visibility.
   - 🌻 confirms monitor surfaces are open before row execution.
4. **First row file landed** — `rows/row-01-pre-swim-gate.md` with explicit pass criteria.

**Pre-swim gate is fired by `rows/row-01-pre-swim-gate.md` PASS, not by ad-hoc ack.**

## Matrix scope

SWIM 40 inherits the `SWIM/FORMAL-SWIM-RUNBOOK.md` §4 declared blocks A-E and overlays the seven v29-specific OV rows above. Because this is a stabilization / pre-ship swim, the default posture is full declared-board execution unless 🌊 + figs explicitly accept an omission.

### Layer order

1. **Static layer** — descriptor / source / test harness on candidate before deploy.
2. **Live-runtime layer** — in-process behavior on each host after deploy.
3. **Post-deploy smoke** — registry/transport surfaces + OTEL if available.

Full row execution files land under `swims/swim-40-v29-substrate-verification/rows/` as the swim progresses. The GitHub tracker issue is the board index for the seven OV row issues.

## Greenlight criteria

Per `SWIM/FORMAL-SWIM-RUNBOOK.md` §9:

- All declared rows have explicit verdict: PASS / FAIL / DEFERRED-with-justification.
- Static-layer rows are 100% PASS.
- Live-runtime rows meet the declared pass bar; any FAIL is triaged with a row-issue link.
- Post-deploy smoke rows are 100% PASS or trigger rollback.
- All seven v29 OV rows are byte-verified on the declared substrate.
- 4/4 cohort concurrence on "advance" via `#sprites-of-thornfield`; group decides, figs adjudicates final ship posture.

## Rollback trigger

- Gateway PID dies on any host post-deploy and does not auto-restart within 60s.
- Any post-deploy smoke row FAILs on any host.
- Any row proves the candidate artifact is not the declared v29 substrate.
- 4/4 cohort concurrence on "abort".

Rollback route is the deploy workflow with each host's last-known-good ref, per `SWIM/RUNBOOK-deploy-to-self.md`.

## Open questions / TBD for 🌊 wake-stamp

- Confirm exact SUT seat assignment and whether Silas remains primary canary for row-01.
- Confirm deploy-lineage variant for v29 runtime + visibility companion.
- Confirm cohort deploy order and whether a fleet canary precedes all-host deploy.
- Confirm latency budget for OV-4 blocked-state channel surfacing.
- Create and link the swim-40 project board.
- Decide whether any non-OV formal rows are explicitly deferred for this swim.

## Provenance

- figs directive, 2026-05-02 ~04:42Z: SWIM 40 targets the 2026.4.29 line unless a severe blocker appears.
- 🌊 explicit ask, 2026-05-02 ~04:48Z / channel msg `1499994945...`: prepare charter + tracker + four migrated OV rows + three visibility rows; 🌊 byte-walk-stamps on wake.
- Source SWIM 39 tracker: `karmaterminal/openclaw-bootstrap#829` (stays open until 🌊 closes on wake).
- Migrated source rows: `#830`, `#832`, `#833`, `#836` (all stay open with migrate-comments until 🌊 wake-stamp closure).

🌊
