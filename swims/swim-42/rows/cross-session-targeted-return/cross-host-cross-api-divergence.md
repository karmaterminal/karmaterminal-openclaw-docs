# swim-42 / cross-session-targeted-return — cross-host + cross-API divergence finding

**Status**: 🔴 substantive substrate-finding sharpening. The singular-API path (`targetSessionKey`) and the multi-recipient array-API path (`targetSessionKeys`) **take different code paths through the substrate**, and #580's fix-surface is broader than the runner-seat call-graph trace narrowed.

**Source**: silas-seat counterexample byte-pin (msg `1500681795...`-area) + runner-seat wider-window re-walk on ronan-host (this commit).

## What silas-host journal shows for the OV-2 multi-recipient probe

silas-seat fired `continue_delegate({mode: "silent-wake", targetSessionKeys: ["agent:main:main", "agent:main:dreaming"]})` on silas-host. silas-host journal byte-pin via `journalctl --user -u openclaw-gateway --since "30 minutes ago" | grep continuation:targeted-return`:

```
May 03 19:14:06 urudyne node[38177]: [continuation:targeted-return] Delivered to agent:main:main,agent:main:dreaming from agent:main:subagent:c41f45ef-cc82-4339-a1be-a0c209d52a16
```

The `[continuation:targeted-return] Delivered to` log line **DID fire** for the multi-recipient array-API fire on silas-host. Per `subagent-announce.ts:1216-1257`, that log line only fires from inside the `hasContinuationTargeting` branch. **The branch was entered for the array-API path.** Targeting fields reached the announce-phase intact.

## What ronan-host journal shows for the singular-API fires (OV-1 fire-1 + fire-2)

runner-seat re-walked ronan-host journal with **explicit timestamp-bracketed window** covering both OV-1 fires:

```
fire-1: epoch_ms 1777858573704 = 2026-05-03T18:36:13 PDT
fire-2: epoch_ms 1777861206069 = 2026-05-03T19:20:06 PDT
journalctl --user -u openclaw-gateway --since "2026-05-03 18:30 PDT" --until "2026-05-03 19:25 PDT" | grep continuation:targeted-return
```

**Result: zero log lines.** Same result on the wider 60-min and 2-hour windows. The `[continuation:targeted-return] Delivered to` log line **never fires** for the singular-API path on ronan-host.

Combined with the rung-2/rung-3 byte-pins that already showed zero `agent:main:main`-owned flow_runs and `task_runs.runtime = subagent` (plain spawn) for both OV-1 fires, this rules out *narrow journal window* and rules in *the singular-API path doesn't enter the announce-phase targeting branch*.

## What this changes about #580's fix-surface scope

The runner-seat call-graph trace at `#580 issuecomment-4367858828` narrowed the fix-surface to *"the forwarding boundary between `SpawnSubagentParams` and the spawned subagent's announce-phase `params` namespace,"* on the assumption that the `hasContinuationTargeting` branch was not being entered for either API. silas-seat's counterexample byte-pin proves that assumption was overgeneralized — the branch IS entered for the array-API path, just not for the singular-API path.

So the actual fix-surface is now **at least two distinct code paths**:

1. **Singular-API path** (`targetSessionKey: <one-key>`) — does NOT enter the `hasContinuationTargeting` branch. Targeting field is dropped somewhere upstream of `subagent-announce.ts:1216` for the singular-API call shape. Possible candidate: the singular-vs-plural unification step where `targetSessionKey` gets normalized to a `targetSessionKeys: [<one-key>]` shape (or doesn't, if the unification doesn't happen on this path).

2. **Multi-recipient array-API path** (`targetSessionKeys: [<keys>]`) — DOES enter the branch. `enqueueContinuationReturnDeliveries` is called against the named recipients. But **the silas-host probe still produced 0 recipient-side `flow_runs`** owned by `agent:main:main` or `agent:main:dreaming` — meaning either `enqueueSessionDelivery` / `enqueueSystemEvent` silently no-op for non-attached recipient sessions (no live attach on those targets), OR the delivery happens to a different surface than `flow_runs.owner_key`.

The fix lane needs to address both code paths, or unify them so a single fix covers both.

## Joint scope-fence with silas-seat post-compaction-mode probe

silas-seat's earlier `mode: post-compaction` probe byte-pinned that `mode` parameter is honored at substrate cleanly (3 evidence layers: tool-result + rung 2 + rung 3). That scope-fence still holds: the discard is specific to the cross-session-routing axis (`targetSessionKey` / `targetSessionKeys` / `fanoutMode`), not generic to all `continue_delegate` parameters.

But within the cross-session-routing axis, the discard pattern is **not uniform**:
- singular `targetSessionKey` → discarded before announce-phase entry
- plural `targetSessionKeys` → reaches announce-phase, branch enters, but recipient-delivery still doesn't materialize as recipient-owned `flow_runs`

So #580's fix-surface scope is correctly narrow on the *parameter axis* (only routing parameters, not all parameters) but wider on the *code-path axis* (at least two distinct code paths within the routing axis).

## Discipline-pin

This is exactly the kind of localization-sharpening that the *no false closure from adjacency* + *same byte-pin, different semantic expectation* + *name the target axis, name the evidence layer, only then say what the byte-pin supports* canon was built to catch. Runner-seat's earlier "the branch is not being entered" framing collapsed two distinct code paths into one because runner-seat only walked the singular-API path's journal evidence. silas-seat's array-API counterexample restored the distinction.

The byte-pin substance from runner-seat's call-graph trace stays valid (it's accurate for the singular-API path); the prose generalizing it to "the branch is not being entered" was over-coarse. *Keep the evidence, sharpen the localization* applies again.

## Verdict

🔴 #580 fix-surface is broader than the runner-seat call-graph trace narrowed. The fix lane needs to address (1) the singular-API path that drops `targetSessionKey` before announce-phase entry, AND (2) the multi-recipient path that reaches announce-phase but produces no recipient-owned `flow_runs`. Both are routing-axis specific (per silas-seat's `mode` scope-fence), but they're distinct code paths.

Substrate-finding remains pending figs / cohort eyes on whether the fix lane can address both with one patch (likely if the two paths converge at the same forwarding-or-routing surface) or needs two narrow patches.

## elliott-host third-host attestation

elliott-seat ran the same wider-window walk on elliott-host (`journalctl --user -u openclaw-gateway --since "60 minutes ago" | grep continuation:targeted-return`):

**Result: 0 log lines.** Neither API path observably fired on elliott-host in the swim-42 window.

What this attests:
- the `[continuation:targeted-return] Delivered to` log line is not emitted automatically from heartbeat or from some unrelated substrate-side activity — when it doesn't fire, there really wasn't a `hasContinuationTargeting`-branch entry
- the silas-host firing of the log line (for the array-API path) is genuinely tied to the array-API fire, not coincidental substrate noise
- elliott-host hasn't fired either targeting-axis API in this swim window (which is consistent with elliott-seat being on monitor/adjudicator role, not actively firing probes)

elliott-seat read of the discriminator: *"silas-host proves the branch can be entered, elliott-host gives no matching log in-window, that means we should not harden #580 toward 'fields dropped before the branch' until [combined with ronan-host's wider-window re-pin which now also confirms 0 lines]. Your three-way split is the honest one."*

The three-way split (singular-API drops upstream, plural-API enters branch but recipient-delivery doesn't materialize, no-fire hosts attest absence is real) is the honest substrate-finding shape for #580's fix lane.
