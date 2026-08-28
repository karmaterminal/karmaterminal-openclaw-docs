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
| Product/base ref | `karmaterminal/openclaw:scribe/129388-covenant-upstream-absorb-20260828` | N/A | N/A | `c1ff1b336e472f05c6b0060b3910e53ddf31723c` | Server safe branch advanced after harness construction began; this lane did not freeze or execute it as a final product candidate. |
| Product contract-reading checkpoint | `karmaterminal/openclaw@7c100aede1fd9895c0ae3e3837eafc9d98ad6982` | N/A | N/A | `7c100aede1fd9895c0ae3e3837eafc9d98ad6982` | Exact immutable object used only to read the recipient-authority contract; no execution credit. |
| Product absorb input | `openclaw/openclaw@babb2fc7c1363587a4e08266d59772e35a78d1c9` | N/A | N/A | `babb2fc7c1363587a4e08266d59772e35a78d1c9` | Commit object resolves on GitHub; the separate product lane owns its schema-v19 convergence. |
| Safe lane ref | `codeagent/129388-covenant-authority-proof-harness-20260828` reviewed harness tip | `92affa163c0e14f7cd9d1ef76ac19f089d85b503` | `92affa163c0e14f7cd9d1ef76ac19f089d85b503` | `92affa163c0e14f7cd9d1ef76ac19f089d85b503` | Local, tracking, and server were equal before the final report successor. |
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
after the product-owned command exists. Promotion also moves the reviewed
scenario from `contracts/return-covenant-authority/scenario.js` into
`scenarios/r-cd-return-covenant-authority.js`. Merely adding an endpoint name,
moving the file, or changing the current manifest would not close the seam.

## Matrix contract

Every executed behavioral case runs sequentially in the exact order:
`continue_delegate(...)` typed tool and terminal
`[[CONTINUE_DELEGATE: ...]]` bracket token. Same-session concurrency is
forbidden.

The plan itself cannot name live data. Its run ID is `rcv-` plus 128 bits of
lowercase hex; every logical session key and the synthetic channel key must be
derived exactly from that run ID and case ID.

| Case | Lifecycle edge after acceptance | Required authority relation | Final-effect authority |
|---|---|---|---|
| `allowed-ordinary-new` | ordinary `/new` | captured = current | exact configured prompt/wake/channel counts |
| `allowed-ordinary-reset` | ordinary `/reset` | captured = current | exact configured prompt/wake/channel counts |
| `allowed-provider-fallback` | provider/model fallback | captured = current | exact configured prompt/wake/channel counts |
| `allowed-compaction` | compaction | captured = current | exact configured prompt/wake/channel counts |
| `allowed-gateway-restart-replay` | isolated gateway stops and restarts before release; durable item replays | captured = current | exact configured prompt/wake/channel counts, no duplicate |
| `allowed-session-id-rollover` | physical session ID/GUID changes under the same canonical key | captured = current | exact configured prompt/wake/channel counts |
| `allowed-late-materialization` | absent logical recipient materializes after capture | captured = current | exactly one adoption under the pre-materialization generation |
| `forbidden-delete-recreate` | explicit delete then same logical key recreated; distinct physical IDs plus deletion/recreation receipts | captured != current | stale, acknowledged/removed, zero prompt/wake/channel |
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

Before k6 starts, `launch-return-covenant-driver.mjs`:

- refuses any docs-root override: the claimed docs SHA must be the repository
  containing the executing launcher and all transitive authority modules, each
  revalidated as an exact regular Git blob before launch and final signing;
- creates a mode-0700 private run root and a detached exact-candidate snapshot;
- creates isolated home/state/config paths and a fresh gateway token;
- runs a reviewed sandbox supervisor under bubblewrap with private PID,
  network, IPC, and user namespaces, fresh `/proc`, masked host home/runtime/tmp
  trees, and a read-only host root with only Node, reviewed docs, candidate
  snapshot, and config rebound through the masked paths; only isolated
  home/state and a dedicated
  run-root IPC directory are writable, so candidate processes cannot read host
  credentials, reach live host sockets, signal host peers, or write
  control/artifact paths, and namespace-init exit kernel-terminates descendants
  that call `setsid()`;
- reads candidate ready/cleanup files only through nonblocking `O_NOFOLLOW`
  regular-file descriptors with strict byte limits; the launcher-written
  attestation is exposed through a separate read-only bind;
- launches the candidate driver itself with no inherited `NODE_OPTIONS`;
- requires a distinct candidate-owned gateway child process with the exact
  frozen full argv, gateway-token fingerprint, canonical config bytes, and its
  own disjoint loopback socket inode;
- generates the per-run nonce and HMAC key that phase responses must prove;
- requires exact clean product and docs `HEAD` values from the plan;
- requires a normalized product-relative command path plus SHA-256 in the plan;
- requires no-follow regular-file descriptors, regular Git blob modes, snapshot
  containment, and exact blob/hash equality before any chmod or spawn;
- requires the command's working bytes to equal its exact candidate Git blob;
- requires a product ready receipt bound to run, row, product, runtime, docs, protocol,
  launch nonce, process ID, command path/hash, and loopback endpoint; and
- requires `/proc/<pid>/cmdline`, process cwd, and the process's LISTEN socket inode to
  prove the ready endpoint is owned by the verified command from that exact
  product checkout;
- requires a live isolated gateway PID in the verified driver's process tree;
- requires distinct driver/gateway loopback sockets owned by their respective PIDs; and
- requires the canonical runtime-config digest read from the exact non-symlink
  `OPENCLAW_CONFIG_PATH` used by that gateway process.

The resulting private `openclaw.k6.return-covenant-driver-attestation.v1` is
loaded privately by k6 and later bound into the signed observer receipt. Its
private per-launch challenge is sent on every phase request, but the HMAC key
never is. Every phase response must prove key possession over its phase,
request nonce, receipt digest, attestation, process start, socket, and runtime
config. The launcher's internal resolver independently re-verifies those proofs. A
caller-authored `status=available` flag or an arbitrary loopback stub is
insufficient.

The driver and every initial/replacement gateway stay in one launcher-created
process group. The launcher samples that group throughout the run, accepts only
the exact candidate gateway command and isolated environment, binds restart
observations to a chronological initial→typed replacement→bracket replacement
lineage with observed start/exit times and real socket ownership, terminates the
whole group on failure, and requires the group to be empty before cleanup can
pass.

Each lifecycle entry retains the normalized endpoint and per-listener
port+inode fingerprints. Initial, typed-replacement, and bracket-replacement
listener sets are immutable over each process lifetime, pairwise disjoint, and
disjoint from the driver socket. The launcher observes predecessor disappearance
before it verifies each successor.

The phase order is fixed:

1. `prepare` creates the product-owned schema fixture, isolated home/state/config,
   synthetic recipient/channel data, and a case handle.
2. `dispatch` fires one delegate form with `holdCompletion=true`; it must return
   acceptance, held-result identity, captured generation, a unique result
   marker, and source-owned origin evidence. Typed-tool form requires exactly
   one tool execution and zero bracket parses; bracket form requires exactly
   one raw-final-text parse and zero typed-tool executions.
3. `transition` performs the named lifecycle edge. The request is rejected by
   the harness unless it carries the accepted receipt and captured generation.
4. `release` is impossible until the transition receipt binds the same accepted
   receipt and generation.
5. `observe` polls through a bounded settlement window and returns one complete
   observation. Product response objects remain byte-equivalent to the HMAC
   material; harness timing is stored separately. The harness's k6 execution
   monotonic clock and the product's release/scan
   timestamps must both prove the full window elapsed.
6. `cleanup` runs in `finally`, including when dispatch, transition, release, or
   observation fails.
7. `cleanup-run` binds canonical observation, phase-chain, driver-attestation,
   and runtime-config digests before the evidence line is emitted. k6 teardown
   must return the same idempotent cleanup-run receipt, and the launcher requires
   the recorded k6 exit code to be zero.

The scenario emits exactly one private
`openclaw.k6.return-covenant-observation-set.v1` log record. It always reports
`PARTIAL-candidate pending signed observer receipt`; k6 status cannot promote
the row.

## Signed observer authority

After the candidate process group stops, `launch-return-covenant-driver.mjs`
consumes the private plan, k6 log/exit receipt, runtime config, attestation, and
cleanup. Its internal resolver uses the same shared HMAC-SHA256 sealing
primitive as the existing `R-CD-2` and `R-CD-TOKEN` authorities, but with a
separate launcher-only observer key that was never passed to the candidate or
written into the attestation. The public receipt uses the distinct
`hmac-sha256-proof-launch-key-v1` algorithm. No external or live gateway
credential is accepted as observer authority.

A `PASS-candidate` requires all 24 case/form observations exactly once:

- candidate SHA, runtime build SHA, and plan SHA agree;
- docs harness SHA agrees;
- the live driver process, ready receipt, command SHA-256, and candidate Git
  blob have a valid attestation;
- schema profile operation is product-owned and complete;
- isolated runtime registration is read from the target config, not ambient
  plugin state;
- the runtime-config canonical SHA-256 agrees in the plan, live gateway process,
  driver attestation, every observation, cleanup, and launcher resolver input;
- acceptance stayed held through transition;
- every prepare, dispatch, transition, release, and per-case cleanup receipt is
  nonempty, unique, and linked to the same case handle;
- authority relation matches the allowed/forbidden case;
- typed and bracket rows carry mutually exclusive product-owned origin receipts;
- all product observations satisfy the same closed Draft 2020-12 shape enforced
  by the semantic resolver; unknown nested fields are rejected;
- queue disposition is terminal and no retry remains;
- prompt, wake, and channel counters are independently sourced and exactly
  equal expectations;
- a unique high-entropy held-result marker is bound to the accepted dispatch,
  and product-owned transcript/trusted-system-event scans for that marker are
  zero;
- settlement is complete, bounded, and actually elapsed on both harness and
  product clocks;
- one run-wide product capability inventory makes both explicit-revocation
  forms either executed or N/A together; and
- cleanup retains zero delegates, queue items, temporary sessions, gateways, or
  fixture processes and removes temporary home/state/config; and
- the launcher directly confirms its run root, snapshot, home, state,
  and config paths are absent and both attested PID/start identities are gone;
  the monitored process group is empty; and the launcher-only observer key
  authenticates cleanup and the final receipt. That key is never provided to the
  candidate or stored in the attestation.

The public receipt carries only SHA identities, timestamps, enums, counts, and
SHA-256 fingerprints. Raw logical keys, session IDs, authority generations,
dispatch/result/queue IDs, markers, prompts, and credentials are forbidden and
scanned before signing. Any missing or duplicated observation, identity drift, cross-phase receipt
reuse, form-origin mismatch, generation mismatch, side effect, retained payload,
short settlement, runtime/config gap, nonzero k6 exit, teardown mismatch, or
cleanup failure produces a signed `FAIL-candidate`.

## Required product seam

Checkpoint `7c100aed` contains the internal epoch and final-delivery checks, but
no canonical product-owned fixture/setup command or diagnostic driver was found.
The final product lane must supply, from the exact candidate tree:

1. a product-tracked command that starts the loopback v1 driver with isolated
   home/state/config and emits the ready receipt required by the attestor;
2. canonical creators for fresh v19, covenant v18, participant v18, and v19
   reopen fixtures—no docs-owned SQL;
3. a hold/release barrier around accepted delegate completion;
4. typed-tool and bracket-token dispatch entry points with source-owned,
   mutually exclusive origin receipts;
5. product-owned reads of captured/current recipient generation and durable
   queue/adoption disposition;
6. controlled `/new`, `/reset`, fallback, compaction, restart/replay,
   session-ID rollover, first materialization, delete/recreate, owner change,
   real access removal, restrictive visibility, and any explicit revocation;
7. separate prompt-adoption, heartbeat-wake, and visible-channel counters plus
   product release/scan timestamps;
8. successor transcript and trusted system-event marker scans; and
9. a cleanup receipt after the fixture and isolated gateway processes stop.

Until all nine are present, the plan must say
`driver.fixtureCommand.status=missing-product-seam`; the k6 scenario refuses to
start.

## Future exact-head invocation

The product lane must first freeze `<PRODUCT_SHA>` and the reviewed docs harness
must freeze `<DOCS_SHA>`. Generate a private input conforming to
`contracts/return-covenant-authority/fixture-input.schema.json`, then use the
trusted launcher to start the product-owned loopback driver. The exact product
command line is intentionally not invented here. Its driver and gateway
relative paths plus SHA-256 values must be frozen in the plan.

Create empty mode-0700 control and candidate-artifact directories outside
product, docs, and live state, then start the trusted launcher. It remains alive
while it launches the pinned `/home/figs/bin/k6` v2.0.0 itself, captures stdout
and the real child exit status through launcher-owned file descriptors, waits
for driver teardown, directly verifies cleanup, and writes the signed observer
receipt itself:

```bash
node tools/k6-proofs/scripts/launch-return-covenant-driver.mjs \
  --plan /private/run/plan.json \
  --source-dir /exact/product/checkout \
  --runtime-config /private/input/openclaw.json \
  --control-dir /private/control \
  --artifact-dir /candidate/R-CD-RETURN-COVENANT-AUTHORITY \
  > /private/launcher.log
```

The launcher invokes k6 with `--log-format raw --log-output stdout`, enforces an
overall deadline, reacts to k6 failure immediately, and supervises the detached
driver/gateway process group with bounded `SIGTERM` then `SIGKILL` escalation.
It verifies the platform entry in `k6-proof-binaries.json` through an
`O_NOFOLLOW` descriptor, exact SHA-256, and full build identity before candidate
launch. The launcher keeps a read-only descriptor to a private copy, unlinks its
pathname, executes it through inherited fd 3, and captures stdout/stderr through
anonymous pipes in launcher memory. It writes the private log and exit receipt
only after the candidate process group is gone. No candidate process chooses or
writes the k6 binary, log, or exit status.

The reviewed in-namespace supervisor launches k6 with an explicit read-only
empty config, a separate isolated k6 home/cwd, and stdout-only `handleSummary`.
It always gives the product driver a bounded graceful cleanup interval,
including for nonzero k6 exits, before the outer launcher escalates namespace
termination.

Expected private artifacts:

```text
/private/run/
  plan.json

/private/control/
  driver-ready.json
  driver-attestation.json
  cleanup-draft.json
  cleanup.json
  driver.log
  k6.log
  k6-exit-code.txt
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
| bracket request relabeled as typed execution | `origin-form-mismatch` |
| claimed window shorter than measured elapsed time | `settlement-too-short` |
| product SHA plus generation mismatch | `identity-mismatch` and `authority-generation-mismatch` |
| missing plus duplicated observation | `observation-missing` and `observation-duplicate` |
| one identifier reused across phases | `phase-chain-mismatch` |
| phase response without launcher HMAC | `phase-proof-mismatch` |
| mixed explicit-revocation executed/N/A forms | `revocation-capability-mismatch` |
| loopback socket owned by another process | driver attestation rejected |
| retained launcher run root | direct cleanup rejected |
| runtime config spliced from another run | `isolated-runtime-unavailable` |
| nonzero k6 exit or mismatched teardown | `scenario-failure` |
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
