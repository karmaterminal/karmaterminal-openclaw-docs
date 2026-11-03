# Independent review: harness sentinel-echo fixes (docs `ed28bb0e..3283454d`)

Bound issue: karmaterminal/openclaw-bootstrap#1727. Reviewer lane: `codeagent/harness-review`.

This is a review only. It changes no scenario, library, manifest or corpus file, and nothing was
fired. The only code it adds is the failing tests named under each finding
(`tools/k6-proofs/tests/review-*.test.mjs`). Every finding comes from the code under review and
from product source at F′, read with `git show` / `git grep`.

## Verdict: changes required

The fixes do what the audit asked. Every one of the 14 rows now binds its verdict to product
records, and none of the 14 original echo shapes survives. All 14 have an echo test and a
true-record test, and the sampled echo tests fail on the pre-fix tree for the intended reason.

Five gaps remain where a value the requester or its child emits can still produce
`PASS-candidate`. Each one is shown by a failing test:

- **F1:** a typed call made through Tool Search's `dispatch_action` is invisible to the
  token-form checks (R-CD-MODEL-TOKEN, R-CW-TOKEN).
- **F2:** a token the requester writes into its own call passes as "child-minted"
  (R-CD-SILENT, and the R-CW-TOKEN live path).
- **F3:** the R-CW-TOKEN live path judges only part of the child transcript, so a typed call
  persisted before the subscription goes unseen.
- **F4:** the R-CD-3 lifeboat prefix is checked by inclusion, not by position.
- **F5:** a missing dispatch run id switches off the run exclusion that guards a prompt-only
  ack (R-CD-CHAINED-DEPTH-2). This is latent at F′.

F1 is the most consequential. It defeats the token-form rows' discriminating check in exactly
the fallback that check exists to catch.

Two R-CD-3 fill-safety findings (F6, F7) and a set of nits yield no false PASS.

## Named refs

| Category | Ref | Full SHA | Equality |
| --- | --- | --- | --- |
| Product: facts read only, never checked out | `karmaterminal/openclaw` F′ | `f15237ec921879d918482cdf372b0718d4c1aab9` | object present in the seat clone `~/flesh_beast_best_beast/source/openclaw` |
| Under review | docs `codeagent/harness-sentinel-audit`: audit `ed28bb0e`, fixes `fb48f7f2..3283454d` | `3283454de601a678d7bc0b328df8520852ad1531` | local = `origin` (ls-remote) |
| Base | docs `main` at the fork point | `7ac3e7b806b3f792c80327ca491743481f74725b` | merge-base of the head and `origin/main`. `origin/main` has since moved to `8628828b` with two corpus-only commits |
| Lane (this review) | docs `codeagent/harness-review` | published unchanged at `3283454d` before any evidence, then review commits only | local = tracking = `origin` at every push |
| CI / workflow | N/A | — | docs checks and `node --test` run locally; Mode-B targets the product repo, not this one |
| Presentation | N/A | — | no PR (workorder) |
| Docs / proof | `PROOFS/f15237ec921879d918482cdf372b0718d4c1aab9/`; `PROOFS/INDEX.json` (static evidence `1cc8f4e3d617ef6f173283ef83d7b739a4995734`) | unchanged in `7ac3e7b8..3283454d` | read only |

## Findings, by severity

### F1 (medium-high, false PASS): typed calls through `dispatch_action` evade the token-form checks

- **Where.**
  - `scenarios/r-cd-model-token.js:36-41` (`typedContinueDelegate`) and `:34`
    (`CONTINUATION_DELEGATE_TASK_PREFIX`).
  - `lib/continue-work-chain.mjs:116-121` (`typedContinueWork`) and `:139`.
- **Product facts at F′.**
  - With Tool Search on, only `message` stays a direct tool (`src/agents/tool-surface-plan.ts:145-150`).
  - Every other call is recorded under the raw dispatcher name `dispatch_action`, with arguments
    `{ id: "<tool>", args }` (`src/agents/tool-catalog.ts:29`).
  - `src/agents/tool-display-call.ts:5-13` unwraps that name for display only, "without changing
    invocation identity". R-CD-2's and R-CD-4's own prompts at F′ tell the agent to reach
    `continue_delegate` exactly this way.
  - The typed `continue_delegate` path writes the same task prefix as the bracket path,
    `[continuation:chain-hop:N] Delegated task (turn N/M): <task>`
    (`src/auto-reply/continuation/delegate-dispatch-request.ts:43`). The bracket path enqueues into
    the same composer.
  - So the prefix proves "continuation dispatch, typed or bracket". It does not prove the token
    form.
- **Concrete input.**
  - R-CD-MODEL-TOKEN: hop-1's transcript has
    `{type:"toolCall", name:"dispatch_action", arguments:{id:"continue_delegate", args:{task, model}}}`
    and then `MODEL-TOKEN-HOP1 <nonce>` in its text. The delegate's task is
    `[continuation:chain-hop:2] Delegated task (turn 2/10): …`, and it serves the requested model.
    Result: `bracket_token_observed: true`, **`PASS-candidate`**.
  - R-CW-TOKEN: the child's transcript has a `dispatch_action {id:"continue_work"}` call, then a
    `[continuation:wake]` row, then a minted hop-2 token. Result: **`PASS-candidate`**.
- **Test.** `tests/review-typed-call-via-dispatch-action.test.mjs`. Both defect cases fail at
  `3283454d`. The by-name controls pass.
- **Fix shape.**
  - Treat `dispatch_action` / `tool_call` with `arguments.id` naming the tool as that tool, in
    every toolCall matcher (`sentinel-binding.mjs:141` `toolNameMatches` and the two local copies).
  - Stop citing the chain-hop prefix as token-form evidence.

### F2 (medium, false PASS): a token the requester writes into its own call passes as "child-minted"

- **Where.**
  - `scenarios/r-cd-silent.js:98-110` (`onChildChat`). The token is checked only against
    `sentTexts`, which holds the harness task, the instruction and the follow-up.
  - `scenarios/r-cw-token-bracket.js:183,188-189,367-369` and `lib/sentinel-binding.mjs:265-291`
    (`mintedTokenFromHistory`, applied on the live path).
- **Mechanism.**
  - The requester can pass the child a task that differs from the harness template, for example
    `<your token>` replaced by `q1w2e3r4t5y6`. The child repeats it, and the requester "reproduces"
    it later from its own memory of the call. That is the original R-CD-SILENT defect, reached
    through the requester's arguments instead of the harness template.
  - R-CD-SILENT never reads the child transcript. The requester's actual `continue_delegate` task
    is in hand (`receipt.args.task` from `createToolReceiptTracker`) but is never consulted.
  - R-CW-TOKEN's live rows start at the subscription, which opens only after the `sessions_spawn`
    toolResult. So the child's spawn-task row, which carries the requester's task, is not in
    `childRows`.
  - `evaluateChild` returns as soon as `hop_2_executed` is set, so the later `chat.history` read
    (which does hold that row) cannot veto it.
- **Contrast.** R-CD-1 and R-CD-3 read the child's own transcript. At F′ its first user row is the
  bare task as the requester actually sent it, because display stripping removes only the
  protected blocks (`src/agents/internal-runtime-context.ts`,
  `src/auto-reply/reply/user-envelope-display.ts`). There the same token is refused.
- **Concrete input.** The requester's call carries `task: "… reply exactly SILENTCHILD <nonce> TOKEN q1w2e3r4t5y6 …"`.
  - R-CD-SILENT: the child's `chat` final says `SILENTCHILD <nonce> TOKEN q1w2e3r4t5y6`, and the
    follow-up run says `RCDS-PARENT-OBSERVED <nonce> TOKEN q1w2e3r4t5y6`. Result:
    **`PASS-candidate`**.
  - R-CW-TOKEN is the same shape. Result: **`PASS-candidate`**.
- **Related.** `sessions_spawn context:"fork"` copies the requester's whole visible branch,
  assistant rows included, into the child (`src/config/sessions/session-accessor.sqlite-parent-fork.ts:219-249`).
  R-CW-TOKEN's `tokenWorkHops` scans every child assistant row, so hop 1 could match the
  requester's own text. The spawn receipt's `args.context` is available and fork is never refused.
- **Test.** `tests/review-requester-authored-token.test.mjs`. Both defect cases fail at
  `3283454d`. The true-mint controls pass.
- **Fix shape.**
  - Add every bound requester call's arguments to the texts a minted token must be absent from.
  - Bind R-CW-TOKEN hop 2 only from a read that includes the child's spawn-task row.
  - Refuse `context:"fork"`.

### F3 (low-medium, false PASS): the R-CW-TOKEN live path hides a typed call persisted before the subscription

- **Where.** `scenarios/r-cw-token-bracket.js:183,189,367-369` and
  `lib/continue-work-chain.mjs:139` (`typedToolUsed` is computed over the rows it is given).
- **Mechanism.**
  - If the subscription lands mid-turn (after hop 1's typed `continue_work` call and its result,
    but before hop 1's text), the live path sees hop 1, the wake and hop 2, and no typed call.
  - Hop 2 binds, and the full `chat.history` read can no longer veto it.
  - The race is narrow, because the child's first model call usually takes longer than the
    subscription. But the token form is the row's whole claim.
- **Concrete input.** A child transcript of
  `[spawn task, toolCall continue_work, toolResult scheduled, "TOKEN-HOP1 <n>", "[continuation:wake] …", "TOKEN-HOP2-DONE <n> TOKEN h4j5k6l7m8n9"]`,
  with live delivery starting at the third-to-last row. Result: **`PASS-candidate`**.
- **Test.** `tests/review-r-cw-token-live-suffix.test.mjs`. It fails at `3283454d`. The control,
  where the call arrives live, passes.
- **Fix shape.** Use live rows only as a prompt to read. Decide hop 1 and hop 2 from a
  `chat.history` read of the whole transcript.

### F4 (low, false PASS; needs a requester deviation and a failed real release): the lifeboat prefix is checked by inclusion

- **Where.** `lib/r-cd-3-lifeboat.mjs:218-221`, used at `scenarios/r-cd-3-post-compaction.js:435`.
- **Product facts.**
  - A released lifeboat's task starts `[continuation:post-compaction] [continuation:chain-hop:N] Compaction just completed. …`
    (`src/auto-reply/reply/post-compaction-delegate-delivery.ts:499-502`). That string survives
    the `chat.history` display projection.
  - An ordinary typed delegate's task is `[continuation:chain-hop:N] Delegated task (turn N/M): <requester task>`.
  - So a requester that writes `[continuation:post-compaction]` plus the row token into an
    ordinary delegate's task creates a child that passes `isReleasedLifeboatTask`.
  - If the real lifeboat is also released, the observer's ambiguity check makes the row PARTIAL.
    If the release fails (the product failure this row exists to catch), the planted child is the
    only one, and the rest of the chain can bind.
- **Test.** `tests/review-lifeboat-prefix-position.test.mjs`, using the exact product
  compositions. It fails at `3283454d`. The release-composition control passes.
- **Fix shape.**
  - Require the de-enveloped task to start with
    `[continuation:post-compaction] [continuation:chain-hop:`.
  - Refuse a requester call whose arguments carry `[continuation:post-compaction]`.

### F5 (low, fail-closed gap; latent at F′): a missing run id empties every run exclusion

- **Where.**
  - `scenarios/r-cd-chained-depth-2.js:358`: `dispatch_run_id = typeof payload.runId === 'string' ? … : null`.
  - It is passed as `excludeRunIds: [dispatch_run_id]` at `:395,398`.
  - Every consumer runs `filter(Boolean)`: `r-cd-chained-depth-2-authority.mjs:66`,
    `wake-turn-receipt.mjs:161,197`, `sentinel-binding.mjs:108,125,311`,
    `r-cd-4-authority.mjs:74`.
- **Mechanism.**
  - `[null]` excludes nothing. `ROOT-CHAIN-ACK` is a prompt-only sentinel, so the dispatch run
    restating its prompt binds the root return. Missing evidence becomes PASS.
  - The same `[null]` shape sits in R-CD-1, R-CD-3, R-CD-SILENT and R-CW-TOKEN, where the
    minted-token ordering keeps it harmless. It also sits in R-CD-4 when the priming row is
    unstamped.
- **Why latent.** At F′ every `sessions.send` reply carries `runId` = `idempotencyKey`, or a
  `randomUUID()` when none is given (`src/gateway/server-methods/sessions-messaging.ts:152-153`;
  `chat-send-session.ts:225`; `chat-send-input-dispatch.ts:557-574`). Transcript rows of a
  directly started turn are stamped with the same value (see the binding table). So this only
  bites on protocol drift.
- **Test.** `tests/review-missing-dispatch-run.test.mjs`. It fails at `3283454d` with
  **`PASS-candidate`**. The run-id-present control passes. The test opens the 1.5 s wall-clock
  gate with `OPENCLAW_MIN_CHAIN_EVIDENCE_DELAY_MS=0`, as the fixing lane's own echo test does,
  because the virtual runtime does not advance `Date.now()`.
- **Fix shape.** No dispatch (or priming) run id means the run-excluded ack cannot bind.

### F6 (low, safety; latent at F′): the R-CD-3 fill falls back to the configured live session

- **Where.** `scenarios/r-cd-3-post-compaction.js:544`: `sessionKey = classified.payload.key || sessionKey`.
  `sessionKey` starts as `manifest.sessionKey` = `${OPENCLAW_SESSION_KEY:-main}`.
- **Mechanism.**
  - A create acknowledgement without `key` sends the fill (up to 6 turns under a 300k-token
    budget) and then the compaction proof into the live session.
  - At F′ `sessions.create` answers a top-level, canonicalised `key`
    (`src/gateway/server-methods/sessions-create.ts:669-680`), so this is latent.
  - R-CD-TOKEN already refuses a missing or non-distinct created key
    (`scenarios/r-cd-token-bracket-delegate.js:488,563`).
- **Test.** `tests/review-r-cd-3-fill.test.mjs`, first test. It fails at `3283454d`: one fill
  turn goes to `agent:main:main`.
- **Fix shape.** Refuse the run unless the created key is present and differs from the
  configured session.

### F7 (low, safety): the fill can aim past automatic compaction, and its mid-fill detector is drop-only

- **Where.**
  - `lib/r-cd-3-lifeboat.mjs:102-104` (the planner aims at target + 2%, capped at an 85% ceiling).
  - `:28-31` (the comment says "about 90% of a 200k window. The fill stops well below that").
  - `scenarios/r-cd-3-post-compaction.js:280,284-289`.
- **Product facts.**
  - The compaction reserve is max(configured, 20,000), capped at 25% of the window
    (`src/agents/agent-settings.ts:11,29-32`; `src/agents/agent-compaction-constants.ts:2-13`).
  - So the automatic line is window − min(20,000, window/4): 90% of 200k, 84.4% of 128k, and 75%
    of any window up to 80k.
  - The planner's own plan crosses that line for windows below about 87k. The 85% ceiling guards
    nothing below about 133k.
  - Preflight compaction runs when the fresh total plus the new prompt reaches the line
    (`src/auto-reply/reply/agent-runner-memory.ts:112-300`). After such a turn the measured total
    is summary + kept tail + the new filler, which can exceed the previous total.
  - The fill's only compaction detectors are a falling total (`:280`) and a stale total, which
    stops only at the 300 s per-turn timeout (`:286-289`).
  - `sessions.describe` exposes no compaction counter: `compactionCount` is not projected into the
    row (`src/gateway/session-utils-row.ts`).
- **Effect.** No false PASS: the lifeboat is staged only in the proof turn, and its release needs
  the requested compaction. But the claim "it stops if the session compacts mid-fill" does not
  hold in general.
- **Test.** `tests/review-r-cd-3-fill.test.mjs`, second test. It fails at `3283454d`: the 64k
  window plans 49,280 against a line of 48,000, and the 80k window plans 61,600 against 60,000.
- **Fix shape.**
  - Cap the plan below window − min(20,000, window/4) minus a margin, or stop when that is unreachable.
  - Treat a changed `sessionId` on the describe row (it moves when compaction rotates the
    transcript) as a stop signal.

### Nits and functional notes (no false PASS)

- **N1 (functional, medium if seats run Tool Search).** The same name-only matching as F1 makes
  every positive receipt fail closed when the call is recorded as `dispatch_action`.
  - Affected: R-CD-1/3/SILENT scheduled, staging and compaction receipts; R-CW-1..4
    `continueWorkChain`; R-CW-TOKEN and MODEL-TOKEN spawn receipts.
  - Those rows would read PARTIAL on such a seat. R-CD-2's F′ receipt records
    `typedDelegateSuccessSameRun: true`, so the canonical seat appears to have used direct names.
    Confirm the tool surface per seat.
- **N2.** `request_compaction` compares the raw fraction but reports integer percent
  (`src/agents/tools/request-compaction-tool.ts:244-253`).
  - A 69.5–69.99% rejection reports `contextUsage: 70, threshold: 70`.
  - `classifyRequestCompactionReceipt` (`lib/r-cd-3-lifeboat.mjs:184`) then returns `invalid`
    instead of a measured below-threshold rejection. It is still PARTIAL, with the wrong reason.
- **N3.** The fill reads `sessions.describe`. Its numerator equals the tool's, through
  `resolveFreshSessionTotalTokens`. Its denominator does not have to:
  - the row's `contextTokens` passes a provenance check and takes a minimum
    (`src/config/sessions/context-token-provenance.ts:50-108`);
  - the tool uses the raw `entry.contextTokens`
    (`src/auto-reply/reply/agent-runner-post-compaction-release.ts:149-170`).
  - A "reached" fill can therefore meet a measured below-threshold rejection. That is PARTIAL, not
    PASS. Consider aiming higher, or reading the denominator the tool reads.
- **N4.** `sessions.send` carries no `traceId` at F′ (no hit in `src/gateway`). Every
  `classified.payload?.traceId` read from a send reply is always null. This affects telemetry only.
- **N5.** `continueWorkChain` anchors hop 1 at the first user row of the page
  (`lib/continue-work-chain.mjs:79`). In a reused or runner-provisioned session the chain fails
  closed. R-CW-4 skips disposable creation for `:subagent:continuation-` keys, and R-CW-1/2/3
  default to non-disposable. Anchor at the user row that carries the harness marker and the nonce.
- **N6.** At F′ the `[continuation:wake]` row is visible verbatim, so `tokenWorkHops`'s
  other-run fallback (`lib/continue-work-chain.mjs:157-159`) matters only when no wake row exists.
  In that case it credits any second child run as hop 2.
- **N7.** When the wake matures while a different run is active, the product folds it into that
  run as a `[system:continuation-note]`, and no `[continuation:wake]` row appears
  (`src/auto-reply/continuation/work-dispatch.ts:614-640`). The CW rows then fail closed. This
  should be documented as an expected PARTIAL cause.
- **N8.** `scripts/recover-session-receipts.mjs` runs `tokenWorkHops` for R-CW-TOKEN on whatever
  transcript it is given. On a parent transcript, the parent restating the child's hop-2 output
  can mark `hop-2-executed` present. `parent-return` is always missing, so recovery cannot reach
  PASS.
- **N9.** An agent can `sessions_send` to its own session (`src/agents/tools/sessions-send-tool.a2a.ts:115-125`).
  The `[continuation:wake]` binding assumes the agent cannot author a visible user row.
  Agent-mediated inter-session rows appear to be persisted `display:false`. I did not establish
  this for self-sends, and nothing was probed.
- **N10.** R-CD-MODEL-TOKEN stops reading hop-1's transcript once `MODEL-TOKEN-HOP1` binds
  (`scenarios/r-cd-model-token.js:147-157`). A typed call persisted later in that turn is never
  seen. The race is narrow; F1's fix should also re-read after hop-1 ends.
- **N11.** `OPENCLAW_CREATE_DISPOSABLE_SESSION=false` alone does not disable R-CD-3's disposable
  session. The plural variable defaults to true (`scenarios/r-cd-3-post-compaction.js:111`).
  That is the safe direction, but the refusal message and the manifest notes name the variable
  that does not control it.

## Step 1: echo vectors that remain, by row

"Requester-emitted" covers the requester's tool arguments, its outbound text and thinking, its
echo of a task, and prompt or harness echoes.

| Row | Verdict-bearing observation now | Source | Remaining requester-emitted vector |
| --- | --- | --- | --- |
| R-CD-1 | scheduled: `continue_delegate` toolResult `scheduled` by toolCallId, plus parent text; child token minted in the child's own transcript; a parent run other than dispatch reproduces it, not before the token | product rows | none found (the child's spawn-task row refuses a requester token; the mirrored completion row has no run id) |
| R-CD-3 | staging and compaction toolResults by toolCallId; lifeboat child (spawnedBy plus prefix plus token); minted token in its own transcript; requester reproduction outside the proof and fill runs | product rows | F4 (prefix by inclusion, needs a requester deviation) |
| R-CD-4 | target ack in a stamped run other than the priming run, after the priming reply | product rows | none found (F5 shape latent if the priming row were unstamped) |
| R-CD-CHAINED-DEPTH-2 | hop sentinels from each lineage-bound hop's own transcript; root ack outside the dispatch run | product rows | F5 (latent at F′) |
| R-CD-MODEL-TOKEN | spawn receipt or observer-bound hop-1; token form = hop-1 turn plus no typed call plus chain-hop prefix; model from the served receipt | product rows | **F1**; N10 |
| R-CD-SILENT | scheduled receipt plus text; child `chat` final mint (spawnedBy); follow-up run reproduces it | product rows | **F2** |
| R-CW-1/2/3/4 | `continueWorkChain` turn order: call → `scheduled` result → sentinel → `[continuation:wake]` row → woken answer | product rows | none found (N9 not established) |
| R-CW-TOKEN | spawn receipt → childSessionKey; child hop 1 / wake / minted hop 2; no typed call; parent reproduction | product rows | **F1**, **F2** (live path), **F3** |
| R-RC-2 | every child report from the child's own transcript after the bound toolResult | product rows | none found |
| R-CD-RETURN-OVERLAP (offline) | each marker → writer session → that writer's targeted-return line; distinct writers | committed journal | none found (see the journal row in step 2) |
| R-CD-COLLECTION-ON-COLLAPSE (offline) | C's marker writer → targeted return from C to a target other than its dispatcher | committed journal | none found |

Observation-level only: R-CD-MODEL-TOKEN's `return_payload` is still read from any parent-stream
event. Its `<provider/model>` placeholder is the only guard (a thinking restatement with a
concrete id would match). The row stays safe because PASS needs the served receipt from the
delegate's own transcript (`lib/model-identity.mjs:206-210`).

## Step 2: is each binding real at F′?

| Binding | Product record, shape and path at F′ | Guaranteed? |
| --- | --- | --- |
| toolCall ↔ toolResult by `toolCallId` | `chat.history` and `session.message` keep `toolCall` parts with `id`, `name` and full `arguments` (`src/gateway/chat-display-projection.sanitize.ts:182-183,227-243`). toolResult rows keep `toolCallId`, `toolName`, `isError` and the content text, with an exact-prefix cap of 8000 by default. `details` is mostly dropped (sanitize.ts:479-522). The content is `JSON.stringify(payload, null, 2)` (`src/agents/tools/tool-results.ts:10-12`) | yes, **but** with Tool Search on, the call's name is `dispatch_action` and the tool is in `arguments.id` (F1, N1) |
| Result statuses | `continue_work` → `{"status":"scheduled",…}` (`continue-work-tool.ts:102-110`). `continue_delegate` → `scheduled`, or `queued-for-compaction` with `mode:"post-compaction"`; the task is never echoed (`continue-delegate-tool.ts:405-449`). `request_compaction` accepted → `compaction_requested` with integer-percent `contextUsage`; unknown → no `contextUsage`/`threshold`; below → both (`request-compaction-tool.ts:226-273,377-387`). `sessions_spawn` → `accepted` with `childSessionKey` (`subagents/spawn/subagent-spawn.ts:673-696`) | yes (N2 rounding) |
| Run stamp `__openclaw.runId` | Stamped on assistant and toolResult rows only (`src/sessions/transcript-events.ts:41-57`) and kept by `chat.history`. On the direct path it equals the `sessions.send` `runId` = `idempotencyKey` (`sessions-messaging.ts:152-153` → `chat-send-session.ts:225` → … → `attempt-session-prepare.ts:627`). Product-started runs get fresh ids: a wake gets a random UUID, and a delegate return waking the requester gets `announce:…`, never the scheduling run's id | yes on the direct path. A steered or collected input's rows carry the active or newest run's id, which fails closed |
| Assistant text in the expected session | `session.message` carries top-level `sessionKey` (and a `session` object, which `eventSessionKey` ignores) (`session-transcript-message.ts:139-149`) | yes. **But** a direct subagent-completion delivery writes the child's text into the requester's transcript as an **assistant** row (`src/sessions/background-session-result.ts:134-149`). It is visible and carries **no run id**. Every binding that requires a run excludes it; markers also differ between child and parent (`CD1-DONE`/`CD1-RETURN`, …). Bindings with `requireRunId:false` are used only in hop transcripts, where no such delivery lands |
| `[continuation:wake]` user row (inferred fact 1) | Built at `src/auto-reply/continuation/work-dispatch-execution.ts:208-226`: it starts with `[continuation:wake] Turn H/M.` and quotes the reason. It is persisted as a role "user" row with no input provenance (`get-reply-run-execute.ts:198,282-285,325-345`). No hide rule matches it, and envelope stripping leaves it alone | source supports it; not live-probed. It is absent when the wake folds into an active run (N7), and that fails closed |
| `spawnedBy` | Observer uses `sessions.list { spawnedBy }` (unchanged). `chat` events carry `spawnedBy` for subagent keys (`src/gateway/server-chat.ts:308-318,686-692`). The lifeboat's `spawnedBy` = the requester (`subagent-spawn-ownership.ts:14-16`) | yes |
| Lifeboat prefix (inferred fact 2) | Task `[continuation:post-compaction] [continuation:chain-hop:N] Compaction just completed. …` (`post-compaction-delegate-delivery.ts:499-502`). `buildSubagentTaskMessage` wraps it in protected blocks, and display stripping removes only those blocks. No prefix regex (timestamp, channel header, legacy `[Subagent Task]`) matches the bracket tag | source supports it; not live-probed. **Inclusion is not enough** (F4) |
| Child spawn task as first user row | Visible, rewritten to the bare task (`src/agents/internal-runtime-context.ts:141-204,267-311`); a forked child's inherited rows come first | yes (refuses requester tokens only where it is read: F2) |
| `[continuation:chain-hop:` prefix as token-form proof | Written by typed **and** bracket dispatch (`delegate-dispatch-request.ts:43`) | **no**: proves continuation dispatch, not the bracket (F1) |
| Child-minted token | Nothing in the product: it is a harness discipline. It holds only if the token is absent from every requester-authored text the child saw | **no** for R-CD-SILENT and the R-CW-TOKEN live path (F2) |
| Silent return reaches the parent | `mode:"silent"` never wakes the parent. The result waits as a system event and enters the parent's next turn as `display:false` runtime context (`subagent-announce.continuation-return.ts:243-279`; `runtime-context-prompt.ts:239-245`). It never goes to a channel | yes; the follow-up run is the right reader |
| Lifeboat return wakes the requester | Silent-wake enrichment: a new internal-event run, `deliver:false` (`continuation-wake.ts:81-109,186-202`). Its body is a visible user row; the requester's reply is an assistant row stamped `announce:…` | yes |
| Transcript turn order | Rows are appended in order; a wake is a new turn (a new user row, then a new run) | yes, except a folded wake (N7) |
| Journal return binding (offline) | `[continuation:targeted-return] Delivered to <keys> from <child>` is printed verbatim (`src/agents/subagent-announce.continuation-return.ts:199`). `[continuation:delegate-spawned] … session=<dispatcher> task=<first 80 chars>` puts `session=` before the task (`src/auto-reply/continuation/delegate-dispatch.ts:480`), so a task-borne marker is never followed by ` session=`, and `task=<marker>` is skipped by the `=` rule. The marker-writer lines in the committed journals (`<marker> session=<child> run=…`; `<marker>` then `session: <child>`) come from the historical build `bca2b0b`. I found no F′ writer of that shape | the targeted-return half is guaranteed; the writer half is a log-shape heuristic over fixed historical evidence, sound for the committed files |
| Fill measurement | `sessions.describe` → `{ session: row }`. `totalTokens` = the last call's prompt snapshot, output excluded, present only when fresh (`session-utils-row.ts:148,660-664`; `src/agents/usage.ts:414-457`). `contextTokens` = the projected window | numerator matches the tool; denominator not guaranteed (N3); no compaction counter (F7) |
| Disposable session | `sessions.create` returns a top-level canonical `key` and adopts an existing key without error (`session-create-service.ts:676-678`). The R-CD-3 key and label both carry the nonce | yes at F′ (F6 latent) |

## Step 3: fail-closed behaviour

| Row | Missing binding → | Notes |
| --- | --- | --- |
| R-CD-3 | PARTIAL or FAIL with a named reason (`classifyRcd3Evidence`, `lib/r-cd-3-lifeboat.mjs:259-292`). Unknown → PARTIAL ("context unknown"); measured below → a separate PARTIAL; `summaryRcd3Verdict` downgrades a disagreeing isolate | correct |
| R-CD-1, R-CD-SILENT, R-CW-TOKEN | `passed` needs every flag; R-CD-1 also goes through `failClosedVerdict` | correct, except F2/F3, which are false PASS rather than missing evidence |
| R-CW-1..4 | `chain.complete` only; any break → PARTIAL with `chain_reason` | correct |
| R-RC-2 | `classifyRrc2Evidence`; parent-stream fields are now diagnostic; `run-proofs.sh:1245-1293` policies read only child-transcript fields | correct |
| R-CD-MODEL-TOKEN | PASS needs the served receipt (`classifyModelIdentity`) | correct, except F1 |
| R-CD-4 | text path skipped when the priming anchor is missing (`r-cd-4-authority.mjs:246`) | correct; F5 shape if the priming row is unstamped |
| R-CD-CHAINED-DEPTH-2 | **a missing dispatch run id → PASS** | F5 |
| Offline rows | `markerReturn` needs a writer and a later return from it | correct |

## Step 4: R-CD-3's context fill

- **Disposable only.**
  - By default the scenario creates `r-cd-3-<nonce>`.
  - With creation disabled, `startFlow` stops before any send (`:481-486`). Note that only the
    plural variable disables creation (N11).
  - The remaining hole is F6, which is latent at F′.
  - The fill, the proof, the lifeboat observation and the compaction all target that one key. The
    lifeboat is the product's child of that session.
- **Methods called.** `sessions.create`, `sessions.messages.subscribe`, `sessions.send`,
  `sessions.describe`, `chat.history` and `sessions.list` (`:256,273,347,387,474,487`, plus the
  observer).
  - No `config.*`, `sessions.patch` or `sessions.compact` call is made. Those are the only paths
    that change a window or compaction setting at F′.
  - `0.7` is a module constant in the tool (`request-compaction-tool.ts:26`) and a read-only
    mirror here.
  - **No threshold or config is changed.**
- **Stops on mid-fill compaction.** Only when the measured total falls, or when it goes stale and
  the 300 s turn timeout expires. A preflight compaction that leaves a larger total is missed, and
  the plan can cross the automatic line on small windows (F7). A detected compaction does stop the
  fill before the proof turn.
- **Budgets.** 6 turns and 300k tokens (`planFillStep`), a 300 s per-turn timeout, an 18-minute
  socket and a 20-minute `maxDuration`. All hold, and each stop names its reason.

## Step 5: tests that mean something

**Coverage.** Every fixed row has an echo test and a true-record test:

| Rows | Test file |
| --- | --- |
| R-CD-1 | `r-cd-1-return-binding` |
| R-CD-3 | `r-cd-3-post-compaction` |
| R-CD-4 | `r-cd-4-priming-echo`, `r-cd-4-authority` |
| R-CD-CHAINED-DEPTH-2 | `r-cd-chained-depth-2-echo` |
| R-CD-MODEL-TOKEN | `r-cd-model-token-bracket-form` |
| R-CD-SILENT | `r-cd-silent-readback` |
| R-CW-1..4 | `r-cw-wake-binding` |
| R-CW-TOKEN | `r-cw-token-binding` |
| R-RC-2 | `r-rc-2-sentinel-echo` |
| Offline rows | `offline-return-binding` |
| Libraries | `sentinel-binding`, `continue-work-chain` |

**Pre-fix overlay.** Method: `git archive 7ac3e7b8` (the whole tree, so the offline rows find
their committed `PROOFS`), then each new or changed test copied in and run with `node --test`.

| Test file | On `7ac3e7b8` | Echo test fails for the intended reason? |
| --- | --- | --- |
| r-cd-1-return-binding | 0/3 | yes: "the return sentinel only rode the task text" |
| r-cd-3-post-compaction | 0/10 | yes: "the requester's own outbound text must not produce a lifeboat PASS" |
| r-cd-4-priming-echo | 1/2 | yes: the priming-run ack was credited |
| r-cd-chained-depth-2-echo | 1/3 | yes: "the root's own outbound text must not complete the chain" |
| r-cd-model-token-bracket-form | 0/3 | yes: "the bracket substrings only rode the spawn task" |
| r-cd-silent-readback | 0/4 | yes: "the parent only repeated outbound text" |
| r-cw-token-binding | 1/5 | yes: "the spawn task substrings must not produce a token-path PASS" |
| r-cw-wake-binding | 4/11 | yes, for R-CW-1/2/3 and R-CW-4. The true-record tests pass on the old tree too, as expected |
| r-rc-2-sentinel-echo | 1/4 | yes: the parent-stream echo set the report flag |
| offline-return-binding | 2/4 | yes: "outbound marker copies must not bind a return". The committed-corpus true tests pass |
| r-cd-4-authority / r-cd-chained-depth-2-authority (changed) | 19/21, 6/7 | yes: the #1727 cases fail |
| sentinel-binding, continue-work-chain | module not found | library-only tests: no pre-fix control is possible by construction; the scenario tests above carry the control |

**Limit of the suites.** The scripted gateways replay rows that a live subscription would not
deliver. For example, `r-cw-token-binding` returns the child's spawn-task row on subscribe. They
model no Tool Search seat and no requester that deviates from its prompt. That is why F1–F3 pass
the existing tests.

## Step 6: suites on the branch head (`3283454d`)

| Command | Result |
| --- | --- |
| `node --test tools/k6-proofs/tests/*.test.mjs` | 275/275 pass |
| `node --test tools/k6-proofs/scripts/__tests__/*.test.mjs` | 826/829. The three failures are the known INDEX reds: `current-corpus-active-scope` ×2 and `harness-provenance-runner` "a mutated proof corpus cannot produce a candidate verdict". The same three fail on `7ac3e7b8`; the fourth base failure there is the archive having no `.git`. Pre-existing and outside this lane |
| `node tools/k6-proofs/scripts/validate-corpus.mjs --sha f15237ec921879d918482cdf372b0718d4c1aab9` | OK: 18 passed, 0 failed (38 required rows; rollup pass 31, partial 2, honest-limit 1, missing 4) |
| `check-manifest-scenarios` | pass (43 manifests; 35 scenario files) |
| `check-scenario-alignment` | pass (`errors: []`) |
| `check-proof-row-manifests` | pass (trace-receipt failures: 0) |
| `check-telemetry-contracts` | pass (26 declared) |
| `check-k6-skill` | ok |

**On this lane** (`codeagent/harness-review`): `tests/*.test.mjs` is 282/291. The 9 failures are
exactly the 9 review defect tests; the 7 review controls pass.

## Reading order and method

- I formed steps 1–3 from the diff, the libraries, their callers, and product source.
- The F′ product facts were gathered by four read-only research passes over
  `git show`/`git grep` at `f15237ec`. I re-verified the load-bearing citations myself, including
  `sessions-create.ts:669-680`, `session-utils-row.ts:658-665`,
  `session-entry-projection.ts:110-150`, `agent-compaction-constants.ts`,
  `agent-settings.ts:9-33`, `delegate-dispatch-request.ts:38-48`,
  `work-dispatch-execution.ts:208-226`, `background-session-result.ts:134-152`,
  `sessions-messaging.ts:150-156`, `chat-send-input-dispatch.ts:555-575`, `tool-catalog.ts:29`,
  `tool-surface-plan.ts:125-160`, `tool-display-call.ts:5-13` and `server-chat.ts:660-700`.
- I read the audit's fix-status table only after steps 1–3. It matches my reading of each binding
  and does not mention F1–F7.
- The k6 authoring skill, which the fixing lane updated, was loaded at the start for harness
  conventions. It carries rules, not the lane's conclusions.

## Commands

```bash
export PATH=$HOME/.nvm/versions/node/v26.12.1/bin:$PATH NO_COLOR=1
node --test tools/k6-proofs/tests/*.test.mjs
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
node tools/k6-proofs/scripts/validate-corpus.mjs --sha f15237ec921879d918482cdf372b0718d4c1aab9
for c in check-manifest-scenarios check-scenario-alignment check-proof-row-manifests check-telemetry-contracts check-k6-skill; do node tools/k6-proofs/scripts/$c.mjs; done
node --test tools/k6-proofs/tests/review-*.test.mjs        # 9 fail (defects), 7 pass (controls)
# pre-fix overlay
mkdir -p /tmp/hr-base && git archive 7ac3e7b806b3f792c80327ca491743481f74725b | tar -x -C /tmp/hr-base
cp tools/k6-proofs/tests/<new>.test.mjs /tmp/hr-base/tools/k6-proofs/tests/ && (cd /tmp/hr-base && node --test tools/k6-proofs/tests/<new>.test.mjs)
```
