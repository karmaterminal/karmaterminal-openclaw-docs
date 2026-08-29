# Generic terminal-marker retention repair

Status: `READY_FOR_SCRIBE_REVIEW`.

Issue binding: `openclaw/openclaw#129388`.

The docs-owned proof-store inspector now mirrors product task-flow maintenance
for generic terminal records: every defined `terminalNoticePending` value
retains queue work. The exact `core/continuation-work` decoder still accepts
only `"retry-exhausted"` and still validates the complete continuation state.

No exact-head proof ran.

## Named-reference contract

This table was written before rejected or successor evidence was credited. The
unchanged lane was first published at rejected SHA
`1116bfed8f0291d10c784e691cf98fceec44a967`; the repaired implementation was
then published and identity-gated before this report-only successor.

| Category | Named reference | Local SHA | Tracking SHA | Server/object SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw@b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | N/A (immutable commit object) | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | local/server equal |
| Safe lane ref (repair evidence anchor) | `codeagent/129388-proof-store-generic-terminal-marker-fix-20260829` | `c0476ca1d5cceee21b3714bee6ecff824298d5aa` | `c0476ca1d5cceee21b3714bee6ecff824298d5aa` | `c0476ca1d5cceee21b3714bee6ecff824298d5aa` | local/tracking/server equal |
| CI/workflow ref | N/A | N/A | N/A | N/A | Focused-only workorder; Mode-B and Gate 3g do not apply. |
| Presentation ref | N/A | N/A | N/A | N/A | Presentation, corpus fold, and live proof are out of scope. |
| Docs/proof rejected successor | `karmaterminal/karmaterminal-openclaw-docs@1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | local/tracking/server equal |
| Docs/proof independent review | `codeagent/129388-proof-store-1116-independent-review-20260829` | `19f09d69e6ca8afdfceb598c1231831803cfe03f` | `19f09d69e6ca8afdfceb598c1231831803cfe03f` | `19f09d69e6ca8afdfceb598c1231831803cfe03f` | local/tracking/server equal |
| Docs/proof negative-control commit | `abec37dba826539fd187b43258f52e59f00921a5` | `abec37dba826539fd187b43258f52e59f00921a5` | N/A (immutable ancestor object) | `abec37dba826539fd187b43258f52e59f00921a5` | local/server equal |
| Docs/proof repaired implementation | `c0476ca1d5cceee21b3714bee6ecff824298d5aa` | `c0476ca1d5cceee21b3714bee6ecff824298d5aa` | `c0476ca1d5cceee21b3714bee6ecff824298d5aa` | `c0476ca1d5cceee21b3714bee6ecff824298d5aa` | local/tracking/server equal |

The final report commit cannot contain its own SHA. The safe-lane value above
is the complete implementation and test byte used for all successor evidence;
the report-only successor changes only `output.md`.

GitNexus discovery used the installed
`/home/figs/flesh_beast_best_beast/source/GitNexus` fork,
`gitnexus@1.6.5`, commit
`3c1e686edfc1acaac882927cada121ddd7c47bcc`. The available
`karmaterminal-openclaw-docs` indexes target other worktrees and stale commits,
so no graph finding is credited. Exact Git-object reads and the workorder's
direct owner-test fallback supplied the authority instead.

## Ownership and cure

The owning product composition boundary is
`src/tasks/task-flow-registry.maintenance.ts` at product authority
`b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25`. Its terminal-row retention test
is controller-independent and structural:
`stateJson.terminalNoticePending !== undefined`.

The exact continuation owner remains
`work-flow-state.ts` / `work-store.ts`, which decodes only
`terminalNoticePending="retry-exhausted"`. The cure changes only the inspector's
generic branch and shared relevance predicate to defined-value semantics. It
does not weaken exact continuation decoding, lifecycle validation, or
contradictory-state rejection.

Synthetic generic `true` fixtures now use the product literal. Additional
direct-store rows use `false`, `null`, and a controller-defined string to prove
the predicate is defined-value based rather than truthy or enum based. The
trusted launcher covers the generic product literal, a false alternate marker,
and the exact continuation literal; every row yields a signed
`resource-retention` `FAIL-candidate`.

## Regression-completeness matrix

| Boundary or lifecycle | Deterministic control |
|---|---|
| Generic product literal | A terminal `core` row with `"retry-exhausted"` must be `observed` as `flow:core-terminal-notice`. |
| Exact-controller sibling | A terminal `core/continuation-work` row with `"retry-exhausted"` remains retained under complete continuation-state validation. |
| Settled sibling | Failed terminal generic and exact rows with the field absent remain excluded. |
| Alternate generic marker | Terminal generic rows carrying `false`, `null`, or a controller-defined string remain retained. |
| Malformed/contradictory states | Generic nonterminal placement plus exact boolean marker, nonterminal placement, and delivered-plus-pending state all fail closed as `unverified-resource-retention`. |
| Signed launcher composition | Generic product, generic alternate, and exact owed rows each survive live/final store observation and force signed `resource-retention` failure. |
| Persistence and WAL | Direct-store inserts occur after the fixture checkpoint with WAL autocheckpoint disabled; the inspector observes the durable SQLite/WAL state. |
| Shutdown/recovery | Launcher controls require the same retained queue identity in both the live observation and the settled post-shutdown final observation. |
| Rollback and partial failure | The inspector is read-only, so marker rollback is N/A. Existing path-swap, source-failure, cleanup-failure, missing/duplicate observation, restart-receipt, and signed-failure controls remain green. |

## Rejected `1116bfed` controls

Negative-control commit
`abec37dba826539fd187b43258f52e59f00921a5` adds only tests, the mock marker,
and the pre-evidence report header on top of rejected
`1116bfed8f0291d10c784e691cf98fceec44a967`. A path-scoped diff proves the
inspector, launcher, contracts, and harness documentation are byte-identical to
the rejected SHA.

```bash
node --test --test-concurrency=1 \
  --test-name-pattern='durable inspector matches current product-shaped retention stores' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs

node --test --test-concurrency=1 \
  --test-name-pattern='trusted launcher signs FAIL for retained terminal notice' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs
```

The direct-store control produced `34/37` pass and `3` reported failures: the
generic product-literal leaf and alternate-defined-marker leaf failed with
`task flow has malformed terminal notice marker`, plus their aggregate parent.
Settled and malformed/contradictory siblings passed.

The launcher control produced `1/3` pass. The exact continuation row passed;
both generic rows produced cryptographically signed `FAIL-candidate` receipts
but had no retained queue inventory and carried only
`unverified-resource-retention`, not the required `resource-retention`.
This is the independent review's exact failure mode and proves there was no
signed-PASS escape.

## Successor validation

Acceptance path: `focused-only`. No Mode-B run ID or workflow SHA applies, and
Gate 3g was not used.

### Targeted direct-store and launcher matrix

```bash
node --check tools/k6-proofs/lib/return-covenant-retention-inspector.mjs
node --check tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs
node --check tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
node --check tools/k6-proofs/tests/fixtures/return-covenant-authority/mock-product-driver.mjs

node --test --test-concurrency=1 \
  --test-name-pattern='durable inspector matches current product-shaped retention stores' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs

node --test --test-concurrency=1 \
  --test-name-pattern='trusted launcher signs FAIL for retained terminal notice' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs

node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
```

Results:

- direct product-store matrix: `37/37` pass;
- trusted launcher generic/exact matrix: `3/3` pass;
- closure contract: `2/2` pass; and
- changed JavaScript/MJS syntax: `4/4` pass.

### Full owner/closure suite, serial twice

The exact same command ran twice with no changes between repetitions:

```bash
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
```

- repetition 1: `119/119` pass, `0` fail, `447892.169472ms`;
- repetition 2: `119/119` pass, `0` fail, `448172.682284ms`.

The suite preserves all prior product-store, nested payload, delivery ownership,
WAL/no-follow, path-swap, PID/socket, session/tombstone, queue, handle-ledger,
rollback, restart/recovery, partial-failure, candidate-diagnostic, and signed
failure controls.

### Corpus, manifest, scenario, telemetry, schema, and diff gates

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
  1116bfed8f0291d10c784e691cf98fceec44a967..HEAD
git diff --exit-code --name-only \
  1116bfed8f0291d10c784e691cf98fceec44a967..HEAD -- PROOFS
```

Results:

- active current-corpus scope: `2/2` pass;
- current corpus: 37 rows,
  `pass=32, partial=4, honest_limit=1, fail=0`;
- proof-row manifests: 37 rows, 42 manifests, 0 missing;
- scenario alignment: `ok=true`;
- manifest/scenario registry: 42 manifests, 35 scenario files, pass;
- telemetry contracts: 13 declared, 9 receipt-requiring rows, 0
  telemetry-rebindable PASS claims, pass;
- return-covenant schemas: `6/6` parse;
- `git diff --check`: pass; and
- protected `PROOFS/**` diff: empty.

No dependency install, product edit, live proof, exact-head proof, corpus
mutation, presentation change, deployment, pull request, Mode-B run, or Gate 3g
fallback was performed.
