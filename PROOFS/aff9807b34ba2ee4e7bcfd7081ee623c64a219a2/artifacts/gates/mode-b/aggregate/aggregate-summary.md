# openclaw-local-ci - FAILURE

- target: `karmaterminal/openclaw@2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a`
- commit: `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a`
- Mode-B workflow: `karmaterminal/openclaw-bootstrap@342cc9c6d190e1ba57d9995d29e394c993a3e79b`
- shards planned: `163` (routed: `163`)
- routed jobs: hosted `55` / self-hosted `12` / self-hosted-dist `2`
- receipt validation: `true` (69 / 69 routed jobs)
- routing ruleset digest: `sha256:9ac20d0d5ad7c5dd63fbc9fd03fb40929fc70932c743f31cb1d79382badbef5d`
- planner digest: `sha256:00998116b58eb9be21491129a6ecfeb6816694ba71c9c813f7cda68abd82fc32`
- artifacts with summaries: `164`
- run: https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32895790947

## Job results
- PASS `preflight`: success
- PASS `custom-command`: skipped
- PASS `static-gates`: success
- PASS `routing-eligibility`: success
- PASS `test-shard-hosted`: skipped
- FAIL `test-shard-hosted-early`: failure
- PASS `test-shard-local`: skipped
- FAIL `test-shard-local-early`: failure
- FAIL `test-shard-local-dist`: failure

## Routing lane guards (3) - aggregate FAILS
- lane hosted variant test-shard-hosted-early finished failure, not success
- lane self-hosted variant test-shard-local-early finished failure, not success
- lane self-hosted-dist variant test-shard-local-dist finished failure, not success

## Full-suite tally
- passed: 165696
- failed: 39
- load-flakes greened: 9

## Deterministic failures (32)
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > launches openclaw chat as local mode through a real PTY
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > launches openclaw terminal as local mode through a real PTY
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > sends the initial message supplied to openclaw tui through a real local PTY
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > prints local usage costs without submitting a model request
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > drives and steers the real local backend with a mocked model endpoint
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > creates and adopts a fresh local session through a real PTY
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > lists local session history through a real PTY
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > keeps whitespace-prefixed bang input in chat after local shell approval
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > confirms and renders local shell output, then extinguishes descendants before TUI exit
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > repairs isolated config through the approved built CLI and resumes local chat
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > authenticates a manifest-discovered provider and resumes the unchanged local model
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > renders safe validation-loop abort diagnostics through the real local backend
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > rejects Gateway options on a local TUI alias through a real PTY
- [core-unit-fast-isolated / test] unit-fast-isolated  src/agents/embedded-agent-runner/run.inherited-auth-owner.test.ts > embedded setup inference inherited auth owner > prepares the explicit main agent from 'a pre-roster config'
- [core-unit-fast-isolated / test] unit-fast-isolated  src/agents/embedded-agent-runner/run.inherited-auth-owner.test.ts > embedded setup inference inherited auth owner > prepares the explicit main agent from 'a sole-agent config'
- [core-unit-fast-isolated / test] unit-fast-isolated  src/agents/embedded-agent-runner/run.session-permissions.test.ts > embedded run session permissions > prepares the exec mode with plugin-owned permission facts
- [core-unit-fast-isolated / test] unit-fast-isolated  src/agents/embedded-agent-runner/run.session-permissions.test.ts > embedded run session permissions > shares the final plugin-clamped exec mode with the outer run
- [core-unit-fast-1 / test] unit-fast  src/auto-reply/reply/commands-learn.test.ts > learn command > includes the load-bearing skill authoring standards
- [agentic-commands-onboard-config / test] commands  src/commands/auth-choice.model-check.test.ts > warnIfModelConfigLooksOff > accepts pending auth profiles collected by the current setup transaction
- [agentic-agents-embedded / test] agents-embedded-agent  src/agents/embedded-agent-runner/model-resolution-consistency.test.ts > embedded model resolution consistency > resolves an explicit alias configured only on the selected agent
- [agentic-commands-doctor / test] commands  src/commands/doctor-lint.test.ts > runDoctorLintCli > reports an actionable Crabbox profile finding before dispatch
- [auto-reply-reply-dispatch / test] auto-reply-reply  src/auto-reply/reply/dispatch-from-config.test.ts > dispatchReplyFromConfig > seeds direct fast-abort prefixes from the session-selected model
- [core-runtime-cron-isolated-agent / test] cron  src/cron/isolated-agent.session-identity.test.ts > runCronIsolatedAgentTurn session identity
- [auto-reply-reply-agent-runner / test] auto-reply-reply  src/auto-reply/reply/agent-runner-memory.test.ts > runMemoryFlushIfNeeded > runs exactly one auto-reply memory flush turn, rotates, and persists metadata
- [agentic-agents-core-subagents / test] agents-core  src/agents/subagent-announce.crosssession-gate.test.ts > continuation cross-session targeting bracket gate > case 7: disabled rejects bracket target syntax with a disabled span and system event
- [core-runtime-config / test] runtime-config  src/config/io.best-effort.test.ts > readBestEffortConfig > reuses valid snapshots while preserving load-time defaults
- [core-runtime-config / test] runtime-config  src/config/io.best-effort.test.ts > readBestEffortConfig > controls observation while returning source and materialized config
- [core-tooling-3 / test] tooling  test/scripts/telegram-mantis-sut.test.ts > Telegram Mantis SUT > waits for the claimed runtime owner before returning from stop
- [agentic-cli / test] cli  src/cli/update-cli/update-command-post-update.test.ts > successful update finalization ordering > removes inherited operator overrides from the managed install environment
- [agentic-cli / test] cli  src/cli/update-cli/update-command-post-update.test.ts > successful update finalization ordering > skips unsafe metadata refresh for unknown ownership
- [agentic-cli / test] cli  src/cli/update-cli/update-command-post-update.test.ts > successful update finalization ordering > skips unsafe metadata refresh for inline reset ownership
- [agentic-cli / test] cli  src/cli/update-cli/update-command-post-update.test.ts > successful update finalization ordering > skips unsafe metadata refresh for environment-file reset ownership
