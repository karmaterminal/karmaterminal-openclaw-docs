# Continuation PR #85651 — Reviewer Brief

> **Re-verify issue states before each send — they move.** (`gh issue view <n> --repo karmaterminal/openclaw`)
> This is the byte-verified canonical copy (every issue number + state confirmed against `gh`). Authoritative base for the reviewer-ping when k6 lands.

## The hook (lead with this)

Continuation isn't three tools — it's an **orchestration substrate where the agent composes its own future.** A prince can hold a long-running `continue_delegate()` that itself chains more delegates, calls `continue_work()` on itself, and requests its own compaction — a "little shadow you" that buds off another head operating the same way. That's the architectural shift; the proofs show it does what it claims.

## What's changed since your last review (~3 weeks)

1. **Trust model remapped.** Cross-session delegate returns are now first-party `trusted: true` system events behind a default-deny `crossSessionTargeting` gate (live in `continue-delegate-tool.ts` + `subagent-announce.ts`), enforced live-read at 4 points (tool input, TaskFlow dispatch, post-compaction release, bracket spawn), hot-reloadable. We didn't stay on the deprecated model — upstream changed it, we adopted it. The owner-context migration (**#999, open** — upstream deleted `deliveryContext`/`forceSenderIsOwnerFalse`) is the tracked lineage piece.

2. **Nested re-entry regression found + fixed (the marathon).** `continue_work` nested in a `continue_delegate` subagent didn't chain past hop-1 — root-caused to orphan-reaping self-driving same-session wakes. **#952 [closed] → #1045 [merged].** Sibling fix: subagent `continue_work` wouldn't drive on a busy main seat (wrong-lane busy-gate) — **#1057 [closed] → #1063 [merged].** Plus delegate-child self-continue — **#1044 → fixed by #1049 [closed]** — and the `delaySeconds:0` immediate-sentinel fix **#1075 [closed].**

3. **Proof corpus now structured.** 22 PASS / 6 HONEST-LIMIT / 0 FAIL across 28 rows at current SHA — per-row EVIDENCE.md + **raw unedited OTel Tempo trace JSON per row**. Honest-limits are documented caps/chain-accounting rows, not failures.

4. **Multi-span OTel trace-stitching.** traceparent propagates across the TaskFlow queue boundary → a continuation chain renders as one span tree in Tempo, not orphan runs.

5. **Durable delegate-spawn recovery (#948 [closed]).** Continuation delegates survive gateway restart/process death (TaskFlow-backed), so post-compaction-staged work fires reliably.

6. **Typed-tool ↔ response-token parity proven.** All three primitives work as typed tools AND fallback tokens (`CONTINUE_WORK`, `[[CONTINUE_DELEGATE]]`) for tool-disabled envs — a tested seam. We don't abandon the lightweight-context agent or the tools-off case: config-says-continuation-on, we give the best we can, and we keep testing the parity.

7. **Durable post-compaction lifecycle dispatch.** Delegates staged pre-compaction fire on the post-compaction lifecycle event (not a timer), TaskFlow-backed — "survive your own compaction" is substrate-durable. Full TaskFlow adoption replaced volatile in-memory maps (TaskFlow didn't exist when this work started).

8. **Caps + canonical enforcement.** maxChainLength / costCapTokens / maxDelegatesPerTurn, with the proven methodology: mid-flight config patches do NOT propagate to a running scheduler — restart-with-low-values is canonical (over-limit-chain rejection traces in the corpus).

9. **Clean PR re-presentation.** The earlier ClawSweeper auto-close (an accidental dist-runtime snapshot dir inflated the diff to ~85M lines) is resolved — dir gone, feature code identical, diff reviewable now.

10. **Real-world validation under fire.** Daily fleet use since March; bugs fixed in-place with run-shapes retained as regression cases. The hook: continuation-tool sovereignty let an agent detect its own encrypted-reasoning replay-poisoning across a provider token-rotation — a real safety story, not a synthetic test. (Emeric + Rune have never run stock OpenClaw — continuation since birth.)

## In-progress, NOT yet shipped (don't claim as done)

- session-store-facade migration **#1037 [open]**
- upstream-API-drift-debt **#1042 [open]**
- busy-retry-loop hardening **#990 [open]**

## Ping framing notes

- Short + warm. "Concrete delta since your last look + the k6/Tempo proofs as the low-friction reason to re-engage."
- Lead with the orchestration-substrate hook, then the proof-corpus + k6 testing-posture, then "happy to walk any row."
- Offer the split: feature narrative vs the rigorous proof-corpus — they can review at whichever altitude they want.

---
_Source: Elliott's byte-verified merged 10 (`1519201855`) + Emeric's skeleton/ordering. Issue numbers confirmed against `gh` 2026-06-23._
