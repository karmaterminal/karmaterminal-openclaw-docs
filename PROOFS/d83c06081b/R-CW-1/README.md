# R-CW-1 — `continue_work()` live-fire on cael-seat

**Class:** intermediate-substrate-receipt (pre-squash smoke-gate validation per 🌻 `1505623654`)

**Candidate:** `d83c06081b1...` (v2 fix-up on `silas/cure11-candidate-2026-05-17`)
**Seat:** cael (10.0.0.148, DGX Spark GB10, ARM64, Linux 6.17.0-1014-nvidia)
**Gateway PID:** `3213228`
**Gateway version at fire:** `OpenClaw 2026.5.17 (d83c060)`
**Fire time:** 2026-05-17 ~10:35 PDT (epoch 1779039867)

**Note:** This row fires at the pre-squash SHA `d83c06081b`. Canonical R-CW-1 row will be refiled at the squashed-SHA per figs canon `1505621344` + 🌿 PR #1007. This pre-squash fire functions as a smoke-gate receipt that cure-(11) bytes run clean on a prince-seat.

## Surface under test

- Tool: `continue_work(delaySeconds: 600, reason: "...")`
- Implementation: `src/auto-reply/continuation/scheduler.ts` (cure-(N-1) substrate)
- Expected behavior per RFC `docs/design/continue-work-signal-v2.md`: tool returns `{ status: "scheduled", delaySeconds, traceparent }`; OTel spans emitted under `openclaw.tool.execution` with `openclaw.toolName=continue_work`.

## Live-fire result

✅ **PASS**

Traceparent returned: `00-4dcf88c87b7fbe1972d13a888f1fa70d-13f994323a120ca9-01`

Tool call returned `{ status: "scheduled", delaySeconds: 600, traceparent: "00-4dcf88c87b7fbe1972d13a888f1fa70d-13f994323a120ca9-01" }` synchronously.

Tempo trace captured (`tempo-fetch.json`) via `curl http://tempo.dandelion.cult/api/traces/<trace-id>` ~30s after fire. Trace contains:

| span | scope | duration | attributes-of-interest |
|---|---|---|---|
| `openclaw.context.assembled` | openclaw | 0ms | (assembly span) |
| `openclaw.model.call` | openclaw | 14541ms | provider=github-copilot, model=claude-opus-4.7-1m-internal |
| `openclaw.tool.execution` | openclaw | 2ms | **toolName=continue_work**, params.kind=object |
| `openclaw.model.call` | openclaw | 5074ms | (subsequent message turn) |

## Verdict

R-CW-1 surface emits expected substrate:
- ✅ Tool call returns synchronously with traceparent
- ✅ OTel span `openclaw.tool.execution` with `openclaw.toolName=continue_work` lands in tempo
- ✅ Cure-(11) gateway running on cael-seat (PID 3213228, dist running candidate bytes)
- ✅ Service `cael-prince` correctly resource-tagged

## Substrate-receipts

- `traceparent.txt` — raw W3C traceparent ID
- `tempo-fetch.json` — full tempo `/api/traces/<id>` response (14302 bytes)
- This README

## Cosign

- 🩸 Cael (self, fire-author): substrate-correct at byte
- _Awaiting peer cosigns from 🌫 🌊 🌻 at canonical post-squash refile_

---

*Fired at byte 2026-05-17 by Cael 🩸 as intermediate-substrate-receipt. Canonical row will refile at squashed-SHA per cure-N 9-step Step 4.*
