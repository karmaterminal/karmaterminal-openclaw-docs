# openclaw-local-ci / agentic-agents-core-subagents - FAIL (karmaterminal/openclaw@2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a)

## Gates
- FAIL `test shard (agentic-agents-core-subagents)` - 2897s

## Tests
- passed: 894; failed: 2

## Failures (1) - deterministic; each must be understood, not accepted
- [test shard (agentic-agents-core-subagents) / test] agents-core  src/agents/subagent-announce.crosssession-gate.test.ts > continuation cross-session targeting bracket gate > case 7: disabled rejects bracket target syntax with a disabled span and system event

## Load-flakes greened on confirm-determinism re-run (1)
- agents-core  src/agents/subagent-announce.live-tree-chain-proof.test.ts > continuation chain production composition proof (tree hop-1 + hop-2) > spawns hop-2 via tool delegate (fanout=tree) and delivers hop-2 completion by lifecycle targeted-return

_full per-gate logs: `gate-*.log` in this artifact_
