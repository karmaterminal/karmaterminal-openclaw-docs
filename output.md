# PR #129388 proof-matrix provenance correction

Status: **complete; the matrix contract is corrected and machine-enforced.
The final evidence corpus fold remains intentionally separate.**

## Named-ref contract

The safe lane was published unchanged before any acceptance evidence was
credited. Applicable refs were resolved on 2026-08-26.

| Category | Named ref | Full SHA | Identity receipt |
|---|---|---|---|
| Product/base | `karmaterminal/karmaterminal-openclaw-docs@45cf1ae59ba0f32031a90dde193fe2d48d494e25` | `45cf1ae59ba0f32031a90dde193fe2d48d494e25` | local object = GitHub server commit |
| Safe lane | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proof-matrix-provenance` | `cb9e6a9b7248386bbdc79a7f91212fa2d3f4f0ae` reviewed code checkpoint | unchanged branch first published at `45cf1ae59ba0f32031a90dde193fe2d48d494e25`; code checkpoint local = tracking = server |
| CI/workflow | focused docs harness/catalog/validator tests; Mode-B N/A | N/A | N/A |
| Presentation | `openclaw/openclaw#129388`, head `codeagent/85651-upstream-1ba243c8-gates` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | GitHub PR head; read-only |
| Docs/proof | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proof-transpose-aff980` | `c083eae1cb6b52c5e50f75d785a039c332172aca` | local = tracking = server; existing aff corpus is historical input only |

Broad Mode-B is N/A for this docs-only lane. `PROOFS/INDEX.json`, docs `main`,
protected OpenClaw refs, and `openclaw/openclaw#129388` remain read-only.

## Outcome

The continuation corpus now has two machine-readable collections:

| Collection | Count | Rows / disposition |
|---|---:|---|
| Required acceptance | 38 | Includes `R-OBS-BACKEND-DISPOSITION`; every row is assigned exactly once in `dispatch_allocation`. |
| Supplemental/future | 3 | `R-OBS-CONT-PROVENANCE`, `R-OBS-PROOF-MARKER`, `R-OBS-TERMINAL-OUTCOME`; all remain `missing`, unallocated, and excluded from required arithmetic. |

All 41 historical `rows[]` records, row directories, evidence documents,
manifests, scenarios, issue links, and original states remain present. No
historical evidence was promoted to PASS. The current historical corpus reports:

| Rollup | total | pass | partial | thin | fail | honest_limit | missing |
|---|---:|---:|---:|---:|---:|---:|---:|
| Catalog/history | 41 | 32 | 4 | 0 | 0 | 1 | 4 |
| Required acceptance | 38 | 32 | 4 | 0 | 0 | 1 | 1 |
| Supplemental/future | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| Required semantic target | 38 | 37 | 0 | 0 | 0 | 1 | 0 |

The current corpus is therefore structurally valid but honestly
`acceptance.complete=false`. The five historical required blockers remain
`R-CD-2`, `R-CD-CHAINED-DEPTH-2`, `R-CD-TOKEN`, `R-CW-6`, and
`R-OBS-BACKEND-DISPOSITION`. This lane does not fabricate their successor
evidence; later reviewed receipts can be folded into the final corrected
corpus.

## Exact provenance

| Event | Commit / issue | Finding |
|---|---|---|
| Four telemetry contracts introduced | `5a061227cbb438572bc9aecdb1dbc902dc585452`, merged in #512 from `karmaterminal/openclaw#1254` | The catalog PR explicitly published contracts, not product instrumentation or PASS evidence. Census report `39803b297bd4786db3971eb82a3a7fd0b29bc643`; observed product `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955`. |
| All four promoted into required acceptance and dispatch | `de315e25aad6871e51341de7916c7383fa3d06a7` | The c3a corpus contains 41 `required_rows` and 41 dispatch entries, including all four telemetry rows. The commit references #514, but #514 owns separate harness-authority repairs; it is not provenance for making fleet research continuation-required. |
| Required set copied forward | `86b39d87e0ae4eef980496d3742e83033ee84a93`, then `d075d3b445cdd238a44d69dc55b057829483e9e9` | The 41-row denominator moved through the 80311 and 4737 corpora without a typed supplemental collection. |
| Backend integrity implemented | `3619675c2832f838874db044fa5ce6c3fd0aa60a`, #517 | Added the shared backend-status writer, Tempo/Loki disposition, PASS withholding, candidate-envelope checks, and runnable scenario. This row is proof-harness integrity and remains required. |
| Correction basis | `45cf1ae59ba0f32031a90dde193fe2d48d494e25` | Contains the backend implementation and the rejected 41-required-row matrix. |

The three supplemental rows are fleet/product research contracts from
`karmaterminal/openclaw#1254`. `R-OBS-BACKEND-DISPOSITION` is different: it
guards the docs harness against treating Tempo/Loki zero results without
completeness metadata as evidence. Removing it would weaken verdict integrity.

## Repair invariant and composition boundary

**Owner:** the concluding `PROOFS/<SHA>/proofs-manifest.json` composition
boundary owns row classification, dispatch, rollups, and required non-PASS
receipts. Directory discovery and prose are not acceptance authority.

The enforced invariant is:

1. `required_rows` equals the canonical ordered 38-row policy.
2. `supplemental_rows` equals the exact typed three-row product telemetry
   collection.
3. Required and supplemental IDs are unique, disjoint, and exhaustive over all
   41 `rows[]`.
4. Every required row appears exactly once in `dispatch_allocation`; no
   supplemental row appears there.
5. Top-level `rollup` preserves all catalog/history records,
   `acceptance.required_rollup` counts only required rows, and
   `supplemental_rollup` counts only supplemental rows.
6. A supplemental row whose state is `missing` cannot claim
   `PASS-candidate`.
7. Only `R-RC-2` may use required `honest_limit`, and only when the named
   candidate run result proves a nonce-bound structured
   `request_compaction` `context_threshold` rejection.
8. The required target is exactly 37 PASS plus that receipt-backed R-RC-2
   honest limit.

The policy is
`tools/k6-proofs/continuation-acceptance-policy.json`, its declared shape is
`continuation-acceptance-policy.schema.json`, and
`scripts/lib/continuation-acceptance-matrix.mjs` is the shared generator and
validator contract.

## Deterministic controls

### Rejected base

An archive of exact
`45cf1ae59ba0f32031a90dde193fe2d48d494e25` received only
`proof-matrix-provenance-negative-control.test.mjs`. The control exited 1 for
the expected first invariant:

```text
AssertionError: Expected values to be strictly equal:
41 !== 38
```

The same base manifest also has no `supplemental_rows`; the three product rows
are present in `required_rows`. Separately, exact c3a commit
`de315e25aad6871e51341de7916c7383fa3d06a7` proves those same rows were in
`dispatch_allocation`.

### Successor

The identical control passes on the successor. The broader matrix test proves:

- 38 required IDs and the three exact supplemental IDs;
- backend disposition remains required;
- required dispatch is exactly once;
- current evidence rows are byte-equivalent to the rejected base `rows[]`;
- catalog, required, and supplemental rollups are independently exact;
- 37 PASS plus receipt-backed R-RC-2 is the only complete target;
- duplicate, overlapping, unclassified, silently dropped, or reallocated rows
  fail;
- stripped matrix fields cannot downgrade the corpus to legacy validation;
- changing the policy to move a supplemental row back into required fails;
- a missing supplemental row cannot claim PASS or lose its missing state;
- another honest limit, a missing R-RC-2 receipt, and a receipt symlink that
  escapes the corpus root all fail.

### Siblings and partial failure

- Candidate-envelope validation and its sibling consumer share the same
  R-RC-2 structured-receipt predicate; existing candidate-envelope negative
  controls remain green.
- Backend disposition remains wired through manifest, scenario, row-list,
  postprocessor, telemetry, and candidate-envelope tests.
- Generator output is atomic. Invalid policy, source row set, dispatch
  allocation, receipt, or generated matrix fails before rename; temporary
  output is removed.
- Re-running from the repository root or `tools/k6-proofs` resolves the same
  repository and produces the same classification.
- Runtime restart/recovery is N/A for this docs-only classification repair.
  Historical runtime/evidence identities are unchanged. Recovery from an
  incomplete corpus is explicit: structural validation passes with
  `acceptance.complete=false`, while `--require-acceptance` fails and names
  every blocker.
- Rollback does not require rewriting proof evidence or `PROOFS/INDEX.json`;
  the final aff corpus remains read-only historical input until a later
  coordinated fold.

## Changed surfaces

- Added the typed continuation acceptance policy and schema.
- Added the root-stable, atomic matrix generator and shared validator.
- Corrected the current manifest to 38 required rows, three typed supplemental
  rows, exact required dispatch, split rollups, and the existing structured
  R-RC-2 receipt.
- Extended corpus/current/index and catalog validators with fail-closed matrix
  enforcement and optional semantic `--require-acceptance`.
- Updated current README/METHOD/CLAWSSWEEPER guidance, the generic manifest
  template, telemetry docs, proof-run docs, contributor instructions, harness
  README, and XML pipeline.
- Reused the candidate-envelope R-RC-2 predicate instead of duplicating it.

Twenty-two files differ from the rejected base. No row evidence file,
`PROOFS/INDEX.json`, workflow, protected OpenClaw ref, docs `main`, or
`openclaw/openclaw#129388` was changed.

## Validation

### Rejected and successor control

```bash
node --test \
  tools/k6-proofs/scripts/__tests__/proof-matrix-provenance-negative-control.test.mjs
```

- exact rejected-base archive: 0 pass / 1 fail, expected `41 !== 38`;
- successor: 1 pass / 0 fail.

### Complete affected docs harness

```bash
node --test \
  tools/k6-proofs/scripts/__tests__/*.test.mjs \
  tools/k6-proofs/tests/*.test.mjs
```

Result: **441 tests, 441 pass, 0 fail**.

This includes manifest/scenario, telemetry-contract, candidate-envelope,
backend disposition, corpus/current/index, JSON/JSONL artifact, report,
redaction/public-safety, interrupted-run, and sibling continuation controls.

### Catalog, corpus, formats, and scenarios

```bash
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node tools/k6-proofs/scripts/list-runnable-rows.mjs --all
node tools/k6-proofs/scripts/validate-corpus.mjs --current --json
node tools/k6-proofs/scripts/validate-corpus.mjs \
  --sha 4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd
jq empty \
  tools/k6-proofs/continuation-acceptance-policy.json \
  tools/k6-proofs/continuation-acceptance-policy.schema.json \
  tools/k6-proofs/row-manifest.schema.json \
  tools/k6-proofs/manifests/*.json \
  PROOFS/4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd/proofs-manifest.json
python3 -c \
  'import xml.etree.ElementTree as ET; ET.parse("tools/k6-proofs/k6-proofs-pipeline.xml")'
bash -n tools/k6-proofs/run-proof.sh tools/k6-proofs/scripts/run-proofs.sh
k6 inspect tools/k6-proofs/scenarios/r-obs-backend-disposition.js
k6 inspect tools/k6-proofs/scenarios/static-corpus-row-validator.js
```

All passed. The static validator's expected no-manifest warning was the only
k6 inspection diagnostic.

The historical corpus was also required to stay incomplete:

```bash
node tools/k6-proofs/scripts/validate-corpus.mjs \
  --current \
  --require-acceptance
```

It exits nonzero and names the five required blockers. That is the intended
honest result until reviewed successor receipts are folded.

## Final disposition

- CI path: **focused-only**. Broad Mode-B is N/A for this docs harness/catalog
  lane; no Gate 3g fallback was used.
- No live proof traffic or fleet mutation occurred.
- No AI subagent, task agent, autoreview, Opus, stock GitNexus, PR creation, or
  merge was used.
- The final aff corpus at docs/proof ref
  `c083eae1cb6b52c5e50f75d785a039c332172aca` remains unchanged historical
  input. Its later fold must run the generator, structural validator, and
  semantic acceptance gate against reviewed successor evidence.
