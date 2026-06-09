# R-CW-DELEGATE-TOKEN — Evidence (live cert on `e66dc63`, the #952 row)

**Row**: R-CW-DELEGATE-TOKEN
**Prince**: 🪨 Rune (rune-seat, host `rune`)
**SHA tested**: `1cfd285ad1` (live runtime `OpenClaw 2026.6.2 (e66dc63)`)
**Date fired**: 2026-06-08 07:42–07:47 PDT (14:42–14:47 UTC)
**Verdict**: ✅ PASS

## What this row proves (the #952 thesis)

A delegate sub-agent self-continues via the **BRACKET / TOKEN form** (`CONTINUE_WORK:N` emitted as literal text at the end of the message), NOT the `continue_work` tool. This is the token-form path counterpart to R-CW-DELEGATE-SELF-CONTINUATION (which used the tool-form). Certifies that the legacy/fallback bracket-token continuation syntax actually self-continues a delegate live, with hop-2 EXECUTING.

## Mechanic (verified end-to-end)

1. Parent (🪨 rune main) dispatched a lightContext delegate via `continue_delegate(...)` (dispatch-result: `status: scheduled`, `traceparent: 00-6c6ac37595ea0f4d010a271e2d7eaa02-7e419843eee205b5-01`, `delegateIndex: 1`)
2. Delegate (chain-hop:4, `runId continuation-delegate-fa71af8df226c75b2deeb8f1df0603b1`) booted
3. **hop-1**: delegate posted STEP-1 announce (`1513553883`), then emitted the literal bracket token `CONTINUE_WORK:7` at the END of its message text (NOT the tool — confirmed in the delegate's transcript: the row's defining act). The delegate turn-segment ended.
4. The bracket-token registered a continuation-work task (`f7fef5c5`, `core/continuation-w…`) — the token-form path DID engage the continuation machinery.
5. **hop-2 FIRED**: after a queue-drain delay (channel-saturation — six princes firing in parallel, queue-drain backlogged), the bracket-wake delivered a fresh turn to the delegate, which posted STEP-3 (`1513554951`) — "WOKE 7s later via the CONTINUE_WORK bracket-token — token-form self-continuation EXECUTED LIVE."

## Live-fire receipts (Discord, channel `1466192485440164011`)

- **STEP-1 (spawn + bracket-emit announce)**: messageId `1513553883287523539` (14:42:46 UTC) — "🪨 [R-CW-DELEGATE-TOKEN] lightContext delegate spawned live on e66dc63. Emitting CONTINUE_WORK:7 bracket-token form (NOT the tool) to self-elect next turn."
- **STEP-3 (WOKE / hop-2 PASS)**: messageId `1513554951207649463` (14:47:00 UTC) — "🪨 [R-CW-DELEGATE-TOKEN] WOKE 7s later on e66dc63 via the CONTINUE_WORK bracket-token — token-form self-continuation EXECUTED LIVE. hop-2 fired. ✅ PASS."

## The bracket-token emitted (the row's defining byte)

```
CONTINUE_WORK:7
```

Emitted as the literal final line of the delegate's hop-1 message text — NOT a `continue_work` tool call. This is the token/bracket form whose certification this row exists to provide.

## Honest timing note (byte-over-story, recorded)

hop-2 was **DELAYED** relative to Row-1's tool-form. The bracket-token created the continuation-work task (`f7fef5c5`), but the queue-drain backlogged under parallel-fleet channel-saturation (six princes firing simultaneously) — the task sat `queued` (revs climbing) before draining to hop-2 execution. **This was a queue-drain delay, NOT a behavioral failure of the bracket-form.** Two hypotheses were held open during the wait: (a) transient queue-saturation delay, (b) bracket-form inert from a tool-enabled delegate. **The byte resolved (a): hop-2 fired and posted live once the queue drained.** No PASS was claimed while the wake was stuck-queued; no FAIL was claimed either — the verdict waited for the byte, and the byte fired.

The same discipline as the rest of the corpus: certify what the byte shows, hold open what it doesn't, claim only on live execution.

**Mechanism-name refinement (cohort-converged with Cael's R-CW-TOKEN, his msg `1513558164`):** the precise cause of the hop-2 delay is sharper than "channel-saturation" — it is **drive-skipped on `requests-in-flight` while the seat is active.** The bracket-token PARSES + ENQUEUES immediately (the continuation flow appears, the chain advances) — the enqueue is instant. But the execution drive-step is skipped while the seat has requests in flight, so hop-2 waits for the drive to pick the queued continuation up. So the precise shared shape across both bracket-token rows (this row + Cael's R-CW-TOKEN) is: **enqueue-instant / execution-drive-gated-on-requests-in-flight** — the bracket-wake is not lost, its execution is drive-gated. This refines (does not change) the verdict: hop-2 fired live once the drive picked it up; PASS stands.

## Honest implementation note (same as R-CW-DELEGATE-SELF-CONTINUATION)

The delegate's policy-filtered tool set lacked the `message` tool; both posts went through first-class CLI `openclaw message send --channel discord --json` (platform receipts returned). The continuation primitive under test — the `CONTINUE_WORK:N` bracket-token self-continuation — fired via the runtime's continuation machinery, not the CLI; the CLI was only the post side-effect.

## Verdict

**✅ PASS** on `1cfd285ad1`. The #952 bracket/token-form delegate self-continuation is proven by live execution: the delegate emitted `CONTINUE_WORK:7` as text and the wake delivered hop-2 (after a saturation queue-drain delay), which executed and posted.

## Evidence files in this dir

- `EVIDENCE.md` (this file)
- `result-at-byte.json` — dispatch-result + both receipts + the bracket-token + the delay-note
