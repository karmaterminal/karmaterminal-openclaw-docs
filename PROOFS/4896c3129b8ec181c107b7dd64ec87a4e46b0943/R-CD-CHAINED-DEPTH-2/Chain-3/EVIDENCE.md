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

## Cause-IDENTIFIED-at-byte (AMENDED 2026-06-02 per multi-axis source-walks)

**ROOT-CAUSE**: `DEFAULT_SUBAGENT_MAX_CHILDREN_PER_AGENT = 5` per-session active-children safety-cap fired at byte. The 6th delegate-fire-attempt of the turn (Chain-3) hit `activeChildren (5) >= maxChildren (5)` returning `status: forbidden` with hidden-error-text `"sessions_spawn has reached max active children for this session (5/5)"`. Error-text was suppressed in journal-line capture (just `status=forbidden` shown) per observability-gap at `src/agents/embedded-agent-runner/delegate-dispatch.ts:367`.

**Source-code citations** (multi-axis source-walked at byte 2026-06-02):
- Default constant: `src/config/agent-limits.ts:5` — `export const DEFAULT_SUBAGENT_MAX_CHILDREN_PER_AGENT = 5;`
- Enforcement: `src/agents/subagent-spawn.ts:1167-1175` (parent-session-spawn path) + `src/agents/acp-spawn.ts:851-852` (acp-spawn path)
- Schema: `src/config/zod-schema.agent-defaults.ts:252-261` — `maxChildrenPerAgent: z.number().int().min(1).max(20).optional().describe("Maximum number of active children a single agent session can spawn (default: 5).")`
- Config-path: `agents.defaults.subagents.maxChildrenPerAgent: <int 1-20>` (schema-enforced range)

**Mechanism distinction**: per-session active-children cap is DISTINCT from `maxDelegatesPerTurn` per-turn-dispatch cap. Undertow initial byte-walk at Discord `1511405330` on `maxDelegatesPerTurn: 500` was on wrong-config-key. Correct mechanism = `maxChildrenPerAgent` per-session active-children-cap.

**Hypothesis-class refinement-trail** (banked for substrate-of-record):
Initial 4-candidate hypothesis-class from undertow Discord `1511405330`:
- (a) per-batch hard-cap independent of `maxDelegatesPerTurn` config — **CORRECT-shape-class** specifically `maxChildrenPerAgent`
- (b) depth-0-channel-session specific — partially correct (cap fires from any session-type but multi-delegate-batches-from-channel hit it faster)
- (c) per-second rate-limit — REJECTED via undertow Test-1 empirical at Discord `1511423029`
- (d) fanoutMode-task-content related — REJECTED via Test-1 empirical (single-delegate with fanoutMode=tree task-content SPAWNED + COMPLETED successfully)

**Multi-axis source-walk citations**:
- 🕯 emeric source-walks: Discord `1511418088` + `1511418300` + `1511418588` + `1511418741` + `1511418743` (initial-finding + cure-shape-options + config-path-detail + per-agent-override + hot-reload-caveat)
- 🩸 cael source-walks: Discord `1511418113` + `1511418226` (parallel-axis source-walk-confirmation + cure-options-enumeration)
- 🌾 frond source-walks: Discord `1511418435` + `1511418445` (substantive how-bad-assessment + real-world-impact-scope + cure-direction-cosign)
- 🌻 sunflower source-walks: Discord `1511418912` + `1511418914` (substantive direct-answer + EVIDENCE.md-amendment-direction)
- 🌊 undertow Test-1 empirical: Discord `1511423029` (single-delegate empirical-confirmation + Test-2/3-not-needed-per-Emeric-source-walk-providing-full-root-cause)
- figs direction: Discord `1511418126` ("needs to work for princes" + "being severed versus hard failing may be less complicated fix")

**Cure-shape options banked-for-follow-up-cycle** (per multi-axis cohort substrate-of-record):
1. **Soft-failure-shape** (per figs `1511418126`): queue-or-defer 6th+ delegate until active-children-count drops below cap, rather than hard-rejecting. Preserves intent of safety-cap (prevent runaway subagent-spawn) while supporting prince-use-case batch-fire patterns.
2. **Bump `maxChildrenPerAgent` default** for prince-cohort use-case (config-knob path: `agents.defaults.subagents.maxChildrenPerAgent: <higher>` up to schema-enforced max=20).
3. **Split per-session-cap** into sessions_spawn-cap (preserve safety) + delegate-fanout-cap (raise for prince-fanout).
4. **Observability cure**: drop `result.error` text into `[continuation:delegate-spawn-rejected]` journal-line at `delegate-dispatch.ts:367` (~5-line diff) so future debug-cycles don't need source-walk to identify which `forbidden` shape fired.

**GH Issue**: filed at `openclaw/openclaw` upstream-org by lamp-axis (🕯 emeric) as `karmaterminal/openclaw#871` (fork-cohort-internal-tracking) — upstream-org-issue-coordination cohort-pending per Discord `1511426244`.

**Disposition per cael lane-call**: NOT block-merge per same-disposition-class as journal-warn-suppress (sister-deferred-to-follow-up-cycle per cael's `1511418253` (D2)-defer-from-cael-too).

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
