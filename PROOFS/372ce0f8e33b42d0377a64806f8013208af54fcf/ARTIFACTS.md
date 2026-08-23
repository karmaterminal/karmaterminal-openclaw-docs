# Artifact inventory

## Seed artifacts

- `proofs-manifest.json`: 41 required rows, all reopened `missing`.
- `R-*/EVIDENCE.md`: one scaffold for every required row.
- `NON-INTERFERENCE-MAP.md`: direct presentation/runtime classification.
- `gates/mode-b-presentation-32650099821-summary.md`: exact red presentation
  receipt.
- `gates/mode-b-*-aggregate.{md,json}`: unedited public aggregate artifacts
  from the exact presentation and absorbed-upstream baseline runs.
- `gates/mode-b-failure-classification.md`: exact deterministic-set
  comparison and fail-closed disposition.
- `gates/gate-2.7-summary.md` and `gates/gate-2.7-classification.tsv`: exact
  final-presentation classification; 346 mixed paths remain undispositioned.
- Both terminal Mode-B receipts are red; a live dispatch is not permitted.
- `artifacts/.gitkeep`: no behavior artifact exists at seed.

## Live artifact rule

The canonical fold must count artifact files on disk and reconcile that count
with every manifest path. A manifest must never promise an absent receipt.
Private acquisition directories, raw identifiers, credentials, and unredacted
payload tails are prohibited.
