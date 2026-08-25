# PR #129388 exact proof corpus transposition

## Outcome

Prepared a self-contained ClawSweeper corpus at
`PROOFS/2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a/` and moved
`PROOFS/INDEX.json` to that exact pure target only after the complete target
subtree was frozen and pushed.

- Target subtree: 538 regular files, 0 symlinks.
- Row rollup: 41 total / 32 pass / 4 partial / 1 honest limit / 4 missing /
  0 fail.
- Historical live execution remains
  `37300f29a7ec1f731575343c2aa73ae25f1d0efb`, with continuation ancestor
  `80311e8aa07fd560cb957475517c5ea18164541c`.
- Exact live proof for descendant runtime composite
  `a48c475baa893493df2ee8ebb17834b845a64aec` remains explicitly pending.
- No docs-main push, presentation-PR mutation, or new PR.

## Named refs

| Category | Ref | Exact SHA / disposition |
|---|---|---|
| Product/base | `karmaterminal/openclaw:codeagent/129388-upstream-4da57168-gates` | local, tracking, and server equal `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` |
| Safe docs lane | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-proof-transpose-2ffc` | unchanged base was published at `0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` before evidence; complete pre-index target freeze was pushed at `76a363f7eb019388aee45f5d25f7119933e82f4a` |
| CI/workflow | `karmaterminal/openclaw-bootstrap:main` | local object, `origin/main`, server `main`, and run head equal `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |
| Presentation | `openclaw/openclaw#129388` | `refs/pull/129388/head` remains predecessor `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd`; intentionally not mutated |
| Docs/proof base | `karmaterminal/karmaterminal-openclaw-docs@0e75318a68d7145c0c5b99e8b11bda304f4f9fd2` | immutable workorder pin resolved locally and on the server |

The in-corpus pre-evidence table is
`artifacts/gates/NAMED-REF-CONTRACT.md`.

## What changed

1. Full-copied all 403 source files from predecessor corpus
   `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd`; every source path has a local
   target mapping and no link leaves the target subtree.
2. Rebound target candidate identities and corpus paths to exact pure
   `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` without rewriting historical
   execution/source identities.
3. Rewrote `TRANSPOSED-FROM.md`, entrypoints, manifest metadata, and gate
   narratives with the exact ancestry:
   `4737afdf` -> spawn-init cure chain -> `6b6f4db7` -> ordinary upstream
   back-merge of `4da57168` -> exact merge `2ffc7ca0`.
4. Vendored Gate 2, Gate 2.5, Gate 2.7, heartbeat review, normal-clone, and
   complete red Mode-B receipts. All 135 gate artifacts have a committed
   `SHA256SUMS` ledger.
5. Preserved missing-row ownership: three telemetry rows under
   `karmaterminal/openclaw#1254`, backend disposition under #517, and R-CW-6
   partial under #516.
6. Losslessly normalized two inherited JSON arrays mislabeled as `.jsonl`;
   exact original bytes remain beside each projection as
   `*.source-array.json` with documented SHA-256 hashes.

## Exact receipts

| Gate | Result |
|---|---|
| Gate 2 | 40/40 primitive-core invariants; 1 exact-upstream projection; 3 tombstones; 0 failures |
| Gate 2.5 | 7 overlap test files; 656/656 assertions passed, one worker |
| Gate 2.7 | 948 files: 648 genuine, 300 safe-new, 0 frozen-stale, 0 mixed-clobber, 0 dropped lines |
| Heartbeat owner/review | 5 files, 67 assertions; read-only `APPROVE` at exact target |
| Exact normal clone | frozen install, production types, full test types, complete check, full build, clean tracked tree |

Mode-B run
[`32895790947`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32895790947)
used product SHA `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` and workflow SHA
`342cc9c6d190e1ba57d9995d29e394c993a3e79b`. Its authoritative conclusion is
`failure`: 165,696 passed, 39 failed, 9 load flakes greened, 32 deterministic.

- 13 TUI PTY failures start before PTY behavior because the dist runner lacks
  an upstream-identical `@openclaw/ai` artifact.
- The `commands-learn` assertion is directly red on the exact target; its test,
  command implementation, and prompt implementation are byte-identical to
  upstream `4da57168…`.
- The accepted gate handoff records direct passing controls for the remaining
  18 deterministic failures.

The docs lane independently replayed those 18 assertions: 16 passed; cron and
cross-session tests reached their own time limits on the loaded shared host
without assertion mismatches. Those replay diagnostics are retained outside
the public corpus and do not replace the supplied exact-target control receipt.

## Validation

Commands run:

```text
node tools/k6-proofs/scripts/validate-corpus.mjs --sha 2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a
node tools/k6-proofs/scripts/validate-corpus.mjs --index
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
sha256sum -c PROOFS/2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a/artifacts/gates/SHA256SUMS
```

Results:

- Corpus validator: 10/10 target checks and 4/4 index checks passed.
- Row manifests: 41 proof rows, 42 catalog entries, 0 missing, 0
  manifest-only rows.
- Catalog: 42 manifests / 35 scenario files; scenario alignment and all 13
  telemetry contracts passed.
- JSON sweep: 246 JSON files and 54 JSONL files / 761 records parsed with 0
  errors.
- Local references: 16 Markdown links and 136 manifest references resolve
  inside the target subtree.
- Predecessor-token audit: 50 occurrences, all explicitly labeled source,
  predecessor, or presentation-only provenance.
- High-confidence sensitive-content scan: 0 files.
- Source mapping: 403/403 source files represented; 0 symlinks.

## Remaining limit

There is no exact-target live execution claim. Runtime composite
`a48c475baa893493df2ee8ebb17834b845a64aec` is an ancestry/materiality
descendant only until Ronan supplies the exact live receipt.
