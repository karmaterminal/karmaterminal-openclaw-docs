# R-CD-4 k6 harness repair

Issue binding: openclaw/openclaw#85651
Authority baseline: `10f98e60cd48eba4d598a0e8805ec42d632a1326`
Product candidate: `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955`
Implementation checkpoint: `fcbb8153`

## Result

The failed R-CD-4 run was a harness initialization failure, not a product
verdict. Its copied scenario bytes exactly match the accepted authority
baseline:

| Source | SHA-256 | Comparison |
| --- | --- | --- |
| Failed workflow `row-scenario.js` | `1646a2062484349b320f63aaf65d5ee2228965bb01873dff1cb781ff0bec012a` | Exact |
| `10f98e60:tools/k6-proofs/scenarios/r-cd-4-target-session-key.js` | `1646a2062484349b320f63aaf65d5ee2228965bb01873dff1cb781ff0bec012a` | Exact |

At `2026-08-15T10:28:12-07:00`, k6 exited 107 while initializing that
scenario, before opening the WebSocket or creating a session:

```text
The moduleSpecifier "node:crypto" couldn't be recognised as something k6 supports.
```

The structural repair makes both affected VU graphs k6-compatible. Node-only
HMAC receipt sealing and validation remain in post-run modules:

| k6-safe structural observer | Node-only post-run authority |
| --- | --- |
| `lib/r-cd-4-authority.mjs` | `lib/r-cd-4-return-authority.mjs` |
| `lib/r-cd-chained-depth-2-authority.mjs` | `lib/r-cd-chained-depth-2-return-authority.mjs` |

The k6 scenarios retain their `k6/crypto` fingerprints and all existing
structural gates. The collector remains the only return PASS authority:
gateway-token HMAC, `structuralOk`, exact target/parent/child/window binding,
one target receipt, zero forbidden parent receipts, and candidate-only review
flags are unchanged.

## Manual versus failed-harness control matrix

Cael's reported manual fire is the behavioral control. Its raw request,
nonce-bound receipt, and cleanup confirmation were relay-blocked, so this
matrix distinguishes observed facts from unavailable bytes rather than
inventing equivalence.

| Surface | Cael manual control | Failed R-CD-4 harness execution | Comparison |
| --- | --- | --- | --- |
| Runtime candidate | Reported exact `6b09…` | `6b09…` in workflow artifact path and job inputs | Candidate aligned |
| Docs/harness | Not supplied | Accepted `10f98e60` scenario bytes, proven byte-identical to artifact | Manual harness bytes unavailable |
| Session topology | One reported nonce-bound manual attempt; receipt retrieval relay-blocked | Planned disposable parent plus target sessions; no `sessions.create` occurred | Harness made no product mutation |
| Parent/source/target identity | Not recoverable without reading sovereign session content | Generated only after k6 initialization; therefore absent | No identity comparison is possible |
| Prompt/tool invocation | Not recoverable | Typed `continue_delegate`, `mode=silent-wake`, response-driven `sessions.send`; source task prompt uses `RCD4:<nonce suffix>` | Harness contract known; manual bytes unavailable |
| Nonce/marker | Nonce not supplied | Nonce would be generated only after init; none was emitted | No marker comparison is possible |
| `targetSessionKey` | Reported targeted-return control, no sealed receipt | Planned target is the disposable target session; VU never reached dispatch | No product claim from the failed run |
| Runtime imports | Manual product execution does not use the k6 graph | `scenario -> r-cd-4-authority -> targeted-return-receipt -> node:crypto` | Root cause |
| Dispatch/wake timing | Not recoverable | Planned 500 ms dispatch delay, then 8/25/50 s task polls in a 90 s window | Harness timing never started |
| Child completion/return | Targeted-return journal marker stream exists but is unbound | No child, return, trace, or scenario evidence | No comparison can establish delivery |
| Loki/Tempo/journal | Payload-free Loki markers observed; Tempo correlation absent | Workflow journal has no proof-relevant product line because k6 never dispatched | Manual is corroborative only |
| Cleanup | Relay-blocked at last report | No sessions were created, so no cleanup was necessary | Manual cleanup still unknown |
| Verdict authority | No HMAC-bound target/child/window receipt available | `PARTIAL-candidate`, `k6ExitCode=107` | Neither side supports a product PASS/FAIL |

## Telemetry recovery

Read-only checks were limited to public-safe metadata and did not inspect
prince memory, mutate sessions, query databases, or initiate a second live
run.

| Source | Result | Authority consequence |
| --- | --- | --- |
| Loki targeted-return marker query | Eight payload-free marker lines in two Cael streams (four mirrored records per stream), at `10:14:42Z`, `10:20:19Z`, `10:20:42Z`, and `17:23:01Z` on 2026-08-15 | No nonce, target, child, or bounded dispatch window binding; cannot be a receipt |
| Tempo `/ready` | HTTP 503 during initial check | Availability gap |
| Tempo host/time search | HTTP 200, zero traces for Cael over the marker window | No trace correlation recovered |
| Failed workflow artifact | Full artifact downloaded and inspected; compiler failure occurred before WebSocket dispatch | Confirms harness origin and zero product evidence |
| Manual receipt/cleanup relay | Still unavailable | Leave manual control `PARTIAL`; do not infer delivery or cleanup |

The latest marker at `17:23:01Z` is not attributed to the manual attempt:
payload-free lines lack the required exact binding and must not be reverse
engineered into an authoritative session identity.

## Import-closure guard

`scripts/check-k6-scenario-import-closure.mjs` now walks every checked-in
`tools/k6-proofs/scenarios/*.js` dependency closure and fails closed on:

- direct or transitive `node:` and bare Node builtin imports;
- unsupported bare imports;
- unresolved relative imports.

It covers static and literal dynamic imports. The guard is wired into:

- `scripts/run-proofs.sh` catalog preflight;
- `run-proof.sh`;
- both GitHub Actions proof workflows;
- the catalog root-contract test; and
- operator documentation.

Before the repair, the all-scenario scan found only R-CD-4 and
R-CD-CHAINED-DEPTH-2. The latter shared the same invalid design: a scenario
observer imported Node HMAC/journal helpers. It was fixed as shared harness
infrastructure, not as a new row behavior change.

## Validation

| Validation | Result |
| --- | --- |
| Focused R-CD-4, targeted-return, chained-depth, catalog-root, and import-closure tests | 46 passed, 0 failed |
| Catalog-wide closure scan | 35 scenario graphs, 0 Node-builtin violations |
| k6 v2.0.0 import/initialization | `k6 inspect` passed for R-CD-4 and R-CD-CHAINED-DEPTH-2 without live dispatch |
| Sanctioned full docs harness command | 381 passed, 1 failed |
| Baseline classification | The sole red reproduces on accepted `10f98e60` and fork base `f7e307d7`; not repaired here |
| Project 81 R-CD-4 dry-run | Workflow `31900349285` succeeded; docs `10f98e60`, candidate `6b09…`, scratch selector `r-cd-4-scratch-20260815`, disposable sessions requested, zero rows dispatched |

Exact commands:

```bash
node tools/k6-proofs/scripts/check-k6-scenario-import-closure.mjs --repo-root "$PWD"
node --test tools/k6-proofs/scripts/__tests__/check-k6-scenario-import-closure.test.mjs \
  tools/k6-proofs/scripts/__tests__/catalog-root-contract.test.mjs \
  tools/k6-proofs/tests/r-cd-4-authority.test.mjs \
  tools/k6-proofs/tests/r-cd-chained-depth-2-authority.test.mjs \
  tools/k6-proofs/tests/targeted-return-receipt.test.mjs
k6 inspect tools/k6-proofs/scenarios/r-cd-4-target-session-key.js
k6 inspect tools/k6-proofs/scenarios/r-cd-chained-depth-2.js
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs tools/k6-proofs/tests/*.test.mjs
```

The known baseline failure is
`candidate envelope is outside and invisible to canonical corpus validation`.
`PROOFS/a7ef03177e0f42831a087521e6eb7720102d6be1/proofs-manifest.json` retains
`openclaw.k6.proofs-manifest.v1` instead of
`openclaw.proofs.manifest.v1` and lacks `capture_sha` and `rows[]`.

No post-fix live R-CD-4 run was fired. The corrected scenario import smoke,
the single dry-run, and the failed-run evidence make another product dispatch
unnecessary in this lane.

## Follow-up plan for other PARTIAL rows

| Row | Shared status | Row-specific follow-up; do not bundle into this lane |
| --- | --- | --- |
| R-CD-CHAINED-DEPTH-2 | Its identical Node-import defect is fixed by this shared boundary split | Fire only after disposable ancestry preflight; retain two stable spawnedBy observations, distinct hop identities, tree-fanout journal receipt, cleanup, and Tempo receipt |
| R-CD-MODEL-TOOL | No Node-import leak | Compare manual requested-model byte, spawnedBy set-diff child model byte, and parent return byte. Keep child prose auxiliary; separately resolve the known explicit-model runtime mismatch if it reproduces |
| R-CD-TOKEN | No Node-import leak | Record raw-final-text seat class before dispatch and compare manual token surface with one origin task, one token delegate, stable full task snapshots, bound return, signed resolver, and Tempo topology |
| R-CW-3 | No Node-import leak | Obtain a public-safe Tempo trace using an exact trace/chain correlation, then verify safe reason attributes exist and the raw reason sentinel does not. The scenario intentionally remains PARTIAL until review |
| R-RC-2 | No Node-import leak | Compare a nonce-bound child tool result, not assistant text. Keep below-threshold rejection as the only HONEST-LIMIT path; accepted compaction needs the isolated lifecycle/post-compaction/cleanup fixture receipts |
| R-CD-2 | No Node-import leak; authority remains under review | Reconcile its signed row-scoped authority with a manual control using the accepted send lifecycle, exact terminal boundary, one typed topology, distinct silent wake, no-channel receipt, and same trace/chain projection |

## Recommendation

Land this as a severable successor to docs PR #510 rather than extending that
PR. PR #510 establishes R-CD-4's signed target-return authority; this change
has an independently reviewable purpose: keep every k6 scenario graph free of
Node builtins, preserve the post-run HMAC boundary, and prevent the complete
failure class across the catalog. No PR was opened or modified.
