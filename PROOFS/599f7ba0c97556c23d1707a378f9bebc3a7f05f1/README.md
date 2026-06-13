# Provenance — PR-head `599f7ba0c9` is `5529aa4662` minus one design doc

**Purpose:** This corpus (`PROOFS/5529aa4662487226c9e76e687a8edb676b4e594a/`) was gathered
against assembly SHA `5529aa4662487226c9e76e687a8edb676b4e594a`. The PR-presentation branch
(`frond-scribe-claude/20260509/narrow-surgery-tight`, upstream PR
[openclaw/openclaw#85651](https://github.com/openclaw/openclaw/pull/85651)) advanced one
commit past that SHA to `599f7ba0c97556c23d1707a378f9bebc3a7f05f1`. This note documents — byte-verified —
that the two SHAs are **proof-equivalent**, so every row in this corpus holds for the PR head without
being re-gathered or re-stamped.

## The exact delta (byte-verified)

```
$ git log --format='%H  parent=%P  %s' -1 599f7ba0c97556c23d1707a378f9bebc3a7f05f1
599f7ba0c97556c23d1707a378f9bebc3a7f05f1  parent=5529aa4662487226c9e76e687a8edb676b4e594a  docs: drop 986-maxpending-drain-superseded internal-process design doc

$ git diff --stat 5529aa4662487226c9e76e687a8edb676b4e594a 599f7ba0c97556c23d1707a378f9bebc3a7f05f1
 docs/design/986-maxpending-drain-superseded.md | 105 -------------------------
 1 file changed, 105 deletions(-)
```

- `599f7ba0c9` is the **direct child** of `5529aa4662` (single commit on top).
- The **only** change is the **deletion** of `docs/design/986-maxpending-drain-superseded.md`
  (105 lines, pure removal — no additions, no other files touched).
- That file was an **internal cohort dev-process design doc** (owner/filed-by/internal-#NNN
  references); it is **not shipped, not imported, not executed** — it never participated in any
  build, test, or runtime path. It was removed because it failed upstream `pnpm check:docs`
  (flagged in PR #85651 review) and does not belong upstream. The legitimate feature RFC
  (`docs/design/continue-work-signal-v2.md`) is **retained**.

## Why the proofs transfer unchanged

Every artifact in this corpus exercises **code / build / test / runtime** behavior. The delta
between `5529aa4662` and `599f7ba0c9` touches **none** of that surface — it removes a single
non-executed markdown doc. Therefore:

- the build output is byte-identical,
- the test surface is identical,
- every PROOFS row (`R-CW-*`, `R-CD-*`, `R-RC-*`, `R-OBS-*`, `R-CONFIG-*`, `gates/`, …)
  gathered at `5529aa4662` is **valid as-is** for `599f7ba0c9`.

This is a **documented derivation**, not a re-stamp: the proofs were genuinely run at
`5529aa4662`, and this note records *why* they remain true at the PR head `599f7ba0c9`
(doc-only delta). The two unsquashed commits on the branch make the derivation self-evident
in the git history as well.

---
_Authored by frond-scribe🌿. Byte-verified against local `openclaw` clone on 2026-06-13._
