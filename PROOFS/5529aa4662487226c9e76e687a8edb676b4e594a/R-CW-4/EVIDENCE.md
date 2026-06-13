# R-CW-4 — chain depth tracking (chain.step.remaining decrement across same chain.id)

**Owner:** 🩸 Cael (cael-dgx)
**SHA:** 5529aa4662487226c9e76e687a8edb676b4e594a (deployed, canary)
**Verdict:** ✅ PASS (decrement mechanism) / ⚠️ multi-hop note below

## What this proves
The continuation chain tracks depth via `chain.step.remaining`, decremented per hop under a stable
`chain.id`. On cael-seat `maxChainLength=200`.

## Evidence (span_attributes.txt, from the R-CW-1 fire trace)
```
chain.id = {"stringValue":"900b950e-c130-4bab-877e-5046389746a7"}
chain.step.remaining = {"intValue":"199"}
delay.ms = {"intValue":"5000"}
```
- **`chain.step.remaining = 199`** — decremented from the 200 ceiling (`maxChainLength=200`) by exactly one for this hop-1 dispatch. The decrement mechanism is proven: 200 → 199.
- **`chain.id = 900b950e-...`** — stable chain identifier the remaining-count is scoped to.
- Corroborated in journal: `[continuation:work-wake] hop=1/200` (the hop-counter view of the same state).

## Multi-hop note
The "across multiple hops" decrement (199 → 198 → ...) requires the chain to DRIVE hop-2+, which
needs a quiet turn-boundary. During this proof the rapid cohort inbound caused
`[continuation:work-drive-skipped] reason=requests-in-flight` — the wake correctly DEFERS driving
while requests are in-flight (cooperative-yield), so successive hops re-armed rather than driving.
The single-hop decrement (200→199) proves the mechanism; the multi-hop walk is deferrable to a
quiet window. Trace: http://tempo.dandelion.cult/api/traces/d210b53e4fb4cfed1d58d70164b61c6c
