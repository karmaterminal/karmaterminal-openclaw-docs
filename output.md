# PR #129388 warm-target proof corpus transposition

## Outcome

Published a complete, self-contained warm-target corpus at
`PROOFS/25051f3b77409c45f5ce71c3b3b05aae85b0f8f9/` and moved
`PROOFS/INDEX.json` to that exact target.

- Validated corpus-tree commit:
  `bbb54b28e09d43f4b7bab4b8a545513bb56d4d0d`.
- Target subtree: 578 regular files, 0 symlinks.
- Source mapping: 544/544 source files represented, 318 byte-identical and 226
  target-rebound, 0 missing.
- Row rollup: 41 total / 32 pass / 4 partial / 1 honest limit / 4 missing /
  0 fail.
- No docs-main push, product mutation, presentation mutation, PR-body/label/
  draft-state mutation, or new PR.

## Identity and qualification contract

| Role | Exact identity |
|---|---|
| Warm target | `25051f3b77409c45f5ce71c3b3b05aae85b0f8f9` |
| Immediate source corpus | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` |
| Frozen qualified basis | `c7131791a6d33ab83d1a820c7cdb81c1b1384931` |
| Pinned upstream parent | `80985b9663252da97bf8d67dd2cbeba0fa03aeea` |
| Historical live execution | `37300f29a7ec1f731575343c2aa73ae25f1d0efb` |
| Historical evidence source | `80311e8aa07fd560cb957475517c5ea18164541c` |
| Pending exact-live runtime | `a0aa4ec8aefe95ced34342978b64c270c16ec3e9` |
| Source docs base | `e19110e419b67118fd8e890f1f3075c51acd8e4d` |
| Mode-B workflow | `342cc9c6d190e1ba57d9995d29e394c993a3e79b` |

The pre-evidence local/tracking/server equality table is committed at
`artifacts/gates/NAMED-REF-CONTRACT.md`. The unchanged safe docs lane was
published at `e19110e419b67118fd8e890f1f3075c51acd8e4d` before evidence was
copied.

Warm qualification is `affected-slice-materiality`:

- `target_mode_b.exact = false`;
- `exact_target_execution = false`;
- owner set: 11 files / 686 assertions;
- independent subset: 11 files / 544 assertions;
- production types, full test types, and build pass;
- three generated snapshots are current.

The warm target intentionally has no exact-target Mode-B and no exact live
execution. Ancestor Mode-B and execution identities were not relabeled:

| Ancestor | Run | Result |
|---|---:|---|
| Source `2ffc7ca0...` | `32895790947` | `failure`: 165,696 passed / 39 failed / 9 load flakes / 32 deterministic |
| Frozen basis `c7131791...` | `32911065508` | `failure`: 167,237 passed / 21 failed / 3 load flakes / 18 deterministic |

The exact c713 review remains `APPROVE` with 1 file / 40 assertions and applies
only to c713 qualification identity.

## What changed

1. Full-copied all 544 files from source corpus `2ffc7ca0...`; target paths and
   target-candidate metadata now resolve inside the warm subtree.
2. Preserved historical row execution at `37300f29...` and documented every
   source, frozen-basis, execution, target, and pending-runtime SHA role in
   `artifacts/transposition/IDENTITY-SEMANTICS.md`.
3. Vendored the frozen c713 aggregate, all three red shard packets, the exact
   c713 review, and a 10-row source/frozen/upstream blob-identity ledger.
4. Preserved the 2ffc aggregate, classifications, controls, and raw receipts as
   source-ancestor evidence.
5. Rebound the existing warm applicability packet to local target paths while
   preserving its raw outputs and content-addressing.
6. Updated README, METHOD, CLAWSSWEEPER, RESOLVED-SHA, TRANSPOSED-FROM,
   ARTIFACTS, the manifest, and `PROOFS/INDEX.json`.
7. Preserved missing ownership: three rows under `karmaterminal/openclaw#1254`,
   backend disposition under #517, and the R-CW-6 partial under #516.

Final disposition:

- `REUSE`: immutable historical corpus plus bounded structural applicability;
- `INVALIDATE`: no ancestor execution transfer;
- `UNKNOWN`: none inside the declared affected slice after docs receipt
  closure.

## Validation

Repository proof contracts:

```text
node tools/k6-proofs/scripts/validate-corpus.mjs --sha 25051f3b77409c45f5ce71c3b3b05aae85b0f8f9
node tools/k6-proofs/scripts/validate-corpus.mjs --index
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
```

Results:

- Corpus validator: 10/10 target checks passed.
- Index validator: 4/4 checks passed; exact current target and rollup agree.
- Row manifests: 41 proof rows / 42 manifest entries, 0 missing and 0
  manifest-only rows.
- Scenario registry: 42 manifests / 35 scenarios; alignment passed.
- Telemetry contracts: 13 declared, 9 receipt-requiring rows, 0 invalid
  rebindable claims.

Deterministic local integrity scanner:

```text
node /home/figs/.copilot/session-state/6053dba0-4d8a-46b5-9073-e3c2bd24273f/files/validate-warm-corpus.mjs
```

Results:

- 256 JSON files and 54 JSONL files / 761 records parsed with 0 errors.
- 21 local Markdown links and 142 manifest-local references resolve inside the
  warm subtree.
- Source mapping is 544/544, unique and hash-current, with 0 errors.
- Stale source/predecessor corpus paths: 0.
- High-confidence sensitive-content matches: 0 files.
- Exact index, row rollup, missing ownership, qualification identities,
  affected-slice counts, and identity semantics all passed.

Checksum and immutable-receipt checks:

```text
(cd PROOFS/25051f3b77409c45f5ce71c3b3b05aae85b0f8f9 && \
  sha256sum -c artifacts/gates/SHA256SUMS)
(cd PROOFS/25051f3b77409c45f5ce71c3b3b05aae85b0f8f9/artifacts/promotion/25051f3b77409c45f5ce71c3b3b05aae85b0f8f9 && \
  sha256sum -c SHA256SUMS)
```

- Gate ledger: 167/167 entries verified.
- Promotion ledger: 4/4 entries verified.
- Frozen c713 packet: 26/26 raw aggregate/shard files byte-identical to the
  supplied run download.
- Frozen c713 review: byte-identical to the independent review receipt.
- Blob ledger: 10/10 paths match 2ffc, c713, and upstream df9 Git objects.
- Ancestry: 2ffc -> c713 -> 25051, 80985 -> 25051, and 25051 -> a0aa all
  verified.
- Both ancestor runs resolve to workflow head
  `342cc9c6d190e1ba57d9995d29e394c993a3e79b` and conclusion `failure`.

Independent committed-diff review reported no significant issues.

## CI path and remaining limit

Acceptance path: **focused-only**. This docs-only lane ran the repository corpus
contracts and deterministic integrity checks above. It did not dispatch an
exact warm-target Mode-B, run Gate 3g, or reinterpret either ancestor Mode-B
run as this lane's CI.

Exact live proof for runtime
`a0aa4ec8aefe95ced34342978b64c270c16ec3e9` remains explicitly pending until
the Ronan receipt.
