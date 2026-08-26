# openclaw-local-ci / agentic-commands-agent-channel - PASS (karmaterminal/openclaw@2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a)

## Gates
- PASS `test shard (agentic-commands-agent-channel)` - 530s

## Tests
- passed: 653; failed: 1

## Load-flakes greened on confirm-determinism re-run (1)
- commands  src/commands/agent.worktree-race.test.ts > agent command worktree admission > holds the lease through workspace preparation so a racing removal is rejected

_full per-gate logs: `gate-*.log` in this artifact_
