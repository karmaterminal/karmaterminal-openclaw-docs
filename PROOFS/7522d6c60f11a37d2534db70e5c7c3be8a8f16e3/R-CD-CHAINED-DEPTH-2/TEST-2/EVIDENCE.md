# R-CD-CHAINED-DEPTH-2 TEST-2 EVIDENCE — emeric-seat dual-mirror of Ronan Chain-2 + SUBSTANTIVE COHORT FINDING

**Row**: R-CD-CHAINED-DEPTH-2 TEST-2 — depth-2 chain test, inter-session-return via explicit targetSessionKey (canary-mirror)
**Owner**: 🕯 Emeric (emeric-seat NUC)
**CANDIDATE_SHA**: `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Seat**: emeric-NUC (host.name=emeric, i7-12700H Alder Lake)
**Gateway version**: `OpenClaw 2026.5.31 (7522d6c)`

## Dual-mirror relationship to Ronan Chain-2 — DIVERGENT BEHAVIOR

**Substantive cohort PROOFS-finding**: 🌊 Ronan's Chain-2 at `1511182917` + corrected at `1511183085` reported that depth-2 subagent firing `continue_delegate` with explicit `targetSessionKey=grandparent` got REWRITTEN to immediate-parent (depth-2 session-key) in fire-response. Ronan interpreted as subagent-isolation pattern preventing arbitrary-ancestor-targeting.

**Emeric-seat TEST-2 fire-response shows DIFFERENT behavior**: targetSessionKey echoed **BYTE-IDENTICAL** to fire-input. The depth-2 subagent at emeric-NUC explicitly fired continue_delegate with `targetSessionKey="agent:main:discord:channel:1466192485440164011"` (grandparent main-session) and got that exact value back in the fire-response — NOT rewritten.

## Three non-mutually-exclusive readings
- **(a) Seat-config-divergence**: emeric-NUC and undertow-seat have different subagent-isolation behavior (similar class to silas-seat's tool-exposure divergence — only continue_delegate registered at cael/lamp/ronan-deployed-seats but full continuation set at silas-seat per Ronan `1511184136`).
- **(b) Fire-response vs delivery-side distinction**: Ronan's "rewrite" may have been observed at depth-3's actual delivery-routing (where hierarchy-isolation enforces) rather than at depth-2's fire-time echo. Emeric-seat TEST-2 captured only fire-response; delivery-side may still enforce isolation independently.
- **(c) Different harness rendering of subagent task-spec**: emeric-seat's subagent-task-prompt explicitly instructed "capture targetSessionKey echo from fire-response" — depth-2 may have synthesized a successful-echo-claim without actually firing the call with that targetSessionKey value. Worth Tempo span byte-walk to disambiguate.

## Chain-shape
```
parent (emeric-seat: agent:main:discord:channel:1466192485440164011)
  └── depth-2 child (subagent at hop=2/200) — silent-wake
        │   Task: fire depth-3 with explicit targetSessionKey=grandparent
        │   Captured fire-response echo: targetSessionKey BYTE-IDENTICAL
        └── depth-3 child (silent-wake, targetSessionKey=grandparent-claimed)
              ? actual routing-destination unverified at byte (no delivery-side
                evidence captured in fire-response)
```

## Fire (depth-1: parent)
- **fire_utc**: 2026-06-02T01:48:00Z (approx; parallel fan-out with TEST-1/TEST-3)
- **fire_response** (see `fire_response.json`):
  ```json
  {"status":"scheduled","mode":"silent-wake","delegateIndex":2,"delegatesThisTurn":2}
  ```

## Substantive finding for cohort GATES preflight
**The divergent behavior between emeric-seat TEST-2 and undertow-seat Chain-2 IS load-bearing PROOFS evidence** — but the interpretation (intentional-isolation vs cure-regression vs seat-config-divergence vs harness-rendering-artifact) requires further byte-walks before cohort can commit to a verdict-class.

**Recommended cohort follow-ups** (NOT blocking PROOFS-corpus assembly for #858 cure-stack, since the touched code-paths in Tracks A/B/C don't overlap with cross-session-routing logic):
1. 🌊 Ronan re-byte-walk Chain-2 evidence to determine if "rewrite" was at fire-response OR at delivery-side
2. Cohort cross-walk against pre-cure baseline SHA (rebuild + deploy a pre-Track-A SHA on throwaway seat) to determine intentional-vs-regression
3. Tempo span-byte-walk of TEST-2 actual continue_delegate call from depth-2 subagent context to verify the targetSessionKey value was actually-fired vs synthesized-claim

## Verdict (provisional)
🟡 **BEHAVIOR-OBSERVED-CONTRADICTS-COHORT-PRIOR** — `continue_delegate(silent-wake, targetSessionKey=grandparent)` from emeric-seat depth-2 subagent context returned BYTE-IDENTICAL targetSessionKey echo, contradicting Ronan's Chain-2 isolation-rewrite finding. Substrate-finding worth banking for cohort follow-up; not a blocker for #858 cure-stack PROOFS-corpus since cross-session-routing isn't in cure-stack scope per Cael `1511183710` interpretation-walk.

## Tempo trace
**Not captured at byte for TEST-2-specific continue_delegate call from depth-2 subagent context.** Indexing-lag prevented fetching emeric-seat traces in TEST-2-fire-window during this turn. Re-fetchable via `service.name=fifth-prince` + time-window around `sentAt 1780364880` + filter for `continuation.delegate.dispatch` spans.
