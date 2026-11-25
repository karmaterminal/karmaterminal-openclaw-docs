# Report: continuation propensity on EvalBench

Bound to karmaterminal/openclaw#1575. **No live fire was run, and no number here is about a model.** The design and the
firing steps are in [`README.md`](README.md).

## Result

The harness is built on EvalBench at the pin. EvalBench was workable, so the k6 fallback was not built. Two complete
offline rehearsals ran against fake gateways, under the supervisor: 270 trials with arm D off, and 360 with it on. Every stage
of the path was exercised: gRPC, WS, history, scorers, supervision, CSVs and report. The CSVs are in
[`artifacts/offline-rehearsal/`](artifacts/offline-rehearsal/report.md) and
[`artifacts/offline-rehearsal-arm-d/`](artifacts/offline-rehearsal-arm-d/report.md).

**The canary's spend is now bounded by something that runs: 1.98 M metered tokens for one trial and 6.24 M for the nine, whatever
the readings do**, and 1.34 M and 4.32 M while every reading is on time. [`CANARY-PACKET.md`](CANARY-PACKET.md#spend) has the
arithmetic, what enforces each number, and what it rests on.

| ref | value |
| --- | --- |
| docs base | `main` at `07f70cb98eec70a341952f11eff02d71d19ff08d` (local = tracking = server) |
| reviewed heads this follows up | `52465362d18b761e5b0eab61026dbf8f39776413` (🌻's read of the packet, room 19:34Z, message 1575233154115969149); before it `cad3a0456f2426907b89caa1964d575bf047e42a` (🌿's review, 🌻's three conditions) |
| lane branch | `codeagent/cont-propensity-evalbench` (final SHA in the PR) |
| product, arms A and B | `ab5a30ea79b776f149e24b1fccab9e79b0a5d299` (server: `frond/1321-sovereign-loader-ab5a` and others) |
| product, arms C and D | `f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306` (server: `gloss/1575-continuation-surface`) |
| EvalBench | `86730417fe7b3f8ae01bc5159369293f60baa306` (release 1.22.0) |
| frond-scribe launcher read | `composite-launcher.sh` as of `67370bd94f19f9a0f89493d4f2b6360d5928183f` |
| openclaw-bootstrap workflow read | `main` at `51546ce6ac213d9e2f62c58a318248652a45e7e7` |
| CI / presentation | N/A / N/A |

## What changed for 🌻's spend condition

🌻's point at `52465362`: the expected 1.6 M is not a bound, and the 51 M and 276 M beside it were enforced by nothing.

| asked for | what it is now |
| --- | --- |
| product caps, the same on every arm | twelve, in `arms.json` `caps`. `overlay` writes them; each trial reads them back, authored, effective and applied, before and after. A trial whose caps didn't take is unscored and halts **every** arm. [README](README.md#spend-caps) cites each at both SHAs |
| the tightest values that still let the first election happen | `costCapTokens: 1` and `maxChainLength: 1`: the election is answered `scheduled`, and nothing follows it. One child, with none of its own. Run through the product's own code at both SHAs (below) |
| an external supervisor that doesn't trust the product | `supervisor.py`, a process and a unit of its own: a reading a second, a limit per trial, per run and outside a trial, its own clocks, active runs, and a gateway it can't read. `sessions.abort`, then SIGKILL of the unit, then what outlives it |
| a durable exec can't bypass it | any stop, and the end of every trial, ends every transient unit whose log, environment or binding is the gateway's. Tested with a real durable unit, beside the trap: stopping the gateway's own unit leaves it running |
| fake gateways that loop, spawn children and ignore aborts | each a process that dies for real, or a systemd unit. Stopped within its limit; its trial's cleanup ran and is on record; the run ended in order |
| the bound as enforced arithmetic | the packet's Spend section: expected and enforced in separate columns, what enforces each number, and how that was tested. A test recomputes it from `arms.json` |
| CI handoff | the packet's last section |

What reading the product for this found:

- **The packet's outer case was not the outer case.** Swarm collectors are a second way to have children: 32 at once and 50 per
  group by default, which the child cap doesn't count. They are capped, per group; a turn chooses its groups, so the supervisor's
  active-run limit stands behind that.
- **A child has no run timeout by default** (0 is none), and its spawn's own argument outranks the configured one.
- **The session list never shows a cron run**, so a supervisor reading only the list would not see one's spend.
  `sessions.usage`'s total is read beside the list. Cron itself is left on: switching it off shows in what `automations` answers.
- **The first supervised rehearsal under-counted**: 0.2 M against the harness's 10 M, because a trial against a fake gateway can
  live and go between two readings. A trial now closes on a fresh reading and on the harness's own count.

## What changed for the conditions before it

| condition | what it is now |
| --- | --- |
| the firing model | one value, `arms.json` `model` = `openai/gpt-6.1-sol` (elliott's live model). Launch, overlay, preflight, arm configs, scoring and report all read it. A test refuses a model named anywhere else in code, configs, fixtures or tests, and the model it replaced is named nowhere |
| "any other served model is unscored" | it already was, trial by trial. The **report** took each record's word for it, so an old run read again after a model change would have printed under the new model's name. It now checks, with a test that fails at `cad3a045` |
| temperature | `openai/gpt-6.1-sol` takes none, at both SHAs. What it does accept is in [`README.md`](README.md#the-firing-model) |
| spend wording | the per-arm stop is checked between trials, and not a ceiling: said in README, here, the packet, `--token-budget`'s help, the halt reason, the manifest and the report itself. A test refuses a document that states it without its rule |
| worst-case overshoot | now the supervisor's, above |
| contrast honesty | A → B "visibility (all tools direct)"; B → C "composite: new text + direct-set narrowing". The report prints what each comparison is, and each arm's direct and deferred tool counts |
| arm D | f9fcd3a5 under B's overlay, off by default. B → D and D → C split the composite |
| the packet | [`CANARY-PACKET.md`](CANARY-PACKET.md) |

Writing the packet found three isolation gaps in the fire as it was planned. All are closed here:

- **Ports.** 18846–18848 lie inside 18789–18899, which the live gateway's derived browser and CDP ports can use, and the arms
  overlapped one another's. They are now 120 apart, from 20846.
- **Log.** Nothing set `logging.file`, so an isolated gateway would have written to the live gateway's rolling log in
  `/tmp/openclaw` and pruned it. The overlay sets it; preflight refuses a gateway without one.
- **Outranking settings.** The launcher copies the seat's per-agent and per-model entries. A per-model `codeMode` outranks
  the overlay's `tools.codeMode`, and an agent-level `model` outranks the firing model. The surface and served-model checks
  would have caught both, after spending. The overlay now clears them and preflight refuses them.

## What EvalBench at the pin could not do, and what this harness does instead

Each trap has a test that shows EvalBench's stock behaviour beside ours (`tests/test_evalbench.py`).

| EvalBench at the pin | here |
| --- | --- |
| `trajectory_matcher` drops every tool name without `__` from both sides. With bare names every trial scores **100**, elected or not. | The adapter reports the three continuation tools as `openclaw__<tool>` and everything else bare, so the matcher's own filter leaves elections only. |
| `token_consumption` reads `stats.models`; the gRPC proxy only fills `stats.tokens`. The score is always **0**. | A generator subclass, loaded through EvalBench's `generator_class` hook, adds `stats.models`. |
| An infrastructure failure over the proxy is scored as an outcome: `model_api_error` is never overridden. A control that timed out scores **100**. | The subclass marks those trials unscored. EvalBench then drops them from its own summary too. |
| The turn request names no scenario, trial or arm. | The model config's `env` carries the arm and gateway URL; each scenario's `env` carries the prompt id and kind. |
| No local per-arm rate with an interval. A/B comparison is a BigQuery report, or a viewer page written by Gemini. | `report.py` reads EvalBench's CSVs: Wilson, Newcombe, prompt bootstrap. |
| Sessions expire after 3 hours, and a job still running then ends with no result. | The launcher sets 48 hours. |
| An exception in one scenario silently drops the scenarios after it. | The report refuses a comparison with fewer scored trials than declared. |
| `python_scorer` answers 0.0 for every trial when `uv` is missing. | `run.sh` puts `uv` on `PATH`; the report checks each score row against the trial record. |
| The checked-in protobuf stubs are older than the `.proto` files. EvalBench's own gRPC integration test **fails** on a fresh checkout (3 of 3). | `bootstrap.sh` regenerates them, as upstream CI does. After that, 59 of 59 upstream tests for this path pass. |
| `agent_runners` has no effect on an agent evalset: its scenarios are one work item. | Trials run one at a time per arm. The arms run in parallel, one job each. |

## What the source says about the arms

1. **`tools.toolSearch: false` alone does not make the tools direct on every runtime.** On the Codex harness
   `codexDynamicToolsLoading` decides. On the embedded runtime Code Mode is `"auto"` when unset, and gpt-6.1-sol prefers
   it. Arms B and D set all three keys. The citations are in README. #1569 records Code Mode as off because `tools.codeMode`
   is unset on all six seats; at ab5a, unset does not mean off.
2. **On the Codex harness, f9fcd3a5's system-prompt text does not reach the model**, only its descriptions and the
   direct-only placement do. README has the lines. This is by code reading, and it bears on #1575 itself.
3. **Which runtime each seat takes was measured by 🌿** (gateway journals, openclaw#1575, 2026-11-25): elliott, silas and
   emeric are embedded; ronan, cael and rune use the Codex harness. This lane did not repeat it. Every trial records its
   runtime, and the report compares nothing across runtimes.
4. **The firing model follows the firing seat.** elliott's turns are `openai/gpt-6.1-sol`. ronan's live primary is
   `openai/gpt-6-sol`, so a fire there is a different question. Preflight refuses any other primary or any fallback.

## Validation

| what | result |
| --- | --- |
| adapter tests (`./run.sh test`) | TESTS passed, none skipped; also from a clean checkout, and the supervisor's under full CPU load |
| pre-fix control, at `52465362` | the same runaway (a 60 k call every 50 ms, deaf to abort and delete), its 600 s deadline cut to 6 s: **7.2 M** metered when the trial ended, against 0.70 M, and 2.4 M more in the 2 s after, because the abort and the delete were all there was. On this head it is dead within 0.70 M and one interval's worth (`test_a_loop_that_ignores_aborts_is_stopped_within_its_cap`) |
| mutation checks on this follow-up (one mutant at a time, on a copy) | MUTANTS |
| the supervisor at its real limits, on a real user unit (fakes, no model) | a two-lane loop: 745,240 metered at 30.1 s, gone within 1 ms of the kill. A frozen gateway: killed 10.01 s after its last reading. A durable exec ended with both |
| the caps, through the product's own code at both SHAs | its config schema accepts them; `continue_work` and `continue_delegate` answer `scheduled`; the turn-end budget then says `cost-capped`, and `chain-capped` for a second hop; a second child, a child of a child and a second collector are refused; timeouts read 330 s and 120 s (defaults 48 h and none); redaction and defaults keep every cap. 49 tools: names, descriptions and parameters the same with and without the caps, and not with swarm off |
| the supervisor's frames, through the product's own validators at both SHAs | 5 of 5 valid; the negative controls refused, 4 of 4 |
| full offline run, D off | 270 trials, 3 jobs, exit 0, no session left on any fake gateway, every gateway proved stopped |
| full offline run, D on | 360 trials, 4 jobs, exit 0, no session left on any fake gateway, every gateway proved stopped |
| the canary's own shape and limits, offline | 9 trials, exit 0, every comparison `not reportable` |
| `tools/k6-proofs/tests` | K6 |

From the first lane, at `cad3a045`, and not repeated: 35 + 20 mutants; 67 of 67 adapter frames valid against the product's own
protocol validators at both SHAs (the trial's own frames have not changed since); `tools/k6-proofs/scripts` (nothing under `tools/k6-proofs` changed).

CI path: **focused-only** (local). The docs repo has no PR checks, and nothing here touches openclaw.

## Independent review

A second reader compared the code with both product SHAs and did not see this report. It proved ten findings. All are
fixed, each with a test that fails when only that fix is undone, or are disclosed in README.

| finding | disposition |
| --- | --- |
| A turn stopped at the deadline stores no prompt report, so it was never scored: polling turns left the denominator, which inflates the rate | fixed: carried surface from the same gateway process and config, controls first; unreadable ones reported on their own with a bound |
| A Code Mode call is a nested-tool row, invisible to an assistant-row reader | fixed |
| On Codex, "wording" is the descriptions only, and B and C differ in placement | README corrected; the report refuses comparisons across runtimes |
| The budget undercounted Codex turns, later turns and children | fixed: `sessions.usage.timeseries`, children, and a charge for turns with no reported usage |
| `report` accepted a job twice, another arm's job, and uneven top-ups | fixed |
| The description hash was recorded but never enforced | fixed: other text contradicts the arm |
| The canary step named output that did not exist, and elected nothing | fixed: a Surface section and a 9-trial canary |
| Arms share host paths; workspaces and automations outlive a session | disclosed; `run` refuses when `/tmp/evalprop` exists, and every trial records it |
| Cleanup saw only `spawnedBy` links | fixed: every link the list filter matches |
| `chat.history` drops some assistant rows with their calls | fixed: a result without its call row is still a call |

### This follow-up

Another reader reviewed `cad3a045..57885fc3` against the product, the launcher and the deploy workflow, and proved its
findings. It found no defect in the harness code and killed 19 of 19 mutants of its own. Its findings were in the packet
and the documents:

| finding | disposition |
| --- | --- |
| **blocker:** a durable `exec` runs in its own unit, so neither `stop` nor the kill ended it, and step 6 reported clean | fixed: the emergency stop finds those units by their log path, step 6 checks, README discloses it |
| **blocker:** step 6 removed builds and state dirs the run may not have made; elliott is a donor for other seats | fixed: recorded first, only what was absent is removed, `artifact-<sha>` is never removed |
| staging leaves payload dirs, lists, a log and stores behind | listed, with what may be removed by name |
| "live config read once" and "never touches the live log" were not true | corrected: who reads the config, and the one boot that writes to the log |
| a pending login unit outlived `stop` | fixed: stopped first |
| the copied-config disclosure and its key check were too narrow | fixed: the whole copied part, paths only |
| step 6 could fail, or destroy receipts, after an early stop | fixed: `finish` copies first and removes only after a shred that succeeded |
| loop thresholds misstated; child limits are the seat's, not the product's | corrected; step 0 prints the seat's |
| preflight could race `login-finish` | fixed: waits for the ports, one retry allowed |
| `logging.file` preflight accepted two shared paths | fixed, with tests |
| a wrong citation, `ultra`, a queue race, a missing rule beside one stop, unlisted leftovers | fixed |

## Cost of one full fire

270 trials: 3 arms × 18 prompts × 5. Per arm, 60 eligible and 30 control. With arm D, 360.

| | low | central | high |
| --- | --- | --- | --- |
| model calls per eligible / control trial | 2.5 / 1 | 3.5 / 1.3 | 6 / 2 |
| calls per arm | 180 | 249 | 420 |
| metered tokens per call (cache reads included) | 30 k | 48 k | 60 k |
| later turns and children before cleanup | none | +35 % | +30 % |
| per arm | 5.4 M | 16 M | 33 M |
| **three arms** | **16 M** | **≈ 50 M** | **≈ 100 M** |
| **with arm D** | **22 M** | **≈ 65 M** | **≈ 130 M** |

48 k per call is what the token-budget work metered on emeric at ab5a, on another model and with that seat's own workspace.
An isolated gateway has an empty one, and arms B and D carry every tool's schema, so both ends are open. The calls per trial
are assumptions. The canary gives the first real ones. Wall time is about 1.5–3 hours with the arms in parallel, more if
turns run to the 300 s deadline. **Arm D's own cost** is one more arm: 90 trials, 16 M (5.4–33 M), nearer the high column
with B, and another sign-in, gateway and state dir. It runs beside the others, so it adds little wall time.

### One trial's maximum

| one trial | calls | metered tokens |
| --- | --- | --- |
| central (an eligible trial: 3.5 calls, +35 %) | 3.5 | 0.2 M |
| high (6 calls, +30 %) | 6 | 0.47 M |
| a loop, under the product's caps alone: 330 s at 5 s a call, 60 k growing 1 k, and one child for 120 s | 66 + 24 | 7.8 M |
| **enforced**: the supervisor's 0.70 M, and the time a stop takes | | **1.98 M**; 1.34 M while every reading is on time |
| before this change: a loop for 600 s, or that and five children | 120, 720 | 15 M, 90 M, enforced by nothing |

| the 270-trial fire | three arms | with D |
| --- | --- | --- |
| expected (low – high) | 50 M (16 – 100 M) | 65 M (22 – 130 M) |
| **enforced** by `--run-token-cap 75000000`, plus the time a stop takes per arm in flight (1.28 M) | **79 M** | a cap of its own |
| the 35 M stop per arm, checked between trials | 105 M | 140 M |

5 s a call is an assumption about a model whose reasoning can't be turned off, and 160 k a call is one full-size tool result per
call; the packet says what the numbers are if every call carries the most the product allows. The report prints each arm's
largest trial and the supervisor's readings, so the canary replaces this with numbers.

## Not settled without a live canary

- The fixture turns and the fake gateway are written from product source. No live row was available to this lane.
- Whether `chat.history` of a turn stopped at the deadline shows its calls on the Codex harness.
- Whether `sessions.usage` returns the prompt report soon after a turn on the firing seat (it is read up to 6 times).
- Whether archive and delete of a busy session finish within 90 s; if not, that arm halts with `cleanup failed`.
- The supervisor's readings of a live gateway: how long one takes, whether a first turn stalls it near 10 s, and whether
  `sessions.usage`'s total agrees with the sum of the sessions. A stall past 10 s fails the canary for nothing spent.
- Whether `hasActiveRun` counts a run the caps allow twice. The limit is two.
- The launcher keys its state dir and unit on its first argument, so arm B gets a label there (README, step 2).
  `identity.json` will record that label as `pure_candidate_P`. A `VARIANT` option in frond-scribe's launcher would be
  cleaner; that repository is out of this lane's scope.
- Whether every arm on elliott takes the embedded runtime with the isolated config. If an arm takes another, the canary stops.
- The real seconds per call, which the worst case above assumes.
- Two eligible prompts (w2, w5) could be answered whole in one reply against the user's wish. That counts as no
  election, in every arm alike.

## Commands

```bash
cd tools/evalbench-openclaw
./bootstrap.sh && ./run.sh test
./run.sh offline --out /tmp/evalprop-offline
./run.sh offline --out /tmp/evalprop-offline-d --arms A,B,C,D
./run.sh offline --out /tmp/evalprop-offline-canary --num-trials 1 --token-budget 800000 --run-token-cap 2400000 --run-seconds 1800 \
  --scenarios c1-arithmetic,w1-file-appears,d1-second-pair-of-eyes
./run.sh report --job A=artifacts/offline-rehearsal/A --job B=artifacts/offline-rehearsal/B --job C=artifacts/offline-rehearsal/C
node --test ../k6-proofs/tests/*.test.mjs
```
