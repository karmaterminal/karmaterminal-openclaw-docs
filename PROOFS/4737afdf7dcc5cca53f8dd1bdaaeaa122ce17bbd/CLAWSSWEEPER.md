# Clawsweeper entrypoint

Read `proofs-manifest.json` and verify pure SHA
`4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd`. Use `required_rows`,
`dispatch_allocation`, and `acceptance.required_rollup` for continuation
acceptance. Use `supplemental_rows` and `supplemental_rollup` only to display
future product telemetry contracts; never add them to acceptance arithmetic or
infer PASS from their missing state. `rows[]` and top-level `rollup` preserve all
41 historical records.

`R-OBS-BACKEND-DISPOSITION` remains required. `R-RC-2` is the sole allowed
required non-PASS state and is bound to the structured receipt named by
`acceptance.honest_limit_receipts`. Treat execution composite `37300f29…` as
ancestry-bound live evidence, never as the presentation SHA. The current
historical required rollup is not acceptance-complete; the target remains 37
PASS plus the receipt-backed R-RC-2 honest limit.
