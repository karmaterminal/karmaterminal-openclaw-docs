# Corpus transposition

| Field | Value |
|---|---|
| Immediate source corpus / frozen warm basis | `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` |
| Final target corpus | `aff9807b34ba2ee4e7bcfd7081ee623c64a219a2` |
| Source docs commit | `b502fa7c445d45d0d31bde81f7a1d3cb3c9bed32` |
| Ordinary merge | `353d76c565c4da43693d41f3454825d48c38e354` |
| Pinned upstream parent | `c841a9958abc8344b37ce5c6c5a06bec4cfa6b91` |
| Qualification mode | `maintenance-materiality-reuse` |
| Historical evidence source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Historical live execution composite | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Exact-live runtime composite | `a0aa4ec8aefe95ced34342978b64c270c16ec3e9` |

Final target `aff9807b...` descends from ordinary merge `353d76c...`, whose
parents are warm basis `25051f3b...` and pinned upstream `c841a995...`, plus
three test-only semantic merge-repair commits.

The complete 595-file warm source subtree was copied here without links. Target
paths and candidate identity were rebound; historical source, execution,
ancestor Mode-B, c713 review, warm qualification, and exact a0aa runtime
identities were not rewritten. The prior source mapping remains immutable, and
the 250-to-aff mapping is a separate content-addressed artifact.

Final applicability comes only from the vendored materiality report at SHA-256
`da25ae8ec270dc2797fde6c56f9b35a5c799d718d76c3067a09c45f57465037e`.
Exact target Mode-B and exact target execution are both absent. Historical live
rows remain attributed to `37300f29...`. Runtime `a0aa4ec8...` retains exact
functional R-CW-1 `PASS-candidate` evidence and `PARTIAL-candidate`
observability on a runtime that contains 250 but not aff.
