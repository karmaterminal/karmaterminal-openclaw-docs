# Swim 10 — Tool Parity + Full Path Coverage canary

**Cycle window**: 5-role canary formation
**SUT**: canary build for volitional compaction (continuation feature)
**Build**: `ad32cde`
**Duration**: approximately 5 hours
**Formation**: driver, log monitor, SUT, coordinator, human user (5-role canary)
**Result**: 12 PASS · 0 FAIL · 1 DEFERRED

## Status

This swim is retained as **historical behavioral evidence** for the shipped feature. It is not the current validation cycle; [Swim 41](../swim-41/README.md) is the current v5.2 substrate recheck.

## Detailed scorecard

| Test  | Description                                    | Result          |
| ----- | ---------------------------------------------- | --------------- |
| 10-T1 | `continue_work()` fires                        | ✅ PASS         |
| 10-T2 | delayed `continue_work()` honored              | ✅ PASS         |
| 10-T4 | single `continue_delegate()` from main session | ✅ PASS         |
| 10-T5 | fan-out × 3                                    | ✅ PASS (retry) |
| 10-T6 | silent-wake delegate return                    | ✅ PASS (fix)   |
| 10-D1 | delegate tool inside delegates                 | ✅ PASS         |
| 10-D4 | chain-length enforcement at depth 10           | ✅ PASS         |
| 10-G1 | width enforcement at 5                         | ✅ PASS         |
| 10-P1 | natural context-pressure fire                  | ✅ PASS         |
| 10-B1 | bare `CONTINUE_WORK` fallback                  | ✅ PASS         |
| 10-B2 | delegate response-token fallback               | ✅ PASS         |
| 10-B3 | response-token + tool coexistence              | ✅ PASS         |
| 10-H1 | fallback under `tools.deny`                    | ⏸️ DEFERRED     |

## Notes during the cycle

- `registerSubagentRun()` initially failed to persist `silentAnnounce` and `wakeOnReturn`; the four-line fix was applied during Swim 10 and the retry passed.
- First-pass tool validation produced a false positive because the agent narrated tool calls it never made; **log verification became mandatory** as a result. This lesson informs the substrate-evidence discipline that Swim 41 carries forward (every OV row records its substrate evidence as a verdict-stamped artifact, not narrated PASS).
- `10-H1` was deferred for operational reasons rather than correctness: provider 429s, timeout and restart churn, and an incorrect response token (`[[CONTINUE_WORK: text]]` instead of bare `CONTINUE_WORK`).
- A six-path delegate wiring audit found one divergence on post-compaction flag normalization; the defensive fix was accepted in `1a1e88e15e` after independent cross-review.
- The qualitative canary report was positive: tools felt natural, silent-wake was effective, and the guardrails held at boundaries.

## Why this is in the public evidence repo

RFC §D.3 cites Swim 10 as part of the historical integration test cycle. Until this public docs repo existed, the RFC text was the only public surface for that history. With this repo live, the RFC can link here for any reader who wants the full per-test scorecard alongside the §D.3 inline summary.

The RFC's §D.3 inline summary remains the source-of-truth narrative; this page is its public-evidence anchor with the full 13-row scorecard.

## Related cohort tracker (private; cohort-internal)

- `karmaterminal/openclaw-bootstrap#377` ("Swim 10: Tool Parity + Full Path Coverage — tools, brackets, delegates, horrid humans")

The private tracker holds the cohort-coordination narrative; this public page holds the byte-pinned scorecard the RFC links to.
