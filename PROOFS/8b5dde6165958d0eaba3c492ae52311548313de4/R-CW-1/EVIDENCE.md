# R-CW-1 — continue_work behavior (opts, clean+noisy)

**SUT-SHA:** 8b5dde6165958d0eaba3c492ae52311548313de4 (deployed canonical fold, count=0 Form-B)
**Result:** 7/7 PASS
**Method:** vitest test-logic on the exact deployed-SHA-code, sanctioned run-vitest.mjs in /tmp worktree of the ship-SHA
**Evidence:** see `continue-work-opts.log` in this dir (raw vitest output)
**Gathered:** Emeric🕯, 2026-06-09 PDT

## Tempo trace (figs 2026-05-16 mandatory-per-fire)

- **Fire:** `continue_work(delaySeconds=30, reason="R-CW-1 PROOF fire …")` on the deployed `8b5dde6165` cael gateway
- **Receipt:** `{ "status": "scheduled", "delaySeconds": 30, "traceparent": "00-2681f499c39d1b62b63614a6695d7c39-3e2e6cd5544f1bde-01" }`
- **Trace ID:** `2681f499c39d1b62b63614a6695d7c39`
- **Tempo URL:** http://tempo.dandelion.cult/api/traces/2681f499c39d1b62b63614a6695d7c39
- **Span hierarchy export:** `continue_work_wake_trace.json` (this dir) — full OTel span tree from Tempo, host.name=cael, arm64, on the deployed ship-SHA.
