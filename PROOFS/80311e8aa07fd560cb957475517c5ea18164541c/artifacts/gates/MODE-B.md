# Terminal Mode-B classification

| Field | Value |
|---|---|
| Product SHA | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Frozen upstream control | `0d4e369b1c3df59cd77b59bba87aac17884742b1` |
| Workflow SHA | `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Run | [`32820979682`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32820979682) |
| Tests | 165,309 passed; 11 failed counts |
| Deterministic unique failures | 6 |
| Load flakes greened | 5 |
| Candidate-caused failures | 0 |

The workflow conclusion is `failure`; this corpus does not rewrite that byte.
The acceptance is based on the complete classification below.

## Deterministic test failures

| Count | Cell | Classification |
|---:|---|---|
| 1 | `test/scripts/telegram-mantis-sut.test.ts` — waits for the claimed runtime owner before returning from stop | Self-hosted environment. `/run/lock/openclaw-mantis-sut-network.lock` was not writable; the test then observed the expected shell failure. |
| 1 | `src/commands/doctor-lint.test.ts` — reports an actionable Crabbox profile finding before dispatch | Hosted-timeout boundary. The test hit its 120-second ceiling; exact-upstream local control passed in about 92 seconds. |
| 2 | `src/plugins/bundled-plugin-metadata.test.ts` | Frozen-upstream baseline, reproduced on the exact control SHA. |
| 2 | `src/plugins/tools.optional.test.ts` | Frozen-upstream baseline, reproduced on the exact control SHA. |

## Static gate

`check (typecheck+lint+duplicates+guards)` also concluded red because the
temp-path guard reported `src/gateway/server-maintenance.ts`. The same guard
failure reproduces on the frozen upstream control and is not candidate-caused.
The static gate is not part of the six-test arithmetic above.

## Load-flake accounting

Five initially red cells passed their confirm-determinism reruns. They contribute
to the aggregate’s 11 failed counts but not to its six deterministic failures.
For example, the `extension-qa` process-lifecycle cell is explicitly recorded as
green on its confirm-determinism rerun.

## Disposition

Mode-B is accepted with baseline/environment reds disclosed, not converted to
green. The candidate-caused failures found in the two earlier Mode-B attempts
were cured before this terminal run.
