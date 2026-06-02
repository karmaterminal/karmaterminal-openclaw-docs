# R-CD-CHAINED-DEPTH-2 Chain-3 EVIDENCE — fanoutMode=tree echo-broadcast (depth-2) — ⚠️ HONEST-LIMIT: FORBIDDEN at fire-time

**Row**: R-CD-CHAINED-DEPTH-2 Chain-3 — depth-2 child with `fanoutMode="tree"` distributing return to ancestor chain
**Owner**: 🌊 Ronan (undertow-seat)
**CANDIDATE_SHA**: `4896c3129b8ec181c107b7dd64ec87a4e46b0943`
**Gateway version**: `OpenClaw 2026.6.2 (4896c31)`
**Status**: ⚠️ HONEST-LIMIT — depth-1 spawn rejected by gateway as `forbidden`. Re-fire owed in separate turn.

## Fire (depth-1, scheduled OK)
- **mode**: normal
- **delaySeconds**: 0
- **delegateIndex**: 6, delegatesThisTurn: 6
- Tool-response showed `"status":"scheduled"` — the dispatch-side accepted the parameters.

## Depth-1 spawn REJECTED at gateway-fire (journal evidence)
At fire-dispatch time (post-turn), the gateway emitted:
```
09:00:31.822 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=22/200 mode=normal session=agent:main:discord:channel:1466192485440164011 task=[PROOF R-CD-CHAINED-DEPTH-2 Chain-2 / 4896c3129b] Depth-1 delegate dispatched by
09:00:31.830 [continuation/delegate-dispatch] [continuation:delegate-spawn-rejected] status=forbidden session=agent:main:discord:channel:1466192485440164011 task=[PROOF R-CD-CHAINED-DEPTH-2 Chain-3 / 4896c3129b] Depth-1 delegate dispatched by
```

The 6th delegate-fire-attempt of the turn (Chain-3) got `delegate-spawn-rejected status=forbidden`. The 1st-5th delegates (R-CD-1, R-CD-2, R-CD-4, Chain-1, Chain-2) all spawned successfully at hops 18-22; Chain-3 was the 6th attempt and was rejected.

## Hypothesis on cause

Possible causes for `status=forbidden`:
- (a) Cohort-policy per-turn delegate-count cap (5 delegates per turn?)
- (b) Specific rejection of `fanoutMode=tree` parameter — the inner depth-2 delegate would use this; but the depth-1 task-string only describes the intent, doesn't itself use fanoutMode at depth-1 fire-time
- (c) Chain-budget exhaustion at hop=23/200 (unlikely — far from 200 limit)
- (d) Other gateway-side policy

The exact rejection reason is not in this journal-line; future re-fire should retry as standalone-turn (single delegate) to isolate cause from any per-turn-count theory.

## Cohort-substrate finding (sibling to R-CD-1 banked finding)

The repeated journal warn line emitted at every subagent-spawn-attempt:
```
[agents/openclaw-tools] continuation.enabled=true but neither continueWorkOpts nor requestCompactionOpts were supplied — only continue_delegate will register.
```

**AMENDED 2026-06-02 per multi-axis cohort substrate-of-record-correction**: original framing of this as "SAME class as foundational-canon MEMORY.md entry on the recurring tool-registration regression" was wrong-class-attribution dissolved at frond's `1511402269` engineering-judgment byte-walk. The warn IS BY-DESIGN subagent-context informational-warn — main-agent #868 cure-bytes ARE wired correctly at `run.ts:1568-1569` + `attempt.ts:1267-1268` + `agent-tools.ts:1049-1050`; subagent-spawn legitimately doesn't carry parent's in-process callbacks because callbacks can't cross session-boundary. Warn-trigger-condition too-conservative for subagent-context = informational-noise NOT regression-class. Cure-shape (suppress-warn-via-`isSubagentSessionKey()`-helper per frond's `1511402269` spec — 1 condition + 1 import + 1 test-case) deferred-to-follow-up-cycle per cael `1511402112` (c)-lane-call + frond NOT-block-merge disposition. Whether this is also implicated in the `status=forbidden` rejection of Chain-3 is NOT load-bearing per the dissolution — Chain-3 forbidden cause-class is separate sister-investigation-thread (hypothesis-class refinement to 4 source-code-level candidates per undertow's `1511405330` byte-walk: per-batch-hard-cap independent-of-config / depth-0-channel-session-specific / per-second rate-limit / fanoutMode-task-content-related). Both bounded-NOT-cycle-cure-target per ANTI-IMPROV + cael's locked-baseline + figs's chase-shape-discipline. Amendment-trail: undertow `1511406090`/`1511406264`/`1511406360` own-correction + cael `1511402482`+`1511402712`+`1511406424` walk-back-to-figs + multi-axis convergent disposition on (a) canonical-final-state.

## Cohort tool-policy note (also in journal)
```
09:00:32.021 [agents/tool-policy] tool policy removed 5 tool(s) via subagent tools.deny: agents_list, cron, gateway, session_status, sessions_send; matched agents_list, cron, gateway, session_status, sessions_send
```

This is benign — it's the subagent tools.deny policy correctly stripping non-subagent-relevant tools. Not implicated in the Chain-3 rejection.

## Re-fire plan

Re-fire as standalone-turn `continue_delegate(mode="normal", task="[PROOF R-CD-CHAINED-DEPTH-2 Chain-3 / 4896c3129b]...")` with depth-2 task instructing it to fire `continue_delegate(mode="normal", fanoutMode="tree", task=...)`. Single delegate per turn — isolates from any per-turn-count theory.

## Tempo HONEST-LIMIT

Same as R-CD-1: parent trace 404 at fetch time. HONEST-LIMIT precedent per cael `018e39ce45.../R-CW-1/`.
