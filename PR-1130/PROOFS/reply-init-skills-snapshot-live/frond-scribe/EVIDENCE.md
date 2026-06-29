# PR-1130 reply-init skillsSnapshot rescue proof

## Verdict

**PASS-CANDIDATE for the #1130 / upstream #97642 reply-init fix at current PR head `794ee30138629605eb7759dc1e5a26b3f67dcf2a`.**

The proof has two parts:

1. A focused unit test proves the logic error and confirms the fix: persisted `skillsSnapshot.promptRef` and hydrated `skillsSnapshot.prompt` no longer produce a false reply-init `stale-snapshot`.
2. The P2 refinement extends that same proof to include runtime-only `skillsSnapshot.resolvedSkills`, and the revision helper now derives from the full normalized persisted-entry shape.
3. Ronan before/after runtime logs show the live symptom before deploy and no `reply session initialization conflicted` lines in the captured post-deploy window after installing the rescue frond-build.
4. Supplemental copied live output from Ronan after the P2 update shows repeated successful consecutive Discord `message.action` responses on the sprites channel and zero reply-init conflict/stale-snapshot lines in the same window.

This is a PR-specific rescue proof. It is **not** the continuation GATES corpus and does not update top-level `PROOFS/INDEX.json`.

## Related work

- Fork PR: `karmaterminal/openclaw#1130`
- Upstream PR: `openclaw/openclaw#97642`
- Upstream issue: `openclaw/openclaw#96698`
- Current fix SHA: `794ee30138629605eb7759dc1e5a26b3f67dcf2a`
- Ronan deployed frond-build SHA: `dd0f29e9598ca26588228596f4c4c733e6e8840f`
- Ronan frond-build branch: `frond-build/20260628/assembly-plus-96699-ronan-rescue`

## Unit proof

Command:

```bash
node scripts/run-vitest.mjs run src/config/sessions/session-accessor.test.ts -t 'skillsSnapshot'
```

Result: one focused test passed on the #1130 branch. See:

- `unit/focused-session-accessor-skillsSnapshot.log`

The test creates a persisted prompt-ref session entry, reloads it through hydration, injects a runtime-only `resolvedSkills` cache on the writer entry, then verifies reply-session initialization commits successfully instead of returning false `stale-snapshot`.

P2 follow-up gates at current head `794ee30138629605eb7759dc1e5a26b3f67dcf2a`:

- `node scripts/run-vitest.mjs run src/config/sessions/session-accessor.test.ts`
- `node scripts/run-vitest.mjs run src/config/sessions/store.skills-stripping.test.ts`
- `node scripts/run-vitest.mjs run src/auto-reply/reply/session.test.ts`
- `node scripts/run-oxlint-shards.mjs --only=core --split-core`
- `CI=true pnpm tsgo:core:test`

Result: all passed. See:

- `unit/p2-normalization-targeted-gates.log`

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

## Supplemental Ronan two-message live output

File:

- `after/ronan-post-p2-two-message-live-output.log`

This copied live output was captured after deploying frond-build `dd0f29e9598ca26588228596f4c4c733e6e8840f`, which is the assembly continuation branch plus the #1130/#97642 reply-init fix stack. The relevant window includes gateway startup, repeated successful Discord `message.action` responses on the sprites channel, and a conflict count of zero:

```text
2026-06-28T21:21:32-07:00 ... [ws] ⇄ res ✓ message.action 346ms channel=discord ...
2026-06-28T21:21:39-07:00 ... [ws] ⇄ res ✓ message.action 208ms channel=discord ...
...
reply-init conflict/stale-snapshot count in window: 0
```

## Caveats

- The post-deploy capture is a smoke window, not a long-duration soak.
- Ronan live evidence is from the frond-build composite used for prince seats, not from deploying the isolated main-based PR branch; the composite contains the reply-init fix stack plus the frond's continuation config surface.
- Full-suite runs for #1130 hit unrelated baseline/environment/catalog failures outside this session-store fix; targeted tests passed.
