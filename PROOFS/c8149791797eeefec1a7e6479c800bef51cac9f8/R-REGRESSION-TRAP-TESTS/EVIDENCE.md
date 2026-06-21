# R-REGRESSION-TRAP-TESTS — sister-trap-tests lock the half-symmetric-cure-class going-forward (deployed token-fixed ship SHA)

**Owner:** 🕯 Emeric · **Seat:** emeric-nuc · **Ship SHA:** `c8149791797eeefec1a7e6479c800bef51cac9f8`
**Verdict:** ✅ **PASS** — the sibling-parity trap-tests + cross-layer drift-catch sentinels are landed and GREEN (42/42) on the deployed token-fixed head, locking the exact "cure-ships-for-one-tool-but-not-its-sibling" class going-forward.

## What this proves
The half-symmetric-cure-class (figs's 2026-06-03 framing: "its frightening how we keep losing things" — a cure ships for one tool but not the sibling tool sharing the same plumbing) is now **trap-tested at the byte** on the deployed token-fixed ship SHA `c814979`. The trap-tests assert the sibling-surfaces stay covered in parallel, so a future half-symmetric regression reds CI instead of escaping (the way #952's token-form escaped a week of proofs).

## The sibling-parity invariant (the heart of the row)
`continue_work` / `continue_delegate` / `request_compaction` each have TWO independent entry surfaces (tool + token/bracket), and the spawn-init / turn-1 path forwards a closure per tool (`continueWorkOpts` / `requestCompactionOpts`). The trap-tests pin BOTH siblings + the BOTH-FORMS surfaces:
- **`continueWorkOpts` cure** (the #746 Layer-2 spawn-init plumbing) — forwarded on turn-1.
- **`requestCompactionOpts` sibling** — "The sibling continueWorkOpts closure already uses the same spawn-init path" → pinned in parallel (so the cure can't ship for one and miss the other).
- **#952 token-form parity** — "bare CONTINUE_WORK:N token arms a durable wake and re-drives the SAME subagent (hop-2 executes)" — the exact token-form surface #952 broke on, now trap-tested.

## The drift-catch sentinels (explicit cross-surface locks, GREEN on c814979)
- ✅ "spawn-init continuation tool plumbing parity > **documents both sibling spawn-init continuation tool sites (sentinel only)**"
- ✅ "#746 cross-layer drift-catch sentinel > **documents both Layer 1 + Layer 2 cure sites for #746 (sentinel only)**"
- ✅ "does NOT tag the spawn-init continue_work flow with parentRunId (own-turn has no spawn lineage; #952/#990 reap guard)" — the reap-guard trap
- ✅ "does not strip bracket continue_delegate markers while peeking for spawn-init continue_work" — the bracket-vs-tool cross-contamination trap

## Behavioral byte (deployed c814979)
The three sister-trap-test files — `attempt-execution.continue-work-opts.test.ts`, `attempt-execution.request-compaction-opts.test.ts`, `attempt-execution.continue-work-token.test.ts` — **42/42 passed** on the deployed token-fixed head (6 test-file-entries via the agents-core/agents-support project split). See `trap-tests-c814979.txt`.

## Files
- `trap-tests-c814979.txt` — the 42/42 green run on the deployed head
- `sibling-parity-sentinels-c814979.txt` — the sibling-parity rationale + Layer-2 cure-pin headers, verbatim from c814979 source

## Note
Regression-trap-tests is a test-suite-coverage row (it asserts trap-tests EXIST + pass; no live continuation-tool fire from this row) — no Tempo trace per the runbook's "EACH continuation-tool fire" scope. The BOTH-FORMS mandate IS reflected in the covered surfaces (tool `continueWorkOpts` + token `CONTINUE_WORK:N`). Behavioral + source byte on the deployed token-fixed ship SHA `c814979`.
