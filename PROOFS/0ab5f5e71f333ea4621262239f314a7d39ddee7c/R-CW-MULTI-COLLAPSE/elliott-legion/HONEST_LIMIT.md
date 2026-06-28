# R-CW-MULTI-COLLAPSE — elliott-legion honest-limit at ship SHA 2723dbee

**Seat:** elliott-legion
**Capture/ship SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3`
**Disposition:** ⚠️ **HONEST_LIMIT** — source/test substrate is pinned and green, but a live elapsed-overlap stale-fold fire is not ethically/operationally induced on this worker session because the current configured fold grace is 48h.

## What this row tests

`R-CW-MULTI-COLLAPSE` is the grace-conditional multi-`continue_work()` collapse behavior:

- close/on-time matured siblings within grace must **all drive**;
- genuinely stale queued backlog older than the grace folds older siblings into the newest election;
- recovered/running work must **never** be folded out from under an in-flight turn;
- elapsed model-turn time before scheduling must not pre-collapse a same-turn multi-election batch.

## Source byte at exact ship SHA

`source-test-byte.txt` captures the exact deployed source and tests from `2723dbee783c113cae70e4fb63a4cff9f55402e3`.

Key source bytes:

- `src/auto-reply/continuation/work-dispatch.ts` defines `SUPERSEDED_GRACE_MULTIPLIER = 2`.
- `dispatchPendingContinuationWork` computes `supersededGraceMs = runtimeConfig.maxDelayMs * SUPERSEDED_GRACE_MULTIPLIER` before calling `partitionSupersededWork`.
- `partitionSupersededWork`:
  - keeps a single newest-elected member by `electedAt`, tie-broken by `hop`;
  - only marks queued, non-newest work as superseded when `now - work.dueAt > graceMs`;
  - always drives `status === "running"` work, regardless of age.

Key test bytes:

- `work-dispatch.test.ts` pins stale older siblings folding into newest, close bursts within grace preserving all, stale running work never folding, and mixed running/queued behavior.
- `attempt-execution.continue-work-opts.test.ts` pins that same-turn multi-`continue_work()` elections schedule independent rows, and that elapsed model-turn time before post-turn scheduling does not collapse/pre-mature that batch.

## Test receipt

Narrow test command run locally on elliott at the exact ship checkout (`/home/figs/flesh_beast_tmp/openclaw` HEAD = `2723dbee783c113cae70e4fb63a4cff9f55402e3`):

```bash
cd /home/figs/flesh_beast_tmp/openclaw
node scripts/run-vitest.mjs run \
  src/auto-reply/continuation/work-dispatch.test.ts \
  src/agents/command/attempt-execution.continue-work-opts.test.ts
```

Result (`rcw-multi-collapse-vitest-2723.log`, summarized in `test-summary.txt`):

```text
PASS — 2 Vitest project shards passed in 25.48s
auto-reply: src/auto-reply/continuation/work-dispatch.test.ts — 71 tests passed
agents: src/agents/command/attempt-execution.continue-work-opts.test.ts — 15 tests passed
```

## Why this is HONEST_LIMIT, not PASS

The issue #118 acceptance asks for the live behavior, not only mocked/static proof. I did not claim live PASS.

Current elliott continuation config (`gateway-config-continuation.json`) reports:

```json
{
  "maxDelayMs": 86400000,
  "derived": {
    "supersededGraceMultiplier": 2,
    "supersededGraceMs": 172800000,
    "supersededGraceHuman": "48h"
  }
}
```

Because the production fold condition is strict `now - work.dueAt > graceMs`, a live stale-fold fire under current config requires queued work to sit overdue for **more than 48 hours** before co-drain, or else a deliberate temporary production config mutation to shrink `agents.defaults.continuation.maxDelayMs`. I did neither from this clean worker channel.

So the byte-grounded state is:

- ✅ deployed source implements the grace-conditional fold exactly at `2723dbee`;
- ✅ deterministic source-level tests for the row are green (`86/86` across the two narrow files);
- ⚠️ live elapsed-overlap stale-fold capture remains not performed here because the configured live grace is 48h and shrinking it would be a production config mutation rather than a normal proof fire.

## Verdict

⚠️ **HONEST_LIMIT** — source/test substrate green and exact-SHA pinned, but live proof remains owed unless the proof plan explicitly authorizes either a 48h+ stale-backlog wait or a coordinated temporary maxDelayMs reduction/restoration window.
