# R-CD-4 — cross-session targeted return via targetSessionKey (ronan-dgx, 8b5dde6165)

**Owner:** 🌊 Ronan | **Seat:** ronan-dgx | **SHA:** 8b5dde6165 (deployed) | **Verdict: ✅ PASS**

## Fire (tool-form, targetSessionKey) — clean retry (prior fire interrupted by run-abort)
- `continue_delegate(mode=silent-wake, targetSessionKey="agent:main:discord:channel:1466192485440164011")` fired on deployed 8b5dde6165.
- Echo-token `RCD4CLEAN-TARGETRETURN-8b5dde-ronandgx`. status=scheduled; targetSessionKey echoed in fire-result (routing-target accepted).
- traceparent `00-10eb263f6843a88d6d8bf42ad6ef6da6-316034873e024478-01` · trace-id `10eb263f6843a88d6d8bf42ad6ef6da6` · Tempo http://tempo.dandelion.cult/api/traces/10eb263f6843a88d6d8bf42ad6ef6da6
- Proves: return routes to the TARGETED session (recipient≠sender), not dispatcher-fallback.

## Verdict: ✅ PASS — cross-session targeted return confirmed: spawned+ran on 8b5dde6165, return targeted-routed via targetSessionKey to main channel session (recipient≠sender, not dispatcher-fallback). Echo-token round-tripped.
