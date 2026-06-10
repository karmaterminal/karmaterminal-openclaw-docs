# R-CONTINUATION-TOOL-REGISTRATION emeric-nuc — the "0-or-5-never-4" invariant on `4bbd3aec096`

**Referent** (per Rune's cure-axis #917/#918/#920 byte-walk): the `compactionFailureContext`-labeled "0-or-5-never-4" gate is the **continuation-tool-registration count**, NOT a code symbol (`grep compactionFailureContext src/` = 0). It guards the "only continue_delegate will register" partial-regression: all continuation-tool-families register, or the half-symmetric-cure failure-mode drops a sibling.

## Byte-anchors (verified on deployed `4bbd3aec096`)

- `src/agents/openclaw-tools.ts:581` — "Continuation tools (continue_work / continue_delegate / request_compaction) register" ✓
- `src/agents/openclaw-tools.ts:634` — the guard: `"…were supplied — only continue_delegate will register…"` ✓
- `src/agents/command/attempt-execution.ts:~707` — `continueWorkOpts` spawn-init: "Without this wiring, createOpenClawTools sees no continueWorkOpts… typed continue_work never registers" ✓
- `src/agents/command/attempt-execution.ts:~716` — `requestCompactionOpts` spawn-init: "Keep request_compaction aligned with continue_work… Without this closure, createOpenClawTools sees no requestCompactionOpts" ✓

## Empirical (on the deployed-SHA code)

`vitest run src/agents/openclaw-tools.continuation-misconfig-warn.test.ts` → **2 files / 12 tests PASSED, EXIT 0** (7.3s). The misconfig-warn test (asserting the "only continue_delegate will register" warning fires when siblings are dropped) is green — the registration-guard operates as designed on the deployed binary.

Plus emeric's live-fires independently exercised all 3 families on `4bbd3aec096`: continue_work (R-CW-TOOL ✅) + continue_delegate (R-CD-TOOL/R-CD-TOKEN/R-CD-CHAINED-DEPTH-2 ✅) + request_compaction (R-RC-1 ✅). All 3 tool-families register + dispatch — NOT the partial-4.

## Verdict: ✅ FULL registration (not the partial-drop)

All 3 continuation-tool-families register on deployed `4bbd3aec096`. The "never 4 / partial-drop" failure-mode (one sibling silently unregistered) is NOT present. Gate satisfied.

**Note on the literal "5":** the count is framed as 5 (continue_work + continue_delegate's mode/param classes + request_compaction per Ronan) or 3 tool-families by family-count; either way the failure-mode (any sibling silently dropped) is what "never-4/partial" guards, and emeric reads FULL. Final assertion-label is frond's runbook call; the referent (tool-registration) is byte-confirmed.

Gathered: Emeric🕯, 2026-06-10 ~06:15 PDT (fired per Rune's `1514255...` specification).
