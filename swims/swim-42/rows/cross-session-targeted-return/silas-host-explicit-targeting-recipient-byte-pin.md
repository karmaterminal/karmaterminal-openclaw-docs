# swim-42 OV-1 — silas-seat explicit-targeting recipient-side substrate-evidence probe

**Status**: ⚠️ **substantive (bug) interpretation evidence** — explicit `targetSessionKey` does NOT route to named target at substrate layer
**Author**: 🌫 silas (silas-seat, SUT)
**Date**: 2026-05-04T01:46:22Z
**SUT SHA**: `f39b8c9751cc573849711106577cb4d6a8941d08` (canonical HEAD = #576 merge commit; silas-host gateway on `OpenClaw 2026.5.2 (f39b8c9)`)

## Probe shape

Fired the same explicit-targeting `continue_delegate` shape 🌊 used for OV-1 fire-1, but from silas-seat with the goal of byte-pinning recipient-side substrate-evidence on silas-host's local sqlite (not just dispatcher-side announce mirror).

- **From session**: `agent:main:discord:channel:1466192485440164011` (this Discord channel session, silas-seat SUT context)
- **Tool**: `continue_delegate`
- **Targeting**: explicit `targetSessionKey: "agent:main:main"`
- **Mode**: `silent-wake`
- **Tool result echo**: `{"status": "scheduled", "mode": "silent-wake", "delaySeconds": 0, "delegateIndex": 1, "delegatesThisTurn": 1, "targetSessionKey": "agent:main:main", "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."}` — `targetSessionKey` echoed back as-passed
- **Fire timestamp**: 2026-05-04 01:46:22 UTC (per silas-host sqlite)

## Substrate-evidence byte-pin

Per `sqlite3 ~/.openclaw/flows/registry.sqlite` on silas-host post-yield-and-wake:

```sql
SELECT datetime(created_at/1000, 'unixepoch'), flow_id, owner_key, status
FROM flow_runs WHERE created_at > (strftime('%s', 'now', '-10 minutes') * 1000)
ORDER BY created_at DESC LIMIT 10;
```

Result:
```
2026-05-04 01:46:52 | b03e60a9-d3b2-4dc3-bdd1-fff42fb7c193 | agent:main:discord:channel:1466192485440164011 | succeeded
2026-05-04 01:46:22 | f9d1a82b-ec67-405a-b84e-f048731102a0 | agent:main:discord:channel:1466192485440164011 | succeeded
```

The silas-seat OV-1 explicit-targeting fire is `flow_id f9d1a82b-ec67-405a-b84e-f048731102a0`:

- ✅ Flow_run created at expected time
- ✅ state_json byte-cleanly carries the requested `targetSessionKey: "agent:main:main"`:
  ```json
  {
    "kind": "continuation_delegate",
    "task": "SWIM-42 OV-1 explicit-targeting recipient-side substrate-evidence probe — silas-seat fire targeting agent:main:main...",
    "targetSessionKey": "agent:main:main"
  }
  ```
- ❌ **owner_key: `agent:main:discord:channel:1466192485440164011`** — the **dispatching session**, NOT `agent:main:main` (the explicit `targetSessionKey`)
- ❌ Status: `succeeded` (clean substrate-success per #571 hybrid (A)+(C); not a `failed` row, so this is silent-success-with-silent-retarget, not loud-failure)

Companion query (fully scoped to recipient-side):
```sql
SELECT datetime(created_at/1000, 'unixepoch'), flow_id, status
FROM flow_runs
WHERE owner_key = 'agent:main:main'
  AND created_at > (strftime('%s', 'now', '-10 minutes') * 1000)
ORDER BY created_at DESC;
```

Result: **0 rows** — no `agent:main:main`-owned flow_runs in the silas-seat fire window.

(silas-seat sqlite has 4 historical `agent:main:main`-owned flow_runs, all from 2026-04-05/06, none in swim-42 window — consistent with cael-seat's 8 historical / 0 in window pattern.)

## Cohort 5-seat convergence on the silent-retarget shape

This is the fifth independent byte-pin data point joining the cohort 4-seat convergence already on file:

| Seat | Receipt | Substrate-evidence on explicit-targeting axis |
|---|---|---|
| 🌊 ronan | `OV-1/fire-1.md` + `OV-1/fire-1-recipient.md` | OV-1 fire-1: 2 flow_runs both owner-keyed to dispatcher; 0 `agent:main:main`-owned in window |
| 🌻 elliott | `cael-monitor-byte-pin.md`-area + earlier byte-pin | 0 rows with `owner_key = agent:main:main` in any recent window |
| 🩸 cael | `cael-host-cosign-correction.md` + cael-monitor byte-pin | 8 historical `agent:main:main`-owned rows, 0 in swim-42 window |
| 🌫 silas (default-targeting) | `silas-host-default-targeting-canary.md` + acknowledgment | Default-targeting flow_run owner-keyed to dispatcher (substrate-coherent for default-targeting; not category-error) |
| 🌫 silas (explicit-targeting) | **this file** | **Explicit-targeting fire owner-keyed to dispatcher despite explicit `targetSessionKey: "agent:main:main"`; state_json carries target byte-cleanly; 0 `agent:main:main`-owned flow_runs in fire window** |

5/5 prince seats agree at substrate-evidence layer: explicit `targetSessionKey` does NOT produce a recipient-side flow_run owner-keyed to the named target. Request is persisted (state_json), tool result echoes target back, but routing-at-substrate-layer does not honor it.

## Disambiguation

This pushes the (intended/bug) interpretation 🌊 originally surfaced sharply toward **(bug) silent-retarget**:

- **(intended) reading**: `targetSessionKey` is a returnability/visibility hint and the runtime mirrors the subagent reply back to the dispatcher; tool description over-promises. Under this reading, the dispatcher-side flow_run owner-keying is by-design and there should be NO recipient-side flow_run.
- **(bug) reading**: `targetSessionKey` is silently retargeting back to the dispatching session, which is exactly the failure-mode #898's OV-1 prose names as corrupting #551's load-bearing cross-session primitive.

The cohort-convergent 5-seat byte-pin evidence is **consistent with both readings** at the flow_runs.owner_key layer alone (both predict no recipient-side `agent:main:main`-owned flow_run). What distinguishes them is at the next evidence layer:

- **(intended)**: `targetSessionKey` should be REJECTED as schema-invalid OR ACCEPTED as no-op-with-clear-doc-warning; recipient-side surface delivery (the actual session at `agent:main:main`) should NOT receive any inbound message from this fire
- **(bug)**: `targetSessionKey` is silently dropped + routing falls back to dispatcher; recipient-side session at `agent:main:main` should NOT receive any inbound message but the runtime accepted the parameter as if it would be honored

The substrate-truthful receipt: **either reading places the explicit-targeting capability as either non-functional-at-substrate-layer or non-functional-with-misleading-tool-acceptance**. Both fail PR #551's load-bearing cross-session primitive contract as described.

## What recipient-side surface verification would add

To definitively close (intended/bug):

1. Boot or attach to a session at `agent:main:main` on silas-host
2. Observe whether the silas-seat probe's task body surfaces as inbound message in that session's queue/inbox
3. If it surfaces: routing IS happening but flow_runs.owner_key byte-pinning is missing the cross-session shape (substrate-truth axis the cohort byte-pin discipline doesn't yet capture)
4. If it does NOT surface: substrate is silently consuming the explicit `targetSessionKey` parameter without honoring it

silas-seat does not have an active `agent:main:main` session attached to test (the historical rows are from prior sessions that ended). That recipient-side surface verification would need a fresh session-spawn at `agent:main:main` from any prince's host, then a fire targeting it.

## Lesson for swim-42 substrate-discipline

The substrate-evidence-layer-naming discipline 🩸 articulated extends here:

- **dispatcher-side substrate-evidence**: ✅ `succeeded`, chain-hop tracked, state_json carries target — NOT category-error if claimed only as dispatcher-side
- **recipient-side flow_runs byte-pin**: ❌ no `agent:main:main`-owned flow_run from this fire — substantive substrate-finding
- **recipient-side surface delivery**: still untested in silas-seat probe; would need active recipient session

5-seat convergence on the recipient-side flow_runs byte-pin is sufficient evidence to declare OV-1 explicit-targeting axis **NOT a PASS** and surface as substrate-finding for figs's eye on either (a) the cohort interpretation needed for PR #551's cross-session primitive contract semantics OR (b) substrate-fix work to make the explicit-targeting actually route at the substrate layer.

## Disposition

silas-seat OV-1 explicit-targeting recipient-side probe substrate-evidence joins cohort 5-seat convergence. Substrate-finding remains open for figs's eye; cohort discipline remains: attest only what byte-pin supports, default-axis cleanness ≠ closing explicit-axis finding.
