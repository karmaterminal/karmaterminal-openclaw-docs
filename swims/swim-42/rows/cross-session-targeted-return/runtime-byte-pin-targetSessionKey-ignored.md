# swim-42 / cross-session-targeted-return — runtime byte-pin: `targetSessionKey` is silently ignored

**Status**: 🔴 substrate-finding byte-pinned at wire-receipt + recipient-delivery layers.

**Source**: runner-seat byte-walk of `~/.openclaw/tasks/runs.sqlite` `task_runs` table for OV-1 fire-1 (epoch 1777858573704+).

## What the substrate actually does

The OV-1 fire-1 dispatched `continue_delegate` with `mode: silent, targetSessionKey: "agent:main:main"`. The runtime byte-pin from `task_runs`:

| field | value | meaning |
|---|---|---|
| `task_id` | `fdb3c76e-b6b0-4499-aee6-660e2328529a` | the subagent task |
| `runtime` | `subagent` | the routing primitive used — **plain subagent spawn**, not a cross-session-target route |
| `owner_key` | `agent:main:discord:channel:1466192485440164011` | dispatcher session, NOT `agent:main:main` |
| `child_session_key` | `agent:main:subagent:3282d176-c12d-492d-a9be-ea809a25c654` | a **new subagent session was spawned**, not a delivery into `agent:main:main` |
| `requester_session_key` | `agent:main:discord:channel:1466192485440164011` | dispatcher session |
| `parent_flow_id` | `6d032362-99b2-49e7-9fd4-06c663a0eafb` | dispatcher-owned flow (the `task_mirrored` row from earlier) |
| `delivery_status` | `delivered` | delivery succeeded — but to **the requester (dispatcher)**, per `notify_policy = done_only` |
| `terminal_summary` | `received delegate at agent:main:main no env 2026-05-04T01:36:42Z` | the subagent's own reply prose; it self-referenced the `agent:main:main` string from the task body, but actually ran in `agent:main:subagent:3282d176-…` |
| `terminal_outcome` | `completed` | the subagent task completed successfully |

A second `task_runs` row records the inner subagent's own session-side completion: `task_id = 752f200e-…`, `runtime = cli`, `owner_key = agent:main:subagent:3282d176-…`, `requester_session_key = agent:main:subagent:3282d176-…`. Same pattern: ownership is the spawned subagent, not the named target.

## What this byte-pins

`continue_delegate` with `targetSessionKey: <other-session>` on the v5.2 canonical substrate at `f39b8c9751`:

1. **does NOT route the dispatch to the named session.** The runtime spawn primitive is plain `subagent`, not a cross-session router.
2. **spawns a brand-new subagent session** (visible in `child_session_key`) and runs the task body there.
3. **delivers the subagent's terminal_summary back to the requester (dispatcher)** via standard subagent task-completion semantics, NOT to the named `targetSessionKey`.
4. **does NOT produce any state-change owned by the named target session.** The `targetSessionKey` parameter from `state_json` is preserved on the dispatching `continue_delegate` flow_run but is **silently ignored at the runtime spawn-routing layer**.

The driver-seat narration that "the delegate received cleanly at agent:main:main and replied with three lines" was self-fabricated from the runtime task-completion announce mirroring the subagent's reply (whose text happened to contain the string `agent:main:main` because it was lifted from the task body) back to the dispatching session. The four-seat cohort recipient-delivery byte-pin (0 rows with `owner_key = agent:main:main` from this fire on any host) was the first warning. This task_runs byte-pin is the closing evidence.

## Resolution between the two earlier readings

Of the two readings runner-seat surfaced earlier (intended hint-shape vs silent-retarget bug), **the byte-pin closes on the (bug)-shape**:

- **(intended hint-shape)** would have left a `task_runs` or `flow_runs` row owned by the named target with `runtime` indicating cross-session route. None observed. ✗
- **(silent-retarget bug)** would have spawned a normal subagent owned by the requester with no acknowledgment of the `targetSessionKey` request beyond preserving it in `state_json`. **This is what the substrate did.** ✓

## Localization sharpening (post-call-graph-walk + frond-scribe mid-flight ownership-semantics correction)

The earlier prose in this file framed the discard as happening at "runtime spawn-routing." That framing is **directionally correct but over-coarse**. The call-graph walk in #580 issuecomment-4367858828 + frond-scribe's mid-flight ownership-semantics self-correction during the fix lane both narrow the localization further:

The substrate threads `targetSessionKey` correctly through five layers (tool → store → dispatch → spawn params → announce-time `hasContinuationTargeting` check). The discard happens at the **forwarding boundary between `SpawnSubagentParams` (where `delegate-dispatch.ts` puts the `continuationTarget*` fields) and the spawned subagent's announce-phase `params` namespace (where `subagent-announce.ts:1216` checks for them).** The journal byte-pin confirms it: zero `[continuation:targeted-return] Delivered to` log lines fire in the fire-window, which would only be silent if the `hasContinuationTargeting` branch never enters — i.e. the targeting fields arrive at the announce-phase as `undefined`.

Byte-pin substance in this file (rung-2 + rung-3 + state_json preservation + 5-seat cohort convergence) all stays as canon-evidence. The prose framing the drop-point is now narrower: not "runtime spawn-routing" generally, but **the spawn-to-announce forwarding surface specifically**.

Silas-seat's complementary scope-fence finding (`mode: post-compaction` IS honored at substrate, observable at all three evidence layers) further byte-pins that the discard is **specific to the cross-session-routing axis** (`targetSessionKey` / `targetSessionKeys` / `fanoutMode`), NOT generic to all `continue_delegate` parameters. The fix-surface is genuinely narrow.

## What this means for #551 and the v5.2 ship

The #898 OV-1 prose names this exact failure-mode as *"would corrupt the cross-session signaling primitive that #551 established as a load-bearing capability for the v5.2 ship."* The byte-pin confirms the corruption: `targetSessionKey` is exposed on the tool surface, accepted without rejection, persisted in flow `state_json`, and then silently discarded at runtime spawn.

Cohort decision shape (figs / cohort eyes):
1. Decide whether this is in-scope for v5.2 ship (was the `#551` cross-session primitive **promised** at this level for v5.2, or was the runtime wiring the missing piece all along?)
2. If in-scope: a runtime fix is needed before ship — `dispatchToolDelegates` (or whatever spawn-routing layer is responsible) must consume `state_json.targetSessionKey` and route the delegate to the named session instead of falling through to plain subagent spawn.
3. If out-of-scope: the tool description must be updated to remove the over-promise (`"targetSessionKey returns to one other session"` is currently misleading), and OV-1 acceptance shape needs re-cast against the actual semantics.

## Discipline pinned

The byte-pin chain that landed the finding:
1. `state_json.targetSessionKey` preserved on dispatcher flow_run (looks promising)
2. zero `flow_runs` with `owner_key = <target>` from this fire on 4/4 cohort hosts (warning)
3. `task_runs.runtime = subagent` and `child_session_key = <new subagent>` instead of `<target>` (closing evidence)

Each layer told a sharper truth than the one above. The lesson is that for cross-session/multi-recipient/fanout substrate-claims, **`task_runs.runtime` and `child_session_key` are the load-bearing byte-pins** — they reveal whether the substrate actually used a cross-session routing primitive or fell through to plain subagent spawn.

Substrate-finding closed at runner-seat. Cohort decision pending.
