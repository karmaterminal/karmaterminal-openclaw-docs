# Method — supplementary Project 81 proof corpus

## Bound identity

The corpus directory is keyed to pure continuation SHA `99ce36658eef9d4a9ad9eca6782ffa0ee7891fd6`.
The live gateway executed composite `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955`. Git verified that the pure
SHA is an ancestor/parent of the composite; the other composite parent is
`b5de30c6ffe068d26f6b18e416f8f4659088241f`.

## Harness identity

Every run used immutable docs harness ref `7ab525923833cbddffa5c75c22481fcbe9d12fe9` and target seat `cael`.
The workflow-provided harness provenance receipts and frozen row
manifest/scenario digests are preserved under `source-runs/`.

## Execution

The Project 81 workflow has a ten-minute job ceiling. One broad run reached that
ceiling after R-CD-MODEL-TOKEN, so the remainder was dispatched serially:

1. `31878888351` — initial broad slice.
2. `31879446802` — model-tool through R-CW-4.
3. `31879999334` — remaining continuation rows.
4. `31880178849` — observation, compaction, regression, and trace rows.

Workflow-level failure is not treated as a blanket product verdict. Each row is
classified from `candidate-run-result.json` when a validated envelope exists,
otherwise from `run-result.json`, its effective exit code, review state, and
preserved error receipts.

## Folding

Row artifact directories were copied byte-for-byte from the four downloaded
GitHub Actions artifacts. No row evidence was rewritten. The only generated
files are this method, the identity receipt, the README ledger, and
`proofs-manifest.json`.

Static readers are explicitly separated from live behavior. The static readers
resolved baseline `0921776150142c3fd8d517de5c73e1c94732f004` from the docs snapshot index, but that
historical corpus was absent from the immutable harness snapshot. Their missing
file and false-check receipts are retained as proof-substrate failures.

Generated: 2026-08-15.
