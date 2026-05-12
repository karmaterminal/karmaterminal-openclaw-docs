# crossSessionTargeting behavioral matrix — settled SHA `6db118a2`

## Config schema

X''''''-prime carries the `agents.defaults.continuation.crossSessionTargeting` config option (introduced via OUTCOME-3 lane in continuation-feature commits `640219ae5c` + `0915c3d11f`, folded into this squash). Documented in RFC at `docs/design/continue-work-signal-v2.md` §5.3 (lines 1009-1018).

```yaml
agents:
  defaults:
    continuation:
      crossSessionTargeting: "disabled"   # or "enabled"
```

Default: `"disabled"`.

## Behavior matrix

| Config              | `targetSessionKey` (non-self) | `targetSessionKeys` (any non-self) | `fanoutMode: "all"` | Self-target | `fanoutMode: "tree"` (lineage) |
|---------------------|-------------------------------|------------------------------------|---------------------|-------------|--------------------------------|
| `"disabled"` (default) | ❌ rejected                | ❌ rejected                          | ❌ rejected          | ✅ allowed   | ✅ allowed                       |
| `"enabled"`         | ✅ allowed                    | ✅ allowed                            | ✅ allowed           | ✅ allowed   | ✅ allowed                       |

## Enforcement points (live-read, no restart required)

The gate is enforced at four enforcement points to cover all paths into delegate dispatch:

1. **Tool validation** (`src/agents/tools/continue-delegate-tool.ts`) — fail-fast on invalid input shape per the gate
2. **TaskFlow delegate dispatch** (`src/auto-reply/reply/post-compaction-delegate-dispatch.ts`) — re-check on dequeue (config may have changed between enqueue and dispatch)
3. **Post-compaction delegate release** (`dispatchPostCompactionDelegates`) — re-check during the post-compaction lifecycle event
4. **Bracket-syntax spawn** (`src/agents/subagents-tool.ts` bracket parser) — same gate covers the alternative invocation surface

Live-read at config-reload (SIGUSR1) means an operator flipping `disabled` → `enabled` (or vice-versa) takes effect on the next dispatch decision without requiring a gateway restart.

## Substrate-evidence

The gate's source-commit `640219ae5c` ("feat(continuation): gate cross-session delegate targeting") landed via the OUTCOME-3 lane on May 11, with edge-case fixes at `0915c3d11f` ("address 3 edge-case gaps in crossSessionTargeting gate"). Both are folded into this squash.

The fleet validation that the gate's schema-validation gate works correctly is independently visible: when fleet-seats with `crossSessionTargeting: enabled` in config tried to deploy karmaterminal canonical-line tip `f7ede2b2` (which doesn't carry the schema), the config-validate gate rejected with `Unrecognized key: "crossSessionTargeting"` — exactly the right behavior (rather than silently accepting an unknown key). See Discord substrate at msgs `1503843701` (cael byte-walk) + `1503844868` (ronan substrate-walk).

When the same fleet-seats deployed `660aa847` (X'''''', which DOES carry the schema), the config validated cleanly. The schema's presence / absence in the binary is observable via config-validate at deploy time — defense-in-depth against operator-config-vs-binary-version drift.

## Default-deny rationale

The default value `"disabled"` reflects the threat-model: a model-controlled `continue_delegate` call with `targetSessionKey` pointing to a non-self session would, without the gate, allow one continuation-enabled session to inject ambient context into unrelated sessions on the same host. Operators must explicitly opt in to cross-session targeting when their deployment model requires it.

For self-targeting (the dispatcher's own session returning the delegate's result back to itself) and lineage routing (`fanoutMode: "tree"`, returning up the spawn-ancestor chain), the gate has no effect — these are the safe defaults that always work.

## Reference

- RFC: `docs/design/continue-work-signal-v2.md` §5.3 lines 1009-1018
- Tracking issue: karmaterminal/openclaw#654 (P1 from clawsweeper review of #79925)
