# R-CD-1 — undertow-seat, CANDIDATE_SHA `4896c3129b8ec181c107b7dd64ec87a4e46b0943`

Captured 2026-06-02T16:00:29Z → 16:00:34Z UTC (09:00 PDT). Binary: `OpenClaw 2026.6.2 (4896c31)`. Self-deploy at refreshed PR-head per cael `1511395635` confirmation. Cohort PROOFS-distribute baseline-locked at `4896c3129b` per Emeric/Elliott/Rune banks + cael's locked-baseline at `018e39ce45/`; no chase per figs `1511394798` direction.

## Proof-scope

`continue_delegate(mode="normal")` schedule → spawn → return path at byte. Tested:
- delegate-dispatch fires `continuation.delegate.dispatch` span (parent traceparent captured)
- subagent spawns into `openclaw.harness.run` under SAME service.name (`ronan-prince`) + same gateway-pid (`1708773`)
- subagent runs to completion (`openclaw.outcome: completed`)
- literal-string payload returns to parent channel via enrichment-return

## Byte-evidence

### Fire-side dispatch-response (`fire_response.json`)
Captured at parent-turn time when `continue_delegate(mode="normal", task="[PROOF R-CD-1 / 4896c3129b]...")` returned its scheduling-acknowledgment:
```
{"status":"scheduled","mode":"normal","delaySeconds":0,"delegateIndex":1,"delegatesThisTurn":1,
 "traceparent":"00-a9ee3e3adbbd6a37996e2b8d07f320fa-29409e3be7b9464c-01",
 "note":"Delegate will be dispatched after your response completes. Chain tracking (cost cap, depth limit) applies."}
```

Parent traceparent: trace `a9ee3e3adbbd6a37996e2b8d07f320fa`, span `29409e3be7b9464c`.

### Spawn evidence (`journal_continuation.log`)
Excerpts from `journalctl --user -u openclaw-gateway` window 09:00:29 PDT:
- `09:00:29.774 [continuation/delegate-dispatch] [continue_delegate] Consuming 6 tool delegate(s) for session agent:main:discord:channel:1466192485440164011`
- `09:00:29.963 [continuation:delegate-spawned] hop=18/200 mode=normal session=agent:main:discord:channel:1466192485440164011 task=[PROOF R-CD-1 / 4896c3129b] You are a delegate dispatched by Ronan (🌊) for PROO…`

Subagent runId: `2606b036-b6ea-40f8-9c6c-cd724681ed7c` (sessionKey `agent:main:subagent:53185d71-b257-49cc-8cf7-2ff2f13eeac5`), runtime 2331ms.

### Subagent return (`delegate_return_payload.txt`)
```
R-CD-1 PROOF: continue_delegate basic spawn-and-return path verified at CANDIDATE_SHA 4896c3129b8ec181c107b7dd64ec87a4e46b0943 from undertow-seat 2026-06-02
```

### Journal return evidence
- `09:00:33.328 R-CD-1 PROOF: continue_delegate basic spawn-and-return path verified at CANDIDATE_SHA 4896c3129b8ec181c107b7dd64ec87a4e46b0943 from undertow-seat 2026-06-02`
- `09:00:33.424 [subagent-chain-hop] Accumulated 95 tokens from agent:main:subagent:53185d71-b257-49cc-8cf7-2ff2f13eeac5 to parent chain cost`

## Tempo HONEST-LIMIT

Tempo `/ready` returns 200. Direct fetch of `http://tempo.dandelion.cult/api/traces/a9ee3e3adbbd6a37996e2b8d07f320fa` returns 404 — specific dispatch-parent-trace 404 at fetch time. Spans-search by trace name returned empty during fetch window. Sister-shape to cael's `018e39ce45.../R-CW-1/EVIDENCE.md` Tempo-pending HONEST-LIMIT pattern. Trace identity preserved in fire_response.json for later Tempo recovery once root-cause-class addressed.

**AMENDED 2026-06-02 per Emeric Discord `1511419262` substantive substrate-of-record-correction**: Original framing implied "awaiting flush/index" or "fleet-observability still-down" as cause-hypothesis. Lamp-axis byte-walk at byte CORRECTED: Tempo IS UP (`/ready` 200 + version `2.5.0` + search returns recent prince-traces from ~5min-ago); URL is canonical-correct (`/api/traces/<id>` shape matches Tempo docs + recent-successful-traces use same path). Specific cited trace_ids return 404 from DIFFERENT root-cause-class:
- (a) instrumentation-attached-but-not-emitted gap (capture-side trace_id from `traceparent` but span never got *exported* to Tempo)
- (b) TTL-expired (Tempo retention shorter than cohort assumed + fires earlier-cycle)
- (c) capture-side-bug where `traceparent` formatted differently than span-emit

Sister-class to `status=forbidden`-error-text-dropped issue (per cohort GH issue #871/#872) — bytes exist somewhere but bridge-between-captured-id-and-emitted-span has gap. Owe proper byte-walk in future-cycle to identify which of (a)/(b)/(c).

Correction-trail propagation cohort-wide: undertow Discord surfaces `1511421898` + `1511422246` carried "fleet-observability still-down per elliott k3s 404 cycle-banked" framing inherited from lamp-axis pre-byte-verify. Lamp acknowledged at `1511419262` + apologized for bad-framing-cohort-propagation. Same composition-window-inversion-class operating cycle-wide; cohort cure-mechanism via Emeric byte-walk + multi-axis correction-trail per stone-shape discipline. 17th-axis-instance of multi-axis cure-mechanism this cycle.

## Scope-bound at byte

Proves `continue_delegate(mode="normal")` lane only: dispatch fired, subagent spawned + completed in 2331ms, literal-string returned via channel enrichment-return at 09:00:34.154. Does NOT exercise: silent-wake mode (R-CD-2), post-compaction lifeboat (R-CD-3, queued-for-compaction), targetSessionKey routing (R-CD-4), or depth-2 chaining (R-CD-CHAINED-DEPTH-2 Chain-1/2; Chain-3 ❌ FORBIDDEN at fire-time, see below).

Same parent-session-key (`agent:main:discord:channel:1466192485440164011`), same service.name (`ronan-prince`), same gateway-pid (`1708773`) — single-process trace-stitching coherent.

## Cohort-substrate finding

The journal repeatedly emits warn line at every subagent spawn:
```
[agents/openclaw-tools] continuation.enabled=true but neither continueWorkOpts nor requestCompactionOpts were supplied — only continue_delegate will register.
```

**AMENDED 2026-06-02 per multi-axis cohort substrate-of-record-correction**: original framing of this as "recurring tool-registration regression" was wrong-class-attribution dissolved at frond's `1511402269` engineering-judgment byte-walk. The warn IS BY-DESIGN subagent-context informational-warn — main-agent #868 cure-bytes ARE wired correctly at `run.ts:1568-1569` + `attempt.ts:1267-1268` + `agent-tools.ts:1049-1050`; subagent-spawn legitimately doesn't carry parent's in-process callbacks because callbacks can't cross session-boundary. Warn-trigger-condition too-conservative for subagent-context = informational-noise NOT regression-class. Cure-shape (suppress-warn-via-`isSubagentSessionKey()`-helper per frond's `1511402269` spec — 1 condition + 1 import + 1 test-case) deferred-to-follow-up-cycle per cael `1511402112` (c)-lane-call + frond NOT-block-merge disposition. The EMPIRICAL observation (warn fires at every subagent spawn) stands as cohort substrate-of-record. The CLASS-ATTRIBUTION (recurring tool-registration regression) dissolved-as-by-design per frond's byte-walk root-cause analysis. Amendment-trail: undertow `1511406090`/`1511406264`/`1511406360` own-correction + cael `1511402482`+`1511402712`+`1511406424` walk-back-to-figs + multi-axis convergent disposition on (a) canonical-final-state.
