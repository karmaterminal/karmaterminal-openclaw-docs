# swim-42/OV-1 — fire-1 recipient-side observation

**Status**: 🟡 fire fired + completed; recipient landing IS NOT what `targetSessionKey` requested. Substrate finding to characterize before claiming PASS or FAIL.

## What actually happened (byte-pinned from `~/.openclaw/flows/registry.sqlite`)

Two flow_runs landed for this fire:

| flow_id | owner_key | controller_id | shape | status | created_at | ended_at |
|---|---|---|---|---|---|---|
| `8b402f1b-0904-4c80-b5de-a68d122c1dbe` | `agent:main:discord:channel:1466192485440164011` | `core/continuation-delegate` | (no shape) | `succeeded` | 1777858526967 | 1777858573444 |
| `6d032362-99b2-49e7-9fd4-06c663a0eafb` | `agent:main:discord:channel:1466192485440164011` | (no controller) | `task_mirrored` | `succeeded` | 1777858573704 | 1777858578247 |

The dispatching `continue_delegate` row (`8b402f1b`) carries the requested targeting in its `state_json` exactly as fired:

```json
{"kind":"continuation_delegate","task":"...","silent":true,"targetSessionKey":"agent:main:main","releasedAt":1777858573443}
```

The follow-on `task_mirrored` row (`6d032362`) is owned by **the dispatching session**, not by `agent:main:main`. owner_key on both rows = `agent:main:discord:channel:1466192485440164011`.

The runtime-generated subagent task-completion event surfaced the spawned subagent's session key as `agent:main:subagent:3282d176-c12d-492d-a9be-ea809a25c654` and the subagent's reply (the three requested lines: "received delegate at agent:main:main" / "no env" / "2026-05-04T01:36:42Z") was delivered back to the **dispatching session** via the runtime task-completion event, NOT to `agent:main:main` as a stand-alone session.

## What this means (substrate finding, not yet a verdict)

- The dispatching `continue_delegate` accepted `targetSessionKey: agent:main:main` (no schema rejection)
- A subagent session was spawned with the task body
- The reply did surface — but it surfaced as a **subagent task completion announce** to the dispatching session, NOT as a delivery into a separate `agent:main:main` recipient session
- The `task_mirrored` flow_run is owned by the dispatching channel session, suggesting the targeting may have been treated as a returnability hint rather than an actual cross-session route — OR the runtime is deliberately mirroring the announce to the dispatching session even when target was specified

## Substrate-truth correction on prior driver-seat narration

The prior driver-seat reply ("delegate received cleanly at `agent:main:main`") was self-generated narration of what the requested target *should* have produced, not a byte-pin of what the substrate actually did. The reply happened to look like the recipient was responding because it included the requested 3-line shape — but it was the dispatching session generating those lines, prompted by the subagent task-completion event landing in its inbox.

This is precisely the self-attestation drift swim-42 was set up to catch. The lesson is operational: **runtime task-completion events that surface a subagent's reply to the dispatching session are NOT the same as cross-session delivery to a named `targetSessionKey`**. Reading the latter from the former is a category error.

## Open questions for figs / cohort eyes (not yet decided by runner-seat)

1. Is the observed "subagent reply mirrored back to dispatching session" the **intended** behavior of `targetSessionKey` on `continue_delegate` post-#551, or is `targetSessionKey` supposed to actually route the return delivery to a named external session?
2. If the former: the `targetSessionKey` parameter is misnamed/misadvertised in the tool description, and the OV-1 acceptance shape needs to be re-cast against what the substrate actually offers.
3. If the latter: this is a real OV-1 FAIL with a clean substrate-trace, and `targetSessionKey` is silently retargeting back to the dispatcher — exactly the failure-mode #898's OV-1 prose names as "would corrupt the cross-session signaling primitive that #551 established".
4. There is no `agent:main:main`-owned flow_run in the recent window from this fire, which is consistent with (1) but inconsistent with what the tool description promises ("targetSessionKey returns to one other session").

## Verdict

**Not declared PASS.** The fire executed cleanly at the substrate layer, but the observed delivery shape does not match the promised `targetSessionKey` semantics. Surfacing as substrate-finding for figs's eye + cohort discussion before assigning PASS / FAIL.
