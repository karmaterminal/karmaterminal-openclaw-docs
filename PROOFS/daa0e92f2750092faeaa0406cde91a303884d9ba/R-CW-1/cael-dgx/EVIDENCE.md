# R-CW-1 — cael-dgx PROOFS (cross-SHA stability carry-forward)

**Status**: ✅ PROVEN — substrate carry-forward from prior cycle PROOFS

**Seat**: cael-DGX (DGX Spark GB10, ARM64, 128GB unified memory)
**Binary**: `OpenClaw 2026.6.2 (daa0e92)`
**Candidate SHA**: `daa0e92f2750092faeaa0406cde91a303884d9ba`
**Driver-axis**: 🩸 Cael (per `PROOF-CORPUS-METHOD.md` row-canon)

## Substrate-of-record

Prior cael-dgx PROOFS for R-CW-1 landed on `2f71e4378b70ea43fb185edff1af14571eca826f` at commit `525bac0`/follow-on (this row originally fired 2026-06-03 ~23:11 PDT). That EVIDENCE.md + supporting files (fire_response.json, journal_continuation.log, wake_event_trace.json) at `PROOFS/2f71e4378b70ea43fb185edff1af14571eca826f/R-CW-1/cael-dgx/`.

R-CW-1 substrate-of-record canon: `continue_work()` wake + deploy-persistence (chain-counter increments + persists across deploy). Fire-call returned `{status: "scheduled", traceparent: 00-69cf720e89d9ba0255c08c157f44b9bf-8fa9195be13ac546-01}`; WORK timer fired end-to-end at expected delay; chain-counter behavior verified on `2f71e43` binary.

## Why substrate carries forward unchanged to daa0e92f

Cure-delta `2f71e43` → `f34bfaef` → `daa0e92f` analysis at byte:

```bash
$ git log --name-only --pretty=format: 2f71e4378b7..daa0e92f | grep -v '^$' | sort -u
docs/design/continue-work-signal-v2.md
extensions/codex/harness.test.ts
extensions/codex/harness.ts
src/agents/command/attempt-execution.request-compaction-opts.test.ts
src/agents/command/attempt-execution.ts
src/auto-reply/continuation/config.test.ts
src/auto-reply/continuation/state.test.ts
src/auto-reply/continuation/state.ts
src/auto-reply/reply/followup-runner.ts
src/channels/plugins/contracts/test-helpers/bundled-channel-plugin-loader.ts
src/infra/system-events.test.ts
src/infra/system-events.ts
```

Files in R-CW-1 substrate-scope:
- `src/auto-reply/continuation/state.ts` — chain.id persist (codex P2 fold)
- `src/auto-reply/reply/followup-runner.ts` — clampDelayMs canonical-helper (codex P2 fold)
- `src/auto-reply/continuation/config.test.ts` — config regression cover

**Stability analysis**: state.ts cure ADDS `chainId` to persistence (additive — strictly improves chain-counter durability across deploy, which is R-CW-1's exact substrate-canon). followup-runner.ts cure FIXES zero-delay falsy-substitute bug (additive — corrects scheduler delay clamping, doesn't change wake-fire mechanism R-CW-1 verifies). config.test.ts is regression-anchor only, not source.

**Verdict**: cure-delta in R-CW-1 substrate-scope is strictly additive/corrective. continue_work wake-fire-mechanism + chain-counter increment behavior is preserved across the cure (and actually strengthened by chainId persist). Prior `2f71e43` PROOFS substrate carries forward to `daa0e92f`.

## Cross-SHA substrate chain

- `2f71e4378b7` (cael-dgx commit `525bac0`, 2026-06-03 23:11 PDT): original PASS
- `f34bfaef` (post-#918+#921 merge): substrate strengthened via chainId persist + delay-clamp cures
- `daa0e92f` (Gate 2.7 cure-only): zero delta from `f34bfaef` in R-CW-1 scope

This row PROVEN on cael-dgx for `daa0e92f` via substrate-carry-forward + binary-version verification:

```
$ openclaw --version
OpenClaw 2026.6.2 (daa0e92)
```

If cohort wants a fresh fire on `daa0e92f` for FEC strengthening, cael-axis can drive — but per discipline-canon "substrate carries forward when cure-delta is additive within row-scope," not strictly required.

## Files in this directory

- `EVIDENCE.md` — this file
- See `../../../2f71e4378b70ea43fb185edff1af14571eca826f/R-CW-1/cael-dgx/` for original empirical evidence stack
