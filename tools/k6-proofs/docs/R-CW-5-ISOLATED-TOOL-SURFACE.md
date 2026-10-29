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

The command refuses a SHA/source mismatch, a missing or altered candidate
lockfile, or any failure to create and remove its disposable worktree. It runs
`pnpm install --frozen-lockfile --prefer-offline` only in that disposable
worktree using the exact version and sha512 integrity pinned by the candidate.
npm installs that pnpm release into a private toolchain. The fixture runs the
bin entry the package declares through a trusted interpreter: `node` for a
`#!...node` script, `/bin/sh` for pnpm 12's shebang-less launcher. It refuses a
pnpm that changes its own toolchain during the `--version` probe. That probe
picks the native binary in the same way the install then does. When the candidate lockfile
opens with a pnpm env document, that document must pin the same pnpm version
and tarball integrity. Every other toolchain package, such as pnpm 12's
`@pnpm/exe.<target>` native binary, must match the integrity that document
records. The installed `.pnpm/lock.yaml` must byte-match the candidate's
lockfile document, the part after any env document.

The candidate-local `tsx` and `vitest` run the same way. The fixture runs the
JS entry each package's `package.json` `bin` declares under the trusted
`node`. The `node_modules/.bin` link pnpm wrote must name that entry: a symlink
up to pnpm 12.0, an sh cmd-shim's `# cmd-shim-target=` line from pnpm 12.3. Node
cannot run a cmd-shim, and the shim itself would pick `node` from `PATH`.

The dispatch boundary suite runs under whichever Vitest config owns it at the
candidate. Candidate `311bc66fca` (fork #1408 L4) moved it onto real
continuation custody, into the database-worker-core lane of
`vitest.infra.config.ts`, which `vitest.auto-reply.config.ts` now excludes.
The fixture asks the candidate's Vitest (`list --filesOnly`) which of those two
configs collects the suite, and needs exactly one. It then reads Vitest's JSON
report. The report must list exactly that file, every test in it must have
passed, none may be skipped or todo, and at least one must have run.
Each of the four contract tests must also have passed. The failed-record test
counts under its custody name or its earlier TaskFlow name. The candidate's
reporter redacts credential-looking spans of a test name, so it reports
`rejects at exact boundary (accumulatedChainTokens === …)` with a
`<redacted len=N>` marker. Such a title counts only when its visible text and
marked length fit the expected name and the committed suite declares that name
verbatim. A green exit, or names on stdout, is never enough. Candidate Vitest
runs do not inherit the caller's `OPENCLAW_VITEST_*` variables. The candidate's
scoped configs would let an inherited `OPENCLAW_VITEST_INCLUDE_FILE` replace
the include list that the fixture selects by.

It never trusts or mutates source `node_modules`, starts a gateway, writes
OpenClaw config, or touches durable fleet state. It produces `boundary-matrix.json`,
`dispatch-boundary-suite.json`, `typed-tool-surface.json`, and `cleanup.json`.
Any missing or failed receipt is `FAIL-fixture`, never a PASS.

The fixture is a reviewed `PASS-candidate`, not an automatic corpus promotion.
The legacy k6 entry remains scaffolded and fail-closed because its shared
config mutation is neither required nor a valid way to invoke this internal
tool.
