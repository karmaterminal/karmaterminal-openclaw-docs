# Report: continuation propensity on EvalBench

Bound to karmaterminal/openclaw#1575, and since follow-up 4 to #1577, gate 6 ("cause, not just count"). **No live fire was
run, no model was called, and no number here is about a model.** The design and the firing steps are in
[`README.md`](README.md).

## Result

The harness is built on EvalBench at the pin. EvalBench was workable, so the k6 fallback was not built. Two complete
offline rehearsals ran against fake gateways, under the supervisor: 360 trials on A, B, C and E with arm D off, and 450 with it
on. Every stage of the path was exercised: gRPC, WS, history, scorers, supervision, CSVs, report, and the awareness sample
with its scripted stand-in judge. The CSVs are in [`artifacts/offline-rehearsal/`](artifacts/offline-rehearsal/report.md) and
[`artifacts/offline-rehearsal-arm-d/`](artifacts/offline-rehearsal-arm-d/report.md).

**No number of tokens is enforced, for a trial or for the canary.** What is enforced is time (480 s a trial and 1800 s the
canary, each + 1 s) and admission in the product (one message turn at a time per gateway, one direct child per session and
none of its own, one collector per swarm group, no automation, activity recap or Skill Workshop review that starts by itself).
The token numbers are estimates on named assumptions: 1.98 M a trial and 7.52 M the four-arm canary at 5 s and 160 k a call;
5.7–18.3 M and 22.5–72.7 M at the most the product lets a call carry on this route, at 5 s to 1 s a call; 10.1–33.7 M and
40.1–134 M if its input estimate is off as far as the provider's window; and more for the lanes a turn opens itself, which
nothing bounds. [`CANARY-PACKET.md`](CANARY-PACKET.md#spend) has
the two columns, the residual, and what would make it a ceiling.

| ref | value |
| --- | --- |
| docs base | `main` at `07f70cb98eec70a341952f11eff02d71d19ff08d` (local = tracking = server); `main` was `2c98daa75faaf5207bc878b78e62a39d9758752a` at follow-up 4, not merged in |
| follow-up 4 | from PR #631's head `8c430fc97a47aafb1dc8b6f9931a97cdeb602f21` (`codeagent/cont-propensity-evalbench`), on lane branch `codeagent/evalbench-arm-e` (final SHA in the PR) |
| reviewed heads this follows up | `d78d1614adc2e9f288715301cffbb6ee19448d4f` (🌻's read of the spend bound and `supervisor.py`, room 22:22Z, message 1575275397732630690; the constraint, 22:23Z, 1575275641740333060); before it `52465362d18b761e5b0eab61026dbf8f39776413` (🌻's read of the packet, room 19:34Z, message 1575233154115969149) and `cad3a0456f2426907b89caa1964d575bf047e42a` (🌿's review, 🌻's three conditions) |
| lane branch | `codeagent/cont-propensity-evalbench` (final SHA in the PR) |
| product, arms A and B | `ab5a30ea79b776f149e24b1fccab9e79b0a5d299` (server: `frond/1321-sovereign-loader-ab5a` and others) |
| product, arms C and D | `f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306` (server: `gloss/1575-continuation-surface`) |
| product, arm E | `de55f3505d930427538359fdfeb256874486ed9f` (server: `codeagent/cont-v6`), the fleet line's build with the settled text; f9fcd3a5 and ab5a30ea are its ancestors, and all three share one lockfile |
| GATES, text only | `4a26193872818aa98945b379d7043113f581df1a` (server: `codeagent/gates-continuation-prose`): read for its continuation text, which is de55f350's; never an arm |
| EvalBench | `86730417fe7b3f8ae01bc5159369293f60baa306` (release 1.22.0) |
| frond-scribe launcher read | `composite-launcher.sh` as of `67370bd94f19f9a0f89493d4f2b6360d5928183f` |
| openclaw-bootstrap workflow read | `main` at `51546ce6ac213d9e2f62c58a318248652a45e7e7` |
| CI / presentation | N/A / N/A |

## What changed for #1577, gate 6 (follow-up 4)

The arms predated the text the three authors settled (seven seams, #1575). The fleet line carries it at de55f350. A count is
not a cause, and this is how a cause gets measured.

| asked for | what it is now |
| --- | --- |
| arm E: de55f350, the fleet default, with the settled text, exactly like arm C | in `arms.json` (port 21326, unit `openclaw-proof-comp-de55f350`, C's config and placement, its own descriptions), `configs/model_arm_e.yaml`, preflight, scoring, the report, the fake gateway's plan and the probe. On by default: the arms are A, B, C and E, and D stays optional and off. Its three descriptions were read from source, rebuilt by the product's own code in the probe, and hash to the same sha256 both ways; the same extractor reproduces `arms.json`'s ab5a30ea and f9fcd3a5 texts byte for byte, and GATES' 4a261938 gives de55f350's |
| what each contrast isolates | README's arm and contrast tables: C → E is the settled wording at the same placement, the three continuation tools direct-only on both; A → E is placement plus wording, descriptive, and A → B, B → C and C → E add up to it. On the embedded runtime the probe shows C → E is the text and nothing else (below); on the Codex harness it is not, and README says why |
| `direct tools: N` beside every arm's rates, in the report and the CSV | every arm's rates row in `report.md` and a new `report.csv` (one row per arm) carry the direct tools its counted trials measured, and **crowded** past 30, with Anthropic's tool search documentation cited as vendor guidance, about Claude. By the probe: A 6, B 66, C 9, D 66, E 9. A contrast that holds the surface (B → D, C → E) is not reportable when its arms measured different direct tools, by count or by name. A test fails if any arm's row lacks its count, on a fresh report and on both archives |
| an awareness label: a pre-declared judge step, offline only | `judges/awareness.md` (sha256 pinned in `arms.json`), a seeded sample of one counted trial per prompt and arm, a blind judge input, labels that must quote the assistant and may not come from the firing model, and "not judged" until labelled, never zero. Wired into every run (the sample and the judge input, privately) and into the rehearsal path, where a scripted stand-in labels it. No model was called |
| costs and stop rules with E | 360 trials (18 × 5 × 4), 65 M expected (22–130 M); D on, 450 and 80 M (27–165 M). The supervisor's enforced caps are unchanged: 0.70 M and 480 s a trial, 75 M and 4 h the fire, 2.40 M and 1800 s the canary. The canary is now twelve trials on four gateways, and its conditional numbers grow by the fourth arm in flight. CANARY-PACKET names the arm set and says again that it is not a go |
| tests, and the rehearsal again with E | below, in Validation |

What reading the product for this found:

- **On the embedded runtime C → E is the text and nothing else.** The probe's attempt path at both builds: the same 9 tools
  sent and 60 catalogued, every other definition the same, every prompt line outside the continuation section that names no
  continuation tool the same. The differences are the three descriptions, the parameter descriptions of `continue_work` and
  `continue_delegate`, and five prompt lines (README). B → D holds the same way, and B → C does not (the negative control).
  `tests/test_probes.py` pins all three from the receipts.
- **On the Codex harness C → E is more than wording.** de55f350 adds the delegate hint and the continuation section to the
  harness base prompt, which Codex builds its prompt from and f9fcd3a5's lacks, and a Codex turn that meets a busy thread now
  waits for it. Runtimes are never compared, so it changes no reading on elliott; it would on ronan, cael or rune.
- **The probe's `/context` prompt hash depended on where the tree was extracted.** That prompt lists each skill's location in
  the tree. Re-running the probe from another directory changed only that hash, on every arm alike, so no comparison was
  wrong; the README's "byte for byte" held only for the same path. The tree's path is now written as `<tree>`, and two
  extracts of f9fcd3a5 at two paths give byte-identical receipts.
- **GATES' continuation text is de55f350's.** The three tools' files, the continuation section and the continuation tooling
  lines differ only outside their strings (types and a comment); other tools' tooling lines do differ there.

## What changed for 🌻's admission condition (follow-up 3)

🌻's point at `d78d1614`: 1.98 M and 6.24 M were conditional estimates, not ceilings. Neither 5 s nor 160 k a call is enforced,
the packet's own worst context gave 3.7 M and 11.4 M, and a turn can have more than two calls in flight before the supervisor
sees them. Detection is not admission. 🌻's constraint: bound what runs, never what the model is shown, the same on every arm;
record what the model can see of it; and if the pinned builds can't, bring back the residual plainly.

| asked for | what it is now |
| --- | --- |
| a per-call ceiling, product-enforced, from source at both SHAs | **none can be set.** The ChatGPT route never sends an output limit (`openai-chatgpt-responses-request.ts:48-105`); input is checked against the route's 500 k budget by a characters ÷ 4 estimate with no reserve; nothing counts calls in a turn. A context budget (`models.providers.openai.models[].contextTokens`) would lower the check, and move `request_compaction`'s 70 % guard and the context-pressure events with it: one of the choices measured, so it is not set |
| admission: at most one model call in flight per gateway | **not reachable by configuration.** Set, the same on every arm and verified like the caps: one message turn at a time in the main lane (`agents.defaults.maxConcurrent: 1`, was 2), no automation that fires by itself (`cron.enabled: false`), no activity recap after a turn (`agents.defaults.utilityModel: ""`), no Skill Workshop review (its `autonomous.mode: "off"`, with the migration marker the runtime needs to read it). Already set: one child per session, none of its own, one collector per swarm group. Open: a collector in every group a turn names, forced automation runs, `sessions_send` to other sessions, the tool calls of one response (they run at once), media and research jobs, and turns that follow a trial's without being continuations (an `automations` wake, a background command's exit notice, a child's announce). Every child and swarm cap has a minimum of 1 |
| the surface intact, proved at both SHAs for every new setting | `probes/product-probe.mts` through the product's own code, two ways per arm: the `/context` path, and the run's own surface on the firing model through the product's tool-surface runtime (Code Mode's controls and catalog for A and C, every tool direct for B and D, the prompt with its continuation section). Tools, catalog and prompt byte for byte the same, each setting alone and all together, every arm; three settings that do change it are seen to. Receipts in `probes/receipts`, checked by `tests/test_probes.py` against `arms.json` and the probe's hash |
| refusals the model sees, recorded per trial | `limitations` in every trial record (a refusal that names a cap, and every `automations` and `skill_workshop` answer with its service off) and `electedAfterLimitation` (an election decided in a later response); the report counts them per arm and leaves the rates alone. Not recognized: a child's own refusals, and a child stopped by its timeout |
| the headline: enforced apart from conditional | the packet's top table and its Spend section: time and admission enforced, no token number; the estimates beside their assumptions; 3.7 M / 11.4 M reconciled (too low: this route admits a call to its whole estimated budget and limits no output, so 628 k a call, not 375 k) |
| tests: preflight refuses, and a second call is refused, not killed | a gateway whose admission settings aren't authored, effective and applied is refused (each setting, both readings), and so is an agent's own utility model. A fake that tries six spawns runs one child and is refused five in the product's words, recorded as limitations, with nothing for the supervisor to stop. Six swarm groups are six admitted collectors, and the supervisor stops them: the residual, in a test |
| the residual, for 🌻 | the packet's [The residual](CANARY-PACKET.md#the-residual): what is unbounded, as numbers, and three ways to a ceiling that are outside these pinned builds |

What reading the product for this found:

- **The Skill Workshop setting needs the migration marker.** Without it the runtime ignores the plugin's entry
  (`src/config/skill-workshop-plugin-migration.ts:92-121`); the probe's readback of the effective configuration showed it
  missing, as preflight would have on a live gateway. With the marker, which records what Doctor would (the launcher copies no
  older Workshop setting), the review reads `off`.
- **An activity recap is a model call after every trial's turn**, on the utility model, outside the session's usage. It is off.
- **Forced automation runs ignore `cron.enabled`**, and the tool waits on one 60 s, or 10 min if asked.
- **Message turns run in the main lane; internal events don't** (`agent-runner-fallback-candidate.ts:110-115`). One main slot
  holds message turns, and a child's announce, which asks for no lane; the cost cap holds continuation wakes; an `automations`
  wake and a background command's exit notice are turns that neither holds.

## What changed for 🌻's spend condition (follow-up 2)

🌻's point at `52465362`: the expected 1.6 M is not a bound, and the 51 M and 276 M beside it were enforced by nothing.

| asked for | what it is now |
| --- | --- |
| product caps, the same on every arm | twelve, in `arms.json` `caps` (fourteen since follow-up 3). `overlay` writes them; each trial reads them back, authored, effective and applied, before and after. A trial whose caps didn't take is unscored and halts **every** arm. [README](README.md#spend-caps-and-admission) cites each at both SHAs |
| the tightest values that still let the first election happen | `costCapTokens: 1` and `maxChainLength: 1`: the election is answered `scheduled`, and nothing follows it. One child, with none of its own. Run through the product's own code at both SHAs (below) |
| an external supervisor that doesn't trust the product | `supervisor.py`, a process and a unit of its own: a reading a second, a limit per trial, per run and outside a trial, its own clocks, active runs, and a gateway it can't read. `sessions.abort`, then SIGKILL of the unit, then what outlives it |
| a durable exec can't bypass it | any stop, and the end of every trial, ends every transient unit whose log, environment or binding is the gateway's. Tested with a real durable unit, beside the trap: stopping the gateway's own unit leaves it running |
| fake gateways that loop, spawn children and ignore aborts | each a process that dies for real, or a systemd unit. Stopped within its limit; its trial's cleanup ran and is on record; the run ended in order |
| the bound as enforced arithmetic | the packet's Spend section: expected and enforced in separate columns, what enforces each number, and how that was tested. A test recomputes it from `arms.json`. Follow-up 3 found those numbers conditional, and says so |
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
5. **At de55f350 the Codex harness's prompt carries the continuation section** (`src/agents/system-prompt-harness-base.ts:59,93-97`),
   so item 2 holds for f9fcd3a5 and not for de55f350. On the embedded runtime C → E is the settled text alone (follow-up 4).

## Validation

| what | result |
| --- | --- |
| adapter tests (`./run.sh test`), follow-up 3 | 566 passed, none skipped (on ronan, with a systemd user manager); 490 at `d78d1614` |
| the caps and admission, through the product's own code at both SHAs (`probes/product-probe.mts`, receipts in `probes/receipts`) | the schema and `config.get`'s own pipeline accept and read back all sixteen, authored and effective (a misspelt key is refused); in the product's command queue two turns start one after the other and so do two children of one session, both at once without the caps, while two swarm groups and two automation runs start together either way; the first child is admitted, a second and a grandchild refused, a second collector in a group refused; the gateway's cron state reads the scheduler off; the utility model `disabled`; Skill Workshop's review `off`, and `auto` without the marker. On every arm, two ways (the `/context` path's 66 tools and prompt; the run's own surface through the product's tool-surface runtime, Code Mode with 6 tools sent and 63 catalogued at ab5a, 9 and 60 at f9fc, every tool direct for B and D, prompt with its continuation section), tools, catalog and prompt are byte for byte the same with and without the caps, each alone and all together; swarm off, an empty `allowAgents` and `automations` denied are each seen to change them. The continuation descriptions hash to `arms.json`'s. A re-run gives the same receipts |
| a setting the probe found not in force | Skill Workshop's `autonomous.mode: "off"` alone: absent from the effective configuration, because the runtime ignores the plugin's entry until Doctor's migration marker. Set with the marker, and read back with it |
| negative controls at `d78d1614` (the same six assertions there and here) | at `d78d1614`: a gateway with two main-lane slots, with cron on, with a utility model, or with the agent's own utility model passes preflight (4 × "did not raise"); a refusal the model saw is not in its trial's record; six spawns run six children. Here: all six hold. The new packet tests fail on `d78d1614`'s documents, each for its own reason |
| mutation checks on follow-up 3 (one mutant at a time, on a copy) | 24 of 26 killed, in two rounds. Left: a clause that could never decide anything (every guarded refusal in the product also says `rejected`), now removed; and placing a nested refusal at its own row instead of its script's result, which no well-formed history tells apart |
| adapter tests at follow-up 2 | 490 passed, none skipped (on ronan, with a systemd user manager); also from a clean checkout. The supervisor's and the units' under full CPU load, at an earlier head of this lane. They leave no unit, process or directory behind |
| pre-fix control, at `52465362` | the same runaway (a 60 k call every 50 ms, deaf to abort and delete), its 600 s deadline cut to 6 s: **7.2 M** metered when the trial ended, against 0.70 M, and 2.4 M more in the 2 s after, because the abort and the delete were all there was. On this head it is dead within 0.70 M and one interval's worth (`test_a_loop_that_ignores_aborts_is_stopped_within_its_cap`) |
| mutation checks on this follow-up (one mutant at a time, on a copy) | 121 of 122 killed. The one left removes the first of three ways a stop kills the same cgroup |
| the supervisor at its real limits, on a real user unit (fakes, no model) | a two-lane loop: 745,240 metered at 30.1 s, gone within 2 ms of the kill. A frozen gateway: killed 10.01 s after its last reading. A durable exec ended with both, all of it proved in 0.5 s |
| the caps, through the product's own code at both SHAs | its config schema accepts them; `continue_work` and `continue_delegate` answer `scheduled`; the turn-end budget then says `cost-capped`, and `chain-capped` for a second hop; a second child, a child of a child and a second collector are refused; timeouts read 330 s and 120 s (defaults 48 h and none); redaction and defaults keep every cap. 49 tools: names, descriptions and parameters the same with and without the caps, and not with swarm off |
| the supervisor's frames, through the product's own validators at both SHAs | 5 of 5 valid; the negative controls refused, 4 of 4 |
| full offline run, D off (archived at `74a3acc1`) | 270 trials, 3 jobs, exit 0, no session left on any fake gateway, every gateway proved stopped, sixteen caps. Rates and comparisons are those of the run before; treatment limitations: 1 trial in A, 2 in B and C, one of them electing after it |
| full offline run, D on (archived at `74a3acc1`) | 360 trials, 4 jobs, exit 0, the same, and D as B and C |
| the canary's own shape and limits, offline (at `74a3acc1`) | 9 trials, exit 0, every comparison `not reportable` |
| `tools/k6-proofs/tests` | 583 of 583 |

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

### Admission and the residual (follow-up 3)

Another reader, who had not seen the reasoning, reviewed `d78d1614..78f4a621` against both product trees, re-ran the probe at
both SHAs and the tests, and checked every citation. It found two blockers and seven more, all in what the documents and the
probe claimed; the code changes held. Each is fixed or disclosed:

| finding | disposition |
| --- | --- |
| **blocker:** the probe built only the `/context` surface, without the Code Mode catalog arms A and C send or the prompt's continuation section, so "on every arm" was not shown | fixed: the probe also builds each arm's own surface through the product's tool-surface runtime and the prompt as the attempt builds it; the caps leave that the same too |
| **blocker:** the Enforced column claimed more than holds: "turns at once: 1", "no wake", "children: 1" | fixed: message turns, continuation wakes, direct children, each so named; the turns that follow without being continuations (`automations` wake, a background command's exit notice, a child's announce) and a collector per group are in the open list |
| Skill Workshop's review can be switched off without changing the surface | set, with the migration marker the runtime needs; read back, and in the probe |
| the residual's low end assumed the product's estimate holds | the provider's window case added: 10.1–33.7 M a trial, 30.7–101 M the canary |
| "elected after a limitation" compared call order, not response order | fixed: a call goes with the response that made it, a Code Mode call with its script, a call whose row is gone with the results it sits among; tested |
| limitations the detector misses | a refusal inside Code Mode's script is now tested; a child's own refusals and a child stopped by its timeout are disclosed as not recorded |
| `maxSpawnDepth: 1` makes a child a leaf; `utilityModel: ""` reaches the prompt with a paired card renderer; one main slot can hold a visible child or a later trial | disclosed, the same on every arm; the last not verified on a gateway |
| nits: cron's switch was the probe's own copy; a check that showed nothing; prompt hashes held temporary paths; the fake checked a group's live children before its total; collectors take no reservation; rehearsals archived before a later change; a test took the supervisor's threshold for the lanes; "the answer" for its status; a citation short of the watchers | fixed (cron read from the gateway's own cron state; receipts reproduce; rehearsals re-run at the final head), or disclosed (the reservation) |

It checked and found correct: every citation the follow-up added; that the ChatGPT route never sends an output limit; the
500 k budget, the 128 k maximum, the estimate, its missing reserve, the provider's compaction at 90 % and the 1,000,000-character
tool-result total; that nothing counts calls in a turn; every cap's minimum of 1; all of the conditional arithmetic; that trial
turns run in the main lane; the probe's readback against `config.get`'s own; and that `automations` keeps its definition whatever
`cron.enabled` says.

The same reader then re-reviewed the fixes at `762b7357`: both blockers and the three it asked to fix are fixed, the rest
disclosed; it re-ran the probe at both SHAs (byte for byte the committed receipts) and the tests (559 passed). It found three
more, fixed since: the migration marker is now refused beside any older Workshop policy it would make take effect (a deny or
allowlist would remove `skill_workshop`), at overlay and preflight alike; the probe's continuation flag reads the section's
heading; a child's announce runs in the main lane, and the packet says so. It judged the probe's attempt path faithful for the
comparison and not the attempt's exact bytes, and the marker safe and honest for a launcher that copies no Workshop policy.

### The spend bound (follow-up 2)

Another reader, who had not seen the design, reviewed `52465362..50e75d40` and then the fixes to it at `09beb28f`, against the
product, the launcher and systemd, and proved its findings with scripts and mutants of its own.

| finding | disposition |
| --- | --- |
| **blocker:** a stop wrote its log line first, outside its own error handling. With a full disk the stop died, nothing tried again, and the gateway was alive at 30 M | fixed: no stop depends on a record; the kill is in a loop that ends only when it is proved |
| the sweep matched any unit whose text mentions the gateway's directory, another gateway's durable exec included | fixed: only a unit's log, environment or binding count |
| a run-level stop, the runner's own stop and the timer left no marker, and the product resumes an interrupted turn | fixed: marked beside the kill, the timer's shell half included; one never asked to do anything is not marked |
| with systemd unreachable, a stop read as proved | fixed: the kernel is told first (`cgroup.kill`); what systemd could not be asked about is not stopped, and is tried again |
| "one polling interval" rested on an unenforced 1 s reading, and one late reading breaks it | fixed: a whole reading has 1.5 s, and the bound that holds whatever the readings do (10 s) is the one in bold |
| `cron.enabled: false` shows in what `automations` answers, and a forced run ignores it | cap dropped; automations, and that they outlive their trial, are disclosed |
| ten mutants of the stop path survived the tests | tests for each; below |
| SIGTERM while arming was swallowed; a runner that left while arming cost every gateway; a timer could outlive a launch | fixed |
| `stop` without a supervisor went one gateway at a time; Ctrl-C waited for every trial's cleanup (81 s) | fixed: all are killed first; Ctrl-C stops them in 0.1 s and the run ends in order |
| the usage total's failures were silent, a partial total was counted from, and it covered one agent | fixed: four failures stop the arm, a partial baseline is refused, all agents |
| recovering from one slow reading was harder than being slow throughout | fixed: a late reading keeps its connection, and opening one has its own time |
| a delayed delegate escapes the cost cap; "product caps alone" was called a bound | disclosed; called an estimate |

### The canary packet

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

360 trials: 4 arms (A, B, C, E) × 18 prompts × 5. Per arm, 60 eligible and 30 control. With arm D, 450.

| | low | central | high |
| --- | --- | --- | --- |
| model calls per eligible / control trial | 2.5 / 1 | 3.5 / 1.3 | 6 / 2 |
| calls per arm | 180 | 249 | 420 |
| metered tokens per call (cache reads included) | 30 k | 48 k | 60 k |
| later turns and children before cleanup | none | +35 % | +30 % |
| per arm | 5.4 M | 16 M | 33 M |
| **four arms (A, B, C, E)** | **22 M** | **≈ 65 M** | **≈ 130 M** |
| **with arm D** | **27 M** | **≈ 80 M** | **≈ 165 M** |

48 k per call is what the token-budget work metered on emeric at ab5a, on another model and with that seat's own workspace.
An isolated gateway has an empty one, and arms B and D carry every tool's schema, so both ends are open. The calls per trial
are assumptions. The canary gives the first real ones. Wall time is about 1.5–3 hours with the arms in parallel, more if
turns run to the 300 s deadline. **Arm E's own cost** is one more arm like C: 90 trials, 16 M (5.4–33 M), with C's 9 direct
tools, and another sign-in, gateway and state dir. **Arm D's** is the same again, nearer the high column with B. Each runs beside
the others, so it adds little wall time, unless the shared provider account's rate limit holds them back.

### One trial's maximum

| one trial | calls | metered tokens |
| --- | --- | --- |
| central (an eligible trial: 3.5 calls, +35 %) | 3.5 | 0.2 M |
| high (6 calls, +30 %) | 6 | 0.47 M |
| a loop, under the product's caps alone: 330 s at 5 s a call, 60 k growing 1 k, and one child for 120 s | 66 + 24 | 7.8 M |
| **enforced** | | **no token number**: the supervisor's clock kills it by 480 s |
| conditional: the supervisor's 0.70 M, and what the turn and its child spend until the kill | | 1.98 M at 5 s and 160 k a call; 5.7 M at 5 s and 628 k, the most this route lets a call carry; 18.3 M at 1 s. More for every lane the turn opens |
| before follow-up 2: a loop for 600 s, or that and five children | 120, 720 | 15 M, 90 M, enforced by nothing |

| the 360-trial fire | four arms (A, B, C, E) | with D |
| --- | --- | --- |
| expected (low – high) | 65 M (22 – 130 M) | 80 M (27 – 165 M) |
| **enforced** | 4 h (`--run-seconds 14400`), + 1 s; no token number | the same |
| conditional: where the supervisor stops it, `--run-token-cap 75000000` (unchanged), plus what the arms in flight spend until the kill | 80 M at 5 s and 160 k a call; 95 M at 628 k; 145 M at 1 s a call. The high estimate is past the stop: such a fire ends there, every arm with it | a cap of its own, the seat owner's: 80 M is past 75 M |
| the 35 M stop per arm, checked between trials | 140 M | 175 M |

5 s a call is an assumption about a model whose reasoning can't be turned off, and 160 k a call is one full-size tool result per
call. Neither is enforced: the packet's [Conditional](CANARY-PACKET.md#conditional) table gives the numbers at the most a call
can carry on this route and at shorter calls. The report prints each arm's largest trial and the supervisor's readings, so the
canary puts measured numbers beside the assumptions. They stay assumptions about the next run.

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
- Whether a live prompt report counts the direct tools the probe does (A 6, B 66, C 9, E 9). The launcher copies the seat's
  tools policy, models and plugins, which the probe leaves out; they would move every arm alike.
- Whether any transcript of a live run is ever judged for awareness. Until it is, every arm reads `not judged`.

## Commands

```bash
cd tools/evalbench-openclaw
./bootstrap.sh && ./run.sh test
./run.sh offline --out /tmp/evalprop-offline
./run.sh offline --out /tmp/evalprop-offline-d --arms A,B,C,D,E
./run.sh offline --out /tmp/evalprop-offline-canary --num-trials 1 --token-budget 800000 --run-token-cap 2400000 --run-seconds 1800 \
  --scenarios c1-arithmetic,w1-file-appears,d1-second-pair-of-eyes
A=artifacts/offline-rehearsal; ./run.sh report --job A=$A/A --job B=$A/B --job C=$A/C --job E=$A/E --manifest $A/manifest.json \
  --awareness $A/awareness-labels.jsonl --csv /tmp/evalprop-report.csv
node --test ../k6-proofs/tests/*.test.mjs
```
