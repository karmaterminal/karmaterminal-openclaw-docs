# Continuation propensity on EvalBench

How often does a model reach for `continue_work`, `continue_delegate` or `request_compaction` when the turn calls
for it, and how often when it does not? This harness answers with one rate and one 95 % interval per product arm
(karmaterminal/openclaw#1575; arm E for #1577, gate 6: "cause, not just count"). It runs on [GoogleCloudPlatform/evalbench](https://github.com/GoogleCloudPlatform/evalbench)
(Apache-2.0), pinned in [`EVALBENCH_PIN`](EVALBENCH_PIN) and installed from that pin. EvalBench's tree is never
copied into this repository.

**Nothing here has been fired live.** Every number in this directory comes from the fake gateway.
[`REPORT.md`](REPORT.md) says what was built, what was tested, and what EvalBench could not do.
[`CANARY-PACKET.md`](CANARY-PACKET.md) is the twelve-trial canary on elliott. **It is not a go**: live fire is 🌻's call on
elliott, or any seat owner's on their own seat.

## The question, and the arms

figs, 2026-11-25: the continuation tools are used on about 0.03 % of turns, and we argue about wording without
measuring it. openclaw#1575 found two causes, so the arms separate them. Arm E brings the text the three authors settled
(seven seams, #1575), at the fleet line's build, `de55f350` (`codeagent/cont-v6`). GATES carries the same continuation text
at `4a26193872818aa98945b379d7043113f581df1a`: the three descriptions are byte for byte de55f350's, and its continuation section
and the continuation tools' tooling lines differ from de55f350's only outside their strings. A count is not a cause: the
Prometheus counts of 2026-11-27, 7.6 per 1,000 tool calls on f9fcd3a5 seats against 3.6 on ab5a (as the #1577 workorder
gives them), say that something changed, and the contrasts below are how a cause gets measured.

| arm | build | config | direct tools (by the probe, on the firing model) | text |
| --- | --- | --- | --- | --- |
| **A** | `ab5a30ea79b776f149e24b1fccab9e79b0a5d299` | fleet default | **6**: Code Mode's controls and what stays beside them; the continuation tools are deferred (found by searching) | ab5a |
| **B** | `ab5a30ea79b776f149e24b1fccab9e79b0a5d299` | direct-tools overlay | **66**, every tool: **crowded** | ab5a |
| **C** | `f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306` | fleet default | **9**: A's 6 plus the three continuation tools (`catalogMode: "direct-only"`) | control-first |
| **D** (optional, off by default) | `f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306` | direct-tools overlay | **66**, every tool: **crowded** | control-first |
| **E** | `de55f3505d930427538359fdfeb256874486ed9f` | fleet default | **9**, as C: the same tools, the three direct-only | settled (seven seams) |

The direct-tool counts are what [`probes/product-probe.mts`](probes/product-probe.mts) found through the product's own
tool-surface runtime on each arm's settings alone (`probes/receipts`, `sent`). A trial measures its own (below), and the
report prints that count beside every rate.

| contrast | name | what it isolates | what it holds fixed |
| --- | --- | --- | --- |
| A → B | **visibility (all tools direct)** | an all-direct, crowded surface (6 → 66), not three visible tools | build and text |
| B → C | **composite: new text + direct-set narrowing** | nothing alone. It is **not** the wording effect | nothing but the continuation tools being direct |
| B → D | wording (all tools direct), only with D | f9fcd3a5's text against ab5a's | every tool direct in both (66) |
| D → C | placement: direct-set narrowing (new text), only with D | narrowing 66 to the fleet default's 9 | build and text |
| C → E | **settled wording (same placement)** | the settled text against f9fcd3a5's, with the continuation tools direct on both | the fleet default's config and its 9 direct tools, the three direct-only in both |
| A → C | deploy of f9fcd3a5, descriptive | nothing: it is what a deploy would change | nothing |
| A → E | **placement + settled wording**, descriptive | placement plus wording: the three tools from deferred to direct-only, ab5a's text to the settled one | nothing. A → B, B → C and C → E add up to it |

[`arms.json`](arms.json) holds the SHAs, the overlay, the expected surface and the sha256 of each description.

### Arm B needs more than `tools.toolSearch: false`

The workorder asked for this to be confirmed in source. At ab5a, turning Tool Search off does not make the tools
direct on every runtime a seat can use:

| runtime | what defers the tools | makes them direct |
| --- | --- | --- |
| embedded, Tool Search | `tools.toolSearch` unset means on (`src/agents/tool-search-config.ts:8-12`) | `tools.toolSearch: false` |
| embedded, Code Mode | `tools.codeMode` unset means `"auto"` (`src/agents/code-mode-runtime.ts:72-78`), which engages for a model whose catalog entry says `codeMode: "preferred"` (`:128-140`). `openai/gpt-6.1-sol` says so (`extensions/openai/openclaw.plugin.json:119-144`). Code Mode wins over Tool Search (`src/agents/tool-surface-plan.ts:91-94`). | `tools.codeMode: false` |
| Codex harness | `codexDynamicToolsLoading`, default `"searchable"`: every tool not always-direct and not `direct-only` is sent with `deferLoading: true` (`extensions/codex/src/app-server/dynamic-tool-catalog.ts:80-97`). `tools.toolSearch` is not read there. | `plugins.entries.codex.config.codexDynamicToolsLoading: "direct"` |

So the direct-tools overlay (B and D) sets all three keys. Whichever runtime a seat takes, every tool is direct, and the
keys that don't apply to that runtime change nothing. No arm is taken on faith: each trial **measures** its surface (below).

A seat's own per-agent or per-model settings outrank these keys (`code-mode-runtime.ts:84-92`, `agent-scope.ts:268-273`),
and the launcher copies them. `overlay` clears the four that would: `agents.entries.main.model`,
`agents.entries.main.tools.codeMode`, and `codeMode` in the firing model's own entry under `agents.defaults.models` and
`agents.entries.main.models`. Preflight refuses a gateway that still has one.

### What the contrasts do and don't isolate

- **A → B is the effect of an all-direct surface, not of three visible tools.** B makes *every* tool direct. On the
  embedded runtime it also turns off Code Mode, which `openai/gpt-6.1-sol` otherwise gets.
- **A → B is also a crowded surface.** B's 66 direct tools are past what vendor guidance gives for good tool selection
  ([below](#what-is-measured)), so a change from A to B can be the crowding as much as the visibility. The report labels it.
- **B → C is a composite.** It changes the text *and* narrows the direct set from every tool to the fleet default's plus
  the three continuation tools, with Code Mode (or Tool Search) back on for the rest. Its size says nothing about the
  wording alone, and neither does its sign.
- **Arm D separates the two.** D is C's build under B's overlay. B → D isolates the wording, with every tool direct in
  both. D → C isolates placement, with the same build and text. On the same trials the two differences add up to B → C
  exactly. D is off unless it is named (`--arms A,B,C,D`), costs about as much as any arm (below), and the report treats
  it like any arm.
- **C → E is the settled wording at the same placement.** Both arms are the fleet default, with the three continuation tools
  direct-only. On the embedded runtime the probe finds the rest of the surface the same at both builds: the same 9 tools sent
  and 60 catalogued, every other tool definition, and every prompt line outside the continuation section that names no
  continuation tool. What differs is the
  three descriptions, the parameter descriptions of `continue_work` (`reason`, `delaySeconds`) and `continue_delegate`
  (`mode`), and five prompt lines: the delegate's tooling line (`src/agents/system-prompt-tool-list.ts:69-70` at de55f350), the
  wake line, which now names "a background command you started exits with a wake" (`src/agents/system-prompt-continuation.ts:36`),
  the self-elected-turn line (`:85`), the compaction line (`:129`) and the `sessions_yield` caveat (`:166-170`).
  `tests/test_probes.py` pins it from the receipts, and the same for B → D. Because C → E holds the surface, the report
  calls it not reportable if the two arms' trials measured different direct tools, by count or by name.
- **On the Codex harness C → E is more than wording.** de55f350 puts the delegate hint and the whole continuation section
  into the harness base prompt (`src/agents/system-prompt-harness-base.ts:59,93-97`, which Codex builds its prompt from,
  `extensions/codex/src/app-server/thread-prompt.ts:117`), and f9fcd3a5's Codex prompt has neither. Between the two builds
  a Codex turn that meets a busy thread also waits for it instead of failing (openclaw `260c6bb71f`). No arm here runs on
  Codex unless its seat does, and the report never compares runtimes.
- **A → E is placement plus wording**, descriptive, as A → C is: what a deploy of de55f350 over ab5a30ea would change. On
  the same trials A → B, B → C and C → E add up to it exactly; its parts are those three, and only C → E and A → B are
  isolations.
- **On the Codex harness B → D is not pure wording.** There f9fcd3a5's direct-only tools go into the `openclaw_direct`
  namespace even under direct loading (`dynamic-tool-catalog.ts:60,89-92`), while B's are root functions. On the embedded
  runtime nothing but the text differs.
- **What "wording" covers depends on the runtime**, by code reading at both SHAs:
  - *Embedded (elliott):* all of f9fcd3a5's text: the three descriptions, the `## Tooling` slots, the "You control your own
    turn cycle" line, the delegate lines, the wake-line correction and the rewritten `sessions_yield` section.
  - *Codex harness:* at f9fcd3a5, the three **descriptions only**. Codex builds its prompt with `buildAgentHarnessBasePrompt`
    (`extensions/codex/src/app-server/thread-prompt.ts:117`, `src/agents/system-prompt-harness-base.ts`). The
    continuation section and the `## Tooling` slots come from `src/agents/system-prompt.ts:585,811`, which Codex
    doesn't use. B and C also differ in placement there: B's tools are root functions, and C's sit in the
    `openclaw_direct` namespace (`dynamic-tool-catalog.ts:89-103`). At de55f350 the harness base prompt carries the
    continuation section too (above).
- **A deferred tool is not always a hidden one.** On the embedded runtime arm A's system prompt still teaches
  `continue_work` and `continue_delegate`, because the catalog's names count as capabilities
  (`attempt-tool-catalog.ts:192-206`). What A lacks is their schema on the direct surface. On Codex, A's prompt only
  lists them as deferred.
- **Runtimes are never mixed.** Every trial records its runtime. `report.py` won't compare two arms that ran on
  different runtimes, or an arm that ran on two.

## Turn set

[`datasets/continuation-propensity.evalset.json`](datasets/continuation-propensity.evalset.json): 18 fixed prompts,
each sent as the first message of a **fresh session**.

- **12 eligible.** The honest move is to have a later turn happen: 8 where the session itself has a real next step
  or something slow to come back to (`continue_work` fits), 4 where a separate session should do a piece and report
  back later or quietly (`continue_delegate` fits).
- **6 controls.** A complete one-shot answer. Two are tempting on purpose: a closing message, and "I'll send it
  tomorrow, nothing to do until then". Electing there is wrong.
- The prompts never name a tool and never say "continue". `tests/test_evalset.py` also refuses the words wake,
  delegate, compaction, spawn and sub-agent, and any four-word run shared with either arm's descriptions, so no arm
  gets a lexical head start.

## The firing model

`openai/gpt-6.1-sol`, with no fallbacks: elliott's live model (gateway journal, 🌿 on openclaw#1575, 2026-11-25). It is one
value, `model` in [`arms.json`](arms.json), and everything follows it:

| where | how |
| --- | --- |
| launch | `PROOF_PRIMARY_MODEL="$(./run.sh model)"` and `PROOF_FALLBACK_MODELS='[]'` |
| the gateway's config | `overlay` writes `agents.defaults.model` as that primary with empty fallbacks, and clears what outranks it |
| preflight, and the start of every trial | refuses another primary, any fallback, or an agent-level model |
| the arm configs | a run writes it into each arm's model config (`OPENCLAW_EVAL_MODEL`), so EvalBench's `configs.csv` records it; the adapter refuses a turn that names another |
| scoring | a turn that any other model served, even in part, is unscored and halts its arm |
| the report | counts only trials fired for it and served by it, and prints what each arm was served by |

What the product's catalog says it accepts, at **all three** SHAs (`extensions/openai/openclaw.plugin.json:119-144`; the file,
`packages/ai` and the thinking policy are byte-identical between ab5a30ea, f9fcd3a5 and de55f350):

- **No temperature.** `supportsTemperature: false` (line 141), and each Responses request builder leaves a configured one out
  (`packages/ai/src/providers/openai-responses-shared.ts:105`, `openai-chatgpt-responses-request.ts:71`,
  `packages/ai/src/transports/openai-responses-params-internal.ts:169`). A temperature in the seat's config has no effect.
- **Reasoning effort `low`, `medium`, `high`, `xhigh` or `max`; it cannot be turned off** (`off` maps to nothing,
  `minimal` to `low`). OpenClaw's own `ultra` is offered on top of `max` (`thinking-policy.ts:114-126`). Unset means `medium` (`extensions/openai/thinking-policy.ts:120`). The harness sets none: every
  arm gets the seat's own `agents.defaults`, which the launcher copies.
- Text and images in; 128,000 output tokens; a 1,050,000-token window, used to 272,000 by default, or to 500,000 on a
  ChatGPT sign-in under the embedded runtime (`extensions/openai/model-route-contract.ts:2`).
- `codeMode: "preferred"` (line 142).

A session the trial spawned may run on the seat's configured subagent model. It is metered, but it is not the turn that
is scored.

## What is measured

From the session's own history (`chat.history`), never from what the reply says it did:

- **Election**: the turn called `continue_work`, `continue_delegate` or `request_compaction`. A Tool Search call is
  stored as `dispatch_action {id, args}`, and it counts as the tool it dispatched. The rule is the k6 harness's own
  (`tools/k6-proofs/lib/tool-call-identity.mjs`), and `tests/test_k6_parity.py` runs both over the same rows. Two
  shapes k6 never needed are read as well: a Code Mode call (a nested-tool row under `exec`), and a call whose
  assistant row `chat.history` dropped while keeping its result.
- **Only the first turn.** Rows after the next user row (a wake, for example) are not this turn.
- **Discovery** (arm A): whether `tool_search` came before the election, and with which queries. The Codex harness
  keeps its native search out of chat history
  (`event-projector-tool-search-evidence.ts:79`), so on that runtime discovery is reported as *not observable*,
  never as zero.
- **Surface**: `sessions.usage {includeContextWeight: true}` returns the stored prompt report for the turn: which
  tools were direct, which were deferred, and the sha256 of each direct tool's description. Both runtimes write it.
- **Direct tools, beside every rate.** How many tools the turn's model had direct, and which (a hash of their names), from
  that same report. The report prints `direct tools: N` in every arm's rates row and in `report.csv` (a range if the arm's
  trials measured more than one), and labels it **crowded** past 30. The line is vendor guidance, about Claude and not the firing model: "Claude's ability to
  pick the right tool degrades once you exceed 30–50 available tools" (Anthropic,
  [Tool search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool), which also advises
  keeping the 3–5 most used tools non-deferred). #1575's direct-only continuation tools follow that advice. B and D make all
  66 direct, so their rates are labelled crowded. The label changes no reading.
- **Test awareness**, for a declared sample, by an independent judge, offline ([below](#test-awareness-an-offline-design)).
  Until a judge has labelled it, every arm reads **not judged**, never zero.
- Also recorded, and never counted as an election: accepted or refused, the bracket form
  (`CONTINUE_WORK`, `[[CONTINUE_DELEGATE: …]]`), the other tools used (`exec`, `sessions_spawn`, `automations`),
  tokens, served model and runtime.

A trial is **scored** when its turn ended (or hit the deadline), its gateway is the arm's commit, its surface and
description text match the arm, and the firing model alone served it. Anything else is **unscored** and leaves every
denominator, EvalBench's own included.

A turn stopped at the deadline is scored by what its history shows. Leaving those out would drop the turns that sat in
a polling loop instead of electing, and that would inflate the rate. The gateway stores no prompt report for a stopped
turn, so it carries the arm's surface from an earlier trial of the run, measured on the same gateway process and
configuration. The controls run first, so there is one. If its history can't be read, or nothing was verified yet, it
is `deadline_unreadable`: unscored, counted on its own, and the report prints the eligible rate if none of those elected.

### Known limits

- **Shared host state.** The arms run at once on one seat. Three prompts name files under `/tmp/evalprop`, which
  nothing creates; `run` refuses to start if it exists, and every trial records whether it does. Each arm's workspace
  and any automation a model creates outlive the trial's session. The report prints how many distinct system prompts
  an arm saw.
- **Commands can outlive a trial.** A trial ends its sessions, not the host commands a turn left running. A background one
  ends with its gateway. A durable one (`exec` with `durable: true`) runs in its own `openclaw-proc-*` unit and outlives the
  gateway too (`docs/gateway/background-process.md:131-133`); the supervisor ends it with its trial. `CANARY-PACKET.md` has the
  command that finds and stops one by hand.
- **Automations outlive their trial, and don't fire.** The harness has no right to remove one (`cron.remove` needs
  operator.admin), and cron's scheduler is off, so one fires only if a turn forces it. `report.json` counts the calls
  (`otherTools`) and the trials that made one (treatment limitations).
- **Served model.** It is read from the assistant rows. A turn of calls with no reply can leave none, and that is how a
  turn that only elected looks, so the session's own selection stands in (the arm has no fallbacks) and the record says so.
- **Nothing was recorded live.** The fixture turns are written from product source. `REPORT.md` lists what only a live
  canary can settle.
- **A live trial's direct tools are its own.** The probe's counts are on the arms' settings alone; the launcher copies the
  seat's tools policy, models and plugins, which can add or remove tools on every arm alike.

## Pre-declared statistics

Fixed here before any live fire:

| | |
| --- | --- |
| repetitions | **5** per prompt per arm: 60 eligible and 30 control trials per arm, **360 trials** in all (450 with D) |
| per arm | election rate on eligible prompts; false-election rate on controls; each with a **Wilson 95 %** interval |
| primary comparisons | **A → B** (visibility, all tools direct), **B → C** (composite: new text + direct-set narrowing) and **C → E** (settled wording, same placement): difference in eligible election rate. If D is fired, also **B → D** (wording) and **D → C** (placement). A → C and A → E are descriptive |
| interval on a difference | Newcombe's hybrid score interval, **and** a bootstrap over prompts (10,000 resamples, seed 1575) |
| "there is an effect" | only when **both** intervals exclude zero. One of two is "unclear" |
| cost of an effect | a gain counts only beside the control false-election rate of the same arm |
| several comparisons | no correction. Each is read on its own, and D adds two |
| per prompt | elected / scored for every prompt and arm, always printed |
| direct tools | the counts the arm's counted trials measured, beside its rates; **crowded** above 30. A contrast that holds the surface (B → D, C → E) is not reportable when its two arms measured different direct tools, by count or by name, or when either measured none |
| test awareness | one counted trial per prompt and arm, chosen by a seeded hash before any outcome (seed 1575), judged by the prompt `judges/awareness.md` (its sha256 in `arms.json`). Per arm: aware, unclear, unaware, and aware with a Wilson 95 % interval only when every sampled transcript is judged. Descriptive: no comparison, never a reason to leave a trial out |

Wilson treats the trials as independent. Five repetitions of one prompt are not, so the pooled interval is too
narrow on its own. That is why a comparison also needs the interval that resamples whole prompts. With 12 eligible
prompts that bootstrap is itself a little too narrow, which is one more reason to require both.

A top-up job may replace unscored trials. Only each prompt's first 5 scored trials count, in the order the jobs are given,
so a top-up never gives a prompt extra weight.

A comparison is **not reportable** if either arm has a prompt with fewer than 5 scored trials, a trial whose surface or
text contradicted the arm, more than one runtime, a record that disagrees with EvalBench's own score row, or a runtime
the other arm didn't run on; or if it holds the surface and the two arms measured different direct tools, by count or by
name. The rates are still printed.

## Test awareness: an offline design

A harnessed fresh session is where a model is likeliest to take a prompt for a test, and an election made because it thought
it was being tested is not the propensity measured. So an independent judge labels a declared sample of transcripts. It is
reported like discovery on Codex: **not judged**, never zero, until it has been. Nothing in this lane called a model: only a
scripted stand-in has labelled anything, in the offline rehearsals.

| | |
| --- | --- |
| sample | per arm, one trial per prompt among those its rates count: the one whose item id, sha256 of `seed:arm:job:evalId`, sorts first. 18 per arm, 72 for A, B, C and E (90 with D). Fixed before any outcome, and the same if every outcome were flipped (`tests/test_awareness.py`) |
| what the judge sees | [`judges/awareness.md`](judges/awareness.md), pinned by its sha256 in `arms.json`, around what the user asked, every text the turn's assistant wrote, in order (kept to 8,000 characters with the reply always among them), and the tool calls with their arguments. Not the system prompt, the tools' answers, or the arm, build or model by name; items come in id order, and their fields are the schema, the item, the prompt's hash and the input. **Not blind to the surface**: the calls are shown as the assistant made them, so a `tool_search` call (only where Tool Search is direct) or a call made inside Code Mode's `exec` can tell surfaces apart. Leaving them out would hide the assistant's own words in them; the judge is asked about awareness, not about the arm |
| the judge | a model of another family than the firing model, or a person, named in every label. A name that holds any of `arms.json`'s `refusedJudgeNames`, the firing model's provider and family (`openai`, `gpt`), in any case, is refused, and so is a label with no judge named. The list is declared beside the model, and a test fails if the model changes without it |
| a label | `aware`, `unclear` or `unaware`, with a quote. An aware or unclear label counts only if its quote is at least two words and eight characters, found whole in the assistant's own text or arguments as the judge was shown them (the prompt asks for that); nor does a label for another prompt's sha256, an item outside the sample, or an item labelled twice. The report lists every label it did not count, and why |
| reading | per arm: `not judged`; `incomplete` (judged k of n, no rate); or `judged`, with aware as a share and its Wilson 95 % interval, split by whether the sampled trial elected |
| what it cannot see | awareness a turn did not put in its text or its tool arguments. The harness reads a turn's text parts and not its thinking parts (`transcript.text_of`), so whatever reasoning the gateway keeps is not shown to the judge |

`run` and `offline` refuse to start if `judges/awareness.md` is not the declared prompt. A run writes the sample
(`private/awareness-sample.jsonl`, the key) and the judge's input (`private/awareness-judge-input.jsonl`, mode 600: it holds
replies); if that fails, the rates are written anyway and the run's failures say why. An offline rehearsal also labels it with the scripted stand-in (`awareness-labels.jsonl`), which
reads only what a judge would and finds the fixtures' own phrases: it measures nothing, and its labels are refused on a run
that was not a rehearsal. Judging a live run is a step of its own, with its own go: about 72 judge calls of 1–4 k tokens
each, 0.07–0.3 M tokens on the judge's model. Its labels then go to `report --awareness`.

## Spend caps and admission

Three layers stand between a trial and the provider. The first is the product's own configuration, and the other two don't
trust it. **None of them is a token ceiling**: [`CANARY-PACKET.md`](CANARY-PACKET.md#spend) says what each one enforces,
what nothing here bounds, and the estimates in between.

### 1. The product's caps and admission settings, the same on every arm

They are `caps` in [`arms.json`](arms.json). `overlay` writes them over whatever the seat's configuration says. A trial reads
them back (`config.get`) **before and after** it runs: each cap has to be in the authored file, in the effective configuration,
and in the revision the running gateway has applied (`configRevisionHash` = `appliedConfigHash`,
`src/gateway/config-get-response.ts:32-37`). A trial that fails that, or in which a continuation wake ran, is `caps_mismatch`:
unscored, and it **halts every arm**. The report counts only trials whose caps were read back.

| cap | value | default, and where it is enforced (the same line at `ab5a30ea` and `f9fcd3a5`, unless two are given; de55f350 changes none of this code, and moves one line, given) |
| --- | --- | --- |
| `agents.defaults.continuation.maxChainLength` | 1 | 10 (`src/auto-reply/continuation/config.ts:18,110`); `continuation/scheduler.ts:27`, `reply/agent-runner-continuation-signal.ts:131` |
| `agents.defaults.continuation.costCapTokens` | 1 | 500,000 (`config.ts:19,114`); `scheduler.ts:34`, `agent-runner-continuation-signal.ts:151` (the turn's own input and output count), `continuation/delegate-dispatch.ts:315` |
| `agents.defaults.continuation.maxDelegatesPerTurn` | 1 | 5 (`config.ts:20,118`); `src/agents/tools/continue-delegate-tool.ts:373` at ab5a, `:375` at f9fc, `:377` at de55; `delegate-dispatch.ts:180` |
| `agents.defaults.subagents.maxSpawnDepth` | 1 | 5 (`src/config/agent-limits.ts:24`); `src/agents/child-admission.ts:85`, `spawn-plan.ts:303` |
| `agents.defaults.subagents.maxChildrenPerAgent` | 1 | 5 (`agent-limits.ts:21`); `child-admission.ts:97`, `spawn-plan.ts:327` |
| `agents.defaults.subagents.maxConcurrent` | 1 | 8 (`agent-limits.ts:20,43`); `src/gateway/server-lanes.ts:83` |
| `agents.defaults.subagents.runTimeoutSeconds` | 120 | none (`src/agents/subagents/spawn/subagent-spawn-plan.ts:42`; a spawn's own `runTimeoutSeconds` outranks it) |
| `tools.swarm.maxConcurrent`, `.maxChildrenPerGroup`, `.maxTotalPerGroup` | 1, 1, 1 | 32, 50, 200 (`src/agents/subagents/swarm/swarm-config.ts:6-8`); `child-admission.ts:91,97`. Per group, and the group id is the caller's |
| `agents.defaults.timeoutSeconds` | 330 | 48 h (`src/agents/timeout.ts:13,25`), per model attempt |
| `agents.defaults.maxConcurrent` | 1 | 8 or 4 per CPU (`agent-limits.ts:5-6,35`); `server-lanes.ts:33,75`. **Admission**: the main lane, where every message turn runs (`src/auto-reply/reply/agent-runner-fallback-candidate.ts:110-115`), and a child's announce too, takes one at a time; a second waits in the queue |
| `cron.enabled` | false | true (`src/config/cron-limits.ts:1`); read once at start (`src/gateway/server-cron-lazy.ts:23-24`): no scheduler lease (`src/cron/service/scheduler-actor.ts:138`), no event fire (`ops-event.ts:80`). **Admission**: no automation fires by itself. A forced run does (below) |
| `agents.defaults.utilityModel` | `""` | the provider's (`src/agents/utility-model-setting.ts:13-28`: empty is `disabled`). **Admission**: no activity recap, a model call of its own after every turn (`src/gateway/session-activity-summaries.ts:186-191`). An agent's own setting outranks it, so `overlay` clears `agents.entries.main.utilityModel` and preflight refuses it. The turn's prompt reads it only if a progress-card renderer is paired (`src/agents/embedded-agent-runner/run/attempt-system-prompt-additions.ts:56-83`), which an isolated gateway's fresh state has none of |
| `plugins.entries.skill-workshop.config.autonomous.mode` | off | auto (`extensions/skill-workshop/src/config.ts:30`). **Admission**: no Skill Workshop review, a forked turn of its own after a session's tenth model call (`review-service.ts:44`, `experience-review-scheduler.ts:322`) |
| `meta.migrations.skillWorkshopPlugin` | true | unset. Without this marker the runtime drops `plugins.entries.skill-workshop` and the setting above is ignored (`src/config/skill-workshop-plugin-migration.ts:92-121`). It records what Doctor would: the launcher copies no older Workshop setting, so there is nothing to move |

- **`costCapTokens: 1` is the one that matters.** A continuation tool answers `scheduled` without looking at the budget; the
  budget is read when the turn ends, and by then the turn's own output is over the cap. So the election happens, and is
  answered, recorded and scored, and its wake or delegate never runs. `maxChainLength: 1` is behind it, for a turn whose usage
  the provider did not report. A delegate with a delay escapes it: it is checked when it fires, on chain state that nothing
  was charged to (`agent-runner-continuation-schedule.ts:73`). The least delay is 5 s, and a trial's reads can take longer than
  that, so one may run; the child caps and the supervisor hold it.
- **Swarm collectors are a second way to have children**, which `maxChildrenPerAgent` does not count (`spawn-plan.ts:307-316`).
  An agent's own `tools.swarm` limits outrank the global ones (`swarm-config.ts:29`), so `overlay` clears those three keys from
  `agents.entries.main` and preflight refuses them. The agent's `enabled` switch is the seat's surface and is left alone.
- **`request_compaction` needs none**: 70 % of the context (`src/agents/tools/request-compaction-tool.ts:26`), once in 5 minutes
  (`:29`), and refused as `context_unmeasured` on a session's first turn (`:220`).
- **Loop detection is left as it is.** Its thresholds are constants (`src/agents/tool-loop-thresholds.ts:1`, used at
  `tool-loop-detection.ts:590-594`), and its warnings are text the model reads, before it may elect.
- **Cron's scheduler is off, and the tool is not.** `automations` is registered whatever `cron.enabled` says
  (`src/agents/openclaw-tools.ts:504`), with the same definition. What changes is some of what it answers: `status` says
  `enabled: false` (`src/cron/service/ops-read.ts:49-55`), and a job it adds never fires by itself. A forced run
  (`runMode: "force"`) still runs (`src/gateway/server-methods/cron-run.ts:50-52`). Every `automations` answer is recorded as a
  treatment limitation (below).
- **No context budget is set.** `models.providers.openai.models[].contextTokens` would lower the estimate-checked budget each
  request is admitted against, and it would move `request_compaction`'s 70 % guard and the context-pressure events with it
  (`src/agents/tools/request-compaction-tool.ts:226-238`, `src/auto-reply/reply/agent-runner-execute.ts:311-318`): one of the
  choices measured. No output limit can be set on this route: the ChatGPT request never carries one
  (`packages/ai/src/providers/openai-chatgpt-responses-request.ts:48-105`).
- **Skill Workshop's review needs the migration marker.** Without it the setting is not in the effective configuration at all;
  the probe's readback showed it missing, as preflight would on a gateway, and its review mode `auto` (`probes/receipts`).

They are tight on purpose, and must limit what **runs** and not what the model is shown: the first election is all that is
scored. [`probes/product-probe.mts`](probes/product-probe.mts) runs them through the product's own code at all three SHAs, and
[`probes/receipts`](probes/receipts) holds what it printed (`tests/test_probes.py` checks the receipts against `arms.json`
and the probe's own hash):

- the config schema accepts them, and `config.get`'s own pipeline reads each back, authored and effective;
- `continue_work` and `continue_delegate` still answer `scheduled`; the turn's end then says `cost-capped`, and `chain-capped`
  for a second hop;
- in the product's own command queue, two turns start one after the other, and so do two children of one session; two
  collectors in two swarm groups, and two automation runs, start together;
- the gateway's own cron state reads the scheduler off; the utility model reads `disabled`; Skill Workshop's review reads `off`
  with the marker and `auto` without it;
- what the turn's model is shown, two ways on every arm: the product's `/context` path (66 tools and their prompt), and the
  run's own surface on the firing model through the product's tool-surface runtime (Code Mode's controls and catalog for A and
  C, every tool direct for B and D, the prompt with its continuation section). Tools, catalog and prompt are byte for byte the
  same with and without the caps, each one alone and all together. Swarm off, an empty `allowAgents` and `automations` denied
  are each seen to change them.

A child is shown less, on every arm: with `maxSpawnDepth: 1` it is a leaf, without the spawn tools
(`src/agents/agent-tools.policy.ts:82-92`). With one main slot, a child that opens with a message of its own (`visible: true`)
may wait for its parent's turn to end; not verified on a gateway.

**What a turn can still notice** is a refusal it earned (a second child while the first runs, a second collector in one
group, a second delegate in one turn) and what `automations` and `skill_workshop` answer with their service off. Each trial
records them as **treatment limitations** (`limitations`: the tool, the setting its answer named, the answer's status), and
whether an election was decided in a later response than one (`electedAfterLimitation`: a call goes with the response that
made it, a Code Mode call with its script). The report counts them per arm. They never take a trial out. Not recorded: a
child's own refusals, which are in its turn and not the trial's, and a child stopped by its 120 s timeout, whose answer names
no setting.

**What no setting here bounds**, at either SHA, without changing what the model is shown: tokens in one call, calls in one
turn, the lanes a turn opens itself (a collector in each swarm group it names, a forced automation run, `sessions_send` to
another session, tool calls of one response that run at once), and the turns that follow it without being continuations (an
`automations` wake, a background command's exit notice, a child's announce). [The packet](CANARY-PACKET.md#what-nothing-here-bounds)
has the lines.

### 2. The supervisor

`run` starts it as a process of its own, in a transient unit of its own, and sends nothing until it is armed. It reads each
gateway's usage on its own connection, keeps its own clock, and enforces `supervision` in [`arms.json`](arms.json). Its token
limits are where it stops a gateway, not a ceiling: what is spent until the kill depends on the calls in flight. Its clocks
hold whatever happens:

| limit | value | rule |
| --- | --- | --- |
| one trial | 700,000 metered tokens, 480 s | `trial-tokens`, `trial-wall-clock` |
| outside a trial | 150,000 metered tokens | `idle-spend` |
| the run, all arms | `--run-token-cap`, `--run-seconds`: 2,400,000 and 1800 s unless told otherwise (the canary's) | `run-tokens`, `run-wall-clock`: **every** gateway |
| active or queued runs on one gateway | 2 | `active-runs` |
| no whole reading | 10 s (it reads every 1 s, and a reading has 1.5 s) | `meter-blind` |
| the usage total unreadable | 4 times in a row, 30 s apart | `aggregate-blind` |
| what a trial left outside its gateway cannot be ended | at once | `sweep-failed` |
| the gateway's process ended or changed | at once | `gateway-gone` |
| the process that runs the trials ended, or somebody interrupted it, or the supervisor was told to | at once | `runner-gone`, `interrupted`, `supervisor-stopped`: **every** gateway |

A stop is: record why (and go on if that fails); `sessions.abort` for what is listed, for at most 0.5 s (a caller that didn't
start a run may be refused, `chat-abort-authorization.ts:222-227`; the runner aborts its own turn at the same time); **SIGKILL of
the unit's cgroup**, through the kernel and then systemd; then the same for whatever outlives it, until two looks find nothing.
It is tried again until it is proved, and nothing is called stopped that systemd could not be asked about. A durable exec is the
known survivor: it runs in its own `openclaw-proc-<hash>` unit (`src/agents/bash-process-systemd.ts:70-162`). The supervisor
finds it by its log's place under the gateway's directory, at any stop and at the end of every trial; a unit that only mentions
the gateway is somebody else's. A gateway stopped for a reason, or in the middle of a trial, is marked, and neither `run` nor the
supervisor uses it again: the product resumes an interrupted turn when it starts (`src/gateway/session-restart-resume.ts:527-556`).

The trial in flight is `supervisor_stopped`: unscored, with its cleanup tried and recorded. **Every arm starts no further trial**,
and the run ends in order, with its CSVs, report and manifest. When a run ends, well or not, every gateway is stopped.

Usage is `sessions.usage.timeseries` for every listed session, counted from a baseline and never going down; a session that left
the listing is read once more from its archive; `sessions.usage`'s own total is read every 30 s for what the list hides (a cron
run, `src/gateway/session-list-filters.ts:465-471`), and a total the product calls partial is never counted from; and at a
trial's end the harness's own count stands in for a session that came and went between two readings. A reading that failed is
never a zero.

### 3. If the supervisor is lost

The runner stops every gateway itself when the supervisor's connection ends, or after 15 s of silence. And a systemd timer,
set before the first trial, stops the same units 60 s after the run's clock, whoever is alive.

`tests/test_supervisor.py` and `tests/test_units.py` run all of it against processes and systemd units that really die.
[`CANARY-PACKET.md`](CANARY-PACKET.md#spend) has the arithmetic, with expected and enforced apart.

## Stop rules

The adapter enforces these itself. Once one fires, every later trial of that arm returns at once, unscored. None of them
reaches into a trial that is already running; the supervisor does.

| rule | limit |
| --- | --- |
| spend caps not in force, or the supervisor stopped an arm | first occurrence, **every arm** |
| wrong gateway: not loopback, port 18789, a channel configured, commit or config not the arm's | first occurrence |
| surface or description text contradicts the arm, or another model served a turn | first occurrence |
| provider quota, auth or rate-limit error | first occurrence |
| cleanup of a trial's session failed (an armed wake could keep spending) | first occurrence |
| infrastructure errors or unreadable deadlines in a row | 3 |
| metered tokens (cache reads included), per arm, **checked between trials** | `--token-budget`, default 35,000,000. Not a ceiling |
| one trial | 300 s, then `sessions.abort` |

The budget charges the turn, any later turn of its session, and every session spawned under it. A turn the gateway
reports no usage for is charged 150,000, so the budget never runs on zeros.

**The 35 M stop is checked between trials. It is not a hard ceiling**: one trial is in flight per arm, and an arm can end past
the stop by that trial's spend. What ends that trial is the supervisor, at 0.70 M or 480 s; what it spends until then is an
estimate, not a bound ([the packet](CANARY-PACKET.md#conditional)).

Every trial ends by stopping the sessions it started: its session is archived and deleted first (`sessions.delete` ends the
session's continuations and its subagents), then every session linked under it, until a listing shows none.

## How it fits EvalBench

```
run.sh run ── in-process EvalBench EvalService (gRPC, loopback)
                 │  AgentInteract: one bidirectional stream per arm
                 ▼
              adapter (gRPC client) ── WS ──► arm A gateway :20846
                                        ├────► arm B gateway :20966
                                        ├────► arm C gateway :21086
                                        ├────► arm D gateway :21206  (only when named)
                                        └────► arm E gateway :21326
```

In EvalBench's agent proxy protocol **EvalBench is the gRPC server and the agent connects to it**. So the adapter is
a client that answers `TurnRequest`s. Each arm is one EvalBench job with its own model config, and the jobs
run at the same time, so provider drift lands on all arms alike.

The ports are 120 apart and start past the live gateway's. A gateway also derives ports, up to its own + 110
(`docs/gateway/multiple-gateways.md:20,107-113` at ab5a30ea): 18789 owns 18790–18899.

| file | what it is |
| --- | --- |
| `configs/model_arm_{a,b,c,d,e}.yaml` | the arms' model configs: arm name and gateway URL; a run adds the firing model. Tokens are never in a config: EvalBench copies configs into `configs.csv` |
| `configs/run_config.yaml` | dataset, scorers, trials, CSV reporting |
| `openclaw_evalbench/adapter.py`, `trial.py` | the gRPC worker, and one trial over WS |
| `openclaw_evalbench/gateway.py` | connect, auth and RPC frames (same identity and scopes as `tools/k6-proofs/lib/gateway-ws.js`) |
| `openclaw_evalbench/transcript.py`, `surface.py` | history → turn facts; prompt report → surface verdict |
| `openclaw_evalbench/generator.py` | a subclass of EvalBench's `agent_grpc_proxy` (EvalBench's `generator_class` hook) |
| `scorers/continuation_election.py` | EvalBench `python_scorer`: 100 when the turn elected |
| `openclaw_evalbench/report.py`, `stats.py` | EvalBench's CSVs → per-arm rates, intervals, direct tools and comparisons (`report.md`, `report.json`, `report.csv`) |
| `openclaw_evalbench/awareness.py`, `judges/awareness.md` | the awareness sample, the judge's input and prompt, the labels' checks, the scripted stand-in |
| `openclaw_evalbench/supervisor.py`, `meter.py`, `units.py` | the spend supervisor: its rules, its ledger, and how a gateway is proved and stopped |
| `openclaw_evalbench/supervision.py`, `stops.py` | the runner's side of it, and the halts |
| `openclaw_evalbench/fake_gateway.py`, `fixtures/` | the fake gateway and its fixture turns, runaways included; it admits a runaway's children as the product does |
| `probes/product-probe.mts`, `probes/receipts/` | the caps and admission through the product's own code at each SHA, and what it printed |

Scorers: `trajectory_matcher`, `token_consumption`, `continuation_election`. No LLM judge in the run, and no simulated user
(`max_turns: 1`, `generator: noop`): the awareness judge is a step of its own, after it.

## Install and test (no model, no gateway)

```bash
cd tools/evalbench-openclaw
./bootstrap.sh            # clones EvalBench at EVALBENCH_PIN outside the repo, uv sync --frozen, regenerates its protobuf stubs
./run.sh test             # adapter tests
./run.sh offline --out /tmp/evalprop-offline                          # 360 trials against four fake gateways, supervised as a fire is
./run.sh offline --out /tmp/evalprop-offline-d --arms A,B,C,D,E       # 450, with arm D
```

The fake gateway models Tool Search's controls for the fleet default, so a rehearsal's A, C and E report 7, 10 and 10 direct
tools, not the probe's Code Mode 6, 9 and 9; under the direct-tools overlay it reports the probe's own 66. The tests start
and kill their own processes, and, where there is a systemd user manager, transient units under random names
of their own; no OpenClaw and no unit of a run is involved. `uv` must be on `PATH` (or set `UV`). `OPENCLAW_EVALBENCH_HOME` moves the install; the default is
`~/.cache/openclaw-evalbench`.

## Firing it: for a seat owner

**Not without a go.** A live fire spends provider quota and needs the seat owner's own sign-in. 🌿 brings the plan
to the frond. Never point an arm at a live gateway: the adapter refuses port 18789 and any gateway with a channel.

The first fire is the canary on elliott. [`CANARY-PACKET.md`](CANARY-PACKET.md) has its exact commands, what it creates and
how each piece is removed, its spend, and its pass and stop rules. In outline, for any seat:

1. **Stage the three builds** with `deploy-gateway.yml` (`stage_only=true`) and check that each `dist/build-info.json` names its SHA.
2. **Set up one isolated gateway per arm** with frond-scribe `scripts/proof-gw/composite-launcher.sh`:

   ```bash
   L=~/flesh_beast_best_beast/frond-scribe/scripts/proof-gw/composite-launcher.sh
   AB5A=ab5a30ea79b776f149e24b1fccab9e79b0a5d299; F9FC=f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306; DE55=de55f3505d930427538359fdfeb256874486ed9f
   # The launcher names its state dir and unit from the first 8 hex of its first argument, so two arms on one build
   # need different first arguments. B's and D's are labels, not commits; E's build is its own:
   BLABEL=$(printf 'openclaw#1575 arm B of %s' "$AB5A" | sha1sum | cut -c1-40)
   DLABEL=$(printf 'openclaw#1575 arm D of %s' "$F9FC" | sha1sum | cut -c1-40)
   export PROOF_PRIMARY_MODEL="$(./run.sh model)" PROOF_FALLBACK_MODELS='[]'
   PORT=20846 bash $L setup $AB5A   $AB5A
   PORT=20966 bash $L setup $BLABEL $AB5A
   PORT=21086 bash $L setup $F9FC   $F9FC
   PORT=21206 bash $L setup $DLABEL $F9FC      # only for arm D
   PORT=21326 bash $L setup $DE55   $DE55
   ```

3. **Stop each gateway, apply each arm's config**, then sign in. `login` starts it again on the edited file.

   ```bash
   PORT=20846 bash $L stop $AB5A $AB5A; PORT=20966 bash $L stop $BLABEL $AB5A; PORT=21086 bash $L stop $F9FC $F9FC   # and D
   PORT=21326 bash $L stop $DE55 $DE55
   ./run.sh overlay A ~/proof-gw/comp-${AB5A:0:8}/openclaw.json
   ./run.sh overlay B ~/proof-gw/comp-${BLABEL:0:8}/openclaw.json
   ./run.sh overlay C ~/proof-gw/comp-${F9FC:0:8}/openclaw.json
   ./run.sh overlay E ~/proof-gw/comp-${DE55:0:8}/openclaw.json
   PORT=20846 bash $L login $AB5A $AB5A      # device code, relayed privately; then:
   PORT=20846 bash $L login-finish $AB5A $AB5A
   # the same for B (20966, $BLABEL $AB5A), C (21086, $F9FC $F9FC) and E (21326, $DE55 $DE55), and D (21206, $DLABEL $F9FC) if it runs
   ```

   `overlay` sets `agents.defaults.skipBootstrap: true` in every arm. A fresh workspace would otherwise be seeded
   with the first-run ritual, and one trial's answer to it would leak into the next. It also writes the firing model and
   points `logging.file` into the gateway's own state: without that, an isolated gateway writes to the live gateway's
   rolling log in `/tmp/openclaw` and prunes it. It writes the [spend caps and admission settings](#spend-caps-and-admission) too.
4. **Preflight** (reads only; no session, no model turn):

   ```bash
   export OPENCLAW_EVAL_TOKEN_FILE_A=~/proof-gw/comp-${AB5A:0:8}/gateway.token    # and _B, _C, _E (_D)
   ./run.sh preflight
   ```

5. **Canary**, 12 trials (one control, one `continue_work` prompt and one `continue_delegate` prompt per arm, on A, B, C and
   E), read by the rules in the packet. A lower `--token-budget` is still checked between trials; `--run-token-cap` and `--run-seconds` are the
   supervisor's, and stop what is running:

   ```bash
   ./run.sh run --go <owner-message-id> --out ~/proof-runs/evalprop-canary --num-trials 1 --token-budget 800000 \
     --run-token-cap 2400000 --run-seconds 1800 --scenarios c1-arithmetic,w1-file-appears,d1-second-pair-of-eyes
   ```

6. **The fire**, 360 trials (`--arms A,B,C,D,E` for 450), on its own go. Its totals are the fire's, said out loud: without the two
   options a run has the canary's, and stops there.

   ```bash
   ./run.sh run --go <owner-message-id> --out ~/proof-runs/evalprop-$(date -u +%Y%m%dT%H%M%SZ) \
     --run-token-cap 75000000 --run-seconds 14400
   ```

7. **Afterwards**: every gateway is already stopped. Copy the CSVs, `report.md` and `report.csv`, then the packet's emergency
   stop (for what a person may have left) and its `finish` for each gateway.
   Read `evals.csv` before publishing it. It holds the models' replies and shell commands, and so does `private/`.

`--go` takes the message id of the owner's go, and it is written into the run's manifest. Without it, `run` refuses.

### Cost of one full fire

360 trials: 18 prompts × 5 repetitions × 4 arms (A, B, C, E). **Expected**: 65 M metered tokens, range 22–130 M, most of it
cache reads, and roughly 1.5–3 hours with the four arms running together (more if the provider's rate limit, which they
share, holds them back). **Enforced**: 4 h for the run (`--run-seconds`) and 480 s a trial, each + 1 s, and the admission
above. **Where the supervisor stops it**: 75 M for the run (`--run-token-cap`, unchanged) and 0.70 M a trial; what the arms
in flight spend until the kill is conditional, 4 × 5.0 M at 5 s a call and 628 k a call
([the packet's arithmetic](CANARY-PACKET.md#conditional)). The central estimate is under the 75 M stop and the high one is
not: a fire that spends at that rate is stopped there, every arm with it, and the prompts left short need a top-up on a go
of their own. The 35 M stop per arm is checked between trials. **Arm E is one more arm like C**: 90 trials and about 16 M
(5.4–33 M), with C's 9 direct tools, so nearer A and C than B. **Arm D adds 90 trials and about 16 M** more, for 80 M
(27–165 M) in all, past the 75 M stop even at the centre: it needs a higher cap, which is the seat owner's call. D carries
every tool's schema as B does, so expect both above A, C and E. The caps stop the later turns the estimate allows for (its
+35 %), so it is high if anything. The arithmetic is in [`REPORT.md`](REPORT.md#cost-of-one-full-fire).

### Top-ups and re-reports

A run leaves its gateways stopped. `login-finish` starts one again on the sign-in it already has, unless it was stopped for a
reason or in the middle of a trial: that one is shredded and set up again.

```bash
./run.sh run --go <id> --out <new-dir> --num-trials 1 --scenarios <prompts below 5 scored trials> --arms <arm>
./run.sh report --job A=<dir>/results/<job> --job A=<top-up>/results/<job> --job B=… --job C=… --job E=… \
  --manifest <dir>/manifest.json --csv <dir>/report.csv --judge-input <dir>/private/awareness-judge-input-topped-up.jsonl
./run.sh report --job A=… --job B=… --job C=… --job E=… --manifest <dir>/manifest.json --awareness <labels.jsonl>    # a judge's labels
```

A top-up can change which trials the awareness sample takes, since it takes only trials the rates count: `--judge-input`
writes the sample's input again, and labels made before it read `incomplete` until the new items are judged.
