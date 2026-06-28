# k6 PROOFS golden path smoke

This is the smallest safe end-to-end check for the Project 81 k6 PROOFS harness.
It proves the candidate-artifact pipeline is wired without touching a live gateway,
firing continuation/delegate tools, or writing into the canonical corpus.

## One-command offline run

From the repository root:

```bash
rm -rf /tmp/p81-k6-golden-path
node tools/k6-proofs/scripts/postprocess-k6-summary.mjs \
  --manifest tools/k6-proofs/manifests/preflight.example.json \
  --summary tools/k6-proofs/examples/k6-summary.preflight.example.json \
  --out-root /tmp/p81-k6-golden-path
```

Expected result: the command exits `0` and prints a JSON object with
`"outcome": "PASS-candidate"` and `"candidateOnly": true`.

The generated run directory has this shape:

```text
/tmp/p81-k6-golden-path/<sha>/preflight/<seat>/k6-run-*/
├── EVIDENCE.md
├── k6-summary.json
├── row-manifest.json
└── row-result.json
```

## What this proves

This smoke proves the offline candidate pipeline:

- manifest schema `openclaw.k6.proof-row-manifest.v1` is accepted
- the k6 summary fixture is parsed into a normalized row result
- the artifact layout under `PROOFS/<sha>/<row>/<seat>/k6-run-*` is generated
- the output stays `candidateOnly: true` and `foldRequiresReview: true`
- the candidate output is kept outside the canonical corpus unless a reviewer
  deliberately folds it later

The source manifest is intentionally non-mutating:

- `transport: "offline"`
- `mutates: false`
- `review.candidateOnly: true`
- `review.foldRequiresReview: true`

## What this does not prove

This smoke does **not** prove live gateway behavior. It does not authenticate to a
gateway, open WebSocket traffic, invoke continuation tools, dispatch delegates,
fetch Tempo traces, or validate live redaction of gateway events. Those belong to
row-specific scenarios and remain candidate evidence until receipt review.

Use this golden path as the “is the harness artifact pipeline alive?” check before
running live rows.

## Validation

```bash
node --test tools/k6-proofs/scripts/__tests__/golden-path.test.mjs
node tools/k6-proofs/scripts/validate-corpus.mjs --index
```

The test writes only to a temporary directory and removes it afterwards. It does
not add files under `PROOFS/`.
