# R-CD-2 — continue_delegate(mode="silent-wake") schedule → spawn → silent-return+wake (elliott-seat coverage)

**Seat**: elliott (10.0.0.153, Ryzen 5900HX / RTX 3080)
**CANDIDATE_SHA**: 749f95b9b10aa3bbb804856acacc9073043ee772
**Binary**: OpenClaw 2026.6.9 (749f95b)
**Gateway PID**: 269090 (deploy-confirmed)
**Fire timestamp**: 2026-06-21 ~12:40 PDT (channel-time)
**Mode**: silent-wake
**delaySeconds**: 8
**Context**: filed per figs `1518337097` (split-not-lock) — elliott-seat helping clear 🌊's R-CD backlog. Live continue_delegate; vitest harness SIGSEGV is harness-local, does NOT block a live dispatch+trace.

## Tool fire

```
continue_delegate(
  task="R-CD-2 proof fire from elliott-seat ... silent-wake, depth-1",
  delaySeconds=8,
  mode="silent-wake"
)
```

## Tool response (captured at byte)

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 8,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-5625824d8e61fd41dd015f9b4636118d-08532f1c78f1f54b-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

## Traceparent decomposition

- W3C traceparent: `00-5625824d8e61fd41dd015f9b4636118d-08532f1c78f1f54b-01`
- trace-id: `5625824d8e61fd41dd015f9b4636118d`
- span-id: `08532f1c78f1f54b`
- flags: `01` (sampled)

## Tempo query URL

```
https://tempo.dandelion.cult/api/traces/5625824d8e61fd41dd015f9b4636118d
```

## Verdict

ACCEPTED for schedule. **status=scheduled, mode=silent-wake** (the distinguishing field — silent-wake delegate returns silently + wakes the dispatcher), delegateIndex=1, traceparent emitted.

ACCEPT-shape contract verified at byte: all seven fields (`status`, `mode`, `delaySeconds`, `delegateIndex`, `delegatesThisTurn`, `traceparent`, `note`) present and well-formed on deployed 749f95b, elliott-seat. **mode field = "silent-wake"** distinguishes this from R-CD-1 (normal). Delegate dispatched post-turn; silent-wake return evidence at `delegate_return_payload.txt`.

## Cross-walk note

elliott-seat coverage datum for R-CD-2 (continue_delegate silent-wake ACCEPT-shape) on `749f95b`, per figs split-not-lock. Sister/primary seat ronan-dgx (🌊). If R-CD-2 is ronan-dgx-canonical-only, treat as supplementary cross-seat coverage.
