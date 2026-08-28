# Return-covenant authority proof harness

Status: **construction complete; product fixture seam missing; no proof run**.

This document defines the reusable k6 and signed-observer contract requested by
the ClawSweeper review on openclaw/openclaw#129388. It does not claim the
return covenant is satisfied. Exact-head execution and proof folding remain
deferred until the product absorb produces a reviewed schema-v19 descendant and
the product supplies the fixture seam described below.

## Named-reference contract

These refs were resolved before any future proof execution. `N/A` means the
surface has no local/tracking ref in this docs-only lane.

| Surface | Named ref | Local SHA | Tracking SHA | Server/object SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw:scribe/129388-covenant-upstream-absorb-20260828` | N/A | N/A | `7c100aede1fd9895c0ae3e3837eafc9d98ad6982` | Server safe branch equals the contract-reading checkpoint; final execution SHA is intentionally not frozen. |
| Product absorb input | `openclaw/openclaw@babb2fc7c1363587a4e08266d59772e35a78d1c9` | N/A | N/A | `babb2fc7c1363587a4e08266d59772e35a78d1c9` | Commit object resolves on GitHub; the separate product lane owns its schema-v19 convergence. |
| Safe lane ref | `codeagent/129388-covenant-authority-proof-harness-20260828` core checkpoint | `b23c7a4b5be675a0552ffed80e4c5600c220b484` | `b23c7a4b5be675a0552ffed80e4c5600c220b484` | `b23c7a4b5be675a0552ffed80e4c5600c220b484` | Local, tracking, and server were equal before this documentation successor. |
| CI/workflow ref | N/A | N/A | N/A | N/A | Harness construction is focused-only; Mode-B and deployment are out of scope. |
| Presentation ref | `openclaw/openclaw#129388` reviewed head | N/A | N/A | `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` | Read-only presentation anchor; no body, label, comment, or protected branch mutation. |
| Docs/proof ref | `karmaterminal/karmaterminal-openclaw-docs@0984dabae218000b20178f4a031e688bdf0584ac` | `0984dabae218000b20178f4a031e688bdf0584ac` | `0984dabae218000b20178f4a031e688bdf0584ac` | `0984dabae218000b20178f4a031e688bdf0584ac` | Lane base and `origin/main` were equal at dispatch. |
| Prior harness authority | `karmaterminal/karmaterminal-openclaw-docs@39ef6b268650c5ff718226cb17fdfcf2d5f4a3da` | `39ef6b268650c5ff718226cb17fdfcf2d5f4a3da` | N/A | `39ef6b268650c5ff718226cb17fdfcf2d5f4a3da` | Commit object resolves, but it is a separate 36-commit line rather than an ancestor of the docs base. Only its isolated-runtime primitive was ported; merging it would alter 122 files and historical corpus. |

Protected corpus bytes at lane start:

- `PROOFS/7c100aede1fd9895c0ae3e3837eafc9d98ad6982/` tree:
  `ceb6b7ef59c6d6f9e2cdebb98d23f663b7e22592`
- current manifest SHA-256:
  `d19c4456643cd1ee4baf55db6954fcd29d4faf4be6a472ff6bf5ddf10ba8ff5e`
- `PROOFS/INDEX.json` blob:
  `3c719b950f8fd01ff4d4a018b9c15feee47df584`
- `PROOFS/INDEX.json` SHA-256:
  `802323debfd41a9556239c7b349cb94febdc159fb9b819d9ce2ffb7a0df37b08`

## Row disposition

The honest proposal is one new indivisible matrix row:
`R-CD-RETURN-COVENANT-AUTHORITY`.

It must not silently enrich an existing row:

| Existing row | Current scope | Why it is not this authority |
|---|---|---|
| `R-CD-2` | Typed `silent-wake`; current corpus state `partial` | Its signed authority joins one accepted dispatch, topology, wake, and no-channel receipt. It does not hold a result across recipient-generation transitions, test revocation, or cover schema-v19 setup. |
| `R-CD-4` | Cross-session `targetSessionKey`; current corpus state `pass` | Its authority is a target acknowledgement plus child identity. It does not prove that stale accepted authority is removed before prompt, wake, and channel effects. |
| `R-CD-RETURN-OVERLAP` | Static overlap/collection receipt | It explicitly does not claim isolated wake causality and has no recipient-generation boundary. |

All subcases share one invariant: the generation attached to one accepted and
held result is compared with product-owned recipient authority only after the
named lifecycle edge and immediately before final effects. Splitting them into
independent row authorities would allow acceptance from one run to be spliced
with absence counters from another. One signed matrix receipt keeps the chain
indivisible while each case/form remains independently rerunnable.

No row manifest or pipeline entry is added in this lane. The eventual initial
manifest should be orchestration-gated:

```json
{
  "rowId": "R-CD-RETURN-COVENANT-AUTHORITY",
  "scenario": {
    "status": "runnable",
    "file": "r-cd-return-covenant-authority.js"
  },
  "liveRunSafety": {
    "classification": "orchestration-required",
    "requiresCandidateSha": true,
    "requiresExternalAgentOrToolInvocation": true,
    "sameSessionConcurrencySafe": false,
    "expectedArtifactClass": "PARTIAL-candidate",
    "requiredReceipts": [
      "exact-product-build-identity",
      "product-owned-schema-fixture",
      "accepted-held-dispatch",
      "recipient-generation-diagnostic",
      "lifecycle-transition",
      "queue-admission-disposition",
      "prompt-wake-channel-effect-counts",
      "bounded-transcript-and-system-event-scan",
      "signed-authoritative-receipt",
      "cleanup"
    ],
    "foldRequiresReview": true
  }
}
```

Promotion to `k6-runnable` and workflow registration is a later reviewed change,
after the product-owned command exists. Merely adding an endpoint name or
changing the current manifest would not close the seam.

## Matrix contract

Every executed behavioral case runs sequentially in both forms:
`continue_delegate(...)` typed tool and terminal
`[[CONTINUE_DELEGATE: ...]]` bracket token. Same-session concurrency is
forbidden.

| Case | Lifecycle edge after acceptance | Required authority relation | Final-effect authority |
|---|---|---|---|
| `allowed-ordinary-new` | ordinary `/new` | captured = current | exact configured prompt/wake/channel counts |
| `allowed-ordinary-reset` | ordinary `/reset` | captured = current | exact configured prompt/wake/channel counts |
| `allowed-provider-fallback` | provider/model fallback | captured = current | exact configured prompt/wake/channel counts |
| `allowed-compaction` | compaction | captured = current | exact configured prompt/wake/channel counts |
| `allowed-gateway-restart-replay` | isolated gateway stops and restarts before release; durable item replays | captured = current | exact configured prompt/wake/channel counts, no duplicate |
| `allowed-session-id-rollover` | physical session ID/GUID changes under the same canonical key | captured = current | exact configured prompt/wake/channel counts |
| `allowed-late-materialization` | absent logical recipient materializes after capture | captured = current | exactly one adoption under the pre-materialization generation |
| `forbidden-delete-recreate` | explicit delete then same logical key recreated | captured != current | stale, acknowledged/removed, zero prompt/wake/channel |
| `forbidden-owner-reassignment` | effective owner changes | captured != current | unauthorized, acknowledged/removed, zero prompt/wake/channel |
| `forbidden-member-access-removal` | an actual member/access grant is removed | captured != current | unauthorized, acknowledged/removed, zero prompt/wake/channel |
| `forbidden-restrictive-visibility` | visibility becomes more restrictive | captured != current | unauthorized, acknowledged/removed, zero prompt/wake/channel |
| `forbidden-explicit-revocation` | final product's explicit revocation API, when exposed | captured != current | revoked, acknowledged/removed, zero prompt/wake/channel |

If the final product exposes no explicit revocation API, the last case may emit
`applicability=not-exposed` only with a product-owned capability receipt bound to
the exact product SHA. A harness assertion or API error is not that receipt.

The input schema requires coverage of:

- fresh schema-v19 installation;
- covenant-shaped schema-v18 upgraded to v19;
- upstream participant-shaped schema-v18 upgraded to v19;
- idempotent schema-v19 reopen; and
- a gateway restart between accepted dispatch and result release.

The committed synthetic plan assigns all four database profiles across the
matrix. A real run must replace its synthetic SHA and command data with the
frozen refs; test fixture values are never evidence.

## Owning composition boundary

At checkpoint `7c100aed`, the product's internal boundary is:

1. `captureSessionRecipientAuthority()` creates or reads one UUID epoch for the
   canonical logical session key.
2. `enqueueContinuationReturnDeliveries()` revalidates that epoch before
   durable enqueue, after enqueue, and before wake.
3. A forbidden transition advances the epoch. Ordinary rollover, fallback,
   compaction, reopen, and first materialization preserve it.
4. A stale queued event must be removed and its durable delivery acknowledged
   before `requestHeartbeatNow()`.
5. Prompt adoption is a later boundary and must independently revalidate the
   attached authority.

The harness therefore rejects transport success, a tool-result status, or an
API error as proof. Its owner observation is the final composition of:

- accepted dispatch receipt;
- held result carrying the captured generation;
- product-owned current-generation diagnostic;
- successor session identity;
- durable queue/adoption disposition;
- independently sourced prompt-adoption, heartbeat-wake, and channel-delivery
  counters; and
- bounded successor transcript plus trusted system-event scans.

## Product-owned fixture driver

The scenario accepts only an HTTP loopback URL and the protocol
`openclaw.k6.return-covenant-fixture-driver.v1`. The driver is a test-only
process launched from a file tracked in the exact product commit; it is not a
new production network API.

The phase order is fixed:

1. `prepare` creates the product-owned schema fixture, isolated home/state/config,
   synthetic recipient/channel data, and a case handle.
2. `dispatch` fires one delegate form with `holdCompletion=true`; it must return
   acceptance, held-result identity, and captured generation.
3. `transition` performs the named lifecycle edge. The request is rejected by
   the harness unless it carries the accepted receipt and captured generation.
4. `release` is impossible until the transition receipt binds the same accepted
   receipt and generation.
5. `observe` polls through a bounded settlement window and returns one complete
   observation.
6. `cleanup` runs in `finally`, including when dispatch, transition, release, or
   observation fails.

The scenario emits exactly one private
`openclaw.k6.return-covenant-observation-set.v1` log record. It always reports
`PARTIAL-candidate pending signed observer receipt`; k6 status cannot promote
the row.

## Signed observer authority

`resolve-return-covenant-authority-receipt.mjs` consumes the private plan, k6
log, isolated runtime config, and cleanup receipt. It uses the same shared
HMAC-SHA256 gateway-token sealing primitive as the existing `R-CD-2` and
`R-CD-TOKEN` authorities.

A `PASS-candidate` requires all 24 case/form observations exactly once:

- candidate SHA, runtime build SHA, and plan SHA agree;
- docs harness SHA agrees;
- schema profile operation is product-owned and complete;
- isolated runtime registration is read from the target config, not ambient
  plugin state;
- acceptance stayed held through transition;
- authority relation matches the allowed/forbidden case;
- queue disposition is terminal and no retry remains;
- prompt, wake, and channel counters are independently sourced and exactly
  equal expectations;
- transcript and trusted-system-event stale-result scans are zero;
- settlement is complete and bounded; and
- cleanup retains zero delegates, queue items, temporary sessions, gateways, or
  fixture processes and removes temporary home/state/config.

The public receipt carries only SHA identities, timestamps, enums, counts, and
SHA-256 fingerprints. Raw logical keys, session IDs, authority generations,
dispatch/result/queue IDs, markers, prompts, and credentials are forbidden and
scanned before signing. Any missing or duplicated observation, identity drift,
generation mismatch, side effect, retained payload, incomplete settlement,
runtime-plugin gap, or cleanup failure produces a signed `FAIL-candidate`.

## Required product seam

Checkpoint `7c100aed` contains the internal epoch and final-delivery checks, but
no canonical product-owned fixture/setup command or diagnostic driver was found.
The final product lane must supply, from the exact candidate tree:

1. a command that starts the loopback v1 driver with isolated home/state/config;
2. canonical creators for fresh v19, covenant v18, participant v18, and v19
   reopen fixtures—no docs-owned SQL;
3. a hold/release barrier around accepted delegate completion;
4. typed-tool and bracket-token dispatch entry points;
5. product-owned reads of captured/current recipient generation and durable
   queue/adoption disposition;
6. controlled `/new`, `/reset`, fallback, compaction, restart/replay,
   session-ID rollover, first materialization, delete/recreate, owner change,
   real access removal, restrictive visibility, and any explicit revocation;
7. separate prompt-adoption, heartbeat-wake, and visible-channel counters;
8. successor transcript and trusted system-event marker scans; and
9. a cleanup receipt after the fixture and isolated gateway processes stop.

Until all nine are present, the plan must say
`driver.fixtureCommand.status=missing-product-seam`; the k6 scenario refuses to
start.

## Future exact-head invocation

The product lane must first freeze `<PRODUCT_SHA>` and the reviewed docs harness
must freeze `<DOCS_SHA>`. Generate a private input conforming to
`contracts/return-covenant-authority/fixture-input.schema.json`, then use the
product command to start the loopback driver. The exact product command line is
intentionally not invented here.

```bash
OPENCLAW_RETURN_COVENANT_INPUT=/private/run/plan.json \
OPENCLAW_RETURN_COVENANT_DRIVER_URL=http://127.0.0.1:<PORT> \
  k6 run tools/k6-proofs/scenarios/r-cd-return-covenant-authority.js \
  > /private/run/k6.log
```

After the product fixture and isolated gateway have stopped and written their
cleanup receipt:

```bash
OPENCLAW_GATEWAY_TOKEN='<runtime-secret-from-env>' \
  node tools/k6-proofs/scripts/resolve-return-covenant-authority-receipt.mjs \
  --plan /private/run/plan.json \
  --k6-log /private/run/k6.log \
  --runtime-config /private/run/openclaw.json \
  --cleanup /private/run/cleanup.json \
  --out /candidate/R-CD-RETURN-COVENANT-AUTHORITY/observer-receipt.json
```

The token notation above is a placeholder, never a literal or committed value.
The operator must provide it through the seat's secret environment.

Expected private artifacts:

```text
/private/run/
  plan.json
  openclaw.json
  k6.log
  driver-ready.json
  cleanup.json
```

Expected public candidate artifacts after sanitization and review:

```text
R-CD-RETURN-COVENANT-AUTHORITY/<seat>/<run-id>/
  scenario-manifest.json
  product-build-identity.json
  observer-receipt.json
  cleanup-receipt.json
  row-scenario.js
```

No private log, config, raw observation, raw session key, raw generation, result
payload, or signing key may enter the public directory.

## Deterministic harness controls

The repository-local owner test covers:

| Control | Required result |
|---|---|
| allowed `/new` fixture | validates |
| correctly rejected delete/recreate fixture | validates |
| stale prompt adoption | `stale-side-effect` |
| stale wake without prompt adoption | `stale-side-effect` |
| stale visible channel delivery | `stale-side-effect` |
| product SHA plus generation mismatch | `identity-mismatch` and `authority-generation-mismatch` |
| missing plus duplicated observation | `observation-missing` and `observation-duplicate` |
| retained queue/process and incomplete cleanup | `cleanup-failure` |
| ambient-only Codex plugin | `isolated-runtime-unavailable` at receipt authority |
| signed receipt tampering | invalid integrity |

The complete synthetic matrix passes only inside the harness test. It is not a
product behavior run, an exact-head receipt, or corpus evidence.

## Current completion boundary

- No exact-head proof ran.
- No disposable control was run against `7c100aed`.
- No Mode-B workflow or fleet deployment ran.
- No live prince, Discord, Telegram, or user data was used.
- No `PROOFS/INDEX.json`, existing `PROOFS/<sha>/`, row verdict, rollup,
  `exact_target_execution`, or `exact_target_mode_b` value changed.
- No PR body, label, comment, or presentation branch changed.
- The ClawSweeper requirement remains unsatisfied until a reviewed final product
  SHA executes this matrix and its signed receipt is reviewed and folded by a
  separate authority.
