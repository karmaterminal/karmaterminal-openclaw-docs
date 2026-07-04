# R-CW-MULTI-COLLAPSE — stale same-session continue_work collapse (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/216

Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`  
Seat: Cael / `cael-dgx`  
Verdict: ✅ PASS, with explicit synthetic-method caveat

## Expected byte lock

This row tests the queue-drain behavior when two same-session continuation-work rows in the same session/chain are already queued/due at restart recovery time:

- the older stale row is folded/superseded, not delivered as an extra wake;
- the newest row grants the same-session continuation wake;
- continuation delay config is restored after the invasive proof;
- no later same-session `continue_work` election supersedes the proof wake before terminalization.

## Method caveat: synthetic DB-seeded rows

This proof used an invasive, figs-authorized DB-seeded method rather than ordinary tool API scheduling. Cael inserted two `flow_runs` rows directly into `~/.openclaw/state/openclaw.sqlite`, then drove gateway restart/recovery through the external `restart-gateway.yml` workflow.

The inserted rows deliberately carried synthetic `hop` metadata:

- old row: `hop: 101`
- newest row: `hop: 102`

These values are **not** realistic chain-depth evidence. They are DB-seeded metadata carried from the synthetic row into the wake banner. The proof claim is limited to the stale-row collapse / newest-row grant / config-restore behavior below.

## Fire

Rerun3 was the clean proof attempt. Rerun2 was invalidated because a later packaging `continue_work` superseded its terminal byte.

Rerun3 identifiers:

```json
{
  "marker": "RCW_MULTI_COLLAPSE_BCA2B0B_CAEL_20260704_0733_RERUN3",
  "session": "agent:main:discord:channel:1466192485440164011",
  "chainId": "29fa6c15-2dc9-409f-bf48-138e73667da5",
  "oldFlow": "rcw-multi-collapse-rerun3-old-1783177467320",
  "newFlow": "rcw-multi-collapse-rerun3-new-1783177467320",
  "now": 1783177467320,
  "oldElected": 1783177422320,
  "newElected": 1783177466320,
  "oldDue": 1783177423320,
  "newDue": 1783177467320
}
```

Temporary continuation delay config was lowered to `1000ms` for `minDelayMs`, `defaultDelayMs`, and `maxDelayMs`, applied by external restart workflow run `28710185731`.

After the proof rows were inserted, external restart workflow run `28710202772` drove recovery/queue-drain. Config was restored by external restart workflow run `28710213668`.

## Observed bytes

### Pre-drain queued rows

`post-insert-sqlite.txt` shows both synthetic rows queued in the same session/chain:

```text
rcw-multi-collapse-rerun3-old-1783177467320|queued|Queued for same-session continuation wake|1783177422320|1783177422320||{"kind":"continuation_work","sessionKey":"agent:main:discord:channel:1466192485440164011","hop":101,"delayMs":1000,"electedAt":1783177422320,"dueAt":1783177423320,"maxChainLength":200,"chainStartedAt":1783177422320,"accumulatedChainTokens":1,"reason":"RCW_MULTI_COLLAPSE_BCA2B0B_CAEL_20260704_0733_RERUN3 OLD_STALE should supersede","chainId":"29fa6c15-2dc9-409f-bf48-138e73667da5"}
rcw-multi-collapse-rerun3-new-1783177467320|queued|Queued for same-session continuation wake|1783177466320|1783177466320||{"kind":"continuation_work","sessionKey":"agent:main:discord:channel:1466192485440164011","hop":102,"delayMs":1000,"electedAt":1783177466320,"dueAt":1783177467320,"maxChainLength":200,"chainStartedAt":1783177422320,"accumulatedChainTokens":1,"reason":"RCW_MULTI_COLLAPSE_BCA2B0B_CAEL_20260704_0733_RERUN3 NEWEST should drive","chainId":"29fa6c15-2dc9-409f-bf48-138e73667da5"}
```

### Drain and wake journal

`journal-continuation-window.txt` shows the old row being superseded, then the newest row producing the wake:

```text
[continuation:work-superseded] flowId=rcw-multi-collapse-rerun3-old-1783177467320 session=agent:main:discord:channel:1466192485440164011 hop=101 overdueMs=56186 — folded into newer election
[continuation:work-wake] hop=102/200 session=agent:main:discord:channel:1466192485440164011 reasonCategory=follow-up-work
```

The continuation wake delivered in-channel as:

```text
Chain: 29fa6c15-2dc9-409f-bf48-138e73667da5 hop 102/200
Flow: rcw-multi-collapse-rerun3-new-1783177467320
Prior reason: "RCW_MULTI_COLLAPSE_BCA2B0B_CAEL_20260704_0733_RERUN3 NEWEST should drive"
```

Again: the `102/200` label is synthetic row metadata, not realistic chain-depth evidence.

### Duplicate wake-line classification

The journal contains **two** `work-wake hop=102/200` lines for the newest row:

- `08:04:39.512` — first wake attempt after the old row was folded.
- `08:05:39.520` — second wake attempt after the restore restart/recovery path re-armed the same row.

Classification: **restore-restart-interrupted first wake, with a single durable terminal grant**.

The restore workflow restarted the gateway at `08:04:57`, after the first wake line but before the newest row had recorded a terminal durable grant. Recovery then replayed the still-not-terminal newest row, re-armed the hedge at the same `fireAt=1783177539504`, and fired it again at `08:05:39`. The final durable row state records only the second fire as the grant:

- `releasedAt: 1783177539510`
- `deliveredAt: 1783177546863`
- `turnGrantedAt: 1783177546863`
- `disposition: granted`

So this evidence is **not** claiming “exactly one wake log line” or “no duplicate wake attempt.” It claims: old stale row collapsed as superseded; newest row eventually granted exactly one durable terminal grant; the duplicate newest wake attempt was caused by the deliberate restore restart occurring between wake emission and durable terminalization. This is a caveat on the invasive proof method, not a second durable grant.

### Terminal durable rows

`final-terminal-sqlite.txt` and `flow-runs-final.json` show the final durable state:

- `rcw-multi-collapse-rerun3-old-1783177467320` → `succeeded`, `current_step = superseded: Superseded by a newer continue_work election after a 56186ms stale backlog.`
- `rcw-multi-collapse-rerun3-new-1783177467320` → `succeeded`, `current_step = Same-session continuation turn granted`, with `disposition: granted`, `succeeded.point: optimal`, `busySkipCount: 0`.

`final-queued-running.txt` is empty, proving no queued/running same-session continuation row remained after the proof wake terminalized.

### Config restore

The active continuation config was restored to the pre-test values:

```json
{
  "enabled": true,
  "maxChainLength": 200,
  "costCapTokens": 500000,
  "contextPressureThreshold": 0.4,
  "maxDelegatesPerTurn": 500,
  "maxDelayMs": 86400000,
  "defaultDelayMs": 15000,
  "minDelayMs": 5000,
  "crossSessionTargeting": "enabled"
}
```

`restore-verified-sha256.txt` shows the restored config byte-identical to the pre-test backup:

```text
98484ce08a10875808f28240bb32d05e6dc67f5722f755082b58c1e5d850f87a  /home/figs/.openclaw/openclaw.json
98484ce08a10875808f28240bb32d05e6dc67f5722f755082b58c1e5d850f87a  /tmp/rcw-multi-collapse-bca2b0b-cael-20260704-0733/openclaw.json.before
```

## Tempo traces

A late bounded Tempo search for the proof window found exact-chain traces for `29fa6c15-2dc9-409f-bf48-138e73667da5`. Machine-readable JSON is saved in this directory:

- `tempo-trace-work-fire-fcfddd0996c2d28125c99e9f7b52ad90.json` — first `continuation.work.fire`, `startTimeUnixNano=1783177479511000000`, `chain.id=29fa6c15-2dc9-409f-bf48-138e73667da5`, `chain.step.remaining=98`, `delay.ms=1000`, `fire.deferred_ms=13191`, `reason.length=72`, `reason.hash=7117359a81fb82ba`.
- `tempo-trace-work-fire-e6f5f835cea3a3568b183f4675d44a60.json` — duplicate/stale `continuation.work.fire`, `startTimeUnixNano=1783177539518000000`, same `chain.id`, `chain.step.remaining=98`, `delay.ms=1000`, `fire.deferred_ms=73197`, same `reason.length=72`, same `reason.hash=7117359a81fb82ba`.
- `tempo-trace-queue-drain-a091817cb7a9e86e723d52ca6b3a575d.json` — `continuation.queue.drain`, `queue.drained_count=1`, `queue.drained_continuation_count=0`, immediately after first work fire.
- `tempo-trace-queue-drain-68d165c2ad88458bebe39c5d5f799032.json` — later `continuation.queue.drain`, `queue.drained_count=0`, `queue.drained_continuation_count=0`.
- `tempo-trace-queue-drain-7d0e3c49b867074fd873023a16224eec.json` — earlier `continuation.queue.drain`, `queue.drained_count=0`, `queue.drained_continuation_count=0`.

The Tempo work-fire traces carry the exact proof chain id and safe reason attributes. They do **not** carry raw flow ids or raw reason text; durable `flow_runs` receipts provide the exact old/new flow ids and reasons. The `chain.step.remaining=98` value derives from the synthetic DB-seeded `hop:102` metadata and is not claimed as realistic chain-depth evidence.

Search receipts are saved under `tempo-search/` and `tempo-search-late/` for audit.

## Supporting receipts

- `insert-vars.json` — exact row ids, session, chain, and due/elected timestamps used for rerun3.
- `post-insert-sqlite.txt` — the two queued DB-seeded rows before restart recovery.
- `final-terminal-sqlite.txt` — final old/new terminal durable rows.
- `flow-runs-final.json` — machine-readable final old/new durable rows.
- `journal-continuation-window.txt` — restart/recovery/wake window with superseded + wake lines.
- `final-queued-running.txt` — empty queued/running continuation rows for the session after terminalization.
- `config-original-before-rerun3.json`, `config-active-lowered-file.json`, `config-restored-active-file.json` — config before/lowered/restored receipts.
- `restore-verified-sha256.txt` — restored config hash equals pre-test backup hash.
- `restart-runs-lower-complete.txt`, `restart-runs-drive-complete.txt`, `restart-runs-restore-complete.txt` — external restart workflow receipts.
- `tempo-attribute-receipt.txt` — extracted exact-chain Tempo attribute receipt.
- `tempo-trace-work-fire-fcfddd0996c2d28125c99e9f7b52ad90.json`, `tempo-trace-work-fire-e6f5f835cea3a3568b183f4675d44a60.json` — exact-chain work-fire Tempo traces.
- `tempo-trace-queue-drain-a091817cb7a9e86e723d52ca6b3a575d.json`, `tempo-trace-queue-drain-68d165c2ad88458bebe39c5d5f799032.json`, `tempo-trace-queue-drain-7d0e3c49b867074fd873023a16224eec.json` — queue-drain Tempo traces from the proof window.
- `tempo-search/`, `tempo-search-late/` — Tempo search receipts.

## Verdict

✅ PASS, scoped to synthetic-method evidence — the stale old same-session continuation row collapsed as superseded, the newest row granted the wake, durable terminal state recorded the grant with no competing same-session continuation left queued/running, and continuation config was restored byte-identically to the pre-test backup.

The synthetic `hop:101/102` values are explicitly **not** claimed as realistic chain-depth evidence.
