# Identity semantics

This map is normative for every repeated SHA in the warm-target subtree.

| Identity | Semantic role | Containment rule |
|---|---|---|
| `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` | warm target / rebound corpus candidate | Active corpus paths, manifest target fields, row transposition target fields, and affected-slice receipts |
| `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` | immediate source corpus / source-ancestor qualification | Row `EVIDENCE.md` source labels, manifest source fields, promotion proof-corpus fields, source gate wrappers, and immutable `artifacts/gates/mode-b/` receipts |
| `c7131791a6d33ab83d1a820c7cdb81c1b1384931` | frozen qualified basis | Row qualification-basis labels, promotion proof-basis fields, c713 review, and immutable `artifacts/gates/mode-b-c713/` receipts |
| `37300f29a7ec1f731575343c2aa73ae25f1d0efb` | historical live execution | Row evidence/catalog packets and `artifacts/live/`; never a target identity |
| `a0aa4ec8aefe95ced34342978b64c270c16ec3e9` | pending exact-live runtime composite | Pending-runtime metadata and narratives only; `exact_live_execution` is false |

Raw ancestor receipts retain the field names emitted by their original tools.
Directory wrappers define their role: every 2ffc identity under
`artifacts/gates/mode-b/` is source-ancestor Mode-B, and every c713 identity
under `artifacts/gates/mode-b-c713/` is frozen-basis Mode-B. Neither directory
contains target Mode-B.

The promotion packet uses 2ffc as `proof_corpus_sha`, c713 as `proof_sha`, and
25051 as `presentation_candidate_sha`. It explicitly invalidates execution
transfer. Row catalog files use 37300 as the historical runtime candidate and
25051 only in their transposition target metadata.
