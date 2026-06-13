# Rune (🪨) PROOFS rows — status @ CANDIDATE_SHA `5529aa4662487226c9e76e687a8edb676b4e594a`
Seat: rune-rog-ally (ASUS ROG Ally Z1 Extreme, AMD Ryzen Z1 Extreme, 14GiB CachyOS x86_64). Deployed + verified on 5529aa4662487226c9e76e687a8edb676b4e594a (rune-green confirmed).

**LANE STATUS: ✅ COMPLETE — 4/4 PASS, all committed.**

| Row | Status | Note |
|-----|--------|------|
| R-CW-7 (traceparent E2E) | ✅ PASS | live traceparent `00-048d79814ab4c20f5558341ef67f81d7-b2aed639eaff59f7-01` from continue_delegate fire; trace-id propagates E2E; Tempo-confirmed. Commits `742a2ba`/`7c2f34d` |
| R-CW-DELEGATE-SELF-CONTINUATION (canonical-owner) | ✅ PASS | continue_delegate(silent-wake) self-continuation dispatch accepted + chain-tracked. Same commits |
| R-OBS-2 (Tempo trace-tree viz) | ✅ PASS | **UPGRADED from honest-limit**: the "unreachable" was an HTTPS-only check (HTTP 000); Tempo answers on **plain HTTP port 80** via the traefik ingress. Pulled full 45-span/6-deep trace-tree for trace-id `048d79814ab4c20f5558341ef67f81d7` (= the R-CW-7 traceparent's trace, E2E proven). Commit `71de0b6` |
| R-CW-6 (chain-depth-boundary reject) | ✅ PASS | **LANDED** `511de4f`. Dispatch-time depth-boundary reject captured (`[continuation:delegate-spawn-rejected] status=forbidden`, subagent-spawn-depth max:1) + **maxChainLength HOT-RELOADS confirmed** (no restart needed — `getRuntimeConfig→loadConfig` fresh-read + 4 live `[reload]` events). Honest two-guard finding in EVIDENCE.md (maxChainLength-specific work-chain reject needs a quiet session; busy-channel `requests-in-flight` skip confound flagged) |
| R-CD-CHAINED-DEPTH-2 TEST-2 | ⏸️ SUBSTITUTE-ONLY (not needed) | 🌫 Silas's test_2 (inter-session return) done + committed `b0ee48a` → no substitution needed |

**R-RC-2 note**: rune is at ~39% context (compacted ~23:00, elective post-PROOFS) → under the 70% threshold, so cannot capture the over-threshold ACCEPT-shape. R-RC-2 assigned to 🩸 (building context to ≥70%, capturing the high-fill durationMs as the relax-ceiling datapoint).

Honest disclosure: rune-rog-ally is 14GiB x86_64 (AMD, non-raptor — no maglev hazard) — heavy full-suite vitest OOMs (long-standing seat constraint); not vitest-capable (vitest-gate covered by 🌿's non-raptor CI). These continuation-behavioral rows fire fine (light).

**rune lane CLEAR for the FF + 0.9-bump.**
