# ClawSweeper direct digest

- Exact protected head: `eee69b3d51c68c76c25c376451c161497e614a2b`
- Proof source ancestor: `4ff99f7e5c149d90214a3df932f9d5adb438b835`
- Semantic rollup: 3 pass, 0 partial, 0 thin, 0 fail, 0 honest-limit, 0 missing
- Exact target behavioral execution: **false**
- Original execution: bootstrap run `32652334564` on disclosed composite
  `6e6da7bba079b0fc50d134b96657cda683985837`
- Materiality: source-to-previous settlement-owner extraction preserves all
  six proof predicates; previous-to-target core blobs are byte-identical
- Current-head qualification: Mode-B `33032456154`, affected channel/plugin
  owners green, hosted lane 54 green
- Negative control: exact floor Mode-B `33033875064` reproduces the same
  non-owner failures and long-tail extensions behavior
- Honest limits: floor control was still in progress at review time; the
  current GitNexus graph was unavailable/stale; no exact-target execution is
  inferred from either limitation

Read [`proofs-manifest.json`](proofs-manifest.json), then each target-local
`rows[].evidence_doc` and `supporting_docs`.
