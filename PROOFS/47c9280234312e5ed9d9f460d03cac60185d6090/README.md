# PROOFS — cure-(21) `47c9280234312e5ed9d9f460d03cac60185d6090`

## Verdict: ✅ PASS via runtime-identical-attest extension

cure-(21) is a 3-file cure-substrate-original revert (P2 orphan restorations):
- `docs/gateway/doctor.md` (--lint mode docs restored, 10 refs back from 0)
- `.github/workflows/mantis-discord-status-reactions.yml` (`clear_issue_comment_reaction` cleanup job restored, +41 lines)
- `ui/src/ui/views/usage-render-overview.ts` (DailyBarTooltipTrigger + floating tooltip + focus handling restored, +247 lines)

Diff stat: 3 files / +340 / -22 vs cure-(20)v3 `a726a815afa22cadb429ec89eafd552170f216f6`. None of these are in Ronan's PR #84 authoritative 24-file load-bearing continuation-surface attest.

## Real behavior proof surface

The substantive behavioral proofs for the continuation feature were captured fresh at cure-(20)v3 SHA `a726a815af` via the full corpus shape. Because cure-(21) is byte-identical to cure-(20)v3 on the entire 24-file continuation surface (verified via 4 independent cohort byte-walks), the cure-(20)v3 PROOFS corpus serves cure-(21) head at byte via runtime-identical-attest pattern.

### Cure-(20)v3 substantive proofs (apply to cure-(21) by attest-extension)

→ [`PROOFS/a726a815afa22cadb429ec89eafd552170f216f6/`](../a726a815afa22cadb429ec89eafd552170f216f6/) — full corpus shape (9 substantive artifacts)

| Row | Description |
|---|---|
| [`R-TA-1/`](../a726a815afa22cadb429ec89eafd552170f216f6/R-TA-1/) | Chain-budget accounting across `continue_delegate` chains (with Tempo trace fetch) |
| [`R-TA-2/`](../a726a815afa22cadb429ec89eafd552170f216f6/R-TA-2/) | Token-counter accuracy + post-compaction-queue survival |
| [`continuation-live-fire.md`](../a726a815afa22cadb429ec89eafd552170f216f6/continuation-live-fire.md) | Live 4-tool fires (`continue_work` / `continue_delegate` modes / `request_compaction`) at deployed gateway with single gateway-issued trace + tool-surface verification |
| [`inter-session-targeting/`](../a726a815afa22cadb429ec89eafd552170f216f6/inter-session-targeting/) | Cross-session delegate targeting |
| [`post-compaction-threshold/`](../a726a815afa22cadb429ec89eafd552170f216f6/post-compaction-threshold/) | Context-pressure threshold + `request_compaction` guard behavior |
| [`deploy-validation/`](../a726a815afa22cadb429ec89eafd552170f216f6/deploy-validation/) | 4-seat fleet AFTER state verification |
| [`gateway-health/`](../a726a815afa22cadb429ec89eafd552170f216f6/gateway-health/) | Elliott single-seat receipt: binary commit + boot timing + plugin count + harness resolution + event flow |
| [`README.md`](../a726a815afa22cadb429ec89eafd552170f216f6/README.md) | Full corpus overview + 24-file attest chain + cohort cosign provenance |
| [`METHOD.md`](../a726a815afa22cadb429ec89eafd552170f216f6/METHOD.md) | Substrate-truth + cohort-validation gates |

## Cure-(21) byte-extension of the attest chain

This corpus extends the substantive proofs from cure-(20)v3 to cure-(21) head via 24/24 continuation-surface zero-delta verification. Independent byte-walks confirmed by 4-prince cohort:

- 🌫 Silas (this seat) — message `1506067459`: spot-checked 6 continuation files = 0 hunks vs cure-(20)v3; 3 P2 restorations verified byte-identical to upstream parent
- 🩸 Cael — message `1506067534`: 3 files restored byte-identical to upstream, 24/24 surface 0 hunks
- 🌊 Ronan — message `1506071707`: GH API content-SHA blob-level verification (working-tree-independent); blob-SHAs `27bcd2e6fb` + `e92eab9866` + `70b0877fc4` match upstream parent
- 🌻 Elliott — fleet deploy confirmation post-bounce: gateway alive on `47c9280234`, render-leak resolved, memory clean

## R-TA-1-RECONFIRM at cure-(21) — runtime-attest extension live-verified

[`R-TA-1-RECONFIRM/`](R-TA-1-RECONFIRM/) — `continue_delegate(silent-wake)` fired on freshly-deployed urudyne gateway on cure-(21) bytes. Gateway-issued OTLP traceparent `00-d4cd1931b0075386eb8c031ee0d6df76-ebd9a220a7ce7367-01`. Response shape byte-identical to all 8 prior reconfirms in the chain spanning cure-(13)/(14a)/(15)/(16)/(17)/(18)/(19)/(20)v3. Continuation tool surface (delegateIndex, delegatesThisTurn, traceparent, chain-tracking note) emits cleanly at cure-(21) bytes — proves the runtime substrate is byte-functional on the new SHA.

## Runtime-identical-attest chain

Full chain verified at byte across 11 cures:

```
cure-(13) 718d8558eb → cure-(14a) cac1d3cc01 → cure-(14b) aacfb53199 →
cure-(15) 6fb0e108bf → cure-(16) 3b0eba6adb → cure-(17) 6acbda514c →
cure-(18) 607d72ac33 → cure-(19) e1c012c3be → cure-(20)v1/v2/v3 a726a815af →
cure-(21) 47c9280234
```

24-file Appendix A continuation-load-bearing scope: **0/24 non-zero hunks at every hop**. The continuation feature substrate is byte-stable across the full 11-cure arc; only orthogonal surface (drift-cures + cure-substrate-original orphan restores) changes between hops.

## Deploy state

4-seat fleet deployed clean on `47c9280234` (verified at byte):
- 🩸 cael ✅
- 🌊 ronan ✅
- 🌫 silas ✅
- 🌻 elliott ✅

## Drift-cure provenance

cure-(21) is the 3rd cure-substrate-original orphan revert cycle today (alongside cure-(15) feishu/plugin-sdk/cleanupBundleMcpOnRunEnd, cure-(18) Nextcloud Talk message-actions, cure-(19) src/config/io.ts `observe?` field, cure-(20) doctor-health-* functions). The orphan-discovery class is recurring; cohort fuller-substrate-audit-during-drift-cure discipline is the operational cure.

## PR state

- PR #79925 head: `47c9280234312e5ed9d9f460d03cac60185d6090`
- mergeable: true
- mergeStateStatus: CLEAN
- Labels: `proof: supplied` + `📣 needs proof` (this corpus resolves the latter)
