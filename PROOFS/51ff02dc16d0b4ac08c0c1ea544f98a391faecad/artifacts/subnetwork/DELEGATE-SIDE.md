# continue_delegate side, P = 51ff02dc16d0b4ac08c0c1ea544f98a391faecad vs F = f15237ec921879d918482cdf372b0718d4c1aab9

Source: read-only, from the detached worktree /tmp/k6ab5a-oc-51ff (HEAD = P) and `git diff F P` in the openclaw repo. Line numbers are at P unless marked `F:`. Paths are relative to the repo root.
Unchanged F→P (`git diff --numstat` empty): signal.ts, scheduler.ts, targeting-pure.ts, delegate-spawn-authority.ts, delegate-spawn-acceptance.ts, delegate-dispatch-request.ts, delegate-dispatch-chain-state.ts, delegate-dispatch-accepted-children.ts, delegate-system-event.ts, delegate-store-post-compaction.ts, post-compaction-{chain-charge,rejection,staleness}.ts, config.ts, delegate-spawn-interrupted.ts, continuation-dispatch-claims.ts, system-event-ownership.ts, post-compaction-delegate-acceptance.ts, src/agents/internal-events.ts, src/agents/subagent-announce-message.ts, src/agents/subagents/announce/subagent-announce.ts.
New since F (they do not exist at F): delegate-dispatch-grant.ts, return-refusal.ts, detached-generation.ts, src/auto-reply/reply/commands-continuations.ts.

---

## A. The continue_delegate path at P, step by step

### A1. Tool registration and schema (src/agents/tools/continue-delegate-tool.ts)
- Name `continue_delegate`, label `Continuation` (:261-262). The description is the joined array at :263-275.
- Modes: `DELEGATE_MODES = ["normal","silent","silent-wake","post-compaction"]` (:41). Fanout modes come from `CONTINUATION_DELEGATE_FANOUT_MODES` (:42).
- `task`: string, maxLength 4096 (:53-57).
- `delaySeconds` description, verbatim (:62-63): `"Seconds to wait before spawning the delegate. 0 or omitted = dispatch after this response ends. Positive delays are clamped to continuation.minDelayMs / maxDelayMs from config."` minimum 0. **F→P:** at F the middle sentence read `0 or omitted = immediate.` This is a text-only change. The behavior is the same: omitted or 0 leaves `delayMs` undefined or 0 (:311-313, :353-356), and the delegate is consumed after the response finalizes (A5).
- `mode` description (:67-72): `"normal" = announces to channel (default). "silent" = result injected as internal context only, no channel echo; ... "silent-wake" = silent + triggers a new generation cycle ... "post-compaction" = silent-wake delegate that fires when compaction happens, not on a timer. ...` Unchanged.
- `targetSessionKey` (:74-80), `targetSessionKeys` (:81-87), `fanoutMode` tree|all (:88-92), `model` (:93-100; **F→P text:** `Omitted or "default" = use the configured subagent model, or inherit the parent session's model when none is configured. Use a provider/model identifier.`), `attachments` maxItems 50 (:101-115; text reworded), `attachAs.mountPath` (:116-129).
- **F→P description changes (text only; all model-visible):** first sentence now `Delegate a bounded objective into a continuation tree: the delegate is queued for dispatch after this response completes, after delaySeconds, or when this session compacts, ...` (:264). New sentences: direct-spawn/yield pointer (:267), model sentence (:269), reworded silent/silent-wake/post-compaction sentence (:270), `A scheduled or queued-for-compaction result means accepted, not completed; a returned result is context to check fresh, not authority to act.` (:271), and the crossSessionTargeting rule (:274).

### A2. execute: input checks (all throw ToolInputError, so the model gets an error toolResult; unchanged F→P)
- Throws when there is no session: `continue_delegate requires an active session. Not available in sessionless contexts.` (:284-288). Empty task throws (:291-293). Attachment validation (:294-305). Unknown mode: `Unknown mode "<m>". Valid modes: normal, silent, silent-wake, post-compaction` (:316-320).
- fanoutMode combined with explicit targets throws (:332-338).
- traceparent is always runtime-captured; model input is ignored (:346).
- `delayMs` is clamped only when >0: `clampDelayMs` (:353-356). Defaults are min 5000, max 300000 (config.ts:16-17).
- Cross-session gate at election, when `crossSessionTargeting === "disabled"` and `hasCrossSessionDelegateTargeting` (:357-366). It throws `cross-session continuation targeting is disabled by agents.defaults.continuation.crossSessionTargeting. Use the default return target, targetSessionKey set to this session, or fanoutMode="tree".`

### A3. Turn admission
- `reserveContinueDelegateTurnSlot(sessionKey, maxDelegatesPerTurn)` (:373-374). The slot is claimed synchronously (delegate-turn-admission.ts:49-77) and reset per provider turn (delegate-turn-admission.ts:37-41; caller src/agents/embedded-agent-runner/run/continue-delegate-turn-budget.ts:14). Default cap 5 (config.ts:20).
- Refusal toolResult (:378-389): `{status:"rejected", guard:"maxDelegatesPerTurn", reason:"would exceed maxDelegatesPerTurn cap (N/M already scheduled this turn)", delegatesThisTurn, limit, queuedDelegateDepth, pendingQueuedDelegates, runnablePendingDelegates, scheduledPendingDelegates, stagedPostCompactionDelegates}`.
- Chain-length and cost caps are **not** checked by the tool. They apply at dispatch (A5). The bracket form checks both at election (A4).

### A4. Election and persistence (toolResult)
- post-compaction (:393-422): calls `stagePostCompactionCustodyDelegate`, which runs `createDelegateRecord` with controller `post-compaction` and kind `post_compaction` (delegate-store-post-compaction.ts:41-69; delegate-flow-store.ts:456). There is no delay and no dispatch grant (flow-store:444-451). ToolResult: `{status:"queued-for-compaction", mode:"post-compaction", delegateIndex, delegatesThisTurn, [attachmentCount], [attachAs], ...targeting, [model], note:"Delegate will fire when compaction occurs, not on a timer. The shard starts at the moment of compaction and returns to the post-compaction session. Chain tracking applies at dispatch time."}`.
- normal/silent/silent-wake (:425-453): debug log `[continue_delegate:enqueue] ...` (:425-427), then `enqueuePendingDelegate(sessionKey, delegate)` (:438). That is controller `pending` and kind `delegate` (delegate-store.ts:205-224), with `dueAt = createdAt + delayMs` (delegate-flow-store.ts:467). ToolResult: `{status:"scheduled", mode, delaySeconds:<clamped s or 0>, delegateIndex, delegatesThisTurn, ..., note:"Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."}`.
- If the durable write throws, the slot is released and the error is rethrown as an error toolResult (:454-458).
- `createDelegateRecord` (delegate-flow-store.ts:420-475) does two things before the record exists:
  - (a) It binds recipient authority: the existing binding, or `createContinuationRecipientAuthorityBinding` (:434-442). With no targeting, the binding is the requester itself (recipient-authority-binding.ts:70-77). With fanout it is `{selection:"pending"}` (:65-68).
  - (b) **New at P:** it sets `dispatchGrant` for controller `pending` only (:443-451; see B1).
- Status strings the tool returns: `scheduled`, `queued-for-compaction`, `rejected` (guard `maxDelegatesPerTurn`). None changed F→P.

### A4b. Bracket token form (src/auto-reply/continuation/signal.ts; unchanged F→P)
- Grammar, end-anchored on the trimmed final text: `/\[\[\s*CONTINUE_DELEGATE:\s*((?:(?!\]\])[\s\S])+?)\s*\]\]\s*$/` (:221-223, inside `parseContinuationSignal` :209). The last payload that carries a marker wins (`extractContinuationSignal` :369, loop :399-410). The bracket outranks a tool continue_work (:438-445).
- Body: `task [+Ns] [| directive]*`. Trailing `|` segments are parsed right to left (:159-185):
  - `normal`
  - `silent`
  - `silent-wake` or `silent wake`
  - `post-compaction`, `postcompaction` or `post compaction`
  - `target=` / `targetsessionkey=` / `target_session_key=`
  - `targets=` / `targetsessionkeys=` / `target_session_keys=` (comma list)
  - `fanout=` / `fanoutmode=` / `fanout_mode=` with value `tree|all`
  - `model=` (`default` means no override)
  - `traceparent=` is swallowed (`parseDelegateDirective` :52-157)
- An unknown segment stops parsing and stays in the task text. An invalid segment, or fanout combined with targets, makes the whole token null.
- Delay `+Ns` is parsed after the directives are stripped (:243-250), so it must come right after the task, before any `|`. The task is truncated to 4096 (:251-256). The display text is stripped with the same regex (:316).
- The bracket is admitted in src/auto-reply/reply/agent-runner-continuation-signal.ts:
  - post-compaction is staged first, with no caps (:82-115). System event: `[continuation:delegate-staged-post-compaction] Bracket delegate staged for post-compaction release: <task>`.
  - Otherwise the chain cap uses `currentChainCount + queued pending` (:126-145). System event: `[continuation] Bracket continuation rejected: chain length N reached.`
  - Cost cap (:146-162). System event: `[continuation] Bracket continuation rejected: cost cap exceeded (a > b).`
  - Cross-session (:170-214). System event: `[continuation] Delegate rejected: cross-session targeting is disabled by policy. Use the default return target, targetSessionKey set to this session, or fanoutMode="tree".`, plus a disabled span `policy.cross_session_targeting`.
  - Delay is clamped to [min,max] (:242-245). Enqueue (:251-274). **F→P:** it now passes `{ electingOperatorAuthority: followupRun.operatorAuthority }` (:273).

### A5. Dispatch, after the response or on the hedge timer (src/auto-reply/continuation/delegate-dispatch.ts)
- Post-turn caller: src/auto-reply/reply/agent-runner-continuation-schedule.ts:53-83. Its `ctx` carries channel/account/to/thread and **no** `resolveGatewayContext`.
- `consumePendingDelegates` takes due rows (:117-120). The rest arm a hedge at the earliest due time (:124-154; hedge B5). Inherited silent/wake is annotated per row (:131-138).
- Admission partition: accepted, interrupted or pending (:171-179). Interrupted claims are terminalized with a notice (:245-254).
- Over the per-turn cap at dispatch (:256-266): `markPendingDelegateFailed("Tool delegate rejected: maxDelegatesPerTurn exceeded (N).")`. Owner system event: `[continuation] Tool delegate rejected: maxDelegatesPerTurn exceeded (N). Task: <task>`.
- Cross-session at dispatch (:276-304): `Tool delegate rejected: cross-session targeting is disabled by policy.`, plus a system event and a disabled span.
- Budget (:313-333; scheduler.ts:19-42): `Tool delegate rejected: chain-capped.` or `cost-capped.`, plus a system event. Defaults: chain 10, cost 500000 (config.ts:18-19).
- Hop: `nextHop = currentChainCount+1`, or the persisted plan (:335-338).
- Silent/wake: the delegate's own mode wins; otherwise it inherits from the chain (:358-366).
- Spans: dispatch span (:393-402). Fire span only when `delivery==="timer"` (:404-417).
- Spawn fence: `revalidatePendingDelegateForSpawn` (:445-456) logs `[continuation:delegate-spawn-fenced]` and sends system event `[continuation] <summary> Task: ...`.
- **Spawn (F→P: now wrapped)** at :457-493: `runUnderContinuationDelegateDispatchGrant({grant: delegate.dispatchGrant, ownerSessionKey, resolveGatewayContext: ctx.resolveGatewayContext}, () => spawnSubagentDirect(buildDelegateSpawnRequest(...), {...continuationDelegateAdmission}))`.
- Spawn task prefix (delegate-dispatch-request.ts:43; unchanged): `[continuation:chain-hop:<hop>] Delegated task (turn <hop>/<max>): <task>`. The request passes `silentAnnounce`, `wakeOnReturn`, targets, fanout, `continuationRecipientAuthorityBinding` and `drainsContinuationDelegateQueue` (:44-69).
- Accepted (:495-545): log `[continuation:delegate-spawned] hop=h/m mode=... session=... task=...`. Owner system event: `[continuation:delegate-spawned] Spawned turn h/m: <task>` (:502-505). Then the chain state is persisted, `commitPendingDelegateSpawnAcceptance`, `confirmAccepted`, and the record hands off to subagent_runs.
- Non-accepted outcomes:
  - Uncertain: an interrupted notice (:546-548).
  - `cancelled`: requeued with phase `Admission cancelled before spawn` (:549-559).
  - Other: `DELEGATE spawn <status>: <reason>`, plus system event `[continuation] DELEGATE spawn <status>: <reason> Task: ...` (:560-573).
  - Thrown: `[continuation:delegate-spawn-failed] error=...` (:594). If the spawn never ran: `[continuation] DELEGATE spawn failed: <msg>. Task: ...` (:619-623). **New at P:** grant-retry branch (:595-613; B1).
- Chain-hop delegates from inside a child (src/agents/subagent-announce.continuation.runtime.ts):
  - Child tool delegates use prefix `[continuation:chain-hop:<n>] Tool-delegated from sub-agent (depth <d>): <task>` (:550). They are now also grant-wrapped (:544-545).
  - Child bracket delegates are enqueued on the child session key (:398-413) and drained through `dispatchToolDelegates` (:140-160).
- Post-compaction release spawn task (src/auto-reply/reply/post-compaction-delegate-delivery.ts:534-536): `[continuation:post-compaction] [continuation:chain-hop:<n>] Compaction just completed. Carry this working state to the post-compaction session: <task>`. It defaults to silent-wake (`silentWake ?? true`, :464-465) and passes the recipient binding (:546-548).

### A6. Child completion → return routing (src/agents/subagent-announce.continuation-return.ts; called from src/agents/subagents/announce/subagent-announce.ts:552-584)
- `hasTargeting` is true when there is a target key, a target list, fanout **or a recipient binding** (:98-103). Every `createDelegateRecord` row carries a binding (A4), so every tool or bracket delegate, including the default-target "normal" delegates, takes the **targeted branch** (:104-215). F was identical here (F:98-103).
  - Recipients: frozen tree keys, frozen "all" selection, or `resolveContinuationReturnTargetSessionKeys` (:113-137). Then the `shouldIgnorePostCompletionAnnounceForSession` filter (:139-146). Fanout=all binds its selection at return (:154-163).
  - `enqueueContinuationReturnDeliveries({ text: triggerMessage || "[continuation:enrichment-return] Delegate completed: <taskLabel>", idempotencyKeyBase: "continuation-return:<announceId>", wakeRecipients: wakeOnReturn===true || silentAnnounce!==true, recipientAuthorities, holdForReset, ... })` (:167-188).
- Per recipient (src/auto-reply/continuation/targeting.ts:249-411):
  - authority check (:277-280)
  - durable row written with `awaitPromptAdoption:true`, `returnWake` and idempotency key `<base>:<sessionKey>` (:281-307)
  - authority re-check, then the reset-hold check or a system-event enqueue owned by the recipient agent (:313-342)
  - third authority check (:358-374)
  - queue-full hold arms a retry (:376-394)
  - otherwise `requestContinuationWake({reason:"delegate-return", ...})` when `wakeRecipients` (:395-403)
- Untargeted silent branch (:217-283): reached only by **unbound (legacy) silent** returns. Wake reason is `silent-wake-enrichment` (:254-256, :273-281).
- Non-silent unbound → `{handled:false, continuationTriggerOverride:"delegate-return"|"subagent-return"}` (:285-293) → ordinary `deliverSubagentAnnouncement` (subagent-announce.ts:592-622).

### A7. Silent vs silent-wake (bytes, unchanged F→P)
- Bound path:
  - silent: `wakeRecipients=false`, so no wake. The event waits in the recipient's system-event queue for its next natural turn (prompt drain).
  - silent-wake and normal: `wakeRecipients=true`. The wake has reason `delegate-return` (targeting.ts:240-247, :395-403).
- In continuation-wake.ts:85-87, `silent = reason === "silent-wake-enrichment"`. So a bound silent-wake wake has `silent=false`: its woken turn is not given `deliver:false` / `replyExpectation:"optional"` (continuation-wake.ts:194-196). Only the unbound silent branch requests a transport-silent wake.
- Wake handoff (continuation-wake.ts:127-260): 250 ms coalesce (:41). Authority decision under writer admission (:163-180). Then `enqueueSessionEventForHost(occurrences.map(e=>e.text).join("\n"), {source:"continuation", sourceRunId, continuation:{continuationTrigger:"delegate-return", parentRunId, continuationInputDeliveries}})` (:187-208). Rows are acked on adoption (:209-226, `acknowledgeAdoptedReturns` :259).
- Trigger mapping: `delegate-return` and `silent-wake-enrichment` both give `continuationTrigger "delegate-return"` (:72-76).

### A8. Persistence and terminalization
- Custody record kinds are `delegate` and `post_compaction`, status `queued` (delegate-flow-store.ts:456-470). State fields include `recipientAuthorityBinding` (delegate-flow-state.ts:115) and **new** `dispatchGrant` (delegate-flow-state.ts:134-140, :274; projected at delegate-flow-store.ts:196).
- Terminal outcomes: accepted means handoff to subagent_runs (delegate-dispatch.ts:513-531). Otherwise `markPendingDelegateFailed` (status failed, `failureReason`), or `terminalizeInterruptedDelegateClaim`.
- Return rows live in the session delivery queue. They settle with `ackSessionDelivery` only on prompt adoption (session-system-events.ts:259-269, ack at :265). **New at P:** a refused row settles with `moveSessionDeliveryToFailed(..., {keepFailedReceipt:true})` (return-refusal.ts:53-66).

---

## B. F→P per file (behavior vs refactor)

### B1. delegate-dispatch-grant.ts (NEW, 155 lines). Behavior.
- `captureContinuationDelegateDispatchGrant` (:59-90).
  - Source authority: the explicit `electingOperatorAuthority`, else `captureAmbientGatewayOperatorAuthority` (:64-69).
  - That capture can **throw at election**: `Continuation delegate election requires the operator's Gateway binding.` (:67-68; thrown at operator-invocation-authority.ts:118-124 when an operator client has no context). It can also throw from `authority.assertCurrent()` (operator-run-recovery-source.ts:31).
  - Only a `gateway`-kind source is kept. If the source is `unavailable`, it logs info `[continuation:delegate-grant-unavailable] session=<k> dispatches under its arming request` (:75-78) and keeps no grant.
  - `expiresAt = dueAt + 3_600_000` (`CONTINUATION_DELEGATE_GRANT_SLACK_MS`, :39, :85).
- `runUnderContinuationDelegateDispatchGrant` (:96-155). Without a grant it runs as before (:105-107). Otherwise it throws `Error("Continuation delegate operator dispatch grant <reason>[: cause].")` (:48-53) for each of these reasons:
  - `belongs to another session` (owner mismatch, :108-110)
  - `expired` (:111-113)
  - `has no Gateway to restore it` (:117-119). The resolver used is the ambient `getPluginRuntimeGatewayRequestScope()?.resolveGatewayContext ?? params.resolveGatewayContext` (:114-116).
  - `was revoked[: cause]` (non-retryable restore failure, :131-136)
- A `GatewayDispatchUnavailableError` with `retryable` is rethrown as is (`isRetryableDelegateGrantFailure`, :44-46). On success, the spawn runs under a synthetic client carrying the restored operator authority (:139-151).
- `DELEGATE_GRANT_RESTORE_RETRY_PHASE = "Waiting for the Gateway to restore its grant"` (:41).
- Consumers:
  - delegate-dispatch.ts:457-493 and :595-613. A retryable failure requeues the row with that phase and re-arms the hedge at +30 s (`DELEGATE_DISPATCH_RETRY_MS`).
  - subagent-announce.continuation.runtime.ts:544-545 and :646-656 (`grantRestorePending`), then the post-drain arm at :669.
- Unverified risk: the post-turn caller passes no `ctx.resolveGatewayContext` (agent-runner-continuation-schedule.ts:62-68), and the reset re-arm passes `ctx:{sessionKey}` (delegate-dispatch-recovery.ts:118). Grant restore then depends on an ambient request scope. Tests at P assert that a timed operator delegate spawns after the connection closes (src/agents/subagents/spawn/subagent-spawn.continuation-operator-grant.test.ts:350) and that boot recovery restores it (:553). Production timer scoping was not traced.

### B2. return-refusal.ts (NEW). Behavior.
- `reportRefusedContinuationReturn` warns `[continuation:return-refused] stage=<enqueue|replay|wake|prompt-drain> reason=recipient-authority-changed session=<k>[ deliveryId=<id>]` (:27-36). Subsystem: `continuation/return-refused`.
- `refuseContinuationReturnDelivery` → `moveSessionDeliveryToFailed(id, ctx, {keepFailedReceipt:true})` (:53-66). `keepFailedReceipt` is new at P (session-delivery-queue-storage.ts:706-719). It replaces F's `ackSessionDelivery` on every stale-authority path.
- Also defines `[continuation:work-refused]` for work (:38-46), which is out of scope.

### B3. recipient-authority-binding.ts (+4). Behavior.
- A fanout election now calls `assertSessionRecipientAuthorityOwner({sessionKey: requester})` before returning the pending binding (:65-68). For an incognito/memory requester this throws `Incognito collaboration command requires its dedicated owner` (session-sharing-store.async.ts:56-57, :607-611). The election fails and no record is written.
- F returned the pending fanout binding unconditionally (F:63-65).

### B4. targeting.ts (+68/-?). Behavior.
- New `refusedSessionKeys` result field (:220-221, :237). Stale authority at any of the 3 checks now calls `refuseStaleRecipient` (:261-276), which writes the failed receipt and the `[continuation:return-refused] stage=enqueue` warn. This covers the pre-write check (:277-280; F skipped silently), the post-write check (:343-347; F acked) and the post-enqueue check (:369-373; F acked).
- Ack-state-dir normalization: `resolveSessionDeliveryAckStateDir` (:309-312, :328, :364). F used raw `params.stateDir`.
- Fanout span: `recipientOutcomes` ("delivered"|"queued"|"refused") replaces `deliveredCount`, plus `refusalReason` (:413-427). This yields new span attrs `fanout.recipient.outcomes`, `fanout.refused_count` and `refusal.reason` (continuation-tracer.ts:1006-1012).
- Removed dep `ackSessionDelivery` (test seam). This is a refactor.

### B5. delegate-dispatch-hedge.ts (+/-83).
- Behavior: the timer body now runs inside `runOnCurrentPluginGeneration` (:177-179; detached-generation.ts:8-10). The hedge fire admits on the plugin generation current at fire time, not the arming turn's.
- Behavior: `mergeHedgeParams` keeps an earlier arm's `ctx.resolveGatewayContext` (:102-109).
- Refactor: `DELEGATE_DISPATCH_RETRY_MS` is exported (:18). The hedge failure system event is unchanged: `[system:continuation-warning] Hedge-timer dispatch failed; queued delegates may be orphaned. Error: <e>. Re-issue continue_delegate if the work is still needed.` (:79-82).

### B6. delegate-dispatch-recovery.ts (+128/-?).
- Refactor: `sessionRowChainState` (:58-91) is extracted from the inline F code (F:147-175). It is byte-equivalent and adds `persistBeforeTerminalCommit: true` and `loadFreshChainState`, as F did inline.
- Behavior (new): `rearmPendingContinuationDelegates` (:98-125). After /new or /reset it re-arms a hedge from custody with `ctx:{sessionKey}` and `applyDelegateChainTokensFold:true`. Fire time is the earliest due time, or at most +30 s when unresolved claims exist (`ABORTED_CLAIM_REARM_MS`, :47, :104-110). It is called from session-reset.ts:162-167.
- custody-boot.ts (+25) now passes the booting Gateway's `resolveGatewayContext` to delegate recovery (custody-boot.ts:105-109).

### B7. delegate-dispatch.ts (+87). Behavior.
- Grant wrap (:457-493) and retryable grant requeue plus hedge re-arm (:595-613). No other changes.

### B8. delegate-flow-store.ts (+40) and delegate-flow-state.ts (+8) and types.ts (+11). Behavior.
- New stored field `dispatchGrant {source, ownerSessionKey, expiresAt}` (types.ts:129-140; schema delegate-flow-state.ts:134-140; encode :274; project delegate-flow-store.ts:196).
- `createDelegateRecord` captures it for `pending` only. It ignores any caller-supplied grant (:443-451), and `createdAt` is computed first (:431). A grant capture that throws aborts the election.
- Binding logic is restructured with the same semantics (:434-442 vs F createDelegateRecord F:417-441). This is a refactor.

### B9. delegate-store.ts (+15).
- Behavior: `enqueuePendingDelegate` accepts and forwards `electingOperatorAuthority` (:205-224).
- Refactor: removed `removeUnacceptedContinuationDelegate` (F:723-728). It had no callers at F (`git grep` at F shows only its definition).

### B10. subagent-announce.continuation.runtime.ts (+/-91). Behavior.
- Child tool-delegate spawn is grant-wrapped (:544-590).
- A retryable grant failure requeues the row (phase `Waiting for the Gateway to restore its grant`) instead of `markPendingDelegateFailed("Tool delegate spawn failed: ...")` (:646-657). It then forces a post-drain hedge (:668-669). The rest is re-indentation.

### B11. subagent-announce.continuation-return.ts (+18). Behavior (logging and reporting only).
- When no recipient remains after filtering (`outcome` undefined), it logs info `[continuation:targeted-return] No current recipient for the return from <child>` (:192-197).
- `[continuation:targeted-return] Delivered to ...` is now logged **only if ≥1 delivered** (:199-203). F logged `Delivered to  from <child>` with an empty list whenever nothing was held, including all-stale or no-target cases (F:194-201).
- With all recipients refused, P logs only the per-recipient `[continuation:return-refused] stage=enqueue` lines and returns `{handled:true}`, as F did.

### B12. agent-runner-continuation-signal.ts (+44). Behavior.
- The bracket delegate enqueue passes `electingOperatorAuthority: followupRun.operatorAuthority` (:251-274). So the bracket elections of an operator run get a grant even after the connection closes (test :372).
- The grammar is unchanged (signal.ts unchanged).

### B13. session-system-event-adoption.ts (+22). Behavior.
- `settleStaleSystemEventAuthority` now takes `stage: "wake"|"prompt-drain"` (:123). It calls `refuseContinuationReturnDelivery` (failed receipt) instead of `ackSessionDelivery` (:125-133) and emits `[continuation:return-refused]` (:141-146).
- Final-adoption refusal passes `stage:"prompt-drain"` (:202-207).
- session-system-events.ts (+9) passes `stage:"prompt-drain"` (:198-202). Its drain span adds `queue.refused_count` and `refusal.reason` (:320-331).

### B14. post-compaction-delegate-delivery.ts (+48). Behavior (telemetry only).
- New dispatch span `startContinuationDelegateSpan({delivery:"compaction", delegateMode:"post-compaction"})` (:484-494).
- Fire span `emitContinuationDelegateFireSpan({compactionId, fireDeferredMs})`, emitted after attempt ownership is durable (:519-529).
- The spawn traceparent is now the dispatch span's (:564). Span status OK/ERROR (:604, :682-688); end (:696).
- No change to spawn text, refusal or timing.

### B15. Other in-scope files
- delegate-dispatch-contract.ts (+3): `ctx.resolveGatewayContext?` (:13-14). Plumbing.
- delegate-turn-admission.ts: `ContinueDelegateTurnSlot` un-exported (:23). Refactor.
- state.ts: `clearTrackedContinuationTimers` releases the timer ref synchronously, no longer via `setTimeout(0)` (state.ts:106-118). Behavior: a reset resolves only after the refs are released.
- detached-generation.ts (NEW, :8-10): `runOutsideAdmittedGenerationScopes(bindPreparedReplyDispatchRuntime(undefined, run))`.
- session-reset.ts (+302): see D7. Behavior.
- post-compaction-delegate-dispatch.ts (+24): `workspaceContextRefreshed` skips `readPostCompactionContext` (:113-114, :425-436).
- agent-runner-post-compaction-release.ts (+40):
  - Behavior: new `releaseMaintenanceCompactionDelegates` (:158-182), called from agent-runner-memory.ts:502-510. Maintenance/preflight compaction now **releases staged post-compaction delegates**; F did not call release there. Failure warns `[continuation:post-compaction-release-failed] session=<k> seam=maintenance reason=<r>` (:176-180), and the turn proceeds.
  - `computeRequestCompactionContextUsage` returns cause strings `no_fresh_usage` / `unknown_context_window` instead of `null`. That belongs to the request_compaction lane.
- subagent-registry-maintenance.ts (+63). Behavior: session-store pruning and eviction now preserves:
  - every live custody owner (`listLiveContinuationCustodyOwners`)
  - every session with a pending continuation delivery row
  - each bound run's requester and selected recipients (:31-50, :52-74)
- subagent-session-cleanup.ts (+30). The cleanup delete runs under `runOutsideAdmittedGenerationScopes` (:266-275), which is behavior (generation scope). `isSessionLifecycleChangedGatewayError` moved to config/sessions/lifecycle.ts:23-34 with equivalent logic, which is a refactor.
- Announce agent-call path (normal unbound returns): `runAnnounceAgentCall` dispatch is wrapped in `runOutsideAdmittedGenerationScopes` (src/agents/subagents/announce/subagent-announce-completion-delivery.ts:103). Behavior (generation scope only).

---

## C. Model-visible text when a delegate returns

Unchanged F→P except the Stats line. Builders: subagent-announce-message.ts:38-87 and internal-events.ts:159-220 (`formatTaskCompletionEvent`) / :241-255, both unchanged.

- `triggerMessage` = `formatAgentInternalEventsForPrompt` (internal-events.ts:241-255), wrapped by `labelRuntimeContextText` (packages/llm-core/src/types.ts:423-425). Shape:
  ```
  OpenClaw runtime context:
  This context is runtime-generated, not user-authored. Keep internal details private.

  [Internal task completion event]
  source: subagent
  session_key: <child key>
  session_id: <child session id>
  type: subagent task
  task: <taskLabel = label || spawn task, e.g. "[continuation:chain-hop:1] Delegated task (turn 1/10): <task>">
  status: completed; ready for parent review | timed out[: e] | failed: <e> | finished with unknown status
  
  <Child result verbatim data block>   (internal-events.ts:124-131)

  Stats: runtime <d> • tokens <n> (in <i> / out <o>)[ • context <c>]   (or "tokens <n> context" / "tokens unknown")

  Action:
  <replyInstruction>
  End OpenClaw runtime context.
  ```
  taskLabel comes from subagent-announce.ts:428. statusLabel from subagent-announce-message.ts:57-67.
- replyInstruction for a non-subagent requester: `A completed subagent task is ready for parent review. <SUBAGENT_COMPLETION_OUTCOME_INSTRUCTION> Otherwise send a truthful user-facing update unless this exact result is already visible to the user in this same turn. Keep this internal context private (...), and do not copy the internal event text verbatim.` (subagent-announce-message.ts:28; constant at subagent-completion-instructions.ts:5-6). A subagent requester gets the orchestration-update variant (:26).
- **F→P change:** Stats line wording (subagent-announce-output.ts:511-528). F `tokens <n> prompt/cache` became P `tokens <n> context`, and F trailing `prompt/cache <n>` became P `context <n>`. This is model-visible in every return (and in ordinary subagent completions).
- How the text reaches each recipient:
  - **normal (bound, the default for every tool/bracket delegate):** a system event on the requester queue plus a `delegate-return` wake. The woken turn's input is the occurrence text(s) joined with `\n` (continuation-wake.ts:187). Its reply is delivered normally (no `deliver:false`).
  - **silent (bound):** the same system event, no wake. The next natural turn's prompt drain renders each line as `System: [<ts>] <line>` (first line timestamped; session-system-events.ts:346-349).
  - **silent-wake (bound):** byte-identical to normal at return. Text plus `delegate-return` wake, `silent=false` (continuation-wake.ts:85-87). The only difference is upstream: the child spawned with `silentAnnounce:true, wakeOnReturn:true` (delegate-dispatch-request.ts:56-57).
  - **unbound legacy silent / silent-wake:** the same text. silent-wake wakes with reason `silent-wake-enrichment` → `deliver:false`, `replyExpectation:"optional"` for non-subagent sessions (continuation-return.ts:244-281; continuation-wake.ts:194-196).
  - **targeted to another session / fanout:** the same text, one row per recipient, idempotency key `continuation-return:<announceId>:<sessionKey>`, event owned by the recipient agent (targeting.ts:291, :332).
- Fallback text `[continuation:enrichment-return] Delegate completed: <taskLabel>` (continuation-return.ts:173, :249) appears only if `triggerMessage` is empty. `buildAnnounceSteerMessage` never returns empty (subagent-announce-message.ts:31-36), so the visible return does not start with `[continuation:`. Inference from the bytes: such returns are not counted by `drainedContinuationCount`, which uses `startsWith("[continuation:")` (session-system-events.ts:316-318; continuation-wake.ts:214-216).
- Owner-side system events from dispatch (model-visible on the parent's next turn): `[continuation:delegate-spawned] Spawned turn h/m: <task>` and the `[continuation] ... Task: <task>` refusals in A5. All unchanged except the new grant refusal text (D6).

---

## D. New conditions at P: refused, dropped, parked or rerouted

1. **Stale recipient authority at enqueue** (session deleted or recreated, owner change, visibility narrowing):
   - Before: F skipped silently (pre-write) or acked the row (post-write).
   - Now: a failed receipt plus warn `[continuation:return-refused] stage=enqueue reason=recipient-authority-changed session=<k>[ deliveryId=<id>]` (targeting.ts:261-280, :343-347, :369-373).
   - Observable: `refusedSessionKeys`; fanout span `fanout.recipient.outcomes` containing `refused`, `fanout.refused_count`, `refusal.reason`. Nothing is delivered and there is no wake.
2. **Stale at wake handoff:** the row is refused, never handed to the turn. Warn `stage=wake` (continuation-wake.ts:237; adoption.ts:118-147). The drain span on the adopted turn carries `queue.refused_count` and `refusal.reason` (continuation-wake.ts:217-220).
3. **Stale at prompt drain or final adoption:** warn `stage=prompt-drain` and a failed receipt (session-system-events.ts:192-207; adoption.ts:202-207). Drain span `queue.refused_count` and `refusal.reason` (session-system-events.ts:320-331). F acked these rows, so the delivery was recorded as settled.
4. **Stale at restart replay:**
   - F: logged `session event delivery skipped: recipient authority changed` and returned.
   - P: `refuseStaleAuthorityReplay` (src/gateway/server-restart-sentinel-delivery.ts:51-77, used at :327, :375). If a copy is still queued in memory, it throws `SessionDeliveryDeferredError("system event is awaiting durable prompt adoption")` (deferred). Otherwise it warns `stage=replay` and throws `SessionDeliveryDeadLetteredError("continuation return refused: recipient-authority-changed", {keepFailedReceipt:true})`.
5. **Incognito requester elects a fanout delegate:** refused at election, `Incognito collaboration command requires its dedicated owner` (recipient-authority-binding.ts:65-68). The tool form returns an error toolResult and the slot is released (continue-delegate-tool.ts:454-458). For the bracket form the throw propagates from agent-runner-continuation-signal.ts:251-274; the catch site was not traced.
6. **Operator dispatch grant** (dispatch-side refusal, not a return refusal):
   - Fires for Gateway-operator elections (tool form via ambient capture; bracket form via `followupRun.operatorAuthority`).
   - Terminal: status `failed`, `failureReason` = `DELEGATE spawn failed: Continuation delegate operator dispatch grant {belongs to another session|expired|has no Gateway to restore it|was revoked[: <cause>]}.` Owner system event `[continuation] DELEGATE spawn failed: <msg>. Task: <task>`. Log `[continuation:delegate-spawn-failed] error=<msg> session=<k>`. Dispatch span ERROR (delegate-dispatch.ts:590-623).
   - Retryable (Gateway unavailable): requeued with phase `Waiting for the Gateway to restore its grant`, hedge re-armed every 30 s, the same `delegate-spawn-failed` log each attempt. It ends at `expiresAt = dueAt + 1h` with `expired` (delegate-dispatch.ts:595-613; grant.ts:39, :111-113).
   - Election-time throw: `Continuation delegate election requires the operator's Gateway binding.` (grant.ts:66-69) gives an error toolResult.
   - A source that cannot be retained logs `[continuation:delegate-grant-unavailable]` and dispatches as at F (grant.ts:74-80).
7. **/new and /reset no longer cancel delegates:**
   - P: `retireReplacedHeadContinuations` (session-reset.ts:124-129) keeps every record of kind `delegate` (`survivesHeadSwap`, :62-64, :79-88). F's `cancelSessionContinuations` set every queued or running record to `cancelled` / `Cancelled by session reset` (F:session-reset.ts:44-51, :76-134; F caller session-reset-cleanup.ts:167).
   - Still cancelled on head swap: `post_compaction` records and running work. `delete` still cancels everything (session-reset-cleanup.ts:171-175).
   - In-flight claims are still aborted (`abortContinuationDispatchClaims`, session-reset-cleanup.ts:193). The dispatcher then requeues `cancelled` spawns with `Admission cancelled before spawn` (delegate-dispatch.ts:549-559).
   - Kept rows are re-armed after the reset (`rearmKeptContinuations`, session-reset.ts:136-168, from session-init-reset-cleanup.ts:60-64 and gateway/session-reset-continuation-retention.ts:54-63). Observable: `[continuation:delegate-hedge-armed] fireIn=... session=<k>`. On failure: warn `failed to re-arm kept continuations for session <k>: ...` or `[continuation:reset-retention] could not re-arm kept continuations for <k>: ...`.
   - Net effect: a delegate elected before a reset now spawns after it, under the replaced head's session key. Its return is subject to the reset-hold that already existed at F (targeting.ts:319-320, :348-356, `[continuation:return-held] session reset pending; ...`).
8. **Explicit owner cancel (new):** `/continuations cancel <id>` (commands-continuations.ts:47-65) → `cancelOwnedContinuationRecords` (session-reset.ts:282-338). Phase `Cancelled by owner`. An in-process claim is aborted with reason `owner-cancel`. Receipt outcomes: `cancelled|fenced|handed-off|already-ended|not-found`. A handed-off child is not stopped.
9. **Session-store maintenance** no longer evicts custody owners, pending-return recipients or bound requesters (subagent-registry-maintenance.ts:31-74). This removes a source of "source session owner is unavailable" and of authority-changed refusals after pruning.
10. **Maintenance compaction releases staged post-compaction delegates** (agent-runner-memory.ts:502-510). Before, they waited for an in-run compaction seam. On failure: warn `[continuation:post-compaction-release-failed] ... seam=maintenance ...`.
11. **Generation fences on detached re-entry:** hedge fire (B5), announce agent call (subagent-announce-completion-delivery.ts:103) and cleanup delete (subagent-session-cleanup.ts:266) now admit on the plugin generation current at run time. No new refusal string. Which generation admits the work changes.
12. **Logging change that affects log-greps:** `[continuation:targeted-return] Delivered to <keys>` is now emitted only when ≥1 recipient was delivered. A new `[continuation:targeted-return] No current recipient for the return from <child>` line exists (B11).
