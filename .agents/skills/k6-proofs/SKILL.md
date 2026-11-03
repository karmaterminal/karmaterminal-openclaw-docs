---
name: k6-proofs
description: Author or change a k6 proof row (row manifest plus k6 scenario under tools/k6-proofs) for the OpenClaw continuation proof corpus. Use when adding a row, writing or fixing a scenario or row manifest, naming its metrics, wiring nonce, redaction and both-forms (tool + token) receipts, or validating and first-firing a new row, for example 'add an R-CW row', 'write the k6 scenario for R-CD-4' or 'check-manifest-scenarios fails'. Keeps new rows on the manifest-driven WebSocket harness and passing its offline catalog checks. For dispatching, triaging or publishing a whole corpus use openclaw-dev:run-k6-proofs from the scribe-prince-shared marketplace instead.
---

# k6 PROOFS (pointer)

This is a pointer, not a copy. The k6 proof-row authoring skill lives beside the scenarios at
`tools/k6-proofs/skill/SKILL.md` from the repository root
([open it](../../../tools/k6-proofs/skill/SKILL.md)). Read that file and follow it; nothing here
adds to it.

It is a real file rather than a symlink because OpenClaw reads `.agents/skills` and skips a skill
directory whose real path leaves that root, unless `skills.load.allowSymlinkTargets` names it on
that seat. The frontmatter above must stay identical to the source's;
`tools/k6-proofs/scripts/check-k6-skill.mjs` fails when the two drift.
