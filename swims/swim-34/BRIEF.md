# BRIEF — continuation module (SUT for swim-34)

SHA `0abaf078ea`, branch `flesh_beast_figs/20260414-claude`. Read against `src/auto-reply/continuation/**` + two new tools + `agent-runner.ts` integration.

## CORRECTION 2026-04-17 09:47 PDT — numerical claims

The original version of this BRIEF (as posted to #sprites msg `1494740724971868340`) stated the refactor as *"51 files, 4257 insertions from foundation `46a6541eac`"* and the agent-runner integration as *"≈11 lines / +211 lines"* in places. Those figures came from a silent-wake delegate's summary and were not verified against `git diff --stat` before posting. **Verified numbers:**

- Total diff `46a6541eac..0abaf078ea`: **46 files, 2706 insertions, 118 deletions**
- `src/auto-reply/continuation/` only: **9 files, 851 insertions, 89 deletions**
- `continuation/` + 2 new tools (`continue-work-tool.ts`, `request-compaction-tool.ts`): **11 files, 1165 insertions, 89 deletions**
- `agent-runner.ts` change: re-verify against actual diff before any row cites a line count.

The seam/invariant/removed-or-forbidden structure below is the delegate's summary and requires independent byte-level verification before any row is authored against it. Treat this BRIEF as **a structured starting point for coord/driver code-reads, not as code-level comprehension in itself**. The caveat at the end names the one seam the delegate could not resolve; every other seam should be spot-checked before being cited.

## What the refactor moves where

Ad-hoc continuation state scattered across agent-runner (timer maps, volatile flag maps, inline bracket-parsing, inline spawn) has been extracted into a modular `src/auto-reply/continuation/` pipeline: **signal → scheduler → delegate-store → delegate-dispatch → state**, with config in `config.ts` and pressure in `context-pressure.ts`. What's genuinely new (not just relocated): (1) **TaskFlow-backed delegate persistence** in `delegate-store.ts` — delegates now survive gateway restart via SQLite, no volatile Map; (2) **context-pressure event bands** (25/80/90/95%) with dedup + post-compaction force-fire; (3) two tools — `continue_work` and `request_compaction` — with "tool writes, runner reads" store coupling. The generation-guard mechanism is **deleted**, not relocated.

## The 5 real integration seams

These are the joints where regression lives — test across them, not inside one file.

1. **Signal merge** — `continuation/signal.ts:extractContinuationSignal` ← `agent-runner.ts:1290–1299`. Bracket parse wins over tool-call; payload text is **mutated** to strip the signal. Backward scan for last text payload matters: tool-call payloads can push the text index off the end.
2. **Scheduler → store coupling** — `continuation/scheduler.ts:scheduleDelegateContinuation` → `delegate-store.ts:addDelayedContinuationReservation`. Delayed delegates get a UUID reservation + timer; `highestDelayedContinuationReservationHop` feeds the hop allocator (so reservation state actively shapes chain-depth enforcement).
3. **Tool-dispatched delegate pipeline** — `continue_delegate` tool → TaskFlow enqueue → `agent-runner.ts:1860–1879` post-response → `delegate-dispatch.ts:dispatchToolDelegates` → `spawnSubagentDirect`. This is the path where `maxDelegatesPerTurn`, `maxChainLength`, `costCapTokens` all apply in sequence.
4. **Post-compaction lifecycle** — `agent-runner.ts:1617–1678`. On compaction success: `clearContextPressureState` → `checkContextPressure({postCompaction:true})` force-fires → `consumeStagedPostCompactionDelegates` drains staged flows → each spawns with `silentAnnounce:true, wakeOnReturn:true`.
5. **Chain-state write-back** — `agent-runner.ts:1884–1897` → `state.ts:persistContinuationChainState`. Writes `continuationChainCount / chainStartedAt / chainTokens` onto `activeSessionEntry` whenever a signal OR queued delegate work was seen. Skipping this is silent drift across turns.

## Invariants worth a row each

- **Delay clamping, not rejection.** `config.ts:clampDelayMs` takes any `rawMs` (including `undefined` → `defaultDelayMs`) and clamps into `[minDelayMs, maxDelayMs]`. N out of range → clamp, never reject. Both `CONTINUE_WORK:N` and `continue_work({delaySeconds:N})` converge through this.
- **TaskFlow persistence survives restart.** `delegate-store.ts` pending + post-compaction delegates are `createManagedTaskFlow` records; a gateway bounce between enqueue and consume must still yield them from `consumePendingDelegates`.
- **Corrupt payload isolation.** `decodeDelegateState` Zod-parse failure → `failFlow`, does NOT throw and does NOT block sibling delegates in the same drain.
- **Concurrency-safe consume.** `consumePendingDelegates` only returns a delegate if `finishFlow(...).applied === true`; a losing racer yields zero delegates, not a duplicate spawn.
- **Hop allocator respects in-flight reservations.** `checkContinuationBudget` takes `max(currentChainCount, highestDelayedContinuationReservationHop)`; a delayed reservation at hop N blocks a new hop ≤ N even if the session entry's count hasn't caught up yet.
- **Per-turn delegate cap fires before chain-cap.** `delegate-dispatch.ts` slices `toolDelegates` at `maxDelegatesPerTurn` first (reason logged as `maxDelegatesPerTurn`); the surviving slice then loops budget-check per-delegate (reason `chain-capped` or `cost-capped`).
- **Work-request store is same-turn ephemeral.** `pendingWorkRequests` is deliberately volatile; `continue_work` tool write must be consumed in the same turn's post-response or lost.
- **Context-pressure dedup is equality, not monotonic.** `context-pressure.ts:checkContextPressure` suppresses only when `band === previous`; a lower band after compaction MUST fire (and `clearContextPressureState` is called right before the post-compaction force-fire to guarantee it).
- **`retainContinuationTimerRef` pairs with `unregisterContinuationTimerHandle`.** Every `setTimeout` in `scheduler.ts` is bracketed by retain→register and unregister (which releases). A thrown `onFire` must still release — note the `try/finally`.
- **No generation-guard cancellation.** `clearTrackedContinuationTimers` is only called on explicit reset (`/new`, `/reset`); inbound noise does NOT touch timers or reservations. This is a **property of the system**, the kind of invariant swim-34 exists to pin down.

## What's removed / forbidden

- **`generationGuardTolerance` field is deleted** from `ContinuationRuntimeConfig` (explicit comment in `types.ts`). Per figs ruling 2026-04-15: unrelated channel noise must not cancel dispatched continuation work. Any row asserting drift-based cancellation is wrong.
- **`clearDelayedContinuationReservations` is no longer called on inbound messages.** The old binary clearing path is gone. It still exists in the store but is only wired to explicit session reset.
- **No volatile `delegatePendingFlags` Map.** `state.ts:setDelegatePending` and `clearDelegatePending` are explicitly no-ops with `@deprecated` JSDoc; source of truth is `pendingDelegateCount` over TaskFlow. Tests asserting flag-map mutation will pass vacuously — catch them.
- **`taskFlowDelegates` is not an opt-out.** Config always resolves `true`; setting it false in gateway config is silently ignored.

## One honest caveat

The **post-compaction staging release** (`agent-runner.ts:1617–1678`) spawns best-effort inside a try/catch that silently swallows everything. If a compaction-triggered session replacement reassigns `sessionKey`, I can't tell from reading whether `consumeStagedPostCompactionDelegates(sessionKey)` still matches the record's `ownerKey` — the TaskFlow records were written against the pre-compaction sessionKey. Before writing rows like "staged delegate survives compaction-triggered session replacement," **ask figs or Cael whether compaction rotates the sessionKey or reuses it**, and whether TaskFlow `ownerKey` is rewritten on rotation. This is the one seam where the code's intent isn't self-evident from the diff.
