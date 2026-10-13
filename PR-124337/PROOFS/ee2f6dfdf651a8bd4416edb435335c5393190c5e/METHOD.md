# Method

## What runs

`harness/boundary-proof.mts` imports the **production modules from the tree under test** (`--tree`) and drives them end to end, with no vitest and no mocks of the modules under test:

```
transport raw event
  -> createChannelIngressMonitor            (what channel plugins call; owns admit + drain)
    -> createChannelIngressQueue            (real SQLite durable queue, temp state dir)
    -> createChannelIngressDrain            (claim, lifecycle, retry disposition)
      -> bindIngressLifecycleToReplyOptions + fanInChannelIngressLifecycles
         + createInboundDebouncer           (the channel hand-off shape, e.g. Discord/WhatsApp)
        -> enqueueFollowupRun               (the real reply/followup queue; session busy)
          -> terminal lifecycle             (clearFollowupQueue on gateway restart-drain,
                                             or queue-cap rejection) -> the drain settles the SQLite row
```

## What is not production

- There is no gateway HTTP/WebSocket server and no real transport socket.
- The channel plugin is a ~40-line stand-in (inspect/codec/deliver), configured like `extensions/sms/src/ingress-spool.ts`.
- The agent turn is a stub. It adopts through the production helper `admitFollowupRunLifecycle` (what `followup-turn-admission.ts` calls), then completes. No model is called.
- "Session busy" is modelled the way `agent-runner-run.ts` does it: `enqueueFollowupRun(..., restartIfIdle = false)` while a run owns the lane.
- The retry policy uses the plugin-level override shape (Discord passes `deadLetterMinAgeMs: 0`). `maxAttempts` is lowered to 3 and backoff to 0/150 ms so each scenario finishes in seconds.
- "Gateway stop" is `markGatewayRestartDraining("stop (proof)")`, the production restart-drain entry point, inside the same process. A2 then runs as a **separate process** against the same state dir.

## Environment

- Node `v26.9.0` (nvm), Linux aarch64 (20 cores). Runs made on 2026-10-13.
- Both trees were checked out in turn in one worktree (`git checkout --detach -f <sha>`, then `git clean -fd` keeping `node_modules`), each followed by `pnpm install --frozen-lockfile`. The lockfile is identical at head and control (`pnpm-lock.yaml` blob `cdac8854c528e1d54b4c4d08d613997c6b284c1b`).
- Head `ee2f6dfdf651a8bd4416edb435335c5393190c5e` (safe-branch candidate; upstream #124337 at `e682f7cc17` when this ran). Control `042db1e7064930a08c534c4487864d7bfb8c5287`. Each log's first line records the tree's `HEAD`.
- Every process ran under `nice -n 15` and `timeout 600`, with no CPU pinning (no `taskset`).

## Commands

`harness/proof-rerun.sh` ran this rerun, as `SCRATCH=<dir> bash harness/proof-rerun.sh`. It runs only this PR's harness and exits 1 unless every install and every phase exits 0.

Layout under `$SCRATCH`, as the executed run used it: inputs `openclaw/` (a clone with both SHAs fetched), `gate25-F/` (the one worktree) and `proof-124337/harness/` (holding this corpus's `boundary-proof.mts`); outputs `proof-124337d/rerun/<side>-<scenario>/state` and `proof-124337d/logs/<side>-<phase>.log`, of which this corpus's `logs/` is a copy. The published script is the executed one with line 5 (`S0=…`) changed to read `SCRATCH`. For each `<side>` (head, then control) it runs, each scenario with a fresh state dir and A2 reusing A1's:

```bash
H=harness/boundary-proof.mts
for ph in A1 A2 B; do
  st=<scratch>/rerun/<side>-${ph%[12]}/state   # A1 and A2 share a dir; B has its own
  (cd <tree> && nice -n 15 timeout 600 node --import <tree>/scripts/tsx.mjs "$H" --tree <tree> --state "$st" --phase "$ph")
done
```

It then replaces `$HOME` and the hostname in each log and strips ANSI colour codes.

Every run exited 0 (`### exit=0` at the end of each log). The `[verdict]` line in each log is computed by the harness from the final SQLite row projection that it prints just before it.

## Reading a log

- `[sqlite] … {msg-1 status=… attempts=… last_error=… failed_reason=…}`: a direct projection of the durable ingress row.
- `[drain-log]`: the drain's own log lines. Head B shows `reached retry limit after 3 attempts; dead-lettered`.
- `[queue] poll N: pending=[…] failed=[…]`: the queue state between drain passes.
