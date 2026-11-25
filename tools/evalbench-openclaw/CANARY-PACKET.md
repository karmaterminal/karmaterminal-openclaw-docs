# Canary packet: nine trials on elliott

For 🌻 to approve or not. 🌻 elected to **host** this eval on elliott after the continuation cut. That is a host
election, not a go, and **this packet isn't one either**. Nothing below has been run. The go for the nine trials is
🌻's own message id, passed to `run --go`. The 270-trial fire needs a second one. The live gate also waits on 🌊's cut
decision ([CI handoff](#ci-handoff)).

🌻 read this packet at `52465362` (room 19:34Z, message 1575233154115969149) and would not accept its exposure: 1.6 M
tokens was an expectation, and the 51 M and 276 M beside it were enforced by nothing. [Spend](#spend) is now what is
enforced, what enforces each number, and how that was tested.

karmaterminal/openclaw#1575 · docs PR #631 · design and statistics in [`README.md`](README.md).

## What it is

| | |
| --- | --- |
| trials | **9**: arms A, B, C × one control (`c1-arithmetic`), one eligible `continue_work` prompt (`w1-file-appears`), one eligible `continue_delegate` prompt (`d1-second-pair-of-eyes`), one repetition each |
| model | `openai/gpt-6.1-sol`, no fallbacks. A trial any other model served is unscored and halts its arm |
| builds | A and B: `ab5a30ea79b776f149e24b1fccab9e79b0a5d299`. C: `f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306` |
| what it proves | that the live gateways answer the way the harness reads them: surface, runtime, served model, an election, cleanup, and real token and call counts |
| what it does not | **no rate.** One trial per prompt says nothing about propensity. Every comparison must print `not reportable` |
| enforced spend | **1.34 M** metered tokens for one trial, **4.32 M** for the canary, with the gateways answering; see [Spend](#spend) for what those rest on, and the numbers when one stops answering |
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

Reads only, apart from the harness checkout, the EvalBench install and a record directory.

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
systemctl --user show -p Version && command -v systemd-run ss >/dev/null && echo user manager ok
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
writes the **spend caps**, the same thirteen on every arm ([Product caps](#product-caps)), over whatever the seat's own
configuration says.

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
stop too**: every cap has to be in the file, in the effective configuration, and in the revision the running gateway says it
has applied. The same readback is made before and after every trial, and a trial that fails it is unscored and halts the
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

**Interrupting `run.sh` (Ctrl-C) stops every gateway**, and so does killing it or closing its terminal. To stop everything
without it, from any shell on the seat, kill the gateways and then what can outlive them:

```bash
systemctl --user kill --signal=SIGKILL openclaw-proof-comp-ab5a30ea openclaw-proof-comp-706a2c56 openclaw-proof-comp-f9fcd3a5
systemctl --user stop openclaw-proof-comp-{ab5a30ea,706a2c56,f9fcd3a5}-login 2>/dev/null
# A durable exec runs in its own unit, outside the gateway's. Its log is under the state dir of the gateway that started it:
grep -lE "append:$HOME/proof-gw/comp-(ab5a30ea|706a2c56|f9fcd3a5)/" /run/user/$(id -u)/systemd/transient/openclaw-proc-*.service 2>/dev/null \
  | xargs -r -n1 basename | xargs -r systemctl --user stop
```

`./run.sh stop --plan $OUT/private/supervision-plan.json` does the same for that run, and says whether it is proved. A plain
`stop` is not the emergency brake: the gateway may drain its running turns first, for up to 330 s. Their state is
disposable, so a kill loses nothing. A gateway the supervisor stopped for a reason has `supervisor-stop.json` beside its
state, and neither `run` nor the supervisor will use it again: it could resume what it was doing. Step 6 removes it.

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
| automations a turn created | the isolated state | `shred` |
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

Metered tokens, cache reads included. **Expected is an estimate. Enforced is where something stops it.**

| | expected | product caps alone | the supervisor's limit | **enforced**: limit + one polling interval | if its gateway also stops answering |
| --- | --- | --- | --- | --- | --- |
| one trial | 0.2 M; 0.47 M for the dearest expected | 7.8 M | **0.70 M** | min(7.8 M, 0.70 M) + 0.64 M = **1.34 M** | 0.70 M + 1.28 M = 1.98 M |
| the canary (9 trials) | 1.6 M | 70 M | **2.40 M** | min(9 × 1.34 M, 2.40 M + 3 × 0.64 M) = **4.32 M** | 2.40 M + 3 × 1.28 M = 6.24 M |
| the canary, at `52465362` | 1.6 M | none | none | none: 51 M, or 276 M with children, was arithmetic | |
| time | 5–15 min | 330 s a turn, 120 s a child | 480 s a trial, 1800 s the canary | 480 s and 1800 s, + 2 s | the same |

How the numbers are made:

- **0.70 M per trial** is 1.5 × the dearest expected trial: 6 calls × 60 k × 1.3 = 468 k, × 1.5 = 702 k.
- **2.40 M for the canary** is 1.5 × 1.6 M. `--token-budget 800000` is the per-arm stop checked between trials (1.5 × 0.54 M);
  it starts no further trial and is not a ceiling.
- **Two lanes at most**: the turn and one child. The caps allow one child, and the supervisor stops a gateway on which a third
  session has an active run.
- **One polling interval** is 4 s from the last reading under the limit to the kill: 2 s between readings, 1 s to read, 1 s for
  the aborts. At 5 s a call that is one call finishing and one in flight per lane: 2 × 2 × 160 k = 0.64 M.
- **A gateway that stops answering** is killed after 10 s without a complete reading, 12 s in all: three calls finishing and one
  in flight per lane, 2 × 4 × 160 k = 1.28 M.
- **160 k a call**: 60 k at the start, growing by one full-size tool result a call (64,000 characters, about 16 k tokens), is
  156 k when the trial reaches 0.70 M. A call that was in flight when its gateway was killed is counted here in full.
- **Product caps alone**: 330 s at 5 s is 66 calls, 60 k each and growing 1 k, 6.1 M; a child's 120 s is 24 calls, 1.7 M.

| the number | enforced by | tested by |
| --- | --- | --- |
| 0.70 M a trial | the supervisor: every reading, on its own connection; then `sessions.abort`, then SIGKILL of the unit | a fake gateway process that loops and ignores every abort and delete; two looping children; a real systemd unit. Each is dead within its limit plus its own rate × one interval, and the trial's cleanup still ran |
| 2.40 M for the canary | the supervisor: the sum over the arms, every reading; every gateway is stopped | two gateways, one looping under its own limit |
| 0.15 M outside a trial | the supervisor: what a gateway spends when no trial of its arm is running | a child the harness's cleanup cannot see, which starts spending after a clean trial |
| two active runs | the supervisor: `hasActiveRun` in the listing | six children at once, stopped before any has finished a call |
| 10 s without a reading | the supervisor's own clock, which no gateway can hold up | a gateway that keeps the socket open and answers nothing. One that stalls for 1 s is left alone |
| 480 s a trial, 1800 s the canary | the same clock | a turn that spends nothing and never ends; a run with no trial at all |
| the durable exec | any stop, and the end of every trial: each transient unit naming the gateway or its directory, and each process started with its state directory, until two looks find none | a real systemd unit with a real durable unit, a stray unit and a bound scope: all ended. The same test shows that stopping the gateway's unit alone leaves the durable exec running. Another gateway's durable exec is untouched |
| the runner dying, or Ctrl-C | the supervisor stops every gateway | a dropped runner connection |
| the supervisor dying or hanging | the runner stops every gateway: at once, or after 15 s of silence | SIGKILL, and SIGSTOP |
| both dying | the timer, 60 s past the canary's clock, stops every gateway and what it owns | both killed; the timer alone stops the unit and its durable exec |

**Measured** at these limits on a real user unit (ronan, fakes, no model): a loop of two lanes at 60 k and 5 s a call was stopped
at 745,240 metered tokens, 30.1 s in, its unit dead 8 ms after the kill was sent and everything it owned 0.45 s after that. A
gateway that stopped answering was killed 10.03 s after its last reading, plus 1.0 s of aborts it never answered.

**What the enforced numbers rest on, and don't cover:**

- **5 s a call and 160 k a call are assumptions.** If every call in the interval carried the most context the product allows
  before it compacts (75 % of a 500,000-token window, 375 k), one trial is 0.70 M + 2 × 4 × 375 k = **3.7 M** and the canary
  2.40 M + 3 × 3.0 M = **11.4 M**, gateways not answering included. That is the most two lanes can spend at 5 s a call.
- **The meter is the product's** (`sessions.usage.timeseries`), read again and again from a process the product doesn't run. It
  is current to the last finished call. A call in flight, a compaction, and a title call (the first 1,000 characters) are not in
  it; the interval allowance and the clocks are what bound them. A session the list hides (a cron run) is in the 30 s-old total
  the supervisor also reads; the caps switch automatic cron runs off.
- **A turn can start many swarm groups in one response.** The caps are per group, and the group's name is the turn's own choice.
  The supervisor stops that at the next reading, with at most the first call of each in flight.
- **It is not a sandbox.** A turn runs shell commands as the seat's user. One that set out to stop the supervisor, its timer and
  the runner, all three, could; the prompts ask for nothing of the kind, and losing either process stops every gateway.

### Product caps

The same on every arm, written by `overlay`, read back before and after every trial. All in configuration paths that the
product reads from `agents.defaults`, `tools` or `cron`, with the lines that enforce them in
[`README.md`](README.md#spend-caps), at both SHAs.

| cap | value | product default | what it bounds |
| --- | --- | --- | --- |
| `continuation.maxChainLength` | 1 | 10 | the chain |
| `continuation.costCapTokens` | 1 | 500,000 | **every follow-up**: the election is answered `scheduled` and recorded, and at the turn's end the chain is over its cap, so no wake and no delegate runs |
| `continuation.maxDelegatesPerTurn` | 1 | 5 | delegate fan-out |
| `subagents.maxChildrenPerAgent`, `maxConcurrent`, `maxSpawnDepth` | 1, 1, 1 | 5, 8, 5 | directly spawned children: one, with none of its own |
| `subagents.runTimeoutSeconds` | 120 | none | a child's run (a turn may ask for longer; the supervisor's clock doesn't) |
| `tools.swarm.maxConcurrent`, `maxChildrenPerGroup`, `maxTotalPerGroup` | 1, 1, 1 | 32, 50, 200 | collectors, which the child cap does not count. The packet at `52465362` missed these |
| `agents.defaults.timeoutSeconds` | 330 | 48 h | a turn. The harness stops it at 300 s, and reads it |
| `agents.defaults.maxConcurrent` | 2 | 8 or more | runs in the main lane |
| `cron.enabled` | `false` | `true` | automations a turn created: recorded, never fired |

`request_compaction` needs no cap: the product refuses it on a session's first turn, and below 70 % of the context after that.

**They don't touch what is scored.** Run through the product's own code at both SHAs: its config schema accepts them; under them
`continue_work` and `continue_delegate` still answer `scheduled`; and all 49 tools the product builds have the same names,
descriptions and parameters with and without them. A second `continue_delegate` in one turn is refused, after the first election.

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
8. `caps verified: 3` and `continuation wakes: 0` in every arm.
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
| `report.md` | Surface (rules 3–6 and 8), unscored, largest trial, the comparisons' names and notes, Supervision (rule 9) |
| `private/supervisor-events.jsonl` | every begin, end and stop, with its time and tokens |
| `results/<job>/configs.csv` | `OPENCLAW_EVAL_MODEL` and the arm, as EvalBench recorded them |
| `results/<job>/evals.csv`, `scores.csv` | each election, against `continuation_election`'s row for it |
| `private/trials-{A,B,C}.jsonl` (🌻 only) | the whole record: tool calls, reply, surface, runtime, cleanup, seconds |
| `$REC/receipts-{A,B,C}/identity.json`, `config-shape.json` | runtime SHA, unit, port; model and no channel, as `setup` derived them (preflight's output has them after the overlay) |

```bash
for a in A B C; do jq -c '{arm, promptId, status, elected, tools: [.elections[]?.tool], served: .servedModels, source: .servedModelSource,
  runtime, surface: .surface.verdict, calls: .modelCalls, metered, seconds, cleanup: .cleanup.ok}' $OUT/private/trials-$a.jsonl; done
```

Two things only this can show: whether an election the harness recorded is one a person reading the transcript agrees with,
and the real calls per trial, tokens per call and seconds per call. The last three replace the assumptions in the estimate
**before** anyone asks for the 270-trial fire.

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
