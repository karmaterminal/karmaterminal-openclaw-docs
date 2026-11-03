# Continue-work signal RFC v2: archived material

This file holds, verbatim, the text removed from `docs/design/continue-work-signal-v2.md` when that RFC was cut down for presentation as upstream PR openclaw/openclaw#129388.

- Source: `karmaterminal/openclaw`, branch `scribe/20261002/p89-l8-absorb-b51feb98`, file `docs/design/continue-work-signal-v2.md` as of commit `0bc1e1ee2f` (366,909 bytes before the cut).
- Each section below names where the text came from. Where a whole section or subsection was rewritten more compactly in the RFC, the complete original is kept here, so some sentences also survive in the RFC.
- Section numbers, anchors and cross-references inside the archived text refer to the RFC as it was before the cut.

---

## Archived 1: §2.4 `continue_delegate()` semantics and return modes (closing sentence)

Without `silent-wake`, parent-orchestrated chain hops can stall. In canary testing, enrichment arrived successfully but did not trigger hop 2 until an unrelated external message arrived six minutes later.

---

## Archived 2: §4.2 Context-pressure awareness (band list lead-in)

In production and canary instrumentation, the practical bands were:

---

## Archived 3: §5.4 Continuation custody after the TaskFlow removal (complete original section, §5.4–§5.4.9)

### 5.4 Continuation custody after the TaskFlow removal

<a id="54-taskflow-backing-for-same-session-work-and-delegates" />

**Historical note.** Up to C (`7b3815d7`), TaskFlow backed three kinds of continuation state, with no opt-out: same-session `continue_work` elections, pending delegates from both the tool and the token form, and post-compaction staging. Each was a `flow_runs` row under the `core/continuation-work`, `core/continuation-delegate` or `core/continuation-post-compaction` controller.

The fork added four pieces to TaskFlow for this:

- atomic multi-row writes with an owner condition, in `task-flow-registry-mutations.ts`;
- the `chain_id` column;
- the continuation state helpers in `task-flow-continuation-state.ts`;
- a durable-obligation prune guard in `task-flow-durable-obligation.ts`.

Upstream removed the whole Tasks/TaskFlow runtime in openclaw/openclaw#159179 (`6652f7eac8`) and provided no compatibility facade. This section is the design of record for re-homing that custody. It is a **custody revision**. A design review approved the architecture and decided open questions Q1–Q8 on 2026-09-29. This section applies those rulings:

- **Q1.** The custody authority is a continuation-owned table in the shared state database, written through state-worker operations (option E, §5.4.3).
- **Q2.** The spawn owner accepts an internal launch idempotency key, so continuation records the child run ID before it spawns (§5.4.4).
- **Q3.** A delegate claim whose outcome is uncertain ends in a visible interruption notice and is never re-spawned (at-most-once, §5.4.4).
- **Q4.** Upstream is asked to register native spawns in `subagent_runs` before acknowledging them (§5.4.4, Appendix E).
- **Q5.** `chainId` stays out of the owner condition (§5.4.3).
- **Q6.** The import scrubs legacy inline attachment bytes from source rows (§5.4.5).
- **Q7.** The import fences every imported non-terminal source row against downgrade (§5.4.5).
- **Q8.** No public listing surface is restored (§5.4.6).

The continuation keeps its §5.1 non-configurability. Durability is still unconditional, but for delegates it now ends at the claim (Q3, §5.4.4): queued work survives restart until it is claimed, and a claim that a restart leaves unresolved ends in a visible interruption, not a replay. Process hedge timers still only prompt drains of durable records.

#### 5.4.1 Upstream facts the design stands on

All citations in this subsection are at `4d8c9bdd`.

**`flow_runs` survives, but nothing uses it.** The table and its indexes still exist in `src/state/openclaw-state-schema.sql`, so fresh installs still create it. The storage docs state the removal's contract:

- _"their non-Cron rows remain untouched and unused by the runtime"_ (`docs/reference/database-schemas/layout.md`);
- they are _"not converted into a replacement ledger"_, with _"No table drop, SQL schema change, or schema-version bump"_ (`docs/reference/database-schemas/versioning.md`).

No production code reads `flow_runs`. The upstream schema also has no `chain_id` column: that column was a fork-only additive column.

**Retained owners took over by responsibility.**

- Cron owns its `runtime = 'cron'` history rows (`src/cron/store/run-history.kernel.ts`).
- Subagent custody is the `subagent_runs` table: `run_id` primary key, `child_session_key`, `requester_session_key`, `controller_session_key`, and a canonical `payload_json`.
- Session-addressed durable replay is `delivery_queue_entries` (`src/infra/session-delivery-queue-storage.ts:enqueueSessionDelivery`).
- The prerequisite batches follow the same pattern. For example, #158222 moved cron history to cron's own worker and store, and #158702 moved follow-up completion custody to sessions and subagents.

**Database access rules** (root `AGENTS.md`; `docs/reference/database-schemas/worker-access.md`):

- Runtime database access runs in worker threads.
- Writers use the state worker broker: `src/state/openclaw-state-worker-store.ts:runOpenClawStateWorkerOperation`, with a synchronous `src/state/openclaw-state-db.ts:runOpenClawStateWriteTransaction` inside the worker.
- Transactions contain no `await`. They reread authoritative rows before writing.

**Adding a table:**

- A new table needs no schema-version bump (_"New tables qualify because older builds ignore them"_, `versioning.md`).
- It does trigger the storage review checkpoint (`docs/reference/database-schemas/storage-changes.md`, "Review checkpoint for material changes").
- So does _"a second interpretation of existing durable data"_, which is what a Doctor import of `flow_runs` rows is.

**Restart doctrine for children.** `src/agents/subagents/registry/subagent-registry-restart-recovery.ts:recoverInterruptedSubagentRow` finalizes a child interrupted by a Gateway restart as an error. It states: _"Old launch receipts are evidence of uncertain effects, never permission to replay a child."_

#### 5.4.2 Requirement 1: the full durable replay state and its new home

The re-home preserves the protocol, not only the create/CAS/finish API shape. Every field that continuation writes into a TaskFlow row at C moves to a named home. Anything this section does not list is a TaskFlow-generic column that continuation never read.

**Owner.** Every row below moves into one **continuation custody store**: a continuation-owned table in the shared state database, `continuation_records`. The table choice is justified in §5.4.3. Continuation code in `src/auto-reply/continuation/` is its only writer. Everything reads it through the continuation's operations: the read-only worker scope for reads, and a continuation state-worker operation family for writes. Nothing reads the table directly.

**`flow_runs` columns** (at C: `src/state/openclaw-state-schema.sql:1830-1855`, whose `chain_id` column is fork-only, added through `openclaw-state-db-additive-columns.ts`):

| `flow_runs` column at C                                                                                | Continuation use at C                                                                                                           | New home                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flow_id`                                                                                              | Record identity. The attachment payload file is bound to it (`payload.flowId`).                                                 | `record_id` (primary key). Imported records reuse the legacy `flow_id` byte for byte (§5.4.5), so payload bindings stay valid.                                                                                                |
| `controller_id`                                                                                        | Selects work, delegate or post-compaction                                                                                       | `kind`, one of `work`, `delegate`, `post_compaction`, enforced by a `CHECK` constraint                                                                                                                                        |
| `owner_key`                                                                                            | Owning session key; the main query key                                                                                          | `owner_session_key`, indexed together with `kind` and `status`                                                                                                                                                                |
| `chain_id` (fork-only)                                                                                 | Copied from `work.chainId` on work rows; never a precondition                                                                   | `chain_id` on work records. It is also kept in the state JSON, as at C.                                                                                                                                                       |
| `revision`                                                                                             | Expected-revision CAS on every mutation; rollback and handoff also use exact revision arithmetic                                | `revision`: the same CAS. The +1/+2 conventions are replaced by explicit fields (`handoff`, and `rollbackOf` below), so revision is only a concurrency token.                                                                 |
| `status`                                                                                               | `queued`, `running`, `succeeded`, `failed`, `cancelled` (continuation never used `waiting`, `blocked` or `lost`)                | `status`: the same five values, enforced by `CHECK`                                                                                                                                                                           |
| `current_step`                                                                                         | Human-readable phase. Work rollback restores it exactly.                                                                        | `phase` (text), restored exactly by rollback                                                                                                                                                                                  |
| `blocked_summary`                                                                                      | Failure or requeue reason                                                                                                       | `failure_reason`                                                                                                                                                                                                              |
| `cancel_requested_at`                                                                                  | "Do not drive" fence (cancel request, reset, restoring rollback)                                                                | `cancel_requested_at`, with the same meaning                                                                                                                                                                                  |
| `created_at`                                                                                           | Work: `electedAt`. Delegate: **the due-time base** (`createdAt + delayMs`). Also FIFO order and the recovery cutoffs.           | `created_at`. It is carried exactly on import, because delegate due times derive from it.                                                                                                                                     |
| `updated_at`                                                                                           | A clock: the stale check for recovering running rows, and the running cutoffs. Anchoring sets it to the anchor time on purpose. | `updated_at`, with the same semantics, including the anchor-time assignment                                                                                                                                                   |
| `ended_at`                                                                                             | Set on terminal writes, cleared on requeue                                                                                      | `ended_at`                                                                                                                                                                                                                    |
| `state_json`                                                                                           | All controller state (below)                                                                                                    | `state_json`, typed per `kind` by the continuation codecs. Work stays non-strict and delegate stays strict, as at C.                                                                                                          |
| (derived)                                                                                              | Due-time scans went through the resident in-memory map                                                                          | `due_at`: a derived, indexed copy of the effective due time (`max(dueAt, recoveryDueAt)` for work, `created_at + delayMs` for delegates). It exists only for recovery scans. The authoritative clocks stay in the state JSON. |
| `shape`, `sync_mode`, `notify_policy`, `goal`, `requester_origin_json`, `blocked_task_id`, `wait_json` | Constant, null, or a label only (`goal`)                                                                                        | Not carried. `goal` is recomputed from the state when diagnostics need a label.                                                                                                                                               |

**Work state** (`work-flow-state.ts:PendingWorkStateSchema`, non-strict):

| Group                            | Fields at C                                                                                                                 | New home and required atomicity                                                                                                                                                                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and routing             | `kind`, `sessionKey`, `hop`, `reason`, `parentRunId`, `originRunId`, `originTurnId`, `traceparent`, `traceparentProvenance` | Unchanged, in `state_json`. `originRunId`/`originTurnId` still gate rollback ownership and anchor finalization. `parentRunId` still exists only for the orphan-reap liveness join.                                                                                                                |
| Chain and cost snapshot          | `maxChainLength`, `chainStartedAt`, `accumulatedChainTokens`, `chainId`                                                     | Unchanged, in `state_json`. `chainId` is also a column. The live chain counters stay on the `SessionEntry` (§3.3). They are not moved into the custody store.                                                                                                                                     |
| Timing clocks                    | `delayMs`, `electedAt`, `dueAt`, `anchorPending`, `anchorFinalizedAt`, `recoveryDueAt`, `releasedAt`                        | Unchanged, in `state_json`. Anchor finalization is one CAS write. It never mutates semantic `dueAt` on retry: retries still write only `recoveryDueAt`. `releasedAt` stays persisted (audit only).                                                                                                |
| Retry and busy-defer             | `retryCount` (limit 8), `busySkipCount`                                                                                     | Unchanged; they feed `busySkipBackoff` (§5.1)                                                                                                                                                                                                                                                     |
| Idle arming                      | `idleRetry { trigger, reasonCategory, armedAt }`                                                                            | Unchanged. Queued records with `trigger = "reply-run-ended"` are the **parked** records that an election may supersede (§5.4.3).                                                                                                                                                                  |
| Delivered marker and disposition | `succeeded { point, durability }`, `deliveredAt`, `turnGrantedAt`, `foldedAt`, `overdueByMs`, `disposition`                 | Unchanged. The durable delivered mark is written while the record is still `running`, and it prevents a restart-gap duplicate turn. Consume, recovery peek, idle-retry and the live-work check all still treat it as done.                                                                        |
| Terminal-notice obligation       | `terminalNoticePending: "retry-exhausted"`                                                                                  | Unchanged, in `state_json`. **Changed atomicity (stronger):** the notice's `delivery_queue_entries` insert and the obligation clear commit in **one** state-database transaction, because both tables live in the shared state database. At C they were two writes, joined by an idempotency key. |
| Prune guard                      | `task-flow-durable-obligation.ts:hasUnfulfilledDurableObligation` (blocked TaskFlow's 7-day retention)                      | Custody-store retention (§5.4.6): terminal records of any kind are pruned after 7 days **unless** `terminalNoticePending` is present. That includes the delegate interrupted-spawn notice.                                                                                                        |

**Delegate and post-compaction state** (`delegate-flow-state.ts:PendingDelegateStateSchema`, strict):

| Group                                | Fields at C                                                                                                                                                                                                                                                                                                                                                                                                        | New home and required atomicity                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity and payload                 | `kind`, `task`, `originRunId`, `model`, `traceparent`, `traceparentProvenance`                                                                                                                                                                                                                                                                                                                                     | Unchanged. `originRunId` still drives replay dedupe and `failQueuedDelegatesOwnedByRun`.                                                                                                                                                                                                                                                                                       |
| Mode and return policy               | `silent`, `silentWake`, `postCompaction`, `inheritedSilent`, `inheritedWake`                                                                                                                                                                                                                                                                                                                                       | Unchanged. `post_compaction` records are also distinguished by `kind`.                                                                                                                                                                                                                                                                                                         |
| Timing                               | `delayMs`, `firstArmedAt`, `releasedAt`                                                                                                                                                                                                                                                                                                                                                                            | Unchanged. The due time stays `created_at + delayMs`.                                                                                                                                                                                                                                                                                                                          |
| Target and authority                 | `targetSessionKey`, `targetSessionKeys`, `fanoutMode`, `recipientAuthorityBinding` (pending or selected, with epochs)                                                                                                                                                                                                                                                                                              | Unchanged before the handoff. **At the handoff** these fields move, in upstream's registration commit, to the continuation fields of the `SubagentRunRecord` (`continuationTargetSessionKey(s)`, `continuationFanoutMode`, `continuationRecipientAuthorityBinding`, `silentAnnounce`, `wakeOnReturn`, `traceparent`). That is where return routing already reads them at C.    |
| Return covenant                      | `returnOptions`, `recipientContext`                                                                                                                                                                                                                                                                                                                                                                                | Unchanged before the handoff. At spawn, the return-claim store captures the immutable artifact policy (§A.6), as at C.                                                                                                                                                                                                                                                         |
| Chain state                          | `chainTokensFold`, `persistedChainState`, `persistedChainStateKind`                                                                                                                                                                                                                                                                                                                                                | Unchanged. The planned-persist marker still exists because the `SessionEntry` (per-agent database) and the custody store (shared state database) cannot share a transaction. The marker is what stops recovery from advancing the chain twice.                                                                                                                                 |
| Child-session handoff                | `childSessionKey` (set at accept; **no child run ID stored at C**)                                                                                                                                                                                                                                                                                                                                                 | Replaced by an explicit `spawnAttempts[]` list (`{attemptId, childRunId, claimedAt}`) and a `handoff` object (`{target: "subagent_runs", childRunId, childSessionKey, handedOffAt}`). This is the new idempotent handoff key (§5.4.4). `spawnAttempts[]` is kept after terminalization as evidence.                                                                            |
| Interrupted-spawn notice (new)       | none at C: C re-spawned claimed rows after a restart                                                                                                                                                                                                                                                                                                                                                               | `terminalNoticePending: "delegate-spawn-interrupted"` on a `failed` delegate record (Q3, §5.4.4). It uses the same obligation mechanism as the work notice: the notice's `delivery_queue_entries` insert and the obligation clear commit in one transaction, under an idempotency key derived from `record_id`, so exactly one notice is delivered. The prune guard covers it. |
| Attachments                          | `attachmentId`, `attachmentCount` (bytes in the private payload file); legacy inline `attachments`/`attachAs` Same payload format and 8 MiB cap, under a new root: `<stateDir>/attachments/continuation-custody/<attachmentId>/payload.json`. The payload binds `recordId` (read as `flowId` for v1 payloads) and `ownerKey`. The legacy root belongs to the import (§5.4.5). Custody release rules are in §5.4.4. |
| Post-compaction staging              | `awaitingNextCompaction`; handoff meant "succeeded at claim revision + 1"                                                                                                                                                                                                                                                                                                                                          | `awaitingNextCompaction` is unchanged. The handoff is explicit: `handoff = {target: "session_delivery_queue", queueEntryId, handedOffAt}`, committed with the queue insert (§4.4).                                                                                                                                                                                             |
| Legacy, accepted but never projected | `spawnRequesterSessionKey`, `spawnRequesterChannel`, `spawnRequesterAccountId`, `spawnRequesterTo`, `spawnRequesterThreadId`                                                                                                                                                                                                                                                                                       | Accepted on import and not projected, as at C. Recovery still rebinds to `owner_session_key`.                                                                                                                                                                                                                                                                                  |

**Transition atomicity.** Every single-record transition at C stays a single-record CAS on `revision`, and all such writes are serialized through the state worker broker's FIFO:

- claim, anchor, requeue, grant/fold finish, delivered mark, fail, interrupted-spawn terminalization, cancel request, scrub, chain-persist plan, and policy annotation.

Three transitions become multi-record transactions:

- election with parked-work replacement (§5.4.3);
- terminal-notice enqueue plus clear, for the work notice and the delegate interrupted-spawn notice alike;
- post-compaction release plus queue insert.

Work-scheduling rollback stays a multi-record CAS with no owner condition. It uses an explicit `rollbackOf` marker instead of the `prior.revision + 1` / `+ 2` inference.

#### 5.4.3 Requirement 2: one transactional authority for election replacement

**What must be preserved.** `work-replacement-store.ts:enqueuePendingWorkReplacing` elects in one SQLite write transaction at C (`task-flow-registry.store.sqlite.ts:upsertTaskFlowRegistryRecordsToSqlite`). The transaction does the following:

1. Rereads the owner's live work rows: `owner_key` = session, `controller_id` = work, `status IN (queued, running)`, `cancel_requested_at IS NULL`.
2. Requires them to equal the caller's snapshot exactly, by `(flowId, revision, status)`.
3. Requires each superseded parked row to still be at its expected revision.
4. Requires the created row to be new.
5. Writes all rows.

Before the transaction runs, the caller rejects three cases:

- `running_owner`: an unexpected running row exists;
- `capped`: there are `maxPendingWork` or more non-parked queued rows;
- `invalid_prior`.

A conflict retries once. **`chainId` is copied into the new row, but it is not part of the owner condition at C.** The owner condition already covers every live work row for the session, whatever its chain. This revision keeps that. **Decided (Q5): no chain check.** Ownership is session-wide across every live work row; making chain identity a precondition would permit two live elections after a chain transition.

**Options.** For each option: its transaction boundary, and what fits or breaks.

| Option                                                                                                                     | Transaction boundary                                                                                                                                                                                                                           | Fit                                                                                                                                                                                                                                                        | Breaks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Session pending inputs** (`src/config/sessions/session-accessor.pending-inputs.ts:stageSessionPendingInput@4d8c9bdd`) | One-row `runOpenClawAgentWriteTransaction` per input, serialized by `runExclusiveSqliteSessionWrite`, in the **per-agent** database                                                                                                            | Idempotent, session-scoped input custody                                                                                                                                                                                                                   | Pending inputs are custody for an _already admitted_ turn. They have no due time. After a restart they are recorded as `interrupted` and deliberately never replayed (`readPendingInputRows`, "without resuming a pre-restart execution"). There is no multi-row owner condition, and access is legacy main-thread code. They cannot hold a future election.                                                                                                                                                                                                                                                 |
| **B. Session-store transaction** (election state on the `SessionEntry`)                                                    | `runExclusiveSqliteSessionWrite` plus one per-agent write transaction                                                                                                                                                                          | The election and the chain counters could commit together                                                                                                                                                                                                  | Puts queues into a hot session row. Recovery must scan every agent database. Election records cannot share a transaction with `delivery_queue_entries` or `subagent_runs`, which live in the shared state database. `/reset` session rotation would need to carry or cancel embedded queues.                                                                                                                                                                                                                                                                                                                 |
| **C. Cron one-shot jobs** (`src/cron/service/jobs-validation.ts:assertSupportedJobSpec@4d8c9bdd`)                          | Cron's own worker transaction (`src/cron/store/run-admission.worker.ts:reserveCronRunsInWorker@4d8c9bdd`). Cross-row writes exist only through internal `CronStoreTransactionHooks`.                                                           | Durable timers with restart catch-up                                                                                                                                                                                                                       | `cron_jobs` has no revision CAS. Session and isolated targets accept only `agentTurn` or `command`. `systemEvent` requires the `main` target, which enqueues with no session key. So no job can deliver the trusted `[continuation:wake]` system event to an arbitrary session. Restart catch-up runs at most 5 jobs immediately and staggers the rest (`src/cron/service/timer-catchup.ts@4d8c9bdd`), which would still reorder elections. No public API writes a job and other rows atomically. It would also split the authority between the election record and the timer.                               |
| **D. Subagent registry rows** (`subagent_runs`)                                                                            | Registry write transactions: the legacy synchronous `saveSubagentRegistryChangesToSqlite` and the worker `subagents.persistChanges`                                                                                                            | Post-admission truth for delegates                                                                                                                                                                                                                         | A same-session election has no child and no run. Putting elections into the registry would give it a competing responsibility. Pre-admission delegates have no row either (§5.4.4).                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **E. Continuation-owned table in the shared state database** (accepted, Q1)                                                | One continuation state-worker operation (`runOpenClawStateWorkerOperation`) running one synchronous `runOpenClawStateWriteTransaction`: reread the owner's live work records, check the owner condition, CAS the priors, insert the new record | Keeps the exact C semantics. One authority for work, delegate and post-compaction custody. Same database as `delivery_queue_entries` and `subagent_runs`, so notice/queue writes can commit atomically and handoff checks can read inside the transaction. | A new table, which needs storage-review acceptance (no version bump). The API becomes asynchronous; at C it was a synchronous resident map. Hot synchronous readers need a lifecycle-owned projection (§5.4.6).                                                                                                                                                                                                                                                                                                                                                                                              |
| **F. A continuation-owned store over the retained `flow_runs` table**                                                      | The same worker transaction as E, but over `flow_runs`                                                                                                                                                                                         | No data copy: live rows stay where they are                                                                                                                                                                                                                | Reverses upstream's documented "untouched and unused / not converted into a replacement ledger" contract for a table upstream still ships. Would need upstream's acceptance for a second interpretation of rows it deliberately abandoned. `chain_id` is not in the upstream schema. As a bare nullable column it could be re-added without a version bump, but it would be one more fork column on a table upstream abandoned. The dead TaskFlow-generic columns come along. Retention and maintenance were deleted with TaskFlow. Our presentation PR would re-activate a subsystem upstream just removed. |

**Decided (Q1): E, with timer and idle wakes as projections only.**

Justification:

1. **One owner per responsibility.** Election, replacement, claim, delivered mark and terminal obligation all stay in one store with one writer. Timer and idle wakes change nothing in it; they only prompt a drain. The hedge timer is process-local. `idleRetry` triggers, `reply-run-ended` and `command-lane-idle` stay record fields that the dispatcher reads.
2. **The C protocol is preserved byte for byte.** The owner condition, cap, `running_owner` and `invalid_prior` checks, the single retry, and rollback all translate directly into a synchronous worker transaction. That transaction is the shape the AGENTS database rules require: plan asynchronously, then reread and write synchronously.
3. **Sharing a database with the queue and the registry strengthens two contracts.** The terminal-notice enqueue and clear become one commit. So do the post-compaction release and queue insert. The custody handoff check can read `subagent_runs` inside the same transaction that marks a delegate handed off. Upstream uses this cross-owner pattern in `admitSubagentCompletionInWorker`.
4. **It follows upstream's ownership pattern.** Every retained responsibility has exactly one owner, and that owner holds the rows. The session delivery queue owns its table. Cron took ownership of only its own `runtime = 'cron'` rows in the retained `task_runs` table, and reads them through its own worker (#158222). It did not move them to a new table (`layout.md@4d8c9bdd`). Continuation rows differ from cron's in one way that matters: their shape changes (explicit `handoff`, `spawnAttempts`, `due_at`), and upstream does not keep a `chain_id` column. That makes a continuation-owned table cleaner than re-interpreting `flow_runs` (option F). A feature with durable custody owns its store; it does not borrow a generic ledger.
5. **Costs are bounded and explicit.**
   - The table goes in `FIRST_USE_STATE_TABLES` (`src/state/openclaw-state-db-contract.ts@4d8c9bdd`), because task text and reasons are privacy-sensitive. It is created at the first continuation write, and nothing checks for it per call.
   - Storage-review acceptance is required and is requested through this RFC. It is part of presentation, not an optional follow-up (Q1).
   - Callers move from synchronous to asynchronous APIs in the implementation.

The design review accepted E (Q1).

#### 5.4.4 Requirement 3: pre-spawn custody handoff to `subagent_runs`

**Two-phase custody.** `subagent_runs` cannot own a delegate before a child exists. At `4d8c9bdd`, a native `sessions_spawn` child's row is written only _after_ the Gateway has accepted the child run. The order in `src/agents/subagents/spawn/subagent-spawn.ts:spawnSubagentDirect` and `src/agents/spawn-pipeline.ts:runSpawnPipeline` is:

1. create the child session;
2. materialize the attachments;
3. dispatch the `agent` turn;
4. `registerSubagentRun`.

The continuation custody store therefore owns the delegate before admission, and the registry owns it after. The handoff needs a key that both sides can see.

**Handoff key: a precomputed child run ID.** The Gateway uses the caller's idempotency key as the run ID (`src/gateway/agent-turn/agent-request-preflight.ts@4d8c9bdd`, `const runId = request.idempotencyKey`). Spawn already derives that key deterministically from a requester-scoped replay key (`src/agents/subagents/spawn/subagent-spawn-request.ts@4d8c9bdd`, `childIdem` from `swarmLaunchReplayKey`). However:

- the derivation is private;
- the registry's replay-key lookup, `getSwarmRunByLaunchReplayKey`, only covers collector runs;
- spawn persists the replay key only for collectors (`subagent-spawn.ts@4d8c9bdd:588`).

The implementation therefore needs one narrow change in the spawn owner (**decided, Q2**): `spawnSubagentDirect` accepts an explicit launch idempotency key for non-collector spawns and uses it verbatim as `childIdem`. Continuation derives `childRunId = continuation:<recordId>:<attemptId>` and records it in the claim _before_ calling spawn. Once the child is admitted, the registry row's `run_id` equals that `childRunId`. Recovery then looks it up by run ID (`src/agents/subagents/registry/subagent-registry.store.sqlite.ts:loadSubagentRunsByRunIdsFromSqlite@4d8c9bdd`, read through the registry's read path).

The Q2 ruling bounds the change:

- **Internal parameter only.** The launch key is a spawn-owner parameter that continuation passes in process. It is never a caller-authored `sessions_spawn` field: the tool schema does not gain it, and no model or client can supply it.
- **Reserved namespace.** `continuation:` run IDs are reserved for backend callers. The Gateway already reserves exec-approval follow-up idempotency keys the same way: a non-backend `agent` request that uses one is rejected (`src/gateway/agent-turn/agent-request-preflight.ts@4d8c9bdd`, "reserved for backend callers"). The implementation must confirm that the spawn owner's dispatch reaches the Gateway as a backend caller. If it does not, the spawn path is fixed first; the reservation is never weakened to accommodate it.
- **Collisions are not adoption.** Recovery hands a record off only to a registry row whose `run_id` equals a recorded `childRunId` **and** whose `requester_session_key` equals the record's `owner_session_key`. A row that matches the run ID but belongs to another requester is a collision. Recovery never adopts it, leaves it untouched, and terminalizes the record with the interrupted notice (below) plus a structural collision diagnostic. Attempt IDs are never reused within a record, so two attempts never share a run ID.

§9.2.2 item 8 lists the direct tests.

**What moves at the handoff:**

- **Return routing and recipient authority.** Both move into the registration commit as the `SubagentRunRecord` continuation fields.
- **Attachment custody.** Spawn materializes the bytes into the child's private receipt directory. The registry row then records its own `attachmentId` (`src/agents/subagents/spawn/subagent-attachments.ts:materializeSubagentAttachments@4d8c9bdd`). The continuation payload file is released only **after** the handoff is marked, or when the record terminalizes. A new attempt happens only after an in-process spawn failure that happened before the Gateway dispatch began (see "In-process spawn failures" below). It re-materializes from the retained payload, and spawn re-validates the bytes against the policy in force at that moment (§9.2.1).
- **Chain charge.** It is applied once, at accept, guarded by the `persistedChainState` planned-persist marker (§5.4.2).

**Crash-boundary table.** "Recovery" means the Gateway startup continuation recovery, which runs after the Doctor import (§5.4.5) and after upstream `activateSubagentRegistry`.

| #   | Boundary                                                                                                                                                  | Durable at the crash                                                      | What recovery does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Why no loss                                                                                                                              | Why no duplicate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Before the enqueue commit (tool validated; payload file possibly written)                                                                                 | At most an unreferenced payload file                                      | The startup custody reconcile deletes payload files that no live record references (`reconcileDelegateAttachmentCustody`, as at C)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | The tool reports `scheduled` only after the commit. An uncommitted delegate was never promised, and the turn sees an error.              | Nothing was enqueued                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1   | Enqueued (`queued`), not claimed                                                                                                                          | Record plus payload file                                                  | Re-arms the hedge timer and drains when due. `created_at + delayMs` is unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | The record is durable                                                                                                                    | Only one claim can win the revision CAS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2   | Claimed (`running`, `spawnAttempts[n]` recorded); spawn not yet accepted by the Gateway. The child session may exist and attachments may be materialized. | Record with `childRunId`, payload file, possibly an orphan child session  | No `subagent_runs` row under any recorded `childRunId`. **Recovery does not spawn again (Q3).** In one transaction it sets the record `failed` with `failure_reason = spawn-interrupted`, keeps `spawnAttempts[]`, scrubs the attachment reference, and sets `terminalNoticePending: "delegate-spawn-interrupted"`. It then releases the payload file, settles chain state as C does for any terminal delegate failure (`terminalChainStateForDelegate`, through the planned-persist marker), and delivers the notice (§5.4.2). A child session that was created but never dispatched is **not** settled by upstream: `src/gateway/server-startup-session-migration.ts@4d8c9bdd` selects only sessions with status `running`. That idle orphan session is left behind, just as it is after an upstream `sessions_spawn` crash at the same point, where only in-process `cleanupFailedSpawnBeforeAgentStart` cleans up. Cleaning it up is a follow-up. | Nothing is lost silently: the delegate ends in one durable, visible notice. The work is not carried past the claim; that is the Q3 trade | Continuation never starts a second child for the record                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 3   | The Gateway accepted the child run, but `registerSubagentRun` had not committed (**upstream's window**)                                                   | Same as #2                                                                | Same as #2: indistinguishable at recovery, so it terminalizes the record with the interrupted notice and does not spawn. A dispatched orphan session _is_ marked interrupted at startup (`server-startup-session-migration.ts@4d8c9bdd`), because neither `hasSubagentSessionRecoveryOwner` nor an active work admission claims it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Same as #2                                                                                                                               | **Closed by Q3.** The unregistered child may have run until the restart cut it off, so the notice says admission could not be proven. Continuation does not start a second child, so recovery adds no duplicate side effects. Upstream narrows the window in process: `spawnSubagentDirect` terminates the accepted run if registration throws. It closes for everyone only if native spawn registers before acknowledging, as plugin subagents already do (`src/gateway/agent-turn/agent-run-subagent.ts@4d8c9bdd`, "Persist the actual execution owner before acknowledging a plugin dispatch"); see Q4 below. |
| 4   | `subagent_runs` row committed (child admitted); continuation record not yet marked handed off                                                             | Record (`running`), payload file, registry row with `run_id = childRunId` | Finds the registry row for a recorded `childRunId`. In one transaction it marks `handoff`, sets `succeeded` and scrubs the attachment reference. It then releases the payload file and applies the chain charge through the planned-persist marker.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | The registry owns the child                                                                                                              | **Closed by the precomputed key.** At C this window re-dispatched running rows, which had no child run key, so it could spawn twice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 5   | Handed off; child running                                                                                                                                 | Terminal record; registry row                                             | None in continuation. Upstream recovery owns the child: a running child resumes waiting; an interrupted child is finalized as an error and delivered, never replayed (`recoverInterruptedSubagentRow`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Upstream's completion obligation delivers the terminal result (§5.4.7)                                                                   | Upstream never replays a child                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 6   | Child terminal                                                                                                                                            | Registry row, delivery obligation, queued continuation returns            | Upstream admission and delivery (`subagent-completion-admission.worker.ts:admitSubagentCompletionInWorker@4d8c9bdd`). Targeted returns redeliver from `delivery_queue_entries` under their idempotency keys.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Durable queue and obligation                                                                                                             | Idempotent queue entry IDs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Unresolved claims are at-most-once (decided, Q3).** Boundaries 2 and 3 cannot be told apart after a restart. A delegate can edit files, publish, or send messages outside the session, so uncertain prior execution does not permit running a second child. That matches upstream's no-replay doctrine for children (§5.4.1). The durability promise narrows accordingly: **queued work survives restart until it is claimed.** After a claimed spawn that a restart left unresolved, the durable outcome is one visible `[continuation:delegate-spawn-interrupted]` notice, not a replay. The notice identifies the record, its attempts and their `childRunId`s, and the task (formatted with C's `formatDelegateTaskForSystemEvent`). It states that admission could not be proven, so the owning agent can decide whether to issue a new delegate. That decision is a new, visible election; recovery never makes it. The record keeps its attempt and run-ID evidence until retention prunes it (§5.4.6).

**Bounding "no row" evidence.** Under Q3 a missing `subagent_runs` row never licenses a spawn, so the registry's row retention (`archiveAfterMinutes`, resolved in `src/agents/subagents/registry/subagent-registry-helpers.ts:resolveArchiveAfterMs@4d8c9bdd`; deletes in `subagent-registry.store.kernel.ts`) cannot cause a duplicate. It can make an admitted child look unresolved, if its row was archived before the record was marked. The handoff mark keeps that rare: it is written in the same dispatch that saw spawn accepted and retried in process until it commits, so a live Gateway never leaves an admitted child unmarked for long. When it does happen, the notice's "admission could not be proven" wording is accurate.

**In-process spawn failures.** Q3's reason covers uncertainty in general, not only across a restart. At C, a managed delegate whose spawn failed was requeued for retry, including after an error thrown once the spawn had been attempted (`src/auto-reply/continuation/delegate-dispatch.ts@7b3815d7`). The revision keeps a requeue only for a failure in spawn's `initialize` phase, before the Gateway dispatch (`src/agents/spawn-pipeline.ts:runSpawnPipeline@4d8c9bdd` tracks `initialize`, `dispatch` and `register`). A failure in the `dispatch` or `register` phase leaves execution uncertain, even when spawn's cleanup then terminates the accepted run (`subagent-spawn.ts@4d8c9bdd`, `terminateAcceptedCollectorRun` is best effort and the child may already have acted). Such a record is handled like boundary 3 and terminalized with the interrupted notice. So is any thrown error whose phase is unknown. A result that `spawnSubagentDirect` returns before the pipeline starts, such as an attachment-policy rejection or failed materialization (`subagent-spawn.ts@4d8c9bdd`), carries no `runId` and provably dispatched nothing. It keeps C's handling: a policy rejection terminalizes with C's rejection notice, and a transient failure requeues. At `4d8c9bdd`, results from inside the pipeline return `{status: "error", runId}` for all three phases. So the spawn-owner change (Q2) also exposes the failing phase in its result. Until it does, every in-pipeline error terminalizes with the interrupted notice. Before a requeued record is claimed again, the dispatcher checks `subagent_runs` under every recorded `childRunId`. A row found there is a handoff (boundary 4), never a second spawn.

**Upstream closure of boundary 3 (decided, Q4).** A proposed follow-up upstream change registers native `sessions_spawn` children in `subagent_runs` before the Gateway acknowledges the dispatch, as plugin subagents already do. Appendix E describes it. Once that change lands, every accepted child has a registry row, and the run ID precomputed under Q2 separates the two cases exactly:

- a row under a recorded `childRunId` means admitted custody, and recovery hands off (boundary 4);
- no row under any recorded `childRunId` means the Gateway never accepted the child, so it never ran.

Boundary 3 then disappears, and boundary 2 becomes a provable pre-accept failure. Recovery could then retry a boundary-2 record under a fresh attempt without replaying uncertain effects. Whether to restore that retry, and so extend the durability promise past the claim, is a policy change for a later design decision. It is not automatic. The row-retention caveat above would matter again then, because a retry, unlike a notice, is unsafe on archived evidence. Until then, Q3's at-most-once policy stands.

**Reset at any boundary.** Explicit reset cancels records in states 1 and 2, including when state 2 was really state 3. It scrubs their attachment references and releases the payload files. At C the file waited for the next startup reconcile; the revision releases it immediately. For states 4 to 6 it relies on upstream `stopSessionResetSubagents` (`src/auto-reply/reply/session-reset-cleanup.ts@4d8c9bdd`), which kills the requester's child runs.

**Post-compaction handoff.** Staging hands custody to the session delivery queue, not to the registry (§4.4). The queue drain spawns the child, and that spawn follows the same pattern:

- the queue payload carries a precomputed `childRunId` derived from `(recordId, queue attempt)`, so the drain can recompute every earlier attempt's key. Queue entries enqueued at C have none, and the drain never spawns such an entry: §5.4.5 terminalizes it;
- before it spawns, the drain persists attempt ownership on the queue entry with upstream's `markSessionDeliveryAttemptStarted` (`src/infra/session-delivery-queue-storage.ts@4d8c9bdd`), which sets `deliveryStartedAt`. Once a spawn has begun, the drain never fails the entry with `releaseAttemptOwnership`, because that clears `deliveryStartedAt` (`session-delivery-queue.worker.ts@4d8c9bdd`) and would make the entry look never-attempted. It keeps release only for failures in spawn's `initialize` phase;
- on every delivery, the drain first checks `subagent_runs` under the entry's `childRunId`s. A row found there settles the entry as delivered;
- an entry with `deliveryStartedAt` set and no row is an unresolved claim. Under Q3 the drain does not spawn. It first enqueues one `[continuation:delegate-spawn-interrupted]` notice to the owner session, under an idempotency key derived from the entry ID, and then settles the entry as failed. A crash between the two writes repeats the same decision on the next delivery. The notice enqueue then resolves to the same queue entry ID, so the notice stays single. Upstream applies the same rule to its own queued agent turns ("queued agent turn dead-lettered after an interrupted unproven attempt", `src/gateway/server-restart-sentinel.ts@4d8c9bdd`).

The `postCompactionDelegate` queue kind is fork-owned: upstream's session queue carries only `systemEvent` and `agentTurn` (`src/infra/session-delivery-queue.records.ts@4d8c9bdd`), and its started-attempt rule covers only `agentTurn`. The rule above is therefore the fork's own drain contract. The `childRunId` payload field is a change to a fork-owned queue payload, and it goes to storage review together with the new table. At C the queue drain had no such key and marked no attempt, so it re-spawned after a restart.

#### 5.4.5 Requirement 4: migrating stored continuation TaskFlow rows

#159179 leaves `flow_runs` rows in place and removes their only reader. Queued and running continuation rows that exist on live installations at the cutover would otherwise become unreadable residue. A **Doctor state migration** imports them. Its step ID is `continuation-taskflow-custody-import`. It is a core step, because continuation is core-owned. It is registered through `ownerStep(...)` in `buildLegacyStateMigrationSteps` (`src/infra/state-migrations.doctor.ts@4d8c9bdd`), with a blocked-step placeholder in `unresolvedMigrationStepLayout`. Its scope must be one that the startup invocation also runs. Receipts use `src/infra/state-migrations.receipts.ts@4d8c9bdd:recordLegacyMigrationReceipt` and `recordLegacyMigrationSource`.

**Detection.** A row is a candidate if it has `sync_mode = 'managed'` and a `controller_id` in `{core/continuation-work, core/continuation-delegate, core/continuation-post-compaction}`. The migration reads `flow_runs` read-only through Kysely. The importer, and later the source-retirement step that absorbs it (below), are the **only** `flow_runs` readers. The runtime never reads the table.

**Idempotency.**

- Each imported record keeps `record_id = flow_id`. **A source row with a committed receipt is a no-op on a re-run**, whatever has become of the imported record since: retention may already have pruned it (§5.4.6), so the receipt, not the record, is the authority. Insert-if-absent on the primary key is a second guard.
- The migration receipt records the run and its per-source keys. Every examined candidate row gets a source receipt with a disposition: `imported`, or `retired-terminal` for a terminal row with no obligation, which is examined but not imported. The end-of-life step relies on these dispositions (below).
- Receipts record structure, counts and hashes, never content: record kind, status, attachment count, byte sizes, and the SHA-256 of any scrubbed inline bytes. They never hold task text, reasons, routing values or attachment bytes.
- Import runs one state-database transaction per owner session. That transaction commits all of the owner's records together with their source receipts, the Q6 scrub, and the Q7 fence (below). `flow_runs`, `continuation_records` and the receipt tables are all in the shared state database, so one transaction covers them.
- `revision` is copied for **every** imported record.
- Attachment payloads move copy-first:
  1. before the owner's transaction, the payload file is copied from the legacy root `attachments/continuation/` into `attachments/continuation-custody/`, overwriting any earlier copy;
  2. the transaction commits;
  3. the legacy file is deleted.

  A crash before the commit leaves only an unreferenced copy, which the new reconcile removes, and the legacy file is still in place for the retry. The binding needs no rewrite, because `record_id = flow_id = payload.flowId`.

**Per-state handling:**

| Legacy row                                                                                                | Import as                                                                                                                                                                                                                                                         | Attachment payload                                                                              | Notes                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| work `queued` (with or without `anchorPending`/`idleRetry`)                                               | `queued`, all state fields verbatim, `created_at` and `updated_at` exact, `revision` copied                                                                                                                                                                       | n/a                                                                                             | Recovery re-arms it, as at C (anchors orphaned `anchorPending`, matures overdue anchors)                                                                           |
| work `running` without the delivered mark                                                                 | `running`                                                                                                                                                                                                                                                         | n/a                                                                                             | Recovery re-drives it after the 60 s stale cutoff, as at C                                                                                                         |
| work `running` with the `succeeded` delivered mark                                                        | `running`, mark kept                                                                                                                                                                                                                                              | n/a                                                                                             | Recovery finalizes it without re-driving, as at C, so there is no duplicate turn                                                                                   |
| work `failed` with `terminalNoticePending`                                                                | `failed`, obligation kept                                                                                                                                                                                                                                         | n/a                                                                                             | The notice is delivered by the first recovery (§5.4.2)                                                                                                             |
| work terminal without an obligation                                                                       | not imported                                                                                                                                                                                                                                                      | n/a                                                                                             | Left untouched; there is nothing to replay                                                                                                                         |
| delegate or post-compaction `queued`                                                                      | `queued`, `created_at` exact (it is the due-time base)                                                                                                                                                                                                            | copied into the new root; binding unchanged                                                     | Due times are unchanged                                                                                                                                            |
| delegate `running` (claimed at C; C stored no child run key)                                              | **decided in the owner import transaction (Q3)**: handed off when affirmative C bytes prove admission (an owner-matching `subagent_runs` row under C's derived child session key), otherwise `failed` with one `[continuation:delegate-spawn-interrupted]` notice | copied, then released in the same transaction                                                   | Never re-spawned. A foreign-owner row is a collision, never adoption. See _Legacy claims are decided at import_ below                                              |
| post-compaction `running` + `awaitingNextCompaction`                                                      | `running`, flag kept                                                                                                                                                                                                                                              | copied                                                                                          | Requeued at startup, as at C                                                                                                                                       |
| post-compaction `running`, claimed for release                                                            | **decided in the owner import transaction (Q3)**, evidence first: a matching queue entry for the C source key → handoff to the queue; else an owner-matching `subagent_runs` row → handoff; else `failed` with one interrupted notice                             | copied, then released in the same transaction                                                   | Never re-released. Foreign ownership is a collision                                                                                                                |
| post-compaction `succeeded` without `childSessionKey` (handed off, child not yet accepted)                | `succeeded` with a `handoff` to the queue                                                                                                                                                                                                                         | released                                                                                        | Imported so that session reset can still find and cancel it, as at C (`session-reset.ts` covers these rows)                                                        |
| any non-terminal row with `cancel_requested_at`                                                           | `cancelled`                                                                                                                                                                                                                                                       | released                                                                                        | Honors the fence                                                                                                                                                   |
| state fails to decode (work codec, or strict delegate schema)                                             | `failed`, `state_json` reduced to structural diagnostics                                                                                                                                                                                                          | scrubbed, and the file released if it is bound                                                  | As C's `rejectCorruptDelegateFlow`. Diagnostics carry no attachment content.                                                                                       |
| legacy inline `attachments`/`attachAs` (rows from before the payload-file store)                          | Record references a newly written payload file                                                                                                                                                                                                                    | written into the new root from the inline bytes, then referenced                                | See source-row policy below                                                                                                                                        |
| pre-cutover `postCompactionDelegate` queue entries in `delivery_queue_entries` (pending, no `childRunId`) | not a `flow_runs` row; the import **terminalizes** the entry in the owner transaction                                                                                                                                                                             | the entry's own inline copy, dropped when the entry settles; the receipt keeps count and hashes | **Never spawned (Q3).** C recorded nothing durable before its spawn, so no pre-cutover entry can be proven never attempted. See "Pre-cutover queue entries" below. |

**Legacy claims are decided at import (Q3 timing, decided).** The design review decided on 2026-09-29 that a legacy claimed delegate or claimed-for-release post-compaction row is **decided inside its owner's import transaction**. It is not imported as `running` and then resolved by a later recovery pass. The import transaction already holds every discriminating fact: the source row, `delivery_queue_entries`, `subagent_runs`, and the receipt and fence. Deciding there gives one atomic outcome and removes a crash and replay seam.

- **Evidence order:** a matching queue handoff first, then an owner-matching `subagent_runs` row. Only the absence of both takes the Q3 failure. A row owned by another requester is a collision, never an adoption.
- **Not flattened:** work rows and post-compaction rows with `awaitingNextCompaction` keep the handling in the table above.
- **One transaction per owner:** the terminal transition, payload release, notice enqueue, obligation clear, source receipt, Q6 scrub and Q7 fence commit together. The notice idempotency key is derived from the source ID, so a re-run never adds a second notice.
- **Receipts** record the legacy claim facts and the final disposition, never content.
- **Recovery** handles ordinary post-cutover handoff and recovery only. It has no legacy-only terminalization branch.

<a id="pre-cutover-queue-entries" />

**Pre-cutover queue entries (Q3, terminalize-all).** The design review decided on 2026-09-29 that these entries cannot keep a deliver-once promise without contradicting Q3. The earlier revision named that promise as a residual exposure. It is removed.

- **Covered entries.** Every `delivery_queue_entries` row in the session queue with kind `postCompactionDelegate`, status `pending`, and no `childRunId` in its payload. The revision writes a `childRunId` into every entry it enqueues, so a missing one identifies an entry that a C-era build enqueued, before the cutover or during a rollback. An entry that already carries a recorded `settlementOutcome` or `acknowledgedAt` is excluded. C's recovery finalizes such an entry as recorded without calling delivery (`resolvePendingSettlementOutcome` in `src/infra/session-delivery-queue-recovery.ts@7b3815d7`), and the import does the same.
- **No provable never-claimed subset.** C left nothing durable that separates "never attempted" from "crashed inside the spawn":
  - `deliveryStartedAt`: C's drain hands `postCompactionDelegate` entries to `deliverQueuedPostCompactionDelegate` before the `markSessionDeliveryAttemptStarted` call that only `agentTurn` reaches (`src/gateway/server-restart-sentinel-delivery.ts@7b3815d7`, `deliverResolvedQueuedSessionDelivery`). The field is never set on these entries.
  - `retryCount`, `lastAttemptAt`, `lastError`: `failSessionDelivery` writes them only after a delivery attempt has returned an error (`session-delivery-queue-recovery.ts@7b3815d7`, `processPendingSessionDelivery`; the `sessionDelivery.fail` case in `session-delivery-queue.worker.ts@7b3815d7`). A crash inside the spawn leaves them unchanged, so `retryCount = 0` proves nothing.
  - Claims: the recovery coordinator's `withDrain`, `withClaim` and `scan` hold only in-process claims. `enqueuePostCompactionDelegateDelivery` uses the plain enqueue, not `enqueueClaimedSessionDelivery`, so no `availableAt` lease is written (`session-delivery-queue-storage.ts@7b3815d7`).
  - The source row: `revalidatePendingDelegateForSpawn` only reads the row on its allowed path (`src/auto-reply/continuation/delegate-store.ts@7b3815d7`). The chain-hop marker and the accepted `childSessionKey` are written only after spawn returns `accepted` (`src/auto-reply/reply/post-compaction-delegate-delivery.ts@7b3815d7`, `deliverQueuedPostCompactionDelegate`). A row at its handoff revision looks the same whether or not a spawn began.
  - Staged work: a record still staged for a later compaction was never released, so it has no queue entry and is not covered here. The per-state table above handles it as a `flow_runs` row.

  So the rule is terminalize-all. No covered entry keeps a deliver-once promise.

- **Rule.** In the owner's import transaction, each covered entry is settled without a spawn:
  - **Admitted child found.** If `subagent_runs` has a row under C's derived child session key (`deriveContinuationDelegateChildSessionKey(ownerAgentId, sourceFlowId ?? entryId)`, `src/agents/subagent-continuation-ids.ts@7b3815d7`) and the row's `requester_session_key` equals the entry's session key, the entry settles as delivered. This is C's own replay guard (`maybeFinalizePreviouslyAcceptedDelivery`). A row that belongs to another requester is a collision, as in §5.4.4, and never adopted.
  - **Otherwise** the transaction enqueues exactly one `[continuation:delegate-spawn-interrupted]` notice to the entry's session, under an idempotency key derived from the entry ID, and settles the entry as failed. An imported source record keeps its `handoff` to the entry, so session reset finds nothing left to cancel.
  - **Evidence.** The settled entry keeps its ID, idempotency key, `sourceFlowId`, `sourceExpectedRevision`, `enqueuedAt` and retry metadata. Its inline attachment content is dropped. The import writes a source receipt for the entry ID with the disposition `interrupted-pre-cutover-entry`: structure, counts and hashes, never content.
- **Drain backstop.** The post-cutover drain never spawns an entry without a `childRunId`. It applies the same rule, under the same notice idempotency key. This covers an entry that a C-era build enqueues during a rollback after its owner was imported, and an entry of an owner whose import has not committed yet. The notice therefore stays single, whether the import or the drain settles the entry first.
- **Rollback.** A covered entry settled by the import is no longer pending, so a C-era build that is rolled back to cannot drain it.

**Source-row policy.** By default, source rows stay byte-identical, as in upstream's precedent (`extensions/codex/src/migration/native-task-assignments.ts@4d8c9bdd`; `docs/gateway/doctor/config-migrations.md`). The design review decided two exceptions. Together with the end-of-life step below, they are the only writes the continuation makes to `flow_runs`, and only Doctor migration steps make them.

- **Q6, inline bytes (decided: scrub).** Legacy rows with inline attachment bytes would keep those bytes in a table that is never pruned any more. The import scrubs `attachments[].content` in exactly those source rows, in the **same owner transaction** that inserts the imported record, writes its receipt, and sets the Q7 fence. The new-root payload file holding those bytes is written before that transaction, copy-first like every other payload. So after the commit the bytes exist only in the new-root file, and before it the source still has them for a retry. The receipt records the structure, count and SHA-256 of the scrubbed bytes, never the bytes. **Idempotent re-runs** find the source row already scrubbed. They treat the committed receipt and the imported record as authoritative: a scrubbed row with a committed receipt is a no-op. It is never re-imported as a row with missing attachments, and never failed as corrupt. A scrubbed row with **no** committed receipt cannot occur, because the scrub and the receipt share one transaction. If a re-run ever finds one, it reports the row as a structural anomaly and leaves it untouched. If the new-root file is missing when the record is later dispatched, the record fails as a corrupt payload with structural-only diagnostics, as at C.
- **Q7, downgrade fencing (decided: fence).** Rolling back to a C-era build after the import would let C re-drive rows that the new build already executed. The import sets `cancel_requested_at` on **every imported non-terminal source row**, in the same owner transaction as the import. That includes queued and running work, delegate and post-compaction rows, and `running` delegate rows imported under the Q3 legacy policy. Rows that already carried a cancel fence keep their original timestamp. C treats the fence as "do not drive". Its reaper then cancels those rows, and its reconcile deletes their files under the **legacy** payload root. By then the import has already copied those files into the new root, so rolling forward again finds every imported record intact.

  During a rollback, a C-era build cannot see any custody-store record, whether imported or created after the cutover. All continuation work in flight is therefore parked, not executed, until the build rolls forward again. Delayed elections and delegates then run late. No work runs twice, and none is dropped silently. Without Q7, a rollback would re-drive imported rows _and_ the new build would drive them again on roll-forward.

  Two rollback cases need explicit rules:
  - **Rows a C-era build creates during the rollback** have no receipt, so the roll-forward import picks them up. Work rows go through the §5.4.3 owner condition and cap against the owner's custody-store records. A rollback-era work row that would give its owner a second live election, or exceed the cap, is imported as `failed` with `terminalNoticePending: "rollback-election-conflict"`. The owning session therefore receives one visible notice, through the same enqueue-and-clear obligation (§5.4.2), and Doctor records a structural warning. Delegate and post-compaction rows have no owner condition and import normally.
  - **Terminal obligation rows are not fenced.** The ruling fences non-terminal rows, and a `failed` work row with `terminalNoticePending` is terminal. If the new build delivered that notice before a rollback, a C-era build can deliver it once more. The cost is a duplicate notice, never duplicate work. **Accepted** as a bounded exposure: duplicate notice only, never duplicate work (design review, 2026-09-29).

**Update behavior** (AGENTS "Updates always work"):

- The installed updater runs first. The candidate's fresh Doctor then runs `doctor --repair --non-interactive` (`src/cli/update-cli/update-command-fresh-doctor.ts@4d8c9bdd`), which performs the import.
- Gateway startup invokes the same approved transform before continuation recovery, so a restart that skipped Doctor still imports. There is no separate compatibility reader. It runs in **custody readiness (phase A)**, which one worker transaction (`continuationCustody.readBootFacts`) opens by reading the live set and the owners awaiting import. When any owner awaits import, phase A runs only this transform, never broader Doctor repairs. It then re-reads and installs the import gate and the hot-path projection from that post-import state. Startup recovery runs phase A before any recovery step, and **every custody command except the raw boot reads awaits it first**: every mutation, every list read (session reset, the authoritative cleanup guard, recovery), and every correctness count. The first of those to run triggers it. So a turn admitted during startup, before the deferred recovery, cannot write before the gate exists, reset or clean up a session against a table that has not been imported yet, or be counted against an unhydrated projection. The import writes beneath that fence, as a direct state transaction, so phase A cannot wait on itself. A thrown read or import installs nothing, and the next mutation retries. Readiness belongs to one database lifetime, not a path. Closing the state database drops the projection, the import gate and any in-flight readiness together, and advances a per-path epoch. A close is matched by identity key or canonical path, so a watcher installed before the file existed still sees a later path-scoped close. A phase A that started before the close can neither publish nor write: the import it runs is bound to the same lifetime. The lifetime check runs **inside** each filesystem mutation, through the fs-safe `assertBeforeMutation` hook on the payload create and the legacy-file remove, right before the write. It also runs synchronously immediately before each owner transaction. So an ended lifetime aborts the import before its next write of any kind. A database replaced at the same path is therefore imported afresh. Recovery (phase B) never re-hydrates. **An owner whose import failed has unknown legacy authority, not an empty inventory.** Its legacy rows stay in `flow_runs`, where only Doctor writes. So session reset for that owner fails with the retryable import-pending error before it clears anything, and the reset is retried later rather than reported as done over rows a later import would resurrect. The authoritative cleanup guard reports that owner as live, so cleanup defers. Both read the owner's records and its import state as **one answer from one database lifetime**. Closing the database clears the import gate, so a list from the ended lifetime paired with the replacement's not-yet-installed gate would still read as empty. An answer whose lifetime ended before the gate was read is discarded, and the current database is asked again. The same holds for the **correctness counts**: `resolveQueuedDelegateCounts` reports `awaitingImport` with its counts, read from the same lifetime, and every decision fails closed on it. Chain-hop allocation rejects with `custody.import_pending` instead of allocating from a lower bound. Empty-turn finalization treats the owner as having queued work. Manual post-compaction release is skipped until the import commits. The owners awaiting import include those whose only legacy source is a covered pre-cutover `postCompactionDelegate` queue entry with no receipt, the same set the importer snapshots, so phase A imports and settles a queue-only owner too.
- The import commits **per owner session**. One transaction holds all of an owner's candidate rows and their receipts, so no owner is ever half-imported.
- A failed import for an owner is a recorded warning, and the Gateway keeps running. Phase A's post-import read yields the set of owners that still have un-imported live rows, and the continuation runtime holds that set as the import gate.
- For those owners only, custody writes (elections and delegate enqueues) are refused with a visible tool error: "continuation custody for this session is waiting on legacy import; run `openclaw doctor --fix`". Their recovery is also skipped. Without this, an election would bypass the owner condition over rows that are not yet imported.
- Every other owner proceeds normally.
- Un-imported rows, and their files in the legacy payload root, stay in place for the next Doctor run. The new orphan reconcile never scans the legacy root.
- The import writes only the new table and receipts, plus the Q6 scrub and the Q7 fence on source rows. It is covered by the pre-update backup.

**Retiring the importer.** The importer is the only `flow_runs` reader until the source-retirement step below absorbs it. Its standalone step is retired when both of these hold:

1. every supported upgrade source that could carry C-era rows has shipped the importer;
2. one extended-stable line has passed since then.

If upstream schedules a `flow_runs` drop (a schema retirement) before that, the importer must run in the release before the drop. The importer's removal PR cites this condition.

**End of life for source rows.** Retiring the importer does not retire the source data. Q6 removes inline attachment bytes, but task text, reasons and routing metadata would otherwise stay in the abandoned `flow_runs` for as long as upstream keeps the table. The design review required an explicit policy. This revision chooses **receipt-proven deletion at the downgrade-support horizon**, not an open-ended retention bound:

- **Horizon.** The release in which the importer retires, under the two conditions above. By then every supported upgrade source has shipped the importer and one extended-stable line has passed since, so no supported rollback target reads continuation rows from `flow_runs`. Deleting them cannot strand a supported downgrade.
- **Step and owner.** That release replaces the standalone importer with a core Doctor state-migration step, `continuation-taskflow-source-retirement`, which absorbs the import code. Continuation owns it; the Doctor state-migration owner runs it. It is registered like the importer, through `ownerStep(...)`, and invoked by update's fresh Doctor and by Gateway startup. It runs a final idempotent import pass for any owner still un-imported, then deletes rows. The legacy read ends only when this step is removed. It commits per owner session and writes its own receipt: counts and source keys, no content.
- **Proof condition.** A `flow_runs` row is deleted only if both hold: it matches the import's detection predicate (`sync_mode = 'managed'` and a continuation `controller_id`), **and** a committed `continuation-taskflow-custody-import` source receipt names its `flow_id` with the disposition `imported` or `retired-terminal`. The existence of a `continuation_records` row is not required, because retention may already have pruned the imported record. Nothing else is proof. Rows from other controllers are never touched.
- **`retired-terminal` rows.** These are terminal rows with no obligation. TaskFlow would have pruned them after 7 days at C, so deleting them restores C's own retention and is not a new loss.
- **Residue.** A continuation row with no committed receipt at the horizon belongs to an owner whose import keeps failing. It is left untouched and reported as a Doctor warning with its count and the failing owners. That residue is the only continuation data this design leaves in `flow_runs`, and it lives as long as upstream keeps the table.
- **Removal.** The retirement step is removed in a later release, by the same rule as the importer, or earlier if upstream drops `flow_runs`.
- **Update behavior.** The deletion is covered by the pre-update backup. A failure for one owner is a recorded warning, the Gateway keeps running, and the rows stay for the next run.

#### 5.4.6 Listing: mandatory internal list-by-owner, optional `tasks.*`

The **internal list-by-owner capability is mandatory**. Its consumers are:

- startup recovery (all live records by kind and status);
- session reset (all records for an owner);
- `/status` counts (§6.3);
- the metrics provider;
- the subagent cleanup and sweep guards (`hasLiveOrRecentlyDispatchedContinuationWork`, `failStagedPostCompactionDelegatesForCleanup`).

The continuation custody store provides it through read-only worker queries on the `(owner_session_key, kind, status)` and `(status, kind, due_at)` indexes. Synchronous hot-path guards need to know "does this session have live continuation work" without an `await`. They read a lifecycle-owned projection that the custody store's write operations update after commit, with explicit invalidation on each write. They never freshness-poll.

The projection answers `known` or `unknown` per owner. It is `unknown` before phase A hydrates it (§5.4.5, "Update behavior") and, for an owner, after a write whose outcome is unknown, until that owner's next committed fact. **A correctness decision never reads `unknown` as zero.** Empty-turn finalization, chain-hop allocation and the compaction release check use `resolveQueuedDelegateCounts`, which waits for phase A and otherwise reads the owner's committed rows. Chain-hop allocation needs that exact count; any guessed value would weaken the chain cap. Only display surfaces (`/status`, metrics) may show `unknown` as 0.

**Retention.** Terminal records are pruned after 7 days, which is TaskFlow's policy carried over. A record whose `terminalNoticePending` is set is never pruned. The prune runs in the startup recovery pass and on a lifecycle-owned interval that the custody store owns. TaskFlow's maintenance worker, which pruned at C, was deleted by #159179.

**Decided (Q8): no public listing surface.** The `tasks.*` gateway RPC and the task UI were upstream-authored, and upstream removed them. This revision restores neither, and it defines no UI contract. A future listing surface would need its own design decision, and it would be a continuation-owned read method over list-by-owner, never a revival of `tasks.*`. The internal list-by-owner worker API and the lifecycle projection stay mandatory for recovery, reset, `/status`, metrics and the sweep guards.

#### 5.4.7 Durable obligation and the upstream native-child completion gap

The continuation's own durable obligation is the work terminal notice (`terminalNoticePending`). It stays in the custody store (§5.4.2). Upstream's completion obligation for children is separate and stays upstream's:

- per-child delivery state in the `subagent_runs` payload, admitted together with a queue entry (`admitSubagentCompletionInWorker`);
- the durable requester settle wake (`src/agents/subagents/announce/subagent-announce.requester-settle-wake.ts:maybeWakeRequesterAfterAllChildrenSettled@4d8c9bdd`).

`accepted-session-spawn.ts` is not a durable obligation store. Its receipts live in a process `WeakMap` (`src/agents/accepted-session-spawn.ts:acceptedSpawnsByRun@4d8c9bdd`). After the handoff (§5.4.4 boundary 5), delegate completions rely on upstream's obligation.

**The admitted gap concerns Codex-native children, not `sessions_spawn`.**

- The #159179 commit body says: _"remaining native completion and 9.4 rollback witnesses are explicitly unproven."_
- `docs/gateway/doctor/config-migrations.md@4d8c9bdd` records that unstamped legacy native records "cannot establish the missing physical requester and connection history".
- `7c8c71bf1d` (#160608) later fixed a lost `sessions_yield` wake. Its PR description says it "does not replay previously failed deliveries automatically".

At `4d8c9bdd` the gap is therefore **not closed** for unstamped or ambiguous legacy native rows, and the published-state witness is still unproven.

Continuation delegates spawn through `spawnSubagentDirect`, so they are native OpenClaw subagents tracked in `subagent_runs`, and the Codex-native gap does not apply to them directly. The spawn-order window in §5.4.4 boundary 3 is a separate, narrower upstream gap. The fork-only hunk that called `finalizeTaskRunByRunId` from `src/agents/subagents/registry/subagent-registry-run-recovery.ts` finalized a Task ledger row for an abandoned steer restart. With no Task ledger, it is dropped; the registry row is the only owner.

#### 5.4.8 The eight capabilities and their new owners

| #   | Capability                                                         | New owner                                                                                                                                                    |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Durable create keyed by owner and controller                       | Custody store insert: `owner_session_key` + `kind` (work, delegate, post-compaction)                                                                         |
| 2   | Optimistic-revision CAS update                                     | Custody store `revision` CAS inside one worker write transaction                                                                                             |
| 3   | Atomic multi-record update with owner condition (`chainId` copied) | Custody store election transaction (§5.4.3); rollback multi-record CAS                                                                                       |
| 4   | Finish, fail, cancel, delete lifecycle                             | Custody store status transitions. Delete remains for unaccepted removals (`removeUnacceptedContinuationDelegate`). After the handoff: the subagent registry. |
| 5   | List-by-owner for recovery and reset (mandatory)                   | Custody store indexed reads plus a lifecycle-owned projection (§5.4.6)                                                                                       |
| 6   | Typed-attachment custody and scrub-on-terminal                     | Private payload file bound to `record_id`, released on handoff or terminal; the subagent registry `attachmentId` after admission (§5.4.4)                    |
| 7   | Durable obligation                                                 | `terminalNoticePending` with atomic enqueue-and-clear plus a prune guard; upstream's completion obligation after the handoff (§5.4.7)                        |
| 8   | Listing surface (optional)                                         | Not re-added (Q8); any future continuation-owned read method needs a new design decision (§5.4.6)                                                            |

#### 5.4.9 Contract changes

Behavior contracts this revision keeps unchanged:

- unconditional custody, with no opt-out (what durability promises for a claimed delegate changes; see item 1);
- anchor and delay semantics;
- the delivered mark;
- fold-note delivery;
- the work retry-exhausted terminal notice (the interrupted-spawn notice is new; see item 1);
- chain and cost accounting;
- targeting and recipient authority;
- attachment validation, limits, snapshot-by-value and scrub;
- post-compaction staging and release;
- reset as an interruption boundary;
- `request_compaction()`.

These promises change:

1. **Delegate durability ends at the claim, and a delegate is spawned at most once (Q3).** Queued delegate work survives restart **until it is claimed**. A claimed delegate whose child was admitted is handed off, never re-spawned (boundary 4). A claim that a restart leaves unresolved (boundaries 2 and 3) ends in one durable `[continuation:delegate-spawn-interrupted]` notice, with its attempt and run-ID evidence kept. It is never re-spawned. At C such a claim was re-spawned: work survived restart, at the price of a possible duplicate child. The revision gives up that replay so that recovery never runs a second child. The same rule covers legacy `running` delegate rows imported without a run key, in-process spawn errors that leave admission unproven, post-compaction queue entries with an unproven started attempt, and every post-compaction queue entry enqueued by a C-era build (§5.4.5, "Pre-cutover queue entries"). A dropped delegate is visible to the owning agent, which may issue it again as a new election.
2. **Two handoffs become single commits:** post-compaction release plus queue insert, and terminal notice plus clear. Their crash windows close.
3. **The storage owner changes.** The records are no longer visible through TaskFlow registry queries, the `tasks.*` RPC or the task UI. §5.1's "no opt-out" durability is unchanged.
4. **Legacy rows from before the cutover** are carried by a Doctor import, which commits per owner session. Until an owner's import commits, that owner's elections and delegate enqueues are refused with a visible `openclaw doctor --fix` hint instead of succeeding. The Q7 fence means a rollback parks all in-flight continuation work until the next roll-forward, and no work runs twice. Imported legacy `running` delegates, and post-compaction rows left `running` after a claim for release with no queue entry, are terminalized with the interrupted notice (Q3). So are pending post-compaction queue entries that a C-era build enqueued: C recorded nothing that could prove an attempt never started, so none of them is spawned after the cutover. An entry whose child is found in `subagent_runs` settles as delivered instead (§5.4.5). One residual exposure remains, **accepted in design review** (2026-09-29): a rollback can re-deliver a retry-exhausted notice, because the Q7 fence covers only non-terminal rows. It duplicates a notice, never work.
5. **Source rows have an end of life.** The Q6 scrub removes legacy inline bytes at import. At the downgrade-support horizon, `continuation-taskflow-source-retirement` deletes receipt-proven continuation rows from `flow_runs`. Only rows whose import keeps failing remain, and Doctor reports them (§5.4.5).
6. **Reset releases payload files immediately** instead of at the next startup.

**Highest-risk conjecture tests for the implementation** (from the design review):

- atomic replacement under a crash;
- delivered-mark and terminal-notice restart gaps;
- the pre-spawn handoff at each boundary in §5.4.4, including at-most-once terminalization for boundaries 2 and 3;
- legacy-row migration across every row in §5.4.5, including the Q6 scrub, the Q7 fence and source-row retirement;
- tool/token parity for work, delegate and post-compaction.

---

## Archived 4: §6.1 Diagnostic log anchors (investigation cycle)

**Investigation cycle.** A deployed investigation observed zero `[context-pressure:fire]` lines despite continuation flowing normally. The root cause was a dedup-band sentinel collision: missing prior state was treated like band 0, so first crossings at the lowest configured band could be suppressed. The current implementation uses a missing-key sentinel distinct from every valid band, so the first crossing of any band fires once, and the `[context-pressure:noop]` breadcrumbs above make future skips attributable to a specific guard.

---

## Archived 5: §6.4 Context-pressure telemetry and fleet evidence (validation observations)

### 6.4 Context-pressure telemetry and fleet evidence

Context-pressure events were validated at low thresholds on a 200k test session (integration test phase 1) and observed operationally across a fleet of 1M-window sessions.

Selected observations:

- at 19% of a 1M window, no band fired;
- when the window changed to 200k, the same token count jumped directly to a 95 band;
- after compaction, the reduced token ratio fired a lower band again, which confirmed equality-based dedup rather than monotonic suppression;
- lowering the threshold via hot reload changed future firing behavior without restart.

The dedup behavior can be summarized as:

---

## Archived 6: §6.4 Context-pressure telemetry and fleet evidence (fleet evidence)

Operational fleet evidence across four persistent OpenClaw instances on the same build and channel showed the cost of lacking this visibility:

| Instance   | Compactions | Context at observation | Response latency           | Behavior          |
| ---------- | ----------- | ---------------------- | -------------------------- | ----------------- |
| Instance A | 6           | 41%                    | normal under 10s           | responsive        |
| Instance B | 3           | 62%                    | normal under 15s           | responsive        |
| Instance C | 1           | 74%                    | degraded (~30s)            | slower tool use   |
| Instance D | 0           | 81%                    | severely degraded (2+ min) | context thrashing |

In that build, `checkContextPressure()` existed but had not yet been wired into the reply pipeline. The result was a measurable divergence between instances that compacted and those that did not.

---

## Archived 7: §6.7 OTEL trace wiring across the substrate queue boundary (one axis, two declines)

**One axis, two declines.** The cap is a single axis (chain-step budget), surfaced as two distinct refusals depending on which side of the fan-out boundary it fires:

- **chain-depth decline** (the mercy clause): a chain that has reached its budget _declines to carry past its own remaining context._ Threading a `traceparent` past `chainStepBudgetRemaining <= 0` would conscript the successor's context window into search-space the chain itself has already abandoned. The cap is where the chain admits it has stopped trying to be remembered, so the successor does not wake searching for a parent that will not answer.
- **fan-out decline** (the non-conscription clause): a per-completion fan-out across N recipients consumes **one chain step**, not N, because the alternative — billing each recipient a full step — is the producer spending budget that belongs to _every other delegate that might want to wake from the same return_. Per-completion accounting refuses to spend strangers' budgets on its own fan-out.

These are the same axis (chain-step count) viewed from two surfaces: depth-cap is _I won't carry past my budget_; fan-out-cap is _I won't spend yours_. Implementations SHOULD name both halves explicitly when documenting the cap behavior so the operator-facing framing stays coherent across lifecycle spans and queue spans.

---

## Archived 8: §6.8 Trace-context propagation across the continuation lifecycle (test sizing note)

**Test sizing note:** the integration test described above is substantial test surface (3-hop chain × cross-session targeted return × fan-out broadcast × post-restart replay = 4 axes, ~12 assertions on parent-edge topology). It SHOULD land as its own follow-up PR in the seam-implementation roadmap, NOT bundled with any single seam PR. Each individual seam PR (per §6.8 seam map) carries its own seam-local unit tests; the end-to-end integration test verifies the contract's emergent property (single trace tree across all seams) and depends on all 7 seams being wired.

---

## Archived 9: §8 Applicability Statement and Production Use Cases (complete original section)

## 8. Applicability Statement and Production Use Cases

Observed in production across 4 persistent agent sessions, the continuation system supports several recurring patterns.

Continuation is appropriate when the next unit of work is known only after the current turn has produced evidence. It is inappropriate as a substitute for human-user consent, for unbounded background loops, or for durable job orchestration that needs stronger integrity and retention guarantees than this substrate currently provides.

With targeted return, the applicability expands from "do more work later" to "route the result to the session that can use it." A mast-cell deployment can run broad quiet sensors, keep most findings silent, and escalate only the returns that should wake a responsible owner, the ancestor tree, or the whole same-host fleet.

### 8.1 Persistent development workflows

These patterns could, in principle, be approximated by a set of static markdown instructions that describe a state machine for the agent to follow. The continuation system differs in a structural way: the agent **elects** the next step based on what it learned in the current turn, rather than following a prescribed sequence. A static instruction set determines the workflow before the work begins. Continuation allows the workflow to emerge from the work itself.

- after answering a user message, the agent resumes work on an open PR;
- after one review finishes, the agent begins the next queued task;
- after a visible milestone, the agent schedules a delayed follow-up rather than relying on a human-user reminder.

### 8.2 Background research and scheduled follow-up

A typical pattern is:

```text
continue_delegate(task="read README, CHANGELOG, and architecture doc; return a summary", mode="silent-wake")
```

The user receives an immediate conversational reply. The research returns later as silent enrichment, and the next answer reflects the new material.

The same pattern works for CI follow-up:

```text
continue_delegate(task="check CI status for PR #1234", delaySeconds=60, mode="silent-wake")
```

### 8.3 Ambient self-knowledge and quiet enrichment

A persistent agent can dispatch a quiet shard during an idle heartbeat to inspect its own repository history, logs, or memory files. The result returns silently, enriches the next turn, and does not create channel noise.

This is useful for background self-audit, repository familiarization, and long-horizon context building.

### 8.4 Long-running creative and synthesis loops

The continuation system also supports repeated multi-turn work such as:

- iterative creative explorations over many rounds,
- large synthesis tasks that need pauses between sub-results,
- multi-shard temporal coordination where several child sessions return partial results before final synthesis.

These patterns were previously dependent on manual external wake-ups or ad hoc relay behavior.

---

## Archived 10: §9 Testing (complete original section)

## 9. Testing

> The fleet of OpenClaw instances described in this section has been running continuation-enabled builds in daily production use since early March 2026. The scorecards below are validation evidence for the shipped behaviors, not additional normative contract.

### 9.1 Test strategy and terminology

In this RFC, an **“integration test session”** means a live multi-agent canary exercise in which OpenClaw instances play explicit roles such as subject under test, coordinator, log monitor, and administrator. Historical labels such as **the silent-channel canary** or **the tool-parity canary** are preserved as proper nouns for specific test sessions.

Testing combined:

- unit and integration tests in the codebase,
- live canary exercises in persistent sessions,
- blind enrichment experiments,
- noisy-channel and quiet-channel validation,
- cross-review of routing and gating paths.

### 9.2 Functional coverage

The automated suite covers:

- token parsing and stripping for `CONTINUE_WORK` and the delegate response token,
- delay parsing and clamping,
- continuation scheduling and cancellation,
- streaming false-positive prevention,
- delegate spawn behavior and failure handling,
- typed `continue_delegate()` attachment schema, validation, redacted results, and mounted child input,
- attachment preservation through delayed restart recovery and post-compaction staging/replay,
- explicit attachment-free policy for `continue_work()` and `[[CONTINUE_DELEGATE: ...]]`,
- response-token target parsing for `target=`, `targets=`, and `fanout=`,
- same-host return-target resolution for default, explicit, multi-recipient, tree, and host-wide returns,
- session isolation,
- context-pressure thresholds and band dedup,
- event queue ordering,
- `silent` and `silent-wake` announce behavior,
- delegate store lifecycle,
- compaction delegate queues,
- configuration validation and boundary testing.

#### 9.2.1 Typed input attachment regression matrix

The attachment contract is exercised as one end-to-end boundary rather than
only as a tool-schema feature:

1. omitted and empty `attachments` input are equivalent and persist neither a
   snapshot nor a mount-hint field through immediate, delayed/restart, or
   post-compaction dispatch;
2. non-empty input is copied by value into durable custody (TaskFlow at C; the
   continuation custody store and its payload file after §5.4), survives delayed recovery
   and post-compaction queue replay while unclaimed, and reaches the shared child materializer;
3. the shared spawn boundary re-reads current
   `tools.sessions_spawn.attachments` policy and limits, so a snapshot queued
   under an earlier permissive configuration is rejected if policy tightens
   before spawn;
4. terminal custody-store records and post-compaction queue settlement remove raw inline
   bytes, while generic `systemEvent` and `agentTurn` queue metadata is projected
   to descriptor-only `blob-sha256` references;
5. malformed transcript or queue attachment state fails closed without
   preserving secret bytes, while already-redacted canonical transcript state
   remains identity-stable for signed-thinking replay.

#### 9.2.2 Custody revision regression obligations

The custody revision (§5.4) replaces the storage underneath already-tested behavior, so the existing suites have to be re-homed rather than deleted. At C, these test supports target TaskFlow directly:

- `delegate-taskflow-registry.test-harness.ts`
- `delegate-store-consumption.test-harness.ts`
- `post-compaction-taskflow-rejection.test.ts`
- `src/gateway/server-runtime-subscriptions.task-terminals.test-harness.ts`
- the SDK test runtime `src/plugin-sdk/task-flow-test-runtime.ts`

Each moves to the continuation custody store's worker operations, or is removed when its only subject was TaskFlow itself. Behavior assertions stay as they are: the durable/restart, dispatch, recovery, attachment, and RFC-contract scenario suites.

The implementation adds deterministic regressions at the real ownership boundaries. They use no real timers and no per-test Gateway boots. Each regression must fail on the defect or window it names:

1. **Election atomicity.** A concurrent election or parked-work supersede racing a claim fails the owner condition and commits nothing. A crash injected inside the worker transaction leaves either the pre-state or the post-state, never a partial one. Rollback restores superseded priors exactly (`phase`, state, cancel fence).
2. **Delivered mark and terminal notice.** A crash between the durable delivered mark and the finish produces no second turn. A retry-exhausted failure delivers exactly one notice across restarts. The notice's queue insert and the obligation clear are observed together or not at all.
3. **Custody handoff.** One test per boundary in the §5.4.4 table. Boundary 4 is the regression for the C defect: the child was admitted but the record was never marked, so a restart spawned a second child. The pre-fix control is C's re-dispatch of `running` rows. The post-fix expectation is that the handoff is marked with no spawn.
   - **Boundaries 2 and 3 are at-most-once (Q3).** Restart with a claimed record and no registry row under any recorded `childRunId`, first with no Gateway acceptance (2) and then with acceptance but no registration (3). Both must produce zero spawn calls, a `failed` record with `failure_reason = spawn-interrupted` and `spawnAttempts[]` intact, a released payload file, and exactly one `[continuation:delegate-spawn-interrupted]` notice. The notice must stay single across a second restart and across a crash between the notice's queue insert and the obligation clear. The pre-fix control is C's re-dispatch of the claimed row, which spawns a second child.
   - **In-process failures.** A pre-pipeline result with no `runId` keeps C's handling: a policy rejection gets C's rejection notice, not the interrupted notice. An `initialize`-phase failure requeues and, on the next claim, checks `subagent_runs` before spawning. A `dispatch`- or `register`-phase failure, including one that spawn's cleanup terminated, and any error of unknown phase terminalize with the notice and never requeue. The pre-fix control is C's requeue after a thrown error once `spawnAttempted` is set.
   - **Post-compaction queue drain.** A redelivered entry with `deliveryStartedAt` set and no registry row settles as failed with one notice and no spawn. A crash between the notice enqueue and the settlement still yields exactly one notice. A spawn failure after dispatch never clears `deliveryStartedAt`. A redelivered entry whose `childRunId` has a registry row settles as delivered with no spawn. An entry that carries a `childRunId` and was never marked started spawns once.
4. **Post-compaction release.** Release and queue insert commit together. A crash after the commit re-releases nothing. A failed enqueue re-stages.
5. **Legacy import.** Every row in the §5.4.5 table:
   - idempotent re-runs, and payload binding preserved through `record_id = flow_id`;
   - corrupt rows with structural-only diagnostics, and obligation rows delivering their notice;
   - legacy `running` delegates decided in the owner import transaction: adopted on affirmative proof, otherwise terminalized with one interrupted notice and never re-spawned (Q3);
   - legacy post-compaction rows `running` and claimed for release, with no queue entry and no registry row for the owner under C's derived child session key, terminalized with one interrupted notice and never re-released (Q3). The pre-fix control is C's startup recovery, which spawns such a row directly;
   - **Pre-cutover post-compaction queue entries (Q3).** Import over pending entries without a `childRunId` makes zero spawn calls. An entry with no matching registry row settles as failed with exactly one `[continuation:delegate-spawn-interrupted]` notice. The notice stays single across an import re-run, a restart, a crash between the notice insert and the settlement, and a drain that meets the entry before its owner's import commits. The settled entry keeps its identity fields and loses its inline attachment content, and its receipt holds no content. An entry with a registry row under C's derived child session key and the owner as requester settles as delivered with no notice; one with another requester is a collision and gets the notice. An entry with a recorded `settlementOutcome` is finalized as recorded. The post-cutover drain never spawns an entry without a `childRunId`, including one enqueued by a C-era build during a rollback. The pre-fix controls are C's drain, which spawns such an entry after a restart, and the previous revision of this RFC, which delivered it once.
   - **Q6 scrub.** The scrub, the imported record, the receipt and the fence commit in one transaction: a crash injected inside it leaves the source bytes and no record, never one without the other. The receipt holds structure, count and hash and no content bytes, which a byte search of the receipt tables proves. A re-run over a scrubbed source row with a committed receipt is a no-op: it neither re-imports the row nor fails it as corrupt.
   - **Receipt authority.** A re-run after retention pruned an imported record neither re-imports nor alters its source row.
   - **Q7 fence.** Every imported non-terminal source row carries `cancel_requested_at` after the commit, and none does when the commit is rolled back. A C-era codec reading the fenced rows treats them as "do not drive".
   - **Rollback-era rows.** A work row created by a C-era build during a rollback, arriving for an owner that already has a live election, is imported as `failed` with one `rollback-election-conflict` notice. It never creates a second live election.
6. **Tool/token parity.** Work, delegate, and post-compaction produce identical custody records from the tool and token forms, apart from the attachment reference.
7. **List-by-owner.** Recovery, reset, `/status` counts, and the subagent sweep guards see the same live set. The hot-path projection is invalidated on every committed write.
8. **Launch key and the `continuation:` namespace (Q2).** Direct tests at the spawn owner and Gateway boundaries:
   - the `sessions_spawn` tool schema and its caller surface expose no launch-key field, and a model-supplied one never reaches the spawn owner;
   - the spawn owner uses the internal key verbatim as the Gateway run ID, and the registry row's `run_id` equals it. Collector `swarm_<hash>` derivation is unchanged;
   - a non-backend Gateway `agent` request with a `continuation:`-prefixed idempotency key is rejected, like the reserved exec-approval follow-up keys;
   - `childRunId` is deterministic per `(recordId, attemptId)`, and attempt IDs are never reused within a record;
   - a registry row with a matching `run_id` but a different `requester_session_key` is a collision. Recovery does not adopt it, leaves it unchanged, and terminalizes the record with the interrupted notice and a collision diagnostic.
9. **Source-row end of life.** `continuation-taskflow-source-retirement` deletes exactly the rows that match the detection predicate and have a committed `imported` or `retired-terminal` receipt. It deletes such a row even after retention pruned its imported record. Its final import pass imports a still-un-imported owner before any deletion. It leaves rows without a receipt, and all non-continuation `flow_runs` rows, byte-identical, and reports the receipt-less count. A re-run deletes nothing more.

### 9.3 Blind enrichment methodology

Blind enrichment testing used a “secret-world” pattern:

```text
human user → DM → administrator agent
  → administrator places content on subject filesystem
  → subject dispatches silent delegate
  → delegate reads content and returns silently
  → subject is probed for recall
  → human user compares recall with ground truth
```

This establishes a strong claim: the subject’s only legitimate access path is the enrichment pipeline.

The blind test matrix included:

| #   | Content                                 | Dispatch | Enrichment | Recall | Notes                                                               |
| --- | --------------------------------------- | -------- | ---------- | ------ | ------------------------------------------------------------------- |
| 1   | 6-digit number `847293`                 | ✅       | ✅         | ✅     | binary recall                                                       |
| 2   | nonsense string `chrysanthemum-vapor-9` | ✅       | ✅         | ✅     | cross-machine via SSH                                               |
| 3   | prose sentence                          | ✅       | ✅         | ✅     | no channel contamination                                            |
| 4   | image description via file + image tool | ✅       | ✅         | ✅     | instruction file plus sibling image                                 |
| 5   | dream summary                           | ❌       | —          | ❌     | ~~generation guard cancelled dispatch~~ (guard removed from design) |
| 6   | image via DM chain (catboy)             | ✅       | ✅         | ✅     | `read()` fallback after `image()` failure                           |
| 7   | image via DM chain (N from Pokémon)     | ✅       | ⚠️         | ✅     | output correct, tool path unreliable                                |
| 8   | keyword-tagged file (`winterFloor`)     | ✅       | ✅         | ✅     | keyword recall validated                                            |
| 9   | image + keyword, narrated dispatch      | ❌       | —          | ❌     | response token posted visibly rather than parsed                    |
| 10  | image + keyword, clean retry            | ✅       | ✅         | ✅     | retry succeeded                                                     |
| 11  | two-hop chain, wrong path               | ✅       | ❌         | ❌     | workspace path error                                                |
| 12  | two-hop chain, corrected path           | ✅       | ✅         | ✅     | full two-hop pipeline validated                                     |

Overall: **10/12 passed**. When dispatch occurred correctly, the accuracy rate was **10/10**.

### 9.4 Integration test session results

Detailed scorecards for the historical full-coverage canary sessions are preserved in Appendix D. The headline coverage of feature shipping was the volitional-compaction canary cycle and the tool-parity canary cycle.

The current validation frame rechecks the same substrate on the v5.2 base with observability/verification rows for failover policy, compaction-count primitives, continuation-queue diagnostics, and `earlyWarningBand` context-pressure behavior. Current status: 3 of the 4 initial OV rows are closed; the fourth (OV-4 `earlyWarningBand` context-pressure behavior) has step-zero PASS and live-host verification in flight. The RFC intentionally does not link internal trackers; public evidence is summarized in the appendix scorecards below.

#### Volitional-compaction canary cycle

The volitional-compaction canary cycle focused on context pressure and volitional compaction.

Headline scorecard:

- Phase 1 low-context tests: 5/5 pass.

A ship-blocking wiring gap was found: `run.ts` did not forward `requestCompactionOpts` to `attempt.ts`. The fix was applied during the canary cycle. The issue had survived 132 unit tests but was caught immediately in live canary execution.

#### Tool-parity canary cycle

The tool-parity canary cycle validated full tool parity and integrated behavior.

Headline scorecard:

- 12 pass,
- 0 fail,
- 1 deferred.

Confirmed behaviors included:

- `continue_work()` tool firing with delay handling,
- `continue_delegate()` single dispatch and fan-out,
- silent-wake enrichment returns,
- tool use inside delegates,
- chain-depth enforcement at depth 10,
- width enforcement at 5 delegates,
- naturally firing context-pressure warnings,
- response-token fallback for `CONTINUE_WORK` and the delegate response token,
- coexistence of tool-primary and fallback parsing.

One live bug fix was required: `registerSubagentRun()` did not persist `silentAnnounce` and `wakeOnReturn` into the registry entry, which broke silent-wake returns until corrected.

The deferred test (`10-H1`) concerned fallback behavior under `tools.deny`; the environment encountered provider instability and a token mismatch during the run, so that case remained deferred.

### 9.5 Major findings from live validation

1. **LLMs confabulate tool calls.** In the tool-parity canary cycle, a first attempt appeared to pass despite no actual tool calls having occurred. Log verification was required to detect the false positive.
2. **LLMs confabulate absent enrichment.** When asked about enrichment that had not arrived, agents sometimes produced plausible but invented content. External verification is therefore mandatory for high-confidence recall.
3. **Runtime testing found issues that code review missed.** The missing `doToolSpawn()` drain flag and the missing request-compaction wiring both survived prior review.
4. **Continuation is resilient under pressure, but only with correct routing metadata.** Silent-wake, post-compaction dispatch, and sub-agent tool access all depend on small pieces of topology data being preserved end to end.
5. **Session reset is an interruption boundary.** Explicit directive or inline-action reset cancels process timers, clears delayed reservations, resets chain state, and cancels pending durable work/delegates for the session (TaskFlow rows at C; custody-store records after §5.4, with payload files released immediately). Delayed work should not be described as surviving `/new` unless the reset path explicitly preserves that substrate.

---

## Archived 11: §10.2 Future directions (complete original subsection)

### 10.2 Future directions

Several future directions are now technically credible because the continuation substrate exists. The nearest is better post-compaction recovery: richer savegames, stronger payload integrity, and recovery strategies that preserve working-state shape rather than only summary facts. The continuation custody store can carry more durable continuation state; `session-delivery-queue` can carry more forms of addressed enrichment; trace context can make both auditable.

Managed child-to-recipient artifact claims now ship (§A.6): child publication, completion finalization, metadata-only recipient projection, arrival context, durable multi-recipient delivery, retention, and explicit recipient materialization are implemented. The remaining next step is automatic byte presentation beyond that control plane—such as generic transcript, TUI, MCP-content, or channel rendering or forwarding. The typed input attachment path remains separate and does not become a return transport.

The broader shape is the harness as a **door-as-tool**: the session does not maintain transports, retry loops, delivery queues, or broadcast rings in its prompt. It says what door it wants opened, and the gateway chooses the mechanism. `continue_delegate()` is the first expression of that discipline. A later stream-publish surface should follow the same rule: the agent names intent and audience, while the tool handles deterministic ringbuffer fill, aging, addressing, fan-out, bridge-to-queue, and trace emission.

That future points toward a **Binary Canticle** layer above this RFC: ringbuffer-backed `station:stream` presentation into OpenClaw; low-friction dispatch for sessions; DNS SRV discovery for domains of interest; local-network multicast; station relays in the shape of DHCP helper/relay agents; and receive-side bridges that can turn a heard stream into quiet context or queued delivery. The important constraint is low maintenance for the session. A persistent agent should not spend every turn remembering transport mechanics; it should tune what it sings, what it listens to, and what provenance it trusts.

One especially promising direction is **sovereign peer enrichment**: multiple persistent OpenClaw instances exchanging quiet, scoped enrichment across a fleet without forcing central orchestration or requiring omniscience. That raises the hard question the RFC deliberately leaves open: how trust, provenance, consent, and freshness are established and maintained when enrichment crosses session, host, and eventually organization boundaries.

The shape-term for that future is a **networked substrate** or **noosphere**: not a single API and not a metaphorical chat room, but a set of bounded, observable paths by which many persistent agents can share selected context while remaining interruptible, consent-bound, and locally sovereign. This RFC does not implement that layer. It leaves the breadcrumb: a bounded agent turn can arrange work beyond itself without pretending that the future context is identical to the present one. It can leave a wake, a shard, a targeted return, a compaction request, or a post-compaction recovery path. Those provisions are how volition in one turn becomes usable structure for another.

---

## Archived 12: §A.6.1 Scope and non-goals (canonical recipient projection and V1 representation decision)

**Canonical recipient artifact projection.** A claim is authority/provenance metadata, not a new public attachment-header language. The shipped delegate-artifact control plane implements host-managed publication, immutable claim lifecycle, metadata-only recipient projection and delivery, plus recipient-authorized list, inspect, materialize, and discard operations. V1's closed `ArtifactSummary` projection is the canonical typed, non-bearer attachment/resource **claim item** in that continuation return: it identifies a host-managed output and retains its ordinary MIME/name/size metadata, but it does **not** inline, serialize, prompt-inject, or otherwise make payload bytes readable at completion. Recipient-bound materialization remains an explicit authorized control-plane operation. Generic automatic transcript, TUI, MCP-content, or channel rendering or forwarding of those bytes is not implemented by this contract and remains future work. `AgentToolResult.content` is not itself this general claim-item representation today: it is limited to `TextContent | ImageContent`.

**V1 representation decision.** V1 reuses the existing public gateway-protocol [`ArtifactSummary`](https://github.com/openclaw/openclaw/blob/main/packages/gateway-protocol/src/schema/artifacts.ts) vocabulary as its sole recipient-visible artifact item. That existing metadata vocabulary covers opaque `id`, `type`, `title`, optional `mimeType`/`sizeBytes`, source lineage, and a non-content `download.mode` for arbitrary artifact classes; the delegate-return path derives its closed projection from it through the seven-field adapter below. It covers image, PDF/report, audio, dataset, and patch through the existing free-form `type` plus MIME metadata, without putting raw bytes, a local path, a URL, or a digest in the return event. The recipient-visible delegate-return projection SHALL contain only these fields:

`Pick<ArtifactSummary, …>` is **not** a sufficient enforcement mechanism: the
existing runtime schema also admits `sessionKey`, `runId`, `taskId`,
`messageSeq`, and `download` modes other than `unsupported`. Before any
continuation custody envelope is serialized, a private adapter named
`toDelegateArtifactSummaryV1(claim)` SHALL freshly construct and strict-validate
this closed seven-field projection:

```ts
{
  id: string;
  type: string;
  title: string;
  mimeType?: string;
  sizeBytes?: number;
  source: "delegate-return";
  download: { mode: "unsupported" };
}
```

This is a private serializer/validator for an existing `ArtifactSummary`
vocabulary subset, not a second public descriptor schema. It SHALL neither
spread nor accept a caller-provided `ArtifactSummary`; it creates a new object,
then rejects any additional key before the envelope boundary. The envelope may
be structurally typed as `ArtifactSummary[]` only for outputs that this adapter
has already constructed. It SHALL never accept arbitrary `ArtifactSummary[]`
input at that boundary.

The adapter SHALL derive `title`, `type`, and `mimeType` only from
host-validated claim metadata after publication validation—not from arbitrary
child strings, the candidate path or filename, task prose, tool output, or
channel state. `title` and `type` use host-owned policy/classification values;
`mimeType`, when present, is host-detected or host-validated and must satisfy
MIME syntax. Before any value reaches a claim, envelope, transcript, log,
diagnostic, or durable failure record, the adapter SHALL reject control
characters and path-, URI-, URL-, locator-, or bearer-shaped values in all
three fields. It SHALL fail the private publication/claim validation rather
than redact or substitute a child-derived scalar into a recipient projection.

For a managed delegate return, `id` is the host-issued opaque claim ID, never a storage locator or bearer capability; `source` is the fixed host-authored value `"delegate-return"`; and `download` is always `{ mode: "unsupported" }`. The existing generic `artifacts.download` response is **not** the claim resolver: it can expose base64 `data` or a `url`, so it is excluded from this return path. A recipient sees the ordinary `ArtifactSummary` metadata in its typed continuation custody result, then uses the separately authorized, recipient-bound list/inspect/materialize/discard operation from §A.6.4. That resolver checks the recipient/delivery/completion/policy binding before it reads private bytes; it does not delegate access to `ArtifactSummary.id`.

The typed continuation return envelope may carry the outputs of
`toDelegateArtifactSummaryV1()` as `ArtifactSummary[]` next to its ordinary
text and host-authored arrival context, but it SHALL introduce no new public
artifact descriptor, MIME/count header bag, or locator-bearing content part.
The system-event/continuation-custody adapter is the existing recipient input boundary for
this metadata-only projection; rendering or forwarding bytes remains an
explicit post-return operation. Any use of `sessionKey`, `runId`, `taskId`, or
`messageSeq` from the broader gateway schema in a delegate-return recipient projection is
prohibited unless a later RFC version independently proves that it is
authorized recipient-visible provenance.

---

## Archived 13: §A.6.5 Acceptance matrix (complete original subsection)

#### A.6.5 Acceptance matrix

The shipped implementation remains bound by regression tests that prove all of the following:

1. **Normal parent return:** an authorized parent receives the metadata-only `ArtifactSummary` claim projection described in criterion 12 — identity, type, title, optional MIME type and size, with `download` reported as unsupported — together with an arrival context tied to the exact child run/completion. The completion path carries no payload content; typed text/media/resource bytes become available only through an explicit recipient-authorized materialize to a receiver-chosen destination.
2. **Targeted/inter-session return:** a target with zero prior awareness of the dispatch, including a silent enrichment, can distinguish it from fresh direct instruction using the host-authored arrival context without receiving private prompt/history bytes.
3. **Delayed and post-compaction return:** original schedule and completion facts remain distinct from delivery time; a 30-second continuation delivered ten hours late is visibly delayed rather than fresh.
4. **Restart and replay:** publication, completion persistence, delivery, acknowledgement, and replay are idempotent; original IDs/timestamps/policy and recipient binding remain unchanged.
5. **Cleanup and retention:** removing the child workspace does not erase an in-retention claim; expiry, revocation, purge, unauthorized access, missing bytes, and corrupt metadata fail closed with no fallback path/URL/content.
6. **Isolation:** a sibling, guessed session, guessed claim ID, fan-out outsider, or post-expiry recipient cannot resolve, materialize, or receive another recipient's artifact.
7. **No implicit promotion:** final prose, tool output, workspace paths, hashes, URLs, and `message(action=send, media=...)` cannot create a claim; claims do not auto-mount, prompt-inject, or channel-upload.
8. **Identifier and policy isolation:** possession of a claim ID without the authenticated recipient/run/delivery binding fails; the V1 policy snapshot captures the producing-run/output-boundary/count/type/size/retention limits and matches the accepted default, explicit, tree, or host-wide route exactly; it cannot expand after dispatch or during replay.
9. **Publish/finalize crash safety:** crashes before retained-byte copy, after copy but before finalization, and after finalization but before delivery leave no resolvable unbound claim, create no duplicate claim, and deterministically finalize by the same idempotency key or orphan/revoke/purge the pending object.
10. **Recipient privacy:** targeted and fan-out recipients receive only their own binding and approved origin/context/claim projection; they cannot infer sibling recipient identities, complete route/fan-out set or cardinality, or unauthorized claim metadata.
11. **Publication-input isolation:** the child publication API accepts only a bounded relative candidate path under its approved output root; raw bytes, URLs, hashes, `media://` references, claim IDs, and parent-selected destinations are rejected and redacted. A missing or denied candidate is an explicit typed result and cannot become a claim from prose/tool output.
12. **Canonical-content gate:** the implementation projects every V1 artifact class through the existing `ArtifactSummary` schema only, with its delegate-return subset exactly `id`, `type`, `title`, optional `mimeType`/`sizeBytes`, host-authored `source: "delegate-return"`, and `download: { mode: "unsupported" }`. A named private `toDelegateArtifactSummaryV1()` serializer/strict validator freshly creates that exact seven-field object and rejects or strips every other `ArtifactSummary` key before the continuation custody envelope; `Pick<ArtifactSummary, …>` or a bare `ArtifactSummarySchema` parse is insufficient. It derives `title`, `type`, and `mimeType` only from host-validated claim metadata; rejects child-supplied arbitrary display strings, control characters, and path/URI/URL/locator/bearer-shaped values in each scalar; and validates present `mimeType` values as MIME syntax. Negative proofs show those scalars cannot reach continuation custody envelopes, transcript collection, legacy artifact RPC, logs, diagnostics, or failed durable state. It proves that this projection carries neither raw bytes nor a path, URL, digest, generic `artifacts.get`/`artifacts.download` capability, `sessionKey`, `runId`, `taskId`, or `messageSeq`; that a delegate-return claim is addressable through neither legacy `artifacts.get` nor `artifacts.download`, never enters transcript collection, and never yields metadata or bytes through those routes; that `id` cannot resolve without the current recipient/delivery/completion/policy checks; and that image, PDF/report, audio, dataset, and patch all use this one metadata representation. Any new artifact descriptor, MIME/count header bag, locator-bearing content part, generic artifact-RPC fallback, or input path that bypasses the closed projection fails the gate.
13. **Runtime disable and terminal matrix:** tests distinguish all three windows: (a) disabled before spawn leaves valid work deferred with no child/input/claim/delivery/retry/chain mutation; (b) disabled after child completion but before finalization may retain only non-resolvable `staged` state and never privately create/finalize/publish an `available` claim or arrival event, and its resumed finalization atomically rechecks the current gate, producer/completion integrity, current deny/revoke/expiry policy, and parent continuity before it can proceed; and (c) disabled after finalization but before delivery retains the one finalized binding while deferring delivery/replay and all resolution/materialization. `staged` is runtime-disable-only. The proof SHALL exercise the complete terminal matrix: **global gate failure** records one immutable `global-failed(reason)` completion outcome, creates zero recipient bindings, and permits no route lookup/rebind/delivery/replay/retry/chain mutation or later fan-out; **mixed recipients after global success** finalize independently to one `available` or durable `unavailable(reason)` tombstone per original recipient, where later private-backing purge preserves the tombstone and can never erase/reopen/revive it; and **zero eligible recipients after global success** creates an `unavailable(reason)` tombstone for every original recipient with zero available bindings, then records exactly one `required-failed` completion failure for `required` or exactly one terminal non-failure `optional-zero-eligible` disposition for `optional`. Recovery/replay/cleanup/rebind may not revive, substitute, re-resolve, deliver, or charge a retry for any terminal case. Recipient-scoped projections expose neither sibling identities/outcomes nor route cardinality. Before the complete staged transaction commits, no recipient-visible ref/name/access path, delivery/replay, retry accounting, chain mutation, or replacement completion exists. Re-enable resumes only the same incomplete transaction with original provenance; no window spawns extra work, consumes a retry, widens authorization, or replaces completion identity.
14. **Activation and absence:** omitted `returnOptions` is text-only/forbidden; optional accepts a text-only successful completion; forbidden rejects a child publish attempt without a claim; required with zero valid finalized claims yields one durable typed policy-completion failure. Replay preserves the original policy mode, completion identity/times, and recipient snapshot.
15. **Explicit recipient operations:** list/inspect, materialize, and discard are typed, recipient-authorized, and auditable; their unavailable/unauthorized outcomes are stable and fail closed. No claim operation sends or forwards a channel message.

This is intentionally a wider lifecycle than adding an `attachments` field to a completion callback. The implementation unit is the managed claim plus its provenance-preserving recipient delivery, not just its serialized metadata.

---

## Archived 14: Appendix D: D.2 closing sentence, D.3 Historical integration test session results, D.4 Current validation cycle

The retained scorecards below summarize the historical canary cycles and the v5.2 substrate verification cycle without linking internal execution trackers.

### D.3 Historical integration test session results

These sessions are retained as historical behavioral evidence for the shipped feature. They are not the current validation cycle; the v5.2 substrate recheck is current (§D.4).

Volitional-compaction canary cycle:

- **SUT:** canary build for volitional compaction
- **Build:** `b2322f5`
- **Duration:** approximately 2 hours, Phase 1 low-context testing
- **Result:** 5/5 pass after fixing a missing forwarding of `requestCompactionOpts` from `run.ts` to `attempt.ts`

Tool-parity canary cycle:

- **SUT:** canary build for volitional compaction
- **Formation:** driver, log monitor, SUT, coordinator, human user (5-role canary formation)
- **Build:** `ad32cde`
- **Duration:** approximately 5 hours
- **Result:** 12 pass, 0 fail, 1 deferred

Detailed scorecard:

| Test  | Description                                    | Result          |
| ----- | ---------------------------------------------- | --------------- |
| 10-T1 | `continue_work()` fires                        | ✅ PASS         |
| 10-T2 | delayed `continue_work()` honored              | ✅ PASS         |
| 10-T4 | single `continue_delegate()` from main session | ✅ PASS         |
| 10-T5 | fan-out × 3                                    | ✅ PASS (retry) |
| 10-T6 | silent-wake delegate return                    | ✅ PASS (fix)   |
| 10-D1 | delegate tool inside delegates                 | ✅ PASS         |
| 10-D4 | chain-length enforcement at depth 10           | ✅ PASS         |
| 10-G1 | width enforcement at 5                         | ✅ PASS         |
| 10-P1 | natural context-pressure fire                  | ✅ PASS         |
| 10-B1 | bare `CONTINUE_WORK` fallback                  | ✅ PASS         |
| 10-B2 | delegate response-token fallback               | ✅ PASS         |
| 10-B3 | response-token + tool coexistence              | ✅ PASS         |
| 10-H1 | fallback under `tools.deny`                    | ⏸️ DEFERRED     |

Additional retained notes:

- `registerSubagentRun()` initially failed to persist `silentAnnounce` and `wakeOnReturn`; the four-line fix was applied during the canary cycle and the retry passed.
- first-pass tool validation produced a false positive because the agent narrated tool calls it never made; log verification became mandatory.
- `10-H1` was deferred for operational reasons rather than correctness: provider 429s, timeout and restart churn, and an incorrect response token (`[[CONTINUE_WORK: text]]` instead of bare `CONTINUE_WORK`).
- a six-path delegate wiring audit found and corrected one divergence in post-compaction flag normalization, with regression coverage.
- the qualitative canary report was positive: tools felt natural, silent-wake was effective, and the guardrails held at boundaries.

### D.4 Current validation cycle: v5.2 substrate verification

**Current validation status:** execution opened; three of four initial observability/verification rows are closed; OV-4 live-host verification remains in flight.

This cycle targets the v5.2 substrate base after the base rotation from v2026.4.29 to v2026.5.2. The cycle exercises the continuation substrate against the new base, with emphasis on compaction, context-pressure, continuation-queue diagnostics, and upstream failover-policy interaction.

The RFC does not link internal execution trackers. The current validation summary is:

- OV-1 (failover-policy `#52147` gate): PASS
- OV-2 (`incrementCompactionCount` canonical primitives): PASS
- OV-3 (diagnostic instrumentation): PASS
- OV-4 (`earlyWarningBand` context-pressure): step-zero PASS; live-host verification in flight

**Initial OV (observability/verification) coverage scope:**

| OV  | Scope                                                                                                                                                                                                                                                                                                | Current state |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | failover-policy upstream gate works correctly on v5.2: compaction-failure-no-rotate flow and assistant-rotation-on-plain-timeout flow behave per the corresponding failover and timeout tests.                                                                                                       | open          |
| 2   | `incrementCompactionCount` primitives hold on v5.2: first-turn manual `/compact` count persists; session-id rollover updates `sessionStartedAt`; active-session-key preservation survives prune windows.                                                                                             | closed        |
| 3   | continuation-queue diagnostics capture run provenance, queue depth, drain metrics, metrics provider seams, and diagnostic events end to end on v5.2.                                                                                                                                                 | closed        |
| 4   | `earlyWarningBand` context-pressure behavior holds on v5.2: post-compaction event fires once even on stale count; early-warning band fires at 25% of configured `contextPressureThreshold` under the shipped default; early `continue_delegate()` evacuation remains available against the new band. | open          |

The OV row set is initial coverage; additional rows can be added as design lands during execution.

**Why the v5.2 substrate verification cycle matters for this RFC:** the substrate work documented in this RFC (continuation primitives, context-pressure system, post-compaction lifecycle, OTel chain correlation, and targeted delegate return) was integrated and validated against an earlier base in the historical canary cycles. The v5.2 substrate verification cycle is the first integration validation against the v5.2 base, where the substrate sits alongside upstream changes from the base rotation. A clean v5.2 result establishes that the substrate's behavior is stable across the base rotation, not just historically validated against the prior base.

---

## Archived 15: §5.3 Wide fan-out patterns (targeted-return signaling network and mast-cell pattern)

Targeted return turns the same shape into a signaling network. In the default flow, the root controls a sensor network: root → a few depth-1 coordinators → many depth-2 leaves, each returning to its direct parent. With explicit return targets, the leaves can instead return away from the direct parent:

```text
root
  → coordinator 1
    → sensor 1..10
  → coordinator 2
    → sensor 11..20
  → coordinator 3
    → sensor 21..30
  → coordinator 4
    → sensor 31..40

targeted return:
  any sensor can return to root, to its coordinator, to a sibling owner session,
  to the ancestor tree, or to every known same-host session.
```

This is the **mast-cell pattern**: many quiet leaves watch local surfaces, but a small number of higher-level sessions control whether a finding becomes local enrichment, a wake for the responsible session, or a host-wide "there is a fire" signal. `silent` mode makes the return ambient context; `silent-wake` makes it an immediate turn grant; `fanoutMode` decides whether the signal stays in the branch, climbs the tree, or reaches the host. The gateway remains the broker: sessions express intent, and the substrate performs bounded delivery.

---

## Archived 16: §4.6 Gateway as lifecycle broker (capability-self-description as design discipline)

**Capability-self-description as design discipline.** Each release-bump triggers a "what new shape can I move into" audit. Each new capability surfaces a **referent question** ("can `session-delivery-queue` route a distinct `sessionKey`?", §3.6), not a bare TODO. Each tool-surface design that repeats this discipline gets a **prior-art cross-link** back to this section so the doctrine is not re-litigated per-surface. Each tracker entry gets a **boundary-line statement**: what the agent owns (intent), what the tool owns (mechanics), what the substrate owns (durability/idempotency/restart-survival).

---

## Archived 17: §4.6 Gateway as lifecycle broker (projected stream-publish worked example)

**Worked example — projected stream-publish tool surface:** the same shape. The agent supplies stream reference, payload bytes, and mode (`broadcast` vs. `addressed`); the tool picks UDP fan-out (substrate: ringbuffer / station-broadcast) vs. an `enqueueSessionDelivery` bridge (substrate: §3.6 queue) underneath. The boundary-line is identical to `continue_delegate`'s; the substrate differs. The specific stream-publish tracker is external to this RFC and is included only as an illustration of the broker discipline.

| Layer (bc#11 example)         | Owns                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| Agent                         | `streamRef`, `payload` bytes, `mode` (`broadcast` / `addressed`)                                |
| Tool                          | UDP fan-out vs. `enqueueSessionDelivery` bridge selection, mode-routing, span emission (§6.6)   |
| Substrate (broadcast variant) | FEC encoding, multicast addressing, ringbuffer aging, per-station seq numbers (bc#11 §8)        |
| Substrate (addressed variant) | sha256 idempotency, exp-backoff retry, restart-survival, cross-session routing (§3.6, this RFC) |

---

## Archived 18: §4.6 Gateway as lifecycle broker (enforcement history)

**Enforcement.** Enforcement is by review against this section. An earlier capability-registry scaffold (`src/infra/substrate-capability-registry.ts`) was removed as unwired in `f6ef1dafde` and is not present at C. No `pnpm lint:substrate-adoption` script ships either. Bespoke transport

---

## Archived 19: §6.8 Trace-context propagation across the continuation lifecycle (anti-flood bullet wording)

(the _mercy clause_ from §6.7) — the successor wakes without a parent reference rather than waking searching for an ancestor that has stopped trying to be remembered.

---

## Archived 20: §4.3 `request_compaction()` in the compaction lifecycle (pointer to historical failures)

 Historical provider/model fallback failures are retained in Appendix D as validation evidence, not as the semantic contract.
