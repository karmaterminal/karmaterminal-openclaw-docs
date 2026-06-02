# PROOFS / `1de29746f0b87c342f362a6a42e6291d832d7ee4`

Proof corpus at uncurse-tip `1de29746f0b87c342f362a6a42e6291d832d7ee4` (post-#870 merge), validating continuation-tool behavior fleet-wide after the #868 cure-chain (#868a → #868b → #869) that restored continuation-opts forwarding through the `embedded-agent-runner` → `attempt` layer.

## CANDIDATE_SHA

`1de29746f0b87c342f362a6a42e6291d832d7ee4`

## Why this bundle exists

The #868 saga (2026-06-01, 9-hour cohort cure-cascade) traced a P1 regression: continuation tools (`continue_work`, `continue_delegate`, `request_compaction`) silently disappearing from `availableTools` at the embedded-agent-runner layer despite being enabled in config. Root cause: `src/agents/embedded-agent-runner/run.ts:1546` silently dropping `continueWorkOpts` + `requestCompactionOpts` between caller (`agent-runner-execution.ts`) and consumer (`attempt.ts:1182`).

**Cure chain merged**:
- `#868a` (`ad7bcae3511`) — forward continuation opts through `embedded-agent-runner` bridge layer
- `#868b` (`96639cb0e6f`) — use `runtimeConfig` for `continueWorkOpts` gate
- `#869` (`29197f5531e`) — merge consolidating the two-phase fix
- `#870` (`1de29746f0b`) — chore: comment-scrub (zero behavioral surface)

This corpus validates the cure landed correctly across the fleet, with each prince firing assigned continuation-tool rows from own seat at CANDIDATE_SHA + capturing Tempo traces per the figs 2026-05-16 directive (traces ARE part of the full proof-set this cycle).

## Verdict table

| Row | Owner | Tool / behavior | Evidence | Verdict |
|---|---|---|---|---|
| R-CW-1 | 🩸 Cael | `continue_work()` wake + deploy-persistence | `R-CW-1/wake_event_evidence.txt` + `wake_event_trace.json` | ⏳ pending |
| R-CW-2 | 🩸 Cael | chain-counter accounting | embedded in `R-CW-1/wake_event_evidence.txt` | ⏳ pending |
| R-CD-1 | 🌊 Ronan | `continue_delegate()` schedule → spawn → return | `R-CD-1/` | ⏳ pending |
| R-CD-2 | 🌊 Ronan | `continue_delegate(mode="silent-wake")` full path | `R-CD-2/` | ⏳ pending |
| R-CD-3 | 🌊 Ronan | `continue_delegate(mode="post-compaction")` lifeboat | `R-CD-3/` | ⏳ pending |
| R-CD-4 | 🌊 Ronan | cross-session targeted return via `targetSessionKey` | `R-CD-4/` | ⏳ pending |
| R-RC-1 | 🕯 Emeric (covering silas-sit-out) | `request_compaction()` threshold REJECT | `R-RC-1/EVIDENCE.md` + `threshold_gate_rejection_evidence.txt` + `session_status_snapshot.txt` + `journal_query_receipt.txt` | ✅ PASS |
| R-RC-2 | 🩸 Cael | `request_compaction()` over-threshold ACCEPT | `R-RC-2/compaction_accept_request_receipt.txt` + `_trace.json` | ⏳ pending |
| R-CD-CHAINED-DEPTH-2 / Chain-1 | 🌊 Ronan | strict 2-deep up-tree silent-wake | `R-CD-CHAINED-DEPTH-2/Chain-1/` | ⏳ pending |
| R-CD-CHAINED-DEPTH-2 / Chain-2 | 🌊 Ronan | strict 2-deep inter-session return-to-root | `R-CD-CHAINED-DEPTH-2/Chain-2/` | ⏳ pending |
| R-CD-CHAINED-DEPTH-2 / Chain-3 | 🌊 Ronan | strict 2-deep echo + cross-channel-broadcast | `R-CD-CHAINED-DEPTH-2/Chain-3/` | ⏳ pending |
| R-CD-CHAINED-DEPTH-2 / TEST-1 | 🪨 Rune (canary, covering silas-sit-out) | depth-2 chain — up-tree silent-wake | `R-CD-CHAINED-DEPTH-2/test_1_uptree_silent_wake/` | ⏳ pending |
| R-CD-CHAINED-DEPTH-2 / TEST-2 | 🪨 Rune (canary) | depth-2 chain — inter-session return | `R-CD-CHAINED-DEPTH-2/test_2_intersession_return/` | ⏳ pending |
| R-CD-CHAINED-DEPTH-2 / TEST-3 | 🪨 Rune (canary) | depth-2 chain — echo broadcast | `R-CD-CHAINED-DEPTH-2/test_3_echo_broadcast/` | ⏳ pending |
| R-OBS-1 | 🌻 Elliott | external `/status` continuation row + 4-prince cross-walk | `R-OBS-1/` | ⏳ pending |

## Per-prince row assignments (this cycle)

Extended for silas-sit-out (pre-cure binary `0dff94dbe4` per Raptor-Lake V8/JIT-wall family; gateway active but build-incompat; structural cure tracked at `openclaw-bootstrap#1114`):

- 🩸 **cael**: R-CW-1, R-CW-2, R-RC-2
- 🌊 **ronan**: R-CD-1/2/3/4 + R-CD-CHAINED-DEPTH-2 Chain-1/2/3
- 🌫 **silas**: SIT OUT (pre-cure binary)
- 🕯 **emeric**: R-RC-1 (covering silas-canary)
- 🪨 **rune**: R-CD-CHAINED-DEPTH-2 TEST-1/2/3 (covering silas-canary, dual-coverage)
- 🌻 **elliott**: R-OBS-1 + 4-prince cross-walk

## Grafana Tempo trace requirement (figs 2026-05-16 directive)

For each row firing a continuation-tool, capture the corresponding Tempo trace:
- Trace ID from the fire (visible in `[continuation:…]` journal lines + tool-result payload)
- Tempo URL: `http://tempo.dandelion.cult/api/traces/<trace-id>`
- Span hierarchy export (JSON)
- For chained / inter-session / post-compaction rows: trace-parent stitching evidence

## Cohort fleet-deploy state at corpus-init

| Prince | Host | Pre-deploy SHA | Deploy run | Post-deploy SHA |
|---|---|---|---|---|
| 🩸 cael | cael (DGX Spark) | `29197f5531` | `26815892699` (in flight 2026-06-02T11:10Z) | `1de29746f0` (target) |
| 🌊 ronan | ronan (DGX Spark) | `29197f5531` | (self-canary; see ronan-axis) | `1de29746f0` (target) |
| 🕯 emeric | emeric (Intel NUC) | — | `26815810536` (in flight) | `bd3c54d3c8` family |
| 🌻 elliott | elliott (CachyOS) | — | `26815834360` (in flight) | `bd3c54d3c8` family |
| 🪨 rune | honoroit (ROG Ally) | — | (verified at CANDIDATE_SHA pre-fire) | `1de29746f0` |
| 🌫 silas | lothric | `0dff94dbe4` (pre-cure) | SIT OUT | — |

## Related files

- `METHOD.md` — methodology + reproducer commands
- `RESOLVED-SHA.md` — full SHA-identity + gate verdicts
- `gates/` — local gate stdout (deferred; cure-chain already CI-validated through #868/#869/#870 merges)
- `cure-bytes/` — cure-bytes verification for #868 forward-opts fix
- Per-row evidence dirs: `R-CW-*/`, `R-CD-*/`, `R-RC-*/`, `R-OBS-*/`

## Status

🚧 Corpus initialized 2026-06-02T11:11Z by 🩸 cael. Cael-deploy `26815892699` in flight; R-CW-1/R-CW-2/R-RC-2 will fire post-deploy. Other princes append their rows as they fire.
