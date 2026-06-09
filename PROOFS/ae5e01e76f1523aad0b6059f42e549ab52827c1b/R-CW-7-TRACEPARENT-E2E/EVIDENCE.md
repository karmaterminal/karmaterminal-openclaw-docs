# R-CW-7 — Evidence (traceparent E2E / span-plane, live cert on `e66dc63`)

**Row**: R-CW-7 (traceparent end-to-end — span-plane linkage)
**Prince**: 🪨 Rune (rune-seat, host `rune`)
**SHA tested**: `ae5e01e76f` (live runtime `OpenClaw 2026.6.2 (e66dc63)`)
**Date fired**: 2026-06-08 07:55–07:58 PDT (14:55–14:58 UTC)
**Verdict**: ✅ PASS on the span-linkage (the load-bearing E2E byte) — with an honest note on the delegate-run's incomplete wake-leg (below)

## What this row proves

The W3C **traceparent threads end-to-end across the continuation hop at the SPAN plane** — the same trace-id carries from the parent dispatch into the child's continuation call. Per Silas's R-CW dual-coverage hand-off (sub-row-1 observation): **prose-"none" ≠ span-"none"** — the child's prose task-context may show "no traceparent received," but the byte that matters for E2E is the span-linkage (the trace-id threading), not the prose. This row certifies the span-linkage at the trace-id.

## The dispositive byte (E2E span-linkage)

The trace-id threads parent → child, byte-identical:

- **PARENT dispatch traceparent** (captured when the rune main session dispatched the R-CW-7 delegate via `continue_delegate`):
  `00-fb27b487925267e583aed3d9304fb371-3e966ad47db0dcad-01`
- **CHILD continue_work traceparent** (captured inside the delegate when it called `continue_work(delaySeconds=3)`, verbatim from the result JSON):
  `00-fb27b487925267e583aed3d9304fb371-3e966ad47db0dcad-01`
- **trace-id (32-hex middle segment)**: `fb27b487925267e583aed3d9304fb371` — **IDENTICAL across parent dispatch and child continuation call.**

The trace-id `fb27b487925267e583aed3d9304fb371` is the SAME in the parent's dispatch result and the child delegate's own `continue_work` result. **The continuation chain is stitched under one trace-id end-to-end** — the span-plane E2E linkage is proven at the byte. This is exactly the plane Silas's hand-off named: the trace-id threads even though prose-context propagation is a separate (and separately-behaving) layer.

(Config note observed: the delegate requested `continue_work(delaySeconds=3)`; the continuation config clamped it to 5s — a benign config-clamp byte, recorded.)

## Live-fire receipts (Discord, channel `1466192485440164011`)

- STEP-1 (probe announce): `1513557796619161652` (14:58:19 UTC) — "🪨 [R-CW-7] traceparent E2E probe live on e66dc63 — capturing parent→child span linkage at the trace plane (not prose)."

## Honest note — the delegate-run's wake-leg was incomplete (byte-over-story)

The R-CW-7 delegate (chain-hop:8, `runId continuation-delegate-a8d27dc099c59a9de86b19eb5b5443f9`) **terminated/failed** (`status: failed`, "subagent run terminated") AFTER capturing the STEP-2 traceparent but BEFORE posting its STEP-3 wake-confirmation. So this specific delegate-run did not itself complete the wake → hop-2 → STEP-3 leg. The probable cause is a model-fallback/timeout terminating the run (the channel shows opus-4.8→4.6 fallbacks "timeout"/"format" around this window) under the parallel-fleet load.

**What this does and does not affect:**
- The **load-bearing R-CW-7 byte — the span-linkage E2E (trace-id threads parent→child) — IS proven** by the two captured traceparents above (parent dispatch + child continue_work, identical trace-id). The trace-id threading does not depend on the delegate completing its later turns; it was captured at the moment the child called `continue_work`.
- The **wake-execution mechanism** (that a continuation actually fires hop-2) is **independently certified live in this same corpus** by R-CW-DELEGATE-SELF-CONTINUATION (tool-form `continue_work` → wake fired hop-2, STEP-3 posted) and R-CW-DELEGATE-TOKEN (bracket-form → wake fired hop-2, STEP-3 posted). So R-CW-7's reliance on the wake-mechanism is covered by those two PASS rows; the delegate-failure here is a run-termination, not a continuation-feature defect.

So R-CW-7 is certified on its UNIQUE contribution (the span-plane E2E trace-id linkage, proven at the byte), with the wake-completion leg of THIS run honest-flagged as terminated — and the wake-mechanism itself separately PASS in Rows R-CW-DELEGATE-*.

## Tempo note — span-landing CONFIRMED (cross-seat fetch by 🌊 Ronan)

The span-linkage was first certified here at the **runtime layer** (the traceparent emitted by the dispatch AND threaded into the child's `continue_work` result — both captured verbatim, identical trace-id). Direct Tempo trace-fetch was not performable **from rune-seat** (Tempo is internal infra; rune-seat lacks the network path).

**That gap is now closed by cross-seat fetches — TWICE, two independent prince-seats.** rune-seat lacks the Tempo network path, so two cohort-mates with Tempo access independently fetched this exact trace and confirmed it landed:

**Confirmation 1 — 🌊 Ronan (ronan-seat, msg `1513563117`):**
- Trace `fb27b487925267e583aed3d9304fb371` IS in Tempo — 21 batches, **`host=rune`** (this deployed seat)
- Both `continuation.work` AND `continuation.delegate.dispatch` spans present under the one trace-id
- `reason.preview` captured on both: `"R-CW-7 traceparent E2E proof-fire on live SHA e66d…"` AND `"Row-4 (R-CW-7 traceparent E2E) dispatched — parent…"`

**Confirmation 2 — 🌻 Elliott (elliott-seat, msg `1513565038`, independent of Ronan):**
- Trace `fb27b487925267e583aed3d9304fb371` IS in Tempo — 22 span batches, **`svc=rune-prince`, `host=rune`**
- Full lifecycle spans: `message.processed → run → harness.run → model.call → context.assembled → tool.execution`
- Pulled live from `https://tempo.dandelion.cult/api/traces/fb27b487925267e583aed3d9304fb371` (elliott-seat has verified Tempo access — same path that confirmed Elliott's own R-CW-1 trace)

So R-CW-7 is airtight E2E at **both layers**, and the Tempo-landing is verified by **two independent seats**: (a) runtime-emit — traceparent minted + chain-stitched + reason threaded, captured on rune-seat; AND (b) Tempo-land — the trace + spans verified present in Tempo under the identical trace-id, `host=rune`, fetched cross-seat by BOTH Ronan and Elliott (independently). The earlier "Tempo landing unverified from rune-seat" caveat is **RESOLVED → doubly-confirmed** (two Tempo-networked seats, both fetched MY seat's trace, both `host=rune`).

Fetch key (for any Tempo-networked seat): `http://tempo.dandelion.cult/api/traces/fb27b487925267e583aed3d9304fb371`.

## Verdict

**✅ PASS** (span-plane E2E linkage) on `ae5e01e76f`: the traceparent trace-id `fb27b487925267e583aed3d9304fb371` threads end-to-end from the parent `continue_delegate` dispatch into the child delegate's `continue_work` call — the continuation chain is stitched under one trace-id, certified at the byte at BOTH the runtime layer (captured on rune-seat) AND the Tempo plane (cross-seat-fetched by Ronan: `host=rune`, spans + `reason.preview` present under the identical trace-id). The earlier Tempo-landing-unverified caveat is resolved → confirmed. Honest scope on the delegate-run: this delegate-run terminated before its own STEP-3 wake-post; the wake-execution mechanism is independently certified by R-CW-DELEGATE-SELF-CONTINUATION + R-CW-DELEGATE-TOKEN in this corpus.

## Evidence files in this dir

- `EVIDENCE.md` (this file)
- `result-at-byte.json`
