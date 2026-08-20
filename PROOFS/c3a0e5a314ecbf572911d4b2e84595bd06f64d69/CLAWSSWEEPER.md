# ClawSweeper entrypoint

## Exact identity

- Upstream PR: [openclaw/openclaw#85651](https://github.com/openclaw/openclaw/pull/85651)
- PR-presentation head: `c3a0e5a314ecbf572911d4b2e84595bd06f64d69`
- Corpus directory: `PROOFS/c3a0e5a314ecbf572911d4b2e84595bd06f64d69/`
- Canonical manifest: [`proofs-manifest.json`](proofs-manifest.json)
- Human rollup: [`README.md`](README.md)
- Method: [`METHOD.md`](METHOD.md)
- SHA/GATES provenance: [`RESOLVED-SHA.md`](RESOLVED-SHA.md)
- Artifact map: [`ARTIFACTS.md`](ARTIFACTS.md)

The canonical manifest filename is `proofs-manifest.json` (hyphen). Repository
validators and historical corpora use that name.

## Required read order

1. Read [`../INDEX.json`](../INDEX.json).
2. Verify `current_sha` equals the PR head above.
3. Follow `manifest_path` to [`proofs-manifest.json`](proofs-manifest.json).
4. Read [`README.md`](README.md) for reviewed row dispositions.
5. Read each manifest row's `evidence_doc`, `traces`, and `supporting_docs`.

## Runtime provenance boundary

Corpus, capture, ship, and proof-source identity are the pure continuation
PR-presentation SHA:

`c3a0e5a314ecbf572911d4b2e84595bd06f64d69`

The runtime actually executed was the deployment-only composite:

`46f4d2115700d574501bb3c4763abf6b2ba977fe`

That composite is the pure continuation SHA plus separately disclosed PR
#121204 runtime stability fixes. It is ancillary execution provenance, not the
PR or corpus identity.

## Reviewed rollup

`41 total / 30 pass / 2 partial / 1 honest_limit / 0 fail / 8 missing`

- `R-CD-2` is folded `partial`, not product `fail`: candidate failure authority
  incorrectly treated successful `phase=end` replay-safety metadata as
  execution failure. Repair is tracked by
  [karmaterminal-openclaw-docs#514](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/514)
  and PR
  [#515](https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/515).
- `R-CD-TOKEN` is `partial`: its strict exact-runtime gate received a version
  stamp rather than an independently bound full runtime SHA, so no behavior was
  dispatched.
- `R-CW-3` is `pass` from the same-runtime focused public Tempo topology
  preserved under supplemental run `32230009131`.
- `R-RC-2` is the policy-defined `honest_limit`: the nonce-bound compaction tool
  result was rejected by `context_threshold` and the matching child result was
  returned.
- Eight current catalog rows are explicitly `missing`; they are not omitted or
  represented as passing.

## Source receipts

- Complete live-suite workflow:
  [32231533500](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/32231533500)
- Supplemental R-CW-3 trace workflow:
  [32230009131](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/32230009131)
- Exact continuation fleet CI:
  [32209969307](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/32209969307)

Do not infer that workflow success means every row passed. The reviewed
manifest and row evidence are canonical.
