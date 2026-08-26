# Final corpus validation

Validated on 2026-08-25 for exact target
`aff9807b34ba2ee4e7bcfd7081ee623c64a219a2`.

## Identity and copy

- Source docs commit:
  `b502fa7c445d45d0d31bde81f7a1d3cb3c9bed32`.
- Source corpus: 595 regular files, 0 symlinks.
- Final corpus: 605 regular files, 0 symlinks. The ten target-only files are
  the archived warm ref contract, final materiality packet (three files), final
  source map, this receipt, its checksum manifest, the execution-identity
  validator, and two regression-control receipts.
- Source mapping: 595/595 paths mapped; 376 byte-identical, 219
  target-rebound, 0 missing.
- `PROOFS/INDEX.json` resolves exactly to aff and its rollup matches the
  manifest: 41 total / 32 pass / 4 partial / 1 honest limit / 4 missing /
  0 fail.
- The pre-evidence named-ref contract resolves product, lane, presentation,
  docs, and ancestor workflow refs to full SHAs. The protected presentation
  branch remains `4737afdf...`.

## Contract gates

| Gate | Result |
|---|---|
| Current corpus/index validator | PASS; index 4/4 and current manifest 10/10 |
| Proof-row manifest coverage | PASS; 41 rows, 42 catalog manifests, 0 missing |
| Manifest/scenario registry | PASS; 42 manifests, 35 scenario files |
| Workflow/scenario alignment | PASS; 22 workflow choices, 0 errors |
| Telemetry contracts | PASS; 13 declared, 9 telemetry-dependent rows, 0 telemetry-rebindable PASS claims |
| Execution-identity boundary | PASS post-fix; rejected `29f7388c...` fails with exactly 24 expected violations |
| JSON | PASS; 269 files |
| JSONL/NDJSON | PASS; 54 files / 761 non-empty records |
| Markdown local links | PASS; 101 files / 23 local links |
| Manifest/index declared references | PASS; 158 references |
| Source-map hashes and dispositions | PASS; 595/595 |
| SHA-256 manifests | PASS; 5 manifests / 194 entries |
| High-confidence credential patterns | PASS; 0 findings |
| Structured sensitive-key values | PASS; 323 files / 1,030 records / 0 findings |
| Newly introduced private path strings | PASS; 0 |

Historical gate checksums use corpus-root-relative paths; packet checksums use
manifest-directory-relative paths. Each manifest was verified from its declared
base. The target-owned named-ref contract checksum was rebound after the final
contract was written.

## Review repair regression completeness

Rejected pushed SHA:
`29f7388c9f50a7a1758295845169a6628e6cbf31`.

The owning composition boundary is the separation between operational
execution identity and transposition target metadata:

- Historical live invariant: `execution_sha` remains `37300f29...` and its
  `pure_sha` remains `80311e8a...`; aff may appear only in the ledger's
  `transposition.target_corpus_sha`.
- Fixture invariant: all 23 R-CW-5/R-CW-6 `candidateSha`,
  `candidateWorktreeHead`, and execution-worktree `head` fields remain
  `80311e8a...`; aff may appear only in the 15 explicit transposition target
  blocks, all of which keep `exact_target_execution=false`.

`check-execution-identity.mjs` run against an archive of rejected SHA
`29f7388c...` exits 1 with exactly 24 expected violations: 23 fixture
operational fields plus the historical live `pure_sha`. The same validator run
against the repaired successor exits 0 with zero violations. Raw controls are
`REJECTED-29F7388C-IDENTITY-CONTROL.json` and
`POSTFIX-EXECUTION-IDENTITY.json`. An archive of exact committed successor
`979aa6189c16e93efc62b06a5f9d45c21dfedc32` passes the same validator with
zero violations.

Nearest siblings and alternate paths are included in the same owner boundary:
R-CW-5 checks readiness, dependency integrity, dispatch, typed-tool, cleanup,
and result receipts; R-CW-6 additionally checks runtime boundary, durable
recovery, public-artifact safety, and the retained partial/FAIL-fixture path.
The repair changes identity labels only. It does not alter persistence,
rollback, restart/recovery, cleanup, spawn, or partial-failure outcomes.

## Commands

```text
node tools/k6-proofs/scripts/validate-corpus.mjs --index --json
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node PROOFS/aff9807b34ba2ee4e7bcfd7081ee623c64a219a2/artifacts/transposition/check-execution-identity.mjs --corpus <rejected archive>
node PROOFS/aff9807b34ba2ee4e7bcfd7081ee623c64a219a2/artifacts/transposition/check-execution-identity.mjs --corpus PROOFS/aff9807b34ba2ee4e7bcfd7081ee623c64a219a2
node <built-in-only JSON/JSONL parser>
node <built-in-only Markdown and declared-reference checker>
node <built-in-only source-map/hash/disposition checker>
sha256sum -c <each SHA256SUMS from its declared base>
node <built-in-only high-confidence and structured sensitive-content scanners>
git diff --check
```

Acceptance path is `focused-only`. No Mode-B, Gate 3g, live execution, or
workflow was dispatched for aff. The final maintenance report remains the only
applicability bridge from warm basis 250 to aff; no impact is unknown within its
declared slice.
