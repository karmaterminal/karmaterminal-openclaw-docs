# Artifacts

## In this packet

| path | what |
|---|---|
| `R-CD-RECIPIENT-AUTHORITY/emeric/authority-row-20261105T060708Z/` | the gate-3 run's 33 public files, byte-identical to the bundle: per case, `case-receipt.json`; for the 10 fired delegates, also `continuation-trace-correlation.json` and `tempo-trace-<id>.json` (the public Tempo projection) |
| `R-CD-RECIPIENT-AUTHORITY/emeric/authority-row-20261105T060708Z.sha256` | sha256 of those 33 files, relative to that directory (`sha256sum -c` from inside it) |
| `R-CD-RECIPIENT-AUTHORITY/LANE-REGRADE.json` | this lane's reproduction of the grade and the trace-structure checks (not a verdict authority) |
| `gates/GATE-3-R-CD-RECIPIENT-AUTHORITY.md` | the Gate 3 receipt |
| `gates/GATE-4-MODE-B-AND-LOCAL-SHARDS.md`, `gates/gate-4-summary.json` | the Gate 4 receipt, summaries only |
| `gates/FOLD-SOURCE-REVIEW.md` | the j12′ fold source-review receipt |
| `<row>/EVIDENCE.md` | one per required row; all 37 say `missing`: 36 not fired at this SHA, and `R-CD-RECIPIENT-AUTHORITY`'s, not folded, records its gate-3 PASS-candidate |

## Source bundles

| bundle (MinIO, `frond` alias) | sha256 | copied here? |
|---|---|---|
| `frond/thornfield-artifacts/proof-runs/2026-11-05/rra-e0b97a595e89973b-public.tar.gz` | `7e29caf5310e877b4dcd5755c1719389b2b929237cfe14d686491ce04da06409` | yes, in full: all 33 files are public-safe |
| `frond/thornfield-artifacts/proof-runs/2026-11-05/j12prime-gate4-local-a22bd9c0/gate4-evidence-a22bd9c0.tar.gz` | `cf7644f755ede925b201bf5bcb6f8bf654dd08404507d008b0d181a476981166` | no: 13 MB of raw test output with local paths (shard logs, counterfactual logs, the runner scripts and the failing-set lists). Summaries only here |

The gate-3 run's private side (raw evidence, gateway logs, session keys, delivery and flow ids) is
in neither bundle, and nothing of it is here. MinIO is a single replica, so the sha256
values above are the binding identity.
