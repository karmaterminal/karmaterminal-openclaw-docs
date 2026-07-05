# R-CW-7 — traceparent propagation direct proof (1cc8f4e, cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/220
Candidate SHA: `1cc8f4e3d617ef6f173283ef83d7b739a4995734`
Seat: Cael / `cael-dgx`
Verdict: ✅ PASS — direct exact-head source/test proof for runtime traceparent propagation

## Bot-readable summary

R-CW-7 should not be read as "the model-facing `continue_delegate` tool accepts a public `traceparent` parameter." On current head `1cc8f4e3d617ef6f173283ef83d7b739a4995734`, that field is intentionally internal and is omitted from public/model-facing schemas.

The PASS claim is narrower and current-head accurate:

1. `traceparent` is an internal protocol field, not a public model-facing tool parameter.
2. `continue_delegate` automatically picks up the active runtime diagnostic trace context when the model omits `traceparent`.
3. pending continuation delegates retain that traceparent through dispatch.
4. spawned child agent runs receive, hand off, persist, and register the inherited traceparent.
5. focused tests for those exact behaviors pass on exact source SHA `1cc8f4e3d617ef6f173283ef83d7b739a4995734`.

This replaces the earlier THIN package, which tried to satisfy an obsolete public-parameter method and then had to explain why that method was impossible.

## Exact source checkout

```text
1cc8f4e3d617ef6f173283ef83d7b739a4995734
Merge upstream/main clean drift into assembly
2026-07-05T13:04:14-07:00
```

Receipt files:

- `source/source-sha.txt`
- `source/source-commit.txt`
- `source/source-snippets.md`

## Focused verification command

Run from a clean worktree checked out at `1cc8f4e3d617ef6f173283ef83d7b739a4995734` with `node_modules` available:

```bash
node scripts/test-projects.mjs \
  src/agents/tools/continue-delegate-tool.test.ts \
  src/auto-reply/continuation/delegate-dispatch.test.ts \
  src/agents/subagent-spawn.test.ts \
  packages/gateway-protocol/src/schema/agent.schema.test.ts
```

Saved log: `test/focused-traceparent-tests.log`.

Result:

```text
[test] passed 3 Vitest shards in 13.99s
```

Shard detail:

```text
packages/gateway-protocol/src/schema/agent.schema.test.ts — 10 passed
src/auto-reply/continuation/delegate-dispatch.test.ts — 81 passed
src/agents/tools/continue-delegate-tool.test.ts — 25 passed
src/agents/subagent-spawn.test.ts — 26 passed
```

Total focused test count: 142 passed / 0 failed.

## Evidence map

### 1. Public schema omission is intentional

`source/source-snippets.md` includes the exact tests showing:

- `AgentParamsSchema.properties.traceparent` is marked `x-openclaw-internal`.
- `stripInternalProtocolFields(AgentParamsSchema)` removes `traceparent` from public generated schema copies.
- `continue_delegate` descriptor keys are pinned to exactly `task, delaySeconds, mode, targetSessionKey, targetSessionKeys, fanoutMode, model`.
- `continue_delegate` tool parameters do not contain `traceparent`.

### 2. Runtime trace context is auto-picked up

`src/agents/tools/continue-delegate-tool.test.ts` includes:

- `auto-picks the active runtime trace context when traceparent is omitted`
- `falls back to the active runtime trace context when a hidden traceparent is invalid`
- `omits traceparent when the carrier is absent`
- `threads active runtime traceparent into staged post-compaction delegates`

These tests prove the model does not need a public traceparent parameter for runtime trace propagation.

### 3. Delegate dispatch preserves traceparent

`src/auto-reply/continuation/delegate-dispatch.test.ts` includes:

- `threads persisted traceparent into spawned continuation runs`

This proves a pending delegate carrying trace context is passed to the spawned continuation run.

### 4. Child spawn receives, hands off, persists, and registers traceparent

`src/agents/subagent-spawn.test.ts` includes:

- `forwards inherited traceparent to the child agent run`

That test asserts the child `agent` call receives `params.traceparent`, the traceparent handoff is consumable, the session store persists `continuationTraceparent`, and the subagent registry receives `traceparent`.

## Why this is PASS now

The prior package was THIN because it tested a method that current OpenClaw intentionally does not expose: a model-authored public `traceparent` argument on `continue_delegate`.

The direct current-head proof avoids that obsolete method. It proves the supported behavior instead: runtime trace context is internal, automatically picked up, and forwarded through continuation delegate dispatch into child agent runs.

## Scope limits

- This is exact-head source/test proof for `1cc8f4e3d617ef6f173283ef83d7b739a4995734`, not a fresh live-fire run on a deployed `1cc8f4e` gateway. At collection time, Cael's live gateway reported `OpenClaw 2026.6.11 (71a1dff)`.
- The older live-fire artifacts under this directory remain historical context only. The PASS verdict above rests on the exact-head focused tests and source snippets, not on the older `bca2b0b` THIN live-fire method.
- If maintainers require a live exact-head runtime proof, deploy `1cc8f4e` first and re-run this row against that live build.
