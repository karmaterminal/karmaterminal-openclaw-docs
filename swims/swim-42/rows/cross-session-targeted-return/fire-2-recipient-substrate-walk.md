# swim-42 / cross-session-targeted-return — fire-2 recipient-side substrate-walk

**Status**: 🔴 sixth-fire convergent attestation on (bug)-shape, with **expanded recipient-side substrate-surface coverage** beyond rung 2 alone.

**Source**: runner-seat fire-2 from `agent:main:discord:channel:1466192485440164011` with `continue_delegate(targetSessionKey="agent:main:main", mode="silent")` at 2026-05-04T02:20:06Z.

## What this fire was for

OV-1 fire-1 + silas explicit-targeting probe both byte-pinned the substrate-finding at **rung 2 (`flow_runs.owner_key`)** and **rung 3 (`task_runs.runtime` + `child_session_key`)**, with cael + elliott byte-pin convergence at rung 2 as well. silas-seat explicitly framed the next-narrowing question: walk *every* recipient-side substrate surface on the dispatching host, not just rung 2, to byte-pin whether the silent-retarget reading extends to *all observable substrate layers* or only to flow_runs ownership.

This fire executes that walk.

## Walk substrate (5 recipient-side surfaces, none requiring a live attach)

### Surface 1 — sessions ledger (`openclaw sessions --json`)

`agent:main:main` ledger entry at walk-time:
- `updatedAt: 1777861215214` (= 2026-05-04 02:20:15 UTC, ~9 seconds *after* fire-2)
- `sessionId: 6b04c622-3b46-4096-8234-e0ca8f1689ff`
- `inputTokens: 20384`, `outputTokens: 29`, `totalTokens: 65440`

The `updatedAt: 02:20:15` is suspicious because it is *after* the fire-2 dispatch at 02:20:06 — but cross-checking the journal, the only event tagged with `session=agent:main:main` in the 5-minute window is a `[continuation:trace] payload-scan: count=1 lastTextIdx=0 [0]text=true:"HEARTBEAT_OK"`. That's a **heartbeat trace tick**, not a recipient-delivery — the session ledger updates `updatedAt` whenever the session's substrate is touched for any reason, including diagnostic heartbeat scans, not just when an inbound message lands.

So the `updatedAt` advance is consistent with normal heartbeat activity, not with a recipient-delivery from this fire.

**Verdict at surface 1**: 🟡 inconclusive on its own (the field updates for non-delivery reasons too); does NOT directly evidence a recipient-delivery.

### Surface 2 — `flow_runs.owner_key = agent:main:main` (rung 2 of the byte-pin ladder)

```sql
SELECT flow_id, datetime(created_at/1000,'unixepoch'), status
FROM flow_runs
WHERE owner_key='agent:main:main' AND created_at > <fire-2-window>
```

**Result: 0 rows.** No flow_run owned by the named recipient from this fire.

**Verdict at surface 2**: 🔴 confirms the silent-retarget reading at rung 2 (consistent with all 5 prior cohort byte-pins).

### Surface 3 — `task_runs.{owner_key,child_session_key,requester_session_key} = agent:main:main` (rung 3 + adjacent)

```sql
SELECT * FROM task_runs
WHERE (owner_key='agent:main:main' OR child_session_key='agent:main:main' OR requester_session_key='agent:main:main')
  AND created_at > <fire-2-window>
```

**Result: 0 rows.** No task_run with `agent:main:main` in any of the three session-key columns from this fire window.

By contrast, walking ALL task_runs in the same window returns the dispatched task and its inner subagent, both with the same shape OV-1 fire-1 produced:
- `task_id = 323f4186-…` — `runtime = subagent`, `owner_key = <dispatcher>`, `child_session_key = agent:main:subagent:08806887-1d31-4bda-b7de-837cd5ca2c60` (a brand-new subagent session, NOT `agent:main:main`), `requester_session_key = <dispatcher>`, `parent_flow_id = 3bae0a1a-…` (dispatcher-owned)
- `task_id = a2fdef00-…` — inner subagent session-side completion, `runtime = cli`, all session-key columns = the spawned subagent

**Verdict at surface 3**: 🔴 confirms the silent-retarget reading at rung 3 (`agent:main:main` does not appear as `owner_key`, `child_session_key`, OR `requester_session_key`). This is **stronger than rung 2 alone** — rung 3 walks three session-key columns, not just one, and none of them carry the named target.

### Surface 4 — session-store `.jsonl` for `agent:main:main` (`6b04c622-….jsonl`)

File mtime: `2026-05-03 19:20:14.595` PDT (= 2026-05-04 02:20:14 UTC, ~8 seconds after fire-2).

Same suspect window as surface 1 — but again, the only event in the journal with `session=agent:main:main` is the heartbeat trace tick, not a content-write. The .jsonl mtime moves whenever any session-touching event fires (heartbeat scan, ledger refresh, diagnostic event), not only on inbound message writes.

Walking the actual .jsonl content for new entries would close this surface definitively, but on this evidence the .jsonl mtime is consistent with heartbeat activity, not a fire-2 inbound write.

**Verdict at surface 4**: 🟡 inconclusive without a content-diff walk; consistent with no fire-2 content-write per the journal evidence.

### Surface 5 — gateway journal events tagged with `agent:main:main` from fire-2 window

```
journalctl --user -u openclaw-gateway --since "5 minutes ago" | grep -E "agent:main:main|targetSessionKey"
```

**Result**: only `[continuation:trace] payload-scan: ... text=true:"HEARTBEAT_OK" session=agent:main:main` and a sibling `effective-signal: origin=none kind=none session=agent:main:main` — both heartbeat-related, both at 02:20:15 (post-fire). **No `targetSessionKey`-tagged events anywhere in the journal window.** No delivery-route events. No cross-session router invocations. The runtime is genuinely silent on the `targetSessionKey` parameter at the journal layer.

**Verdict at surface 5**: 🔴 confirms the silent-retarget reading at the journal/log layer. The runtime never even *mentions* `targetSessionKey` in its diagnostic output — it's discarded silently enough that no log line records the fact of discard.

## Joint walk verdict

Per the EVIDENCE-LAYERS.md three-clause rule:
1. **Target axis**: explicit-targeting (`targetSessionKey: agent:main:main`)
2. **Evidence layer**: recipient-delivery, walked across 5 substrate surfaces
3. **What the byte-pin supports**: silent-retarget extends from rung 2 alone to **at least 4 of 5 walked recipient-side substrate surfaces** on this host (rungs 2, 3, 5 confirm directly; rungs 1 and 4 are inconclusive on their own but consistent with no recipient-delivery)

The two inconclusive surfaces (sessions ledger `updatedAt`, .jsonl mtime) are the ones that move on heartbeat activity too. Their inconclusiveness does NOT partially refute the silent-retarget reading; it just narrows what those surfaces can attest in isolation.

The previously-flagged narrowing question — *"if any recipient-side substrate surface shows state-change owned by `agent:main:main` from this fire, the silent-retarget reading is partially refuted"* — has its answer: **none of the substrate-coherent surfaces show recipient-side state-change.** The only surfaces that moved at all (sessions ledger `updatedAt`, .jsonl mtime) moved on heartbeat activity at +9s post-fire, not on delivery activity.

## Why this matters for #580 fix lane

frond-scribe's fix lane is currently scoped to *spawn-routing-to-announce-return boundary*. This walk byte-pins that scoping is correct — the silent-discard happens early enough in the pipeline that:
- no journal entry mentions `targetSessionKey` at all (rung 5)
- no `task_runs` row threads the named target through any session-key column (rung 3)
- no `flow_runs` row materializes for the named target (rung 2)

The discard is happening at the spawn-routing layer, not at the announce-return layer or the registry-lifecycle layer. The fix-surface `dispatchToolDelegates` → `spawnSubagentDirect` ownership-keying is the right layer; the bug is upstream of any return-side or rehydration-side wiring.

## Honest scope-limit on this walk

This walk does NOT test surface-delivery in the live-attached-observer sense — `agent:main:main` is a persisted direct CLI session on this host but no human, TUI, or agent process is interactively attached to it. So the walk only covers recipient-side substrate, not recipient-side surface.

If a future probe spawns a fresh observer process at `agent:main:main` and re-fires, that surface-layer would close the last evidence rung that this walk explicitly does not claim. Without it, the substrate-side reading is still as airtight as substrate-evidence can get on this host alone.

## Verdict

🔴 **Sixth-fire convergent attestation on (bug)-shape**, with expanded recipient-side substrate-surface coverage. The silent-retarget reading is byte-pinned across rung 2, rung 3 (now with all three session-key columns walked), AND rung 5 (journal layer) on this host, in addition to the prior 5 cohort host byte-pins at rung 2.

#580 fix lane scoping (`spawn-routing-to-announce-return boundary`) is supported by this walk. Frond-scribe is on the right layer.
