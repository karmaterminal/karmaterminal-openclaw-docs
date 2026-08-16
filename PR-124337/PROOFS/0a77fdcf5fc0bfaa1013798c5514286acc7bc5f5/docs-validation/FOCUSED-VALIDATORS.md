# Docs harness focused validators (publication lane)

Continuation INDEX left untouched. Sidecar is not consumed by these tools.

| Command | Exit | Notes |
| --- | ---: | --- |
| `node tools/k6-proofs/scripts/check-manifest-scenarios.mjs` | 0 | 38 manifests / 35 scenarios |
| `node tools/k6-proofs/scripts/check-scenario-alignment.mjs` | 0 | ok:true |
| `node tools/k6-proofs/scripts/check-proof-row-manifests.mjs` | 0 | current PROOFS/a7ef0317; 0 missing |
| `node tools/k6-proofs/scripts/validate-corpus.mjs --index` | 1 | **baseline** schema-manifest red |
| `node tools/k6-proofs/scripts/validate-corpus.mjs --current` | 1 | same baseline red |

## Known baseline manifest-schema red

Present on `origin/main` `PROOFS/a7ef0317…/proofs-manifest.json`:

- expected `openclaw.proofs.manifest.v1`, got `openclaw.k6.proofs-manifest.v1`
- missing `capture_sha`
- `rows[]` missing or not an array

This lane does not own that continuation board. Not repaired here.
