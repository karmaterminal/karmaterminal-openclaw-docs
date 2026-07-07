# R-CD-3 addendum — natural post-compaction seam-fired returns (2026-07-07, cael-dgx)

Candidate SHA: `1cc8f4e3d617ef6f173283ef83d7b739a4995734`
Seat: Cael / `cael-dgx`
Runtime: `OpenClaw 2026.6.11 (1cc8f4e)`
Verdict: ✅ PASS-addendum / lifecycle evidence

## Scope

The canonical `R-CD-3` row already proves typed `continue_delegate(mode="post-compaction")` staging: the tool returns `queued-for-compaction`, and durable state records `postCompaction: true` with controller `core/continuation-post-compaction`.

This addendum captures stronger natural lifecycle evidence observed later on the same seat: already-staged post-compaction delegates fired after an automatic compaction seam and returned to the post-compaction parent session.

It does **not** replace the canonical locked byte. It adds seam-order evidence for the stricter behavior:

```text
staged before compaction → automatic compaction succeeds → post-compaction guard arms → delegates dispatch → targeted returns land in the post-compaction session
```

## Observed timeline

All timestamps are from `journalctl --user -u openclaw-gateway` on `cael-dgx`.

1. Context pressure and overflow triggered an automatic compaction attempt:

```text
08:14:19 [continuation/context-pressure] band=40 ratio=52% ... session=agent:main:discord:channel:1466192485440164011
08:15:35 [context-overflow-diag] ... Context overflow: prompt too large for the model (precheck)
08:15:35 context overflow detected ... attempting auto-compaction
08:15:35 [context-pressure:fire] mid-turn trigger=overflow attempt=1/3 ...
```

2. The compaction seam completed and the post-compaction guard armed:

```text
08:17:45 [compaction] rotated active transcript after compaction (sessionKey=agent:main:discord:channel:1466192485440164011)
08:17:45 auto-compaction succeeded ... retrying prompt
08:17:45 [agents/post-compaction-guard] post-compaction guard armed for 3 attempts
```

3. Four staged post-compaction delegates dispatched immediately after the seam:

```text
08:17:48 Post-compaction delegate dispatch for session agent:main:discord:channel:1466192485440164011: Post-compaction Project 81 lifeline ...
08:17:49 Post-compaction delegate dispatch for session agent:main:discord:channel:1466192485440164011: Post-compaction P81 state ...
08:17:50 Post-compaction delegate dispatch for session agent:main:discord:channel:1466192485440164011: Post-compaction proof lifeline ... nonce POST-COMPACT-ROOM-1523847893524545661 ...
08:17:52 Post-compaction delegate dispatch for session agent:main:discord:channel:1466192485440164011: Post-compaction Project 81 lifeline update ...
```

4. The delegate returns reached the post-compaction Discord session:

```text
08:18:14 [continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-5ada68838fa3a09db8d835b14bb8d992
08:18:26 [continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-79c198fcece618142c749a6b47db65ca
08:18:36 [continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-276362ef912dd7568d84c156d274ac12
08:19:13 [continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:continuation-bb22c1b2fc648cf49a6bf04d522278a0
```

5. Returned delegate prose confirms post-compaction execution and fresh state checking:

```text
08:18:13 Post-compaction lifeline fired and I rebuilt state from `/tmp/oc-p81-preflight` files, not confidence.
08:18:26 Post-compaction lifeline fired successfully. This confirms post-compaction lifecycle delivery worked for the room-event 2026-07-06 17:27 PDT request.
08:18:35 Post-compaction state carried and fresh-checked in `/tmp/oc-p81-preflight`.
08:19:12 Key finding: the post-compaction lifeline instruction was stale on this point. Current files already contain a later correction: R-CD-MODEL-TOOL is **PASS-candidate**, not HONEST-LIMIT.
```

The stale-task correction is load-bearing: it shows the post-compaction return was treated as context, not evidence, and the child fresh-checked current files before reporting.

## Receipts

- `journal-seam-window.txt` — focused journal window covering pressure, overflow, compaction, dispatch, and returns.
- `journal-post-compaction-lines.txt` — narrowed post-compaction dispatch/return lines.
- `version.txt` — runtime version receipt.

## Verdict

✅ PASS-addendum — Natural lifecycle evidence shows previously staged post-compaction delegates were released only after an automatic compaction seam and their targeted returns landed in the post-compaction parent session.
