# Return-covenant authority proof harness

Status: **runtime artifact attested; product fixture seam missing; no proof run**.

This document defines the reusable k6 and signed-observer contract requested by
the ClawSweeper review on openclaw/openclaw#129388. It does not claim the
return covenant is satisfied. The harness can now launch a tracked gateway blob
with a closed, read-only runtime artifact, but exact-head matrix execution and
proof folding remain deferred until the product supplies the fixture seam
described below.

## Named-reference contract

These refs were resolved before any future proof execution. `N/A` means the
surface has no local/tracking ref in this docs-only lane.

| Surface | Named ref | Local SHA | Tracking SHA | Server/object SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw@0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | N/A | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | Local object/server commit equal; exact production store authority. |
| Safe lane ref | `codeagent/129388-harness-global-schema-v15-currency-20260830` before implementation | `16f8bca6593813adb25e864c91d38f456b1708c0` | `16f8bca6593813adb25e864c91d38f456b1708c0` | `16f8bca6593813adb25e864c91d38f456b1708c0` | Local/tracking/server equal before evidence. |
| CI/workflow ref | N/A | N/A | N/A | N/A | Harness construction is focused-only; Mode-B and deployment are out of scope. |
| Presentation ref | N/A | N/A | N/A | N/A | Protected presentation, docs main, and fleet are read-only and out of scope. |
| Docs/proof ref | accepted base `16f8bca6593813adb25e864c91d38f456b1708c0`; accepted review `6995218335b0fb9205de1e6c03b48acc88418d53`; blocked corpus `ba8d344c1240275a9c54042294b8129eea4e497b` | All three objects resolve exactly | accepted base tracks as the safe lane; other refs N/A | All three server objects resolve exactly | Exact accepted history and blocked proof corpus; none is mutated. |

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

## Attested runtime artifact

The detached candidate remains Git-only. Dependencies and build output are not
copied into that source snapshot and an installed host CLI cannot replace a
candidate command. Instead, the launcher requires
`--runtime-artifact <directory>` and the plan freezes both
`target.productTreeSha` and `target.runtimeArtifactManifestSha256`.

The artifact has exactly this closed layout:

```text
runtime-artifact/
  manifest.json
  payload/
    node_modules/
    dist/
```

`manifest.json` uses
`openclaw.k6.return-covenant-runtime-artifact.v1`. It binds:

- row ID, 128-bit run ID, docs harness SHA, exact product commit, and exact
  product tree;
- the complete product-tree authority plus regular Git blob and SHA-256
  identities for `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `node-version.mjs`, `scripts/build-all.mts`, `scripts/tsx.mjs`, and both
  tsdown configurations;
- the exact `pnpm run build` command, package-manager field/version,
  package-manager executable digest, Node
  version/platform/architecture/libc, modules/N-API versions, and Node
  executable digest;
- the exact current-platform
  `pnpm install --prod --frozen-lockfile --os ... --cpu ... --libc ...`
  dependency-closure command; and
- every generated `dist` subtree for a workspace package actually linked by
  that production closure, with source path, mounted artifact path, counts,
  bytes, and inventory digest; and
- a sorted complete inventory of every payload directory and regular file,
  including immutable mode, size, per-file SHA-256, per-root inventory
  digests, total counts/bytes, and one closure digest.

The reviewed producer
`build-return-covenant-runtime-artifact.mjs` requires an exact clean product
checkout and an absolute package-manager argv. It verifies the package-manager
version against the product's pinned `packageManager`, runs the product build,
creates a disposable exact Git scratch checkout, installs production
dependencies there for the attested Node platform/architecture/libc from the
frozen lock, discovers workspace links in that resulting closure, and copies
only their required source-build `dist` outputs into the matching scratch
packages before materialization. A workspace export that names `dist` without
a corresponding build output fails artifact creation. The producer removes the
scratch checkout after copying. The caller's full
build dependency tree is never pruned or replaced, including on install/copy
failure, so the same exact source can be retried. Scratch cleanup changes only
directory permissions needed for removal; it never chmods package files whose
inodes may be hardlinked to the lane-local pnpm store. The producer rejects
tracked-source mutation, materializes dependency and build closures as
independent files, and freezes all directories/files to mode `0555`/`0444`
(retaining `0555` only for executable files). The package-manager argv may pin
a stable lane-local `--store-dir`; that argv and executable digest are part of
the toolchain identity.

Before sandbox entry, the trusted launcher:

1. rejects an absent artifact or any artifact overlapping product, docs,
   control, output, or live runtime roots;
2. opens the manifest and every payload file with `O_NOFOLLOW`, rejects
   writable modes, hardlinks, symlinks, special files, unsafe paths,
   missing/extra entries, empty closure roots, count/size overflow, and
   no-follow identity changes;
3. verifies the complete inventory, all content digests, product commit/tree,
   build inputs, package-manager pin, current Node identity, docs SHA, row, and
   run against the frozen plan;
4. copies the verified bytes into the launcher-owned mode-0700 run root,
   re-verifies the private copy, and derives
   `openclaw.k6.return-covenant-runtime-artifact-binding.v1`; and
5. creates otherwise-empty candidate mount points and read-only binds only
   `payload/node_modules` to `<snapshot>/node_modules` and `payload/dist` to
   `<snapshot>/dist`.

Before it starts the candidate driver, the tracked sandbox supervisor attempts
to add owner-write permission to each mount root and a payload file, then
attempts to create a file in each root. Every operation must fail specifically
with `EROFS`; mode-based `EACCES`/`EPERM` is not read-only mount evidence. The
supervisor emits one closed observation bound to the artifact manifest digest,
and the launcher, driver attestation, cleanup chain, and signed public receipt
retain it. A plain writable bind over mode-0555 payload therefore fails before
candidate code runs.

The candidate never sees the external artifact pathname, package-manager
store, host home, credentials, live sockets, or any unrelated dependency
tree. The private copy removes the host-mutation race, and bubblewrap makes
both fixed mounts read-only even to the candidate owner. The fixture and
gateway receive only the manifest digest and product-tree identity in their
cleared environment.

The manifest digest is repeated in the driver-ready receipt, every phase
request and case observation, the retention request/response, live and final
store identities, launcher cleanup, driver attestation, and signed public
receipt. The full private binding includes the run ID; the public receipt
projects only product tree, manifest/closure digests, Node identity, and fixed
read-only mount inventory digests. A cross-run, cross-row, cross-docs, or
cross-product artifact therefore fails before driver execution and cannot be
spliced back into later observation or cleanup material.

`gatewayCommand.relativePath` is unchanged authority: it must still resolve to
a contained regular Git blob at the exact candidate commit, its working bytes
must match the planned SHA-256, and the live process must retain the exact
Node/script/argv/cwd/environment/socket ancestry. The artifact can satisfy
that blob's imports and `dist` lookup; it cannot supply or replace the
executable.

Build an artifact only from a same-host exact checkout with dependencies
installed under the repository's worktree policy:

```bash
node tools/k6-proofs/scripts/build-return-covenant-runtime-artifact.mjs \
  --source-dir /private/exact-product-checkout \
  --output-dir /private/runtime-artifact \
  --run-id rcv-<32-lowercase-hex> \
  --docs-harness-sha <DOCS_SHA> \
  --package-manager-command '["/absolute/path/to/pnpm"]'
```

The exact-product bootstrap smoke uses the same verifier, private copy, fixed
mounts, tracked-command check, cleared environment, namespace isolation, and
process/socket ownership rules without pretending the missing product fixture
driver exists. The plan binds the published runtime config's fixed repository
path, exact Git blob, and canonical SHA-256. The `--runtime-config` argument
must resolve to that tracked fixture; an identical private copy is rejected.
Only the private run-root config directory is read-write bound so the tracked
gateway can create `openclaw.json.lock` and its backup/last-good files. The
trusted inner supervisor must observe the lock while all six artifact probes
still return `EROFS`, and the lock must be released before cleanup:

```bash
node tools/k6-proofs/scripts/smoke-return-covenant-runtime-artifact.mjs \
  --plan /private/input/plan.json \
  --source-dir /private/exact-product-checkout \
  --runtime-config tools/k6-proofs/tests/fixtures/return-covenant-authority/runtime-config.valid.json \
  --runtime-artifact /private/runtime-artifact \
  --receipt /private/output/runtime-smoke.json
```

Listener discovery retries bounded transient `ENOENT`, `ESRCH`, and `EACCES`
from `/proc/<pid>/fd`. A live process that remains inaccessible reaches a
terminal failure rather than readiness. If the child exits during those
retries, its exit status and captured stdout/stderr remain the primary error.

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
- requires and completely verifies the immutable runtime artifact before any
  candidate process starts, copies it privately, then mounts only its
  dependency and build-output closures read-only at fixed candidate paths;
- creates isolated home/state/config paths and a fresh gateway token;
- runs a reviewed sandbox supervisor under bubblewrap with private PID,
  network, IPC, and user namespaces, fresh `/proc`, masked host home/runtime/tmp
  trees, and a read-only host root with only Node, reviewed docs, candidate
  snapshot, and private run-root paths rebound through the masked paths; only
  isolated home/state/config and a dedicated run-root IPC directory are
  writable. The private plan and k6 config live in a separate read-only
  authority directory. Candidate processes therefore cannot read host
  credentials, reach live host sockets, signal host peers, mutate plan/k6
  inputs, or write control/artifact paths, and namespace-init exit
  kernel-terminates descendants that call `setsid()`;
- reads candidate ready and cleanup-diagnostic files only through nonblocking
  `O_NOFOLLOW` regular-file descriptors with strict byte limits; the diagnostic
  is copied to a private `passEligible=false` envelope and never enters signed
  cleanup, while the launcher-written attestation is exposed through a
  separate read-only bind;
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
- starts a docs-owned `/proc` sampler with the sandbox and retains an exact
  Node/script/argv/cwd observation keyed by PID plus kernel start ticks before
  product `process.title` can overwrite Linux `cmdline`;
- correlates that immutable launch observation with the same live
  PID/start/executable/cwd/isolated environment and its owned LISTEN socket;
  after exact argv was independently observed, the only alternate current
  command line accepted for a gateway is the product-owned
  `openclaw-gateway` title;
- requires a live isolated gateway PID in the verified driver's process tree;
- requires distinct driver/gateway loopback sockets owned by their respective PIDs; and
- requires the canonical runtime-config digest read from the exact non-symlink
  `OPENCLAW_CONFIG_PATH` used by that gateway process; and
- requires the same product tree and runtime-artifact manifest digest in the
  ready receipt, live driver/gateway environments, observations, cleanup, and
  final signed receipt.

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

The sampler follows the same fail-closed rule as the exact product's
`scripts/e2e/lib/plugin-update/process-observer.mjs`: title mutation can retain
an earlier kernel-observed argv, but it can never manufacture one. A listener
first seen only after its argv changed, a PID/start mismatch, an unrecognized
title, or any sampler error is rejected.

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
   and runtime-config digests.
8. The docs-owned scenario may send the legacy nonce-bound resource-inspection
   request to the final isolated gateway. Current product does not expose that
   endpoint, so its response is retained only as candidate diagnostic material:
   redirects remain disabled and no response field can grant or veto PASS. The
   scenario emits the evidence line and then holds the runtime open.
9. The evidence line triggers the launcher-owned read of the isolated
   runtime's canonical stores, beginning with `state/openclaw.sqlite`. It
   freezes the complete attested process group,
   proves every member stopped, samples the driver and final gateway PID/start
   plus gateway socket identity, then opens the state root, state database,
   every registry-owned per-agent database, and all present WAL/SHM sidecars
   with `O_NOFOLLOW`. Device, inode, mode, size, and mtime identities are bound
   before the opened files are copied to a launcher-only directory and
   revalidated. Only those copies are opened with SQLite. The global snapshot
   must expose global schema v15 exactly: `flow_runs`, `subagent_runs`,
   `delivery_queue_entries`, `agent_databases`, and
   `current_conversation_bindings`. For every observed global-v15 and
   per-agent-v19 table, the semantic fingerprint requires a real `STRICT`
   table; the complete ordered `table_xinfo` inventory (including hidden
   classification, defaults, nullability, and primary-key ordinals); column
   collations; every `index_list` origin and every ordered key/auxiliary
   `index_xinfo` row; uniqueness, sort direction, and normalized partial
   predicates; all ordered foreign-key mappings, targets, actions, and match
   modes; all normalized CHECK constraints; and every generated expression
   and stored/virtual mode. The inventory also requires the exact normalized
   trigger set, including all three product-owned `session_nodes.entry_valid`
   maintenance triggers. The v15 binding table therefore rejects hidden
   generated or ordinary resurrection of the removed `target_agent_id` and
   `target_session_id` projections, table-owned uniqueness, and any target
   index other than `target_session_key, updated_at DESC, binding_key`.
   Every raw-DDL fact uses one fail-closed SQLite token scanner before
   comparison. It removes line and block comments only outside literals and
   quoted identifiers, preserves token boundaries and exact string bytes,
   understands SQLite double-quote, backtick, and bracket identifier forms,
   and rejects unterminated lexical states or unbalanced parentheses. CHECK
   normalization may discard only balanced parentheses that wrap the complete
   expression; it does not simplify, reorder, or remove inner grouping.
   Each registered per-agent snapshot must expose the exact v19
   `session_nodes.entry_json` owner and physical schema, including the
   `session_windows` CHECK and foreign-key contracts. Full-source SHA-256
   pins for `src/state/openclaw-state-schema.sql` and
   `src/state/openclaw-agent-schema.sql` at product authority `0ed59cb6`
   drive a fresh-database drift control; formatting-equivalent canonical
   migration DDL is accepted without raw SQL-text equality. A
   product-canonical cleared node
   (`entry_json={}`, `entry_valid=-1`) is ignored only when the matching
   `session_windows` row still owns its current session ID. Views,
   missing/extra constraints, columns, indexes, or triggers, malformed JSON/status,
   registry/layout disagreement, path replacement, and symlinks fail closed.
   WAL bytes are copied with the main database so a row present only in WAL is
   observable. The launcher re-samples driver/gateway/socket identity before
   resuming; teardown therefore cannot begin before the live observation
   completes.
10. After the timestamped k6 teardown record and bounded process-group
    settlement, the launcher repeats the same opened-identity snapshot without
    a live writer. The signed resolver independently requires
    evidence-end → live snapshot → teardown start/completion → shutdown
    settlement → final snapshot ordering and identical live/final resource
    sets.

The scenario emits exactly one private
`openclaw.k6.return-covenant-observation-set.v1` log record. It always reports
`PARTIAL-candidate pending signed observer receipt`; k6 status cannot promote
the row.

## Signed observer authority

After the candidate process group stops, `launch-return-covenant-driver.mjs`
consumes the private plan, k6 log/exit receipt, runtime config, and attestation,
then constructs cleanup itself. Its internal resolver uses the same shared HMAC-SHA256 sealing
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
- any direct gateway resource response is diagnostic only. Current product's
  absent endpoint, redirects, malformed bytes, or forged arrays cannot grant
  or veto PASS; the launcher still binds the expected gateway process and
  socket across its live snapshot;
- the launcher derives active delegates from canonical
  `subagent_runs.payload_json`, using product execution, cleanup-completion,
  and required-final-delivery semantics. It derives continuation work from
  canonical `flow_runs`, including the distinct work/delegate controller rules,
  the exact `core/continuation-work`
  `terminalNoticePending="retry-exhausted"` recovery marker, and the generic
  terminal-flow maintenance predicate, where any defined
  `terminalNoticePending` value is an obligation independently of controller
  imports. A terminal row that still owns either marker remains retained work
  until the durable handoff clears it. Exact-controller malformed or
  contradictory states and generic nonterminal placement fail closed. It
  derives unfinished session delivery
  from `delivery_queue_entries` (`pending` and
  failed `settlement_pending`, including durable attempt ownership). It reads
  product-registered `agents/<agent>/agent/openclaw-agent.sqlite`
  `session_nodes.entry_json` rows and treats every product-spawned row as a
  temporary session in the fresh isolated state, even after all registry and
  queue rows have retired; root and UI-only parent rows are not temporary. Indexed
  child/requester/controller keys plus nested delivery, continuation-target,
  swarm-owner, flow-owner, and flow child/target keys remain bound as
  diagnostic correlation rather than a gate on retention.
  Unknown or malformed status/JSON/lineage, table/view/column drift,
  registry/layout disagreement, identity change, symlink, missing sidecar
  identity, unstable live/final resources, or count overflow forces
  `unverified-resource-retention`;
- the launcher derives gateway and fixture-process counts from its `/proc`
  PID/start, process-group, and socket observations; derives
  `allCaseHandlesClosed` and the handle set from exact phase-chain coverage and
  the docs-owned issued/closed/open request ledger, not any `closed` value in
  candidate cleanup; and requires every count to be zero; and
- candidate cleanup claims remain non-authoritative, but their fixed path,
  bounded regular-file read, JSON parse, and closed diagnostic shape are
  classified before cleanup. Missing, symlinked, malformed, oversized, or
  otherwise rejected candidate diagnostics cannot interrupt trusted cleanup;
  the redacted category is bound into cleanup and forces a signed
  `FAIL-candidate`;
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
cleanup failure produces a signed `FAIL-candidate`. Candidate
`retained`/`allCaseHandlesClosed` values are private diagnostic input only and
cannot override any trusted observation. Only failure to produce a readable,
canonical diagnostic record affects the verdict, through its bounded signed
failure category rather than through candidate-supplied claims.

## Required product seam

Product authority `0ed59cb6` contains the internal epoch and final-delivery checks, but
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
9. canonical v15 global and v19 per-agent SQLite stores at the product-owned
   default paths, including their WAL/SHM sidecars and registry metadata; and
10. launcher-derived cleanup after the fixture and isolated gateway processes
   stop.

Until all ten are present, the plan must say
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
  --runtime-config tools/k6-proofs/tests/fixtures/return-covenant-authority/runtime-config.valid.json \
  --runtime-artifact /private/input/runtime-artifact \
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
  candidate-cleanup-diagnostic.json
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
| candidate says zero while a delegate remains | `resource-retention` |
| candidate says zero while a queue item remains | `resource-retention` |
| candidate says zero while a temporary session remains | `resource-retention` |
| candidate says all handles closed with missing/duplicated coverage or an explicitly open handle | `phase-chain-mismatch` |
| candidate resource-inspection seam missing, stale, or malformed with clean canonical stores | diagnostic only; canonical stores can still yield `PASS-candidate` |
| current-product `payload_json` retains a subagent | `resource-retention` |
| `delivery_queue_entries` retains pending/settlement work or attempt ownership | `resource-retention` |
| canonical `session_nodes.entry_json` retains a run-bound spawned session | `resource-retention` |
| spawned child session remains after every run/flow/queue row retires | `resource-retention` |
| unknown/malformed lifecycle or delivery status/JSON | `unverified-resource-retention` |
| missing, renamed, or view-substituted canonical table/column | `unverified-resource-retention` |
| global v13, v14, future version, metadata disagreement, or wrong owner | `unverified-resource-retention` |
| removed v15 binding projection resurrected or required projection absent | `unverified-resource-retention` |
| missing, extra, reordered, or direction-mutated canonical index | `unverified-resource-retention` |
| symlink or pathname swap after no-follow open | `unverified-resource-retention` |
| WAL/SHM identity changes after no-follow open | `unverified-resource-retention` |
| retained row exists only in WAL | row is observed and yields `resource-retention` |
| driver/gateway PID/start/socket changes across live snapshot | `unverified-resource-retention` |
| live snapshot overlaps teardown | `unverified-resource-retention` |
| clean exact product-shaped stores plus settled process teardown | `PASS-candidate` |
| one identifier reused across phases | `phase-chain-mismatch` |
| phase response without launcher HMAC | `phase-proof-mismatch` |
| mixed explicit-revocation executed/N/A forms | `revocation-capability-mismatch` |
| loopback socket owned by another process | driver attestation rejected |
| retained launcher run root | direct cleanup rejected |
| no runtime artifact | launcher rejects before driver execution |
| artifact product commit/tree, docs, row, or run mismatch | launcher rejects before driver execution |
| altered manifest or payload digest | launcher rejects before driver execution |
| missing/extra inventory entry or closure root | launcher rejects before driver execution |
| writable artifact root/file | launcher rejects before driver execution |
| mode-0555 payload exposed through writable bind | trusted supervisor `chmod` succeeds, so launch fails before driver execution |
| symlink, hardlink, path traversal, FIFO, device, or other special file | launcher rejects before driver execution |
| wrong Node or package-manager identity | producer/verifier rejects before driver execution |
| dependency closure without build output, or build output without dependencies | launcher rejects before driver execution |
| production workspace dependency lacks its generated `dist` export | producer rejects the partial closure; real gateway cannot be credited |
| untracked gateway executable substitution | tracked-command verifier rejects before driver execution |
| gateway overwrites Linux argv through `process.title` | only a prior docs-owned exact argv observation for the same PID/start can bind the titled listener |
| valid closure mounted in bubblewrap | both fixed roots are present and unwritable |
| isolated config directory mounted read-only | exact gateway fails on `openclaw.json.lock`; successor binds only that private directory read-write |
| transient `/proc/<pid>/fd` `EACCES` | bounded retry reaches the real child listener |
| persistent live-process `/proc` `EACCES` | bounded terminal failure; never readiness |
| child exits during `/proc` `EACCES` | original child exit/stdout/stderr is surfaced |
| private copy of the published runtime config | rejected before sandbox creation even when bytes match |
| published runtime config missing `gateway.mode=local` | exact gateway exits 78; tracked fixture is bootable |
| gateway launch failure after artifact verification | private artifact/run root removed; original sandbox cause retained |
| runtime config spliced from another run | `isolated-runtime-unavailable` |
| nonzero k6 exit or mismatched teardown | `scenario-failure` |
| retained process and incomplete cleanup | `resource-retention` and/or `cleanup-failure` |
| ambient-only Codex plugin | `isolated-runtime-unavailable` at receipt authority |
| signed receipt tampering | invalid integrity |

The complete synthetic matrix passes only inside the harness test. It is not a
product behavior run, an exact-head receipt, or corpus evidence.

## Current completion boundary

- No exact-head proof ran.
- The exact-product runtime smoke is bootstrap evidence only; it cannot satisfy
  or promote the absent product-owned fixture seam.
- No disposable control was run against `7c100aed`.
- No Mode-B workflow or fleet deployment ran.
- No live prince, Discord, Telegram, or user data was used.
- No `PROOFS/INDEX.json`, existing `PROOFS/<sha>/`, row verdict, rollup,
  `exact_target_execution`, or `exact_target_mode_b` value changed.
- No PR body, label, comment, or presentation branch changed.
- The ClawSweeper requirement remains unsatisfied until a reviewed final product
  SHA executes this matrix and its signed receipt is reviewed and folded by a
  separate authority.
