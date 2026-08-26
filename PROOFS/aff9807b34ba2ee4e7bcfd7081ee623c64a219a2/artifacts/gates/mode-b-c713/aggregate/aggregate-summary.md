# openclaw-local-ci - FAILURE

- target: `karmaterminal/openclaw@c7131791a6d33ab83d1a820c7cdb81c1b1384931`
- commit: `c7131791a6d33ab83d1a820c7cdb81c1b1384931`
- Mode-B workflow: `karmaterminal/openclaw-bootstrap@342cc9c6d190e1ba57d9995d29e394c993a3e79b`
- shards planned: `163` (routed: `163`)
- routed jobs: hosted `55` / self-hosted `12` / self-hosted-dist `2`
- receipt validation: `true` (69 / 69 routed jobs)
- routing ruleset digest: `sha256:9ac20d0d5ad7c5dd63fbc9fd03fb40929fc70932c743f31cb1d79382badbef5d`
- planner digest: `sha256:00998116b58eb9be21491129a6ecfeb6816694ba71c9c813f7cda68abd82fc32`
- artifacts with summaries: `164`
- run: https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32911065508

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
- passed: 167237
- failed: 21
- load-flakes greened: 3

## Deterministic failures (18)
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
- [agentic-commands-doctor / test] commands  src/commands/doctor-lint.test.ts > runDoctorLintCli > reports an actionable Crabbox profile finding before dispatch
- [agentic-cli / test] cli  src/cli/update-cli/update-command-post-update.test.ts > successful update finalization ordering > removes inherited operator overrides from the managed install environment
- [agentic-cli / test] cli  src/cli/update-cli/update-command-post-update.test.ts > successful update finalization ordering > skips unsafe metadata refresh for unknown ownership
- [agentic-cli / test] cli  src/cli/update-cli/update-command-post-update.test.ts > successful update finalization ordering > skips unsafe metadata refresh for inline reset ownership
- [agentic-cli / test] cli  src/cli/update-cli/update-command-post-update.test.ts > successful update finalization ordering > skips unsafe metadata refresh for environment-file reset ownership
