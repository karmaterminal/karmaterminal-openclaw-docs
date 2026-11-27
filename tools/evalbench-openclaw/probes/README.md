# The product probe

[`product-probe.mts`](product-probe.mts) runs the run's caps and admission settings (`arms.json` `caps`) through the product's
own code at one SHA, and prints what it found. [`receipts/`](receipts) holds what it printed at each of the three SHAs the arms
run (ab5a30ea, f9fcd3a5, de55f350), every arm's settings at each, and `tests/test_probes.py` checks each receipt against
`arms.json` and against this probe's own sha256, so a receipt is never older than the probe, the caps or the arms.

It reads a product tree and starts nothing: no gateway, no model, no network. Every product function it calls is named in
the script.

| part | what it shows |
| --- | --- |
| `config` | the caps in a configuration file, read back the way `config.get` reads one (`readConfigFileSnapshot`, then `redactConfigSnapshot`): valid, and each cap present as authored and in the effective configuration. A misspelt key is refused, so a valid file is not a vacuous one |
| `capsBehavior` | the continuation budget after a first election (`cost-capped`) and for a second hop (`chain-capped`), delegates admitted in one turn, the turn and child timeouts |
| `admission` | the lane widths the gateway sets at start (`resolveGatewayLaneConcurrency`, `applyGatewayLaneConcurrency`), and how many of two tasks the product's own command queue starts at once in each lane, with the caps and without them; child and collector admission (`resolveChildAdmission`); cron's scheduler as the gateway's own cron state reads it (`createLazyGatewayCronState`); the utility model setting |
| `config.skillWorkshopReview` | Skill Workshop's review mode as the runtime configuration gives it: `off` with the caps, `auto` without them, and `auto` with the setting but without the migration marker |
| `surface.<arm>.context` | the tools (names, descriptions, parameters) and the system prompt the product's `/context` path builds (`resolveCommandsSystemPromptBundle`), with the per-session additions a trial's session gets (`prepareAttemptSystemPromptAdditions`) |
| `surface.<arm>.attempt` | the run's own surface on the firing model: the product's tool-surface runtime (`createAgentHarnessToolSurfaceRuntimeCore`) plans it (Code Mode, Tool Search or every tool direct), builds its controls and compacts the tools into what is sent and what is catalogued; the prompt is built as the attempt builds it (`buildConfiguredAgentSystemPrompt` with the continuation section) |
| `surface.<arm>.<path>.withoutContinuation` | the rest of the surface without the continuation text: the prompt without the `## Continuation & Delegation` section and without any other line that names a continuation tool or its bracket form, and every tool definition but the three, hashed. Two arms with the same rest show the model other continuation text and nothing else; `tests/test_probes.py` pins that for B → D and C → E on the attempt path, and that B → C's rest differs |
| both | with no caps, with all of them, and with each alone; and three settings that do change the surface, as controls. The three continuation descriptions are hashed. Paths of the product tree, the workspace and the probe's home are written as `<tree>`, `<workspace>` and `<home>` before anything is hashed |

## Making a receipt

On a seat with the product's dependencies installed for the same lockfile (all three SHAs share one), from an extract of the tree
at the SHA. Nothing is written to the tree; `node_modules` links are read only.

```bash
H=$PWD/tools/evalbench-openclaw                     # this harness
R=~/flesh_beast_best_beast/source/openclaw           # a clone that has the commit
N=~/flesh_beast_best_beast/source/WORKTREES/openclaw-cont-composite   # an install at the same lockfile
SHA=ab5a30ea79b776f149e24b1fccab9e79b0a5d299         # or f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306, or de55f3505d930427538359fdfeb256874486ed9f
T=$(mktemp -d); git -C $R archive $SHA | tar -x -C $T
ln -s $N/node_modules $T/node_modules
for d in $(cd $N && ls -d packages/*/node_modules extensions/*/node_modules); do [ -d $T/$(dirname $d) ] && ln -s $N/$d $T/$d; done
P=$(mktemp -d)                                       # HOME, state and config of the probe's own
cd $T && env -i PATH=$PATH HOME=$P OPENCLAW_STATE_DIR=$P/state OPENCLAW_CONFIG_PATH=$P/openclaw.json TMPDIR=$P NO_COLOR=1 \
  PROBE_PRODUCT_SHA=$SHA node --import $H/probes/hooks.mjs --import tsx $H/probes/product-probe.mts $T $H/arms.json \
  | sed -n 's/^PRODUCT-PROBE //p' | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin), indent=1, sort_keys=True))' \
  > $H/probes/receipts/${SHA:0:8}.json
```

[`hooks.mjs`](hooks.mjs) is for the source tree only: its plugin loader requires two packages that publish ESM alone, and a
built gateway imports them. When such a require fails, the hook resolves it again with the `import` condition. Without it five
bundled plugins (browser, canvas, codex, memory-core, skill-workshop) don't load and their tools are missing from the
comparison.

A re-run on the same host gives the same receipt byte for byte, wherever the tree was extracted: the `/context` prompt lists
each skill's location inside the tree, which is why the tree's own path is written as `<tree>` (two extracts of f9fcd3a5 at two
paths gave byte-identical receipts; before that, the prompt hash followed the path). One field depends on the host: the main
lane's width without the caps, which is 4 per CPU (`admission.lanesWithoutCaps.widths.main`).

## What it does not show

- **A live gateway.** The probe calls the functions a gateway calls; it does not start one. Preflight's readback on the
  seat is what shows the caps applied by the running process.
- **The real attempt end to end.** The attempt path calls the product's own planner, runtime and prompt builder; it does not
  run an attempt. Its model is the firing model's route and Code Mode preference, not the resolved model; the tools are built
  with fewer options than an attempt passes (no model compat, construction plan or Code Mode skills); `compactTools` gets no
  prepared options and the provider's schema normalization is not applied; and the prompt has no Code Mode catalog prompt,
  skills prompt, bootstrap files or extra prompt, nor what the session and run add (history, delivery facts, sandbox). None of
  those inputs reads a cap, so the comparison with and without the caps hides nothing; it is not the attempt's exact bytes.
- **The seat's own configuration.** The surface is compared on the arms' settings alone. The launcher copies more from the
  seat (tools policy, models, plugins); the caps are compared with and without on the same base, so a difference they make is
  seen whatever that base holds, unless it is a difference only that seat's settings would expose.
- **Tool behavior.** Two definitions that are the same can still answer differently at execution, which is what the trial's
  `limitations` record.
