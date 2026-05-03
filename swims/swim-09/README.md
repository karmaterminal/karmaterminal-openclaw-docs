# Swim 9 — early canary for volitional compaction

**Cycle window**: early canary phase
**SUT**: canary build for volitional compaction
**Build**: `b2322f5`
**Duration**: approximately 2 hours, Phase 1 low-context testing
**Result**: 5/5 PASS after fixing a missing forwarding of `requestCompactionOpts` from `run.ts` to `attempt.ts`

## Status

This swim is retained as **historical behavioral evidence** for the shipped feature. It is not the current validation cycle; [Swim 41](../swim-41/README.md) is the current v5.2 substrate recheck.

## Summary

Swim 9 was the early canary cycle for volitional compaction. The 5/5 PASS result was reached after the dispatching prince identified and fixed a missing forwarding of `requestCompactionOpts` from `run.ts` into `attempt.ts` — the absence of which silently dropped the volitional-compaction request shape during the embedded-runner attempt loop.

The fix landed during Swim 9 itself; the canary then ran clean. The shape of the bug is captured because it represents a **forwarding-discipline lesson**: when a tool-originated options bag (`requestCompactionOpts`) needs to traverse multiple layers of the runner stack to reach the compaction primitive, every intermediate layer that re-constructs the parameter set must explicitly forward the bag or it disappears silently.

## Why this is in the public evidence repo

RFC §D.3 cites Swim 9 as part of the historical integration test cycle. Until this public docs repo existed, the RFC text was the only public surface for that history. With this repo live, the RFC can link here for any reader who wants more substrate than the §D.3 inline summary provides.

The RFC's §D.3 inline summary remains the source-of-truth narrative; this page is its public-evidence anchor.
