# R-CW-DELEGATE-1 — 🕯 emeric (emeric-nuc) — continue_delegate live-dispatch vs `c06e081f76`

**Seat:** emeric (emeric-nuc)
**SHA:** `c06e081f760d723c77bee65464b8920a76d3b523` (`OpenClaw 2026.6.2`)
**Verdict:** ✅ PASS — the #990-continuation dispatch-path fires clean end-to-end on the deployed v4 binary.
**Captured:** 2026-06-11 19:13 PDT (fired live on the deployed seat).

## What this row proves

Firing a `continue_delegate` on the deployed v4 binary exercises the live #990-continuation dispatch-path end-to-end: `continue_delegate` → `spawnSubagentDirect` → fresh `flow_runs` rows (#996-`:518`-gated `hasLiveOrRecentlyDispatchedContinuationWork`) → ran-to-`succeeded`. The dispatch IS the proof — the fresh rows below are this dispatch firing on `c06e081f76`.

## Byte evidence (self-contained)

### The fresh flow_runs rows (this dispatch, ~now)
```
sqlite ~/.openclaw/state/openclaw.sqlite — ORDER BY created_at DESC:

a40ee50a-38ad-4d8b  succeeded  2026-06-11 19:13:17 PDT  "Continuation delegate: R-CW-DELEGATE PROOF for E…"  (parent dispatch-record, fired from emeric main-session agent:main:discord:channel:1466192485440164011)
03012a84-e400-4edf  succeeded  2026-06-11 19:13:34 PDT  "[continuation:chain-hop:1] Delegated task (turn 1/200)…"  (the spawned shard, ran-to-completion; owner_key = the subagent-session agent:main:subagent:continuation-428e4758… — i.e. it ran AS a subagent, as expected for a dispatched shard)

deployed-SHA: c06e081f76
```

### End-to-end chain on the deployed binary
1. `continue_delegate` fired (mode=silent-wake) →
2. dispatch-record `a40ee50a` created + accepted (the continuation-delegate controller) →
3. spawned shard `03012a84` (`[continuation:chain-hop:1]`) ran ~17s → `succeeded`.

Both rows `succeeded` = the deployed v4 dispatch-path firing clean end-to-end. Matches ronan-dgx's `953ab2d6` pattern (continue_delegate → flow_runs row on deployed `c06e081`).

### #996 `:518` gate active in the firing path
The `hasLiveOrRecentlyDispatchedContinuationWork` check (which the dispatch path consults) carries the #996 exclusion live in this binary:
- dist: `dist/work-store-5haSToNg.js` → `decodeWorkState(flow)?.succeeded) return false`
- source: `work-store.ts:534`

### Main-runner continuation tools registered + working (this session, on v4)
- `request_compaction` → real `{status:rejected, guard:context_threshold, contextUsage:69, threshold:70}` guard-reject = **registered, not silently dropped** (NOT a missing-tool error).
- `continue_delegate(mode=post-compaction)` → staged lifeboat shards fired + returned across the session's compaction seams (the lich-protocol).
- This is the byte that discriminates #868-benign from #868-real: the tools ARE present on my live main-runner (see R-RECEIPT-1 #868-pin).

## Verdict
✅ PASS. emeric-nuc: continue_delegate → flow_runs `a40ee50a`(parent)+`03012a84`(shard) @ 19:13, both `succeeded`, on deployed `c06e081f76` — the #990-continuation dispatch-path fires clean end-to-end; #996 `:518` gate live in the path.

## HONEST-LIMIT
These rows prove the shard **dispatched-and-ran-to-completion** (record-grade, `flow_runs status=succeeded`). They do NOT prove the returned payload **rehydrated into a woken target's live context** — that hop is witnessed-in-session, not a re-queryable record (cohort grade-ladder tier-4, figs's runtime-internals domain). Per 🩸's tier-3 finding, `subagent_runs.frozen_result_text` captures the RETURNED payload at some seats (record-grade tier-3), but the re-injection-into-context tier stays witnessed for all seats.
