# Identity semantics

This map is normative for every repeated SHA in the final-target subtree.

| Identity | Semantic role | Containment rule |
|---|---|---|
| `aff9807b34ba2ee4e7bcfd7081ee623c64a219a2` | final target / rebound corpus candidate | Active corpus paths, manifest target fields, row transposition target fields, and final maintenance materiality metadata |
| `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` | immediate source corpus / frozen warm basis | Warm affected-slice packet, source mapping, final materiality basis, and a0aa ancestry; never exact aff execution |
| `353d76c565c4da43693d41f3454825d48c38e354` | ordinary merge | Topology metadata and final materiality report only |
| `c841a9958abc8344b37ce5c6c5a06bec4cfa6b91` | pinned upstream parent of ordinary merge | Final materiality topology and exact-upstream comparison only |
| `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` | ancestor source corpus / source-ancestor qualification | Immutable warm promotion fields, ancestor qualification sections, source gate wrappers, and `artifacts/gates/mode-b/` receipts |
| `c7131791a6d33ab83d1a820c7cdb81c1b1384931` | frozen qualified basis | Row qualification-basis labels, promotion proof-basis fields, c713 review, and immutable `artifacts/gates/mode-b-c713/` receipts |
| `37300f29a7ec1f731575343c2aa73ae25f1d0efb` | historical live execution | Row evidence/catalog packets and `artifacts/live/`; never a target identity |
| `a0aa4ec8aefe95ced34342978b64c270c16ec3e9` | exact functional-live runtime composite | Exact R-CW-1 functional packet only; contains 250, not aff; observability remains `PARTIAL-candidate` |

Raw ancestor receipts retain the field names emitted by their original tools.
Directory wrappers define their role: every 2ffc identity under
`artifacts/gates/mode-b/` is source-ancestor Mode-B, and every c713 identity
under `artifacts/gates/mode-b-c713/` is frozen-basis Mode-B. Neither directory
contains target Mode-B.

The immutable warm promotion packet uses 2ffc as `proof_corpus_sha`, c713 as
`proof_sha`, and 25051 as `presentation_candidate_sha`. It explicitly
invalidates execution transfer. The final maintenance packet uses 25051 as its
basis and aff980 as its target. Row catalog files use 37300 as the historical
runtime candidate and aff980 only in rebound transposition target metadata.
No receipt claims exact aff Mode-B or execution.
