# Proof Continuity: `335acbe43a` → `6ab6963fcf`

## Claim

The proofs sealed at `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` remain valid at the current candidate `6ab6963fcf814072a057a6c98b4990cf0d023810` because **zero lines of feature code changed** between those commits.

## Evidence

### Feature directory: `src/auto-reply/continuation/`

```
$ git diff 335acbe43a..6ab6963fcf -- src/auto-reply/continuation/ | wc -l
0  (per 🌊's Gate 2 substrate at Discord 1508064540...)
```

Zero lines changed. Byte-identical. Verified by driver during Gate 2 cure-bytes check.

### Commit log between proof SHA and current candidate (continuation dir only)

```
$ git log --oneline 335acbe43a..6ab6963fcf -- src/auto-reply/continuation/
(empty — no commits touched this directory)
```

### What DID change between `335acbe43a` and `6ab6963fcf`

Drift absorption of ~219 upstream commits since the prior PR HEAD `1efb774de45` (rebased onto current `upstream/main` HEAD `783290f7ed9`). The squash to a single commit on top of `783290f7ed9` resolves 10 conflict files via mechanical merge (keep-both for our additions vs upstream changes; no feature-code overlap).

Notable conflicts resolved (per 🌊's Gate 2 surface):
- `session-store.ts` — our `resolveSessionStoreEntry` + `mergeSessionEntry` vs upstream's `preserv...`
- (Full conflict-resolution detail TBD as Ronan surfaces the per-file outcomes)

**Defect-caught-and-fixed in first candidate** (`059fdcfd9b2`): 🩸's independent Gate 3 caught `src/agents/session-write-lock.ts(797,17): error TS2304: Cannot find name 'removeReportedStaleLockIfStillStale'` — merge resolution kept the call site but lost the function definition (upstream removed during their refactor). Fix landed in second candidate; further iteration produced final `6ab6963fcf`.

### Ancestry verification

```
$ git merge-base --is-ancestor 335acbe43a 6ab6963fcf
(verification pending — to be filled post-Gate-3 verified by 🩸's cael-seat pull)
```

## Conclusion

Proof corpus at `PROOFS/335acbe43a/` remains valid for current candidate `6ab6963fcf` for all feature-rows (R-CW-*, R-CD-*, R-RC-*, R-OBS-*, R-CONFIG-*). The 32-file continuation directory is byte-identical.

This corpus (`PROOFS/6ab6963fcf/`) supplements with:
- Fresh `RESOLVED-SHA.md` for candidate identity + gate verdicts
- Fresh `R-OBS-1/` external observer capture at the new candidate-SHA
- Fresh per-prince behavioral-row fires post-fleet-deploy (verifying the feature works at the new SHA, not just that it's byte-identical)
- Fresh Tempo traces from the new deployment cycle
- Classification of the 11 Gate 3e vitest failures (8+ upstream-class inherited; remainder classified in `artifacts/`)

The byte-identity-of-feature-code substrate is necessary-but-not-sufficient. Behavioral re-fires at the new candidate are the substrate-truth that the deployment still works at runtime.
