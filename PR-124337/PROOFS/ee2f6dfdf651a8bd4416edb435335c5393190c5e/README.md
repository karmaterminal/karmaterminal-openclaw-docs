# PR #124337 exact-head proof corpus

This corpus is bound to the **safe-branch candidate `ee2f6dfdf651a8bd4416edb435335c5393190c5e`** (`karmaterminal/openclaw` `gloss/124337-backmerge-20261011`). Upstream #124337 still pointed at `e682f7cc17` when this ran; the PR branch is fast-forwarded to `ee2f6dfdf6` only after this corpus and the code are reviewed. **It executes those exact bytes.** The control is the same harness, unchanged, on `042db1e706`, upstream main and the back-merge's second parent.

## What changed since the 0cb65da5f2 corpus

Six commits, for ClawSweeper's review of `e682f7cc17` (itself `0cb65da5f2` plus one oxfmt-only commit):
- `e682f7cc17`: oxfmt only.
- `7cab4e61eb` **[P1]**: LINE's webhook spool ends ownership of an unhanded delivery at shutdown through `fannedIn.cancel()` instead of `abandon()`, so a row at the retry ceiling is not dead-lettered on stop. A new test pins the active-delivery-return case at the ceiling; it fails with only that fix reverted.
- `2b67393ddd`, `5c214fa2a4`, `cd45f79821` **[P3]**: every polling wait (`vi.waitFor`) this PR added is replaced by an owned settlement signal: the queue's committed write (`observeChannelIngressQueueWrite`, plus the new `observeChannelIngressQueueWrites` for several events), the drain's `claimNext` commit, or deferreds that the owned turns resolve. Test-only.
- `ee2f6dfdf6`: two lint fixes in Slack tests (a bound `claimNext`, an unused import).

The boundary under test here (the core reply/ingress cancellation and abandonment) is unchanged by these commits, so the verdicts below are expected to match the `0cb65da5f2` corpus, and they do.

Gate receipt at `ee2f6dfdf6`, on the same host as these runs: install, `tsgo` x4, and 35/35 selected tests passed. `pnpm check` fails only in its lint step, and none of the reported errors is in a file this PR touches (the runner intersects the reported files with the PR's diff against `042db1e706`: 0).

## Verdict: PASS. Head and control differ in exactly the two ways the PR claims.

| Scenario | Head `ee2f6dfdf6` | Control `042db1e706` (upstream main; second parent of the merge) |
| --- | --- | --- |
| **A1, intentional cancellation.** A message is durably admitted and deferred into the reply/followup queue behind a busy session. Then the gateway stops (restart-drain clears the followup queue). | **Budget-free.** The row returns to `pending` with `attempts=0` and no `lastError`. [log](logs/head-A1.log) | **Charged.** The row returns to `pending` with `attempts=1` and `lastError=turn-abandoned`. [log](logs/control-A1.log) |
| **A2, restart.** A fresh process drains the same state dir. | `msg-1` is redelivered, adopted and completed, with `attempts=0`. [log](logs/head-A2.log) | `msg-1` is redelivered, adopted and completed, carrying the `attempts=1` the cancellation charged. [log](logs/control-A2.log) |
| **B, genuine pre-adoption abandonment.** The reply queue is at cap (`cap=1, dropPolicy=new`), so every delivery of `msg-1` is abandoned before adoption, with `maxAttempts=3` and `deadLetterMinAgeMs=0` (Discord's shape). `msg-2` waits on the same lane. | **Bounded.** On its 3rd delivery `msg-1` goes `failed` with `retry-limit-exceeded` / `turn-abandoned`. The persisted row shows `attempts=2`, because the terminal disposition doesn't increment the counter; the drain logs `reached retry limit after 3 attempts`. The lane then releases. `msg-2` is abandoned once while the session is still busy (`attempts=1`), then adopted and **completed** once the session frees. [log](logs/head-B.log) | **Not bounded within the observation window.** `msg-1` stays `pending` while `attempts` climbs past `maxAttempts`. The harness stopped observing at `attempts=6`, twice the limit. It hadn't dead-lettered by then, and `msg-2` was **not dispatched** during the window (`pending`, `attempts=0`): the lane stayed blocked. [log](logs/control-B.log) |

That is ClawSweeper's ask on this PR, shown through the channel → durable ingress queue → drain → reply-queue boundary:
- cancellation stays budget-free;
- genuine abandonment reaches the retry limit;
- the next lane row progresses.

**Comparison with the `0cb65da5f2` corpus.** Every `[verdict]` line and every final SQLite row matches it: control A1 charged `attempts=1`, control B stopped at `attempts=6` with `msg-2` undispatched, head B dead-lettered `msg-1` at `attempts=2` and completed `msg-2` at `attempts=1`.

## Files

- [`METHOD.md`](METHOD.md): what the harness wires, what is production and what isn't, and exact commands
- [`RESOLVED-SHA.md`](RESOLVED-SHA.md): identities
- [`proofs-manifest.json`](proofs-manifest.json): rows A1, A2 and B with their evidence files
- [`harness/boundary-proof.mts`](harness/boundary-proof.mts): the harness, sha256 `d433fe2787c514931d48462f06242160c111d4bfde6aedfe942191e49e261645` (same bytes as the `0cb65da5f2` and `b2d5e48e5b` corpora)
- [`harness/proof-rerun.sh`](harness/proof-rerun.sh): the runner for this rerun (this PR's harness only; it exits 1 unless every install and every phase exits 0; replay with `SCRATCH=<dir> bash harness/proof-rerun.sh`), sha256 `f433bee0eb70d4d8b9e60db1431c6b9f39347babc35b46d4f2225d8c6c2f3b9e`
- `logs/{head,control}-{A1,A2,B}.log`: raw output with ANSI stripped and the home directory and hostname replaced by `<home>` / `<host>`. Each log starts with a `### <side> / <phase> / tree <sha>` line and ends with the exit code. The SQLite row projections are inline (`[sqlite] …`).

No credentials, provider or channel identifiers, hostnames or message bodies appear. All messages are synthetic (`msg-1`, `msg-2`, `blocker`).
