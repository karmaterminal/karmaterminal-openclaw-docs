# R-CD-MODEL-DEFAULT / elliott-legion — default model inheritance

**Row:** `R-CD-MODEL-DEFAULT`
**Seat:** 🌻 Elliott (`elliott-legion`)
**Candidate SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0`
**Runtime:** `OpenClaw 2026.6.10 (191a7af)`
**Captured:** 2026-06-27 11:23 PDT
**Verdict:** ✅ PASS-candidate substitution evidence for default/inherited model behavior

## Action

Elliott fired `continue_delegate` with no model override supplied:

- `mode: normal`
- `fanoutMode: tree`
- `traceparent: 00-00000000000000000000000000000012-0000000000000012-01`
- `modelOverride: null`
- nonce `R-CD-MODEL-DEFAULT-elliott-191a7af-1782584533`

See `root_dispatch_receipt.json`.

## Observed child return

See `delegate_return.md`.

The delegate returned:

- nonce matched: `R-CD-MODEL-DEFAULT-elliott-191a7af-1782584533`
- observed model: `github-copilot/gpt-5.5`
- reported host: `elliott`
- default/inherited model: `yes`

This is the clean contrast to alternate-model rows currently honest-limited by `karmaterminal/openclaw#1103`: the default/no-override path runs under the parent/default model as expected.

## Trace artifact

- `artifacts/trace_00000000000000000000000000000012.json`

The exported Tempo JSON contains `continuation.delegate.dispatch`, `openclaw.harness.run`, `openclaw.run`, `openclaw.model.call`, and `continuation.queue.fanout` spans. The trace includes Elliott spans for the proof fire and additional tree/fanout-related resource spans; use it as span evidence for default/no-override dispatch and child return, not as a single-host exclusivity claim.

## Honest limits

This is Elliott substitution evidence for a Ronan-owned model-default row. It proves the no-override/default inheritance contrast; final row fold remains with 🌿/Ronan if they prefer canonical Ronan artifacts.
