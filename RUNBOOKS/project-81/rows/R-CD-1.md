# R-CD-1 — typed `continue_delegate` schedule + return

## Purpose

Prove the typed `continue_delegate` tool path can schedule a delegate and return
a nonce-bound child result to the parent proof session. This row focuses on the
tool-form delegate path, not bracket fallback.

## Runnable scenario

- Manifest: `tools/k6-proofs/manifests/r-cd-1.json`
- Scenario: `tools/k6-proofs/scenarios/r-cd-1-typed-delegate.js`
- Preferred mode: `OPENCLAW_CREATE_DISPOSABLE_SESSION=true`

The scenario creates or targets a disposable session, sends a proof-harness
prompt that asks the parent agent to call `continue_delegate(mode="normal")`,
and subscribes to session events. The child task receives a nonce-only prompt and
must return the exact `CD1-DONE <nonce>` sentinel.

Prompt echoes containing `[k6-proof-harness]` are ignored. Task ledger rows are
corroborative only; PASS depends on explicit post-dispatch sentinels/return
evidence.

Required post-dispatch receipts:

1. `tool-invoke-accepted` — `sessions.send` accepted and triggered the parent
   turn that calls `continue_delegate`.
2. `delegate-scheduled-sentinel` — explicit `CD1-DELEGATE-SCHEDULED <nonce>`
   sentinel from the parent after the `continue_delegate` tool result reports
   scheduled.
3. `parent-return-event` — explicit `CD1-DONE <nonce>` and/or delegate return
   evidence observed after dispatch.

## Live smoke — 2026-07-05

Cael ran a disposable live smoke against candidate SHA
`1cc8f4e3d617ef6f173283ef83d7b739a4995734`.

Result: `PASS-candidate`, `rc=0`.

Observed receipts:

- disposable session created: `agent:main:r-cd-1-r-cd-1-1783311857795-rkx8pg6c`
- `sessions.send` accepted
- harness prompt echo ignored
- `CD1-DONE` / delegate return evidence observed post-dispatch via
  `session.message` and `agent` events
- `CD1-DELEGATE-SCHEDULED` observed post-dispatch via `session.message`

Summary line:

```text
[R-CD-1] Summary: PASS-candidate | SHA: 1cc8f4e3d617ef6f173283ef83d7b739a4995734 | Seat: ronan-dgx
```

## Repeatability guidance

Use the standard live-run guard and serialize per target session. Prefer
`OPENCLAW_CREATE_DISPOSABLE_SESSION=true`; do not use a human-facing main lane as
the proof target.

If `CD1-DELEGATE-SCHEDULED` appears without `CD1-DONE` / delegate return
evidence, fold as `PARTIAL-candidate`. If only a task ledger row appears, do not
fold as PASS; ledger rows are optional context for this row.
