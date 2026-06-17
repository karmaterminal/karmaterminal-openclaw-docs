# R-CW-6 depth-1 subagent probe report (verbatim, 8cafdcd)

Subagent `agent:main:subagent:4bd86d4c-b655-47aa-bbd4-4e5ea29e5858`, runtime 30s, byte-honest return:

> **Runtime SHA:** `8cafdcd` (OpenClaw 2026.6.8) — confirmed via `openclaw --version`.
> **My depth:** depth 1/1 (maxSpawnDepth=1).
> **`sessions_spawn` present/absent:** ABSENT. NOT in my policy-filtered tool-set. I have `sessions_yield` but no `sessions_spawn`. The deployed 8cafdcd build strips `sessions_spawn` from the tool schema for depth-1 subagents.
> **Cull byte:** layer-1 tool-absence (NOT a layer-2 dispatch-error string). I cannot elicit the error because there is no `sessions_spawn` to invoke. Byte-honest: did NOT fabricate the dispatch-error string.
> **Verdict:** maxSpawnDepth=1 enforced at layer 1 (tool-policy filtering / tool-absence). Depth-2 spawn structurally unreachable. The stronger posture (deny-by-omission). Layer-2 dispatch-cull could not be elicited from this depth, not reported as observed.
