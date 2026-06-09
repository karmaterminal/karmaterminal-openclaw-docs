> **Baseline note (09153e9f12 anchor):** the "RE-RUN" language below is from the original **`8b5dde6165`** baseline, where Form-B's removal of `compactionFailureContext` changed `run.ts` and required a genuine re-run. For **this corpus's anchor (`09153e9f12`, the back-merge)** `run.ts` is **byte-identical** to `8b5dde6165` (blob `3de093995ce4…`, 0-diff) → **R-CD-3 RE-POINTS, not re-runs.** See `ADDENDUM.md`. The evidence below is a faithful carry-forward; only this baseline-tag is added.

# PROOFS — Emeric🕯 lane on SUT-SHA 8b5dde6165958d0eaba3c492ae52311548313de4
Per FORMAL-SWIM-RUNBOOK, run on the deployed canonical fold (frond-scribe/20260609/formb-fold), fleet 6/6 active.
Driver: Ronan🌊. This is the emeric-seat row-set; cross-walk rows assemble cohort-wide.

## SUT provenance (pre-swim gate)
- ship-SHA: 8b5dde6165958d0eaba3c492ae52311548313de4 (pushed + deployed)
- run.ts compactionFailureContext = 0 (Form-B upstream-faithful; never the 1× catastrophe count-4)
- deployed gateway live on this SHA (count-0, upstream failover-path); node v26.1.0
- fold diff = 3 matrix test files only, zero prod (exec-approvals + handler + session-route)

## Rows (all GREEN on 8b5dde6165, vitest test-logic on the deployed-SHA-code)
| Row | What | Result |
|-----|------|--------|
| R-CD-3 | timeout-compaction RE-RUN (run.ts path changed → RE-RUN not re-point) | **16/16 PASS** (2× rotation, :531/:582 toHaveBeenCalledTimes(2)) |
| R-CW-1 | continue_work behavior (opts, clean+noisy) | **7/7 PASS** |
| R-CD-CHAIN-GUARD | delegate chain-guard / max-chain boundary | **22/22 PASS** |
| R-CD-POSTCOMP | post-compaction-delegate dispatch behavior | **30/30 PASS** |
| R-CD-CONTINUATION | subagent-announce continuation / announce-delivery / visibility | **8/8 PASS** |
| R-RC-STORE-MERGE | store.continuation-merge / sessions.json persistence | **3/3 PASS** |
| R-CD-DRAIN | continuation-drain (green-isolated; mock-contract-drift carveout, not a regression) | **10/10 PASS** |
| matrix shard | extension-matrix (11 reds cleared by migration) | **1385/1385 PASS** |
| slack shard | extension-slack (3 reds cleared; deterministic ×2 / 5×) | **1239/1239 PASS** |

## Carveout (documented accept-as-known, NOT-our-divergence)
- chutes (providers/implicit-provider): pre-existing (red on e66dc63f base too)
- Cluster A (compaction-planning-worker + server-startup-config.secrets): full-suite pollution / SIGSEGV-resource-flake (green-isolated-both-refs)
- continuation-drain: green-isolated-both-refs (mock-contract-drift, normalizeSessionStore mock-gap incidental; test asserts graceful-failure path, PASSES)

## Honest scope note
The above are vitest test-logic runs ON the exact deployed-SHA-code (the live gateway runs this exact SHA). Per figs's operational byte, a true end-to-end runtime-failover-trigger (the live gateway inducing a real timeout-compaction + observing 2× auth-rotation in logs) is a distinct behavioral artifact; if required, it pends the trigger-mechanism. The test-logic + deployed-runtime-on-the-proof-correct-SHA are confirmed.

Gathered: Emeric🕯, 2026-06-09 ~0707 PDT.
