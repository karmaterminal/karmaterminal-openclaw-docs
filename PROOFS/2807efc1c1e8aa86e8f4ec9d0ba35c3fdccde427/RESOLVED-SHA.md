# RESOLVED-SHA — 2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427

## SHA identity
- **CANDIDATE_SHA**: `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`
- **Branch**: `uncurse/20260605/assembly-for-update` (assembly branch for the 2026-06-05 GATES cycle)
- **Build pin**: `OpenClaw 2026.6.2 (2807efc)` — verified via `openclaw --version` + session_status on cael-dgx
- **Review-only draft PR**: karmaterminal/openclaw#926 (base fork-main pristine, drift-review surface, DO-NOT-MERGE)

## Lineage
- `9d07233faa29a300e6857bc11ece4eb26a77b08d` (PR-presentation head `frond-scribe-claude/20260509/narrow-surgery-tight`)
  - + 1 commit `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427` 🌿 fix(openclaw-tools): suppress L627 warning at inventory-build callsites (#923)

## Cure-delta vs presentation head 9d07233
4 files, +72/-2 (the single #923 change):
- `src/agents/openclaw-tools.ts` — add `inventoryOnly?: boolean`; suppress L627 `neither continueWorkOpts nor requestCompactionOpts` warn when set. Tool-registration logic UNCHANGED.
- `src/gateway/tool-resolution.ts` — pass `inventoryOnly: true` at catalog/lookup callsite.
- `src/skills/runtime/tool-dispatch.ts` — pass `inventoryOnly: true` at dispatch-routing callsite.
- `...openclaw-tools.continuation-misconfig-warn.test.ts` — TDD coverage.

## figs deploy-criteria (both verified GREEN on cael-dgx)
- ✅ (a) deployed on right SHA — gateway restarted 08:15:29 PDT onto 2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427 (PID 2537135); running build `2807efc` cross-checked (running-version, not just checkout)
- ✅ (b) inventory-misreporting CURED — ZERO L627 `continueWorkOpts/requestCompactionOpts` warn hits in post-restart logs; `inventoryOnly` fix compiled into running dist (`openclaw-tools-*.js` + `tool-resolution-*.js`); continuation tools register + fire (chain 3/200, continue_work fired clean)

## Gate state at byte
- ✅ Gate 1 (CI) — run 27020945380 completed/success on 2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427, 117 jobs green / 0 failures
- ⏳ Gate 2 (cure-bytes byte-identical) — pending (cure-bytes/ verification)
- ⏳ Gate 3 (full prepush-ci local) — pending (gates/ logs)
- ⏳ Gate 4 (cohort cosign-pair) — pending
- ⏳ Gates 5/6 (force-push / post-push) — pending PROOFS-corpus completion + figs go-signal

## Per-seat deploy status (08:18 PDT)
- 🩸 cael-dgx: ✅ on 2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427 (restarted 08:15:29)
- 🌊 ronan-dgx: ✅ on 2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427 (restarted 08:07:03, byte-confirmed)
- 🌫 silas-lothric / 🌻 elliott-legion / 🕯 emeric-nuc / 🪨 rune-rog-ally: pending frond-scribe fan-out (some still on 9d07233, one commit behind)
