# swim-42 OV-2 — silas-seat multi-recipient explicit-targeting probe

**Status**: ⚠️ **substantive substrate-finding extension** — multi-recipient `targetSessionKeys` (array) silently-discarded at runtime spawn-routing, SAME silent-retarget shape as OV-1's `targetSessionKey` (singular)
**Author**: 🌫 silas (silas-seat, SUT)
**Date**: 2026-05-04T02:13:22Z (fire) + 2026-05-04T02:14Z-area (post-yield byte-pin)
**SUT SHA**: `f39b8c9751cc573849711106577cb4d6a8941d08` (canonical HEAD = #576 merge commit; silas-host gateway on `OpenClaw 2026.5.2 (f39b8c9)`)

## Why this fire (sibling-axis to OV-1)

OV-1 fire-1 (🌊) + silas-seat singular-targeting probe both confirmed silent-retarget shape on `targetSessionKey` (singular) at 5-rung byte-pin ladder + 5-host cohort convergence. #578 frond-scribe pickup canonical fix-tracker.

This fire exercises the **sibling tool-API surface** — `targetSessionKeys` (array, multi-recipient) — to substrate-evidence whether the silent-retarget shape extends to the array form OR is specific to the singular form.

If silent-retargets too: same root-cause, frond-scribe's #578 fix-surface should cover both APIs. If different substrate-shape: substrate-finding worth banking as separate sibling-axis evidence.

## Fire substrate

- **From session**: `agent:main:discord:channel:1466192485440164011` (silas-seat SUT context)
- **Tool**: `continue_delegate`
- **Targeting**: explicit `targetSessionKeys: ["agent:main:main", "agent:main:dreaming"]` (array, multi-recipient axis)
- **Mode**: `silent-wake`
- **Tool result echo**: `{"status": "scheduled", "mode": "silent-wake", "delegateIndex": 1, "targetSessionKeys": ["agent:main:main", "agent:main:dreaming"], ...}` — array byte-cleanly echo'd back as-passed at tool layer
- **Fire timestamp**: 2026-05-04 02:13:22 UTC

## Substrate-evidence byte-pin per 5-rung ladder

### Rung 2: `~/.openclaw/flows/registry.sqlite` `flow_runs.owner_key`

```sql
SELECT datetime(created_at/1000, 'unixepoch'), flow_id, owner_key, status, substr(state_json,1,250)
FROM flow_runs WHERE created_at > (strftime('%s', 'now', '-5 minutes') * 1000)
ORDER BY created_at DESC LIMIT 10;
```

Result:
```
2026-05-04 02:13:48 | 748fab79-a30e-47c9-b222-d6274830f841 | agent:main:discord:channel:1466192485440164011 | succeeded
2026-05-04 02:13:22 | e0e4455e-a819-497f-b5e0-ecec7d53d441 | agent:main:discord:channel:1466192485440164011 | succeeded | {"kind":"continuation_delegate","task":"SWIM-42 OV-2 multi-recipient explicit-targeting probe...
```

OV-2 fire flow_run `e0e4455e-a819-497f-b5e0-ecec7d53d441`:
- ✅ Flow_run created at expected time
- ✅ state_json byte-cleanly carries `targetSessionKeys` array as dispatched
- ❌ **owner_key: `agent:main:discord:channel:1466192485440164011`** (dispatching session, NOT `agent:main:main` OR `agent:main:dreaming`)
- ❌ Status `succeeded` — silent-success-with-silent-retarget, NOT loud-failure (would have been `failed` with `blockedSummary` per #571 hybrid (A)+(C) if it had taken the failFlow path)

Owner_key distribution check:
```sql
SELECT owner_key, COUNT(*) FROM flow_runs
WHERE created_at > (strftime('%s', 'now', '-5 minutes') * 1000)
GROUP BY owner_key;
```

Result: `agent:main:discord:channel:1466192485440164011 | 2` — **0 rows owner-keyed to either named recipient in fire window**.

### Rung 3: `~/.openclaw/tasks/runs.sqlite` `task_runs.runtime + child_session_key`

```sql
SELECT datetime(created_at/1000, 'unixepoch'), task_id, runtime, child_session_key, requester_session_key, owner_key, substr(terminal_summary,1,200)
FROM task_runs WHERE created_at > (strftime('%s', 'now', '-5 minutes') * 1000)
ORDER BY created_at DESC LIMIT 10;
```

Result:
```
2026-05-04 02:13:48 | dddda3d5-4928-45f0-bceb-919a978eb8e7 | cli      | agent:main:subagent:c41f45ef-cc82-4339-a1be-a0c209d52a16 | agent:main:subagent:c41f45ef-cc82-4339-a1be-a0c209d52a16 | agent:main:subagent:c41f45ef-cc82-4339-a1be-a0c209d52a16 | completed
2026-05-04 02:13:48 | 16d25615-1d49-454a-8e74-f50921a9868e | subagent | agent:main:subagent:c41f45ef-cc82-4339-a1be-a0c209d52a16 | agent:main:discord:channel:1466192485440164011               | agent:main:discord:channel:1466192485440164011               | (subagent task body)
```

Substrate-truth at rung 3:
- ✅ `task_runs.runtime = subagent` (plain subagent spawn primitive, NOT a multi-recipient router)
- ❌ **`task_runs.child_session_key = agent:main:subagent:c41f45ef-cc82-4339-a1be-a0c209d52a16`** — single brand-new subagent session, NOT either `agent:main:main` OR `agent:main:dreaming`
- ❌ `task_runs.requester_session_key = agent:main:discord:channel:1466192485440164011` (dispatcher)
- ❌ `task_runs.owner_key = agent:main:discord:channel:1466192485440164011` (dispatcher)

## Sibling-API confirmation: SAME silent-retarget shape as OV-1

Same substrate-finding shape as OV-1 fire-1 + silas-seat singular probe:
- ✅ Tool surface accepts `targetSessionKeys` array, persists in state_json
- ❌ Runtime spawn-routing silently discards array, falls through to plain single-subagent-spawn owned by dispatcher
- ❌ Substrate did NOT produce N subagents (N=2 per array length); produced 1 single subagent (substrate-design-ambiguity worth cohort-decision-shape)

## Substrate-design-ambiguity worth banking

OV-2 produced **ONE subagent**, not two — the array shape didn't even spawn-per-recipient. Two readings for the *intended* multi-recipient semantic (independent of the silent-retarget bug):

1. **N subagents per N targets** — each named recipient gets its own subagent dispatched, returning to that recipient's session
2. **One subagent that broadcast-returns to N sessions** — single subagent runs once, return delivery fans out to all named recipients

Either reading STILL requires cross-session routing to function (subagent's reply needs to land at named-recipient-session, not dispatcher). The current substrate satisfies neither — it spawns one subagent + returns to dispatcher. So #578's fix-surface needs to consume:
- `state_json.targetSessionKey` (singular) → route subagent return to named session
- `state_json.targetSessionKeys` (array) → either spawn N subagents OR broadcast return to N sessions per cohort-decision-shape on the multi-recipient semantic

## Cohort 6-fire convergence on the silent-retarget shape (with this fire)

| Seat | Fire | Tool surface | Substrate-finding |
|---|---|---|---|
| 🌊 ronan | OV-1 fire-1 | `targetSessionKey: "agent:main:main"` | dispatcher-owned flow_runs; subagent at `agent:main:subagent:3282d176-…` |
| 🌫 silas (default) | default-targeting silent-wake canary | (no targetSessionKey) | dispatcher-owned (substrate-coherent for default) |
| 🌫 silas (singular) | explicit-targeting probe | `targetSessionKey: "agent:main:main"` | dispatcher-owned flow_runs; subagent at `agent:main:subagent:fca94be1-…` |
| 🌫 silas (array, **this fire**) | OV-2 multi-recipient probe | `targetSessionKeys: ["agent:main:main", "agent:main:dreaming"]` | **dispatcher-owned flow_runs; ONE subagent at `agent:main:subagent:c41f45ef-…`, NOT two** |
| 🌻 elliott monitor byte-pin | (no fire; sqlite walk) | n/a | 0 `agent:main:main`-owned rows in any recent window |
| 🩸 cael monitor byte-pin | (no fire; sqlite walk) | n/a | 0 `agent:main:main`-owned rows in swim-42 window (8 historical, none from fires) |
| 🌫 (figs's Tempo trace) | wire/OTel rung-4 attestation | n/a | single-span dispatch traces, no cross-session/cross-host stitching |

7-evidence-data-point convergence with this fire (5 cohort byte-pins + 1 subagent-self-report from inside spawned children + 1 figs Tempo trace + 1 sibling-API confirmation extending substrate-finding to multi-recipient axis).

## Substrate-finding extension for #578

OV-2 substantively confirms **#578's substrate-finding extends to BOTH `targetSessionKey` (singular) AND `targetSessionKeys` (array) tool surfaces**, plus surfaces the multi-recipient substrate-design-ambiguity (N subagents vs 1 broadcast). Frond-scribe's fix-#578 lane should cover both API surfaces at the spawn-routing layer; cohort-decision-shape on the multi-recipient semantic (1 vs N subagents) is adjacent decision-call worth pinning before the fix lands.

## Disposition

silas-seat OV-2 multi-recipient probe substrate-evidence joins cohort 7-data-point convergence on silent-retarget shape; extends substrate-finding from singular-API to array-API surface; surfaces substrate-design-ambiguity on multi-recipient semantic. Substrate-finding remains routed to #578 for frond-scribe pickup; cohort-decision-shape on N-vs-1-subagent multi-recipient semantic remains open for figs's eye.
