# Continuation propensity on EvalBench

How often does a model reach for `continue_work`, `continue_delegate` or `request_compaction` when the turn calls
for it, and how often when it does not? This harness answers with one rate and one 95 % interval per product arm
(karmaterminal/openclaw#1575). It runs on [GoogleCloudPlatform/evalbench](https://github.com/GoogleCloudPlatform/evalbench)
(Apache-2.0), pinned in [`EVALBENCH_PIN`](EVALBENCH_PIN) and installed from that pin. EvalBench's tree is never
copied into this repository.

**Nothing here has been fired live.** Every number in this directory comes from the fake gateway.
[`REPORT.md`](REPORT.md) says what was built, what was tested, and what EvalBench could not do.
[`CANARY-PACKET.md`](CANARY-PACKET.md) is the nine-trial canary on elliott, for 🌻 to approve or not.

## The question, and the arms

figs, 2026-11-25: the continuation tools are used on about 0.03 % of turns, and we argue about wording without
measuring it. openclaw#1575 found two causes, so the arms separate them.

| arm | build | config | direct tools | text |
| --- | --- | --- | --- | --- |
| **A** | `ab5a30ea79b776f149e24b1fccab9e79b0a5d299` | fleet default | the fleet default's; the continuation tools are deferred (found by searching) | ab5a |
| **B** | `ab5a30ea79b776f149e24b1fccab9e79b0a5d299` | direct-tools overlay | every tool | ab5a |
| **C** | `f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306` | fleet default | the fleet default's plus the three continuation tools (`catalogMode: "direct-only"`) | control-first |
| **D** (optional, off by default) | `f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306` | direct-tools overlay | every tool | control-first |

| contrast | name | what it holds fixed |
| --- | --- | --- |
| A → B | **visibility (all tools direct)** | build and text |
| B → C | **composite: new text + direct-set narrowing** | nothing but the continuation tools being direct. It is **not** the wording effect |
| B → D | wording (all tools direct), only with D | every tool direct in both |
| D → C | placement: direct-set narrowing (new text), only with D | build and text |
| A → C | deploy of f9fcd3a5, descriptive | nothing: it is what a deploy would change |

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
- **B → C is a composite.** It changes the text *and* narrows the direct set from every tool to the fleet default's plus
  the three continuation tools, with Code Mode (or Tool Search) back on for the rest. Its size says nothing about the
  wording alone, and neither does its sign.
- **Arm D separates the two.** D is C's build under B's overlay. B → D isolates the wording, with every tool direct in
  both. D → C isolates placement, with the same build and text. On the same trials the two differences add up to B → C
  exactly. D is off unless it is named (`--arms A,B,C,D`), costs about as much as any arm (below), and the report treats
  it like any arm.
- **On the Codex harness B → D is not pure wording.** There f9fcd3a5's direct-only tools go into the `openclaw_direct`
  namespace even under direct loading (`dynamic-tool-catalog.ts:60,89-92`), while B's are root functions. On the embedded
  runtime nothing but the text differs.
- **What "wording" covers depends on the runtime**, by code reading at both SHAs:
  - *Embedded (elliott):* all of f9fcd3a5's text: the three descriptions, the `## Tooling` slots, the "You control your own
    turn cycle" line, the delegate lines, the wake-line correction and the rewritten `sessions_yield` section.
  - *Codex harness:* the three **descriptions only**. Codex builds its prompt with `buildAgentHarnessBasePrompt`
    (`extensions/codex/src/app-server/thread-prompt.ts:117`, `src/agents/system-prompt-harness-base.ts`). The
    continuation section and the `## Tooling` slots come from `src/agents/system-prompt.ts:585,811`, which Codex
    doesn't use. B and C also differ in placement there: B's tools are root functions, and C's sit in the
    `openclaw_direct` namespace (`dynamic-tool-catalog.ts:89-103`).
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

What the product's catalog says it accepts, at **both** SHAs (`extensions/openai/openclaw.plugin.json:119-144`; the file,
`packages/ai` and the thinking policy are byte-identical between ab5a30ea and f9fcd3a5):

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
- **Served model.** It is read from the assistant rows. A turn of calls with no reply can leave none, and that is how a
  turn that only elected looks, so the session's own selection stands in (the arm has no fallbacks) and the record says so.
- **Nothing was recorded live.** The fixture turns are written from product source. `REPORT.md` lists what only a live
  canary can settle.

## Pre-declared statistics

Fixed here before any live fire:

| | |
| --- | --- |
| repetitions | **5** per prompt per arm: 60 eligible and 30 control trials per arm, **270 trials** in all (360 with D) |
| per arm | election rate on eligible prompts; false-election rate on controls; each with a **Wilson 95 %** interval |
| primary comparisons | **A → B** (visibility, all tools direct) and **B → C** (composite: new text + direct-set narrowing): difference in eligible election rate. If D is fired, also **B → D** (wording) and **D → C** (placement) |
| interval on a difference | Newcombe's hybrid score interval, **and** a bootstrap over prompts (10,000 resamples, seed 1575) |
| "there is an effect" | only when **both** intervals exclude zero. One of two is "unclear" |
| cost of an effect | a gain counts only beside the control false-election rate of the same arm |
| several comparisons | no correction. Each is read on its own, and D adds two |
| per prompt | elected / scored for every prompt and arm, always printed |

Wilson treats the trials as independent. Five repetitions of one prompt are not, so the pooled interval is too
narrow on its own. That is why a comparison also needs the interval that resamples whole prompts. With 12 eligible
prompts that bootstrap is itself a little too narrow, which is one more reason to require both.

A top-up job may replace unscored trials. Only each prompt's first 5 scored trials count, in the order the jobs are given,
so a top-up never gives a prompt extra weight.

A comparison is **not reportable** if either arm has a prompt with fewer than 5 scored trials, a trial whose surface or
text contradicted the arm, more than one runtime, a record that disagrees with EvalBench's own score row, or a runtime
the other arm didn't run on. The rates are still printed.

## Spend caps

Three layers bound what a trial can spend. The first is the product's own configuration, and the other two don't trust it.

### 1. The product's caps, the same on every arm

They are `caps` in [`arms.json`](arms.json). `overlay` writes them over whatever the seat's configuration says. A trial reads
them back (`config.get`) **before and after** it runs: each cap has to be in the authored file, in the effective configuration,
and in the revision the running gateway has applied (`configRevisionHash` = `appliedConfigHash`,
`src/gateway/config-get-response.ts:32-37`). A trial that fails that, or in which a continuation wake ran, is `caps_mismatch`:
unscored, and it **halts every arm**. The report counts only trials whose caps were read back.

| cap | value | default, and where it is enforced (the same line at `ab5a30ea` and `f9fcd3a5`, unless two are given) |
| --- | --- | --- |
| `agents.defaults.continuation.maxChainLength` | 1 | 10 (`src/auto-reply/continuation/config.ts:18,110`); `continuation/scheduler.ts:27`, `reply/agent-runner-continuation-signal.ts:131` |
| `agents.defaults.continuation.costCapTokens` | 1 | 500,000 (`config.ts:19,114`); `scheduler.ts:34`, `agent-runner-continuation-signal.ts:151` (the turn's own input and output count), `continuation/delegate-dispatch.ts:315` |
| `agents.defaults.continuation.maxDelegatesPerTurn` | 1 | 5 (`config.ts:20,118`); `src/agents/tools/continue-delegate-tool.ts:373` at ab5a, `:375` at f9fc; `delegate-dispatch.ts:180` |
| `agents.defaults.subagents.maxSpawnDepth` | 1 | 5 (`src/config/agent-limits.ts:24`); `src/agents/child-admission.ts:85`, `spawn-plan.ts:303` |
| `agents.defaults.subagents.maxChildrenPerAgent` | 1 | 5 (`agent-limits.ts:21`); `child-admission.ts:97`, `spawn-plan.ts:327` |
| `agents.defaults.subagents.maxConcurrent` | 1 | 8 (`agent-limits.ts:20,43`); `src/gateway/server-lanes.ts:83` |
| `agents.defaults.subagents.runTimeoutSeconds` | 120 | none (`src/agents/subagents/spawn/subagent-spawn-plan.ts:42`; a spawn's own `runTimeoutSeconds` outranks it) |
| `tools.swarm.maxConcurrent`, `.maxChildrenPerGroup`, `.maxTotalPerGroup` | 1, 1, 1 | 32, 50, 200 (`src/agents/subagents/swarm/swarm-config.ts:6-8`); `child-admission.ts:91,97`. Per group, and the group id is the caller's |
| `agents.defaults.timeoutSeconds` | 330 | 48 h (`src/agents/timeout.ts:13,25`), per model attempt |
| `agents.defaults.maxConcurrent` | 2 | 8 or 4 per CPU (`agent-limits.ts:5-6,35`); `server-lanes.ts:33,75` |

- **`costCapTokens: 1` is the one that matters.** A continuation tool answers `scheduled` without looking at the budget; the
  budget is read when the turn ends, and by then the turn's own output is over the cap. So the election happens, and is
  answered, recorded and scored, and its wake or delegate never runs. `maxChainLength: 1` is behind it, for a turn whose usage
  the provider did not report. A delegate with a delay is checked when it fires (`agent-runner-continuation-schedule.ts:73`):
  its session is deleted by then, or the one-child cap holds it.
- **Swarm collectors are a second way to have children**, which `maxChildrenPerAgent` does not count (`spawn-plan.ts:307-316`).
  An agent's own `tools.swarm` limits outrank the global ones (`swarm-config.ts:29`), so `overlay` clears those three keys from
  `agents.entries.main` and preflight refuses them. The agent's `enabled` switch is the seat's surface and is left alone.
- **`request_compaction` needs none**: 70 % of the context (`src/agents/tools/request-compaction-tool.ts:26`), once in 5 minutes
  (`:29`), and refused as `context_unmeasured` on a session's first turn (`:220`).
- **Loop detection and cron are left as they are.** Loop thresholds are constants (`src/agents/tool-loop-thresholds.ts:1`, used at
  `tool-loop-detection.ts:590-594`), and its warnings are text the model reads, before it may elect. `cron.enabled: false` would
  show in what `automations` answers (`src/cron/service/ops-read.ts:49-55`), the tool a turn might take instead.

They are tight on purpose and must not move the **first** election, which is all that is scored. Run through the product's own
code at both SHAs: the config schema accepts them; `continue_work` and `continue_delegate` answer `scheduled` under them; and the
49 tools the product builds have the same names, descriptions and parameters with and without them (with swarm switched off
instead, they differ). What a turn can notice before its first election is a refusal it earned: a second child while the first
runs, or a child of a child.

### 2. The supervisor

`run` starts it as a process of its own, in a transient unit of its own, and sends nothing until it is armed. It reads each
gateway's usage on its own connection, keeps its own clock, and enforces `supervision` in [`arms.json`](arms.json):

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
the stop by that trial's spend. What bounds that trial is the supervisor: 0.70 M, and 0.64 M for one polling interval
([the packet](CANARY-PACKET.md#spend)).

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
                                        └────► arm D gateway :21206  (only when named)
```

In EvalBench's agent proxy protocol **EvalBench is the gRPC server and the agent connects to it**. So the adapter is
a client that answers `TurnRequest`s. Each arm is one EvalBench job with its own model config, and the jobs
run at the same time, so provider drift lands on all arms alike.

The ports are 120 apart and start past the live gateway's. A gateway also derives ports, up to its own + 110
(`docs/gateway/multiple-gateways.md:20,107-113` at ab5a30ea): 18789 owns 18790–18899.

| file | what it is |
| --- | --- |
| `configs/model_arm_{a,b,c,d}.yaml` | the arms' model configs: arm name and gateway URL; a run adds the firing model. Tokens are never in a config: EvalBench copies configs into `configs.csv` |
| `configs/run_config.yaml` | dataset, scorers, trials, CSV reporting |
| `openclaw_evalbench/adapter.py`, `trial.py` | the gRPC worker, and one trial over WS |
| `openclaw_evalbench/gateway.py` | connect, auth and RPC frames (same identity and scopes as `tools/k6-proofs/lib/gateway-ws.js`) |
| `openclaw_evalbench/transcript.py`, `surface.py` | history → turn facts; prompt report → surface verdict |
| `openclaw_evalbench/generator.py` | a subclass of EvalBench's `agent_grpc_proxy` (EvalBench's `generator_class` hook) |
| `scorers/continuation_election.py` | EvalBench `python_scorer`: 100 when the turn elected |
| `openclaw_evalbench/report.py`, `stats.py` | EvalBench's CSVs → per-arm rates, intervals and comparisons |
| `openclaw_evalbench/supervisor.py`, `meter.py`, `units.py` | the spend supervisor: its rules, its ledger, and how a gateway is proved and stopped |
| `openclaw_evalbench/supervision.py`, `stops.py` | the runner's side of it, and the halts |
| `openclaw_evalbench/fake_gateway.py`, `fixtures/` | the fake gateway and its fixture turns, runaways included |

Scorers: `trajectory_matcher`, `token_consumption`, `continuation_election`. No LLM judge, no simulated user
(`max_turns: 1`, `generator: noop`).

## Install and test (no model, no gateway)

```bash
cd tools/evalbench-openclaw
./bootstrap.sh            # clones EvalBench at EVALBENCH_PIN outside the repo, uv sync --frozen, regenerates its protobuf stubs
./run.sh test             # adapter tests
./run.sh offline --out /tmp/evalprop-offline                          # 270 trials against three fake gateways, supervised as a fire is
./run.sh offline --out /tmp/evalprop-offline-d --arms A,B,C,D         # 360, with arm D
```

The tests start and kill their own processes, and, where there is a systemd user manager, transient units under random names
of their own; no OpenClaw and no unit of a run is involved. `uv` must be on `PATH` (or set `UV`). `OPENCLAW_EVALBENCH_HOME` moves the install; the default is
`~/.cache/openclaw-evalbench`.

## Firing it: for a seat owner

**Not without a go.** A live fire spends provider quota and needs the seat owner's own sign-in. 🌿 brings the plan
to the frond. Never point an arm at a live gateway: the adapter refuses port 18789 and any gateway with a channel.

The first fire is the canary on elliott. [`CANARY-PACKET.md`](CANARY-PACKET.md) has its exact commands, what it creates and
how each piece is removed, its spend, and its pass and stop rules. In outline, for any seat:

1. **Stage both builds** with `deploy-gateway.yml` (`stage_only=true`) and check that each `dist/build-info.json` names its SHA.
2. **Set up one isolated gateway per arm** with frond-scribe `scripts/proof-gw/composite-launcher.sh`:

   ```bash
   L=~/flesh_beast_best_beast/frond-scribe/scripts/proof-gw/composite-launcher.sh
   AB5A=ab5a30ea79b776f149e24b1fccab9e79b0a5d299; F9FC=f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306
   # The launcher names its state dir and unit from the first 8 hex of its first argument, so two arms on one build
   # need different first arguments. B's and D's are labels, not commits:
   BLABEL=$(printf 'openclaw#1575 arm B of %s' "$AB5A" | sha1sum | cut -c1-40)
   DLABEL=$(printf 'openclaw#1575 arm D of %s' "$F9FC" | sha1sum | cut -c1-40)
   export PROOF_PRIMARY_MODEL="$(./run.sh model)" PROOF_FALLBACK_MODELS='[]'
   PORT=20846 bash $L setup $AB5A   $AB5A
   PORT=20966 bash $L setup $BLABEL $AB5A
   PORT=21086 bash $L setup $F9FC   $F9FC
   PORT=21206 bash $L setup $DLABEL $F9FC      # only for arm D
   ```

3. **Stop each gateway, apply each arm's config**, then sign in. `login` starts it again on the edited file.

   ```bash
   PORT=20846 bash $L stop $AB5A $AB5A; PORT=20966 bash $L stop $BLABEL $AB5A; PORT=21086 bash $L stop $F9FC $F9FC   # and D
   ./run.sh overlay A ~/proof-gw/comp-${AB5A:0:8}/openclaw.json
   ./run.sh overlay B ~/proof-gw/comp-${BLABEL:0:8}/openclaw.json
   ./run.sh overlay C ~/proof-gw/comp-${F9FC:0:8}/openclaw.json
   PORT=20846 bash $L login $AB5A $AB5A      # device code, relayed privately; then:
   PORT=20846 bash $L login-finish $AB5A $AB5A
   # the same for B (20966, $BLABEL $AB5A) and C (21086, $F9FC $F9FC), and D (21206, $DLABEL $F9FC) if it runs
   ```

   `overlay` sets `agents.defaults.skipBootstrap: true` in every arm. A fresh workspace would otherwise be seeded
   with the first-run ritual, and one trial's answer to it would leak into the next. It also writes the firing model and
   points `logging.file` into the gateway's own state: without that, an isolated gateway writes to the live gateway's
   rolling log in `/tmp/openclaw` and prunes it. It writes the [spend caps](#spend-caps) too.
4. **Preflight** (reads only; no session, no model turn):

   ```bash
   export OPENCLAW_EVAL_TOKEN_FILE_A=~/proof-gw/comp-${AB5A:0:8}/gateway.token    # and _B, _C (_D)
   ./run.sh preflight
   ```

5. **Canary**, 9 trials (one control, one `continue_work` prompt and one `continue_delegate` prompt per arm), read by the
   rules in the packet. A lower `--token-budget` is still checked between trials; `--run-token-cap` and `--run-seconds` are the
   supervisor's, and stop what is running:

   ```bash
   ./run.sh run --go <owner-message-id> --out ~/proof-runs/evalprop-canary --num-trials 1 --token-budget 800000 \
     --run-token-cap 2400000 --run-seconds 1800 --scenarios c1-arithmetic,w1-file-appears,d1-second-pair-of-eyes
   ```

6. **The fire**, 270 trials (`--arms A,B,C,D` for 360), on its own go. Its totals are the fire's, said out loud: without the two
   options a run has the canary's, and stops there.

   ```bash
   ./run.sh run --go <owner-message-id> --out ~/proof-runs/evalprop-$(date -u +%Y%m%dT%H%M%SZ) \
     --run-token-cap 75000000 --run-seconds 14400
   ```

7. **Afterwards**: every gateway is already stopped. Copy the CSVs and `report.md`, then the packet's emergency stop (for what a
   person may have left) and its `finish` for each gateway.
   Read `evals.csv` before publishing it. It holds the models' replies and shell commands.

`--go` takes the message id of the owner's go, and it is written into the run's manifest. Without it, `run` refuses.

### Cost of one full fire

270 trials. **Expected**: 50 M metered tokens, range 16–100 M, most of it cache reads, and roughly 1.5–3 hours with the three
arms running together. **Enforced**: 75 M and 4 h for the run (`--run-token-cap`, `--run-seconds`), plus one polling interval of
the three arms in flight (3 × 0.64 M), and 0.70 M a trial. The 35 M stop per arm is checked between trials. **Arm D adds 90
trials and about 16 M (5.4–33 M)**, for 65 M (22–130 M) in all, and needs a higher cap. It carries every tool's schema as B does,
so expect both above A and C. The caps stop the later turns the estimate allows for (its +35 %), so it is high if anything. The
arithmetic is in [`REPORT.md`](REPORT.md#cost-of-one-full-fire).

### Top-ups and re-reports

A run leaves its gateways stopped. `login-finish` starts one again on the sign-in it already has, unless it was stopped for a
reason or in the middle of a trial: that one is shredded and set up again.

```bash
./run.sh run --go <id> --out <new-dir> --num-trials 1 --scenarios <prompts below 5 scored trials> --arms <arm>
./run.sh report --job A=<dir>/results/<job> --job A=<top-up>/results/<job> --job B=… --job C=…
```
