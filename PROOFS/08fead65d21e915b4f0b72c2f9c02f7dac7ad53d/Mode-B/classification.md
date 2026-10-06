## Mode-B at cut candidate `08fead65d21e915b4f0b72c2f9c02f7dac7ad53d`: classified against baseline

| | run | product SHA | conclusion | pass / fail / skip |
|---|---|---|---|---|
| candidate | [37333667018](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/37333667018) | `08fead65d21e915b4f0b72c2f9c02f7dac7ad53d` | failure | 47 / 32 / 8 |
| baseline | [37168081387](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/37168081387) | `680dc9e0220cb1cf3fe9879445107c508df0e732` | failure | 44 / 35 / 8 |

**Every candidate red is base-present.** For each failed job I compared the sorted set of `GATE_FAIL` lines and failing test names against the same-named baseline job, and all 31 are identical. The 32nd is `aggregate + status`, the rollup. `static gates` has a SHA in its job name, so I matched it by hand: the identical SQLite worker ratchet `1541 -> 1544` in `session-accessor.sqlite-recipient-authority.ts`, which is #1417's accepted step-6 trade. **No red is new at the cut.**

Base-present classes:
- **Dist-fence refusal before Vitest** (`Cannot verify that test preparation is separate from managed Gateway artifacts`, 0 Vitest shards): ct-10, ct-15 and most hosted batches. Tracked in **#1421**. Those shards **ran no tests in either run**, so this is a coverage gap, not a pass.
- **Tooling:**
  - ct-1 `release-wrapper-scripts`
  - ct-2 `package-acceptance-workflow` (`ERR_MODULE_NOT_FOUND @openclaw/normalization-core`)
  - ct-11 withdrawn-appcast mock-`gh`
  - ct-16 `check-database-worker-ratchet.test.ts`
- **Product suites, same failing names on both runs:**
  - `doctor-maintenance.native-identity` ×7
  - `daemon/service.test.ts` FreeBSD ownership
  - the remaining hosted batches, identical per job

**Candidate is better than baseline:** three base-red jobs are green here.
- `core-tooling-4` and `core-tooling-9`: database-worker routing tests.
- `hosted(auto-reply-continuation, …)`: `nonexistent-target-session-delivery.race.test.ts` "branch 3 — target deleted during dispatch race", the stale-recipient ack case.

Shard-level receipts were cross-checked with 🌻 (ct-2/10/11/15/16). Next: a live check at `08fead65d2` under 🕯's grant. The presentation promote/hold call stays with 🌊.

