# Docs harness focused validators (P1 rebound)

Continuation `PROOFS/INDEX.json` left untouched.

| Command | Exit | Notes |
| --- | ---: | --- |
| `check-manifest-scenarios.mjs` | 0 | 38 manifests / 35 scenarios |
| `check-scenario-alignment.mjs` | 0 | ok:true |
| `check-proof-row-manifests.mjs` | 0 | current PROOFS/a7ef0317; 0 missing |
| `validate-corpus.mjs --index` | 1 | **baseline** schema-manifest red |

Known baseline: expected `openclaw.proofs.manifest.v1`, got
`openclaw.k6.proofs-manifest.v1` on `origin/main`. Out of this lane.
