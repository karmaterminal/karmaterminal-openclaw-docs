# R-CD-2 — undertow-seat, CANDIDATE_SHA `4896c3129b8ec181c107b7dd64ec87a4e46b0943`

Captured 2026-06-02T16:00:30Z → 16:00:34Z UTC (09:00 PDT). Binary: `OpenClaw 2026.6.2 (4896c31)`.

## Proof-scope

`continue_delegate(mode="silent-wake")` schedule → spawn → silent-return + wake path at byte. Tested:
- silent-wake delegate-dispatch fires with `delegate.mode=silent-wake` attr
- subagent spawns + completes with literal-string output
- return delivered as `enrichment-return` to parent channel (not as visible reply)
- the silent-wake mode is the cohort-canonical shape for ambient enrichment that also wakes the parent

## Byte-evidence

### Fire-side dispatch-response (`fire_response.json`)
```
{"status":"scheduled","mode":"silent-wake","delaySeconds":0,"delegateIndex":2,"delegatesThisTurn":2,
 "traceparent":"00-a9ee3e3adbbd6a37996e2b8d07f320fa-29409e3be7b9464c-01"}
```

### Spawn evidence (`journal_continuation.log`)
- `09:00:30.294 [continuation:delegate-spawned] hop=19/200 mode=silent-wake session=agent:main:discord:channel:1466192485440164011 task=[PROOF R-CD-2 / 4896c3129b] You are a silent-wake delegate dispatched by Ronan (…`

Subagent runId: `6fedc026-b5b2-4d48-9b45-4c1ee7cdde41` (sessionKey `agent:main:subagent:46d7db3b-bb57-4a28-9f1d-cd0332f7ea71`), runtime 2503ms.

### Subagent return (`delegate_return_payload.txt`)
```
R-CD-2 PROOF: continue_delegate silent-wake mode verified at CANDIDATE_SHA 4896c3129b8ec181c107b7dd64ec87a4e46b0943 from undertow-seat 2026-06-02
```

### Journal return + enrichment-return evidence
- `09:00:34.043 R-CD-2 PROOF: continue_delegate silent-wake mode verified at CANDIDATE_SHA 4896c3129b8ec181c107b7dd64ec87a4e46b0943 from undertow-seat 2026-06-02`
- `09:00:34.149 [subagent-chain-hop] Accumulated 92 tokens from agent:main:subagent:46d7db3b-bb57-4a28-9f1d-cd0332f7ea71 to parent chain cost`
- `09:00:34.154 [continuation/announce] [continuation:enrichment-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:46d7db3b-bb57-4a28-9f1d-cd0332f7ea71`

The `enrichment-return` line is the load-bearing byte for silent-wake mode — distinguishes it from normal-mode (which delivers as visible reply) and from silent-mode (which delivers context but does not wake). The same target session-key (channel) is the wake recipient.

## Tempo HONEST-LIMIT

Same as R-CD-1: parent trace `a9ee3e3adbbd...` 404 at fetch time, awaiting flush/index. HONEST-LIMIT precedent per cael `018e39ce45.../R-CW-1/`.

## Scope-bound at byte

Proves `continue_delegate(mode="silent-wake")` lane: dispatch fired with correct mode attr, subagent spawned + completed in 2503ms, silent enrichment-return delivered to parent channel (waking it). Does NOT exercise: parent-side wake-handler synthesis behavior (that's a parent-policy concern, not a delegate-fire concern).
