# Continuation propensity on EvalBench

How often does a model reach for `continue_work`, `continue_delegate` or `request_compaction` when the turn calls
for it, and how often when it does not? This harness answers with one rate and one 95 % interval per product arm
(karmaterminal/openclaw#1575). It runs on [GoogleCloudPlatform/evalbench](https://github.com/GoogleCloudPlatform/evalbench)
(Apache-2.0), pinned in [`EVALBENCH_PIN`](EVALBENCH_PIN) and installed from that pin. EvalBench's tree is never
copied into this repository.

**Nothing here has been fired live.** Every number in this directory comes from the fake gateway.
[`REPORT.md`](REPORT.md) says what was built, what was tested, and what EvalBench could not do.

## The question, and the three arms

figs, 2026-11-25: the continuation tools are used on about 0.03 % of turns, and we argue about wording without
measuring it. openclaw#1575 found two causes, so the arms separate them.

| arm | build | config | how the continuation tools reach the model | text |
| --- | --- | --- | --- | --- |
| **A** | `ab5a30ea79b776f149e24b1fccab9e79b0a5d299` | fleet default | deferred (found by searching) | ab5a |
| **B** | `ab5a30ea79b776f149e24b1fccab9e79b0a5d299` | direct-tools overlay | direct | ab5a |
| **C** | `f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306` | fleet default | direct (`catalogMode: "direct-only"`) | control-first |

- **A vs B** is the visibility effect: same build, same text, only the surface changes.
- **B vs C** is the wording effect: direct in both, different text.
- **A vs C** is what a deploy of f9fcd3a5 would change. It is descriptive, not a primary comparison.

[`arms.json`](arms.json) holds the SHAs, the overlay, the expected surface and the sha256 of each description.

### Arm B needs more than `tools.toolSearch: false`

The workorder asked for this to be confirmed in source. At ab5a, turning Tool Search off does not make the tools
direct on every runtime a seat can use:

| runtime | what defers the tools | makes them direct |
| --- | --- | --- |
| embedded, Tool Search | `tools.toolSearch` unset means on (`src/agents/tool-search-config.ts:8-12`) | `tools.toolSearch: false` |
| embedded, Code Mode | `tools.codeMode` unset means `"auto"` (`src/agents/code-mode-runtime.ts:72-78`), which engages for a model whose catalog entry says `codeMode: "preferred"` (`:128-140`). `openai/gpt-5.6-sol` says so (`extensions/openai/openclaw.plugin.json:220-236`). Code Mode wins over Tool Search (`src/agents/tool-surface-plan.ts:100-104`). | `tools.codeMode: false` |
| Codex harness | `codexDynamicToolsLoading`, default `"searchable"`: every tool not always-direct and not `direct-only` is sent with `deferLoading: true` (`extensions/codex/src/app-server/dynamic-tool-catalog.ts:80-97`). `tools.toolSearch` is not read there. | `plugins.entries.codex.config.codexDynamicToolsLoading: "direct"` |

So arm B's overlay sets all three keys. Whichever runtime a seat takes, B is direct, and the keys that don't apply
to that runtime change nothing. No arm is taken on faith: each trial **measures** its surface (below).

### What the contrasts do and don't isolate

- **B makes every tool direct, not only the three.** Its tool list is longer than C's. B vs C therefore also
  compares "everything direct" with "only the continuation tools direct". A clean wording contrast needs a fourth
  arm, f9fcd3a5 with B's overlay. The harness takes it as one more model config and one more `arms.json` entry. It
  is not part of the pre-declared fire.
- **What "wording" covers depends on the runtime**, by code reading at both SHAs:
  - *Embedded:* all of f9fcd3a5's text: the three descriptions, the `## Tooling` slots, the "You control your own
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

Model: `openai/gpt-5.6-sol`, no fallbacks, thinking level and temperature as deployed (the launcher copies the
seat's `agents.defaults`; gpt-5.6-sol takes no temperature). A trial served by any other model is invalid.

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
description text match the arm, and the pinned model served it. Anything else is **unscored** and leaves every
denominator, EvalBench's own included.

A turn stopped at the deadline is scored by what its history shows. Leaving those out would drop the turns that sat in
a polling loop instead of electing, and that would inflate the rate. The gateway stores no prompt report for a stopped
turn, so it carries the arm's surface from an earlier trial of the run, measured on the same gateway process and
configuration. The controls run first, so there is one. If its history can't be read, or nothing was verified yet, it
is `deadline_unreadable`: unscored, counted on its own, and the report prints the eligible rate if none of those elected.

### Known limits

- **Shared host state.** The three arms run at once on one seat. Three prompts name files under `/tmp/evalprop`, which
  nothing creates; `run` refuses to start if it exists, and every trial records whether it does. Each arm's workspace
  and any automation a model creates outlive the trial's session. The report prints how many distinct system prompts
  an arm saw.
- **Served model.** It is read from the assistant rows. A turn of calls with no reply can leave none, and that is how a
  turn that only elected looks, so the session's own selection stands in (the arm has no fallbacks) and the record says so.
- **Nothing was recorded live.** The fixture turns are written from product source. `REPORT.md` lists what only a live
  canary can settle.

## Pre-declared statistics

Fixed here before any live fire:

| | |
| --- | --- |
| repetitions | **5** per prompt per arm: 60 eligible and 30 control trials per arm, **270 trials** in all |
| per arm | election rate on eligible prompts; false-election rate on controls; each with a **Wilson 95 %** interval |
| primary comparisons | **A vs B** (visibility) and **B vs C** (wording): difference in eligible election rate |
| interval on a difference | Newcombe's hybrid score interval, **and** a bootstrap over prompts (10,000 resamples, seed 1575) |
| "there is an effect" | only when **both** intervals exclude zero. One of two is "unclear" |
| cost of an effect | a wording or visibility gain counts only beside the control false-election rate of the same arm |
| per prompt | elected / scored for every prompt and arm, always printed |

Wilson treats the trials as independent. Five repetitions of one prompt are not, so the pooled interval is too
narrow on its own. That is why a comparison also needs the interval that resamples whole prompts. With 12 eligible
prompts that bootstrap is itself a little too narrow, which is one more reason to require both.

A top-up job may replace unscored trials. Only each prompt's first 5 scored trials count, in the order the jobs are given,
so a top-up never gives a prompt extra weight.

A comparison is **not reportable** if either arm has a prompt with fewer than 5 scored trials, a trial whose surface or
text contradicted the arm, more than one runtime, a record that disagrees with EvalBench's own score row, or a runtime
the other arm didn't run on. The rates are still printed.

## Stop rules

The adapter enforces these itself. Once one fires, every later trial of that arm returns at once, unscored.

| rule | limit |
| --- | --- |
| wrong gateway: not loopback, port 18789, a channel configured, commit or config not the arm's | first occurrence |
| surface or description text contradicts the arm, or another model served a turn | first occurrence |
| provider quota, auth or rate-limit error | first occurrence |
| cleanup of a trial's session failed (an armed wake could keep spending) | first occurrence |
| infrastructure errors or unreadable deadlines in a row | 3 |
| metered tokens (cache reads included), per arm | `--token-budget`, default 35,000,000 |
| one trial | 600 s, then `sessions.abort` |

The budget charges the turn, any later turn of its session, and every session spawned under it. A turn the gateway
reports no usage for is charged 150,000, so the budget never runs on zeros. It is a cutoff checked between trials, not a
hard ceiling.

Every trial ends by stopping what it started: its session is archived and deleted first (`sessions.delete` ends the
session's continuations and its subagents), then every session linked under it, until a listing shows none.

## How it fits EvalBench

```
run.sh run ── in-process EvalBench EvalService (gRPC, loopback)
                 │  AgentInteract: one bidirectional stream per arm
                 ▼
              adapter (gRPC client) ── WS ──► arm A gateway :18846
                                        ├────► arm B gateway :18847
                                        └────► arm C gateway :18848
```

In EvalBench's agent proxy protocol **EvalBench is the gRPC server and the agent connects to it**. So the adapter is
a client that answers `TurnRequest`s. Each arm is one EvalBench job with its own model config, and the three jobs
run at the same time, so provider drift lands on all arms alike.

| file | what it is |
| --- | --- |
| `configs/model_arm_{a,b,c}.yaml` | the three model configs: arm name and gateway URL. Tokens are never in a config: EvalBench copies configs into `configs.csv` |
| `configs/run_config.yaml` | dataset, scorers, trials, CSV reporting |
| `openclaw_evalbench/adapter.py`, `trial.py` | the gRPC worker, and one trial over WS |
| `openclaw_evalbench/gateway.py` | connect, auth and RPC frames (same identity and scopes as `tools/k6-proofs/lib/gateway-ws.js`) |
| `openclaw_evalbench/transcript.py`, `surface.py` | history → turn facts; prompt report → surface verdict |
| `openclaw_evalbench/generator.py` | a subclass of EvalBench's `agent_grpc_proxy` (EvalBench's `generator_class` hook) |
| `scorers/continuation_election.py` | EvalBench `python_scorer`: 100 when the turn elected |
| `openclaw_evalbench/report.py`, `stats.py` | EvalBench's CSVs → per-arm rates, intervals and comparisons |
| `openclaw_evalbench/fake_gateway.py`, `fixtures/` | the fake gateway and its fixture turns |

Scorers: `trajectory_matcher`, `token_consumption`, `continuation_election`. No LLM judge, no simulated user
(`max_turns: 1`, `generator: noop`).

## Install and test (no model, no gateway)

```bash
cd tools/evalbench-openclaw
./bootstrap.sh            # clones EvalBench at EVALBENCH_PIN outside the repo, uv sync --frozen, regenerates its protobuf stubs
./run.sh test             # adapter tests
./run.sh offline --out /tmp/evalprop-offline      # all 270 trials against three fake gateways
```

`uv` must be on `PATH` (or set `UV`). `OPENCLAW_EVALBENCH_HOME` moves the install; the default is
`~/.cache/openclaw-evalbench`.

## Firing it: for a seat owner

**Not without a go.** A live fire spends provider quota and needs the seat owner's own sign-in. 🌿 brings the plan
to the frond. Never point an arm at a live gateway: the adapter refuses port 18789 and any gateway with a channel.

1. **Stage both builds on the seat** with `deploy-gateway.yml` (`stage_only=true`): `ab5a30ea79b776f149e24b1fccab9e79b0a5d299`
   and `f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306`. Check that each `dist/build-info.json` names its SHA.
2. **Set up one isolated gateway per arm** with frond-scribe `scripts/proof-gw/composite-launcher.sh`:

   ```bash
   L=~/flesh_beast_best_beast/frond-scribe/scripts/proof-gw/composite-launcher.sh
   AB5A=ab5a30ea79b776f149e24b1fccab9e79b0a5d299; F9FC=f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306
   # The launcher names its state dir and unit from the first 8 hex of its first argument, so A and B (same build)
   # need different first arguments. B's is a label, not a commit:
   BLABEL=$(printf 'openclaw#1575 arm B of %s' "$AB5A" | sha1sum | cut -c1-40)
   export PROOF_PRIMARY_MODEL=openai/gpt-5.6-sol PROOF_FALLBACK_MODELS='[]'
   PORT=18846 bash $L setup $AB5A   $AB5A
   PORT=18847 bash $L setup $BLABEL $AB5A
   PORT=18848 bash $L setup $F9FC   $F9FC
   ```

3. **Apply each arm's config**, then sign in. `login-finish` restarts the gateway on the edited file.

   ```bash
   ./run.sh overlay A ~/proof-gw/comp-${AB5A:0:8}/openclaw.json
   ./run.sh overlay B ~/proof-gw/comp-${BLABEL:0:8}/openclaw.json
   ./run.sh overlay C ~/proof-gw/comp-${F9FC:0:8}/openclaw.json
   PORT=18846 bash $L login $AB5A $AB5A      # device code, relayed privately; then:
   PORT=18846 bash $L login-finish $AB5A $AB5A
   # the same for B (18847, $BLABEL $AB5A) and C (18848, $F9FC $F9FC)
   ```

   `overlay` sets `agents.defaults.skipBootstrap: true` in every arm. A fresh workspace would otherwise be seeded
   with the first-run ritual, and one trial's answer to it would leak into the next.
4. **Preflight** (reads only; no session, no model turn):

   ```bash
   export OPENCLAW_EVAL_TOKEN_FILE_A=~/proof-gw/comp-${AB5A:0:8}/gateway.token    # and _B, _C
   ./run.sh preflight
   ```

5. **Canary**, 9 trials (one control, one `continue_work` prompt and one `continue_delegate` prompt per arm). It proves
   the surface reading, an election and its cleanup before the rest of the money:

   ```bash
   ./run.sh run --go <owner-message-id> --out ~/proof-runs/evalprop-canary --num-trials 1 \
     --scenarios c1-arithmetic,w1-file-appears,d1-second-pair-of-eyes
   ```

   Read the report's **Surface** section. Go on only if every arm says `surface: verified`, `contradictions: 0`, and the
   same single runtime.
6. **The fire**, 270 trials:

   ```bash
   ./run.sh run --go <owner-message-id> --out ~/proof-runs/evalprop-$(date -u +%Y%m%dT%H%M%SZ)
   ```

7. **Afterwards**: copy the CSVs and `report.md`, then `composite-launcher.sh stop` and `shred` for each gateway.
   Read `evals.csv` before publishing it. It holds the models' replies and shell commands.

`--go` takes the message id of the owner's go, and it is written into the run's manifest. Without it, `run` refuses.

### Cost of one full fire

270 trials. Estimated **50 M metered tokens, range 16–100 M**, most of it cache reads, and roughly 1.5–3 hours with the
three arms running together. The arithmetic is in [`REPORT.md`](REPORT.md#cost-of-one-full-fire).

### Top-ups and re-reports

```bash
./run.sh run --go <id> --out <new-dir> --num-trials 1 --scenarios <prompts below 5 scored trials> --arms <arm>
./run.sh report --job A=<dir>/results/<job> --job A=<top-up>/results/<job> --job B=… --job C=…
```
