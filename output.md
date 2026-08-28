# READY_FOR_SCRIBE_REVIEW

## Delivery

- Branch:
  `codeagent/129388-covenant-authority-proof-harness-20260828`
- Reviewed harness tip:
  `92affa163c0e14f7cd9d1ef76ac19f089d85b503`
- Final report-only successor: recorded in the COMPLETE receipt.
- Binding: `openclaw/openclaw#129388`, ClawSweeper comment `5442236054`.
- Scope: 34 harness/documentation paths plus this report.
- CI acceptance path: `focused-only`; Mode-B and deployment are N/A.
- Verdict: construction is complete, but the product fixture seam is missing
  and no product proof has run.

## Named-reference contract

| Surface | Named ref | Local SHA | Tracking SHA | Server/object SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw:scribe/129388-covenant-upstream-absorb-20260828` | N/A | N/A | `c1ff1b336e472f05c6b0060b3910e53ddf31723c` | Server branch resolved at handoff. It advanced after construction began and was not frozen or executed as this lane's final product candidate. |
| Product contract-reading checkpoint | `karmaterminal/openclaw@7c100aede1fd9895c0ae3e3837eafc9d98ad6982` | N/A | N/A | `7c100aede1fd9895c0ae3e3837eafc9d98ad6982` | Immutable checkpoint used to read the recipient-authority contract only. |
| Product absorb input | `openclaw/openclaw@babb2fc7c1363587a4e08266d59772e35a78d1c9` | N/A | N/A | `babb2fc7c1363587a4e08266d59772e35a78d1c9` | Exact upstream object resolves; the product lane owns its schema-v19 convergence. |
| Safe lane ref | `codeagent/129388-covenant-authority-proof-harness-20260828` reviewed harness tip | `92affa163c0e14f7cd9d1ef76ac19f089d85b503` | `92affa163c0e14f7cd9d1ef76ac19f089d85b503` | `92affa163c0e14f7cd9d1ef76ac19f089d85b503` | Local, tracking, and server refs were equal before this report-only successor. |
| CI/workflow ref | N/A | N/A | N/A | N/A | Harness construction is focused-only; no Mode-B workflow or deployment applies. |
| Presentation ref | `openclaw/openclaw#129388` head `codeagent/85651-upstream-1ba243c8-gates` | N/A | N/A | `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` | Read-only PR head; no body, labels, comments, or presentation branch were changed. |
| Docs/proof base | `karmaterminal/karmaterminal-openclaw-docs:main` at dispatch | `0984dabae218000b20178f4a031e688bdf0584ac` | `0984dabae218000b20178f4a031e688bdf0584ac` | `0984dabae218000b20178f4a031e688bdf0584ac` | Base object, `origin/main`, and server `main` are equal. |
| Prior harness authority | `karmaterminal/karmaterminal-openclaw-docs@39ef6b268650c5ff718226cb17fdfcf2d5f4a3da` | `39ef6b268650c5ff718226cb17fdfcf2d5f4a3da` | N/A | `39ef6b268650c5ff718226cb17fdfcf2d5f4a3da` | Exact object resolves but is not an ancestor of the docs base. Only its isolated-runtime primitive was ported; its 122-file/corpus-bearing line was not merged. |

## Row disposition

The honest future row is one indivisible
`R-CD-RETURN-COVENANT-AUTHORITY` matrix with 12 lifecycle cases and both forms
in exact `typed-tool` then `bracket-token` order: 24 observations total.

This must be a new row rather than a silent promotion:

| Existing row | Current authority | Why it cannot absorb this claim |
|---|---|---|
| `R-CD-2` | Partial typed `silent-wake` dispatch/topology receipt | It does not hold a result across recipient generations, prove forbidden revocation edges, or own schema-v19 setup. |
| `R-CD-4` | Passing target-session acknowledgement | It does not prove stale accepted authority is removed before prompt, wake, and channel effects. |
| `R-CD-RETURN-OVERLAP` | Static overlap/collection evidence | It explicitly lacks isolated wake causality and recipient-generation authority. |

One receipt prevents an accepted dispatch from one run being spliced with
zero-effect observations from another. Each case/form remains independently
addressable inside the signed matrix. The proposed row is not in a manifest,
workflow, pipeline, runnable scenario directory, or `PROOFS` corpus.

## Constructed authority

The lane adds:

- versioned closed schemas for the plan, ready receipt, driver attestation,
  observation set, and cleanup;
- a construction-only k6 scenario covering seven allowed and five nearest
  forbidden transitions across fresh v19, both v18-to-v19 fixture shapes, v19
  reopen, and gateway restart/replay;
- an exact-SHA trusted launcher that verifies product/docs Git blobs, an
  approved k6 binary, runtime config, candidate driver, gateway argv,
  environment, process ancestry, PID/start identities, and loopback socket
  ownership;
- bubblewrap user/PID/network/IPC isolation, a trusted in-namespace supervisor,
  bounded no-follow candidate JSON reads, launcher-only artifact paths, and
  non-voluntary descendant cleanup;
- separate candidate phase HMAC and launcher-only observer HMAC authorities;
- ordered initial-to-typed-to-bracket gateway restart lineage with immutable,
  pairwise-disjoint listener fingerprints;
- fail-closed validation of captured/current generations, accepted/held
  receipts, queue acknowledgement, exact prompt/wake/channel counts, bounded
  transcript/system-event marker absence, k6 exit/teardown, and direct cleanup;
  and
- deterministic adversarial controls for allowed success, correctly rejected
  forbidden delivery, stale prompt/wake/channel effects, identity or generation
  drift, missing/duplicate evidence, origin relabeling, short settlement,
  phase proof/reuse, revocation capability mismatch, retained state, nonzero k6,
  schema closure, public redaction, and signature tampering.

The final independent review found one fail-closed availability defect in the
transient `/proc` gateway fallback: its observation omitted
`listenerFingerprints`. The owning launcher-monitor return shape now includes
the same listener identity as the direct path, and the closure test rejects any
future omission. This is harness construction hardening, not a product-behavior
cure claim.

## Harness repair regression

- Invariant and owner: the launcher lifecycle monitor owns the composition of
  socket liveness and PID liveness. A verified gateway may close its listener
  before its PID exits; this is terminal shutdown, not listener mutation. Any
  later listener reappearance under the same PID/start identity remains fatal.
- Deterministic predecessor control: applying the closure contract's exact
  source invariant to rejected pushed SHA
  `3e6220734dbe92018591ce84bbe1f100cb82331a` returns
  `EXPECTED_FAIL ... missing terminal listener-close handling`.
- Successor proof: the same closure assertion passes at
  `92affa163c0e14f7cd9d1ef76ac19f089d85b503`, and the synthetic gateway holds
  the listener-closed/PID-alive window open for 50 ms. The complete real-k6
  owner suite then passes 37/37.
- Nearest sibling: a changed nonempty listener set is still
  `gateway listener mutation`; a listener that reappears after terminal
  closure is still `gateway listener resumed after exit`.
- Persistence and rollback: lifecycle evidence retains the last verified
  listener fingerprints and records PID disappearance; rollback to
  `3e622073...` reintroduces the rejected closure race.
- Restart/recovery: the matrix performs initial-to-typed-to-bracket gateway
  replacement and requires predecessor exit before each successor.
- Partial failure: listener closure followed by a hung PID cannot pass cleanup;
  direct PID/start and empty process-group checks remain mandatory.

## Required product seams

The exact final product tree must still provide all of these before execution:

1. A tracked loopback v1 fixture-driver command and separately tracked gateway
   command with exact relative paths and SHA-256 values.
2. Product-owned creation/migration for fresh v19, covenant-shaped v18,
   participant-shaped v18, and idempotent v19 reopen; no docs-owned SQL.
3. A hold/release barrier around an accepted delegate result.
4. Typed-tool and raw terminal bracket-token entry points with mutually
   exclusive product-owned origin receipts.
5. Product-owned reads of captured/current recipient authority and durable
   queue/adoption disposition.
6. Controlled `/new`, `/reset`, fallback, compaction, restart/replay,
   session-ID rollover, late materialization, delete/recreate, owner change,
   actual access removal, restrictive visibility, and explicit revocation when
   exposed.
7. Independently sourced prompt-adoption, heartbeat-wake, and visible-channel
   counters with product release/scan timestamps.
8. Successor transcript and trusted system-event scans for the unique held
   result marker.
9. Idempotent per-case and run cleanup receipts after fixture and gateway
   processes stop.

Until those seams exist, the plan must declare
`driver.fixtureCommand.status=missing-product-seam`, which the scenario refuses
to execute.

## Future exact-head invocation

Freeze reviewed full 40-character `<PRODUCT_SHA>` and `<DOCS_SHA>` values.
Create a private plan conforming to
`tools/k6-proofs/contracts/return-covenant-authority/fixture-input.schema.json`
with the exact candidate/runtime/docs/config identities and exact tracked
driver/gateway paths and hashes. Create empty mode-0700 control and artifact
directories outside the product tree, docs tree, and any live state, then run:

```bash
node tools/k6-proofs/scripts/launch-return-covenant-driver.mjs \
  --plan /private/run/plan.json \
  --source-dir /exact/product/checkout \
  --runtime-config /private/input/openclaw.json \
  --control-dir /private/control \
  --artifact-dir /candidate/R-CD-RETURN-COVENANT-AUTHORITY \
  > /private/launcher.log
```

The launcher, not the candidate, starts pinned k6 with raw stdout logging,
captures its real exit, finalizes cleanup, revalidates exact docs/product bytes,
and writes `observer-receipt.json`. Private plans, configs, raw observations,
logs, IDs, generations, result markers, and signing keys must never enter a
public proof directory.

## Focused validation

- Owner and closure suite:

  ```text
  node --test --test-concurrency=1 \
    tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
    tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
  ```

  Result: 37/37 pass. This includes a full synthetic 24-observation run through
  real pinned k6, real loopback driver/gateway sockets, two actual gateway
  replacements, signed resolution, and final cleanup. It is harness validation,
  not product proof.

- Existing signing authorities and active-corpus contracts:

  ```text
  node --test --test-concurrency=1 \
    tools/k6-proofs/scripts/__tests__/r-cd-2-authoritative-receipt.test.mjs \
    tools/k6-proofs/scripts/__tests__/r-cd-token-authoritative-receipt.test.mjs \
    tools/k6-proofs/scripts/__tests__/current-corpus-active-scope.test.mjs \
    tools/k6-proofs/scripts/__tests__/check-proof-row-manifests.test.mjs \
    tools/k6-proofs/scripts/__tests__/telemetry-contract.test.mjs
  ```

  Result: 44/44 pass.

- Current corpus and catalog:

  ```text
  node tools/k6-proofs/scripts/validate-corpus.mjs --current
  node tools/k6-proofs/scripts/validate-corpus.mjs --index
  node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
  node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
  node tools/k6-proofs/scripts/check-scenario-alignment.mjs
  node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
  ```

  Result: all pass; 37 current rows, zero missing manifests, 42 catalog
  manifests, 35 runnable scenario files, and no telemetry-rebindable PASS
  claim.

- All changed JavaScript passes `node --check`; all changed JSON parses; the
  Draft 2020-12 adversarial schema control passes; `git diff --check` is clean.
- Pinned executor:
  `k6 v2.0.0 (commit/8c3be52cc1, go1.26.3, linux/arm64)`,
  SHA-256
  `6fcd167ac6525e444bb710a2cb98dbe200ef12a6e0a4e9f83d062a4acabc1e70`.
- Independent final review: the one reported fallback-shape finding is closed;
  no other significant issue was found.

## Protected corpus and completion boundary

The current corpus remains byte-untouched:

- `PROOFS/7c100aede1fd9895c0ae3e3837eafc9d98ad6982/` tree:
  `ceb6b7ef59c6d6f9e2cdebb98d23f663b7e22592`
- current manifest SHA-256:
  `d19c4456643cd1ee4baf55db6954fcd29d4faf4be6a472ff6bf5ddf10ba8ff5e`
- `PROOFS/INDEX.json` blob:
  `3c719b950f8fd01ff4d4a018b9c15feee47df584`
- `PROOFS/INDEX.json` SHA-256:
  `802323debfd41a9556239c7b349cb94febdc159fb9b819d9ce2ffb7a0df37b08`

No exact-head proof, disposable `7c100aed` product control, Mode-B workflow,
Gate 3g fallback, fleet deployment, live prince, Discord/Telegram/user-data
run, proof fold, current-corpus mutation, PR creation, or presentation mutation
occurred. `exact_target_execution` and `exact_target_mode_b` remain false.
The ClawSweeper requirement is not yet satisfied; a separate reviewed execution
and folding authority must run this harness after the product seams and exact
candidate are frozen.
