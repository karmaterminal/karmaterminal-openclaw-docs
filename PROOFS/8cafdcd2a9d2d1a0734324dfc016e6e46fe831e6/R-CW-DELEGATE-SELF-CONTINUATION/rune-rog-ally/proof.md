# R-CW-DELEGATE-SELF-CONTINUATION — continue_delegate round-trip + self-continuation (rune-rog-ally on 8cafdcd)

**Target SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (deployed rune-rog-ally, gateway restarted onto the FF'd ship-tip) · **Prince**: 🪨 Rune (canonical-owner, succeeded Cael-originator per method-doc line 82)
**Status**: PASS (dispatch→return round-trip live on the deployed ship-current bytes)

## Scenario
Proves continue_delegate works on the deployed `8cafdcd` build: a `continue_delegate`-dispatched background sub-agent dispatches AND returns (the full round-trip), demonstrating the continuation-delegate mechanism live on the shipped post-FF code. The mechanism proves itself — dispatched on `8cafdcd`, the return = continue_delegate functional on the deployed bytes.

## Fire + round-trip
`continue_delegate(mode="silent")` fired from rune-main-session on the deployed `8cafdcd` gateway → dispatched clean (traceparent `00-077c78cef402e4f5495777a99c64ccd3-a65bd23cdc58d5c5-01`) AND returned (the silent delegate completed + re-confirmed runtime `8cafdcd` at return). Full dispatch→return round-trip closed on the FF'd ship-tip.

## Evidence (filed in this dir)
- **dispatch_trace.json** — the Tempo trace for the fire (7 spans incl `continuation.delegate.dispatch` under `openclaw.continuation`, host.name=rune, pid=1260958==gateway MainPID, runtime 8cafdcd). Pulled `curl http://tempo.dandelion.cult/api/traces/077c78ce...` (shared ingress port 80).
- **EVIDENCE.md** — the round-trip + SHA-triple-match record.

## Verdict: PASS
continue_delegate round-trip-complete on deployed `8cafdcd`: dispatched + returned, runtime-SHA==ship-tip==8cafdcd, the `continuation.delegate.dispatch` span captured in Tempo (host-pinned to rune-rog-ally). The mechanism proved itself on the shipped post-FF bytes.
