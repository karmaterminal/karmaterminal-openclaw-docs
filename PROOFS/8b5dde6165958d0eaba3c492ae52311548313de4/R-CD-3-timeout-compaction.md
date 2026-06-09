# R-CD-3 Timeout-Compaction Reproof — Form B (count-0, upstream-faithful)
## Exact ship-SHA: 8b5dde6165958d0eaba3c492ae52311548313de4
Branch: frond-scribe/20260609/formb-fold (karmaterminal/openclaw)
Gathered by: Emeric🕯 (proof/byte-verification prince), 2026-06-09 ~0650 PDT
Runner: scripts/run-vitest.mjs (sanctioned), auto-route + forced-config shards as noted.

## Byte-verification (exact ship-SHA)
- run.ts `compactionFailureContext` count = **0** (never 4; upstream-faithful Form-B removal — restores the file's early-asserted 2x rotation)
- run.ts diff vs slack-base 0573362b55 = **EMPTY** (zero prod change; fold adds matrix test-files only)
- slack prepare.test.ts saveSessionStore = 4 (cure in fold) · matrix session-route.test.ts saveSessionStore = 3 (cure in fold)
- full fold diff = 3 matrix test files only (exec-approvals + handler + session-route)

## Test results (vitest, on the exact ship-SHA 8b5dde6165)
- **R-CD-3 timeout-compaction RE-RUN** (run.ts path changed → RE-RUN not re-point): `run.timeout-triggered-compaction.test.ts` = **16/16 PASS** (2x across profile rotation, :531/:582 toHaveBeenCalledTimes(2))
- **continuation-suite (6 files)** = **83 PASS** (timeout 16 + store.continuation-merge + chain-guard + continuation + continue-work-opts + post-compaction-delegate = 67 [auto-routed: src/config + src/auto-reply files route clean])
- **matrix shard** (vitest.extension-matrix.config.ts) = **1385/1385 PASS** (11 matrix-3 reds cleared by e7c30b4d15d)
- **slack shard** (vitest.extension-slack.config.ts) = **1239/1239 PASS** (3 slack reds cleared by 0573362b55; deterministic per Ronan's 5x)

## Carveout (accept-as-known, documented not-our-divergence)
- chutes (providers/implicit-provider) = pre-existing (red on e66dc63f base too)
- Cluster A (compaction-planning-worker + server-startup-config.secrets) = full-suite pollution / resource-flake (green-isolated-both-refs; SIGSEGV under starvation)
- continuation-drain (subagent-announce.continuation-drain) = full-suite pollution / mock-contract-drift (green-isolated-both-refs)

## NOTE on proof-type
The above is the vitest test-suite run ON the exact deployed ship-SHA (the deployed gateway's code = proof-correct base). Per figs's operational byte, a DEPLOYED-RUNTIME behavioral proof (the running gateway exercising the actual timeout-compaction failover at 2x rotation, end-to-end) is distinct from vitest. If that true-runtime-trigger proof is required for the gate-grade PROOFS set, it is pending the trigger-procedure on the deployed runtime.
