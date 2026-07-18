# R-CW-5 isolated typed-tool surface

`continue_work` is a session-elected internal primitive.  It is **not
externally invocable through the gateway loopback**, so it cannot be proved by
sending `tools.invoke` through the gateway WebSocket or MCP loopback.  The
exact candidate deliberately omits it from that externally invocable tool set.
A WebSocket scenario which claims to invoke it is therefore a harness error,
not a live continuation test.

The smallest executable surface is the same one used by a real embedded agent
attempt:

1. Create a disposable exact-candidate worktree and temporary session store.
2. Give `runAgentAttempt` a continuation-enabled, in-memory config with
   `costCapTokens=100` and a session entry whose accumulated tokens are `101`.
3. Have the embedded-agent test double call the supplied
   `continueWorkOpts.requestContinuation` callback twice.
4. Require both elections to be rejected, no TaskFlow row to exist, and the
   cost-cap system event to name both dropped elections.
5. Remove the disposable worktree and temporary store regardless of outcome.

This is not a synthetic copy of the policy: the fixture enters the production
attempt runner, receives its real typed callback, persists/reserves through
the real continuation scheduling path, and observes the real TaskFlow
registry.  The companion production-module matrix and dispatcher suite cover
the below/equal/over boundary plus rejected-hop no-spawn/failed-flow behavior.

## Why the fixture is process-local

The exact-candidate gateway test `src/gateway/mcp-http.runtime.test.ts` asserts
that loopback scope excludes `continue_work` because it is "not
external/CLI-invocable."  The actual route is
`runAgentAttempt` -> `continueWorkOpts.requestContinuation` -> continuation
scheduling.  GitNexus on the exact `6ee7eca` index confirms that
`checkContinuationBudget` is reached by `scheduleContinuationWork`,
`dispatchToolDelegates`, and post-compaction dispatch; the R-CW-5 fixture
exercises the first of those through the typed callback and separately runs
the real delegate-dispatch boundary suite.

## Command and receipts

```bash
node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs \
  --source-dir <exact-6ee7eca-worktree> \
  --candidate-sha 6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d \
  --artifact-dir <empty-private-directory> --cap 100 --json
```

The command refuses a SHA/source mismatch, missing preinstalled dependencies,
a source `node_modules/.pnpm/lock.yaml` that is absent or byte-different from
the candidate's committed `pnpm-lock.yaml`, missing pinned pnpm metadata or
required local `tsx`/`vitest` executables, or any failure to create and remove
its disposable worktree.  It never runs
`pnpm install`, starts a gateway, writes OpenClaw config, or touches durable
fleet state.  It produces `boundary-matrix.json`,
`dispatch-boundary-suite.json`, `typed-tool-surface.json`, and `cleanup.json`.
Any missing or failed receipt is `FAIL-fixture`, never a PASS.

The fixture is a reviewed `PASS-candidate`, not an automatic corpus promotion.
The legacy k6 entry remains scaffolded and fail-closed because its shared
config mutation is neither required nor a valid way to invoke this internal
tool.
