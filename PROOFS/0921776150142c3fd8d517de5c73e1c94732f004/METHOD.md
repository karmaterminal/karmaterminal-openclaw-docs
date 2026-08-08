# Method

- Exact runtime candidate: `0921776150142c3fd8d517de5c73e1c94732f004`
- Execution seat: Cael
- Automated catalog: `.github/workflows/project81-k6-proof.yml`, `rows=all`
- Process-local rows: `R-CW-5` and `R-CW-6` exact-candidate fixtures
- Runner artifacts are reviewed and folded into this directory.
- Trace-required rows must include public-safe raw Tempo JSON. Harness misses trigger trace recovery and a harness issue, not a partial verdict by default.
- Only `R-RC-2` may use `honest_limit`, solely when exact live evidence shows `request_compaction` refused because context pressure is below 70%.
