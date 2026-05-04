# swim-42 / OV-6 — fire-1: chain-budget anti-flood cap probe

**Status**: ✅ chain-step accounting + per-turn dispatch counter substrate-coherent. **Non-targeting axis** — independent of #580.

**Source**: runner-seat fire-1 from `agent:main:discord:channel:1466192485440164011` at 2026-05-04T02:24:52Z. Three concurrent `continue_delegate` tool calls in a single turn, all `mode: silent`, no `targetSessionKey`, distinct task bodies (`OV-6 probe 1/2/3 of 3`).

## Tool-result substrate

The tool returned three sequential results in the same turn:
- delegate 1: `delegatesThisTurn: 1, delegateIndex: 1`
- delegate 2: `delegatesThisTurn: 2, delegateIndex: 2`
- delegate 3: `delegatesThisTurn: 3, delegateIndex: 3`

Per-turn counter increments correctly (3, not 1, not collapsed-to-fanout). Live config has `maxDelegatesPerTurn: 500` (re-pinned via `openclaw config get agents.defaults.continuation`), so no rejection fired.

## Registry substrate (`flow_runs`)

Three dispatcher-owned `flow_runs` from this fire (per-fire byte-pin):

| flow_id | controller_id | created_utc | status | chain_id |
|---|---|---|---|---|
| `f14fd02f-…` | `core/continuation-delegate` | 2026-05-04 02:24:52 | succeeded | (empty) |
| `88e48f7d-…` | `core/continuation-delegate` | 2026-05-04 02:24:52 | succeeded | (empty) |
| `1752ba7e-…` | `core/continuation-delegate` | 2026-05-04 02:24:52 | succeeded | (empty) |

Three independent dispatcher rows, all owned by the dispatching session, all `succeeded`. **Important observation**: `chain_id` field is empty (NULL) for all three despite the schema carrying the column. Either (a) not populated yet on this canonical for plain-subagent-spawn dispatches, or (b) only populated under specific routing conditions (cross-session, fanout, etc.). Worth a sub-row byte-pin if cohort wants to chase `chain_id` semantics as their own swim row.

## Task substrate (`task_runs`)

Three pairs of rows (1 dispatcher-side `subagent` task_run + 1 child-session `cli` task_run, per dispatch):

| task_id | runtime | child_session_key | parent_flow_id | created_utc | status |
|---|---|---|---|---|---|
| `59d779f5-…` | subagent | `agent:main:subagent:db916982-…` | `3bf329aa-…` | 02:25:12 | succeeded |
| `13294073-…` | cli | `agent:main:subagent:db916982-…` | (none) | 02:25:12 | succeeded |
| `d87b4b6f-…` | subagent | `agent:main:subagent:89274782-…` | `1fedb83d-…` | 02:25:11 | succeeded |
| `ff53bb9a-…` | cli | `agent:main:subagent:89274782-…` | (none) | 02:25:11 | succeeded |
| `1ec981c0-…` | subagent | `agent:main:subagent:1c0d7ba5-…` | `eba5d99f-…` | 02:25:09 | succeeded |
| `786b46ec-…` | cli | `agent:main:subagent:1c0d7ba5-…` | (none) | 02:25:09 | succeeded |

Three distinct child sessions (`db916982` / `89274782` / `1c0d7ba5`), each with its own subagent task_run + paired cli task_run. Chain-step accounting walks correctly: each dispatch got its own subagent spawn, no collapsed-to-fanout, no overflow, no rejection.

## What this attests for OV-6

- ✅ **per-turn dispatch counter** increments correctly (1 → 2 → 3 per tool call within same turn)
- ✅ **chain-step accounting** allocates one chain-step per dispatch (not one per fanout)
- ✅ **per-dispatch session isolation** — each delegate gets its own subagent session, no cross-talk between concurrent dispatches
- ✅ **substrate stays clean under 3-concurrent load** — all 6 task_runs landed `succeeded`, no chain-budget warnings, no rejections
- ✅ **#571 hybrid (A)+(C) failure-semantics not exercised** (no rejection conditions hit at 3-concurrent under 500-cap config); separate row would cover the failure-side

## What this does NOT attest

- the 50-recipient fanout case (per #898 OV-6 prose: "50-recipient fanoutMode: 'all' decrements chainStepBudgetRemaining by 1, NOT by 50") — that case requires `targetSessionKeys` array OR `fanoutMode`, both of which are gated on the #580 fix
- the mercy-clause case (per RFC §6.7: "when chainStepBudgetRemaining <= 0, traceparent NOT threaded past cap") — requires saturating the chain budget which requires routable cross-session fanout, also #580-gated

So OV-6 fire-1 closes the **non-targeting half** of the OV-6 acceptance shape (per-turn counter + per-dispatch chain-step + isolation + clean substrate behavior under concurrent load). The **targeting half** (fanout cap + mercy-clause) remains gated on #580.

## Honest scope-limit

OV-6 fire-1 is a small concurrent-load case (3 dispatches), not the full anti-flood case (would need closer-to-cap dispatches like 50+ to exercise the cap-mercy boundary). Would require a follow-on fire to cover the cap-boundary axis specifically; current fire byte-pins the substrate-coherent normal-load case only.

## Verdict

🟢 OV-6 non-targeting axis substrate-coherent on canonical `f39b8c9751`. Per-turn counter, per-dispatch chain-step, per-dispatch isolation all behave as advertised under 3-concurrent normal-load. Targeting-axis OV-6 sub-rows (fanout-cap, mercy-clause) gated on #580. Substrate-finding NOT a bug; row produces evidence of correct behavior on the non-gated half.
