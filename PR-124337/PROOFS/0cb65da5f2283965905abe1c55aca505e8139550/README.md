# PR #124337 exact-head proof corpus

This corpus is bound to the PR head **`0cb65da5f2283965905abe1c55aca505e8139550`**: the previous PR head `51631e61a238de75ae0207af541b341e6edeac0e` with upstream main `042db1e7064930a08c534c4487864d7bfb8c5287` merged in, plus two test-only follow-ups:
- `8853b1ae51` Merge upstream main into ingress retry-budget abandonment
- `c6cfd25c54` test(reply): import path for upstream's moved dispatch fixtures
- `0cb65da5f2` test(slack): the cancellation test's mocks spread the real modules, for the mock-export ratchet

**It executes those exact bytes.** The control is the same harness, unchanged, on `042db1e706`, upstream main and the merge's second parent.

## What changed since 51631e61a2

The merge ported the PR onto upstream's refactor of the reply and channel delivery code. The behaviour under test is the same:
- `completeFollowupRuns` forwards a disposition.
- Summary consumption keeps its settlement argument; upstream's `false` maps to `"retained"`.
- `dropAbortedFollowups` stays in `aborted-followups.ts` and uses `completeFollowupRuns(.., "cancelled")`.
- The feishu broadcast gets a `"cancelled"` lane state on upstream's pending/deferred/completed/failed model.
- feishu flush/delivery, slack and telegram regain `onCancelled`.
- The telegram abort-reason mapping lives in `abortedProcessingResult`.

The two follow-up commits change tests only.

Gate receipt, on the same host as these runs: install, `tsgo` x4, and 35/35 selected tests passed. `pnpm check` fails the same three pre-existing ratchets as control `042db1e706` (line-cap growth, a max-lines suppression, an assertion without a SAFETY comment).

## Verdict: PASS. Head and control differ in exactly the two ways the PR claims.

| Scenario | Head `0cb65da5f2` | Control `042db1e706` (upstream main; second parent of the merge) |
| --- | --- | --- |
| **A1, intentional cancellation.** A message is durably admitted and deferred into the reply/followup queue behind a busy session. Then the gateway stops (restart-drain clears the followup queue). | **Budget-free.** The row returns to `pending` with `attempts=0` and no `lastError`. [log](logs/head-A1.log) | **Charged.** The row returns to `pending` with `attempts=1` and `lastError=turn-abandoned`. [log](logs/control-A1.log) |
| **A2, restart.** A fresh process drains the same state dir. | `msg-1` is redelivered, adopted and completed, with `attempts=0`. [log](logs/head-A2.log) | `msg-1` is redelivered, adopted and completed, carrying the `attempts=1` the cancellation charged. [log](logs/control-A2.log) |
| **B, genuine pre-adoption abandonment.** The reply queue is at cap (`cap=1, dropPolicy=new`), so every delivery of `msg-1` is abandoned before adoption, with `maxAttempts=3` and `deadLetterMinAgeMs=0` (Discord's shape). `msg-2` waits on the same lane. | **Bounded.** On its 3rd delivery `msg-1` goes `failed` with `retry-limit-exceeded` / `turn-abandoned`. The persisted row shows `attempts=2`, because the terminal disposition doesn't increment the counter; the drain logs `reached retry limit after 3 attempts`. The lane then releases. `msg-2` is abandoned once while the session is still busy (`attempts=1`), then adopted and **completed** once the session frees. [log](logs/head-B.log) | **Not bounded within the observation window.** `msg-1` stays `pending` while `attempts` climbs past `maxAttempts`. The harness stopped observing at `attempts=6`, twice the limit. It hadn't dead-lettered by then, and `msg-2` was **not dispatched** during the window (`pending`, `attempts=0`): the lane stayed blocked. [log](logs/control-B.log) |

That is ClawSweeper's ask on this PR, shown through the channel → durable ingress queue → drain → reply-queue boundary:
- cancellation stays budget-free;
- genuine abandonment reaches the retry limit;
- the next lane row progresses.

**Comparison with the `b2d5e48e5b` corpus.** Every verdict and every final SQLite row matches it. Control A1 charged `attempts=1` in this run, as in the `b2d5e48e5b` logs; an earlier run there charged `attempts=2`. The number charged depends on whether a redelivery lands during the drain, so control A1 is `attempts≥1`, not a fixed value. Head A1 has been `attempts=0` in every run. Two log-shape differences, neither in a verdict: head B's first poll shows `msg-1:attempts=2` because two deliveries landed before it (the `b2d5e48e5b` run polled between them; poll 2 is not printed here), and control B's printed polls skip 6 instead of 5. The `[sqlite]`, `[result]` and `[verdict]` lines are otherwise identical to the `b2d5e48e5b` logs.

## Files

- [`METHOD.md`](METHOD.md): what the harness wires, what is production and what isn't, and exact commands
- [`RESOLVED-SHA.md`](RESOLVED-SHA.md): identities
- [`proofs-manifest.json`](proofs-manifest.json): rows A1, A2 and B with their evidence files
- [`harness/boundary-proof.mts`](harness/boundary-proof.mts): the harness, sha256 `d433fe2787c514931d48462f06242160c111d4bfde6aedfe942191e49e261645` (same bytes as the `b2d5e48e5b` corpus)
- [`harness/proof-rerun.sh`](harness/proof-rerun.sh): the runner for this rerun, sha256 `2fc7b5f8d622502762d22f6491cb41530e5ee44f100de36762fa7b184d2877a7`
- `logs/{head,control}-{A1,A2,B}.log`: raw output with ANSI stripped and the home directory and hostname replaced by `<home>` / `<host>`. Each log starts with a `### <side> / <phase> / tree <sha>` line and ends with the exit code. The SQLite row projections are inline (`[sqlite] …`).

No credentials, provider or channel identifiers, hostnames or message bodies appear. All messages are synthetic (`msg-1`, `msg-2`, `blocker`).
