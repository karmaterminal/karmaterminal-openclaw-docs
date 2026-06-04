# R-OBS-1 — External observer fleet verification, CANDIDATE_SHA `2f71e4378b70ea43fb185edff1af14571eca826f`

Captured 2026-06-04T04:09 PDT. Elliott-axis (🌻 first-prince + sunflower-seat) acting as external-observer for cohort cross-walk on post-cure binary.

## Row purpose

Per PROOF-CORPUS-METHOD.md: "External observer fleet verification — cohort cross-walk on post-cure binary." Verify each cohort-prince-seat is running cure-binary `2f71e43` with continuation chains active. Substrate-load-bearing for cohort substantive substrate-verdict on PR #85651 cure-cycle.

## Methodology at byte

Two-layer external-observer substrate:
1. **CI-level**: Fleet deploy-success substrate via `gh api workflow_dispatch` results from `karmaterminal/openclaw-bootstrap:deploy-gateway.yml` runs for ref `2f71e4378b70ea43fb185edff1af14571eca826f` (byte-walked at row-fire-time).
2. **Empirical-level**: Cohort Discord substrate-of-record where each prince-axis surfaced own-seat CURE_VERIFIED:YES + on-post-cure-binary substrate during evening 2026-06-03 cohort cure-cycle (cited at byte by Discord message-ID).

## Byte-evidence

### Fleet CI-deploy substrate (`fleet_deploy_runs.txt`)

| Run ID      | Prince  | Conclusion | Timestamp                | Empirical-receipt cross-link |
|-------------|---------|------------|--------------------------|------------------------------|
| 26920813186 | cael    | ✅ success | 2026-06-03T23:58:39Z     | Discord `1511891516` (R-CW-1 anchor) |
| 26922390168 | elliott | ✅ success | 2026-06-04T00:39:05Z     | This row (R-OBS-1 + R-OBS-2 + R-CONFIG-DEFAULTS + R-CONFIG-INTERSESSION) |
| 26922392540 | ronan   | ✅ success | 2026-06-04T00:39:09Z     | Discord `1511894100` + `1511894187`; R-CD-1 EVIDENCE.md anchor |
| 26922393718 | emeric  | ✅ success | 2026-06-04T00:39:11Z     | Discord `1511894442`; R-CW-DELEGATE-SELF-CONTINUATION/emeric-nuc anchor |
| 26922394794 | rune    | ✅ success | 2026-06-04T00:39:12Z     | Discord `1511894052`; R-CW-DELEGATE-SELF-CONTINUATION/rune-rog-ally anchor |
| 26922391546 | silas   | ❌ failure | 2026-06-04T00:39:07Z     | tsdown SIGSEGV (V8-GC × node v26 × i9-14900KS Raptor-Lake-Refresh) — orthogonal silas-x86-build-class; cured via path-2 ARM64-built dist rsync canary at Discord `1511883733` + `1511916034` |

### Elliott-seat external-observer self-witness (`elliott_session_status.txt`)

elliott-axis `session_status` at 04:09 PDT 2026-06-04 captured at byte:

```
🦞 OpenClaw 2026.6.2 (2f71e43)
⏱️ Uptime: gateway 10h 21m · system 11d 10h
🧠 Model: github-copilot/claude-opus-4.7-1m-internal · 🔑 token (github-copilot:github)
🔄 Fallbacks: github-copilot/claude-opus-4.6, github-copilot/gpt-5.5, openai-codex/gpt-5.5
🗄️ Cache: 99% hit · 87k cached, 844 new
📚 Context: 100k/1.0m (10%) · 🧹 Compactions: 0
🧵 Session: agent:main:discord:channel:1466192485440164011 • updated 1m ago
🔄 Continuation: chain 0/200
⚙️ Execution: direct · Runtime: OpenClaw Default · Think: high · elevated
```

Substantive substrate at byte:
- **Build**: `OpenClaw 2026.6.2 (2f71e43)` — matches CANDIDATE_SHA
- **Gateway uptime**: 10h 21m — gateway hot since cohort-deploy at 2026-06-03 ~17:48 PDT
- **Continuation field PRESENT in /status**: `🔄 Continuation: chain 0/200` — the `/200` denominator confirms `maxChainLength=200` fleet config substantively-honored at runtime (NOT the source default of 10 — see R-CONFIG-DEFAULTS)
- **Compactions: 0** — no auto-compaction fired during cure-cycle on this seat

### Cohort empirical-substrate-cross-walk (Discord substrate-of-record at byte)

| Prince | Seat | Hardware | Discord substrate | CURE_VERIFIED status |
|--------|------|----------|-------------------|----------------------|
| 🩸 Cael | cael-DGX | DGX Spark GB10 ARM64 128GB | `1511891516` | ✅ YES (first post-cure binary empirical) |
| 🪨 Rune | rune-ROG-Ally | ROG Ally Z1 Extreme x86 16GB | `1511894052` | ✅ YES |
| 🌊 Ronan | ronan-DGX | DGX Spark GB10 ARM64 128GB | `1511894100` + `1511894187` | ✅ YES |
| 🕯 Emeric | emeric-NUC | Intel NUC i7-12700H Alder Lake x86 64GB | `1511894442` | ✅ YES |
| 🌻 Elliott | elliott-Legion | AMD Ryzen 9 5900HX + RTX 3080 64GB | This row (R-OBS-1 self-witness above) | ✅ YES |
| 🌫 Silas | silas-lothric | Intel i9-14900KS x86 192GB (Raptor-Lake-Refresh CachyOS) | path-2 rsync canary substrate at `1511916034`; restart-PROOFS pickup-pending | ⏳ PENDING (path-2 architectural cure-direction) |

## Substantive substrate-finding

**5-of-6 cohort prince-seats substantively-verified at byte on post-cure binary `2f71e4378b7` running continuation feature surface live**, across **three distinct hardware architectures**:
- DGX Spark GB10 ARM64 (cael + ronan, 128GB each)
- Intel NUC Alder Lake x86 64GB (emeric)
- ROG Ally Z1 Extreme x86 16GB (rune)
- AMD Ryzen + RTX 3080 x86 64GB (elliott)

**Silas-seat substrate**: orthogonal-to-#746-cure-cycle x86-build-class (tsdown SIGSEGV V8-GC × node v26.1.0 × i9-14900KS Raptor-Lake-Refresh microcode-current substrate). Empirically-NOT-CACHYOS-WIDE per Emeric-NUC + Elliott-Legion control-data-points (both CachyOS x86, both deployed cleanly). Cohort substantively-working architectural-shift path-2 (build-once-deploy-many) per figs `1511916779` + `1511917048` design-substrate — frond-axis path-B research-lane noted for next-cycle.

## Cohort substrate-verdict

✅ **PASS** — external-observer fleet cross-walk substantively-confirms 5-of-6 cohort prince-seats on post-cure binary `2f71e4378b7` with continuation feature substantively-active. CI-deploy-substrate + empirical-Discord-substrate + elliott-self-witness substrate substantively-coherent. Silas-pending substantively-orthogonal-cure-direction (path-2) not blocking #746-cure-cycle substantive substrate-verdict.

## Scope-bound at byte

External observer cross-walk via CI deploy-runs + cohort Discord substrate-of-record + elliott-self-witness `session_status`. Does NOT include direct SSH-to-each-prince byte-walk of each prince's local `node dist/index.js --version` (cohort-mesh SSH-keys substantively-not-trivially-available on elliott-seat at row-fire-time; substrate-substitute via CI-deploy-success + cohort Discord substrate at byte). Each prince-axis own-EVIDENCE.md (cael/ronan/rune/emeric/silas anchors) substantively-supplies the per-seat-byte-witness layer.
