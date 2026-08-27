# READY FOR SCRIBE REVIEW

## Delivery

- Branch: `codeagent/129388-proofs-transpose-be0-method-correction-20260827`
- Reviewed corpus commit: `dbebbbd1be5c033ff9ca82a3e0dd90b913171169`
- Reviewed repository tree: `d42b723335b85fef306f7fbf2cbee2466a24928e`
- Final report-only successor: recorded in the PR and COMPLETE receipt
- Source corpus tree: `b879c8adc4f284d622b5d388e978928c675f1aeb`
- Target corpus tree: `4e96989f7cfa2e3398ab5fb2aa929016b414051a`
- Reviewed corpus commit: 401 changed files; total PR diff including this report: 402 files
- PR: https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/531
- CI acceptance path: `focused-only` (docs validators; no Mode-B dispatch)

| Category | Named ref | Exact SHA | Equality |
|---|---|---|---|
| Product/base ref | `karmaterminal/karmaterminal-openclaw-docs:main` | `c26a6b492beb5336fcf7af40af443d8c616f36bf` | Tracking and server refs equal; source worktree was anchored here. |
| Safe lane ref | `codeagent/129388-proofs-transpose-be0-method-correction-20260827` reviewed corpus tip | `dbebbbd1be5c033ff9ca82a3e0dd90b913171169` | Local, tracking, and server refs were equal before the report-only successor. |
| CI/workflow ref | N/A | N/A | Docs validators only; exact-target upstream CI is separate and pending. |
| Presentation ref | `openclaw/openclaw#129388` head and `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates` | `be0ef63a0461a7b3705bdf3c6b282f172b15f650` | Both GitHub refs equal. |
| Docs/proof ref | Reviewed lane tip plus `PROOFS/INDEX.json` | `dbebbbd1be5c033ff9ca82a3e0dd90b913171169` | Local, tracking, server, and PR head were equal before the report-only successor. |

## Change

Created and indexed
`PROOFS/be0ef63a0461a7b3705bdf3c6b282f172b15f650/` from canonical remote docs
`main` at `c26a6b492beb5336fcf7af40af443d8c616f36bf`. Target-facing identity and
navigation now resolve to `be0ef63a0461a7b3705bdf3c6b282f172b15f650`.
Historical execution, row dispositions, receipts, checksums, source docs
lineage, and Mode-B identities remain preserved.

The corrected active matrix is 37 rows: 32 `pass`, 4 `partial`,
1 `honest_limit`, 0 `fail`, and 0 `missing`. The partials are `R-CD-2`,
`R-CD-CHAINED-DEPTH-2`, `R-CD-TOKEN`, and `R-CW-6`; the sole honest limit is
`R-RC-2`. This is not acceptance-complete.

`R-OBS-BACKEND-DISPOSITION`, `R-OBS-CONT-PROVENANCE`,
`R-OBS-PROOF-MARKER`, and `R-OBS-TERMINAL-OUTCOME` remain in the historical
`446f4b22...` corpus and Git history. They are not PR #129388 feature
acceptance contracts and have no row directory or active manifest/table entry
in the new target.

## Inventory and hash receipts

- Source: 403 files; target: 399 files; zero symlinks.
- Source-only files are exactly the four excluded rows' `EVIDENCE.md` files.
- Retained source and target relative-inventory SHA-256:
  `9d23f49ef197b7879e451161ff637590510c17b8c6bc8ee3c97b89a2ef60c67a`.
- The 392 retained non-glue files have matching source and target byte-map
  SHA-256:
  `d458a475f53edd5f26d7511a0665b25f16085ecd78a5801aab1a2e2abc06e887`.
- The only changed retained files are `ARTIFACTS.md`, `CLAWSSWEEPER.md`,
  `METHOD.md`, `README.md`, `RESOLVED-SHA.md`, `TRANSPOSED-FROM.md`, and
  `proofs-manifest.json`.
- Full generated receipt:
  `/home/figs/.copilot/session-state/a73c402d-d716-4453-947e-7fb796ea8052/files/inventory-hash-receipt.txt`.

## Repair regression

- Invariant and owner: `PROOFS/INDEX.json` composes the current corpus, whose
  manifest, row directories, README table, and ClawSweeper guidance must expose
  exactly the 37 PR #129388 feature-acceptance rows.
- Negative control: on exact rejected docs SHA
  `c26a6b492beb5336fcf7af40af443d8c616f36bf`, the focused test failed for the
  expected reason: `41 !== 37`.
- Successor proof: the same focused test passes against
  `dbebbbd1be5c033ff9ca82a3e0dd90b913171169`, including inventory and byte
  preservation.
- Nearest active sibling paths: `R-OBS-1`, `R-OBS-2`, and `R-OBS-STATUS`
  remain active feature rows; the four research rows remain accessible only in
  the immediate source corpus.
- Persistence/rollback: the correction is locked by the current-corpus test;
  rollback can repoint the index to the untouched historical source corpus.
- Restart/recovery: N/A for this docs-only composition change; no runtime,
  gateway, persistence store, or deployment was mutated.
- Partial failure: the four partial rows and `R-RC-2` honest limit remain
  explicit. Exact-target execution and exact-target Mode-B remain false.

## Validation

- Focused owner proof:
  `node --test tools/k6-proofs/scripts/__tests__/current-corpus-active-scope.test.mjs`
  - pre-fix: 0/1, expected `41 !== 37`
  - post-fix: 2/2 pass
- Corpus:
  `node tools/k6-proofs/scripts/validate-corpus.mjs --sha be0ef63a0461a7b3705bdf3c6b282f172b15f650`
  and
  `node tools/k6-proofs/scripts/validate-corpus.mjs --sha 446f4b22d321cb7f5f26a4fbc2247f54da72d2a4`
  - both 10/10 checks pass
- Current/index:
  `node tools/k6-proofs/scripts/validate-corpus.mjs --index` and
  `node tools/k6-proofs/scripts/validate-corpus.mjs --current`
  - both 4/4 checks pass
- Catalog/scenario:
  `node tools/k6-proofs/scripts/check-manifest-scenarios.mjs --repo-root "$PWD"`,
  `node tools/k6-proofs/scripts/check-scenario-alignment.mjs --repo-root "$PWD"`,
  and
  `node tools/k6-proofs/scripts/check-proof-row-manifests.mjs --repo-root "$PWD"`
  - all pass; 37 proof rows and zero missing manifests
- Telemetry:
  `node tools/k6-proofs/scripts/check-telemetry-contracts.mjs`
  - pass; 13 declared contracts, 9 receipt-requiring rows, 0 rebindable PASS claims
- Serialized integration suite:
  `node --test --test-concurrency=1 tools/k6-proofs/scripts/__tests__/*.test.mjs tools/k6-proofs/tests/*.test.mjs`
  - 387/387 pass
- Structured payloads: 209 JSON files parse; 52 JSONL files are line-valid;
  two inherited JSONL files parse as legacy whole-JSON arrays.
- Shell syntax: all two `tools/k6-proofs/**/*.sh` files pass `bash -n`.
- Public safety: high-confidence credential scan has zero matches; the seven
  changed target metadata files plus `PROOFS/INDEX.json` have zero absolute-home
  path matches.
- Target exactness scans: no active exact-target true flag, dangling excluded
  target path, or stale 41-row/4-missing rollup.
- `git diff HEAD --check`: clean.
- Tracked worktree: clean.

## Limits and uncertainties

No proof row was fired, no Mode-B workflow was dispatched, no product
presentation was modified, and nothing was deployed or merged.
`exact_target_execution=false` and `exact_target_mode_b=false` throughout the
active corpus. Historical exact-4737 Mode-B run `32859410821` at workflow SHA
`342cc9c6d190e1ba57d9995d29e394c993a3e79b` remains ancestry/materiality
evidence only. Separately tracked exact-target upstream product CI
`330963...` is pending and is not folded into this docs corpus.
