# Sentinel-echo audit of the k6 proof scenarios (2026-10-30)

Bound issue: karmaterminal/openclaw-bootstrap#1727. Trigger: R-CD-3's false "lifeboat return"
(findings: openclaw-bootstrap#1727 comment 6532342767; corpus corrected at docs `7ac3e7b8`).
🌊's go: Discord `1565818219715895457`.

This file is the read-only audit. It was written and committed before any scenario changed.
No corpus file is edited by this lane, and no row is re-fired.

## Refs

| Category | Ref | Full SHA | Equality |
| --- | --- | --- | --- |
| Product (the code the subscriber facts below were read from) | `karmaterminal/openclaw` F′ | `f15237ec921879d918482cdf372b0718d4c1aab9` | read with `git show` from the seat's clone; nothing built or run |
| Lane branch | `codeagent/harness-sentinel-audit` | `7ac3e7b806b3f792c80327ca491743481f74725b` at audit start | local = tracking = `origin` |
| CI / workflow | N/A | — | docs validators run locally; Mode-B targets the product repo, not this one |
| Presentation | N/A | — | a docs PR to `main`, no product presentation |
| Docs / proof | `karmaterminal-openclaw-docs` `main`, corpus `PROOFS/f15237ec921879d918482cdf372b0718d4c1aab9/` | `7ac3e7b806b3f792c80327ca491743481f74725b` | local `main` = `origin/main` |

## What a subscriber can see (product facts at F′)

Every live scenario opens one operator WebSocket, calls `sessions.messages.subscribe` on its
session, and with `caps: []` (`lib/gateway-ws.js` `connectFrame`). Most then test
`JSON.stringify(eventPayload).includes("<SENTINEL> <nonce>")` and skip an event only when it also
contains `[k6-proof-harness]`. Here is what such a match can hit at F′:

1. **The harness prompt** is a visible user row. The marker filter drops it only while the marker
   is in the same event; any restatement without the marker passes.
2. **Tool-call arguments arrive verbatim.** `session.message` carries the assistant row with its
   `toolCall` parts and their `arguments` untruncated (`src/gateway/chat-display-projection.sanitize.ts:182-183,227-233`).
   The tool-start `agent` `item` event also carries `task` for `continue_delegate` and `reason`
   for `continue_work` / `request_compaction` (`src/agents/tool-display-config.ts:393-395`,
   `src/agents/embedded-agent-subscribe.handlers.tools.start.ts:361-396`). This is how R-CD-3
   matched its own `continue_delegate` call.
3. **Thinking parts are delivered.** Only the signature is removed (`chat-display-projection.sanitize.ts:227-249`).
   A model that restates its instructions while thinking emits the sentinel.
4. **Every `session.message` carries a session snapshot.** That includes
   `lastAssistantMessage`, `label` and similar fields (`src/gateway/session-transcript-message.ts:139-149`,
   `src/gateway/session-event-payload.ts:64-195`). Text from one row rides along on later events.
5. **The connection is unscoped.** Without the `session-scoped-events` capability, `chat` and
   `agent` events for every session on the gateway reach the harness, children included
   (`src/gateway/server/client-registry.ts:60-66`, `src/gateway/server-broadcast.ts:277-294`).
6. **A delegate's task text comes back.** It is in the parent's `continue_delegate` call (2),
   the child's first user row, and the return trigger's `task:` line. That line is hidden from
   the subscriber, but the woken parent model sees it and can repeat it (`src/agents/internal-events.ts:159-219`).
7. **A `continue_work` reason comes back.** The wake input quotes the reason twice and is stored
   as a user row (`src/auto-reply/continuation/work-dispatch-execution.ts:165-226`). Visibility is
   inferred from the hide rules; a live probe has not confirmed it. An accepted
   `request_compaction` result also echoes its `reason` (`src/agents/tools/request-compaction-tool.ts:377-387`).
8. **What the agent cannot author:**
   - a `toolResult` row, which is tied to its call by `toolCallId`;
   - a lifecycle run identity, which differs per run, so a woken run is not the dispatch run;
   - a child session's own assistant rows, bound by `spawnedBy` plus its own spawn task;
   - the direct-announce header on a delivered row;
   - the product prefix `[continuation:post-compaction]` on a released lifeboat's task
     (`src/auto-reply/reply/post-compaction-delegate-delivery.ts:497-539`).

## Classification rule

An observation is **verdict-bearing** if the scenario's VERDICT line depends on it, or if
`run-proofs.sh` reads it to keep or drop a verdict (the R-RC-2 honest-limit and pass policies).

An observation is **safe** if one of these holds:
- it is bound to something in item 8 above;
- the string it accepts cannot occur in the harness prompt, any tool argument, any delegate task,
  or an echo of those. For example, a placeholder such as `<provider/model>` or `<yes|no>` that
  the observation's own regex rejects.

Everything else is **vulnerable**. A vulnerable observation can be satisfied by the agent's own
outbound text, or by the product echoing that text back. Severity:

- **V1, echo of harness-authored text.** The sentinel sits inside a tool argument, a delegate
  task or a spawn task, so the agent emits it just by following instructions. This is the R-CD-3
  class: near-certain to fire.
- **V2, prompt echo.** The sentinel is only in the harness prompt. Something must restate it
  without the marker (thinking, an early assistant line, a snapshot field), and nothing binds the
  match to a toolResult, a run or a session.

A row is vulnerable when one vulnerable observation can carry its verdict. If a structural
receipt in the same verdict already implies the same fact, the observation is noted but the row
stays safe.

## Results by scenario

| Scenario (row) | Verdict-bearing text observation | Sentinel appears in | Class |
| --- | --- | --- | --- |
| `preflight.js` | none (structured RPC only) | — | safe |
| `r-cd-1-typed-delegate.js` (R-CD-1) | `delegate_scheduled_sentinel`: `CD1-DELEGATE-SCHEDULED <nonce>` in any non-marker event | prompt; echoes | **V2** |
| | `parent_return_event`: `CD1-DONE <nonce>` (or event `delegate.return`) after scheduled + delay | **delegate task** (manifest template), so the parent's `continue_delegate` call, the tool-start meta and the child's spawn row; prompt | **V1** (a timing gate only) |
| `r-cd-2-silent-wake.js` (R-CD-2) | wake ack: the whole assistant text equals `RCD2-WAKE-ACK <nonce>`, in the session, from a run other than the dispatch run, bound to an in-window lifecycle start | prompt only; exact equality on text-only assistant rows, distinct run | safe |
| | dispatch terminal sentinel: whole assistant text equals the sentinel during the dispatch lifecycle | prompt | safe (exact, run-window bound) |
| | same-run delegate success: the nonce-bound `continue_delegate` toolCall and its `scheduled` toolResult by `toolCallId` | — | safe |
| | completion record `"notify":false` + `"outcome":"done"` + nonce | binds only through a distinct run's lifecycle start | safe |
| `r-cd-3-post-compaction.js` (R-CD-3) | `lifeboat_return_observed`: `RCD3-LIFEBOAT-RECEIVED <nonce>` in any non-marker event | **delegate task**, so the parent's `continue_delegate` call | **V1, confirmed false positive at F′** |
| | `threshold_refusal_observed`: `RCD3-THRESHOLD-LIMIT <nonce>` | prompt; the agent's own report, never the toolResult | **V2**; also cannot tell an unknown rejection from a measured one |
| | `compaction_accepted`: `RCD3-COMPACTION-ACCEPTED <nonce>` | prompt | **V2** |
| `r-cd-4-target-session-key.js` (R-CD-4) | target ack: text-only assistant row, target `sessionKey`, exact `TARGET-ACK <nonce>`, child bound. The heartbeat path excludes the priming run; the assistant-text path (`session.message` and `chat.history`) does not | target priming prompt | **V2**: the target's priming reply could carry the ack |
| `r-cd-chained-depth-2.js` (R-CD-CHAINED-DEPTH-2) | `child_done_sentinel`: `CHILD-DONE <nonce> CHILD-DELEGATE-SCHEDULED` in any non-marker event 1.5 s after dispatch | **delegate task**, so the root's `continue_delegate` call | **V1** |
| | `grandchild_done_sentinel`: `GRANDCHILD-DONE <nonce>` | **delegate task** (nested task); prompt | **V1** |
| | root ack: text-only assistant row in the root session, exact `ROOT-CHAIN-ACK <nonce>`. The heartbeat path excludes the dispatch run; the assistant-text path does not | prompt | **V2** |
| `r-cd-collection-on-collapse.js` | scaffold, throws | — | n/a (the row is validated by `static-corpus-row-validator.js`) |
| `r-cd-model-chained-alt.js` (R-CD-MODEL-CHAINED-ALT) | `depth_1_scheduled_inner`: `MODEL-CHAINED-DEPTH1-SCHEDULED <nonce>` | **depth-1 task**, inside the parent's call | V1 at observation level. **Row safe:** `complete` also needs the observer-bound depth-2 child (`spawnedBy` depth-1), which implies the same fact |
| | `return_payload`: `MODEL-CHAINED-DEPTH2 <nonce> MODEL <id>` | the task carries the literal `<provider/model>`, which the regex rejects | safe (placeholder) |
| | served model: depth-2's own assistant row in its own transcript, run window, `provider`/`model` fields | — | safe |
| `r-cd-model-default.js` (R-CD-MODEL-DEFAULT) | `parent_scheduled_sentinel`: `MODEL-DEFAULT-PARENT-SCHEDULED <nonce>` | prompt | V2 at observation level. **Row safe:** the observer-bound child and its served receipt carry the verdict |
| | `return_payload`, served receipts | placeholder; product fields | safe |
| `r-cd-model-tool.js` (R-CD-MODEL-TOOL) | `parent_scheduled_sentinel` (`MODEL-TOOL-PARENT-SCHEDULED` plus the nonce anywhere in the event) | prompt | V2 at observation level. **Row safe**, as for MODEL-DEFAULT |
| `r-cd-model-token.js` (R-CD-MODEL-TOKEN) | `subagent_spawn_accepted`: `MODEL-TOKEN-PARENT-SPAWNED`, **or `sessions_spawn`, or `childSessionKey`**, in any event with the nonce | the parent's own `sessions_spawn` call (tool name and arguments) | **V1** |
| | `bracket_token_observed`: `MODEL-TOKEN-HOP1 <nonce>`, **or `[[CONTINUE_DELEGATE:`, or `bracket`** | **spawn task** (it contains all three), so the parent's call, hop-1's spawn row and hop-1's thinking | **V1**. Nothing structural proves hop-1 used the token rather than the typed tool, so the token-form claim rests on this |
| | `bracket_model_modifier_observed`: `model=<requested>` | **spawn task** (the bracket text) | **V1** |
| | `return_payload`, served receipt | placeholder; product fields | safe |
| `r-cd-return-overlap.js` (R-CD-RETURN-OVERLAP, offline) | `both_targeted_returns_in_journal`: the journal has one `[continuation:targeted-return]` line and contains both markers **anywhere** | the markers are in the delegate tasks, so any dispatch log line satisfies them | **V1** (shape). The committed journal does bind each marker to a child session and that child's targeted return |
| | `both_markers_in_tasks` (task rows or EVIDENCE.md) | outbound by design: it claims dispatch, not return | safe for this audit |
| `r-cd-silent.js` (R-CD-SILENT) | `scheduled_sentinel`: `RCDS-SCHEDULED <nonce>` | prompt | V2 |
| | `child_completion_observed`: a `chat` final event on a `:subagent:continuation-` session key carrying the child token | session-bound: only the child's own assistant output | safe |
| | `parent_internal_context_observed`: `RCDS-PARENT-OBSERVED <childToken>` | **the token is in the parent's own `continue_delegate` call and in the dispatch prompt**, so the parent already knows it | **V1**: this is the row's readback claim |
| `r-cd-token-bracket-delegate.js` (R-CD-TOKEN) | bound return: only a user/system row with the direct-announce header whose `sourceSession` is the delegate | — | safe |
| | targeted return: correlation only (assistant row, run other than the bracket run, after the delegate ended); never binds | — | safe |
| | source leg: the delegate's own assistant row stamped with its run, exactly one | — | safe |
| `r-config-defaults.js`, `r-config-intersession.js` | none (structured RPC only) | — | safe |
| `r-cw-1-tool-schedule-wake.js` (R-CW-1) | `continue_work_tool_result_scheduled`: `CW-SCHEDULED <nonce>` (the agent's text, not the toolResult its name suggests) | prompt | **V2** |
| | `work_woke_event`: `CW-WOKE <nonce>` after scheduled and delay | **the `continue_work` reason** (manifest), so the call, the tool-start meta and the wake input that quotes the reason | **V1** |
| `r-cw-2-immediate-wake.js` (R-CW-2) | `scheduled_sentinel`: `CW2-SCHEDULED <nonce>` | prompt | **V2** |
| | `immediate_wake_observed`: `CW2-WOKE <nonce>` after scheduled, no delay gate | **reason** | **V1** |
| `r-cw-3-reason-telemetry.js` (R-CW-3) | `scheduled_sentinel`: `CW3-SCHEDULED <nonce>` | prompt | **V2** |
| | `wake_observed`: `CW3-WOKE <nonce>` after scheduled | **reason**; the prompt also quotes the reason | **V1** |
| `r-cw-4-chain-depth.js` (R-CW-4) | `hop1/2/3_scheduled`, `final_done`: `CW4-HOP*-SCHEDULED` / `CW4-DONE <nonce>` in any non-marker event | prompt only (the reasons carry none) | **V2** |
| `r-cw-5-cost-cap-reject.js`, `r-cw-6-max-chain-length.js` | scaffolds, throw | — | n/a (fixture rows) |
| `r-cw-delegate-self-continuation.js` (R-CW-DELEGATE-SELF-CONTINUATION) | hops from the child's own transcript (toolCall, toolResult `scheduled`, `[continuation:wake]` turn); a child-minted token reproduced by the parent in a run other than dispatch, after the token's timestamp. Event-string checks are diagnostic only | — | safe (the reference shape) |
| `r-cw.js`, `r-cw-1.js` (legacy) | HTTP health checks only, no manifest row | — | n/a |
| `r-cw-token-bracket.js` (R-CW-TOKEN) | `subagent_spawn_accepted`: `PARENT-SPAWNED`, **or `sessions_spawn`, or `childSessionKey`** | the parent's own `sessions_spawn` call | **V1** |
| | `token_emitted_or_stripped`: `TOKEN-HOP1 <nonce>` **or `CONTINUE_WORK`** | **spawn task** | **V1** |
| | `hop_2_executed`, `parent_return`: `TOKEN-HOP2-DONE <nonce>` | **spawn task** | **V1** |
| `r-obs-1.js` (R-OBS-1) | `OBS1-STATUS <nonce> BUILD … ROUTE …` parsed for yes/no | the prompt carries `<yes|no>`, which the parser rejects | safe (placeholder). It is the agent's attestation by design; not an echo question |
| `r-obs-2.js`, `r-obs-status.js` | Tempo span names / structured RPC | — | safe |
| `r-rc-1-threshold-reject.js` (R-RC-1) | authoritative `toolResult` bound to the nonce-bearing call by `toolCallId`; the assistant sentinel is diagnostic only | — | safe |
| `r-rc-2-delegate-request-compaction.js` (R-RC-2) | child-transcript paths: toolResult by `toolCallId`; yield, wake and report after the bound toolResult (text parts only) | — | safe |
| | parent-stream "auxiliary" path. It sets `delegate_child_report_observed`, `child_reported_context_threshold`, `request_compaction_accepted_reported` and `post_compaction_path_observed` from `REQUEST_COMPACTION_* <nonce>` in any non-marker event, and the runner's HONEST-LIMIT/PASS policy reads those fields | **child task** (all three sentinels), so the parent's `continue_delegate` call and the return's `task:` line | **V1** |
| `r-rc-2.js` | scaffold, throws | — | n/a |
| `r-regression-trap-tests.js`, `r-trace-redaction-1121.js` (offline) | EVIDENCE.md and test-log text | human/CI-written, no agent | safe for this audit |
| `static-corpus-row-validator.js`, R-CD-COLLECTION-ON-COLLAPSE | `cSentinelPresent`: the C sentinel in EVIDENCE.md and the journal; `rootCollection`: the C sentinel in `root-collection-receipt.md` | the C task carries it. The journal has B's outbound `C_SENTINEL_SCHEDULED=…` line, and the root receipt has the root's own `sessions_history` reads of B's and C's task text | **V1** (shape). The committed `journal/load-bearing-lines.log` has the structural byte (`targeted-return … from <C>`), which is not checked |
| `static-corpus-row-validator.js`, the other rows (R-CW-7, R-CW-DELEGATE-CHILD-LIVE, R-CW-DELEGATE-TOKEN, R-CW-MULTI, R-CW-MULTI-COLLAPSE, R-CW-5A, R-CW-6A) | presence of committed source, test-log, journal, flow-row, SQL and Tempo text. R-CW-DELEGATE-CHILD-LIVE's hop files are written by the child by design, and the same validator also requires Tempo `continuation.work.fire` `delay.ms=5000` | product logs and human audits | safe for this audit |

Vulnerable rows (14): R-CD-1, R-CD-3, R-CD-4, R-CD-CHAINED-DEPTH-2, R-CD-MODEL-TOKEN,
R-CD-SILENT, R-CW-1, R-CW-2, R-CW-3, R-CW-4, R-CW-TOKEN, R-RC-2, and two offline rows:
R-CD-RETURN-OVERLAP and R-CD-COLLECTION-ON-COLLAPSE (the latter through
`static-corpus-row-validator.js`).

Rows with only an observation-level note (row safe): R-CD-MODEL-DEFAULT, R-CD-MODEL-TOOL and
R-CD-MODEL-CHAINED-ALT.

## Vulnerable rows at F′: what the canonical runs suggest

These runs are under `PROOFS/f15237ec921879d918482cdf372b0718d4c1aab9/<ROW>/`. The redacted
event stream is not in the public corpus, so these readings rest on `k6.log` console lines,
`evidence-lines.log` and the gateway journal. None of them changes a corpus state here.

- **R-CD-3**: `emeric-isolated-composite/20261030T013104Z-r-cd-3-44aa4c89`.
  - The "return" was recorded at 5.1 s, from an event 5 s after `sessions.send`. The session
    transcript puts the `request_compaction` rejection *after* that point (seq 6–7, unknown
    usage), and nothing followed it.
  - **False positive, confirmed.** The corpus was already corrected to missing at `7ac3e7b8`.
- **R-CW-TOKEN**: `emeric-isolated-composite/20261030T014725Z-r-cw-token-44aa4c89`.
  - The journal shows `continuation:work-wake hop=1/200` at 18:47:43.007. `TOKEN-HOP2-DONE` was
    "observed" at 18:47:43.167 (`hop_2_at_ms`), 160 ms later, and the socket then closed.
  - No model turn finishes in 160 ms. So the "hop-2 executed" byte matched an echo of the spawn
    task, not hop 2's reply. The wake did fire (the journal shows it), but hop-2 execution was
    not observed.
  - **Likely false positive** for the row's own "required proof byte". The corpus records pass.
    Flagged for 🌊; the corpus is not edited here.
- **R-RC-2**: `emeric-isolated-composite/20261030T014846Z-r-rc-2-44aa4c89`.
  - The measured toolResult receipt is real: `context_usage 13`, `threshold 70`,
    `threshold_rejected_measured`, read from the child's own transcript.
  - The child-report half of HONEST-LIMIT is not real:
    - The only report seen was the parent-stream "auxiliary" match at 18:49:29, which parsed
      `context=unknown threshold=unknown`.
    - `child_report_source` is absent from the public line. The sanitizer keeps that key, so
      the child-transcript report never bound.
    - A real child report would carry `CONTEXT 13`. `unknown` is what the regex returns on the
      task template's `<contextUsage>` placeholder.
  - **The child-report receipt is likely an echo of the child task.** The honest-limit rests on
    the measured receipt plus an unproven report. Flagged for 🌊; the corpus is not edited.
- **R-CW-3**: `emeric-isolated-composite/20261030T014534Z-r-cw-3-44aa4c89`.
  - `CW3-WOKE` arrived 5.296 s after `CW3-SCHEDULED`, with a 5 s delay. That is too soon for a
    model reply.
  - It fits the wake input row, which quotes the reason (and the reason carries `CW3-WOKE
    <nonce>`). That row is product-authored and implies the wake fired, but the row matched an
    echo, not the woken agent.
- **R-CW-1**: canonical refire `emeric-isolated-composite/20261030T021254Z-r-cw-1-bca3fca7`.
  `CW-WOKE` arrived 5.69 s after `CW-SCHEDULED` (5 s delay), on a `session.message`. Same reading
  as R-CW-3: most likely the wake input quoting the reason.
- **R-CW-2**: `emeric-isolated-composite/20261030T014440Z-r-cw-2-44aa4c89`. `CW2-WOKE` arrived
  38.4 s after `CW2-SCHEDULED` (delay 0). The timing does not identify the source. The reason
  carries the sentinel, so a reason echo cannot be excluded.
- **R-CD-1**: `emeric-isolated-composite/20261030T012952Z-r-cd-1-44aa4c89`.
  - At 18:30:03, four `CD1-DONE` echoes of the parent's own call were refused by the window. The
    scheduled sentinel came at 18:30:06, the observer saw the child running at 18:30:10, and the
    first accepted `CD1-DONE` matches were `agent` events at 18:30:11.
  - The sequence fits genuine child output on the unscoped child stream. But the window, not the
    source, is all that separated those matches from the refused ones.
- **R-CD-CHAINED-DEPTH-2**: `emeric-isolated-composite/20261030T013602Z-r-cd-chained-depth-2-44aa4c89`.
  - `CHILD-DONE` matched at +10 s, `GRANDCHILD-DONE` at +20 s and the root ack at +42 s. The
    child and grandchild ended `done`, observer-bound.
  - The timing fits real hop output. But both hop sentinels are in the root's own call, and the
    run cannot exclude that the first matches came from it.
- **R-CD-MODEL-TOKEN**: `emeric-isolated-composite/20261030T013747Z-r-cd-model-token-44aa4c89`.
  - The spawn "acceptance" matched the parent's own `sessions_spawn` events at 18:37:57. The
    bracket flags matched at 18:38:01–02, about 4 s later, which fits hop-1's own turn.
  - Nothing in the run shows hop-1 used the bracket rather than the typed tool.
- **R-CD-SILENT**: `emeric-isolated-composite/20261030T013909Z-r-cd-silent-44aa4c89`.
  - The child's completion on its own session is real (18:39:28).
  - The parent's readback at 18:39:35 named a token the parent had written into its own
    `continue_delegate` call at dispatch. **The readback does not prove the silent return
    reached the parent's context.**
- **R-CD-4**: `emeric-isolated-composite/20261030T013415Z-r-cd-4-44aa4c89`.
  - The target ack arrived on a live `session.message` 20 s after dispatch. Before dispatch the
    scenario only reads events for priming, and the child ended `done`. That fits a real woken
    turn.
  - The history path, though, would also accept an ack inside the priming run.
- **R-CW-4**: `emeric-isolated-composite/20261030T014605Z-r-cw-4-44aa4c89`. The hop sentinels
  arrived at 10 s, 9 s and 7 s spacing on `agent` events, and the continuation trace topology
  (three `continue_work` tool spans) corroborates three hops. A prompt echo is structurally
  possible but nothing here suggests one.
- **R-CD-RETURN-OVERLAP** (offline; canonical `emeric-isolated-composite/20261030T013904Z-r-cd-return-overlap-44aa4c89`).
  - It validates `PROOFS/1cc8f4e3…/R-CD-RETURN-OVERLAP/cael-dgx`. That journal binds each marker
    line to a child session (`session=…continuation-7bdd…`, `…continuation-dc71…`), and each
    child has a targeted-return line.
  - The evidence is sound. The check is loose.
- **R-CD-COLLECTION-ON-COLLAPSE** (offline; `static-validator-20261030T013043Z`). The committed
  `journal/load-bearing-lines.log` has `targeted-return Delivered to <B>,<root> from <C>`, and
  C's own sentinel line is followed by `session: <C>`. The evidence is sound; the check reads
  outbound copies instead.

## Out of scope, noted

- **R-RC-1 passes on the unknown-usage branch.** The F′ receipt has `context_usage: null`. That
  is the row's documented claim ("below-threshold structured reject via disposable
  session/inventory-only path"), so it is not a defect here. It differs from R-CD-3's rule (c)
  and from R-RC-2's measured rejection.
- **`scripts/recover-session-receipts.mjs` has the same substring shape** for R-CW-1, R-CW-4 and
  R-CW-TOKEN (`allText.includes(…)` over the whole transcript). It is a manual recovery tool, not
  a scenario. It is fixed alongside those rows only where the fix is the same binding.
- Offline validators that check EVIDENCE.md prose validate documents, not agent output. That is a
  different weakness and is not changed here.

## Fix plan (what follows this audit)

1. **R-CD-3:**
   - **(a)** The lifeboat sentinel is read only from the released lifeboat child's own assistant
     text. The child must be bound by `spawnedBy` = the row session and by its own spawn task,
     which must start with the product's `[continuation:post-compaction]` prefix and carry the
     row token. Nothing in the parent stream counts.
   - **(b)** The scenario fills the disposable session with real prior turns until measured
     usage passes the threshold. Measured usage is `totalTokens`/`contextTokens` with
     `totalTokensFresh`, read from `sessions.list`: the same inputs as
     `computeRequestCompactionContextUsage`. No threshold is lowered and no config is touched.
     If the budget cannot reach the threshold, the run fails closed.
   - **(c)** A `request_compaction` toolResult bound by `toolCallId` decides the outcome. An
     unknown or unmeasured rejection is PARTIAL with a named reason, never PASS. A measured
     below-threshold rejection is a separate PARTIAL reason.
2. **Every other vulnerable row, the same way:**
   - Scheduled claims come from the tool's own toolResult by `toolCallId`.
   - Wake and return claims come from text-only assistant rows in the expected session and in a
     run other than the dispatch (or priming) run, or from the hop's own transcript.
   - Sentinels leave reasons and tasks wherever the harness can read the real record instead.
   - Readback claims use a child-minted token, as R-CW-DELEGATE-SELF-CONTINUATION already does.
   - The two offline checks bind each marker to the targeted-return line from its own child.
3. **Tests:** for each fix, an echo-only event must not satisfy the observation, and the true
   event must.

## Fix status (added after the audit commit `ed28bb0e`)

Each fix has a test where an echo-only event must not satisfy the observation and the true record
must. Each echo test imports nothing added with the fix. Run against the pre-fix tree (`git
archive 7ac3e7b8 tools/k6-proofs`, plus the two offline rows' committed `PROOFS` files), it fails
for the expected reason: the old scenario credits the echo. On this branch it passes. Nothing was
re-fired.

| Row | Fix commit | Binding now | Echo test (fails on `7ac3e7b8`, passes here) |
| --- | --- | --- | --- |
| R-CD-3 | `fb48f7f2` | (a) see note 1. (b) the fill takes real prior turns until fresh `totalTokens/contextTokens` from `sessions.describe` passes the threshold; it is disposable-only and budgeted, with no threshold or config change. (c) unknown/unmeasured rejection is PARTIAL, never PASS; a measured below-threshold rejection is a separate PARTIAL reason | `tests/r-cd-3-post-compaction.test.mjs` "F′ echo" |
| R-CW-1, R-CW-2, R-CW-3, R-CW-4 | `02327fb0` | turn order in the session's own transcript (see note 2); the shipped reasons drop the wake sentinel | `tests/r-cw-wake-binding.test.mjs` |
| R-CW-TOKEN | `5eba53bf` | `sessions_spawn` toolResult → childSessionKey. The child's own rows: TOKEN-HOP1, then hop 2 after a wake row or in another run, with a token minted in hop 2; no typed `continue_work`. The parent reproduces the hop-2 token outside the dispatch run | `tests/r-cw-token-binding.test.mjs` "F′ echo" |
| R-RC-2 | `8f051313` | every child report from the child's own transcript; parent-stream sightings are diagnostics. The post-compaction report binds in a later turn or run after the accepted toolResult | `tests/r-rc-2-sentinel-echo.test.mjs` "F′ echo" |
| R-CD-SILENT | `ce022ac6`, `1ba9e374` | the child mints a token in its own chat final (spawnedBy the parent); the parent reproduces it in a run other than the dispatch run; scheduled needs the toolResult | `tests/r-cd-silent-readback.test.mjs` "F′ echo" |
| R-CD-CHAINED-DEPTH-2 | `8782bed7` | CHILD-DONE and GRANDCHILD-DONE only in the lineage-bound hop's own transcript; the root ack excludes the dispatch run | `tests/r-cd-chained-depth-2-echo.test.mjs` "F′ echo" |
| R-CD-1 | `e8baa61a` | scheduled needs the toolResult plus the parent's text; the child mints in its own transcript; a later parent run reproduces the token; the docs#564 window is now diagnostic | `tests/r-cd-1-return-binding.test.mjs` "F′ echo" |
| R-CD-MODEL-TOKEN | `6d2182c0` | see note 3 | `tests/r-cd-model-token-bracket-form.test.mjs` "F′ echo" |
| R-CD-4 | `472072ed` | the target ack excludes the priming run on the live and transcript paths; the transcript path is anchored after the priming reply | `tests/r-cd-4-authority.test.mjs` (#1727 cases), `tests/r-cd-4-priming-echo.test.mjs` |
| R-CD-RETURN-OVERLAP, R-CD-COLLECTION-ON-COLLAPSE (offline) | `2cac8da4` | each marker binds to its writer and that writer's targeted-return line (`lib/journal-return-binding.mjs`). The committed corpus still validates | `tests/offline-return-binding.test.mjs` (outbound-only copies) |

Notes:

1. **R-CD-3 (a).** Staging and request_compaction come from their toolResults, bound by
   `toolCallId`. The lifeboat is a child whose own spawn task carries the product prefix
   `[continuation:post-compaction]` and the row token. Its report is a token it mints. The return
   is the requester reproducing that token outside the proof and fill runs.
2. **R-CW-1/2/3/4.** The nonce-bound `continue_work` call's `scheduled` toolResult, with the
   hop's scheduled sentinel in that turn. Then a `[continuation:wake]` user row, and the next hop
   or the done sentinel inside the wake turn.
3. **R-CD-MODEL-TOKEN.**
   - Spawn: the `sessions_spawn` toolResult, or hop-1 bound by the observer.
   - Token form: hop-1's own transcript has its turn and no typed `continue_delegate` call, and
     the delegate's own task carries the product prefix `[continuation:chain-hop:`.
   - Model modifier: the delegate's served or selected model equals the requested one.

`recover-session-receipts.mjs` uses the same bindings for R-CW-1, R-CW-4 and R-CW-TOKEN. The
k6 authoring skill's scenario rules now require these bindings, so a new row cannot repeat the
pattern.

Rows noted at observation level only (R-CD-MODEL-DEFAULT, R-CD-MODEL-TOOL,
R-CD-MODEL-CHAINED-ALT) were left unchanged: their verdicts already rest on structural receipts.

The F′ readings above (R-CW-TOKEN, R-RC-2, R-CD-SILENT, and the timing reads of the others) are
for 🌊's ruling. No corpus file is edited here.
