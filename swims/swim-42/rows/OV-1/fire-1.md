# swim-42/OV-1 — fire-1: outside-of-tree targeted return live exercise

**Status**: 🟡 fired, awaiting recipient-side landing
**Driver**: Ronan 🌊 (runner-seat)
**Mode**: Option B minimum-viable swim — live integration exercise, not unit-test stub
**SUT SHA**: `f39b8c9751cc573849711106577cb4d6a8941d08` (canonical HEAD = #576 merge commit; ronan-host gateway on `OpenClaw 2026.5.2 (f39b8c9)`)

## Fire substrate

- **From session**: `agent:main:discord:channel:1466192485440164011` (this Discord channel session, runner-seat driver context)
- **Tool**: `continue_delegate`
- **Targeting**: `targetSessionKey: "agent:main:main"` (my own direct CLI session, outside this Discord channel session's tree)
- **Mode**: `silent`
- **Tool result**: `{"status": "scheduled", "mode": "silent", "delaySeconds": 0, "delegateIndex": 1, "delegatesThisTurn": 1, "targetSessionKey": "agent:main:main"}`
- **Fire timestamp** (UTC): see commit timestamp on this file
- **Acceptance shape**: recipient at `agent:main:main` returns three short lines (confirmation / `process.env.HOSTNAME` or "no env" / ISO 8601 timestamp). The point is to prove the targeted return path landed at the intended outside-of-tree session, not the spawning child tree.

## What this exercises

Per the swim-42 charter §6.8 + post-#551 surface:
- targeted-return invariant: `targetSessionKey` overrides default-return-to-dispatching-session
- outside-of-tree shape: target is not a descendant of the dispatching session
- silent mode: no channel echo on return; recipient receives the delegate as internal context
- single-recipient slice (companion fanout / multi-recipient slices follow as fire-2..fire-N)

## What "PASS" looks like for this fire

- recipient session `agent:main:main` shows the delegate in its inbound queue
- recipient generates the requested 3-line reply
- reply does NOT land back at `agent:main:discord:channel:1466192485440164011` (the dispatching session)
- trace tree (when otel-wiring trace is captured) shows the cross-session targeted return edge

## What "FAIL" looks like

- delegate scheduled but never fires (silent loss; mode-2 wedge family)
- delegate fires but returns to dispatching session despite explicit `targetSessionKey` (silent retarget; would corrupt #551's load-bearing capability)
- delegate fires, recipient runs, but reply lands at wrong session (cross-session routing bug)
- spawn-rejection / failFlow path triggers (would surface as `failed` row per #571 hybrid contract — a clean failure, not a silent one)

## Companion-evidence pointer

This fire-receipt anchors the trace; the recipient-side landing receipt (`agent:main:main` confirms / fails to confirm) lands as a sibling file in this directory once observed. figs's eyes on the trace tempo per Option B.
