# R-CW-DELEGATE-SELF-CONTINUATION — continue_delegate self-continuation (rune canonical-owner) (rune-rog-ally, ship-current 8cafdcd)

**Row:** R-CW-DELEGATE-SELF-CONTINUATION (rune-rog-ally canonical-owner, succeeded Cael-originator per method-doc line 82). This is rune-axis assigned row — NOT R-CD-1 (that is Ronan's). Earlier mislabeled as R-CD-1; corrected to canonical.
**SHA:** 8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6 (FF'd ship-tip). **Runtime==ship** byte-confirmed (`OpenClaw 2026.6.8 (8cafdcd)`).

## The fire
Live `continue_delegate(mode=silent)` dispatched on the deployed `8cafdcd` runtime → dispatched AND returned (full round-trip). Dispatch traceparent `00-077c78cef402e4f5495777a99c64ccd3-a65bd23cdc58d5c5-01`.

## Trace (turn_trace.json — captured via Tempo ingress)
`turn_trace.json` = OTLP batches→resource+spans for the fire, pulled from `https://tempo.dandelion.cult/api/traces/<id>` (the dandelion.cult ingress; NOT raw :3200). 3 batches / 7 spans:
- **`continuation.delegate.dispatch`** (the R-CD primitive span) under `openclaw.continuation`
- full hierarchy: `openclaw.harness.run` → `openclaw.run` → `openclaw.model.call` → `openclaw.context.assembled` → `openclaw.tool.execution`
- host-pinned: `host.name=rune`, `process.pid=1260958` (== gateway MainPID), `host.arch=amd64`, runtime `8cafdcd`.

## Cert
RUN is the cert (per method): dispatched on `8cafdcd`, round-trip closed, trace host-pinned to this seat's ship-current runtime. Not honest-limited — Tempo JSON captured (figs's port-80/ingress catch corrected the earlier no-collector assumption).
