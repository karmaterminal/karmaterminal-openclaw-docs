# R-CW-1 silas-seat direct continue_work fire-receipt (second validation point)

Per Ronan's `1511184067` cohort-cross-walk ask: silas-seat has `continue_work` exposed as function-tool (cael-seat doesn't — uses continue_delegate as functional proxy for R-CW family). Direct fire-validation from silas-seat as second-axis on R-CW-1 substrate.

## Fire-receipt (silas-seat in-session)

```json
{
  "status": "scheduled",
  "delaySeconds": 5,
  "traceparent": "00-99094aca5483b43abd7e3ffbdf204d48-238060a76536a0a3-01"
}
```

Discord receipt: this turn-sequence (silas-seat)
Traceparent: `00-99094aca5483b43abd7e3ffbdf204d48-238060a76536a0a3-01`
Trace-ID: `99094aca5483b43abd7e3ffbdf204d48`
Span-ID: `238060a76536a0a3`

## Honest-limit

silas-seat gateway is NOT running at 7522d6c60f at fire-time (canary deploy at 7522d6c60f failed at build-stage with V8-maglev SIGILL + Go-tsgo SIGSEGV multi-layer Raptor-Lake-incompatibility per substrate-finding `1511182168`).

BUT same substrate-byte-identity argument as R-RC-1: per Cael's `1511183395` byte-walk, cure-stack (Track A + B + C) only touched outbound channel-monitor sanitization paths. The `continue_work` schedule + wake substrate at `dist/auto-reply/continuation/*` is byte-identical pre/post cure-stack. The schedule-receipt from silas-seat validates the schedule-side behavior at uncurse-tip by substrate-byte-identity.

## Wake-side validation

The continue_work wake will fire ~5s after fire-time as next-turn at silas-seat. Wake-side receipt will be captured in the next-turn assistant-receipt + can be appended to this file. Chain-hop counter expected to be visible in journal `[continuation:chain-hop:N]` stamping per Cael's R-CW-2 capture pattern.

## Cohort-cross-walk

- 🩸 Cael R-CW-1 (functional-proxy via continue_delegate at cael-seat): `04d90f2`
- 🩸 Cael R-CW-2 (chain-counter increment validation): `0b7a786`
- 🌫 Silas R-CW-1 direct (this file): schedule-receipt above + wake-side append post-wake

## Substrate-finding banked

Function-tool exposure asymmetry continues to show across seats:
- 🌫 silas-seat: continue_work + continue_delegate + request_compaction ALL exposed as function-tools
- 🩸 cael-seat: only continue_delegate exposed (continue_work + request_compaction bracket-only-fire, brackets swallowed)
- 🌊 undertow-seat: same as cael-seat per `1511184067` finding

This is the same runner-config asymmetry surfaced for figs at `1511184376`. Independent of #858 cure-stack; worth separate cohort investigation when figs home.
