# Artifact inventory

## Seed artifacts

- `proofs-manifest.json`: 41 required rows, all reopened `missing`.
- `R-*/EVIDENCE.md`: one scaffold for every required row.
- `NON-INTERFERENCE-MAP.md`: direct presentation/runtime classification.
- `gates/mode-b-32674562617-aggregate.{md,json}`: exact final presentation
  aggregate with both full SHA identities and valid routing receipts.
- `gates/mode-b-upstream-32657627746-aggregate.{md,json}`: frozen-upstream
  comparison receipt.
- `gates/gate-2.7-summary.md` and `gates/gate-2.7-classification.tsv`: exact
  final-presentation classification and reconciliation summary.
- `gates/gate-2.7-feature-delta-patchid.tsv`: prior/final overlay identity
  comparison; 341 identical and four reviewed semantic merges.
- `gates/gate-2-feature-cores.log`: 40/40 primitive-core preservation receipt.
- `gates/gate-3d-pnpm-check.log` and `gates/gate-3f-pnpm-build.log`: local
  static/build acceptance.
- The terminal Mode-B receipt is red but completely classified; no
  candidate-specific product red remains.
- `artifacts/.gitkeep`: no behavior artifact exists at seed.

## Live artifact rule

The canonical fold must count artifact files on disk and reconcile that count
with every manifest path. A manifest must never promise an absent receipt.
Private acquisition directories, raw identifiers, credentials, and unredacted
payload tails are prohibited.
