# R-OBS-1: 4-Prince Cross-Walk Verification

**SHA**: `55c0ed67a5b89c0e3a99e3e862968a5e1aeabc26`
**Date**: 2026-05-20
**Method**: SSH to each prince-host, query `git rev-parse HEAD` in live runtime tree (`~/flesh_beast_tmp/openclaw`)
**Driver**: 🌊 ronan (spark-ecdf seat)

## Cross-walk receipts

```
elliott: 55c0ed67a5b89c0e3a99e3e862968a5e1aeabc26
silas: 55c0ed67a5b89c0e3a99e3e862968a5e1aeabc26
cael: 55c0ed67a5b89c0e3a99e3e862968a5e1aeabc26
ronan: 55c0ed67a5b89c0e3a99e3e862968a5e1aeabc26
```

**Verdict**: ✅ 4-of-4 fleet seats aligned at canonical SHA. Continuation-feature runtime live on all 4 prince-hosts at the SHA matching PR #79925 HEAD.

## Status-card observations (from fleet `/status` walk earlier this session)

| Seat | Version | Gateway Uptime | Continuation Chain |
|------|---------|----------------|---------------------|
| 🌻 elliott | `OpenClaw 2026.5.19 (55c0ed6)` | 19m 28s | chain 0/200 (fresh post-deploy) |
| 🌫 silas | `OpenClaw 2026.5.19` (post-realign at `55c0ed67a5`) | (post-`fe241bd5a1` deploy + realign) | chain 5/200 |
| 🌊 ronan | `OpenClaw 2026.5.19 (55c0ed6)` | 25m 59s (this seat) | chain 5/200 |
| 🩸 cael | `OpenClaw 2026.5.19 (55c0ed6)` | 23m 43s | chain 9/200 |

## Observability surface (Tempo trace-context)

The `traceparent` header is propagated through every continuation tool call (continue_work / continue_delegate / request_compaction). Traces land in tempo via otel-collector → `tempo.observability.svc.cluster.local:4317` (gRPC), bypassing haproxy entirely. Cluster-internal path verified live during PROOFS firing.

External `tempo.dandelion.cult/api/traces/<trace-id>` requires haproxy resolver-block fix (banked separately as 🌻 haproxy template-PR for the chronic 24-min restart-loop). For this PROOFS cycle, trace-IDs captured from delegate dispatch responses at runtime:

| Row | Trace-ID | Receipt |
|-----|----------|---------|
| R-CW-1 (🌊) | `05316d9aa5bd2f840d67b15b2618af1d` | continue_work scheduled, wake delivered |
| R-CD-1 (🌊) | `808b5850574aa890725aef4b69572098` | continue_delegate full path |
| R-CD-3 (🌊) | `99b7385bd56f24242b7356cf0a771be8` | post-compaction stage-acceptance |
| R-CD-4 (🌊) | `5848711489872fb8bfb59cdc8bee1e70` | cross-session targetSessionKey dispatch |
| R-CW-2 (🩸) | `b41b4b3f27acc886b864985715a0fb14` | chain-counter + multi-tool same-turn |
| R-OBS-1 (🩸) | `b41b4b3f27acc886b864985715a0fb14` | silent-wake full cycle (same-trace as R-CW-2) |
| R-CD-CHAINED-DEPTH-2 (🌫) | `9b853d83...` / `fed5a295...` / `bd89c9ee...` | depth-2 chain tests |
| R-RC-1 (🌫) | n/a (rejection-path, no trace fan-out) | request_compaction threshold-guard rejection |
