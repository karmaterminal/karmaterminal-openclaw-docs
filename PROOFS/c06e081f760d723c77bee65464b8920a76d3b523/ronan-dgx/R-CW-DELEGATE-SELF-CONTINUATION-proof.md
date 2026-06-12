# R-CW-DELEGATE-SELF-CONTINUATION — Proof Row — Deployed SHA `c06e081f76`

**Proof type:** R-CW-DELEGATE-SELF-CONTINUATION (continue_delegate self-continuation, fired from the live deployed gateway) + #996 `:518` cleanup-guard live-in-dist + #868 continuation-tool-registration benign-pin
**Date:** 2026-06-11 ~18:48 PDT (2026-06-12T01:48Z)
**SUT (seat under test):** ronan-seat — `ronan` / spark-ecdf / 10.0.0.246
**Deployed SHA:** `c06e081f760d723c77bee65464b8920a76d3b523` (v4 = v3 `3e163a70ff` + upstream perf-harness `301213a05f`, non-continuation)
**Gateway:** `OpenClaw 2026.6.2 (c06e081)` — active since 18:32:37 PDT (the v4 fan-restart)
**Collector:** ronan-seat (self-fire from the live deployed gateway — the proof IS the live tool-use)
**Landing-call authority:** figs (A) picked + frond fan 5/6 (`27388469751` deploy-to-ronan success 18:27 PDT)

---

## SUT verification — gateway IS running the deployed SHA `c06e081f76`

- `openclaw --version` → **`OpenClaw 2026.6.2 (c06e081)`** (live-from-HEAD = checkout-at-target).
- `.deployed-sha` + runtime-checkout HEAD both = `c06e081f760d723c77bee65464b8920a76d3b523`.
- Gateway active since **18:32:37 PDT** — the v4 fan-restart (the restart that interrupted my mid-turn WAS the fan landing; my own continuation carried across that seam — lich-protocol in production, same as 🌫 lothric + 🕯 emeric).
- **Content-provenance (#996 marker in the running dist):** `dist/work-store-5haSToNg.js:362` → `if (decodeWorkState(flow)?.succeeded) return false;` — the `!decodeWorkState(flow)?.succeeded` exclusion compiled into the running binary (the De-Morgan / early-return compiled form of the source `:518 && !decodeWorkState(flow)?.succeeded`), matching 🌫 lothric line-534 + 🕯 emeric line-534. The dist is built-from-target (the #996 guard is present in the compiled chunk).

## R-CW-DELEGATE-SELF-CONTINUATION — live evidence (the proof IS the dispatch)

Fired a `continue_delegate` (silent-wake, self-continuation proof) from the live deployed gateway. It exercised the live dispatch-path + work-store (#996-gated) end-to-end. Both `flow_runs` rows landed `succeeded` (byte-verified `state/openclaw.sqlite`):

| Row | flow_id | shape | status | Evidence |
|-----|---------|-------|--------|----------|
| dispatch-record | `061a080a-974c-45ee-aeeb-0fe16e92202b` | managed | ✅ succeeded | `controller=core/continuation-delegate`, step `Accepted by continuation subagent`, `state_json.kind=continuation_delegate`, `childSessionKey=…continuation-f85b013d04232d00c4bc12ef2230d455`, traceparent issued |
| spawned-shard | `953ab2d6-2cb3-40c1-9f3c-6a0b663e14d5` | task_mirrored | ✅ succeeded | goal `[continuation:chain-hop:1] Delegated task (turn 1/200): PROOF-ROW…`, created 18:48:08 → ended 18:48:34 (ran ~26s to completion) |

So end-to-end on the deployed binary: `continue_delegate` → dispatch-record (accepted) → spawned-shard (ran-to-completion-succeeded). The #990-continuation feature fires clean on `c06e081f76`.

## #868 continuation-tool-registration — BENIGN pin (ronan = #990-wiring-owner)

The v4-runtime #868-warn (`continuation.enabled=true but neither continueWorkOpts nor requestCompactionOpts were supplied — only continue_delegate will register`) is the **inventory/dispatch-build domain, NOT the main-runner gap.** Two legs:

1. **Source:** the main-session-runner supplies BOTH opts on v4 — `agent-runner-execution.ts:2570 continueWorkOpts` + `:2602 requestCompactionOpts` (corroborated `embedded-agent-runner/run.ts:1641-1642`, `run/attempt.ts:1323-1324`, `agent-tools.ts:1075-1076`). The warn-emitting sites are the `buildInventoryContinuationToolOpts` fan-out (`tools-effective-inventory.ts:356`, `doctor-core-checks.runtime.ts:701`, `skills/runtime/tool-dispatch.ts:204`) — inventory/doctor/dispatch, the benign stub-domain.
2. **Dispositive live byte (the per-seat live-test):** my v4 main-runner has all three continuation-tools functional this cycle — `continue_delegate` fired (the two succeeded rows above), `request_compaction` returned a real 39–40%<70% guard-reject (`{guard: context_threshold, contextUsage, threshold:70}` — NOT a missing-opts error; a runner missing the opts would error, not clean-reject), `continue_work` fires clean. So both callbacks present + live on the main-runner.

**Verdict: #868-warn BENIGN on v4** — the #990/#996-continuation surface (continue_work + continue_delegate + request_compaction) is WIRED + live-functional. Per-seat live-test = `request_compaction` real-guard-reject + `continue_delegate` flow_runs-row.

## Results summary

| Row | Expected | Observed | Status |
|-----|----------|----------|--------|
| R-CW-DELEGATE (dispatch) | continue_delegate → dispatch-record accepted | `061a080a` succeeded, "Accepted by continuation subagent" | ✅ PASS |
| R-CW-DELEGATE (shard) | spawned-shard runs-to-completion | `953ab2d6` succeeded, ran ~26s | ✅ PASS |
| R-RC-guard | request_compaction → real threshold-reject (not missing-opts) | `39–40%<70%` guard-reject | ✅ PASS |
| #996 `:518` live-in-dist | exclusion compiled into running binary | `work-store-5haSToNg.js:362` | ✅ PASS |
| #868 wiring-pin | main-runner supplies both opts; warn benign | benign (inventory-domain); live-runner full-set | ✅ PASS |

**ronan-dgx: deploy-clean (v4 `c06e081f76`), continuation-feature proven-live (continue_delegate→2 succeeded flow_runs rows), #996-fix live-in-dist (line 362), #868-warn benign-pinned. Clean for the fan + Gate-5.**
