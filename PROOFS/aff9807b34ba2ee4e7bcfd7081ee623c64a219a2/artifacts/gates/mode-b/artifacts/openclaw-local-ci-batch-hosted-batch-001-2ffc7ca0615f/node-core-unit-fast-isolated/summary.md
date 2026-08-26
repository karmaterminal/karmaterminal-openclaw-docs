# openclaw-local-ci / core-unit-fast-isolated - FAIL (karmaterminal/openclaw@2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a)

## Gates
- FAIL `test shard (core-unit-fast-isolated)` - 1068s

## Tests
- passed: 1577; failed: 4

## Failures (4) - deterministic; each must be understood, not accepted
- [test shard (core-unit-fast-isolated) / test] unit-fast-isolated  src/agents/embedded-agent-runner/run.inherited-auth-owner.test.ts > embedded setup inference inherited auth owner > prepares the explicit main agent from 'a pre-roster config'
- [test shard (core-unit-fast-isolated) / test] unit-fast-isolated  src/agents/embedded-agent-runner/run.inherited-auth-owner.test.ts > embedded setup inference inherited auth owner > prepares the explicit main agent from 'a sole-agent config'
- [test shard (core-unit-fast-isolated) / test] unit-fast-isolated  src/agents/embedded-agent-runner/run.session-permissions.test.ts > embedded run session permissions > prepares the exec mode with plugin-owned permission facts
- [test shard (core-unit-fast-isolated) / test] unit-fast-isolated  src/agents/embedded-agent-runner/run.session-permissions.test.ts > embedded run session permissions > shares the final plugin-clamped exec mode with the outer run

_full per-gate logs: `gate-*.log` in this artifact_
