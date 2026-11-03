# Independent review: harness sentinel echo fixes

Branch under review: `codeagent/harness-sentinel-audit` at `3283454de601a678d7bc0b328df8520852ad1531`

## Named refs

| Category | Ref | Full SHA / identity | Equality |
|---|---|---|---|
| Product/base ref | Docs base `7ac3e7b806b3f792c80327ca491743481f74725b`; product facts F′ | `f15237ec921879d918482cdf372b0718d4c1aab9` | F′ exists in the read-only product clone; clone HEAD is intentionally different (`599f7ba0...`) and was not checked out |
| Lane safe branch | `codeagent/harness-review-mai` | local `3283454de601a678d7bc0b328df8520852ad1531`, origin `3283454de601a678d7bc0b328df8520852ad1531` | equal |
| CI/workflow ref | N/A — this is a review-only lane | N/A | N/A |
| Presentation ref | N/A | N/A | N/A |
| Docs/proof ref | Audit/fix branch | audit `ed28bb0e...` (resolved fixing range head `3283454de601a678d7bc0b328df8520852ad1531`) | origin and local fixing range head equal |

The lane branch was published unchanged before review work. The local product clone has the exact F′ object; it was read with `git show`/`git grep` only.

## Verdict

**Changes required.**

The fixes remove the broad event/wildcard echo paths and add materially stronger row bindings. One false-PASS vector remains in the offline journal validators, which defeats the journal return binding for `R-CD-RETURN-OVERLAP` and `R-CD-COLLECTION-ON-COLLAPSE`.

## Findings

### HIGH — Arbitrary journal text can be treated as an actual marker writer

`tools/k6-proofs/lib/journal-return-binding.mjs:13-32` accepts a marker if the same line contains the marker followed by whitespace and `session=<key>`, or within the next three lines contains `session: <key>`. It does not require a product/session ownership record; the journal is arbitrary committed text or logged content.

Concrete false-PASS input:

```text
dispatcher copy: delegated RCD_REVIEW_ECHO_MARKER session=agent:main:subagent:review-child
[continuation:targeted-return] Delivered to agent:main:main from agent:main:subagent:review-child
```

`markerReturn(...)` reports the child as the marker writer, finds the targeted return from that child, and binds `true`. This concrete copy contains no marker the child/session wrote, but the string satisfies the validator. The same weak helper feeds both:

- `tools/k6-proofs/scenarios/r-cd-return-overlap.js:52-53`
- `tools/k6-proofs/scenarios/static-corpus-row-validator.js:199`
- collection path at `tools/k6-proofs/scenarios/static-corpus-row-validator.js:191`

The assignment `KEY=<marker>` case is rejected, but it is only a narrower spelling guard. An outbound dispatcher copy can use any prose form, for example `delegated <marker> session=<key>`, and currently passes.

**Regression:** `tools/k6-proofs/tests/review-sentinel-echo-mai.test.mjs:5-14` currently fails on branch head because the dispatcher echo is incorrectly bound.

## Echo vectors by fixed row

| Rows | Verdict-bearing observation and source | Remaining requester-origin vector |
|---|---|---|
| R-CD-1 | Child discovery is `spawnedBy` plus child task; minted token comes from child assistant text; parent reproduction is timestamped assistant text in a different run (`sentinel-binding.mjs:248-314`, `scenarios/r-cd-1-typed-delegate.js:201`) | None found. The token is rejected if it appeared in user/harness text. |
| R-CD-3 | Compaction answer is a nonce-bound `request_compaction` toolResult; staging is a nonce-bound `continue_delegate` toolResult; lifeboat is `sessions.list spawnedBy` plus the surviving post-compaction task prefix; report/reply are child-minted + parent-reproduced tokens (`r-cd-3-lifeboat.mjs:157-225`) | None found from requester text. The prefix assertion is product text and the token is checked against harness/user text. |
| R-CD-4 | Target ack is named-session assistant text outside the priming/dispatch run; child identity is separately bound by `spawnedBy` and task (`r-cd-4-authority.mjs:42-105`) | The target's own prompt/requester echo is excluded by run ID and `TARGET-READY` priming anchor where applicable. |
| R-CD-CHAINED-DEPTH-2 | Each hop's own bound child/grandchild transcript; root acknowledgement comes from the root session in a later run (`r-cd-chained-depth-2-authority.mjs:35-72`) | The child/grandchild are the observation subjects, not the requester. No wildcard event credit remains. |
| R-CD-MODEL-TOKEN | Hop transcript is bound to the child session; served/selected model facts use `sessions.describe`/history product receipts (`r-cd-model-token.js:153-170`) | The hop sentinel can be emitted by the child, which is the subject of the test rather than the requester. |
| R-CD-SILENT | Scheduling is a toolCallID-matched toolResult; child completion is a child-key chat final carrying a child-minted token; parent reads it in a later run (`r-cd-silent.js:98-116,164-183`) | None found in the remaining binding. A parent follow-up can only satisfy the parent return with the child-minted value. |
| R-CW-1/2/3 | Transcript-ordered continue_work call/result, assistant scheduled text in that turn, `[continuation:wake]` user row, assistant done text in the wake turn (`continue-work-chain.mjs:26-85`) | Scheduled/done text is in the requester/woken transcript. That is the answer intentionally proving execution, but it is still model-authored text; there is no independent product field proving a semantic answer. However the chain also requires product `continue_work`/wake records, and wildcard event echo was removed. |
| R-CW-4 | Same turn/wake chain, one scheduled assistant row per hop plus final row in third wake turn (`continue-work-chain.mjs:26-85`) | Same caveat as CW-1/2/3; no wildcard text vector remains. |
| R-CW-TOKEN | Child hop transcript plus minted token absent from harness/user text, wake row or run change, and parent reproduction after the mint timestamp (`continue-work-chain.mjs:98-132`) | No remaining prompt/harness echo vector. Typed-tool fallback prevents a typed continue_work from standing in for the token form. |
| R-RC-2 | nonce-bound request_compaction call/result by toolCallId; child identity; yield/wake turn; child report after the receipt (`request-compaction-receipt.js:357-412`) | The child report is bound to child rows and a wake turn, not harness/event text. |
| R-CD-RETURN-OVERLAP | Journal marker-writer and `targeted-return` lines | **Finding HIGH above:** arbitrary `delegated ... marker session=<key>` prose is enough. |
| R-CD-COLLECTION-ON-COLLAPSE | Journal C marker writer and targeted return plus C dispatcher lineage/root checks | **Finding HIGH above:** `markerReturn` can bind an arbitrary echo and satisfy collection return authority. |

## Binding table against F′

| Binding | Product guarantee at F′ | Verdict |
|---|---|---|
| `toolCallId` call/result pairing | Tool call/result transcript protocol carries matching IDs; the product transcript guard writes transcript tool rows and results (`src/agents/session-tool-result-guard*`, gateway protocol `toolCallId` schema) | Real; helpers also require nonce-bound call arguments and product role/name. |
| `spawnedBy` plus child session first task | `spawnedBy`/`parentSessionKey` are session-row lineage fields and `sessions.list` exposes session rows. Child subagent creation writes the `[Subagent Task]` envelope and task text (`src/agents/subagents/spawn/subagent-system-prompt.ts`, `subagent-spawn*`) | Real where `sessions.list` is available. The child task display stripping test confirms ordinary subagent task text survives its envelope stripping. |
| Lifeboat `[continuation:post-compaction]` spawn prefix | Post-compaction delivery explicitly constructs that prefix before `spawnSubagentDirect` (`src/auto-reply/reply/post-compaction-delegate-delivery.ts:497-539`). The display projection strips only the generated `[Subagent Context]` envelope and `[Subagent Task]` wrapper, preserving subsequent task text (`src/auto-reply/reply/user-envelope-display.ts`) | Real and direct. It is more strongly grounded than the two inferred facts. |
| Child-minted tokens | Product cannot mint on behalf of the child here; the child response is a persisted assistant row and the token is absent from the task/user/harness texts. `mintedTokenFromHistory` is a structural proof, not a cryptographic attestation | Real as negative provenance; does depend on harness inventory being complete (`sentTexts`) and transcript timestamps. |
| Transcript turn order | `chat.history` preserves transcript order and `__openclaw.runId`; product continuation wake text is generated as `[continuation:wake] Turn ... Prior reason ...`, then driven as a continuation turn (`src/auto-reply/continuation/work-dispatch-execution.ts:208-221,267,590-601`) | Turn/run shape is real. A live `chat.history` presence probe is not present in the review evidence and remains the workorder's inferred fact, so the harness should fail closed if paging/observation is incomplete. |
| Journal targeted return | The product emits `[continuation:targeted-return] Delivered to ... from ...` journal lines; the helper targets exact source/recipient | The targeted-return portion is concrete. The marker writer portion is not anchored to an independent product record and is currently only a text heuristic, hence the HIGH finding. |

## Fail-closed behavior

Missing calls/results, missing observer data, observation refusal, ambiguous child identity, missing child task/lineage, and missing wake/return transcripts generally fall to `PARTIAL-candidate` through `failClosedVerdict`/row classifiers. The R-CD-3 classifier explicitly keeps unknown usage and measured below-threshold results at PARTIAL and never PASS.

No general missing-evidence-to-PASS path was found in the live fixed rows. The weak offline journal binding is separate: syntactically sufficient but wrong evidence is accepted; under a malicious or copied outbound journal line it can turn to PASS, subject to the static validator's overall conditions.

## R-CD-3 context fill

The fill is gated by `OPENCLAW_CREATE_DISPOSABLE_SESSION` / `_SESSIONS`; with creation disabled, `startFlow()` calls `stopFill(...)` and never sends filler or the proof turn (`r-cd-3-post-compaction.js:469-485`). Otherwise it creates a separate nonce key via `sessions.create` and sends every filler/proof turn only to that key (`:471-475,248-257,334-347`). It never updates `main`, `MIN_CONTEXT_THRESHOLD`, or configuration.

The measured fill target is 75%, ceiling 85%, max 6 turns, and 300k filler-token budget (`r-cd-3-lifeboat.mjs:34-43`). `onFillMeasured` stops immediately when fresh total usage drops relative to its prior measurement, naming compaction mid-fill (`r-cd-3-post-compaction.js:275-288`). Missing/failing measurements also stop on timeout or exhausted budgets rather than dispatching proof.

## Validation

- `node --test tools/k6-proofs/tests/*.test.mjs`: **275 passed, 0 failed**.
- `node --test tools/k6-proofs/scripts/__tests__/*.test.mjs`: **829 total, 826 passed, 3 failed**. The failures are the three pre-existing `INDEX` reds reported by the lane; no new fix category was changed.
- `node tools/k6-proofs/scripts/validate-corpus.mjs --sha f15237ec921879d918482cdf372b0718d4c1aab9`: **18 passed, 0 failed**.
- Catalog checks: manifest/scenario alignment, scenario alignment, proof-row manifest coverage, and telemetry contracts all passed.
- `git archive 7ac3e7b806b3f792c80327ca491743481f74725b tools/k6-proofs`, then overlaying the existing R-CW echo test file and helpers: echo regressions failed on the pre-fix tree, including R-CW-4 wildcard event echo and R-CW-3 old F′ reason echo. This is a valid negative-control result: the old tree accepted evidence absent a fixed transcript/wake receipt.
- Review false-PASS journal regression: fails on branch head, demonstrating the finding.
