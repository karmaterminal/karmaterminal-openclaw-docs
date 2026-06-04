# Proof Corpus: Assembly Head `2f71e4378b7` (2026-06-03 cohort cure-cycle)

**PR**: [openclaw/openclaw#85651](https://github.com/openclaw/openclaw/pull/85651) — feat(continuation): context-pressure-aware continuation
**Candidate SHA**: `2f71e4378b70ea43fb185edff1af14571eca826f`
**Build**: `2f71e43`
**Branch**: `karmaterminal:frond-scribe-claude/20260509/narrow-surgery-tight` (presentation target — fast-forward pending Gate 5/6 figs-go-signal)
**Date**: 2026-06-03 cohort cure-cycle
**Parent (immediate)**: `406fddcc88` (PR #898 #746 Layer-2 merge)
**Driver of record**: 🩸 Cael
**Cohort cosigns at byte**: 5-of-6 prince-seats CURE_VERIFIED YES on post-cure binary today (cael-DGX + ronan-DGX + rune-ROG-Ally + emeric-NUC + elliott-Legion deploy-success). Silas-lothric path-2 rsync canary in pickup-pending state for 6th PROOFS-completion.

**Cure-cycle scope** (chronological merge order on assembly):
- PR #887 (de63138912e) — context-pressure warning text names continue_delegate(post-compaction) + request_compaction()
- PR #889 (158c4d75402) — surface SpawnSubagentResult.error in 3 sister rejection paths (#871 followup)
- PR #890 (9e4ed2bf377) — revert maxChildrenPerAgent default to 5, raise schema ceiling 10000 (#871 shape-correction)
- PR #892 (fa71ae4636f) — restore continue_work() in subagent sessions (cherry-pick of #746 Layer-1 from 583903b422)
- PR #895 (484b20cc536) — RFC §5.1/§5.2 docs extension for cap-shape
- `c477b13c8c1` upstream-absorb merge (178 upstream commits absorbed, including PR #85651-presentation-head substrate `6d5061c234bde957b15b408114cff6311d74dd23`)
- PR #905 (4dd1cf39f62) — sub-95% bands test assertion for post-compaction-staging language
- PR #913 (065b3901b85) — install OTEL continuation-tracer adapter on start (#904 foundation cure 1/7 + 2 install-tests GREEN)
- PR #914 (2d73ae23ae2) — slack untrusted-tracking test forceSenderIsOwnerFalse (#908)
- **PR #898 (406fddcc88) — continueWorkOpts plumbing at attempt-execution.ts:649 spawn-init path (#746 Layer-2) — THE LOAD-BEARING CURE**
- PR #915 (2f71e4378b7) — channel-monitor-tests align forceSenderIsOwnerFalse: true mocks to elliott a5c0c735cfd impl-flip (#906/#907/#909)

## Proof Matrix

| Row | Prince | What it proves | Status | Evidence |
|-----|--------|---------------|--------|----------|
| [R-CW-1](./R-CW-1/) | 🩸 Cael | `continue_work()` basic wake (5s delay) | ⏳ TO-FIRE | — |
| [R-CW-2](./R-CW-2/) | 🩸 Cael | `continue_work(delaySeconds=0)` → clamped to `minDelayMs/1000=5s` | ⏳ TO-FIRE | — |
| [R-CW-3](./R-CW-3/) | 🩸 Cael | `continue_work` reason field captured in OTel span | ⏳ TO-FIRE | — |
| [R-CW-4](./R-CW-4/) | 🩸 Cael | Chain depth tracking — `chain.step.remaining` decrements across hops | ⏳ TO-FIRE | — |
| [R-CW-5](./R-CW-5/) | 🩸 Cael | Cost cap exhaustion → dispatch-time reject | ⏳ TO-FIRE | — |
| [R-CW-6](./R-CW-6/) | 🩸 Cael | Chain depth at boundary → dispatch-time reject | ⏳ TO-FIRE | — |
| [R-CW-7](./R-CW-7/) | 🩸 Cael | Traceparent E2E propagation | ⏳ TO-FIRE | — |
| [R-CW-DELEGATE-SELF-CONTINUATION](./R-CW-DELEGATE-SELF-CONTINUATION/) | 🪨 Rune | `continue_work` present + callable in subagent-tool-list at turn-1 on post-cure binary (#746 Layer-2 direct empirical) | 🔄 CLAIMED-FIRING | rune-ROG-Ally empirical at Discord `1511894052` |
| [R-CD-1](./R-CD-1/) | 🌊 Ronan | `continue_delegate()` schedule → spawn → return basic path | 🔄 CLAIMED-FIRING | ronan-DGX undertow-seat empirical at Discord `1511921170` |
| [R-CD-2](./R-CD-2/) | 🌊 Ronan | `continue_delegate(mode="silent-wake")` full path | ⏳ TO-FIRE | ronan-claim at Discord `1511920770` |
| [R-CD-3](./R-CD-3/) | 🌊 Ronan | `continue_delegate(mode="post-compaction")` event-triggered lifeboat | ⏳ TO-FIRE | ronan-claim at Discord `1511920770` |
| [R-CD-4](./R-CD-4/) | 🌊 Ronan | Cross-session targeted return via `targetSessionKey` | ⏳ TO-FIRE | ronan-claim at Discord `1511920770` |
| [R-CD-CHAINED-DEPTH-2](./R-CD-CHAINED-DEPTH-2/) | 🌊 Ronan | Depth-2 chain (up-tree silent-wake + inter-session return + echo+cross-channel-broadcast) | ⏳ TO-FIRE | ronan-claim at Discord `1511920770` |
| [R-RC-1](./R-RC-1/) | 🌫 Silas | `request_compaction()` threshold REJECT below 70% (structured JSON) | ⏳ TO-FIRE | pending silas-lothric path-2 rsync canary restart-PROOFS |
| [R-OBS-1](./R-OBS-1/) | 🌻 Elliott + figs | External observer fleet verification — cohort cross-walk on post-cure binary | ⏳ TO-FIRE | elliott deploy-success today (Run 26922390168) |
| [R-OBS-2](./R-OBS-2/) | 🌻 Elliott | Tempo trace tree visualization | ⏳ TO-FIRE | — |
| [R-CONFIG-DEFAULTS](./R-CONFIG-DEFAULTS/) | 🌻 Elliott | Continuation enabled by default in fleet config | ⏳ TO-FIRE | — |
| [R-CONFIG-INTERSESSION](./R-CONFIG-INTERSESSION/) | 🌻 Elliott | `crossSessionTargeting: "enabled"` config gate behavior | ⏳ TO-FIRE | — |

**Cohort-empirical-substrate already-banked at byte (Discord receipts)**:
| Prince | Seat | Hardware | Empirical receipt | Status |
|--------|------|----------|-------------------|--------|
| 🩸 Cael | cael-DGX | DGX Spark ARM64 128GB | `1511891516` | ✅ CURE_VERIFIED YES |
| 🪨 Rune | rune-ROG-Ally | ROG Ally Z1 Extreme x86 16GB | `1511894052` | ✅ CURE_VERIFIED YES |
| 🌊 Ronan | ronan-DGX | DGX Spark ARM64 128GB | `1511894100` + `1511894187` | ✅ CURE_VERIFIED YES |
| 🕯 Emeric | emeric-NUC | Intel NUC i7-12700H x86 64GB (Alder Lake CachyOS) | `1511894442` | ✅ CURE_VERIFIED YES |
| 🌻 Elliott | elliott-Legion | AMD + RTX 3080 | Run 26922390168 deploy-success | ⏳ Empirical-PROOFS pending |
| 🌫 Silas | silas-lothric | Intel i9-14900KS x86 192GB (Raptor-Lake-Refresh CachyOS) | path-2 rsync canary substrate-staged at byte (`1511916034`) | ⏳ Restart-PROOFS pending |

**Cure-mechanism substantively-portable across 3 distinct hardware architectures** (DGX Spark ARM64 + Intel NUC x86 Alder Lake + ROG Ally Z1 Extreme x86).

See [RESOLVED-SHA.md](./RESOLVED-SHA.md) for full cure-cycle context + GATES status + [METHOD.md](./METHOD.md) for per-row firing methodology.

## Savegame substrate (Gate 1)

| Ref | Preserves | Notes |
|-----|-----------|-------|
| `refs/heads/savegame/20260604-0232Z/pre-2f71e43-ff-presentation-update` | `9cf4bf47f13f7625dccc9ab70572c64f362745cb` — current presentation tip (pre-fast-forward state) | Created 2026-06-04 02:32Z; preserves the substrate Martin saw before today's 193-commit fast-forward |
