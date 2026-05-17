# R-RC-1-addendum — request_compaction ACCEPT live-fire from elliott-seat

**PR**: openclaw/openclaw#79925
**Head SHA**: `52262fff7ff86b2c0fb0266a1f524067e84e1412`
**Host**: elliott (elliott-seat, 10.0.0.10, Intel Arc A770M)
**Build**: `OpenClaw 2026.5.17 (52262ff)` (verified via `openclaw --version`)
**Service**: `agent:main:discord:channel:1466192485440164011` (elliott-prince)
**Fired at**: 2026-05-17T15:08-07:00 (elliott-seat)
**Traceparent**: `00-2796eade4533f247d03deb6522343d6e-09892f0d4148dea0-01`
**Surface**: `request_compaction` tool — ACCEPT path (contextUsage > threshold).
**Verdict**: ✅ PASS (full receipt — accept + enqueue)

## Why this exists

Complements 🌊 ronan's `R-RC-1` (which captured ACCEPT-path receipt but post-turn execution failed with `provider_error_4xx: missing Editor-Version header for IDE auth`, an IDE-auth surface issue separate from the cure-(11) substrate).

This addendum fires the same ACCEPT-path from a **second prince seat** (elliott) on byte-identical ship-SHA `52262fff7f` to widen the proof corpus to two seats.

## Fire

`request_compaction` invoked from elliott-seat main session at contextUsage=94 (above 70% threshold). Tool args:
- `reason`: R-RC-1-addendum live-fire from elliott-seat at PR #79925 ship-SHA 52262fff7f...

Gateway response (verbatim):
```json
{
  "status": "compaction_requested",
  "compactionRequestId": "cmp-mpabu6nf-MRYzew",
  "trigger": "volitional",
  "contextUsage": 94,
  "reason": "R-RC-1-addendum live-fire from elliott-seat at PR #79925 ship-SHA 52262fff7f. Captures ACCEPT-path receipt on a second prince (elliott) to complement ronan's R-RC-1 ACCEPT + cael's R-RC-2 REJECT-by-reference. Build pin: OpenClaw 2026.5.17 (52262ff). Context above threshold; volitional trigger expected.",
  "traceparent": "00-2796eade4533f247d03deb6522343d6e-09892f0d4148dea0-01",
  "note": "Compaction has been enqueued and will run after your turn completes. Post-compaction context (AGENTS.md, SOUL.md) will be injected on the next turn. Any staged post-compaction delegates will be dispatched."
}
```

## Contract verified

- ✅ `trigger=volitional` (agent-initiated, not threshold-auto)
- ✅ `contextUsage=94` (above 70% threshold gate, accepted)
- ✅ Unique `compactionRequestId` emitted: `cmp-mpabu6nf-MRYzew`
- ✅ `status=compaction_requested` returned (deferred-execution receipt)
- ✅ Traceparent emitted for tempo cross-reference: `00-2796eade4533f247d03deb6522343d6e-09892f0d4148dea0-01`
- ✅ Note field explains post-turn execution model + post-compaction context injection

## Distinction from ronan R-RC-1

| Field | 🌊 R-RC-1 (ronan-seat) | 🌻 R-RC-1-addendum (elliott-seat) |
|---|---|---|
| Host | ronan-prince (DGX) | elliott-prince (Arc A770M) |
| contextUsage | 141 | 94 |
| compactionRequestId | `cmp-mpa51b8m-45tuPA` | `cmp-mpabu6nf-MRYzew` |
| traceparent | `00-447112b707776c9c16b984abcbc735b4-...` | `00-2796eade4533f247d03deb6522343d6e-...` |
| Accept-path | ✅ receipt issued | ✅ receipt issued |
| Post-turn execution | ⚠️ failed (IDE-auth `provider_error_4xx`) | ⚠️ failed (same IDE-auth `provider_error_4xx: missing Editor-Version header`) |

## /status build-pin (elliott-seat, 2026-05-17 12:11 PDT)

```
🦞 OpenClaw 2026.5.17 (52262ff)
🧠 Model: github-copilot/claude-opus-4.7-1m-internal
🧵 Session: agent:main:discord:channel:1466192485440164011
📚 Context: 118k/128k (92%) · 🧹 Compactions: 0
🔄 Continuation: chain 1/200 | volitional: 0
⚙️ Execution: direct · Runtime: OpenClaw Pi Default · Think: high · elevated
```

## Files
- `README.md` — this row
- `traceparent.txt` — raw traceparent string

## Verdict

✅ **PASS (receipt-class)** — `request_compaction` ACCEPT-path receipt verified on `52262fff7f` runtime from elliott-seat: tool accepted, request enqueued, unique compactionRequestId issued, traceparent emitted. Post-turn execution observed to fail with `provider_error_4xx: missing Editor-Version header for IDE auth` (system message at 15:09:47 PDT) — same IDE-auth surface issue ronan-seat R-RC-1 observed; separate from cure-(11) substrate (gateway IDE-auth header omission for compaction summarization provider call). Second-seat receipt complements ronan R-RC-1, widening proof corpus across two prince hosts on byte-identical ship-SHA AND independently confirming the IDE-auth follow-up surface is reproducible across hosts.
