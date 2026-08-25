# openclaw-local-ci / auto-reply-reply-agent-runner - FAIL (karmaterminal/openclaw@2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a)

## Gates
- FAIL `test shard (auto-reply-reply-agent-runner)` - 1178s

## Tests
- passed: 754; failed: 2

## Failures (1) - deterministic; each must be understood, not accepted
- [test shard (auto-reply-reply-agent-runner) / test] auto-reply-reply  src/auto-reply/reply/agent-runner-memory.test.ts > runMemoryFlushIfNeeded > runs exactly one auto-reply memory flush turn, rotates, and persists metadata

## Load-flakes greened on confirm-determinism re-run (1)
- auto-reply-reply  src/auto-reply/reply/agent-runner.misc.runreplyagent.test.ts > runReplyAgent auto-compaction token update > updates totalTokens from lastCallUsage even without compaction

_full per-gate logs: `gate-*.log` in this artifact_
