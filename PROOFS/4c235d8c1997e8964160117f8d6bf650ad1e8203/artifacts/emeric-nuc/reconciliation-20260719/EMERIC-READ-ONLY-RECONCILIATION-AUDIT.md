# Emeric read-only reconciliation audit — exact candidate `4c235d8c`

Evidence anchors: Elliott publication `7230ffcf04de09ee567cbcd273f7de6d9aed2ae4`, Silas comparator publication `d9fb2fd9807912b6f7c9b25a3e9ec0bd66938e51`, and additive Silas ledger `5c0a153350e76449454a5bd13761e899d6b4a1cc`. At publication time, server `main` resolved to `10fe10da42535175aa79f48018bdb9266b22bfa7`, whose first parent is `5c0a1533` and whose proof-relevant delta is the R-OBS-STATUS harness repair. No proof fire, recovery, reset, or runtime/queue mutation was performed by this audit.

## Verdict

The deliberate combined canonical floor is unchanged from the conservative Elliott-derived rollup:

- **PASS:** `R-CW-5`, `R-CW-6`
- **FAIL:** `R-OBS-1`
- **PARTIAL:** the other 32 rows
- Rollup: **2 PASS / 32 PARTIAL / 1 FAIL / 0 HONEST_LIMIT / 0 missing**

This numerical equality does **not** make the current canonical corpus reconciled. The current manifest/index are still Elliott-only, mislabel Elliott's primary as comparator, omit Silas from the row-level canonical reasoning, and lack an independent reconciliation receipt.

## 1. Integrity and one-fire verification

- Elliott primary ledger: SHA-256 `cba55c7b0fc7365041385a4e9048b2a0d7729b57265ef3e60190915d70e695f4`; 35 rows, 35 unique row IDs, 35 unique run IDs, candidate/docs identity uniform, role uniformly `primary`, and `behavior_refired=false` for every row. Separate preflight makes 36 executions.
- Elliott/Silas read-only crosswalk: SHA-256 `897d3ef8830234010b4b85030eb3d7c73a5d393904a9a43b436b88b71581f927`; 35 rows.
- Silas published row ledger at `5c0a1533`: SHA-256 `9fdfe6a7577b11ba5c45ada2b13c289c4f4eb8422b9bf5078598b821b4bcf24c`; 35 unique rows/run directories, every row `refireAllowed=false` and `canonicalFoldAllowed=false`.
- Silas bundle checksum envelope: `checksums.sha256` SHA-256 `356f80829b86f7d069c9c75d1fe1eebef918efaabcd0684cf1c76cdcb68136be`; all **811/811** entries independently passed `sha256sum -c`.
- The server history is linear: `1303a03c` → `7230ffcf` → `d9fb2fd9` → `5c0a1533`. `7230ffcf` changed 397 files including 39 canonical surfaces; `d9fb2fd9` added 813 files and changed zero canonical surfaces; `5c0a1533` changed three additive Silas-ledger files and zero canonical surfaces.

### `R-CW-5/6` fixture non-fire receipts

Both seats have one successful exact-candidate fixture packet per row. Silas's first invocations exited 2 at the `0700` artifact-directory gate, with empty stdout and the exact error `artifact dir must not be group/world accessible (mode 0700 required)`. Source review confirms `prepareArtifactDir()` is called before readiness writes, candidate worktrees, production-module evaluation, Vitest, or fixture state creation. The replacements exited 0 and are therefore the sole behavioral executions. The initial calls are mechanically proven non-fires, not refires.

## 2. Seat-preserving 35-row crosswalk

Legend: `E` = Elliott primary canonical classification at `7230ffcf`; `S` = Silas comparator reviewed classification; `C` = deliberate combined verdict.

```text
row                                  E        S             comparison class                                  C
R-CD-1                               PARTIAL  PARTIAL       trace-contract/acquisition                        PARTIAL
R-CD-2                               PARTIAL  PARTIAL       behavior/authority + trace acquisition             PARTIAL
R-CD-3                               PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CD-4                               PARTIAL  PARTIAL       trace-contract/acquisition                        PARTIAL
R-CD-CHAINED-DEPTH-2                 PARTIAL  PARTIAL       trace-contract/acquisition                        PARTIAL
R-CD-COLLECTION-ON-COLLAPSE          PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CD-MODEL-CHAINED-ALT               PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CD-MODEL-DEFAULT                   PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CD-MODEL-TOKEN                     PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CD-MODEL-TOOL                      PARTIAL  PARTIAL       behavior/authority                               PARTIAL
R-CD-RETURN-OVERLAP                  PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CD-SILENT                          PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CD-TOKEN                           PARTIAL  PARTIAL       harness-selection                                PARTIAL
R-CONFIG-DEFAULTS                    PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CONFIG-INTERSESSION                PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CW-1                               PARTIAL  PARTIAL       artifact-late behavior + settled trace-contract    PARTIAL
R-CW-2                               PARTIAL  PASS          behavior/receipt divergence                       PARTIAL
R-CW-3                               PARTIAL  PARTIAL       behavior/authority + trace-contract               PARTIAL
R-CW-4                               PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CW-5                               PASS     PASS          agreement                                         PASS
R-CW-6                               PASS     PASS          agreement                                         PASS
R-CW-7                               PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CW-DELEGATE-CHILD-LIVE             PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CW-DELEGATE-SELF-CONTINUATION      PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CW-DELEGATE-TOKEN                  PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CW-MULTI                           PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CW-MULTI-COLLAPSE                  PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-CW-TOKEN                           PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-OBS-1                              FAIL     PASS          authoritative seat/policy divergence               FAIL
R-OBS-2                              PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-OBS-STATUS                         PARTIAL  PARTIAL       shared harness-selection BAD_PROOF                PARTIAL
R-RC-1                               PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-RC-2                               PARTIAL  HONEST_LIMIT  authority/policy divergence                        PARTIAL
R-REGRESSION-TRAP-TESTS              PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
R-TRACE-REDACTION-1121               PARTIAL  PASS          candidate-behavior agreement; primary authority debt PARTIAL
```

Category totals from the immutable inputs: 23 concordant PASS-candidates, five concordant PARTIALs, three shared-behavior/trace-posture splits, and four specific divergences (`R-CW-2`, `R-OBS-1`, `R-OBS-STATUS`, `R-RC-2`). No row qualifies for promotion solely as `artifact-late`: `R-CW-1` did acquire its late wake, but the settled trace still has `UNSET` statuses, two fire spans, and a wrong causal parent.

## 3. Required deep review

- `R-CD-CHAINED-DEPTH-2`: both seats observed parent dispatch, child and grandchild spawn, both sentinels, chain return, and depth 2. Silas's settled validator rejected `continuation.delegate.dispatch` status/topology; Elliott never acquired a valid trace. **PARTIAL, trace-contract/acquisition.**
- `R-CD-4`: both seats observed the target-only return contract (`return_in_target=true`, `return_in_parent=false`). Silas's settled trace failed non-OK dispatch status; Elliott's trace remained missing. **PARTIAL, trace-contract/acquisition.**
- `R-CD-MODEL-TOOL`: both seats requested `openai/gpt-5.6-luna`, accepted dispatch, and saw the parent scheduled sentinel, but neither received child session/model metadata or a return in about 180 seconds. This is unavailable authority, not a proved model mismatch. **PARTIAL, behavior/authority.**
- `R-CD-TOKEN`: both seats stopped before dispatch because the carrier was `message-body`, not scanner-supported raw final text. No parser, queue, spawn, return, or Tempo receipt exists. **PARTIAL, shared harness-selection defect; zero behavioral fire.**
- `R-OBS-1`: Elliott's primary disposable session lacked the required `session_status` tool and produced explicit `FAIL-candidate`; Silas independently observed the full status card and passed. This is a genuine seat-policy/tool-inventory divergence, not proof of a core status regression. The primary failure cannot be averaged away. **FAIL**, with the reason explicitly framed as a primary required-tool precondition failure and comparator PASS.
- `R-OBS-STATUS`: both seats fetched identical source SHA-256 `7dd1f0c6d5d411f85fbcf4e3c68bee8b6e750b33c67b097889f15347f7d1f5bc`; both failed to extract the formatter, so neither required assertion ran. **PARTIAL/BAD_PROOF, shared harness-selection defect; no product verdict.** The expected product contract does account for omission: an all-zero state returns `undefined` and must render no continuation line; a non-zero active state must render the line. Merge `10fe10da` repairs the stale source path/extractor and adds both assertions as source-contract tests. That repair does not retroactively change the historical BAD_PROOF receipts.
- `R-RC-2`: Silas has a valid seat-local HONEST_LIMIT: child history exists, the `request_compaction` toolResult is invocation-bound, status `rejected`, guard `context_threshold`, and the matching child report is present. Elliott lacks child history and the invocation-bound toolResult. Silas's receipt validates **Silas HONEST_LIMIT only**; it cannot replace Elliott's missing authority. **Combined PARTIAL.**

## 4. Harness-versus-product triage

- **A — confirmed harness defect:** `R-OBS-STATUS`. Both historical attempts are BAD_PROOF because the harness fetched the stale aggregator and could not extract the moved formatter. Docs issue #438 tracks it. Merge `10fe10da` changes the manifest to `src/status/status-continuation-line.ts`, uses brace-balanced function extraction, and adds source-contract coverage. The merged tests pass **9/9**, including the required all-zero omission and active-line rendering cases. Manual execution is unnecessary for this historical classification; a fresh proof attempt may validate the repaired harness separately.
- **A — harness/authority debt, not product regression:** `R-CD-TOKEN`, `R-CD-MODEL-TOOL`, the trace-contract rows, and `R-CW-2`. Their receipts do not yet establish a candidate-code regression.
- **Mixed PASS/FAIL requiring discrimination:** `R-OBS-1`. Elliott's primary failed because the disposable session did not expose the required `session_status` tool; Silas passed the full card. Docs issue #439 tracks the proof-session/tool-policy problem. Before any product issue, compare the exact tool-policy/config receipts and journal sequence: expected is tool inventory admitting `session_status`, tool invocation start/result, then the rendered status card. Elliott proves the first precondition failed; Silas proves the product path can work. This is not yet a confirmed B-class `karmaterminal/openclaw` regression.
- **Honest limit:** `R-RC-2`. Preserve Silas's invocation-bound `context_threshold` rejection as seat-local HONEST_LIMIT, but keep combined PARTIAL until another independent attempt begins above 70% context pressure and produces its own child/tool/return authority.
- **B — confirmed product regression:** none established by this reconciliation packet. Open a `karmaterminal/openclaw` issue only if a controlled, authority-complete attempt shows the expected product log/return path missing after harness and seat-policy causes are excluded.

## 5. Exact canonical-surface change required

Minimum deliberate reconciliation touches the same 39 canonical surfaces that Elliott's premature publication changed, plus adds immutable reconciliation receipts and regenerates validation/checksums. No source packet should be deleted or renamed.

### `PROOFS/INDEX.json`

Keep candidate paths and rollup unchanged, but change:

```text
execution_seat:   "elliott-legion" → "elliott-legion + silas-lothric"
publication_role: "comparator"     → "combined-reconciliation"
owner_policy:     "canonical owners preserved; Elliott is comparator only"
               → "canonical owners preserved; Elliott primary and Silas comparator independently reconciled"
```

Add a `reconciliation` object pinning commits `7230ffcf…`, `d9fb2fd…`, `5c0a1533…`; Elliott ledger `cba55c…`; Silas ledger `9fdfe6…`; Silas checksum manifest `356f80…`; crosswalk `897d3e…`; and this audit receipt. Point `validation_path` at the regenerated reconciliation validation packet. Rollup remains exactly `2/32/1/0`.

### Exact-SHA `proofs-manifest.json`

- Change `publication.schema` from comparator-publication to combined-reconciliation, `execution_role` to `combined-reconciliation`, and record both seats plus both ledgers.
- For every row, preserve the current Elliott artifact path but relabel its row object from `.comparator` to `.primary`, set its execution role to `primary`, and add a separate `.comparator` object pointing to the immutable Silas run directory/classification.
- Set combined `state` by the 35-row table above; keep rollup `pass=2`, `partial=32`, `fail=1`, `honest_limit=0`, `missing=0`.
- `R-OBS-1` must carry both `primary=fail` and `comparator=pass`, with the seat-policy divergence explicit. `R-RC-2` must carry `primary=partial`, `comparator=honest_limit`, `combined=partial`.
- Each row's `summary`, `notes`, and `supporting_docs` must cite both seat packets and the reconciliation reason, without moving or rewriting original receipt bytes.

### Other canonical surfaces

- Correct `execution-summary.json` and exact-SHA README from Elliott comparator to Elliott primary + Silas comparator + combined reconciliation.
- Regenerate all 35 row `EVIDENCE.md` files from the seat-preserving table.
- Add checksummed `reconciliation/primary-ledger.json`, `comparator-ledger.json`, `crosswalk.json`, and independent audit receipt; regenerate exact-SHA/current/index validation and concrete-secret scan.

## 6. Publication recommendation

**Use one reviewed reconciliation commit atop the fresh server head (at audit publication: `main@10fe10da42535175aa79f48018bdb9266b22bfa7`); do not revert to `1303a03c`.**

Proof: the evidence history is linear; all Elliott and Silas source packets are intact; the later evidence commits are additive; `10fe10da` changes only the R-OBS-STATUS harness/source-contract files; and the deliberate combined rollup is numerically identical to the current conservative floor. Reverting would negate 1,213 path changes across evidence, validation, canonical metadata, and the ledger, then re-add most of them, creating destructive churn without improving authority. A reconciliation commit can correct exactly the 39 canonical surfaces, add the audit receipts, and leave every immutable seat packet and publication-boundary mistake visible in ancestry.

This recommendation authorizes no push. It is evidence for figs/frond's explicit corrective choice only.
