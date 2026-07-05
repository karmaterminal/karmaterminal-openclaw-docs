# R-CD-COLLECTION-ON-COLLAPSE — A→B→delayed-C collection after B finalizes (cael-dgx)

Issue: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/217  
Method lock: https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/217#issuecomment-4883680115  
Candidate SHA: `bca2b0b89ab886bf23a10e4983926f6b374b3188`  
Build: `OpenClaw 2026.6.11 (bca2b0b)`  
Seat: Cael / `cael-dgx`  
Verdict: ✅ PASS

## Scope

The method lock requires a fresh live A→B→delayed-C collection-on-collapse shape:

1. root/main A spawns detached intermediate B;
2. B schedules C with typed `continue_delegate(mode=normal, delaySeconds≈5-10, fanoutMode=tree)`;
3. B finalizes before C is due;
4. C returns a unique sentinel after B has finalized;
5. root/main receives or can observe the C sentinel with requester/session-chain bytes proving B → continuation leaf, not only an in-B delivery.

No config mutation and no DB seeding were used.

## Sentinels / sessions

- Sentinel prefix: `RCD_COLLECTION_BCA2B0B_CAEL_20260704_1316`
- B sentinel: `RCD_COLLECTION_BCA2B0B_CAEL_20260704_1316_B_FINALIZED`
- C sentinel: `RCD_COLLECTION_BCA2B0B_CAEL_20260704_1316_C_REACHED_AFTER_B_FINAL`
- Root/main requester: `agent:main:discord:channel:1466192485440164011`
- B run id: `67acd221-b7e0-4f3b-b9a1-c42580aebf02`
- B session: `agent:main:subagent:a10dc300-825c-44d5-8edf-94e19d3c29f9`
- C run id: `ea37bf7c-288d-49ce-8f41-e347b86c554d`
- C session: `agent:main:subagent:continuation-36a7f4834cf27002824bb6b0329ece4b`

## Root A spawned detached B

Root used `sessions_spawn` run-mode to create detached/intermediate B. The task row in `db/task-rows-concise.json` records:

- source/run id: `67acd221-b7e0-4f3b-b9a1-c42580aebf02`
- requester: `agent:main:discord:channel:1466192485440164011`
- child session: `agent:main:subagent:a10dc300-825c-44d5-8edf-94e19d3c29f9`
- parent flow: `d51b62a0-70de-4917-b226-619d233faeb8`
- status: `succeeded`
- delivery status: `delivered`

The corresponding flow row succeeded:

- flow id: `d51b62a0-70de-4917-b226-619d233faeb8`
- owner: `agent:main:discord:channel:1466192485440164011`
- status: `succeeded`
- created: `1783196149595`
- ended: `1783196155408`

## B scheduled delayed C with typed continue_delegate, then finalized

B's session transcript (`sessions/e4a1f112-d9ed-4061-9081-59092fd35c0e.jsonl` and trajectory) records one typed `continue_delegate` tool call. The tool arguments were:

```json
{
  "delaySeconds": 7,
  "mode": "normal",
  "fanoutMode": "tree"
}
```

B did not use bracket tokens, did not call `continue_work`, did not use `sessions_spawn`, and did not set an explicit root target. The continuation tool receipt in the B trajectory records:

```json
{
  "status": "scheduled",
  "mode": "normal",
  "delaySeconds": 7,
  "delegateIndex": 1,
  "delegatesThisTurn": 1,
  "fanoutMode": "tree"
}
```

B then finalized with:

```text
B_SENTINEL=RCD_COLLECTION_BCA2B0B_CAEL_20260704_1316_B_FINALIZED
SCHEDULE_STATUS=scheduled
SCHEDULE_MODE=normal
SCHEDULE_DELAY_SECONDS=7
SCHEDULE_FANOUT_MODE=tree
SCHEDULE_DELEGATE_INDEX=1
C_SENTINEL_SCHEDULED=RCD_COLLECTION_BCA2B0B_CAEL_20260704_1316_C_REACHED_AFTER_B_FINAL
```

Timestamp ordering from task/flow rows:

- B task ended: `1783196155408`
- B→C delegate flow released at: `1783196159763`
- C task created: `1783196159896`
- C task started: `1783196160129`
- C task ended: `1783196163634`

So B finalized before C was created, started, or returned.

## B→C durable flow/task rows

`db/flow-rows-concise.json` records the B→C continuation delegate row:

- flow id: `042699b1-5138-486c-a41c-7be8fa59f99f`
- owner: `agent:main:subagent:a10dc300-825c-44d5-8edf-94e19d3c29f9`
- controller: `core/continuation-delegate`
- status: `succeeded`
- current step: `Accepted by continuation subagent`
- `delayMs: 7000`
- `fanoutMode: "tree"`
- `traceparent: "00-ecda443e0038fb9a38fc33a8b98d7d02-a003e1637047d678-01"`
- child session: `agent:main:subagent:continuation-36a7f4834cf27002824bb6b0329ece4b`
- released at: `1783196159763`

`db/task-rows-concise.json` records the C leaf task:

- task id: `1d1856e7-d056-4783-a37b-827a119d437f`
- source/run id: `continuation-delegate-36a7f4834cf27002824bb6b0329ece4b`
- requester: `agent:main:subagent:a10dc300-825c-44d5-8edf-94e19d3c29f9`
- child session: `agent:main:subagent:continuation-36a7f4834cf27002824bb6b0329ece4b`
- parent flow: `879b7c3c-5211-4187-9639-910088b40938`
- status: `succeeded`
- delivery status: `delivered`
- progress summary includes the C sentinel and C session/run id.

## C returned after B finalized

C's transcript (`sessions/ea37bf7c-288d-49ce-8f41-e347b86c554d.jsonl`) records the leaf response:

```text
RCD_COLLECTION_BCA2B0B_CAEL_20260704_1316_C_REACHED_AFTER_B_FINAL
session: agent:main:subagent:continuation-36a7f4834cf27002824bb6b0329ece4b
sessionId/run id: ea37bf7c-288d-49ce-8f41-e347b86c554d
```

The gateway journal also records the C sentinel at `13:16:03`, after B's `13:15:55` finalization:

```text
RCD_COLLECTION_BCA2B0B_CAEL_20260704_1316_C_REACHED_AFTER_B_FINAL
[agent] run continuation-delegate-36a7f4834cf27002824bb6b0329ece4b ended with stopReason=stop
```

## Root/main collection byte

The load-bearing collection byte is the targeted-return journal line immediately after the C run ended:

```text
[continuation:targeted-return] Delivered to agent:main:subagent:a10dc300-825c-44d5-8edf-94e19d3c29f9,agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-36a7f4834cf27002824bb6b0329ece4b
```

This proves the C leaf return was delivered both to B's session and to the root/main requester session by tree fanout after B had already finalized. `main/root-collection-receipt.md` preserves bounded root/main requester-session excerpts that show root inspecting the completed B and C histories after C returned. The durable task row also records C `delivery_status=delivered`.

## Tempo trace

Machine-readable Tempo JSON is saved at:

```text
tempo/trace-ecda443e0038fb9a38fc33a8b98d7d02.json
```

`tempo/trace-summary.json` records the expected B→C delegate/collection path spans:

- `continuation.delegate.dispatch`: 1
- `continuation.queue.fanout`: 1
- `continuation.queue.drain`: 2
- `openclaw.harness.run`: 3
- `openclaw.run`: 3
- `openclaw.tool.execution`: 5
- `openclaw.message.delivery`: 1

The trace id comes directly from the B→C flow row traceparent: `00-ecda443e0038fb9a38fc33a8b98d7d02-a003e1637047d678-01`.

## Negative guard

The optional negative guard for mixed `targetSessionKey` + `fanoutMode=tree` was omitted. The method lock explicitly called it nice-to-have only, and I left it out to avoid perturbing the final live proof.

## Supporting receipts

- `comment-4883680115.json` — method lock from docs#217.
- `runtime-version.txt` and `source/source-sha-status.txt` — deployed build / source receipts.
- `db/flow-rows.json`, `db/flow-rows.pretty.json`, `db/flow-rows-concise.json` — durable flow rows.
- `db/task-rows.json`, `db/task-rows-concise.json` — durable task rows.
- `sessions/e4a1f112-d9ed-4061-9081-59092fd35c0e*` — B transcript / trajectory.
- `sessions/ea37bf7c-288d-49ce-8f41-e347b86c554d*` — C transcript / trajectory.
- `main/root-collection-receipt.md` — bounded root/main requester-session collection excerpts.
- `journal/window.log`, `journal/filtered.log`, `journal/load-bearing-lines.log` — B final, delayed C dispatch, C sentinel, and targeted return.
- `main/root-collection-receipt.md` — root-session collection receipts.
- `tempo/trace-ecda443e0038fb9a38fc33a8b98d7d02.json` and `tempo/trace-summary.json` — machine-readable Tempo receipt.
- `evaluation.json` — machine-readable verdict flags.

## Honest scope

✅ Proves root A spawned detached/intermediate B.

✅ Proves B used typed `continue_delegate` exactly once to schedule delayed C with `mode=normal`, `delaySeconds=7`, and `fanoutMode=tree`.

✅ Proves B finalized before C was due/created/started/returned.

✅ Proves C ran in a continuation leaf, returned the unique C sentinel, and did not need any tools.

✅ Proves root/main collection occurred after B finalization via targeted return to both B and `agent:main:discord:channel:1466192485440164011`.

✅ Proves the durable flow/task rows and Tempo trace agree with the B→C delegate/collection path.

❌ Does not prove the optional negative guard for mixed explicit target + tree fanout; it was omitted by design.

## Verdict

✅ PASS — the live A→B→delayed-C collection-on-collapse shape succeeded on deployed `OpenClaw 2026.6.11 (bca2b0b)`: B finalized before C, C returned the sentinel, and tree fanout delivered the C result back to both B and root/main with durable flow/task rows, session transcripts, journal receipts, and Tempo JSON preserved.
