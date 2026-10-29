# Gate 2 disposition: `f4675cff00` → `08c37a1562`

| | |
|---|---|
| checker | `feature-cores-byte-check.sh f4675cff00 08c37a1562 --upstream 4fc73d6995` (receipt: `feature-cores-byte-check.08c37a1562.txt`) |
| result | 40 invariants: 16 FAIL, 16 exact-upstream, 5 tombstone, 3 PASS, 0 empty. **The same 16 FAIL files** as at `293c977f62` and P' `8ba08c76d8` |
| P' → F change in those 16 cores | 5 deleted lines (`forceRestartSafeTools` / `forceCodeModeTools` in `run/params.ts`; `readOnly: options?.forceRestartSafeTools` in `openclaw-tools.ts`). Upstream deleted exactly these lines between U9 and U11 (its #185730 restart-recovery removal), so this is upstream content carried faithfully, not a fork change |

Groups (A) and (B) therefore carry from the `293c977f62` / P' dispositions (🌊 `1565185387293577258`). Group (C), the #1499 announce-reader hunks, carries from P' (🌊 `1565264257996693626`).

## (D) Post-P' continuation additions ruled at F

**RULING (🌊, 2026-10-29 21:36:27Z, Discord `1565479457718800485`): accept-and-renotify-reviewer** for the +6 restart activation, the +9 continuation-held cleanup row, and the 44,526-line allocation. Each is a continuation-owned delta absent from U11, and the allocation names #129388 and keeps its fossils. This is a cure-byte disposition, not acceptance of the race semantics or a Gate 5 pass: 🌫's independent review and 🌻's completeness check still stand.

| file | owner | hunk | why |
|---|---|---|---|
| `src/agents/subagents/registry/subagent-registry.ts` | upstream | +6: `activateSubagentRegistry` awaits the restorer, then `settleOwnerlessContinuationChildren` | continuation-only restart custody (`2698bfd125`); 🌊 accepted the behavior (`1565380624808812646`) |
| `src/agents/subagents/registry/subagent-registry-lifecycle-bookkeeping.ts` | upstream | +9: `completeCleanupBookkeeping` keeps a delete-mode child's row while it holds live continuation custody | the subagent hop-2 race fix (`5a3835111a`, `08c37a1562`); 🌊 required it before the final matrix (`1565380624808812646`) |
| `config/test-lines-allocations/continuation-20261029.txt` | upstream mechanism, new file | allocation of 44526 test lines (the measured overage at this head against U11); ratchet GREEN | 🌊 approved one allocation (`1565405398964641943`) |

Each passes the counterfactual test: with continuation deleted, none of these hunks would exist. The #1499 announce-work regression fix (`f0d8a4a4dc`) touches fork-owned files only.

## (E) Absorb-era continuation footprint changes P' → F

**RULING (🌊, 2026-10-29 22:29:04Z, Discord `1565492697605869611`), a Gate 2 scope ruling, not Gate 5 or FF:**
- **Accept the seven counterfactual-passing (iii) rows as disclosed fork deltas**, subject to 🌻's independent classification check. The queue admission and routing, the fast-path display strip, and the sweeper test belong to continuation.
- **`412b3e5394`: accept the broader semantic explicitly.** Every superseded run stays `killed` but no longer marks the successor's `abortedLastRun`; that is what the session-wide field means. Do not describe it as continuation-only; show the upstream reviewer its generic test.
- **The D3b Vitest-list entry (`test/vitest/vitest.gateway-server-paths.mjs`): keep it, but disposition it separately** as fleet #1468's live-/stop regression guard, not as a continuation cure byte. It fails the continuation counterfactual and must be named separately in the reviewer packet.
- Rows (i), (ii) and (iv) stand as recorded. 🌻's E check and the corpus and Mode-B non-PASS decisions remain gates; presentation stays HOLD.

**Status: proposed, not ruled.** 🌻's review (bootstrap#1727 c6509086406) found that (D) lists only the hunks it rules. Other U11-owned files where the fork's lines changed between P' and F had no disposition. This section gives each one a row. Nothing here changes (D)'s ruling.

**Method.** An upstream-owned file is any path present in U11 `4fc73d6995` (61,055 paths). The fork footprint of a file is the set of added lines (`^\+[^+]`) in `git diff --no-renames -U0 <U> <head> -- <file>`, sorted as a multiset. It is taken at P' (U9 `8ea3ef8d86` → `8ba08c76d8`) and at F (U11 → `08c37a1562`), and the two are compared with `comm`, as in (B). 378 U11 paths appear in either diff: 346 have identical multisets and **32 changed**. None of the 32 is a primitive core or a (C) file, since their multisets are identical P' → F. `subagent-registry-lifecycle-bookkeeping.ts` is exactly (D)'s +9 and is excluded. `subagent-registry.ts` keeps a row for what remains after (D)'s +6. The allocation file is not in U11. **That leaves 31 files.** The workorder's 24-file starting list was missing eight of them: four files whose fork lines are all gone at F, three generated docs, and one test list. "#185730" below is upstream `9344233e7a`, absorbed in the j10 merge `977aa70b5f` (U10 `960debc517`). The j11 merge is `8bd20d2db0`.

**Checks.**
- **Removed lines.** The same comparison on removed lines (`^-[^-]`) differs in three more files: `subagent-registry-run-launch.ts`, `subagent-registry-sweeper.ts` and `auto-reply/reply/session.test.ts`. In each, the fork's added lines are unchanged. The removed lines changed only because upstream renamed or deleted them, and the fork's relocated copies follow upstream (`subagent-registry-run-launch-queued.ts`, `subagent-registry-sweep-collector-groups.ts`). These three are not rows.
- **Deleted files.** The fork deletes one U11 file, `test/tsconfig/tsconfig.core.test.messaging.json`, and it deletes the same file at P'.
- **Readings.** Every reading below was checked against the Git objects: a blame at P' or F for each changed line, its count at U9, P', U11 and F, and `git log -S` for upstream intent.
- **Generated rows.** Each generator was rerun at F, on a `git archive` of F using same-host dependencies from a checkout with an identical lockfile:
  - `config:docs --check`: OK;
  - `gateway:validators --check`: `predicates.js` unchanged;
  - `db:worker-inventory --check`: current;
  - `db:postgres --target canonical --verify`: passes for the whole directory.

  The fork's input to each generator is the same at both heads. The protocol schema delta is byte-identical (4 files, +309). The state catalog adds one table, and the port one fragment, both `continuation_records`, with identical SQL. The config baseline adds 17 core keys over upstream at both heads (2571 → 2588 and 2572 → 2589).

**Rulings searched:** this corpus, bootstrap#1727, and the lane workorders and merge messages. Discord itself could not be searched from this lane. Two 🌊 rulings bear on these files, and both cover (D) only: `1565380624808812646` (fix the race before the final matrix; restart custody accepted for continuation delegates only, per merge `9633c6678a`) and `1565479457718800485`. `1565364154875912254` retargets the FF to the j10 line; it is not a hunk disposition. **No located 🌊 ruling covers any class (iii) row below.** frond-scribe's j11 absorb workorder names `412b3e5394` and `e7ddc7f2ee` as "j10 follow-ups" to preserve. That is a lane instruction, not a Gate 2 ruling.

**Counterfactual** (🌊's rule, as quoted in the j10 and j11 workorders): delete continuation in your head; if our side would still be there, it isn't continuation, and upstream wins.

**Classes:** (i) kept, re-expressed; (ii) dropped, because upstream now owns or deleted the path; (iii) new or changed fork behavior; (iv) generated.

| file | P' | F | shared | P'-only | F-only | class | commits | reading |
|---|---|---|---|---|---|---|---|---|
| `src/agents/embedded-agent-subscribe.handlers.messages.stream.ts` | 13 | 24 | 10 | 3 | 14 | (iii), with (i) | `f781a6d873`; merge `977aa70b5f` | Upstream #186622 (`3aa99a57b6`) added a settled-prefix append fast path that skips the fork's display strip. The merge keeps the strip on the canonical parse and records the pre-strip text as the settled prefix (3 lines, (i)). `f781a6d873` takes the fast path only when that prefix was not stripped and the strip leaves the append unchanged (11 lines). **Counterfactual: passes**: every line serves `stripContinuationSignalFromDisplayText`. Ruling: none located. |
| `src/config/sessions/session-run-lifecycle-projection.ts` | 3 | 2 | 0 | 3 | 2 | (iii) | `412b3e5394` | A superseded run stays `killed` but is not an `abortedLastRun`. The predicate is the P' carry `ff556745e4` minus upstream's deleted `interruptedForRestart`. The j10 merge dropped it, because its restart-recovery purpose (karmaterminal/openclaw#1462) left with #185730. `412b3e5394` restored it for the D3a continuation-wake fossil (a wake that yields to a newer writer must not mark the next turn interrupted). **Counterfactual: passes**: with continuation deleted, the merge's own resolution drops it. **Scope flag:** it applies to every run upstream's session controller supersedes, not only continuation wakes. Ruling: none located. |
| `src/gateway/server-restart-sentinel.ts` | 24 | 31 | 17 | 7 | 14 | (iii), with (i) and (ii) | merge `977aa70b5f` | Upstream #185730's body is kept verbatim: legacy inference rows stay inert and produced media is replayed. Ahead of it, rows that `isContinuationSessionDelivery` admits go to the fork delivery core (new, (iii)). The fork's optional `queueContext`/`stateDir` from P' is rewired onto upstream's new body ((i)). At P' the fork core took every non-media row; that takeover is gone ((ii)). **Counterfactual: passes**: the predicate matches only fork-written rows (see `records.ts`). Ruling: none located. |
| `src/infra/session-delivery-queue-recovery.ts` | 68 | 71 | 68 | 0 | 3 | (iii) | `4d088cd22c` | #185730 drains and recovers only produced-media rows. Both gates here also admit `isContinuationSessionDelivery` rows; before this fix, continuation returns sat pending forever (RED at `977aa70b5f`, per the commit). **Counterfactual: passes.** Ruling: none located. |
| `src/infra/session-delivery-queue-runtime.ts` | 256 | 265 | 253 | 3 | 12 | (iii) | `4d088cd22c`, `e7ddc7f2ee`; merge `977aa70b5f` | `4d088cd22c` (5 lines): the arm gate also admits continuation rows. `e7ddc7f2ee` (7 lines): `armSessionDelivery` reports whether it scheduled the row, and the fork's periodic pending sweep (`a7b8b0a9dc`) counts only those, so inert legacy rows no longer use up its 256-row budget. P'-only 3: the records import, which is now upstream's shape. **Counterfactual: both pass.** The sweep is a continuation fix, and the count matters only because `4d088cd22c` leaves inert rows unarmed. The sweep also arms upstream produced-media rows, as it did before P'. Ruling: none located (`e7ddc7f2ee` is a "j10 follow-up" in the j11 workorder). |
| `src/infra/session-delivery-queue.records.ts` | 55 | 68 | 55 | 0 | 13 | (iii) | merge `977aa70b5f` | New `isContinuationSessionDelivery`. It admits `postCompactionDelegate` rows, and `systemEvent` rows that carry `awaitPromptAdoption` or a legacy `continuation-return:` key. **Counterfactual: passes**: none of those markers exists at U11, and every non-test writer of `awaitPromptAdoption: true` is under `src/auto-reply/continuation/`. Ruling: none located. |
| `src/agents/subagents/registry/subagent-registry-sweeper-lifecycle.test.ts` | 0 | 2 | 0 | 0 | 2 | (iii), test only | `5dbefc02b5` | #185730 rewrote "joins retirement" to assert the archive delete inside a fake-timer advance. The fork's delete guard (`callGatewayForSweep`) reads durable continuation custody first, so the case now waits for the delete. Assertions are unchanged. **Counterfactual: passes** (the commit reports the same bytes passing at U10). Ruling: none located. |
| `test/vitest/vitest.gateway-server-paths.mjs` | 11 | 12 | 11 | 0 | 1 | (iii), test only | `21ef1297a3`, `c66bbae2ad`; merges `977aa70b5f`, `8bd20d2db0` | Lists `session-restart-resume.live-stop.test.ts`, the fork fossil that re-proves D3b (a live /stop is never resumed) on upstream's graceful-restart path. **Counterfactual: fails, so this is not continuation.** D3b is the fleet's carry for /stop versus restart recovery (karmaterminal/openclaw#1468, `3843b62548` "carry fleet D3b"). The fossil would still exist with continuation deleted. Needs an owner decision. Ruling: none located. |
| `src/agents/subagents/registry/subagent-registry.ts` (after (D)'s +6) | 97 | 70 | 60 | 37 | 10 | (i), with (ii) | `dd4578b66f`, `2698bfd125` ((D)); merge `977aa70b5f` | **F-only 10.** Five are (D)'s activation hunk: the import, `runSubagentRegistryActivation(async …)`, `await subagentRestorer.activate()`, `await settleOwnerlessContinuationChildren(…)`, and upstream's new `bindGatewayContextResolver` re-indented inside the fork's latch. The other five re-express the F2 armed-resume fence after #185730 dropped `resumeSubagentRun`'s `source` parameter: three comment lines, `deferArmedSubagentResume(entry, …)` and `resume: (runId) => …`. **P'-only 37.** Two are replaced inside (D)'s activation body, and five are re-expressed as above. The other 30 are restore-only branches retired with upstream's deletions: orphan resume, the retained-delivery bypass, the resume reader and the queued-launch replay. |
| `src/agents/subagents/registry/subagent-registry.test.ts` | 11 | 8 | 7 | 4 | 1 | (i) | `3d62ea68ea`, `b38294f692`; merges `977aa70b5f`, `8bd20d2db0` | The fork keeps the restore-retry case in its line-cap test-support, as at J9. The call now passes upstream's `activateRegistry`, since #185730 removed `hydrateAndActivateRegistry`. |
| `src/agents/subagents/registry/subagent-registry-completion-runtime.test.ts` | 17 | 16 | 16 | 1 | 0 | (i) | merge `977aa70b5f` | The fork case "resumes canonical terminal cleanup after two persistence failures" (`b46d31a327`) is kept. Its one `scheduleSweep` assertion is gone, because #185730 removed `scheduleSweep` from the completion runtime and its harness. |
| `src/agents/subagents/spawn/subagent-spawn-collector.ts` | 139 | 133 | 130 | 9 | 3 | (i) | merge `977aa70b5f` | The H1 launch idempotency key is now `swarmLaunchIdempotencyKey ?? childRunId`. Its `queuedLaunch` branch went with upstream's queued-launch replay (#185730), and the comment drops "by restore". |
| `src/auto-reply/reply/session-event-context.ts` | 7 | 2 | 1 | 6 | 1 | (i) | merges `977aa70b5f`, `8bd20d2db0` | The fork's `replyExpectation` option is kept. #185730 moved `readmissionAttempt` out of the options union into a parameter, so the union fits on one line again. |
| `src/gateway/agent-turn/agent-run-execution-phase.ts` | 13 | 15 | 13 | 0 | 2 | (i) | merge `977aa70b5f` | #185730 dropped `canUseInternalRuntimeHandoff` from `StartAgentRunExecutionParams`; its only upstream reader was the deleted restart-recovery context. The fork re-declares the field on its own continuation params type, so `resolveAgentRunContinuationHandoff` keeps the same trust input. Upstream's preflight still computes it. |
| `src/infra/session-delivery-queue.recovery.test.ts` | 210 | 215 | 209 | 1 | 6 | (i) | `9b29be26b1`, `c8497e6b99`; merge `977aa70b5f` | #185730 recovers `agentTurn` rows only when they carry produced media, so the fork case now seeds a produced-media row. It is renamed to what it proves: the trigger and trusted trace survive recovery exactly once. Assertions are unchanged. Upstream's replay starts no model turn, so the test no longer proves that a turn runs (see the agent-delivery row). |
| `src/agents/agent-command.ts` | 6 | 4 | 4 | 2 | 0 | (ii) | merge `977aa70b5f` | #185730 removed the restart delivery-claim tracking. The fork-moved `trackedRestartRecoveryDeliveryClaim` line and its comment (`1b92f87c41`) went with it. |
| `src/agents/subagents/registry/subagent-registry-restore.ts` | 12 | 0 | 0 | 12 | 0 | (ii) | none since P': `977aa70b5f` took U10, which equals U11 | F equals U11 byte for byte. #185730's restore only hydrates history, so the fork's spawn-custody skip (`203d9e341b`, `1ef417495b`) has nothing left to guard. |
| `src/agents/subagents/registry/subagent-registry.persistence.resume.test.ts` | 88 | 0 | 0 | 88 | 0 | (ii) | none since P': `977aa70b5f` took U10 | F equals U11. #185730 replaced the restart-resume suite, and the fork's restart-case edits retired with those cases. Its live fossil "persists completion-time all-recipient authority selection on the authoritative run" moved to the fork-owned `subagent-registry.persistence.continuation-return.test.ts`. At F it has the same four `expect`s, on a re-based harness. |
| `src/agents/subagents/registry/subagent-registry.persistence.test.ts` | 6 | 4 | 4 | 2 | 0 | (ii) | merge `977aa70b5f` | Upstream's #185730 rewrite is taken. The imports of two upstream helpers the fork had moved into test-support (`3203237bd7`) are gone. The fork's `hydrateContinuationCustody` insert is unchanged. |
| `src/auto-reply/reply/agent-runner-run.ts` | 39 | 19 | 19 | 20 | 0 | (ii) | merge `977aa70b5f` | #185730 replaced the restart-recovery source read and claim controller with `createReplyInputAdmission`. The fork's `readReplyRestartRecoverySource` extraction (`049d5c58a4`) retired with them, and its module is gone at F. One import line is now upstream's. The fork's continuation-controller lines are unchanged (the 19 shared). |
| `src/auto-reply/reply/reply-turn-admission.ts` | 2 | 0 | 0 | 2 | 0 | (ii) | none since P': `977aa70b5f` took U10 | F equals U11. #185730 deleted the restart-recovery owner-claim block that held the D3b guard `isMainSessionCurrentGenerationStop` (`3843b62548`). Upstream's resume path owns the invariant now, re-proved by `21ef1297a3` (see the vitest row). |
| `src/gateway/server-restart-sentinel-agent-delivery.ts` | 23 | 0 | 0 | 23 | 0 | (ii) | none since P': `977aa70b5f` took U10 | F equals U11. #185730's queue replays produced media from the host and starts no completion turn. The fork's `continuationTrigger` and traceparent on that turn (`2273ef64d5`) retired with it, so after a restart a media completion's continuation trigger no longer reaches a turn. The j10 absorb recorded this as continuing on upstream semantics, with re-delivery across a restart left as a product follow-up. |
| `src/infra/session-delivery-queue-storage.ts` | 351 | 350 | 350 | 1 | 0 | (ii) | merge `977aa70b5f` | #185730 deleted `advanceSessionDeliveryAgentRun` (restart inference replay), and the fork's doc comment on it went too. |
| `src/infra/session-delivery-queue.worker.ts` | 76 | 74 | 74 | 2 | 0 | (ii) | merge `977aa70b5f` | #185730 dropped the `lastChargedAgentRunAttempt` charge, and the fork's `safeEntry` rename of those lines (`c15749a11f`) went too. The fork codec still decodes the field on old rows (`4d088cd22c`). |
| `docs/.generated/config-baseline.counts.json` | 1 | 1 | 0 | 1 | 1 | (iv) | merge `977aa70b5f` | `config:docs:gen`. Core keys: 2571 → 2588 at P', 2572 → 2589 at F. That is the same +17 fork keys over upstream's +1. |
| `docs/.generated/config-baseline.sha256` | 2 | 2 | 0 | 2 | 2 | (iv) | merge `977aa70b5f` | `config:docs:gen`; the two hashes follow the baseline. |
| `docs/reference/database-schemas/worker-access-inventory.md` | 85 | 26 | 18 | 67 | 8 | (iv) | merges `977aa70b5f`, `8bd20d2db0` | `db:worker-inventory:gen`. It was the j11 merge's one textual conflict and was regenerated. It inventories the source tree at each head, so its rows move with upstream (#185730, #186457, #187313) and with the fork modules retired above. |
| `packages/gateway-protocol/src/compiled/protocol.generated/predicates.js` | 6792 | 6783 | 5039 | 1753 | 1744 | (iv) | merge `977aa70b5f` | `gateway:validators:gen`. The fork's schema delta is identical at both heads. The churn is regeneration over upstream schema changes (#185730, `4b952ced9a`, #186457). |
| `src/state/postgres-schema.generated/sqlite-state-catalogs.json` | 1 | 1 | 0 | 1 | 1 | (iv) | merge `977aa70b5f` | `db:postgres:gen` writes it as one JSON line. The fork adds only `continuation_records`, with the same SQL at both heads. |
| `src/state/postgres-schema.generated/sqlite-state-catalogs.ts` | 141 | 152 | 76 | 65 | 76 | (iv) | merge `977aa70b5f` | `db:postgres:gen`. |
| `src/state/postgres-schema.generated/state-port.json` | 109 | 109 | 17 | 92 | 92 | (iv) | merge `977aa70b5f` | `db:postgres:gen`. The fork adds one fragment, `continuation_records`, at both heads. The rest is offsets moved by upstream #186457 (state 36). |

**Owner decisions flagged:**

1. **Not continuation:** `test/vitest/vitest.gateway-server-paths.mjs`. It lists the D3b fossil `session-restart-resume.live-stop.test.ts`, a fork regression guard for a fleet carry, and it fails the counterfactual. Either rule it separately as a fleet-carry fossil, or leave it out of the continuation presentation.
2. **Continuation-motivated, not continuation-scoped:** `412b3e5394`. It passes the counterfactual, but it changes `abortedLastRun` for every superseded run. Either accept it as is, with the reviewer told, or narrow it to continuation wake runs.

For the reviewer, not as a flag: the `server-restart-sentinel-agent-delivery.ts` row records a restart behavior that the fork no longer provides.

**Asked of 🌊:**
1. Rule (E). Rows (i), (ii) and (iv) record continuation lines that were re-expressed, dropped or regenerated against U11. The seven (iii) rows that pass the counterfactual are new fork behavior, so each needs its own ruling. One of them, `412b3e5394`, also carries flag 2.
2. Decide the two flags above.
3. If accepted, renotify the reviewer on openclaw/openclaw#129388 with (D) and (E) when the presentation advances.

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
