## Token accounting evidence — gateway log excerpts

Source: `/tmp/openclaw/openclaw-2026-05-18.log`

### memoryFlush check (2026-05-18T14:24:45.021Z)

```
memoryFlush check:
  sessionKey=agent:main:discord:channel:1466192485440164011
  tokenCount=165728
  contextWindow=1000000
  threshold=976000
  isHeartbeat=false
  isCli=false
  memoryFlushWritable=true
  compactionCount=1
  memoryFlushCompactionCount=1
  persistedPromptTokens=165235
  persistedFresh=true
  promptTokensEst=493
  transcriptPromptTokens=undefined
  transcriptOutputTokens=undefined
  projectedTokenCount=165728
  transcriptBytes=3462189
  forceFlushTranscriptBytes=2097152
  forceFlushByTranscriptSize=true
```

### context-pressure noop (2026-05-18T14:24:45.022Z, repeated)

```
[context-pressure:noop] reason=band-dedup band=13 previous=13 ratio=17% session=agent:main:discord:channel:1466192485440164011
```

### context-pressure noop (later, same session) 14:29:45 / 14:30:54 / 14:31:31 / 14:31:40

```
[context-pressure:noop] reason=band-dedup band=13 previous=13 ratio=19% session=agent:main:discord:channel:1466192485440164011
```

Band quantization is stable across the session lifetime (`band=13`, `previous=13`) and pressure-ratio movement from 17% → 19% across the proof window matches the agent-surface `session_status` reading of 189k/1.0m (≈19%) at 14:30 UTC.

### continuation-queue diagnostic heartbeat (2026-05-18T14:29:55.561Z)

```
heartbeat:
  webhooks=0/0/0
  active=0
  waiting=0
  queued=0
  continuationQueueTotal=4
  continuationQueueRunnable=0
  continuationQueueScheduled=0
  continuationQueueStagedPostCompaction=4
  continuationQueueInvalid=0
  continuationQueueEnqueued=0
  continuationQueueDrained=0
  continuationQueueFailed=0
  continuationQueueEnqueueRatePerMinute=0.00
  continuationQueueDrainRatePerMinute=0.00
  continuationQueueFailedRatePerMinute=0.00
  continuationQueueTop=[
    agent:main:subagent:3e4268b9-d292-41e2-80ec-4379212fbf70 (total=1, staged=1),
    agent:main:subagent:4ae7ac88-ecaa-4da8-9c28-f3eb4d3ee920 (total=1, staged=1),
    agent:main:subagent:76a48101-8439-45e6-8b6e-cccf0bbeaedd (total=1, staged=1),
    agent:main:subagent:bdf4514e-740f-4b41-bff1-776c5fc7a7a8 (total=1, staged=1)
  ]
```

The four post-compaction delegates have remained staged for the entire 12+ minute gateway lifetime since deploy at 14:18:10Z. `queue_depth_history` shows 8+ consecutive 30-second samples at `staged_post_compaction=4`, with `enqueued=0` and `drained=0` (no churn).

### continue_work tool fire (2026-05-18T14:31:16.989Z)

```
[continue_work:request]
  session=agent:main:discord:channel:1466192485440164011
  delaySeconds=0
  reason=Fire proof-1 of token-accounting + intra-session continuation chain for cure-(13...
  traceId=42e04614499584c8d0c4e50892f31670
  spanId=6127dc74ece25c0f
  parentSpanId=95cabae6b1a693ea
  traceFlags=01
```

Tool start at 14:31:16.955Z, tool end at 14:31:16.994Z. The `parentSpanId=95cabae6b1a693ea` confirms the continue_work span is stitched under the active agent-turn span (proof of trace-parent stitching invariant).
