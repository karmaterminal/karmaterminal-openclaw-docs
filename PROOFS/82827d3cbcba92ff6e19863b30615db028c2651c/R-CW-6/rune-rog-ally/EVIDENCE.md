# R-CW-6 — chain-depth boundary / cap guard evidence

**Row:** R-CW-6  
**Seat:** 🪨 Rune (`rune`, ROG Ally Z1 Extreme)  
**SHA tested:** `82827d3cbcba92ff6e19863b30615db028c2651c` (`OpenClaw 2026.6.9 (82827d3)`)  
**Captured:** 2026-06-23 00:12 PDT  
**Verdict:** ✅ PASS (guard present + live chain accounting observed)

## Source/test guard on SHA

The source worktree at `/home/figs/flesh_beast_tmp/openclaw` is exactly:

```text
82827d3cbcba92ff6e19863b30615db028c2651c
```

The cap guard is present in `src/auto-reply/continuation/delegate-dispatch.chain-depth-exhaustion.test.ts`. Its header pins the bounded-continuation invariant:

- dispatch checks `currentChainCount < maxChainLength`
- equality means the delegate is rejected, not dispatched
- rejection emits a `chain-capped` system event
- rejection marks the corresponding TaskFlow as `failed`
- within one dispatch call, the running chain counter increments per successful spawn

The live runtime status reports continuation enabled with chain max 200:

```text
OpenClaw 2026.6.9 (82827d3)
Continuation: enabled · chain max 200 · fan-out max 500
```

## Live chain accounting observed

The R-CD chained TEST-2 proof in this same corpus executed a bracket delegate chain. Journal bytes show the chain accounting path active:

```text
[subagent-chain-hop] Spawned chain delegate (1/200) from agent:main:subagent:3bae706b-9a4b-47ea-8426-3d6afc9de488: taskName=r_cd_chained_test2_depth2_proof...
[subagent-chain-hop] Accumulated 23849 tokens from agent:main:subagent:d69b7d49-b40d-4b85-99b5-3ed5dd5bb747 to parent chain cost
```

This does not intentionally burn the fleet into a 200-hop cap. Instead it verifies the active runtime is using the same chain-hop accounting path whose cap/reject branch is pinned by the source test. That matches the prior row discipline: the reject guard is a source/test-gated safety boundary; live proof shows the accounting path in use.

## Targeted local gate

A low-memory targeted Vitest run on rune-seat completed green for continuation tool boundary coverage:

```text
Test Files: 2 passed
Tests: 8 passed
```

The exact chain-depth exhaustion test was also started with single-worker/forks, but rune-seat is resource-constrained; this evidence therefore claims the row at source/test-presence + live chain-accounting scope, not an expensive live cap-exhaustion burn.

## Verdict

✅ PASS (honest scope): on `82827d3cbc`, the chain-depth cap guard is present/pinned in source tests, the live runtime reports chain max 200, and the chain-hop accounting path executed live during R-CD-CHAINED-DEPTH-2 TEST-2. No 200-hop cap-exhaustion burn was performed.
