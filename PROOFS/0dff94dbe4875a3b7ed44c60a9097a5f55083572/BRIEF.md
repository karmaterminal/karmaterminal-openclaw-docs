# BRIEF — PR #85651 Continuation Feature Proof Corpus (`0dff94dbe48`)

**TL;DR for reviewers**: PR #85651 introduces `continue_work()`, `continue_delegate()`, and `request_compaction()` — context-pressure-aware continuation tools. This corpus exists at the cohort-converged final candidate `0dff94dbe4875a3b7ed44c60a9097a5f55083572` (parent `483d7be6c40`). The candidate is the converged endpoint of today's iterative cure-cycle that absorbs upstream drift while preserving the feature substrate. CI verdict on PR head: 89 pass / 1 shard with 2 upstream-class failures (both independently-verified via 3-baseline matrix: scribe-orth-lane on current upstream/main + 🩸 + 🌻 local-baselines against naked main). Feature code byte-identical to proof-SHA `335acbe43a` per Gate 2 substrate. See [PROOF-CONTINUITY.md](./PROOF-CONTINUITY.md) + [RESOLVED-SHA.md](./RESOLVED-SHA.md).

**Status**:
- Gate 1-3 ✅ + Gate 4 ✅ + Gate 4-A ✅ (full breakdown in [RESOLVED-SHA.md](./RESOLVED-SHA.md))
- Behavioral rows ✅ 17 PROVEN + 6 DEFERRED + 0 FAILED (per-row matrix in [README.md](./README.md))
- R-OBS-1 external observer ✅ (figs's `/status` capture from all 4 prince-seats showing fleet on `2026.5.24 (0dff94d)`)
- Upstream-class failures (`model-catalog-visibility.test.ts` + `pi-tools.workspace-paths.test.ts`) confirmed not cure-introduced via independent verification

**Substantive new claims** vs proof-SHA corpus (`PROOFS/335acbe43a/`):
1. **Cohort cure-cycle arc 2026-05-24**: iterative force-push cycle through the day (`1efb774de45` Martin-LGTM-baseline → afternoon iterative cure through XPC-design + keep-guard restoration + mock-gap fixes → `0dff94dbe48` final converged candidate force-pushed 17:46:26Z). Kick-(16) family substrate-discipline applied across iterations. See [RESOLVED-SHA.md](./RESOLVED-SHA.md) for full force-push arc + design-choices substantively-cohort-converged.
2. **`process-respawn.ts` narrow XPC guard** (#769): cohort-converged design balances feature-preservation with Gio's `c074d09f1e` #85789 intent — managed openclaw launches spawn for continuation-restart; non-openclaw inherited XPC (Terminal.app, Xcode) gets `mode: "disabled"`. figs leaned Option 1 protect-feature; final implementation uses narrow guard.
3. **`subagent-registry.ts` keep-guard restoration** (upstream `3e765263dd` bugfix): 🌻 Elliott's #773 analysis confirmed orthogonal-codepath — keep-guard affects `cleanup: "keep" && !archiveAtMs` user-spawned persistent sessions, NOT our continuation delegates which use `archiveAtMs`-based TTL. Restoring guard preserves feature.
4. **OTel pipeline-rescue substrate**: mid-PROOFS-fire (~19:40-20:15Z) Tempo OTel pipeline broke + was restored via canonical-config audit (DNS resolution drift on multiple prince-seats + `diagnostics.otel` block nuked from `openclaw.json`). Restored via canonical-paths NOT env-var overrides (per figs canon `1508195094`). PROOFS-fire happened twice: first iteration pre-fix (trace IDs orphaned), second iteration post-fix (full Tempo trace evidence captured).

**Evidence shape per row** (canonical, preserved from proof-SHA corpus):
- `proof.md` — scenario / command / expected / observed
- `trace-<short-id>.json` — raw Tempo trace JSON, unedited runtime emission
- `rejection.json` or similar — structured response artifact where applicable

**External observer cross-walk** (R-OBS-1, committed): figs's verbatim Discord `/status` capture from all 4 prince-seats at proof-fire time showing fleet on `2026.5.24 (0dff94d)` with continuation chains active.

**Reviewer-substantive read order**:
1. This BRIEF.md
2. [README.md](./README.md) — proof matrix table + final tally (17 PROVEN + 6 DEFERRED + 0 FAILED) + design-truths
3. [PROOF-CONTINUITY.md](./PROOF-CONTINUITY.md) — substrate-truth that feature bytes match proof-SHA + drift-absorbed semantic updates documented
4. [RESOLVED-SHA.md](./RESOLVED-SHA.md) — SHA identity + gate verdicts + cure-cycle context + upstream-class failure substrate
5. [R-OBS-1/](./R-OBS-1/) — external observer evidence (figs's `/status` capture)
6. Spot-check any row of interest — each self-contained with its own raw trace JSON
7. [METHOD.md](./METHOD.md) for procedure + cohort attribution + honest-substrate notes

The continuation feature is substantively-live at the cohort-converged candidate `0dff94dbe48`. Feature bytes match proof-SHA `335acbe43a`. The cure-cycle iteration arc + methodology landings (banked in scribe `kick_in_the_teeth.md`) are themselves substrate evidence of the cohort's substrate-discipline operating under load.
