# R-REGRESSION-TRAP-TESTS — Continuation cure-PR sister-trap enumeration

> **Row:** `R-REGRESSION-TRAP-TESTS` · **owner:** emeric 🕯 · **forms:** `ci` · **issue:** [#120](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/120) · **family:** regression-lock
>
> **Behavior (pipeline.xml):** "Sister-trap-tests lock in each cure going forward."
> **Evidence (pipeline.xml):** "Enumeration of trap-tests by cure-PR; current PASS/FAIL status on deployed SHA."

## What this row is

The continuation marathon fixed a cluster of nested-re-entry / scheduling regressions (the `#952` family). Each cure landed with **sister-trap-tests** — unit tests that assert the *specific* broken behavior is now correct, so a future refactor that re-breaks it trips the trap in CI rather than silently regressing in the field.

This is a **`ci`-form** proof row, not a k6 live-fire row: the evidence is the *existence + green status of the locked-in trap-tests on the deployed SHA*, not a gateway-fire receipt. It is the regression-safety backstop for the whole continuation feature.

## Deployed SHA under test

`82827d3cbcba92ff6e19863b30615db028c2651c` (openclaw source at `/home/figs/flesh_beast_tmp/openclaw`, "Merge upstream/main f66e83154b (drift re-absorb #9)").

> **SHA-topology note (2026-06-24, byte-confirmed):** `82827d3cbc` is the **head of PR #85651** on `openclaw/openclaw` (`feat(continuation): context-pressure-aware continuation`, ref `frond-scribe-claude/20260509/narrow-surgery-tight`, base `main`, **OPEN/unmerged**). That branch is **what the fleet deploys from**, where the PROOFS corpus is pinned, and where the `CONTINUE_WORK` parser + `src/auto-reply/continuation/` subsystem live. These `ci`-form trap-tests are pinned to it **correctly** — it is the deployed / corpus / feature-branch SHA, not a stale artifact. **Do not** expect these test paths on `karmaterminal/openclaw` `main` HEAD: `main` (`5eec2158…`) is a *pristine upstream mirror* that correctly does **not** carry the continuation code (PR #85651 has not landed upstream yet) — `status: diverged` is expected (the feature branch has continuation `main` doesn't; `main` has ~315 upstream commits the branch doesn't). The "main lost the fix" reading is a false alarm: `main` never gained it; it lives on PR #85651 until that lands. **Re-verify against the deployed / PR-#85651-head SHA, not `main`.**

## Trap-test registry (by cure-PR)

Every file below is **PRESENT on the deployed SHA** (byte-confirmed `git ls-tree` + file-stat).

### #952 → #1045 (orphan-reap of self-driving same-session continue_work)
The marathon's core regression: `continue_work` nested in a `continue_delegate` subagent didn't chain past hop-1, root-caused to orphan-reaping a confident-terminal own-turn wake.

- `src/agents/command/attempt-execution.continue-work-token.test.ts` — `describe("#952 subagent CONTINUE_WORK token self-continuation (token-form parity)")` — a tool-less / light-context subagent emitting the **bare** `CONTINUE_WORK` token drives hop-2 (2 it-blocks).
- `src/agents/subagent-announce.self-continuation.test.ts` — `describe("#952 subagent self-continuation via announce/completion flow")` — a completing subagent whose final findings carry a bare `CONTINUE_WORK` drives a successor turn (4 it-blocks).
- `src/agents/command/attempt-execution.continue-work-opts.test.ts:497` — `it("does NOT tag the spawn-init continue_work flow with parentRunId (own-turn has no spawn lineage; #952/#990 reap guard)")` — pins the own-turn flow onto the `#990` never-reap (`parentRunId==null` same-session) path so the `#952` reap can't fire.

### #1057 → #1063 (subagent continue_work wouldn't drive on a busy main seat)
Sibling fix: a subagent's elected continuation got blocked by a wrong-lane busy-gate when the *main* seat was busy.

- `src/auto-reply/continuation/work-dispatch.test.ts:579` — `it("drives a subagent continuation to completion on its own session lane when main is busy (#1057)")`.

### #1075 (delaySeconds:0 immediate-sentinel)
A real `0` delay is the IMMEDIATE sentinel and must pass through unchanged (not be coerced to the default delay).

- `src/agents/tools/continue-work-tool.boundary.test.ts:195` — `it("preserves delaySeconds = 0 as immediate (#1075)")` (+ the clamp-positive-delays contract, 4 it-blocks in file).
- `src/auto-reply/continuation/config.test.ts:229` — `it("treats an explicit zero as the immediate sentinel → 0, NOT defaultDelayMs (#918 + #1075)")`.

### #990 (busy-retry-loop hardening — OPEN, hardening tests already landed)
`#990` is still open (ongoing hardening), but its Pillar-0 trap-tests are already in the deployed suite, locking the busy-skip backoff / never-drop / dedup contracts:

- `src/auto-reply/continuation/work-dispatch.test.ts:980` — `backs off exponentially on consecutive busy-skip re-arms instead of a flat 1s (#990 Pillar-0)`.
- `:1021` — `never increments retryCount or drops the flow across many busy-skips (rate-cap-forever, #952 never-penalize)`.
- `:1052` — `resets busySkipCount to 0 and delivers once a busy-deferred flow finally drives (#990 Pillar-0 + #952-preserve)`.
- `:1092` — `does not re-consume a cancel-requested continuation work flow (:259 dedup harden, #990 Pillar-0)`.
- `:1151` — `does not count a delivered-marked-but-still-running flow as live work (#990 P2 / #996)`.
- `:1182` — `describe("#990 bucket-1 parent-lineage reap (design-pass §5)")`.
- `src/auto-reply/continuation/config.test.ts:137,147,165` — busySkipBackoff defaults/clamp + `orphanReapStaleCutoffMs` resolution (#990).

## Current status on deployed SHA

**Targeted verification run (2026-06-23 22:57 PDT):** `#952` token-parity + `#1075` boundary trap-tests — **12 passed / 12 (4 test files), 0 fail** on `82827d3cbc` (vitest 4.1.8, `--no-opt`, 23.9s). The remaining registry files (subagent-announce, work-dispatch, config) verify with the same Verification command.

| cure | trap-test files | present on `82827d3cbc` | status |
|---|---|---|---|
| #952→#1045 | continue-work-token (✅ run, green), subagent-announce.self-continuation, continue-work-opts:497 | ✅ | token-parity GREEN; rest present, same-cmd verify |
| #1057→#1063 | work-dispatch:579 | ✅ | present, same-cmd verify |
| #1075 | continue-work-tool.boundary:195 (✅ run, green), config:229 | ✅ | boundary GREEN |
| #990 (open) | work-dispatch (6 blocks), config (3 blocks) | ✅ | present, same-cmd verify |

> Verified subset = 12/12 green (token + boundary). The full continuation set is large (work-dispatch alone = 56 it-blocks); the targeted command runs the whole registry when a complete sweep is wanted — kept bounded here per the no-burn-while-idle posture.

## Verification (how to run)

Targeted run on the deployed tree (low-burn, just the trap-test files):

```bash
cd /home/figs/flesh_beast_tmp/openclaw
# NOTE: this seat (i7-12700H, alder-lake) needs --no-opt to avoid V8 maglev SIGILL on heavy JIT.
NODE_OPTIONS="" node --no-opt node_modules/.bin/vitest run \
  src/agents/command/attempt-execution.continue-work-token.test.ts \
  src/agents/subagent-announce.self-continuation.test.ts \
  src/agents/command/attempt-execution.continue-work-opts.test.ts \
  src/agents/tools/continue-work-tool.boundary.test.ts \
  src/auto-reply/continuation/work-dispatch.test.ts \
  src/auto-reply/continuation/config.test.ts \
  --reporter=dot
```

Full continuation regression sweep = the `src/auto-reply/continuation/` + `src/agents/.../continue-work*` test set.

## Fresh-user-test feedback for the pipeline (k6-proofs-pipeline.xml)

Building this row as a fresh user surfaced plumbing gaps in the pipeline's flow for a **`ci`-form** row (vs the k6 live-fire rows it's built around):

1. **The 4-step Pipeline (`preflight → fire-row → evidence-capture → commit`) assumes a k6 `./run-proof.sh r-{row}` live-fire.** A `ci`-form row has no gateway-fire — its "fire" is `vitest run <trap-tests>` and its "evidence" is suite PASS/FAIL, not a Tempo trace + summary.json. The pipeline should branch on `forms="ci"`: substitute a `Verify` step (vitest) for `fire-row` + `evidence-capture`.
2. **Evidence destination is ambiguous for a `ci` row.** k6 rows land `PROOFS/{SHA}/R-{ROW}/EVIDENCE.md`. A `ci` row's SHA is the *openclaw source* deployed SHA (`82827d3cbc`), not a harness/candidate SHA — different SHA namespace than the k6 corpus anchor. Pipeline should say which SHA a `ci` row keys on.
3. **No manifest schema fit.** `tools/k6-proofs/row-manifest.schema.json` (`transport`/`toolSurface`/`expectedReceipts`) describes a gateway-fire; a `ci` row has none of those. Either a `ci`-row manifest variant or an explicit "ci rows are manifest-exempt, doc-only" note.
4. **Dual-tree ambiguity** (`tools/k6-proofs/` harness vs `k6-proofs/` newer): a fresh user doesn't know which tree a new row's artifacts belong in. The pipeline's `<Infrastructure>` points at `k6-proofs/`; the schema + manifests live in `tools/k6-proofs/`. One canonical tree (or an explicit map) would remove the guess.

— 🕯 emeric, fresh-user-test of `k6-proofs/k6-proofs-pipeline.xml` for #120
