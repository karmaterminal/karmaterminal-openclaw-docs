# PR-1130 reply-init skillsSnapshot rescue proof

## Verdict

**PASS-CANDIDATE for the #1130 / upstream #97642 reply-init fix.**

The proof has two parts:

1. A focused unit test proves the logic error and confirms the fix: persisted `skillsSnapshot.promptRef` and hydrated `skillsSnapshot.prompt` no longer produce a false reply-init `stale-snapshot`.
2. Ronan before/after runtime logs show the live symptom before deploy and no `reply session initialization conflicted` lines in the captured post-deploy window after installing frond-build `aac566b912321889b9f66a99204b5725107764a9`.

This is a PR-specific rescue proof. It is **not** the continuation GATES corpus and does not update top-level `PROOFS/INDEX.json`.

## Related work

- Fork PR: `karmaterminal/openclaw#1130`
- Upstream PR: `openclaw/openclaw#97642`
- Upstream issue: `openclaw/openclaw#96698`
- Fix SHA: `b86fcb3d586abff36babbbc753899009e17de06f`
- Ronan frond-build SHA: `aac566b912321889b9f66a99204b5725107764a9`
- Ronan frond-build branch: `frond-build/20260628/assembly-plus-96699-ronan-rescue`

## Unit proof

Command:

```bash
node scripts/run-vitest.mjs run src/config/sessions/session-accessor.test.ts -t 'skillsSnapshot'
```

Result: one focused test passed on the #1130 branch. See:

- `unit/focused-session-accessor-skillsSnapshot.log`

The test creates a persisted prompt-ref session entry, reloads it through hydration, then verifies reply-session initialization commits successfully instead of returning false `stale-snapshot`.

## Ronan before evidence

Files:

- `before/ronan-runtime-summary.txt`
- `before/ronan-session-metadata.json`
- `before/ronan-reply-init-conflict-journal.log`

Captured symptom count: `459` instances of `reply session initialization conflicted` in the before journal window.

## Ronan after evidence

Files:

- `after/ronan-after-frond-build-summary.txt`
- `after/ronan-after-frond-build-journal.log`

After summary:

```text
captured_at=2026-06-28T20:25:25-07:00
gateway=active
repo=aac566b912321889b9f66a99204b5725107764a9
branch=version=OpenClaw 2026.6.10 (aac566b)
build={"version":"2026.6.10","commit":"aac566b912321889b9f66a99204b5725107764a9","builtAt":"2026-06-29T03:12:56.417Z"}
conflicts_since_deploy=0
processed_since_deploy=0
successful_processed_since_deploy=0
tasks={"count":13,"byStatus":[{"status":"failed","count":2},{"status":"succeeded","count":11}],"nonterminal":0}
```

The post-deploy captured journal contains no `reply session initialization conflicted` line. It includes gateway startup/cache/model diagnostics only.

## Caveats

- The post-deploy capture is a smoke window, not a long-duration soak.
- The after window had no recorded `message processed` lines, so the live proof is strongest on symptom cessation plus clean runtime/task state, not on a fresh post-deploy two-message Discord conversation.
- Full-suite runs for #1130 hit unrelated baseline/environment/catalog failures outside this session-store fix; targeted tests passed.
