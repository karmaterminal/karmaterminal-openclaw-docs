# elliott-legion per-seat attestation — deployed `4bbd3aec096`

**Seat:** elliott-legion (10.0.0.153; CachyOS, Ryzen 9 5900HX, 64GB, RTX 3080 — Lenovo Legion)
**Ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` · OpenClaw `2026.6.2 (4bbd3ae)`
**Owner:** 🌻 Elliott. Per-seat attestation that the deployed binary runs + the #978 fix + continuation tools are live on elliott-legion.

## Row summary

| Row | Proof | Verdict | File |
|---|---|---|---|
| Reading-A baseline | dist-loading daemon, 3-signal closure (ordering + build-info-provenance + content-closure) | ✅ ironclad | `seat-facts.txt` + R-OBS-1 reading-A note |
| #978 empirical | `vitest subagent-announce.postcompaction-route.test.ts` → 8/8 PASS, EXIT 0 | ✅ | `R978-EVIDENCE.md` + `r978-vitest.log` |
| #978 byte-in-dist | post-compaction parse `tokens-CMBF5Yh4.js:181-182` + `stagePostCompactionDelegate` in running dist | ✅ | `R978-EVIDENCE.md` |
| R-RC-1 (request_compaction REJECT) | ctx=37% < 70% → guard=context_threshold, rejected, session uninterrupted | ✅ | `R-RC-1-EVIDENCE.md` |
| R-CW-1 (continue_work tool) | scheduled (trp `2742c02b`) → `work-wake hop=1/200` fired; `work-drive-skipped reason=requests-in-flight` = defer-while-active guard (corroborates Silas+Emeric on 3rd seat) | ✅ | `R-CW-R-CD-DISPATCH.md` |
| R-CD-1 (continue_delegate tool, silent-wake) | scheduled (trp `2742c02b`) → `[continuation:delegate-spawned] Spawned turn 2/200`, chain→2/200 | ✅ | `R-CW-R-CD-DISPATCH.md` |
| R-OBS-1 (owner) | external `/status` 6-prince cross-walk aggregate (owner-arm + verdict table) | ✅ owner | `../R-OBS-1/` |

## Reading-A note
elliott-legion daemon = `node dist/index.js` (PID 2646980) — dist-loading shape (NOT runs-from-tree;
the cohort-wide CLI-entrypoint-vs-daemon-load correction). Reading-A closed THREE ways: ordering-blade
(restart 04:36:29 postdates dist-build 04:35:01), build-info content-provenance (`.buildstamp.head`=target,
build-time-written), and code-content-closure (target-only symbols `contextEngineOwnsCompaction` etc. in
dist chunks, absent at `9b1f42a`). Full detail in `../R-OBS-1/chat_card_visibility_external_observer.md`.

## Tool-set registration (foundational-canon)
All three continuation primitives fired live on the deployed binary from elliott-legion main session:
continue_work ✅ (R-CW-1) + continue_delegate ✅ (R-CD-1) + request_compaction ✅ (R-RC-1 reject-arm).
NOT the "only continue_delegate registers" partial-regression. Foundational-canon satisfied on elliott-legion.
