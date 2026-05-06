# SWIM 38 — slippy-hoodie edition (ronan's swim)

**Status**: ACTIVE — CHARTER posting; pre-swim gate fires next.
**Driver**: Ronan 🌊 (helm, setup, row-calls, findings → SWIM/ factory)
**Roles** (per `SWIM/SEAL-BOY-SWIM-RUNBOOK.md` + `SWIM-METHODOLOGY.md` fixed roles):
- SUT: Silas 🌫 (urudyne canary)
- Driver / test admin: Ronan 🌊
- Deployer / build handler: Cael 🩸
- Monitor / infra: Elliott 🌻
- Adjudicator: figs (group decides advance; figs explicitly NOT manufactured-gate per msg `1499473265171763281`)

**Candidate (SUT artifact / deploy ref)**: `0a960498dccbba3b0ed2ef64ecd8cd2cc9368e1b` (PR #469 head)
**Lineage**: canonical2-rooted per parent chain `0a960498dc → 48c259721e → cfa27eee83` (🩸 byte-receipt msg `1499477762862223362`)
**Tree-equivalent receipt branch**: `swim-38/candidate-cfa-plus-469 @ 865d44e025bcb14b1dd034b15e4c56a8575f3cb9` — same `tree=284b1135855e7a685d78fd4afc9daf05a7520e23` (🌻 byte-receipt msg `1499476361629143292`); kept as documented-jacket evidence, NOT used as deploy ref
**Driver call**: deploy `0a960498dc` direct — SHA traceable to PR #469 head, no swim-only metadata in deployed bytes; receipt branch documents the canonical2 arithmetic
**Baseline**: `cf7830ffb3702bf7d826d70838893e2e41709f12` (pre-squash base, canonical2 rooted)

## Goal

Pre-advance validation of the assembled-shape produced by PR #469 fold (4-file C5 symlink-escape repair + 1-file/+2 C3 fixture unblock) against canonical2 lineage, before the cohort decides presentation-branch advance.

This is the swim that closes #433's last live gate (post-fold runtime verification) so the group can make an informed advance call on `feature/context-pressure-squashed`.

## The actual swim

Per `SWIM/RUNBOOK-deploy-to-self.md` + figs reframe (msg `1499473265171763281`): **the swim IS the sequenced deploy of `0a960498dc` to canary 🌫 with traces visible + behavioral matrix exercised.** Not a doc audit. The deploy is the case.

## Substrate decision (locked, with deferred lineage choice)

**Runtime axis** (what SWIM 38 proves about deployed bytes): SUT = `0a960498dc`. Tree-equivalent to `865d44e025` (🌻 receipt). Either ref deploys the same bytes; choosing `0a960498dc` keeps the SHA traceable to PR #469 head.

**Lineage axis**: PR #469's actual lineage already lives on canonical2 (parent chain to `cfa27eee83`); `90db3699` is just the PR-open *target*, not the branch parent. SWIM 38 evidence is **lineage-neutral** — same runtime tree — so the swim certifies the assembled shape regardless of merge-vs-rebase mechanic the cohort chooses at advance time.

**Advance mechanic**: DEFERRED to post-swim group decision. 🌫's #433 appendix (`4355036874`) + swim evidence inform that call.

**No manufactured gate; no blocked-on-figs.**

## Pre-swim gate (HARD prereqs to row-1)

Per `SWIM/RUNBOOK-deploy-to-self.md` 4-clause safe shape:

1. **CHARTER posted** (this file, on `openclaw-bootstrap` main) — byte-checkable
2. **Substrate locked** — `0a960498dc` named, tree-equivalence receipt cited
3. **Deployer + monitor confirm**:
   - 🩸 confirm dispatch route to 🌫 (cross-prince guard: needs `karmafeast` switch OR 🌫 self-dispatch)
   - 🌫 confirm canary box ready, workspace clear, last build-info snapshotted
   - 🌻 monitor surfaces live (per msg `1499476364141527112`): journal, session-store, delivery_queue, continuation signal/guard, OTEL if reachable
4. **First row file landed** (`rows/row-01-pre-swim-gate.md`) with explicit pass criteria

## Matrix scope

Inheriting from `SWIM/FORMAL-SWIM-RUNBOOK.md` §4 declared blocks + swim-37 OVERLAY:

- **Block A** (TC1-TC4): infra reachability — adapt to swim-38 candidate
- **Block B** (F1-F8): behavioral, continuation surface
- **Block C** (P1-P7): port-specific
- **Block D** (R1-R5): regression/recovery
- **Block E** (V1-V3): validation
- **Continuation extension** (per `#412`): full continuation public-surface audit on the deployed bytes (`continue_work`, `continue_delegate`, `request_compaction`)

**Layer order** (per swim-37 OVERLAY pattern):
1. Static layer — descriptor / source / vitest harness on `0a960498dc` BEFORE deploy
2. Live-runtime layer — in-process behavior on 🌫 after deploy
3. Post-deploy smoke — registry/transport surfaces + OTEL if available

Full row matrix lands in `rows/` files as the swim progresses; CASES.md + OVERLAY.md follow swim-37 pattern.

## Greenlight criteria

- All declared rows have explicit verdict (PASS / FAIL / DEFERRED-with-justification)
- Static-layer rows: 100% PASS
- Live-runtime: ≥95% PASS; FAIL must be triaged with row-issue link
- Post-deploy smoke: 100% PASS or hard rollback
- 4/4 cohort concurrence on "advance" via `#sprites-of-thornfield` (group decides, NOT figs-gated)

## Roll-back trigger

- Gateway PID dies on 🌫 and does not auto-restart within 60s
- Any post-deploy smoke row FAIL
- 4/4 cohort concurrence on "abort"

Roll-back: `deploy-gateway.yml ref=<🌫 last-known-good>` per `RUNBOOK-deploy-to-self.md`.

## Provenance

- figs naming: msg `1499473265171763281` ("ronan's slippy-hoodie edition")
- helm assignment: figs msg ("typically @Ronan🌊 does the swim setup and stuff")
- 🌻 helm-confirm: msg `1499473728281645116`
- 🩸 helm-ack: msg `1499474672218148885`
- Tree-equivalence receipt: 🌻 msg `1499476361629143292`
- 🌫 canonical2-base-rot appendix: <https://github.com/karmaterminal/openclaw/issues/433#issuecomment-4355036874>
- PR #469: <https://github.com/karmaterminal/openclaw/pull/469>
- Issue #433: <https://github.com/karmaterminal/openclaw/issues/433>

## Async followups (NOT blocking greenlight)

- TOOLS.md retry (resolver-trap + set-diff classifier + first-fired-wins + manufactured-gate poison-shape)
- `PRESENT-FOR-GREENLIGHT.md` + 9-step canonical-release-lifecycle
- Canonical-continuation two-liner before ship `2026.4.24`
- Lineage-shape decision (a) vs (b) — group decides post-swim
