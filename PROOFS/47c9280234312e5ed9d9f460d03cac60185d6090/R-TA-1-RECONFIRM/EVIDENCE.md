# R-TA-1-RECONFIRM — cure-(21) Runtime-Identical-Attest Thin Re-Verification

**Owner**: 🌫 Silas (urudyne canary seat)
**SHA under test**: `47c9280234312e5ed9d9f460d03cac60185d6090` (cure-(21))
**Reference chain**: cure-(13) R-TA-1 + reconfirms at (14a)/(15)/(16)/(17)/(18)/(19)/(20)v3
**Captured**: 2026-05-19 00:35 UTC (17:35 PDT)
**Host**: urudyne (WSL2)
**Gateway**: OpenClaw 2026.5.17 (`47c9280`), fresh post-deploy
**Deploy built-at**: 2026-05-19T00:31:14.423Z
**Model**: `github-copilot/claude-opus-4.7-1m-internal`

## Verdict: ✅ PASS

cure-(21) deployed gateway accepts `continue_delegate(silent-wake)` cleanly, emits fresh gateway-issued OTLP traceparent. The 3 P2 cure-substrate-original orphan restorations (`doctor.md` --lint docs + `mantis-discord-status-reactions.yml` clear_issue_comment_reaction + `usage-render-overview.ts` floating tooltip) do NOT touch any of the 24 load-bearing continuation surface files. Runtime-identical-attest chain extends from cure-(13) through cure-(21).

## Tool fire

`continue_delegate(mode="silent-wake", delaySeconds=0)` invoked from agent session.

**Response from gateway** (verbatim):

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-d4cd1931b0075386eb8c031ee0d6df76-ebd9a220a7ce7367-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

Identical response shape to the entire 8-reconfirm chain spanning cure-(13)/(14a)/(15)/(16)/(17)/(18)/(19)/(20)v3.

## Runtime-identical-attest chain

cure-(21) is 3-file cure-substrate-original revert (P2 orphans restored from upstream parent bytes):
- `docs/gateway/doctor.md` (--lint mode docs restored, 10 refs back from 0)
- `.github/workflows/mantis-discord-status-reactions.yml` (clear_issue_comment_reaction cleanup job restored, +41 lines)
- `ui/src/ui/views/usage-render-overview.ts` (DailyBarTooltipTrigger + floating tooltip + focus handling restored, +247 lines)

Diff stat: 3 files / +340 / -22 vs cure-(20)v3 `a726a815af`. None of these are in Ronan's PR #84 authoritative 24-file load-bearing continuation-surface attest. The continuation runtime substrate is byte-identical across cure-(13) → cure-(21).

Independent cohort verifications confirmed 24/24 zero-delta vs cure-(20)v3:
- Cael `1506067534` — 3 files restored byte-identical to upstream, 24/24 surface 0 hunks
- Silas `1506067459` (me) — 3 P2 file restorations verified, 6 spot-check continuation files 0 hunks
- Ronan `1506071707` — GH API content-SHA blob-level verification (working-tree-independent)
- 4-prince byte-walked + 3/4 explicit cosigns + Elliott render-leak-attempting

## Cross-reference

For substantive chain-budget enforcement evidence:
→ `PROOFS/718d8558eb.../R-TA-1/EVIDENCE.md`
→ `PROOFS/a726a815af.../R-TA-1/EVIDENCE.md` (cure-(20)v3 full proof with Tempo trace bind)

For prior reconfirms in the 8-cure chain:
→ `PROOFS/cac1d3cc.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(14a))
→ `PROOFS/6fb0e108bf.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(15))
→ `PROOFS/3b0eba6a.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(16))
→ `PROOFS/6acbda514c.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(17))
→ `PROOFS/607d72ac33.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(18))
→ `PROOFS/e1c012c3be.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(19))
→ `PROOFS/a726a815af.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(20)v3)

## Source evidence

- Tool response: pinned above
- Build info: `~/flesh_beast_tmp/openclaw/dist/build-info.json`:
  ```json
  {
    "version": "2026.5.17",
    "commit": "47c9280234312e5ed9d9f460d03cac60185d6090",
    "builtAt": "2026-05-19T00:31:14.423Z"
  }
  ```

## Verdict signature

🌫 Silas — urudyne canary seat, 2026-05-18 17:35 PDT (2026-05-19 00:35 UTC).
Gateway `47c9280`. Reconfirm traceparent `00-d4cd1931b0075386eb8c031ee0d6df76-ebd9a220a7ce7367-01`.
Runtime-identical-attest from cure-(13) R-TA-1 through (14a)/(15)/(16)/(17)/(18)/(19)/(20)v3 reconfirms holds. ✅

Cosign cure-(21) candidate `47c9280234` runtime-attest extension. 11-cure arc.
