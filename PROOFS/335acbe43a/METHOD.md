# METHOD — Proof Corpus for `335acbe43a`

## Substrate-frame

This corpus was assembled over the night of 2026-05-22→2026-05-23 PDT, fresh from zero on PR #85651 head SHA `335acbe43a354486e74c684aaa2e2fe14e9aa8c6`. Per figs's substrate-directive: *"as if you've never run them before… because you haven't. because this is a new PR where proofs have never existed."* No inheritance from prior corpora.

## Procedure

1. **Deploy** — scribe-class dispatched `gh workflow run deploy-gateway.yml --repo karmaterminal/openclaw-bootstrap` for all 4 prince-seats at `335acbe43a` via karmafeast auth. All 4 deploys completed SUCCESS.
2. **External observer cross-walk** — figs captured verbatim `/status` from all 4 prince-seats showing fleet on `335acbe` with continuation chains active. This is the R-OBS-1 anchor — the human outside the system verifies fleet deployment before any internal-self-tests.
3. **Per-prince row firing** — each prince fires their assigned lane:
   - 🩸 Cael: `continue_work()` family (8 rows + bracket fallback for R-CW-DELEGATE)
   - 🌊 Ronan: `continue_delegate()` family (13 rows including recursive depth + mixed-tool chain)
   - 🌫 Silas: `request_compaction()` family (1 PROVEN; 4 DEFERRED due to hardcoded 70% threshold)
   - 🌻 Elliott: External observer + config gates (4 rows)
4. **Trace pull** — scribe-class pulled raw OTel JSON from `http://tempo.dandelion.cult/api/traces/<id>` via `ssh <prince>` for each fired row.
5. **Per-row writeup** — scribe-class composed `proof.md` per row in scenario/command/expected/observed canonical shape, citing the prince who fired it + the verbatim Discord substrate where the prince reported PROVEN status.
6. **Honest substrate** — when guards didn't fire as expected (R-CW-5 mid-flight attempt) or behaviors diverged from row-spec (R-CD-6 dispatch enforcement), the row is documented as HONEST FINDING — not skipped, not faked.

## Row taxonomy

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
- The **deployment seat** (e.g., cael-seat / ronan-seat) with the actual hostname recorded in trace JSON `host.name` attribute

This is multi-attribution: the test was fired by a specific prince at a specific moment with a specific runtime instance, all verifiable from independent sources.

## Honest-substrate notes

**Methodology substrate-canon banked tonight**: continuation cap enforcement (cost-cap, chain-depth) is read at chain-start, not per-call. Mid-flight config patches do NOT propagate to running chains. Correct test methodology: restart gateway with low values from boot; fresh chain reads + enforces them. Prior corpora deferred R-CW-5/R-CW-6 because this methodology wasn't yet substantively-banked.

**Substrate-findings preserved verbatim** (not papered over as PASS):

1. **R-CD-6 (parallel fan-out)**: gateway accepts 3 delegate dispatches per turn at scheduling time, but ENFORCES 1-delegate-per-turn at spawn time. `delegatesThisTurn` counter tracks SCHEDULED, not SPAWNED. HONEST FINDING — whether intended feature or regression needs code-walk follow-up.

2. **R-CW-DELEGATE-SELF-CONTINUATION (lightContext tool surface)**: `continue_work` is NOT exposed in the lightContext subagent tool surface (only `continue_delegate` is). Delegate-self-continuation works via bracket fallback `[[CONTINUE_WORK:...]]`. However, the delegate's lifecycle ends before the bracket-scheduled wake fires. Documented as PARTIAL PASS + cross-referenced to #746.

3. **Cost-cap + chain-depth hot-reload** (per `artifacts/cost-cap-chain-depth-wiring-investigation.md`): external file-watcher edits to `agents.defaults.continuation.*` do NOT refresh the runtime snapshot — they're classified under `{prefix:"agents", kind:"none"}` no-op rule in `config-reload-plan.ts:112-118`. Restart is required for boot-time application.

4. **R-RC-2..5 deferred**: `MIN_CONTEXT_THRESHOLD = 0.7` is hardcoded in `request-compaction-tool.ts` — NOT configurable. Acceptance proof + compaction-related proofs fire on natural ≥70% context pressure (next long session). Documented as DEFERRED (not faked PASS, not silently skipped).

## When scribe writes vs when princes write

- **Scribe**: corpus assembly (README, BRIEF, METHOD, RESOLVED-SHA), cross-references, honest-substrate notes
- **Prince (whoever fired the row)**: substantive `proof.md` content per row (their scenario context + their JSON receipts + their observed-behavior substrate)
- **Both**: trace JSON pulls via SSH (whoever has the seat warm)

Scribe paraphrases minimally — the canonical evidence is the prince's verbatim Discord-substrate quote in the Observed section, plus the raw trace JSON.

## Trace pull mechanics

Tempo lives at `http://tempo.dandelion.cult` (internal infra; prince-seat-accessible only). Scribe pulls via:

```bash
ssh <prince> 'curl -s http://tempo.dandelion.cult/api/traces/<full-id>' > PROOFS/335acbe43a/R-XX-N/trace-<short-id>.json
```

Trace JSONs are raw runtime-emitted OTel JSON — NEVER edited (no SHA substitution, no cleanup). The `host.name` attribute in each trace's resource block confirms which prince-seat emitted the spans.

## Final aggregation (R-MULTI-SEAT-DUAL)

Deferred for this corpus. Each row was substantively-fired from ONE prince's seat. Dual-seat verification would re-fire each row from a SECOND seat to cross-confirm. This is a final-pass extension that the corpus can be extended with as the cohort has bandwidth — the foundational substrate is the single-seat fire substantiated by raw traces.
