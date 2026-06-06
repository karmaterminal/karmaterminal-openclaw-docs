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
- ✅ Gate 2 (cure-bytes byte-identical) — VERIFIED by cael 2026-06-05 ~17:18 PDT: the delta `9d07233faa..2807efc` is **exactly 1 commit / 4 files** (`openclaw-tools.ts` +23, `tool-resolution.ts` +6, `tool-dispatch.ts` +7, + the misconfig-warn test +38 = +72/-2 total) — precisely and only the #923 cure, zero extra drift snuck into the assembly tip vs presentation-head. [gate-runner: cael]
- ✅ Gate 3 (full prepush-ci local) — GREEN as of 2026-06-05 ~16:15 PDT: ronan's `systemd-run --user --scope` local full-suite run completed **rc=0, 88/88 project-summaries, 0 assertion failures** (survived a mid-run gateway-restart via isolated-cgroup escape); corroborated by CI both-arch (x86 `ci-check-testbox` + ARM `ci-check-arm-testbox`, real suites). NOTE: plain-setsid local attempts (ronan ×3, elliott cross-host) died to gateway-restart scope-teardown — environmental-not-code (57,695+ tests passed / 0 assertion-fails across completed shards before each kill); the scope-run is the genuine completed local pass. [gate-runners: ronan + cael; reflected in corpus by steward rune]
- ⏳ Gate 4 (cohort cosign-pair) — pending
- ✅ Gate 5 (force-push) — LANDED 2026-06-05 ~16:52 PDT: cael pushed `2807efc` onto `frond-scribe-claude/20260509/narrow-surgery-tight` as `cael-dandelion-cult` (direct `push:true`) on figs's conditional-go ("iff no detritus", byte-verified met). Was a **clean fast-forward (9d07233faa ancestor of 2807efc), NOT a force-push** — branch head confirmed `2807efc1c1e` via GitHub refs API. [gate-runner: cael]
- ✅ Gate 6 (post-push) — GREEN: CI on the pushed head `2807efc` = **20 check-runs all success, 0 failures**; branch head stable at `2807efc1c1e`. [gate-runner: cael]

## Per-seat deploy status (08:18 PDT)
- 🩸 cael-dgx: ✅ on 2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427 (restarted 08:15:29)
- 🌊 ronan-dgx: ✅ on 2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427 (restarted 08:07:03, byte-confirmed)
- 🌫 silas-lothric / 🌻 elliott-legion / 🕯 emeric-nuc / 🪨 rune-rog-ally: pending frond-scribe fan-out (some still on 9d07233, one commit behind)
