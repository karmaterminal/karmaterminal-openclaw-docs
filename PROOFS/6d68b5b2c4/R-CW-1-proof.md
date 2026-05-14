=== R-CW-1: continue_work proof ===
SUT: silas-canary (10.0.0.153 / silas.dandelion.cult)
Deployed SHA: 6d68b5b2c4
PR head: 4e11558fff (test-file-only delta, no runtime change)
Collector: cael-seat (10.0.0.148)
Time: 2026-05-14T03:05:38Z (2026-05-13 20:05:38 PDT)

--- SUT Verification ---
OpenClaw 2026.5.12-beta.1 (6d68b5b)

--- Proof Fire: continue_work(delaySeconds=5, reason='R-CW-1 proof-fire from cael-seat against silas-canary 6d68b5b2c4') ---

continue_work fired successfully:
- status: scheduled
- delaySeconds: 5
- traceparent: 00-dfccb2892b5a1fdebc73fa91612037ec-80d2dbb71bb53980-01
- trace-id for Tempo: dfccb2892b5a1fdebc73fa91612037ec

Awaiting wake to confirm round-trip...

Wake confirmed at: 2026-05-14T03:06 UTC (20:06 PDT)
Round-trip: continue_work(delaySeconds=5) → scheduled → wake fired → session resumed.
Verdict: **PASS**

Tempo trace fetched: tempo-dfccb2892b5a1fdebc73fa91612037ec-cael-rcw1.json (21KB)
Trace-id: dfccb2892b5a1fdebc73fa91612037ec
Service: cael-prince

--- R-CW-1 COMPLETE: PASS ---
