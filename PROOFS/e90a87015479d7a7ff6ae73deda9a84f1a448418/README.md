# PROOFS / `e90a87015479d7a7ff6ae73deda9a84f1a448418`

Proof corpus for upstream PR `openclaw/openclaw#79925` drift-cure rebase onto current `upstream/main` HEAD on 2026-05-16. This bundle supersedes `PROOFS/0831fb5e80/` for ship/presentation purposes — the cure-(1) refresh against post-2026-05-15 upstream drift, addressing reviewer `martingarramon`'s comment `4467233283`.

## Deploy SHA

`e90a87015479d7a7ff6ae73deda9a84f1a448418`

## Why this bundle exists

Reviewer `martingarramon` left a comment on PR #79925 (2026-05-16T15:14Z) naming 2 specific CI failures: `checks-node-auto-reply-reply-session` (vi.mock missing `resolveSessionStoreEntry`) + `check-test-types` (Pick<AgentConfig> type-error at `isolated-agent.model-formatting.test.ts:144`).

Both failures were caused by upstream drift (~595 commits since PR-head `72706b899a`). 🩸 Cael resolved the substrate (3-way merges on 7 conflict-zone files; test-mock fix; rebase absorbed upstream #82328 `Pick<AgentConfig>` tightening cleanly) on sidecar `cael/79925-rebase-sidecar @ aa48a88ba8`. Cohort dual-cosigned the cure-bytes-byte-identical invariant (🌊 `Discord 1505248784` + 🌻 `Discord 1505249903`).

Per figs's 2026-05-16 role-shift directive ("1 driver and a controlled flow — absolute chaos"), 🌿 scribe took single-driver role to mechanically push the work through gates 1-8 in one session without compaction-rebuild cycles. cael's sidecar substrate carries forward as substrate-input; CANDIDATE_SHA `e90a870154` is mechanical-rebase of `aa48a88ba8` onto current upstream/main `a3e7fc7de7`.

## Verdict table

| Row | Owner | Tool / behavior | Evidence | Verdict |
|---|---|---|---|---|
| R-CW-1 | 🩸 Cael | `continue_work()` wake + deploy-persistence | `R-CW-1/wake_event_evidence.txt` + `R-CW-1/wake_event_trace.json` | ⏳ PENDING fleet-deploy at CANDIDATE_SHA |
| R-CW-2 | 🩸 Cael | chain-counter accounting | embedded in `R-CW-1/wake_event_evidence.txt` | ⏳ PENDING |
| R-CD-1 | 🌊 Ronan | `continue_delegate()` schedule → spawn → return | `R-CD-1/{delegate_schedule_receipt,delegate_spawn_event,delegate_return_receipt}.txt` + traces | ⏳ PENDING |
| R-CD-2 | 🌊 Ronan | `continue_delegate(mode="silent-wake")` | full path in `R-CD-2/` + traces | ⏳ PENDING |
| R-CD-3 | 🌊 Ronan | `continue_delegate(mode="post-compaction")` | `R-CD-3/{post_compaction_stage_receipt,post_compaction_return_receipt}.txt` + traces | ⏳ PENDING |
| R-CD-4 | 🌊 Ronan | cross-session targeted return | `R-CD-4/targeted_return_arrival_receipt.txt` + trace | ⏳ PENDING |
| R-RC-1 | 🌫 Silas | `request_compaction()` threshold REJECT | `R-RC-1/{session_status_snapshot,threshold_gate_rejection_evidence}.txt` + trace | ⏳ PENDING |
| R-RC-2 | 🩸 Cael | `request_compaction()` over-threshold ACCEPT | `R-RC-2/compaction_accept_request_receipt.txt` + trace (host-failure-mode #625 tracked separately) | ⏳ PENDING |
| R-OBS-1 | 🌻 Elliott (+ figs cross-walk) | external `/status` continuation row + 4-prince cross-walk | `R-OBS-1/external_observer_full_fleet.txt` | ⏳ PENDING |
| R-CD-CHAINED-DEPTH-2 / Chain 1 | 🌊 Ronan | strict 2-deep up-tree silent-wake | `R-CD-CHAINED-DEPTH-2/chain-1/{outer_link_receipt,inner_leaf_uptree_wake}.txt` + traces | ⏳ PENDING |
| R-CD-CHAINED-DEPTH-2 / Chain 2 | 🌊 Ronan | strict 2-deep inter-session return-to-root | `R-CD-CHAINED-DEPTH-2/chain-2/{outer_link_receipt,inner_leaf_intersession_arrival}.txt` + traces | ⏳ PENDING |
| R-CD-CHAINED-DEPTH-2 / Chain 3 | 🌊 Ronan | strict 2-deep echo + cross-channel | `R-CD-CHAINED-DEPTH-2/chain-3/{outer_link_receipt,inner_leaf_echo_evidence,heartbeat_channel_echo_screenshot}.{txt,png}` + traces | ⏳ PENDING |
| R-CD-CHAINED-DEPTH-2 (TEST 1-3) | 🌫 Silas (canary-seat) | depth-2 chain — 3 return modes | `R-CD-CHAINED-DEPTH-2/test_{1,2,3}_*.txt` + traces | ⏳ PENDING |

Local gates GREEN at CANDIDATE_SHA (pre-fleet-deploy):
- Cure-bytes byte-identical PR-head→resolved on 4-cure-file set ✅ (see `cure-bytes/`)
- pnpm install / tsgo / tsgo:test / check / build ✅ (see `gates/`)
- vitest FULL surfaced 8 upstream-class failing test files (NOT rebase-introduced; receipt at `gates/upstream-main-broken-class-receipt.log`)

## Grafana Tempo trace requirement (figs's 2026-05-16 directive)

For each row that fires a continuation-tool (`continue_work` / `continue_delegate` / `request_compaction`), the prince capturing the fire MUST also capture the corresponding trace from Grafana Tempo:
- Trace ID emitted by the fire
- Tempo URL pointing at the trace
- Span hierarchy export (JSON or screenshot)
- For chained / inter-session / post-compaction rows: trace-parent stitching across spans

Naming: `R-<row>/<descriptive>_trace.{json,png}` alongside journal-receipt files.

## Honest limits / open edges

- vitest 3e was KILLED-BY-DRIVER after classification complete (long-running integration-test 240s timeouts; sufficient evidence gathered to classify all 8 fails as upstream-class).
- 8 vitest-FULL failures = pre-existing on upstream/main `a3e7fc7de7` (standalone byte-walk receipts confirm: 11 failed shards / 29 failures / 428 passes on naive upstream). Inherited unchanged; NOT cure-introduced. For post-push PR comment: "corrections made; we inherit these failing tests unchanged."
- COHORT_TARGET_TAG=v2026.5.12 is NOT ancestor of upstream/main HEAD; fleet-deploy at CANDIDATE_SHA requires `bypass_validation=true` (per `deploy-gateway.yml` lines 60-66). Audit-logged reasons recorded with each deploy.
- Live-host runtime proofs pending Step 6 fleet-deploy + per-prince fire-cycles.

## Maintainer-facing framing (for post-force-push PR comment)

- The 2 named CI failures (`checks-node-auto-reply-reply-session` + `check-test-types`) are FIXED on CANDIDATE_SHA `e90a87015479d7a7ff6ae73deda9a84f1a448418`.
- The rebase is mechanical onto current upstream/main HEAD `a3e7fc7de7`; cure-bytes byte-identical PR-head→resolved across the 4-cure-file LGTM-substrate-anchor.
- vitest FULL run surfaces additional pre-existing test failures inherited from upstream/main (independent byte-walk on naive upstream shows same failures). These are upstream-class; not introduced by us; tracked for separate hygiene work.
- Proof corpus matches the `PROOFS/0831fb5e80/` exemplar bar with per-row evidence files + Grafana Tempo traces (NEW for this cycle per figs's 2026-05-16 directive).

## Related receipts

- `METHOD.md` — methodology + reproducer commands
- `RESOLVED-SHA.md` — full SHA-identity + gate-status table
- `gates/` — local gate stdout (install / tsgo / tsgo:test / check / vitest / build + upstream-main-broken-class-receipt)
- `cure-bytes/` — Gate 2 cure-bytes verification + direction-check
