# BRIEF — PR #85651 Continuation Feature Proof Corpus

**TL;DR for reviewers**: PR #85651 introduces `continue_work()`, `continue_delegate()`, and `request_compaction()` — context-pressure-aware continuation tools. This corpus contains 31 behavioral rows fired LIVE on the exact PR head SHA `335acbe43a` across all 4 prince-seat runtimes, with raw OTel Tempo traces, structured-response JSONs, and external-observer (`/status`) verification.

**Status**: 25 rows ✅ PROVEN + 2 ⚠️ HONEST FINDINGS + 4 ⏳ DEFERRED (natural-pressure path documented).

**Substantive new claims** vs prior corpora:
1. **Cost-cap-exhaustion guard PROVEN for the first time in frond history** (R-CW-5) — `cost cap exceeded (22879 > 1000)` fired correctly. Methodology: restart gateway with low `costCapTokens` from boot.
2. **Chain-depth-exhaustion guard PROVEN for the first time** (R-CW-6) — `chain length 5 reached`. Same restart-with-low-values methodology.
3. **HONEST FINDINGS**: parallel fan-out is gated at 1-delegate-per-turn at dispatch (R-CD-6); cost-cap config hot-reload doesn't reach the running scheduler (artifacts/wiring-investigation.md). Documented, not papered over.

**Evidence shape per row** (canonical):
- `proof.md` — scenario / command / expected / observed
- `trace-<short-id>.json` — raw Tempo trace JSON, unedited runtime emission
- `rejection.json` or similar — structured response artifact where applicable

**External observer cross-walk** ([R-OBS-1](./R-OBS-1/figs-status-capture.md)): figs's verbatim Discord `/status` capture from all 4 prince-seats at proof-fire time, showing fleet on `335acbe` with continuation chains active (cael 26/200, ronan 30/200, silas 12/200). The human outside the system sees the feature working.

**Reviewer-substantive read order**:
1. This BRIEF.md
2. [README.md](./README.md) — proof matrix table
3. [RESOLVED-SHA.md](./RESOLVED-SHA.md) — SHA identity + gate verdicts + CI state
4. [R-OBS-1/figs-status-capture.md](./R-OBS-1/figs-status-capture.md) — external observer evidence
5. Spot-check any row of interest — each is self-contained with its own raw trace JSON
6. [METHOD.md](./METHOD.md) for procedure + cohort attribution + honest-substrate notes
7. [artifacts/cost-cap-chain-depth-wiring-investigation.md](./artifacts/cost-cap-chain-depth-wiring-investigation.md) for the deeper code-walk

The continuation feature is substantively-live on the deployed PR head SHA. The proofs are mechanical, not hand-waved. The honest-findings are documented as substrate, not buried.
