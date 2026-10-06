# #1421 fenced-shard execution: consolidated receipt table at pure cut 08fead65d2

Assembled 2026-10-06 ~03:30Z by frond-scribe from read-only reads of `~/ci-fenced-08fead65/` on
ronan, cael, emeric, elliott. Nothing was started, stopped or modified on any seat. Every number
below was read from the bytes on the seat (`result.json`, `summary.md`, vitest `Test Files` / `Tests`
lines in `ci-output.log`, file mtimes). Disposition claims are checked against the cited evidence;
they are not copied from the brief.

## Exact refs

| what | value |
|---|---|
| product (pure cut) | `08fead65d21e915b4f0b72c2f9c02f7dac7ad53d` (every `result.json` `sha` field) |
| upstream baseline | `b51feb98ebb1bfa6735b62d136eca9abdbee4285` (`cmp-plugins-b51feb98eb` `result.json` `sha`; `baseline-gsi/wt-b51feb98eb`) |
| runner (bootstrap tools) actually executing | `0b079a08a62cc932a8f0e35aaecba6e023260255` (all four `RECEIPT.txt`; `BOOTSTRAP_TOOLS_SHA` in every run dir incl. reruns and cmp-plugins) |
| deviation vs Mode-B run 37333667018 runner `0507f50303` | scheduling-only per RECEIPT: `openclaw-local-ci-runner.sh` byte-identical, only `openclaw-local-ci-run-batch.sh` differs (#1638). `fenced-seat.sh` header still says 0507f50303 (stale comment) |
| node | `v24.17.0` (sha256-verified official tarball) first on PATH, all seats and reruns (`seat-start.txt`). emeric: through a `--no-opt` shim execing that same binary, because host `/usr/bin/node` is v26.7.0 (`emeric-seat-RECEIPT-shim.txt`, 🕯 grant 1556804153790173296) |
| timezone note | seat file mtimes are PDT (UTC-7); verified by `seat-start.txt` content (`…Z`) against its own mtime on all four seats |

## Table: 24 shards (6 per seat)

Count columns are the vitest `Tests` summary lines from the shard's `ci-output.log`, summed across
the shard's vitest blocks. `kit tally` is the runner's `summary.md` figure where it differs.
Paths are relative to `~/ci-fenced-08fead65/` on the named seat.

| # | shard | seat | run dir | conclusion (rc) | tests passed / failed | disposition | evidence |
|---|---|---|---|---|---|---|---|
| 1 | checks-fast-contracts-channels-a | ronan | seat | success (0) | 240 / 0 | PASS | `seat/results/batch-0/contract-checks-fast-contracts-channels-a/` |
| 2 | agentic-control-plane-runtime-state | ronan | seat | success (0) | 156 / 0 | PASS | `seat/results/batch-0/node-agentic-control-plane-runtime-state/` |
| 3 | extension-codex-app-server-support | ronan | seat | success (0) | 2022 / 0 | PASS | `seat/results/batch-0/supplemental-extension-codex-app-server-support/` |
| 4 | extension-database-workers | ronan | seat | success (0) | 3623 / 1, then greened | PASS, with recorded flake | `seat/results/batch-0/supplemental-extension-database-workers/{summary.md,confirm-determinism-flakes.txt}`: one load-flake `extensions/tlon/src/monitor/index.test.ts > monitorTlonProvider reply prefixes > delivers global fallback through the shared dispatcher` greened on the kit's confirm-determinism re-run |
| 5 | extensions | ronan | seat (umask 0002) | failure (1) | 6208 / 39 | ENV (umask 0002); CI-parity rerun PASS | original red: `seat/results/batch-0/supplemental-extensions/` (failures are onepassword/vault file-mode tests, e.g. `creates private plans in a 493 directory…`; list in `ext-fails.txt`, 37 lines). Rerun: `seat-ext-umask022/results/batch-0/supplemental-extensions/` success (0), **6247 / 0** (73 skipped), 00:29:58Z to 00:38:07Z. Supporting: the failing files pass at both SHAs outside the kit (`baseline-gsi/summary-ext.txt`: 68 passed, 1 skipped at b51feb98eb and 08fead65d2) |
| 6 | core-runtime-infra-storage-state | ronan | seat (umask 0002), then seat-storage-umask022 | **no result.json in either run dir** | n/a | **OPEN** | see "Open rows" |
| 7 | core-unit-fast-2 | cael | seat | success (0) | 8553 / 0 | PASS | `seat/results/batch-0/node-core-unit-fast-2/` |
| 8 | core-tooling-15 | cael | seat | success (0) | 1499 / 0 (kit tally 2998, see note A) | PASS | `seat/results/batch-0/node-core-tooling-15/` |
| 9 | agentic-commands-runtime | cael | seat | success (0) | 53 / 0 | PASS | `seat/results/batch-0/node-agentic-commands-runtime/` |
| 10 | agentic-plugin-sdk | cael | seat | success (0) | 1058 / 0 | PASS | `seat/results/batch-0/node-agentic-plugin-sdk/` |
| 11 | core-runtime-config | cael | seat | failure (1) | 5411 / 1 | BASE-PRESENT | cut red: `seat/results/batch-0/node-core-runtime-config/` (cael), one failure `src/config/sessions/session-history-read.imports.test.ts > keeps history readers independent of host acquisition and decoration`. Same test fails at both SHAs on ronan: `baseline-gsi/shr-imports-{b51feb98eb,08fead65d2}.log`, each `1 failed / 1 passed` |
| 12 | core-bundled | cael | seat | success (0) | 213 / 0 | PASS | `seat/results/batch-0/supplemental-core-bundled/` |
| 13 | agentic-control-plane-runtime-server | emeric | seat | success (0) | 1534 / 0 | PASS | `seat/results/batch-0/node-agentic-control-plane-runtime-server/` |
| 14 | core-tooling-10 | emeric | seat | failure (1) | 1224 / 2 (kit tally 2448 / 4, note A) | ENV (no Ruby on emeric); ronan rerun PASS | emeric red: `seat/results/batch-0/node-core-tooling-10/ci-output.log` line 1702 `android-fastlane.sh: line 3: ruby: command not found`, under the two `test/scripts/mobile-release.test.ts` Android build failures. `command -v ruby` on emeric returns nothing. Rerun on ronan: `seat-tooling-umask022/results/batch-0/node-core-tooling-10/` success (0), **1226 / 0** (56 skipped), 03:04:02Z to 03:21:22Z (`seat-done.txt`). Supporting: `baseline-gsi/summary-rest.txt` ct10 mobile-release 12 / 0 at both SHAs |
| 15 | agentic-gateway-core-runtime | emeric | seat | success (0) | 3 / 0 | PASS | `seat/results/batch-0/node-agentic-gateway-core-runtime/` |
| 16 | agentic-control-plane-runtime-config | emeric | seat | success (0) | 80 / 0 | PASS | `seat/results/batch-0/node-agentic-control-plane-runtime-config/` |
| 17 | agentic-cli-process | emeric | seat | failure (1) | 830 / 2 | BASE-PRESENT | cut red: `seat/results/batch-0/node-agentic-cli-process/` (emeric), 2 failures `src/cli/update-cli/update-command-resume-completion.test.ts > … resume repairs an old parent's restored config before unchanged plugins (metadata=false/true)`. Same two fail at both SHAs: `baseline-gsi/cli-process-fails-{b51feb98eb,08fead65d2}.txt` (identical), `summary-rest.txt` `2 failed / 7 passed` each |
| 18 | extension-qa | emeric | seat | success (0) | 3948 / 0 | PASS | `seat/results/batch-0/supplemental-extension-qa/` |
| 19 | agentic-agents-core-models | elliott | seat | success (0) | 1111 / 0 | PASS | `seat/results/batch-0/node-agentic-agents-core-models/` |
| 20 | core-runtime-infra-process | elliott | seat | success (0) | 1551 / 0 | PASS | `seat/results/batch-0/node-core-runtime-infra-process/` |
| 21 | agentic-gateway-server-isolated | elliott | seat | failure (1) | 169 / 2 | BASE-PRESENT | cut red: `seat/results/batch-0/node-agentic-gateway-server-isolated/` (elliott), failures in `src/gateway/server.chat-cli-auth.test.ts` (`preserves account selection and session history`) and `src/gateway/server.cli-watchdog.test.ts` (`registered chat.send ends a resumed CLI stall…`). Same named test fails at both SHAs per file on ronan: `baseline-gsi/server.{chat-cli-auth,cli-watchdog}-{b51feb98eb,08fead65d2}.log`, each `1 failed / 5 passed` (`ronan-baseline-gsi-summary.txt`) |
| 22 | agentic-gateway-methods | elliott | seat | success (0) | 6484 / 0 | PASS | `seat/results/batch-0/node-agentic-gateway-methods/` |
| 23 | extension-telegram | elliott | seat | success (0) | 1514 / 0 | PASS | `seat/results/batch-0/supplemental-extension-telegram/` |
| 24 | agentic-plugins | elliott | seat | failure (1) | 5237 / 1 | BASE-PRESENT | cut red: `seat/results/batch-0/node-agentic-plugins/` (elliott), one failure `src/plugins/plugin-module-loader-cache.test.ts > getCachedPluginModuleLoader > keeps source SDK evaluation native and preserves terminal failures`. Same-seat full-shard comparison through the same kit on elliott: `cmp-plugins-b51feb98eb` failure (1), **5240 / 1**, same test; `cmp-plugins-08fead65d2` failure (1), 5237 / 1, same test. File-level on ronan: `baseline-gsi/plugins-fails-{b51feb98eb,08fead65d2}.txt` identical, `1 failed / 14 passed` each |

Note A: core-tooling-10 and core-tooling-15 logs print the same vitest summary block twice
(identical counts, durations 0.01s apart), and the kit's `summary.md` tally adds both. The table
gives the single-run vitest figure.

### Counts by disposition

| disposition | rows | n |
|---|---|---|
| PASS | 1, 2, 3, 7, 8, 9, 10, 12, 13, 15, 16, 18, 19, 20, 22, 23 | 16 |
| PASS, with recorded flake | 4 (extension-database-workers) | 1 |
| ENV, CI-parity rerun PASS | 5 (extensions, umask), 14 (core-tooling-10, Ruby) | 2 |
| BASE-PRESENT (reproduces at upstream b51feb98eb) | 11, 17, 21, 24 | 4 |
| OPEN | 6 (core-runtime-infra-storage-state) | 1 |
| total | | 24 |

The brief listed core-tooling-10 as in progress. The bytes show its ronan rerun finished at
03:21:22Z with PASS, so it is counted closed here.

## Open rows

**6 — core-runtime-infra-storage-state (ronan).** No run dir has a `result.json`.

- Original run (`seat/`, umask 0002): started 22:59:08Z and was still `running` when it was stopped
  and archived to `storage-original-umask0002-evidence/` (its `shard-state.json` was last updated
  03:02:22Z, 14589s elapsed, 16174 test lines). The attempt-1 log has 70 `×` lines
  (`failure-count.txt` = 70), mostly in `node-worker-prepared-workspace`, `snapshot/git-backup`,
  `post-core-dependency-health.integration` and `skills/lifecycle/upload-store`. `writable-signature-count.txt` = 21.
  The brief calls these privacy refusals. This receipt did not re-check that classification
  test by test. Copies: `ronan-storage-original-umask0002-*`.
- CI-parity rerun (`seat-storage-umask022/`, started 00:38:59Z): attempts 1 and 2 were killed by
  the kit's own guard, not by test failures (guard incident 2 below). **Attempt 3 is IN PROGRESS** as
  of 03:26:05Z: the vitest process for `vitest.infra.config.ts` has been running since about 01:50:21Z,
  and `shard-state.json` reads `running` with 13140 test lines at 03:25:05Z. The guard's `.hang-killed`
  marker on that shard work dir keeps the dir-age guard from firing on this shard again.

## Guard incidents (disclosed plainly)

**Incident 1: progress-aware guard false kills on the main `seat/` runs (all four seats).** At
23:52Z frond-scribe replaced the dir-age guard with `progress-guard.sh` (identical on all four
seats, sha256 prefix `5b428eb328649d18`; copy `ronan-seat-progress-guard.sh`). It treats a shard
as hung when `shard-state.json` says `running` and `test_lines` has not moved for 20 min. It then
`pkill`s that shard's work dir. Because the heartbeat state lagged behind completion, it logged
15 HANG-KILLs (00:12:27Z to 00:19:30Z) against shards that had already finished. It was stopped at
00:26Z, and each RECEIPT says so (`progress guard STOPPED … (frond-scribe error)`). Each kill was
checked against the shard's `result.json` mtime:

| seat | HANG-KILL (UTC) | shard | result.json written (UTC) |
|---|---|---|---|
| ronan | 00:12:27 | contract-checks-fast-contracts-channels-a | 23:20:39 |
| ronan | 00:12:27 | agentic-control-plane-runtime-state | 23:16:36 |
| ronan | 00:12:27 | supplemental-extension-codex-app-server-support | 23:32:05 |
| cael | 00:12:29 | agentic-commands-runtime | 23:51:48 |
| cael | 00:12:29 | core-tooling-15 | 23:37:26 |
| cael | 00:12:29 | core-unit-fast-2 | 23:42:16 |
| cael | 00:17:29 | agentic-plugin-sdk | 23:57:13 |
| cael | 00:19:30 | supplemental-core-bundled | 23:59:45 |
| emeric | 00:12:29 | agentic-control-plane-runtime-config | 23:46:06 |
| emeric | 00:12:29 | agentic-control-plane-runtime-server | 23:27:10 |
| emeric | 00:12:29 | agentic-gateway-core-runtime | 23:36:48 |
| emeric | 00:12:29 | core-tooling-10 | 23:30:55 |
| elliott | 00:12:27 | agentic-agents-core-models | 23:13:30 |
| elliott | 00:12:27 | agentic-gateway-server-isolated | 23:41:26 |
| elliott | 00:12:27 | core-runtime-infra-process | 23:23:20 |
| elliott | 00:12:27 | supplemental-extension-telegram | 23:50:10 |

All 15 results were written between about 20 and 59 minutes before the kill. Every shard on the four `seat/` runs
has exactly one `attempt-1` log (no retries), and no `ci-output.log` there contains
`died by signal` or `exited by signal`. The shards still running at 00:12Z were ronan
database-workers, extensions and storage-state, cael core-runtime-config, emeric agentic-cli-process
and elliott gateway-methods and agentic-plugins. None of them is named in any hang.log. The `pkill`
pattern is the named shard's own work dir, so it could not match them. No recorded result was
changed by this incident. Copies: `<seat>-seat-hang.log`, `<seat>-seat-RECEIPT.txt`.

**Incident 2: the kit's 60-min dir-mtime guard killed the storage-state rerun.** `fenced-seat.sh`
as shipped with the reruns had a background guard that kills any shard work dir whose mtime is 60
minutes old. Dir mtime does not track test progress. In `seat-storage-umask022` it fired at
01:49:59Z (`ronan-seat-storage-umask022-hang.log`). Attempt 1 ended `exit 143` (SIGTERM) and
attempt 2 ended `exit 137` (SIGKILL), the guard's TERM and then KILL 20s apart. Neither was a test
failure. The current `kit/fenced-seat.sh` on ronan has this guard removed (header: "removed
2026-10-06"). On elliott, `kill-dirage-guard.sh` removed the guard from the cut-side
`cmp-plugins-08fead65d2` run at 01:15:25Z (`elliott-kill-dirage-guard.log`). The upstream-side
`cmp-plugins-b51feb98eb` run took 29.4 min (00:45:42Z to 01:15:05Z), under the 60-min threshold.
Neither cmp run is affected.

## Excluded runs (listed only; not used for any row)

| seat | dir | why excluded |
|---|---|---|
| ronan | `aborted-0507f503-ronan-1557` | first launch on the 0507f503 kit at 22:55Z, aborted in pretest build (tsdown SIGKILL/143); no test results |
| elliott | `aborted-0507f503-elliott-1557` | same launch, aborted in pretest build (`exit code 143`); no test results |
| cael | `aborted-fence-refused-cael-1617` | first cael attempt (22:59Z). The relaunch RECEIPT says it was archived as excluded after a 🩸-granted reset-failed of the cael isolated-startup-memory units. Its tooling-15 and unit-fast-2 "failures" are 6s gate failures, not test results |

## Files in this directory

- `<seat>-seat-RECEIPT.txt`, `<seat>-seat-hang.log`: main fenced-run receipts and guard logs (4 seats). `emeric-seat-RECEIPT-shim.txt`: the `--no-opt` node shim grant.
- `ronan-seat-progress-guard.sh`: the incident-1 guard (byte-identical on all four seats).
- `ronan-seat-{ext,storage,tooling}-umask022-seat-{start,done}.txt`, `ronan-seat-storage-umask022-hang.log`: rerun timing and the incident-2 log. These reruns have no RECEIPT.txt.
- `elliott-cmp-plugins-*`: same-seat comparison run script (🌊 grant 1556829698959482941), timings, and the guard-removal script and log.
- `ronan-baseline-gsi-{run,run-ext,run-rest}.sh`, `ronan-baseline-gsi-summary*.txt`: upstream-baseline reproduction scripts and summaries. These are file-level (`scripts/run-vitest.mjs`, `--maxWorkers=1`, node v24.17.0, `pnpm install --frozen-lockfile` in a detached worktree per SHA) and run outside the fenced kit.
- `ronan-storage-original-umask0002-{failure-count,writable-signature-count}.txt`, `…-shard-state.json`: the stopped original storage-state run.

Large `ci-output.log` files are not copied. They stay at the cited paths on each seat.
