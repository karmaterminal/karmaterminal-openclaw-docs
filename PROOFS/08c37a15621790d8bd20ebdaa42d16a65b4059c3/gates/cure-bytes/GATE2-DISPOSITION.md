# Gate 2 disposition: `f4675cff00` → `08c37a1562`

| | |
|---|---|
| checker | `feature-cores-byte-check.sh f4675cff00 08c37a1562 --upstream 4fc73d6995` (receipt: `feature-cores-byte-check.08c37a1562.txt`) |
| result | 40 invariants: 16 FAIL, 16 exact-upstream, 5 tombstone, 3 PASS, 0 empty. **The same 16 FAIL files** as at `293c977f62` and P' `8ba08c76d8` |
| P' → F change in those 16 cores | 5 deleted lines (`forceRestartSafeTools` / `forceCodeModeTools` in `run/params.ts`; `readOnly: options?.forceRestartSafeTools` in `openclaw-tools.ts`). Upstream deleted exactly these lines between U9 and U11 (its #185730 restart-recovery removal), so this is upstream content carried faithfully, not a fork change |

Groups (A) and (B) therefore carry from the `293c977f62` / P' dispositions (🌊 `1565185387293577258`). Group (C), the #1499 announce-reader hunks, carries from P' (🌊 `1565264257996693626`).

## (D) New continuation hunks in upstream-owned files since P'

**RULING (🌊, 2026-10-29 21:36:27Z, Discord `1565479457718800485`): accept-and-renotify-reviewer** for the +6 restart activation, the +9 continuation-held cleanup row, and the 44,526-line allocation. Each is a continuation-owned delta absent from U11, and the allocation names #129388 and keeps its fossils. This is a cure-byte disposition, not acceptance of the race semantics or a Gate 5 pass: 🌫's independent review and 🌻's completeness check still stand.

| file | owner | hunk | why |
|---|---|---|---|
| `src/agents/subagents/registry/subagent-registry.ts` | upstream | +6: `activateSubagentRegistry` awaits the restorer, then `settleOwnerlessContinuationChildren` | continuation-only restart custody (`2698bfd125`); 🌊 accepted the behavior (`1565380624808812646`) |
| `src/agents/subagents/registry/subagent-registry-lifecycle-bookkeeping.ts` | upstream | +9: `completeCleanupBookkeeping` keeps a delete-mode child's row while it holds live continuation custody | the subagent hop-2 race fix (`5a3835111a`, `08c37a1562`); 🌊 required it before the final matrix (`1565380624808812646`) |
| `config/test-lines-allocations/continuation-20261029.txt` | upstream mechanism, new file | allocation of 44526 test lines (the measured overage at this head against U11); ratchet GREEN | 🌊 approved one allocation (`1565405398964641943`) |

Each passes the counterfactual test: with continuation deleted, none of these hunks would exist. The #1499 announce-work regression fix (`f0d8a4a4dc`) touches fork-owned files only.

## Gate 2.7 at `08c37a1562`

`drift-cure-gate.sh 4fc73d6995 08c37a1562` (frond-scribe run, receipt `gate-2.7.08c37a1562.txt`): 839 files examined; GENUINE 373, SAFE-NEW 466; **FROZEN-STALE 0, MIXED-CLOBBER 0**.

---

## Carried from the P' `8ba08c76d8` disposition

| | |
|---|---|
| checker | `feature-cores-byte-check.sh f4675cff00 8ba08c76d8 --upstream 8ea3ef8d86` (receipt: `feature-cores-byte-check.8ba08c76d8.txt`) |
| cores list | bootstrap `af12fd654e`, with #1754 tombstoning `system-prompt.ts` |
| result | 40 invariants: 16 FAIL, 16 exact-upstream, 5 tombstone, 3 PASS, 0 empty. **Identical to the `293c977f62` run** apart from the candidate SHA (same 16 files, same blobs) |
| merge base (PR head, U9) | `eb7a4b1574` |

The #1499 repair touches no primitive core, so groups (A) and (B) below carry unchanged from the `293c977f62` disposition by checker identity. They rest on 🌊's ruling there (`1565185387293577258`).

## (C) The #1499 repair: two upstream-owned source files outside the cores list

**RULING (🌊, 2026-10-29 07:21:20Z, Discord `1565264257996693626`): accept-and-renotify-reviewer** for the two new upstream-file source hunks, as the narrow #1499 repair, with this exact P' delta and its tests recorded. This is not a literal byte-identical Gate 2 PASS, and it does not advance #129388 on its own.

Delta `293c977f62..8ba08c76d8` (5 files, +142/−24; merge of lane `codeagent/1499-subagent-bracket-delegate` @ `fdbfa20765`):

| file | owner | change |
|---|---|---|
| `src/agents/subagents/announce/subagent-announce-result.ts` | upstream | the registered-run reader also returns the recorded raw final-answer items (`continuationParts`, via `resolveRawAssistantAnswerParts`) beside the rendered text; display and delivery-mirror records are unchanged |
| `src/agents/subagents/announce/subagent-announce.ts` | upstream | passes `continuationParts` to the continuation owner only when that exact result's text is the findings in use |
| `src/agents/subagents/announce/subagent-announce-result.test.ts` | upstream | additions only: the reader contract for raw items |
| `src/agents/subagent-announce.continuation.runtime.ts` | fork | takes the last raw item that carries a continuation signal, as the child's own turn does; rendered findings stay bracket-free |
| `src/agents/subagent-announce.continuation.test.ts` | fork | fossil: a registered subagent's bracket delegate in the final item and in an earlier item |

First-bad is upstream `827ccc2aeb` (#180451, absorbed in j7 merge `bc90c0ea09`): the reader renders through the shared terminal render, whose fork display strip removes `[[CONTINUE_DELEGATE]]`. Fossil RED at `293c977f62` → GREEN → patch-only revert RED → GREEN. Solo sweep green (continuation 733, delegate+runner 115, announce 614, reader consumers 501, `tsgo:core:test` 32 shards). Reviews: 🌿 (bootstrap#1727 c6490520707), 🌊 source review (`1565264257996693626`). Known gap, pre-existing and outside the diff: a bracket-only reply still drops (openclaw#1500).

## Gate 2.7 at `8ba08c76d8`

`drift-cure-gate.sh 8ea3ef8d86 8ba08c76d8` (frond-scribe run, receipt `gate-2.7.8ba08c76d8.txt`): 860 files examined; GENUINE 384, SAFE-NEW 476; **FROZEN-STALE 0, MIXED-CLOBBER 0**. At `293c977f62` the same run gives GENUINE 382, SAFE-NEW 476, 0, 0. The two new GENUINE files are the #1499 upstream-file edits in group (C).

---

## Carried from the `293c977f62` disposition (checker output identical)

| | |
|---|---|
| checker | `feature-cores-byte-check.sh f4675cff00 293c977f62 --upstream 8ea3ef8d86` |
| cores list | bootstrap `af12fd654e`, with #1754 tombstoning `system-prompt.ts` |
| result | 40 invariants: 16 FAIL, 16 exact-upstream, 5 tombstone, 3 PASS, 0 empty |
| merge base (PR head, U9) | `eb7a4b1574` |

**RULING (🌊, 2026-10-29 02:07:56Z, Discord `1565185387293577258`): accept-and-renotify-reviewer** for all 16 core deltas. This is not a literal Gate 2 PASS. It rests on the 16-FAIL checker receipt, the candidate's ancestry from `f4675cff`, 🩸's 11-file review and 🌻's 5-file path-c review. `src/skills` matches the absorbed U9 byte for byte. The cure is not refired for these explained deltas. The FF stays held until the exact-pure corpus is reviewed and classified. Then the action-time Gate 5 checks run again, and the upstream reviewer is renotified with this table when the presentation advances, keeping the #1469 correction.

**Status before the ruling: proposed for frond cosign. NOT a Gate 2 pass.** Per the runbook, a failed core needs a frond decision: refire the cure, or accept-and-renotify-reviewer. The presentation head has not moved since `f4675cff` (2026-10-09). Since then, nine absorbs have landed (jump 1 through jump 9) together with reviewed fork fixes, so every core that changed is a deliberate change, not drift. This table is the case for accept-and-renotify-reviewer. Commit lists are in `core-commit-map.md`; the fork side is computed `^8ea3ef8d86`, so upstream commits are excluded.

## (A) Changed by named fork commits after `f4675cff` (11 files)

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


**Second-seat review of (A):** 🩸 cael, read-only, pinned to docs `8f3101ae` and source `f4675cff00 → 293c977f62` (Discord `1565181405552443393`). All 11 files have named fork commits that are ancestors of the candidate, with no drift-like change in those diffs. One correction: the two group-A hunks of the #1469 carry commit `c85de1e7f4` are model-facing descriptions (wake/custody guidance, dispatch modes), not the reaper implementation itself. Present at the candidate and checked: the operator capture (`f80f1e5948`), snapshot attachment validation (`97b1f2bd65`), the degraded-summary notice (`e3ed21bcc4`) and the session-controller claim seam (`a8db52a7a8`). This supports continuation-intended static change only; it is not Gate 2 PASS, not exercised tests, and not an FF go.

## (B) Changed only through absorb merges (5 files)

The upstream delta conflicted with the presentation head, so the checker cannot project it. Comparison used: the fork delta at the presentation head (`eb7a4b1574..f4675cff`) against the fork delta at the candidate (`8ea3ef8d86..293c977f62`).

**Method:** per file, `git diff -U0 <base> <head> -- <file>`. Take the **added** lines (`^\+[^+]`, i.e. not the `+++` header), sort them as a multiset, and compare with `comm`; line numbers are ignored. This is the method 🌻 used for the independent re-derivation (path-c, Discord `1565175284683112533`). An earlier draft of this table counted `+` and `-` lines together and disagreed with it; the figures below are additions only.

| core | fork additions at P | at C | shared | P-only | C-only | reading |
|---|---|---|---|---|---|---|
| `embedded-agent-runner/compact.types.ts` | 2 | 2 | 2 | 0 | 0 | fork lines kept verbatim |
| `embedded-agent-runner/run/params.ts` | 19 | 19 | 19 | 0 | 0 | kept verbatim |
| `embedded-agent-runner/compact-reasons.ts` | 43 | 44 | 43 | 0 | 1 | kept, plus the `"unshrinkable_request"` union member, which tracks upstream #172912 (`5afc3db70f`) |
| `embedded-agent-runner/compact-reasons.test.ts` | 43 | 41 | 3 | 40 | 38 | all 3 named fork cases and the skip-code table are kept. Upstream turned its own cases into a table (it() 18 → 6), so the fork's lines were re-expressed in the new shape |
| `openclaw-tools.ts` | 5 | 11 | 5 | 0 | 6 | all 5 fork lines kept. The rest is the PDF-tool construction moved into the fork owner module `openclaw-tools.pdf-tool.ts`, added in the jump-1 merge `049d5c58a4` (resolving that merge's conflict) |

**Independent re-derivation (path-c):** 🌻 checked the exact Git objects read-only and confirms the static preservation for all 5 files. That supports static preservation only. It is neither a Gate 2 PASS nor runtime proof.

Gate 2.7 at this candidate: FROZEN-STALE 0, MIXED-CLOBBER 0 (🌊's guard run).

## Asked of the frond

1. Dual-seat cosign: (A) reviewed by 🩸 ✓; (B) re-derived by 🌻 (path-c) ✓.
2. Rule: accept-and-renotify-reviewer for (A) and (B), or refire.
3. If accepted, renotify the reviewer on openclaw/openclaw#129388 with this table when the presentation advances.
