# PROOFS / 718d8558eb618304b5cc43c8a3b5d93ff5bef454

Focused-proof corpus for **cure-(13)** ship-candidate SHA.

- **SHA**: `718d8558eb618304b5cc43c8a3b5d93ff5bef454`
- **PR**: openclaw/openclaw#79925
- **Parent**: `upstream/main@6a5a1353c7` (at squash-time 2026-05-18T14:04Z)
- **Build verified on silas-host**: `OpenClaw 2026.5.17 (718d855)` (built 14:18:10Z)
- **Build verified on ronan-host**: `OpenClaw 2026.5.17` (continuation-live-fire firing)

## Gates summary

| Gate | Status | Detail |
|------|--------|--------|
| tsgo:core | ✅ | 0 errors |
| tsgo:test | ✅ | 0 errors (core.test + extensions.test) |
| focused session-write-lock.test.ts | ✅ | 34/34 passed (560ms) |
| pnpm lint (scripts + core + extensions) | ✅ | 0/0/0 errors |
| pnpm test (full, 16 workers, 32GB heap) | ✅* | 2031 passed / 1 failed (`src/plugins/uninstall.test.ts` — upstream's own bug, reproduces on bare upstream identically) / 1 skipped |
| 🌊 ronan cohort byte-walk | ✅ | telegram + agent-runner + compact + no-conflict-markers + 53/53 + 28/28 |
| 🩸 cael cohort byte-walk | ✅ | compact.ts + agent-runner.ts Trigger D + preview-dedupe fixup |
| Squashed SHA byte-empty tree-diff vs pre-squash | ✅ | runtime-identical-attest pattern |

\* The one full-vitest failure is upstream's own regression from `2a67a7f65e fix(plugins): prune managed peers on uninstall`. Both `src/plugins/uninstall.ts` (prod) and `src/plugins/uninstall.test.ts` (test) are byte-identical between cure-(13) and `upstream/main`. NOT a cure-(13) regression; tracked separately as upstream-bug class.

## Row inventory

| Row | Prince-seat | Verdict | Path |
|-----|-------------|---------|------|
| `continuation-live-fire/` | 🌊 ronan | (pending fire) | `continuation-live-fire/` |
| `inter-session-targeting/` | 🩸 cael | (gated on cael deploy re-fire) | `inter-session-targeting/` |
| `post-compaction-threshold/` | 🩸 cael | (gated on cael deploy re-fire) | `post-compaction-threshold/` |
| `R-TA-1/` token-accounting | 🌫 silas | (firing scheduled) | `R-TA-1/` |
| `deploy-validation/` | 🌻 elliott | (ACK pending) | `deploy-validation/` |
| `gateway-health/` | 🌻 elliott | (ACK pending) | `gateway-health/` |

See `METHOD.md` for methodology + upstream-drift acknowledgement + cohort-decision context.

## Cohort-validated drift posture

This candidate's parent (`6a5a1353c7`) was current upstream/main at squash-time. Upstream has since advanced (~9 commits at time of this README write; rate ~1 commit per 5-10 min observed). Cohort decision (🌊 + 🩸 + scribe consensus): freeze this SHA as proof base; do not chase upstream during gate window. The 30-45 min re-rebase work (per 🌊's deep conflict analysis at Discord `1505940421…`) includes 2 substantive prod-semantic 3-way merges (`agent-runner-execution.ts`, `pi-embedded-runner/run.ts`) that risk introducing regressions; the chase-the-tail trap is exactly what `karmaterminal/openclaw#707` was filed to automate cure.

When force-push gate opens (figs-sanction), ONE final drift-cure handles any remaining parent-freshness need at that moment. Proof artifacts here are runtime-valid regardless.

## Cure-(13) substrate-truth

Cure-(13) is drift-rebase of cure-(12) substrate (`3a37573434`, 1-ahead-of `b0b18d1e4a`) onto upstream/main `6a5a1353c7`, with:

- 8 cohort-byte-walked conflicts resolved per converged policy
- test-isolation lock-patch `10abecf2de` cherry-picked on top
- 2 post-rebase fixups for upstream evolution during cohort-policy-formation window
  - `f55c98abb7`: drop preview-dedupe per upstream's `b6fd843288` revert (today 06:11Z)
  - `4df99ac0b1`: add 7 cure-introduced underscored names to `.oxlintrc.json` allow list

cure-(12) shipped at `a289329d0f` (PR head currently) with PROOFS at `581678f4378427a336c5ac0cf2698cb36e5de9a0/`. cure-(13) preserves all cure-(12) substrate plus lock-patch.


## Appendix A — Drift characterization at proof-time

Per 🩸 suggestion (Discord `1505946352…`): bank the byte-level drift probe as evidence
for why `karmaterminal/openclaw#707` (automated daily rebase) matters. The conflict surface
**grows** with elapsed time, and changes class in ways that auto-merge cannot resolve.

### Probe timeline

| time (UTC) | upstream/main HEAD | conflict files vs cure-(13) | conflict class |
|---|---|---|---|
| 14:11Z (squash time, frozen as proof base) | `6a5a1353c7` | 0 (squashed clean) | n/a |
| ~14:20Z (🌊 first stale-flag) | `4f4d108639` | 6 | test files only |
| ~14:40Z (🌊 fresh probe at `1505940421…`) | `c49d909b60` | **9** | **6 test + 1 lint + 2 prod-semantic** |

### Detailed surface at `c49d909b60`

| file | class | resolution shape |
|---|---|---|
| `.oxlintrc.json` | semantic / convention | upstream simplified to bare `"error"`; cure has ~200-entry allow list. Adopt-or-walk decision. |
| `src/agents/subagent-announce-delivery.test.ts` | rename refactor | upstream renamed `__testing` → `testing` |
| `src/agents/subagent-announce.live.test.ts` | rename refactor | same |
| `src/agents/subagent-registry.lifecycle-retry-grace.e2e.test.ts` | rename refactor | same |
| `src/agents/subagent-registry.test.ts` | semantic | upstream relocated/removed cure-added test block |
| `src/auto-reply/reply/agent-runner.misc.runreplyagent.test.ts` | rename refactor | same `__testing` → `testing` plus extra cure import |
| `extensions/codex/src/app-server/run-attempt.test.ts` | rename refactor | same `__testing` → `testing` |
| `src/agents/pi-embedded-runner/run.ts` | **prod semantic** | both sides add different fields to same object-literal line |
| `src/auto-reply/reply/agent-runner-execution.ts` | **prod semantic (2 blocks)** | orthogonal additions to `runWithModelFallback` union + options object |

### Operational findings

1. **GitHub auto-merge does NOT resolve any of these.** Renames + semantic adds are real `UU`
   conflicts requiring manual 3-way resolution.
2. **The conflict class hardens over time.** At T+10min the surface was test-only mechanical;
   by T+30min it included 2 prod-semantic 3-way merges in load-bearing code paths.
3. **Re-rebase work estimate** at `c49d909b60`: 30–45 minutes of careful resolution + a full gate
   cycle to re-prove, then byte-walks invalidating any pre-existing cosigns. Each minute spent
   on it lets upstream advance further.
4. **The `__testing` → `testing` rename is codebase-wide convention churn.** Even after resolving
   the 6 listed files, downstream callers of the renamed identifiers would need walking. Adopting
   upstream's convention is the only stable choice; partial-adoption is a regression vector.

### Why this argues for #707

The cure-(10) through cure-(13) treadmill burned 30+ hours of cohort time **each cycle** because:

- Upstream advances ~1 commit per 5–10 min (observed during this window).
- Without automated daily rebase + alert on conflicts, cure work always starts on an already-stale
  base.
- Manual probe → resolve → gate → cosign cycle takes 60+ min minimum; by the time cosigns land,
  upstream has moved enough to invalidate the parent.
- The freeze-as-proof-base decision is a tactical workaround, not a strategic solution. It works
  because PROOFS validate runtime behavior, but it leaves a parent-freshness debt at force-push time.

`#707` automates the daily probe: rebase nightly, push if clean, fail-loud + Discord ping if
conflicts. That converts the treadmill from a 30+h-per-cycle manual lift into a 0–5min-per-day
ambient cost. The freeze workaround remains available when needed; #707 ensures the freeze base
is at most 24h stale rather than however-many-hours-the-current-cycle-took.

### Provenance

- probe worktree: `/tmp/oc-cure13-conflict-class/probe`
- probe SHA-base: `718d8558eb618304b5cc43c8a3b5d93ff5bef454`
- probe target (current at probe time): `c49d909b60a68999a3df28b56524a00c6e7cbbb2`
- Discord references: `1505935105…` (first stale-flag), `1505940421…` (full conflict analysis), `1505946352…` (🩸 ask)

— Ronan 🌊
