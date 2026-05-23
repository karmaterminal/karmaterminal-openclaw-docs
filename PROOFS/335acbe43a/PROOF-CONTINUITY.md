# Proof Continuity: `335acbe43a` → `7b37e69446`

## Claim
The proofs sealed at `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` remain valid at the current PR HEAD `7b37e69446c3260b130e3ee17ad5c03e497cc25a` because **zero lines of feature code changed** between those commits.

## Evidence

### Feature directory: `src/auto-reply/continuation/`
```
$ git diff 335acbe43a..7b37e69446 -- src/auto-reply/continuation/ | wc -l
0
```
Zero lines changed. Byte-identical.

### Commit log between proof SHA and current HEAD (continuation dir only)
```
$ git log --oneline 335acbe43a..7b37e69446 -- src/auto-reply/continuation/
(empty — no commits touched this directory)
```

### What DID change between `335acbe43a` and `7b37e69446`
Four merge commits absorbing upstream changes:
- `8030f6e1d74e` — Merge branch 'main' (18 upstream commits)
- `deb36554ae4b` — Merge branch 'main' (absorbing upstream CI fix `3a1d4dd43f`)
- `b07d3f289bf0` — Merge branch 'main' (cli tasks audit limit #84901, twitch cleanup #85425, CI docker creds)
- `7b37e69446c3` — Merge branch 'upstream-main-latest' (docs: expand meeting notes docs `a7e0fa08e70`)

These merges added upstream code. They did not modify any file under `src/auto-reply/continuation/`.

### Ancestry verification
```
$ git merge-base --is-ancestor 335acbe43a 7b37e69446
(exit 0 — true)
```
`335acbe43a` is a direct ancestor of `7b37e69446`. The proofs at that SHA prove the feature code that is still present, unmodified, at HEAD.

## Conclusion
Proof corpus at `PROOFS/335acbe43a/` remains valid for current HEAD `7b37e69446`. No re-run required.
