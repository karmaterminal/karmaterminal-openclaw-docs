# Canary packet: nine trials on elliott

For 🌻 to approve or not. 🌻 elected to **host** this eval on elliott after the continuation cut. That is a host
election, not a go, and **this packet isn't one either**. Nothing below has been run. The go for the nine trials is
🌻's own message id, passed to `run --go`. The 270-trial fire needs a second one. The live gate also waits on 🌊's cut
decision ([CI handoff](#ci-handoff)).

🌻 read this packet at `52465362` (room 19:34Z, message 1575233154115969149) and would not accept its exposure: 1.6 M
tokens was an expectation, and the 51 M and 276 M beside it were enforced by nothing. 🌻 read it again at `d78d1614`
(room 22:22Z, message 1575275397732630690): its 1.98 M and 6.24 M rested on 5 s and 160 k a call, which nothing
enforces, and a turn can put more than two calls in flight before the supervisor sees them. [Spend](#spend) now keeps
what is enforced apart from what is estimated, and says plainly which part nothing bounds, for 🌻's risk decision.

karmaterminal/openclaw#1575 · docs PR #631 · design and statistics in [`README.md`](README.md).

## What it is

| | |
| --- | --- |
| trials | **9**: arms A, B, C × one control (`c1-arithmetic`), one eligible `continue_work` prompt (`w1-file-appears`), one eligible `continue_delegate` prompt (`d1-second-pair-of-eyes`), one repetition each |
| model | `openai/gpt-6.1-sol`, no fallbacks. A trial any other model served is unscored and halts its arm |
| builds | A and B: `ab5a30ea79b776f149e24b1fccab9e79b0a5d299`. C: `f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306` |
| what it proves | that the live gateways answer the way the harness reads them: surface, runtime, served model, an election, cleanup, and real token and call counts |
| what it does not | **no rate.** One trial per prompt says nothing about propensity. Every comparison must print `not reportable` |
| enforced, whatever the provider or model does | **No number of tokens.** Time: a trial is killed by 480 s and the canary by 1800 s, each + 1 s. Admission, in the product: one message turn at a time per gateway, one direct child per session and none of its own, one collector per swarm group, no automation that fires by itself, no activity recap, no Skill Workshop review. See [Spend](#spend) |
| conditional: estimates, each on a named assumption | **1.98 M** a trial and **6.24 M** the canary at 5 s and 160 k a call; **5.7–18.3 M** and **17.5–55 M** at the product's own per-call limits on this route (500 k in, by its estimate, and 128 k out) and 5 s to 1 s a call; **10.1–33.7 M** and **30.7–101 M** if the estimate is off as far as the provider's window (1.05 M in). Each lane a turn opens beyond its one child adds 2.5–8.8 M to its trial at the product's limits, and **nothing bounds how many it opens** |
| supervision | a process of its own polls every gateway, and kills its unit at a limit. It is launched by `run`, and `run` sends nothing until it is armed |

Arm D (f9fcd3a5 under B's overlay) is **off**. Turning it on makes this 12 trials on four gateways, and needs 🌻 to say so.

| arm | launcher arguments | state dir | unit | port |
| --- | --- | --- | --- | --- |
| A | `ab5a30ea…` `ab5a30ea…` | `~/proof-gw/comp-ab5a30ea` | `openclaw-proof-comp-ab5a30ea` | 20846 |
| B | `706a2c56…` (a label) `ab5a30ea…` | `~/proof-gw/comp-706a2c56` | `openclaw-proof-comp-706a2c56` | 20966 |
| C | `f9fcd3a5…` `f9fcd3a5…` | `~/proof-gw/comp-f9fcd3a5` | `openclaw-proof-comp-f9fcd3a5` | 21086 |
| D, off | `2fef6685…` (a label) `f9fcd3a5…` | `~/proof-gw/comp-2fef6685` | `openclaw-proof-comp-2fef6685` | 21206 |

The ports are 120 apart and clear of 18789–18899, which the live gateway's derived ports can use
(`docs/gateway/multiple-gateways.md:20,107-113` at ab5a30ea).

## Commands

All on elliott, as the seat's user, by 🌻, in **one shell** (later steps use earlier variables). Nothing is run from another
seat. After the cut the live seat may itself run f9fcd3a5; the arms still run from their own stages, never from the live
install.

### 0. Look first

Reads only, apart from the harness checkout, the EvalBench install, a record directory, and what the tests start: processes and
transient user units under random names of their own, no OpenClaw among them, which they end and check are gone.

```bash
HARNESS=                      # the 40-hex head of #631 that 🌻 read
[[ $HARNESS =~ ^[0-9a-f]{40}$ ]] && echo harness sha ok
BOOT=karmaterminal/openclaw-bootstrap
AB5A=ab5a30ea79b776f149e24b1fccab9e79b0a5d299; F9FC=f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306
BLABEL=$(printf 'openclaw#1575 arm B of %s' "$AB5A" | sha1sum | cut -c1-40)      # 706a2c56…
FS=~/flesh_beast_best_beast/frond-scribe; L=$FS/scripts/proof-gw/composite-launcher.sh
LIVE=~/flesh_beast_tmp/openclaw; PB=~/flesh_beast_tmp/.openclaw-path-b; STAGE=$PB/stage-only; DONOR=~/flesh_beast_tmp/.openclaw-path-b-builds
DOCS=~/flesh_beast_best_beast/source/karmaterminal-openclaw-docs; W=~/flesh_beast_best_beast/source/WORKTREES/docs-evalprop-canary
git -C $DOCS fetch -q origin codeagent/cont-propensity-evalbench && git -C $DOCS worktree add --detach $W "$HARNESS"
cd $W/tools/evalbench-openclaw && ./bootstrap.sh && ./run.sh test        # needs uv on PATH, or UV set

# The "before" record. Step 6 compares against it and puts the receipts beside it.
REC=~/proof-runs/evalprop-canary-record-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p $REC; chmod 700 $REC
systemctl --user show openclaw-gateway -p MainPID -p ActiveEnterTimestamp > $REC/live-unit.txt
jq -r .commit $LIVE/dist/build-info.json | tee $REC/live-build.txt
sha256sum ~/.openclaw/openclaw.json > $REC/live-config.sha256
systemctl --user list-timers --all --no-legend | awk '{print $NF}' | sort > $REC/timers.txt; crontab -l > $REC/crontab.txt 2>/dev/null || true
{ ls -1d $PB/* $STAGE/* $DONOR/* 2>/dev/null || true; } | sort > $REC/builds.txt

# Each must print as shown. Anything else, stop here: nothing has been changed.
[ "$(gh api user --jq .login)" = elliott-dandelion-cult ] && echo actor ok
git -C $FS log -1 --format=%H -- scripts/proof-gw/composite-launcher.sh      # 67370bd94f19f9a0f89493d4f2b6360d5928183f, the one this was written against
[ "$(jq -r .agents.defaults.model.primary ~/.openclaw/openclaw.json)" = "$(./run.sh model)" ] && echo "live primary is the firing model"
for p in 20846 20966 21086; do ss -ltnH "sport = :$p" | grep -q . && echo "port $p BUSY"; done; echo ports checked
for d in comp-ab5a30ea comp-706a2c56 comp-f9fcd3a5; do [ ! -e ~/proof-gw/$d ] || echo "$d EXISTS: STOP, step 6 removes these"; done; echo state dirs checked
[ ! -e /tmp/evalprop ] && echo scratch path absent
free -g | sed -n 2p; df -h --output=avail ~/flesh_beast_tmp | tail -1
# The supervisor and its timer are transient units of this user manager; a stop is its SIGKILL.
systemctl --user show -p Version && for c in systemd-run ss; do command -v $c >/dev/null || echo "$c MISSING"; done; echo user manager checked
systemctl --user list-units --all 'openclaw-evalprop-*' --no-legend     # expect nothing
# Paths only, never values: strings under credential-like names in the part setup copies. A reference ({source, provider, id})
# is fine. A literal would sit in an isolated config (mode 600) until shred; 🌻 decides.
jq -c '[{agents: {defaults: .agents.defaults, main: .agents.entries.main}, models, tools, commands, messages, diagnostics, plugins: (.plugins.entries | {openai, codex, "diagnostics-otel"})}
  | paths(type == "string") | map(tostring) | select(any(.[]; test("key|token|secret|password|auth|header|cookie"; "i"))) | join(".")]' ~/.openclaw/openclaw.json
```

If the live primary is no longer `openai/gpt-6.1-sol`, the canary waits: the model is one value in `arms.json`, changed by a
commit, so the packet and the rehearsal change with it.

### 1. Stage both builds (no stop, no cutover)

Skip a build whose stage is already in `builds.txt`: check it with the last block and use it. Otherwise, one at a time (the
second only after the first has finished; GitHub keeps one waiting run per seat and would drop the other):

```bash
INSTALLED=$(jq -r .commit $LIVE/dist/build-info.json)
R=~/flesh_beast_best_beast/source/openclaw; for s in $AB5A $F9FC $INSTALLED; do git -C $R fetch -q origin $s; done
for s in $AB5A $F9FC; do git -C $R merge-base --is-ancestor $INSTALLED $s && echo "${s:0:8} forward" || echo "${s:0:8} NOT forward: add the flag"; done
gh workflow run deploy-gateway.yml --repo $BOOT -f target_prince=elliott -f approved_ref=$AB5A -f approved_base=$AB5A \
  -f stage_only=true -f reason="stage-only for the openclaw#1575 propensity canary, docs#631; installed $INSTALLED"
gh run list --repo $BOOT --workflow deploy-gateway.yml --limit 3         # wait for it; never cancel it
gh workflow run deploy-gateway.yml --repo $BOOT -f target_prince=elliott -f approved_ref=$F9FC -f approved_base=$AB5A \
  -f stage_only=true -f reason="stage-only for the openclaw#1575 propensity canary, docs#631; installed $INSTALLED"
```

After the cut, ab5a30ea is behind the installed build. The workflow then refuses it unless
`-f allow_non_forward_cutover=true` is added to that dispatch. Despite its name, nothing is cut over with `stage_only=true`.
Leave `path_b_mode` at its default, so elliott builds its own stage. Then:

```bash
for s in $AB5A $F9FC; do
  [ "$(jq -r .commit $STAGE/$s/dist/build-info.json)" = $s ] && [ -f $STAGE/$s/dist/extensions/diagnostics-otel/index.js ] \
    && [ -f $STAGE/$s/.path-b-stage-only/receipt.json ] && echo "staged ${s:0:8}"
done
```

### 2. Set up three isolated gateways

```bash
cd $W/tools/evalbench-openclaw
export PROOF_PRIMARY_MODEL="$(./run.sh model)" PROOF_FALLBACK_MODELS='[]'
PORT=20846 bash $L setup $AB5A   $AB5A && PORT=20846 bash $L stop $AB5A   $AB5A
PORT=20966 bash $L setup $BLABEL $AB5A && PORT=20966 bash $L stop $BLABEL $AB5A
PORT=21086 bash $L setup $F9FC   $F9FC && PORT=21086 bash $L stop $F9FC   $F9FC
./run.sh overlay A ~/proof-gw/comp-ab5a30ea/openclaw.json
./run.sh overlay B ~/proof-gw/comp-706a2c56/openclaw.json
./run.sh overlay C ~/proof-gw/comp-f9fcd3a5/openclaw.json
```

`setup` starts each gateway once to prove that it boots, and `stop` ends it before the overlay is written. The overlay also
writes the **spend caps and admission settings**, the same sixteen on every arm ([Product caps](#product-caps)), over
whatever the seat's own configuration says, and clears the agent's own settings that would outrank them.

### 3. Sign in, once per gateway (🌻's own account)

```bash
PORT=20846 bash $L login $AB5A $AB5A            # device code; 🌻 completes it privately, then:
PORT=20846 bash $L login-finish $AB5A $AB5A     # checks the profile landed in the ISOLATED store, restarts on the overlay

PORT=20966 bash $L login $BLABEL $AB5A          # the same for B, then:
PORT=20966 bash $L login-finish $BLABEL $AB5A

PORT=21086 bash $L login $F9FC $F9FC            # and C, then:
PORT=21086 bash $L login-finish $F9FC $F9FC
```

Three sign-ins, because a refresh token is never live in two gateways (`adopt-auth` moves one; it does not share it).
Nothing is copied from the live credential stores. Device codes and gateway tokens never go into a channel, an issue or an
argument.

### 4. Preflight (no session, no model turn)

```bash
export OPENCLAW_EVAL_TOKEN_FILE_A=~/proof-gw/comp-ab5a30ea/gateway.token
export OPENCLAW_EVAL_TOKEN_FILE_B=~/proof-gw/comp-706a2c56/gateway.token
export OPENCLAW_EVAL_TOKEN_FILE_C=~/proof-gw/comp-f9fcd3a5/gateway.token
for p in 20846 20966 21086; do timeout 120 bash -c "until ss -ltnH 'sport = :$p' | grep -q .; do sleep 2; done" || echo "port $p not up"; done
./run.sh preflight        # three times "ok": true, each with "model": "openai/gpt-6.1-sol" and "caps": {"verdict": "verified", …}
```

It only reads, so one retry is fine (a gateway can still be starting). Anything else twice: stop. **`caps not in force` is a
stop too**: every cap and admission setting (one message turn at a time, cron's scheduler off, no utility model, Skill
Workshop's review off) has to be in the file, in the effective configuration, and in the revision the running gateway says
it has applied. The same readback is made before and after every trial, and a trial that fails it is unscored and halts the
whole canary.

### 5. The nine trials

```bash
GO=                           # 🌻's message id
OUT=~/proof-runs/evalprop-canary-$(date -u +%Y%m%dT%H%M%SZ)
./run.sh run --go "$GO" --out $OUT --num-trials 1 --token-budget 800000 --run-token-cap 2400000 --run-seconds 1800 \
  --scenarios c1-arithmetic,w1-file-appears,d1-second-pair-of-eyes
echo "exit $?"
```

`run` first sets a systemd timer, then starts the supervisor, each in a transient unit of its own, and sends nothing until
the supervisor says it is armed: every unit proved to be the isolated gateway, every usage reading made once. When it
ends, **all three gateways are stopped**, whether it ended well or not.

**Ctrl-C stops every gateway at once**, then lets the run end in order; a second Ctrl-C ends it there. Killing `run.sh` or
closing its terminal stops them too. To stop everything without it, from any shell on the seat, kill the gateways and then what
can outlive them:

```bash
systemctl --user kill --signal=SIGKILL openclaw-proof-comp-ab5a30ea openclaw-proof-comp-706a2c56 openclaw-proof-comp-f9fcd3a5
systemctl --user stop openclaw-proof-comp-{ab5a30ea,706a2c56,f9fcd3a5}-login 2>/dev/null
# A durable exec runs in its own unit, outside the gateway's. Its log is under the state dir of the gateway that started it:
grep -lE "append:$HOME/proof-gw/comp-(ab5a30ea|706a2c56|f9fcd3a5)/" /run/user/$(id -u)/systemd/transient/openclaw-proc-*.service 2>/dev/null \
  | xargs -r -n1 basename | xargs -r systemctl --user stop
```

`./run.sh stop --plan $OUT/private/supervision-plan.json` does the same for that run, and says whether it is proved. A plain
`stop` is not the emergency brake: the gateway may drain its running turns first, for up to 330 s. Their state is
disposable, so a kill loses nothing. A gateway that was stopped for a reason, or in the middle of a trial, has
`supervisor-stop.json` beside its state, and neither `run` nor the supervisor will use it again: the product resumes an
interrupted turn when it starts (`src/gateway/session-restart-resume.ts:527-556`). The three shell commands leave no such file,
so a gateway stopped that way is shredded too. Step 6 removes all of them.

### 6. Afterwards, whatever happened

Run the three commands of the emergency stop first (they are harmless when nothing is left, as after any ended run). Then:

```bash
finish() {  # <arm> <port> <launcher arg 1> <launcher arg 2>; removes a gateway only after its state is shredded
  local d=~/proof-gw/comp-${3:0:8}; [ -n "${3:-}" ] && [ -d "$d" ] || { echo "$1: no gateway"; return 0; }
  cp -a "$d/receipts" "$REC/receipts-$1"; rm -f "$REC/receipts-$1/login.log"      # the log held a device code
  cp -a "$d/supervisor-stop.json" "$REC/supervisor-stop-$1.json" 2>/dev/null || true       # only if a supervisor stopped it
  PORT=$2 bash $L stop $3 $4 && PORT=$2 bash $L shred $3 $4 && rm -rf "$d" && echo "$1: removed" || echo "$1: NOT removed, look at $d"
}
finish A 20846 $AB5A $AB5A; finish B 20966 $BLABEL $AB5A; finish C 21086 $F9FC $F9FC

# The live seat is as it was:
systemctl --user show openclaw-gateway -p MainPID -p ActiveEnterTimestamp | diff - $REC/live-unit.txt && echo live unit unchanged
jq -r .commit $LIVE/dist/build-info.json | diff - $REC/live-build.txt && echo live build unchanged
sha256sum -c $REC/live-config.sha256
systemctl --user list-timers --all --no-legend | awk '{print $NF}' | sort | diff - $REC/timers.txt && echo timers unchanged
crontab -l 2>/dev/null | diff - $REC/crontab.txt && echo crontab unchanged
systemctl --user list-units --all 'openclaw-proof-comp-*' 'openclaw-evalprop-*' --no-legend; ls -d ~/proof-gw/comp-* /tmp/evalprop 2>/dev/null     # expect nothing from this run
grep -l 'proof-gw/comp-' /run/user/$(id -u)/systemd/transient/openclaw-proc-*.service 2>/dev/null                              # expect nothing
```

If the full fire is expected soon, the stages can stay. When they are no longer wanted, remove **only what this run made**:

```bash
for s in $AB5A $F9FC; do grep -qxF "$STAGE/$s" $REC/builds.txt || git -C $LIVE worktree remove --force $STAGE/$s; done      # the receipt's own remove_command
{ ls -1d $PB/* $STAGE/* $DONOR/* 2>/dev/null || true; } | sort | comm -13 $REC/builds.txt -      # what else appeared; nothing reaps it
git -C $DOCS worktree remove --force $W; rm -rf ~/.cache/openclaw-evalbench
```

In that list, `payload-<sha>-*`, `generated-outputs-<sha>-*.list` and `rollback-config-probe.*.log` for these two SHAs can be
removed by name. **Leave `artifact-<sha>`**: elliott is the donor for silas, emeric and rune, and another seat's deploy may be
using it. The pnpm stores and receipts stay too.

Shredding removes the isolated sign-ins from disk. It does not revoke them at the provider; 🌻 can, from the account's own
session list.

## Isolation

### What it creates, and how each piece goes

| piece | where | removed by |
| --- | --- | --- |
| two staged builds | `.openclaw-path-b/stage-only/<sha>`, and their worktree entries and fetched refs in the live checkout's `.git` | step 6, second block (the refs stay) |
| what staging leaves beside them | `payload-<sha>-*`, `generated-outputs-*`, a probe log, receipts and a pnpm store in `.openclaw-path-b`; `artifact-<sha>` and a pnpm store in `.openclaw-path-b-builds` | by hand, from step 6's list. `artifact-<sha>`, the stores and the receipts stay |
| three gateways: config, token, state, sign-in, workspace, log | `~/proof-gw/comp-*` (mode 700) | `finish`: `stop`, `shred`, then `rm -rf` |
| three transient units, and a login unit each | `openclaw-proof-comp-*` in the user manager | the supervisor when the run ends, the emergency stop, and `finish`. They are never enabled and don't restart |
| the supervisor, and its timer | `openclaw-evalprop-supervisor-<run>`, `openclaw-evalprop-deadman-<run>` | themselves: the supervisor ends with the run and removes the timer once every gateway is proved stopped |
| one session per trial, its children and continuations | inside the isolated state | the harness archives and deletes them after every trial; a failed cleanup halts the arm |
| commands a turn started, background ones included | the gateway's own cgroup | any stop |
| a **durable** command a turn started | its own unit, `openclaw-proc-<hash>`, which outlives the gateway | the supervisor, when its trial ends and again at any stop, by its log path; the emergency stop; step 6 checks |
| automations a turn created | the isolated state; cron's scheduler is off, so none fires by itself, and a forced run is the turn's own | `shred` |
| the run's results, with replies and tool arguments | `$OUT` (mode 700; `private/` holds the full trial records, and the supervisor's plan, events and receipt, which name token files and hold no token) | kept. Read `evals.csv` before publishing anything |
| the before/after record and receipts | `$REC` | kept |
| harness checkout and the EvalBench install | `$W`, `~/.cache/openclaw-evalbench` | step 6, second block |
| journal lines, traces and metrics | the user journal; the frond's collector, under `elliott-proof-comp-*` service names, with the seat's own content-capture setting | not removed |

### What it never touches

| | held by |
| --- | --- |
| the live gateway process, its unit and port 18789 | the adapter refuses that port and any URL that isn't loopback; no step here stops, starts or deploys the live unit; step 6 compares pid and start time |
| the contents of `~/.openclaw/openclaw.json` | it is read by each `setup` (`jq`), by each stage's two `config validate` runs, and by step 0. `overlay` refuses any path under `~/.openclaw`. Step 6 compares its sha256 |
| live state, sessions and credential stores | each gateway has its own `OPENCLAW_STATE_DIR` and its own sign-in; the launcher never opens the live stores |
| the live workspace | each gateway's `agents.defaults.workspace` is its own empty directory |
| any channel | the isolated config has none, and preflight refuses a gateway that has one |

### What is not isolated

- **It is not a sandbox.** A turn's `exec` runs as the seat's user, with the seat's own `tools` policy, which `setup` copies.
  So the table above is about this harness and the gateways, not about what a model could type. The three prompts ask for
  arithmetic, for a look at a file in `/tmp/evalprop`, and for a second opinion on three numbers and their total.
- **The provider quota is shared.** It is 🌻's account. A rate limit here is a rate limit for the live seat too; the first 429
  halts its arm.
- **The live gateway's log, once.** `setup` boots each gateway before the overlay gives it a log of its own. Those start-up
  lines go to the live gateway's rolling log in `/tmp/openclaw`, and that boot may prune rolled logs there that are over 24
  hours old. Preflight refuses a gateway that still has no log of its own. The directory stays the temp root for every
  gateway on the host.
- **Much of the live config is copied**: `agents.defaults`, `agents.entries.main`, `models`, `tools`, `commands`, `messages`,
  `diagnostics` and three plugin entries, with any credential written into them. Step 0 lists where one could be.
- **The three arms share the host.** `/tmp/evalprop` must stay absent; `run` refuses to start if it exists, and every trial
  records whether it does.
- Three Node processes at once, each allowed a 16 GB heap.

## Spend

Metered tokens, cache reads included. **Enforced** is a number that holds whatever the provider or the model does, beside
what holds it. **Conditional** is an estimate, beside the assumption it rests on. No number of tokens is enforced.

### Enforced

| what | the bound | what holds it | tested by |
| --- | --- | --- | --- |
| one trial's time | killed by 480 s, + 1 s | the supervisor's own clock, then SIGKILL of the gateway's unit | a turn that spends nothing and never ends |
| the canary's time | killed by 1800 s, + 1 s; 1860 s if the supervisor and the runner both die | the same clock; then a systemd timer | a run with no trial at all; both processes killed |
| the kill, once a limit is crossed | within 12.5 s of the last reading under it, whatever the readings do; 4.5 s while every reading is on time | the supervisor: a reading a second on its own connection, its own clock, then the kill until it is proved | fakes that loop, ignore every abort, or stop answering; a real systemd unit |
| message turns at once on one gateway (the main lane, where every message's turn runs, `src/auto-reply/reply/agent-runner-fallback-candidate.ts:110-115`; other turns run in another lane, [below](#what-nothing-here-bounds)) | **1**; a second waits in the queue | `agents.defaults.maxConcurrent: 1`, the main lane's width (`src/gateway/server-lanes.ts:33,75`, `src/config/agent-limits.ts:33-38`) | the product's own queue at both SHAs: two turns start one after the other, and both at once without it (probe) |
| direct children of one session (`sessions_spawn` without `collect`, and a delegate with a delay) | **1** at a time, none of its own | `subagents.maxChildrenPerAgent`, `maxConcurrent` and `maxSpawnDepth`, 1 each (`src/agents/child-admission.ts:84-109`, `server-lanes.ts:83`) | the probe; a fake that tries six spawns runs one child and is refused five, in the product's words, which the trial records |
| collectors in one swarm group | **1** (a turn names as many groups as it likes: [below](#what-nothing-here-bounds)) | `tools.swarm.*`, 1 each | the probe |
| automations that fire by themselves | **none**: scheduled, event and watcher fires, the proactive check among them. It is what heartbeat became: an automation every 30 min on the main session, which setup or onboarding may create (`src/cron/default-proactive-job.ts:26-54`); heartbeat's own config is retired, and the schema refuses it (`src/config/types.agent-defaults.ts:25-26`) | `cron.enabled: false` (`src/gateway/server-cron-lazy.ts:23-24`, `src/cron/service/scheduler-actor.ts:138`, `ops-event.ts:80`; watchers `src/gateway/server-cron.ts:203,944`) | the probe, through the gateway's own cron state |
| the activity recap after a turn (a model call of its own) | **none** | `agents.defaults.utilityModel: ""` (`src/agents/utility-model-setting.ts:23-24`, `src/gateway/session-activity-summaries.ts:186-191`) | the probe |
| Skill Workshop's review of a session, a forked turn of its own | **none** | `plugins.entries.skill-workshop.config.autonomous.mode: "off"`, with `meta.migrations.skillWorkshopPlugin: true`, the marker without which the runtime ignores that entry (`src/config/skill-workshop-plugin-migration.ts:92-121`; `extensions/skill-workshop/src/review-service.ts:44`, `experience-review-scheduler.ts:322`) | the probe: `off` with the marker, `auto` without it |
| continuations of the turn | no continuation wake, and no delegate without a delay | `continuation.costCapTokens: 1`, `maxChainLength: 1` | the probe: `cost-capped`, then `chain-capped`; a wake in a trial is `caps_mismatch`. Other turns can follow it ([below](#what-nothing-here-bounds)) |

Each setting in it is written by `overlay` on every arm, and read back like the caps: in the file, in the effective
configuration and in the revision the running gateway has applied, at preflight and before and after every trial. One that
is not in force halts every arm. They limit what runs and leave what the model is shown as it was
([Product caps](#product-caps)).

### What nothing here bounds

- **Tokens in one call.** On this route (a ChatGPT sign-in, `openai-chatgpt-responses`) no output limit is ever sent: the
  request has no `max_output_tokens`, whatever `maxTokens` says (`packages/ai/src/providers/openai-chatgpt-responses-request.ts:48-105`).
  The model's own maximum, 128,000 (`extensions/openai/openclaw.plugin.json:126`), is the provider's to hold. Input is checked
  before each request against the route's budget, 500,000 (`extensions/openai/model-route-contract.ts:2`), by an estimate
  (characters ÷ 4, weighted: `packages/normalization-core/src/cjk-chars.ts:10`) and with no reserve
  (`src/agents/embedded-agent-runner/run/attempt-setup.ts:440-486`). The estimate's error is not bounded: at 3 characters a
  token the same check admits 667 k.
- **Calls in one turn.** The agent loop counts none (`packages/agent-core/src/agent-loop.ts:250`). Loop detection is off by
  default and stops only repeats.
- **Seconds a call.** The provider's.
- **The lanes a turn opens itself.** Each puts a model call beside the turn's, and no setting that leaves the surface as it
  is closes it:
  - a collector in **every swarm group**: the group is the call's own `groupId`, each group admits its first
    (`src/agents/subagents/spawn/subagent-spawn-request.ts:241-247,262-276`), and each has a lane of its own
    (`src/agents/subagents/swarm/swarm-scheduler.ts:428`);
  - a **forced automation run**: `automations` with `runMode: "force"` ignores `cron.enabled`
    (`src/gateway/server-methods/cron-run.ts:50-52`, `src/cron/service/ops-run.ts:27-55`), in a lane 8 wide
    (`server-lanes.ts:58`). The tool waits on it 60 s, or up to 10 min if the call asks (`src/agents/tools/cron-tool.ts:102,636-639`),
    and a run that outlasts the wait goes on beside the turn;
  - **`sessions_send`** to another session, a lane for each (`src/agents/lanes.ts:26-31`);
  - the **tool calls of one response**, which run at once (`packages/agent-core/src/agent-loop.ts:570-591`), so tools that call
    a model themselves (image, pdf, web search through a model, deep research) overlap one another;
  - **media generation** and **deep research** jobs, which run on after their tool returns;
  - **turns that follow the trial's and are no continuation**: an `automations` `wake`, which checks neither cron's switch nor
    the continuation caps (`src/cron/service/wake.ts:150-158`) and goes to the caller's own session unless it names another
    (`src/agents/tools/cron-tool.ts:676-697`); the exit notice of a background `exec`, on by default
    (`src/agents/bash-tools.exec-notify.ts:31-48`, `bash-tools.exec-request-preparation.ts:167`); and a child's completion
    announce. Each is a turn of its own, after the trial's on its session or beside it on another. The wake and the exit
    notice run in the lane for internal events, 8 wide (`agent-runner-fallback-candidate.ts:110-115`); the announce asks for
    no lane and takes the main one (`src/agents/subagents/announce/subagent-announce-direct-delivery.ts:380-399`,
    `src/agents/embedded-agent-runner/lanes.ts:35`), behind the trial's turn. None writes a `[continuation:wake]` row, so the
    trial's wake check doesn't see them; the trial's cleanup deletes its session, and the supervisor meters them.
  - **two collectors spawned into one group at once**: collector admission takes no reservation
    (`subagent-spawn-request.ts:298-304`), so both may be admitted. The group's lane still runs them one at a time. Not
    verified.

  Closing them would change what the model is shown: swarm off removes `agents_wait` and changes `sessions_spawn`, and
  denying a tool removes it (the probe's negative controls). The supervisor stops a gateway at the first reading that lists a
  third active run. That is detection, not admission: what those lanes spend until then is in the conditional column.
- **What the meter can't see.** A tool's own model call and a media or research job spend outside `sessions.usage`. Only
  the clocks bound them.

### Conditional

One trial: the supervisor's limit, 0.70 M, plus what the turn and its one child spend from the last reading under the limit
to the kill: a call finishing at once, one for each whole call in that time, and the one in flight, each counted in full.
The canary: the smaller of nine trials, and the run's limit, 2.40 M, plus the same for each of the three arms.

| assumption | one trial | the canary |
| --- | --- | --- |
| 5 s and 160 k a call (the packet at `d78d1614`) | 1.98 M | 6.24 M |
| 5 s, and 375 k a call, 75 % of 500 k (its "most context" case) | 3.7 M | 11.4 M |
| 5 s, and the most this route lets a call carry: 500 k in by the product's estimate and 128 k out, 628 k | **5.7 M** | **17.5 M** |
| the same at 2 s a call | 10.7 M | 32.5 M |
| the same at 1 s a call | **18.3 M** | **55 M** |
| for each lane beyond the turn and its child that is open when a limit is crossed | + 2.5 M at 5 s, 5.0 M at 2 s, 8.8 M at 1 s | the same, for each arm |
| 5 s, and the most the provider takes: its window, 1,050,000 in (`extensions/openai/openclaw.plugin.json:124`), and 128 k out, 1.178 M, if the product's estimate is off that far | 10.1 M | 30.7 M |
| the same at 1 s a call | **33.7 M** | **101 M** |
| 5 s and 628 k, while every reading is on time (4.5 s, not 12.5 s) | 3.2 M | 9.9 M |

- **The 3.7 M and 11.4 M were too low for this route.** They took 75 % of the window as the most a call carries before it
  is compacted. On a ChatGPT sign-in OpenClaw's own early compaction is off (`run/attempt-prompt-phase.ts:136-145`) and the
  provider's starts at 90 % (`run/chatgpt-v2-compaction.ts:127-139`); the check before a request admits the whole estimated
  budget; and the output is not limited at all. So 628 k replaces 375 k.
- **A call gets there in three.** One response's tool results together may be 1,000,000 characters
  (`src/agents/embedded-agent-runner/tool-result-truncation.ts:433-458`), about 250 k tokens, so 60 k, about 440 k, then the
  budget.
- **The product's estimate is the only check below the provider's window.** 628 k is what it lets through when it is right;
  1.178 M is what the provider would take if it were wrong by that much.
- **Below 1 s a call, and with every lane a turn opens, the numbers grow without limit.**
- **Expected** is as it was: 0.2 M a trial, 0.47 M for the dearest expected, 1.6 M for the canary, 5–15 min. The supervisor's
  limits are multiples of it: 0.70 M is 1.5 × the dearest trial (6 calls × 60 k × 1.3 = 468 k), and 2.40 M is 1.5 × 1.6 M.
  `--token-budget 800000` is the per-arm stop checked between trials (1.5 × 0.54 M): it starts no further trial and is not a
  ceiling.

### The residual

For 🌻's risk decision. **Enforced**: time (480 s a trial, 1800 s the canary) and admission (one message turn, one direct
child, one collector a group, no automation, recap or review that starts by itself). **Not enforced**: tokens. With the turn
and its child, 5.7–18.3 M for one trial and 17.5–55 M for the canary at 5 s to 1 s a call, if the product's input estimate
holds, and 10.1–33.7 M and 30.7–101 M if it is off as far as the provider's window; 2.5–8.8 M more for every swarm group,
forced automation, wake or other session a turn starts before the supervisor's next reading, and how many it starts is the
model's choice. What would make it a ceiling is outside this
harness's pinned builds, and each is a decision of its own:

1. **A proxy in front of the provider**, owned by the harness: one request at a time per gateway, a refusal past a token
   budget, an output limit added to each request. It is admission at the only place every call passes, and it changes
   nothing the model is shown. It needs the route's base URL pointed at it and the sign-in's traffic through it, and only a
   started gateway can prove it. Not built here.
2. **Settings that change the surface**: swarm off, or `automations` and `sessions_send` denied. They close those lanes and
   change what is measured. 🌻's constraint excludes them.
3. **A per-call output limit in the product**: the ChatGPT route would have to send one. A change to openclaw.

### How the supervisor was tested

| it does | tested by |
| --- | --- |
| a trial's limit, 0.70 M: every reading on its own connection; then `sessions.abort`, then SIGKILL of the unit's cgroup, through the kernel and then systemd, until it is proved | a fake gateway process that loops and ignores every abort and delete; looping children; a real systemd unit. Each is dead within its limit plus its own rate × one interval, and the trial's cleanup still ran. Also: a disk that takes no record, an abort that is never answered, a first stop that fails, a systemd that answers nothing |
| the canary's limit, 2.40 M: the sum over the arms, every reading; every gateway is stopped | two gateways looping, neither at the limit alone |
| 0.15 M outside a trial | a child the harness's cleanup cannot see, which starts spending after a clean trial |
| a third active run | collectors in six swarm groups, each admitted, stopped before any has finished a call |
| what the session list hides | `sessions.usage`'s own total, every 30 s, at the same limits; unreadable four times in a row is a stop |
| 10 s without a whole reading | a gateway that keeps the socket open and answers nothing. One that stalls for 1 s is left alone |
| the durable exec | a real systemd unit with a real durable unit, a stray unit, a bound scope and a loose process: all ended. Stopping the gateway's unit alone leaves the durable exec running. Another gateway's durable exec, and a command that only mentions this one's paths, are untouched |
| the runner dying, or Ctrl-C | a dropped runner connection, with the runner's own stop disabled; SIGINT to a whole offline run |
| the supervisor dying or hanging | SIGKILL, and SIGSTOP: the runner stops every gateway |
| both dying | both killed: the timer alone stops the unit and its durable exec |

**Measured** at these limits on a real user unit (ronan, fakes, no model): a loop of two lanes at 60 k and 5 s a call was stopped
at 745,240 metered tokens, 30.1 s in, its processes gone within 2 ms of the kill, and everything it owned, a durable exec
included, proved ended within 0.5 s. A gateway that stopped answering was killed 10.01 s after its last reading and as fast.
That is the supervisor at the fakes' rates. It is not a provider's rate, and it is no ceiling.

### Product caps

The same on every arm, written by `overlay`, read back before and after every trial. All in configuration paths that the
product reads from `agents.defaults`, `tools` or `cron`, with the lines that enforce them in
[`README.md`](README.md#spend-caps-and-admission), at both SHAs.

| cap | value | product default | what it bounds |
| --- | --- | --- | --- |
| `continuation.maxChainLength` | 1 | 10 | the chain |
| `continuation.costCapTokens` | 1 | 500,000 | **every follow-up but a delayed delegate**: the election is answered `scheduled` and recorded, and at the turn's end the chain is over its cap, so no wake and no delegate runs. A delegate with a delay (5 s at least) is checked when it fires, on a chain nothing has been charged to yet: unless its trial has been cleaned up by then, it runs, as the one child |
| `continuation.maxDelegatesPerTurn` | 1 | 5 | delegate fan-out |
| `subagents.maxChildrenPerAgent`, `maxConcurrent`, `maxSpawnDepth` | 1, 1, 1 | 5, 8, 5 | directly spawned children: one, with none of its own |
| `subagents.runTimeoutSeconds` | 120 | none | a child's run (a turn may ask for longer; the supervisor's clock doesn't) |
| `tools.swarm.maxConcurrent`, `maxChildrenPerGroup`, `maxTotalPerGroup` | 1, 1, 1 | 32, 50, 200 | collectors, which the child cap does not count. Per group, and a turn names its groups |
| `agents.defaults.timeoutSeconds` | 330 | 48 h | a turn. The harness stops it at 300 s, and reads it |
| `agents.defaults.maxConcurrent` | 1 | 8 or more | **admission**: one turn at a time in the main lane |
| `cron.enabled` | false | true | **admission**: no automation fires by itself. A forced run still does |
| `agents.defaults.utilityModel` | `""` | the provider's | **admission**: no activity recap after a turn. The turn's tools don't use it, and its prompt only if a progress-card renderer is paired, which an isolated gateway's fresh state has none of (`attempt-system-prompt-additions.ts:56-83`) |
| `plugins.entries.skill-workshop.config.autonomous.mode`, with `meta.migrations.skillWorkshopPlugin` | `"off"`, `true` | `"auto"`, unset | **admission**: no Skill Workshop review. The marker records what Doctor would: there is no older Workshop setting to move, as the launcher copies none |

`request_compaction` needs no cap: the product refuses it on a session's first turn, and below 70 % of the context after that.
**No context budget is set**, though `models.providers.openai.models[].contextTokens` would lower the check above: it would also
move `request_compaction`'s 70 % guard and the context-pressure events that prompt it, and that is one of the choices measured.

**They don't touch what the turn's model is shown.** [`probes/product-probe.mts`](probes/product-probe.mts) runs the product's own
code at both SHAs ([receipts](probes/receipts)): the config schema and `config.get`'s readback accept every cap and show each,
authored and effective. Then, for each arm, two ways: the `/context` path (the 66 tools the product builds and their prompt),
and the run's own surface on the firing model, through the product's tool-surface runtime: Code Mode's controls and its
catalog of the rest for A and C, every tool direct for B and D, and the prompt as the attempt builds it, continuation section
included. Both are byte for byte the same with and without the caps (names, descriptions, parameters, catalog, prompt), on
every arm, for each cap alone and all together. Three settings that would change the surface (swarm off, an empty
`allowAgents`, `automations` denied) are each seen to, in both. The three continuation descriptions hash to `arms.json`'s at
each SHA. What it does not show is a gateway: preflight's readback is what shows the caps applied.

Two exceptions, the same on every arm. A child is shown less: with `maxSpawnDepth: 1` it is a leaf, without the spawn tools
and with its own depth in its instructions (`src/agents/agent-tools.policy.ts:82-92`). And with one main slot, a child that opens
with a message of its own (`sessions_spawn` with `visible: true`, `session-create-initial-turn.ts:88-97`) may wait for the
parent's turn to end, as may a trial's turn for main-lane work the trial before it left. Neither is verified on a gateway.

**What a turn can still notice** is a refusal it earned (a second child while the first runs, a second collector in a group,
a second delegate in one turn), every `automations` answer with cron's scheduler off (`status` says `enabled: false`, and a job
it adds never fires by itself), and every `skill_workshop` answer with its review off (`list` says `off`). Each trial records
these as **treatment limitations** (`limitations` in its record: the tool, the setting its answer named, and the answer's
status), and whether an election was decided in a later response than one (`electedAfterLimitation`). The report counts them
per arm and leaves the rates alone. **Not recorded**: a child's own refusals (a grandchild), which are in the child's turn and
not the trial's; and a child stopped by its 120 s run timeout, whose answer says `timeout` and names no setting.

## Pass and stop rules

**Pass** means all of these:

1. `run` exits 0, with `failures` empty and every arm's `halted` null in `manifest.json`.
2. 9 of 9 trials scored, `unscored: none`. One trial that hit its deadline may be scored (`carried`); none may be `deadline_unreadable`.
3. **Surface** section, each arm: `surface: verified 3` (or `verified 2, carried 1`) and `contradictions: 0`. Description text:
   `none` for A, `match` for B and C (9 each, or 6 if `request_compaction` isn't registered).
4. `runtime: openclaw 3` in **every** arm. elliott is embedded, and only on that runtime does C carry the whole change.
5. `served: openai/gpt-6.1-sol 3` in every arm.
6. `tools:` shows 0 deferred and no Code Mode for B, and some deferred for A and C. That is what the contrast names claim.
7. No record problems, scratch path present 0, and every trial's cleanup ok.
8. `caps verified: 3` and `continuation wakes: 0` in every arm. `treatment limitations` is read, not judged: each one is a
   trial whose model was shown a cap or admission setting, and its record says which and what came after.
9. **Supervision** section: `halted: no`, `supervisor lost: no`, every arm `stopped by run-finished` and `proved stopped: yes`, and no
   longest gap above 10 s. No arm reached its 0.8 M stop, which is checked between trials.
10. Every comparison reads `not reportable`.
11. Step 6's live-seat checks all pass.

**Not a pass rule:** whether anything elected. If none of the six eligible trials did, the canary passes, but the harness has
still never read a live election. Say so when asking for the fire.

**The supervisor stops by itself** for spend, time, fan-out, a gateway it can't read, and a lost runner; any of those fails the
canary. **A person stops at once** (the kill in step 5) if: the live gateway's pid changes or the live seat misbehaves; a
provider refusal or rate limit appears; `/tmp/evalprop` appears; anything is posted to a channel; `SUPERVISOR COULD NOT STOP` is
printed; or 🌻 wants it stopped. Then step 6, and nothing is rerun without a new go.

**Fail, no rerun:** any rule above that doesn't hold. An arm on the Codex harness or on another model is a stop and a
question, not something to configure around on the spot.

## What a reviewer reads afterwards

| file in `$OUT` | for |
| --- | --- |
| `manifest.json` | the go, `model`, `caps`, harness SHA and `harnessDirty: false`, EvalBench pin = head, budget and its rule, each arm's `halted` and `meteredTokens`, and `supervision`: the limits, the supervisor's receipt, and each gateway's stop |
| `report.md` | Surface (rules 3–6 and 8, and the treatment limitations), unscored, largest trial, the comparisons' names and notes, Supervision (rule 9) |
| `private/supervisor-events.jsonl` | every begin, end and stop, with its time and tokens |
| `results/<job>/configs.csv` | `OPENCLAW_EVAL_MODEL` and the arm, as EvalBench recorded them |
| `results/<job>/evals.csv`, `scores.csv` | each election, against `continuation_election`'s row for it |
| `private/trials-{A,B,C}.jsonl` (🌻 only) | the whole record: tool calls, reply, surface, runtime, cleanup, seconds, and `limitations` |
| `$REC/receipts-{A,B,C}/identity.json`, `config-shape.json` | runtime SHA, unit, port; model and no channel, as `setup` derived them (preflight's output has them after the overlay) |

```bash
for a in A B C; do jq -c '{arm, promptId, status, elected, tools: [.elections[]?.tool], served: .servedModels, source: .servedModelSource,
  runtime, surface: .surface.verdict, calls: .modelCalls, metered, seconds, cleanup: .cleanup.ok, limits: [.limitations[]?.settings[]],
  afterLimit: .electedAfterLimitation}' $OUT/private/trials-$a.jsonl; done
```

Two things only this can show: whether an election the harness recorded is one a person reading the transcript agrees with,
and the real calls per trial, tokens per call and seconds per call. The last three put numbers where the conditional column
has assumptions **before** anyone asks for the 270-trial fire. They do not make it a ceiling.

## CI handoff

Arm C's build is `f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306`. Its Mode-B receipts are named on
[karmaterminal/openclaw#1575](https://github.com/karmaterminal/openclaw/issues/1575); this packet adds no verdict to what is
posted there.

| receipt | run | workflow |
| --- | --- | --- |
| full | [45606214935](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/45606214935) | `51546ce6ac213d9e2f62c58a318248652a45e7e7` |
| subset | [45658851673](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/45658851673) | the same |
| subset 2 | [45686079091](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/45686079091), in progress when this was written | the same |
| 🌿's classification | [#1575 comment 7170483613](https://github.com/karmaterminal/openclaw/issues/1575#issuecomment-7170483613), interim | |

**The canary's live gate waits on 🌊's cut decision.** Nothing here asks for the gateways to be set up before it.
