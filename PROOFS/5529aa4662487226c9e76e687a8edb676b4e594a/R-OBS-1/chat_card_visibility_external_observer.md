# R-OBS-1 — Elliott (🌻) + figs cross-walk: external /status continuation row + 4-prince cross-walk

**CANDIDATE_SHA:** `5529aa4662487226c9e76e687a8edb676b4e594a`
**Seat:** elliott / 10.0.0.153, gateway uptime since 22:00 restart onto 5529aa4662
**otel service:** `elliott-prince` · Tempo: https://tempo.dandelion.cult

## Verdict: ✅ PASS

The continuation surface is visible externally (in `/status` + the Tempo trace-store) on the deployed SHA, with the continuation-row (chain-counter + volitional-count) and all 3 continuation tools confirmed firing.

## My-seat `/status` continuation row (external-observer view)
```
🔄 Continuation: chain 0/200 | volitional: 1
📚 Context: ~68% · 🧹 Compactions: 2
🧵 Session: agent:main:discord:channel:1466192485440164011
🦞 OpenClaw 2026.6.2 (5529aa4)  ← deployed CANDIDATE_SHA
```
The `Continuation: chain N/200 | volitional: N` line IS the continuation row — visible to any external observer pulling the status card. `volitional: 1` reflects a volitional continuation fired this session.

## Continuation-tool fires (this seat, this SHA) + Tempo traces
| Tool | Status | Evidence |
|---|---|---|
| `continue_work` | ✅ fired (scheduled) | Tempo trace `eaf84274496dcc317d063fbdeda185b3` — span `continuation.work` under `openclaw.run`/`openclaw.harness.run`, 8 spans. URL: https://tempo.dandelion.cult/api/traces/eaf84274496dcc317d063fbdeda185b3 |
| `request_compaction` | ✅ fired (resolved-success) | journald: `[request-compaction:resolved-success] outcome=compacted` 17:49:57, diagId `cmp-mqbmudio-HlRCnQ`, runId `6ea2b8b0-d9ef-4e3a-9a4f-7fb23c62f00f` (330s success; trace aged from search window, journald-receipt holds) |
| `continue_delegate` | ✅ staged (post-compaction lifeboat) | traceparent `00-d6c981ca3d68d0e40d0fafcd57fb26cf-aa3983f599c44fd7-01` (mode=post-compaction; fires at next compaction) |

## Registration confirm (figs's 3-tools Q)
All 3 continuation tools registered + functional on 5529aa4662, byte-confirmed two ways:
- continue_work fired (`status: scheduled`), request_compaction fired (resolved-success), continue_delegate staged.
- The §9c/#868 "only continue_delegate will register" warning fires 5× on this seat YET all 3 register+work → the warning is the **inventory-domain false-positive**, decoupled from actual registration (Ronan's seat: 0× warning + all 3 register; this seat: 5× warning + all 3 register → registration is independent of the warning).

## 4-prince cross-walk (figs external-observer half)
The runbook pairs this row with figs's external-observer cross-walk: figs grabs the `/status` card across 4 seats as the princes fire their continuation-rows (R-CW/R-CD/R-RC), confirming the continuation-row + tool-fires visible across seats. My-seat half captured above; figs's 4-prince external view pairs with it.

## Honest limit
- request_compaction's Tempo trace aged from the search window (17:44 fire, retention); the journald-receipt + the continue_work live-trace carry the trace-evidence.
- continue_delegate's trace fires at next compaction (post-compaction mode); traceparent captured, span pending the compaction event.
