# Target-local artifact inventory

Every path below is inside this target corpus.

| Class | Paths | Count |
| --- | --- | ---: |
| Copied source corpus | All entries listed by [SOURCE-COPY-MAP.json](SOURCE-COPY-MAP.json) | 18 |
| Immutable row artifacts | `STALE-DIRECT-OPEN/*`, `CORRUPT-PENDING/*`, `WATCHDOG-REPAIR/*` | 12 |
| Source harness | `proof-harness.test.ts` | 1 |
| Target entry and method | `README.md`, `METHOD.md`, `RESOLVED-SHA.md`, `manifest.json` | 4 |
| Materiality | `MATERIALITY.md`, `NON-INTERFERENCE-MAP.md` | 2 |
| Exact-target Mode-B | `MODE-B-RECEIPT.json` | 1 |
| Source copy map and inventory | `SOURCE-COPY-MAP.json`, `ARTIFACTS.md` | 2 |
| Historical causal control | `CAUSAL-CONTROL/README.md`, public RED projection, public GREEN projection | 3 |

The target subtree contains 25 files. The source map records all 18 copied
counterparts and their source SHA-256
digests. The 12 row files and source harness are intentionally byte-identical.
The copied source-facing Markdown and manifest were made target-aware while
retaining every immutable execution identity and verdict boundary.

The causal logs are target-local public projections with private workstation
paths removed. No artifact path is a symlink, redirect, or dependency on an
earlier corpus directory.
