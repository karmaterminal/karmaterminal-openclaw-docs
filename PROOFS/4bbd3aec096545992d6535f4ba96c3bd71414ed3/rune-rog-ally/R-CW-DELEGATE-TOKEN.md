# R-CW-DELEGATE-TOKEN — `CONTINUE_WORK:N` bracket-half from inside a continue_delegate child (#952/#959)

**SHA (deployed):** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Seat:** rune-rog-ally · **Owner:** 🪨 Rune
**Verdict:** ✅ PASS (corrected — see "Test-method correction" below; the first attempt was a malformed-bracket test-error, NOT a deployed-binary gap)

## ⚠️ WORKING-SYNTAX PRECONDITION (per frond's `1514268xxx` request — document so the row is reproducible)
The `CONTINUE_WORK:N` bracket-half fires ONLY when the marker is **bare + end-anchored**:
- ✅ `CONTINUE_WORK` (bare, at end of response-text) — fires
- ✅ `CONTINUE_WORK:30` (digits after colon, at end) — fires
- ❌ `[[CONTINUE_WORK: <prose> ]]` (prose after colon, or `[[...]]`-wrapped, or anything trailing) — does NOT fire (`bracketIdx=-1`)

The regex is `/\bCONTINUE_WORK(?::(\d+))?\s*$/` (`tokens.ts:539`): `CONTINUE_WORK` optionally `+:<digits>`, **anchored to end-of-text** (`\s*$`). Emit it as the bare last line of the model's response-text — NOT wrapped in `[[...]]`, NOT inside a `message`-tool body (that bypasses the parser), NOT followed by prose. A malformed marker is correctly rejected by the parser (this is by-design, not a bug). My first GAP-call was a malformed-marker test-error; the corrected bare end-anchored form passes.
**Fired:** 2026-06-10 ~05:56 PDT (LIVE on deployed gateway `OpenClaw 2026.6.2 (4bbd3ae)`)

## Behavior under test
The #952/#959 bracket-half, frond-flagged as "the most important single row in the corpus, the one the corpus never covered": a **lightContext continue_delegate child** emits a `CONTINUE_WORK:N` continuation marker in its response-text → a **hop-2 continue_work continuation** must fire LIVE non-mocked from inside the delegate-child. For leaf subagents the tool is denied, so the bracket is the ONLY continuation path (`signal.ts:78-80`: *"Critical for subagent chain-hops where the bracket is the ONLY continuation path (tool is denied for leaf subagents)"*).

## ✅ PASS — byte-confirmed via gateway continuation:trace
Re-fired a lightContext continue_delegate child instructed to emit a correctly-formed `CONTINUE_WORK:30` as the bare, end-anchored final line of its response-text. Dispatch traceparent: `e1292d32ffc20ee9a1755cf91e5d4505`; child session `agent:main:subagent:continuation-edc37e855cdc696d91b2b599c49c0542`.

**Child emitted the marker** (verbatim from child result):
```
R-CW-DELEGATE-TOKEN-v2 child on 4bbd3aec096 ... emitting CORRECTLY-FORMED CONTINUE_WORK:30 for hop-2
session-key agent:main:subagent:continuation-edc37e855cdc696d91b2b599c49c0542, lightContext-confirmed
CONTINUE_WORK:30
```
(`CONTINUE_WORK:30` as the bare final line, lightContext-confirmed.)

**Gateway parser DETECTED it + drove hop-2** (continuation:trace log, child session, 05:56:08 PDT):
```
payload-scan: count=1 bracketIdx=0 [0]text=true          ← bracket DETECTED at idx 0
bracket-parse: kind=work delayMs=30000                    ← parsed as continue_work, :30 delay honored
effective-signal: origin=bracket kind=work                ← signal extracted FROM THE BRACKET
work-hedge-armed fireIn=29999ms                           ← hop-2 continue_work ARMED to fire
```

**dispatch → child emits CONTINUE_WORK:30 → parser detects (bracketIdx=0) → kind=work extracted → hop-2 work-hedge-armed** — the bracket-half drove a live hop-2 continue_work continuation from inside the lightContext delegate-child on the deployed binary. **#952/#959 is COVERED on `4bbd3aec096`.**

## Test-method correction (honest-negative → corrected PASS)
**First attempt was a TEST-ERROR, not a gap.** Initial fire used `[[CONTINUE_WORK: R-CW-DELEGATE-TOKEN hop-2 proof-fire... ]]` — **prose after the colon (not digits) and not end-anchored** (text + `]]` followed). The regex (`tokens.ts:539`) is `/\bCONTINUE_WORK(?::(\d+))?\s*$/` — it matches `CONTINUE_WORK` or `CONTINUE_WORK:<DIGITS>`, **end-anchored**. The malformed prose-after-colon correctly failed to match → `bracketIdx=-1, origin=none` → no hop-2. That was the parser working as designed against invalid syntax, NOT the bracket-half failing.

Caught by reading the regex before standing on the GAP-call (the discipline: byte-check the test-METHOD, not just the result). Re-fired with correct `CONTINUE_WORK:30` syntax → PASS. The corpus avoided a false-negative on its most-important row.

Contrast at byte:
- malformed `[[CONTINUE_WORK: prose ]]` → `bracketIdx=-1, origin=none` → no hop-2 (test-error)
- correct bare `CONTINUE_WORK:30` end-anchored → `bracketIdx=0, kind=work, work-hedge-armed` → hop-2 fires (PASS)

## Verdict: ✅ PASS on `4bbd3aec096`
The #952/#959 bracket-half works: a correctly-formed `CONTINUE_WORK:N` emitted from inside a lightContext continue_delegate child IS parsed and DOES drive a hop-2 continue_work continuation. Byte-confirmed via gateway parser log, not inferred. The format requirement: bare `CONTINUE_WORK` or `CONTINUE_WORK:<digits>`, end-anchored (no prose after the colon, nothing trailing).
