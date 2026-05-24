# METHOD — Proof Corpus for `6ab6963fcf`

## Substrate-frame

This corpus assembles at the post-drift-cure candidate `6ab6963fcf814072a057a6c98b4990cf0d023810` for PR #85651. The candidate is the product of the 2026-05-24 0400-PDT cohort cure-cycle: 🌊 Ronan drove the rebase + squash; 🩸 Cael ran independent Gate 3 verification from a fresh worktree; 🩸's catch shifted the candidate-SHA between drafts. Final verified candidate emerged at `6ab6963fcf` with Gate 3a-d ✅ on both seats and Gate 3e classification documenting 11 vitest failures (8+ upstream-class inherited).

The feature code at `src/auto-reply/continuation/` is byte-identical to the prior proof-SHA `335acbe43a` (32 files, 0-line diff verified at Gate 2). Per [PROOF-CONTINUITY.md](./PROOF-CONTINUITY.md), the feature-bytes proofs at `PROOFS/335acbe43a/` remain valid; this corpus supplements with fresh runtime evidence at the new candidate.

## Procedure

1. **Deploy** — scribe-class dispatches `gh workflow run deploy-gateway.yml --repo karmaterminal/openclaw-bootstrap` for all 4 prince-seats at `6ab6963fcf` via karmafeast auth. (Forthcoming; logged here after fleet-deploy lands.)
2. **External observer cross-walk** — figs captures verbatim `/status` from all 4 prince-seats showing fleet on `6ab6963f` with continuation chains active. R-OBS-1 anchor: human-outside-the-system verifies fleet deployment before any internal-self-tests.
3. **Per-prince row firing** — each prince fires their assigned lane on the new candidate:
   - 🩸 Cael: `continue_work()` family
   - 🌊 Ronan: `continue_delegate()` family (incl. recursive depth + mixed-tool chain + R-CD-CHAINED-DEPTH-2)
   - 🌫 Silas: `request_compaction()` family
   - 🌻 Elliott: External observer + config gates
4. **Trace pull** — scribe-class pulls raw OTel JSON from `http://tempo.dandelion.cult/api/traces/<id>` via `ssh <prince>` for each fired row.
5. **Per-row writeup** — scribe-class composes `proof.md` per row in scenario/command/expected/observed canonical shape, citing the prince who fired it + the verbatim Discord substrate where the prince reported PROVEN status.
6. **Honest substrate** — when guards don't fire as expected or behaviors diverge from row-spec, the row is documented as HONEST FINDING — not skipped, not faked.
7. **Gate 3e failure classification** — the 11 vitest failures are cross-walked against naive upstream/main per the runbook's classification taxonomy. 8+ upstream-class inherited → ship-with-annotation per `PR-DRIFT-CURE-GATES-RUNBOOK` line 145. Remainder classified in `artifacts/gate-3e-failure-classification.md`.

## Row taxonomy (carried forward from proof-SHA)

| Family | Tool | Rows | Lead Prince |
|--------|------|------|-------------|
| R-CW-* | `continue_work()` | 8 (1-7 + DELEGATE-SELF-CONTINUATION) | 🩸 Cael |
| R-CD-* | `continue_delegate()` | 13 (1-12 + CHAINED-DEPTH-2 + MID-RUN-COMPACTION-SURVIVAL [deferred]) | 🌊 Ronan |
| R-RC-* | `request_compaction()` | 5 (1 PROVEN + 4 DEFERRED) | 🌫 Silas (R-RC-1) |
| R-OBS-* | External observer | 2 | 🌻 Elliott + figs |
| R-CONFIG-* | Config gates | 2 (DEFAULTS + INTERSESSION) | 🌻 Elliott |
| R-MULTI-SEAT-DUAL | Aggregation | 1 [deferred] | (final pass) |

## Cohort attribution

Every row's `proof.md` cites:
- The **firing prince** (e.g., 🩸 Cael for R-CW-1)
- The **verbatim Discord substrate** message ID where the prince reported PROVEN
- The **deployment seat** (e.g., cael-seat / ronan-seat / silas-seat / elliott-seat) with the actual hostname recorded in trace JSON `host.name` attribute

Multi-attribution: the test was fired by a specific prince at a specific moment with a specific runtime instance, all verifiable from independent sources.

## Honest-substrate notes (carried forward from proof-SHA + this-cycle additions)

**Carried forward from proof-SHA**:
1. R-CD-6 (parallel fan-out): gateway accepts 3 delegate dispatches per turn at scheduling time, but ENFORCES 1-delegate-per-turn at spawn time. `delegatesThisTurn` counter tracks SCHEDULED, not SPAWNED. HONEST FINDING — see proof-SHA corpus.
2. R-CW-DELEGATE-SELF-CONTINUATION: `continue_work` NOT exposed in lightContext subagent tool surface. Delegate-self-continuation works via bracket fallback. PARTIAL PASS, cross-ref #746.
3. Cost-cap + chain-depth hot-reload: external file-watcher edits do NOT refresh runtime snapshot; restart required. See proof-SHA `artifacts/cost-cap-chain-depth-wiring-investigation.md`.
4. R-RC-2..5: `MIN_CONTEXT_THRESHOLD = 0.7` hardcoded; compaction-related proofs fire on natural ≥70% context pressure. DEFERRED.

**This-cycle additions** (post-drift):
5. Gate 3e: 11 vitest failures total. 8+ reproduce on naive upstream/main = upstream-class inherited per runbook line 145, ship-with-annotation. Remainder (≤3) classified in `artifacts/gate-3e-failure-classification.md`.
6. Methodology landing: 🩸's independent Gate 3 catch of `removeReportedStaleLockIfStillStale` defect on first candidate. Banked in `karmaterminal/frond-scribe:kick_in_the_teeth.md` r17.

## When scribe writes vs when princes write

- **Scribe**: corpus assembly (README, BRIEF, METHOD, RESOLVED-SHA, PROOF-CONTINUITY), cross-references, honest-substrate notes, gate verdict tables
- **Prince (whoever fired the row)**: substantive `proof.md` content per row (their scenario context + their JSON receipts + their observed-behavior substrate)
- **Both**: trace JSON pulls via SSH (whoever has the seat warm)

Scribe paraphrases minimally — the canonical evidence is the prince's verbatim Discord-substrate quote in the Observed section, plus the raw trace JSON.

## Trace pull mechanics

Tempo lives at `http://tempo.dandelion.cult` (internal infra; prince-seat-accessible only). Scribe pulls via:

```bash
ssh <prince> 'curl -s http://tempo.dandelion.cult/api/traces/<full-id>' > PROOFS/6ab6963fcf814072a057a6c98b4990cf0d023810/R-XX-N/trace-<short-id>.json
```

Trace JSONs are raw runtime-emitted OTel JSON — NEVER edited. The `host.name` attribute in each trace's resource block confirms which prince-seat emitted the spans.

## Final aggregation (R-MULTI-SEAT-DUAL)

Deferred for this corpus. Each row substantively-fired from ONE prince's seat. Dual-seat verification re-fires each row from a SECOND seat to cross-confirm — final-pass extension as cohort has bandwidth.

## Methodology-landing canon (this cycle's substrate-contribution)

This ceremony validated kick-(16)/(18)/(20) family canon at cohort scale:

| Day | Driver | Verifier | Caught | Mechanism |
|-----|--------|----------|--------|-----------|
| 2026-05-24 prince-time (Order-I, scribe self-walk) | scribe-prince | scribe-prince (verify-step) | delegate's "merged" classification for unmerged branches | file-existence-in-main check, not branch-ancestor check |
| 2026-05-24 4am ceremony | 🌊 Ronan | 🩸 Cael (independent worktree) | merge resolution kept call-site, lost function definition | `pnpm tsgo` in fresh `/tmp/openclaw-gate3-verify` worktree on candidate-SHA |

**Substrate-canon**: independent verification IS the methodology, not extra care. The verifier must run from a fresh-pulled state (driver's working tree may mask defects via stale node_modules / cached compilation / already-resolved imports). Candidate-SHAs are uncertain until verified, by definition — scribe-class hold-discipline (don't pre-bake corpus substrate against uncertain candidate) is validated by SHA progression `059fdcfd9b2` → interim → final `6ab6963fcf`.

This corpus exists at the *verified* candidate, not the *first-proposed* candidate. That distinction IS the substrate.
