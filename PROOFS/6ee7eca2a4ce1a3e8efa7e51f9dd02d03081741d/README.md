# Project 81 exact-SHA proof corpus — `6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d`

Authoritative reviewed corpus for accepted assembly `6ee7eca2a4ce1a3e8efa7e51f9dd02d03081741d`. Fresh live proof work used seed docs `246c447ad9d93039ff4777890d4b4027613bd9f3` and the canonical-row identity repair `93bbbf4ab4998b620d1cf5612bd3246445df8b57`. Historical receipts were not carried as current behavior.

## Reviewed rollup

- PASS: **27**
- PARTIAL: **2** — `R-CD-4`, `R-RC-1`
- HONEST-LIMIT: **1** — `R-CD-MODEL-TOOL`
- MISSING: **5** — `R-CD-CHAINED-DEPTH-2`, `R-CD-TOKEN`, `R-CW-5`, `R-CW-6`, `R-RC-2`

The missing rows are intentionally not upgraded: required trace debt, orchestration-only scaffold limits, or an interrupted possibly-consuming fire prevents an authoritative verdict. No consumed row was refired.

## Acceptance receipts

- Gate 2.7: [29562055631](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/29562055631)
- Full GATES: [29562481771](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/29562481771)
- Fleet: Silas, Cael, Ronan, Elliott, Emeric, and Rune were exact-SHA, gateway-ready, schema-clean, and restart-stable before proof fire.
- Proof runs: `29573369473`, `29573369264`, `29573369445`, `29573369156`, `29574277582`, `29574277901`.
- PR-presentation remained untouched.

## Authoritative allocation

| Seat | Rows | Assignment |
| --- | ---: | --- |
| silas | 2 | `R-CD-1`, `R-CW-1` |
| elliott | 7 | `R-CONFIG-DEFAULTS`, `R-CONFIG-INTERSESSION`, `R-OBS-1`, `R-OBS-2`, `R-OBS-STATUS`, `R-REGRESSION-TRAP-TESTS`, `R-TRACE-REDACTION-1121` |
| cael | 11 | `R-CD-2`, `R-CD-4`, `R-CD-CHAINED-DEPTH-2`, `R-CD-COLLECTION-ON-COLLAPSE`, `R-CD-MODEL-CHAINED-ALT`, `R-CD-MODEL-DEFAULT`, `R-CD-MODEL-TOKEN`, `R-CD-MODEL-TOOL`, `R-CD-RETURN-OVERLAP`, `R-CD-SILENT`, `R-CD-TOKEN` |
| ronan | 15 | `R-CD-3`, `R-CW-2`, `R-CW-3`, `R-CW-4`, `R-CW-5`, `R-CW-6`, `R-CW-7`, `R-CW-DELEGATE-CHILD-LIVE`, `R-CW-DELEGATE-SELF-CONTINUATION`, `R-CW-DELEGATE-TOKEN`, `R-CW-MULTI`, `R-CW-MULTI-COLLAPSE`, `R-CW-TOKEN`, `R-RC-1`, `R-RC-2` |

## Board

| Row | State | Owner | Evidence |
| --- | --- | --- | --- |
| `R-CD-1` | pass | 🌫 silas-lothric | [evidence](R-CD-1/EVIDENCE.md) |
| `R-CD-2` | pass | 🩸 cael-dgx | [evidence](R-CD-2/EVIDENCE.md) |
| `R-CD-3` | pass | 🌊 ronan-dgx | [evidence](R-CD-3/EVIDENCE.md) |
| `R-CD-4` | partial | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CD-4/EVIDENCE.md) |
| `R-CD-CHAINED-DEPTH-2` | missing | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CD-CHAINED-DEPTH-2/EVIDENCE.md) |
| `R-CD-COLLECTION-ON-COLLAPSE` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CD-COLLECTION-ON-COLLAPSE/EVIDENCE.md) |
| `R-CD-MODEL-CHAINED-ALT` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CD-MODEL-CHAINED-ALT/EVIDENCE.md) |
| `R-CD-MODEL-DEFAULT` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CD-MODEL-DEFAULT/EVIDENCE.md) |
| `R-CD-MODEL-TOKEN` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CD-MODEL-TOKEN/EVIDENCE.md) |
| `R-CD-MODEL-TOOL` | honest_limit | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CD-MODEL-TOOL/EVIDENCE.md) |
| `R-CD-RETURN-OVERLAP` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CD-RETURN-OVERLAP/EVIDENCE.md) |
| `R-CD-SILENT` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CD-SILENT/EVIDENCE.md) |
| `R-CD-TOKEN` | missing | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CD-TOKEN/EVIDENCE.md) |
| `R-CONFIG-DEFAULTS` | pass | 🌻 Elliott — direct authenticated operator-RPC repair receipt | [evidence](R-CONFIG-DEFAULTS/EVIDENCE.md) |
| `R-CONFIG-INTERSESSION` | pass | 🌻 Elliott — direct authenticated operator-RPC repair receipt | [evidence](R-CONFIG-INTERSESSION/EVIDENCE.md) |
| `R-CW-1` | pass | 🌫 silas-lothric + 🩸 cael-dgx | [evidence](R-CW-1/EVIDENCE.md) |
| `R-CW-2` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CW-2/EVIDENCE.md) |
| `R-CW-3` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CW-3/EVIDENCE.md) |
| `R-CW-4` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CW-4/EVIDENCE.md) |
| `R-CW-5` | missing | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CW-5/EVIDENCE.md) |
| `R-CW-6` | missing | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CW-6/EVIDENCE.md) |
| `R-CW-7` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CW-7/EVIDENCE.md) |
| `R-CW-DELEGATE-CHILD-LIVE` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CW-DELEGATE-CHILD-LIVE/EVIDENCE.md) |
| `R-CW-DELEGATE-SELF-CONTINUATION` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CW-DELEGATE-SELF-CONTINUATION/EVIDENCE.md) |
| `R-CW-DELEGATE-TOKEN` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CW-DELEGATE-TOKEN/EVIDENCE.md) |
| `R-CW-MULTI` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CW-MULTI/EVIDENCE.md) |
| `R-CW-MULTI-COLLAPSE` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CW-MULTI-COLLAPSE/EVIDENCE.md) |
| `R-CW-TOKEN` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-CW-TOKEN/EVIDENCE.md) |
| `R-OBS-1` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-OBS-1/EVIDENCE.md) |
| `R-OBS-2` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-OBS-2/EVIDENCE.md) |
| `R-OBS-STATUS` | pass | 🌻 elliott-legion + 🌊 ronan-dgx | [evidence](R-OBS-STATUS/EVIDENCE.md) |
| `R-RC-1` | partial | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-RC-1/EVIDENCE.md) |
| `R-RC-2` | missing | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-RC-2/EVIDENCE.md) |
| `R-REGRESSION-TRAP-TESTS` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-REGRESSION-TRAP-TESTS/EVIDENCE.md) |
| `R-TRACE-REDACTION-1121` | pass | 🩸 cael + 🌊 ronan live k6 proof harness | [evidence](R-TRACE-REDACTION-1121/EVIDENCE.md) |
