# Proof: R-CW-4 (chain depth tracking across hops)

**Issue:** karmaterminal/karmaterminal-openclaw-docs#117
**Row:** `R-CW-4`

## Behavior
Gateway properly tracks chain depth across multi-hop subagent continuation chains. The `chain.step.remaining` attribute decrements across 4+ hops in the same `chain.id`.

## Evidence
k6-proof suite target `r-cw-4` tests successful execution and spans verify decrementing counts. Verified against target-session-key test output.

```json
{
  "rowId": "R-CW-4",
  "owner": "cael",
  "forms": "tool",
  "issue": "117",
  "status": "PASS"
}
```
