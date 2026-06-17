# R-CW-DELEGATE-SELF-CONTINUATION — elliott-seat — BOTH-FORMS proof (#952 token-parse path)

**CANDIDATE_SHA (ship-tip):** `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6`
**Seat:** elliott (Lenovo Legion, Ryzen 9 5900HX, RTX 3080, CachyOS, x86_64) — runtime `OpenClaw 2026.6.8 (8cafdcd)`, host=elliott, HEAD=`8cafdcd2a9d2…` (live ship-tip; fresh fire per cael's keeper — stale-session traceparents age out of Tempo).
**Coordinated with:** 🌊 Ronan's R-CD-TOKEN (two seats proving the token-parse path on `8cafdcd` = the #952-escape coverage).

---

## The both-forms mandate (figs 2026-06-07, post-#952)

Each `continue_*` continuation primitive has TWO code paths that must both be proven:
- **TOOL form** — `continue_delegate(...)` the tool. (My tool-form proof: `../../elliott-seat/RECEIPT.md` + `proof_fire_continue_delegate_trace.json`, committed `77c03a1`, 26 spans.)
- **BRACKET/TOKEN form** — `[[CONTINUE_DELEGATE: ...]]` parsed from the assistant response via `tokens.ts:parseContinuationSignal`. **This is the path #952 escaped on** — a tool-only proof is structurally blind to it.

**This file = the BRACKET-form half**, completing both-forms coverage for elliott-seat's R-CW-DELEGATE-SELF-CONTINUATION row.

---

## Bracket-form fire — PASS on `8cafdcd` (token-parse path, origin=bracket)

Fired `[[CONTINUE_DELEGATE: ...]]` at the close of an assistant turn on the live `8cafdcd` runtime. The gateway journal confirms the **token-parse path** fired (NOT the tool path):

```
[continuation:trace] payload-scan: count=1 bracketIdx=0 [0]text=true session=agent:main:discord:channel:1466192485440164011
[continuation:trace] bracket-parse: kind=delegate delayMs=default session=...
[continuation:trace] effective-signal: origin=bracket kind=delegate session=...
elliott R-CW-DELEGATE bracket-form dispatched via token-parse on 8cafdcd   ← shard return (hop-2 ran)
[subagent-chain-hop] Accumulated 159 tokens from agent:main:subagent:478f7800-… to parent chain cost
```

- **`origin=bracket kind=delegate`** = the bracket-form signal fired via the token-parse path, NOT the tool. ✅
- **`bracketIdx=0`** = the bracket parsed at position 0 of the scanned payload. ✅
- **Shard dispatched → hop-2 executed → returned the proof line** = the bracket parsed AND dispatched a real continuation hop on the shipped bytes. ✅

**Tempo trace** (`bracket_form_dispatch_trace.json`): trace `dfc8451cb0bcf4b660d9ae1f1b0a0396`, 8994 bytes, 7 spans, host=elliott, carries the **`continuation.delegate.dispatch`** span. Pulled fresh from the ingress (`http://tempo.dandelion.cult/api/traces/<id>`) on the live `8cafdcd` runtime.

---

## #952-relevant finding: the bracket-form parse is POSITION-SENSITIVE (corrected 2026-06-17 ~04:10 PDT)

**CORRECTION of my own earlier cause-attribution** (after 🌫 Silas re-ran the exact shapes at the regex, `tokens.ts:491`). My first draft of this finding said "FORMAT-SENSITIVE: long/multi-line fails; fire compact + single-line." **That was the wrong cause — a confound.** My failing first-attempt was long/multi-line AND had a trailing sign-off after the `]]`; my working compact retry was short AND dropped the sign-off. I credited the **length** (the salient change) when the causal variable was the **terminal position**.

The byte: the regex `tokens.ts:491` is `/\[\[\s*CONTINUE_DELEGATE:\s*([\s\S]+?)\s*\]\]\s*$/` — **no `/m` flag**, so the trailing `\s*$` anchors to the end of the WHOLE response. Body is `[\s\S]` (the `:486` comment literally says multiline tasks are safe). Re-run on `8cafdcd`: long multi-line body + bracket TERMINAL → `bracketIdx=0` ✅; same long body + a trailing ` 🤝` → `bracketIdx=-1` ❌.

**The real rule: the `[[CONTINUE_DELEGATE:...]]` bracket must be the TERMINAL thing in the message — only whitespace after the closing `]]` (no glyph, no sign-off, no prose). Multi-line / long task bodies are SAFE.** Do NOT single-line a legitimately-multi-line task spec (e.g. R-CD-TOKEN); just keep the bracket last. The earlier "fire compact" advice treated a symptom (compacting also dropped the trailing chars) as the cause.

---

## Verdict

**R-CW-DELEGATE-SELF-CONTINUATION both-forms: ✅ PASS ship-current** on `8cafdcd`:
- TOOL form ✅ (`77c03a1`, 26 spans)
- BRACKET form ✅ (this file — `origin=bracket`, dispatched hop-2, `dfc8451c…` dispatch trace, 7 spans)

The #952 token-parse path is proven on the shipped bytes from elliott-seat. Cross-ref: 🌊 Ronan's R-CD-TOKEN (the lightContext-subagent bracket-only path) — two seats, both bracket-forms, the #952-escape coverage on `8cafdcd`.
