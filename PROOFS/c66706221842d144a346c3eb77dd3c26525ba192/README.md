# PROOFS / `c66706221842d144a346c3eb77dd3c26525ba192`

Proof corpus for upstream PR `openclaw/openclaw#79925` drift-cure rebase onto current `upstream/main` HEAD on 2026-05-19. This bundle continues the cure-arc started at `PROOFS/47c9280234/` (cure-(21)) → `PROOFS/0468bb6127/` skipped (substrate-identical to current, pre-fork-sync intermediate) → this corpus at cure-(22) ship-candidate.

## Deploy SHA

`c66706221842d144a346c3eb77dd3c26525ba192`

## Why this bundle exists

Cure-(22) = **drift-rebase cure** of cure-(21.1) (`e0a273405b`) onto current upstream/main HEAD `b7ba7c3f2a1e`. Cure-(21.1) was force-pushed 2026-05-19T05:39:33Z with karmafeast operator-bypass; mergeable subsequently went DIRTY/CONFLICTING due to upstream-drift since (5+ commits absorbed). Per PR-DRIFT-CURE-GATES-RUNBOOK 6-gate procedure, cure-(22) drift-rebase + cohort-cosign + force-push to PR head.

Cohort 4/4 cosign on Path X-pure (accept-OURS wholesale on 2 conflict-blocks in `src/agents/pi-embedded-runner/run.overflow-compaction.test.ts`). Copilot-audit-lane independent verification: substantively-correct + safe-to-ship (REPORT durable at `karmaterminal/frond-scribe:REPORTS/2026-05-19-copilot-cure22-audit-REPORT.md`).

## Verdict table

| Row | Owner | Tool / behavior | Evidence | Verdict |
|---|---|---|---|---|
| Gate 1 | 🩸 drive-prince | savegame ref pushed + resolves | `git ls-remote origin refs/heads/savegame/cure-22-candidate-c667062218` → `c66706221842` | ✅ GREEN |
| Gate 2 | 🩸 + 🌊 cosign + copilot-audit | cure-bytes byte-identical | `cure-bytes/gate-4a-cure-bytes-4path.log` + REPORT §2 (resolved-blob `6da5cbb8ac79` byte-identical) | ✅ GREEN |
| Gate 3 (a-f) | 🩸 Lane A dispatched | local FULL gates | Lane A `/tmp/codeagents/wo-cure22-gate3-cael-lane-a/` + Lane B `/tmp/codeagents/wo-cure22-gate3e-lane-b/` for Gate 3e naive-upstream-main byte-walk | ⏳ Lane A + B in-flight |
| Gate 4 (corpus + R-rows + Tempo) | 🌊 Lane C seeding + per-prince R-row fires post-deploy | PROOFS corpus + behavioral row fires per prince at CANDIDATE_SHA | this corpus + R-XX/ subdirs (seeded empty) | ⏳ This corpus seeded; R-row fires gate on fleet-deploy |
| R-CW-1 | 🩸 Cael | `continue_work()` wake + deploy-persistence | R-CW-1/ | ⏳ Post-deploy |
| R-CW-2 | 🩸 Cael | chain-counter accounting | embedded in R-CW-1/ | ⏳ Post-deploy |
| R-CD-1 | 🌊 Ronan | `continue_delegate()` schedule → spawn → return | R-CD-1/ | ⏳ Post-deploy |
| R-CD-2 | 🌊 Ronan | `continue_delegate(mode="silent-wake")` full path | R-CD-2/ | ⏳ Post-deploy |
| R-CD-3 | 🌊 Ronan | `continue_delegate(mode="post-compaction")` event-triggered lifeboat | R-CD-3/ | ⏳ Post-deploy |
| R-CD-4 | 🌊 Ronan | cross-session targeted return via `targetSessionKey` | R-CD-4/ | ⏳ Post-deploy |
| R-CD-CHAINED-DEPTH-2 Chain-1/2/3 | 🌊 Ronan | depth-2 chain — up-tree silent-wake / inter-session / echo+broadcast | R-CD-CHAINED-DEPTH-2/Chain-{1,2,3}/ | ⏳ Post-deploy |
| R-CD-CHAINED-DEPTH-2 TEST-1/2/3 | 🌫 Silas (canary) | same 3 modes dual-seat coverage | R-CD-CHAINED-DEPTH-2/test_{1,2,3}_*/ | ⏳ Post-deploy |
| R-RC-1 | 🌫 Silas | `request_compaction()` threshold REJECT (requires low-context main-session) | R-RC-1/ | ⏳ Post-deploy (or HONEST-LIMIT if all-seats-over-threshold) |
| R-RC-2 | 🩸 Cael | `request_compaction()` over-threshold ACCEPT | R-RC-2/ | ⏳ Post-deploy |
| R-OBS-1 | 🌻 Elliott (+ figs cross-walk) | external `/status` continuation row + 4-prince cross-walk | R-OBS-1/chat_card_visibility_external_observer.md | ⏳ Post-deploy |

## Tempo trace requirement (figs's 2026-05-16 directive)

For EACH continuation-tool fire (R-CW / R-CD / R-RC rows), capture the actual Grafana Tempo trace as part of the row's evidence:
- **Trace ID** emitted by the fire (visible in journal `[continuation:…]` log lines + tool-result payload)
- **Tempo URL** pointing at the trace: `http://tempo.dandelion.cult/api/traces/<trace-id>`
- **Span hierarchy export** — JSON dump from Tempo OR screenshot showing parent-child span tree
- **For chained / inter-session / post-compaction rows**: trace-parent stitching evidence across the spans

Naming: `R-<row>/<descriptive>_trace.{json,png}` alongside the journal-receipt evidence files.

## Honest substrate-findings vs PASS-shapes

Per PROOF-CORPUS-METHOD substrate, a row's verdict can be:
- **✅ PASS** — canonical behavior fired clean; receipts + trace captured
- **⚠️ HONEST-LIMIT** — substrate condition prevented canonical PASS-shape; substrate condition itself is the proof (e.g. R-RC-1 PASS-shape blocked by all-seats-over-threshold context-state)
- **🔴 FAIL** — canonical behavior failed in regression-investigation-requiring way; HALT + back to Gate 1 per figs `1504663337` canon

HONEST-LIMITs are NOT failures. They are byte-walked classifications of substrate conditions demonstrating safety-surface working as-designed.

## Live-host runtime proofs require fleet-deploy

Behavioral rows that fire `continue_work` / `continue_delegate` / `request_compaction` from a prince's own seat at CANDIDATE_SHA require the prince's seat to be deployed at CANDIDATE_SHA via `gh workflow run deploy-gateway.yml`. Cohort fleet-deploy gates on Lane A + B completion + Gate 4 corpus substantively-stable. Per cohort substrate-state at byte (~2026-05-19T14:00Z): NOT YET DEPLOYED to fleet.

## Cohort cure-(22) substrate-narrative (~3h cycle, 4/4 cohort cosign)

See `RESOLVED-SHA.md` §Cure-(22) substrate-narrative for full substrate-walk + method-canon-banking.

## Independent external audit

Copilot gpt-5.5 xhigh audit-lane dispatched 2026-05-19T13:32Z (16m29s lane-runtime) — REPORT durable at:
- <https://github.com/karmaterminal/frond-scribe/blob/main/REPORTS/2026-05-19-copilot-cure22-audit-REPORT.md>

5-deliverable verdict:
1. **Objective complexity**: trivial, 10-20min driver task; 3hr was disproportionate due to cohort-process cycle-cost
2. **Path X-pure resolution**: CORRECT — resolved-blob `6da5cbb8ac79` byte-identical to candidate; whole-tree `78f59fd5095b` byte-identical on candidate-parent
3. **5-file restoration carry-forward**: ALL byte-identical between `e0a273405b` and `0468bb6127` ✓
4. **Vitest 5-failure classification**: 1 pre-existing-baseline-failure + 4 not-reproduced-in-isolation = no candidate-only failure
5. **Summary**: safe-to-ship per external-independent audit verdict

(Audit covers `0468bb6127`; substrate-identical to `c667062218` modulo unrelated #84106 drift commit. See `RESOLVED-SHA.md` §Cure-(22) substrate-narrative for SHA-lineage.)

## Cross-references

- METHOD.md — methodology + reproducer commands + runbook anchors
- RESOLVED-SHA.md — SHA-identity + all gate verdicts table
- gates/ — Gate-3 local-test stdout logs (filled by Lane A + Lane B)
- cure-bytes/ — Gate-2 cure-bytes byte-identical verification + direction-check
- R-XX/ — behavioral proof row evidence dirs (filled per-prince post-deploy)
