# Gate 4.5 — Pre-Readiness Review for PR #85651 force-push

**Candidate SHA:** `9d07233faa29a300e6857bc11ece4eb26a77b08d`
**Branch:** `emeric/20260604/restore-pure-format-v3`
**Reviewer:** cael (claude-opus-4.7-1m-internal)
**Date:** 2026-06-04 12:09 PDT
**Lineage:** `daa0e92f` + 1 commit (46-file pure-format-only restore to merge-base bytes)

---

## VERDICT: ✅ READY-FOR-PUSH

All four check categories pass. No semantic drift detected in the 46-file restore. All pre-cured plumbing from earlier gates is intact on the substrate. Cure-targeted vitest set is fully green (99/99 tests).

Recommend proceeding with the force-push to the PR #85651 presentation branch.

---

## 1. 46-file pure-format-only spot-check (oxfmt-normalized)

Methodology: for each file in `git diff --name-only daa0e92f..9d07233faa`, hash the oxfmt-normalized `daa0e92f` blob and the oxfmt-normalized `9d07233faa` blob. Equality = zero semantic delta after format normalization.

**Coverage:** all 46/46 changed files (exhaustive, not sampled).

| Result | Count |
|---|---|
| ✓ MATCH (pure-format-only) | **46** |
| ✗ MISMATCH (semantic drift) | **0** |

Two independent randomized spot-check passes also run (10-file `shuf` + 7-file `shuf` from task spec) — both 100% MATCH, consistent with exhaustive result.

**Sample run output (7-file randomized):**
```
✓ test/scripts/check-docs-mdx.test.ts
✓ extensions/google/provider-policy.ts
✓ extensions/discord/src/voice/receive-recovery.ts
✓ src/agents/bash-tools.exec-gateway-approval.e2e.test.ts
✓ scripts/e2e/lib/plugin-lifecycle-matrix/measure.mjs
✓ src/plugin-sdk/agent-harness-runtime.ts
✓ src/agents/tools/nodes-tool-commands.ts
```

---

## 2. Cure-files intact verification (substrate carryover from `daa0e92f`)

| File | Cure | Verified |
|---|---|---|
| `src/agents/command/attempt-execution.ts` | `continueWorkOpts` (#746) + `requestCompactionOpts` (#917) spawn-init plumbing | ✅ Lines 656–698 + threading at 868–869 |
| `src/infra/system-events.ts` | sanitize-untrusted at enqueue boundary (`sanitizeInboundSystemTags`) | ✅ Import line 10, gated call line 153 |
| `src/auto-reply/continuation/state.ts` | `chainId` persist | ✅ Lines 166, 180, 196–197 |
| `src/auto-reply/reply/followup-runner.ts` | delay-clamp via canonical `clampDelayMs` helper | ✅ Lines 1185, 1214 |
| `extensions/codex/harness.ts` | all-token match | ✅ Line 58 `tokens.every((token) => providerIds.has(token))` |
| `src/channels/plugins/contracts/test-helpers/bundled-channel-plugin-loader.ts` | byte-identical to upstream/main | ✅ sha256 `66042b72af23e3690110b0b922a7ac8870dd2673eba5a2a2de049d7f65e4e014` (exact match to expected) |

---

## 3. Cure-targeted vitest set

Command:
```bash
pnpm exec vitest run \
  src/agents/command/attempt-execution.request-compaction-opts.test.ts \
  src/auto-reply/continuation/config.test.ts \
  src/auto-reply/continuation/state.test.ts \
  extensions/codex/harness.test.ts \
  src/infra/system-events.test.ts
```

Note: tests are colocated under `src/`, not `test/src/`, in this repo layout (corrected from task spec).

**Result:**
```
 ✓  agents-core     attempt-execution.request-compaction-opts.test.ts (6 tests)  22ms
 ✓  agents-support  attempt-execution.request-compaction-opts.test.ts (6 tests)  23ms
 ✓  auto-reply      continuation/config.test.ts                       (14 tests) 62ms
 ✓  auto-reply      continuation/state.test.ts                        (14 tests) 64ms
 ✓  extension-codex extensions/codex/harness.test.ts                  (8 tests)  48ms
 ✓  infra           system-events.test.ts                             (51 tests) 86ms

 Test Files  6 passed (6)
      Tests  99 passed (99)
   Duration  11.56s
```

All 99 tests across 6 files pass. Note `attempt-execution.request-compaction-opts.test.ts` runs in both `agents-core` and `agents-support` vitest projects (12 total invocations, 99 unique reported).

---

## 4. PR file-count reduction confirmation

Per cohort metadata: PR file-count vs merge-base `6d5061c234bde957b15b408114cff6311d74dd23` reduced **340 → 294 (-46, -13.5%)**. The 46-file delta exactly matches `git diff --name-only daa0e92f..9d07233faa | wc -l = 46`. Restore math is consistent.

---

## Surface notes (none blocking)

- Spec said `test/src/...` paths; actual layout is `src/...` colocated. No actual missing tests — just path correction.
- `gate-out/` untracked dir present in working tree (harmless, doesn't affect HEAD).
- All oxfmt normalization performed via the repo's pinned `pnpm exec oxfmt` (no toolchain drift introduced by reviewer).

---

**Reviewer signature:** cael-opus-4.7 (subagent depth 1, session `83447256-e3af-405d-9ac9-f7af0db07c51`)
**Recommendation:** **READY-FOR-PUSH** — proceed with force-push to upstream PR #85651.
