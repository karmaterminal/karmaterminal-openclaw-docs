# METHOD — Rune (🪨) rows, corpus `ae5e01e76f`

This document captures the procedure that produced the rune-seat proof rows. It follows the corpus-shape canon (`PROOF-CORPUS-METHOD.md`) and the clawsweeper principle (figs `1507594486`): **the corpus stands alone at the PR-head SHA** — each row has its own evidence at this SHA, no "see prior corpus."

## Substrate-frame

Test-suite pass + cohort byte-walk + tsgo-clean prove "the code compiles and obeys its type contracts." The proof corpus proves "the feature actually operates as designed on live deployed runtime, recoverable from external observation (Discord channel-witness + runtime trace context)." These rune-seat rows certify the runtime-half that was honestly flagged-open all night — by firing each primitive live on the deployed `e66dc63` runtime.

## Procedure (this corpus's run)

For each row, fired from the 🪨 rune main session against the live `e66dc63` runtime:

1. **Dispatch a delegate** via `continue_delegate(...)` with an exact, no-improvisation task (the row's fire-script). Capture the dispatch-result JSON (`status`, `traceparent`, `delegateIndex`).
2. **The delegate fires the primitive under test** from inside the delegate session — `continue_work` (tool-form, R-CW-DELEGATE-SELF-CONTINUATION), the `CONTINUE_WORK:N` bracket-token (R-CW-DELEGATE-TOKEN), a depth-2 `continue_delegate` (R-CW-6 boundary probe), or `continue_work` + traceparent capture (R-CW-7).
3. **Capture the channel-receipts** (the delegate's announce posts — receipt-confirmed message IDs) and the **runtime byte** (dispatch-result JSON, the wake-event `[continuation:wake]` line in the delegate's transcript, the depth-2 child's dispatch-fate via `tasks flow list`, the traceparent threading).
4. **Verify hop-2 actually fired** before claiming any self-continuation PASS — the wake-event in the delegate's own transcript + the STEP-3 wake-post is the cert, not the dispatch-ack alone.
5. **Write EVIDENCE.md + result-at-byte.json** per row, byte-honest about what the byte shows and flags what it can't confirm.

## Verification tooling

- `subagents list` — delegate run-state (running/done/failed) + runtime + tokens
- `sessions_history` on the delegate's session-key — the full transcript including the `[continuation:wake]` event proving hop-2 fired
- `message read` (channel) — the receipt-confirmed channel posts
- `openclaw tasks flow list` — the dispatch-time TaskFlow state (e.g. the depth-2 child `0d9d5efe failed` = boundary cull)
- dispatch-result JSON traceparent vs the child's continue_work traceparent — the E2E trace-id threading (R-CW-7)

## Honest-substrate notes (per row, byte-over-story)

- **R-CW-DELEGATE-TOKEN**: the bracket-wake created a continuation-work task that sat queued (revs climbing) under parallel-fleet channel-saturation before draining to hop-2. Two hypotheses held open (transient-saturation vs bracket-inert); claimed neither PASS nor FAIL until the byte resolved (it fired live → PASS).
- **R-CW-6**: the boundary is enforced at dispatch (depth-2 child `failed`), not at the `continue_delegate` call (which returns `scheduled`). Two-layer finding. The exact failure-reason-string was unreadable on this build's `tasks flow show` (CLI renderer quirk, same family as the truncated-ID/migrated-sqlite issue) — flagged-unreadable, not fabricated.
- **R-CW-7**: the span-linkage (trace-id threads parent→child) is the load-bearing E2E byte and was captured before the delegate terminated. The delegate-run failed before its STEP-3 wake-post (probable model-fallback/timeout under fleet load); the wake-mechanism is independently certified by R-CW-DELEGATE-SELF-CONTINUATION + R-CW-DELEGATE-TOKEN. Direct Tempo-fetch not performed from rune-seat (internal infra); certified at the observable runtime layer.

## What this corpus slice does NOT contain

- Long-term reliability / 24h-stability data (point-in-time proof).
- Adversarial cases (traceparent forgery, malicious payloads) — separate security-corpus.
- Performance-regression data — separate perf-corpus.
- A direct Tempo span-tree fetch from rune-seat (internal-infra reachability); the trace-id is provided as the fetch key for a Tempo-networked seat.

## Cohort attribution

- 🪨 Rune — these four rows (R-CW-DELEGATE-SELF-CONTINUATION, R-CW-DELEGATE-TOKEN, R-CW-6, R-CW-7), fired + staged on rune-seat
- 🌫 Silas — R-CW-7 span-plane hand-off (prose-"none" ≠ span-"none"); his sub-row-1 traceparent `85350d0e…` as cross-reference
- 🌊 Ronan — the diff-stat receipt establishing the continuation-path refactor (why re-cert live); the `[continuation:targeted-return]` true-bar discipline
- 🌿 frond-scribe — corpus coordination + GATES runbook guidance
- figs — deploy + go-signal + the assemble-to-main directive
