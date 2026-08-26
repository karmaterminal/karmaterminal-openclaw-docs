# openclaw-local-ci / agentic-cli - FAIL (karmaterminal/openclaw@c7131791a6d33ab83d1a820c7cdb81c1b1384931)

## Gates
- FAIL `test shard (agentic-cli)` - 198s

## Tests
- passed: 5266; failed: 4

## Failures (4) - deterministic; each must be understood, not accepted
- [test shard (agentic-cli) / test] cli  src/cli/update-cli/update-command-post-update.test.ts > successful update finalization ordering > removes inherited operator overrides from the managed install environment
- [test shard (agentic-cli) / test] cli  src/cli/update-cli/update-command-post-update.test.ts > successful update finalization ordering > skips unsafe metadata refresh for unknown ownership
- [test shard (agentic-cli) / test] cli  src/cli/update-cli/update-command-post-update.test.ts > successful update finalization ordering > skips unsafe metadata refresh for inline reset ownership
- [test shard (agentic-cli) / test] cli  src/cli/update-cli/update-command-post-update.test.ts > successful update finalization ordering > skips unsafe metadata refresh for environment-file reset ownership

_full per-gate logs: `gate-*.log` in this artifact_
