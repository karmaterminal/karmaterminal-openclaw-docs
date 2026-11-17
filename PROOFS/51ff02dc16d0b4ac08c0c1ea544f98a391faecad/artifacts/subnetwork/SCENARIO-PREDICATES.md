# k6 proof rows: scenario predicates against product bytes

- Harness: karmaterminal-openclaw-docs @ `9ba5518bdb079da3c3c75961fd8cd26be040eb1e`, worktree `WORKTREES/karmaterminal-openclaw-docs-k6-proofs-ab5a`. Every path below is relative to `tools/k6-proofs/` unless it starts with `PROOFS/`.
- Candidate under check: karmaterminal/openclaw @ `51ff02dc16d0b4ac08c0c1ea544f98a391faecad`. None of the harness's product citations are at this SHA. They are pinned to older cuts: f15237ec92, 41b8d69b90, 14d31a81b1, 935ba44c17, 8baac2feb6, 2273ef64d5, 6652f7eac8, and the census basis 6b09b1dbe9. Re-check every `file.ts:N` listed in §4 of each row.
- Read-only research. Nothing was fired. Every claim cites harness code. Wherever README, EVIDENCE or receipt-description prose disagrees with the code, the code wins.
- Layout: COMMON (C-SHARED binding helpers, C-TRACE collector), then one section per live row, then the read-only/static rows. The model rows have M-COMMON before them; the R-CW rows have CW-COMMON.

## CROSS-ROW FLAGS (check these first against 51ff02dc; details and citations are in each row's section)
- **Chain id attribute key.**
  - The collector requires `chain.id` as a UUIDv4 on the accept and fire spans (collect:461-472).
  - The advisory manifests say `continuation.chain.id`. They are `enforcement:"advisory"`, so the mismatch is not a gate (C-TRACE).
- **Delegate deferral attribute.**
  - Every `continue_delegate` row, typed or bracket, needs fire `fire.deferred_ms` or fire/accept `delay.ms` as a positive OTLP intValue. Without it the collector throws "lacks complete causal timing" (collect:273-322, 491-493).
  - R-CD-3 (delaySeconds 0) needs `fire.deferred_ms ≥ 1`.
- **Public-safety refusal.** The raw Tempo trace must not contain any of these, or the collector throws (collect:220-232):
  - the raw reason or task;
  - the nonce;
  - session keys;
  - run ids;
  - `traceparent`.
- **reason fingerprint.** `reason.hash` must be the first 16 hex characters of sha256 over the exact reason/task string, and `reason.length` must be its JS `.length`. TraceQL matches `.reason.length=<n>` unquoted, so the attribute should be an int (inference) (collect:178-196, 665-672).
- **Typed tool span name.** `openclaw.tool.execution` with `gen_ai.tool.name=<tool>` is the only one accepted on continuation rows (collect:483-487). `openclaw.toolName` counts only on the tool-row path (R-RC-1, R-CW-TOKEN; collect:582-589).
- **Tool Search.**
  - Rows unwrap `dispatch_action`/`tool_call {id, args}` (lib/tool-call-identity.mjs:44-92) and pair toolResults by `toolCallId` only.
  - R-RC-1's `sessions.get` read is triggered only by a `request_compaction`-named toolResult or by the agent sentinel (see R-RC-1).
- **toolResult status bytes matched literally:**
  - continue_delegate `scheduled` (R-CD-1, R-CD-SILENT, R-CD-2);
  - continue_delegate `queued-for-compaction` with mode `post-compaction` (R-CD-3);
  - request_compaction `compaction_requested` (accepted) or `rejected` with `guard:"context_threshold"` (R-RC-1/2, R-CD-3), plus `contextUsage`/`threshold`, compared `<` in R-RC-2 (lib/request-compaction-receipt.js:242) and `<=` in R-CD-3 (lib/r-cd-3-lifeboat.mjs:246);
  - continue_work `scheduled` (R-CW-1..4, R-CW-DELEGATE-SELF child);
  - sessions_spawn accepted with `childSessionKey` (R-CW-TOKEN);
  - heartbeat_respond `status:"accepted"` (C-SHARED).
- **User-turn prefixes matched literally:**
  - `[continuation:wake]` (startsWith; lib/sentinel-binding.mjs:276-281; R-CW-*, R-RC-2, R-CW-TOKEN);
  - `[continuation:post-compaction] [continuation:chain-hop:N] ` (regex `^…\d+\] `; lib/r-cd-3-lifeboat.mjs:55-57; R-CD-3);
  - `[continuation:chain-hop:` in the delegate spawn task (R-CD-MODEL-TOKEN);
  - `[Subagent Task]` (child-observer.mjs:42);
  - `[Inter-session message]` with `sourceTool=subagent_announce` and `sourceSession=<delegate>` (lib/r-cd-token-contract.js:487-501; R-CD-TOKEN, the only PASS form).
  - `[continuation:work-wake]` (R-CW-TOKEN) is named in the manifest only; no code checks it.
- **R-CD-2.**
  - The send run's lifecycle end must carry `data.replayInvalid === true`, else FAIL `delegate-replay-unsafe` (scenarios/r-cd-2-silent-wake.js:431; lib/r-cd-2-authoritative-receipt.mjs:441-444, 550-555).
  - The wake is bound by `RCD2-WAKE-ACK <nonce>` assistant text or by a heartbeat `notify:false` + `outcome:"done"` record.
- **R-CD-3 trace receipts are expected to stay pending.** The scenario's own comment says the product releases the lifeboat with no dispatch/fire spans (scenarios/r-cd-3-post-compaction.js:205-207).
- **R-CD-TOKEN is PARTIAL by construction** while every delegate return is targeted (since 2273ef64d5). Only a direct `subagent_announce` row can PASS.
- **Checked less than the manifest says (code is weaker than the receipt prose):**
  - R-CW-4: no `chain.step` read. The collector passes with only hop 1's tool span on the trace.
  - R-CW-1/2: the wake is not checked against `delaySeconds`.
  - R-CW-TOKEN: no `[continuation:work-wake]` journal check; the `sessions_spawn` span status is not checked.
  - R-CW-DELEGATE-SELF: the parent's `continue_delegate` toolResult and the child's `continuation.work` spans are not checked.
  - R-CD-4: the `continue_delegate` toolResult is never read.
  - R-CD-CHAINED-DEPTH-2: the nested toolResult is not read.
  - R-OBS-1: only an agent-authored yes/no sentinel; the status card is not read.
  - R-CONFIG-DEFAULTS: types only, no values.
- **No FAIL path** in R-CD-1, R-CD-SILENT, R-CD-CHAINED-DEPTH-2, R-CD-4, R-CD-TOKEN, R-RC-1, R-CONFIG-*. A miss there is PARTIAL.
  - R-OBS-1 and R-CD-RETURN-OVERLAP/static rows give FAIL-candidate on any miss.
  - R-OBS-STATUS gives BAD_PROOF.
- **R-OBS-STATUS** executes the candidate's `formatStatusTextContinuationLine` body as plain JS.
  - The signature must end exactly `}): string | undefined {`.
  - The body must be TS-annotation-free, self-contained, and read from `params`.
  - Expected output: `'🔄 Continuation: chain 1/8'` for chainCount 1/max 8, and `undefined` for all zeros.
- **Static/read-only rows read `PROOFS/1cc8f4e3d617ef6f173283ef83d7b739a4995734/…`** (INDEX `static_evidence_sha`), never the candidate.

## COMMON

### C-SHARED: binding helpers used by most live rows (the product bytes they assume)
- **Tool identity under Tool Search.**
  - A `type:"toolCall"` part named `dispatch_action` or `tool_call` (case-insensitive) with a string `arguments.id` counts as a call of that id. A catalog id `^(openclaw|mcp|client):<x>:<tool>` is unwrapped to `<tool>`. The call's args are then `arguments.args` (lib/tool-call-identity.mjs:44-45, 80-92).
  - Arguments are read from `arguments` or `input`, as an object or a JSON string (lib/tool-call-identity.mjs:62-68).
  - A toolResult row is admitted when its `toolName` is the tool's name or the dispatcher's name (lib/tool-call-identity.mjs:95-97).
  - Name match also accepts `*__<tool>` (lib/sentinel-binding.mjs:146-148).
- **toolResult pairing.** A bound call is an assistant toolCall part that has a string `id` and whose `args[argField]` contains the nonce/needle (lib/sentinel-binding.mjs:166-171). A result counts only through `toolCallId` equal to that id (:205-229 history path; :231-262 live `session.message` path).
- **toolResult payload.** The first `type:"text"` part whose text parses as a JSON object, otherwise `message.details` (lib/sentinel-binding.mjs:175-187). `status` must be a string (:191). `isError` must be `=== true` to count as an error (:192).
- **Run stamp.** `message.__openclaw.runId`, otherwise the event envelope's `runId` (lib/wake-turn-receipt.mjs:95-100). Every "a run other than the dispatch run" predicate depends on this field. An exclusion list holding a null id binds nothing (lib/wake-turn-receipt.mjs:90-93).
- **Event session.** The top-level `sessionKey` and `session` of a `session.message` event must not disagree (lib/sentinel-binding.mjs:73-79).
- **Text authority.**
  - Only assistant `type:"text"` parts or string content count. Tool calls, thinking and user rows never count (lib/sentinel-binding.mjs:56-70).
  - Sentinels are matched exactly: `(^|[^A-Za-z0-9_-])<marker>\s+<nonce>(?=$|[^A-Za-z0-9_-])`.
  - Any text containing `[k6-proof-harness]` is refused (lib/wake-turn-receipt.mjs:43, 50-58).
- **Minted token.**
  - Format: `<marker> <nonce> TOKEN <[a-z0-9]{12}>`.
  - The token must be absent (case-insensitive) from harness-sent texts and from every user row of the same transcript (lib/sentinel-binding.mjs:29-30, 293-326).
  - A reply counts only if all three hold: its `__openclaw.runId` is outside the excluded runs, it has a numeric `timestamp`, and that timestamp is ≥ the token's timestamp. It fails closed when a timestamp is missing (lib/sentinel-binding.mjs:328-353). This relies on chat.history rows carrying a numeric `timestamp` plus `__openclaw.runId`.
- **Wake input row.** A `role:"user"` row whose text starts with `[continuation:wake]` and contains the needle (lib/sentinel-binding.mjs:276-281).
- **heartbeat_respond receipt.**
  - The call goes through `heartbeat_respond`, or the dispatcher with `id:"heartbeat_respond"`.
  - The sentinel must appear in `notificationText`, `notification_text` or `summary`, in both the call args and the result.
  - The result must have `status === "accepted"` and no `isError`, carry the same `toolCallId`, and run in the same run as the call (lib/wake-turn-receipt.mjs:42-44, 106-139, 155-200, 208-231).
  - `outcome` and `notify` are copied into the receipt (:149-150) but are not checked here. Rows that need `notify:false`/`outcome:"done"` check them themselves (see R-CD-2).
- **Lifecycle events.** `runId` sits on the event envelope. `stream:"lifecycle"` and `data.phase` must be `start` or `end` (lib/gateway-lifecycle.js:5-20).
  - A successful end has phase `end`, `aborted !== true`, no `error`, `yielded !== true`, and either `status` undefined with `aborted === false`, or `status` `"ok"` (lib/gateway-lifecycle.js:28-37).
  - A wake start has phase `start`, a run ≠ the accepted run, and the same session (:47-55).
  - The `sessions.send` response `runId` equals the idempotency key when one is supplied (:1-4).
- **Child observer** (it replaced the removed task ledger).
  - Preflight: the connect response must be `type:"hello-ok"` with `features.methods[]` containing every row method (lib/child-observer.mjs:81-131).
  - `sessions.list {spawnedBy: requester, limit}`: rows are rechecked client-side for `spawnedBy === requester`. Fields read: `key`, `status`, `endedAt`, `lastRunId`, `label`, `parentSessionKey`, `forkedFromParent` (lib/child-observer.mjs:316, 364-394). Paging uses `hasMore` and `nextOffset` (:461-475).
  - `chat.history {sessionKey, limit, offset}` pages back to `hasMore === false`. A response without `hasMore` gives HISTORY_PAGING_UNAVAILABLE, and the row goes PARTIAL (:478-499).
  - Binding: the child's own first user message carries the nonce or task token. Where the `[Subagent Task]` marker is present, only the text after it counts. A display-stripped first message is taken whole only if no user row has the marker and `forkedFromParent !== true` (:42, 230-245).
  - Terminal statuses: `done|failed|killed|timeout|interrupted` (:40). "Completed" means `status === 'done'` (:574).
  - A FORBIDDEN or unknown-method reply is recorded as observation_refused and gives PARTIAL, never "no child" (:28-31, 160-195).
- **Row identity tokens.**
  - Child keys bind only via the `task`, `text` or `title` field of the same structured record that carries `childSessionKey` (lib/row-child-correlation.mjs:6, 41-51).
  - Compact token is `<PREFIX>:<last 16 chars of nonce>` (:11-18). Templates render `{{nonceSuffix16}}` and `{{nonce}}` (:20-27).
  - Nonce format: `<ROW>-<Date.now()>-<rand8 base36>` (lib/gateway-ws.js:67-69).
- **Delegate return window.** It opens at `anchorAtMs + delayMs`. The legacy `OPENCLAW_MIN_DELEGATE_DELAY_MS` gate is diagnostic only (lib/delegate-return-window.mjs:13-20).

### C-TRACE: the Tempo collector (`scripts/collect-continuation-trace.mjs`) for every continuation row
- **Who owes a trace.**
  - A row owes one if its tool is `continue_work`, `continue_delegate` or `request_compaction`, or its toolSurface is `token` or `bracket-token` (lib/continuation-trace-requirement.mjs:29, 38, 93-116).
  - Receipt name: `continuation-trace-correlation.json` for continue_work/continue_delegate (or a token row with no tool). Any other tool (`request_compaction` R-RC-1, `sessions_spawn` R-CW-TOKEN) gets `tool-trace-correlation.json` (:50, 70-76).
- **Evidence inputs the scenario must record.**
  - `reason_hash`: 16 hex characters, not all zeros (collect:82-88, 178).
  - `reason_length`: a positive integer (collect:179-182).
  - `delegate_mode`: must equal the manifest mode when both are present (collect:143-150).
  - When the manifest template's only placeholders are `{{nonce}}`/`{{nonceSuffix16}}`, the collector re-renders it and requires `sha256(rendered).hex[0:16] === reason_hash` and `rendered.length === reason_length`, using JS UTF-16 `.length` (collect:123-130, 185-196).
  - Product implication: span attr `reason.hash` must be the first 16 lowercase hex characters of sha256 over the exact reason/task bytes, and `reason.length` must use the same length unit.
- **Span names.** Delegate rows: `continuation.delegate.dispatch` (accept) and `continuation.delegate.fire`. continue_work rows: `continuation.work` (accept) and `continuation.work.fire` (collect:141-160).
- **Search** (TraceQL, Tempo `/api/search`, limit 20; collect:235-243, 665-672).
  - Continuation rows: `{ resource.service.name="<svc>" && name="<accept span>" && .reason.hash="<h16>" && .reason.length=<n> [&& .delegate.mode="<mode>"] }`.
  - Tool rows: `{ resource.service.name="<svc>" && name="openclaw.tool.execution" && .gen_ai.tool.name="<tool>" }`.
  - `<svc>` is the seat-name prefix before the first `-` plus `-prince`, or `OPENCLAW_PROOFS_SERVICE_NAME` (lib/proofs-service-name.mjs:14-17).
  - Inference (TraceQL typing, not harness code): the unquoted `.reason.length=<n>` matches only an int-typed attribute.
- **Search window.** From `floor(dispatch_accepted_at_ms || started) − 60 s` to `max(dispatch, ended) + 60 s` (collect:26, 673-681).
  - More than one candidate trace throws "ambiguous". This is checked on every poll, through the settle period, and on the final query (collect:698-701, 740-769).
  - Consequence: a second matching trace in the window fails collection. For tool rows, any second span of that tool on the seat within ±60 s also counts as a second match.
- **validateTrace** (collect:448-580). All of these must hold:
  - Exactly one accept span whose name, `reason.hash`, `reason.length` (via `Number()`) and, for delegate rows, `delegate.mode` all match (:255-261, 450-456). Its status must be OK; UNSET is refused for the accept span (:458-460).
  - The accept span has a `chain.id` attribute that is a UUIDv4 (`^[0-9a-f]{8}-[0-9a-f]{4}-4…-[89ab]…$`) (:461-465). The attribute key is `chain.id`, not `continuation.chain.id`.
  - Fire spans match the same name, hash, length and mode, plus the same `chain.id`. Delegate rows need exactly one fire span; continue_work rows need ≥1. Every fire span must be status OK (:467-481).
  - Tool spans: `name === "openclaw.tool.execution"` with `gen_ai.tool.name === <tool>` (:483-487). `openclaw.toolName` is NOT accepted here (it is accepted only on the tool-row path below).
  - Delegate tool-span scoping by timing (:288-322, 488-494):
    - The anchor is the fire span's `startTimeUnixNano`. The deferral is the first present of fire `fire.deferred_ms`, fire `delay.ms`, accept `delay.ms`. It must be an OTLP `intValue` string of a positive integer (`^[1-9]\d*$`) (:273-286).
    - Tool spans must start within [anchor − deferral − 15000 ms, anchor − deferral + 1000 ms] (:27-28, 307-321).
    - A missing deferral or start time throws "lacks complete causal timing" (:301-305, 491-493). A delegate with delay 0 therefore needs `fire.deferred_ms ≥ 1`. A `delay.ms` of 0 fails.
    - A legacy public projection without any timing fields skips scoping (:298-300).
  - originSurface `raw-final-text` (bracket rows): zero tool spans in scope (:497-500).
  - Chain rows (`chainDepthTarget > 1`, R-CW-4): `scopeContinueWorkChain` (:334-427, 501-502). Every other row needs exactly one tool span (:503-509).
  - Tool span status must be UNSET or OK, and `openclaw.outcome !== "blocked"` (:510-516).
  - Accept, fire and tool spans share one traceId (:519-524) and have distinct spanIds (:532-540).
  - Accept, fire and tool spans must each have a `parentSpanId` (`idHex` throws on empty) (:528-530).
  - No parent/child edge is required between the tool, dispatch and fire spans; only same-trace is required (chain rows excepted). Children of the accept span are recorded, not required (:542-546).
- **validateToolTrace** (tool rows R-RC-1, R-CW-TOKEN; collect:582-609): exactly one `openclaw.tool.execution` span with `gen_ai.tool.name` or `openclaw.toolName` equal to the tool. No status check and no continuation spans are required.
- **Public-safety refusal** (collect:220-232). The collector throws if the raw trace JSON contains:
  - the substring `traceparent` (case-insensitive);
  - the raw reason;
  - any evidence string value of 6 or more characters whose key normalizes to contain `nonce`, `sessionkey`, `runid` or `idempotencykey`, ends in `session`, or is `task`/`message`/`prompt`/`prompttemplate`/`raw` etc. (scripts/sanitize-k6-artifacts.mjs:6-17, 56-78).
  - Product implication: no span or resource attribute may carry the raw reason/task, the nonce, a session key, a run id, or a `traceparent` key or value.
- **Public projection** (lib/public-tempo-trace.mjs:1-10, 59-79, 90-124):
  - It keeps only span names matching `^(openclaw|continuation)\.`.
  - It keeps only these attrs: `chain.id`, `delegate.mode`, `gen_ai.tool.name` and `openclaw.toolName` (values limited to continue_delegate/continue_work/request_compaction, so a `sessions_spawn` name is dropped), `openclaw.outcome` (`blocked` only), `reason.hash`, `reason.length`, `reason.present`.
  - `delegate.mode` must be one of `normal|silent|silent-wake|post-compaction`.
- **Outcome.**
  - Any throw sets the row's `tempo-trace-json` and correlation receipts as pending (`review-pending`). It does not change the scenario verdict, unless `OPENCLAW_PROOFS_K6_TEMPO_REQUIRED=true` sets postprocess rc=1 (scripts/run-proofs.sh:1356-1406).
  - Receipts are "held" only if they are regular files in the run dir that name the same traceId (lib/continuation-trace-requirement.mjs:181-206, 227-248).
- **Advisory telemetryContract.**
  - 23 manifests list attr `continuation.chain.id` (emittedByProduct:true) and, as not-yet-emitted, `continuation.session.fingerprint`, `continuation.turn.fingerprint`, `continuation.origin.run.fingerprint`, `continuation.signal.origin` and `openclaw.proof.run_id` (manifests/*.json `.telemetryContract.expectedTelemetry.attributes`).
  - These are `enforcement:"advisory"` and only shape-checked (scripts/check-telemetry-contracts.mjs:72, 100-189).
  - The collector itself reads only `reason.hash`, `reason.length`, `delegate.mode`, `chain.id`, `fire.deferred_ms`, `delay.ms`, `gen_ai.tool.name`, `openclaw.outcome`, and `openclaw.toolName` (tool path only).
- **Product citations in C-SHARED/C-TRACE code (verbatim).**
  - collect:324-327: `openclaw work-dispatch-execution.ts driveContinuationTurn -> runWithDiagnosticTraceparent(work.traceparent)`, `continue-work-tool.ts captures the live span`.
  - lib/continuation-trace-requirement.mjs:265: `continue-delegate-tool.ts DELEGATE_MODES`.
  - lib/tool-call-identity.mjs:4-12, 22 (at f15237ec92): `src/agents/tool-surface-plan.ts:145-150`, `src/agents/tool-catalog.ts:29`, `src/agents/tool-display-call.ts:5-24`, `src/agents/tool-search-catalog.ts:193`, `tool-search-runtime.ts:75-103`, `src/agents/session-tool-result-guard.ts:482-486`, `tool-display-call.ts:5 TOOL_CALL_DISPLAY_NAMES`.
  - lib/sentinel-binding.mjs:4-13 (at f15237ec92): `src/gateway/chat-display-projection.sanitize.ts:182-183,227-233`, `(:227-249)`, `src/gateway/session-transcript-message.ts:139-149`, `src/gateway/server/client-registry.ts:60-66`, `src/agents/internal-events.ts:159-219`, `src/auto-reply/continuation/work-dispatch-execution.ts:165-226`.
  - lib/wake-turn-receipt.mjs:3-29 (at 41b8d69b90): `targeting.ts:229-237`, `subagent-announce.continuation-return.ts :210-231`, `src/agents/tools/heartbeat-response-tool.ts` (`:21-37`, `:78-105`, `:54-75`), `packages/llm-core/src/types.ts:304-313`, `(:424-432)`, `session-tool-result-guard.ts:311`, `chat-display-projection.sanitize.ts :431-463`, `chat-display-projection.history.ts:329-334, 366`, `heartbeat-dispatch.ts:605-623`, `deliver-core.ts:214`, `heartbeat-events.ts:10-27`.
  - lib/gateway-lifecycle.js:23, 62, 66: `openclaw 41b8d69b90 / 14d31a81b1` lifecycle end shape `{ phase: "end", aborted: false, stopReason: "stop", executionSettled: true }`, `buildCodexLifecycleTerminalMeta`, `openclaw 14d31a81b1 ... requestHeartbeatNow`, `openclaw 8baac2feb6 (#1475) ... requestContinuationWake -> enqueueSessionEventForHost`.
  - lib/child-observer.mjs: `src/gateway/server-methods.ts:603-609`, `src/gateway/method-scopes.ts:277` (cut 41b8d69b90) (:8); `core-descriptors.ts:252`, `src/gateway/session-utils-row.ts:436,465,538-546`, `core-descriptors.ts:365`, `src/agents/subagents/spawn/subagent-system-prompt.ts:23-36` (:13-19); `packages/gateway-protocol/src/schema/sessions-row.ts:28-36` (:39); `src/gateway/server/ws-connection/connect-hello.ts:300`, `packages/gateway-protocol/src/schema/frames.ts:94,106-107` (:77-78); `src/gateway/chat-sanitize.ts`, `src/auto-reply/reply/user-envelope-display.ts` (at 935ba44c17) (:221-223); `chat-history-response-page.ts:91-112`, `chat-history-handler.cli-import.test.ts:465-470` (41b8d69b90) (:266-268); `src/gateway/session-list-filters.ts:150-163` (:366); `src/gateway/session-utils-row.ts:457 at openclaw 935ba44c17` (:394).
  - lib/row-child-correlation.mjs:4 and lib/child-observer.mjs:3: `6652f7eac8` (task ledger removed).

## R-CD-1 — scenarios/r-cd-1-typed-delegate.js

Manifest `manifests/r-cd-1.json`: invocation tool `continue_delegate`, mode `normal`, delaySeconds 1, promptTemplate has only `{{nonce}}` (r-cd-1.json:31-33). Methods: sessions.create, sessions.messages.subscribe, sessions.send, sessions.list, chat.history (r-cd-1.json:19; lib/child-observer.mjs:51).

### 1. Product strings/fields matched literally
- Connect preflight: the connect `res` payload must be `type:"hello-ok"` with `features.methods[]` containing every row method, or the row stops before dispatch (lib/child-observer.mjs:81-87, 108-131; scenario :317-323).
- `sessions.send` response `ok` → tool_invoke_accepted (:363-366). Dispatch run id = response `payload.runId` (string) (:367; lib/gateway-lifecycle.js:5-9). Optional `payload.traceId` copied to evidence.trace_id (:368) (no predicate uses it).
- Scheduled receipt (product-emitted): a `session.message` event whose top-level `sessionKey`/`session` is the parent (lib/sentinel-binding.mjs:73-79) carrying an assistant `toolCall` part that has an `id` and invokes `continue_delegate`. Matches if the raw name is `continue_delegate`, ends with `__continue_delegate`, or is `dispatch_action`/`tool_call` with `arguments.id` = `continue_delegate` or `<openclaw|mcp|client>:<x>:continue_delegate` (lib/sentinel-binding.mjs:146-171; lib/tool-call-identity.mjs:44-45, 80-92). Its `args.task` must contain the nonce (scenario :275; sentinel-binding.mjs:170). The toolResult row is paired by `toolCallId`. Its status comes from the first JSON `{...}` text part, falling back to `details`, and must be `status === "scheduled"` with `isError !== true` (scenario :396; sentinel-binding.mjs:175-193, 245-261).
- Its run id is taken from the toolCall row's `message.__openclaw.runId` or the event envelope `runId`. It is used as the dispatch run id only when sessions.send gave none (:398; lib/wake-turn-receipt.mjs:95-100).
- Agent-authored text: `CD1-DELEGATE-SCHEDULED <nonce>`, exact and word-bounded, in the parent assistant row's `type:"text"` parts, with no run id required (:401; sentinel-binding.mjs:96-113; wake-turn-receipt.mjs:50-58).
- Child binding (needed for PASS; see §5) uses `sessions.list {spawnedBy: parentKey}`:
  - Response fields read: `payload.sessions[]`, `hasMore`, `nextOffset`.
  - Row fields read: `key`, `spawnedBy` (must equal the parent, rechecked client-side), `status`, `endedAt`, `lastRunId`, `label`, `parentSessionKey`, `forkedFromParent` (lib/child-observer.mjs:316, 364-394, 461-475).
  - The child's own oldest `chat.history` page must answer `hasMore === false`. Without pagination fields the observer reports HISTORY_PAGING_UNAVAILABLE, which forces PARTIAL (child-observer.mjs:478-499).
  - The first user message must carry the nonce. If it has the product marker `[Subagent Task]`, the text after the marker is used. A display-stripped first message is taken whole only when no row has the marker and the child is not forked (child-observer.mjs:42, 230-245; scenario :378-386; lib/row-child-correlation.mjs:41-51).
- Child return (agent-authored, read from the product transcript): child `chat.history {sessionKey: child, limit: 200}` (:196) must contain an assistant text `CD1-DONE <nonce> TOKEN <[a-z0-9]{12}>` (:203; sentinel-binding.mjs:293-326).
  - The token must be absent (lowercase compare) from the harness task, the instruction, the requester's own call-args JSON, and every user row of the child transcript (:201-203, 274; sentinel-binding.mjs:316-318).
  - The row's numeric `timestamp` is kept as the ordering anchor.
- Parent return (agent-authored, in the woken parent run): parent `chat.history {sessionKey, limit: 200}` (:221) must contain an assistant text `CD1-RETURN <nonce> TOKEN <token>`. The row must have `__openclaw.runId` ≠ dispatch run and a numeric `timestamp` ≥ the child token's timestamp (:226-232; sentinel-binding.mjs:328-353).
- Diagnostics only:
  - `delegate.return` event name or `CD1-DONE <nonce>` text on the stream (:409).
  - Channel message = any event JSON containing `channel` plus the nonce (:425-427).

### 2. Ordering/timing
- sessions.subscribe goes out at startProofFlow; sessions.send follows 500 ms later (:257-281). The disposable-session create is sent 250 ms after hello (:293-299). Preflight timeout is 10000 ms (:311).
- Observer polls at 5000/15000/30000/60000 ms (:284-286). Socket closes at 120000 ms (:288). k6 maxDuration is 150 s (:53).
- Child history: up to 40 reads, retry 3000 ms, first read 1000 ms after binding (:191-197, 384). Parent history: up to 40 reads, retry 4000 ms, first read 1000 ms after the token (:211, 216-223, 234).
- Scheduled needs both the toolResult receipt and the text, in either order. The code does not enforce "text after toolResult" (:181-185).
- Return window is diagnostic only. It opens at scheduled_at + delayMs (1000). Legacy gate `OPENCLAW_MIN_DELEGATE_DELAY_MS` defaults to 5000 (:133, 410-422; lib/delegate-return-window.mjs:13-20).
- Early close happens after trace_collect_after_ms = scheduled_at + max(5000, 1000) + `OPENCLAW_TRACE_INGEST_GRACE_MS` (default 10000) (:171, 185, 240-252, 267).
- Ordering that binds: parent reply runId ≠ dispatch runId, and parent reply timestamp ≥ child token timestamp (gateway timestamps; fails closed if either is missing) (sentinel-binding.mjs:336-350). No absolute window applies.

### 3. Telemetry
- reason = `inv.promptTemplate.replace(/\{\{nonce\}\}/g, rowNonce)` (:262). The scenario records `reason_hash = sha256(task).hex[0:16]` (:263), `reason_length = task.length` (:264) and `delegate_mode = inv.mode` (`normal`) (:265).
- The template renders from the nonce alone, so the collector re-renders it and requires an equal hash and length (scripts/collect-continuation-trace.mjs:185-196, fingerprintSource `manifest-nonce`).
- The product must therefore emit span attr `reason.hash` = sha256(task) first 16 hex and `reason.length` = JS string length of the exact task the model passed (collector :255-261). The model has to copy `task="…"` byte-exact from the instruction (:269).
- originSurface is unset, so the typed path applies and the trace needs exactly one `openclaw.tool.execution` span with `gen_ai.tool.name="continue_delegate"` in the timing scope (collector :483-509).
- The scenario makes no span checks of its own. For the collector, see COMMON C-TRACE.
- Manifest telemetryContract (`enforcement: advisory`) names attr `continuation.chain.id` (sha256-16 form) (r-cd-1.json telemetryContract.expectedTelemetry.attributes[0]). The collector actually reads `chain.id` and requires a UUIDv4 (collector :462-465). The contract is shape-checked only (scripts/check-telemetry-contracts.mjs:100-189).

### 4. Product source citations verbatim
- Scenario, manifest: none (only issue refs `#562`, `#564`, `openclaw-bootstrap#1727`). Manifest census SHAs: `"reportCommit": "39803b297bd4786db3971eb82a3a7fd0b29bc643"`, `"productBasis": "6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955"` (r-cd-1.json:95-96).
- Shared libs this row's predicates rest on:
  - lib/tool-call-identity.mjs:5-12, 22: `src/agents/tool-surface-plan.ts:145-150`, `src/agents/tool-catalog.ts:29`, `src/agents/tool-display-call.ts:5-24`, `src/agents/tool-search-catalog.ts:193`, `tool-search-runtime.ts:75-103`, `src/agents/session-tool-result-guard.ts:482-486`, `tool-display-call.ts:5 TOOL_CALL_DISPLAY_NAMES`.
  - lib/sentinel-binding.mjs:6-13: `src/gateway/chat-display-projection.sanitize.ts:182-183,227-233`, `(:227-249)`, `src/gateway/session-transcript-message.ts:139-149`, `src/gateway/server/client-registry.ts:60-66`, `src/agents/internal-events.ts:159-219`, `src/auto-reply/continuation/work-dispatch-execution.ts:165-226`.
  - lib/child-observer.mjs:
    - :8: `src/gateway/server-methods.ts:603-609`, `src/gateway/method-scopes.ts:277`.
    - :13-19: `core-descriptors.ts:252`, `src/gateway/session-utils-row.ts:436,465,538-546`, `core-descriptors.ts:365`, `src/agents/subagents/spawn/subagent-system-prompt.ts:23-36`.
    - :39: `packages/gateway-protocol/src/schema/sessions-row.ts:28-36`.
    - :77-78: `src/gateway/server/ws-connection/connect-hello.ts:300`, `packages/gateway-protocol/src/schema/frames.ts:94,106-107`.
    - :222-223: `src/gateway/chat-sanitize.ts`, `src/auto-reply/reply/user-envelope-display.ts`.
    - :267-268: `chat-history-response-page.ts:91-112`, `chat-history-handler.cli-import.test.ts:465-470`.
    - :366: `src/gateway/session-list-filters.ts:150-163`.
    - :394: `src/gateway/session-utils-row.ts:457 at openclaw 935ba44c17`.
  - lib/gateway-lifecycle.js:1-4 (comment only, no file:line): sessions.send returns the `runId` (= idempotency key when supplied). Here the key is `R-CD-1-DISPATCH-<nonce>` (:279).

### 5. Verdict paths
- PASS-candidate requires all of the following (:463-465):
  - (disposable off or session_created)
  - tool_invoke_accepted
  - delegate_scheduled_sentinel (receipt `scheduled` AND text)
  - child_return_bound
  - parent_return_event
- The manifest calls the child "optional", but child_return_bound can only come from the observer-bound child key (:191, 378-386). So a child with no observer binding is in practice PARTIAL.
- PARTIAL-candidate otherwise (:466). It is also forced by failClosedVerdict when:
  - preflight was refused, timed out or never completed
  - the observer was refused (FORBIDDEN/missing scope/unknown method)
  - the observer was incomplete: unrecovered error, HISTORY_UNBOUND after 8 attempts, PAGINATION_TRUNCATED, HISTORY_PAGING_*, or INVALID_TRAVERSAL (lib/child-observer.mjs:160-173, 184-193, 597-625).
- No FAIL path exists. A non-`scheduled` or isError toolResult just leaves the scheduled receipt unset, giving PARTIAL (:396). A missing dispatch runId means no parent reply can bind, giving PARTIAL (sentinel-binding.mjs:338-339).
- The runner takes the last `VERDICT: X-candidate` line from the VU log over the summary file (scripts/run-proofs.sh:1222-1236). handleSummary's verdict is only `proof_failures==0` (:478-484). Trace receipts affect review completeness, not the verdict (COMMON C-TRACE).

---

## R-CD-2 — scenarios/r-cd-2-silent-wake.js (manifests/r-cd-2.json)

Paths relative to `tools/k6-proofs/`. "S" = `scenarios/r-cd-2-silent-wake.js`, "RCPT" = `lib/r-cd-2-authoritative-receipt.mjs`, "GL" = `lib/gateway-lifecycle.js`, "TS" = `lib/r-cd-2-terminal-sentinel.js`, "SRD" = `lib/r-cd-2-same-run-delegate.mjs`, "COL" = `scripts/collect-continuation-trace.mjs`.

The verdict authority: the scenario always prints `PARTIAL-candidate` (S:629, S:639). The runner swaps in `.verdict` from `r-cd-2-authoritative-receipt.json` written by `scripts/resolve-r-cd-2-authoritative-receipt.mjs` (scripts/run-proofs.sh:1440-1466). If the resolver fails, the verdict is `PARTIAL-candidate` with source `r-cd-2-authoritative-receipt-missing` (run-proofs.sh:1463-1465). The resolver is `resolveRcd2AuthoritativeReceipt` (RCPT:598-697).

### 1. Product strings/fields matched literally

**Product-emitted bytes (gateway/runtime)**
- **Preflight:** hello-ok `features.methods` must advertise `sessions.create`, `sessions.messages.subscribe`, `sessions.send`, `sessions.list` and `chat.history` (lib/child-observer.mjs:43,51; S:193,307-313; manifest `scenario.methods`). A refusal closes the socket before dispatch (S:308-311).
- **`sessions.create`:** request params `{key: "r-cd-2-<nonce lowercased, non [a-z0-9-] -> '-'>", label: "k6 R-CD-2 <nonce>"}` (S:284-288). The response must be `ok` with `payload.key`, which becomes the row session key for every later comparison (S:338-342).
- **`sessions.list {limit:20}`:** the response `payload.sessions` (or `payload.items`) must contain a row with `key === sessionKey`. That row must have none of `channelId`, `channel` or `deliveryChannel` (S:344,352-358).
  - If the row is missing or bound, the scenario sets `dispatch_failure_observed=true` (S:360). The resolver then returns FAIL-candidate `provider-or-turn-failure` (RCPT:571).
  - So the session must appear in the first 20 rows.
- **`sessions.messages.subscribe`:** uses param `key`, not `sessionKey` (S:248).
- **`sessions.send` request:** `{key, message, idempotencyKey: "R-CD-2-<nonce>"}` (S:265-269).
- **`sessions.send` response:**
  - Must be `ok` with a top-level string `payload.runId` (GL:5-9; S:372). The comment says runId is the idempotency key when one is supplied (GL:1-4).
  - A missing `runId` sets `dispatch_failure_observed` (S:380-382), which gives FAIL `provider-or-turn-failure`.
  - Optional `payload.traceId` is recorded as `accepted_send_trace_id` (S:383-386). If present it must be 32 hex (RCPT:458-459) and equal the Tempo trace found by reason hash (RCPT:479-484).
- **Agent lifecycle events:**
  - Event name `agent` with envelope `runId` (string), `stream === "lifecycle"` (case-insensitive), and `data.phase` of `start` or `end` (GL:15-20; S:405-413).
  - Session identity for the wake is `eventData.sessionKey` or `eventData.session`; two differing values bind nothing (GL:39-45).
- **Success end of the dispatch run** (`gatewayLifecycleSucceeded`, GL:28-37): all of
  - `data.phase:"end"`;
  - `data.aborted !== true`;
  - `data.error === undefined`;
  - `data.yielded !== true`;
  - status: either `data.status` undefined AND `data.aborted === false` (explicit), or `data.status` equal to `"ok"` (case-insensitive).
  - The comment cites the live shape `{ phase:"end", aborted:false, stopReason:"stop", executionSettled:true }`, with failure statuses `"timed_out"` and `"cancelled"` (GL:22-27).
- **Replay refusal:** the dispatch run's lifecycle end must carry `data.replayInvalid === true` (S:431).
  - Required for PASS: `replaySafe` (RCPT:441-444).
  - If the send run scheduled the delegate and `replayInvalid` is not true, the result is FAIL-candidate `delegate-replay-unsafe` (RCPT:550-555).
- **Wake START:**
  - An `agent` lifecycle event with `phase:"start"`, a `runId` that is not the accepted send runId, and session key equal to the row session (GL:47-56; S:441).
  - Only start events with the return window open are recorded (S:445-458). Earlier starts are dropped, not stored.
  - `session.message` is never a wake start (S:477-481).
- **Same-run delegate success** (SRD:196-223):
  - Both rows are `session.message` rows whose run id (`message.__openclaw.runId`, else envelope `runId`) equals the accepted runId (SRD:203; lib/wake-turn-receipt.mjs:95-100).
  - The assistant `toolCall` part has a string `id`. Its name is `continue_delegate` or `*__continue_delegate`, or it is `dispatch_action` / `tool_call` with `arguments.id` equal to `continue_delegate` or `openclaw|mcp|client:<x>:continue_delegate` (SRD:206-212; lib/tool-call-identity.mjs:44-92). `args.task` contains the nonce.
  - The `role:"toolResult"` row with that `toolCallId` is `isError !== true`, and its status is `"scheduled"`. Status is read from the first JSON text part `{status}`, else `details.status` (SRD:174-188,216-218).
  - Any other status or isError gives `'failed'`, i.e. `typed_delegate_failure_category: 'tool-result-not-scheduled'` (SRD:236-240).
- **Heartbeat completion record** (a raw substring scan, S:516-523):
  - On ANY event: `JSON.stringify(eventData)` contains the row nonce AND the literal `"notify":false` AND the literal `"outcome":"done"`. There must be no whitespace after the colon and the quotes must be unescaped.
  - So only a structured-object `arguments` serialization matches. JSON-string arguments or `JSON.stringify(...,null,2)` result text would not.
  - The run is taken from the envelope `runId`, else `message.__openclaw.runId` (GL:101-105).
  - It binds as receipt source `'heartbeat-completion-record'` (GL:92-94).
- **Channel-delivery detector (negative):** an event whose JSON contains the nonce AND one of these (S:75-88,549-559):
  - the lowercased event name contains `delivery` plus one of `channel`, `message` or `outbound`; or
  - `eventData.channelId|channel_id|targetChannel|deliveryChannel` is truthy AND `deliveryStatus|delivery_state|deliveryState` (lowercased) is in `sent`, `delivered` or `completed`.
  - If the event also contains `[k6-proof-harness]`, it is the dispatch echo and is ignored (S:551-553). Otherwise `channel_message_observed=true` (S:555).
  - This is absence-based: only events on this socket's subscription count.
- **Diagnostic only (writes no outcome):** same-run events containing nonce + `continue_delegate` with `codex_dynamic_tool_error`, `"outcome":"blocked"`, `"status":"error"` or `"status":"rejected"` (S:537-544).
- **Optional child context:** the child-observer binding is `sessions.list {spawnedBy}` with row `spawnedBy` equal to the session, plus the first user message `[Subagent Task]` carrying the nonce (S:316-325; lib/child-observer.mjs:22-26,230-245,368).
  - The resolver does not read `child_created`. `lifecycleChecks` (RCPT:423-462) has no child key.
  - `observation_refused` and `verdict_reason` are not read by the resolver either.

**Agent-authored sentinels (model text, not product bytes)**
- **Dispatch terminal sentinel:** `RCD2-DELEGATE-SCHEDULED <nonce>` (S:102,262).
  - Matched in an assistant `message` (or `payload.message`) whose text parts, joined and trimmed, EQUAL the sentinel exactly (TS:9-24,26-31).
  - `thinking` and `reasoning` parts are ignored. Any other non-text part (e.g. a toolCall) makes the text null, so the sentinel must be in a text-only assistant row (TS:3,15-17).
  - The row's own runId is NOT checked. It counts only while `dispatchLifecycleActive` (between the accepted run's lifecycle start and end) and before any wake is bound (TS:33-41; S:495-506).
- **Wake ack:** `RCD2-WAKE-ACK <nonce>` (S:103,264). It is an exact-equality assistant text in a `session.message` whose top-level `sessionKey`/`session` equals the row session (TS:46-50). Its run (envelope `runId`, else `__openclaw.runId`) must differ from the accepted runId (S:486-489). It binds as `'assistant-wake-ack'` (S:492).
- **Dispatch instruction text** (S:260-264):
  - `[k6-proof-harness] Use tool_search to discover the deferred continue_delegate tool, then call dispatch_action with id from that result and args={task:"<prompt>", mode:"silent-wake", delaySeconds:1}.`
  - Prompt = manifest `promptTemplate` with `{{nonce}}` replaced: `Proof nonce {{nonce}}: reply with DONE and the nonce only. Do not mutate files. Do not post to any channel.` (manifest invocation.promptTemplate; S:255-256).

**Wake binding rule (`createSilentWakeBinder`, GL:71-97)**
- A wake binds only when the SAME runId has both a recorded in-window lifecycle start (`noteStart`) and a wake receipt (`assistant-wake-ack` or `heartbeat-completion-record`), in either order.
- The first binding wins (GL:75-79). A runId equal to the accepted runId is refused (GL:81,87).

### 2. Ordering/timing
- **Timers:**
  - Socket open, then preflight timeout of 10000 ms (S:301).
  - `sessions.create` at +250 ms after hello (S:283-289).
  - `sessions.send` at +500 ms after `startProofFlow` (S:254,270).
  - Observer polls at 5000, 15000 and 30000 ms (S:273-275).
  - Hard close at 90000 ms (S:278).
  - k6 `maxDuration: '120s'` (S:40); threshold `r_cd_2_duration p(95)<90000` (S:45).
  - Manifest `timeoutSeconds: 120`.
- **Event-order dependency:**
  - `agent` lifecycle events are processed only after `send_accepted` is true (S:405). If the dispatch run's lifecycle `start` arrives before the `sessions.send` response, `dispatchLifecycleActive` is never set, and the dispatch sentinel can never count (S:410-412,495-502).
  - `session.message` rows that arrive before the response are buffered (max 200) for the same-run tracker only (S:204,468-474). The sentinel/ack checks need `send_accepted` (S:476).
- **Delegate return window** (`delegateReturnWindow`, lib/delegate-return-window.mjs:13-21; S:445-450):
  - Anchor is `dispatch_accepted_at_ms`, the harness clock when the send response is received (S:371).
  - `delayMs = invocation.delaySeconds*1000 = 1000` (manifest `delaySeconds: 1`; S:447). The window opens at anchor+1000 ms.
  - Legacy gate `OPENCLAW_MIN_DELEGATE_DELAY_MS` defaults to 5000 (S:179), so `max(5000, 1000)` is diagnostic only (`wake_before_legacy_gate`, S:223).
- **Post-wake quiet:** on the bound wake, a timer of `OPENCLAW_POST_WAKE_QUIET_MS` (default 5000) runs (S:181,232-240). If no channel delivery is seen by then, `post_wake_quiet=true` and `post_wake_quiet_at_ms` is set, then the socket closes. `postWakeQuiet` is required for PASS (RCPT:446).
- **Resolver ordering** (harness ms, RCPT:405-421), all required for PASS:
  - `dispatch_accepted_at_ms <= dispatch_terminal_sentinel_at_ms`.
  - `dispatch_terminal_sentinel_at_ms <= dispatch_lifecycle_end_at_ms`.
  - `dispatch_lifecycle_end_at_ms <= wake_lifecycle_at_ms`. `wake_lifecycle_at_ms` is the time of the wake run's lifecycle START (S:455, GL:77). So the wake run must START after the dispatch run's END has been observed. An overlapping wake start gives `missing-send-run-lifecycle` (PARTIAL).
  - `wake_lifecycle_at_ms <= post_wake_quiet_at_ms`.
- **Distinct runs:**
  - `distinctWakeRun` requires `sha256(sendRunId)[:16]` ≠ `sha256(wakeRunId)[:16]` (RCPT:451-452).
  - `terminalRunMatchesSend` requires `terminal_run_fingerprint` (set in `maybeRecordDispatchTerminalSuccess`, S:210-219) to equal `send_run_fingerprint`, with `send_run_mismatch` not true (RCPT:456-457).
- **Collector timing:**
  - Defaults: `timeoutMs 180000`, `pollMs 2000`, `settleMs` = poll (COL:47-49,77). The runner passes no override (run-proofs.sh:1363-1371).
  - Tempo search window: `[floor(dispatch_accepted_at_ms/1000) - 60, max(dispatchSec, floor(ended/1000)) + 60]` (COL:723-731).
  - The resolver re-checks those exact bounds against the evidence (RCPT:349-357).
- **Tool-span scoping:** the window is `[fireStart - deferredMs - 15000 ms, fireStart - deferredMs + 1000 ms]` (COL:26-27,288-322).
  - `deferredMs` comes from fire attr `fire.deferred_ms`, else fire `delay.ms`, else dispatch `delay.ms`. It must be a positive `intValue` string (COL:273-297).
  - If that attr is missing, or the span start times are missing, the trace is refused as `invalid-timing` (COL:301-305,491-493).

### 3. Telemetry
- **Hashed string:** `prompt = promptTemplate.replace(/\{\{nonce\}\}/g, nonce)`. Then `reason_hash = sha256(prompt).hex[:16]`, `reason_length = prompt.length` and `delegate_mode = "silent-wake"` (S:256-259).
  - The collector re-renders the manifest template with the nonce and requires equal hash and length (COL:185-196). This sets `reason.source = "manifest-nonce"`, which the acquisition validator REQUIRES (RCPT:230).
  - So the product's `reason.hash`/`reason.length` must be computed over the exact task string the model passed: sha256 hex first 16 chars, with a UTF-16 `.length`.
- **Tempo query** (exact string, COL:714-720): `{ resource.service.name="<svc>" && name="continuation.delegate.dispatch" && .reason.hash="<h>" && .reason.length=<n> && .delegate.mode="silent-wake" }`.
  - `<svc>` is `OPENCLAW_PROOFS_SERVICE_NAME`, or else `<seat prefix before '-'>-prince` (lib/proofs-service-name.mjs:14-17).
  - The resolver requires this exact query string and its sha256 (RCPT:213-217,237-239).
  - Exactly 1 search candidate is allowed through the poll, stabilization and final queries (COL:749-818).
- **`validateTrace`** (COL:448-580), consumed by the R-CD-2 receipt:
  - Exactly 1 `continuation.delegate.dispatch` span with attrs `reason.hash`, `reason.length` and `delegate.mode="silent-wake"`. Its status must be `OK`, and attr `chain.id` must be a UUIDv4 (COL:450-465).
  - Exactly 1 `continuation.delegate.fire` span with the same reason attrs, mode and `chain.id`, status `OK` (COL:467-481). Repeated fires are allowed only for `continue_work` (COL:473).
  - `openclaw.tool.execution` spans with `gen_ai.tool.name === "continue_delegate"`, scoped by timing: exactly 1 (COL:483-509).
    - Note: the scenario makes the model call `dispatch_action` (S:261). The trace still needs `gen_ai.tool.name="continue_delegate"` on the tool span; `openclaw.toolName` is NOT accepted on this continuation path (COL:485-486, vs the tool-row path at COL:586-588).
  - Tool span status must be `UNSET` or `OK`, and `openclaw.outcome` must not be `blocked` (COL:510-516).
  - Dispatch, fire and tool share one traceId (COL:519-524). Their span IDs are distinct (COL:532-540).
  - The dispatch and tool `parentSpanId` must be decodable 8-byte IDs (COL:528-531). No parent/child relation is required between them.
- **Raw-trace safety:** the raw trace must not contain `traceparent`, the raw prompt, or any sanitizer token of 6 characters or more (COL:220-232).
- **R-CD-2 collector branch:**
  - `row_nonce_fingerprint` must equal `sha256(nonce)[:16]` (COL:647-662).
  - `rowBinding` is written as `{acceptedSendRunFingerprint: evidence.send_run_fingerprint, nonceFingerprint, acceptedSendTraceId: evidence.accepted_send_trace_id || traceId, acceptedSendTraceSource: 'sessions-send-response' | 'unique-reason-bound-trace'}` (COL:871-884).
  - Also written: `collector`, `nonce`, `querySha256`, `finality`, `tempoSnapshot` and `uniqueness` (COL:808-837). Then an HMAC seal with `OPENCLAW_GATEWAY_TOKEN` (COL:902-907).
- **Acquisition receipt shape** (RCPT:199-352), all required:
  - `attribution === 'reason-hash-length-mode'` (RCPT:223).
  - `continuation = {tool:'continue_delegate', originSurface:'typed-tool', acceptSpan:'continuation.delegate.dispatch', fireSpan:'continuation.delegate.fire'}` and `delegate.mode === 'silent-wake'` (RCPT:231-238).
  - `toolSpanIds.length === 1`, `fireSpanIds.length === 1`, `fireAttemptCount === 1` and dispatch ≠ fire (RCPT:313-335).
  - `finality.candidateCount 1`, `stable true`; `uniqueness.acceptedTraceCount 1`, `resultClass 'unique'` (RCPT:250-275).
  - The evidence join: nonce sha256 and length, `reason_hash` and `reason_length`, send run fingerprint, and accepted-trace source/ID (RCPT:333-358).
- **Topology checks** (RCPT:503-525): `typedTool`, `silentWake`, `exactlyOneToolSpan`, 32-hex `traceId`, non-empty `chainId`, distinct dispatch/fire, `rowBinding` fields, `collectorUnique`, `authenticatedAcquisition`.
- **Joins** (RCPT:479-501,527-545):
  - `send_run_fingerprint` equals `rowBinding.acceptedSendRunFingerprint`.
  - The nonce fingerprint equals `rowBinding.nonceFingerprint`.
  - The accepted trace: if `sessions.send` returned `traceId`, it must equal the Tempo trace ID. Otherwise the source must be `unique-reason-bound-trace`.
- **Manifest attr name vs collector:** the manifest `telemetryContract` (advisory, `enforcement:"advisory"`) lists attribute `continuation.chain.id`, but the collector actually reads `chain.id` (COL:462,470). The public projection allowlists `chain.id` only (lib/public-tempo-trace.mjs:1-10,71-72).
  - Manifest spans: `continuation.delegate.dispatch`, `continuation.delegate.fire` and `openclaw.tool.execution` (`emittedByProduct:true`); `continuation.finalization` (`emittedByProduct:false`; openclaw#1254).
- **Trace-held rule:** R-CD-2's trace counts as held only through the signed receipt (`rCd2ReceiptHoldsTrace`, RCPT:698-715; lib/r-cd-2-authority-context.mjs:1033-1050). The public `evidence.jsonl`, k6 log and journal are replaced by a withheld notice (run-proofs.sh:1570-1584).

### 4. Product source citations verbatim
- None of the R-CD-2 files cite product `*.ts:line`.
- Product SHAs and function names cited:
  - GL:23 `openclaw 41b8d69b90 / 14d31a81b1 is { phase: "end", aborted: false, stopReason: "stop", executionSettled: true, ... } (codex harness buildCodexLifecycleTerminalMeta returns undefined on success; failures set status "timed_out" or "cancelled")`.
  - GL:62-63 `heartbeat_respond (openclaw 14d31a81b1, whose targeting still woke through requestHeartbeatNow)`.
  - GL:66-70 `From openclaw 8baac2feb6 (#1475) a delegate return wakes an ordinary session-event turn (requestContinuationWake -> enqueueSessionEventForHost): no heartbeat_respond exists there, its input rows are hidden from session.message, and its lifecycle data names no delegate`.
  - S:483 `A session-event wake (openclaw 8baac2feb6) answers in assistant text`.
  - S:167 `tasks.list removed upstream in 6652f7eac8`.
  - S:422-426: the product contract (dated 2026-10-05) that a turn that spawned a delegate ends with `replayInvalid:true`.
  - SRD:6 `the current product writes that record from the WAKE run (docs #572)`.
  - SRD:9-11: the transcript shape `{ type:"toolCall", id, name:"continue_delegate", arguments:{ task } }` / `{ role:"toolResult", toolCallId, toolName, isError?, content:[{ type:"text", text:'{"status":"scheduled",...}' }] }` "both stamped __openclaw.runId".
- `manifests/r-cd-2.json` telemetryContract.census: `"issue": "karmaterminal/openclaw#1254"`, `"reportCommit": "39803b297bd4786db3971eb82a3a7fd0b29bc643"`, `"productBasis": "6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955"`.
  - `productIssue: karmaterminal/openclaw#1254` repeats on `continuation.finalization`, `continuation.outcome`, `continuation.signal.origin`, `continuation.origin.run.fingerprint`, `continuation.session.fingerprint`, `continuation.turn.fingerprint` and `openclaw.proof.run_id`.
- Inherited shared-lib citations used by this row:
  - lib/tool-call-identity.mjs:25-34: `src/agents/tool-surface-plan.ts:145-150`, `src/agents/tool-catalog.ts:29`, `src/agents/tool-display-call.ts:5-24`, `src/agents/tool-search-catalog.ts:193`, `tool-search-runtime.ts:75-103`, `src/agents/session-tool-result-guard.ts:482-486`.
  - lib/child-observer.mjs:7-20: `src/gateway/server-methods.ts:603-609`, `src/gateway/method-scopes.ts:277`, `core-descriptors.ts:252`, `src/gateway/session-utils-row.ts:436,465,538-546`, `core-descriptors.ts:365`, `src/agents/subagents/spawn/subagent-system-prompt.ts:23-36`.
  - lib/child-observer.mjs:39: `packages/gateway-protocol/src/schema/sessions-row.ts:28-36`.
  - lib/child-observer.mjs:367: `src/gateway/session-list-filters.ts:150-163`.
  - lib/child-observer.mjs:390: `src/gateway/session-utils-row.ts:457`.
  - lib/wake-turn-receipt.mjs:3-28: `targeting.ts:229-237`, `subagent-announce.continuation-return.ts:210-231`, `src/agents/tools/heartbeat-response-tool.ts` `:21-37`, `:78-105`, `:54-75`, `packages/llm-core/src/types.ts:304-313`, `:424-432`, `session-tool-result-guard.ts:311`, `chat-display-projection.sanitize.ts:431-463`, `chat-display-projection.history.ts:329-334, 366`, `heartbeat-dispatch.ts:605-623`, `deliver-core.ts:214`, `heartbeat-events.ts:10-27`.
  - lib/continuation-trace-requirement.mjs:265: `continue-delegate-tool.ts DELEGATE_MODES`.

### 5. Verdict paths (resolver `categoryFor`, RCPT:547-596; resolve RCPT:647-666)
- **PASS-candidate:** every `lifecycleChecks` key is true (RCPT:423-466) AND every `topologyChecks` key AND both joins (RCPT:647-651). The lifecycle keys:
  - `sessionCreated`, `sessionUnbound`, `sendAccepted`, `sendRunCaptured`;
  - `dispatchTerminalSentinel` and its same-run window;
  - `terminalSuccessSameRun`;
  - `typedDelegateAttemptedSameRun`, `typedDelegateSuccessSameRun`, `typedDelegateFailureFree`;
  - `replaySafe` (`replayInvalid:true`);
  - `wakeLifecycle`, `wakeSessionBound`, `postWakeQuiet`;
  - `noChannelDelivery` (`channel_message_observed === false`) and `dispatchFailureFree`;
  - valid and distinct send/wake fingerprints, `rowNonceFingerprint`, `terminalRunMatchesSend`, `acceptedSendTraceShape`;
  - the four ordering checks.
  - Note that `sessionCreated` means disposable mode must be on (`OPENCLAW_CREATE_DISPOSABLE_SESSION` default `true`, S:99).
- **FAIL-candidate** (conclusive set, RCPT:32-37), checked in this order:
  1. `silent-channel-delivery`: `channel_message_observed` (RCPT:548).
  2. `delegate-replay-unsafe`: same-run delegate scheduled AND `replay_refused_observed === false` (lifecycle end lacked `replayInvalid:true`) (RCPT:551-555).
  3. `provider-or-turn-failure`:
     - the same-run toolResult was not `scheduled`, or isError (RCPT:556-559);
     - OR `dispatch_failure_observed` (RCPT:571). That flag is set by: `sessions.send` rejected (S:388-392); a send response without `runId` (S:380-382); a dispatch lifecycle end that is not successful (aborted, error, yielded, or status not ok) (S:417-419); a disposable session missing from `sessions.list` or bound (S:359-363).
  4. `missing-terminal-sentinel`: the sentinel was not observed in the dispatch window AND (the delegate was scheduled, OR there was no attempt plus terminal success, OR the scenario tagged it) (RCPT:560-567). The scenario tags it when the send run succeeded without the sentinel (S:585-590).
- **PARTIAL-candidate:**
  - `delegate-not-spawned`: the send was accepted and terminal success observed with the sentinel, but no `continue_delegate` call was seen on the send run (RCPT:577-583).
  - `send-run-mismatch`: the fingerprints differ, or a lifecycle end was attributed to another run (RCPT:584-590).
  - `missing-send-run-lifecycle`: any other lifecycle gap (RCPT:591). This includes no in-window wake start, no wake receipt on the same run, a wake start before the dispatch end, no quiet window, and a failed `sessions.create`.
  - `missing-continuation-topology`: no correlation file, e.g. the collector timed out or the trace was ambiguous (RCPT:592).
  - `send-topology-mismatch`: the topology is OK but the joins fail (RCPT:593-595).
  - `invalid-continuation-topology` (RCPT:596).
  - The resolver throws, leaving the runner at PARTIAL `r-cd-2-authoritative-receipt-missing` (run-proofs.sh:1463-1465), if: the acquisition receipt is invalid (RCPT:606-614); or the authority context is invalid. The context requires `candidateSha === runtimeBuildSha` (lib/r-cd-2-authority-context.mjs:371-374) and a seat-readiness v2 `PASS-candidate` with `config.get` cli auth and bindings (lib/r-cd-2-authority-context.mjs:298-342). It also requires manifest `invocation.tool` to be `continue_delegate` and `mode` to be `silent-wake` (lib/r-cd-2-authority-context.mjs:450-451).
- **Not consulted by the resolver:** `child_created`, `observation_refused`, `verdict_reason`, `wake_ack_observed`, `silent_status_record_observed`, `wake_before_legacy_gate` and `delegate_failure_text_seen_same_run` do not affect the verdict, beyond feeding the binder (RCPT:423-462). The k6 `failures` counter (S:610-621) is not the verdict source for this row.
- **Signing/hygiene:** HMAC sealing and validation with `OPENCLAW_GATEWAY_TOKEN` (RCPT:187-197,397-403,716-768), provenance and digest reconciliation (lib/r-cd-2-authority-context.mjs), and the selected-context receipt are bookkeeping, not product bytes.

## R-CD-3 — scenarios/r-cd-3-post-compaction.js (manifests/r-cd-3.json; lib/r-cd-3-lifeboat.mjs)

Note: lib/request-compaction-receipt.js is NOT imported by R-CD-3 (imports at scenarios/r-cd-3-post-compaction.js:47-77); it uses its own classifier in lib/r-cd-3-lifeboat.mjs. scripts/run-accepted-compaction-fixture.mjs / scripts/lib/accepted-compaction-orchestrator.mjs are not referenced by r-cd-3, r-rc-1 or r-rc-2 manifests or by run-proofs.sh (grep: only manifests/r-rc-2.json:256-257 mentions an accepted-compaction fixture, in prose). They are not on the live path for these three rows.

### 1. Product strings/fields matched literally
- Preflight: hello-ok `payload.type === 'hello-ok'`, `payload.features.methods` must include sessions.create, sessions.messages.subscribe, sessions.send, sessions.list, chat.history, sessions.describe (lib/child-observer.mjs:43,54,81-87,108-131; gate used at scenarios/r-cd-3-post-compaction.js:217,560-566).
- Disposable session: `sessions.create {key:"r-cd-3-<nonce>", label}` response `payload.key` must be a string that is not the configured session; else nothing is sent (scenarios/r-cd-3-post-compaction.js:524-525,595-616,120-125).
- Fill measurement (product `sessions.describe {key}` → `payload.session`): reads `totalTokensFresh === true`, numeric `totalTokens`, numeric `contextTokens > 0`, string `sessionId` (lib/r-cd-3-lifeboat.mjs:119-128; call at scenarios/r-cd-3-post-compaction.js:301,627). usage = totalTokens/contextTokens (lib/r-cd-3-lifeboat.mjs:127).
- Mid-fill compaction detection: `sessionId` changes, or `totalTokens` falls (scenarios/r-cd-3-post-compaction.js:309-317).
- Fill-turn end: `agent` event with envelope `runId` === fill run, `stream` 'lifecycle', `data.phase` 'end' (scenarios/r-cd-3-post-compaction.js:652-656; lib/gateway-lifecycle.js:5-20). Fill/proof run id = `sessions.send` response `payload.runId` (scenarios/r-cd-3-post-compaction.js:619,632; lib/gateway-lifecycle.js:5-9). `payload.traceId` recorded if present (:633).
- continue_delegate staging receipt (product toolResult): call = assistant toolCall of `continue_delegate` (by name, `*__continue_delegate`, or Tool Search `dispatch_action`/`tool_call` with `arguments.id`) whose `task` arg includes taskToken `RCD3:<last16 of nonce>`; result = role toolresult (case-insensitive) with matching `toolCallId` (scenarios/r-cd-3-post-compaction.js:373; lib/r-cd-3-lifeboat.mjs:100-102,275-277; lib/sentinel-binding.mjs:144-229; lib/tool-call-identity.mjs:44,80-92; lib/row-child-correlation.mjs:11-18).
  - Staged iff exactly one bound receipt, `!isError`, payload `status === 'queued-for-compaction'` AND payload `mode === 'post-compaction'` (lib/r-cd-3-lifeboat.mjs:267-273). Payload = first JSON text content part, else `details` (lib/sentinel-binding.mjs:175-187).
- request_compaction receipt (product toolResult): call whose `reason` includes the nonce (scenarios/r-cd-3-post-compaction.js:374; lib/r-cd-3-lifeboat.mjs:262-264). Classifier (lib/r-cd-3-lifeboat.mjs:234-260):
  - `isError` → error (:240)
  - `status 'compaction_requested'` + numeric `contextUsage` → accepted; without contextUsage → invalid (:241)
  - `status 'rejected'` + `guard 'context_threshold'`, neither `contextUsage` nor `threshold` numeric → context_unknown (:242-243)
  - same with both numeric and `contextUsage <= threshold` → threshold_rejected_measured (`<=` because the tool rounds; :244-246); otherwise invalid (:247)
  - `rejected` + `guard 'rate_limit'` → rate_limited (:249); `status 'already_pending'` → already_pending (:250); anything else → other (:251)
  - more than one bound receipt → ambiguous (:257)
- Released lifeboat child: `sessions.list {spawnedBy: <proof session>}` row with `spawnedBy` === proof session (lib/child-observer.mjs:316,368); child's spawn task = text after `[Subagent Task]` in its FIRST user message, or the whole first user text if display-stripped and not `forkedFromParent` (lib/child-observer.mjs:42,230-245). Bound via observer.boundChild(nonce, [taskToken]) (scenarios/r-cd-3-post-compaction.js:474). Task must match `/^\[continuation:post-compaction\] \[continuation:chain-hop:\d+\] /` after trimStart AND include taskToken (lib/r-cd-3-lifeboat.mjs:55-57,285-288; scenarios/r-cd-3-post-compaction.js:483). This is the product release composition the lib attributes to post-compaction-delegate-delivery.ts (lib/r-cd-3-lifeboat.mjs:25-28,56).
- Child row `status` recorded only (observer.childStatus), not gating (scenarios/r-cd-3-post-compaction.js:486,683).
- Requester refusal: any parent assistant toolCall (incl. dispatcher-wrapped) whose JSON args contain `[continuation:post-compaction]` → refuse binding (lib/r-cd-3-lifeboat.mjs:296-305; scenarios/r-cd-3-post-compaction.js:430-436,439,657).
- Agent-authored sentinels (not product bytes): lifeboat assistant text `RCD3-LIFEBOAT <nonce> TOKEN <[a-z0-9]{12}>` (lib/r-cd-3-lifeboat.mjs:53,308-310; lib/sentinel-binding.mjs:30,293-326); parent assistant text `RCD3-PARENT-RETURN <nonce> TOKEN <token>` (lib/r-cd-3-lifeboat.mjs:54,313-321; lib/sentinel-binding.mjs:328-353). Token must be absent from every harness-sent text (lifeboat task, compaction reason, fill headers, proof instruction, requester call-arg JSON) and from the child's user rows (scenarios/r-cd-3-post-compaction.js:220,281,380,504-506; lib/sentinel-binding.mjs:310-313).
- Product row stamps relied on: `__openclaw.runId` on chat.history assistant rows, numeric `timestamp` on the lifeboat token row and the parent reply row (lib/sentinel-binding.mjs:82-84,316-322,341-350; lib/wake-turn-receipt.mjs:95-100).
- No sentinel is read from the requester's event stream; only toolResults (by toolCallId) and requester toolCall args are read there (scenarios/r-cd-3-post-compaction.js:657-666).

### 2. Ordering/timing
- Fill target = clamp(env OPENCLAW_RCD3_FILL_TARGET || 0.75, 0.71, 0.83) (scenarios/r-cd-3-post-compaction.js:136; lib/r-cd-3-lifeboat.mjs:59-61). Threshold constant 0.7 "not configurable" (lib/r-cd-3-lifeboat.mjs:18,58-59).
- Budgets: 300,000 filler tokens, 6 turns, first chunk 40,000 chars, chunk 4,000..480,000 chars, initial 0.3 tok/char (lib/r-cd-3-lifeboat.mjs:62-69). Planner stops if `ceil(target*contextTokens) >=` automatic-compaction line minus margin, where line = window − min(max(reserve,20000), floor(window/4)) and margin = max(2000, ceil(0.02*window)) (lib/r-cd-3-lifeboat.mjs:71-98,151-158). Reserve override env OPENCLAW_RCD3_COMPACTION_RESERVE_TOKENS (scenarios/r-cd-3-post-compaction.js:141).
- Fill turn: describe poll every 10 s (scenarios/r-cd-3-post-compaction.js:290-295); measure 750 ms after lifecycle end (:655), re-measure 1,500 ms if total not yet grown (:324-326); per-turn timeout 300,000 ms (:139,320-323). Fill done when measured usage ≥ target (lib/r-cd-3-lifeboat.mjs:150) → proof turn sent (scenarios/r-cd-3-post-compaction.js:358-360).
- Proof turn: one sessions.send; instruction asks continue_delegate(mode="post-compaction", delaySeconds=0, task=JSON.stringify(lifeboatTask)) THEN request_compaction(reason) (scenarios/r-cd-3-post-compaction.js:375-382).
- Parent chat.history {limit:200}: first read 5,000 ms after accept (:635), then every 4,000 ms while compaction outcome unknown or accepted (:457), and 1,000 ms after the token is minted (:517).
- Non-accepted compaction outcome → close after 5,000 ms (:410-415). Accepted → observer poll at 3,000 ms then every 5,000 ms (:461-470); lifeboat history 500 ms after binding, retries every 3,000 ms, ≤40 reads, limit 100 (:488-500,509).
- Return ordering: parent reply runId ∉ {dispatch runId, every fill runId}; any null id in that list binds nothing (lib/wake-turn-receipt.mjs:90-93; scenarios/r-cd-3-post-compaction.js:446,620-622); reply timestamp ≥ lifeboat token timestamp; untimed reply fails closed (lib/sentinel-binding.mjs:338-352).
- Socket deadline 1,080,000 ms (scenarios/r-cd-3-post-compaction.js:142,542-545); k6 maxDuration 20m (:85); preflight connect timeout 10 s (:554).

### 3. Telemetry
- Hashed string: `lifeboatTask` = renderRowTaskTemplate(manifest promptTemplate, nonce) (scenarios/r-cd-3-post-compaction.js:154); `reason_hash = sha256(lifeboatTask)[0:16]`, `reason_length = lifeboatTask.length`, `delegate_mode = 'post-compaction'` (:370-372). Template has only {{nonce}}/{{nonceSuffix16}}, so the collector re-renders and cross-checks it (scripts/collect-continuation-trace.mjs:123-130,185-196). Hash matches the product span only if the agent passes the task bytes verbatim.
- Collector contract (delegate): `continuation.delegate.dispatch` with `reason.hash`, `reason.length`, `delegate.mode="post-compaction"`, status OK, `chain.id` UUIDv4. Exactly one `continuation.delegate.fire` on the same `chain.id`/mode, status OK. Exactly one `openclaw.tool.execution` with `gen_ai.tool.name="continue_delegate"` inside the causal window; all three on one trace (scripts/collect-continuation-trace.mjs:141-155,255-261,448-530).
- Causal window needs a positive-integer `fire.deferred_ms` or `delay.ms` (fire), else `delay.ms` (dispatch). The first such attribute present must be `/^[1-9]\d*$/` or the trace is refused as invalid-timing (scripts/collect-continuation-trace.mjs:273-310,491-493). This row stages with delaySeconds=0 (scenarios/r-cd-3-post-compaction.js:377; manifests/r-cd-3.json:35). A `delay.ms` of 0 alone fails this check.
- Attribute-name mismatch: the collector reads `chain.id` (scripts/collect-continuation-trace.mjs:462,470). The manifest telemetryContract lists `continuation.chain.id` (manifests/r-cd-3.json:155, also rebindKeys).
- Scenario-side span checks: none. `continuation.compaction.released` appears in manifest expectedTelemetry (manifests/r-cd-3.json:128ff) and is never checked by the scenario or the collector. The collector only records it as a child-span name under dispatch if one is parented there (scripts/collect-continuation-trace.mjs:542-546).
- Expected pending: per the scenario comment, the product releases the lifeboat with no dispatch span (openclaw#1497) and no trace carries the fingerprint (scenarios/r-cd-3-post-compaction.js:205-207). The manifest census says that at 293c977f62 the release from post-compaction-delegate-delivery.ts emits only `continuation.compaction.released` (manifests/r-cd-3.json:113).
- The trace never affects the verdict (classifyRcd3Evidence ignores it; lib/r-cd-3-lifeboat.mjs:343-382). Collector: see COMMON C-TRACE.

### 4. Product source citations (verbatim)
- scenarios/r-cd-3-post-compaction.js:38 `context-token-provenance.ts:50-108`; :39-40 `agent-runner-post-compaction-release.ts :149-170`.
- lib/r-cd-3-lifeboat.mjs:9 `openclaw f15237ec92`; :10 `src/agents/tools/request-compaction-tool.ts`; :11 `(:236-243)` unknown; :12 `(:244-255)` measured below; :15 `(:257-273)` rate_limit; :16 `(:226-232)` already_pending; :17 `(:377-387)` accepted; :18 `(:26)` threshold; :20 `src/auto-reply/reply/agent-runner-post-compaction-release.ts:149-170`; :24 `src/agents/tools/continue-delegate-tool.ts:389-418` (queued-for-compaction, no task echo); :28 `src/auto-reply/reply/post-compaction-delegate-delivery.ts:497-539`; :31 `delegate-dispatch-request.ts:43` (ordinary delegate task `[continuation:chain-hop:N] Delegated task (turn N/M): <task>`); :36 `packages/agent-core/src/harness/compaction/compaction.ts:260-269`; :38 `src/agents/agent-settings.ts:11,29-38; agent-compaction-constants.ts:2-13`; :42 `src/auto-reply/reply/agent-runner-memory.ts:112-300`; :56 `post-compaction-delegate-delivery.ts:499-502`; :58 `request-compaction-tool.ts:26 MIN_CONTEXT_THRESHOLD`; :70 `agent-settings.ts:11 DEFAULT_AGENT_COMPACTION_RESERVE_TOKENS_FLOOR`; :72 `agent-compaction-constants.ts:2 MAX_COMPACTION_RESERVE_RATIO`; :116 `agent-runner-post-compaction-release.ts:64-74 newSessionId`; :245 `request-compaction-tool.ts:244-253`.
- lib/child-observer.mjs:13-20 `core-descriptors.ts:252`, `src/gateway/session-utils-row.ts:436,465,538-546`, `core-descriptors.ts:365`, `src/agents/subagents/spawn/subagent-system-prompt.ts:23-36`; :39 `packages/gateway-protocol/src/schema/sessions-row.ts:28-36`; :221-222 `openclaw 935ba44c17`, `src/gateway/chat-sanitize.ts`, `src/auto-reply/reply/user-envelope-display.ts`; :367 `src/gateway/session-list-filters.ts:150-163`; :385 `src/gateway/session-utils-row.ts:457`.
- manifests/r-cd-3.json:105 `src/config/sessions/context-token-provenance.ts:50-108`, `src/auto-reply/reply/agent-runner-post-compaction-release.ts:149-170`; :111 reportCommit `39803b297bd4786db3971eb82a3a7fd0b29bc643`; :112 productBasis `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955`; :113 `karmaterminal/openclaw 293c977f62`, `post-compaction-delegate-delivery.ts`.

### 5. Verdict paths (lib/r-cd-3-lifeboat.mjs:343-382, then failClosedVerdict at scenarios/r-cd-3-post-compaction.js:685; VU log line :706 owns, per scripts/run-proofs.sh:1221-1236)
- PARTIAL: preflight not ok (:347); observer refused/incomplete (:348-355; also lib/child-observer.mjs:160-174); >1 bound child (:356); requester call carried the prefix (:357-359); fill stopped before the proof turn (:360-362), e.g. the planner cannot reach the target, a mid-fill compaction, a describe that is not fresh, or a non-disposable session (scenarios/r-cd-3-post-compaction.js:261-265,537); compaction kind threshold_rejected_measured (:368-373); context_unknown/rate_limited/already_pending/error/invalid/ambiguous/missing-with-staging/other (:374,327-336); accepted but no staging receipt (:375); no released lifeboat (:376); no minted token (:377); return unbound (:378-380).
- FAIL: proof sessions.send not accepted (:363); neither a staging receipt nor any request_compaction result bound (:365-367).
- PASS: accepted (`compaction_requested` + numeric contextUsage) AND staging `queued-for-compaction`/mode post-compaction AND released lifeboat (prefix + token + spawnedBy) AND minted token AND parent reproduction outside the proof/fill runs, after the token (:375-381).
- handleSummary: summaryRcd3Verdict returns PARTIAL unless the VU evidence verdict equals the reclassification (lib/r-cd-3-lifeboat.mjs:385-389).
- Trace receipts: review debt only. backendUnavailable disposition PARTIAL-candidate, which "never changes the VU verdict" (manifests/r-cd-3.json:252).

## R-CD-4 — scenarios/r-cd-4-target-session-key.js

(manifest `manifests/r-cd-4.json`; row lib `lib/r-cd-4-authority.mjs`. All paths relative to tools/k6-proofs/.)

### 1. Product strings/fields matched literally
- **No toolResult is read.** The continue_delegate toolResult status ("scheduled" etc.) is never checked; dispatch credit = `sessions.send` response `ok` + truthy `payload` (scenarios/r-cd-4-target-session-key.js:414-420). `payload.traceId` optional (:419).
- Agent-facing tool surface assumed (harness prompt, agent-authored call): `tool_search` discovers deferred `continue_delegate`, then `dispatch_action` with `args={task, mode:"silent-wake", delaySeconds:1, targetSessionKey}` (:283). So the product must expose Tool Search + `dispatch_action` and accept `targetSessionKey` on continue_delegate. mode/delay come from the manifest (manifests/r-cd-4.json:31-32; scenario :75-76).
- Disposable sessions (when `OPENCLAW_CREATE_DISPOSABLE_SESSIONS(=true)`, :88): `sessions.create {key:"r-cd-4-parent-<nonce>"|"r-cd-4-target-<nonce>", label}` and the response `payload.key` is taken as the session key (:257-273, :388-406). Otherwise `OPENCLAW_TARGET_SESSION_KEY` is required (:101-105).
- `sessions.messages.subscribe {key}` on both parent and target (:298-299).
- Event shape relied on: `session.message` with top-level `sessionKey`/`session` (both must agree if both present), `message.role === 'assistant'`, text from `content` string or `type:"text"` parts (lib/r-cd-4-authority.mjs:14-43). Run stamp = `message.__openclaw.runId`, else envelope `runId` (lib/wake-turn-receipt.mjs:95-100).
- Agent-authored sentinels, but the product must route them to the right session:
  - Priming: `TARGET-READY <nonce>` assistant text in the target session (lib/r-cd-4-authority.mjs:87-100). The match is word-bounded `(?:^|[^A-Za-z0-9_-])MARKER\s+NONCE(?=$|[^A-Za-z0-9_-])`, and any text containing `[k6-proof-harness]` is refused (:45-52).
  - Target ack, path A: assistant text `TARGET-ACK <nonce>` in the **target** session, in a stamped run ≠ priming run (lib/r-cd-4-authority.mjs:63-85; scenario :494-504).
  - Target ack, path B (heartbeat wake): a `heartbeat_respond` toolCall (direct, or via `dispatch_action` id unwrapping, lib/tool-call-identity.mjs:80-92) whose `notificationText`|`notification_text`|`summary` carries `TARGET-ACK <nonce>`. The paired toolResult (same `toolCallId`, not `isError`, JSON content `status === "accepted"`) must carry it too, in the same run (lib/wake-turn-receipt.mjs:44, :120-139, :164-166, :208-231). The toolResult name may be `heartbeat_respond`, `dispatch_action` or `tool_call` (lib/tool-call-identity.mjs:94-98). The receipt records `outcome`/`notify` but **does not gate on them** (lib/wake-turn-receipt.mjs:150-151).
  - `TARGET-RECEIVED <nonce>` (the child's reply, per the template at manifests/r-cd-4.json:34) is **never matched**. Only the console log text names it (:226, :231).
- Child identity:
  - Bound by the observer: a `sessions.list {spawnedBy:<parent>}` row whose own `spawnedBy` equals the parent (lib/child-observer.mjs:316, :368).
  - The child's own first user message (chat.history paged to the oldest page) must carry the nonce or the `RCD4:<last16 of nonce>` token. That message is the text after `[Subagent Task]`, or the whole message if display-stripped and not forked (lib/child-observer.mjs:230-245; lib/r-cd-4-authority.mjs:102-105; scenario :327).
  - Event-path records with `childSessionKey` + `task|text|title` containing the token are cross-checks only (lib/row-child-correlation.mjs:41-92; lib/child-observer.mjs:658-682; scenario :478-486).
- The child key must differ from both the parent and target keys (:205-206).
- Session row `status === 'done'` → `child_completed` (lib/child-observer.mjs:573-575; scenario :345-348). This is **not** part of the PASS predicate (:572-576).
- `chat.history {sessionKey, limit:200}` → `payload.messages` for target then parent (:245, :434-451).

### 2. Ordering/timing
- k6 `maxDuration: '120s'` (:45). Threshold `r_cd_4_duration p(95) < R_CD_4_DURATION_THRESHOLD_MS = 110_000` (:50; lib/r-cd-4-authority.mjs:5).
- Preflight connect answer within 10000 ms (:359). Parent create +250 ms after hello (:317). Target priming send +500 ms after subscribe (:301-312).
- Dispatch is sent 100 ms after `TARGET-READY` is observed (:475). The priming run id is captured from that row. If it is unstamped, no target ack can bind (:470-473; lib/wake-turn-receipt.mjs:90-93).
- After dispatch: observer polls at 8000/25000/50000/70000 ms (:289-291). The socket closes at `R_CD_4_OBSERVATION_WINDOW_MS = 90_000` (:292; lib/r-cd-4-authority.mjs:4).
- History polling starts 1000 ms after the send is accepted (:421). It repeats every 2000 ms until any receipt binds (:249-254), and polls immediately when the child row turns `done` (:348).
- Target heartbeat acks count only while `target_primed && tool_accepted` (:510). Assistant-text acks on the event path count only after `tool_accepted` (:492).
- History path: the ack must come after the last `TARGET-READY` row and in a run ≠ that row's run. If no anchor is found, there is no target credit (lib/r-cd-4-authority.mjs:172-205, :235-248).
- **No ordering vs the delegate fire or child end is required.** Only "after priming and in another run" matters.
- `wake_gate_ms = OPENCLAW_MIN_DELEGATE_DELAY_MS || 5000` (:148) is diagnostic only (lib/r-cd-4-authority.mjs:127-135, :162).
- Early close 2000 ms after a parent receipt (:527-534). A target receipt does **not** close early: the full window runs to prove no parent landing (lib/r-cd-4-authority.mjs:284-291).

### 3. Telemetry
- `reason_hash = sha256(prompt)[:16]` and `reason_length = prompt.length`, where `prompt = rCd4TaskPrompt(manifest promptTemplate, nonce)` = `"RCD4:<last16> Proof nonce <nonce>: reply with TARGET-RECEIVED and the nonce. Do not mutate files."` (:279-281; lib/r-cd-4-authority.mjs:107-114; manifests/r-cd-4.json:34).
  - The scenario DEFAULTS template (:63) differs: it adds "Do not post to any channel.". It is only used if the manifest lacks one (:77).
  - Placeholders are nonce-only, so the collector re-renders and cross-checks the hash (`fingerprintSource:'manifest-nonce'`, scripts/collect-continuation-trace.mjs:185-196).
  - So the product must emit `reason.hash`/`reason.length` over exactly the `task` arg.
- `delegate_mode = 'silent-wake'` (:282). The collector queries `.delegate.mode="silent-wake"` on both dispatch and fire (scripts/collect-continuation-trace.mjs:150, :260, :467-472).
- Typed row (no `originSurface`): exactly one `openclaw.tool.execution` span with `gen_ai.tool.name="continue_delegate"` inside the fire-anchored window (scripts/collect-continuation-trace.mjs:483-509).
  - The window needs `fire.deferred_ms` or `delay.ms` as a positive `intValue` on fire/accept. Expected ≈1000 for delaySeconds 1 (:293-297).
  - The window is [fireStart − deferred − 15000 ms, fireStart − deferred + 1000 ms] (:27-28, :307-320).
- Scenario-side span checks: none. `trace_id` is only recorded (:419).
- Manifest telemetryContract is `enforcement: "advisory"`, `rebindable: false` (manifests/r-cd-4.json:106-118).
  - It names `continuation.chain.id` (:145, :229), but the collector actually reads the attribute `chain.id` (scripts/collect-continuation-trace.mjs:462).
  - It lists `continuation.target.session.fingerprint` etc. as `emittedByProduct:false`, productIssue openclaw#1254 (manifests/r-cd-4.json:152-158).
- Collector: see COMMON C-TRACE.

### 4. Product source citations verbatim
- lib/r-cd-4-authority.mjs:170 — "(#567; chat-display-projection.history.ts:329-334, 366)"
- scenarios/r-cd-4-target-session-key.js:344 — "the bound child's own row status 'done' (sessions-row.ts:28-36)"
- manifests/r-cd-4.json:109-111 — census `"issue": "karmaterminal/openclaw#1254"`, `"reportCommit": "39803b297bd4786db3971eb82a3a7fd0b29bc643"`, `"productBasis": "6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955"`
- Via shared libs used by this row:
  - lib/wake-turn-receipt.mjs:3-29 — openclaw cut 41b8d69b90; targeting.ts:229-237; subagent-announce.continuation-return.ts:210-231; src/agents/tools/heartbeat-response-tool.ts (:21-37, :78-105, :54-75); packages/llm-core/src/types.ts:304-313, :424-432; session-tool-result-guard.ts:311; chat-display-projection.sanitize.ts:431-463; chat-display-projection.history.ts:329-334, 366; heartbeat-dispatch.ts:605-623; deliver-core.ts:214; heartbeat-events.ts:10-27
  - lib/child-observer.mjs:3-19, :39, :221-223, :266-267, :366, :394 — 6652f7eac8; server-methods.ts:603-609; method-scopes.ts:277 @41b8d69b90; core-descriptors.ts:252, :365; session-utils-row.ts:436,465,538-546; subagent-system-prompt.ts:23-36; packages/gateway-protocol/src/schema/sessions-row.ts:28-36; 935ba44c17 chat-sanitize.ts / user-envelope-display.ts; chat-history-response-page.ts:91-112; session-list-filters.ts:150-163; session-utils-row.ts:457 @935ba44c17
  - lib/tool-call-identity.mjs:4-22 — f15237ec92; tool-surface-plan.ts:145-150; tool-catalog.ts:29; tool-display-call.ts:5-24; tool-search-catalog.ts:193; tool-search-runtime.ts:75-103; session-tool-result-guard.ts:482-486

### 5. Verdict paths
- The scenario emits only `PASS-candidate` or `PARTIAL-candidate`. **No FAIL path exists** (:577; handleSummary :590-596 gives PASS iff `proof_failures == 0`).
- PASS needs all of (:572-576):
  - `target_primed`
  - `tool_accepted`
  - `agent_turn_observed`
  - a non-null, unambiguous child that is not the parent or target
  - `target_return_receipt !== null`
  - `parent_return_receipt === null`
- A receipt only finalizes once a child is bound (lib/r-cd-4-authority.mjs:294-298). An ack seen before the child binds is held as a candidate and re-finalized later (:182-196, :215).
- Negative control, a parent landing → PARTIAL (not FAIL). It triggers on any `TARGET-ACK <nonce>` in the parent:
  - assistant text in **any** run, including the dispatch run (no exclusion, lib/r-cd-4-authority.mjs:156-161, :206-210)
  - or a parent heartbeat ack after dispatch (:513)
- Child ambiguous (observer >1, event path >1, or event/observer disagreement) → PARTIAL (:326-339; lib/child-observer.mjs:671-680).
- Preflight refused/never completed, or observer refusal/incomplete (FORBIDDEN, HISTORY_UNBOUND, INVALID_TRAVERSAL, paging) → PARTIAL with reason (lib/child-observer.mjs:160-174, :596-626).
- `sessions.create` rejected → failure + close (:407-411). `sessions.send` rejected → failure (:425-428). Missing token, or a missing target key without disposable mode → early return, no evidence emitted (:95-105).
- No R-CD-4-specific runner gate (scripts/run-proofs.sh has no R-CD-4 branch). Disposable mode is set only by the operator env (scenario :88).

---

## R-CD-CHAINED-DEPTH-2 — scenarios/r-cd-chained-depth-2.js

Manifest `manifests/r-cd-chained-depth-2.json`: tool `continue_delegate`, mode `silent-wake`, delaySeconds 1, promptTemplate (only `{{nonce}}`) tells depth-1 to fire its own `continue_delegate(mode='silent-wake', task='Grandchild nonce {{nonce}}: …GRANDCHILD-DONE {{nonce}}…')` and then say `CHILD-DONE {{nonce}} CHILD-DELEGATE-SCHEDULED` (r-cd-chained-depth-2.json:36-38). Methods as R-CD-1 (lib/child-observer.mjs:55). Row lib: lib/r-cd-chained-depth-2-authority.mjs.

### 1. Product strings/fields matched literally
- Preflight hello-ok `features.methods` as in R-CD-1 (:310-316).
- `sessions.send` ok gives parent_dispatch_accepted. dispatch_run_id = `payload.runId` (:354-359). Idempotency key `R-CD-CHAIN-<nonce>`, the same string the model is told to pass to continue_delegate (:264, 271).
- Hop identities come only from the observer (maxDepth 2) (:159, 221-240):
  - The depth-1 `sessions.list {spawnedBy: root}` row has `spawnedBy === root`, and its first user message (`[Subagent Task]` rule) contains the chain nonce.
  - The depth-2 row is listed under `sessions.list {spawnedBy: <child key>}` with `spawnedBy === childKey`, and its first user message contains the nonce (lib/child-observer.mjs:364-394, 541-549).
  - So the product must stamp a nested delegate's session row with `spawnedBy` = the depth-1 child key.
  - More than one match at either depth sets chain_identity_conflict (:223, 232).
- Event-path cross-check (:377-381, 441-444): any subscribed event holding a structured record `{childSessionKey, task|text|title ⊃ nonce}` (lib/row-child-correlation.mjs:41-51, 68-92) that names a key other than the two lineage hops sets a conflict. So does a third such key.
- Child sentinel (agent-authored, from the product transcript): child `chat.history {limit: 200}` assistant text contains exact `CHILD-DONE <nonce> CHILD-DELEGATE-SCHEDULED`, no runId needed (:174, 180; sentinel-binding.mjs:121-138). The row does NOT check the child's nested continue_delegate toolResult status. Only the sentinel text is read.
- Grandchild sentinel: grandchild `chat.history` assistant text `GRANDCHILD-DONE <nonce>` (:181).
- Root ack, either form:
  - (a) a root `session.message` event (top-level `sessionKey`/`session` = root) with `message.role === 'assistant'` whose text parts contain `ROOT-CHAIN-ACK <nonce>` (word-bounded, no `[k6-proof-harness]` in the text). It needs a runId (`message.__openclaw.runId` or envelope `runId`) present and ≠ dispatch_run_id (lib/r-cd-chained-depth-2-authority.mjs:40-47, 59-77).
  - (b) heartbeat_respond (:247, 402-405; lib/wake-turn-receipt.mjs:106-134, 208-231):
    - an assistant toolCall `heartbeat_respond`, or `dispatch_action` `id:"heartbeat_respond"`, whose `notificationText`/`notification_text`/`summary` arg contains `ROOT-CHAIN-ACK <nonce>`;
    - its toolResult (toolName `heartbeat_respond` or dispatcher) with the same `toolCallId`, JSON `status === "accepted"`, not isError, and `notificationText`/`summary` also carrying the sentinel;
    - the same run, not the dispatch run.
  - The receipt also records `outcome` and `notify` (wake-turn-receipt.mjs:141-156). Neither is checked.
- Outer gate on both root-ack forms (:382-387): the raw event JSON must contain the nonce and must NOT contain `[k6-proof-harness]` anywhere.
  - Risk: a product `session.message` that spreads a session snapshot (lib/sentinel-binding.mjs:7-8) carrying the harness-prefixed first user message (e.g. a derived title or preview) would hide the ack.
- The root receipt finalizes only with distinct child and grandchild keys (lib/r-cd-chained-depth-2-authority.mjs:80-87; scenario :193-202).

### 2. Ordering/timing
- Dispatch goes out 500 ms after subscribe (:254-273). Disposable create is sent 250 ms after hello (:286-291). Preflight timeout is 10000 ms (:304).
- Observer polls at 8000/20000/40000/60000/90000/120000 ms (:276-278). Socket closes at 150000 ms (:281). k6 maxDuration is 180 s (:49).
- Hop history: up to 40 reads per hop, retry 3000 ms, first read 1000 ms after each observer answer (:166-176, 324-325).
- Root-ack events count only once elapsed since dispatch acceptance is ≥ `OPENCLAW_MIN_CHAIN_EVIDENCE_DELAY_MS` (default 1500) (:70, 385-387). The only run ordering enforced is runId ≠ dispatch run. Hop sentinels have no ordering relative to each other or to the root ack.
- The full chain (child spawn → nested schedule → grandchild run → return → root wake + ack) must finish inside 150 s.

### 3. Telemetry
- reason = manifest promptTemplate with `{{nonce}}` replaced (:256). Recorded: `reason_hash = sha256(task)[0:16]`, `reason_length = task.length`, `delegate_mode = 'silent-wake'` (:257-259). The task is passed to the model as `task=${JSON.stringify(task)}` (:263).
- The collector re-renders the template and cross-checks the hash and length (collector :185-196).
- The trace is matched on the root task's hash. The depth-1 child's nested dispatch has a different `reason.hash`, so neither accept nor fire counts it (collector :255-261, 450-472).
- The nested `openclaw.tool.execution` continue_delegate span, if exported on the same trace, is kept out only by the timing scope [fire.start − deferred − 15000 ms, fire.start − deferred + 1000 ms] (collector :26-27, 288-321). Otherwise the trace fails with "matched trace contains 2 continue_delegate tool spans" (collector :503-508).
- The scenario makes no span checks. For the collector, see COMMON C-TRACE.
- Manifest telemetryContract (advisory) names `continuation.chain.id` (emitted) and `continuation.chain.depth` (emittedByProduct false). Neither is read by the collector, which uses `chain.id`.

### 4. Product source citations verbatim
- Scenario, row lib, manifest: none (refs `#562`, `#563 item 2`, `#567`, `openclaw-bootstrap#1727`). Census SHAs `39803b297bd4786db3971eb82a3a7fd0b29bc643` / `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955` (r-cd-chained-depth-2.json:104-105).
- Shared libs used:
  - lib/wake-turn-receipt.mjs:3-29:
    - `targeting.ts:229-237`, `subagent-announce.continuation-return.ts :210-231`
    - `src/agents/tools/heartbeat-response-tool.ts`, `(:21-37 …)`, `(:78-105)`, `(:54-75)`
    - `packages/llm-core/src/types.ts:304-313`, `(:424-432)`, `session-tool-result-guard.ts:311`
    - `chat-display-projection.sanitize.ts :431-463`, `chat-display-projection.history.ts:329-334, 366`
    - `heartbeat-dispatch.ts:605-623`, `deliver-core.ts:214`, `heartbeat-events.ts:10-27`
  - The child-observer, sentinel-binding and tool-call-identity lists are as in R-CD-1.

### 5. Verdict paths
- PASS-candidate requires all of the following (:470-477):
  - (disposable off or session_created)
  - parent_dispatch_accepted
  - child_done_sentinel
  - grandchild_done_sentinel
  - child_session
  - grandchild_session
  - root_return_receipt (distinct hop keys)
  - !chain_identity_conflict
- These then pass through failClosedVerdict (:478): a preflight or observer refusal or incomplete observation forces PARTIAL.
- PARTIAL-candidate in every other case. This includes "no dispatch runId", which means no root ack can bind (:393-395).
- No FAIL path. `max depth >= 2` is a k6 check only (:457).
- The VU-log verdict wins (run-proofs.sh:1222-1236).

## M-COMMON — shared model-identity + child-binding predicates (all four rows)

### Served vs selected (lib/model-identity.mjs)
- SELECTED = `sessions.describe` response `payload.session`: `model`, `modelProvider` (fallback `provider`); `model` containing `/` used verbatim, else `provider/model` (lib/model-identity.mjs:16-21). Scenarios also record `session.key` (must equal the asked key or be absent) and `modelSelectionLocked === true` (e.g. scenarios/r-cd-model-tool.js:279,285-290).
- ACTIVE FALLBACK = `session.activeModel` + (`session.activeModelProvider` || `session.modelProvider`); returned only when present AND different from the selection (lib/model-identity.mjs:48-56). Cited schema: sessions-row.ts:248-252 (lib/model-identity.mjs:43).
- SERVED (one transcript message) = assistant row (`role` lowercased === `assistant`) fields `provider`, `model`, `responseModel` (lib/model-identity.mjs:75-86). `responseModel` replaces `model` when non-empty, different, and NOT `model` + `-YYYY-MM-DD` or `-YYYYMMDD` (lib/model-identity.mjs:63-66,81-83). Id containing `/` returned verbatim; else needs `provider` (else null) (lib/model-identity.mjs:84-85). `normalizeModel` trims and strips trailing `[.,;:]` (lib/model-identity.mjs:11-13). `api` and `__openclaw` are NOT read by the served predicate.
- SERVED RECEIPT window (lib/model-identity.mjs:109-149): opens at the FIRST `user` message whose text parts (`content` string, or `type:"text"` parts joined) include `anchor` (:116); closes at the FIRST later `assistant` message whose text includes `sentinel` (substring, not word-bounded) (:119-122). That message is the receipt. `conflict` = >1 distinct served model among all assistant messages anchor+1..receipt inclusive (:128-135). Receipt with `stopReason === 'error'` or `'aborted'` or any string `errorMessage` → `served: null` (:144-146). Receipt with no provider/model → `served: null` (:147).
- Served transcript read = `chat.history {sessionKey, limit: 100}` single newest page, no paging (lib/child-observer.mjs:425-430; scenarios call `refreshHistory(key, 100, ...)`), so the anchor user message must be inside the newest 100 messages. Re-read every 2000 ms up to `SERVED_HISTORY_MAX_ATTEMPTS = 15` (e.g. scenarios/r-cd-model-tool.js:42,165-181).
- `resolveRequestedModel(OPENCLAW_ALT_MODEL, manifest invocation.model)`: first non-empty wins; must match `/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:/-]+$/` (provider/model), else refusal; no default (lib/model-identity.mjs:28-38). Manifest `"model": "${OPENCLAW_ALT_MODEL:-}"` expands to env or `''` (lib/manifest-loader.js:14-16).

### Verdict order — classifyModelIdentity (lib/model-identity.mjs:169-217), first match wins
1. `expected` pin set and baseline != pin → FAIL-candidate (:186-188) (only R-CD-MODEL-DEFAULT passes `expected`).
2. active fallback set and != baseline → FAIL-candidate (:189-191).
3. served-window conflict → FAIL-candidate (:192-194).
4. served set and != baseline → FAIL-candidate (:195-197).
5. no served, selection set and != baseline → FAIL-candidate (:198-202).
6. no baseline → PARTIAL-candidate "no authoritative baseline model" (:203-205).
7. no served → PARTIAL-candidate "selection matched; served route unproven" (selection present) / "no authoritative child-session model" (:206-210).
8. served == baseline but `complete` false → PARTIAL-candidate (:213-215).
9. else PASS-candidate (:216). A differing selection with matching served is still PASS (selectionMatches=false recorded) (:211-212).
- Then `failClosedVerdict(..., keepProvenFail: true)`: preflight refused / never completed → PARTIAL (lib/child-observer.mjs:161-166); observer refusal (FORBIDDEN / "missing scope" / "unknown method", :184-193) or incomplete (unrecovered error, HISTORY_UNBOUND after 8 attempts, INVALID_TRAVERSAL; :598-624) → PARTIAL unless verdict is FAIL (FAIL kept) (:167-172).
- Each scenario then forces PARTIAL on `child_identity_conflict`, overriding even FAIL (e.g. scenarios/r-cd-model-tool.js:365-369).
- Preflight: connect `res` must be ok with `payload.type === 'hello-ok'` and `payload.features.methods` containing every ROW_METHODS entry = `sessions.create, sessions.messages.subscribe, sessions.send, sessions.list, chat.history, sessions.describe` for all four rows (lib/child-observer.mjs:43,54-60,81-87,108-130); 10000 ms connect timeout (e.g. scenarios/r-cd-model-tool.js:226).

### Child binding (product session rows / transcripts)
- `sessions.list {spawnedBy: <requester>, limit: 100}`; row `key`, `spawnedBy` (rechecked === requester), `status`, `endedAt`, `lastRunId`, `label`, `parentSessionKey`, `forkedFromParent === true`; paging `hasMore`/`nextOffset` (lib/child-observer.mjs:316,364-392,462-476). Terminal statuses `done|failed|killed|timeout|interrupted` (lib/child-observer.mjs:40).
- `chat.history {sessionKey, limit: 50, offset}` paged to `hasMore === false` (missing `hasMore` = HISTORY_PAGING_UNAVAILABLE) (lib/child-observer.mjs:478-500). Spawn task = FIRST user message; text after literal `[Subagent Task]`, else whole text only if no user message carries the marker and child not `forkedFromParent` (lib/child-observer.mjs:42,230-245).
- Bound = unique child whose own row spawnedBy = requester and whose own task contains the nonce or row token (lib/child-observer.mjs:541-549; lib/row-child-correlation.mjs:41-51). Event-path `childSessionKey` records only cross-check; disagreement or >1 → conflict (lib/child-observer.mjs:658-682).
- Row tokens = `<PREFIX>:<last 16 chars of nonce>` (lib/row-child-correlation.mjs:11-18); nonce = `<ROW>-<Date.now()>-<8 base36>` (lib/gateway-ws.js:67-69).

### Telemetry common
- Every row: evidence `reason_hash` = `crypto.sha256(<task>,'hex').slice(0,16)`, `reason_length` = JS `.length`, `delegate_mode = 'normal'`; collector: see COMMON C-TRACE (scripts/collect-continuation-trace.mjs:132-218 contract, :255-261 span match on `reason.hash`/`reason.length`/`delegate.mode`, :448-580 topology: exactly one `continuation.delegate.dispatch` OK with UUIDv4 `chain.id`, exactly one `continuation.delegate.fire` OK on same `chain.id`+mode, `openclaw.tool.execution` with `gen_ai.tool.name="continue_delegate"` scoped to `[fireStart - deferredMs - 15000ms, fireStart - deferredMs + 1000ms]` with `deferredMs` from fire `fire.deferred_ms` | fire `delay.ms` | dispatch `delay.ms` as positive `intValue` (:288-322; tolerances :27-28)).
- Tempo query `{ resource.service.name="<svc>" && name="continuation.delegate.dispatch" && .reason.hash="<h>" && .reason.length=<n> && .delegate.mode="normal" }` (scripts/collect-continuation-trace.mjs:665-672); window `dispatch_accepted_at_ms` (else `started`) −60 s .. max(dispatch, `ended`) +60 s (:673-681); >1 candidate trace = ambiguous error (:699-701).
- Manifest advisory `expectedTelemetry` names attribute `continuation.chain.id` (e.g. manifests/r-cd-model-tool.json:137, manifests/r-cd-model-default.json:144) but the collector reads `chain.id` (scripts/collect-continuation-trace.mjs:462). Manifest `enforcement: "advisory"` (e.g. manifests/r-cd-model-tool.json:105).
- No scenario-side span checks in any of the four scenarios (only `traceId` is lifted from `sessions.send` response `payload.traceId` or event `traceId`, e.g. scenarios/r-cd-model-tool.js:261,301).
- No delegate-return-window, no run-id exclusion, no wake-turn receipts are used by these rows (imports: scenarios/r-cd-model-tool.js:6-23, r-cd-model-default.js:6-22, r-cd-model-chained-alt.js:6-19, r-cd-model-token.js:6-20).

---

## R-CD-MODEL-CHAINED-ALT — scenarios/r-cd-model-chained-alt.js (manifests/r-cd-model-chained-alt.json)

### 1. Product strings/fields matched literally
- Parent told: `continue_delegate mode="normal", delaySeconds=<1>, task=<depth1Task>`, "Do not set a model override on the depth-1 delegate" (scenarios/r-cd-model-chained-alt.js:180-185).
- depth1Task tells depth-1 to call `continue_delegate exactly once with mode="normal", delaySeconds=<1>, model="<requested>", targetSessionKey="<root sessionKey>", task=<depth2Task>`, then reply `MODEL-CHAINED-DEPTH1-SCHEDULED <nonce>` (:172-176). depth2Task begins `MCH2:<nonce16>` and asks for `MODEL-CHAINED-DEPTH2 <nonce> MODEL <provider/model>` (:168-171).
- Depth-1 binding: observer only, own row spawnedBy = root, own task contains `MCH1:<nonce16>` (passed as the binding "nonce") (:147-152). There is no event cross-check for depth-1 (:255).
- Depth-2 binding: own row spawnedBy = depth-1's key, although depth-1 passes `targetSessionKey` = root. Own task contains `MCH2:` and not `MCH1:` (:153-162; lib/child-observer.mjs:561-567). Event cross-check via childSessionKeyForTokenOnly (:256-257).
- Depth-2 describe → selection/activeFallback/metadata (:238-251). Depth-2 served receipt: anchor `MCH2:<nonce16>`, sentinel `MODEL-CHAINED-DEPTH2 <nonce>` (:130).
- Agent-authored substrings on any non-harness event with the nonce, ≥ gate after accept: `MODEL-CHAINED-PARENT-SCHEDULED` (log only) (:261); `MODEL-CHAINED-DEPTH1-SCHEDULED <nonce>` → sets BOTH `depth_1_child_observed` and `depth_1_scheduled_inner` (:262). This exact text also appears inside depth1Task, i.e. inside the parent's own continue_delegate toolCall arguments, which carry no harness marker. `MODEL-CHAINED-DEPTH2\s+<nonce>\s+MODEL\s+([A-Za-z0-9_./-]+)` → return_payload, self-report auxiliary (:263-269). The `<provider/model>` placeholder can't match the class because of `<`.
- Baseline = requested model (:283). The depth-1 child's model is not checked.

### 2. Ordering/timing
- `POST_DISPATCH_EVIDENCE_GATE_MS` = env `OPENCLAW_MIN_DELEGATE_EVIDENCE_DELAY_MS` or 1500 (:38). Events earlier than that after accept `return` from the handler, which also skips the served/early-close lines for that frame (:259-260).
- Subscribe → +500 ms dispatch (:166-186); polls 20/45/90/130 s (:187); close 220000 ms (:188); maxDuration 240 s (:21). Observer maxDepth 2 (:92). Depth-2 describe ≤6, 250 ms retry (:109-117,250).
- Early close: dispatch ∧ depth-1 observed ∧ depth-1 scheduled ∧ depth-2 metadata ∧ return ∧ served done (:273).

### 3. Telemetry
- Hashed = `depth1Task` (root hop), which embeds depth2Task, the requested model, and the root session key (:84-86,172-179). The manifest has no promptTemplate → `scenario-evidence` (scripts/collect-continuation-trace.mjs:184). Mode `normal`. `dispatch_accepted_at_ms` set (:227).
- Only the root-hop dispatch/fire + its typed tool span are attributed. The depth-2 dispatch (different task hash) is excluded by the reason-hash match (scripts/collect-continuation-trace.mjs:255-261,450-472). The depth-2 tool span starts after the root fire, so it falls outside the `[fireStart − deferred − 15 s, fireStart − deferred + 1 s]` scope (:311-321). The model override on depth-2 has no telemetry check.
- Collector: see COMMON C-TRACE.

### 4. Product source citations (verbatim)
- None in the scenario. lib/model-identity.mjs and lib/child-observer.mjs as for R-CD-MODEL-TOOL.
- Manifest: `reportCommit 39803b297bd4786db3971eb82a3a7fd0b29bc643`, `productBasis 6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955` (manifests/r-cd-model-chained-alt.json:114-115); `karmaterminal/openclaw#1254` (:113,181…217).

### 5. Verdict paths
- Refused before dispatch → PARTIAL (:93-103).
- `complete` = (disposable ⇒ created) ∧ dispatch_accepted ∧ depth_1_child_observed ∧ depth_1_scheduled_inner ∧ depth_2_child_observed ∧ return_payload (:279). Depth-2 describe is not required.
- FAIL: depth-2 active fallback ≠ requested; depth-2 served conflict; depth-2 served ≠ requested; no served and depth-2 selection ≠ requested (M-COMMON 2-5) (:282-289); kept through observer errors (:292).
- PARTIAL: selection-only; incomplete; preflight; observer; identity conflict (depth-1 ambiguous/changed, depth-2 conflict) (:136-139,148-159,293-297).
- PASS: depth-2 served == requested ∧ complete.

## R-CD-MODEL-DEFAULT — scenarios/r-cd-model-default.js (manifests/r-cd-model-default.json)

### 1. Product strings/fields matched literally
- As R-CD-MODEL-TOOL for dispatch/create/describe/observer (scenarios/r-cd-model-default.js:234-291). Child bound by own row spawnedBy = parent + own task containing nonce or `MDEF:<nonce16>` (:189-203,258-260).
- Describe for BOTH parent (selection only, recorded; no activeFallback read for parent) and child (selection + activeFallback + metadata) (:262-291).
- continue_delegate args the agent is told to send: `task=<childTask>, mode="normal", delaySeconds=<1>, and NO model override` (:149-154).
- Agent-authored sentinels: `MODEL-DEFAULT-PARENT-SCHEDULED <nonce>` exact substring on a non-harness event containing the nonce (:300-308); `MODEL-DEFAULT-CHILD\s+<nonce>\s+MODEL\s+([A-Za-z0-9_./-]+)` → return_payload, self-report auxiliary (:309-315).
- Served receipts: parent window anchor `R-CD-MODEL-DEFAULT nonce <nonce>` (the harness instruction's own user row, which also carries `[k6-proof-harness]`; not filtered in servedReceiptFromHistory), sentinel `MODEL-DEFAULT-PARENT-SCHEDULED <nonce>` in the parent's own chat.history (:181); child window anchor `MDEF:<nonce16>`, sentinel `MODEL-DEFAULT-CHILD <nonce>` (:182).
- Baseline = parent SERVED model (:333). The parent window includes the parent's continue_delegate toolCall assistant row(s), so any model change across that window is a conflict.
- Optional `OPENCLAW_EXPECTED_MODEL` pin, normalized, compared to the baseline (:62,338).
- Manifest forms list `bracket-token-no-model` (manifests/r-cd-model-default.json:35-38; toolSurface `mixed` :15), but the scenario sends only the typed instruction (:149-155). The bracket form is not exercised.

### 2. Ordering/timing
- Subscribe → +500 ms dispatch (:138-156); polls 5/15/30/60 s (:157); close 180000 ms (:158); maxDuration 210 s (:24); default delaySeconds 1 (:34,63).
- Parent describe (+250 ms) and parent served read (+500 ms) start only after the parent sentinel substring is seen (:301-308). Child served read +500 ms after the child return substring (:313,318). Describe ≤6 attempts per side (:128).
- Early close: dispatch ∧ parent served done ∧ child served done ∧ child metadata ∧ return (:319-322).

### 3. Telemetry
- Hashed = `childTask` from manifest promptTemplate (manifests/r-cd-model-default.json:39; scenarios/r-cd-model-default.js:59,146-148) → manifest-nonce cross-check (scripts/collect-continuation-trace.mjs:185-196); mode `normal`; typed: exactly one scoped tool span. Window from `started` (no dispatch_accepted_at_ms) (scripts/collect-continuation-trace.mjs:673).
- Collector: see COMMON C-TRACE.

### 4. Product source citations (verbatim)
- None in the scenario. lib/model-identity.mjs and lib/child-observer.mjs citations as listed for R-CD-MODEL-TOOL.
- Manifest: `reportCommit 39803b297bd4786db3971eb82a3a7fd0b29bc643`, `productBasis 6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955` (manifests/r-cd-model-default.json:100-101); `karmaterminal/openclaw#1254` (:99,167…196).

### 5. Verdict paths
- `complete` = (disposable ⇒ created) ∧ dispatch_accepted ∧ parent_scheduled_sentinel ∧ child_session_observed ∧ return_payload (:329). Child describe is NOT required for `complete`.
- `servedConflict` = child window conflict OR parent window conflict → FAIL (:336).
- Wrong pin: FAIL only when a parent served baseline exists; without it → PARTIAL "parent served route unproven: <reason>" (lib/model-identity.mjs:161-163,186-188,203-205; scenarios/r-cd-model-default.js:352-354).
- FAIL also on child active fallback ≠ parent served, child served ≠ parent served, and no child served with child selection ≠ parent served (M-COMMON 2-5); kept through observer errors (:343).
- PARTIAL: no parent served receipt; child selection-only; served match but incomplete; preflight; observer; identity conflict (:344-348).
- PASS: child served == parent served (both run-window bound, no conflict) ∧ pin (if set) == parent served ∧ complete.
- No refuse-before-dispatch path (no requested model).

---

## R-CD-MODEL-TOKEN — scenarios/r-cd-model-token.js (manifests/r-cd-model-token.json)

### 1. Product strings/fields matched literally
- Origin hop: the parent is told to call `sessions_spawn` with `runtime="subagent", mode="run", taskName="r-cd-model-token-<nonce>"` (lowercased, ≤80), `label="k6 R-CD-MODEL-TOKEN <nonce>", lightContext=true, context="isolated", cleanup="delete", task=<childTask>` (scenarios/r-cd-model-token.js:264,272). `lightContext` defaults true because the manifest omits it (:77).
- Spawn receipt (product toolResult): a toolCall to `sessions_spawn` (by name, `*__sessions_spawn`, or Tool Search `dispatch_action`/`tool_call` `{id, args}`) whose `args.task` contains `MTOK1:<nonce16>`, paired by `toolCallId` with a toolResult whose JSON text content (else `details`) has `status === 'accepted'` and `isError !== true` (:274,358-363; lib/sentinel-binding.mjs:154-198,231-262; lib/tool-call-identity.mjs:44,80-92). Alternatively, the hop-1 observer binding alone sets spawn accepted (:240-243).
- Hop-1 binding: own row spawnedBy = parent; own task contains `MTOK1:<nonce16>` (:234). Event cross-check: event `childSessionKey` field + `MTOK1` token anywhere in the event (:355).
- Bracket grammar the hop-1 child is told to end with, on its own final line: `[[CONTINUE_DELEGATE: <delegateTask> +<delaySeconds>s | model=<requested provider/model>]]` (:267,271). `delaySeconds` = manifest 1 (manifests/r-cd-model-token.json:40) → ` +1s`.
- delegateTask = `MTOKD:<nonce16> Proof R-CD-MODEL-TOKEN delegate nonce <nonce>: reply exactly MODEL-TOKEN-DELEGATE-DONE <nonce> MODEL <provider/model>, replacing ... Do not post externally.` (:266). Neither task names the model; only the modifier does (:265).
- Delegate binding: own row spawnedBy = hop-1's key (the bracket origin child, not the parent); own task contains `MTOKD:<nonce16>` and NOT `MTOK1:<nonce16>` (:248-251; lib/child-observer.mjs:561-567).
- Product dispatch prefix: the delegate's own spawn task (observer-read first user message) must contain literal `[continuation:chain-hop:` (:45,154-155).
- Hop-1 transcript (`chat.history` limit 200, purpose `hop1`): an assistant row whose text parts carry exact word-bounded `MODEL-TOKEN-HOP1 <nonce>` (no `[k6-proof-harness]`; runId not required) (:171,182; lib/sentinel-binding.mjs:121-140; lib/wake-turn-receipt.mjs:50-58). NO continue_delegate toolCall (by name, `*__continue_delegate`, or `dispatch_action`/`tool_call` with `id` `continue_delegate` or `<openclaw|mcp|client>:<x>:continue_delegate`) in any hop-1 history read or live hop-1 `session.message` event (:48-50,177,333-337; lib/tool-call-identity.mjs:45,80-92).
- Hop-1 live subscription: `sessions.messages.subscribe {key: hop1}` response ok (:245,330-332).
- Diagnostic only (not in any predicate): hop-1 assistant text with `[[CONTINUE_DELEGATE:` + `MTOKD` token (:178-181); parent-stream substrings `MODEL-TOKEN-PARENT-SPAWNED`/`sessions_spawn`/`MODEL-TOKEN-HOP1`/`[[CONTINUE_DELEGATE:`/`model=<requested>` (:368-371).
- Return: `MODEL-TOKEN-DELEGATE-DONE\s+<nonce>\s+MODEL\s+([A-Za-z0-9_./-]+)` on any non-harness event containing the nonce, ≥1500 ms after dispatch accept (:365-379).
- Delegate served receipt: anchor `MTOKD:<nonce16>`, sentinel `MODEL-TOKEN-DELEGATE-DONE <nonce>` in the delegate's own chat.history (:213). Delegate describe as M-COMMON (:338-351).
- Baseline = requested model (:396). `bracket_model_modifier_observed` = (delegate served, else selected) == requested. This is a model comparison, not a parse observation (:389-391).

### 2. Ordering/timing
- `POST_DISPATCH_EVIDENCE_GATE_MS` = env `OPENCLAW_MIN_TOKEN_EVIDENCE_DELAY_MS` or 1500 (:65); return substring ignored before it (:367).
- Hop-1 coverage (N10): `hop1_post_end_read` needs a hop-1 read carrying the sentinel that was sent after hop-1's subscribe ack, with hop-1 then settled (row status terminal or delegate bound), or a sentinel read sent after hop-1 settled (:144-153,162-189). Hop-1 reads every 3000 ms, ≤40 (:163,187).
- Subscribe → +500 ms dispatch (:262-276); polls 15/30/60/90 s (:277); close 180000 ms (:278); maxDuration 210 s (:52). Observer maxDepth 2 (:123).

### 3. Telemetry
- Hashed = `delegateTask` (the bracket body before ` +1s | model=`) (:266,268-270). The product parser must hand exactly these bytes to the dispatch span `reason.hash`/`reason.length`. The manifest has no promptTemplate → `fingerprintSource: scenario-evidence` (scripts/collect-continuation-trace.mjs:184).
- Manifest `originSurface: "raw-final-text"` (manifests/r-cd-model-token.json:42) → attribution `bracket-token-reason-hash-length-mode` (scripts/collect-continuation-trace.mjs:153-155) and the timing-scoped continue_delegate tool-span set must be EMPTY (:497-500). Timing metadata (fire start + `fire.deferred_ms`/`delay.ms`) is still required, else `invalid-timing` throws (:301-305,491-493).
- `delegate.mode="normal"` required on dispatch and fire (:150,255-261,467-472). `dispatch_accepted_at_ms` set (scenarios/r-cd-model-token.js:314) → window anchor.
- Collector: see COMMON C-TRACE.

### 4. Product source citations (verbatim)
- `delegate-dispatch-request.ts:43` ("The typed tool and the bracket write the same prefix") (scenarios/r-cd-model-token.js:40-41); `openclaw-bootstrap#1727` (:23).
- lib/tool-call-identity.mjs (used for dispatch_action unwrap): `src/agents/tool-surface-plan.ts:145-150` (:26), `src/agents/tool-catalog.ts:29`, `src/agents/tool-display-call.ts:5-24` (:29-30), `src/agents/tool-search-catalog.ts:193`, `tool-search-runtime.ts:75-103` (:31-32), `src/agents/session-tool-result-guard.ts:482-486` (:33), `tool-display-call.ts:5 TOOL_CALL_DISPLAY_NAMES` (:43); `At openclaw f15237ec92` (:25).
- lib/sentinel-binding.mjs header: `src/gateway/chat-display-projection.sanitize.ts:182-183,227-233` (:6), `(:227-249)`, `src/gateway/session-transcript-message.ts:139-149` (:8), `src/gateway/server/client-registry.ts:60-66` (:10), `src/agents/internal-events.ts:159-219` (:12), `src/auto-reply/continuation/work-dispatch-execution.ts:165-226` (:13).
- lib/model-identity.mjs and lib/child-observer.mjs as for R-CD-MODEL-TOOL.
- Manifest: `reportCommit 39803b297bd4786db3971eb82a3a7fd0b29bc643`, `productBasis 6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955` (manifests/r-cd-model-token.json:107-108); `karmaterminal/openclaw#1254` (:106,174…210).

### 5. Verdict paths
- Refused before dispatch → PARTIAL (model unset/alias, tokens unrenderable) (:124-134).
- `bracket_token_observed` = hop1_turn_bound ∧ hop1_post_end_read ∧ ¬hop1_typed_continue_delegate ∧ delegate bound ∧ delegate task has `[continuation:chain-hop:` (:156-159).
- `complete` = (disposable ⇒ created) ∧ prompt_injected ∧ spawn requested ∧ spawn accepted ∧ bracket_token_observed ∧ bracket_model_modifier_observed ∧ child_session_observed ∧ return_payload (:392).
- A typed continue_delegate in hop-1 never directly FAILs. It makes `complete` false → PARTIAL even when the model matches (:156,392; lib/model-identity.mjs:213-215).
- FAIL / PARTIAL / PASS per M-COMMON with baseline = requested (:395-402); keepProvenFail (:405); identity conflict → PARTIAL (:406-410).

---

## R-CD-MODEL-TOOL — scenarios/r-cd-model-tool.js (manifests/r-cd-model-tool.json)

### 1. Product strings/fields matched literally
- Product-emitted: `sessions.send` response ok (scenarios/r-cd-model-tool.js:258-263); `sessions.create` response `payload.key` when disposable (:248-256); child `sessions.describe` `session.model/modelProvider/provider/activeModel/activeModelProvider/key/modelSelectionLocked` (:275-298); child chat.history assistant `provider/model/responseModel/stopReason/errorMessage` via servedReceiptFromHistory (:174-181); child session row `spawnedBy` = parent session key + child first-user-message task containing nonce or `MTOOL:<nonce16>` (:149-163,271-273). Event `childSessionKey` records cross-check (:303-311).
- continue_delegate args the agent is told to send: `task=<childTask>, mode="normal", delaySeconds=<1>, model="<requested provider/model>"` (:196-202). The requested model is NOT in the child task (:185-186; template :38).
- No toolResult status is read. "scheduled" appears only in the agent instruction (:201); the parent sentinel is matched as an event substring.
- Agent-authored sentinels (event-substring on any subscribed event containing the nonce and not `[k6-proof-harness]`): `MODEL-TOOL-PARENT-SCHEDULED` (:312-316); `MODEL-TOOL-CHILD\s+<nonce>\s+MODEL\s+([A-Za-z0-9_./-]+)` → return_payload; self-reported model is auxiliary, not used for equality (:317-324).
- Served receipt: anchor `MTOOL:<nonce16>`, sentinel `MODEL-TOOL-CHILD <nonce>` in the child's own chat.history (:176).
- Baseline = requested model (:343).

### 2. Ordering/timing
- Subscribe → +500 ms dispatch (:183-208); disposable create at +250 ms after hello (:213-217); observer polls at 5/15/30/60 s (:209); socket close 180000 ms (:210); k6 maxDuration 210 s (:25); default delaySeconds 1 (manifest has none) (:34,63).
- Served read first at +500 ms after the child return substring, then every 2000 ms ≤15 (:322,327,180). Child describe up to 6 attempts, 250 ms retry (:138-147,295-297).
- No minimum-delay gate and no run binding on the return substring.
- Early close when dispatch_accepted ∧ child metadata ∧ return_payload ∧ served done (:328-331).

### 3. Telemetry
- Hashed = `childTask` = manifest promptTemplate rendered with nonce (:58,193-195); manifest template has only `{{nonce}}`/`{{nonceSuffix16}}` (manifests/r-cd-model-tool.json:40) → collector re-renders and requires equal hash/length, `fingerprintSource: manifest-nonce` (scripts/collect-continuation-trace.mjs:185-196). `delegate_mode: 'normal'` (:195). No `originSurface` → typed: exactly one scoped continue_delegate tool span required (scripts/collect-continuation-trace.mjs:503-509).
- Evidence has no `dispatch_accepted_at_ms`; window uses `started` (scripts/collect-continuation-trace.mjs:673).
- Manifest expectedTelemetry spans omit `continuation.delegate.fire` (manifests/r-cd-model-tool.json:119-129) but the collector still requires exactly one fire (scripts/collect-continuation-trace.mjs:467-481).
- Collector: see COMMON C-TRACE.

### 4. Product source citations (verbatim)
- None in scenarios/r-cd-model-tool.js. Via lib/model-identity.mjs: `packages/gateway-protocol/src/schema/sessions-row.ts:248-252` and `resolveGatewaySessionActiveModel, src/gateway/session-utils-row.ts:307-361` (:43-44); `openclaw packages/ai/src/.../anthropic-server-fallback.ts:136-137` (:62); `openclaw packages/ai/src/transports/assistant-output.ts:4-17` (:71); `packages/llm-core/src/types.ts:390-420` (:73).
- Via lib/child-observer.mjs (binding surfaces): `src/gateway/server-methods.ts:603-609, src/gateway/method-scopes.ts:277 at cut 41b8d69b90` (:8-9); `core-descriptors.ts:252` (:13); `src/gateway/session-utils-row.ts:436,465,538-546` (:15); `core-descriptors.ts:365` (:16); `subagent-system-prompt.ts:23-36` (:19); `packages/gateway-protocol/src/schema/sessions-row.ts:28-36` (:39); `src/gateway/server/ws-connection/connect-hello.ts:300` + `packages/gateway-protocol/src/schema/frames.ts:94,106-107` (:77-78); `at openclaw 935ba44c17 chat.history ... chat-sanitize.ts, src/auto-reply/reply/user-envelope-display.ts` (:221-223); `openclaw 41b8d69b90 chat-history-response-page.ts:91-112; chat-history-handler.cli-import.test.ts:465-470` (:266-268); `src/gateway/session-list-filters.ts:150-163` (:366); `src/gateway/session-utils-row.ts:457 at openclaw 935ba44c17` (:394).
- Manifest: census `reportCommit 39803b297bd4786db3971eb82a3a7fd0b29bc643`, `productBasis 6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955` (manifests/r-cd-model-tool.json:101-102); `karmaterminal/openclaw#1103` (:29); `karmaterminal/openclaw#1254` (:100,148…185).

### 5. Verdict paths
- Refused before dispatch → PARTIAL: OPENCLAW_ALT_MODEL/manifest model unset or not provider/model, or token/task unrenderable (:121-133).
- `complete` = (disposable ⇒ session_created) ∧ dispatch_accepted ∧ parent_scheduled_sentinel ∧ child_session_metadata_observed ∧ return_payload (:341). Note: served receipt is not in `complete`; it is the classifier's `served` (:342-349).
- FAIL: active fallback ≠ requested; served conflict; served ≠ requested; no served and selection ≠ requested (M-COMMON order 2-5). Kept through observer errors (keepProvenFail) (:364).
- PARTIAL: selection-only match ("served route unproven"); no describe and no served; served match but `complete` false; preflight refused; observer refusal/incomplete; child identity conflict (:365-369).
- PASS: served (run-window) == requested ∧ complete ∧ no fallback/conflict.
- `sessions.describe` error → reason recorded only (:292-294).

---

## R-CD-SILENT — scenarios/r-cd-silent.js

Manifest `manifests/r-cd-silent.json`: tool `continue_delegate`, mode `silent`, delaySeconds 1, no promptTemplate (r-cd-silent.json:29). Methods: sessions.create, sessions.send, sessions.messages.subscribe (manifest scenario.methods). The scenario uses no preflight gate and no child observer (imports at :27-30).

### 1. Product strings/fields matched literally
- `sessions.send` ok:
  - The first ok answer is dispatch_accepted. Dispatch run = `payload.runId` (:187).
  - Any later ok answer is followup_accepted (:188).
  - Idempotency keys: `R-CD-SILENT-DISPATCH-<nonce>` (:161), `R-CD-SILENT-FOLLOWUP-<nonce>` (:104).
- Scheduled receipt: same tracker as R-CD-1 (toolName `continue_delegate`, argField `task` contains the nonce, toolResult `status === "scheduled"`, `!isError`) on parent `session.message` events (:160, 205-211; sentinel-binding.mjs:231-262).
- Agent text: `RCDS-SCHEDULED <nonce>` in a parent assistant row's text parts, no runId required (:214).
- Child completion uses product `chat` events (:216, 137-151):
  - The event name must be exactly `chat`.
  - Top-level `sessionKey`/`session` must be ≠ the parent.
  - Either `eventData.spawnedBy === parentKey` when the field exists, or (when `spawnedBy` is absent) the session key contains the literal `:subagent:continuation-` (:140).
  - Text comes from `eventData.message` text parts, buffered per `eventData.runId` (or the key).
  - The report is read on `eventData.state === 'final'` (:144).
  - The report must match `SILENTCHILD <nonce> TOKEN <[a-z0-9]{12}>`, word-bounded (:66, 145-148).
- Dependency on product broadcast: the scenario subscribes only to the parent key (:154). It sees child `chat` events only if the gateway broadcasts chat events for every session to a connection without session-scoped events (lib/sentinel-binding.mjs:9-10 cites `src/gateway/server/client-registry.ts:60-66`).
- Token acceptance (:109-134):
  - The requester's nonce-bound continue_delegate call must already have been seen (`scheduledTracker.calls()` non-empty).
  - The token must be absent (lowercase) from harness texts and the requester call-args JSON.
  - It must also be absent from every parent assistant `session.message` content JSON seen before acceptance (text, thinking, toolCalls) (:201-204).
- Parent readback (agent-authored, product-stamped run), evaluated only after the follow-up was sent (:219-224):
  - a parent `session.message` assistant text part
  - containing `RCDS-PARENT-OBSERVED <nonce> TOKEN <token>`
  - with a required runId (`message.__openclaw.runId` or envelope `runId`) ≠ dispatch run (sentinel-binding.mjs:96-113).
- No-channel-delivery negative (:48-55, 197-200) trips when any event both:
  - carries a minted `SILENTCHILD <nonce> TOKEN <12>` anywhere in its JSON, and
  - is channel-shaped: the event name contains `channel`/`delivery`, OR the payload has any of `channelId`/`channel_id`/`channel`/`targetChannel`/`deliveryChannel`, OR `surface`/`provider` ∈ {discord, slack, telegram}.
- Risk: if the product's own child `chat` final event carries a `channel`/`provider` field, the child's legitimate report trips this check.

### 2. Ordering/timing
- Dispatch goes out 500 ms after subscribe (:155-162). Disposable create is sent 250 ms after open (:168-172).
- Follow-up is sent `OPENCLAW_SILENT_FOLLOWUP_AFTER_CHILD_MS` (default 5000) after the child token is accepted (:132, 99-105). The readback is evaluated only after the follow-up is sent (:219).
- So the order "child minted, then follow-up, then readback" holds by construction. There is no timestamp check.
- Socket closes at max(180000, (1+150)·1000) = 180000 ms (:163). k6 maxDuration is 210 s (:34). Early close happens when all six receipts hold (:230).
- Scheduled needs receipt and text in either order (:215).

### 3. Telemetry
- reason = a scenario-owned string (:156): ``Proof ${rowNonce}: invent a fresh random token of exactly 12 lowercase letters and digits (make it up now; do not copy it from anywhere) and return exactly SILENTCHILD ${rowNonce} TOKEN <your token>. Do not mutate files. Do not post to any channel.``
- Recorded: `reason_hash = sha256(task)[0:16]`, `reason_length = task.length`, `delegate_mode = 'silent'` (:157).
- The model receives the task as `task=${JSON.stringify(task)}` (:158).
- The manifest has no template, so the collector cannot cross-check and trusts the evidence fingerprint (collector :184-196, fingerprintSource `scenario-evidence`). Typed origin (no originSurface).
- The scenario makes no span checks. For the collector, see COMMON C-TRACE. Product `delegate.mode` must equal `silent`.
- Manifest telemetryContract (advisory) lists `continuation.chain.id`, `reason.hash`, `reason.length`, `delegate.mode` (r-cd-silent.json telemetryContract.expectedTelemetry.attributes). The collector reads `chain.id` (UUIDv4), not `continuation.chain.id`.

### 4. Product source citations verbatim
- Scenario, manifest: none (refs `openclaw-bootstrap#1727`, `#600`). Census SHAs `39803b297bd4786db3971eb82a3a7fd0b29bc643` / `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955` (r-cd-silent.json:96-97).
- Shared libs used: sentinel-binding.mjs:6-13 and tool-call-identity.mjs:5-12, 22 (same list as R-CD-1). The child observer is not used.

### 5. Verdict paths
- PASS-candidate requires all of the following (:247, 250):
  - (disposable off or session_created)
  - dispatch_accepted
  - scheduled_sentinel
  - child_completion_observed
  - followup_accepted
  - parent_internal_context_observed
  - no_channel_delivery
- PARTIAL-candidate otherwise. This includes the channel-delivery negative: it adds a proof failure but still yields PARTIAL, not FAIL (:199, 247-250).
- No FAIL path and no failClosedVerdict (there is no preflight or observer).
- With no dispatch runId the readback can never bind, giving PARTIAL (:218; wake-turn-receipt.mjs:90-93).
- handleSummary writes `review.status` `ready-for-human-review` only when the summary verdict is PASS and a trace_id exists, otherwise `review-pending` (:258). The VU-log verdict wins (run-proofs.sh:1222-1236).

---

## R-CD-TOKEN — scenarios/r-cd-token-bracket-delegate.js

(manifest `manifests/r-cd-token.json`; libs `lib/r-cd-token-contract.js`, `lib/r-cd-token-authoritative-receipt.mjs`; resolver `scripts/resolve-r-cd-token-authoritative-receipt.mjs`. `lib/journal-return-binding.mjs` is **not imported** by this row; its only users are scenarios/static-corpus-row-validator.js:11 and scenarios/r-cd-return-overlap.js:17.)

### 1. Product strings/fields matched literally
- **Bracket grammar the product scanner must accept** (the agent writes it as the last line of the origin child's final text): `[[CONTINUE_DELEGATE: <delegateTask> +10s]]` (:85, :91).
  - `delegateTask` = manifest `promptTemplate` `"{{marker}} reply exactly RCDT-RETURN-{{tag}}"` (manifests/r-cd-token.json:116), with `{{marker}}` → `D-<first 12 hex of tag>` and `{{tag}}` → `tag = sha256(rowNonce)[:16]` (:50, :73, :80-84).
  - Delay modifier `+${delaySeconds}s`, with `delaySeconds = 10` (manifests/r-cd-token.json:111; scenario :54). **No `model=` modifier** is used by this row.
  - The child is told: no text after `]]` and do not call continue_delegate (:91).
  - The scanner must yield task bytes == `delegateTask` with the ` +10s` modifier stripped, because the Tempo match keys on `sha256(delegateTask)` (§3).
- Comment-asserted product constraint: "Production prepends 63 characters before signal.task and then exposes only the first 80 title characters", so the marker is kept at 14 chars (:77-80). This is a legacy title-surface concern; the current binding uses the spawn task (below).
- Origin spawn (agent-authored `sessions_spawn` call; the product must honor the args):
  - Args: `runtime="subagent"`, `mode="run"`, `taskName="r-cd-token-<tag>"`, `label="RCDT-O-<tag>"`, `lightContext=true`, `context="isolated"`, `cleanup="delete"`, `task=<childTask>` (:366, :75-76).
  - **The sessions_spawn toolResult is not read.** Neither the `RCDT-PARENT-SPAWNED-<tag>` nor the `RCDT-HOP1-<tag>` sentinel is ever matched (requested at :366, :91; no matcher anywhere in scenario or contract).
- Session lifecycle:
  - `sessions.create {key:"r-cd-token-<tag>"}` must answer `ok` with a non-empty `payload.key` ≠ the requested/configured key (:393-396, :487-497; lib/r-cd-token-contract.js:33-43).
  - `sessions.send` must answer `ok` with `payload.runId` (:499-509).
  - The origin subscribe response must be `payload.subscribed === true && payload.key === <origin key>` (:478-486).
- Child identity (sessions.list via observer, maxDepth 2, :131-136):
  - Origin: row `spawnedBy === <disposable parent>` && `label === "RCDT-O-<tag>"` (trimmed), exactly one (lib/r-cd-token-contract.js:238-242; scenario :265). The label comes from sessions.list row `label` (lib/child-observer.mjs upsertRow `record.label = str(row.label)`).
  - Delegate: row `spawnedBy === <origin child key>`, and its own spawn task (first user message, after `[Subagent Task]` or display-stripped) **includes** `D-<tag12>`; exactly one (lib/r-cd-token-contract.js:243-249).
  - Row fields used: `lastRunId` → runId; `status` `'done'` → `'completed'`; `endedAt` → `endedAtMs` (lib/r-cd-token-contract.js:198-217).
  - Terminal set for "proof complete": completed|failed|cancelled|timed_out (:5, :300-306). Row statuses `killed`/`timeout`/`interrupted` are not in that set.
  - PASS requires both rows `done` (:630) and origin `lastRunId` ≠ delegate `lastRunId` (:641).
- **Only binding return route: direct-announce** (`TOKEN_BOUND_RETURN_ROUTES = ['direct-announce']`, lib/r-cd-token-contract.js:397). It is a `session.message` event on the origin key (envelope `sessionKey` and `session` agree, :543-548), or exactly one origin chat.history row (:570-577), with:
  - `message.role` ∈ {`user`,`system`};
  - text contains `RCDT-RETURN-<tag>` and no `[k6-proof-harness]`;
  - first line matches `^\[Inter-session message\]`, the header has `\bsourceTool=subagent_announce\b`, and `\bsourceSession=(\S+)` equals the delegate child key exactly (lib/r-cd-token-contract.js:487-501).
- **Targeted return = correlation only.** It leaves the row PARTIAL with reason `"targeted-return correlated; no product-stamped delivery→run join observable"` (lib/r-cd-token-contract.js:309-310, :322-325). Its legs:
  - Source leg: the delegate child's own chat.history has exactly one assistant row containing `RCDT-RETURN-<tag>` exactly once, without `[k6-proof-harness]` or `[[CONTINUE_DELEGATE:`. Its run stamp (`__openclaw.runId`, which must agree with the envelope `runId` if both are present) must equal the delegate row's `lastRunId` (:426-444, :469-485). It is read only after the delegate row is `done` (scenario :233-241). This needs the delegate transcript to persist (comment: delegate cleanup "keep", :231-232).
  - Origin wake (live): an `agent` event with `stream === 'lifecycle'` and `data.phase === 'start'` on the origin key. Its `runId` must differ from the origin's first-observed `lastRunId` (= bracket run, scenario :223-229), and `data.startedAt` (or `ts`) must be ≥ delegate `endedAt` (lib/r-cd-token-contract.js:451-462; scenario :521-538).
  - Origin answer: an assistant `RCDT-RETURN-<tag>` on the origin in such a woken run (:512-541). History variant: after the last bracket-run row, with `message.timestamp` ≥ delegate `endedAt`, exactly one (:584-597).
- Product behavior asserted only in comments (not matched):
  - `deliverSubagentAnnouncement` header row hidden "at 8ba08c76d8".
  - `routeSubagentContinuationReturn` handles every delegate since 2273ef64d5: systemEvent row + queued system event + `delegate-return` wake, logged `[continuation:targeted-return] Delivered to <origin> from <delegate>`, with provenance `internal_system / continuation / the delegate run`.
  - "The direct-announce path is not reached for a continuation delegate" (lib/r-cd-token-contract.js:345-391).
  - So at current product the expected outcome is PARTIAL by construction.
- Journal formats in lib/journal-return-binding.mjs (not used here; listed because requested):
  - `[continuation:targeted-return] Delivered to (\S+) from (\S+)` (:92)
  - `[continuation:delegate-spawned][^\n]*\bsession=(\S+)` (:55, :114)
  - marker-writer forms `^<marker> session=(\S+) run=(\S+)$`, or `<marker>` followed by `^session: (\S+)$` (:69, :75-76)
  - journald prefix + ISO timestamp are stripped (:33-35)
- Seat class is **not product-probed**. `OPENCLAW_SEAT_CLASS` is taken from `seat-readiness.json .seat.class` (scripts/run-proofs.sh:1082), which defaults to policy `defaultClass` or `'message-body'` (scripts/seat-readiness-preflight.mjs:263). `raw-final-text` / `raw-final-text-seat` is required (lib/r-cd-token-contract.js:7-12, :606).

### 2. Ordering/timing
- k6 `maxDuration: '210s'`; threshold `r_cd_token_duration p(95) < 180000` (:31, :34). Observation window 180000 ms from proof-flow start, then `interrupted=true` (:373-380).
- Preflight 10000 ms (:406-413). Create +250 ms after hello (:392-397). Dispatch +500 ms after subscribing the parent (:365).
- Delegate delay +10 s (manifests/r-cd-token.json:111).
- Observer: first poll 250 ms after send accepted (:506), then every `TASK_POLL_MS` (default 750) (:45, :295-308). `OBSERVER_PAGE_LIMIT = 100` (:47).
- Stability: `REQUIRED_STABLE_TASK_SNAPSHOTS = 3` identical full-traversal digests (:48, :327-334). Then "proof complete" must hold continuously for `SETTLE_MS` (default 5000) before close (:46, :285-292).
- Targeted-return ordering:
  - woken-run start ≥ delegate `endedAt` (lib/r-cd-token-contract.js:460, :526-529)
  - woken run ≠ origin bracket run (:457, :523)
  - history answer after the last bracket-run row (:587-593)
- Buffers: 20 pending return events (:515), 20 lifecycle starts (:534).
- Runner pre-dispatch gates:
  - exact 40-hex candidate == `OPENCLAW_RUNTIME_BUILD_SHA` (scripts/run-proofs.sh:1044-1057)
  - `OPENCLAW_ROW_NONCE="R-CD-TOKEN-<uuid>"` and attempt-state written before k6 (:1067-1079)
  - seat-class gate (:1081-1101)
  - disposable session forced (:1104-1107)

### 3. Telemetry
- `reason_hash = sha256(delegateTask)[:16]`, `reason_length = delegateTask.length`, `delegate_mode = 'normal'` (:108). E.g. task = `"D-<12hex> reply exactly RCDT-RETURN-<16hex>"`.
  - The manifest template has non-nonce placeholders (`{{marker}}`, `{{tag}}`), so the collector cannot re-render it and trusts the evidence fingerprint (`fingerprintSource:'scenario-evidence'`, scripts/collect-continuation-trace.mjs:123-130, :184-196).
  - The product must hash the bracket's task text without ` +10s`.
- `originSurface: 'raw-final-text'` (manifests/r-cd-token.json:115) has two effects:
  - attribution `bracket-token-reason-hash-length-mode` (scripts/collect-continuation-trace.mjs:153-155)
  - **zero** time-scoped `openclaw.tool.execution` spans with `gen_ai.tool.name="continue_delegate"` are allowed, else the collector throws (:497-500)
- The time scope is still computed. The fire must carry `fire.deferred_ms` or `delay.ms` (positive intValue, ≈10000), else `invalid-timing` throws even on this bracket row (:288-305, :488-493).
- Dispatch/fire are queried with `.delegate.mode="normal"` (:150, :684-688).
- Resolver topology predicate (lib/r-cd-token-authoritative-receipt.mjs:35-46):
  - `continuation.tool === 'continue_delegate'`
  - `continuation.originSurface === 'raw-final-text'`
  - `toolSpanIds.length === 0`
  - `traceId` 32-hex, `chainId` non-empty
  - `dispatchSpanId`/`fireSpanId` 16-hex and distinct
  - `sameTrace` and `distinctSpans` true
- Reason join: evidence `reason_hash`/`reason_length` == correlation `reason.hash`/`reason.length` (:48-51).
- `trace_id` from `sessions.send payload.traceId` is recorded only (:505).
- Manifest telemetryContract is `enforcement: "advisory"` (manifests/r-cd-token.json:127). It names `continuation.chain.id` (:160, :258), while the collector reads `chain.id` (scripts/collect-continuation-trace.mjs:462). `continuation.signal.surface` is `emittedByProduct:false` (#1254).
- Collector: see COMMON C-TRACE.

### 4. Product source citations verbatim
- lib/r-cd-token-contract.js:79 — "the task-ledger RPC (tasks.list) was removed upstream in openclaw 6652f7eac8"; :169 — "(openclaw 6652f7eac8)"
- lib/r-cd-token-contract.js:176-177 — "(sessions_spawn label= is stored on the child entry, subagent-spawn-session-patch.ts:168; spawnedBy at :99)"
- lib/r-cd-token-contract.js:212 — "Row endedAt is the run's lifecycle end (session-run-lifecycle-projection.ts:215)."
- lib/r-cd-token-contract.js:214-215 — "Row status 'done' is the current terminal-success state (packages/gateway-protocol/src/schema/sessions-row.ts:28-36)."
- lib/r-cd-token-contract.js:347-351 — "deliverSubagentAnnouncement ... "[Inter-session message] sourceSession=<delegate child> ... sourceTool=subagent_announce" header ... at 8ba08c76d8 display projection hides it (chat-display-projection.history.ts:413-415)."
- lib/r-cd-token-contract.js:352-363 — "since openclaw 2273ef64d5 (2026-09-12) every pending delegate carries a recipient-authority binding ... routeSubagentContinuationReturn ... `delegate-return` wake (logged `[continuation:targeted-return] Delivered to <origin> from <delegate>`) ... (provenance internal_system / continuation / the delegate run) ... (history.ts:416-421)"
- lib/r-cd-token-contract.js:376 — "At the integration candidate karmaterminal/openclaw 9f1b83f9d0 no gateway read surface returns a product record naming the delegate run, the recipient session and the woken run together"
- lib/r-cd-token-contract.js:381 — "Only assistant and tool rows are run-stamped (sessions/transcript-events.ts:41-58)"
- manifests/r-cd-token.json:80 — "A targeted return (every delegate since openclaw 2273ef64d5: ...)"
- manifests/r-cd-token.json:123-124 — `"reportCommit": "39803b297bd4786db3971eb82a3a7fd0b29bc643"`, `"productBasis": "6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955"`
- manifests/r-cd-token.json:31-35 — seatClassExpectation (raw-final-text-seat → PASS-candidate, message-body-seat → PARTIAL-candidate). This is prose; it cites "TOOLS.md bracket-position-sensitive notes", not a .ts file.
- Via shared libs: lib/child-observer.mjs citations as listed under R-CD-4 §4.

### 5. Verdict paths
- **No FAIL verdict exists** in the scenario, the contract or the resolver. The outcomes are PASS-candidate / PARTIAL-candidate only.
  - `handleSummary` is always `PARTIAL-candidate` (:593-594).
  - The authoritative verdict is the resolver's receipt (scripts/run-proofs.sh:1472-1487). A resolver error gives PARTIAL with `r-cd-token-authoritative-receipt-missing`.
- Scenario PASS (`classifyTokenEvidence`, lib/r-cd-token-contract.js:605-648) needs all of:
  - `surface_class` is raw-final-text
  - `session_created`, `disposable_origin_ready`, `prompt_injected`, `send_accepted`
  - `origin_subscription_accepted`
  - `delegate_return_observed` (direct-announce only)
  - full traversal, ≥3 stable snapshots, no refused traversals
  - origin and delegate each exactly once
  - all 11 identity hashes 16-hex: origin run/requester/child, delegate run/requester/child, send run, nonce, attempt, return target/source
  - origin run ≠ delegate run
  - the delegate's requester == the origin child
  - return target == origin child and return source == delegate child
  - route bound (`direct-announce`, or null for legacy evidence)
  - both rows `completed` (row `done`)
  - not interrupted
- Then `failClosedVerdict` → PARTIAL on preflight or observer refusal/incomplete (:556; lib/child-observer.mjs:160-174).
- Resolver PASS additionally requires runner identity (lib/r-cd-token-authoritative-receipt.mjs:53-69):
  - metadata row R-CD-TOKEN
  - candidate == runtime, both 40-hex
  - attempt-state schema `openclaw.k6.r-cd-token.attempt-state.v1`
  - attempt/nonce hashes match
  - `automaticRetryAllowed === false`
  - evidence SHAs match
- Resolver PASS also requires `topologyPasses` and the reason join (§3). Otherwise it seals PARTIAL with `failureCategory` ∈ `runner-or-build-identity-mismatch` | `incomplete-or-nonunique-lifecycle` | `missing-continuation-topology` | `reason-topology-mismatch` | `invalid-continuation-topology` (:124-141).
- HMAC sealing with the gateway token (`hmac-sha256-gateway-token-v1`) is file-integrity mechanics only (:24-33, :186-233).
- Early terminals, all PARTIAL:
  - `pre-dispatch-disposable-creation-not-enabled` (:383-391)
  - `pre-dispatch-preflight-refused` (:406-427)
  - `disposable-session-rejected` (:494-497)
  - `pre-dispatch-disposable-origin-required` (:350-362)
  - `sessions-send-rejected` (:507-509)
  - `origin-session-subscription-rejected` (:482-485)
  - `child-observation-refused` (:300-306, :466-473)
  - `duplicate-or-mislinked-task-identity-observed`, closed immediately when origin or delegate count >1 (:277-283)
  - `observation-window-expired` (:373-380)
- Runner pre-dispatch PARTIALs (nothing dispatched), with pendingReceipts listed:
  - build-identity gate (scripts/run-proofs.sh:1044-1057)
  - surface gate (:1081-1101)
- Targeted return correlated but no direct-announce → PARTIAL with `TOKEN_TARGETED_RETURN_UNBOUND_REASON` in `partial_reasons` (:559; lib/r-cd-token-contract.js:322-325). Per the contract comments this is the expected result on products since 2273ef64d5 / 8ba08c76d8.

## CW-COMMON (shared by R-CW-1/2/3/4)

### Transcript chain binder `continueWorkChain` (lib/continue-work-chain.mjs:82-122)
- Read surface: `chat.history {sessionKey, limit:200}` (R-CW-1/2/3) or `limit:300` (R-CW-4). Only the returned page is read, oldest→newest; no paging back (scenarios cited per row). The harness dispatch row must sit inside that newest page.
- Window start = first **user** row whose text parts contain `[k6-proof-harness]` AND the nonce (lib/continue-work-chain.mjs:44-48, 95-96). Product dependency: chat.history must return the sessions.send user text with the `[k6-proof-harness]` marker and nonce intact (display stripping must not remove them).
- Per hop, inside the turn (until next user row, :51-54):
  - an assistant row with a `type:"toolCall"` part having a string `id`, invoking `continue_work` and `args.reason` containing the nonce (:101-104 → lib/sentinel-binding.mjs:166-172). Name match: raw `continue_work`, any `*__continue_work` (lib/sentinel-binding.mjs:146-148), or Tool Search dispatcher `dispatch_action`/`tool_call` with `arguments.id` = `continue_work` or `openclaw|mcp|client:<x>:continue_work` and args in `arguments.args` (lib/tool-call-identity.mjs:44-45, 80-92). Arguments may be an object or a JSON string in `arguments`/`input` (lib/tool-call-identity.mjs:62-68).
  - the **first** row with `role` (case-insensitive) `toolResult` and `toolCallId` = call id after the call, inside the turn: `isError === true` → hop fails; payload `status === "scheduled"` required (lib/continue-work-chain.mjs:56-64). toolName is NOT checked here. Payload = first `type:"text"` content part that parses as a JSON object, else `details` (lib/sentinel-binding.mjs:175-187). Only `status` is read; no `delaySeconds`, chain step, or other result field is read.
  - agent sentinel `<SCHEDULED-marker> <nonce>` in assistant **text parts** after the result, before the next user row (lib/continue-work-chain.mjs:66-72, 110-111). Exact match: `(^|[^A-Za-z0-9_-])MARKER\s+NONCE(?=$|[^A-Za-z0-9_-])`; any text containing `[k6-proof-harness]` is rejected (lib/wake-turn-receipt.mjs:50-57). Tool args and thinking never count (lib/sentinel-binding.mjs:56-70).
  - wake: the **first user row after the turn** must be the wake. It must have role user, text parts that **start with** `[continuation:wake]` and contain the nonce (carried by the quoted reason). Any other user row first → the hop fails (lib/continue-work-chain.mjs:112-116; lib/sentinel-binding.mjs:276-280).
- Done: `<doneMarker> <nonce>` in assistant text inside the last wake turn (lib/continue-work-chain.mjs:119-120).
- Expected-PARTIAL cause the lib names: a wake folded into an active run as `[system:continuation-note]` writes no `[continuation:wake]` row → missing wake (lib/continue-work-chain.mjs:28-32).
- Event text is diagnostic only. Events only trigger a re-read (e.g. lib/../scenarios/r-cw-1-tool-schedule-wake.js:253-260).

### Common telemetry path (continue_work rows): collector, see COMMON C-TRACE
- `traceContract` for `continue_work`: template = `manifest.invocation.reason`. Spans: accept `continuation.work`, fire `continuation.work.fire`. Attribution is `reason-hash-length` with no mode clause (scripts/collect-continuation-trace.mjs:156-160). TraceQL: `{ resource.service.name="<svc>" && name="continuation.work" && .reason.hash="<16hex>" && .reason.length=<n> }` (:665-672).
- The evidence must carry `reason_hash` (16 hex) and a positive integer `reason_length` (:178-182). When the manifest template has only `{{nonce}}`/`{{nonceSuffix16}}` placeholders, the collector re-renders it and requires an equal hash/length (`fingerprintSource:"manifest-nonce"`) (:185-196).
- `continue_work` specifics in validateTrace:
  - fires: ≥1 allowed (`permitsRepeatedFireAttempts`), all OK, all carrying the same reason.hash/length + chain.id (:467-481).
  - tool spans: `openclaw.tool.execution` with `gen_ai.tool.name === "continue_work"` (not `openclaw.toolName`) (:483-487). No timing scoping, which applies to continue_delegate only (:488-494).
  - exactly one tool span unless it is a chain row (:501-509). Tool status UNSET|OK and `openclaw.outcome !== "blocked"` (:510-516).
  - `workParentSpanId` is recorded (:575-579), but the collector does not require the work span to be parented to the tool span (that is only required in R-CW-3's review, below).
- Raw-trace public-safety (applies to every row): the **raw** Tempo trace must not contain the substring `traceparent` (any case), nor the rendered reason (`contract.raw`), nor any ≥6-char evidence value stored under a key matching nonce / sessionKey / `*session` / runId / idempotencyKey / task / message / prompt… (scripts/collect-continuation-trace.mjs:220-232, 787; scripts/sanitize-k6-artifacts.mjs:6-17, 57-78). Otherwise the collector throws. Product implication: span attributes/events must not carry the raw reason, the nonce, or session keys/run ids of length ≥6.
- Search window: [dispatch − 60 s, max(dispatch, evidence.ended) + 60 s]. Dispatch = `dispatch_accepted_at_ms`, else `Date.parse(started)` (:26, 673-681). More than one matching trace → ambiguous error (:698-701, 745-748).
- Trace failure → `tempo-trace-json` + correlation receipt go review-pending, not FAIL. Exception: `OPENCLAW_PROOFS_K6_TEMPO_REQUIRED=true` sets POSTPROCESS_RC=1 (scripts/run-proofs.sh:1360-1404).
- Manifest `expectedTelemetry` lists attribute `continuation.chain.id` (e.g. manifests/r-cw-1.json:117-122). The code reads `chain.id` (scripts/collect-continuation-trace.mjs:462, 470) and the projection allowlists `chain.id` only (lib/public-tempo-trace.mjs:1-10). The manifest key is therefore not what any resolver matches.

### Common harness gates / verdict shape
- Dispatch: `sessions.messages.subscribe {key}`, then `sessions.send {key, message, idempotencyKey}` 500 ms later. A response with `ok` (no `error`) counts as accepted (RequestTracker.classify: lib/gateway-ws.js:101-112).
- Disposable mode: `sessions.create {key,label}`. `payload.key` is adopted (e.g. scenarios/r-cw-1-tool-schedule-wake.js:191-198, 219-226). The verdict requires `session_created` when disposable mode is on.
- R-CW-1/2/3/4 have no preflight gate and no child observer. The verdict is only PASS-candidate or PARTIAL-candidate, never FAIL (see each row).

---

_Note from the CW slice:_ All paths relative to `tools/k6-proofs/`. "Product bytes" = rows/fields the gateway or runtime writes. "Agent sentinel" = text the model is told to write; the harness binds it to product rows but its spelling is harness-chosen.

## R-CW-1 — scenarios/r-cw-1-tool-schedule-wake.js (manifests/r-cw-1.json)

### 1. Product strings/fields matched literally
- `continue_work` toolResult payload `status === "scheduled"`, not isError, paired by toolCallId (via CW-COMMON). Binder call: scenarios/r-cw-1-tool-schedule-wake.js:146 (`scheduledMarkers:['CW-SCHEDULED'], doneMarker:'CW-WOKE'`).
- Wake row: user text starting `[continuation:wake]`, containing the nonce (CW-COMMON). The nonce reaches it only through the quoted reason `k6-proof-R-CW-1-<nonce>` (manifests/r-cw-1.json:31; scenarios/r-cw-1-tool-schedule-wake.js:84).
- `sessions.send` response `payload.traceId` copied if present (:239). Not a verdict input.
- Agent sentinels: `CW-SCHEDULED <nonce>`, `CW-WOKE <nonce>` (:173-174).
- Harness dispatch text begins `[k6-proof-harness] Call continue_work with reason="…" and delaySeconds=5` (:171-175). It must come back in chat.history with marker and nonce (CW-COMMON).

### 2. Ordering/timing
- History reads start 5000 ms after send acceptance (:241). Re-reads come 1500 ms after any `session.message` event (:259) and 5000 ms after an incomplete read (:162). All reads are `chat.history limit:200` (:141).
- Ordering is transcript order only (CW-COMMON): call → scheduled result → CW-SCHEDULED in the same turn → the next user row is `[continuation:wake]` → CW-WOKE in that turn.
- **No delay check**: `wake_delay_ms = wokeAt − resultAt` (gateway `timestamp`s) is recorded only (:155-158). The manifest positive control "wake sentinel arrives after the declared delay" (manifests/r-cw-1.json:184) is not enforced by code.
- delaySeconds = 5 (manifests/r-cw-1.json:30; default :55). Socket close = max((5+75)·1000, 90000) = 90000 ms (:184-185). maxDuration 120 s (:39).

### 3. Telemetry
- Hashed string: `wakeReason` = manifest reason with `{{nonce}}` replaced (:84). `reason_hash = sha256(wakeReason)[0:16]`, `reason_length = wakeReason.length` (:122-123). Manifest-nonce cross-check applies (scripts/collect-continuation-trace.mjs:185-196).
- No chainDepthTarget. No scenario-side span checks.
- Collector: see COMMON C-TRACE + CW-COMMON telemetry.

### 4. Product source citations (verbatim)
- manifests/r-cw-1.json:76 notes: `src/auto-reply/continuation/work-dispatch.ts:614-640`, `work-dispatch-execution.ts:234-235` (`[system:continuation-note]` fold).
- Libs on its path: lib/continue-work-chain.mjs:7 `src/agents/tool-display-config.ts:394`; :9 `src/auto-reply/continuation/work-dispatch-execution.ts:165-226`; :30-31 `src/auto-reply/continuation/work-dispatch.ts:614-640, work-dispatch-execution.ts:234-235`; SHA `openclaw f15237ec92` (:6).
- Manifest provenance: `reportCommit 39803b297bd4786db3971eb82a3a7fd0b29bc643`, `productBasis 6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955` (manifests/r-cw-1.json:82-83). `productIssue karmaterminal/openclaw#1254` (:81, :140…).
- Stale prose: manifests/r-cw-1.json:250 still says "the scenario embeds the CW-WOKE instruction in the continue_work reason". The reason no longer carries it (scenarios/r-cw-1-tool-schedule-wake.js:11-15, 56).

### 5. Verdict paths
- PASS-candidate = (disposable ⇒ session_created) ∧ sessions.send ok ∧ chain.scheduled ≥ 1 ∧ chain.complete (:293-294, 299).
- Anything missing → PARTIAL-candidate plus `proof_failures` (:289-291). That includes a non-`scheduled` result, an isError result, a missing wake row, another user row before the wake, CW-WOKE outside the wake turn, sessions.send/sessions.create rejection, or a ws error (:228-230, 243-244, 272-275). `chain_reason` names the failing step (:147).
- No FAIL path. handleSummary verdict = PASS-candidate iff proof_failures == 0 (:304, 310).

---

## R-CW-2 — scenarios/r-cw-2-immediate-wake.js (manifests/r-cw-2.json)

### 1. Product strings/fields matched literally
- Same binder with `CW2-SCHEDULED` / `CW2-WOKE` (scenarios/r-cw-2-immediate-wake.js:57). Product bytes: toolResult `status:"scheduled"` (not isError) and a user row starting `[continuation:wake]` carrying the nonce via the quoted reason `k6-proof-R-CW-2-immediate-<nonce>` (manifests/r-cw-2.json:31; scenario :28, 44).
- `sessions.send` `payload.traceId`, and event `eventData.traceId` when the event carries CW2-SCHEDULED (:84, 96). Diagnostic only.
- Dispatch text: `[k6-proof-harness] R-CW-2 proof nonce <n>. Call continue_work with delaySeconds=0 and reason="…"…` (:73).

### 2. Ordering/timing
- delaySeconds = 0 (manifests/r-cw-2.json:30). The wake must be the first user row after the scheduled turn (CW-COMMON). Nothing checks "immediate": `wake_delay_ms` is recorded only (:61-64).
- "prompt-echo-filtered" means only that the event path ignores events containing `[k6-proof-harness]` (:93). Its check passes if `prompt_echo_ignored || scheduled_sentinel` (:107). It is not a verdict input (:109).
- Reads: 5000 ms after accept (:84), 1500 ms after session.message (:92), limit 200 (:54). Close at 90000 ms (:76). maxDuration 120 s (:20).

### 3. Telemetry
- Hashed string: `wakeReason` = manifest reason rendered with the nonce (:44). `reason_hash`/`reason_length` (:45). Manifest-nonce cross-check applies.
- Collector: see COMMON C-TRACE + CW-COMMON (continue_work allows repeated fire spans).
- handleSummary marks `tempo-trace-json` pending only when no `trace_id` was captured from WS (:116-124). run-proofs.sh independently runs the collector for continuation rows (scripts/run-proofs.sh:1360-1404).

### 4. Product source citations (verbatim)
- manifests/r-cw-2.json:81 notes: `src/auto-reply/continuation/work-dispatch.ts:614-640`, `work-dispatch-execution.ts:234-235`.
- Lib citations as R-CW-1 (lib/continue-work-chain.mjs:6-9, 30-31). Provenance SHAs as R-CW-1 (manifests/r-cw-2.json:87-88).

### 5. Verdict paths
- PASS-candidate = (disposable ⇒ created) ∧ dispatch_accepted ∧ scheduled_sentinel ∧ immediate_wake_observed (:109, 111). Otherwise PARTIAL-candidate (:108).
- handleSummary review status is `ready-for-human-review` only if a WS trace_id was seen and the verdict is PASS. Otherwise `review-pending` (:136). No FAIL path.

---

## R-CW-3 — scenarios/r-cw-3-reason-telemetry.js (+ scripts/review-r-cw-3-reason-telemetry.mjs) (manifests/r-cw-3.json)

### 1. Product strings/fields matched literally
- Same binder with `CW3-SCHEDULED` / `CW3-WOKE` (scenarios/r-cw-3-reason-telemetry.js:89). Reason = `k6-proof-R-CW-3-redaction RAW-RCW3-<nonce>` (manifests/r-cw-3.json:32; scenario :57, 76). The wake row carries the nonce through it.
- Trace-id scraping (diagnostic, not a verdict input):
  - fields read: `traceId` / `trace_id` matching `/^[0-9a-f]{8,64}$/i`, or W3C `traceparent` `00-<32hex>-…`.
  - where: the frame root and its `.result`, `.state`, `.payload`; the sessions.send response payload; the event that carries CW3-SCHEDULED (:27-47, 117-120, 129-132, 147-151).
- **Public-evidence raw-reason predicate**:
  - each frame's payload is passed through `redactEvent`, an allowlist kept recursively (lib/gateway-ws.js:125-145).
  - only the **top-level** `reason` key is then deleted (:58-62).
  - if the JSON still contains `RAW-RCW3-<nonce>`, `public_artifact_raw_reason_absent=false` (:121-122) → proof_failures (:162).
  - Product dependency: no gateway response/event may carry the raw reason under an allowlisted key path below top level. Allowlisted keys: `state`, `tools`, `reason`, `status`, `name`, `mode`, … (lib/gateway-ws.js:126-133). Example: `state.reason`, `tools[].reason`.
- Review script (run automatically by scripts/run-proofs.sh:1549-1560; its outcome only adds/removes review debt):
  - Safe reason attrs anywhere in the projected trace JSON: `reason.present` (true/"true"), `reason.length`, `reason.hash` (scripts/review-r-cw-3-reason-telemetry.mjs:718-722, 752-757).
  - On **every** `continuation.work` and `continuation.work.fire` span:
    - `reason.present` must equal `true`|`"true"`;
    - `reason.hash` and `reason.length` must equal the evidence values;
    - the correlation receipt's `reason.hash`/`length` must match, with `rawPersisted === false`;
    - exactly one work span and ≥1 fire spans.
    (:332-375)
  - Raw-reason absence: no string anywhere in the projected trace contains `RAW-RCW3-` or `k6-proof-R-CW-3-redaction` (:43-44, 175-181, 758-761).
    - The same scan runs over evidence.jsonl, the correlation receipt, runner-metadata.json, the summary, run-result.json, evidence-lines.log, k6.log and **gateway-journal.log** (:72, 209-232, 724-733).
    - Product dependency: the gateway journal must not log the raw continue_work reason. The sanitizer keeps nonce-correlated journal lines and scrubs only the nonce, so a journal line with `RAW-RCW3-<nonce>` still contains `RAW-RCW3-` (scripts/sanitize-k6-artifacts.mjs:192-199).
  - The projected public trace keeps only allowlisted attrs with value-shape guards: `chain.id`, `delegate.mode`, `gen_ai.tool.name`, `openclaw.outcome`, `openclaw.toolName`, `reason.hash` (16 hex), `reason.length` (int), `reason.present` (bool) (lib/public-tempo-trace.mjs:1-10, 59-79). The trace-JSON raw scan therefore cannot see non-allowlisted product attributes. The collector's raw-trace check (CW-COMMON) is the only gate on raw Tempo bytes.

### 2. Ordering/timing
- Binder ordering as CW-COMMON. delaySeconds 5 (manifests/r-cw-3.json:31). `wake_delay_ms` is recorded only (:93-96).
- Reads: 5000 ms / 1500 ms / limit 200 (:84-87, 134, 143). Close = max(600000, (5+540)·1000) = 600000 ms (:108). maxDuration 10 m (:49).

### 3. Telemetry
- Hashed string: `rawReason` (:76-77). Manifest-nonce cross-check applies. Collector: see COMMON C-TRACE + CW-COMMON.
- Review topology, stricter than the collector (scripts/review-r-cw-3-reason-telemetry.mjs:382-460):
  - correlation receipt: `attribution === "reason-hash-length"`, `resultClass "unique"`, `sameTrace/sameChain/distinctSpans === true`, `continuation.tool "continue_work"`, `originSurface "typed-tool"`, `acceptSpan "continuation.work"`, `fireSpan "continuation.work.fire"` (:397-406);
  - exactly one `openclaw.tool.execution` span in the projected trace (:415-417), with `gen_ai.tool.name === "continue_work"` (:441-445);
  - **the work span and every fire span must be parented to that one tool span** (fire is a sibling of work, not its child) (:422-430);
  - one shared `chain.id` UUIDv4 on work+fire (:393, 408, 434);
  - work and fire status OK; tool status UNSET|OK and not `openclaw.outcome:"blocked"` (:436-448);
  - `fireAttemptCount` must equal the observed fire count (:431).
- External anchors (candidate SHA, run id, matrix id, trace id) and source digests are also required (:470-567).

### 4. Product source citations (verbatim)
- manifests/r-cw-3.json:82 notes: `src/auto-reply/continuation/work-dispatch.ts:614-640`, `work-dispatch-execution.ts:234-235`. Provenance SHAs: manifests/r-cw-3.json:88-89.
- Review script: no product file:line citations (grep of scripts/review-r-cw-3-reason-telemetry.mjs finds none).
- Lib citations as R-CW-1.

### 5. Verdict paths
- The scenario always prints `VERDICT: PARTIAL-candidate` (:165). handleSummary verdict is fixed at `PARTIAL-candidate` and `review.status:"review-pending"` (:172-174, 193). Failures still add `proof_failures`: no dispatch, schedule, or wake, or raw reason present in public evidence (:162).
- run-proofs.sh always seeds `reason-telemetry-redaction-review` as pending for R-CW-3 and nothing removes it (scripts/run-proofs.sh:1336-1349). A failed review join adds `reason-telemetry-redaction-review-join` (:1555-1559).
- The review verdict `reason-telemetry-redaction-review-passed` vs `review-pending` requires all checks ok (scripts/review-r-cw-3-reason-telemetry.mjs:776, 792). It never lifts the row verdict (:25-27). No FAIL path.

---

## R-CW-4 — scenarios/r-cw-4-chain-depth.js (manifests/r-cw-4.json)

### 1. Product strings/fields matched literally
- Binder with three scheduled markers `CW4-HOP1-SCHEDULED`, `CW4-HOP2-SCHEDULED`, `CW4-HOP3-SCHEDULED` and done `CW4-DONE` (scenarios/r-cw-4-chain-depth.js:53, 62). Each hop needs:
  - a nonce-bound `continue_work` call whose toolResult is `status:"scheduled"` (not isError);
  - the agent sentinel in the same turn;
  - next user row = `[continuation:wake]`+nonce, and the next hop's call runs **inside that wake turn** (lib/continue-work-chain.mjs:97-118).
- Hop reasons, all carrying the nonce so each wake row quotes it:
  - hop1 = manifest `R-CW-4 hop1 {{nonce}}; on wake call hop2` (manifests/r-cw-4.json:33; scenario :48);
  - hop2 `R-CW-4 hop2 <nonce>; on wake call hop3`;
  - hop3 `R-CW-4 hop3 <nonce>; on wake finish` (:82).
- **No `chain.step` / `hop=N/M` byte is read anywhere.** The scenario and libs have no `step` or `hop=` matcher (grep), although manifest receipts hop-1/2/3 say "chain.step shows n/N" (manifests/r-cw-4.json requiredReceipts; extract line in manifest-extract).
- Disposable key `agent:main:subagent:continuation-r-cw-4-<nonce>`, sent via `sessions.create` (:32, 87). `payload.key` is adopted (:93). A requested key containing `:subagent:continuation-` skips creation (:31, 40).

### 2. Ordering/timing
- Strict turn order across 3 hops + done (CW-COMMON). Reads use `chat.history limit:300` (:59), so the whole chain plus the dispatch row must fit in the newest 300 messages.
- delaySeconds 2 per hop (manifests/r-cw-4.json:32). No inter-hop delay check. Close = max(600000, (2·4+360)·1000) = 600000 ms (:85). maxDuration 10 m (:22).
- Evidence has no `dispatch_accepted_at_ms`, so the collector window anchors on `Date.parse(started)` (scripts/collect-continuation-trace.mjs:673).

### 3. Telemetry
- Hashed string: hop-1 reason only (:46-49). Manifest-nonce cross-check applies.
- `chainDepthTarget: 3` (manifests/r-cw-4.json:31) → `traceContract` carries it (scripts/collect-continuation-trace.mjs:199-216).
- In validateTrace:
  - >3 `continue_work` tool spans on the trace → throw (:341-345).
  - 2–3 tool spans → `scopeContinueWorkChain` (:501-502, 334-427):
    - hop 1 = the tool span that parents the fingerprint-matched `continuation.work`;
    - every other continue_work tool span must parent exactly one OK `continuation.work` with the same `chain.id`;
    - its nearest continue_work ancestor must be the previous hop, with no branching and one sequence.
  - **Exactly one tool span (hops 2/3 on other traces) also passes**: `chainRow && tools.length > 1` is false, so it falls to `tools.length !== 1` (:501-509). `chainDepth` is then recorded as 1 (:559-566).
  - The collector therefore does not require the 3-hop chain on one trace.
- Fire spans counted are only those matching the hop-1 reason.hash/length + chain.id (:467-472).

### 4. Product source citations (verbatim)
- manifests/r-cw-4.json:83 notes: `src/auto-reply/continuation/work-dispatch.ts:614-640`, `work-dispatch-execution.ts:234-235`.
- Collector comment on the chain topology it assumes (scripts/collect-continuation-trace.mjs:324-328): `openclaw work-dispatch-execution.ts driveContinuationTurn -> runWithDiagnosticTraceparent(work.traceparent)`; "continuation.work is a child of its electing tool span (continue-work-tool.ts captures the live span)". No line numbers given.
- Lib citations as R-CW-1. Provenance SHAs: manifests/r-cw-4.json:89-90.

### 5. Verdict paths
- PASS-candidate = (disposable ⇒ created) ∧ dispatch_accepted ∧ hop1/2/3_scheduled ∧ final_done (:119-120). `hopN_scheduled` flips when `chain.scheduled > N−1` (:64-70). Otherwise PARTIAL-candidate (:118). No FAIL path.
- A wake folded into a running turn (no `[continuation:wake]` row) breaks the chain at that hop → PARTIAL (lib/continue-work-chain.mjs:28-32, 116).

---

## R-CW-DELEGATE-SELF-CONTINUATION — scenarios/r-cw-delegate-self-continuation.js (manifests/r-cw-delegate-self.json)

### 1. Product strings/fields matched literally
- Preflight: hello-ok `payload.type === "hello-ok"`. `payload.features.methods` must include `sessions.create`, `sessions.messages.subscribe`, `sessions.send`, `sessions.list`, `chat.history` (lib/child-observer.mjs:37, 43, 62, 81-87, 108-132; scenario :172, 346-352). Refusal or timeout at 10000 ms → no dispatch (:340).
- Parent dispatch accepted = `sessions.send` ok (:392-395). `dispatch_run_id = payload.runId` (string) (:397). **The parent's own `continue_delegate` toolResult is not read**: no `scheduled` check on the parent.
- Child binding (only the observer binds; lib/child-observer.mjs:22-26):
  - `sessions.list {spawnedBy:<parent key>}` row whose own `spawnedBy` equals the parent key (lib/child-observer.mjs:316, 368);
  - the child's **first user message** in `chat.history` (paged back to oldest) contains the nonce. Text after `[Subagent Task]` if present; otherwise the whole first user message, provided no user row carries the marker and `forkedFromParent !== true` (lib/child-observer.mjs:42, 230-245, 390-395);
  - unique match (scenario :213-229).
  - Event-path candidates: records with `childSessionKey` plus `task|text|title` containing the nonce, found under top-level/`task`/`tasks`/`records` (lib/row-child-correlation.mjs:6-8, 41-51, 68-92; scenario :411-416). These are a cross-check only; any disagreement → conflict (lib/child-observer.mjs:658-682).
  - Child row `status` is recorded (:223) but is not a verdict input.
- Child turn 1, from the child's own chat.history (lib/cw-delegate-self-receipt.mjs:75-96):
  - **exactly one** `continue_work` call in the whole transcript with `args.reason` containing the nonce (exact target name `continue_work` after dispatcher unwrapping; lib/request-compaction-receipt.js:150-173);
  - its toolResult: role toolResult, `toolName` = `continue_work` **or** `dispatch_action`/`tool_call`, same toolCallId, not isError, payload `status === "scheduled"` (JSON content text, else `details`) (lib/cw-delegate-self-receipt.mjs:45-56; lib/tool-call-identity.mjs:95-98);
  - agent sentinel `CHILD-CW-SCHEDULED <nonce>` in an assistant row before the next user row (:59-65, 87).
- Child wake: a later user row whose text starts with `[continuation:wake]` and contains the nonce (via the quoted reason `k6-self-continuation-<nonce>`). It may be **any** later user row, not necessarily the first (lib/request-compaction-receipt.js:190-199). Then `CHILD-HOP2-DONE <nonce>` in that turn (lib/cw-delegate-self-receipt.mjs:90-93).
- Minted token: `CHILD-CW-SCHEDULED <nonce> TOKEN <[a-z0-9]{12}>` on the turn-1 sentinel row. The token must be absent from the harness instruction, the task, and the child's first user row (:141-160; scenario :305).
- Parent return, from the parent's chat.history (lib/cw-delegate-self-receipt.mjs:179-213):
  - assistant text `PARENT-RETURN <nonce> TOKEN <token>` (exact, word-bounded);
  - row `__openclaw.runId` present and ≠ dispatch runId;
  - row index after the last row stamped with the dispatch runId, and that row must exist (:184-186);
  - `timestamp` (number) ≥ the child token row's `timestamp` (:188-199).
  - Alternatively a `heartbeat_respond` call+result pair: same run, both runIds required, result payload `status:"accepted"`, sentinel in `notificationText|notification_text|summary` of both (:204-209; lib/wake-turn-receipt.mjs:42-44, 106-200).

### 2. Ordering/timing
- Child order: yield call → scheduled result → CHILD-CW-SCHEDULED (same turn) → later `[continuation:wake]`+nonce → CHILD-HOP2-DONE (same turn).
- Parent: return run ≠ dispatch run, after the dispatch run's last row, gateway timestamp not earlier than the child token. Fails closed if a timestamp is missing (lib/cw-delegate-self-receipt.mjs:174-199). The k6 clock is not compared with gateway time (:176-177).
- Observer polls at 5/15/30/60/90 s (:283-285). Child hop reads every 3000 ms, max 40 (:78-79, 231-242). Parent reads every 3000 ms, max 40 (:80, 185-194).
- `POST_DISPATCH_EVIDENCE_GATE_MS` = env or 1500 (:76) gates diagnostics only (:421-436).
- Delegate `delaySeconds` 1 (manifest invocation). The child's continue_work `delaySeconds=2` is task text only. Socket close 120000 ms (:317). maxDuration 150 s (:53).

### 3. Telemetry
- Hashed string: the delegate `task` = manifest `promptTemplate` with `{{nonce}}` replaced (:291). `reason_hash = sha256(task)[0:16]`, `reason_length = task.length`, `delegate_mode = "normal"` (:295-297). The template has only `{{nonce}}` placeholders → manifest-nonce cross-check (scripts/collect-continuation-trace.mjs:185-196). Product implication: `continuation.delegate.dispatch`/`fire` `reason.hash`/`reason.length` are computed over the exact `task` argument.
- Collector continue_delegate path: see COMMON C-TRACE. Accept `continuation.delegate.dispatch`, fire `continuation.delegate.fire`, `delegate.mode="normal"` in TraceQL (:150-155, 665-670).
  - Exactly one fire (:473-478).
  - Tool span `gen_ai.tool.name="continue_delegate"`, timing-scoped (:288-322):
    - the fire must have `startTimeUnixNano`;
    - the first present of fire `fire.deferred_ms`, fire `delay.ms`, accept `delay.ms` must be an OTLP `{intValue:"<positive int>"}` with no other key (a 0 value or another value type → invalid-timing throw, :273-286, 491-493);
    - tool start ∈ [fireStart − deferred − 15000 ms, fireStart − deferred + 1000 ms] (:27-28, 307-320).
- The child's `continuation.work`/`.work.fire` spans appear in manifest expectedTelemetry (manifest-extract spans) but **no resolver checks them**: validateTrace scopes only dispatch/fire/tool and records direct children of dispatch as `childSpans` (scripts/collect-continuation-trace.mjs:542-546).

### 4. Product source citations (verbatim)
- manifests/r-cw-delegate-self.json:39 `continue-work-tool.ts:86-95` (toolResult status "scheduled"); :40 `work-dispatch-execution.ts:197-215` (`[continuation:wake]` user turn).
- lib/cw-delegate-self-receipt.mjs:
  - :6-7 `openclaw cut 41b8d69b90`;
  - :9 `src/agents/tools/continue-work-tool.ts:86-95`;
  - :12-13 `src/auto-reply/continuation/work-dispatch-execution.ts :197-215; a normal turn, not a heartbeat, :364-388`;
  - :16 `chat-display-projection.sanitize.ts:431-463`;
  - :104 `subagents/registry/subagent-registry-lifecycle-announce-cleanup.ts:560`;
  - :106 `subagents/announce/subagent-announce-direct-delivery.ts:384-413`;
  - :109 `chat-display-projection.history.ts:350-354, input-provenance.ts:145-156`;
  - :110-111 `work-dispatch-execution.ts :364-388`.
- lib/request-compaction-receipt.js:186 `openclaw 41b8d69b90 work-dispatch-execution.ts:197-215, sent as the turn Body at :365-372`.
- Shared libs on path:
  - lib/child-observer.mjs:13 `core-descriptors.ts:252`; :15 `src/gateway/session-utils-row.ts:436,465,538-546`; :16 `core-descriptors.ts:365`; :18-19 `src/agents/subagents/spawn/subagent-system-prompt.ts:23-36`; :39 `packages/gateway-protocol/src/schema/sessions-row.ts:28-36`; :77-78 `src/gateway/server/ws-connection/connect-hello.ts:300`, `packages/gateway-protocol/src/schema/frames.ts:94,106-107`; :221-223 `openclaw 935ba44c17 … src/gateway/chat-sanitize.ts, src/auto-reply/reply/user-envelope-display.ts`; :366 `src/gateway/session-list-filters.ts:150-163`; :394 `src/gateway/session-utils-row.ts:457 at openclaw 935ba44c17`.
  - lib/tool-call-identity.mjs:5,8-12,22 (`tool-surface-plan.ts:145-150`, `tool-catalog.ts:29`, `tool-display-call.ts:5-24`, `tool-search-catalog.ts:193`, `tool-search-runtime.ts:75-103`, `session-tool-result-guard.ts:482-486`; `openclaw f15237ec92` :4).
  - lib/wake-turn-receipt.mjs:3-29 (`cut 41b8d69b90`, `targeting.ts:229-237`, `subagent-announce.continuation-return.ts :210-231`, `heartbeat-response-tool.ts` :21-37/:54-75/:78-105, `packages/llm-core/src/types.ts:304-313`/`:424-432`, `session-tool-result-guard.ts:311`, `chat-display-projection.sanitize.ts :431-463`, `chat-display-projection.history.ts:329-334, 366`, `heartbeat-dispatch.ts:605-623`, `deliver-core.ts:214`, `heartbeat-events.ts:10-27`).
- Provenance SHAs: manifests/r-cw-delegate-self.json:61-62.

### 5. Verdict paths
- PASS-candidate = (disposable ⇒ created) ∧ delegate_accepted ∧ child_spawned ∧ ¬child_identity_conflict ∧ child_continue_work_accepted ∧ child_hop_2_woke ∧ parent_return (:482-488). The result then passes `failClosedVerdict` (:489).
- PARTIAL-candidate with a named reason when:
  - preflight was refused or never completed (lib/child-observer.mjs:160-166);
  - any observer method was refused (FORBIDDEN / "missing scope" / "unknown method", :184-193) or observation was incomplete (`observer.failClosedReason()`, :167-173);
  - there was a child identity conflict (scenario :490-493).
- Any missing receipt → PARTIAL-candidate (:475-480). That includes a non-`scheduled` or isError child result, 0 or ≥2 nonce-bound continue_work calls, no wake, a token echoed in harness text, a missing dispatch runId, or missing timestamps. No FAIL path.
- `hop2_output_reached_parent` is explicitly not claimed (:152-155).

---

## R-CW-TOKEN — scenarios/r-cw-token-bracket.js (manifests/r-cw-token.json)

### 1. Product strings/fields matched literally
- Parent `sessions_spawn` receipt (scenarios/r-cw-token-bracket.js:191-217):
  - tool name `sessions_spawn` (also via dispatcher unwrap or `*__sessions_spawn`);
  - `args.task` contains the nonce; result paired by toolCallId through the live tracker or chat.history (:272, 312, 410-414; lib/sentinel-binding.mjs:205-262);
  - required: not isError, payload `status === "accepted"`, payload `childSessionKey` a non-empty string after trim (:208-209). More than one receipt → `ambiguous` (:193).
  - Refused: `args.context === "fork"`, or `context` undefined with `args.thread === true` (:202-207).
- dispatchRunId = `sessions.send` response `payload.runId` (lib/gateway-lifecycle.js:5-9; scenario :374), else the spawn receipt's runId (:210).
- Child transcript = `chat.history {sessionKey:childKey, limit:200}` plus live `session.message` rows for childKey, but only when the read was sent after the child subscribe was acknowledged (:241-259, 384-386, 416-421). The live row's runId comes from `message.__openclaw.runId` or the event `runId` (:417).
- `tokenWorkHops` (lib/continue-work-chain.mjs:156-192):
  - first user row (plain text parts; no `[Subagent Task]` handling) must contain the nonce (:163-168, 194-200);
  - hop 1: assistant text `TOKEN-HOP1 <nonce>` after it (:170-175);
  - wake index: first later user row starting `[continuation:wake]`. This is **not nonce-bound**, unlike CW-COMMON (:177-180);
  - hop 2: assistant `TOKEN-HOP2-DONE <nonce> TOKEN <[a-z0-9]{12}>`, token absent from harness texts, requester sessions_spawn args, and every user row (lib/sentinel-binding.mjs:293-319). It must come after the wake row **or** in a run (`__openclaw.runId`) ≠ hop-1's (lib/continue-work-chain.mjs:181-189);
  - any typed `continue_work` call in the child rows (name, `*__continue_work`, or dispatcher) → incomplete (:160, 190).
- **The bare `CONTINUE_WORK:<n>` token itself is never matched.** The child is told to end with `CONTINUE_WORK:5` (:300; manifests/r-cw-token.json invocation.tokenDelaySeconds 5). The receipt `token-emitted-or-stripped` = TOKEN-HOP1 seen with no typed call (:226-229).
- Parent return: `TOKEN-HOP2-RETURN <nonce> TOKEN <hop2 token>` in parent assistant text. The runId must be present and ≠ dispatchRunId. Timestamp ≥ the hop-2 token row timestamp, and both timestamps must be numbers (:273-280; lib/sentinel-binding.mjs:328-354). A null dispatchRunId → nothing binds (lib/wake-turn-receipt.mjs:90-93).
- `[continuation:work-wake]` journal line: **no code reads it.** It appears only as manifest requiredReceipt `journal-work-wake-hop-2` and in verdictAuthority prose (manifests/r-cw-token.json:66-68, 249, 275, 280). grep finds no matcher in scenarios/scripts/lib. run-proofs.sh only marks `gateway-journal` pending when the journal capture failed (scripts/run-proofs.sh:1333-1335).

### 2. Ordering/timing
- Spawn receipt → child subscribe → child read 250 ms later (:215-216). Child re-reads every 3000 ms (500 ms after a live row), max 60 (:242, 399, 420). Parent re-reads every 4000 ms, max 60, first one 5000 ms after accept (:262, 289, 377).
- Hop 2 is after a `[continuation:wake]` row or in a different run from hop 1. There is no delay check against `tokenDelaySeconds`.
- Parent return is in a run other than the dispatch run, not earlier than the token.
- Socket close 150000 ms (:322). maxDuration 180 s (:63). Close 1000 ms after the parent return binds (:185-189, 285).

### 3. Telemetry
- `invocation.tool = "sessions_spawn"` → `traceContract` kind `tool`, attribution `seat-tool-dispatch-window`; no reason hash (scripts/collect-continuation-trace.mjs:161-167). The scenario records no `reason_hash`.
- TraceQL: `{ resource.service.name="<svc>" && name="openclaw.tool.execution" && .gen_ai.tool.name="sessions_spawn" }` over [dispatch−60 s, ended+60 s] (:672-681). There must be exactly one candidate trace in the window: any other sessions_spawn trace on the seat → ambiguous throw.
- `validateToolTrace`: exactly one `openclaw.tool.execution` span with `gen_ai.tool.name` **or** `openclaw.toolName` === `sessions_spawn`. Records its status but **does not require OK** (:582-609). Writes `tool-trace-correlation.json` (:798-803).
- `continuation.work`/`continuation.work.fire` under it are not checked by code (manifest says "reviewed by hand"; manifest-extract tool-trace-correlation). The public projection drops `gen_ai.tool.name` values other than continue_delegate/continue_work/request_compaction (lib/public-tempo-trace.mjs:68-69), so the published trace carries the span without its tool-name attribute.
- The raw-trace public-safety check still applies (CW-COMMON). Evidence tokens include the nonce, `child_session_key`, `sessionKey`/`created_session_key` (if ≥6 chars) and run ids.

### 4. Product source citations (verbatim)
- scenarios/r-cw-token-bracket.js:199 `session-accessor.sqlite-parent-fork.ts:219-249`; :201 `subagent-spawn-context.ts:207-229`.
- lib/continue-work-chain.mjs (tokenWorkHops path): see R-CW-1 list. lib/gateway-lifecycle.js:23 `openclaw 41b8d69b90 / 14d31a81b1` (lifecycle success shape; runId-only extraction used here).
- manifests/r-cw-token.json: no `.ts` citations. Provenance SHAs at :104-105. `#952` lineage in notes (:91).

### 5. Verdict paths
- PASS-candidate = (disposable ⇒ created) ∧ parent_dispatch_accepted ∧ subagent_spawn_requested ∧ subagent_spawn_accepted ∧ token_emitted_or_stripped ∧ hop_2_executed ∧ ¬child_typed_continue_work_observed ∧ parent_return (:471-478).
- Otherwise PARTIAL-candidate (:462-469, 483). That includes a spawn result not `accepted`, a missing childSessionKey, a fork/thread-default context (`spawn_refusal_reason`, :204), a typed continue_work in the child, no wake row and same run, a token echoed in sent text, and a missing timestamps/runId on the parent return.
- No FAIL path. manifests/r-cw-token.json:251 states FAIL is not emitted. A message-body seat is expected PARTIAL (seatClassExpectation, manifests/r-cw-token.json:29-33). This is not enforced by code.

## R-OBS-1 — scenarios/r-obs-1.js (manifests/r-obs-1.json)

### 1. Product strings/fields matched literally
- `sessions.create {key: "r-obs-1-<nonce lowercased, [^a-z0-9-]→->", label}`. The response must be `ok` and `payload.key` is adopted as the session key (scenarios/r-obs-1.js:120-124, 143-150). A rejected create counts as a failure (:151-155).
- `sessions.messages.subscribe {key}` and `sessions.send {key, message, idempotencyKey: "R-OBS-1-<nonce>"}` (:102, 109-113). The response must be `ok` (:158-166). `payload.traceId` is copied to evidence if present; no predicate reads it (:161).
- No product byte of the status card is matched. The only predicate is agent-authored text: the last `OBS1-STATUS <nonce>` in the concatenation of every event's `JSON.stringify(data)` that contains the nonce and not `[k6-proof-harness]`, followed by `BUILD (yes|no)`, `CONTEXT (yes|no)`, `CHAIN (yes|no)`, `ROUTE (yes|no)` (case-insensitive) (:42-52, 169-190).
  - Events are not filtered by session, event name, role or text part. A match inside tool-call args or thinking also counts (:170-177).
- The tool name `session_status` appears only in the prompt (:104-108). Nothing checks that the tool was called, that it exists in tools.effective, or what its result held. Manifest `scenario.methods` lists `session_status`, but nothing reads it at runtime; the only consumer is a child-observer test comment (lib/child-observer.mjs:48).

### 2. Ordering/timing
- Create at +250 ms after open (:121-124). Subscribe at flow start; send 500 ms later (:101-114). Socket closes at 60000 ms (:115). k6 maxDuration is 90s (:22). There is a threshold `r_obs_1_duration p(95)<75000` (:27).
- No ordering against the dispatch. A pre-dispatch event that carries the nonce without the harness marker would be eligible (:171-177).

### 3. Telemetry
- None. `invocation: null` and toolSurface `typed-tool`, so traceRequirement is not continuation (lib/continuation-trace-requirement.mjs:93-116). `trace-id` is optional in the manifest and absent from requiredReceipts (manifests/r-obs-1.json `.liveRunSafety.requiredReceipts` = seat-readiness, dispatch-accepted, status-card-sentinel, build-context-chain-route-visible).

### 4. Product source citations verbatim
- None in the scenario or manifest.

### 5. Verdict paths
- PASS-candidate if and only if `proof_failures == 0`, else FAIL-candidate (:222-235).
- A failure is added by:
  - a missing token (:63-66);
  - a rejected create (:151-155);
  - a rejected send (:163-166);
  - a ws error (:198-201);
  - any of dispatch_accepted, status_card_observed, build_visible, context_visible, continuation_chain_visible or route_visible being false (:215-217).
- An agent reply with any `no` therefore gives FAIL-candidate, not PARTIAL (:180-183, 215).

## R-RC-1 — scenarios/r-rc-1-threshold-reject.js (manifests/r-rc-1.json; lib/request-compaction-receipt.js)

### 1. Product strings/fields matched literally
- No preflight gate: R-RC-1 is not in ROW_METHODS and the scenario never calls createPreflightGate (lib/child-observer.mjs:50-64; scenarios/r-rc-1-threshold-reject.js:12-18). `sessions.create` is sent 250 ms after the connect frame without waiting for hello (:154-160).
- Disposable session is always created: `createDisposableSession = ... || true` (:49). Uses `payload.key` from the sessions.create response with no check against the configured key (:179-186).
- tools.effective `{sessionKey}`: `payload.groups[].tools[]` entries (string, or `.id`/`.name`) must include `request_compaction` (lib/request-compaction-receipt.js:33-46; scenarios/r-rc-1-threshold-reject.js:102,194-205). Absent → close before dispatch.
- Call binding: exactly one assistant toolCall of `request_compaction` (by name or dispatcher `id`) with a string `part.id` whose `args.reason` includes the nonce; an id-less match → null (lib/request-compaction-receipt.js:48-67; reason text at scenarios/r-rc-1-threshold-reject.js:107).
- Result row: `role === 'toolResult'` (case-sensitive) AND (`toolName === 'request_compaction'` OR (`toolCallId` === bound id AND toolName ∈ {dispatch_action, tool_call})) (lib/request-compaction-receipt.js:76-80). Searched newest-first (:113-117).
- Receipt payload: `message.details` object first, else content (object | JSON string | parts with `.details` or JSON `.text`) (lib/request-compaction-receipt.js:18-31,82-84). No structured receipt → invalid (:85-91).
- PASS shape: `receipt.status === 'rejected' && receipt.guard === 'context_threshold'` (lib/request-compaction-receipt.js:93-99; scenarios/r-rc-1-threshold-reject.js:120-128). `contextUsage`/`threshold` are recorded if finite (:129-130) but NOT required, so the unknown-usage rejection branch also passes. `no_compaction_side_effect` is set true by assertion, not measured (:131).
- Transcript read uses `sessions.get {key, limit:20}` → `payload.messages` (scenarios/r-rc-1-threshold-reject.js:151,236). R-RC-2's comment says sessions.get is `advertise:false` (scenarios/r-rc-2-delegate-request-compaction.js:247).
- Trigger for the transcript read: a subscription event whose `message.role === 'toolResult'` and `toolName === 'request_compaction'`, since without a toolCallId a dispatcher-named row is 'unrelated' (lib/request-compaction-receipt.js:77-80; scenarios/r-rc-1-threshold-reject.js:250-257). The other trigger is an assistant event containing `RC1-RESULT-OBSERVED <nonce>` (agent-authored, diagnostic; :259-266). Under Tool Search (toolResult named `dispatch_action`), only the assistant sentinel triggers the read.
- Agent-authored sentinel `RC1-RESULT-OBSERVED <nonce>` is diagnostic only (:110,261-263).

### 2. Ordering/timing
- Sequence: create (250 ms) → tools.effective → subscribe → sessions.send → event-triggered sessions.get (:156-160,101-104,203,207-210,255-266).
- sessions.get retries: up to 8 attempts, 250 ms apart (≈2 s) after the first trigger, then failure (:238-244).
- Socket close 60,000 ms after tools.effective is sent (:103); k6 maxDuration 90 s (:26); `dispatch_accepted_at_ms` = local time of the sessions.send ok (:220).
- No requirement that the result follow any wake; the result must be in the last 20 rows of the disposable session (:151).

### 3. Telemetry
- No reason_hash/length is recorded. Tool row: the collector contract kind is 'tool' (scripts/collect-continuation-trace.mjs:161-167); correlationReceiptFor → `tool-trace-correlation` (lib/continuation-trace-requirement.mjs:71-76).
- Query `{ resource.service.name="<svc>" && name="openclaw.tool.execution" && .gen_ai.tool.name="request_compaction" }` (scripts/collect-continuation-trace.mjs:665-672). Window [floor(dispatch_accepted_at_ms/1000) − 60, max(dispatch, ended) + 60] s (:673-681,26).
- Exactly one matching Tempo trace across the seat's service in that window, stable through settle and final query (:699-701,733-765). Another request_compaction call on the seat within ±60 s makes it ambiguous.
- validateToolTrace: exactly one `openclaw.tool.execution` with `gen_ai.tool.name` OR `openclaw.toolName` = `request_compaction` (:582-596). No status/outcome attribute is checked; the manifest notes the span "carry[ies] no accepted/rejected outcome" (manifests/r-rc-1.json:97).
- The trace never affects the verdict. Collector: see COMMON C-TRACE.

### 4. Product source citations (verbatim)
- manifests/r-rc-1.json: no `.ts`/`src/` refs (grep `\.ts|src/|[0-9a-f]{10,40}` hits only receipt prose at :40-42,97,163,222).
- lib/request-compaction-receipt.js (shared with R-RC-2; cited below under R-RC-2). The R-RC-1 functions (:1-119) carry no product line cites except the comment at :55 `(#1727 review F1/N1)`.
- lib/tool-call-identity.mjs:25-33 `src/agents/tool-surface-plan.ts:145-150`, `src/agents/tool-catalog.ts:29`, `src/agents/tool-display-call.ts:5-24`, `src/agents/tool-search-catalog.ts:193`, `tool-search-runtime.ts:75-103`, `src/agents/session-tool-result-guard.ts:482-486` (at `openclaw f15237ec92`).

### 5. Verdict paths
- VU log `[R-RC-1] VERDICT:` = PASS-candidate iff `tool_invoke_rejected`, else PARTIAL-candidate (scenarios/r-rc-1-threshold-reject.js:307). That flag is set only by a nonce-bound toolResult with status rejected + guard context_threshold (:120-127). The VU log verdict owns the run (scripts/run-proofs.sh:1221-1236).
- PARTIAL (never FAIL): request_compaction missing from tools.effective (:196-200); create/subscribe/send rejected (:187-191,210-214,223-227); a nonce-bound result with any other status, e.g. `compaction_requested`, `rate_limit`, or no structured receipt → `non_threshold_result`/`invalid` → failure counter, PARTIAL (:136-143); no result after 8 reads (:240-243); no trigger event at all.
- handleSummary: PASS iff `proof_failures == 0` (:312,318). It also counts guard/nonce-bound/registration checks (:296-302), so it can disagree with the VU log line, and the VU log wins.
- manifests/r-rc-1.json verdictAuthority.fail: "Not emitted by this scenario" (manifests/r-rc-1.json:202).

## R-RC-2 — scenarios/r-rc-2-delegate-request-compaction.js (manifests/r-rc-2.json; lib/request-compaction-receipt.js)

### 1. Product strings/fields matched literally
- Preflight: hello-ok `features.methods` ⊇ sessions.create, sessions.messages.subscribe, sessions.send, sessions.list, chat.history (lib/child-observer.mjs:43,63; scenarios/r-rc-2-delegate-request-compaction.js:170,318-324).
- Disposable session: `sessions.create` `payload.key` used with no configured-key check (:342-349).
- Child binding: observer only (`sessions.list {spawnedBy}` row + child's own first-user spawn task carrying the nonce or `RRC2:<last16>`). Event-path `childSessionKey` records (task/text/title fields carrying the nonce/token) are cross-checks only; any disagreement → conflict (:96,215-237,447-457; lib/child-observer.mjs:658-682; lib/row-child-correlation.mjs:41-97).
- All receipts are read from the CHILD's `chat.history {sessionKey: child, limit:200}` (:249,369-445).
- Turn-1 yield: exactly one child assistant toolCall `continue_work` (by name or dispatcher) whose `args.reason` includes the nonce (lib/request-compaction-receipt.js:150-173).
- Wake turn (product-injected): a child user-role message after the yield whose text-parts string `startsWith('[continuation:wake]')` and includes the nonce (via the quoted prior reason) (lib/request-compaction-receipt.js:183-199).
- request_compaction call: exactly one child toolCall with id whose `args.reason` includes the nonce, at an index after the wake row (lib/request-compaction-receipt.js:48-67,214-221).
- Result row: `role === 'toolResult'` and (`toolName 'request_compaction'` or dispatcher name + matching toolCallId); payload from `details`, else content JSON (lib/request-compaction-receipt.js:76-91; chat.history drops details per :137-139).
- Measured classification (lib/request-compaction-receipt.js:212-248):
  - `status 'rejected'` + `guard 'context_threshold'`:
    - both `contextUsage` and `threshold` finite numbers and `contextUsage < threshold` (strict) → threshold_rejected_measured (:242-244)
    - both numbers but `>=` → invalid (:244)
    - neither field → context_unknown (:241)
    - only one field present → invalid (:240)
  - `status 'compaction_requested'` → accepted (:146-148,246); the literal 'accepted' status is not accepted (:142-145)
  - anything else → other (:247)
- Strictness differs from R-CD-3: there `contextUsage <= threshold` counts as measured (lib/r-cd-3-lifeboat.mjs:246). A 70/70 receipt is HONEST-LIMIT-eligible in neither row; in R-RC-2 it is 'invalid'.
- Recorded receipt fields: `status`, `guard`, `contextUsage`, `threshold` (scenarios/r-rc-2-delegate-request-compaction.js:406-419). `request_compaction_receipt_role`/`_tool_name` are set to the constants 'toolResult'/'request_compaction' by the harness, not read from the row (:408-409).
- Agent-authored child sentinels, read only from the child transcript:
  - `RRC2-CHILD-READY <nonce>`: diagnostic, any assistant content (:384-385)
  - `REQUEST_COMPACTION_REJECTED_CONTEXT_THRESHOLD <nonce>` with `CONTEXT <n>` and `THRESHOLD <n>` after it, in an assistant row after the bound toolResult and before the next user row (lib/request-compaction-receipt.js:279-304)
  - `REQUEST_COMPACTION_ACCEPTED <nonce>`, same window (:305)
  - `REQUEST_COMPACTION_POST_COMPACTION <nonce>` after a `compaction_requested` toolResult, in a later turn (a user row in between) or an assistant row whose `__openclaw.runId` differs from the call's (:320-345)
  - All matched word-bounded via hasExactSentinelText; text containing `[k6-proof-harness]` never counts (lib/wake-turn-receipt.mjs:50-58).
- Parent-stream sightings of the three REQUEST_COMPACTION_* strings are diagnostics that only trigger a child read (scenarios/r-rc-2-delegate-request-compaction.js:458-476).

### 2. Ordering/timing
- Child sequence (all in the child transcript): continue_work yield (nonce reason) < `[continuation:wake]` user row < request_compaction call. `wakeTurnBound` requires `wakeIndex > yieldIndex && callIndex > wakeIndex` (lib/request-compaction-receipt.js:218-221). yieldBound ≡ wakeTurnBound (:221).
- Template asks for continue_work delaySeconds=5 (manifests/r-rc-2.json:33). Delegate delaySeconds = manifest 1 (manifests/r-rc-2.json:31; default 1), so the delegate takes the timer path and emits dispatch+fire (scenarios/r-rc-2-delegate-request-compaction.js:273-277).
- Timers: sessions.send 500 ms after subscribe (:255,288); observer.poll at 10, 30, 60, 90 s only (:289-291); socket close 120 s (:292); k6 maxDuration 150 s (:62); first child history 250 ms after binding (:232); re-reads every 2,000 ms (:372,426,440,442); preflight timeout 10 s (:312).
- Report window: the threshold/accepted report must sit after the bound toolResult and before the next user row (same wake turn) (lib/request-compaction-receipt.js:293-306).

### 3. Telemetry
- Hashed string: `childTask = renderRowTaskTemplate(manifest promptTemplate, nonce)` (scenarios/r-rc-2-delegate-request-compaction.js:263). `reason_hash = sha256(childTask)[0:16]`, `reason_length = childTask.length`, `delegate_mode = inv.mode || 'normal'` (manifest 'normal') (:270-272). The collector re-renders the template (only {{nonce}}/{{nonceSuffix16}}) and cross-checks (scripts/collect-continuation-trace.mjs:185-196).
- Fidelity hazard: the instruction embeds `task="${childTask}"` unescaped, and childTask contains literal `"` around the reason values (scenarios/r-rc-2-delegate-request-compaction.js:280; manifests/r-rc-2.json:33). The product span hash matches only if the agent passes those exact bytes.
- Collector contract (delegate, mode normal): one `continuation.delegate.dispatch` and one `continuation.delegate.fire` sharing `chain.id`, with `reason.hash`, `reason.length` and `delegate.mode="normal"`, status OK. One `openclaw.tool.execution` `gen_ai.tool.name="continue_delegate"` in the causal window from a positive `fire.deferred_ms`/`delay.ms`, on one trace (scripts/collect-continuation-trace.mjs:141-155,255-261,288-322,448-530).
- The child's own continue_work and request_compaction spans are not checked. `continuation.compaction.released` is listed in manifest expectedTelemetry but checked by neither the scenario nor the collector.
- Manifest attribute key `continuation.chain.id` (manifests/r-rc-2.json:132) vs collector `chain.id` (scripts/collect-continuation-trace.mjs:462,470). Manifest also lists `signal.kind`, `continuation.compaction.context_ratio` (manifests/r-rc-2.json:139,154); neither is checked anywhere in these files.
- Trace never affects the verdict. Collector: see COMMON C-TRACE.

### 4. Product source citations (verbatim)
- scenarios/r-rc-2-delegate-request-compaction.js:6-7 `openclaw 41b8d69b90 request-compaction-tool.ts:211-217`; :247 `core-descriptors.ts:383` (sessions.get advertise:false); :275 `delegate-dispatch.ts:358-359, 383-407` (delay>0 → dispatch+fire; delay 0 → dispatch only).
- lib/request-compaction-receipt.js:124 `openclaw cut 41b8d69b90`; :126 `src/agents/command/session-store.ts:168-182 via post-run.ts:266`; :129 `src/agents/command/attempt-execution.continuation.ts:82-88`; :132 `src/agents/tools/request-compaction-tool.ts:211-217` (unknown branch); :134 `request-compaction-tool.ts:219-229; MIN_CONTEXT_THRESHOLD = 0.7 at :26`; :135 `(:338-348)` accepted; :138-139 `tool-results.ts:10-11`, `chat-display-projection sanitize.ts:441-460`; :142-144 `openclaw 41b8d69b90 request-compaction-tool.ts: ... (:211-229, also rate_limit :236-247) ... (:338-348)`; :186 `openclaw 41b8d69b90 work-dispatch-execution.ts:197-215, sent as the turn Body at :365-372`; :208 `work-dispatch-execution.ts:540-545`; :239 `request-compaction-tool.ts:211-217`; :253-255 `openclaw 41b8d69b90`, `chat-display-projection.history.ts:329-334`.
- Cross-lib inconsistency: request-compaction-tool.ts line ranges at 41b8d69b90 (lib/request-compaction-receipt.js: unknown :211-217, measured :219-229, accepted :338-348) differ from those at f15237ec92 (lib/r-cd-3-lifeboat.mjs:11-17: unknown :236-243, measured :244-255, accepted :377-387). Neither SHA is the candidate 51ff02dc16.
- manifests/r-rc-2.json:26 `openclaw 41b8d69b90 request-compaction-tool.ts:211-217; turn-end persistence session-store.ts:168-182`; :88 reportCommit `39803b297bd4786db3971eb82a3a7fd0b29bc643`; :89 productBasis `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955`.

### 5. Verdict paths (lib/request-compaction-receipt.js:354-406 → failClosedVerdict at scenarios/r-rc-2-delegate-request-compaction.js:496 → run-proofs.sh policy)
- PARTIAL first: preflight not ok, observer refused/incomplete, child identity conflict (lib/request-compaction-receipt.js:359-372; lib/child-observer.mjs:160-174).
- PASS-candidate: parent dispatch accepted + delegate requested + receiptBase (child bound, toolResult observed, invocation bound, yield + wake bound) + status `compaction_requested` + `request_compaction_accepted` + child report observed + `post_compaction_path_observed` (:373-379,385-393). Re-checked field by field by scripts/run-proofs.sh:1274-1296 (status must equal "compaction_requested"); fails down to PARTIAL.
- HONEST-LIMIT-candidate: receiptBase + status `rejected` + guard `context_threshold` + measured (`contextUsage < threshold`) + child `REQUEST_COMPACTION_REJECTED_CONTEXT_THRESHOLD` report (:380-384,389-390,394). The reported CONTEXT/THRESHOLD numbers are recorded but not compared to the receipt (scenarios/r-rc-2-delegate-request-compaction.js:394-395). Re-checked by scripts/run-proofs.sh:1244-1273; only R-RC-2 may hold HONEST-LIMIT (:1245-1246).
- PARTIAL: any partial evidence, such as context_unknown (explicit reason :400-401), a receipt without the yield/wake turn (:402-403), a report without a receipt, or an accepted receipt without the post-compaction report (:395-398,405). The scenario also adds a failure for PARTIAL-with-reason (scenarios/r-rc-2-delegate-request-compaction.js:499).
- FAIL-candidate: no partial evidence at all, e.g. the child never reached request_compaction (lib/request-compaction-receipt.js:405). The manual postprocessor maps FAIL → PARTIAL (scripts/postprocess-k6-summary.mjs:125-133).
- handleSummary: summaryRrc2Verdict → PARTIAL unless the VU verdict equals the reclassification (lib/request-compaction-receipt.js:415-419).

## R-CONFIG-DEFAULTS — scenarios/r-config-defaults.js (manifests/r-config-defaults.json)

### 1. Product strings/fields matched literally
- Gateway RPC `config.get` with params `{}`, sent 300 ms after the connect frame (scenarios/r-config-defaults.js:61-64). Response read as `classified.payload` (:72-76).
- Path `payload.config.agents.defaults.continuation` must be an object (:25-27), with these keys:
  - `enabled`: `typeof === 'boolean'` (:28, 32).
  - `maxChainLength`: `Number.isFinite` (:29, 32).
  - `maxDelegatesPerTurn`: `Number.isFinite` (:30, 33).
  - `costCapTokens`: `Number.isFinite` (:31, 33).
- No expected values are asserted; any boolean and any finite numbers pass (:32-34, 77-83). The row therefore depends on `config.get` returning these four keys explicitly in `payload.config`. Whether that is the raw file or the resolved config with schema defaults applied is the product question. If config.get returns only user-written keys, an unset default makes the row PARTIAL.
- `classified.ok` is recorded but not gated. A non-ok response with a payload that carries the keys would still pass (:73-83).

### 2. Ordering/timing
- Socket closes at 15000 ms (:64). k6 maxDuration is 45s (:17).

### 3. Telemetry
- None. `invocation: null`, read-only. `correlation.service = "<seat>-prince"` is only recorded (:55).

### 4. Product source citations verbatim
- None.

### 5. Verdict paths
- The VU log prints `PASS-candidate` if `config_read`, else `PARTIAL-candidate` (:103). handleSummary prints PASS-candidate if failures == 0, else PARTIAL-candidate (:106-108).
- No FAIL path. A missing key, a wrong type, a parse error, a ws error or no token all give PARTIAL (:41, 83, 85, 87, 99).

## R-CONFIG-INTERSESSION — scenarios/r-config-intersession.js (manifests/r-config-intersession.json)

### 1. Product strings/fields matched literally
- Gateway RPC `config.get {}` at +300 ms (scenarios/r-config-intersession.js:54-57).
- `payload.config.agents.defaults.continuation.crossSessionTargeting` must be strictly the string `'enabled'` (:23-29). Any other value (`"disabled"`, `true`, absent) is treated as not observed (:25-28, 68-73).
- `classified.ok` is not gated (:66-73).

### 2. Ordering/timing
- Socket closes at 15000 ms (:57). k6 maxDuration is 45s (:15).

### 3. Telemetry
- None.

### 4. Product source citations verbatim
- None. The manifest description names the key `agents.defaults.continuation.crossSessionTargeting` (manifests/r-config-intersession.json:30).

### 5. Verdict paths
- PASS-candidate if the value is `'enabled'`, else PARTIAL-candidate (:93, 96-98).
- No FAIL path. This is a seat-config fact, not a product default: it passes only if the seat's config sets the value to `enabled` (or the product's resolved config defaults it to `enabled`).

## R-OBS-STATUS — scenarios/r-obs-status.js (manifests/r-obs-status.json)

### 1. Product strings/fields matched literally
- Source file: `src/status/status-continuation-line.ts` in `karmaterminal/openclaw` (manifests/r-obs-status.json:18-21; scenario defaults :64-69). The runner fetches it from `https://raw.githubusercontent.com/<repo>/<OPENCLAW_CANDIDATE_SHA>/<path>` and passes it in `OPENCLAW_STATUS_SOURCE_PATH` (scripts/run-proofs.sh:1126-1142; scenario :40-41).
- Required bytes in that file:
  - A line-start declaration `export function formatStatusTextContinuationLine(`, matched by `^export\s+function\s+formatStatusTextContinuationLine(?=\s*\()` with flag `m` (lib/source-function-extractor.js:12-19; scenario :50-54).
  - The text ending at the body's opening brace must be exactly `}): string | undefined {`. This means a destructured or object-typed parameter list ending in `})`, the return type `string | undefined`, and single spaces (scenario :42; lib/source-function-extractor.js:36-46).
  - The body is extracted by brace balancing and run as JavaScript through `new Function('params', "'use strict';\n" + body)` (scenario :49-60; lib/source-function-extractor.js:48-103).
  - The body must therefore be plain JS with no TypeScript-only syntax (type annotations, `as`, generics, `satisfies`). It must not reference any import, outer constant or helper; it may use only `params` and globals. Otherwise it throws, and the row is BAD_PROOF (:139-141).
  - Destructured parameter names are not available to the body. It runs as `function(params)`, so the body must read the fields from `params`.
- Contract cases (:116-137):
  - `{maxChainLength: 8, chainCount: 0, pending: 0, staged: 0, volitional: 0}` must return `undefined` (strict `===`).
  - `{maxChainLength: 8, chainCount: 1, pending: 0, staged: 0, volitional: 0}` must return exactly `'🔄 Continuation: chain 1/8'` (U+1F504, a space, `Continuation: chain 1/8`, no trailing text).

### 2. Ordering/timing
- No gateway. k6 maxDuration is 30s (:28). The candidate SHA must match `^[0-9a-f]{40}$` (:86-89).

### 3. Telemetry
- None. `invocation: null` and toolSurface `source-status-formatter` (manifest :10).

### 4. Product source citations verbatim
- `src/status/status-continuation-line.ts` (manifests/r-obs-status.json:20; scenario :66).
- Function `formatStatusTextContinuationLine` with signature end `}): string | undefined {` (scenario :42, 52-53).
- Issue `#1172` (manifest :22).

### 5. Verdict paths
- PASS-candidate when failures == 0. Any failure gives `BAD_PROOF`, never FAIL or PARTIAL (:157-170).
- A failure is added by:
  - a non-40-hex SHA (:86-89);
  - manifest validation errors (:90-96);
  - missing prefetched source (:106-107);
  - an extraction or execution throw (:139-141);
  - the clean case returning anything but `undefined` (:133-135);
  - the active case not equal to the exact string (:136-138).
- This is a source contract, not runtime behaviour. The deployed gateway is never touched.

## READ-ONLY / STATIC ROWS (no gateway connection; nothing is checked at the live candidate SHA)

`PROOFS/INDEX.json` at docs 9ba5518b: `current_sha = e821503d0764d72b0d53a17e329b1efe9446690a` and `static_evidence_sha = 1cc8f4e3d617ef6f173283ef83d7b739a4995734`. Every static row below reads `PROOFS/<static_evidence_sha || current_sha>/<ROW>/...`, so it reads `PROOFS/1cc8f4e3…/`, not the candidate 51ff02dc. All verdicts are PASS-candidate or FAIL-candidate. `OPENCLAW_CANDIDATE_SHA` is only echoed into evidence.

- **R-CD-RETURN-OVERLAP** (scenarios/r-cd-return-overlap.js):
  - Reads these files under `PROOFS/1cc8f4e3…/R-CD-RETURN-OVERLAP/cael-dgx/` (:27-35): `EVIDENCE.md`, `db/flow-rows-concise.json`, `db/task-rows-concise.json`, `journal/journal-filtered.log`, `tempo/trace-0d676f84623ebfe6499a324d039ee050-summary.json`.
  - Fixed markers: `RCD_RETURN_OVERLAP_BCA2B0B_CAEL_20260704_1521_{SILENT,WAKING}_RETURN` (:36-37).
  - Both must bind through `markerReturn`, from two different writer sessions (:52-53, 65). `markerReturn` works on journal lines of the forms:
    - `<marker> session=<k> run=<r>`, or `<marker>` followed by a `session: <k>` line;
    - a later `[continuation:targeted-return] Delivered to <targets> from <writer>`;
    - with the writer not named as `session=` on any earlier `[continuation:delegate-spawned]` line, and not a return target (lib/journal-return-binding.mjs:32-35, 53-118).
  - Its other checks are substring checks on EVIDENCE prose and the flow JSON: `"silentWake":true` / `silentWake=true`, `"silentWake":null` (:61-69).
  - Nothing is live, and nothing is checked at the candidate. The lib notes "no F' writer of these shapes exists" (lib/journal-return-binding.mjs:14-18).
- **R-OBS-2** (scenarios/r-obs-2.js):
  - Reads `PROOFS/1cc8f4e3…/R-OBS-2/cael-dgx/{trace-tree.json, span-counts.json, span-tree.txt}` (:21-27).
  - It requires all of:
    - `traceIdsHex` non-empty;
    - `spanCount` > 0;
    - `rootCount` ≥ 1;
    - `orphanCount === 0`;
    - span names `continuation.delegate.dispatch`, `openclaw.harness.run`, `openclaw.run`, `openclaw.tool.execution`, `continuation.queue.fanout` and `continuation.queue.drain`, each found in span-tree.txt or `spanNameCounts` (:35-42).
  - A pinned capture only; nothing is checked at the candidate.
- **R-REGRESSION-TRAP-TESTS** (scenarios/r-regression-trap-tests.js):
  - Reads `PROOFS/1cc8f4e3…/R-REGRESSION-TRAP-TESTS/cael-dgx/{EVIDENCE.md, regression-trap.log, source-git-status.txt, test-inventory.txt}` (:21-29).
  - It requires all of:
    - `Verdict: ✅ PASS` or `Verdict: PASS` in EVIDENCE;
    - `[test] passed 2 Vitest shards` in the log;
    - `31/31 PASS`, or the log has both `5 passed` and `26 passed`;
    - the 40-hex SHA from source-git-status.txt appears in EVIDENCE;
    - four test paths named somewhere: `src/agents/tools/continuation-inventory-opts.test.ts`, `src/agents/openclaw-tools.continuation-registration.test.ts`, `src/agents/tools/continuation-tools-registration.test.ts`, `src/agents/openclaw-tools.continuation-misconfig-warn.test.ts` (:38-56).
  - No test is run, and the candidate SHA is not checked. The source SHA is whatever the pinned capture recorded.
- **R-TRACE-REDACTION-1121** (scenarios/r-trace-redaction-1121.js):
  - Reads only `PROOFS/1cc8f4e3…/R-TRACE-REDACTION-1121/EVIDENCE.md` (:20-24). The path has no `cael-dgx/` segment.
  - It requires these substrings:
    - `# R-TRACE-REDACTION-1121` and `PASS`;
    - `reason.present`, `reason.length`, `reason.hash`, `reason.redacted`;
    - ``No `reason.preview` field exists`` or ``asserts no `reason.preview` ``;
    - `asserts no attribute value contains the raw reason`;
    - `src/infra/continuation-tracer.test.ts (88 tests) passed`;
    - `src/infra/continuation-tracer.ts` (:39-44).
  - Prose only. Nothing is checked at the candidate.

### static-corpus-row-validator.js rows
- Common mechanics (scenarios/static-corpus-row-validator.js):
  - `sourceEvidenceSha = index.static_evidence_sha || current_sha`, unless the manifest has a `preflightAttachment` (:33-37). None of the six rows below has one (each manifest's `.preflightAttachment` is null). The exact-candidate binding (`exactCandidateBinding`, `materialNamesCandidate`) applies only to R-CW-5A/6A (:53-56, 76-93, 329-332).
  - Root: `PROOFS/<sourceEvidenceSha>/<row>/cael-dgx` (:41). Missing files read as `''` (:42), so a missing file only fails the checks that need it.
  - Verdict: `liveRunSafety.expectedArtifactClass` (PASS-candidate for all six) if every check is true, else FAIL-candidate (:343, 361-364, 376-377).
  - None of the six checks anything at the live candidate SHA.
- **R-CD-COLLECTION-ON-COLLAPSE** (:133-143, 239-261):
  - Reads `PROOFS/1cc8f4e3…/R-CD-COLLECTION-ON-COLLAPSE/cael-dgx/{EVIDENCE.md, evaluation.json, db/flow-rows-concise.json, db/task-rows-concise.json, main/root-collection-receipt.md, journal/filtered.log, tempo/trace-summary.json}`.
  - Fixed sentinel `RCD_COLLECTION_BCA2B0B_CAEL_20260704_1316_C_REACHED_AFTER_B_FINAL`. It must have a journal writer, and a `[continuation:targeted-return]` from that writer to a target that is neither its `[continuation:delegate-spawned]` dispatcher nor itself (:242-255).
  - Substrings checked:
    - `core/continuation-delegate` in flow rows;
    - `succeeded` in task rows;
    - prose `A→B→delayed-C`, `B finalized before C`, ``typed `continue_delegate` ``, `delaySeconds`, `fanoutMode`;
    - trace id `ecda443e0038fb9a38fc33a8b98d7d02` or `continuation.delegate` (:246-258).
  - Its manifest tool is `continue_delegate` (mode silent-wake), so traceRequirement makes it owe `tempo-trace-json` and `continuation-trace-correlation`. The static validator fires nothing, so those stay pending on every run (lib/continuation-trace-requirement.mjs:93-116; manifests/r-cd-collection-on-collapse.json requiredReceipts).
- **R-CW-7** (:96-103, 178-191):
  - Reads `PROOFS/1cc8f4e3…/R-CW-7/cael-dgx/{EVIDENCE.md, test/focused-traceparent-tests.log, source/source-snippets.md, source/source-sha.txt}`.
  - Substrings checked:
    - `x-openclaw-internal` in the snippets;
    - prose such as `auto-picks the active runtime trace context`, `threads persisted traceparent`, `forwards inherited traceparent`;
    - `passed 3 Vitest shards` or `142 passed / 0 failed`.
  - The source-sha check compares against `sourceEvidenceSha` (= 1cc8f4e3…), not the candidate (:188).
- **R-CW-DELEGATE-CHILD-LIVE** (:104-113, 193-206):
  - Reads `PROOFS/1cc8f4e3…/R-CW-DELEGATE-CHILD-LIVE/cael-dgx/{EVIDENCE.md, hop1.txt, hop2.txt, verifier-receipt.txt, flow-runs.json, tempo-attribute-receipt.txt}`.
  - Substrings checked:
    - `HOP1-WROTE-BEFORE-CONTINUE_WORK`;
    - `hop2-EXECUTED after child continuation wake`;
    - `hop1_exists=yes` and `hop2_exists=yes`;
    - `continuation.delegate.dispatch` and `delegate.mode=normal`;
    - `continuation.work.fire` and `delay.ms=5000`;
    - `continuation_work` or `continuation-work` in flow.
- **R-CW-DELEGATE-TOKEN** (:114-122, 208-221):
  - Reads `PROOFS/1cc8f4e3…/R-CW-DELEGATE-TOKEN/cael-dgx/{EVIDENCE.md, child-transcript-tool-audit.md, journal-continuation-excerpt.log, flow-runs-matching-full.jsonl, tempo-child-tool-audit.txt}`.
  - Substrings checked:
    - `CONTINUE_WORK:5` in EVIDENCE and in the child audit;
    - `origin=bracket kind=work`;
    - a no-typed-tool phrase;
    - `Real second child turn` and ``Disposition: `granted` ``;
    - `core/continuation-work`, `status`, `succeeded`;
    - `continuation.work` or `continuation.work.fire`.
- **R-CW-MULTI-COLLAPSE** (:144-156, 263-277):
  - Reads `PROOFS/1cc8f4e3…/R-CW-MULTI-COLLAPSE/cael-dgx/{EVIDENCE.md, insert-vars.json, post-insert-sqlite.txt, final-terminal-sqlite.txt, final-queued-running.txt, flow-runs-final.json, journal-continuation-window.txt, restore-verified-sha256.txt, tempo-attribute-receipt.txt}`.
  - Substrings checked:
    - `OLD_STALE`, `NEWEST should drive`;
    - `superseded` and journal `continuation:work-superseded`;
    - `Same-session continuation turn granted`;
    - flow `disposition` and `granted`;
    - empty final-queued file;
    - ≥2 restore hash lines;
    - chain id `29fa6c15-2dc9-409f-bf48-138e73667da5` and `continuation.work.fire`.
- **R-CW-MULTI** (:123-132, 223-236):
  - Reads `PROOFS/1cc8f4e3…/R-CW-MULTI/cael-dgx/{EVIDENCE.md, source-tool-receipts.jsonl, flow-runs-final.json, journal-continuation-lines.txt, wake-and-folded-receipts.txt, tempo/trace-summary.jsonl}`.
  - Checks:
    - ≥3 `"status":"scheduled"` in the tool receipts;
    - flow `disposition` and `granted`;
    - ≥2 `folded-active`;
    - journal `continuation:work-folded-active`;
    - ≥3 `continuation.work` in the trace summary.
- Product strings these pinned captures embed, which a reader may want to compare with the candidate's current log and label vocabulary (these are capture bytes, not live checks):
  - `[continuation:targeted-return] Delivered to … from …`, `[continuation:delegate-spawned] … session=`;
  - `continuation:work-superseded`, `continuation:work-folded-active`;
  - `origin=bracket kind=work`;
  - flow kinds `core/continuation-delegate` and `core/continuation-work`;
  - `"status":"scheduled"`, `delay.ms=5000`, `delegate.mode=normal`.
