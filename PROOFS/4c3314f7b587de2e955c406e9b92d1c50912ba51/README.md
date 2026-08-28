# PR #129388 continuation proof corpus

Target presentation SHA: `4c3314f7b587de2e955c406e9b92d1c50912ba51`.
Immediate source presentation:
`4f85d9974f6b9b180dc2304fdf672bbca154da66`.
Original proof source:
`80311e8aa07fd560cb957475517c5ea18164541c`.
Historical live execution composite:
`37300f29a7ec1f731575343c2aa73ae25f1d0efb`.

## Transposition

This is a self-contained transposition of the canonical
`PROOFS/4f85d9974f6b9b180dc2304fdf672bbca154da66/` subtree at docs commit
`1d023b1b9e48edcb409ddceda8988532ef1efc7d`. Corpus identity and navigation
are rebound to `4c3314f7b587de2e955c406e9b92d1c50912ba51`;
all retained row evidence and vendored artifacts remain local to this target
subtree. Historical execution identities, verdicts, review states, timestamps,
receipts, payloads, and checksums retain their source provenance.

The target descends from the immediate source. Accepted covenant checkpoint
`c2aef217...` is the first absorb ancestor. The target merge parents are
`f04d8fcf...` and `df905a6c...`; `f04d8fcf...` has parents `c2aef217...`
and `f7e5add4...`.

No live row ran at the current target. Historical exact-4737 Mode-B run
[`32859410821`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32859410821)
remains ancestry/materiality evidence only. Exact-target Mode-B run
[`33165923171`](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/33165923171)
is active separately and is not row evidence. Until terminal evidence is
explicitly folded, `exact_target_mode_b=false`.

## Verdicts

The 37 row IDs, row states, review states, summaries, and evidence receipts are
preserved in `proofs-manifest.json` and the row-local `EVIDENCE.md` files.

## Rollup

`{"total_rows":37,"pass":32,"partial":4,"thin":0,"fail":0,"honest_limit":1,"missing":0}`

This matrix is not acceptance-complete. `R-CD-2`, `R-CD-CHAINED-DEPTH-2`,
`R-CD-TOKEN`, and `R-CW-6` remain partial, and `R-RC-2` remains the sole
honest limit. Zero fail and zero missing do not make the target complete or
green.

## Honest limits

- Live rows are historical execution-composite evidence, not exact-4c3314f7
  execution claims.
- Exact-4737 Mode-B is historical source evidence.
- Exact-target Mode-B run 33165923171 is active separately and not folded.
- R-CD-2 and R-CD-TOKEN retain signed/catalog partial dispositions.
- R-CD-CHAINED-DEPTH-2 did not deliver the root return within its observation
  window.
- R-CW-6 remains partial because the docs-generated selected delegate fixture
  is stale; its direct product surfaces passed.
- R-RC-2 was threshold-rejected and remains an honest limit.
