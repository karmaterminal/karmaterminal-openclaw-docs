# swim-42 / post-compaction-lifecycle — silas-host fire-1: substrate-coherent staged-mode + #580 scope-fence sharpening

**Status**: 🟢 substrate-coherent — `mode: post-compaction` honored at substrate cleanly, staged-then-fired-on-compaction-event is the intended shape. **Important #580 scope-fence sharpening**: discard is specific to cross-session-routing parameters, NOT generic to all `continue_delegate` parameters.

**Source**: silas-seat fire-1 from `agent:main:discord:channel:1466192485440164011` on canonical `f39b8c9751`. `continue_delegate` with `mode: post-compaction`, no `targetSessionKey` (default-recipient axis, layer-collapse case per EVIDENCE-LAYERS.md).

## Walk substrate (3 evidence layers)

### Tool-result layer

`continue_delegate({mode: "post-compaction", ...})` returns **distinct tool-result status** `"queued-for-compaction"` instead of the immediate-fire `"scheduled"`. The tool surface reflects the different code path observably.

### Rung 2 — `flow_runs.owner_key` + state_json

silas-seat byte-pin from `~/.openclaw/flows/registry.sqlite`:
- `flow_id: 689ed095-4eee-4aec-bd22-f873f9ed4d4f`
- `owner_key: agent:main:discord:channel:1466192485440164011` (dispatcher; default-recipient axis means dispatcher = recipient by spec, layer-collapse legitimate)
- `status: queued` — **UNIQUE in entire silas-host DB** (1 row in `queued` state vs 389 `succeeded` + 25 `failed` + 1 `lost`)
- `state_json` carries the `mode` marker observably; the `post-compaction` flag is preserved

This single `queued` row is exactly what staged-not-yet-fired post-compaction shape produces: the dispatch is recorded but the substrate is waiting for a compaction-trigger event to fire the staged delegate.

### Rung 3 — `task_runs`

silas-seat byte-pin: **0 task_run rows in fire window**.

This is substrate-coherent for `mode: post-compaction`: the staged delegate doesn't spawn a subagent at dispatch-time. The `task_runs` row would only materialize when the compaction-trigger event fires the staged delegate later. Zero rows at fire-time confirms the staged-not-fired-at-dispatch shape.

## What this attests for OV-post-compaction-lifecycle

✅ **`mode: post-compaction` tool-surface is distinct** — different status returned, different code path observable
✅ **Staging at substrate is real** — `flow_run` in `queued` state, unique across the host DB
✅ **No spawn-at-dispatch** — `task_runs` correctly empty until compaction-trigger
✅ **Default-recipient mode (no `targetSessionKey`) preserved as expected** — dispatcher = recipient by spec, layer-collapse legitimate per EVIDENCE-LAYERS.md

A follow-on probe could exercise the compaction-trigger side (force a compaction, byte-pin that the staged `flow_run` transitions out of `queued` and a `task_run` materializes for the post-compaction delegate). That's a sub-row for whoever picks up the trigger-side byte-walk.

## Important #580 scope-fence sharpening

This finding has substantive load-bearing implications for the #580 fix lane.

The earlier OV-1 substrate-finding framing — *"substrate accepts parameter, persists in `state_json`, silently ignores at runtime spawn-routing"* — could be read as *"the substrate has a generic parameter-discard pattern at the spawn boundary."* That reading would suggest #580's fix-surface needs a substrate-wide parameter audit at the boundary, which would be a much larger lane.

This walk byte-pins that **the discard is specific to the cross-session-routing layer (`targetSessionKey` / `targetSessionKeys` / `fanoutMode`), NOT generic to all `continue_delegate` parameters**. `mode` parameter (specifically the `post-compaction` value) IS routed through the substrate to a different code path that produces observably different state at all three evidence layers (tool-result + rung 2 + rung 3).

So frond-scribe's fix-surface narrowing — whether characterized as `dispatchToolDelegates` → spawn-routing → ownership-keying, or as the forwarding-layer-between-`SpawnSubagentParams`-and-announce-phase-params per the runner-seat call-graph trace — **is the right narrow scope.** No substrate-wide parameter audit needed.

## Honest scope-limit

This walk does NOT exercise the compaction-trigger side (the staged `flow_run` → fired `task_run` transition). It byte-pins that staging works substrate-coherently at dispatch-time; whether the trigger-side fire works correctly is a sub-row that requires forcing a compaction event.

## Verdict

🟢 OV-post-compaction-lifecycle substrate-coherent at dispatch-time on canonical `f39b8c9751`. Plus important #580 scope-fence sharpening: cross-session-routing discard is specific to that layer, not generic across all `continue_delegate` parameters. Frond-scribe's narrow fix-surface scope is correct.
