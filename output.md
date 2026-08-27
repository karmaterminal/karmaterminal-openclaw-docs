# PR #129388 continuation corpus transposition

**Status:** READY FOR SCRIBE REVIEW

**Docs PR:** https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/530

**CI path:** `focused-only` (docs corpus validators; no product Mode-B dispatch)

**Reviewed corpus commit:** `4577c95e5ea0007ebc3dab8e3828488f0ec1e265`

**Reviewed repository tree:** `fd617171d46b7049983e4e90e21c72d6a8b479b8`

**Target corpus tree:** `b879c8adc4f284d622b5d388e978928c675f1aeb`

## Named-ref contract

The safe lane was published before evidence was credited. The reviewed corpus
tip below was equal locally, on its tracking ref, and on the server before this
report-only successor commit.

| Category | Named ref | Local SHA | Tracking SHA | Server / authoritative SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `openclaw/openclaw` source presentation commit | N/A | N/A | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | Server object exists; exact source-to-target merge base. |
| This lane's safe branch ref | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proofs-transpose-446f-20260827` reviewed corpus tip | `4577c95e5ea0007ebc3dab8e3828488f0ec1e265` | `4577c95e5ea0007ebc3dab8e3828488f0ec1e265` | `4577c95e5ea0007ebc3dab8e3828488f0ec1e265` | Equal before report-only successor. |
| CI/workflow ref | Docs validators only; no product workflow dispatched | N/A | N/A | N/A | N/A |
| Presentation ref | `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates` | N/A | N/A | `446f4b22d321cb7f5f26a4fbc2247f54da72d2a4` | Fork branch equals `openclaw/openclaw#129388` head. |
| Docs/proof base ref | `karmaterminal/karmaterminal-openclaw-docs:main` | `f71e97238bfd8150f2eb0fe5488a25c250e257cc` | `f71e97238bfd8150f2eb0fe5488a25c250e257cc` | `f71e97238bfd8150f2eb0fe5488a25c250e257cc` | Equal. |
| Docs/proof source corpus | `PROOFS/4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd/` at docs `main` | tree `97f278557b2c121627804b76e440b0f2004f5e21` | same | same via equal server `main` | Equal; 403 files, 4,666,303 bytes. |
| Docs/proof target corpus | `PROOFS/446f4b22d321cb7f5f26a4fbc2247f54da72d2a4/` at reviewed corpus tip | tree `b879c8adc4f284d622b5d388e978928c675f1aeb` | same | same via equal server lane | Equal. |
| Latest source-corpus update | docs commit `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` | reachable | reachable from `origin/main` | reachable from equal server `main` | Incorporated into canonical source bytes. |
| Upstream PR base commit | `openclaw/openclaw#129388` base | N/A | N/A | `9bd50c803cce88f2ab387ddaf6cc29b4ef004005` | PR API authority; informational materiality boundary. |

GitHub reports target presentation `446f4b22…` ahead of source presentation
`4737afdf…` by 1,244 commits, behind by zero, with the source as the exact merge
base. The target branch and upstream PR head were rechecked immediately before
PR creation.

## Change

- Copied the complete canonical 403-file source subtree to
  `PROOFS/446f4b22d321cb7f5f26a4fbc2247f54da72d2a4/`, including every row packet
  and vendored artifact.
- Kept 396 payload files byte-identical. Only six target-facing glue documents
  and `proofs-manifest.json` differ from the source subtree.
- Rebound `PROOFS/INDEX.json`, all manifest row paths, and every INDEX
  entrypoint to the target subtree.
- Kept `proof_source_sha` at immediate proof-bearing source `4737afdf…`;
  presentation fields `capture_sha`, `ship_sha`, and `sha` identify target
  `446f4b22…`.
- Preserved original proof source `80311e8a…`, historical runtime composite
  `37300f29…`, source docs commits, run IDs, timestamps, payloads, checksums,
  and row dispositions.
- Preserved exact-source Mode-B run `32859410821` and workflow SHA
  `342cc9c6d190e1ba57d9995d29e394c993a3e79b` as historical
  ancestry/materiality evidence only.
- Set current `exact_target_execution=false` and
  `exact_target_mode_b=false`; current target Mode-B is explicitly `not-run`.
- Changed 405 repository paths relative to docs base: the 403-file target
  subtree, `PROOFS/INDEX.json`, and this report.

## Unchanged rollup

`41 total / 32 pass / 4 partial / 1 honest_limit / 0 fail / 4 missing`

Every non-PASS row:

| Row | State |
|---|---|
| `R-CD-2` | partial |
| `R-CD-CHAINED-DEPTH-2` | partial |
| `R-CD-TOKEN` | partial |
| `R-CW-6` | partial |
| `R-RC-2` | honest_limit |
| `R-OBS-BACKEND-DISPOSITION` | missing |
| `R-OBS-CONT-PROVENANCE` | missing |
| `R-OBS-PROOF-MARKER` | missing |
| `R-OBS-TERMINAL-OUTCOME` | missing |

Source and target row IDs, states, candidate verdicts, review states, pending
receipts, fired timestamps, summaries, and executed-test labels compare equal.
No verdict was promoted.

## Validation

Repository-native current-corpus gates:

```bash
node tools/k6-proofs/scripts/validate-corpus.mjs --sha 446f4b22d321cb7f5f26a4fbc2247f54da72d2a4
node tools/k6-proofs/scripts/validate-corpus.mjs --index
node tools/k6-proofs/scripts/validate-corpus.mjs --current
```

Receipts: target SHA report 10/10 checks; INDEX report 4/4 plus current manifest
10/10; all exit 0. The same SHA and INDEX commands against a detached archive
of exact docs base `f71e9723…` report the canonical 4737 source green.

Catalog and contract validators:

```bash
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
```

Receipts: 42 manifests / 35 scenarios; alignment `ok:true`; 41 current proof
rows with zero missing or manifest-only rows; 13 telemetry contracts with zero
invalid rebindable-PASS claims. All exit 0.

Targeted current-corpus integration tests:

```bash
node --test \
  tools/k6-proofs/scripts/__tests__/catalog-root-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/candidate-run-result.test.mjs \
  tools/k6-proofs/scripts/__tests__/check-proof-row-manifests.test.mjs \
  tools/k6-proofs/scripts/__tests__/static-evidence-source.test.mjs
```

Receipt: 46 tests, 46 pass, 0 fail.

Syntax and diff gates:

```bash
bash -n tools/k6-proofs/run-proof.sh tools/k6-proofs/scripts/run-proofs.sh
git diff --check origin/main...HEAD
git diff --check
```

Receipts: both proof shell entrypoints parse; the copied target contains no
`.sh` files; both diff checks exit 0.

Supplementary deterministic checks:

- Source and target relative inventories are identical: 403 files, zero
  symlinks.
- Exactly seven target files differ from source:
  `ARTIFACTS.md`, `CLAWSSWEEPER.md`, `METHOD.md`, `README.md`,
  `RESOLVED-SHA.md`, `TRANSPOSED-FROM.md`, and `proofs-manifest.json`.
- All INDEX entrypoints and all 41 manifest row/evidence paths exist and remain
  inside the target subtree.
- All 209 `.json` files parse. Of 54 `.jsonl` files, 52 are line-valid and two
  inherited `flow-runs-matching-full.jsonl` files are valid legacy whole-JSON
  arrays; source and target parse dispositions are identical.
- The retained two-line restore checksum receipt contains one identical,
  well-formed SHA-256 digest.
- High-confidence token, webhook, private-key, and bearer-secret patterns have
  zero matches.
- Canonical absolute seat-home provenance strings occur in the same 39
  byte-identical historical files on source and target. No new private-path
  material appears in target-facing metadata. Rewriting those signed source
  payloads would violate the byte/checksum preservation contract.
- The target SHA appears only in presentation/navigation metadata; no copied
  artifact records it as `candidateSha` or `execution_runtime_sha`, and no
  current exact-target flag is true.

Informational archival scan:

```bash
node tools/k6-proofs/scripts/validate-corpus.mjs --all --json
```

The non-strict archival scan exits 0 and reports 136 directories, 55 validated,
42 green, 81 without manifests, and 13 failed historical reports. Every failed
historical directory and `validate-corpus.mjs` are byte-identical to exact docs
base `f71e9723…`; the new 446f current report is green. No archival failure was
laundered or repaired in this lane.

## Independent review

A read-only review found two medium provenance defects in the first metadata
checkpoint:

1. `proof_source_sha` incorrectly named the unexecuted target.
2. `execution.immediate_source_is_ancestor` incorrectly implied that 4737 was
   an ancestor of runtime composite 37300f29.

Commit `4577c95e…` fixes both: proof source remains `4737afdf…`, the
source-to-runtime flag is false, and target descent from 4737 is recorded
separately. All owner validators and the 46 integration tests passed again
after the fix.

## Explicit limits

- No live proof was fired at `446f4b22…`.
- No Mode-B workflow was dispatched for `446f4b22…`.
- Historical exact-4737 Mode-B is not exact-target acceptance.
- Current target upstream CI is pending separately and is not folded into this
  corpus.
- Product presentation and runtime were not modified.
- The docs PR must not be merged by this lane.
