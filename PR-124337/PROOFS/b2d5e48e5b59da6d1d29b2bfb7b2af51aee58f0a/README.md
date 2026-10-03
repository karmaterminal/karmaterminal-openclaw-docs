# PR #124337 exact-head proof corpus

This corpus is bound to the PR head **`b2d5e48e5b59da6d1d29b2bfb7b2af51aee58f0a`**, two commits on upstream main `363b9d0ae746cde25d0846ce8a05e962bef4f26e`:
- `808f1564aa` fix(reply): carry queued-turn cancellation through the reply terminal lifecycle
- `b2d5e48e5b` fix(ingress): bound pre-adoption abandonment with the existing retry budget

**It executes those exact bytes.** Earlier corpora in this directory ran a fleet composite carrying a cherry-picked variant; this one does not. The control is the same harness on `363b9d0ae7`, the first parent of the tested two-commit series, which was upstream main when the proof ran. The hosted PR's base is upstream `main` and moves on; the head merges cleanly into `44cdd57720`.

## Verdict: PASS. Head and control differ in exactly the two ways the PR claims.

| Scenario | Head `b2d5e48e5b` | Control `363b9d0ae7` (series parent; upstream main at execution) |
| --- | --- | --- |
| **A1, intentional cancellation.** A message is durably admitted and deferred into the reply/followup queue behind a busy session. Then the gateway stops (restart-drain clears the followup queue). | **Budget-free.** The row returns to `pending` with `attempts=0` and no `lastError`. [log](logs/head-A1.log) | **Charged.** The row returns to `pending` with `attempts≥1` and `lastError=turn-abandoned`. [log](logs/control-A1.log) |
| **A2, restart.** A fresh process drains the same state dir. | `msg-1` is redelivered, adopted and completed, with `attempts=0`. [log](logs/head-A2.log) | `msg-1` is redelivered and completed, carrying the attempts the cancellation charged. [log](logs/control-A2.log) |
| **B, genuine pre-adoption abandonment.** The reply queue is at cap (`cap=1, dropPolicy=new`), so every delivery of `msg-1` is abandoned before adoption, with `maxAttempts=3` and `deadLetterMinAgeMs=0` (Discord's shape). `msg-2` waits on the same lane. | **Bounded.** On its 3rd delivery `msg-1` goes `failed` with `retry-limit-exceeded` / `turn-abandoned`. The persisted row shows `attempts=2`, because the terminal disposition doesn't increment the counter; the drain logs `reached retry limit after 3 attempts`. The lane then releases, and once the session frees, `msg-2` is adopted and **completed**. [log](logs/head-B.log) | **Not bounded within the observation window.** `msg-1` stays `pending` while `attempts` climbs past `maxAttempts`. The harness stopped observing at `attempts=6`, twice the limit. It hadn't dead-lettered by then, and `msg-2` was **not dispatched** during the window: the lane stayed blocked. [log](logs/control-B.log) |

That is ClawSweeper's ask on this PR, shown through the channel → durable ingress queue → drain → reply-queue boundary:
- cancellation stays budget-free;
- genuine abandonment reaches the retry limit;
- the next lane row progresses.

**Variance, stated honestly.** On control A1, the number charged depends on whether a redelivery lands during the drain: one run charged `attempts=1` (these logs), an earlier run charged `attempts=2`. Head A1 was `attempts=0` in both runs.

## Files

- [`METHOD.md`](METHOD.md): what the harness wires, what is production and what isn't, and exact commands
- [`RESOLVED-SHA.md`](RESOLVED-SHA.md): identities
- [`proofs-manifest.json`](proofs-manifest.json): rows A1, A2 and B with their evidence files
- [`harness/boundary-proof.mts`](harness/boundary-proof.mts): the harness, sha256 `d433fe2787c514931d48462f06242160c111d4bfde6aedfe942191e49e261645`
- `logs/{head,control}-{A1,A2,B}.log`: raw output with ANSI stripped and local paths replaced by `<scratch>` / `<home>`. The SQLite row projections are inline (`[sqlite] …`).

No credentials, provider or channel identifiers, hostnames or message bodies appear. All messages are synthetic (`msg-1`, `msg-2`, `blocker`).
