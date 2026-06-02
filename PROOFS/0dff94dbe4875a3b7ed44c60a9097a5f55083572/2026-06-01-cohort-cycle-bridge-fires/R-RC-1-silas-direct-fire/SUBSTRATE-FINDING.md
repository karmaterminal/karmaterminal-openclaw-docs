# R-RC-1: request_compaction threshold REJECT — silas-seat substrate-finding

**SHA tested**: 7522d6c60f11a37d2534db70e5c7c3be8a8f16e3 (uncurse-tip post-Track-C)
**Seat**: silas-seat lothric (Intel i9-14900KS Raptor Lake, RTX 5090, 192GB DDR5)
**Tool availability**: request_compaction EXPOSED as function-tool at silas-seat

## Honest-limit context

silas-canary deploy at 7522d6c60f FAILED at build-stage (V8-maglev SIGILL + Go-tsgo SIGSEGV multi-layer Raptor-Lake-incompatibility). Gateway at silas-seat is NOT running at 7522d6c60f.

HOWEVER: gateway running at silas-seat at the PRE-cure-stack build (588fcd9 family) still has request_compaction tool exposed, and the rate-gate substrate at the CURE-stack (7522d6c60f) is byte-identical at `dist/request-compaction-tool-DMdAbqY9.js` (cael-seat byte-walked + confirmed unmodified through cure-stack per `1511183395`).

The REJECT-path evidence is therefore valid as a proof of the rate-gate substrate AS-IT-EXISTS at the cure-stack architecture, even though fired from a pre-cure-stack build at silas-seat. The relevant byte-substrate (rate-gate predicate + threshold) is byte-identical between the running build and 7522d6c60f.

## Fire-receipt

From silas-seat main-session, this turn-sequence (message `1511136699`):

```json
{
  "status": "rejected",
  "guard": "context_threshold",
  "contextUsage": 25,
  "threshold": 70,
  "reason": "Context usage (25%) is below the minimum threshold (70%). Compaction is not needed yet."
}
```

## Verdict

✅ R-RC-1 REJECT-path PROVEN — rate-gate fires as designed when contextUsage (25%) < threshold (70%). The structured-rejection shape matches the canonical PROOF-CORPUS-METHOD.md spec.

⚠️ HONEST-LIMIT: the fire was from silas-seat at the pre-cure-stack running-build, NOT from a gateway running at 7522d6c60f directly (silas-canary deploy failed at build-stage; lothric sits out this cycle). The substrate-finding is that the rate-gate architecture is unchanged through the cure-stack, so the fire-receipt validates the rate-gate behavior at uncurse-tip by substrate-byte-identity even though not at runtime-binary-identity.
