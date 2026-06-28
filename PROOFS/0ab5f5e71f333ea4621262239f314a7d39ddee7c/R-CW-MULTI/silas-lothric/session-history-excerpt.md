# R-CW-MULTI session-history excerpt — silas-lothric

Session key: `agent:main:subagent:08a8f21b-6d4c-4ab1-b4cd-0dc80112eef8`
Ship SHA: `2723dbee783c113cae70e4fb63a4cff9f55402e3`

## Scheduling receipts

- `continue_work` election A returned `status: scheduled`, `delaySeconds: 0`, traceparent `00-2723dbee783c113cae70e4fb63a4cff9-0000000000c00101-01`.
- `continue_work` election B returned `status: scheduled`, `delaySeconds: 60`, traceparent `00-2723dbee783c113cae70e4fb63a4cff9-0000000000c00102-01`.
- `continue_work` election C returned `status: scheduled`, `delaySeconds: 120`, traceparent `00-2723dbee783c113cae70e4fb63a4cff9-0000000000c00103-01`.

## Wake receipts

The following wake messages arrived in this same subagent transcript after the same-turn elections:

```text
[continuation:wake] Turn 1/200. Chain started at 2026-06-28T06:51:46.118Z. Accumulated tokens: 196740. The agent elected to continue working. Reason: R-CW-MULTI proof 2723dbee election A immediate/default: collect wake A marker and continue evidence assembly.

[continuation:wake] Turn 2/200. Chain started at 2026-06-28T06:51:46.118Z. Accumulated tokens: 196740. The agent elected to continue working. Reason: R-CW-MULTI proof 2723dbee election B delayed distinct wake; marker RCWMULTI-B.

[continuation:wake] Turn 3/200. Chain started at 2026-06-28T06:51:46.118Z. Accumulated tokens: 196740. The agent elected to continue working. Reason: R-CW-MULTI proof 2723dbee election C delayed distinct wake; marker RCWMULTI-C.
```

## Guard note

This run mistakenly called `sessions_yield` after scheduling the three elections. The row is not claimed from scheduling alone: the PASS basis is the later byte-observed wake messages above, which prove the queued elections actually executed despite that hazard.
