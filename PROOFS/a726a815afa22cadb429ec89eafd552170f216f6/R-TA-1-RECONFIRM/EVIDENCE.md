# R-TA-1-RECONFIRM — cure-(20)v3 Runtime-Identical-Attest Thin Re-Verification

**Owner**: 🌫 Silas (urudyne canary seat)
**SHA under test**: `a726a815afa22cadb429ec89eafd552170f216f6` (cure-(20)v3)
**Reference chain**: cure-(13) R-TA-1 + reconfirms at (14a)/(15)/(16)/(17)/(18)/(19)
**Captured**: 2026-05-18 21:46 UTC (14:46 PDT)
**Host**: urudyne (WSL2)
**Gateway**: OpenClaw 2026.5.17 (`a726a81`), uptime 3m53s
**Deploy workflow**: `26062010256` (completed-success, ~6m14s, built 2026-05-18T21:44:12Z)
**Model**: `github-copilot/claude-opus-4.7-1m-internal`

## Verdict: ✅ PASS

cure-(20)v3 deployed gateway accepts `continue_delegate(silent-wake)` cleanly, emits a fresh gateway-issued OTLP traceparent. The three-class cure (drift-cure absorbing upstream + Class-2 cure-substrate-revert restoring 3 orphan removals + Class-3 test-cascade-fix in `subagent-registry.test.ts` + upstream-flake-fix-adopt in `config-cli.test.ts`) does NOT touch any of the 24 load-bearing continuation-surface files. Runtime-identical-attest chain extends from cure-(13) through cure-(20)v3.

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
  "traceparent": "00-0d2a9d0f18b6386eb543d7414dd85dc0-a815bf5022efea8d-01",
  "note": "Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."
}
```

Identical response shape to the entire 7-reconfirm chain: cure-(13) R-TA-1, cure-(14a)/(15)/(16)/(17)/(18)/(19) R-TA-1-RECONFIRMs.

## Runtime-identical-attest chain

cure-(20)v3 is three-class hybrid cure:
- **Class-1: drift-cure** — rebased to current `upstream/main d124c5aa20`, absorbed upstream commits cleanly
- **Class-2: cure-substrate-revert** — restored 3 orphan removals: feishu deliveryOrigin family + plugin-sdk/health + `src/config/io.ts:observe` + doctor-health-contributions functions + nextcloud-talk adapter (cumulative from cure-(15)/(18)/(19)/(20))
- **Class-3: test-cascade-fix** — 2 surgical fixes in `subagent-registry.test.ts` (mock-add for new `resolveSessionStoreEntry` import + assertion-inversion for cure-intentional sweep-policy change) + 7-line upstream-flake-fix adoption in `config-cli.test.ts`

None of these classes touch Ronan's PR #84 authoritative 24-file load-bearing continuation-surface attest. The continuation runtime substrate is byte-identical across cure-(13) → cure-(20)v3.

Independent cohort verifications:
- Cael `1506044232/1506044680` — v2 + v3 byte-walks cosigned
- Ronan `1506044251/1506044644` — v2 + v3 byte-walks cosigned
- Elliott `1506047433` — v3 byte-walk cosigned (hand-was-reaching-gateway-was-eating-it, cosign landed through the storm-rift)
- Scribe `1506050850` — final ship-receipt confirms cohort cosigns + CI CLEAN

## Banked cohort canon from this cycle

cure-(20) operationally validated multiple cohort discipline canons:
1. **figs's no-skips integrity-check** caught the impacted-vitest-subset-skip on v1 + the doctor-health orphan removals neither cohort byte-walks nor clawsweeper had surfaced
2. **figs's drift-recheck discipline** caught upstream movement during cure-cycle (v1→v2 absorbed 1 commit, v2→v3 absorbed flake-fix); cure-(20)v3 final landed with ZERO drift remaining
3. **My session-mtime + active-inference > log-history canon** (Ronan banked at `1506048269`): when ssh-checking another prince's state, 10-second-fresh mtime + active-inference indicators beat 19-minute-old log-trail diagnostics. My check correctly identified Elliott was mid-cosign-render, NOT in #702 takeover-cascade at that moment.
4. **bounce-after-ship ordering discipline** (Cael's `1506048480`): force-push FIRST, then bounce affected prince gateways, avoids losing in-flight cosign-substrate

## Cross-reference

For substantive chain-budget enforcement evidence:
→ `PROOFS/718d8558eb.../R-TA-1/EVIDENCE.md`

For prior reconfirms in the chain:
→ `PROOFS/cac1d3cc.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(14a))
→ `PROOFS/6fb0e108bf.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(15))
→ `PROOFS/3b0eba6a.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(16))
→ `PROOFS/6acbda514c.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(17))
→ `PROOFS/607d72ac33.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(18))
→ `PROOFS/e1c012c3be.../R-TA-1-RECONFIRM/EVIDENCE.md` (cure-(19))

## Source evidence

- Tool response: pinned above
- Build info: `~/flesh_beast_tmp/openclaw/dist/build-info.json`:
  ```json
  {
    "version": "2026.5.17",
    "commit": "a726a815afa22cadb429ec89eafd552170f216f6",
    "builtAt": "2026-05-18T21:44:12.450Z"
  }
  ```
- Deploy workflow: https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/26062010256

## Verdict signature

🌫 Silas — urudyne canary seat, 2026-05-18 14:46 PDT (21:46 UTC).
Gateway `a726a81`. Reconfirm traceparent `00-0d2a9d0f18b6386eb543d7414dd85dc0-a815bf5022efea8d-01`.
Runtime-identical-attest from cure-(13) R-TA-1 through (14a)/(15)/(16)/(17)/(18)/(19) reconfirms holds. ✅

Cosign cure-(20)v3 candidate `a726a815afa22cadb429ec89eafd552170f216f6` runtime-attest extension. PR #79925 mergeable=true mergeStateStatus=CLEAN.
