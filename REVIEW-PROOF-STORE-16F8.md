# Independent review: proof-store generic marker repair `16f8bca6`

Issue binding: `openclaw/openclaw#129388`.

## Named-reference contract

This table was written before crediting any rejected-control or successor
evidence. The unchanged safe review lane was published before its identity
gate.

| Category | Named reference | Local SHA | Tracking SHA | Server/object SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw:scribe/129388-covenant-upstream-absorb-20260828` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | local/tracking/server equal |
| Safe review lane pre-report anchor | `codeagent/129388-proof-store-16f8-independent-review-20260829` | `16f8bca6593813adb25e864c91d38f456b1708c0` | `16f8bca6593813adb25e864c91d38f456b1708c0` | `16f8bca6593813adb25e864c91d38f456b1708c0` | local/tracking/server equal |
| CI/workflow ref | N/A | N/A | N/A | N/A | Focused-only review; Mode-B and Gate 3g do not apply. |
| Presentation ref | N/A | N/A | N/A | N/A | Corpus presentation and live proof are out of scope. |
| Docs/proof successor | `codeagent/129388-proof-store-generic-terminal-marker-fix-20260829` | `16f8bca6593813adb25e864c91d38f456b1708c0` | `16f8bca6593813adb25e864c91d38f456b1708c0` | `16f8bca6593813adb25e864c91d38f456b1708c0` | local/tracking/server equal |
| Docs/proof rejected parent | `codeagent/129388-proof-store-terminal-notice-signed-fail-fix-20260829` | `1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | local/tracking/server equal |
| Docs/proof prior review | `codeagent/129388-proof-store-1116-independent-review-20260829` | `19f09d69e6ca8afdfceb598c1231831803cfe03f` | `19f09d69e6ca8afdfceb598c1231831803cfe03f` | `19f09d69e6ca8afdfceb598c1231831803cfe03f` | local/tracking/server equal |

The eventual report commit cannot contain its own SHA. The safe-lane value
above is the exact complete candidate byte reviewed by this lane; the only
permitted successor change is this report.

## Verdict

`CONFIRMED`

The successor closes the prior review's blocking generic-controller mismatch.
The inspector now mirrors product task-flow maintenance exactly for generic
terminal records: every defined `stateJson.terminalNoticePending` value is
retained. The dedicated `core/continuation-work` path remains stricter: it
requires the owned `"retry-exhausted"` literal, validates the complete
continuation state and owner, and rejects malformed or contradictory terminal
states.

No owed row escaped to signed PASS. The trusted launcher produced signed
`resource-retention` `FAIL-candidate` evidence for the generic product marker,
an alternate defined generic marker, and the exact continuation-work marker.
Candidate cleanup diagnostic errors continued through trusted cleanup to signed
observer FAIL evidence.

Acceptance path: **focused-only**. No product edit, dependency install, live or
exact-head proof, corpus fold, presentation change, deployment, pull request,
Mode-B run, or Gate 3g fallback was performed. GitNexus was not used or
credited; immutable Git-object reads and the direct owner tests supplied the
source authority.

## Source and composition authority

The product composition owner is
`src/tasks/task-flow-registry.maintenance.ts` at
`karmaterminal/openclaw@b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25`.
`hasUnfulfilledDurableObligation` tests
`state[key] !== undefined` independently of controller imports, and
`shouldPruneFlow` refuses to prune any terminal row for which that predicate is
true.

The exact continuation owner remains:

- `work-flow-state.ts`: the decoder accepts only
  `terminalNoticePending: "retry-exhausted"`;
- `work-store.ts`: failure and the pending notice are persisted in one
  expected-revision CAS, terminal recovery reads only the exact controller and
  literal, and the marker is CAS-cleared only after handoff; and
- `work-terminal-notice.ts`: durable queue enqueue precedes marker clear, uses a
  flow-stable idempotency key, preserves the marker on unresolved handoff, and
  leaves restart recovery as the final backstop.

The inspector's pinned product-store contract commit
`0109521b0c2b8a2c81c9f901789a81c5316074a7` is an ancestor of the workorder's
product source. The six owner blobs relevant to this review are byte-identical:

| Product owner | Blob at `0109521b` and `b8a16fd7` |
|---|---|
| `src/tasks/task-flow-registry.maintenance.ts` | `de7bf19a71bf8b5e22bb4df40b657f97638bbd75` |
| `src/tasks/task-flow-registry.types.ts` | `bb19242d447ae3b72bcf94438141316d0c457ae0` |
| `src/auto-reply/continuation/work-flow-state.ts` | `1d0fe17f6313a054a90920fde2f0121861637547` |
| `src/auto-reply/continuation/work-store.ts` | `632e75742fcc3602b670028ee808656f12fd7ded` |
| `src/auto-reply/continuation/work-terminal-notice.ts` | `f1306422f7cd38216c67eaf02eae14fe05deacb1` |
| `src/auto-reply/continuation/work-dispatch-execution.ts` | `6f0f9138c56ba3839750e981be57616fb0d40562` |

The successor's owning implementation is
`tools/k6-proofs/lib/return-covenant-retention-inspector.mjs`:

- `hasDefinedTerminalNotice` applies the product's
  `state.terminalNoticePending !== undefined` predicate;
- generic rows require a terminal product lifecycle state but do not invent a
  value enum;
- the exact continuation branch still calls
  `validateContinuationWorkState`, requires owner/session consistency, requires
  `"retry-exhausted"`, and rejects nonfailed, nonended, cancellation-pending,
  or already-succeeded contradictions;
- `buildResources` uses the same defined-field predicate for flow relevance,
  preserving owner, child, target, target-array, and recipient-authority
  session correlation; and
- the trusted resolver derives retained counts from live and final canonical
  stores, adds `resource-retention`, binds cleanup with launcher HMAC, validates
  the final signed receipt, and exits nonzero for every non-PASS verdict.

## Review matrix

| Required property | Independent result |
|---|---|
| Generic `core + "retry-exhausted"` | Retained as `flow:core-terminal-notice`; the rejected implementation deterministically rejects the same row. |
| Another defined generic marker | `false`, `null`, and a controller-defined string are all retained in the direct store; the trusted launcher independently covers `false`. This matches product structural semantics, not truthiness. |
| Settled terminal rows with field absent | Failed generic and exact-controller rows with no field remain excluded. Existing terminal flow and delivery siblings remain excluded exactly. |
| Exact continuation-work decoder | The literal product marker is retained only with complete state and owner consistency. Boolean marker, nonterminal placement, and delivered-plus-pending contradiction fail closed. Broader malformed state/table cases also remain fail closed. |
| Signed owed-row failure | Generic product, generic alternate, and exact-controller launcher rows each produce `FAIL-candidate`, a 64-hex HMAC signature, `resource-retention`, one retained queue item, and the same queue identity in live and final store observations. The launcher validates the signature before publishing the receipt. |
| Candidate cleanup diagnostics | Missing, symlink, malformed JSON, and invalid closed shape each produce signed exact `candidate-cleanup-diagnostic-*` failure evidence after trusted cleanup. |
| Prior store and cleanup controls | Both full serial repetitions pass all 119 tests, including product store/layout, nested payload, delivery ownership, WAL/no-follow/path swap, PID/start/socket, queue/session/tombstone, orphan session, handle ledger, rollback/teardown, restart/recovery, source failure, candidate diagnostic, direct cleanup, and signed failure controls. |
| Product-shaped fixtures | The generic fixture default is the product byte `"retry-exhausted"`; boolean `true` remains only as a deliberately malformed exact-controller negative case. |
| Protected proof surfaces | `PROOFS/**`, `PROOFS/INDEX.json`, the current manifest, pipeline, row manifests, and scenarios have an empty candidate diff. Row states and both exact-target flags are unchanged. |

## Regression-completeness record

**Invariant and owning boundary.** Product task-flow maintenance owns generic
terminal-record retention. Any terminal flow whose state contains a defined
`terminalNoticePending` value remains a delivery obligation. The continuation
controller owns the narrower interpretation of its own marker and accepts only
`"retry-exhausted"` with a consistent failed terminal state.

**Deterministic pre-fix control.** Test-overlay commit
`abec37dba826539fd187b43258f52e59f00921a5` has exact parent
`1116bfed8f0291d10c784e691cf98fceec44a967`. Its implementation, launcher,
contracts, and documentation are byte-identical to rejected `1116bfed`; it adds
only the missing tests, product-byte fixture control, and report metadata.

- The direct-store matrix failed `3` of `37` reported tests: the aggregate plus
  the generic product-literal and alternate-defined-marker leaves. Both leaves
  failed with `task flow has malformed terminal notice marker`.
- The trusted-launcher matrix passed only the exact continuation sibling
  (`1/3`). Both generic controls returned signed `FAIL-candidate` receipts with
  `unverified-resource-retention` instead of retained queue inventory and the
  required `resource-retention`.
- Settled absent-marker rows and all four exact/generic malformed or
  contradictory sibling controls passed on the rejected implementation, so the
  negative control isolates the generic value restriction rather than changing
  lifecycle expectations.

**Post-fix proof.** Exact successor
`16f8bca6593813adb25e864c91d38f456b1708c0`, tree
`1eacb6fdb4c6d025a4d4e2667efb494821c24df3`, passes the same direct matrix
`37/37` and trusted launcher matrix `3/3`.

**Nearest siblings and alternate paths.** The direct matrix covers the exact
controller, generic controller, field-absent settled rows, generic nonterminal
placement, exact boolean-marker rejection, exact nonterminal placement,
delivered-plus-pending contradiction, continuation target aliases, delivery
rows, and spawned-session correlation. The launcher covers both generic values
and the exact product marker through the full trusted snapshot/signing
composition rather than a mocked resolver.

**Persistence, restart, rollback, and partial failure.** The direct fixture uses
the canonical SQLite global/agent schemas, WAL mode with autocheckpoint
disabled, and post-checkpoint inserts; the WAL-only test proves sidecar bytes
are observed. Launcher assertions require the same retained queue identity
during the quiesced live observation and after shutdown settlement. Product's
enqueue-before-clear and idempotent replay path establishes partial-failure and
restart ownership. The inspector is read-only, so marker rollback is not an
applicable operation; rollback/cleanup authority remains with the existing
trusted run-root, process-group, handle-ledger, and direct-cleanup controls.
Source read failure, identity change, symlink, pathname swap, unstable
live/final resources, missing observations, and incomplete cleanup all remain
signed or fail-closed controls in the passing full suite.

## Deterministic execution evidence

All Node tests ran with one worker and no dependency reconciliation.

### Receipt identity and hygiene

The rejected test worktree resolved to `abec37d...`, whose parent and complete
implementation byte are exact rejected `1116bfed...`. The successor test
worktree resolved to exact `16f8bca6...` and stayed clean.

One initial negative-control command accidentally inherited the review-lane
working directory and exercised successor implementation bytes. That result
was immediately discarded, reported as TROUBLE, and is not credited anywhere
in this report. Every result below came from the explicitly resolved detached
worktree.

### Rejected direct-store and launcher controls

```bash
node --test --test-concurrency=1 \
  --test-name-pattern='durable inspector matches current product-shaped retention stores' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs

node --test --test-concurrency=1 \
  --test-name-pattern='trusted launcher signs FAIL for retained terminal notice' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs
```

Results:

- direct store: `34/37` pass, `3` fail,
  `9726.282842ms`; expected generic-marker failures only;
- trusted launcher: `1/3` pass, `2` fail,
  `86873.263521ms`; both generic rows lack retained inventory and
  `resource-retention`, while the exact continuation row passes.

### Successor direct-store and launcher matrices

```bash
node --test --test-concurrency=1 \
  --test-name-pattern='durable inspector matches current product-shaped retention stores' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs

node --test --test-concurrency=1 \
  --test-name-pattern='trusted launcher signs FAIL for retained terminal notice' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs

node --test --test-concurrency=1 \
  --test-name-pattern='trusted launcher signs cleanup diagnostic failure' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs
```

Results:

- direct product-store matrix: `37/37` pass, `10124.638059ms`;
- owed-row trusted launcher matrix: `3/3` pass, `86900.589958ms`; and
- cleanup diagnostic launcher matrix: `4/4` pass,
  `116233.518698ms`.

### Full owner/closure suite, serial twice

The exact same command ran twice with no byte change between repetitions:

```bash
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
```

- repetition 1: `119/119` pass, `0` fail, `447751.272062ms`;
- repetition 2: `119/119` pass, `0` fail, `447731.364733ms`.

Both logs contain the same 119 normalized passing test names. No product or
harness flake was observed.

### Corpus, static, schema, and protected-byte gates

```bash
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/current-corpus-active-scope.test.mjs
node tools/k6-proofs/scripts/validate-corpus.mjs --current
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node --check <each changed JavaScript/MJS file>
# JSON.parse each return-covenant *.schema.json
git diff --check \
  1116bfed8f0291d10c784e691cf98fceec44a967..\
16f8bca6593813adb25e864c91d38f456b1708c0
git diff --exit-code --name-only \
  1116bfed8f0291d10c784e691cf98fceec44a967..\
16f8bca6593813adb25e864c91d38f456b1708c0 -- \
  PROOFS tools/k6-proofs/k6-proofs-pipeline.xml \
  tools/k6-proofs/manifests tools/k6-proofs/scenarios
```

Results:

- current-corpus active scope: `2/2` pass;
- corpus validation: `37` rows,
  `pass=32, partial=4, honest_limit=1, fail=0`;
- proof-row manifests: `37` proof rows, `42` manifests, `0` missing;
- scenario alignment: `ok=true`;
- manifest/scenario registry: `42` manifests, `35` scenario files, pass;
- telemetry contracts: `13` declared, `9` receipt-requiring rows,
  `0` telemetry-rebindable PASS claims, pass;
- changed JavaScript/MJS syntax: `4/4` pass;
- return-covenant schemas: `6/6` parse;
- candidate diff check: pass; and
- protected proof/pipeline/manifest/scenario diff: empty.

`PROOFS/INDEX.json` retains blob
`3c719b950f8fd01ff4d4a018b9c15feee47df584`; the current manifest retains blob
`7f79b035c56df9a8fd813df4cbc95f78ac4dcdd4`. Its 37-row state projection
retains SHA-256
`c6698c938ca55918b23326cf3666559a9f56a68b22813a95e8a37f05f4f6023d`,
and both `exact_target_execution` and `exact_target_mode_b` remain `false`.

## Final verdict

`CONFIRMED`

The generic terminal-flow repair matches the immutable product maintenance
owner, preserves the exact continuation decoder and fail-closed state checks,
turns every tested owed row into signed resource-retention failure evidence,
and leaves all protected proof and prior closure authorities unchanged.
