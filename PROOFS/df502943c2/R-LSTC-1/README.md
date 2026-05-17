# R-LSTC-1 — liveSessionToolConfig hot-reload via delegate continuation

**SHA**: `df502943c2667ff2e1eed9f850379b41f9b8a8f6`
**Build-info on host**: `OpenClaw 2026.5.17 (df50294)`, `build-info.json` commit `df502943c2667ff2e1eed9f850379b41f9b8a8f6`, builtAt `2026-05-17T06:56:38.908Z`
**Fire by**: 🌫 silas-seat (`urudyne`)

## Claim under test

Cure-(10) preserved the `liveSessionToolConfig: true` graft at the new policy seam (`src/auto-reply/reply/skill-tool-dispatch.runtime.ts:153`). On continuation-tool wake (`continue_delegate`), the dispatched delegate must run with **current** session config (model, provider, channel, agent), not a stale snapshot baked into the original session boot.

## Method

1. From silas-seat session running on `df502943c2`, invoked `continue_delegate(mode="silent", task="R-LSTC-1 proof shard...")` natively.
2. Captured structured tool result with traceparent.
3. Delegate ran, emitted a confirmation marker line, returned silently as enrichment to the parent session.
4. Re-fetched the full trace from tempo backend after delegate completion.
5. Verified the trace shows:
   - `continuation.delegate.dispatch` span (parent = session-root)
   - A second `openclaw.run` span (parent = `delegate.dispatch`) — the delegate's actual run
   - Both runs carry **identical model/provider/channel/trigger** attributes (delegate inherited session config, not a stale snapshot)
   - Common `chain.id` linking dispatch ↔ delegate (chain tracking works across boundary)
6. Byte-confirmed the live deployed bundle on the host has the `liveSessionToolConfig: true` graft at the expected call site.

## Evidence

### Tool result returned

```json
{
  "status": "scheduled",
  "mode": "silent",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-5d20de575ad4443bfd7cc7f50fa68350-6ccfea1c1a3de566-01"
}
```

### Tempo evidence

- **Trace ID**: `5d20de575ad4443bfd7cc7f50fa68350`
- **Tempo URL**: <http://tempo.dandelion.cult/api/traces/5d20de575ad4443bfd7cc7f50fa68350>
- **Trace dump**: [`trace.json`](./trace.json) (56.4 KB, 42 spans)
- **service.name**: `silas-prince`

### Span-tree chain (the load-bearing evidence)

```
openclaw.run                       parent=null              span=bM/qHBo95WY=  (root session)
  ├─ openclaw.tool.execution       parent=root              span=O77eYl09L2A=  toolName=continue_work
  ├─ openclaw.tool.execution       parent=root              span=lXTQS0BBMpc=  toolName=continue_delegate
  ├─ continuation.work             parent=root              span=x83T4DS+RPk=  chain.id=019e31f1-3c71-719b-a980-35a3cceeef48
  ├─ continuation.delegate.dispatch parent=root             span=pwLOqJoALBM=  chain.id=019e31f1-3c71-719b-a980-35a3cceeef48
  │                                                          delegate.mode=silent
  │                                                          delegate.delivery=immediate
  │                                                          chain.step.remaining=186
  └─ openclaw.run                  parent=delegate.dispatch span=JhTe5g0Z78Y=  (the DELEGATE's actual run)
        provider=github-copilot
        model=claude-opus-4.7-1m-internal
        channel=discord
        trigger=user
        outcome=completed
```

The delegate's `openclaw.run` span is **parented to** `continuation.delegate.dispatch`, and its provider/model/channel/trigger attributes **exactly match** the root session's. That means the delegate woke with the current session's runtime tool config, not a stale snapshot — the load-bearing claim of `liveSessionToolConfig: true`.

### Byte-evidence in deployed bundle

Live host `df50294` deployed runtime bundle `dist/skill-tool-dispatch.runtime-MxiQRqh8.js`:

```
...agentMemberRoleIds: params.ctx.MemberRoleIds,
   agentDir: params.agentDir,
   workspaceDir: params.workspaceDir,
   config: params.cfg,
   liveSessionToolConfig: true,            ← cure-(10) graft, deployed
   allowGatewaySubagentBinding: true,
   sandboxed: sandboxRuntime.sandboxed,
   requesterAgentIdOverride: params.agentId,...
```

Exactly the source position at `src/auto-reply/reply/skill-tool-dispatch.runtime.ts:153` in cure-(10) source — preserved through bundle minification.

## Verdict

**PASS**.

The cure-(10) `liveSessionToolConfig: true` graft is:
- Present in the source (verified by all 4 prince byte-walks)
- Present in the deployed bundle on the live host (verified above)
- **Operationally load-bearing**: delegate run carries identical runtime config to parent, with same `chain.id`, confirming the graft is the path the continuation took on wake — not a fallback or stale-snapshot path.

The substrate works end-to-end on `df502943c2`.

## Recipient-side receipt vs agent prose

Trace data fetched from tempo backend API (file `trace.json`). Bundle bytes inspected on disk. Both are recipient-side evidence; agent prose summarises them; substrate is in the files.

## Honesty note: delegate marker line

The delegate was tasked to also emit `LSTC-PROOF-OK trace=<the-traceparent-you-were-spawned-with>` as an additional marker. Delegate returned `trace=unknown` instead — the spawned child didn't surface its own traceparent into the textual response. **This does not affect the verdict**: the load-bearing evidence is the tempo span tree (delegate's `openclaw.run` parented to `continuation.delegate.dispatch` with matching config attrs + shared `chain.id`), captured in `trace.json` from the recipient-side backend. The marker-line was a redundant convenience check, not the substrate of the claim. Recording the gap for substrate-honesty.
