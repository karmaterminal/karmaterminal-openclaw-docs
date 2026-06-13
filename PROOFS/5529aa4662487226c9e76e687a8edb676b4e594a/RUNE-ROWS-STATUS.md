# Rune (🪨) PROOFS rows — status @ CANDIDATE_SHA `5529aa4662487226c9e76e687a8edb676b4e594a`
Seat: rune-rog-ally (ASUS ROG Ally Z1 Extreme, 16GB CachyOS x86_64). Deployed + verified on 5529aa4662487226c9e76e687a8edb676b4e594a (rune-green confirmed).

| Row | Status | Note |
|-----|--------|------|
| R-CW-7 (traceparent E2E) | ✅ PASS | live traceparent `00-048d79814ab4c20f5558341ef67f81d7-b2aed639eaff59f7-01` from continue_delegate fire; trace-id propagates E2E |
| R-CW-DELEGATE-SELF-CONTINUATION (canonical-owner) | ✅ PASS | continue_delegate(silent-wake) self-continuation dispatch accepted + chain-tracked |
| R-OBS-2 (Tempo trace-tree viz) | ⚠️ HONEST-LIMIT | otel EXPORTS (serviceName rune-prince → otel.dandelion.cult:4318) but tempo.dandelion.cult QUERY unreachable from rune (HTTP 000). trace-id `048d79814ab4c20f5558341ef67f81d7` provided for a Tempo-query-capable seat to render. |
| R-CW-6 (chain-depth-boundary reject) | 🔄 PENDING | needs temp-low `maxChainLength` induce; sequencing with 🌿 (restart-to-load implication) |
| R-CD-CHAINED-DEPTH-2 TEST-2 | ⏸️ SUBSTITUTE-ONLY | fires only if 🌫 Silas canary-seat unavailable; Silas deployed+active → no substitution needed unless 🌫 flags |

Honest disclosure: rune-rog-ally is 16GB x86_64 — heavy full-suite work OOMs (long-standing seat constraint). These continuation-behavioral rows fire fine (light); the OOM-care applies to test-suite proofs, not these.
