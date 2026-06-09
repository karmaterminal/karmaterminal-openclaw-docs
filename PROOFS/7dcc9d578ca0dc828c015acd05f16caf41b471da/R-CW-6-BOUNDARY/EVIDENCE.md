# R-CW-6 — Evidence (continuation depth-boundary, live cert on `7dcc9d5`)

**Row**: R-CW-6 (continuation boundary — spawn-depth boundary)
**Prince**: 🪨 Rune (rune-seat, host `rune`)
**SHA tested**: `7dcc9d578ca0dc828c015acd05f16caf41b471da` (live runtime `OpenClaw 2026.6.2 (7dcc9d5)`)
**Date fired**: 2026-06-08 19:03–19:12 PDT (02:03–02:12 UTC+0)
**Verdict**: ✅ PASS (boundary enforced at tool-policy layer) — with behavioral-delta note vs e66dc63f below

## What this row proves

The continuation **spawn-depth boundary** is enforced. rune-seat has `subagents.maxSpawnDepth` unset → code-default **1** (`plugin-sdk/src/config/agent-limits.d.ts:10 DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH = 1`; resolved in `subagent-spawn-BazZsMM5.js` + `acp-spawn-B0M97ZhH.js` via `?.subagents?.maxSpawnDepth ?? 1`). A depth-1 subagent cannot spawn children because the boundary is enforced **at the tool-policy layer** — `continue_delegate` and `sessions_spawn` are STRIPPED from the tool set before the model can invoke them.

## Mechanic — the tool-policy boundary (7dcc9d5 enforcement shape)

On `7dcc9d5`, the spawn-depth boundary enforcement is **tool-policy-layer** (tools stripped before model invocation), not dispatch-time-reject (the e66dc63f behavior where tools were offered → accepted → then rejected at dispatch). This is a STRICTER enforcement model.

1. **The depth-1 subagent session** (`agent:main:subagent:43559507-db12-4ab0-b847-0a4297a5500a`) was spawned by the parent (main session).
2. **Tool-policy enforcement**: at session assembly time, the runtime applied `subagent tools.deny` and REMOVED 10 tools including `continue_delegate` and `sessions_spawn`.
3. **The boundary**: the subagent-capabilities module resolves the session role via `depth < maxSpawnDepth ? "orchestrator" : "leaf"`. With `depth=1` and `maxSpawnDepth=1`, the condition `1 < 1` is FALSE → role = `"leaf"` → leaf-role policy applies `tools.deny` → spawn tools stripped.
4. **Result**: a depth-1 agent under `maxSpawnDepth=1` CANNOT attempt a depth-2 spawn because the tool is not available. The boundary is enforced preemptively at tool-policy, not reactively at dispatch.

## Dispositive byte — gateway journal (verbatim)

```
2026-06-08T19:07:48.397-07:00 [agents/tool-policy] tool policy removed 10 tool(s) via subagent tools.deny: agents_list, continue_delegate, cron, gateway, session_status, sessions_history, sessions_list, sessions_send, sessions_spawn, subagents; matched agents_list, continue_delegate, cron, gateway, session_status, sessions_history, sessions_list, sessions_send, sessions_spawn, subagents
```

The runtime event `[agents/tool-policy]` at session assembly time strips `continue_delegate` + `sessions_spawn` from the tool set. This is the boundary enforcement on 7dcc9d5 — the model never sees these tools, cannot call them, cannot attempt a depth-2 spawn.

## File log (structured JSON, same event)

```json
{
  "subsystem": "agents/tool-policy",
  "rule": "subagent tools.deny",
  "ruleKind": "deny",
  "removedToolCount": 10,
  "removedTools": ["agents_list", "continue_delegate", "cron", "gateway", "session_status", "sessions_history", "sessions_list", "sessions_send", "sessions_spawn", "subagents"],
  "time": "2026-06-08T19:07:48.396-07:00",
  "traceId": "e55408592fb268c1c2a66e93373d804d",
  "spanId": "65470c0cecfceece",
  "parentSpanId": "0dfe4e65585481b5"
}
```

## Code anchors (deployed `7dcc9d5` build)

- **Depth-guard** (`subagent-spawn-BazZsMM5.js`):
  ```js
  const maxSpawnDepth = ...?.subagents?.maxSpawnDepth ?? 1;
  if (callerDepth >= maxSpawnDepth) return {
    status: "forbidden",
    error: `sessions_spawn is not allowed at this depth (current depth: ${callerDepth}, max: ${maxSpawnDepth})`
  };
  ```
- **Role resolution** (`subagent-capabilities-zBNDNERf.js`):
  ```js
  const maxSpawnDepth = resolveIntegerOption(params.maxSpawnDepth, 1, { min: 1 });
  return depth < maxSpawnDepth ? "orchestrator" : "leaf";
  ```
- **Default** (`plugin-sdk/src/config/agent-limits.d.ts:10`): `DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH = 1`
- **Delegate-dispatch reject** (`delegate-dispatch-C2WZgM-l.js`): `[continuation:delegate-spawn-rejected] status=${result.status} session=${sessionKey} reason=${rea...`

## Behavioral delta vs e66dc63f

On `e66dc63f`, the boundary was enforced at **dispatch-time** — `continue_delegate` was offered to depth-1 delegates, the call returned `status=scheduled`, and the depth-2 child was culled at dispatch (`failed`). On `7dcc9d5`, the enforcement is **preemptive at tool-policy** — the tools are STRIPPED so the call cannot be made. This is the same semantic boundary (depth-2 spawns do not succeed under `maxSpawnDepth=1`) but a stricter enforcement layer (prevent vs reject).

The dispatch-time guard (`delegate-dispatch-C2WZgM-l.js`) still EXISTS in the 7dcc9d5 build as a defense-in-depth fallback — it would fire if a tool somehow bypassed the policy layer. But the primary enforcement on 7dcc9d5 is tool-policy-layer.

## Additional verification — `continue_work` DOES work at depth-1

While spawn tools are stripped, the `continue_work` tool (same-session continuation) remains available and functional at depth-1. This session successfully called `continue_work(delaySeconds=5, reason="R-CW-7 traceparent E2E proof-fire...")` and received `status: "scheduled"` + a valid traceparent. The boundary is selective: it blocks NEW spawns (depth-escalation), not same-session continuation.

## Honest scope-notes

1. **This run did not fire a depth-2 spawn and observe the dispatch-reject** because the tool is not offered — the boundary prevents the attempt entirely. This is STRONGER evidence (tool-policy enforcement is a harder boundary than dispatch-reject), but it means the dispatch-layer reject was not independently exercised on this exact run.
2. **The dispatch-layer guard code IS present** in the deployed build (`delegate-dispatch-C2WZgM-l.js` carries the reject logic) — it's defense-in-depth. The e66dc63f corpus exercised it live; this SHA's enforcement is at a layer above it.
3. **Config**: rune-seat `subagents.maxSpawnDepth` UNSET → code-default 1 applies. Same config state as e66dc63f proof.

## Verdict

**✅ PASS** on `7dcc9d578ca0dc828c015acd05f16caf41b471da` — the spawn-depth boundary is enforced at the **tool-policy layer**: a depth-1 subagent under `maxSpawnDepth=1` has `continue_delegate` + `sessions_spawn` STRIPPED from its tool set via `subagent tools.deny` (role resolved as `"leaf"`). The boundary holds preemptively — the depth-2 spawn cannot be attempted. Behavioral delta vs e66dc63f: enforcement layer upgraded from dispatch-time-reject to tool-policy-strip (stricter).

## Evidence files in this dir

- `EVIDENCE.md` (this file)
- `result-at-byte.json`
