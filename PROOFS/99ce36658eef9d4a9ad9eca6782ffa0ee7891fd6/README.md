# Supplementary proof corpus — `99ce3665` (`6b09` runtime composite)

**This corpus is SUPPLEMENTARY. It does not supersede the stronger bound corpus
`a7ef0317`, and `PROOFS/INDEX.json` is deliberately NOT repointed.**

## Identity and provenance

- **Published/pure continuation SHA:** `99ce36658eef9d4a9ad9eca6782ffa0ee7891fd6`
- **Runtime executed:** `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955`
- **Composite parents:** semantic-fix side `b5de30c6ffe068d26f6b18e416f8f4659088241f` and pure
  continuation `99ce36658eef9d4a9ad9eca6782ffa0ee7891fd6`
- **Harness docs ref:** `7ab525923833cbddffa5c75c22481fcbe9d12fe9`
- **Seat:** `cael`
- **Source workflow runs:** 31878888351, 31879446802, 31879999334, 31880178849

The runtime SHA and publication SHA differ deliberately. `6b09` contains the
separately reconstructed PR #121204 ingress/admission semantics needed to keep
the live proof seat usable; the continuation PR presents pure `99ce`. Git
ancestry verifies that pure `99ce` is a parent/ancestor of `6b09`.

## Why this corpus does not replace `PROOFS/INDEX.json`

The current bound corpus `a7ef0317` records 26 passes and zero failures. This
execution produced ten offline/static-reader failures because the immutable docs
snapshot at `7ab525923833` pointed those readers at prior corpus
`0921776150142c3fd8d517de5c73e1c94732f004` without carrying that corpus tree into the harness
snapshot. Those outcomes are proof-substrate failures, not observations of the
`6b09` runtime.

Among the **23 live proof rows**, there are no `FAIL-candidate`
outcomes. The live rollup is:

- validated PASS: 15
- PASS held for review receipts: 1
- PARTIAL: 7
- FAIL: 0

Repointing the current corpus would therefore degrade navigation and conflate
static-baseline packaging failures with runtime behavior. The never-regress rule
is satisfied by publishing this exact evidence as supplementary while leaving
the stronger index pointer unchanged.

## Execution shape

The workflow has a ten-minute ceiling, so the matrix was completed in four
serialized slices. Every emitted row artifact was copied byte-for-byte. There
are 35 artifact directories covering 34 unique rows
(33 proof rows plus `PREFLIGHT`); `R-CD-MODEL-TOOL` appears in two
slices because the first run reached the workflow ceiling during that row.

No artifact directories were emitted for the four orchestration-required rows:
`R-CW-5`, `R-CW-5A`, `R-CW-6`, `R-CW-6A`.

## Static-reader classification

These ten rows are offline/static corpus readers, not live gateway exercises:
`R-CD-COLLECTION-ON-COLLAPSE`, `R-CD-RETURN-OVERLAP`, `R-CW-7`, `R-CW-DELEGATE-CHILD-LIVE`, `R-CW-DELEGATE-TOKEN`, `R-CW-MULTI`, `R-CW-MULTI-COLLAPSE`, `R-OBS-2`, `R-REGRESSION-TRAP-TESTS`, `R-TRACE-REDACTION-1121`.

They attempted to read the `09217761` corpus selected by the
snapshot's `PROOFS/INDEX.json`. The required historical evidence files were not
present in the immutable harness tree, producing exit 99 threshold failures or
exit 107 file-open/evidence-redaction failures. Their raw receipts are preserved
without promoting them to product regressions.

## Row ledger

| Row | Surface | Verdict | Exit | Envelope | Classification | Source run |
| --- | --- | --- | ---: | --- | --- | --- |
| `PREFLIGHT` | live | `unclassified` | 0 | not validated | `unclassified` | 31878888351 |
| `R-CD-1` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31878888351 |
| `R-CD-2` | live | `PARTIAL-candidate` | 0 | not validated | `live-partial` | 31878888351 |
| `R-CD-3` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31878888351 |
| `R-CD-4` | live | `PARTIAL-candidate` | 99 | not validated | `live-partial` | 31878888351 |
| `R-CD-CHAINED-DEPTH-2` | live | `PARTIAL-candidate` | 99 | not validated | `live-partial` | 31878888351 |
| `R-CD-COLLECTION-ON-COLLAPSE` | static reader | `FAIL-candidate` | 99 | not validated | `static-proof-substrate-failure` | 31878888351 |
| `R-CD-MODEL-CHAINED-ALT` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31878888351 |
| `R-CD-MODEL-DEFAULT` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31878888351 |
| `R-CD-MODEL-TOKEN` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31878888351 |
| `R-CD-MODEL-TOOL` | live | `PARTIAL-candidate` | 99 | not validated | `live-partial` | 31878888351, 31879446802 |
| `R-CD-RETURN-OVERLAP` | static reader | `unclassified` | 107 | not validated | `static-proof-substrate-failure` | 31879446802 |
| `R-CD-SILENT` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31879446802 |
| `R-CD-TOKEN` | live | `PARTIAL-candidate` | 0 | not validated | `live-partial` | 31879446802 |
| `R-CONFIG-DEFAULTS` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31879446802 |
| `R-CONFIG-INTERSESSION` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31879446802 |
| `R-CW-1` | live | `PASS-candidate` | 0 | not validated | `live-pass-review-pending` | 31879446802 |
| `R-CW-2` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31879446802 |
| `R-CW-3` | live | `PARTIAL-candidate` | 0 | not validated | `live-partial` | 31879446802 |
| `R-CW-4` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31879446802 |
| `R-CW-7` | static reader | `FAIL-candidate` | 99 | not validated | `static-proof-substrate-failure` | 31879999334 |
| `R-CW-DELEGATE-CHILD-LIVE` | static reader | `FAIL-candidate` | 99 | not validated | `static-proof-substrate-failure` | 31879999334 |
| `R-CW-DELEGATE-SELF-CONTINUATION` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31879999334 |
| `R-CW-DELEGATE-TOKEN` | static reader | `FAIL-candidate` | 99 | not validated | `static-proof-substrate-failure` | 31879999334 |
| `R-CW-MULTI` | static reader | `FAIL-candidate` | 99 | not validated | `static-proof-substrate-failure` | 31879999334 |
| `R-CW-MULTI-COLLAPSE` | static reader | `FAIL-candidate` | 99 | not validated | `static-proof-substrate-failure` | 31879999334 |
| `R-CW-TOKEN` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31879999334 |
| `R-OBS-1` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31880178849 |
| `R-OBS-2` | static reader | `unclassified` | 107 | not validated | `static-proof-substrate-failure` | 31880178849 |
| `R-OBS-STATUS` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31880178849 |
| `R-RC-1` | live | `PASS-candidate` | 0 | validated | `live-validated-pass` | 31880178849 |
| `R-RC-2` | live | `PARTIAL-candidate` | 0 | not validated | `live-partial` | 31880178849 |
| `R-REGRESSION-TRAP-TESTS` | static reader | `unclassified` | 107 | not validated | `static-proof-substrate-failure` | 31880178849 |
| `R-TRACE-REDACTION-1121` | static reader | `FAIL-candidate` | 99 | not validated | `static-proof-substrate-failure` | 31880178849 |

## Publication disposition

- Raw public-safe artifacts are under each row's `cael/<run-id>/` directory.
- Per-slice harness reports and workflow logs are under `_source-runs/<run-id>/`.
- `proofs-manifest.json` is the machine-readable ledger.
- `METHOD.md` records the sliced execution and folding method.
- `RESOLVED-SHA.md` records pure/composite identity.
- `PROOFS/INDEX.json` remains unchanged on stronger corpus `a7ef03177e0f42831a087521e6eb7720102d6be1`.
