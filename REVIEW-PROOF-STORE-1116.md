# Independent review: proof-store signed-FAIL repair `1116bfed`

Issue binding: `openclaw/openclaw#129388`.

## Named-reference contract

This table was written before crediting any rejected-control or successor
evidence. The unchanged review lane was published before its identity gate.

| Category | Named reference | Local SHA | Tracking SHA | Server/object SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw:scribe/129388-covenant-upstream-absorb-20260828` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | `b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25` | equal |
| Safe review lane ref | `codeagent/129388-proof-store-1116-independent-review-20260829` | `1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | equal |
| CI/workflow ref | N/A | N/A | N/A | N/A | Focused-only review; Mode-B, Gate 3g, and live proof are out of scope. |
| Presentation ref | N/A | N/A | N/A | N/A | Corpus presentation and live proof are out of scope. |
| Docs/proof successor | `codeagent/129388-proof-store-terminal-notice-signed-fail-fix-20260829` | `1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | `1116bfed8f0291d10c784e691cf98fceec44a967` | equal |
| Docs/proof rejected parent | `codeagent/129388-retention-authority-product-store-alignment-20260829` | `49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8` | `49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8` | `49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8` | equal |
| Docs/proof prior review | `codeagent/129388-proof-store-49dd-independent-review-20260829` | `9798a01040ff47cb4502b0db4365d2cc2c26e5dc` | `9798a01040ff47cb4502b0db4365d2cc2c26e5dc` | `9798a01040ff47cb4502b0db4365d2cc2c26e5dc` | equal |

The historical product review branch named in the repair receipt has advanced
to `25235bb785af477df11ea37f9d05a3ac87e82596`; this review therefore uses the
still-exact named product ref above and independently resolves the mandated
product commit through the GitHub commit object. The eventual report commit
cannot contain its own SHA; the safe-lane row identifies the complete reviewed
implementation byte.

**Verdict: `REQUEST_CHANGES`.**

The successor closes the two dangerous behaviors identified by the prior
review: expected candidate cleanup-diagnostic failures now reach signed cleanup
and observer FAIL artifacts, and the exact product
`core/continuation-work` terminal-notice row is retained. It does not exactly
mirror the product's controller-independent maintenance semantics. The generic
`core` branch accepts only boolean `true`, so the product-owned
`"retry-exhausted"` byte is rejected as malformed when exercised through that
branch instead of being reported as retained queue work.

This mismatch fails closed: the trusted launcher emits a signed
`FAIL-candidate`, not PASS. It nevertheless violates the workorder's exact
retention contract and the harness documentation, and the committed regression
uses a synthetic boolean marker that masks it.

No product code was changed or checked out. No dependency install, live proof,
corpus fold, presentation change, deployment, pull request, Mode-B run, or Gate
3g fallback was performed.

## Source authority

The product ownership walk used Git-object reads at
`karmaterminal/openclaw@b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25`.
The six relevant owner blobs are byte-identical to the inspector's pinned
product-store contract ancestor
`0109521b0c2b8a2c81c9f901789a81c5316074a7`.

| Boundary | Exact source | Review result |
|---|---|---|
| Product continuation-work decoder | [`work-flow-state.ts` lines 53-64 and 121-131](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/auto-reply/continuation/work-flow-state.ts#L53-L64) | The canonical marker is exactly `terminalNoticePending: "retry-exhausted"`. |
| Product failure/recovery owner | [`work-store.ts` lines 574-680](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/auto-reply/continuation/work-store.ts#L574-L680), [`work-terminal-notice.ts` lines 73-155](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/auto-reply/continuation/work-terminal-notice.ts#L73-L155) | The failed row is the restart backstop until queue handoff succeeds; enqueue precedes the CAS clear. |
| Product generic maintenance owner | [`task-flow-registry.maintenance.ts` lines 21-40 and 65-75](https://github.com/karmaterminal/openclaw/blob/b8a16fd74f1803e85ff9bb8f7ca7cee4fafe0f25/src/tasks/task-flow-registry.maintenance.ts#L21-L40) | For every terminal controller, any record with a defined `terminalNoticePending` field remains retained. The predicate is structural and does not substitute a boolean value contract. |
| Successor exact-controller decoder | [`return-covenant-retention-inspector.mjs` lines 961-1010](https://github.com/karmaterminal/karmaterminal-openclaw-docs/blob/1116bfed8f0291d10c784e691cf98fceec44a967/tools/k6-proofs/lib/return-covenant-retention-inspector.mjs#L961-L1010) | Correctly requires the literal for `core/continuation-work`, validates the complete product state, and retains the failed obligation. |
| Successor generic decoder | [`return-covenant-retention-inspector.mjs` lines 1012-1020](https://github.com/karmaterminal/karmaterminal-openclaw-docs/blob/1116bfed8f0291d10c784e691cf98fceec44a967/tools/k6-proofs/lib/return-covenant-retention-inspector.mjs#L1012-L1020) | **Mismatch:** accepts only `true`; the same product literal used through `core` becomes `unverified-resource-retention`. |
| Flow correlation | [`return-covenant-retention-inspector.mjs` lines 1236-1257 and 1810-1864](https://github.com/karmaterminal/karmaterminal-openclaw-docs/blob/1116bfed8f0291d10c784e691cf98fceec44a967/tools/k6-proofs/lib/return-covenant-retention-inspector.mjs#L1236-L1257) | Owner, session, child, single/multi-target, selected-recipient, and subagent requester/controller/child keys remain run-bound once the flow is accepted. Legacy spawn-requester overrides remain intentionally subordinate to `owner_key`, matching product. |
| Candidate cleanup read | [`return-covenant-candidate-io.mjs` lines 4-80](https://github.com/karmaterminal/karmaterminal-openclaw-docs/blob/1116bfed8f0291d10c784e691cf98fceec44a967/tools/k6-proofs/lib/return-covenant-candidate-io.mjs#L4-L80), [`launch-return-covenant-driver.mjs` lines 1487-1519](https://github.com/karmaterminal/karmaterminal-openclaw-docs/blob/1116bfed8f0291d10c784e691cf98fceec44a967/tools/k6-proofs/scripts/launch-return-covenant-driver.mjs#L1487-L1519) | The no-follow, nonblocking bounded reader classifies missing, symlink, permission, invalid-file, path, size, parse, and closed-shape failures. Unknown launcher/infrastructure errors still propagate. |
| Signed failure composition | [`launch-return-covenant-driver.mjs` lines 1595-1665](https://github.com/karmaterminal/karmaterminal-openclaw-docs/blob/1116bfed8f0291d10c784e691cf98fceec44a967/tools/k6-proofs/scripts/launch-return-covenant-driver.mjs#L1595-L1665), [`return-covenant-authoritative-receipt.mjs` lines 136-157 and 2325-2390](https://github.com/karmaterminal/karmaterminal-openclaw-docs/blob/1116bfed8f0291d10c784e691cf98fceec44a967/tools/k6-proofs/lib/return-covenant-authoritative-receipt.mjs#L136-L157) | The redacted category is HMAC-bound into cleanup, projected into the observer receipt, and forces an exact `candidate-cleanup-diagnostic-*` failure category. PASS requires `status="read"` and `failureCategory=null`. |

The published harness contract says every terminal row owning either marker is
retained until handoff
([`RETURN-COVENANT-AUTHORITY-HARNESS.md` lines 341-373](https://github.com/karmaterminal/karmaterminal-openclaw-docs/blob/1116bfed8f0291d10c784e691cf98fceec44a967/tools/k6-proofs/docs/RETURN-COVENANT-AUTHORITY-HARNESS.md#L341-L373)).
That statement is not true for `core` plus the product literal.

## Finding

### 1. Blocking: the generic controller rejects the product marker byte

**Invariant and owner.** Product task-flow maintenance is the composition owner
for terminal-row retention. Its marker test is controller-independent and
structural: a terminal flow remains retained whenever
`stateJson.terminalNoticePending !== undefined`. The only product producer at
the reviewed byte writes the literal `"retry-exhausted"` in the same CAS that
terminalizes continuation work. The inspector must therefore retain that byte
through both the exact continuation controller and the generic controller
branch named by the workorder.

The successor instead imposes `state.terminalNoticePending === true` on the
generic path. Its committed fixture deliberately changes the byte to boolean
for `core`
([`mock-product-driver.mjs` lines 444-463](https://github.com/karmaterminal/karmaterminal-openclaw-docs/blob/1116bfed8f0291d10c784e691cf98fceec44a967/tools/k6-proofs/tests/fixtures/return-covenant-authority/mock-product-driver.mjs#L444-L463)),
and the owner test repeats that substitution
([`return-covenant-authority.test.mjs` lines 2722-2772](https://github.com/karmaterminal/karmaterminal-openclaw-docs/blob/1116bfed8f0291d10c784e691cf98fceec44a967/tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs#L2722-L2772)).
Neither test exercises the product literal through `core`.

**Deterministic successor control.** A review-only direct-store case inserted a
terminal `core` row with `terminalNoticePending="retry-exhausted"`. The expected
product-equivalent result was `status="observed"` with
`queueItems=["flow:core-product-literal-terminal-notice"]`. The actual result
was:

```text
status=unverified-resource-retention
failureReason=task flow has malformed terminal notice marker
```

The one-worker test result was `38/39` pass, with this case as the sole failure.
A second review-only full-launcher characterization used the same row and
confirmed launcher exit `1`, a cryptographically valid signed
`FAIL-candidate`, and failure category `unverified-resource-retention`.
Therefore this is not a signed-PASS escape; it is an exact-semantics and
proof-availability defect.

**Siblings and lifecycle.** The exact
`core/continuation-work+"retry-exhausted"` path and the synthetic
`core+true` path both produce retained queue work and signed
`resource-retention` FAIL. Session/child/target/targets/recipient aliases all
remain run-bound on the accepted generic form. Settled failed rows without the
field remain excluded, and malformed exact-controller states fail closed.
Product persistence, handoff partial failure, restart replay, completed
tombstone, and CAS-clear behavior were inspected in the exact owner and its
adjacent durability tests.

**Required change.** Make the generic path mirror the maintenance owner's
presence semantics, rather than inventing a boolean-only contract, and replace
the synthetic fixture byte with the product literal. At minimum, a regression
must require `core+"retry-exhausted"` to be retained while preserving the
exact-controller decoder and genuinely settled terminal sibling.

## Review-question matrix

| Question | Result |
|---|---|
| Can candidate cleanup-diagnostic failures suppress signed cleanup/observer FAIL evidence? | **No for every candidate-controlled class exercised.** Missing, `ELOOP`, malformed JSON, oversize, invalid shape, directory, permission denial, and sandboxed parent-path swap all reached HMAC-signed cleanup and a signed observer FAIL. Direct `ENOTDIR` classified as `path-rejected`. Unexpected non-candidate launcher failures remain intentionally fatal. |
| Does retention exactly mirror `terminalNoticePending` for `core` and `core/continuation-work`? | **No.** Exact continuation work is correct; generic `core` rejects the product literal and accepts a synthetic boolean instead. |
| Can an owed failed/terminal flow produce signed PASS? | **No in the owned and alias matrices.** Exact and accepted generic obligations are retained; the mismatched generic literal fails closed with a signed FAIL rather than PASS. |
| Are settled terminal rows excluded? | **Yes.** Failed exact and generic siblings without a marker produce no queue item; delivered continuation work remains excluded. |
| Do previous proof-store and cleanup authorities remain intact? | **Yes.** The complete owner/closure suite covers product-store layout, nested `payload_json`, delivery ownership, session nodes, WAL/no-follow/path swap, PID/socket identity, tombstone/media, orphan sessions, handle ledger, rollback/restart/partial failure, and process cleanup. Protected `PROOFS/**` and the unchanged attestation/sandbox/scenario authority blobs are identical to the rejected parent. |

## Deterministic regression evidence

Acceptance path: **focused-only**. Mode-B and Gate 3g do not apply to this
review-only workorder.

### Exact rejected implementation

A detached worktree remained at exact HEAD
`49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8`. Only the test and mock-driver
diff from test-only commit
`3c40c697d580cbe265274e1ded63867421339e5f` was overlaid; an implementation-path
diff against HEAD was empty.

```bash
git worktree add --detach "$REJECTED" \
  49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8
git diff --binary \
  49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8..\
3c40c697d580cbe265274e1ded63867421339e5f -- \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/tests/fixtures/return-covenant-authority/mock-product-driver.mjs |
  git -C "$REJECTED" apply -
git -C "$REJECTED" diff --exit-code HEAD -- \
  tools/k6-proofs/lib \
  tools/k6-proofs/scripts/launch-return-covenant-driver.mjs \
  tools/k6-proofs/contracts tools/k6-proofs/docs
```

| Rejected control | Deterministic result |
|---|---|
| Direct terminal/malformed matrix | Expected regression reproduced: `30` pass / `7` fail. Both owed rows were omitted; malformed/contradictory states were incorrectly reported observed. |
| Trusted launcher, `core` and `core/continuation-work` owed rows | Expected regression reproduced: `0/2` pass. Both launchers exited `0` instead of `1`, proving signed PASS eligibility. |
| Trusted launcher, cleanup-draft symlink | Expected regression reproduced: `0/1` pass. `ELOOP` escaped before candidate diagnostic, cleanup, or observer receipt existed. |
| Review-only missing/malformed/oversize/shape matrix | Expected regression reproduced: `0/4` pass. Each launcher exited `0` instead of the required signed-FAIL exit `1`. |

Commands:

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

node --test --test-concurrency=1 \
  --test-name-pattern='review negative control: trusted launcher signs cleanup diagnostic failure' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs
```

### Successor focused controls

The same tests ran from exact successor
`1116bfed8f0291d10c784e691cf98fceec44a967`; supplemental cases existed only in
the detached review worktree.

| Successor control | Result |
|---|---|
| Committed direct store matrix | All committed subtests passed, including exact/generic retained rows, malformed states, settled rows, alternate targets, and prior store controls. |
| Trusted launcher terminal matrix | `2/2` pass for committed `core+true` and `core/continuation-work+"retry-exhausted"` retained rows. |
| Required diagnostic matrix | `5/5` pass for missing, `ELOOP`, malformed JSON, invalid shape, and review-only launcher-level oversize. Every result carried signed cleanup and observer FAIL evidence. |
| Additional candidate-path classes | Directory and permission denial signed exact failures; sandboxed parent replacement resolved as signed `missing`; a direct `ENOTDIR` reader control resolved as `path-rejected`. |
| Alias matrix | Owner, session, child, target, target-array, selected-recipient, and subagent keys remained run-bound. |
| Product-literal generic `core` | **Failed as Finding 1:** direct observation was unverified rather than retained. The launcher still emitted signed FAIL, proving no PASS escape. |

Commands:

```bash
node --test --test-concurrency=1 \
  --test-name-pattern='durable inspector matches current product-shaped retention stores|review control: core terminal notice uses the product literal|review control: terminal notice session aliases remain run-bound' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs

node --test --test-concurrency=1 \
  --test-name-pattern='trusted launcher signs cleanup diagnostic failure|review control: trusted launcher signs oversize cleanup diagnostic failure' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs

node --test --test-concurrency=1 \
  --test-name-pattern='trusted launcher signs FAIL for retained terminal notice|review control: core product literal fails closed without signed PASS' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs
```

### Full owner/closure suite

The complete suite was run serially twice, without implementation changes
between repetitions:

```bash
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
```

- repetition 1: `118/118` pass, `0` fail, `415823.582628ms`;
- repetition 2: `118/118` pass, `0` fail, `419828.40421ms`.

### Corpus and static gates

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
  49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8..\
1116bfed8f0291d10c784e691cf98fceec44a967
git diff --exit-code --name-only \
  49dd1db3d9772b2c55e3c81ab0824d0e543bd6b8..\
1116bfed8f0291d10c784e691cf98fceec44a967 -- PROOFS
```

Results:

- active corpus scope: `2/2` pass;
- current corpus: 37 rows, rollup
  `pass=32, partial=4, honest_limit=1, fail=0`;
- row manifests: 37 proof rows, 42 manifests, 0 missing;
- scenario alignment: `ok=true`;
- manifest/scenario registry: 42 manifests, 35 scenario files, pass;
- telemetry: 13 contracts, 9 receipt-requiring rows, 0 rebindable PASS
  claims, pass;
- changed JavaScript/MJS syntax: `7/7` pass;
- return-covenant JSON schemas: `6/6` parse;
- candidate diff check: pass; and
- protected `PROOFS/**` diff: empty.

## Final verdict

`REQUEST_CHANGES`

The signed-FAIL repair is effective and no owed product shape was shown to
escape into signed PASS. The successor is not confirmable because its generic
terminal-flow branch contradicts the exact product maintenance predicate and
its own published contract. Accepting the product literal through `core` (with
a deterministic owner and launcher regression) is required before this lane
can be `CONFIRMED`.
