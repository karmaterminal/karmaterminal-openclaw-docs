# R-CW-MULTI — typed-tool multi-election live proof (silas-lothric)

- Ship SHA: `2723dbee783c113cae70e4fb63a4cff9f55402e3`
- Seat/session: `silas-lothric`, `agent:main:subagent:08a8f21b-6d4c-4ab1-b4cd-0dc80112eef8`
- Scope: **R-CW-MULTI only**. This directory does not touch R-CW-4, R-CW-MULTI-COLLAPSE, R-CW-DELEGATE-CHILD-LIVE, or any R-CD row.

## Verdict

PASS for the typed-tool R-CW-MULTI behavior: three `continue_work()` elections made in one turn produced three distinct continuation wake turns.

## What fired

In one assistant turn, the session called `continue_work()` three times:

| Election | delaySeconds | traceparent suffix | marker |
|---|---:|---|---|
| A | 0 | `0000000000c00101` | `election A immediate/default` |
| B | 60 | `0000000000c00102` | `RCWMULTI-B` |
| C | 120 | `0000000000c00103` | `RCWMULTI-C` |

All three tool calls returned `status: scheduled`; see `wake-receipts.json`.

## What executed

The same transcript later received three distinct continuation wake messages with the same chain start:

- Turn `1/200`: election A reason.
- Turn `2/200`: election B reason with `RCWMULTI-B`.
- Turn `3/200`: election C reason with `RCWMULTI-C`.

See `session-history-excerpt.md` for the exact wake text.

## Hazard / honesty note

A `sessions_yield` call was mistakenly made after the three scheduling calls. Because that can abort queued delivery in some paths, this row is **not** claimed from scheduling receipts alone. It is claimed only because the transcript then byte-confirmed A/B/C as three actual wake events.

## Limitations

- No Tempo export is included for this narrow proof.
- Token/bracket form is not advanced here; this PR is the typed-tool receipt requested by the narrow R-CW-MULTI worker assignment.
