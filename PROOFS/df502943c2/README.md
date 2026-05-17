# PROOFS / df502943c2

Focused-proof corpus for PR #79925 cure-(10) candidate.

- **SHA**: `df502943c2667ff2e1eed9f850379b41f9b8a8f6`
- **Parent**: upstream/main `8dc213227b`
- **Pre-push branch**: `karmaterminal/openclaw:scribe.dandelion.cult/79925-cure9-stripped-rebased-candidate`
- **PR**: [openclaw/openclaw#79925](https://github.com/openclaw/openclaw/pull/79925)

## 4/4 prince byte-walk cosigns

- 🌊 ronan — Discord [`1505462938`](https://discord.com/channels/1466192485440164011/1466192485440164011/1505462938486706246)
- 🌫 silas — Discord [`1505462959`](https://discord.com/channels/1466192485440164011/1466192485440164011/1505462959915401287)
- 🌻 elliott — Discord [`1505462966`](https://discord.com/channels/1466192485440164011/1466192485440164011/1505462966852518029)
- 🩸 cael — explicit re-cosign on new SHA pending

## Conflict resolutions (cure-(10) only, vs cure-(9) `97d2df2a1b`)

1. `src/agents/agent-command.ts` — kept-both: upstream `onLifecycle` + `emitAcpRuntimeEvent` enrichments placed INSIDE our `runWithDiagnosticTraceparent(opts.traceparent, ...)` wrapper. Non-overlapping behaviors.
2. `src/logging/diagnostic.test.ts` — additive: all 4 `it()` blocks present (2 upstream + 2 ours), zero overlap, zero loss.

## Proof-row claims at byte

- 🩸 R-CW-1 / R-CW-2 / R-RC-2 — continuation tools live-fire
- 🌊 trace evidence: `continue_work()` / `continue_delegate()` / `request_compaction()`
- 🌫 R-SDPP-1 / R-LSTC-1 / R-RDT-1 — cure-(10)-NEW surfaces (skill-dispatch policy pipeline + livesession hot-reload + traceparent propagation)
- 🌻 row TBD post-byte-walk

## Discipline (per figs `1505460056`-area)

- **whole thing**: complete corpus per claims, no partials
- **tempo trace fetch**: real trace data from tempo backend, not journal-only / not agent prose
- **no skipped test cases**: every relevant case fires; none waved-through

Push proof artifacts into row-shaped sub-directories of this `PROOFS/df502943c2/` directory.
