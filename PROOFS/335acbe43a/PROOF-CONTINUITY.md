# Proof Continuity: `335acbe43a` → `deb36554ae`

## Claim
The proofs sealed at `335acbe43a354486e74c684aaa2e2fe14e9aa8c6` remain valid at the current PR HEAD `deb36554ae4b0b495836cabc532c8e3bb772eb9c` because **zero lines of feature code changed** between those commits.

## Evidence

### Feature directory: `src/auto-reply/continuation/`
```
$ git diff 335acbe43a..deb36554ae -- src/auto-reply/continuation/ | wc -l
0
```
Zero lines changed. Byte-identical.

### Commit log between proof SHA and current HEAD (continuation dir only)
```
$ git log --oneline 335acbe43a..deb36554ae -- src/auto-reply/continuation/
(empty — no commits touched this directory)
```

### What DID change between `335acbe43a` and `deb36554ae`
Two GitHub "Update Branch" merge commits absorbing upstream changes:
- `8030f6e1d74e` — Merge branch 'main' (18 upstream commits)
- `deb36554ae4b` — Merge branch 'main' (absorbing upstream CI fix `3a1d4dd43f`)

These merges added upstream code (meeting-notes plugin, docs sweep, CI fixes). They did not modify any file under `src/auto-reply/continuation/`.

### Ancestry verification
```
$ git merge-base --is-ancestor 335acbe43a deb36554ae
(exit 0 — true)
```
`335acbe43a` is a direct ancestor of `deb36554ae`. The proofs at that SHA prove the feature code that is still present, unmodified, at HEAD.

## Conclusion
Proof corpus at `PROOFS/335acbe43a/` remains valid for current HEAD. No re-run required.
