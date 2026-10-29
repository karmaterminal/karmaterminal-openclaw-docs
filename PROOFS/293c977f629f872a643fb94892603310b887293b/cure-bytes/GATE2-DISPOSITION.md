# Gate 2 disposition: `f4675cff00` → `293c977f62`

| | |
|---|---|
| checker | `feature-cores-byte-check.sh f4675cff00 293c977f62 --upstream 8ea3ef8d86` |
| cores list | bootstrap `af12fd654e`, with #1754 tombstoning `system-prompt.ts` |
| result | 40 invariants: 16 FAIL, 16 exact-upstream, 5 tombstone, 3 PASS, 0 empty |
| merge base (PR head, U9) | `eb7a4b1574` |

**Status: proposed for frond cosign. NOT a Gate 2 pass.** Per the runbook, a failed core needs a frond decision: refire the cure, or accept-and-renotify-reviewer. The presentation head has not moved since `f4675cff` (2026-10-09). Since then, nine absorbs have landed (jump 1 through jump 9) together with reviewed fork fixes, so every core that changed is a deliberate change, not drift. This table is the case for accept-and-renotify-reviewer. Commit lists are in `core-commit-map.md`; the fork side is computed `^8ea3ef8d86`, so upstream commits are excluded.

## (A) Changed by named fork commits after `f4675cff` (12 paths)

| core | fork commits | intent |
|---|---|---|
| `tools/continue-work-tool.ts` | `c85de1e7f4` (carry #1469), `f80f1e5948` | reap orphaned continuation custody; keep operator policy custody for continuation wakes |
| `tools/continue-work-tool.test.ts` | `0bca87cd40`, `f80f1e5948`, `b852ec80db`, `519b5f3eb7` | #1469 fossils; operator-capture tests; mock-export settle |
| `tools/continue-work-tool.boundary.test.ts` | `519b5f3eb7` | check-test-mock-exports settle (test-only) |
| `tools/continue-delegate-tool.ts` | `c85de1e7f4`, `97b1f2bd65` | #1469 custody; restore upstream `sessions_spawn` attachment limits and base64 whitespace |
| `tools/continue-delegate-tool.test.ts` | `97b1f2bd65` | same restore |
| `tools/request-compaction-tool.ts` | `e3ed21bcc4` | tell the agent when volitional compaction commits a degraded summary |
| `tools/request-compaction-tool.test.ts` | `e3ed21bcc4` | same |
| `tools/request-compaction-tool.callsite-threading.test.ts` | `519b5f3eb7` | mock-export settle (test-only) |
| `tools/request-compaction-tool.classifier-emission.test.ts` | `519b5f3eb7`, `ec1921e4a0` | mock-export settle; closed logger mocks (test-only) |
| `tools/request-compaction-tool.volitional-threading.test.ts` | `519b5f3eb7`, `ec1921e4a0` | same (test-only) |
| `embedded-agent-runner/run.continuation-opts-forward.test.ts` | `a8db52a7a8` | port the opts-forward suite to the new runner seam |


## (B) Changed only through absorb merges (4 paths)

The upstream delta conflicted with the presentation head, so the checker cannot project it. Comparison used: the fork delta at the presentation head (`eb7a4b1574..f4675cff`) against the fork delta at the candidate (`8ea3ef8d86..293c977f62`), as changed lines with line numbers ignored.

| core | lines at P | lines at C | shared | P-only | C-only | reading |
|---|---|---|---|---|---|---|
| `embedded-agent-runner/compact.types.ts` | 3 | 3 | 3 | 0 | 0 | fork hunks preserved exactly; the remaining difference is upstream's delta |
| `embedded-agent-runner/run/params.ts` | 19 | 19 | 19 | 0 | 0 | preserved exactly |
| `embedded-agent-runner/compact-reasons.ts` | 45 | 46 | 45 | 0 | 1 | preserved; plus the `"unshrinkable_request"` union member, which tracks upstream #172912 (`5afc3db70f`, a reason added to upstream's map) |
| `embedded-agent-runner/compact-reasons.test.ts` | 43 | 41 | 3 | 40 | 38 | all 3 fork test cases are kept by name ("Unknown model → unknown_model", empty → unknown, closed union). Upstream turned its own cases into a table (it() 18 → 6), so the fork's lines were re-expressed in the new shape |
| `openclaw-tools.ts` | 5 | 29 | 5 | 0 | 24 | all 5 fork lines kept. The extra 24 are the PDF-tool construction moved into the fork owner module `openclaw-tools.pdf-tool.ts`, added in the jump-1 merge `049d5c58a4` (resolving that merge's conflict) |

Gate 2.7 at this candidate: FROZEN-STALE 0, MIXED-CLOBBER 0 (🌊's guard run).

## Asked of the frond

1. Dual-seat cosign: another seat re-derives (B) by path-c, independent recreation.
2. Rule: accept-and-renotify-reviewer for (A) and (B), or refire.
3. If accepted, renotify the reviewer on openclaw/openclaw#129388 with this table when the presentation advances.
