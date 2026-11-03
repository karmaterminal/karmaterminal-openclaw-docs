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

- Node `v26.9.0` (nvm), Linux x86-64.
- Both trees are clean detached worktrees with dependencies installed from the shared lockfile, which is identical at head and control.
- Head `b2d5e48e5b59da6d1d29b2bfb7b2af51aee58f0a`, dirty=0.
- Control `363b9d0ae746cde25d0846ce8a05e962bef4f26e`, dirty=0.

## Commands

The same commands run for each `<tree>` (head, then control), each scenario with a fresh state dir; A2 reuses A1's:

```bash
H=harness/boundary-proof.mts
for ph in A1 A2 B; do
  st=<scratch>/rerun/<side>-${ph%[12]}/state   # A1 and A2 share a dir; B has its own
  (cd <tree> && node --import <tree>/scripts/tsx.mjs "$H" --tree <tree> --state "$st" --phase "$ph")
done
```

Every run exited 0. The `[verdict]` line in each log is computed by the harness from the final SQLite row projection that it prints just before it.

## Reading a log

- `[sqlite] … {msg-1 status=… attempts=… last_error=… failed_reason=…}`: a direct projection of the durable ingress row.
- `[drain-log]`: the drain's own log lines. Head B shows `reached retry limit after 3 attempts; dead-lettered`.
- `[queue] poll N: pending=[…] failed=[…]`: the queue state between drain passes.
