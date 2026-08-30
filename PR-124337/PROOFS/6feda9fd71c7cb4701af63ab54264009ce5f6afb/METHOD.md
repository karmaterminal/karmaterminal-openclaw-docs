# Method and evidence authority

## Ownership boundary

The proof uses the production Discord composition, not an HTTP response or a
mock queue:

1. `createDiscordMessageHandler` accepts a synthetic, public-safe Discord
   `MESSAGE_CREATE` payload.
2. `createDiscordIngressMonitor` durably admits and claims it.
3. `createChannelIngressDrain` owns retry disposition and lane exclusion.
4. `createDiscordMessageDispatcher` owns debounce and invokes
   `fanInChannelIngressLifecycles` through the Plugin SDK import boundary.
5. The injected reply-lane terminal action calls the production lifecycle
   supplied through that composition.

Only the external Discord network socket is absent. No listener is needed to
exercise the gateway-message handler, and no prince runtime or fleet state is
mutated.

## Authoritative reads

After each row, the harness closes production SQLite owners and opens the
resulting files read-only with `node:sqlite`. Evidence is projected from:

- `channel_ingress_events` for ingress, claim, lane, attempt, completion, and
  dead-letter facts;
- `session_nodes` for the durable route/session binding.

The raw database hashes are recorded. Canonical rows, rather than whole-file
byte equality, are the restart invariant because opening SQLite can checkpoint
WAL state without changing logical rows.

Each PASS or FAIL envelope signs a stable serialization of its payload with an
ephemeral Ed25519 run key. `signing-public-key.json` is the matching public key.
The key authenticates unchanged run bytes; it does not assert a human identity.

## Row A

The row advances only the injected clock used by the production monitor and
queue. Real timers continue to drive the one-second Discord pump. On each
reply-lane `onAbandoned`, a docs-owned queue read captures the durable attempt
fact. The eighth genuine abandonment reaches the configured ceiling of eight,
with the queue's retained attempt field at seven because terminal `fail()` does
not increment the claim-time count.

The row then observes the follower complete, closes both state owners, reads the
canonical stores, reopens the same state through a replacement Discord handler,
and proves that neither terminal row dispatches again.

## Row B

Two durable claims from different ingress lanes are delivered to the same
Discord debounce key. One lifecycle is current and one is projected to the
shipped legacy shape by omitting only `onCancelled`. The combined preflight
receipt (`combined_content_lines: 2`) proves that the production Discord
debouncer formed one fan-in. Dispatcher shutdown then invokes aggregate
cancellation: the current source uses `onCancelled`; the legacy source uses the
scoped cancel-compat `onAbandoned`. Both return to pending with attempt count
zero and no dead letter.

A separate current lifecycle is cancelled before preflight, also with zero
attempts and no dead letter. Row A is the same-process sibling control showing
that genuine abandonment still reaches the ceiling.

## Prior corpus disposition

The prior exact component corpus at product
`eee69b3d51c68c76c25c376451c161497e614a2b` was inspected in place. Its three
behavioral rows stop at shared queue/drain and direct Plugin SDK owners, set
`target_exact_execution=false`, and preserve a deployment-composite execution.
Those receipts are useful provenance but do not satisfy the requested Discord
transport boundary or exact successor execution. No behavioral artifact was
copied or relabeled; `transposed_rows` is empty.

## Diagnostics and cleanup

Every post-load harness failure emitted a signed FAIL and exited nonzero. The
paired public key is retained beside each diagnostic:

| Diagnostic | Boundary reached | Classification |
| --- | --- | --- |
| `session-store-scope-failure` | before row action | harness setup accidentally consulted default state registry; corrected to row-local environment |
| `timing-helper-failure` | before first retry observation | harness initialization-order defect |
| `projection-helper-failure` | retry ceiling and follower dispatch completed | projection helper initialization-order defect |
| `sqlite-reopen-byte-failure` | canonical rows stable and replay empty | over-strict whole-file equality rejected a WAL checkpoint |

The successful harness removes each named temporary state root after projection.
An independent shell scan after the strengthened refire at
`2026-08-30T15:26:49Z` found zero
`/tmp/openclaw-pr124337-discord-*` directories. The exact product worktree was
clean after execution.
