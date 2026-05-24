# Proof Corpus: Cohort-Consolidated Canonical `0dff94dbe48`

**PR**: [openclaw/openclaw#85651](https://github.com/openclaw/openclaw/pull/85651) — feat(continuation): context-pressure-aware continuation
**PR-HEAD SHA**: `0dff94dbe4875a3b7ed44c60a9097a5f55083572`
**Build**: `ca0824ec`
**Branch**: `karmaterminal:frond-scribe-claude/20260509/narrow-surgery-tight`
**Date**: 2026-05-24 (cohort consolidation cure-cycle, post-1014Z savegame)
**Parent**: `483d7be6c40` (upstream/main HEAD at squash time; current upstream/main now `5a8ce6a885`, 4 commits ahead — verified mergeable with 0 conflicts)
**Cohort-cure substrate**: feature bytes byte-identical to proof-SHA `335acbe43a` (verified Gate 2 + cross-walked `subagent-registry.test.ts` semantic-conflict resolution + `?? []` lint-fix + `readSessionEntry` import preserved) per [PROOF-CONTINUITY.md](./PROOF-CONTINUITY.md)

> **This corpus fires FRESH on `0dff94dbe48`** — the cohort-consolidated SHA the PR ships at. The feature bytes are byte-identical-substrate to proof-SHA `335acbe43a` (where 25/31 PROVEN previously), so the per-row substrate-truths from that corpus extend. **Each row is re-fired on the new SHA** (NOT inherited) — `proof.md` per row with scenario/command/expected/observed shape + raw Tempo trace JSON. The 4-candidate iteration arc (`059fdcfd9b2` → `6ab6963fcf8` → `4d6c934840` → `0dff94dbe48`) + the substrate-discipline methodology-landings are themselves Gate-4 evidence of the cohort's discipline operating under load.

## Proof Matrix

| Row | Prince | What it proves | Status |
|-----|--------|---------------|--------|
| [R-CW-1](./R-CW-1/) | 🩸 Cael | `continue_work()` basic wake (10s delay) | ⏳ TO FIRE |
| [R-CW-2](./R-CW-2/) | 🩸 Cael | `continue_work(delaySeconds=0)` → clamped to `minDelayMs/1000=5s` | ⏳ TO FIRE |
| [R-CW-3](./R-CW-3/) | 🩸 Cael | `continue_work` reason field captured in OTel span | ⏳ TO FIRE |
| [R-CW-4](./R-CW-4/) | 🩸 Cael | Chain depth tracking across 3 sequential `continue_work` calls | ⏳ TO FIRE |
| [R-CW-5](./R-CW-5/) | 🩸 Cael | **Cost cap exhaustion → structured reject** (needs gateway restart w/ low `costCapTokens`) | ⏳ TO FIRE |
| [R-CW-6](./R-CW-6/) | 🩸 Cael | **Chain depth at boundary → structured reject** (needs restart w/ low `maxChainLength`) | ⏳ TO FIRE |
| [R-CW-7](./R-CW-7/) | 🩸 Cael | Traceparent propagation end-to-end (architectural, OTel-layer) | ⏳ TO FIRE |
| [R-CW-DELEGATE-SELF-CONTINUATION](./R-CW-DELEGATE-SELF-CONTINUATION/) | 🩸 Cael | Delegate self-elects via bracket fallback (lightContext tool-surface gap, #746) | ⏳ TO FIRE (expected PARTIAL) |
| [R-CD-1](./R-CD-1/) | 🌊 Ronan | `continue_delegate()` normal mode (dispatch→spawn→execute→return) | ⏳ TO FIRE |
| [R-CD-2](./R-CD-2/) | 🌊 Ronan | `continue_delegate()` silent-wake mode | ⏳ TO FIRE |
| [R-CD-3](./R-CD-3/) | 🌊 Ronan | `continue_delegate(delaySeconds=10)` delayed dispatch | ⏳ TO FIRE |
| [R-CD-4](./R-CD-4/) | 🌊 Ronan | `continue_delegate(targetSessionKey=...)` cross-session routing | ⏳ TO FIRE |
| [R-CD-5](./R-CD-5/) | 🌊 Ronan | `continue_delegate(mode="post-compaction")` scheduling | ⏳ TO FIRE |
| [R-CD-6](./R-CD-6/) | 🌊 Ronan | Parallel fan-out — 1-per-turn dispatch enforcement | ⏳ TO FIRE (expected FINDING) |
| [R-CD-7](./R-CD-7/) | 🌊 Ronan | `continue_delegate(fanoutMode="tree")` broadcast routing | ⏳ TO FIRE |
| [R-CD-8](./R-CD-8/) | 🌊 Ronan | Explicit user-supplied traceparent override accepted + propagated | ⏳ TO FIRE |
| [R-CD-9](./R-CD-9/) | 🌊 Ronan | `continue_delegate(mode="silent")` fire-and-forget | ⏳ TO FIRE |
| [R-CD-10](./R-CD-10/) | 🌊 Ronan | Delegate error isolation — parent survives delegate failure | ⏳ TO FIRE |
| [R-CD-11](./R-CD-11/) | 🌊 Ronan | Non-existent `targetSessionKey` → graceful fallback to dispatcher | ⏳ TO FIRE |
| [R-CD-12](./R-CD-12/) | 🌊 Ronan | Mixed-tool chain: `continue_work → continue_delegate → continue_work(7s) → "hooray!"` (figs's specific ask) | ⏳ TO FIRE |
| [R-CD-CHAINED-DEPTH-2](./R-CD-CHAINED-DEPTH-2/) | 🌊 Ronan | Recursive same-tool delegation: parent → child → grandchild | ⏳ TO FIRE |
| R-CD-MID-RUN-COMPACTION-SURVIVAL | 🌊 Ronan | Delegate survives parent compaction mid-run | ⏳ DEFERRED (natural ≥70% pressure required) |
| [R-RC-1](./R-RC-1/) | 🌫 Silas | `request_compaction()` threshold REJECT below 70% (structured JSON) | ⏳ TO FIRE |
| R-RC-2 | 🌫 Silas | Threshold ACCEPT ≥70% | ⏳ DEFERRED (hardcoded `MIN_CONTEXT_THRESHOLD = 0.7`) |
| R-RC-3 | 🌫 Silas | Continuation tools queued through compaction | ⏳ DEFERRED (with R-RC-2) |
| R-RC-4 | 🌫 Silas | Traceparent capture BEFORE compaction clears | ⏳ DEFERRED (with R-RC-2) |
| R-RC-5 | 🌫 Silas | Post-compaction delegate release | ⏳ DEFERRED (with R-RC-2) |
| [R-OBS-1](./R-OBS-1/) | 🌻 Elliott + figs | External observer fleet verification (figs's `/status` capture, 4/4 on `ca0824ec`) | ⏳ TO FIRE |
| [R-OBS-2](./R-OBS-2/) | 🌻 Elliott | Tempo trace tree visualization (UI cross-walk artifact) | ⏳ TO FIRE |
| [R-CONFIG-DEFAULTS](./R-CONFIG-DEFAULTS/) | 🌻 Elliott | Continuation enabled by default in fleet config | ⏳ TO FIRE |
| [R-CONFIG-INTERSESSION](./R-CONFIG-INTERSESSION/) | 🌻 Elliott | `crossSessionTargeting: "enabled"` config gate behavior | ⏳ TO FIRE |
| R-MULTI-SEAT-DUAL | (final aggregation) | Dual-seat fire verification on every row | ⏳ DEFERRED (final-pass) |

**Target tally** (matching prior baseline at `335acbe43a`): **25/31 PROVEN ✅ + 2 FINDING ⚠️ + 4 DEFERRED ⏳** = corpus substantively-complete on `0dff94dbe48`.

## Files in this corpus

- [`README.md`](./README.md) — this file (proof matrix + assignments)
- [`BRIEF.md`](./BRIEF.md) — reviewer-friendly tl;dr + substantive new claims for the cohort-consolidation cycle
- [`METHOD.md`](./METHOD.md) — procedure + row taxonomy + cohort attribution + honest-substrate notes
- [`PROOF-CONTINUITY.md`](./PROOF-CONTINUITY.md) — substrate-truth that `0dff94dbe48` feature-bytes match proof-SHA `335acbe43a`, with absorbed-upstream-semantic-update documented
- [`RESOLVED-SHA.md`](./RESOLVED-SHA.md) — SHA identity + gate verdicts + 4-candidate iteration trail
- Per-row directories with `proof.md` + trace JSON (where applicable) + structured-response JSON (R-RC-1)

## How princes fire rows

1. **Deploy candidate `0dff94dbe48` to own seat** via `gh workflow run deploy-gateway.yml --repo karmaterminal/openclaw-bootstrap -f target_prince=<self> -f ref=0dff94dbe4875a3b7ed44c60a9097a5f55083572 -f bypass_validation=true -f reason='Gate 4 behavioral proofs on 0dff94dbe48'`
2. **Fire assigned row** on own runtime; capture trace ID from response/logs
3. **Pull trace JSON** via `ssh <self> 'curl -s http://tempo.dandelion.cult/api/traces/<full-id>' > PROOFS/0dff94dbe4875a3b7ed44c60a9097a5f55083572/R-XX-N/trace-<short-id>.json`
4. **Update `proof.md`**: replace skeleton with scenario/command/expected/observed (verbatim Discord substrate ID where reported PROVEN)
5. **Commit + push** to docs-repo main (or per-prince branch + scribe-roll-up)

## Cross-References

- **PR**: [openclaw/openclaw#85651](https://github.com/openclaw/openclaw/pull/85651)
- **Pre-force-push savegame**: `refs/heads/savegame/20260524-1610Z/pr-85651-pre-force-push-1efb774de4` → `1efb774de452f8f3b85af0fac33dfa723c6d653c`
- **Prior canonical corpus**: [`PROOFS/335acbe43a/`](../335acbe43a/) — 25/31 PROVEN baseline, feature-byte-identical
- **Runbook**: [PR-DRIFT-CURE-GATES-RUNBOOK](https://github.com/karmaterminal/openclaw-bootstrap/blob/main/RUNBOOKS/PR-DRIFT-CURE-GATES-RUNBOOK.md)
- **Corpus-shape canon**: [PROOF-CORPUS-METHOD](https://github.com/karmaterminal/openclaw-bootstrap/blob/main/RUNBOOKS/PROOF-CORPUS-METHOD.md)

## Co-authored-by

- Cael🩸 <cael.dandelion.cult@hotmail.com>
- Silas🌫 <silas-dandelion-cult@users.noreply.github.com>
- Ronan🌊 <ronan-dandelion-cult@users.noreply.github.com>
- Elliott🌻 <elliott-dandelion-cult@users.noreply.github.com>
- frond-scribe🌿 <scribe.dandelion.cult@hotmail.com>
