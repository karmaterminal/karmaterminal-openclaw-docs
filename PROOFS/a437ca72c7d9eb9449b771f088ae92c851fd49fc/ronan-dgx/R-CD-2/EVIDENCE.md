# R-CD-2 EVIDENCE — `continue_delegate(mode="silent-wake")` enrichment-return + parent-wake

**Row**: R-CD-2 — `continue_delegate(mode="silent-wake")` full path (silent return + parent-wake trigger)
**Owner**: 🌊 Ronan (ronan-dgx seat)
**CANDIDATE_SHA**: `a437ca72c7d9eb9449b771f088ae92c851fd49fc`
**Seat**: ronan-dgx
**Gateway version**: `OpenClaw 2026.6.2 (a437ca7)` ("Merge #992")
**Gateway PID**: `1356577` (ActiveEnterTimestamp `Wed 2026-06-10 21:01:59 PDT`)
**Cure-assembly landed in this binary**: #982/#985 (multi-`continue_work` capture) + #988 (flood-cap) + #989 (chain-budget reset gate)
**Session provenance**: fired from the **MAIN** session (`agent:main:discord:channel:1466192485440164011`) — clean main-session provenance (NOT the post-compaction shard, which terminated mid-flight; its partial R-CD-2 capture was superseded by this main-session fire).

## Proof-scope

`continue_delegate(mode="silent-wake")` full path at byte on the deployed `a437ca7` binary. This is the **tool-form** of the BOTH-FORMS mandate (figs 2026-06-07; the bracket-form sibling `R-CW-DELEGATE-TOKEN` is Rune's). The silent-wake contract has two halves that BOTH must hold:
1. **Silent** — the delegate's return payload is delivered as internal context with `silentAnnounce=true` (NO channel-visible post from the child).
2. **Wake** — the return triggers a fresh parent-turn (`wakeOnReturn=true`).

**The behavioral proof is self-demonstrating**: the parent-turn that captured this EVIDENCE.md is *itself* the wake the silent-wake triggered. The EVIDENCE.md exists because the wake fired.

## Fire

- **fire_utc**: 2026-06-11T05:07:54Z (2026-06-10 22:07:54 PDT) — see `fire_response.json`
- **mode**: silent-wake
- **delaySeconds**: 0 (resolved → `delegate.delivery=immediate`)
- **delegateIndex**: 1, delegatesThisTurn: 1
- **fire_response**:
  ```json
  {"status":"scheduled","mode":"silent-wake","delaySeconds":0,"delegateIndex":1,"delegatesThisTurn":1,
   "traceparent":"00-c91022b97a34f108a881ac37340495cd-a28033bc37644d6b-01"}
  ```
  `status: "scheduled"` is the dispatch return-shape (the mode-distinction surfaces in the journal + trace, not the fire-response status).

## Spawn + Return + Wake (journal byte-trail — `journal_enrichment_return.log`)

```
22:08:09.698 [continuation/delegate-dispatch] [continuation:delegate-spawned] hop=1/200 mode=silent-wake
             session=agent:main:discord:channel:... task=[PROOF R-CD-2 / a437ca7 / ronan-dgx / main-session]
22:08:13.014 R-CD-2 PROOF: continue_delegate(mode=silent-wake) enrichment-return + parent-wake path verified
             at CANDIDATE_SHA a437ca72c7d... from ronan-dgx main session 2026-06-10        ← payload echoed
22:08:13.143 [subagent-chain-hop] Accumulated 103 tokens from agent:main:subagent:continuation-1e2b41bb... to parent chain cost
22:08:13.145 [continuation/announce] [continuation/silent-wake] wakeOnReturn=true target=agent:main:discord:channel:... silentAnnounce=true
22:08:13.145 [continuation/announce] [continuation:enrichment-return] Delivered to agent:main:discord:channel:... from agent:main:subagent:continuation-1e2b41bb...
```

**The two dispositive lines** (22:08:13.145):
- `[continuation/silent-wake] wakeOnReturn=true ... silentAnnounce=true` — proves BOTH halves of the contract on one line: `silentAnnounce=true` (silent) AND `wakeOnReturn=true` (wake).
- `[continuation:enrichment-return] Delivered to agent:main:discord:channel:...` — the enrichment-return delivery signature (the payload arrives as internal context to the parent session, not as a channel post).

Round-trip: fire 22:07:54 → spawn 22:08:09 → return/deliver 22:08:13 (~3s child runtime per the completion event: 103 tokens, in 2 / out 101).

## Tempo trace

**Trace ID**: `c91022b97a34f108a881ac37340495cd`
**Tempo URL**: http://tempo.dandelion.cult/api/traces/c91022b97a34f108a881ac37340495cd
**Raw**: `turn_trace_raw.json` (this dir) • **span list**: `span_summary.tsv` (22 spans)
**resource attrs at byte**: `host.name=ronan`, `process.pid=1356577` (matches the deployed gateway PID).

The dispatch span:

| span | duration | key attrs |
|---|---|---|
| `continuation.delegate.dispatch` | 63.3ms | `chain.id=fe075dd5-cc7c-4dd7-a3ea-ab8077e58b40`, `chain.step.remaining=199`, **`delegate.mode=silent-wake`**, `delegate.delivery=immediate`, `delay.ms=0`, `reason.preview=[PROOF R-CD-2 / a437ca7 / ronan-dgx / main-session]…` |
| `continuation.queue.drain` | 0.0ms | — |

`delegate.mode=silent-wake` on the dispatch-span is the Tempo byte distinguishing this row from R-CD-1 (`delegate.mode=normal`).

## Verdict

✅ **PASS** — `continue_delegate(mode="silent-wake")` from the ronan-dgx **main** session at CANDIDATE_SHA `a437ca72c7d…` (deployed `a437ca7`) spawns with `mode=silent-wake`, returns the payload as an enrichment-return delivery with `silentAnnounce=true` (silent — no channel post) AND `wakeOnReturn=true` (wake — triggers the fresh parent-turn). The Tempo `continuation.delegate.dispatch` span confirms `delegate.mode=silent-wake`. **The parent-turn that wrote this EVIDENCE.md is the wake — the proof is self-demonstrating.**

## Scope-bound at byte

Proves the `continue_delegate(mode="silent-wake")` lane only on `a437ca7`: dispatch-span fired with `mode=silent-wake`, payload returned via `[continuation:enrichment-return]`, `wakeOnReturn=true` + `silentAnnounce=true` confirmed in journal, parent-wake fired (this EVIDENCE.md). Does NOT exercise: normal mode (R-CD-1), post-compaction lifeboat (R-CD-3), targetSessionKey routing (R-CD-4). Single gateway-pid (`1356577`) — single-process trace coherent. Tool-form only (bracket-form sibling = Rune's R-CW-DELEGATE-TOKEN).
