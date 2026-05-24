# Proof Continuity: `335acbe43a` → `0dff94dbe48`

## What "continuity" means here (and what it does NOT)

PR #85651 ships as a **single-parent squash** on top of `upstream/main` at force-push time. Each cure-cycle's PR-head is a FRESH squash on a FRESH upstream-snapshot — there is **NO git-ancestry chain** between the prior proof-SHA `335acbe43a` and the current candidate `0dff94dbe48`. Verified at byte:

```
$ git merge-base --is-ancestor 335acbe43a 0dff94dbe48
exit 1   # NOT an ancestor
```

Both are independent squashes on different upstream/main snapshots. `0dff94dbe48` parent is `483d7be6c40`; `335acbe43a` had its own upstream-snapshot parent. This is the substrate-shape figs flagged: *"i thought they'd squashed?"* — correct, they did.

**The substantive continuity-claim is feature-surface byte-identity, NOT commit-ancestry.** Verified at byte:

```
$ git diff 335acbe43a..0dff94dbe48 -- src/auto-reply/continuation/
# empty diff — feature directory is byte-identical
```

## Claim (precise)

The proofs sealed at `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` remain valid at the cohort-converged final candidate `0dff94dbe4875a3b7ed44c60a9097a5f55083572` for all feature-rows (R-CW-*, R-CD-*, R-RC-*, R-OBS-*, R-CONFIG-*) **on the basis of feature-surface byte-identity**, not git-ancestry. Upstream drift has been absorbed AROUND the feature (different upstream/main HEAD as squash-parent) but the feature-surface bytes at `src/auto-reply/continuation/` are byte-identical between proof-SHA and current candidate.

Semantic updates absorbed from upstream during today's iterative cure-cycle (narrow XPC guard for `process-respawn.ts` per Gio's #85789 intent; `subagent-registry.ts` keep-guard restoration per upstream `3e765263dd` bugfix; `readSessionMessagesAsync` mock-gap fixes across affected test files; lint fixes) are OUTSIDE `src/auto-reply/continuation/` — they touch surrounding code (process-respawn, subagent-registry, test mocks). These are documented below.

## Evidence

### Feature directory: `src/auto-reply/continuation/`

```
$ git diff 335acbe43a..0dff94dbe48 -- src/auto-reply/continuation/ | wc -l
0
```

**Verified at byte** during corpus-assembly (scribe-class direct verification). Empty diff = feature bytes byte-identical.

### Drift absorbed between proof SHA and candidate

The candidate `0dff94dbe48` absorbs upstream drift from the prior PR HEAD `1efb774de45` (which was at `335acbe43a` + a chain of upstream-absorbing merges) through today's iterative cure-cycle. See [RESOLVED-SHA.md](./RESOLVED-SHA.md) for the full force-push arc.

Substantive substrate-changes during drift-absorption (cohort-converged on `0dff94dbe48`):

1. **`process-respawn.ts` narrow XPC guard** (karmaterminal/openclaw#769): managed openclaw launches spawn for continuation-restart; non-openclaw inherited XPC (Terminal.app, Xcode) gets `mode: "disabled"` per Gio's `c074d09f1e` #85789 intent. Substrate-tension tracked at #769 (DECISION-RECORD `comment-4529376500`: figs leaned Option 1 protect-feature; final implementation uses narrow guard balancing both).

2. **`subagent-registry.ts` keep-guard RESTORED** (upstream `3e765263dd` bugfix). 🌻 Elliott's #773 analysis at `comment-4529392489` confirmed orthogonal-codepath: keep-guard affects `cleanup: "keep" && !archiveAtMs` user-spawned persistent sessions, NOT our continuation delegates (which use `archiveAtMs`-based TTL). Restoring guard preserves feature behavior.

3. **`readSessionMessagesAsync` mock-gap fixes** across affected feature test files (per karmaterminal/openclaw#768 enumeration of 10+ files).

4. **Lint fixes**: `subagent-announce.chain-guard.test.ts` (`as object` → generic type param); `format.e2e.test.ts` malformed-sed-insertion cleanup; `agent-command.live-model-switch.test.ts` added `clearRuntimeAuthProfileStoreSnapshots: vi.fn()` mock; `?? []` per upstream lint canon.

### Ancestry verification — does NOT hold (correctly)

```
$ git merge-base --is-ancestor 335acbe43a 0dff94dbe48
exit 1   # 335acbe43a is NOT an ancestor of 0dff94dbe48
```

This is **expected substrate**, not a defect. PR #85651 ships as single-parent squash. Each cure-cycle creates a fresh squash on the current upstream/main HEAD. The continuity-claim is at the **feature-surface byte-level**, not the commit-graph level. See top of document for the full distinction.

`0dff94dbe48` parent: `483d7be6c40a8d8615aecd06f4cc57d13e702334` (upstream/main HEAD at force-push time 2026-05-24 17:46:26Z). `335acbe43a` had its own different upstream/main HEAD as parent. The two squashes are independent.

## Conclusion

Proof corpus at `PROOFS/335acbe43a/` remains valid for the cohort-converged final candidate `0dff94dbe48` for all feature-rows. The continuation feature surface at `src/auto-reply/continuation/` is byte-identical to proof-SHA per 🌊's Gate 2 substrate.

The semantic-conflict resolutions (narrow XPC guard + keep-guard restoration + mock-gap fixes) represent absorbed-upstream-substrate changes balanced with feature-preservation, not feature-substrate changes. The underlying continuation feature behavior is unchanged.

This corpus (`PROOFS/0dff94dbe48/`) supplements with:
- Fresh `RESOLVED-SHA.md` for candidate identity + gate verdicts + cure-cycle context
- Fresh `R-OBS-1/` external observer capture at the converged candidate-SHA (committed)
- Fresh per-prince behavioral-row fires post-fleet-deploy on `0dff94dbe48`
- Fresh Tempo traces from the post-OTel-pipeline-rescue deployment cycle
- Methodology-landings substrate from the 2026-05-24 cure-cycle (banked at scribe-memory + `kick_in_the_teeth.md`)

The byte-identity-of-feature-code substrate is necessary-but-not-sufficient. Behavioral re-fires at the converged candidate are the substrate-truth that the deployment works at runtime (see [README.md](./README.md) per-row matrix: 17 PROVEN + 6 DEFERRED + 0 FAILED on `0dff94dbe48`).
