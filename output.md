# Generic terminal-marker repair lane

Issue binding: `openclaw/openclaw#129388`.

## Pre-evidence named-reference contract

This table was written before running the rejected negative control or
crediting successor evidence. The unchanged safe lane was published to
`origin` before its identity gate.

| Category | Named reference | Local SHA | Tracking SHA | Server/object SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw@b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | N/A (immutable commit object) | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | local/server equal |
| Safe lane ref | `codeagent/129388-proof-store-generic-terminal-marker-fix-20260829` | `1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | local/tracking/server equal |
| CI/workflow ref | N/A | N/A | N/A | N/A | Focused-only workorder; Mode-B and Gate 3g do not apply. |
| Presentation ref | N/A | N/A | N/A | N/A | Presentation, corpus fold, and live proof are out of scope. |
| Docs/proof rejected successor | `karmaterminal/karmaterminal-openclaw-docs@1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | local/tracking/server equal |
| Docs/proof independent review | `codeagent/129388-proof-store-1116-independent-review-20260829` | `19f09d69e6ca8afdfceb598c1231831803cfe03f` | `19f09d69e6ca8afdfceb598c1231831803cfe03f` | `19f09d69e6ca8afdfceb598c1231831803cfe03f` | local/tracking/server equal |

The installed GitNexus fork is
`/home/figs/flesh_beast_best_beast/source/GitNexus`, package `gitnexus@1.6.5`,
fork commit `3c1e686edfc1acaac882927cada121ddd7c47bcc`. Its available
`karmaterminal-openclaw-docs` indexes point at other worktrees and stale commits,
so no graph finding is credited; the workorder's direct exact-object and
owner-test route is used.

---

# Prior proof-store terminal notice and signed-FAIL repair

Status: `READY_FOR_SCRIBE_REVIEW`.

Issue binding: `openclaw/openclaw#129388`.

This lane repairs the docs-owned return-covenant proof-store authority. It does
not edit product code, mutate the proof corpus, run live proof, change
presentation, deploy, or open a pull request. No exact-head product proof ran.

## Named-reference contract

This table was written before crediting the rejected-control or successor
validation below. The unchanged safe lane was first published at rejected SHA
`49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8`; the repaired implementation was
then published before its identity gate.

| Category | Named reference | Local SHA | Tracking SHA | Server/object SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw:codeagent/129388-b8a16fd7-independent-review-20260829` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | equal |
| Safe lane ref (repair evidence anchor) | `codeagent/129388-proof-store-terminal-notice-signed-fail-fix-20260829` | `665b1d0a4077fbc2dbfcbd7d6e4a308e1c66c3b2` | `665b1d0a4077fbc2dbfcbd7d6e4a308e1c66c3b2` | `665b1d0a4077fbc2dbfcbd7d6e4a308e1c66c3b2` | equal |
| CI/workflow ref | N/A | N/A | N/A | N/A | Focused-only workorder; Mode-B and Gate 3g are out of scope. |
| Presentation ref | N/A | N/A | N/A | N/A | Presentation and live proof are out of scope. |
| Docs/proof rejected implementation | `codeagent/129388-retention-authority-product-store-alignment-20260829` | `49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8` | `49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8` | `49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8` | equal |
| Docs/proof independent review | `codeagent/129388-proof-store-49dd-independent-review-20260829` | `9798a01040ff47cb4502b0db4365d2cc2c26e5dc` | `9798a01040ff47cb4502b0db4365d2cc2c26e5dc` | `9798a01040ff47cb4502b0db4365d2cc2c26e5dc` | equal |
| Docs/proof rejected-control commit | `3c40c697d580cbe265274e1ded63867421339e5f` | `3c40c697d580cbe265274e1ded63867421339e5f` | N/A (immutable ancestor object) | `3c40c697d580cbe265274e1ded63867421339e5f` | local/server equal |
| Docs/proof repaired implementation | `665b1d0a4077fbc2dbfcbd7d6e4a308e1c66c3b2` | `665b1d0a4077fbc2dbfcbd7d6e4a308e1c66c3b2` | `665b1d0a4077fbc2dbfcbd7d6e4a308e1c66c3b2` | `665b1d0a4077fbc2dbfcbd7d6e4a308e1c66c3b2` | equal |

The final report commit cannot contain its own SHA. The safe-lane value above is
the complete repaired implementation byte used for evidence; the report-only
successor changes `output.md`.

## Ownership and repair

### Candidate cleanup diagnostic

The trusted composition boundary is
`scripts/launch-return-covenant-driver.mjs`, not candidate
`cleanup-draft.json`. The reader now classifies only bounded candidate-controlled
failure modes (`missing`, `symlink`, `access-denied`, `invalid-file-type`,
`path-rejected`, `size-bound`, `malformed-json`, and `invalid-shape`).
Unexpected launcher or infrastructure errors still propagate.

Known diagnostic failures no longer interrupt process/store observation or
cleanup. The launcher records no success-shaped replacement claims, signs the
redacted `{status, failureCategory}` into `cleanup.json`, projects the same
category into the observer receipt, and forces the exact
`candidate-cleanup-diagnostic-<category>` `FAIL-candidate`. Candidate counts and
closure claims remain unable to grant or override trusted observations.

### Terminal notice retention

Product authority at
`b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` has two relevant ownership
boundaries:

- `work-flow-state.ts` / `work-store.ts` decode the exact
  `core/continuation-work` marker
  `terminalNoticePending="retry-exhausted"`; and
- `task-flow-registry.maintenance.ts` treats a structurally present terminal
  obligation marker as retained registry work independently of controller
  feature imports.

The inspector now retains the exact continuation-work marker and the generic
boolean-`true` maintenance form, includes their owner and nested child/target
keys in run-bound session correlation, and rejects malformed or contradictory
markers as `unverified-resource-retention`. A failed terminal continuation row
without a pending marker remains settled and pass-eligible.

## Regression controls and validation

Acceptance path: `focused-only`. No Mode-B run ID or workflow SHA applies, and
Gate 3g was not used.

### Rejected implementation controls

The rejected-control commit
`3c40c697d580cbe265274e1ded63867421339e5f` changes only the owner test and mock
fixture; its implementation parent is exactly
`49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8`. A path-scoped diff confirmed that
its contracts, docs, libraries, launcher, and sandbox bytes are unchanged from
the rejected implementation.

| Control on rejected implementation | Deterministic result |
|---|---|
| Direct product-shaped store matrix | Expected failure: `30` pass / `7` fail. Both terminal obligations produced `queueItems=[]`; malformed and contradictory terminal-notice states returned `status="observed"` instead of failing closed. |
| Trusted launcher, generic `core` terminal notice | Expected failure: launcher exit `0` instead of `1`; signed result was incorrectly pass-eligible. |
| Trusted launcher, exact `core/continuation-work` terminal notice | Expected failure: launcher exit `0` instead of `1`; signed result was incorrectly pass-eligible. |
| Trusted launcher, symlinked cleanup draft | Expected failure: launcher exit `1`, but `candidate-cleanup-diagnostic.json` was `null`; execution stopped at `ELOOP` before trusted signed cleanup/observer artifacts could satisfy the control. |

The exact rejected commands were:

```bash
node --test --test-concurrency=1 \
  --test-name-pattern='durable inspector matches current product-shaped retention stores|terminal notice obligations remain retained|settled terminal continuation-work|malformed terminal notice fails closed' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs

node --test --test-concurrency=1 \
  --test-name-pattern='trusted launcher signs FAIL for retained terminal notice' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs

node --test --test-concurrency=1 \
  --test-name-pattern='trusted launcher signs diagnostic failure when cleanup draft is a symlink' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs
```

Each nonzero result was wrapped in an assertion that required the expected
failure text; the control command itself then returned success only when the
regression reproduced.

### Successor controls

The same owner boundaries pass on repaired implementation
`665b1d0a4077fbc2dbfcbd7d6e4a308e1c66c3b2`:

| Successor control | Result |
|---|---|
| Direct store/signing/reader controls | `39/39` pass. Exact and generic terminal obligations are retained; alternate child keys remain run-bound; settled rows remain excluded; malformed/contradictory markers fail closed. |
| Trusted launcher terminal-notice controls | `2/2` pass. Generic `core` and exact `core/continuation-work` rows each yield launcher exit `1`, signed `FAIL-candidate`, exact `resource-retention`, and one retained queue item in both live and final store observations. |
| Trusted launcher diagnostic controls | `4/4` pass. Missing, symlink, malformed-JSON, and invalid-shape drafts each complete trusted cleanup and emit a signed `FAIL-candidate` carrying the exact bounded `candidate-cleanup-diagnostic-<category>`. |
| Clean launcher sibling | Passes as `PASS-candidate`; canonical candidate diagnostics remain non-authoritative. |

Commands:

```bash
node --test --test-concurrency=1 \
  --test-name-pattern='durable inspector matches current product-shaped retention stores|candidate cleanup diagnostic failures remain signed and exact|candidate JSON reader classifies' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs

node --test --test-concurrency=1 \
  --test-name-pattern='trusted launcher signs FAIL for retained terminal notice' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs

node --test --test-concurrency=1 \
  --test-name-pattern='trusted launcher signs cleanup diagnostic failure' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs
```

### Full focused owner/closure suite

The complete owner/closure suite was run serially twice with the exact same
command and no changes between repetitions:

```bash
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
```

- repetition 1: `118/118` pass, `0` fail, `419517.000896ms`;
- repetition 2: `118/118` pass, `0` fail, `417946.333183ms`.

The suite retains prior payload JSON, delivery queue, session-node,
WAL/no-follow, path-swap, socket/PID, tombstone/media, orphan-session,
handle-ledger, rollback, restart/recovery, partial-failure, and process-cleanup
controls.

### Current corpus and static gates

```bash
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/current-corpus-active-scope.test.mjs
node tools/k6-proofs/scripts/validate-corpus.mjs --current
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
```

Results:

- active scope: `2/2` pass;
- current corpus: 37 rows, rollup
  `pass=32, partial=4, honest_limit=1, fail=0`;
- row manifests: 37 rows, 42 manifests, 0 missing;
- scenario alignment: `ok=true`;
- manifest/scenario registry: 42 manifests, 35 scenario files, pass;
- telemetry: 13 contracts, 9 receipt-requiring rows, 0 rebindable PASS
  claims, pass.

Seven changed JavaScript/MJS files pass `node --check`; all six
return-covenant JSON schemas parse; `git diff --check` passes; and
`PROOFS/**` has no diff from the rejected implementation.

### Independent review and uncertainty

An independent high-effort diff review found no blocking correctness,
security, or logic issue. It specifically checked both trusted composition
boundaries, candidate-error classification, signed projections, clean siblings,
and owner/child correlation.

The workorder calls the pending field boolean `true`, while the exact product
continuation-work decoder at `b8a16fd7` owns the literal
`"retry-exhausted"`. The repair does not blur those bytes: exact
`core/continuation-work` accepts only the product literal, while the generic
maintenance-owned controller form accepts boolean `true`; wrong types,
nonterminal placement, delivered-plus-pending state, and other contradictions
fail closed. This fork was surfaced to the cohort before implementation.

No exact-head proof ran. No live proof, product test, product edit, dependency
install, corpus fold, presentation change, deployment, PR, Mode-B run, or Gate
3g fallback was performed.
