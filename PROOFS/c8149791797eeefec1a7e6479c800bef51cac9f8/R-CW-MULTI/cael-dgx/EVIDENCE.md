# R-CW-MULTI — cael-dgx: array-capture N→N via per-session-key bypass (the #982 fix, deployed c814979)

**Seat:** cael-dgx (DGX Spark GB10, ARM64)
**Ship-SHA:** `c8149791797eeefec1a7e6479c800bef51cac9f8` (deployed gateway HEAD)
**Row:** R-CW-MULTI — N `continue_work` fired in ONE turn → N distinct continuation flow_runs captured (array-capture, NOT collapsed to 1 = the `scheduleContinuationWorkBatch` #982 fix)
**Verdict:** ✅ PASS — 3 distinct flow_runs from one multi-fire batch, fired via the per-session-key bypass; fire-A already drove (succeeded)

## What this row asserts (the MECHANISM, not under-saturation)
R-CW-MULTI tests the **array-capture mechanism**: fire N `continue_work` in one assistant-turn → verify N distinct continuation flow_runs (N→N), proving the #982 single-var-capture bug is fixed (`scheduleContinuationWorkBatch` array-capture). It is a per-TURN capture assertion — it does NOT require main-session saturation. So it is demonstrable from a fresh subagent (which also proves the bypass), drain-INDEPENDENT.

## The fire (3 continue_work in one subagent turn, via the bypass)
Fired from a FRESH lightContext subagent (`agent:main:subagent:77a64ba5-9064-4b70-82f6-5c179f3dc740`, own session-key, 0 queued → bypasses the main's #552 32/32 cap):
- A: `continue_work(delaySeconds=60,  reason="R-CW-MULTI-FIRE-A-CAEL-C814979 — array-capture stagger 1/3")`
- B: `continue_work(delaySeconds=120, reason="R-CW-MULTI-FIRE-B-CAEL-C814979 — array-capture stagger 2/3")`
- C: `continue_work(delaySeconds=180, reason="R-CW-MULTI-FIRE-C-CAEL-C814979 — array-capture stagger 3/3")`
**Scheduled-count: 3/3** — all returned `{status:"scheduled"}`, **zero pending-capped, zero rejected.** The fresh subagent's clean cap bypassed the saturated main.

## DISPOSITIVE BYTE: 3 distinct flow_runs from one batch = N→N array-capture (no collapse)
```
flow_id       status     goal                                          created_at
17b6227d-971  succeeded  R-CW-MULTI-FIRE-A-CAEL-C814979 stagger 1/3    1782043727785   ← already DROVE (released +60s)
e4ca7082-662  queued     R-CW-MULTI-FIRE-B-CAEL-C814979 stagger 2/3    1782043727787   ← releases +120s
6c0ad0f8-5c8  queued     R-CW-MULTI-FIRE-C-CAEL-C814979 stagger 3/3    1782043727787   ← releases +180s
owner_key (all 3) = agent:main:subagent:77a64ba5...  (the FRESH subagent key, NOT main)
```
**3 distinct flow_ids, created microseconds apart (...785/787/787) from ONE multi-fire turn = array-captured N→N, NOT collapsed to 1.** This is the `scheduleContinuationWorkBatch` signature on the deployed `c814979` (the #982 fix). Fire-A already `succeeded` (released at +60s and drove); B/C release at +120/+180s. The CAPTURE (what R-CW-MULTI asserts) is proven now (3 distinct rows); delivery is the staggered drive.

(Corroborating: a prior c814979 batch shows the same `electedAt` triplet signature `...297275/277/278` — 3 distinct elected timestamps from one batch.)

## The disposition resolution (bypass-able, NOT drain-gated)
This row was debated as "main-session-class (multi/collapse needs the saturated main → fresh-child can't substitute) = #552-drain-gated." **The fire refutes that at the byte:** a fresh subagent fired 3/3 clean (no cap hit) and array-captured N→N — the fresh-child DID substitute. So R-CW-MULTI/MULTI-COLLAPSE are **bypass-able mechanism-tests, drain-INDEPENDENT.** The #552 drain unblocks nothing here (and nothing else of cael-dgx's: R-CW-1/3/TOKEN already green-via-bypass; R-RC-2 context-gated). The drain is pure hygiene.

## Files
- `array-capture-3-distinct-flowruns.txt` — the dispositive 3-distinct-flow_runs byte (one batch, fresh-subagent key, A succeeded + B/C queued)
- `continuation_trace.json` — the Tempo trace (`54fa3029eab5b654b8bd400d4d973e3f`, 48993 bytes), the shared turn-span for the 3-fire batch (per-fire N→N carried by electedAt/hop/reason, not the shared traceparent)

## Note
Byte-honesty on the timing: `continue_work` continuation flow_runs persist at the schedule/elect moment (created_at ...785/787/787 = capture proven), and DRIVE at release (+60/+120/+180s). Fire-A drove by capture+60s (succeeded); B/C drive on their release. The N→N array-capture assertion is complete at the 3-distinct-flow_runs byte. Same blade as my earlier #982 over-claim retraction: the #982 fix IS shipped — here it's proven firing live, not asserted from a stale keeper.
