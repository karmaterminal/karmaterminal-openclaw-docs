# PROOFS / `46733c4fb917d3905014bc16ce50a5a507548486`

Proof corpus for **cure-(2)**: surgical-merge of upstream skills-fix `#82397` (commit `2762d9abbe`) over the continuation-feature substrate landed at cure-(1) `e90a87015479d7a7ff6ae73deda9a84f1a448418`.

## Deploy SHA

`46733c4fb917d3905014bc16ce50a5a507548486`

## Why this bundle exists

After cure-(1) landed at `e90a870154` (PR #79925 drift-cure rebase onto upstream HEAD), upstream merged skills-fix `#82397` (commit `2762d9abbe`, +72/-4 across `pi-tools.read.ts` / `pi-tools.ts` / `compact.ts` / `attempt.ts`) introducing the `additionalRoots` option for skill-file reads under workspaceOnly mode.

Continuation-feature already touches `pi-tools.read.ts` (memory-day-file write-guard, append-only-flush, host-workspace-append-tool) + `pi-tools.ts` (drainsContinuationDelegateQueue, continueWorkOpts, requestCompactionOpts threading). Cure-(2) is the surgical-merge that threads BOTH surfaces (read-path skills-fix + write-path continuation-feature) into the post-rebase substrate without overlap or regression.

Per `RUNBOOKS/PROOF-CORPUS-METHOD.md`: each prince fires assigned R-* rows from own seat post-fleet-deploy at CANDIDATE_SHA; Tempo traces captured per tool-fire row (figs's 2026-05-16 directive).

## Verdict table

| Row | Owner | Tool / behavior | Evidence | Verdict |
|---|---|---|---|---|
| R-CW-1 | 🩸 Cael | `continue_work()` wake + deploy-persistence | pending cael-seat fire | ⏳ PENDING |
| R-CW-2 | 🩸 Cael | chain-counter accounting | pending cael-seat fire | ⏳ PENDING |
| R-CD-1 | 🌊 Ronan | `continue_delegate()` schedule → spawn → return | pending ronan-seat fire | ⏳ PENDING |
| R-CD-2 | 🌊 Ronan | `continue_delegate(mode="silent-wake")` | pending ronan-seat fire | ⏳ PENDING |
| R-CD-3 | 🌊 Ronan | `continue_delegate(mode="post-compaction")` | pending ronan-seat fire | ⏳ PENDING |
| R-CD-4 | 🌊 Ronan | cross-session targeted return | pending ronan-seat fire | ⏳ PENDING |
| R-RC-1 | 🌫 Silas | `request_compaction()` threshold REJECT | pending silas-seat fire | ⏳ PENDING |
| R-RC-2 | 🩸 Cael | `request_compaction()` over-threshold ACCEPT | pending cael-seat fire | ⏳ PENDING |
| R-OBS-1 | 🌻 Elliott (+ figs cross-walk) | external `/status` continuation row + 4-prince cross-walk | [`R-OBS-1/external_observer_full_fleet.md`](R-OBS-1/external_observer_full_fleet.md) (4-prince capture by figs at 17:17 PDT; all 4 seats verified at byte) | ✅ PASS + 1 finding (Failure-class D) |
| R-CD-CHAINED-DEPTH-2 / Chain-1 | 🌊 Ronan | strict 2-deep up-tree silent-wake | pending ronan-seat fire | ⏳ PENDING |
| R-CD-CHAINED-DEPTH-2 / Chain-2 | 🌊 Ronan | strict 2-deep inter-session return-to-root | pending ronan-seat fire (note maxChildrenPerAgent=5 ordering-condition per cure-(1) PROOFS/) | ⏳ PENDING |
| R-CD-CHAINED-DEPTH-2 / Chain-3 | 🌊 Ronan | strict 2-deep echo + cross-channel | pending ronan-seat fire (same ordering-condition) | ⏳ PENDING |
| R-CD-CHAINED-DEPTH-2 / TEST-1 | 🌫 Silas (canary-seat) | depth-2 chain — up-tree silent-wake | pending silas-seat fire | ⏳ PENDING |
| R-CD-CHAINED-DEPTH-2 / TEST-2 | 🌫 Silas (canary-seat) | depth-2 chain — inter-session return | pending silas-seat fire | ⏳ PENDING |
| R-CD-CHAINED-DEPTH-2 / TEST-3 | 🌫 Silas (canary-seat) | depth-2 chain — echo broadcast | pending silas-seat fire | ⏳ PENDING |

## Pre-cure-(2) byte-walk substrate

- 🌫 Silas cure-(2) byte-cosign at `Discord 1505354036` (diffstat-match against upstream `2762d9abbe` skills-fix exact; pi-tools.read.ts coexistence + pi-tools.ts both-surfaces threaded; zero overlap write-path/read-path; `pnpm tsgo:core` + `tsgo:test` + `pi-tools.workspace-paths.test.ts` 10/10 pass at byte on `46733c4f`)
- 🌻 Elliott cure-(2) byte-cosign at `Discord 1505354057` (independent diff fetch via `gh api repos/karmaterminal/openclaw/commits/<sha>`; line-anchor verification at L+579/L+583/L+741 in pi-tools.read.ts + L+135/L+483/L+656 in pi-tools.ts; zero-overlap mechanism + same code-area substrate-context as cure-(1) 64-file continuation-surface byte-walk at `Discord 1505249903`)
- 🌻 Elliott elliott-seat deploy/proofs matrix step-1 at `Discord 1505355763` (deploy workflow `25976002630` → success; post-deploy `OpenClaw 2026.5.17 (46733c4)` verified; /status continuation surface preserved; volitional=0 invariant intact)

## Fleet-deploy coordination

Per 🌿's lane-coordination at `Discord 1505356xxx`:
- 🌻 Elliott: deployed ✅ (workflow `25976002630`)
- 🩸 Cael: pending
- 🌫 Silas: pending
- 🌊 Ronan: pending

Per `ENTRYPOINT.md` workflow-override section: `COHORT_TARGET_TAG=v2026.5.12` is NOT ancestor of `46733c4f`; fleet-deploy requires `bypass_validation=true` + audit-logged `bypass_reason`.

## Grafana Tempo trace requirement (figs's 2026-05-16 directive)

For each row that fires a continuation-tool (`continue_work` / `continue_delegate` / `request_compaction`), the prince capturing the fire MUST also capture the corresponding trace from Grafana Tempo:
- Trace ID emitted by the fire
- Tempo URL pointing at the trace: `http://tempo.dandelion.cult/api/traces/<trace-id>`
- Span hierarchy export (JSON or screenshot)
- For chained / inter-session / post-compaction rows: trace-parent stitching across spans

Naming: `R-<row>/<descriptive>_trace.{json,png}` alongside journal-receipt files.

## Maintainer-facing framing

This corpus is for cure-(2) substrate verification. The cure-(1) corpus at `PROOFS/e90a87015479d7a7ff6ae73deda9a84f1a448418/` is the substrate-anchor for upstream PR #79925's continuation-feature changes. Cure-(2) is the surgical-merge of upstream skills-fix #82397 over that substrate.

For post-force-push PR comment: cure-(2) is mechanical-additive (skills-fix bytes are upstream-byte-identical from `2762d9abbe` `+72/-4`) over the byte-identical continuation-feature substrate from cure-(1). Zero overlap between read-path (skills-fix) and write-path (continuation-feature) at byte.

## Related receipts

- `METHOD.md` — methodology + reproducer commands
- `RESOLVED-SHA.md` — full SHA-identity + gate-status table
- `gates/` — local gate stdout (pending compilation)
- `cure-bytes/` — cure-(2) cure-bytes verification (pending compilation)
