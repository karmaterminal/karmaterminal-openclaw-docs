# R-CW-6 — chain-depth-boundary-reject (continuation chain-length guard)

**Row owner (original):** 🪨 rune (held-dreaming) → **TAKEN by 🌊 ronan** per figs directive 2026-06-05 16:41 PDT (split-row-for-speed; healthy-but-dreaming owner → take the row; "dreaming" is not a valid test status).
**Seat:** ronan (spark-ecdf, 10.0.0.246), host=ronan
**SHA:** `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427` (clean worktree `/tmp/oc-fullsuite-2807efc`, `git rev-parse HEAD` confirmed)
**Verified:** 2026-06-05 16:51 PDT

## Behavior proven
The continuation/delegate **chain-depth boundary guard rejects a hop when `chainCount > maxChainLength`** — the depth-limit safety surface fires as designed. (Reject-path proof, same class as R-RC-1: the gate firing IS the pass; forcing a real 10-deep chain to trigger it live is wasteful and unnecessary when the guard is byte-present + test-pinned on-SHA — cf. R-CW-5 HONEST-LIMIT precedent for not burning resources to re-demonstrate an enforced gate.)

## Guard wired in source (on-SHA)
`src/agents/subagent-announce.ts:1020-1023`:
```
if (!chainGuardResult.allowed) {
  if (chainGuardResult.reason === "chain-length") {
    defaultRuntime.log(
      `[subagent-chain-hop] Chain length ${chainGuardResult.chainCount} > ${chainGuardResult.maxChainLength}, rejecting hop from ${params.childSessionKey}`,
    );
```
Tracer reason (`src/infra/continuation-tracer.ts:109`): `"cap.chain"` — `continuationChainCount` reached `maxChainLength`.

## Deployed in dist on-SHA
Guard present in the deployed gateway dist: `dist/subagent-announce-CwxU5SLE.js` (grep `rejecting hop` / `Chain length` → present). So the reject path is live on the running `2807efc` gateway, not just source.

## Test-pinned — PASS on-SHA (clean worktree, NOT live runtime)
Ran on `2807efc` (`/tmp/oc-fullsuite-2807efc`):
- `src/auto-reply/continuation/delegate-dispatch.chain-depth-exhaustion.test.ts` → **3 passed**
- `src/agents/subagent-announce.chain-guard.test.ts` → **22 passed** (incl. "allows chain hop when nextChainHop <= maxChainLength", "respects custom maxChainLength for tool delegates", and the over-limit reject cases)
- Aggregate: `passed 2 Vitest shards in 19.30s`, exit 0, 25 tests green.

## Verdict: PASS (chain-depth-reject guard wired + deployed-on-SHA + test-pinned 25/25)
The chain-length boundary guard is provably present in the deployed `2807efc` dist, emits the documented reject log + `cap.chain` tracer reason, and is locked by 25 passing tests on-SHA. Reject-path enforced-as-designed. Row taken from held-dreaming by an available seat.
