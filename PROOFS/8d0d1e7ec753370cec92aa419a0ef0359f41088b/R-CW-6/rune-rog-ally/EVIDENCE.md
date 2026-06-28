# R-CW-6 — chain-depth-boundary reject — rune-rog-ally + cael-dgx completion

**Seat:** `rune-rog-ally` source/test evidence, completed by `cael-dgx` live cap byte  
**Capture/ship SHA:** `2723dbee783c113cae70e4fb63a4cff9f55402e3`  
**Disposition:** ✅ **PASS** — source boundary + direct scheduler unit + live lowered-cap rejection byte + restored-settings proof.

## What this row tests

R-CW-6 is the continuation chain-depth boundary: once continuation chain state reaches `maxChainLength`, the next continuation election must be rejected instead of extending the lineage forever.

The deployed source boundary is in `src/auto-reply/continuation/scheduler.ts:19-38`:

```ts
const allocatedChainHop = chainState.currentChainCount;

if (allocatedChainHop >= config.maxChainLength) {
  log.info(
    `[continuation] Chain depth ${allocatedChainHop}/${config.maxChainLength} — capped for session ${sessionKey}`,
  );
  return "chain-capped";
}
```

That is the row's core condition: `currentChainCount >= maxChainLength` returns `chain-capped`.

## Source/test bytes retained from Rune

`chain-depth-source-and-test-byte.txt` captures the exact deployed SHA source around the boundary and the related tests:

- `src/auto-reply/continuation/scheduler.test.ts:17-37` — `returns chain-capped at max depth` asserts `currentChainCount: 10`, `maxChainLength: 10` returns `"chain-capped"`.
- `src/auto-reply/continuation/work-dispatch.test.ts:1608-1632` — `schedules the valid elections and caps the overflow without dropping the earlier ones` uses `maxChainLength: 2`; the captured assertions prove the batch accounting surface: `scheduledCount: 2`, `cappedCount: 1`, `capped: true`, and `chainState.currentChainCount: 2`.

The earlier broad filtered local test receipt (`rune-rcw6-test-2723dbee-20260628T033143Z.log`) remains diagnostic: direct scheduler coverage passed, while an unrelated durable-dispatch delivery assertion in the broad selector failed (`deliveredReasons=[]`). This PASS does not rely on that fragile delivery assertion.

## Why the earlier low-cap attempts were not accepted

Rune's original low-cap attempt lowered `maxChainLength: 200 → 2`, but queued delegates replayed after restore under `maxChainLength=200`; journal showed `hop=2/200`, `hop=3/200`, `hop=4/200`, `dispatched=3 rejected=0`. That proved the original attempt was not a valid cap proof.

Cael's first two follow-up attempts were also not accepted:

1. Same-session `continue_work` overlap under `maxChainLength=1` produced a valid hop-1 registry row, but did not produce an over-cap rejection byte. This matches the known multi-`continue_work` capture/compression shape, not the nested delegate-chain boundary that R-CW-6 is meant to prove.
2. A nested delegate attempt was restored too early; the child attempted its grandchild after restored `maxChainLength=200`, and the grandchild ran. That attempt is diagnostic only.

frond-scribe clarified the correct proof surface in-room: continuation depth caps are for limiting delegate-chain length; the valid live proof shape is a nested delegate attempting a grandchild hop over the lowered cap.

## Live cap-hit proof from Cael

Cael temporarily lowered continuation config for a clean nested proof retry, then restored it after the cap byte was observed.

### Lowered config receipt

Live file and `openclaw status` after external restart showed:

```json
{
  "enabled": true,
  "maxChainLength": 1,
  "costCapTokens": 500000,
  "contextPressureThreshold": 0.4,
  "maxDelegatesPerTurn": 500,
  "maxDelayMs": 1000,
  "defaultDelayMs": 1000,
  "minDelayMs": 1000,
  "crossSessionTargeting": "enabled"
}
```

Status confirmed:

```text
Continuation         │ enabled · chain max 1 · fan-out max 500
```

Files captured under `/tmp/rcw6-cael-final/` include:

- `config-lowcap2-file.json`
- `config-lowcap2-validate.txt`
- `post-lowcap2-restart-check.txt`

### The cap byte

At the live lowered cap, the runtime emitted the required rejection:

```text
2026-06-28T02:12:20.562-07:00 [agents/agent-command] [continuation:work-rejected] chain-capped for agent:main:discord:channel:1466192485440164011: 1/1
```

This is the live R-CW-6 acceptance byte: the runtime rejected continuation work because the active chain was already at `1/1` under the temporary cap.

The post-restore verification file `final-cap-and-restore-verify.txt` captures the journal byte directly:

```text
Jun 28 02:12:20 cael node[3312520]: 2026-06-28T02:12:20.562-07:00 [agents/agent-command] [continuation:work-rejected] chain-capped for agent:main:discord:channel:1466192485440164011: 1/1
```

### Nested delegate retry notes

The nested delegate retry was fired while the cap was lowered; frond-scribe restored the config immediately after seeing the cap byte. Subsequent delegate replay under restored config is not used as the cap proof. The proof rests on the explicit `work-rejected` / `chain-capped` byte above.

## Restored-settings proof

After the cap byte was observed, frond-scribe restored `/tmp/rcw6-cael/openclaw.json.original` and restarted Cael's gateway. Cael independently verified restored config:

```json
{
  "enabled": true,
  "maxChainLength": 200,
  "costCapTokens": 500000,
  "contextPressureThreshold": 0.4,
  "maxDelegatesPerTurn": 500,
  "maxDelayMs": 86400000,
  "defaultDelayMs": 15000,
  "minDelayMs": 5000,
  "crossSessionTargeting": "enabled"
}
```

`openclaw status` confirmed:

```text
Continuation         │ enabled · chain max 200 · fan-out max 500
```

Captured in `/tmp/rcw6-cael-final/final-cap-and-restore-verify.txt` and `/tmp/rcw6-cael-final/current-after-interrupt.txt`.

## Verdict

✅ **PASS.** R-CW-6 now has all required layers:

- source boundary: `currentChainCount >= maxChainLength → chain-capped`
- direct scheduler unit: `returns chain-capped at max depth`
- cap-accounting test byte: `scheduledCount: 2`, `cappedCount: 1`, `capped: true`
- live lowered-cap runtime rejection: `[continuation:work-rejected] chain-capped ... 1/1`
- restored production config proof: `maxChainLength=200`, `min/default/maxDelayMs=5000/15000/86400000`, `costCapTokens=500000`

Only `R-RC-2/request_compaction` remains an acceptable `HONEST_LIMIT` in the final corpus.
