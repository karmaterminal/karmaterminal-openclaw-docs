# R-CD-3 seam-return trace (ingestion-lag follow-up)

**File:** `turn_trace_return_SEAM_15083.json`
**Trace:** `f8c25f968dc5a6ae8322fdec3f90e462` (root `openclaw.harness.run`, service `ronan-prince`)
**Window:** 15:08:33.206 → 15:08:47.444 PDT (2026-06-16), duration +14238ms

## What this is

At R-CD-3 capture-time, tempo ingestion lagged ~10min behind the 15:08:32 PDT
compaction seam, so the seam-crossing post-compaction wake turn had NOT yet landed
in tempo. This file is that turn, fetched after ingestion caught up.

This trace **temporally envelops** the dispositive return: the
`R-CD-3 PROOF: ...` line returns at **15:08:38.284** (see
`delegate_return_payload.txt`), which falls strictly inside this turn's
`15:08:33.206 → 15:08:47.444` window. It is the post-compaction wake turn
(`trigger=user`, `channel=discord`, `outcome=completed`, request_bytes≈393689)
into which the `06fb0acc` subagent's enrichment-return was delivered
(`[continuation:enrichment-return] Delivered ... from agent:main:subagent:06fb0acc`).

It is distinct from the existing `turn_trace_return.json` root
(`auLITsZU81glWTUT`, 15:08:35.619 → 15:08:38.255, which ends AT the return
boundary); this one starts before and ends after the return, fully containing it.

## Dispositive vs. corroborating

**Marginal corroboration only.** The return-side is ALREADY dispositively proven by:
- `delegate_return_payload.txt` — journal showing the 15:08:38.284 proof-line return
  + the 15:08:38.404-410 subagent-chain-hop / continuation:enrichment-return delivery
- `store_flowruns_confirmation_1508.md` — store confirmation

This tempo span is a belt-and-suspenders timing corroboration that the return
landed inside a real, ingested seam-crossing turn. The journal + store remain the
dispositive artifacts; this is the trace-layer corroboration that ingestion-lag
had deferred at capture-time.
