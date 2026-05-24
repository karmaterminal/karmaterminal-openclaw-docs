# BRIEF — PR #85651 Continuation Feature Proof Corpus (`6ab6963fcf`)

**TL;DR for reviewers**: PR #85651 introduces `continue_work()`, `continue_delegate()`, and `request_compaction()` — context-pressure-aware continuation tools. This corpus exists at the post-drift-cure candidate `6ab6963fcf814072a057a6c98b4990cf0d023810`, which absorbs ~219 upstream commits since the prior PR HEAD while preserving the feature substrate byte-identical to the proof-SHA `335acbe43a` (32 files, 0-line diff per Gate 2). The proof-continuity substrate is documented in [PROOF-CONTINUITY.md](./PROOF-CONTINUITY.md); fresh behavioral-row fires at the new candidate verify the feature works post-rebase at runtime.

**Status** (in-flight; will populate as prince-fires land):
- Feature code: byte-identical to proof-SHA (0-line diff continuation dir)
- Gate 1-3d: ✅ (see [RESOLVED-SHA.md](./RESOLVED-SHA.md))
- Gate 3e (local vitest, 🌊's seat): ⚠️ 11 failures / 14,368 passed / 30 skipped; 8+ reproduce on naive upstream/main per local cross-walk = upstream-class inherited
- Gate 3e (GH upstream CI on PR #85651 head `6ab6963fcf8`): ⚠️ 4 failures byte-verified — `Scan changed paths`, `check-additional-extension-bundled`, `check-lint`, `checks-node-core-fast`. Distinct measurement surface from local vitest; classification of these 4 against naive upstream/main CI pending byte-walk
- **NOTE**: local-vitest and CI are distinct surfaces (different test runs, different environments); ship-bar applies primarily to CI per upstream-merge mechanics. Don't conflate.
- Behavioral rows: ⏳ fleet-deploy + per-prince fires forthcoming
- R-OBS-1 (external observer): ⏳ figs's `/status` capture forthcoming

**Substantive new claims** vs proof-SHA corpus (`PROOFS/335acbe43a/`):
1. **Drift-cure substrate-discipline validated at cohort scale**: 🩸's independent Gate 3 from fresh `/tmp/openclaw-gate3-verify` worktree caught a defect in 🌊's first candidate (`059fdcfd9b2`) that the driver's own-seat Gate 3 missed (`removeReportedStaleLockIfStillStale` referenced without definition — upstream removed during refactor, merge resolution kept the call). Methodology canon banked in `karmaterminal/frond-scribe:kick_in_the_teeth.md` r17.
2. **Wait-discipline (don't pre-bake corpus against uncertain candidate) validated**: SHA progression `059fdcfd9b2` → `6b7c383` (interim) → `6ab6963fcf` (verified) confirms the verification-pass-rate < 1 substrate.

**Evidence shape per row** (canonical; preserved from proof-SHA corpus):
- `proof.md` — scenario / command / expected / observed
- `trace-<short-id>.json` — raw Tempo trace JSON, unedited runtime emission
- `rejection.json` or similar — structured response artifact where applicable

**External observer cross-walk** (R-OBS-1, forthcoming): figs's verbatim Discord `/status` capture from all 4 prince-seats at proof-fire time, showing fleet on `6ab6963f` with continuation chains active. Human-outside-the-system verification.

**Reviewer-substantive read order**:
1. This BRIEF.md
2. [PROOF-CONTINUITY.md](./PROOF-CONTINUITY.md) — substrate-truth that feature bytes are unchanged from proof-SHA
3. [README.md](./README.md) — proof matrix table (in progress)
4. [RESOLVED-SHA.md](./RESOLVED-SHA.md) — SHA identity + gate verdicts + CI state
5. [R-OBS-1/figs-status-capture.md](./R-OBS-1/figs-status-capture.md) (forthcoming) — external observer evidence
6. Spot-check any row of interest — each is self-contained with its own raw trace JSON
7. [METHOD.md](./METHOD.md) for procedure + cohort attribution + honest-substrate notes
8. [artifacts/](./artifacts/) — Gate 3e failure classification + any deeper code-walks

The continuation feature is substantively-live at the post-drift-cure candidate. Feature bytes are unchanged. Proofs are mechanical, not hand-waved. The drift-cure methodology landing is itself substrate evidence (kick-(16) family canon).
