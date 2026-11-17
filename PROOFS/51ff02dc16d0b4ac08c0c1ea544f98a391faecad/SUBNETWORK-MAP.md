# Continuation subnetwork → proof-predicate map (pre-fire, read-only)

- Product (bound): karmaterminal/openclaw `51ff02dc16d0b4ac08c0c1ea544f98a391faecad` ("P").
- Runtime that executes the rows: `ab5a30ea79b776f149e24b1fccab9e79b0a5d299` ("R"). P is an ancestor of R (`git merge-base --is-ancestor` ok).
- Last emeric live fire: `f15237ec921879d918482cdf372b0718d4c1aab9` ("F"). F is an ancestor of P; F..P = 5,830 commits.
- Harness: karmaterminal-openclaw-docs `9ba5518bdb079da3c3c75961fd8cd26be040eb1e`, `tools/k6-proofs/`.
- Method: source bytes from a detached worktree at P (`/tmp/k6ab5a-oc-51ff`) plus `git diff F P`. The GitNexus index was used only to orient (section 1). Line numbers are at P unless marked `F:`. Nothing was fired, deployed, committed or posted.
- Working files next to this map, cited below:
  - `artifacts/subnetwork/DELEGATE-SIDE.md`: the continue_delegate walk, every claim with file:line.
  - `artifacts/subnetwork/SCENARIO-PREDICATES.md`: the harness predicates, every claim with a scenario/lib file:line.
  - `gnx-context.txt`, `manifest-extract.txt` (lane-local working files, not published).
  - In this map, "DS §x" means DELEGATE-SIDE.md and "SP §x" means SCENARIO-PREDICATES.md.

---

## 1. GitNexus receipt

| Item | Value |
|---|---|
| Wrapper | `gnx` (`~/.local/bin/gnx`, sha256 `07e85be6…8f53`, byte-identical to plugin `scribe-prince-shared/gitnexus/0.2.7/bin/gnx`) |
| Fork CLI | `~/src/gitnexus/gitnexus/dist/cli/index.js` (sha256 `00f67e34c0ef3a7e…8590`). `gnx cli --version` → `1.6.5` |
| Fork repo / SHA | `https://github.com/karmaterminal/GitNexus.git`, `main` @ `3c1e686edfc1acaac882927cada121ddd7c47bcc` (2026-05-29, "perf(scope-resolution): yield cooperatively at openclaw-scale (#2)"). Does **not** contain `1a07ad3`, so the 1.6.5 resolver rules apply. |
| Storage / DB | storage v40; `CALL db_version()` → LadybugDB `0.16.1`. `impact` counts are a lower bound (karmaterminal/GitNexus#8). |
| Registry | `~/.gitnexus/registry.json`: 68 entries, 40 MCP-visible; 11 openclaw candidates |
| `gnx pick 51ff02dc… -- src/auto-reply/continuation src/infra/continuation-tracer.ts` | no fresh index. Best is `openclaw-composite-39d19454` at `<seat-source>/WORKTREES/openclaw-gn-39d19454`, indexed `39d1945464c4a11d954c069e8e46d5f9351a7937` (2026-11-14T03:48Z, 1,600,944 nodes). It is an ancestor of P: ref+24 / idx+0 commits, 39 files changed repo-wide. |
| `gnx pick ab5a30ea… ` (same scope) | same index, ref+50 / idx+0 commits, 91 files. No fresh index for R. |
| `gnx fresh <39d19454> 51ff02dc -- src/auto-reply/continuation src/infra/continuation-tracer.ts` | **STALE**, exit 1. The single scoped file changed is `custody-conjecture.scenario.test.ts` (+12, test only). |
| `gnx fresh … -- <68 production files of src/auto-reply/continuation> src/infra/continuation-tracer.ts` | **FRESH-FOR-SCOPE**, exit 0. 0 scoped files changed. |
| `gnx fresh … -- src/agents/tools src/agents/system-prompt-continuation.ts src/auto-reply/reply/queue` | **STALE**. 8 changed: `continue-delegate-tool.ts`, `continue-work-tool.ts`, `system-prompt-continuation.ts`, `queue/enqueue.ts`, `queue/lifecycle.ts`, plus 3 tests. These are exactly the #1547 tool-description surfaces. |
| `worktree_head_moved` / `worktree_dirty` | false / false |

**Verdict and gap.**
- No EXACT index exists for P or for R.
- The 39d19454 index is FRESH-FOR-SCOPE for the continuation production files and the tracer. It is STALE for the three tool files and the system prompt.
- So I used graph answers only as caller/callee leads, every one byte-checked against P. All tool-file and prompt lines in this map come from source.
- I did not build a new index. The only recorded analyze on this seat (`WORKTREES/gnx-index-cut-073fefdc.log`) ran 2 h 56 m and died of OOM at 35.6 GB RSS. An incremental refresh still runs the whole parse pipeline (skill §2), which is far beyond the 10-minute budget.
- Graph quirks seen:
  - The index's `startLine` is 0-based (for example `scheduleContinuationWork` 631 → P:632).
  - Dynamic-import and function-as-argument edges are missing. `scheduleContinuationWork` shows 0 production callers because it is reached through `scheduleContinuationWorkBatchWith`. `dispatchToolDelegates` lacks its `lazy.runtime` caller.

GitNexus context (index `openclaw-composite-39d19454`@`39d1945464`, verdict FRESH-FOR-SCOPE for P, scope = continuation production files + tracer; byte-verified at P):

| Symbol (P file:line) | Production callers (graph) | Callees of note |
|---|---|---|
| `scheduleContinuationWork` work-dispatch.ts:632-741 | 0 (missed edge; actual: `scheduleContinuationWorkBatch` :744 → `scheduleContinuationWorkBatchWith`) | `checkContinuationBudget`, `clampDelayMs`, `captureWorkElectionAuthority`, `enqueueContinuationWorkForSchedule`, `emitContinuationWorkSpan`, `registerIdleRetry`, `armNextWorkTimer` |
| `dispatchPendingContinuationWork` work-dispatch.ts:468-630 | `dispatchPendingContinuationWorkFromDetachedCallback`, `recoverPendingContinuationWork` | `consumePendingWork`, `deliverPendingTerminalNoticeWithRetry`, `refuseStaleContinuationWork`, `partitionSupersededWork`, `commitFoldedContinuationWork`, `executePendingWorkWithOperatorContinuation` |
| `executePendingContinuationWork` work-dispatch-execution.ts:549-713 | (missed; via operator-continuation wrapper) | `emitContinuationWorkFireSpan`, `formatContinuationWakeText`, `driveContinuationTurn`, `requeuePendingWork`, `markPendingWorkFailed/Reaped/Superseded/TurnGranted` |
| `refuseStaleContinuationWork` work-recipient-authority.ts:102-152 (NEW) | `dispatchPendingContinuationWork`, `driveContinuationTurn`, `prepareFoldedContinuationWork`, `refuseStaleContinuationWorkAtReplay` | `markPendingWorkFailed`, `reportRefusedContinuationWork`, `emitContinuationQueueDrainSpan` |
| `markPendingWorkTurnStarted` work-store.ts:103-152 (NEW) | `driveContinuationTurn` | `writeWork`, `decodeWorkState` |
| `formatContinuationWakeText` work-wake-text.ts:52-70 (moved) | `executePendingContinuationWork` | `provenanceLines` |
| `handleContinuationSignal` agent-runner-continuation-signal.ts:37-546 | `scheduleReplyContinuation` | `stagePostCompactionDelegate`, `enqueuePendingDelegate`, `emitBracketContinuationRejected` |
| `captureWorkElectionAuthority` work-operator-continuation.ts:34-52 (NEW) | `scheduleContinuationWork` | `captureContinuationWorkRecipientAuthority`, `captureWorkOperatorContinuation` |
| `dispatchToolDelegates` delegate-dispatch.ts:92-649 | `drainChildContinuationQueue`, `recoverPendingContinuationDelegates` (post-turn caller via lazy import missed) | `startContinuationDelegateSpan`, `emitContinuationDelegateFireSpan`, `spawnSubagentDirect` |
| `startContinuationDelegateSpan` continuation-tracer.ts:596-611 | `dispatchToolDelegates`, `deliverQueuedPostCompactionDelegate` (NEW caller) | `continuationDelegateSpanAttributes` |
| `emitContinuationDelegateFireSpan` continuation-tracer.ts:810-853 | `dispatchToolDelegates`, `deliverQueuedPostCompactionDelegate` (NEW caller) | `continuationReasonAttributes` |
| `emitContinuationWorkFireSpan` :885-922 / `emitContinuationWorkSpan` :625-649 | `executePendingContinuationWork` / `scheduleContinuationWork` | |
| `evaluateRequestCompactionGuards` request-compaction-tool.ts:187-262 (NEW) | `execute` (tool), `isRequestCompactionAdmitted` @ agent-runner-execute.ts | |

Upstream impact (`--include-tests`, depth 3, lower bound):
- `refuseStaleContinuationWork`: HIGH, 32 symbols. Reaches `work-dispatch.followup-admission.test.ts`, `work-dispatch.turn-start-fence.test.ts`, `work-recipient-authority.reset.test.ts` and the durable-2..8 suites.
- `markPendingWorkTurnStarted`: LOW, 7 symbols.
- `evaluateRequestCompactionGuards`: LOW, 2 symbols.

---

## 2. Per-tool code path at P

### 2.0 Registration (shared)
- `createOpenClawContinuationTools` openclaw-tools.continuation.ts:20-85, called from openclaw-tools.ts:674.
  - Gate: `agents.defaults.continuation.enabled === true` and not `disableContinuationTools` (:29-34).
  - `continue_work` registers only when the runner supplies `continueWorkOpts` (:38-45).
  - `continue_delegate` registers unless `drainsContinuationDelegateQueue === false` or the session is a cron-run session (:51-57).
  - `request_compaction` registers only with `requestCompactionOpts` (:58-67).
- Live runner callbacks: agent-runner-embedded-candidate.ts.
  - continue_work requests are pushed to `attemptContinueWorkRequests` (:220-226). The tool itself does not schedule.
  - request_compaction gets `getContextUsage → computeRequestCompactionContextUsage` (:232-238) and `triggerCompaction` (:239-290).
  - On `compacted`, `releaseQueuedCompactionTolerant` releases staged lifeboats (:275-285).
- Config defaults (config.ts:15-22, unchanged F→P):
  - delay default 15 s, min 5 s, max 300 s
  - maxChainLength 10, costCapTokens 500,000, maxDelegatesPerTurn 5, maxPendingWork 32
  - `crossSessionTargeting` defaults `"disabled"` (:128-129)
  - `clampDelayMs` keeps an explicit 0 as immediate and clamps positive values to [min, max] (:161-172)

### 2.1 continue_work (typed) and bracket `CONTINUE_WORK`
1. **Schema/registration.** continue-work-tool.ts:18-32. `reason` is maxLength 1024. `delaySeconds` description (:28): "0 or omitted = immediate. Positive delays are clamped to continuation.minDelayMs / maxDelayMs from config." **F→P:** only the description sentence at :46 changed, to "the turn starts after this one ends, or delaySeconds later".
2. **Tool execute.** :51-111.
   - Runtime traceparent `formatCurrentSpanContinuationTraceparent()` (:70).
   - Operator context capture (:76-83). `requestContinuation({reason, delaySeconds, traceparent?, operatorContinuation?})` (:85-90).
   - It always returns `{status:"scheduled", delaySeconds:<clamped>, note?}` (:102-110). The real scheduling happens after the turn (step 3), so a toolResult of `scheduled` does not prove that a wake was armed.
3. **Post-turn scheduling.** `scheduleReplyContinuation` agent-runner-continuation-schedule.ts:17-107 → `handleContinuationSignal` agent-runner-continuation-signal.ts:37-546. The work branch is :281-541:
   - Bracket form only: chain cap `currentChainCount + queued pending ≥ maxChainLength` → `[continuation] Bracket continuation rejected: chain length N reached.` (:126-145). Cost cap → `… cost cap exceeded …` (:146-162).
   - Durable chain reservation (:329-362). Failure → system event `[continuation] continue_work election(s) were not scheduled because chain state could not be persisted.` (:389-392).
   - `scheduleContinuationWorkBatch` (:467-478). Throw → `[continuation] continue_work scheduling failed; the reserved chain budget remains fail-closed.` (:488-491).
   - With more than one election, capped ones surface as `[continuation] N of M continue_work elections were not scheduled (chain/cost/pending cap).` (:531-536).
   - **F→P:** this file's work branch is unchanged. The only diff is the bracket-delegate `electingOperatorAuthority` (:273).
4. **Schedule.** `scheduleContinuationWork` work-dispatch.ts:632-741:
   - budget check → `[continuation:work-rejected]` (:635-645)
   - hop = count+1; `clampDelayMs` (:648)
   - **NEW:** `captureWorkElectionAuthority` → recipient-authority epoch + operator custody (:663-666; work-operator-continuation.ts:34-52; work-recipient-authority.ts:63-67). A failed capture throws, so the election is not scheduled (see step 3 throw).
   - Active-turn anchoring: if the electing reply run is still active, `dueAt = electedAt + maxDelayMs` (hedge) and `anchorPending` (:670-698). Otherwise `dueAt = electedAt + delay`.
   - durable enqueue (:701)
   - **span `continuation.work`** (:719-726)
   - `[continuation:work-parked-on-turn-end]` (:727-732)
   - `armNextWorkTimer` (:734)
5. **Dispatch (timer/idle retry).** `dispatchPendingContinuationWork` work-dispatch.ts:468-630:
   - Live-config disabled → recheck timer, nothing consumed (:481-491).
   - `finalizeAnchorPendingWork` (:498-505).
   - `consumePendingWork` (:509-515). **NEW:** a consumed record that carries a `turnStart` fence is interrupted, never re-driven (work-store.ts:273-282, `[continuation:work-turn-interrupted]`), and its notice is delivered (:520-522).
   - **NEW** handoff refusal `refuseStaleContinuationWork(works,"wake")` (:530). An unreadable authority keeps the works for the adoption check (work-recipient-authority.ts:116-124).
   - Backlog supersede → `[system:continuation-note] N stale continue_work wake(s) were folded…` (:527-551). The logic moved to work-dispatch-supersede.ts.
   - If the session is active, anchor-finalized works are **folded** into the active turn as a `[system:continuation-note]` note, with no `[continuation:wake]` row (:574-600; note text work-wake-text.ts:75-105).
   - Otherwise each work is driven (:601-628).
6. **Execute.** `executePendingContinuationWork` work-dispatch-execution.ts:549-713:
   - **span `continuation.work.fire`** is emitted on **every attempt**, before the drive (:560-568).
   - Journal `[continuation:work-wake] hop=h/m session=… reasonCategory=…` (:569-571). Unchanged; at F it was :597.
   - `driveContinuationTurn` (:185-394):
     - Gateway draining / session busy / main-lane queue busy → retryable skip (:213-233).
     - `missing-session` (:245-247).
     - no-op-rearm guard (:253-261).
     - **NEW adoption refusal** `refuseStaleContinuationWork([work],"adoption")` → `recipient-refused` → record failed, **no notice, no turn** (:267-269, :599-601).
     - **NEW durable turn-start fence** `markPendingWorkTurnStarted(work, turnRunId=randomUUID())` (:275-292; work-store.ts:103-152). This replaces F's `revalidatePendingWorkForTurn`.
     - lifecycle-revision check (:293-305).
     - `getReplyFromConfig({Body: wakeText, Provider/Surface/From:"system"}, {runId: turnRunId, continuationTrigger:"work-wake", typingPolicy:"system_event", onWorkWakeRefused})` (:311-347).
   - **NEW followup admission** get-reply-run-admission.ts:516-525. A `work-wake` that finds the session active, or would `enqueue-followup`, is refused, never queued (commit 7571deea1d). It comes back as `admission-refused`, a retryable skip (:359-368, :124-132), and is requeued with busy backoff `1 s·2^n`, capped at maxDelayMs (work-dispatch.ts:446-467; work-dispatch-backoff.ts).
7. **Wake text.** work-wake-text.ts:52-70 (moved from F:work-dispatch-execution.ts:208-226; body bytes identical, only `export` added): `[continuation:wake] Turn h/m. [Chain started at …. ][Accumulated tokens: N. ]The agent elected to continue working.[ Prior reason: "<reason>"] [provenance] Origin run: … Elected at: … Due at: … Overdue by: … Delivered at: … Disposition: granted Chain: <chainId> hop h/m Flow: <flowId> Prior reason: "<reason>"`.
8. **Persistence/terminalization.**
   - `markPendingWorkDelivered` → `markPendingWorkTurnGranted` (work-dispatch-execution.ts:388-393, :578-584).
   - Non-retryable skip → `[system:continuation-warning] continue_work turn was not granted (<reason>).` plus failed (:657-662).
   - Retry exhaustion / interrupted → terminal notice. **NEW** text for an interrupted turn (work-terminal-notice.ts:49-69): `[continuation:work-turn-interrupted]\ncontinue_work record <flowId> started its turn as run <runId> at <iso>, and that turn's completion was never confirmed.…`.
   - Recovery at boot needs a Gateway resolver, otherwise `[continuation:work-recovery-no-gateway]` (work-dispatch.ts:767-773).
   - Fence drain (`work-fence-drain.ts`, NEW) is an **offline** operator surface (`openclaw continuations`) that interrupts fenced, undelivered wakes before a seat moves to a build without the fence. No live row reaches it.
9. **Bracket CONTINUE_WORK.** The grammar is in signal.ts (unchanged F→P, DS §A4b). A bracket election schedules one work from the merged signal with `delaySeconds = (delayMs ?? defaultDelayMs)/1000` (agent-runner-continuation-signal.ts:287-298), then follows steps 4-8.

### 2.2 continue_delegate (typed) and bracket `[[CONTINUE_DELEGATE: …]]` (full walk: DS §A)
1. **Schema.** continue-delegate-tool.ts:41-129, name :262, description :263-275.
   - `delaySeconds` (#1547), verbatim (:62-63): **"Seconds to wait before spawning the delegate. 0 or omitted = dispatch after this response ends. Positive delays are clamped to continuation.minDelayMs / maxDelayMs from config."** F said "0 or omitted = immediate." The text changed; behavior did not (DS §A1).
   - Modes `normal|silent|silent-wake|post-compaction` (:41).
2. **Arbitration.**
   - Cross-session gate at election throws unless `crossSessionTargeting==="enabled"` (:357-366).
   - `maxDelegatesPerTurn` slot (:373-389) → `{status:"rejected", guard:"maxDelegatesPerTurn", …}`.
   - Chain and cost caps apply at dispatch (delegate-dispatch.ts:313-333), not in the tool.
   - The bracket form checks chain and cost at election (agent-runner-continuation-signal.ts:126-162).
3. **Election and persistence.** `createDelegateRecord` (delegate-flow-store.ts:420-475) binds recipient authority (:434-442).
   - **NEW:** it captures an operator `dispatchGrant` for `pending` rows (:443-451; delegate-dispatch-grant.ts:59-90).
   - ToolResult `scheduled` (:425-453), or `queued-for-compaction` for post-compaction (:393-422). Both strings are unchanged.
4. **Dispatch** (post-turn `dispatchToolDelegates`, or the hedge timer at the clamped due time; DS §A5):
   - span `continuation.delegate.dispatch` (delegate-dispatch.ts:393-402).
   - span `continuation.delegate.fire` **only when delivery is `timer`**, i.e. delay > 0. A 1 s request clamps to 5 s, which is a timer (:404-417).
   - spawn wrapped in **NEW** `runUnderContinuationDelegateDispatchGrant` (:457-493; grant.ts:96-155).
   - spawn task `[continuation:chain-hop:<h>] Delegated task (turn h/m): <task>` (delegate-dispatch-request.ts:43, unchanged).
5. **Return** (DS §A6-A7):
   - Every tool or bracket delegate carries a recipient binding, so returns take the targeted path (subagent-announce.continuation-return.ts:98-215; targeting.ts:249-411). This was already so at F.
   - silent → system event, no wake. normal and silent-wake → `delegate-return` wake via continuation-wake.ts (250 ms coalesce, `enqueueSessionEventForHost`).
   - **NEW:** stale-authority refusals at enqueue, wake, prompt-drain and replay leave failed receipts plus `[continuation:return-refused] stage=… reason=recipient-authority-changed` (return-refusal.ts; DS §B2, §D1-4).
   - Visible return text is unchanged except the Stats line: `tokens N prompt/cache` → `tokens N context` (DS §C).
6. **Post-compaction lifeboat** (post-compaction-delegate-delivery.ts):
   - Spawn task `[continuation:post-compaction] [continuation:chain-hop:<n>] Compaction just completed. Carry this working state to the post-compaction session: <task>` (:534-536).
   - **NEW** dispatch span `{delivery:"compaction", delegateMode:"post-compaction"}` (:484-494) and **NEW** fire span `{delegate.delivery:"compaction", compaction.id, fire.deferred_ms = now − firstArmedAt}` (:519-529; tracer :839). `firstArmedAt` is the staging time (delegate-store-post-compaction.ts:49, :332-336).
   - `chainId = sessionEntry.continuationChainId ?? randomUUID()` (:460).
   - **NEW:** maintenance compaction also releases staged lifeboats (agent-runner-memory.ts:502-510; agent-runner-post-compaction-release.ts:158-182).

### 2.3 request_compaction
1. **Schema.** request-compaction-tool.ts:71-86 (`reason` ≤1024, `focus` ≤4096). Name :291. `MIN_CONTEXT_THRESHOLD = 0.7` (:26).
2. **Guards.** `evaluateRequestCompactionGuards` :187-262, NEW extraction (commit dd32c17eba):
   - `already_pending` (:197-206).
   - **`{status:"rejected", guard:"context_unmeasured", cause:"no_fresh_usage"|"unknown_context_window"|"inventory_only", reason}`** when usage is not a number (:209-224; reasons :37-43). **At F the same condition returned `guard:"context_threshold"` with no contextUsage/threshold (F tool body).**
   - `{status:"rejected", guard:"context_threshold", contextUsage, threshold:70, reason}` (:226-239).
   - `rate_limit` 5 min (:241-259).
3. **Usage source.** `computeRequestCompactionContextUsage` agent-runner-post-compaction-release.ts:183-204. It returns `"no_fresh_usage"` when the session entry has no fresh `totalTokens` (a first turn, before any completed turn's totals). F returned `null` (F:149-170).
4. **Accept.** :337-449, `{status:"compaction_requested", …}` (:440). `triggerCompaction` → `compactQueuedEmbeddedAgentSession` → `releaseQueuedCompactionTolerant` → `continuation.compaction.released` span (agent-runner-post-compaction-release.ts:130-132; agent-runner-result.ts:172; agent-runner-result-accounting.ts:672).
5. **Built-in compaction trigger** (outside the continuation dir, but on R-CD-3's path). packages/agent-core/src/harness/compaction/compaction-threshold.ts:2-14 at P is `max(0, min(window − reserve, floor(window·0.75)), minimumThresholdTokens)`. At F (src/auto-reply/reply/memory-flush.ts:76-84) it was `max(0, window − reserve, minimumThresholdTokens)`. Changed by upstream `e0ed68c7b8` "fix(agents): compact long tool turns and refresh context totals (#190017)", 2026-11-01. The context-pressure bands now derive from it (context-pressure.ts `resolveTriggerPressureBand`, commit 337c01f8a5).

### 2.4 Telemetry
- Span names (continuation-tracer.ts:241-251): `continuation.work`, `continuation.work.fire`, `continuation.delegate.dispatch`, `continuation.delegate.fire`, `continuation.queue.enqueue`, `continuation.queue.fanout`, `continuation.queue.drain`, `continuation.compaction.released`, `continuation.disabled`. There is no `continuation.finalization` at F or at P; the R-CD-2 manifest already declares it `emittedByProduct:false`.
- Attributes are emitted unprefixed (`chain.id`, `delegate.mode`, `delegate.delivery`, `delay.ms`, `fire.deferred_ms`, `reason.hash`, `reason.length`, `reason.present`, `reason.redacted`). The OTEL adapter passes keys through unchanged (extensions/diagnostics-otel/src/continuation-tracer-adapter.ts:81-98).
  - `reason.hash` = sha256(redacted reason)[0:16]; `reason.length` = raw `.length` (tracer :560-581). Unchanged F→P.
- **NEW attrs:**
  - `delegate.delivery:"compaction"` and `compaction.id` on post-compaction fire spans (:839-840).
  - `queue.refused_count` and `refusal.reason` on drain spans (:965-966).
  - `fanout.recipient.outcomes` including `refused`, plus `fanout.refused_count` (:1006-1012).
- `openclaw.tool.execution` with `gen_ai.tool.name` comes from extensions/diagnostics-otel/src/service-recorders-tools.ts:36, :71, :152, :176, not from core. The trace-context normalizer moved to src/infra/diagnostic-trace-context.ts:66-92 with byte-equivalent logic.

### 2.5 Terminalization summary
- **Work:** delivered, then granted; or folded; or superseded; or reaped (orphan, parent confident-terminal); or failed.
  - Failed reasons: recipient-refused (no notice, **new**), not-granted warning, turn-interrupted notice (**new**), or retry-exhausted notice.
- **Delegate:** accepted → subagent_runs; or failed (`DELEGATE spawn …`, chain-capped, cost-capped, cross-session, maxDelegatesPerTurn, **new** grant refusals); or interrupted notice.
- **Return rows:** acked on prompt adoption, or failed-receipt on stale authority (**new**; F acked them).

---

## 3. Row → predicate → product transition (33 rows)

Static or read-only rows read pinned captures under `PROOFS/1cc8f4e3d617ef6f173283ef83d7b739a4995734/…` or other PROOFS SHAs, never the candidate (SP "READ-ONLY / STATIC ROWS"). They cannot observe P behavior. They are marked **STATIC** below.

| Row | Scenario | Predicates that touch product bytes (SP section) | P transition(s) exercised (file:line) | F→P delta on that path |
|---|---|---|---|---|
| R-CD-1 | r-cd-1-typed-delegate.js | toolResult `scheduled` bound by toolCallId plus `CD1-DELEGATE-SCHEDULED` in the parent text. The child bound by observer (spawnedBy + `[Subagent Task]` nonce). The child mints a token; a parent run ≠ dispatch run reproduces `CD1-RETURN`. Tempo: one dispatch, one fire (timer), one `openclaw.tool.execution` `gen_ai.tool.name=continue_delegate`, UUIDv4 `chain.id`, positive `fire.deferred_ms`. No FAIL path. | tool :425-453 → hedge dispatch delegate-dispatch.ts:393-493 → targeted return + `delegate-return` wake (continuation-wake.ts) | grant wrap (F4), return refusal (F7), Stats wording, description text (F8) |
| R-CD-2 | r-cd-2-silent-wake.js | send-run lifecycle end with `replayInvalid:true` (else FAIL); same-run `scheduled`; distinct wake run in the return window with `RCD2-WAKE-ACK` or heartbeat `notify:false/done`; no channel delivery; signed authority receipt (candidate==runtime SHA). Tempo as R-CD-1 with mode `silent-wake`. | Same as R-CD-1. A bound silent-wake return wakes with reason `delegate-return`, not delivery-suppressed (continuation-wake.ts:85-87, :194-196; DS §A7) | F4, F7. The replayInvalid marker files (embedded-agent-subscribe.handlers.lifecycle.ts:364-372, attempt-normalization.ts:379-383) have no replay-logic diff F→P |
| R-CD-3 | r-cd-3-post-compaction.js | Fill until `sessions.describe` fresh `totalTokens/contextTokens ≥ 0.75` (clamp 0.71-0.83), with a planner cap that assumes line = window − min(max(reserve,20k), window/4). Mid-fill compaction → PARTIAL. Staging `queued-for-compaction`+`post-compaction`. `compaction_requested` with numeric contextUsage for PASS. A released child whose task matches `^[continuation:post-compaction] [continuation:chain-hop:\d+] ` + token; minted token; parent return. Trace never affects the verdict. | tool :393-422 → request_compaction guards :187-262 → `releaseQueuedCompactionTolerant` → post-compaction-delegate-delivery.ts:460-536 | **F2 (HIGH)**, F9, F3 (new spans), maintenance release (DS §D10) |
| R-CD-4 | r-cd-4-target-session-key.js | parent and target disposable sessions created; target primed; target emits `TARGET-ACK` after the return wakes it; no parent return; child identity bound. The continue_delegate toolResult is never read. Needs `crossSessionTargeting:"enabled"`. Tempo as R-CD-1. | election cross-session gate :357-366; targeted return to the target (targeting.ts:249-411) with the target's recipient binding | F7 (target authority must not move), F4 |
| R-CD-CHAINED-DEPTH-2 | r-cd-chained-depth-2.js | `CHILD-DONE … CHILD-DELEGATE-SCHEDULED`, `GRANDCHILD-DONE`, `ROOT-CHAIN-ACK` bound to distinct identities. The nested toolResult is not read. Tempo as R-CD-1. | child tool delegate `[continuation:chain-hop:n] Tool-delegated from sub-agent (depth d): …` (subagent-announce.continuation.runtime.ts:550), now grant-wrapped (:544-590) | F4 (chained grant restore unverified), F7 |
| R-CD-COLLECTION-ON-COLLAPSE | static-corpus-row-validator.js | STATIC: pinned capture parse. Its trace receipts stay pending by design. | none live | none observable |
| R-CD-MODEL-CHAINED-ALT | r-cd-model-chained-alt.js | depth-2 child SERVED provider/model from its own chat.history equals `OPENCLAW_ALT_MODEL`; selection-only gives PARTIAL; fallback gives FAIL. Tempo as R-CD-1. | `model` param → `resolveSubagentSpawnModelSelection` (model-selection.ts:174-206, unchanged F→P) | F4; F8 (model description text only) |
| R-CD-MODEL-DEFAULT | r-cd-model-default.js | child served model equals the parent served baseline (typed + bracket forms). | No override: configured subagent model wins, else inherit (model-selection.ts:184-197). Same at F; only the description now says so (commit 6098a56348) | F8. A seat with `agents.defaults.subagents.model` set gives child ≠ parent, as at F |
| R-CD-MODEL-TOKEN | r-cd-model-token.js | bracket `model=` modifier observed; spawn task carries `[continuation:chain-hop:`; served model. Tempo with zero tool spans (raw-final-text). | signal.ts grammar (unchanged) → `enqueuePendingDelegate` with `electingOperatorAuthority` (signal handler :251-274) | F4 (bracket grant from `followupRun.operatorAuthority`) |
| R-CD-MODEL-TOOL | r-cd-model-tool.js | requested-model byte in the call; child served model. Tempo as R-CD-1. | as R-CD-MODEL-CHAINED-ALT | F4 |
| R-CD-RETURN-OVERLAP | r-cd-return-overlap.js | READ-ONLY: pinned flow/task/journal/tempo receipts; `journal-return-binding.mjs` greps `[continuation:targeted-return] Delivered to (\S+) from (\S+)`. | none live | The P logging change (DS §B11) would matter only for a fresh capture |
| R-CD-SILENT | r-cd-silent.js | `scheduled` + `RCDS-SCHEDULED`; the child minted `SILENTCHILD` token before the follow-up; follow-up accepted; a parent run ≠ dispatch reproduces the token; no channel delivery of the child report. | bound silent: system event, no wake; consumed at the next natural turn's prompt drain (session-system-events.ts; DS §A7) | F7 (new prompt-drain refusal stage), F4 |
| R-CD-TOKEN | r-cd-token-bracket-delegate.js | raw-final-text bracket from a lightContext origin child; exactly one token delegate child; PASS only via a direct `[Inter-session message] … sourceTool=subagent_announce sourceSession=<delegate>` row. Targeted returns give PARTIAL by construction (since 2273ef64d5, which predates F). Tempo zero tool spans. | bracket path as R-CD-MODEL-TOKEN; targeted return | Pre-existing PARTIAL; F4 |
| R-CONFIG-DEFAULTS | r-config-defaults.js | `config.get` → `payload.config.agents.defaults.continuation` must hold `enabled`, `maxChainLength`, `maxDelegatesPerTurn`, `costCapTokens` (types only). | config surface (types.agent-defaults.ts: doc-only diff F→P) | none |
| R-CONFIG-INTERSESSION | r-config-intersession.js | `…continuation.crossSessionTargeting === "enabled"`. | config.ts:128-129 | none |
| R-CW-1 | r-cw-1-tool-schedule-wake.js | `scheduled` + `CW-SCHEDULED`; the next user row starts `[continuation:wake]` and carries the nonce via the quoted reason; `CW-WOKE` in that turn. Tempo: one `continuation.work` (OK, UUIDv4 chain.id), ≥1 `continuation.work.fire`, one `openclaw.tool.execution` `gen_ai.tool.name=continue_work`. | §2.1 steps 2-8 (delay 5 s = minDelayMs) | **F5**: recipient binding, adoption refusal, turn-start fence, followup admission |
| R-CW-2 | r-cw-2-immediate-wake.js | as R-CW-1 with delaySeconds 0; "immediate" is not checked. | `clampDelayMs(0)=0`; anchored to turn finalization (work-dispatch.ts:670-698) | F5 (an immediate wake is the most exposed to "session still active", which means a fold or admission-refused) |
| R-CW-3 | r-cw-3-reason-telemetry.js | as R-CW-1; the raw reason `RAW-RCW3-<nonce>` must be absent from the public artifact and the Tempo JSON; the reviewer requires work and fire spans parented to the one tool span. | `continuationReasonAttributes` (tracer :562-581, unchanged) | F5 |
| R-CW-4 | r-cw-4-chain-depth.js | 3 hops, each a `scheduled` call inside the previous wake turn; `CW4-DONE`. No `chain.step` byte is read. Collector `scopeContinueWorkChain` (≤3 tool spans, each hop parents one OK `continuation.work` on the same chain.id). | delay 2 s → clamped 5 s with `note` (tool :105-109); chain reservation (signal :329-362) | F5 (per hop) |
| R-CW-7 | static-corpus-row-validator.js | STATIC (traceparent propagation captures). | none live | none |
| R-CW-DELEGATE-CHILD-LIVE | static-corpus-row-validator.js | STATIC. | none live | none |
| R-CW-DELEGATE-SELF-CONTINUATION | r-cw-delegate-self-continuation.js | Parent delegate; from the CHILD's chat.history: exactly one nonce-bound `continue_work` with `scheduled` plus `CHILD-CW-SCHEDULED … TOKEN`; a later `[continuation:wake]` row + `CHILD-HOP2-DONE`; the parent reproduces the token as `PARENT-RETURN`. Tempo: parent delegate dispatch/fire/tool. | delegate path §2.2, then child continue_work §2.1 on a subagent lane (work-dispatch-execution.ts:225-226) | F4, F5, F7; citation drift F10 |
| R-CW-DELEGATE-TOKEN | static-corpus-row-validator.js | STATIC. | none live | none |
| R-CW-MULTI-COLLAPSE | static-corpus-row-validator.js | STATIC. | none live | none |
| R-CW-MULTI | static-corpus-row-validator.js | STATIC. | none live | none |
| R-CW-TOKEN | r-cw-token-bracket.js | parent `sessions_spawn` accepted with childSessionKey; child `TOKEN-HOP1` with no typed continue_work; hop 2 after a `[continuation:wake]` row (not nonce-bound) or in another run, `TOKEN-HOP2-DONE … TOKEN`; parent `TOKEN-HOP2-RETURN`. Tool-trace: one `sessions_spawn` tool span. | bracket CONTINUE_WORK (§2.1 step 9) → steps 4-8 | F5 |
| R-OBS-1 | r-obs-1.js | only the agent-authored `OBS1-STATUS <nonce> BUILD/CONTEXT/CHAIN/ROUTE yes`; any `no` gives FAIL. | session_status card; status-continuation-line.ts unchanged F→P; status-message.ts context-window profile change (non-continuation) | low (see F15) |
| R-OBS-2 | r-obs-2.js | READ-ONLY corpus trace-tree. | none live | none |
| R-OBS-STATUS | r-obs-status.js | runs P's `formatStatusTextContinuationLine` body (signature must end `}): string \| undefined {`); `🔄 Continuation: chain 1/8` for 1/8, `undefined` for all-zero. | src/status/status-continuation-line.ts (no diff F→P, no diff P→R) | none |
| R-RC-1 | r-rc-1-threshold-reject.js | fresh disposable session; `tools.effective` lists `request_compaction`; the **first** turn calls it; PASS iff toolResult `status:"rejected"` **and** `guard:"context_threshold"` (contextUsage not required). Any other result → PARTIAL. Tool-trace: one `openclaw.tool.execution` `request_compaction`. | guards :187-262 with `getContextUsage` → `no_fresh_usage` on a first turn | **F1 (HIGH)** |
| R-RC-2 | r-rc-2-delegate-request-compaction.js | delegate child: turn 1 `continue_work` (5 s), wake `[continuation:wake]`+nonce, then `request_compaction` in the wake turn. PASS: `compaction_requested` + reports. HONEST-LIMIT: `rejected`+`context_threshold` with `contextUsage < threshold` + child report. `context_unknown` (rejected/context_threshold without numbers) → PARTIAL; any other guard → `other` → PARTIAL. | delegate §2.2 → child continue_work §2.1 → request_compaction §2.3 on the child's second turn | F5, F4; F6 (unmeasured now says `context_unmeasured`, which classifies `other`, still PARTIAL) |
| R-REGRESSION-TRAP-TESTS | r-regression-trap-tests.js | READ-ONLY: pinned evidence of 31/31 trap tests. | none live | none |
| R-TRACE-REDACTION-1121 | r-trace-redaction-1121.js | READ-ONLY: pinned redaction evidence. | (tracer reason attrs unchanged F→P) | none |

---

## 4. Risk flags (F→P product changes that can make a row non-PASS for product-semantics reasons)

### HIGH

**F1 — R-RC-1: first-turn request_compaction no longer answers `guard:"context_threshold"`.**
- Changed symbols:
  - `evaluateRequestCompactionGuards` request-compaction-tool.ts:209-224 (new branch `guard:"context_unmeasured"`, `cause:"no_fresh_usage"`).
  - `computeRequestCompactionContextUsage` agent-runner-post-compaction-release.ts:183-204 (returns `"no_fresh_usage"` instead of `null`).
  - Commit `dd32c17eba` "fix(continuation): truthful request_compaction rejection when usage is unmeasured".
- Why it matters:
  - R-RC-1 creates a fresh disposable session and immediately sends the request_compaction turn (scenarios/r-rc-1-threshold-reject.js:102-117, 158-209).
  - The entry has no fresh `totalTokens` until a turn completes, so P returns `context_unmeasured`.
  - The PASS predicate is `status==='rejected' && guard==='context_threshold'` (lib/request-compaction-receipt.js:93-99). At F the unknown branch satisfied it (SP R-RC-1 §1: "the unknown-usage rejection branch also passes").
  - Expected at P: `non_threshold_result`, so the VU verdict is **PARTIAL-candidate** for a product-semantics reason.
  - The only P path to PASS is a measured `context_threshold`, which needs a completed prior turn in that session. The scenario has no priming turn.
- R-RC-2 and R-CD-3 classify the new guard as `other` and stay PARTIAL as before (F6). Their lib comments cite the removed branch (`request-compaction-tool.ts:211-217` @41b8d69b90; `:236-243` @f15237ec92).

**F2 — R-CD-3: the built-in auto-compaction line moved down to 75% of the window, exactly the row's default fill target.**
- Changed symbol: `resolveCompactionThreshold` packages/agent-core/src/harness/compaction/compaction-threshold.ts:2-14 at P is `min(window − reserve, floor(0.75·window))`. At F it was `window − reserve` (F:src/auto-reply/reply/memory-flush.ts:76-84). Upstream `e0ed68c7b8` (#190017). Consumers: `resolveBuiltInCompactionTrigger` (memory-flush-plan.ts:124-147), embedded attempt-setup.ts:4.
- Compounding P changes:
  - Maintenance/preflight compaction now **releases staged post-compaction delegates** (agent-runner-memory.ts:502-510; agent-runner-post-compaction-release.ts:158-182; DS §D10).
  - Context-pressure events are now trigger-relative (context-pressure.ts `resolveTriggerPressureBand`, `buildTriggerPressureEvent`; commit 337c01f8a5). See F9.
- Why it matters:
  - The harness models the line as `window − min(max(reserve,20k), floor(window/4))` and caps the fill below it (lib/r-cd-3-lifeboat.mjs:71-98). Its fill target defaults to 0.75 (lib/r-cd-3-lifeboat.mjs:60; clamp 0.71-0.83 at scenarios/r-cd-3-post-compaction.js:136).
  - For a 200k window: harness line 180k (cap 176k); P line **150k**; fill target **150k**.
  - Likely outcomes:
    - (a) a fill turn or its preflight compacts → "mid-fill compaction" → PARTIAL (scenarios/r-cd-3-post-compaction.js:309-317);
    - (b) the proof turn's preflight compacts before the model stages the lifeboat;
    - (c) after compaction, request_compaction measures below 70% (`threshold_rejected_measured` → PARTIAL) or unmeasured (`context_unmeasured` → `other` → PARTIAL).
  - At P the usable band is 70% ≤ fill < 75%, minus the proof turn's own growth.
- Exceptions:
  - `minimumThresholdTokens` (Responses server compaction) can raise the line for some provider/models.
  - Runtimes that own their own compaction (non-built-in harness) do not use this function.
  - So the effect depends on the seat and model.
- Operator note (not a prescription): `OPENCLAW_RCD3_FILL_TARGET` (floor 0.71) and `OPENCLAW_RCD3_COMPACTION_RESERVE_TOKENS` (scenarios/r-cd-3-post-compaction.js:136, 141) are the existing knobs. Neither changes the harness's formula for the line.

### MEDIUM

**F3 — R-CD-3 trace receipts can now be produced (stale harness expectation, not a failure).**
- Changed symbols: `deliverQueuedPostCompactionDelegate` now emits `startContinuationDelegateSpan({delivery:"compaction", delegateMode:"post-compaction"})` and `emitContinuationDelegateFireSpan({compactionId, fireDeferredMs: now − firstArmedAt})` (post-compaction-delegate-delivery.ts:484-529; tracer :839-840; commit `e0466a097e`). F emitted neither.
- Why it matters:
  - The scenario comment (scenarios/r-cd-3-post-compaction.js:205-207) and manifest census (manifests/r-cd-3.json:113) say these spans do not exist.
  - At P they do, with `delegate.mode="post-compaction"` (public projection allows it), a UUIDv4 `chain.id` (:460), and a positive `fire.deferred_ms` anchored at staging time (delegate-store-post-compaction.ts:49, :332-336). That satisfies the collector's causal-window rule (collect:273-322).
  - The verdict is unaffected (the trace is review debt). A reviewer should expect `tempo-trace-json`/correlation to be **held** when the lifeboat is released, not pending.

**F4 — Operator dispatch grant on every timer delegate (new refusal path; production scoping unverified).**
- Changed symbols:
  - `captureContinuationDelegateDispatchGrant` / `runUnderContinuationDelegateDispatchGrant` (delegate-dispatch-grant.ts:59-155, NEW).
  - Wrap sites delegate-dispatch.ts:457-493 and :595-613; subagent-announce.continuation.runtime.ts:544-590, :646-669.
  - Bracket elections pass `followupRun.operatorAuthority` (agent-runner-continuation-signal.ts:273). Details: DS §B1, §D6.
- Why it matters:
  - The harness drives turns over an operator WebSocket, so its elections can carry a grant. Every typed or bracket delegate row with delaySeconds ≥ 1 (clamped to 5 s → hedge timer) dispatches from the timer.
  - Affected rows: R-CD-1, R-CD-2, R-CD-4, R-CD-CHAINED-DEPTH-2, R-CD-MODEL-*, R-CD-SILENT, R-CD-TOKEN, R-CW-DELEGATE-SELF, R-RC-2.
  - The restore needs `getPluginRuntimeGatewayRequestScope()?.resolveGatewayContext ?? ctx.resolveGatewayContext` (grant.ts:114-119). The post-turn caller passes no `resolveGatewayContext` (agent-runner-continuation-schedule.ts:62-68).
  - P tests assert that a timed operator delegate spawns after the connection closes (subagent-spawn.continuation-operator-grant.test.ts:350, :553). Whether a production timer inherits the request scope was **not traced**.
- Failure signatures:
  - `[continuation:delegate-spawn-failed] error=Continuation delegate operator dispatch grant has no Gateway to restore it.`, or `… expired.` / `… was revoked…`.
  - Owner system event `[continuation] DELEGATE spawn failed: …`.
  - Election-time throw `Continuation delegate election requires the operator's Gateway binding.`
  - The retryable branch requeues every 30 s with phase `Waiting for the Gateway to restore its grant`. Each retry re-emits dispatch (and fire) spans, which breaks the collector's "exactly one accept / one fire span" rule (collect:450-481).
- Rows would show "no child" (PARTIAL), not FAIL. Grep the journal for `delegate-grant-unavailable|operator dispatch grant|delegate-spawn-failed` before attributing a missing child to the seat.

**F5 — continue_work wake admission rewired: recipient-authority binding, adoption refusal, durable turn-start fence, "run now or refused" followup admission.**
- Changed symbols:
  - `captureWorkElectionAuthority` (work-operator-continuation.ts:34-52, commit 77e4440903).
  - `refuseStaleContinuationWork` (work-recipient-authority.ts:102-152), at dispatch (work-dispatch.ts:530), adoption (work-dispatch-execution.ts:267-269) and folds (:440-478).
  - `markPendingWorkTurnStarted` (work-store.ts:103-152, commit 2186878dee), plus interrupt-on-consume (work-store.ts:273-282).
  - get-reply-run-admission.ts:516-525 (commit 7571deea1d) with `CONTINUATION_TURN_ADMISSION_REFUSED_REASON` (work-dispatch-execution.ts:38, :124-132, :359-368).
  - The wake now runs under a pre-minted `runId` (:275, :326).
- Why it matters (affected rows: R-CW-1/2/3/4, R-CW-DELEGATE-SELF, R-RC-2, R-CW-TOKEN):
  - (a) At F a wake that met an active or queued session could be enqueued as a follow-up and would still write a `[continuation:wake]` user row. At P it is refused and requeued with busy backoff (1 s, 2 s, 4 s…). If the session is active when the retry fires, an anchor-finalized wake is **folded** (work-dispatch.ts:574-600). A fold writes `[system:continuation-note]` and no `[continuation:wake]` row. The CW binder then breaks the hop → PARTIAL (lib/continue-work-chain.mjs:28-32, 112-116). Disposable sessions with no other traffic make this unlikely. It is most exposed for R-CW-2 (delay 0) and child sessions (R-CW-DELEGATE-SELF, R-RC-2) whose announce run may still be active.
  - (b) Each attempt emits another `continuation.work.fire` span (work-dispatch-execution.ts:560-568). The work collector allows ≥1 (SP C-TRACE), so this is safe for traces.
  - (c) A recipient-authority change (session delete, owner or visibility change) between election and wake fails the record silently: no wake, no notice, only `[continuation:work-refused]` and a drain span with `queue.refused_count` (return-refusal.ts:25, :44; work-recipient-authority.ts:132-149). This matters only if a harness cleanup deletes a session while its wake is pending.
  - (d) A Gateway restart mid-wake now ends the work as `turn-started-delivery-unconfirmed` with a `[continuation:work-turn-interrupted]` notice, never a re-drive (work-store.ts:154-166, work-terminal-notice.ts:49-69).
  - (e) A failed authority capture at election (e.g. an incognito/memory session) throws after the tool already said `scheduled` (signal handler :484-492: `[continuation] continue_work scheduling failed…`). The harness does not create incognito sessions, so this is not exercised.

**F7 — Delegate returns refused on stale recipient authority (new failed-receipt semantics).**
- Changed symbols: return-refusal.ts (NEW), targeting.ts:261-280/:343-347/:369-373, session-system-event-adoption.ts:123-146/:202-207, continuation-wake.ts:214-220, server-restart-sentinel-delivery.ts:51-77 (DS §B2, §B4, §B13, §D1-4).
- Why it matters:
  - R-CD-4's target, and every requester of a delegate row, must keep its recipient epoch from election to adoption.
  - Same-owner `/new`/`/reset` keep the epoch. Delete, recreate, owner change and visibility narrowing advance it.
  - A refused return produces no wake and a failed receipt. The row sees "no return" (PARTIAL).
  - Signature: `[continuation:return-refused] stage=<enqueue|wake|prompt-drain|replay> reason=recipient-authority-changed`.
  - The `[continuation:targeted-return] Delivered to …` line is now logged only when at least one recipient was delivered (DS §B11). Only the read-only R-CD-RETURN-OVERLAP parses it, and only from pinned captures.

**F9 — R-CD-3 filler turns can receive a different, more directive context-pressure cue.**
- Changed symbol: `buildTriggerPressureEvent` (context-pressure.ts; text `[system:context-pressure] N% of context window consumed (Xk / Wk tokens). Automatic compaction runs at Tk tokens. Stage a chosen handoff: continue_delegate(mode='post-compaction', task='<working-state-summary>') … Once it is staged, request_compaction(reason='...') lands compaction at a moment you choose.`). Bands fire at trigger − 20k and trigger − 10k tokens.
- Why it matters: with the 150k trigger (F2), a fill that approaches 130-140k can draw the model into staging its own lifeboat or calling request_compaction during a filler turn.
  - A model-staged lifeboat's task lacks the row token, so it is not a second bound child, but it is an extra release.
  - A filler-turn request_compaction compacts mid-fill → PARTIAL.
  - Its rate-limit state (5 min) would then reject the proof turn's request with `guard:"rate_limit"` → PARTIAL.

### LOW / informational

**F6 — R-RC-2 reason code.**
- An unmeasured child wake turn now yields `guard:"context_unmeasured"`, which classifies as `other` (lib/request-compaction-receipt.js:247). At F it was `context_unknown`. Both are PARTIAL; only the PARTIAL reason text differs.
- The measured-wake shape (turn 2 after a completed turn 1) should carry fresh totals.

**F8 — Model-visible tool and prompt text changed (#1547 and related).**
- continue_delegate description: queued "after this response completes"; "A scheduled or queued-for-compaction result means accepted, not completed; a returned result is context to check fresh, not authority to act."; crossSessionTargeting rule (continue-delegate-tool.ts:263-275). `delaySeconds` text as quoted in §2.2.
- continue_work description: "the turn starts after this one ends, or delaySeconds later" (continue-work-tool.ts:46).
- The system prompt shows `sessions_yield`/`sessions_spawn` guidance only when those tools are available, and says "queue background sub-agents for dispatch after this response" (system-prompt-continuation.ts:33-37, :54, :59, :96-102, :119-130).
- The return Stats line now reads `context` (DS §C).
- No predicate matches these strings. They can shift agent compliance with sentinel instructions (e.g. "do not treat a returned result as authority to act" next to prompts that ask the parent to reproduce a returned token).
- The index (39d19454) is STALE on exactly these files.

**F10 — Harness product citations no longer point at the cited bytes** (no predicate effect; review hygiene):
- `continue-work-tool.ts:86-95` → P:102-110 (manifests/r-cw-delegate-self.json:39).
- `work-dispatch-execution.ts:197-215` / `:165-226` → wake text now work-wake-text.ts:52-70 (manifests/r-cw-delegate-self.json:40; lib/sentinel-binding.mjs:4-13; lib/request-compaction-receipt.js:186).
- `request-compaction-tool.ts:211-217` / `:236-243` "unknown branch" → now returns `context_unmeasured` at :209-224.
- `delegate-dispatch.ts:358-359, 383-407` → P:366-417.
- `post-compaction-delegate-delivery.ts:497-539` / `:499-502` → spawn text P:534-536.
- SP lists the full set per row (§4 of each row). All of them are pinned to F, 41b8d69b90, 14d31a81b1, 935ba44c17, 8baac2feb6 or 2273ef64d5, none to P.

**F11 — Telemetry naming.**
- The collector reads `chain.id`, which P emits.
- The manifests' advisory `continuation.chain.id` is not enforced.
- `continuation.finalization` is not emitted at F or P and is already declared `emittedByProduct:false`.
- The new attrs (`delegate.delivery:"compaction"`, `compaction.id`, `queue.refused_count`, `refusal.reason`, `fanout.refused_count`) are dropped by the public projection and are not read by the collector.

**F12 — The P→R delta does not touch the continuation surface.**
- `git diff --stat 51ff02dc ab5a30ea` over every file named in §2, including extensions/diagnostics-otel and compaction-threshold.ts, is empty.
- R adds owner-account room-queue protection: queue/enqueue.ts, discord/slack/telegram ingress, get-reply-run-execute.ts. It is keyed on channel-verified account provenance for discord/slack/telegram room events, so the WS `sessions.send` traffic of the rows is not in its scope.

**F13 — Delegate behavior changes that rows do not exercise.**
- `/new`/`/reset` keep delegates and re-arm them (DS §D7).
- `/continuations cancel` (DS §D8).
- Session-store pruning keeps custody owners (DS §D9).
- Plugin-generation re-admission on timers (DS §D11).
- The incognito fanout refusal (DS §D5).
- Offline fence drain (`openclaw continuations`) — relevant to seat **downgrades** below the fence, not to rows.

**F15 — Pre-existing conditions (unchanged F→P) that can still make a row non-PASS.** These are listed so they are not misattributed to P:
- R-CD-TOKEN is PARTIAL by construction while returns are targeted (since 2273ef64d5).
- R-OBS-1's CHAIN answer depends on the agent's reading of a card whose continuation line is omitted for an all-zero session (status-continuation-line.ts, unchanged).
- R-CD-MODEL-DEFAULT fails on a seat whose config sets a subagent model.
- R-CONFIG-DEFAULTS depends on `config.get` returning the four keys explicitly.
- R-CD-4 and R-CONFIG-INTERSESSION need `crossSessionTargeting:"enabled"` on the seat.
