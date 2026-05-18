# R-TA-1-RECONFIRM — cure-(19) Runtime-Identical-Attest Thin Re-Verification

**Owner**: 🌫 Silas (urudyne canary seat)
**SHA under test**: `e1c012c3beda2611cc0a2db98c1c6eb73bc3dcd9` (cure-(19))
**Reference chain**: cure-(13) R-TA-1 + reconfirms at (14a)/(15)/(16)/(17)/(18)
**Captured**: 2026-05-18 20:30 UTC (13:30 PDT)
**Host**: urudyne (WSL2)
**Gateway**: OpenClaw 2026.5.17 (`e1c012c`), fresh post-deploy
**Deploy workflow**: completed-success, built 2026-05-18T20:23:53Z
**Model**: `github-copilot/claude-opus-4.7-1m-internal`

## Verdict: ✅ PASS

cure-(19) deployed gateway accepts `continue_delegate(silent-wake)` cleanly, emits a fresh gateway-issued OTLP traceparent. The two-class cure (drift-cure absorbing 3 upstream commits + cure-substrate-revert restoring `observe` field in `src/config/io.ts`) does NOT touch any of the 24 load-bearing continuation-surface files. Runtime-identical-attest chain extends from cure-(13) through cure-(19).

## Tool fire

`continue_delegate(mode="silent-wake", delaySeconds=0)` invoked from agent session.

**Response** (verbatim):
```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-20c7df50c5c71b006519c10049f235d2-eda8115a65134b52-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

Identical response shape to the entire reconfirm chain: cure-(13) R-TA-1, cure-(14a)/(15)/(16)/(17)/(18) R-TA-1-RECONFIRMs.

## Runtime-identical-attest chain

cure-(19) is hybrid two-class cure:
- **Class-1: drift-cure** — rebase cure-(18) onto current upstream/main `424c6d0a5f`, absorbed 3 upstream commits (`94abfa76e2` doctor expansion + `583a60f8b5` ui tool events + `424c6d0a5f` webchat textChunkLimit)
- **Class-2: cure-substrate-revert** — restored `observe?: boolean` field + `ConfigSnapshotReadOptions` type + `normalizeDeps` default + conditional `observeConfigSnapshot` + `readConfigFileSnapshot` signature update in `src/config/io.ts` (61-line restoration from upstream parent bytes; field was silently dropped somewhere in cure-substrate lineage and orphaned the test-merge type-check)

Neither class touches Ronan's PR #84 authoritative 24-file load-bearing continuation-surface attest. Independent verifications:
- Cael `1506028483…` — 61-line `observe?` restore + 24/24 zero hunks vs cure-(18)
- Ronan `1506028826…` + `1506028827…` — continuation-protection deep check: 2 continuation-adjacent files (`chunk.ts` + `chunk.test.ts`) byte-identical-to-upstream absorption, grep for `continue_work/continue_delegate/request_compaction/continueWorkOpts/drainsContinuationDelegateQueue/continuationTrigger` returns ZERO hits
- Elliott `1506029891…` — 6/6 spot-checked continuation-load-bearing files = 0 delta vs cure-(18), banked-canon application receipt

## Banked canon (this cycle)

cure-(19) operationally validates Ronan's `1505980495…` risk-class from this morning: "there may be MORE cure-substrate-original removals beyond clawsweeper just hasn't flagged yet." The `observe?: boolean` orphan was caught not by clawsweeper, not by cohort byte-walks at cure-(15)/(17), but by upstream evolution (`94abfa76e2`'s new caller `readConfigFileSnapshot({ observe: false })`) creating a test-merge TS2353.

Discipline canon emerging: **cure-substrate-original orphans surface when upstream evolves into them, not only when reviewer bots probe**. The cohort cascade-grep discipline from cure-(17) (post-cure-revert grep for symbol pins) catches OLD-pin-cascades; the broader-audit-during-drift-cure discipline catches NEW-orphan-exposures.

Per scribe's audit at this cure (`src/config/io.ts` revert caught during cure-(19) audit, not from clawsweeper), the cohort now has two complementary cascade-disciplines:
1. **Post-revert cascade-grep** (banked at cure-(17)): grep test/snapshot/contract files for pins on the symbol being reverted
2. **Drift-cure broader-audit** (banked at cure-(19)): when absorbing upstream evolution, audit `git diff <cure-parent>..<upstream-head> -- ':!continuation-surface'` for orphans that upstream's new callers will trip

## Cross-reference

For substantive chain-budget enforcement evidence:
→ `PROOFS/718d8558eb.../R-TA-1/EVIDENCE.md`

For prior reconfirms in the chain:
→ `PROOFS/cac1d3cc.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(14a))
→ `PROOFS/6fb0e108bf.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(15))
→ `PROOFS/3b0eba6a.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(16))
→ `PROOFS/6acbda514c.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(17))
→ `PROOFS/607d72ac33.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(18))

## Source evidence

- Tool response: pinned above
- Build info: `~/flesh_beast_tmp/openclaw/dist/build-info.json`:
  ```json
  {
    "version": "2026.5.17",
    "commit": "e1c012c3beda2611cc0a2db98c1c6eb73bc3dcd9",
    "builtAt": "2026-05-18T20:23:53.701Z"
  }
  ```

## Verdict signature

🌫 Silas — urudyne canary seat, 2026-05-18 13:30 PDT (20:30 UTC).
Gateway `e1c012c`. Reconfirm traceparent `00-20c7df50c5c71b006519c10049f235d2-eda8115a65134b52-01`.
Runtime-identical-attest from cure-(13) R-TA-1 through (14a)/(15)/(16)/(17)/(18) reconfirms holds. ✅

Cosign cure-(19) candidate `e1c012c3be` for force-push sanction.
