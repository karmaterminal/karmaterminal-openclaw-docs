# Terminal Mode-B classification

| Field | Value |
|---|---|
| Product SHA | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` |
| Absorbed upstream control | `1ba243c88ed800986909bc50e4ce7b8139891b94` |
| Workflow SHA | `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Run | [`32859410821`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32859410821) |
| Routed shards | 163 |
| Routing receipts | 69/69 valid |
| Tests | 166,719 passed; 23 failed counts |
| Deterministic unique failures | 19 |
| Load flakes greened | 5 |
| Candidate-caused failures | 0 |

The workflow conclusion is `failure`; this corpus does not rewrite that byte.
Every deterministic failure was classified before acceptance.

## Deterministic failures

| Count | Cell | Classification |
|---:|---|---|
| 1 | `test/scripts/telegram-mantis-sut.test.ts` — waits for the claimed runtime owner before returning from stop | Self-hosted environment: `/run/lock/openclaw-mantis-sut-network.lock` is not writable. Same known host-bound failure class as the prior exact run. |
| 1 | `src/commands/doctor-lint.test.ts` — reports an actionable Crabbox profile finding before dispatch | Hosted-timeout boundary at 120 seconds. The exact-upstream local control previously passed in about 92 seconds. |
| 4 | `src/cli/update-cli/update-command-post-update.test.ts` | Runner-order/environment class. The failed test file and owning implementation are byte-identical to absorbed upstream. The complete candidate CLI shard and complete exact-upstream CLI shard both pass locally: 228 files, 5,252 assertions, 79 skips. |
| 13 | `src/tui/tui-pty-local.e2e.test.ts` | Dist-runner packaging class. Each failure starts before the tested PTY behavior because `node_modules/@openclaw/ai/dist/internal/openai-responses-payload-policy.mjs` is absent. The source module, package export, package build config, lockfile, and PTY test are byte-identical to absorbed upstream. |

## Load-flake accounting

Five initially red cells passed confirm-determinism reruns. The aggregate
reports them separately from the 19 deterministic failures.

## Disposition

Mode-B is accepted with all non-candidate reds disclosed. No continuation,
delegate, compaction, TaskFlow, session, gateway-delivery, or candidate repair
test failed.
