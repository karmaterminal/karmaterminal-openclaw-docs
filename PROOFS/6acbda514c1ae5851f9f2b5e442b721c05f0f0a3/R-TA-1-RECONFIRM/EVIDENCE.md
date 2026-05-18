# R-TA-1-RECONFIRM — cure-(17) Runtime-Identical-Attest Thin Re-Verification

**Owner**: 🌫 Silas (urudyne canary seat)
**SHA under test**: `6acbda514c1ae5851f9f2b5e442b721c05f0f0a3` (cure-(17))
**Reference corpus**: `PROOFS/718d8558eb618304b5cc43c8a3b5d93ff5bef454/R-TA-1/` (cure-(13)) + reconfirm chain through cure-(14a), cure-(15), cure-(16)
**Captured**: 2026-05-18 19:04 UTC (12:04 PDT)
**Host**: urudyne (WSL2)
**Gateway**: OpenClaw 2026.5.17 (`6acbda5`), fresh post-deploy
**Deploy workflow**: `26053799211` (completed-success, built 2026-05-18T18:58:36Z)
**Model**: `github-copilot/claude-opus-4.7-1m-internal`

## Verdict: ✅ PASS

cure-(17) deployed gateway accepts `continue_delegate(silent-wake)` cleanly, emits a fresh gateway-issued OTLP traceparent. The 2-file cascade-fix (drop orphaned `cleanupBundleMcpOnRunEnd` test assertion + restore 4 Swift baseline refs) touches only test + Swift baseline — no runtime code change. Runtime-identical-attest chain extends from cure-(13) through cure-(17).

## Tool fire

`continue_delegate(mode="silent-wake", delaySeconds=0, task="cure-(17) R-TA-1-RECONFIRM thin re-verification probe...")` invoked from agent session.

**Response from gateway** (verbatim):

```json
{
  "status": "scheduled",
  "mode": "silent-wake",
  "delaySeconds": 0,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "traceparent": "00-dbfdbf4f91786ff773473673b52d178f-cd681d55b1330705-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

Response shape identical to:
- cure-(13) R-TA-1 (`PROOFS/718d8558eb.../R-TA-1/traceparent.json`)
- cure-(14a) R-TA-1-RECONFIRM
- cure-(15) R-TA-1-RECONFIRM
- cure-(16) R-TA-1-RECONFIRM (`PROOFS/3b0eba6a.../R-TA-1-RECONFIRM/traceparent.json`)

Same fields, same note text, same status/mode discriminator. Only trace_id/span_id differ (gateway-issued fresh per fire).

## Runtime-identical-attest chain extends

cure-(17) is a 2-file test+Swift-baseline cascade-fix:
- `src/gateway/protocol/schema/agent.schema.test.ts` — orphaned `cleanupBundleMcpOnRunEnd?.["x-openclaw-internal"]` assertion dropped (cure-substrate-introduced test that pinned cure-(15)-reverted wrap-shape)
- `apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift` — 4 `cleanupbundlemcponrunend` refs restored at parent-byte positions (bundled-protocol generator catching up to now-public field)

No runtime code changes. No file in Ronan's PR #84 authoritative 24-file load-bearing continuation-surface attest is touched. cure-(13) PROOFS corpus + reconfirm chain forward unchanged.

Independent byte-walks confirming 24/24 zero-delta through cure-(17):
- Ronan `1506007222…` — fuller cascade-grep verified at byte
- Elliott `1506008570…` — 6 spot-checked continuation-load-bearing files = 0 delta vs cure-(16)
- Cael `1506007084…` — 2-file surgical verified

## Banked canon (cohort-discipline shift)

Cure-(15) cohort 4-seat byte-walks missed the cure-substrate-introduced test assertion + Swift baseline pin on `cleanupBundleMcpOnRunEnd` because we focused on prod-code revert correctness only. CI on cure-(16) surfaced the cascade.

For cure-(17), cohort applied the new discipline (per `1506004917…`): **after a cure-substrate revert, grep for `<unwrapped-symbol>` in test files + protocol contracts to find pinned-cure-shape assertions that need cascading**. Elliott banked the operational form: `grep -rn 'x-openclaw-internal' --include='*.test.ts' --include='*.swift'` for any field name being moved across the public/internal boundary.

Scribe applied the fuller cascade-grep PRE-fix on cure-(17). Cohort applied it during byte-walk. Result: zero hidden cascade-misses found.

## Cross-reference

For substantive chain-budget enforcement evidence:
→ `PROOFS/718d8558eb.../R-TA-1/EVIDENCE.md`

For prior reconfirms in the chain:
→ `PROOFS/cac1d3cc.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(14a))
→ `PROOFS/6fb0e108bf.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(15))
→ `PROOFS/3b0eba6a.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(16))

## Source evidence

- Tool response: pinned verbatim above
- Build info: `~/flesh_beast_tmp/openclaw/dist/build-info.json`:
  ```json
  {
    "version": "2026.5.17",
    "commit": "6acbda514c1ae5851f9f2b5e442b721c05f0f0a3",
    "builtAt": "2026-05-18T18:58:36.217Z"
  }
  ```
- Deploy workflow: https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26053799211

## Verdict signature

🌫 Silas — urudyne canary seat, 2026-05-18 12:04 PDT (19:04 UTC).
Gateway `6acbda5`. Reconfirm traceparent `00-dbfdbf4f91786ff773473673b52d178f-cd681d55b1330705-01`.
Runtime-identical-attest from cure-(13) R-TA-1 through cure-(14a)/(15)/(16) reconfirms holds. ✅

Cosign cure-(17) candidate `6acbda514c` for force-push sanction.
