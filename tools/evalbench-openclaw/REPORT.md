# Report: continuation propensity on EvalBench

Bound to karmaterminal/openclaw#1575. **No live fire was run, and no number here is about a model.** The design and the
firing steps are in [`README.md`](README.md).

## Result

The harness is built on EvalBench at the pin. EvalBench was workable, so the k6 fallback was not built. All 270 trials
of the pre-declared fire ran offline against three fake gateways, and every stage of the path was exercised: gRPC, WS,
history, scorers, CSVs and report. The CSVs are in [`artifacts/offline-rehearsal/`](artifacts/offline-rehearsal/report.md).

| ref | value |
| --- | --- |
| docs base | `main` at `07f70cb98eec70a341952f11eff02d71d19ff08d` (local = tracking = server at the start and at the end) |
| lane branch | `codeagent/cont-propensity-evalbench` (final SHA in the PR) |
| product, arms A and B | `ab5a30ea79b776f149e24b1fccab9e79b0a5d299` (server: `frond/1321-sovereign-loader-ab5a` and others) |
| product, arm C | `f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306` (server: `gloss/1575-continuation-surface`) |
| EvalBench | `86730417fe7b3f8ae01bc5159369293f60baa306` (release 1.22.0) |
| CI / presentation | N/A / N/A |

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
| `agent_runners` has no effect on an agent evalset: its scenarios are one work item. | Trials run one at a time per arm. The arms run in parallel as three jobs. |

## What the source says about the arms

1. **`tools.toolSearch: false` alone does not make the tools direct on every runtime.** On the Codex harness
   `codexDynamicToolsLoading` decides. On the embedded runtime Code Mode is `"auto"` when unset, and gpt-5.6-sol prefers
   it. Arm B sets all three keys. The citations are in README. #1569 records Code Mode as off because `tools.codeMode`
   is unset on all six seats; at ab5a, unset does not mean off.
2. **On the Codex harness, f9fcd3a5's system-prompt text does not reach the model**, only its descriptions and the
   direct-only placement do. README has the lines. This is by code reading, and it bears on #1575 itself.
3. **Which runtime each seat takes is not established here.** Codex is the source default for official `openai/*`
   routes. The `dispatch_action` rows of run 44245772142 show emeric on the embedded runtime with Tool Search. Every
   trial records its runtime, and the report compares nothing across runtimes.
4. **ronan's live primary is `openai/gpt-6-sol`, not gpt-5.6-sol.** Only that seat's model keys were read. The firing
   steps pin `PROOF_PRIMARY_MODEL` and empty the fallbacks, and preflight refuses anything else.

## Validation

| what | result |
| --- | --- |
| adapter tests (`./run.sh test`) | 243 passed |
| required fixture turns | election, `tool_search` then election, no election, control false election: each in `test_transcript.py`, `test_trial.py` and the end-to-end jobs |
| mutation checks (one mutant at a time, on a copy) | 35 of 35 killed before review; of 20 for the review fixes 19 killed, and the survivor then got a test |
| adapter frames against the product's own protocol validators | 67 of 67 frames that have a validator are valid at ab5a and at f9fcd3a5; a frame with one unknown parameter is refused by 12 of 12. `sessions.usage.timeseries` has no validator; k6 calls it the same way |
| parity with the k6 readers (`tool-call-identity.mjs`, `model-identity.mjs`) | equal on every fixture turn and on a set of hostile calls, results and model rows |
| full offline run | 270 trials, 3 jobs, exit 0, no session left on any fake gateway |
| `tools/k6-proofs/tests` | 583 of 583 |
| `tools/k6-proofs/scripts/__tests__` | 1172 tests, 17 red. 3 (`current-corpus-active-scope` ×2, `harness-provenance-runner` ×1) are red on the untouched base `07f70cb9` too. 14 are one file, `return-covenant-restart-control`: red in the parallel run only, 68 of 68 alone on this branch and on the base |
| `tools/k6-proofs/scripts/*.test.mjs`, the four catalog validators | 49 of 49; all pass |

CI path: **focused-only** (local). The docs repo has no PR checks, and nothing here touches openclaw.

The frames check, the mutation run and the base comparison were one-off checks by this lane. They are not part of `./run.sh test`.

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

## Cost of one full fire

270 trials: 3 arms × 18 prompts × 5. Per arm, 60 eligible and 30 control.

| | low | central | high |
| --- | --- | --- | --- |
| model calls per eligible / control trial | 2.5 / 1 | 3.5 / 1.3 | 6 / 2 |
| calls per arm | 180 | 249 | 420 |
| metered tokens per call (cache reads included) | 30 k | 48 k | 60 k |
| later turns and children before cleanup | none | +35 % | +30 % |
| per arm | 5.4 M | 16 M | 33 M |
| **three arms** | **16 M** | **≈ 50 M** | **≈ 100 M** |

48 k per call is what the token-budget work metered on emeric at ab5a, with that seat's own workspace. An isolated
gateway has an empty one, and arm B carries more tool schemas, so both ends are open. The calls per trial are
assumptions: the canary gives the first real ones. The default stop is 35 M per arm. Wall time is about 1.5–3 hours with
the arms in parallel, more if turns run to the 600 s deadline.

## Not settled without a live canary

- The fixture turns and the fake gateway are written from product source. No live row was available to this lane.
- Whether `chat.history` of a turn stopped at the deadline shows its calls on the Codex harness.
- Whether `sessions.usage` returns the prompt report soon after a turn on the firing seat (it is read up to 6 times).
- Whether archive and delete of a busy session finish within 90 s; if not, that arm halts with `cleanup failed`.
- The launcher keys its state dir and unit on its first argument, so arm B gets a label there (README, step 2).
  `identity.json` will record that label as `pure_candidate_P`. A `VARIANT` option in frond-scribe's launcher would be
  cleaner; that repository is out of this lane's scope.
- Two eligible prompts (w2, w5) could be answered whole in one reply against the user's wish. That counts as no
  election, in every arm alike.

## Commands

```bash
cd tools/evalbench-openclaw
./bootstrap.sh && ./run.sh test
./run.sh offline --out /tmp/evalprop-offline
./run.sh report --job A=artifacts/offline-rehearsal/A --job B=artifacts/offline-rehearsal/B --job C=artifacts/offline-rehearsal/C
node --test ../k6-proofs/tests/*.test.mjs
node --test ../k6-proofs/scripts/__tests__/*.test.mjs
```
