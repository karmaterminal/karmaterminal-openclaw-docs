# R-CW-DELEGATE-SELF-CONTINUATION — delegate child self-continuation

## Purpose

Prove a delegate child can call `continue_work` for itself and execute the hop-2
wake turn. This covers the interaction between typed `continue_delegate` and a
child-owned typed `continue_work` election.

## Runnable scenario

- Manifest: `tools/k6-proofs/manifests/r-cw-delegate-self.json`
- Scenario: `tools/k6-proofs/scenarios/r-cw-delegate-self-continuation.js`
- Preferred mode: `OPENCLAW_CREATE_DISPOSABLE_SESSION=true`

The scenario asks the parent proof session to call `continue_delegate`. The
child delegate then calls `continue_work`, emits `CHILD-CW-SCHEDULED <nonce>`
after the tool result reports scheduled, and must emit `CHILD-HOP2-DONE <nonce>`
on the child hop-2 wake.

Prompt echoes containing `[k6-proof-harness]` are ignored. Generic nonce-bearing
events are not enough for PASS.

Required post-dispatch receipts:

1. `delegate-accepted` — `sessions.send` accepted and triggered the parent turn.
2. `child-continue-work-accepted` — explicit `CHILD-CW-SCHEDULED <nonce>`
   sentinel after the child `continue_work` tool result reports scheduled.
3. `child-hop-2-woke` — explicit `CHILD-HOP2-DONE <nonce>` sentinel from the
   child continuation wake turn.
4. `parent-return` — delegate return observed after dispatch.

## Live smoke — 2026-07-05

Cael ran a disposable live smoke against candidate SHA
`1cc8f4e3d617ef6f173283ef83d7b739a4995734`.

Result: `PASS-candidate`, `rc=0`.

Observed receipts:

- disposable session created: `agent:main:r-cw-ds-r-cw-ds-1783311884772-vfqfu8ut`
- `sessions.send` accepted
- harness prompt echo ignored
- `CHILD-CW-SCHEDULED` observed post-dispatch
- `CHILD-HOP2-DONE` observed post-dispatch
- parent return event from delegate observed post-dispatch

Summary line:

```text
[R-CW-DELEGATE-SELF-CONTINUATION] Summary: PASS-candidate | SHA: 1cc8f4e3d617ef6f173283ef83d7b739a4995734 | Seat: cael-dgx
```

## Repeatability guidance

Use the standard live-run guard and serialize per target session. Prefer
`OPENCLAW_CREATE_DISPOSABLE_SESSION=true`; do not use a human-facing main lane as
the proof target.

If the child emits `CHILD-CW-SCHEDULED` but not `CHILD-HOP2-DONE`, fold as
`PARTIAL-candidate`. If the parent return is missing, keep the artifact as
review-pending even if the child sentinels appear.
