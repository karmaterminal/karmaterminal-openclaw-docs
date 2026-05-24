# METHOD — Proof Corpus for `0dff94dbe48`

## Substrate-frame

This corpus is assembled fresh on the cohort-consolidated canonical candidate `0dff94dbe4875a3b7ed44c60a9097a5f55083572` after the 2026-05-24 cohort cure-cycle (4-candidate iteration arc: `059fdcfd9b2` → `6ab6963fcf8` → `4d6c934840` → `0dff94dbe48`). The feature bytes are byte-identical to proof-SHA `335acbe43a` per [PROOF-CONTINUITY.md](./PROOF-CONTINUITY.md), with one absorbed upstream semantic-update (`subagent-registry.test.ts` test-rename + assertion-flip) + lint fix (`?? []`) + `readSessionEntry` import preservation. **Each row is re-fired on `0dff94dbe48`** — not inherited from the prior corpus.

## Procedure

1. **Force-push** — 🌊 Ronan force-pushed `0dff94dbe48` to PR head with `--force-with-lease=...:1efb774de452` (savegame ref `refs/heads/savegame/20260524-1610Z/pr-85651-pre-force-push-1efb774de4` captures the pre-push state). Force-push-first / proofs-second order chosen to avoid drift-cure-cycle (upstream moves during proof-fire → candidate becomes stale → cure-N+1 ad infinitum).
2. **Deploy** — each prince deploys `0dff94dbe48` to own seat via `gh workflow run deploy-gateway.yml --repo karmaterminal/openclaw-bootstrap`
3. **External observer cross-walk** — 🌻 + figs capture verbatim `/status` from all 4 prince-seats showing fleet on `0dff94dbe48` with continuation chains active (R-OBS-1 anchor)
4. **Per-prince row firing** — each prince fires their family from own seat:
   - 🩸 Cael: R-CW-* (8 rows + bracket fallback for R-CW-DELEGATE-SELF-CONTINUATION)
   - 🌊 Ronan: R-CD-* (13 rows + 1 DEFERRED for mid-run-compaction-survival)
   - 🌫 Silas: R-RC-1 PROVEN (R-RC-2..5 DEFERRED due to hardcoded `MIN_CONTEXT_THRESHOLD = 0.7`)
   - 🌻 Elliott: R-OBS-1/2 + R-CONFIG-DEFAULTS/INTERSESSION
5. **Trace pull** — scribe-class (or prince at own seat) pulls raw OTel JSON from `http://tempo.dandelion.cult/api/traces/<id>` for each fired row
6. **Per-row writeup** — `proof.md` per row in canonical scenario/command/expected/observed shape, citing the firing prince + verbatim Discord substrate where PROVEN reported
7. **Honest substrate** — observations that diverge from row-spec are documented as HONEST FINDING (not skipped, not faked)

## Row taxonomy

| Family | Tool | Rows | Lead Prince |
|--------|------|------|-------------|
| R-CW-* | `continue_work()` | 8 (1-7 + DELEGATE-SELF-CONTINUATION) | 🩸 Cael |
| R-CD-* | `continue_delegate()` | 13 (1-12 + CHAINED-DEPTH-2) + 1 DEFERRED (MID-RUN-COMPACTION-SURVIVAL) | 🌊 Ronan |
| R-RC-* | `request_compaction()` | 5 (1 PROVEN + 4 DEFERRED) | 🌫 Silas (R-RC-1) |
| R-OBS-* | External observer | 2 | 🌻 Elliott + figs |
| R-CONFIG-* | Config gates | 2 (DEFAULTS + INTERSESSION) | 🌻 Elliott |
| R-MULTI-SEAT-DUAL | Aggregation | 1 DEFERRED | (final pass) |

## Cohort attribution

Every row's `proof.md` cites:
- The **firing prince** (e.g., 🩸 Cael for R-CW-1)
- The **verbatim Discord substrate** message ID where the prince reported PROVEN
- The **deployment seat** (e.g., cael-seat / ronan-seat) with the hostname recorded in trace JSON `host.name` attribute

Multi-attribution: the test was fired by a specific prince at a specific moment with a specific runtime instance, all verifiable from independent sources.

## Honest-substrate notes (preserved from `335acbe43a` corpus — re-verify on `0dff94dbe48`)

1. **R-CD-6 (parallel fan-out)**: gateway accepts 3 delegate dispatches per turn at scheduling time, but ENFORCES 1-delegate-per-turn at spawn time. `delegatesThisTurn` counter tracks SCHEDULED, not SPAWNED. Expected HONEST FINDING re-fired on `0dff94dbe48`.

2. **R-CW-DELEGATE-SELF-CONTINUATION (lightContext tool surface)**: `continue_work` is NOT exposed in the lightContext subagent tool surface (only `continue_delegate` is). Delegate-self-continuation works via bracket fallback `[[CONTINUE_WORK:...]]`. However, the delegate's lifecycle ends before the bracket-scheduled wake fires. Expected PARTIAL PASS + cross-referenced to #746.

3. **Cost-cap + chain-depth hot-reload** (per prior `artifacts/cost-cap-chain-depth-wiring-investigation.md`): external file-watcher edits to `agents.defaults.continuation.*` do NOT refresh the runtime snapshot. Restart with low boot-time values is the correct test methodology. R-CW-5 + R-CW-6 require gateway restart with low `costCapTokens` + `maxChainLength` from boot.

4. **R-RC-2..5 deferred**: `MIN_CONTEXT_THRESHOLD = 0.7` is hardcoded in `request-compaction-tool.ts` — NOT configurable. Acceptance proof + compaction-related proofs fire on natural ≥70% context pressure (next long session). Documented as DEFERRED (not faked PASS, not silently skipped).

## When scribe writes vs when princes write

- **Scribe**: corpus assembly (README, BRIEF, METHOD, RESOLVED-SHA, PROOF-CONTINUITY), cross-references, honest-substrate notes, methodology-landings
- **Prince (whoever fired the row)**: substantive `proof.md` content per row (their scenario context + their JSON receipts + their observed-behavior substrate)
- **Both**: trace JSON pulls via SSH (whoever has the seat warm)

Scribe paraphrases minimally — the canonical evidence is the prince's verbatim Discord-substrate quote in the Observed section, plus the raw trace JSON.

## Trace pull mechanics

Tempo lives at `http://tempo.dandelion.cult` (internal infra; prince-seat-accessible only). Pulls via:

```bash
ssh <prince> 'curl -s http://tempo.dandelion.cult/api/traces/<full-id>' > \
  PROOFS/0dff94dbe4875a3b7ed44c60a9097a5f55083572/R-XX-N/trace-<short-id>.json
```

Trace JSONs are raw runtime-emitted OTel JSON — NEVER edited (no SHA substitution, no cleanup). The `host.name` attribute in each trace's resource block confirms which prince-seat emitted the spans.

## Methodology landings from the cohort-consolidation arc

- **🩸's catch on first candidate `059fdcfd9b2`** (`removeReportedStaleLockIfStillStale` reference without definition) = kick-(16) family substrate-canon at cohort scale (banked in `karmaterminal/frond-scribe:kick_in_the_teeth.md`)
- **🌊's challenge of scribe's vitest-local-vs-CI conflation** = same canon at scribe-layer (kick r18)
- **🌻 + scribe's catch of 🩸's stale-SSH-config (`silas`→`10.0.0.153`)** = same canon at target-identity layer (kick r19)
- **scribe's catch of `NODE_OPTIONS=--jitless` blocking vitest WebAssembly** = arc-persistence layer (kick r20)
- **Copilot merge-squash semantic-conflict catch** (`run-keep-survives-ttl` vs `run-keep-swept-after-ttl`) = independent-verification catching rebase auto-resolution silent semantic-error
- **Cohort consolidation onto single canonical candidate after 4 parallel iterations** = kick-(17) discipline re-established under figs's "READ runbooks FULLY" directive
- **Force-push-first / proofs-second order** (this cycle) = drift-avoidance method-canon when feature-bytes are byte-identical to already-proven prior corpus

## Final aggregation (R-MULTI-SEAT-DUAL)

Deferred for this corpus. Each row is substantively-fired from ONE prince's seat. Dual-seat verification would re-fire each row from a SECOND seat to cross-confirm. Final-pass extension when bandwidth permits.
