# openclaw-local-ci - FAILURE

- target: `karmaterminal/openclaw@372ce0f8e33b42d0377a64806f8013208af54fcf`
- commit: `372ce0f8e33b42d0377a64806f8013208af54fcf`
- Mode-B workflow: `karmaterminal/openclaw-bootstrap@6dd6c3a7712c8ae02937a29054525b2ddacb89c1`
- shards planned: `163` (routed: `163`)
- routed jobs: hosted `55` / self-hosted `12` / self-hosted-dist `2`
- receipt validation: `true` (69 / 69 routed jobs)
- routing ruleset digest: `sha256:9ac20d0d5ad7c5dd63fbc9fd03fb40929fc70932c743f31cb1d79382badbef5d`
- planner digest: `sha256:00998116b58eb9be21491129a6ecfeb6816694ba71c9c813f7cda68abd82fc32`
- artifacts with summaries: `164`
- run: https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32650099821

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
- passed: 163506
- failed: 38
- load-flakes greened: 22

## Deterministic failures (16)
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-harness.e2e.test.ts > TUI PTY harness > preserves xAI account limit errors in terminal output
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-harness.e2e.test.ts > TUI PTY harness > renders redacted, cause-aware send failures in the real terminal loop
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
- [agentic-commands-doctor / test] commands  src/commands/doctor-lint.test.ts > runDoctorLintCli > reports an actionable Crabbox profile finding before dispatch
- [core-tooling-6 / test] tooling  test/scripts/telegram-mantis-sut.test.ts > Telegram Mantis SUT > waits for the claimed runtime owner before returning from stop
