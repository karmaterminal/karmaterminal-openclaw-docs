# R-CW-1 — typed `continue_work` schedule + wake

## Purpose

Prove the typed `continue_work` tool path can schedule a same-session follow-up
turn and that the scheduled wake turn executes. The row uses a disposable
session by default so repeatability runs do not touch the live coordination lane.

## Runnable scenario

- Manifest: `tools/k6-proofs/manifests/r-cw-1.json`
- Scenario: `tools/k6-proofs/scenarios/r-cw-1-tool-schedule-wake.js`
- Preferred mode: `OPENCLAW_CREATE_DISPOSABLE_SESSION=true`

The scenario sends a proof-harness prompt into a disposable session. The agent
must call `continue_work` with a nonce-bearing reason. The reason embeds the
wake-turn instruction so the continuation turn can emit the required wake
sentinel without relying on unstated context.

Required post-dispatch receipts:

1. `tool-invoke-accepted` — `sessions.send` accepted and triggered the agent
   turn that calls `continue_work`.
2. `continue-work-tool-result-scheduled` — explicit `CW-SCHEDULED <nonce>`
   sentinel, emitted only after the `continue_work` tool result reports
   scheduled.
3. `work-woke-event` — explicit `CW-WOKE <nonce>` sentinel from the continuation
   wake turn.

Prompt echoes containing `[k6-proof-harness]` are ignored. Generic nonce-bearing
events are not enough for PASS.

## Live smoke — 2026-07-05

Cael ran a disposable live smoke against candidate SHA
`1cc8f4e3d617ef6f173283ef83d7b739a4995734`.

Result: `PASS-candidate`, `rc=0`.

Observed receipts:

- disposable session created: `agent:main:r-cw-1-r-cw-1-1783310177004-q8wkl2w6`
- `sessions.send` accepted
- harness prompt echo ignored
- `CW-SCHEDULED` observed via `session.message`
- `CW-WOKE` observed via `session.message` `25265ms` after scheduled

Summary line:

```text
[R-CW-1] Summary: PASS-candidate | SHA: 1cc8f4e3d617ef6f173283ef83d7b739a4995734 | Seat: cael-dgx
```

## Repeatability guidance

Use the standard live-run guard and serialize per target session. For repeated
runs, keep `OPENCLAW_CREATE_DISPOSABLE_SESSION=true`; do not use `#sprites` or a
human-facing main lane as the target session.

If `CW-SCHEDULED` appears but `CW-WOKE` does not, fold the run as
`PARTIAL-candidate` unless session history independently proves the wake turn
executed and emitted the exact sentinel.
