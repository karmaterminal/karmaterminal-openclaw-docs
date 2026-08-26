# Continuation acceptance matrix

This is the machine-enforced boundary between the original continuation
feature acceptance method and later fleet communication-health research.

The current catalog preserves 41 row records and all historical evidence. Only
38 rows are continuation acceptance requirements. Three telemetry contracts
remain visible as supplemental/future work and retain their `missing` state.

## Provenance

| Event | Exact commit / issue | Meaning |
|---|---|---|
| Telemetry contracts introduced | `5a061227cbb438572bc9aecdb1dbc902dc585452`, merged by `karmaterminal/karmaterminal-openclaw-docs#512` from `karmaterminal/openclaw#1254` | Added all four cross-cutting contracts to the docs catalog. It explicitly published contracts, not product instrumentation or PASS evidence. |
| Contracts promoted into acceptance | `de315e25aad6871e51341de7916c7383fa3d06a7` | The c3a corpus put all four rows into both `required_rows` and `dispatch_allocation`. The commit referenced docs #514, but that issue owns separate proof-harness authority repairs; it is not provenance for making fleet telemetry research a continuation acceptance requirement. |
| Required set copied forward | `86b39d87e0ae4eef980496d3742e83033ee84a93`, then `d075d3b445cdd238a44d69dc55b057829483e9e9` | The 41-row required set moved through the 80311 and 4737 corpora without a typed supplemental distinction. |
| Backend integrity implemented | `3619675c2832f838874db044fa5ce6c3fd0aa60a`, docs #517 | Implemented `backend-status.json`, Tempo/Loki disposition, PASS withholding, and candidate-envelope checks. This is harness integrity and remains required. |
| Correction basis | `45cf1ae59ba0f32031a90dde193fe2d48d494e25` | Contains the backend implementation and the rejected 41-required-row matrix. |

The read-only final-presentation corpus at docs ref
`c083eae1cb6b52c5e50f75d785a039c332172aca`
(`PROOFS/aff9807b34ba2ee4e7bcfd7081ee623c64a219a2/`) remains historical input.
Its evidence is not rewritten here; a final corrected corpus can be generated
and folded later.

## Classification

| Collection | Rows | Acceptance meaning |
|---|---|---|
| Required | 38, as ordered in `continuation-acceptance-policy.json::required_rows` | Exactly-once dispatch and semantic acceptance arithmetic. Includes `R-OBS-BACKEND-DISPOSITION`. |
| Supplemental/future | `R-OBS-CONT-PROVENANCE`, `R-OBS-PROOF-MARKER`, `R-OBS-TERMINAL-OUTCOME` | Product telemetry research from `karmaterminal/openclaw#1254`. Visible, unallocated, excluded from required arithmetic, and still `missing`. |

`R-OBS-BACKEND-DISPOSITION` differs from the other three because it protects the
proof harness itself. A Tempo or Loki HTTP 200 with zero results and no
completeness metadata cannot masquerade as complete evidence. Removing that row
would weaken evidence integrity, so it remains required. Its acceptance is
two-level: backend status and count authority remain exactly as observed, while
the row may PASS when a partial/capped disposition is valid, non-authoritative,
public-safe, receipt-complete, and rebind-complete. Unknown/unavailable status,
failed queries, missing/invalid receipts, contradictory authority, unsafe data,
or incomplete rebind remain non-PASS.

## Machine shape

`tools/k6-proofs/continuation-acceptance-policy.json` is the canonical typed
classification. A corrected `proofs-manifest.json` contains:

- `required_rows`: the exact 38-row ordered set;
- `supplemental_rows`: three typed objects with classification, missing state,
  issue, introduction commit, and catalog PR;
- `dispatch_allocation`: every required row exactly once, no supplemental row;
- `rows[]`: all 41 evidence records, unchanged;
- `rollup`: all 41 catalog/history records;
- `acceptance.required_rollup`: required rows only;
- `supplemental_rollup`: supplemental rows only;
- `acceptance.target_rollup`: 37 PASS plus one `R-RC-2` honest limit;
- `acceptance.honest_limit_receipts.R-RC-2`: the structured
  `request_compaction` context-threshold receipt.

The validator rejects duplicate IDs, overlap, unclassified rows, rows silently
dropped from either collection, missing or duplicate dispatch assignments,
supplemental allocation, a supplemental missing row claiming PASS, an
`honest_limit` on any row other than `R-RC-2`, and an unverified R-RC-2
honest-limit receipt.

## Generation and validation

Generate a corrected manifest from historical input plus its allocation source:

```bash
node tools/k6-proofs/scripts/generate-continuation-acceptance-matrix.mjs \
  --input <historical-proofs-manifest.json> \
  --allocation-from <manifest-with-exactly-once-allocation.json> \
  --honest-limit-receipt R-RC-2=<repo-relative-structured-run-result.json> \
  --output <successor-proofs-manifest.json> \
  --summary
```

Validate structural integrity without inventing acceptance:

```bash
node tools/k6-proofs/scripts/validate-corpus.mjs --current
```

Require the semantic target only when the reviewed successor evidence is ready:

```bash
node tools/k6-proofs/scripts/validate-corpus.mjs \
  --current \
  --require-acceptance
```

An incomplete historical corpus may pass structural validation while reporting
`acceptance.complete=false`. It must fail `--require-acceptance`; open required
rows are never converted to PASS to make the command green.

## ClawSweeper navigation

ClawSweeper reads `PROOFS/INDEX.json` only to locate the current manifest. It
then uses the manifest's `required_rows`, `dispatch_allocation`, and
`acceptance.required_rollup` for acceptance. It displays
`supplemental_rows`/`supplemental_rollup` separately and may inspect their
unchanged row evidence, but it must not add them to the denominator.
