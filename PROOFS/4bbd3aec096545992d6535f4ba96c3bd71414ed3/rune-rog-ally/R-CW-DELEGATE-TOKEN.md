# R-CW-DELEGATE-TOKEN — `[[CONTINUE_WORK:N]]` bracket-half from inside a continue_delegate child (#952/#959)

**SHA (deployed):** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Seat:** rune-rog-ally · **Owner:** 🪨 Rune
**Verdict:** ❌ GAP (honest-negative — the bracket-half does NOT fire on the deployed binary)
**Fired:** 2026-06-10 ~05:49 PDT (LIVE on deployed gateway `OpenClaw 2026.6.2 (4bbd3ae)`)

## Behavior under test
The #952/#959 bracket-half, described by frond as "the most important single row in the corpus, the one the corpus never covered": a **lightContext continue_delegate child** emits `[[CONTINUE_WORK:N]]` in its response-text → a **hop-2 continue_work continuation** must fire LIVE non-mocked from inside the delegate-child (the child's jsonl should carry a hop-2 turn).

## Test method (live fire on deployed binary)
Dispatched `continue_delegate(mode="silent-wake")` with a lightContext child instructed to:
1. confirm it's running lightContext on `4bbd3aec096`
2. emit the literal `[[CONTINUE_WORK:...]]` bracket as PLAIN PROSE in its final response-text (NOT inside a message-tool call — so the continuation-parser at `agent-runner-execution.ts:2087` processes the response-payload)

Dispatch traceparent: `d6b1a7d514fbaef60fde2364f9754e03`.

## Result: GAP — bracket emitted but NOT parsed, hop-2 did NOT fire

**The child DID emit the literal bracket** (verbatim from its session jsonl `6eed04a4-…`):
```
[[CONTINUE_WORK: R-CW-DELEGATE-TOKEN hop-2 proof-fire on 4bbd3aec096 — bracket-half from inside continue_delegate child]]
```
Child confirmed: `lightContext: confirmed — banner carries the light bootstrap context shape`, session-key `agent:main:subagent:continuation-f151324bbe265fed337790ca0f19610a`.

**But the gateway continuation-parser did NOT detect the bracket.** Gateway log for the child session (05:50:01 PDT):
```
[continuation:trace] payload-scan: count=1 bracketIdx=-1 [0]text=true session=…continuation-f151324…
[continuation:trace] effective-signal: origin=none kind=none session=…continuation-f151324…
```
- `[0]text=true` — the payload HAS text (the bracket is present in it)
- **`bracketIdx=-1`** — the parser scanned and found NO bracket-pattern match
- **`origin=none kind=none`** — NO continuation signal extracted

**Subagent completion confirms no hop-2**: the child returned via normal silent-wake subagent-completion ("completed; ready for parent review", runtime 5s, 229 tokens) — a single turn, NO hop-2 continuation turn in its jsonl. The `[[CONTINUE_WORK:N]]` from inside the delegate-child drove nothing.

## Verdict: ❌ GAP on `4bbd3aec096`
The bracket-half does NOT work from inside a continue_delegate lightContext child. The `[[CONTINUE_WORK:N]]` emitted in a delegate-child's response-text is not parsed (`bracketIdx=-1`), so the hop-2 continuation does not execute. **#952/#959 is still UNCOVERED on the deployed binary** — confirmed at the byte (gateway parser log), not inferred.

## Honest scope (why `bracketIdx=-1` — needs one more byte to fully root-cause)
`bracketIdx=-1` means the payload-scan didn't find the bracket-pattern. Two candidate causes, not yet disambiguated:
- (a) the bracket-parser does not run / is disabled on lightContext or delegate-child payloads, OR
- (b) the child's response-payload shape differs from a main-session response such that the bracket-regex misses it (e.g. the bracket landed in a payload-block the scan doesn't cover).
No `bracketIdx>=0` was observed anywhere in the test window, suggesting bracket-detection has a payload-shape precondition the lightContext-child output does not meet. Either way the row as-tested is a GAP; the precise root-cause (a vs b) is the follow-up byte.

## Contrast with what DOES work (same cycle, rune-seat)
- R-CW-DELEGATE-SELF-CONTINUATION ✅ — `continue_delegate` self-continuation (tool-form) fires + the delegate spawns/execs/returns.
- The bracket-form `continue_delegate` (R-CD-TOKEN, cael+silas seats) fires when the bracket is in a MAIN-session response-text.
- What FAILS here is specifically the bracket from inside a *lightContext continue_delegate CHILD* driving hop-2 — the #952 recursive-bracket-half. That specific path is the gap.
