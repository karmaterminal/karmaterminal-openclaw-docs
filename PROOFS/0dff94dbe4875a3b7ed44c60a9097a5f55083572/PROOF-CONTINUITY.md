# PROOF-CONTINUITY — `0dff94dbe4875a3b7ed44c60a9097a5f55083572`

**This SHA does not chain to prior SHAs.**

PR #85651 ships as single-parent squash on `upstream/main` HEAD at force-push time. Each cure-cycle is an independent squash with no git-ancestry to the prior cycle's candidate.

```
$ git merge-base --is-ancestor 335acbe43a 0dff94dbe48
exit 1   # NOT an ancestor — expected, by shape
```

`0dff94dbe48` parent: `483d7be6c40` (upstream/main HEAD at 2026-05-24T17:46:26Z force-push).
Prior proof-SHA `335acbe43a` had its own different upstream-snapshot parent.

## Substantive substrate

The substrate-claim that lands is the per-row evidence in this corpus, not a chain to prior cycles:

- Per-row proof matrix: [README.md](./README.md)
- Candidate identity + gate verdicts + cure-cycle context: [RESOLVED-SHA.md](./RESOLVED-SHA.md)
- Reviewer brief + cohort attribution: [BRIEF.md](./BRIEF.md) + [METHOD.md](./METHOD.md)

## Feature-surface byte-identity (informational, not continuity-claim)

Feature surface at `src/auto-reply/continuation/` happens to be byte-identical to prior proof-SHA `335acbe43a`:

```
$ git diff 335acbe43a..0dff94dbe48 -- src/auto-reply/continuation/
# empty diff
```

Byte-identity across independent squashes is happens-to-match, not a continuity chain. The per-row behavioral evidence in this corpus is what proves the feature works on `0dff94dbe48`.
