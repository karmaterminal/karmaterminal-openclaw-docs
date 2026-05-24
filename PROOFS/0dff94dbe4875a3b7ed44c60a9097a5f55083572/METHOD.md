# METHOD — Proof Corpus for `0dff94dbe48`

## Substrate-frame

This corpus is assembled fresh on the cohort-converged final candidate `0dff94dbe4875a3b7ed44c60a9097a5f55083572` after the 2026-05-24 iterative cure-cycle (multiple force-pushes through the day converging on this final SHA — see [RESOLVED-SHA.md](./RESOLVED-SHA.md) for the full force-push arc + design-choices substantively-cohort-converged). PR #85651 ships as single-parent squash on `upstream/main`; this candidate does not chain to prior proof-SHAs (see [PROOF-CONTINUITY.md](./PROOF-CONTINUITY.md)). Cure-cycle absorbed substantive design choices: narrow XPC guard for `process-respawn.ts` per Gio's #85789 intent; `subagent-registry.ts` keep-guard restoration per upstream `3e765263dd` bugfix; `readSessionMessagesAsync` mock-gap fixes; lint fixes. **Each row is re-fired on `0dff94dbe48`** — corpus stands on its own per-row evidence.

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

## Honest-substrate notes (substantively-re-verified on `0dff94dbe48`)

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

## Methodology landings from the 2026-05-24 cure-cycle

- **figs canon `1508146201`**: only 🌊 force-pushes PR-presenting-branch; NO bypass-of-gates (banked at scribe-memory `feedback_force_push_only_ronan_no_bypass_gates`)
- **figs canon `1508147807`**: GH issues for substantive design decisions, not Discord chat (banked at `feedback_gh_issues_durable_substrate_not_discord_chat`)
- **figs canon `1508195094`**: audit canonical config before patching around it; central DNS not per-host hacks; restore canonical state via canonical-path (banked at `feedback_audit_canonical_config_before_patching_around`; surfaced when princes patched around Tempo outage with env-var overrides instead of restoring the nuked `diagnostics.otel` block in openclaw.json)
- **Optimistic-schedule + dispatch-time-reject pattern** (R-CW-5/6 design discovery): tool returns `{status: "scheduled"}` to the model; rejection fires at the system level when chain-depth/cost-cap exceeded
- **Traceparent is OTel-infrastructure-layer NOT prompt-visible payload** (R-CW-7 design clarification): W3C runtime-invariant trace-context propagator; trace continuity holds at the OTel layer, not as data the agent reads
- **Cohort-converged narrow XPC guard for #769** vs broader Option 2/3: balances feature-preservation with Gio's #85789 intent
- **`subagent-registry.ts` keep-guard restoration is orthogonal-codepath** to continuation feature (🌻's #773 analysis): keep-guard affects `cleanup: "keep" && !archiveAtMs` user-spawned persistent sessions, NOT our continuation delegates
- **Force-push-first / proofs-second order** for the substrate-shape where the new squash + the prior cycle's squash converge on substantively-same feature bytes (drift-avoidance heuristic; not a continuity-chain claim)
- **scribe-orth-lane (independent-verification on current upstream/main HEAD)**: parallel-cure-and-verification lane against rebased candidate on current upstream HEAD `ad71a998ff`; pi-tools cure committed at `a00bbf285a`; substrate confirmed upstream-class for 2 cited failures + surfaced next-drift-cure substrate (npm-install-env / code-mode / list-command / telegram)

## Final aggregation (R-MULTI-SEAT-DUAL)

Deferred for this corpus. Each row is substantively-fired from ONE prince's seat. Dual-seat verification would re-fire each row from a SECOND seat to cross-confirm. Final-pass extension when bandwidth permits.
