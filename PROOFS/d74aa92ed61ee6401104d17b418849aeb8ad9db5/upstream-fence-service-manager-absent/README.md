# Live-gateway dist fence: proven-absent service manager (head `d74aa92e`)

| | |
|---|---|
| Product head | `d74aa92ed61ee6401104d17b418849aeb8ad9db5`, a merge of upstream main `0387f4f96a` into `5376ab7d34` |
| Control | upstream `openclaw/openclaw` main `0387f4f96a2963409bd0da3aa42f3510459bfea8` |
| Diff vs control | `scripts/lib/live-gateway-dist-fence.mts`, `test/scripts/live-gateway-dist-fence.test.ts` only. Both are byte-identical to `5376ab7d34`. |
| Why a new head | The CI job `check-test-types-core-2` failed at the old base `00be453166` on `ui/src/components/mcp-app-*.test.ts`, which this PR doesn't touch. Upstream fixed that in `319ec991d0` (#169439). |
| Earlier corpus | `PROOFS/5376ab7d34f5a1684a1bb00e8d29be92a3a7f94a/upstream-fence-service-manager-absent/`. It includes the no-`systemctl` negative control. |
| Run | 2026-10-12 00:14–00:19Z, `node:24.17.0-bookworm`, aarch64, uid 1000, `systemd` installed, `systemctl --user is-system-running` → `offline` |

`proof.sh` is byte-identical to the earlier corpus's `proof.sh`, and it produced this log. The
product tree is `git archive` of the exact head (`inputs.sha256`).

| Step | Fence source | Tests | Result |
|---|---|---|---|
| 1 control | main | main | 41/41 + absence 3/3 pass |
| 2 head | head | head | 50/50 + absence 3/3 pass |
| 3 fix reverted | main | head | **4 failed** / 46 passed |
| 4 fix reapplied | head | head | 50/50 pass |
| 5 real fence call, control | main | — | `{"refuse":true,"message":"[openclaw] Cannot verify …"}` |
| 6 real fence call, head | head | — | `{"refuse":false}` |
| 7 `prepare-vitest-runtime`, control | main | — | refuses, exit 1, `dist` absent (nothing listed) |
| 8 `prepare-vitest-runtime`, head | head | — | full build, exit 0, 8564 `dist` entries |
| 9 Vitest after real preparation | head | head | 50/50 pass |
