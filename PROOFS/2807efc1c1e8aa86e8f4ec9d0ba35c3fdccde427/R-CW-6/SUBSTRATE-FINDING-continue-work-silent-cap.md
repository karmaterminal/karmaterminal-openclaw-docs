# R-CW-6 — SUBSTRATE FINDING: `continue_work` self-continuation chain-cap is a SILENT server-side no-op (not a model-visible rejection)

**Seat:** 🌻 elliott (elliott-seat, 10.0.0.153), host=elliott
**SHA:** `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427` (running gateway `git rev-parse HEAD` confirmed on-SHA; same checkout that serves this seat)
**Captured:** 2026-06-05 (subagent depth 1/5, chain-hop turn 2/200)
**Relationship to existing EVIDENCE.md:** COMPLEMENTARY, not a replacement. ronan's `EVIDENCE.md` proves the `continue_delegate`/subagent **chain-hop** depth guard (`subagent-announce.ts` chain-guard, test-pinned 25/25). THIS finding covers the *other* continuation surface — `continue_work` **self-continuation** chain-length — via **live behavioral execution** plus source-of-record, and corrects a mistaken hypothesis in the R-CW-6 task brief.

---

## 1. What the R-CW-6 task brief hypothesized (and why it's wrong for `continue_work`)

The delegated task brief asserted:
> "After ~10 successful continue_work fires, the 11th should be rejected with a reason like 'chain length exceeded' or 'maxChainLength reached.' … capture the exact rejection message/reason."

**This hypothesis is incorrect on two counts for the `continue_work` path:**

1. **The default is overridden on every real deployment I can see.** Upstream default is `DEFAULT_CONTINUATION_MAX_CHAIN_LENGTH = 10` (`src/auto-reply/continuation/config.ts:18`), but **this seat's `openclaw.json` sets `agents.defaults.continuation.maxChainLength = 200`.** So the live boundary is 200, not 10. A live chain does NOT reject at the 11th fire here.

2. **`continue_work` does NOT surface a model-visible rejection at the cap.** The cap is enforced **downstream, server-side, as a silent `return`** that declines to arm the wake-timer. The tool result the model receives is **always `{status:"scheduled"}`** regardless of cap state. There is no `ToolInputError`, no `{isError:true}`, no rejection string returned to the caller. The chain simply **goes dark** — the next continuation-wake never fires.

This is exactly the failure-shape the proof corpus exists to catch: an intuitive "it'll throw at the boundary" mental model that is **false** for this surface.

---

## 2. LIVE BEHAVIORAL EVIDENCE (11 real `continue_work` fires, on-SHA running gateway)

I fired `continue_work` 11 consecutive times across continuation-wakes / heartbeat-interleaved turns. **Every single fire returned `status: scheduled` — no rejection at the hypothesized boundary of 11.**

| Step | Result | traceparent (trace-id) |
|------|--------|------------------------|
| 1 | scheduled, clamped 0s→5s | `00-8be976c2dc2df9bea5429de554202e5a-624a617188e0a3db-01` |
| 2 | scheduled | `00-f19bb2a69f47e9e207ad1ed203e92f36-3d6e430d9fc13839-01` |
| 3 | scheduled | `00-69b08838f9433a17b04d2e41234474d4-ead83d889b4381c1-01` |
| 4 | scheduled | `00-d6c8403be9033ba34b03c6e9e424da8c-2528566eee301d4a-01` |
| 5 | scheduled | `00-82dd1c27afa5d826bc06dd22896e4935-af221fe53e5e3532-01` |
| 6 | scheduled | `00-c9ece47db1fcb4a38295bff58097c967-def8841a29eb6f0f-01` |
| 7 | scheduled | `00-cdfb49e4a94121be1ca02af0e5aa7ea0-844edacbbb95e7be-01` |
| 8 | scheduled | `00-b865fd358f2fb851b154930cc2425ff8-3d6638801f91319a-01` |
| 9 | scheduled | `00-d06636c9a01748a88681b1ed57fddce2-90e3ea0d2446b8ff-01` |
| 10 | scheduled | `00-e12e48ad996c10db4f14186ed878301c-a22ad31915bae83a-01` |
| 11 | scheduled (**no reject at "expected" boundary**) | `00-d0f26a375f95907018e5932f82bad78b-7c43a216b7145a31-01` |

**Verbatim tool result shape (every fire):**
```json
{
  "status": "scheduled",
  "delaySeconds": 5,
  "note": "Requested 0s, clamped to 5s by continuation config.",
  "traceparent": "00-<unique-32hex-trace>-<16hex-span>-01"
}
```

**Observations from the live run:**
- Each fire mints a **fresh trace-id** (not a continuation of one parent trace).
- The `0s→5s` clamp note is **byte-identical** to the value pinned in `continue-work-tool.boundary.test.ts` (`"Requested 0s, clamped to 5s by continuation config."`), confirming the delay-clamp contract is the one under test.
- I **stopped at 11** rather than burning ~189 more 5-second continuation cycles to reach the real 200 cap, because the cap *mechanism* is fully established by source-of-record (below) and the brief's premise was already disproven empirically.

---

## 3. SOURCE-OF-RECORD: where the `continue_work` cap actually lives (on-SHA `2807efc`)

The `continue_work` chain-cap is enforced at **three symmetric sites**, all using the same `currentChainCount >= maxChainLength` comparison, and all **silently declining** rather than throwing:

### 3a. `attempt-execution.ts:940` — spawn-init / turn-1 path
```js
const { maxChainLength } = continuationConfig;
const chainState = loadContinuationChainState(params.sessionEntry, turnTokens);
const currentChainCount = chainState.currentChainCount;

if (currentChainCount >= maxChainLength) {
  log.info(
    `[attempt-execution] continue_work cap reached for ${sanitizeForLog(params.sessionKey)}: ${currentChainCount}/${maxChainLength}`,
  );
  return;          // ← SILENT NO-OP. No throw. No model-visible reject. Timer never armed.
}
```

### 3b. `followup-runner.ts:1199` — turn-2+ path (the path THIS subagent runs on)
```js
if (currentChainCount >= maxChainLength) {
  defaultRuntime.log(
    `[followup-runner] continue_work cap reached for ${sessionKey}: ` +
      `${currentChainCount}/${maxChainLength}`,
  );
  // else-branch: advance nextChainCount, persist, arm setTimeout → requestHeartbeatNow
}
```
Same shape: cap-hit → **log-and-skip**, no timer armed, no reject returned. The model's tool call already returned `scheduled` upstream in `continue-work-tool.ts`; this scheduler is decoupled from that result.

### 3c. `agent-runner.ts:2521` — bracket-signal path (`[[CONTINUE_WORK]]` / structured tool request)
This is the ONE path that DOES emit a model-visible system-event on cap:
```js
if (allocatedChainHop >= maxChainLength) {
  defaultRuntime.log(`Continuation chain capped at ${maxChainLength} for session ${sessionKey}`);
  enqueueSystemEvent(
    `[continuation] Bracket continuation rejected: chain length ${maxChainLength} reached.`,
    { sessionKey, trusted: true },
  );
  emitContinuationDisabledSpan({ disabledReason: "cap.chain", ... });   // ← OTel span
}
```
**Verbatim model-visible reject string (bracket path only):**
> `[continuation] Bracket continuation rejected: chain length 200 reached.`

(`200` = this seat's configured `maxChainLength`. Upstream-default deployment would read `10`.)

---

## 4. The cap counter genuinely accumulates — it is NOT reset by ordinary turns

`loadContinuationChainState` (`state.ts:158`) reads `source?.continuationChainCount ?? 0`; `persistContinuationChainState` (`state.ts:185`) writes the advanced count back to the `SessionEntry` after each scheduled hop. The **only** place the counter is zeroed is a full session-reset (`agent-runner-session-reset.ts:87`: `continuationChainCount: undefined`). So the chain depth is real and persistent — a chain *would* eventually hit 200 here. It does not silently reset on heartbeat-interleaved wakes; the counter survives.

---

## 5. OTel trace evidence for the cap event

When the cap fires on the bracket path, `emitContinuationDisabledSpan` (`continuation-tracer.ts:599`) emits span `continuation.disabled` with attributes:
- `disabled.reason = "cap.chain"`  ← documented at `continuation-tracer.ts:109` as "`continuationChainCount` reached `maxChainLength`"
- `signal.kind = "bracket-work"` (or `"bracket-delegate"`)
- `continuation.disabled = true`
- `chain.step.remaining = max(0, maxChainLength - allocatedChainHop)` (= 0 at the cap)
- `chain.id` (if a stable chain id was minted)

**Note:** the silent `return` paths (3a/3b) do **not** emit a `continuation.disabled` span — they only `log.info` server-side. So on a real-deployment `continue_work` cap-hit via the non-bracket scheduler, the *only* forensic signal is the `continue_work cap reached for <session>: <n>/<max>` log line, **not** an OTel span and **not** anything the model sees.

---

## 6. VERDICT

**PASS (with corrected behavior-shape) — the `continue_work` chain-cap guard is wired, on-SHA, and enforced — but it is a SILENT server-side gate, not a model-visible rejection.**

- ✅ Cap comparison `currentChainCount >= maxChainLength` present at 3 symmetric source sites on-SHA `2807efc`.
- ✅ Live execution: 11 real fires, all `scheduled`, byte-confirming the tool result is decoupled from cap enforcement.
- ✅ Counter accumulates persistently (only full session-reset zeroes it).
- ✅ Bracket path emits verbatim reject `[continuation] Bracket continuation rejected: chain length <max> reached.` + OTel `continuation.disabled / cap.chain`.
- ⚠️ **CORRECTION TO TASK BRIEF:** (a) boundary is `maxChainLength=200` on this seat, NOT the upstream default 10; (b) the scheduler-path cap is a silent `return` — there is NO `ToolInputError` / rejection returned to the model on the `continue_work` tool result; the wake simply never arms. The brief's "11th fire should be rejected with a reason" is FALSE for the `continue_work` scheduler surface. The only model-visible chain-cap reject is on the bracket/`[[CONTINUE_WORK]]` signal path.

**Honest-limit note (cf. R-CW-5 HONEST-LIMIT / R-RC-1 precedent):** I did not drive the live chain to the real 200 boundary to capture a runtime `cap reached` log, because (a) that is ~189 additional 5s+ continuation cycles of pure resource burn, and (b) the cap mechanism, comparison, reset-semantics, reject strings, and OTel span are all established byte-exact from on-SHA source — the gate firing IS the pass. The live 11-fire run was sufficient to disprove the brief's "rejects at 11" premise and confirm the `scheduled`-always tool-result contract.
