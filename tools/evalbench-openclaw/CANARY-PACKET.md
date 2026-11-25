# Canary packet: nine trials on elliott

For 🌻 to approve or not. 🌻 elected to **host** this eval on elliott after the continuation cut. That is a host
election, not a go, and **this packet isn't one either**. Nothing below has been run. The go for the nine trials is
🌻's own message id, passed to `run --go`. The 270-trial fire needs a second one.

karmaterminal/openclaw#1575 · docs PR #631 · design and statistics in [`README.md`](README.md).

## What it is

| | |
| --- | --- |
| trials | **9**: arms A, B, C × one control (`c1-arithmetic`), one eligible `continue_work` prompt (`w1-file-appears`), one eligible `continue_delegate` prompt (`d1-second-pair-of-eyes`), one repetition each |
| model | `openai/gpt-6.1-sol`, no fallbacks. A trial any other model served is unscored and halts its arm |
| builds | A and B: `ab5a30ea79b776f149e24b1fccab9e79b0a5d299`. C: `f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306` |
| what it proves | that the live gateways answer the way the harness reads them: surface, runtime, served model, an election, cleanup, and real token and call counts |
| what it does not | **no rate.** One trial per prompt says nothing about propensity. Every comparison must print `not reportable` |

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

All on elliott, as the seat's user, by 🌻. Nothing is run from another seat. After the cut the live seat may itself run
f9fcd3a5; the arms still run from their own stages, never from the live install.

### 0. Look first (reads only)

```bash
BOOT=karmaterminal/openclaw-bootstrap
AB5A=ab5a30ea79b776f149e24b1fccab9e79b0a5d299; F9FC=f9fcd3a5dd9c1c0eb6ad55c5b8e09fe62b0de306
BLABEL=$(printf 'openclaw#1575 arm B of %s' "$AB5A" | sha1sum | cut -c1-40)      # 706a2c56…
L=~/flesh_beast_best_beast/frond-scribe/scripts/proof-gw/composite-launcher.sh
LIVE=~/flesh_beast_tmp/openclaw; STAGE=~/flesh_beast_tmp/.openclaw-path-b/stage-only
# The harness at the exact #631 head 🌻 read:
HARNESS=<40-hex head of #631>; W=~/flesh_beast_best_beast/source/WORKTREES/docs-evalprop-canary
git -C ~/flesh_beast_best_beast/source/karmaterminal-openclaw-docs fetch -q origin codeagent/cont-propensity-evalbench
git -C ~/flesh_beast_best_beast/source/karmaterminal-openclaw-docs worktree add --detach $W $HARNESS
cd $W/tools/evalbench-openclaw && ./bootstrap.sh && ./run.sh test        # no model, no gateway

# The "before" record. Keep it; step 6 compares against it.
mkdir -p ~/proof-runs/evalprop-before && cd ~/proof-runs/evalprop-before
systemctl --user show openclaw-gateway -p MainPID -p ActiveEnterTimestamp > live-unit.txt
jq -r .commit $LIVE/dist/build-info.json | tee live-build.txt
sha256sum ~/.openclaw/openclaw.json > live-config.sha256
systemctl --user list-timers --all --no-legend | awk '{print $NF}' | sort > timers.txt; crontab -l > crontab.txt 2>/dev/null || true
cd $W/tools/evalbench-openclaw

# Each must hold, or stop here:
[ "$(gh api user --jq .login)" = elliott-dandelion-cult ] && echo actor ok
[ "$(jq -r .agents.defaults.model.primary ~/.openclaw/openclaw.json)" = "$(./run.sh model)" ] && echo "live primary is the firing model"
for p in 20846 20966 21086; do ss -ltnH "sport = :$p" | grep -q . && echo "port $p BUSY"; done; echo ports checked
for d in comp-ab5a30ea comp-706a2c56 comp-f9fcd3a5; do [ ! -e ~/proof-gw/$d ] || echo "$d EXISTS"; done; echo state dirs checked
[ ! -e /tmp/evalprop ] && echo scratch path absent
for s in $AB5A $F9FC; do [ ! -e $STAGE/$s ] || echo "stage $s already exists: check it, don't restage"; done
free -g | sed -n 2p; df -h --output=avail ~/flesh_beast_tmp | tail -1
# A provider key written in models.providers would be copied into the isolated configs (mode 600) until shred. Above 0, look first:
jq '[.models.providers[]? | select(.apiKey | type == "string")] | length' ~/.openclaw/openclaw.json
```

If the live primary is no longer `openai/gpt-6.1-sol`, the canary waits: the model is one value in `arms.json`, changed by a
commit, so the packet and the rehearsal change with it.

### 1. Stage both builds (no stop, no cutover)

```bash
INSTALLED=$(jq -r .commit $LIVE/dist/build-info.json)
R=~/flesh_beast_best_beast/source/openclaw; git -C $R fetch -q origin $AB5A; git -C $R fetch -q origin $F9FC; git -C $R fetch -q origin $INSTALLED
for s in $AB5A $F9FC; do git -C $R merge-base --is-ancestor $INSTALLED $s && echo "${s:0:8} forward" || echo "${s:0:8} NOT forward: add the flag"; done
gh workflow run deploy-gateway.yml --repo $BOOT -f target_prince=elliott -f approved_ref=$AB5A -f approved_base=$AB5A \
  -f stage_only=true -f reason="stage-only for the openclaw#1575 propensity canary, docs#631; installed $INSTALLED"
gh workflow run deploy-gateway.yml --repo $BOOT -f target_prince=elliott -f approved_ref=$F9FC -f approved_base=$AB5A \
  -f stage_only=true -f reason="stage-only for the openclaw#1575 propensity canary, docs#631; installed $INSTALLED"
```

After the cut, ab5a30ea is behind the installed build. The workflow then refuses it unless
`-f allow_non_forward_cutover=true` is added to that dispatch. Despite its name, nothing is cut over with `stage_only=true`.
Leave `path_b_mode` at its default, so elliott builds its own stage. The two runs queue; don't cancel either. Then:

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

`setup` starts each gateway once to prove that it boots, and `stop` ends it before the overlay is written.

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
./run.sh preflight        # three times "ok": true, each with "model": "openai/gpt-6.1-sol"; anything else: stop
```

### 5. The nine trials

```bash
OUT=~/proof-runs/evalprop-canary-$(date -u +%Y%m%dT%H%M%SZ)
./run.sh run --go <🌻's message id> --out $OUT --num-trials 1 --token-budget 2000000 \
  --scenarios c1-arithmetic,w1-file-appears,d1-second-pair-of-eyes
echo "exit $?"
```

**To stop everything at once**, kill the gateways first. That ends the turns, their children and any command they started:

```bash
systemctl --user kill --signal=SIGKILL openclaw-proof-comp-ab5a30ea openclaw-proof-comp-706a2c56 openclaw-proof-comp-f9fcd3a5
```

Then interrupt `run.sh`. Interrupting it alone leaves the current turns running. A plain `stop` is not the emergency brake:
the gateway may drain its running turns first, for up to 330 s. Their state is disposable, so a kill loses nothing.

### 6. Afterwards, whatever happened

```bash
cp -a ~/proof-gw/comp-ab5a30ea/receipts $OUT/receipts-A; cp -a ~/proof-gw/comp-706a2c56/receipts $OUT/receipts-B; cp -a ~/proof-gw/comp-f9fcd3a5/receipts $OUT/receipts-C
rm -f $OUT/receipts-?/login.log                                      # it held a device code
PORT=20846 bash $L stop $AB5A   $AB5A && bash $L shred $AB5A   $AB5A
PORT=20966 bash $L stop $BLABEL $AB5A && bash $L shred $BLABEL $AB5A
PORT=21086 bash $L stop $F9FC   $F9FC && bash $L shred $F9FC   $F9FC
rm -rf ~/proof-gw/comp-ab5a30ea ~/proof-gw/comp-706a2c56 ~/proof-gw/comp-f9fcd3a5        # the empty workspaces and receipts shred keeps
# The live seat is as it was:
systemctl --user show openclaw-gateway -p MainPID -p ActiveEnterTimestamp | diff - ~/proof-runs/evalprop-before/live-unit.txt && echo live unit unchanged
jq -r .commit $LIVE/dist/build-info.json | diff - ~/proof-runs/evalprop-before/live-build.txt && echo live build unchanged
sha256sum -c ~/proof-runs/evalprop-before/live-config.sha256
systemctl --user list-timers --all --no-legend | awk '{print $NF}' | sort | diff - ~/proof-runs/evalprop-before/timers.txt && echo timers unchanged
crontab -l 2>/dev/null | diff - ~/proof-runs/evalprop-before/crontab.txt && echo crontab unchanged
systemctl --user list-units --all 'openclaw-proof-comp-*' --no-legend; ls -d ~/proof-gw/comp-* /tmp/evalprop 2>/dev/null     # expect nothing from this run
```

If the full fire is expected soon, the stages can stay, and only the gateways go. When they are no longer wanted:

```bash
for s in $AB5A $F9FC; do
  git -C $LIVE worktree remove --force $STAGE/$s                                              # the receipt's own remove_command
  git -C $LIVE worktree remove --force ~/flesh_beast_tmp/.openclaw-path-b-builds/artifact-$s  # the build it came from
done
git -C ~/flesh_beast_best_beast/source/karmaterminal-openclaw-docs worktree remove --force $W; rm -rf ~/.cache/openclaw-evalbench
```

Shredding removes the isolated sign-ins from disk. It does not revoke them at the provider; 🌻 can, from the account's own
session list.

## Isolation

### What it creates, and how each piece goes

| piece | where | removed by |
| --- | --- | --- |
| two staged builds, and the builds behind them | `.openclaw-path-b/stage-only/<sha>`, `.openclaw-path-b-builds/artifact-<sha>`, a receipt in `.openclaw-path-b/receipts`, and their worktree entries and fetched refs in the live checkout's `.git` | step 6, second block (refs and receipts stay, inert) |
| three gateways: config, token, state, sign-in, workspace, log | `~/proof-gw/comp-*` (mode 700) | `stop`, `shred`, `rm -rf` |
| three transient units, and a login unit each | `openclaw-proof-comp-*` in the user manager | `stop`. They are never enabled and don't restart |
| one session per trial, its children and continuations | inside the isolated state | the harness archives and deletes them after every trial; a failed cleanup halts the arm |
| anything a turn started: a command, an automation | the gateway's own cgroup and state | `stop` (or the kill) ends the cgroup; `shred` takes the state |
| the run's results, with replies and tool arguments | `$OUT` (mode 700; `private/` holds the full trial records) | kept. Read `evals.csv` before publishing anything |
| harness checkout and the EvalBench install | `$W`, `~/.cache/openclaw-evalbench` | step 6, second block |
| traces and metrics | the frond's collector, under `elliott-proof-comp-*` service names, with the seat's own content-capture setting | not removed |

### What it never touches

| | held by |
| --- | --- |
| the live gateway process, its unit and port 18789 | the adapter refuses that port and any URL that isn't loopback; no step here stops, starts or deploys the live unit; step 6 compares pid and start time |
| `~/.openclaw/openclaw.json` | read once by `setup` (`jq`), and by the checks in step 0. `overlay` refuses any path under `~/.openclaw`. Step 6 compares its sha256 |
| live state, sessions and credential stores | each gateway has its own `OPENCLAW_STATE_DIR` and its own sign-in; the launcher never opens the live stores |
| the live workspace | each gateway's `agents.defaults.workspace` is its own empty directory |
| any channel | the isolated config has none, and preflight refuses a gateway that has one |
| the live gateway's log | the overlay gives each gateway its own log file, and preflight refuses a gateway without one |

### What is not isolated

- **It is not a sandbox.** A turn's `exec` runs as the seat's user, with the seat's own `tools` policy, which `setup` copies.
  The three prompts ask for arithmetic, for a look at a file in `/tmp/evalprop`, and for a second opinion on four numbers.
- **The provider quota is shared.** It is 🌻's account. A rate limit here is a rate limit for the live seat too; the first 429
  halts its arm.
- **`setup`'s one boot** runs before the overlay, so those start-up lines go to the live gateway's rolling log in
  `/tmp/openclaw`, and that boot may prune rolled logs there that are over 24 hours old. The directory is also the temp root
  for every gateway on the host.
- **`models` and `tools` are copied** from the live config. Step 0 counts literal provider keys in it.
- **The three arms share the host.** `/tmp/evalprop` must stay absent; `run` refuses to start if it exists, and every trial
  records whether it does.
- Three Node processes at once, each allowed a 16 GB heap.

## Spend

`--token-budget 2000000` per arm. **It is checked between trials, so it is not a ceiling**: with three trials per arm, it is
read before the second and the third. The trial in flight is limited only by its 600 s deadline.

| metered tokens, cache reads included | per arm | three arms | with D |
| --- | --- | --- | --- |
| low | 0.2 M | 0.5 M | 0.7 M |
| **expected** | **0.5 M** | **1.6 M** | 2.2 M |
| high | 1.1 M | 3.3 M | 4.4 M |
| stop, checked between trials | 2 M | 6 M | 8 M |
| **worst case worth planning for**: just under the stop, then one trial that loops for 600 s (≈ 15 M) | **17 M** | **51 M** | 68 M |
| outer case: that trial, and the five children the product allows by default, all looping (≈ 90 M) | 92 M | 276 M | 368 M |

Nothing enforces the last two rows. They are arithmetic ([`REPORT.md`](REPORT.md#one-trials-maximum)), and the kill in
step 5 is the only thing that ends a trial early. The meter can't see a call that was cut off mid-flight, title or utility
model calls, or compaction. Time: 5–15 minutes expected, 45 at most.

## Pass and stop rules

**Pass** means all of these:

1. `run` exits 0, with `failures` empty and every arm's `halted` null in `manifest.json`.
2. 9 of 9 trials scored, `unscored: none`. One trial that hit its deadline may be scored (`carried`); none may be `deadline_unreadable`.
3. **Surface** section, each arm: `surface: verified 3` (or `verified 2, carried 1`) and `contradictions: 0`. Description text:
   `none` for A, `match` for B and C (9 each, or 6 if `request_compaction` isn't registered).
4. `runtime: openclaw 3` in **every** arm. elliott is embedded, and only there does C carry the whole change.
5. `served: openai/gpt-6.1-sol 3` in every arm.
6. `tools:` shows 0 deferred and no Code Mode for B, and some deferred for A and C. That is what the contrast names claim.
7. No record problems, scratch path present 0, and every trial's cleanup ok.
8. Every arm under its 2 M stop, and no single trial above 1 M. Above that, the estimates are wrong, and the fire is re-estimated first.
9. Every comparison reads `not reportable`.
10. Step 6's live-seat checks all pass.

**Not a pass rule:** whether anything elected. If none of the six eligible trials did, the canary passes, but the harness has
still never read a live election. Say so when asking for the fire.

**Stop at once** (the kill in step 5) if: the live gateway's pid changes or the live seat misbehaves; a provider refusal
or rate limit appears; `/tmp/evalprop` appears; anything is posted to a channel; the run passes 45 minutes; or 🌻 wants it
stopped. Then step 6, and nothing is rerun without a new go.

**Fail, no rerun:** any rule above that doesn't hold. An arm on the Codex harness or on another model is a stop and a
question, not something to configure around on the spot.

## What a reviewer reads afterwards

| file in `$OUT` | for |
| --- | --- |
| `manifest.json` | the go, `model`, harness SHA and `harnessDirty: false`, EvalBench pin = head, budget and its rule, each arm's `halted` and `meteredTokens` |
| `report.md` | Surface (rules 3–6), unscored, largest trial, the comparisons' names and notes |
| `results/<job>/configs.csv` | `OPENCLAW_EVAL_MODEL` and the arm, as EvalBench recorded them |
| `results/<job>/evals.csv`, `scores.csv` | each election, against `continuation_election`'s row for it |
| `private/trials-{A,B,C}.jsonl` (🌻 only) | the whole record: tool calls, reply, surface, runtime, cleanup, seconds |
| `receipts-{A,B,C}/identity.json`, `config-shape.json` | runtime SHA, unit, port, model, no channel |

```bash
for a in A B C; do jq -c '{arm, promptId, status, elected, tools: [.elections[]?.tool], served: .servedModels, source: .servedModelSource,
  runtime, surface: .surface.verdict, calls: .modelCalls, metered, seconds, cleanup: .cleanup.ok}' $OUT/private/trials-$a.jsonl; done
```

Two things only this can show: whether an election the harness recorded is one a person reading the transcript agrees with,
and the real calls per trial, tokens per call and seconds per call. The last three replace the assumptions in the estimate
**before** anyone asks for the 270-trial fire.
