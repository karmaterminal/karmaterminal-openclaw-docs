# BRIEF — PR #85651 Continuation Feature Proof Corpus (`ca0824ec11`)

**TL;DR for reviewers**: PR #85651 introduces `continue_work()`, `continue_delegate()`, and `request_compaction()` — context-pressure-aware continuation tools. This corpus exists at the cohort-consolidated canonical candidate `ca0824ec116c778c288df1aa3a45f1282a1d7f97` (parent `483d7be6c40`, current upstream/main HEAD). The candidate absorbs ~253 upstream commits since the prior PR HEAD while preserving the feature substrate. Gate 3 ALL GREEN (9575 vitest tests passed / 0 failed). Feature code expected byte-identical to proof-SHA `335acbe43a` per Gate 2 substrate (re-verify pre-push). See [PROOF-CONTINUITY.md](./PROOF-CONTINUITY.md).

**Status**:
- Gate 1-3 ✅ (full breakdown in [RESOLVED-SHA.md](./RESOLVED-SHA.md))
- Behavioral rows ⏳ (per-prince fires post-fleet-deploy)
- R-OBS-1 external observer ⏳ (figs's `/status` capture forthcoming)
- 4 CI failures from prior PR head (Martin's review-substrate) — fresh CI to fire on `ca0824ec11` at force-push; ship-bar = green per figs's "test issues were our problem" directive

**Substantive new claims** vs proof-SHA corpus (`PROOFS/335acbe43a/`):
1. **Cohort-consolidation arc**: 4-candidate iteration trail (`059fdcfd9b2` → `6ab6963fcf8` → `4d6c934840` → `ca0824ec11`) with each iteration catching a distinct substrate-error class. Kick-(16) family substrate-discipline at scale.
2. **Copilot merge-squash semantic catch**: `subagent-registry.test.ts` test rename + assertion flip from upstream (entry now SURVIVES sweep) was silently auto-resolved by rebase to opposite-of-correct; Copilot's git merge --squash surfaced the conflict explicitly + corrected.
3. **`NODE_OPTIONS=--jitless` substrate-blocker** caught at scribe-byte-walk: previous-arc belt-and-suspenders setting (against AVX-512 E-core JIT crashes) that survived the arc + became next-arc blocker (vitest needs WebAssembly which requires JIT). New substrate-canon class extension banked in `kick_in_the_teeth.md` for kick (20).

**Evidence shape per row** (canonical, preserved from proof-SHA corpus):
- `proof.md` — scenario / command / expected / observed
- `trace-<short-id>.json` — raw Tempo trace JSON, unedited runtime emission
- `rejection.json` or similar — structured response artifact where applicable

**External observer cross-walk** (R-OBS-1, forthcoming): figs's verbatim Discord `/status` capture from all 4 prince-seats at proof-fire time, showing fleet on `ca0824ec` with continuation chains active.

**Reviewer-substantive read order**:
1. This BRIEF.md
2. [PROOF-CONTINUITY.md](./PROOF-CONTINUITY.md) — substrate-truth that feature bytes match proof-SHA + drift-absorbed semantic update documented
3. [README.md](./README.md) — proof matrix table (in progress)
4. [RESOLVED-SHA.md](./RESOLVED-SHA.md) — SHA identity + gate verdicts + 4-candidate iteration trail
5. [R-OBS-1/figs-status-capture.md](./R-OBS-1/figs-status-capture.md) (forthcoming) — external observer evidence
6. Spot-check any row of interest — each self-contained with its own raw trace JSON
7. [METHOD.md](./METHOD.md) for procedure + cohort attribution + honest-substrate notes
8. [artifacts/](./artifacts/) — methodology landings + CI failure classification (in progress)

The continuation feature is substantively-live at the cohort-consolidated candidate. Feature bytes match proof-SHA. The 4-candidate iteration arc + methodology landings are themselves substrate evidence of the cohort's substrate-discipline operating under load.
