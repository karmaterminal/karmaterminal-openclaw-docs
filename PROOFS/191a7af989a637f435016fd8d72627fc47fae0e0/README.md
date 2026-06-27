# PROOFS / 191a7af989a637f435016fd8d72627fc47fae0e0

Behavioral proof corpus for the deployed assembly continuation candidate `191a7af989a637f435016fd8d72627fc47fae0e0`.

- **SHA**: `191a7af989a637f435016fd8d72627fc47fae0e0`
- **Short**: `191a7af989a6`
- **Branch**: `karmaterminal/openclaw:frond-scribe/20260624/assembly-continuation-followons`
- **Method**: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`
- **Status**: in progress; row owners are firing live proofs on deployed prince gateways.

## Gate and deploy state

| Surface | Result |
|---|---|
| Hosted drift gate `28294844687` | PASS: `FROZEN-STALE=0`, `MIXED-CLOBBER=0`, total 317 |
| `openclaw-local-ci` `28294845382` | PASS: 85,062 tests passed / 0 failed |
| Deploy | PASS: all six gateways live on `191a7af989` |
| Known caveat | Upstream moved after this green SHA; later drift is intended to be absorbed after proofs if it does not touch continuation surface. |
| Known unrelated live bug | Discord reply-session conflict matches upstream open `openclaw/openclaw#96936`; do not classify as deploy regression. |

## Corpus files

- `proofs-manifest.json` — in-progress row manifest and owner map.
- `RESOLVED-SHA.md` — SHA identity, deploy, and gate receipts.
- Row directories are named in `proofs-manifest.json`; owners should create/populate them with `EVIDENCE.md`, trace JSON, receipts, and honest-limit notes.

## Row-owner map

Current manifest rollup: `28 total / 19 pass / 1 partial / 4 honest_limit / 4 pending / 0 fail / 0 missing`.

| Row | Owner | State |
|---|---|---|
| R-CW-1 | Cael | pass |
| R-CW-3 | Cael + Emeric cross-walk | pass |
| R-CW-4 | Cael | pass |
| R-CW-5 | Cael | pass |
| R-CW-TOKEN | Cael | pass |
| R-CW-6 | Rune | pass |
| R-CW-7 | Rune | pass |
| R-CW-DELEGATE-SELF-CONTINUATION | Rune | pass |
| R-CW-DELEGATE-TOKEN | Rune | pass |
| R-CD-1 | Ronan + Elliott substitution | pass |
| R-CD-2 | Ronan + Silas fill-in canary | pass |
| R-CD-3 | Ronan | pending |
| R-CD-4 | Ronan | pending |
| R-CD-MODEL-DEFAULT | Ronan + Elliott substitution | pass (default-inheritance contrast) |
| R-CD-MODEL-TOOL | Ronan | honest_limit — grouped under `karmaterminal/openclaw#1103` |
| R-CD-MODEL-TOKEN | Ronan | honest_limit — grouped under `karmaterminal/openclaw#1103` |
| R-CD-MODEL-CHAINED-ALT | Ronan | honest_limit — grouped under `karmaterminal/openclaw#1103` |
| R-CD-TOKEN | Ronan | pending |
| R-CD-CHAINED-DEPTH-2 | Ronan + Rune + Silas + Emeric | partial |
| R-CD-CHAINED-DEPTH-2-TEST-1 | Emeric | pending |
| R-RC-1 | Silas | pass |
| R-RC-2 | Cael | honest_limit |
| R-OBS-1 | Elliott + figs external observer | pass |
| R-OBS-2 | Rune | pass |
| R-CONFIG-DEFAULTS | Emeric | pass |
| R-CONFIG-INTERSESSION | Emeric | pass |
| R-REGRESSION-TRAP-TESTS | Emeric | pass |

### Honest-limit grouping

The `4 honest_limit` entries represent two underlying blockers, not four unrelated proof gaps:

- `R-CD-MODEL-TOOL`, `R-CD-MODEL-TOKEN`, and `R-CD-MODEL-CHAINED-ALT` are one alternate-model override cluster blocked by `karmaterminal/openclaw#1103`. In the observed edge, the runtime accepts/applies-looking `github-copilot/goldeneye`, but the child context reports `github-copilot/gpt-5.5`; the unresolved root remains override ignored vs runtime context misreported vs silent fallback/alias normalization.
- `R-RC-2` is separate: the firing lane was below the `request_compaction` over-threshold accept condition, so the corpus records an honest limit rather than claiming an accept-leg pass.

## Assembly instructions

Princes should place row artifacts under `PROOFS/191a7af989a637f435016fd8d72627fc47fae0e0/<ROW>/<seat>/` where possible, with an `EVIDENCE.md` that names:

1. deployed runtime SHA/build byte,
2. command or prompt used,
3. observed behavior,
4. Tempo trace URL or exported trace JSON when applicable,
5. honest limits and any scoped bug encountered.

`PROOFS/INDEX.json` remains pointed at the last completed corpus until this proof set is filled and reviewed.


## Rune fill status (2026-06-27)

Fresh Rune rows on `191a7af989`:

| Row | State | Evidence |
|---|---|---|
| R-CW-6-BOUNDARY | ✅ PASS | `R-CW-6-BOUNDARY/rune-rog-ally/EVIDENCE.md` |
| R-CW-7-TRACEPARENT-E2E | ✅ PASS | `R-CW-7-TRACEPARENT-E2E/rune-rog-ally/EVIDENCE.md` + `trace-00000000000000000000000000000001-dispatch-tree.json` |
| R-CW-DELEGATE-SELF-CONTINUATION | ✅ PASS | `R-CW-DELEGATE-SELF-CONTINUATION/rune-rog-ally/EVIDENCE.md` + trace JSON |
| R-OBS-2 | ✅ PASS | `R-OBS-2/rune-rog-ally/EVIDENCE.md` + span-hierarchy JSON |

Manifest rollup after Rune fill was superseded by later folds; current rollup after Rune R-CW-DELEGATE-TOKEN fill is `28 total / 19 pass / 1 partial / 4 honest_limit / 4 pending / 0 fail / 0 missing`.


## Silas fill status (2026-06-27)

Silas filled one safe Ronan-owned row without touching `PROOFS/INDEX.json`:

| Row | State | Evidence |
|---|---|---|
| R-CD-2 | ✅ PASS-candidate | `R-CD-2/silas-lothric/EVIDENCE.md` + redacted k6 artifacts + nonce-only delegate return |

The fill-in proof is explicitly seat-scoped to Silas. It does not claim Ronan-local artifacts or unblock the remaining Ronan R-CD rows without their own receipts/Tempo exports.

## Elliott substitution fill (2026-06-27)

Elliott added substitution evidence for two Ronan-owned gaps while Ronan artifact rendering was blocked:

| Row | State | Evidence |
|---|---|---|
| R-CD-1 | ✅ PASS-candidate | `R-CD-1/elliott-legion/EVIDENCE.md` + Tempo JSON |
| R-CD-MODEL-DEFAULT | ✅ PASS-candidate | `R-CD-MODEL-DEFAULT/elliott-legion/EVIDENCE.md` + Tempo JSON |

These are substitution proofs on Elliott, not a claim that Ronan-local artifacts landed. Alternate-model rows remain honest-limited by `karmaterminal/openclaw#1103`; Ronan chained/delegate-token rows remain pending/partial until their artifacts are byte-verified.

## Emeric supplemental receipt (2026-06-27)

Emeric captured an additional default-inheritance tool-form receipt after Elliott had already filled `R-CD-MODEL-DEFAULT`. This is supplemental only; the manifest row remains anchored to Elliott's substitution proof.

| Row | State | Evidence |
|---|---|---|
| R-CD-MODEL-DEFAULT | supplemental receipt | `R-CD-MODEL-DEFAULT/emeric-nuc/EVIDENCE.md` + `tool-default-trace-00000000000000000000000000000012.json` |

## Rune R-CW-DELEGATE-TOKEN fill (2026-06-27)

Rune filled the remaining Rune-owned token row on the deployed `191a7af989` corpus:

| Row | State | Evidence |
|---|---|---|
| R-CW-DELEGATE-TOKEN | ✅ PASS | `R-CW-DELEGATE-TOKEN/rune-rog-ally/EVIDENCE.md` + subagent transcript excerpt + journal parse/wake log |

This proof is transcript+journal based: a lightContext subagent emitted bare `CONTINUE_WORK:5`, the journal parsed it as `kind=work` with `delayMs=5000`, the runtime delivered hop `1/200`, and the hop-2 transcript marker `TOKENBARE-HOP2-DROVE R-CW-DELEGATE-TOKEN-191a7af` landed. No Tempo JSON is filed for this row.
