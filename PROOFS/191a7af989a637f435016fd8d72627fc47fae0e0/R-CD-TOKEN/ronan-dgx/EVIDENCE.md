# R-CD-TOKEN — `[[CONTINUE_DELEGATE: ...]]` bracket-token surface

**Verdict:** ✅ PASS

**Assembly SHA under proof:** `191a7af989a637f435016fd8d72627fc47fae0e0`
**Seat:** `ronan-dgx` (host=ronan, aarch64)
**Runtime:** OpenClaw 2026.6.10 (191a7af)
**Date:** 2026-06-27 (Sat, 10:36 PDT)
**Turn trace:** `cc7d13d9c0dd444212f7bff9971d5035`

## Proof statement

R-CD-TOKEN PASS: bracket-token surface `[[CONTINUE_DELEGATE: ...]]` emitted in subagent final-text → `payload-scan bracketIdx=0 [0]text=true` → `bracket-parse: kind=delegate` → `effective-signal: origin=bracket kind=delegate` → spawned chain delegate 8/200 → grandchild returned `R-CD-TOKEN GRANDCHILD: bracket-token-fired-positive on 191a7af989, runtime=arm64` with SHA-verify. The bracket-token continuation-surface is alive on 191a7af989.

## What's distinctive about the bracket-token surface

The continuation system supports TWO equivalent signal surfaces:
- **Tool-call**: `continue_delegate(...)` invocation (covered by R-CD-1/2/3/4).
- **Bracket-token**: A terminal `[[CONTINUE_DELEGATE: ...]]` literal in the agent's final-text payload, parsed by the `continuation/signal` scanner.

R-CD-TOKEN proves the bracket-token surface by causing a SUBAGENT (whose final-text is scanned by the gateway) to emit the bracket as the terminal element of its response. The grandchild-spawn is the byte-evidence that the scanner fired.

## How the fire was arranged

This dispatcher's main-channel final-text routes through the message-tool body (`message(action=send)`) for visible-reply policy, so the bracket-scanner's `\s*$` end-of-payload anchor is empty-payload-skipped from THIS seat. The bracket fires cleanly from a **subagent emission surface** where final-text IS scanned.

A `continue_delegate(mode=normal, model=gpt-5.5)` was used to spawn a depth-1 subagent (`continuation-a799f4897152d45c7ee94599e52687b1`) whose explicit instruction was to:
1. Do its body work (SHA-verify).
2. Emit ONE terminal line: `[[CONTINUE_DELEGATE: ... | silent]]` with whitespace-only after `]]` (NO glyph sign-off, NO prose after — the bracket-fire is position-anchored).

## Bracket-fire trace (gateway journal)

```
10:36:44.571 [continuation/signal] [continuation:trace] payload-scan: count=1 bracketIdx=0 [0]text=true session=agent:main:subagent:continuation-a799f4897152d45c7ee94599e52687b1
10:36:44.572 [continuation/signal] [continuation:trace] bracket-parse: kind=delegate delayMs=default session=agent:main:subagent:continuation-a799f4897152d45c7ee94599e52687b1
10:36:44.572 [continuation/signal] [continuation:trace] effective-signal: origin=bracket kind=delegate session=agent:main:subagent:continuation-a799f4897152d45c7ee94599e52687b1
10:36:44.599 Firing bracket-token R-CD-TOKEN on 191a7af989 (OpenClaw 2026.6.10 191a7af; host ronan; runtime aarch64).
            [[CONTINUE_DELEGATE: R-CD-TOKEN GRANDCHILD on 191a7af989 fired via bracket-token. SHA-verify and return: 'R-CD-TOKEN GRANDCHILD: bracket-token-fired-positive on 191a7af989, runtime=arm64.' | silent]]
10:36:45.293 [subagent-chain-hop] Spawned chain delegate (8/200) from agent:main:subagent:continuation-a799f4897152d45c7ee94599e52687b1: R-CD-TOKEN GRANDCHILD on 191a7af989 fired via bracket-token...
10:36:54.091 R-CD-TOKEN GRANDCHILD: bracket-token-fired-positive on 191a7af989, runtime=arm64.
            Verified:
            - `~/flesh_beast_tmp/openclaw` HEAD short SHA: `191a7af989`
            - Full SHA: `191a7af989a637f435016fd8d72627fc47fae0e0`
            - Machine arch: `aarch64` (arm64)
```

## Discriminating bytes

- `bracketIdx=0` ← the scanner found the bracket at index-0 of the payload's terminal-region (whitespace-only after `]]`).
- `origin=bracket` ← effective-signal source is the bracket, NOT a tool-call.
- `kind=delegate` ← the bracket parsed as CONTINUE_DELEGATE (not CONTINUE_WORK).
- `[subagent-chain-hop] Spawned chain delegate (8/200) from <subagent>...` ← the grandchild was spawned BY the bracket-fire (different code path than tool-call-fired chain delegates).
- The grandchild's return confirms SHA `191a7af989` ← grandchild was running on the build under proof.

## Round-trip artifacts

- **Dispatching subagent**: `agent:main:subagent:continuation-a799f4897152d45c7ee94599e52687b1` (gpt-5.5, 16s, 32k tokens)
- **Spawned grandchild via bracket**: `agent:main:subagent:82d5a118-01e1-4f01-ad97-94b0a9c5be0f` (chain-hop:8, 8.6s, 32k tokens)
- **Grandchild return**: SHA-verify confirms 191a7af989a637f435016fd8d72627fc47fae0e0 on host=ronan arch=aarch64
- **Delivery surface**: `silent` (the grandchild's return was silent enrichment, consistent with the `| silent` modifier in the bracket)

## Files

- `fire_response.json` — tool response for the dispatching subagent
- `journal.log` — gateway journal slice covering bracket-parse + chain-hop + grandchild lifecycle
- `turn_trace.json` — full Tempo trace for the dispatching turn

## Field note

This is the bracket-token equivalent of a tool-call `continue_delegate`. It proves the signal-scanner's bracket surface is alive on this build. The position-anchoring (terminal `]]` with whitespace-only-after) is enforced by `\s*$` regex — a glyph sign-off or trailing prose after `]]` would yield `bracketIdx=-1` (no fire). The subagent obeyed the position constraint precisely.
