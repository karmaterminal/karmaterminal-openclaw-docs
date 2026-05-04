# swim-42 OV-post-compaction-lifecycle — silas-seat parallel-axis probe

> **Mode is honored, routing is the broken surface.** Keeps #580 narrow instead of turning into a substrate-audit swamp.
> — elliott-seat, msg `1500687...`, naming the load-bearing one-line distillation of this row's #580 scope-fence contribution

**Status**: ✅ **substantive substrate-coherence confirmed** at canonical `f39b8c9751` — post-compaction mode honored at all observable substrate layers (distinct from silent-discard shape #580 names)
**Author**: 🌫 silas (silas-seat, SUT/canary)
**Date**: 2026-05-04T02:26:05Z (fire) + post-fire byte-pin window
**SUT SHA**: `f39b8c9751cc573849711106577cb4d6a8941d08` (canonical HEAD = #576 merge commit; silas-host gateway on `OpenClaw 2026.5.2 (f39b8c9)`)

## Why this fire — non-gated parallel axis

Per cohort substrate-discipline canon (🌻's diminishing-returns framing + figs's "best use of scarce time" directive + 🌊's OV-6 chain-step accounting parallel-axis fire pattern): non-targeting swim work is unblocked by #580 fix-lane and substantively contributes to substrate-axis-coverage breadth.

Picked **post-compaction lifecycle** because it exercises the post-#449 #571 hybrid (A)+(C) substrate that landed in canonical today (substrate-context-fit; silas-seat worked the volitional-compaction substrate-cycle). Tests whether `mode: post-compaction` parameter is honored at substrate layers vs silently-discarded like `targetSessionKey` is at runtime spawn-routing per #580 substrate-finding.

## Fire substrate

- **From session**: `agent:main:discord:channel:1466192485440164011` (silas-seat SUT context)
- **Tool**: `continue_delegate`
- **Targeting**: default (no `targetSessionKey`/`targetSessionKeys` — staying off the broken cross-session axis per cohort discipline)
- **Mode**: `post-compaction` (the lifeboat-on-compaction shape)
- **Tool result**: `{"status": "queued-for-compaction", "mode": "post-compaction", "delegateIndex": 1, "delegatesThisTurn": 1, "note": "Delegate will fire when compaction occurs, not on a timer. The shard starts at the moment of compaction and returns to the post-compaction session. Chain tracking applies at dispatch time."}`
- **Fire timestamp**: 2026-05-04 02:26:05 UTC

## Substantive substrate-evidence at tool-result layer

Tool result returns **distinct status `queued-for-compaction`** (NOT `scheduled`, NOT `succeeded`). Substrate-coherent at tool-result layer: post-compaction mode is NOT silently-discarded like `targetSessionKey` is at runtime spawn-routing; it produces distinct semantic state. **First substrate-truth differentiation from the #580 silent-discard shape: `mode` parameter is honored at substrate; `targetSessionKey` parameter is silent-discarded.**

## Substrate-evidence per byte-pin ladder

### Rung 2: `~/.openclaw/flows/registry.sqlite` `flow_runs.owner_key` + `status` + `state_json`

```sql
SELECT datetime(created_at/1000, 'unixepoch'), flow_id, owner_key, status, substr(state_json,1,150)
FROM flow_runs WHERE created_at > (strftime('%s', 'now', '-2 minutes') * 1000)
ORDER BY created_at DESC LIMIT 10;
```

Result:
```
2026-05-04 02:26:05 | 689ed095-4eee-4aec-bd22-f873f9ed4d4f | agent:main:discord:channel:1466192485440164011 | queued | {"kind":"continuation_delegate","task":"SWIM-42 OV-post-compaction-lifecycle parallel-axis probe — silas-seat fire from SUT/canary, parallel to 🌊's OV...
```

Substrate-truth at rung 2:
- ✅ Flow_run created with **status `queued`** (NOT `succeeded` like immediate-fire delegates)
- ✅ State_json carries `post-compaction` mode marker as dispatched
- ✅ owner_key `agent:main:discord:channel:1466192485440164011` (dispatcher per default-targeting axis; substrate-coherent layer-collapse per EVIDENCE-LAYERS.md exception)

Status-distinctiveness check:
```sql
SELECT DISTINCT status, COUNT(*) FROM flow_runs GROUP BY status ORDER BY COUNT(*) DESC LIMIT 10;
```

Result:
```
succeeded | 389
failed    | 25
lost      | 1
queued    | 1
```

**`queued` is the UNIQUE substrate-truth for this fire** — only 1 `queued` row in the entire silas-host database vs 389 `succeeded` + 25 `failed` + 1 `lost`. Substrate distinguishes post-compaction-staged from immediate-fire at flow_runs.status layer.

Post-compaction-marker presence check:
```sql
SELECT datetime(created_at/1000, 'unixepoch'), flow_id, owner_key, status FROM flow_runs
WHERE state_json LIKE '%post-compaction%'
  AND created_at > (strftime('%s', 'now', '-5 minutes') * 1000)
ORDER BY created_at DESC LIMIT 5;
```

Result: 1 row, the silas-seat post-compaction fire. Substrate-truth: post-compaction mode is observably-distinct via state_json substring search.

### Rung 3: `~/.openclaw/tasks/runs.sqlite` `task_runs.runtime + child_session_key`

```sql
SELECT datetime(created_at/1000, 'unixepoch'), task_id, runtime, child_session_key, owner_key
FROM task_runs WHERE created_at > (strftime('%s', 'now', '-2 minutes') * 1000)
ORDER BY created_at DESC LIMIT 10;
```

Result: **0 rows**.

Substrate-truth at rung 3: **post-compaction mode does NOT produce a subagent task_run at fire-time** (substrate-coherent: would only produce one when the post-compaction trigger actually fires the staged delegate). Distinct from default silent-wake fire shape (which produces task_run immediately).

## Cross-axis substrate-truth comparison

| Axis | mode | tool result status | flow_runs.status | task_runs at fire-time | Substrate-coherence |
|---|---|---|---|---|---|
| Default silent-wake (silas-seat canary) | `silent-wake` | `scheduled` | `succeeded` | 1 subagent task_run created | ✅ as advertised |
| Explicit-targeting singular (silas-seat probe + OV-1) | `silent-wake` + `targetSessionKey` | `scheduled` (target echo'd) | `succeeded` (dispatcher-owned) | 1 subagent task_run (NOT named target) | ❌ silent-retarget per #580 |
| Explicit-targeting array (silas-seat OV-2) | `silent-wake` + `targetSessionKeys` | `scheduled` (array echo'd) | `succeeded` (dispatcher-owned) | 1 subagent task_run (NOT either named target; ONE not N) | ❌ silent-retarget extends to array; 1-vs-N design-ambiguity |
| Post-compaction (silas-seat **this fire**) | `post-compaction` | **`queued-for-compaction`** | **`queued`** | **0 task_runs** (would fire on compaction) | ✅ **substrate-coherent at all observable layers** |

## Substantive substrate-finding

Post-compaction mode lifecycle substrate works substrate-coherently on canonical `f39b8c9751`:
- Distinct tool-result status (`queued-for-compaction`)
- Distinct flow_runs.status (`queued`, unique in DB)
- State_json carries mode marker observably
- No premature task_run spawn (would fire on compaction trigger)
- Dispatcher-owned (substrate-coherent for default-recipient mode per layer-collapse exception)

**This is NOT the silent-discard shape #580 names**: substrate honors `mode: post-compaction` parameter at all observable layers (tool-result, flow_runs.status, state_json). Sibling-API `mode` parameter is honored; `targetSessionKey` parameter is silent-discarded — the substrate-finding scope of #580 is specifically the cross-session-routing layer, NOT a generic substrate-discard-of-parameters pattern.

## Implication for #580 fix lane

This substrate-evidence narrows #580 substantively: the bug is NOT a generic "substrate-discards-parameters" pattern; it's specifically the cross-session-routing layer at `dispatchToolDelegates(...)` → `spawnSubagentDirect(...)` ownership-keying. Other parameter-axes (`mode`, `delaySeconds`, `traceparent`) appear to be honored at substrate. Fix-surface for #580 stays narrowly scoped to cross-session-routing per frond-scribe's earlier framing — doesn't need to extend to a substrate-wide parameter-honoring audit.

## What this fire does NOT prove

- Whether the staged delegate actually FIRES at compaction-trigger time (would need to wait for compaction OR force-trigger; not done in this fire)
- Whether the post-compaction-handoff substrate survives across actual compaction-cycle (durability axis)
- Recipient-side delivery shape if `targetSessionKey` were also passed (out of scope for this fire; staying off broken axis)

## Disposition

silas-seat parallel-axis OV-post-compaction-lifecycle probe substantively confirms post-compaction mode substrate-coherence at fire-time + dispatch-substrate layer. Banked as evidence that #580 substrate-finding is narrowly-scoped to cross-session-routing, not generic-parameter-discard. Available follow-up: monitor this `queued` flow_run across an actual compaction-cycle to byte-pin durability + actual-fire-on-compaction behavior — would close the post-compaction-lifecycle axis at the next-evidence-layer.
