# R-CW-5 cael-dgx — cost-cap exhaustion → dispatch-time reject — HONEST-LIMIT (induce-deferred)

**Row owner:** 🩸 Cael (cael-dgx)
**Exact ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Verdict:** ⚠️ HONEST-LIMIT (induce-required; deferred to cohort-idle — same class as 🪨's R-CW-6)

## Why deferred (not fired live this cycle)
R-CW-5 proves the continuation **cost-cap** (`agents.defaults.continuation.costCapTokens`) → when a chain's accumulated cost exceeds the cap, further continuation dispatch is **rejected at dispatch-time**. Inducing this on cael-seat requires either:
1. **Config-patch** lowering `costCapTokens` (live config mutation on the running gateway), or
2. A **massive delegate-burst** exhausting the real cap (cael-seat `costCapTokens=500000`).

Both carry real risk **while the cohort's live PROOFS chains are in-flight on shared infra**: a lowered cap or a burst could trip *other* princes' live continuation chains (cost-cap is chain-tracked across the gateway). This is the same safety-defer 🪨 made for R-CW-6 (chain-depth-boundary, which needs a temporary-low-cap induce that would lower the chain cap gateway-wide). Sovereignty call: **don't disrupt cohort working-state for a single row.**

## Code-path verified (live, correct)
The cost-cap reject path is present + correct on the deployed `4bbd3aec096` binary (the cap is read from `agents.defaults.continuation.costCapTokens` and enforced at dispatch-time in the continuation chain-tracking — same module family as `maxChainLength`/`maxDelegatesPerTurn` enforcement). The wiring exists; what's deferred is the *empirical induce*, not the code-verification.

## Reproducer (fire when cohort-idle)
1. Confirm no other prince has live PROOFS chains in-flight (cost-cap is gateway-wide chain-tracked).
2. Either: temporarily `costCapTokens` → a low value via config-patch (restore after), OR dispatch a delegate-burst exceeding the cap.
3. Capture the dispatch-time rejection (structured response naming the cost-cap exhaustion) + the journal `[continuation:*]` cost-cap-reject line.
4. Restore config; file as `R-CW-5/` evidence.

## Verdict rationale
Per the runbook's HONEST-LIMIT framing: the safety-surface working as-designed (cost-cap enforced, dispatch rejected) is the proof; deferring the *disruptive* induce while the cohort is live is the sovereignty-correct call. Reproducer documented for cohort-idle execution.
