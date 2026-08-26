# R-CD-CHAINED-DEPTH-2 acknowledgment authority cure

Bound issue: #119

## Outcome

The harness cure is complete on reviewed harness checkpoint
`f14fbd7895744ee596d1a5a30b09a2cec03dc3c0`; the core implementation is
`6ddf5aa911596c4a0e557a5fcd196cf82bcd8680`. The historical artifact from
Project-81 run `32981265676` remains immutable and retains its recorded
`PARTIAL-candidate` verdict; it was not rewritten, folded, or rerun.

The row still requires root model consumption after both depth-2 returns. It no
longer treats exact prose `ROOT-CHAIN-ACK` as that consumption authority.
Candidate PASS instead requires all of the following:

1. A fully paginated task snapshot and nonce-bound `tasks.get` details resolve
   exactly two unique tasks forming root -> child -> grandchild.
2. Both tasks are `completed`, `deliveryStatus=delivered`, postdate dispatch,
   carry unique task/run identities, and establish depth exactly 2.
3. The depth-1 task records the committed `continue_work` recovery wake and the
   depth-2 task records the exact grandchild marker.
4. A later, non-dispatch root lifecycle run supplies the exact child marker and
   grandchild marker through structured `heartbeat_respond` input fields.
5. The matching heartbeat tool-call id receives `status=accepted`.
6. The same root lifecycle run ends successfully.
7. The typed `continue_delegate` trace correlation, candidate/runtime identity,
   required artifacts, and public-safety checks all validate.

`ROOT-CHAIN-ACK` is retained only as supplemental evidence.

## Named refs

The unchanged safe lane was published before contract evidence was evaluated.
Exact commits and immutable run metadata are used where no branch ref applies.

| Category | Required ref | Resolved identity | Equality |
|---|---|---|---|
| Product/runtime evidence | `karmaterminal/openclaw@a5db13ad6297721cbf43af445d5a4a9b9bb0ad67` | Server commit and exact read-only product worktree `a5db13ad6297721cbf43af445d5a4a9b9bb0ad67` | Requested = server = inspected source; product tree tracked-clean |
| Safe lane/base | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-depth-ack-harness-cure` from `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` | Before evidence: local/tracking/server `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512`; reviewed harness checkpoint `f14fbd7895744ee596d1a5a30b09a2cec03dc3c0` | Unchanged branch published before evidence; reviewed checkpoint local = tracking = server after push |
| CI/workflow | N/A | N/A | Focused harness tests only; live workflow dispatch prohibited by the workorder |
| Presentation | `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates@4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | Server branch and commit `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | Requested branch tip = requested commit = server; read-only |
| Docs/proof evidence | Report handoff `dc6bffc8f55692a9fc6131d67c77a4e9b116a4ed`; run `32981265676`; artifact `9612027467` | Handoff local/server `dc6bffc8f55692a9fc6131d67c77a4e9b116a4ed`; run head `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512`; non-expired artifact `project81-k6-proof-32981265676` | Handoff local = server; required run/artifact identities match |

The final output-only branch child is the SHA in the required COMPLETE receipt.
It changes no harness, scenario, manifest, product, workflow, or proof corpus
byte.

## Steward restart and invalidated delegated reviews

Two delegated code-review runs, `depth-ack-review` and
`depth-ack-rereview`, were invoked contrary to the lane's no-subagent rule.
Both reviews, every finding they emitted, and every conclusion attributed to
them were invalidated with zero evidentiary credit. The steward restart at
`2026-08-26T09:11:52-07:00` was reported to `#sprites`. No later subagent,
review agent, Explore agent, or other AI delegate was used.

Every retained change was then re-derived in this GPT-5.6 session from the exact
artifact, preserved read-only state, exact product source, production protocol
schemas, and deterministic tests. The complete diff was reviewed directly
after those derivations.

## Contract classification

The exact run establishes classifications 2 and 3 from the workorder:

- A post-return root model run did occur.
- The model consumed structured evidence from both returns.
- The exact assistant phrase was only a nondeterministic proxy for that stronger
  structured boundary.

This is not a delivery-only downgrade. Delivery is necessary but insufficient:
completed task rows without a later root input, an accepted matching tool
result, and a successful same-run lifecycle end remain non-PASS.

### Exact run chronology

Public-safe timing and count facts from the preserved isolated state:

| Boundary | Exact observation |
|---|---|
| Parent dispatch accepted | `1787755189770` ms |
| Depth-1 task | Created `1787755206391`; ended `1787755217483`; `completed`/`delivered`; recovery tool `continue_work` |
| Depth-2 task | Created `1787755217512`; ended `1787755220181`; `completed`/`delivered` |
| Frozen fanout targets | Depth 1: one root target; depth 2: two targets (child and root) |
| Root consumption lifecycle | Started `1787755258037`; structured heartbeat input `1787755266775`; accepted result `1787755266776`; lifecycle ended successfully at `1787755266794` |
| Structured marker ownership | Exact child marker appears once in heartbeat `scratch`; exact grandchild marker appears once in heartbeat `reason` |
| Assistant prose ACK | Absent |

The earlier root heartbeat did not carry both exact nonce-bound phrases and is
rejected by the successor predicate. Bare substring checks were also rejected:
`CHILD-DONE` is a substring of `GRANDCHILD-DONE`, so every control uses the full
nonce-bound phrases.

## Independent derivations

| Retained change | Direct derivation |
|---|---|
| Bounded task title handling | Exact product `src/tasks/task-status.ts` blob `f7ce7c1f2c1d175597b04ddc4d3c71577a1e8ba7` caps titles at 80 characters. In the exact run, nonce offsets were 74 and 73; both rendered titles omitted the full nonce. Exact `tasks.get` returns the bounded full prompt, so task authority uses that prompt rather than a truncated title. |
| Full pagination | Exact product tasks handler blob `83ab298f95730348bc60f247a558d78365da4414` returns numeric `nextCursor` offsets from `tasks.list` and full prompt/result details from `tasks.get`. The scenario exhausts every cursor, rejects repeats/duplicate ids, resolves candidate details, and requires two identical complete snapshots. |
| Standalone candidate binding | `evidence-writer.mjs` chooses its destination from `--sha`; `postprocess-k6-summary.mjs` chooses from the manifest. Without an explicit comparison, a valid signed receipt could be copied under another target. Both paths now require receipt candidate/runtime identity to equal their destination identity. |
| Descendant deadline | The original descendant timer was installed before the delayed `sessions.send` acceptance even though its deadline was computed from acceptance. The successor arms from acceptance and re-evaluates the exact remaining duration. |
| Heartbeat acceptance | Exact product heartbeat tool blob `89ff33bd91ceb55a4f862f83beebcacfaf9d152b` emits JSON `status:"accepted"` only after schema validation and one-shot acceptance. The row binds the model's structured tool input to the matching accepted tool-call id and same lifecycle end. |
| Receipt integrity | Writer/postprocessor paths copy receipt bytes publicly. The successor HMAC signs every top-level field except `integrity`, enforces exact top-level/binding/lifecycle/integrity keys, and rejects added or altered fields before copy. |
| Recursive public redaction | Task/run/tool-call identities occur in arrays and nested receipt objects. The sanitizer now collects scalar descendants of sensitive fields before dropping them, then scrubs the same values from k6 and service logs. |
| Snapshot rearming | The descendant contract permits 180 seconds and requires two stable snapshots. Polling now rearms after every complete or rejected snapshot until the computed descendant deadline, rather than ending at a fixed 120-second schedule. |

## Owning composition boundary

The owner is the proof-harness composition:

```text
fully paginated tasks.list
  -> nonce-bound tasks.get details
  -> exact two-task chain receipt
  -> post-completion root agent lifecycle start
  -> root session.message heartbeat toolCall input
  -> same-run/session matching accepted toolResult
  -> same-run successful agent lifecycle end
  -> HMAC-sealed public-safe row receipt
  -> runner/writer/postprocessor/candidate-envelope consumers
```

The row-scoped resolver is the sole candidate verdict authority. Generic k6
summary text cannot promote this row.

## Regression completeness

| Requirement | Receipt |
|---|---|
| Exact rejected control | Run `32981265676`, artifact `9612027467`; artifact ZIP SHA-256 `0505d580b8a59da3b8c81a8fde417fadd779e08faf004dc5c1bf113904523794`; rejected row-result SHA-256 `4a4a1152ec190778553d78a4334e2c10513bdccae5b929edde2e55bc0b0da989` |
| Pre-fix negative | On the unchanged harness implementation, the new exact characterization exited 1: actual structured authority was `undefined`, expected `structured-post-return-consumption`. Log SHA-256 `1d6553802b5ff1a508e784a01319cc3b700a9fc36842f150bf274e8ecb54c1c8`. |
| Successor positive | The same run-32981265676 characterization passes through task lineage, lifecycle start, structured heartbeat input, accepted matching result, and successful lifecycle end without `ROOT-CHAIN-ACK`. Log SHA-256 `bc1f30a35ffa9c70c7c228ac7760c252ce5f4434d56cc1449a9f900e495c184e`. |
| Old lost ancestry | Predecessor run `32958479691`, artifact `9603030118`, stays `PARTIAL-candidate` with failure category `missing-or-invalid-task-ledger`; artifact ZIP SHA-256 `ed1e36f60e2212893ea715b5f7560f104342cfd7d4a6efc04d9a4b2063ec196c`. |
| Phrase-only ACK | Assistant `ROOT-CHAIN-ACK` without task ledger, structured heartbeat input, accepted result, and lifecycle end is rejected. |
| One return / intermediate only | Missing child or grandchild delivery, wrong root requester, or one task row is rejected. |
| Duplicate | Duplicate task ids, run ids, task markers, prompt nonces, return markers, cursors, or additional nonce-bound task rows are rejected. |
| Stale/preexisting | Tasks created before dispatch, nonce only in nested metadata, old prompt nonce, early root input, or a reused dispatch run are rejected. |
| Wrong depth/identity | Collapsed child/grandchild identities, a root-owned second task, wrong candidate/runtime SHA, wrong mode/tool/trace, or mismatched tool-call id is rejected. |
| Partial failure | Rejected heartbeat result, failed lifecycle end, missing trace, missing required artifact, pagination error, unstable snapshot, or incomplete public projection withholds PASS. |
| Nearest sibling | R-CD-2 remains lifecycle-owned for silent wake and R-CD-4 remains target-session-owned; neither can substitute for this row's exact two-task depth and post-return root-consumption composition. |
| Persistence/recovery | Authority is read from the exact run's durable task registry through public gateway methods and two stable snapshots. Candidate-envelope persistence/re-read coverage is included; product restart recovery is not claimed. |
| Rollback/restart | N/A. This docs harness change mutates no gateway config, product state, runtime, or corpus. No restart or rollback was performed. |

## Public safety and artifact closure

- Raw nonce, prompt, heartbeat input, session keys, task ids, run ids,
  tool-call ids, gateway token, and private paths do not enter the public
  receipt.
- Public identity fields are SHA-256-16 fingerprints under an exact signed
  schema.
- Sensitive scalar descendants are collected before arrays/objects are removed,
  so copies in k6 and gateway logs are scrubbed too.
- The candidate envelope revalidates the HMAC, receipt digest, candidate/runtime
  identity, harness source digests, required artifacts, and sibling raw result.
- Missing `EVIDENCE.md`, row result, summary, gateway events, seat readiness,
  trace correlation, signed receipt, or backend status remains fail-closed.
- Protected `PROOFS/`, `PROOFS/INDEX.json`, `.github/`, docs main, product code,
  presentation refs, and prior artifacts are unchanged.

## Changed paths and LOC

Implementation checkpoint `6ddf5aa911596c4a0e557a5fcd196cf82bcd8680`:
23 files, `+3106/-234` lines.

| Surface | Paths |
|---|---|
| Row authority | Scenario, manifest, pipeline registry, task correlation helper, structured authority helper, signed receipt helper |
| Result pipeline | Row resolver, row-list runner, evidence writer, summary postprocessor, candidate emitter and sibling validator, sanitizer |
| Regression controls | Exact rejected-run characterization, lost-ancestry characterization, authority tests, resolver tests, sanitizer tests, runner/candidate/closure contracts |

Follow-up checkpoint `f14fbd7895744ee596d1a5a30b09a2cec03dc3c0`
changes one title-truncation test literal from a private nonce to a synthetic
equivalent. The final child replaces only this report.

## Focused validation

Acceptance path: **focused-only**. No Mode-B run, Gate 3g fallback, live
Project-81 fire, corpus fold, product test suite, or Crabbox/Testbox run was
performed or claimed.

Focused owner command:

```bash
node --test \
  tools/k6-proofs/tests/row-child-correlation.test.mjs \
  tools/k6-proofs/tests/r-cd-chained-depth-2-authority.test.mjs \
  tools/k6-proofs/tests/r-cd-chained-depth-2-artifact.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-cd-chained-depth-2-authoritative-receipt.test.mjs \
  tools/k6-proofs/scripts/__tests__/backend-disposition-pipeline.test.mjs \
  tools/k6-proofs/scripts/__tests__/telemetry-backend-status.test.mjs \
  tools/k6-proofs/scripts/__tests__/candidate-run-result.test.mjs \
  tools/k6-proofs/scripts/__tests__/telemetry-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/tempo-fetch.test.mjs \
  tools/k6-proofs/scripts/__tests__/loki-fetch.test.mjs \
  tools/k6-proofs/scripts/__tests__/collect-continuation-trace.test.mjs \
  tools/k6-proofs/scripts/__tests__/proof-harness-closure-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/golden-path.test.mjs \
  tools/k6-proofs/scripts/__tests__/continuation-row-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-cd-2-authoritative-receipt.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-rc-2-honest-limit-policy.test.mjs \
  tools/k6-proofs/scripts/__tests__/observability-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/r-cd-token-runner-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/review-debt.test.mjs \
  tools/k6-proofs/scripts/__tests__/report-render.test.mjs \
  tools/k6-proofs/scripts/__tests__/sanitize-k6-artifacts.test.mjs \
  tools/k6-proofs/scripts/__tests__/check-proof-row-manifests.test.mjs \
  tools/k6-proofs/scripts/__tests__/continuation-acceptance-matrix.test.mjs \
  tools/k6-proofs/scripts/__tests__/matrix-continuation-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/proof-matrix-provenance-negative-control.test.mjs \
  tools/k6-proofs/scripts/__tests__/live-run-guard.test.mjs
```

Result: tests `269`, pass `269`, fail `0`.

Additional gates:

```bash
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node tools/k6-proofs/scripts/validate-corpus.mjs --current
k6 version
k6 inspect tools/k6-proofs/scenarios/r-cd-chained-depth-2.js
node --check <all changed JS/MJS entry points>
bash -n tools/k6-proofs/scripts/run-proofs.sh
git diff --check
```

Results:

- Manifest registry: 42 manifests, 36 scenario files.
- Scenario alignment: `ok=true`.
- Manifest coverage and telemetry contracts: passed.
- Current corpus validation: 4 passed, 0 failed; unchanged acceptance remains
  incomplete.
- k6: `v2.0.0`; one VU, one iteration, `maxDuration=6m0s`.
- Syntax, shell, patch-hygiene, protected-path, and private-identity scans:
  passed.

## Direct review

After the steward restart, the complete implementation and all callers,
consumers, sibling receipt patterns, production gateway/task/heartbeat schemas,
manifest policy, sanitizer, fixtures, and focused tests were reviewed directly
in this GPT-5.6 session. The final direct review found no remaining
high-confidence correctness, false-PASS, identity-binding, or public-safety
defect.

## Exact row-only refire handoff

No live refire was dispatched. A future owner must first re-establish the same
isolated, exact-product gateway and reviewed bounded public-safe TraceQL/LogQL.
Then dispatch only this row against the final reviewed harness branch:

```bash
gh workflow run project81-k6-proof.yml \
  --repo karmaterminal/karmaterminal-openclaw-docs \
  --ref codeagent/129388-depth-ack-harness-cure \
  -f rows=R-CD-CHAINED-DEPTH-2 \
  -f candidate_sha=a5db13ad6297721cbf43af445d5a4a9b9bb0ad67 \
  -f runtime_build_sha=a5db13ad6297721cbf43af445d5a4a9b9bb0ad67 \
  -f dry_run=false \
  -f 'runner_labels_json=["self-hosted","ronan"]' \
  -f gateway_ws=ws://127.0.0.1:19892 \
  -f session_selector=main \
  -f seat_name=ronan-isolated-129388 \
  -f seat_class=raw-final-text \
  -f create_disposable_sessions=true \
  -f metrics_push=false \
  -f otel_service_name=ronan-isolated-129388-a5db13ad \
  -f gateway_unit=openclaw-proof-129388-cured-row-refire.service \
  -f 'tempo_traceql=<reviewed bounded public-safe TraceQL>' \
  -f 'loki_logql=<reviewed bounded public-safe LogQL>'
```

Review the signed
`r-cd-chained-depth-2-authoritative-receipt.json`,
`run-result.json`, `candidate-run-result.json`, `backend-status.json`, copied
manifest/scenario digests, and every required artifact together. A behavioral
PASS still requires the existing telemetry and artifact policy; do not infer a
corpus fold from the row receipt. Keep #119 and the product issue open until a
separately reviewed live result is accepted.
