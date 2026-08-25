# openclaw-local-ci / agentic-commands-onboard-config - FAIL (karmaterminal/openclaw@2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a)

## Gates
- FAIL `test shard (agentic-commands-onboard-config)` - 1372s

## Tests
- passed: 745; failed: 2

## Failures (1) - deterministic; each must be understood, not accepted
- [test shard (agentic-commands-onboard-config) / test] commands  src/commands/auth-choice.model-check.test.ts > warnIfModelConfigLooksOff > accepts pending auth profiles collected by the current setup transaction

## Load-flakes greened on confirm-determinism re-run (1)
- commands  src/commands/onboard-custom.test.ts > promptCustomApiConfig > rejects aliases already used only by the selected agent

_full per-gate logs: `gate-*.log` in this artifact_
