# openclaw-local-ci - FAILURE

- target: `karmaterminal/openclaw@6feda9fd71c7cb4701af63ab54264009ce5f6afb`
- commit: `6feda9fd71c7cb4701af63ab54264009ce5f6afb`
- Mode-B workflow: `karmaterminal/openclaw-bootstrap@d05778e6a96dd9a96946eff483e80c4d9ff9575e`
- shards planned: `167` (routed: `167`)
- routed jobs: hosted `55` / self-hosted `12` / self-hosted-dist `2`
- receipt validation: `true` (69 / 69 routed jobs)
- routing ruleset digest: `sha256:d2ef6b0b93c9f36ca9a668270b50eb696d3ea302760861d2cadf2cdac1a230a8`
- planner digest: `sha256:0bee700c22fb01bd637e009689faa55c66277fb09bf4ee333064cfeeca7366a8`
- artifacts with summaries: `168`
- run: https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/33318993673

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
- passed: 179809
- failed: 25
- load-flakes greened: 5

## Deterministic failures (20)
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-harness.e2e.test.ts > TUI PTY harness > sanitizes ANSI OSC and C1 payloads across real PTY display boundaries
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-harness.e2e.test.ts > TUI PTY harness > preserves xAI account limit errors in terminal output
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > with shared Gateway fixture > executes Gateway status model new and reset RPCs through a real TUI PTY
- [core-runtime-tui-pty / test] tui-pty  src/tui/tui-pty-local.e2e.test.ts > TUI PTY real backends > with shared Gateway fixture > renders a non-deliverable direct reply failure through the real Gateway and TUI
- [agentic-plugins / test] plugins  src/plugins/npm-install-security-scan.release.test.ts > publishable plugin npm package install security scan > keeps '@openclaw/codex' files clear of unexpected critical hits
- [agentic-gateway-core-runtime / test] gateway-core  src/gateway/gateway-active-memory.test.ts > Gateway Active Memory > keeps a grounded but terminally failed recall out of the main prompt
- [agentic-gateway-core-runtime / test] gateway-core  src/gateway/gateway-concurrent-streams.test.ts > Gateway concurrent HTTP streams > keeps both streams isolated while global observers retain every run
- [core-tooling-5 / test] tooling  test/scripts/full-release-validation-state.test.ts > release decision policy > accepts a monotonically newer attempt for the exact child tuple
- [core-tooling-5 / test] tooling  test/scripts/full-release-validation-state.test.ts > release decision policy > preserves the last valid snapshot through HTTP 503: Server Error and then recovers
- [core-tooling-5 / test] tooling  test/scripts/full-release-validation-state.test.ts > release decision policy > preserves the last valid snapshot through HTTP 429: API rate limit exceeded and then recovers
- [core-tooling-5 / test] tooling  test/scripts/full-release-validation-state.test.ts > release decision policy > preserves the last valid snapshot through HTTP 403: secondary rate limit and then recovers
- [core-tooling-5 / test] tooling  test/scripts/full-release-validation-state.test.ts > release decision policy > preserves the last valid snapshot through read ECONNRESET and then recovers
- [core-tooling-5 / test] tooling  test/scripts/full-release-validation-state.test.ts > release decision policy > preserves complete composite evidence when the run read succeeds but jobs fail
- [core-tooling-7 / test] tooling  test/scripts/install-sh.test.ts > install.sh > uses the apk Node.js installer path on Alpine
- [core-tooling-7 / test] tooling  test/scripts/install-sh.test.ts > install.sh > tries nodejs-current when Alpine nodejs is below the runtime floor
- [core-tooling-7 / test] tooling  test/scripts/install-sh.test.ts > install.sh > fails with Alpine guidance when apk cannot provide a safe SQLite runtime
- [core-tooling-7 / test] tooling  test/scripts/install-sh.test.ts > install.sh > stops when NodeSource repository setup fails
- [core-tooling-7 / test] tooling  test/scripts/install-sh.test.ts > install.sh > stops when apt cannot install the Node.js package
- [agentic-gateway-methods / test] gateway-methods  src/gateway/server-methods/usage.sessions-usage.test.ts > sessions.usage > loads bare-key usage details through the persisted fixed-store owner
- [extension-telegram / test] extension-telegram  extensions/telegram/src/bot.create-telegram-bot.test.ts > createTelegramBot > honors routed group activation from session store
