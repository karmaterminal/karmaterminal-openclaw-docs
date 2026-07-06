# R-OBS-status exact-head repeatability artifacts — Cael 2026-07-06T01:26Z

Candidate/runtime target:

```text
1cc8f4e3d617ef6f173283ef83d7b739a4995734
OpenClaw 2026.6.11 (1cc8f4e)
```

Source live artifact root on Cael:

```text
/tmp/k6-proof-runs-robs-exact-head-patched/1cc8f4e3d617ef6f173283ef83d7b739a4995734/R-OBS-STATUS/cael/
```

All three live read-only runs exited `0` and produced `PASS-candidate` summaries.
`trace_id` is `null` in each evidence record because the status response did not emit a traceparent/trace id.

| run | started | verdict | failures | duration_avg_ms | status_ok | trace_id |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-07-06T01:26:29.371Z | PASS-candidate | 0 | 633 | true | None |
| 2 | 2026-07-06T01:26:31.823Z | PASS-candidate | 0 | 624 | true | None |
| 3 | 2026-07-06T01:26:34.290Z | PASS-candidate | 0 | 656 | true | None |

## Copied files

Each `run-N/` directory contains `runner-metadata.json`, `run-result.json`, `r-obs-status-summary.json`, `evidence.jsonl`, `evidence-lines.log`, and `row-manifest.json`.
