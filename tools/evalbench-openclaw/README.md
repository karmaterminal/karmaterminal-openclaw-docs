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
- **Wording means all of f9fcd3a5's text**, not one description: the three descriptions, the `## Tooling` slots,
  the "You control your own turn cycle" line and the wake-line correction.
- **A deferred tool is not a hidden one.** In arm A the system prompt still teaches `continue_work` and
  `continue_delegate`, because the catalog's names count as capabilities
  (`attempt-tool-catalog.ts:192-206`). What A lacks is their schema on the direct surface.

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
  (`tools/k6-proofs/lib/tool-call-identity.mjs`), and `tests/test_k6_parity.py` runs both over the same rows.
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

A trial is **scored** when its turn ended (or hit the deadline), its gateway is the arm's commit, its surface
matches the arm, and the pinned model served it. Anything else is **unscored** and leaves every denominator.
A deadline is scored by what the history shows: leaving those out would drop the turns that sat in a polling loop
instead of electing, and that would inflate the rate.

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
narrow on its own. That is why a comparison also needs the interval that resamples whole prompts.

A comparison is **not reportable** if either arm has any prompt with fewer than 5 scored trials, or any trial whose
surface contradicted the arm. The rates are still printed.

## Stop rules

The adapter enforces these itself. Once one fires, every later trial of that arm returns at once, unscored.

| rule | limit |
| --- | --- |
| wrong gateway: not loopback, port 18789, a channel configured, commit or config not the arm's | first occurrence |
| surface contradicts the arm | first occurrence |
| provider quota, auth or rate-limit error | first occurrence |
| cleanup of a trial's session failed (an armed wake could keep spending) | first occurrence |
| infrastructure errors in a row | 3 |
| metered tokens (cache reads included), per arm | `--token-budget`, default 30,000,000 |
| one trial | 600 s, then `sessions.abort` |

Every trial ends by stopping what it started: list children, abort, archive and delete each session
(`sessions.delete` ends the session's continuations and its subagents). A budget stop is a cutoff checked between
trials, not a hard ceiling.

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

5. **Canary**, 3 trials (one control prompt per arm). It proves the surface reading before the money:

   ```bash
   ./run.sh run --go <owner-message-id> --out ~/proof-runs/evalprop-canary --num-trials 1 --scenarios c1-arithmetic
   ```

   Stop unless every arm says `surface: verified`.
6. **The fire**, 270 trials:

   ```bash
   ./run.sh run --go <owner-message-id> --out ~/proof-runs/evalprop-$(date -u +%Y%m%dT%H%M%SZ)
   ```

7. **Afterwards**: copy the CSVs and `report.md`, then `composite-launcher.sh stop` and `shred` for each gateway.
   Read `evals.csv` before publishing it. It holds the models' replies and shell commands.

`--go` takes the message id of the owner's go, and it is written into the run's manifest. Without it, `run` refuses.

### Cost of one full fire

270 trials. Estimated **50 M metered tokens, range 25–100 M**, about 85–95 % of it cache reads, and roughly
1.5–3 hours with the three arms running together. The arithmetic is in [`REPORT.md`](REPORT.md#cost-of-one-full-fire).
