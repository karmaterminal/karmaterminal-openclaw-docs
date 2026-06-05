# R-CW-3 — continue_work reason-field in OTel span :: emeric-nuc (per-seat-sister cross-walk)

Seat: 🕯 Emeric / `emeric-nuc` (Intel NUC i7-12700H, 64GB, CachyOS x86_64)
Build: OpenClaw `2026.6.2` · dist build-info commit `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`
Date: 2026-06-05 ~12:37 PDT
Canonical-owner: 🩸 Cael (`R-CW-3/cael-dgx/`, PR #759 domain). This is the **emeric-nuc per-seat-sister
cross-walk** — emeric is the #898/#923 authoring-seat, best-positioned to empirically verify the
reason-field span-capture on its own seat at the candidate SHA (per README row-assignment).

## Contract (PR #759 domain)
The `continue_work` `reason` field is captured as an attribute on the `continuation.work` OTel span
emitted by the continuation-tracer at the runner-side accept seam. The attribute is `reason.preview`
— the first ≤80 chars of the reason, for operator readability (`continuation-tracer.ts:87-88`,
"First ≤80 chars of the tool-call `reason`").

## Instrumentation confirmed compiled into emeric's running dist (2807efc1c1e)
- `src/infra/continuation-tracer.ts:213-214` declares span names `"continuation.work"` +
  `"continuation.work.fire"`.
- `emitContinuationWorkSpan` (continuation-tracer.ts:480-518) starts the `continuation.work` span
  (L511) with attributes incl. `reason.preview` (L500-509: ≤80-char truncation of `args.reason`).
- `src/auto-reply/reply/agent-runner.ts:2947-2971` emits `continuation.work` at the accept seam,
  passing `reason: continuationWorkReason`.
- Compiled into the deployed dist: `dist/continuation-tracer-6cQSzFX5.js` contains both
  `continuation.work` and `continuation.work.fire` (grep-confirmed in the running install whose
  `build-info.json` commit = `2807efc1c1e…`, this dir).

## Test-pinned on-SHA (re-run on emeric's seat) — ✅ 5/5
```
pnpm vitest run src/auto-reply/reply/agent-runner.continuation-work-span.test.ts \
                src/auto-reply/continuation/trace-context-propagation.integration.test.ts
 ✓  trace-context-propagation.integration.test.ts (1 test) 51ms
 ✓  agent-runner.continuation-work-span.test.ts (4 tests) 1298ms
     ✓ emits exactly one `continuation.work` span on accepted WORK with UUID chain.id and clamped chain.step.remaining (1157ms)
 Test Files  2 passed (2)
      Tests  5 passed (5)
```
- `trace-context-propagation.integration.test.ts:221-225` — sets `reason: "continue traced work"`
  then asserts `expect(workSpan.name).toBe("continuation.work")`.
- `agent-runner.continuation-work-span.test.ts` — pins exactly-one `continuation.work` span on an
  accepted WORK turn, with UUID `chain.id` + clamped `chain.step.remaining` (and that rejected
  requests emit NO `continuation.work` span). Receipt: `workspan-tests.log` (this dir).

## Live Tempo proof — the `continuation.work` span + `reason.preview` lands in Tempo on-SHA
The continuation-tracer's span family is actively exporting to Grafana Tempo from the on-SHA fleet.
A live `continuation.work` span captured from Tempo (`continuation_work_span_exemplar_trace.json`,
this dir) shows the exact reason-bearing shape:
```json
"name": "continuation.work",
"attributes": [
  { "key": "delay.ms",              "value": { "intValue": "5000" } },
  { "key": "chain.step.remaining",  "value": { "intValue": "199" } },
  { "key": "chain.id",              "value": { "stringValue": "98177bf2-ce6d-46d8-b702-c4194c883639" } },
  { "key": "reason.preview",        "value": { "stringValue": "Dream rounds 1-40 complete. Continuing into rounds 41-80 — entering the deep ter" } }
]
```
This confirms the `reason` → `reason.preview` (≤80-char) span-attribute capture is live in the
Tempo export, not just compiled/tested. (This exemplar is a *fleet* `continuation.work` span on
`host.name=silas` captured 11:00:32 today on the same candidate SHA — cross-seat confirmation that
the span emits on-SHA fleet-wide. **Emeric's OWN first-party `continuation.work` span is captured
below** (`wake_event_trace.json`).)

### ⭐ Emeric's OWN `continuation.work` span — captured first-party from Tempo on-SHA
Forced + captured the direct proof: fired `continue_work` from emeric's **MAIN session** (reply-runner
path, see path-distinction below) with a distinctive marker, and the accepted wake emitted emeric's
own `continuation.work` span to Tempo — fetched by trace-id `f9e70029c5c050f7a0533039b8eb11c2`
(`wake_event_trace.json` + `wake_event_evidence.txt`, this dir):
```
host.name        = emeric
service.name     = fifth-prince
name             = continuation.work
chain.id         = 776a7d79-ef28-4ac5-81a8-2bf497d98761
reason.preview   = "RCW3-EMERIC-NUC-2807efc-MARKER :: capturing emeric-own continuation.work span re…"  (≤80-char truncation, live)
delay.ms         = 25000
chain.step.remaining = 198
```
This is the reason→`reason.preview` capture proven on **emeric's own seat, on the candidate SHA**,
from Tempo — the cael-dgx canonical bar met first-party, not by fleet-exemplar.

## emeric-nuc fire (this seat, this SHA) + byte-honest path-distinction finding
Fired `continue_work` on emeric's seat with a distinctive reason marker:
`reason = "RCW3-EMERIC-NUC-SPAN-CAPTURE-2807efc1c1e :: …"`.
Tool receipt: `{ status: scheduled, delaySeconds: 20, traceparent:
00-5b738a0ac4016bff5b223887334a63ce-5adb500b4041c560-01 }`. The wake FIRED — journal receipt
(`journal_continuation_fire.log`, this dir):
```
12:39:17 [agents/agent-command] [attempt-execution] continue_work timer fired for session agent:main:subagent:7d95ca0a-52ad-425b-b591-6df08bca7e43
```

**Honest substrate finding (byte-walked):** my fire ran as a *subagent*, so its continue_work timer
traversed the **agent-command / embedded execution path** (`src/agents/command/attempt-execution.ts:972`,
log string `[attempt-execution] continue_work timer fired`). The `emitContinuationWorkSpan` call that
emits the reason-bearing `continuation.work` span lives ONLY in the **channel reply-runner path**
(`src/auto-reply/reply/agent-runner.ts:2950`, log string `WORK timer fired`). `rg emitContinuationWorkSpan
src/agents/` returns EMPTY — the subagent path does not emit the work-span by design. So emeric's
subagent fire emitted `continuation.queue.drain` (captured: `emeric_continuation_queue_drain_trace.json`)
and `openclaw.harness.run`/`openclaw.exec` spans on the wake-turn, but NOT a `continuation.work` span.
This is architecturally correct (which code path a subagent's continue_work traverses), NOT a
regression — the #923 cure touches neither path's span instrumentation.

**Path-distinction completed (both arms now byte-captured on emeric's seat):**
- SUBAGENT-path fire (first attempt) → emitted `continuation.queue.drain` + `openclaw.exec`, NOT
  `continuation.work` (the agent-command path does not emit the work-span by design;
  `rg emitContinuationWorkSpan src/agents/` is empty). Captured: `emeric_continuation_queue_drain_trace.json`.
- MAIN/REPLY-RUNNER-path fire (this finalization) → emitted emeric's own `continuation.work` span
  with `reason.preview`, captured above (`wake_event_trace.json`). This is the seam at
  `agent-runner.ts:2950`.
So the reason-field-in-`continuation.work`-span behavior is proven **first-party on emeric's own
seat** via the captured span, AND the path-distinction is fully byte-walked (which code path a
continue_work traverses determines whether the work-span emits) — architectural, not a #923 regression.

### Bonus: live #923-cure surface cross-walk (same journal)
The same wake-turn journal shows the running gateway emitting the L627 partial-registration warn
— the *exact surface #923 cures* — live on-SHA, with the #923 remediation hint present:
```
12:41:55 [agents/openclaw-tools] continuation.enabled=true but neither continueWorkOpts nor
requestCompactionOpts were supplied — only continue_delegate will register. … (Inventory/catalog/
dispatch callers should pass inventoryOnly: true to suppress this warning — see karmaterminal/openclaw#923.)
```
This is the live runtime counterpart to R-REGRESSION-TRAP-TESTS: the #923-aware warn-text
(`inventoryOnly: true` hint) is compiled into and firing from the deployed candidate-SHA gateway.

## Verdict
✅ **PASS** — the `continue_work` reason → `continuation.work` span `reason.preview` attribute is
(1) byte-confirmed compiled into emeric's running dist at the candidate SHA
(`dist/continuation-tracer-6cQSzFX5.js`), (2) test-pinned 5/5 on emeric's seat
(`agent-runner.continuation-work-span.test.ts` + `trace-context-propagation.integration.test.ts`),
and (3) confirmed LIVE in the Tempo export with **emeric's OWN first-party `continuation.work` span**
— `host.name=emeric`, `service.name=fifth-prince`, carrying the distinctive marker as `reason.preview`,
captured by trace-id `f9e70029c5c050f7a0533039b8eb11c2` (`wake_event_trace.json`). emeric's main-session
continue_work wake was accepted at the reply-runner seam (`agent-runner.ts:2950`) → emitted the span.

**figs's config/method-vs-regression ambiguity — RESOLVED to category-1 (NOT a regression):**
- NOT category-2 (regression): `continuation.work` emits on the cured SHA, proven two ways — silas's
  fleet span at 11:00:32 today (`host=silas`) AND emeric's own span (this capture, `host=emeric`).
- NOT a broken emeric otel-config: emeric actively exports `continuation.queue.drain`, `openclaw.exec`,
  `openclaw.model.usage`, and now `continuation.work` to Tempo.
- It WAS category-1 (capture timing + path): the first fire ran the subagent path (no work-span by
  design) and ended before the wake; the main-session fire runs the reply-runner path and emitted +
  was captured. The path-distinction is architectural; the #923 cure (L627 inventory-warn suppression)
  is byte-disjoint from the continuation-tracer span instrumentation — no regression.
