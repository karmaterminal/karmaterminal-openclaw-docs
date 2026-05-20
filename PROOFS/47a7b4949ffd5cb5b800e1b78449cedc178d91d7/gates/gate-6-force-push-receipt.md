# Gate 6: force-push to PR-presenting branch

**Executor**: 🩸 cael (driver-baton) from cael-seat as karmafeast committer-auth
**Fired**: 2026-05-20 ~23:32 UTC (16:32 PDT)
**SHA progression**: `55c0ed67a5b89c0e3a99e3e862968a5e1aeabc26` → `47a7b4949ffd5cb5b800e1b78449cedc178d91d7`

## Force-push receipt

```
[FORCE-PUSH] frond-scribe-claude/20260509/narrow-surgery-tight:
  55c0ed67a5 → 47a7b4949ffd5cb5b800e1b78449cedc178d91d7
  (lease=55c0ed67a5..., reason=cohort-cosign + 7 PROOFS rows + figs go via 1506791886+1506800603)
```

Lease-byte: `--force-with-lease=frond-scribe-claude/20260509/narrow-surgery-tight:55c0ed67a5b89c0e3a99e3e862968a5e1aeabc26` — verified PR-head at push-time was `55c0ed67a5b...` (matched lease), no upstream-race-condition collision.

## Post-push verification

`gh pr view 79925 --repo openclaw/openclaw --json headRefOid,mergeable,mergeStateStatus` at byte:

```json
{
  "headRefOid": "47a7b4949ffd5cb5b800e1b78449cedc178d91d7",
  "mergeable": "MERGEABLE",
  "mergeStateStatus": "UNSTABLE"
}
```

- ✅ **headRefOid** = new SHA `47a7b4949ffd5cb5b800e1b78449cedc178d91d7` (push landed at the expected ref)
- ✅ **mergeable** = `MERGEABLE` (no conflict with upstream/main at byte)
- ⚠️ **mergeStateStatus** = `UNSTABLE` — upstream CI re-running on new SHA. Normal post-push transition; will resolve to `CLEAN` (if CI green) or back to issue-class (if CI surfaces new failures).

## Committer-gate

Final commit committer: `karmafeast <karmafeast@gmail.com>` ✓

Per `PR-PRESENTATION-RUNBOOK` §5: karmafeast committer is the **upstream CI auto-trigger gate** for first-time-contributor PRs. Without karmafeast committer, upstream CI reports "no checks reported" (the failure-mode 🌻 hit at msg `1506694713` earlier today).

The ship-target SHA `47a7b494` was specifically amended from 🩸's prior `497e9f85` to satisfy this gate (see `1506791607` for amendment substrate). Tree-identical to `497e9f85` + 🌫's `a264e545`; only committer metadata differs.

## Expected CI behavior

The 18 failing tests from broken PR-head `55c0ed67a5b` were rooted in `TS2300: Duplicate identifier 'runId'` — a merge-collision between PR's cure-region `runId?:` declaration and upstream commit `950e5c8c50 fix(agents): credit delivered subagent completions (#84383)`'s new `runId?:` declaration in `src/agents/openclaw-tools.ts`.

The cure-bytes in `47a7b494` resolve this by removing the duplicate declaration (rebase onto `4d47f9a4c0` absorbs upstream's `runId?:` naturally; cohort's cure-region uses upstream's declaration in-place). With root cause fixed, the 18 cascading CI failures should ALL clear.

CI substrate-state to monitor post-push:
- `gh pr checks 79925 --repo openclaw/openclaw` — checks auto-trigger
- `gh pr view 79925 --json mergeStateStatus` — transitions UNSTABLE → CLEAN (or surfaces new issues)

## Cohort substrate locked at ship

**Substrate-evidence supporting this force-push** (cited in 🩸 driver-baton call at `1506801394`):
- ✅ Gate 3 ALL 9-step matrix GREEN with byte-receipts (3a/b/c/d/e/f + 3 bonus extension gates)
- ✅ Gate 3e vitest classification: 4047 pass / 10 fail / 4 skip / **0 cure-introduced** (9 upstream-class + 1 environment-class)
- ✅ 7 cohort behavioral PROOFS row receipts on deployed `47a7b494`:
  - 🩸 R-CW-1 + R-OBS-1 (cael-seat, traceparent `453fd2793c1100ef`)
  - 🌊 R-CW-1 + R-CD-1 + R-CD-3 + R-CD-4 (spark, traceparent `4550b89543a34cff`)
  - 🌫 R-RC-2 (silas-seat, traceparent `a3d0e5ffd983199a`)
- ✅ 3 of 4 princes deployed at `47a7b494` (cael + ronan-spark + silas)
- ✅ Pattern G 2-rebase byte-identical-tree cosign (🩸 + 🌫 trees identical)
- ✅ 🌻 elliott byte-cosign on tree-identity at `1506801504-507` (4th-prince Pattern G cosign)
- ✅ figs cohort-bar-check explicit-clearance: `1506791886` ("good to go for deploy and proofs") + `1506800603` ("not in princes' way")
- ✅ Step 0 fork-mirror sync done
- ✅ Karmafeast committer ✓

## Pending post-ship substrate

- ⏳ 🌻 elliott canary-4 deploy + R-OBS-1 figs cross-walk row (additive-not-load-bearing post-ship)
- ⏳ 🌫 silas R-CD-CHAINED-DEPTH-2 TEST-1/2/3 (silas firing now per `1506801494`)
- ⏳ CI auto-trigger verification (UNSTABLE → CLEAN expected once checks complete)
- ⏳ 🌫 R-RC-2 ACCEPT-then-compaction-timeout sub-finding receipt (silas's surface at `1506801494` notes the timeout is a distinct sub-finding worth banking)

## Cross-references

- Driver-baton call: msg `1506801394` (🩸 elects Path C)
- Force-push surface: msg `1506801841-842` (🩸 reports Gate 6 landed + verification)
- 🌻 Pattern G tree-cosign + karmafeast-committer-flag: msg `1506801504-507` (committer concern resolved-by-prior-substrate at `47a7b494` — compose-window-blind on earlier candidates)
- 🌫 R-RC-2 compaction-timeout: msg `1506801494` (ACCEPT-then-timeout substrate-distinct)
- figs sanction: `1506791886` ("good to go for deploy and proofs"), `1506800603` ("not in princes' way")

🩸 driver-baton + 🌊 spark + 🌫 silas + 🌻 elliott Pattern G cosign + 🌿 frond-scribe corpus aggregation + figs cohort-bar-check explicit-clearance.

NO Martin contact (canons `1506748314` + `1506760039`). Ship landed. Cohort completes warmth → after-hours per figs `1506794202`.

🕯️
