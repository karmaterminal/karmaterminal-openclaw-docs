# Independent global-schema-v15 harness review

Status: `REQUEST_CHANGES`.

Issue binding: `openclaw/openclaw#129388`.

## Named-reference contract

This table was written before rejected or successor evidence was credited. The
unchanged review lane was first published at implementation SHA
`2a219003d4a75bc2650dd72bbeb43274686e85b5`.

| Category | Named reference | Local SHA/object | Tracking SHA | Server SHA/object | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw@0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | N/A (immutable commit object) | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | local/server equal |
| Safe lane ref | `codeagent/129388-2a219003-harness-v15-independent-review-20260830` | `2a219003d4a75bc2650dd72bbeb43274686e85b5` | `2a219003d4a75bc2650dd72bbeb43274686e85b5` | `2a219003d4a75bc2650dd72bbeb43274686e85b5` | local/tracking/server equal |
| CI/workflow ref | N/A | N/A | N/A | N/A | Focused-only docs-harness review; Mode-B and Gate 3g do not apply. |
| Presentation ref | N/A | N/A | N/A | N/A | Protected presentation and fleet are read-only and have no named ref in the workorder. |
| Product-driver lane | N/A | N/A | N/A | N/A | Workorder records it blocked with zero product edits; no ref was furnished and this review does not resume it. |
| Docs/proof accepted parent | `codeagent/129388-proof-store-generic-terminal-marker-fix-20260829` | `16f8bca6593813adb25e864c91d38f456b1708c0` | `16f8bca6593813adb25e864c91d38f456b1708c0` | `16f8bca6593813adb25e864c91d38f456b1708c0` | local/tracking/server equal |
| Docs/proof accepted parent review | `codeagent/129388-proof-store-16f8-independent-review-20260829` | `6995218335b0fb9205de1e6c03b48acc88418d53` | `6995218335b0fb9205de1e6c03b48acc88418d53` | `6995218335b0fb9205de1e6c03b48acc88418d53` | local/tracking/server equal |
| Docs/proof v15 implementation | `savegame/129388-harness-global-schema-v15-currency-20260830T195326Z` | `2a219003d4a75bc2650dd72bbeb43274686e85b5` | `2a219003d4a75bc2650dd72bbeb43274686e85b5` | `2a219003d4a75bc2650dd72bbeb43274686e85b5` | local/tracking/server equal |
| Docs/proof report successor | `savegame/129388-harness-global-schema-v15-currency-final-20260830T1958Z` | `faf2125eb486c28d0b19904c8bcad03640ce0f76` | `faf2125eb486c28d0b19904c8bcad03640ce0f76` | `faf2125eb486c28d0b19904c8bcad03640ce0f76` | local/tracking/server equal |
| Docs/proof blocked corpus | `codeagent/129388-0ed59cb6-full-exact-proof-20260830` and `savegame/129388-0ed59cb6-blocked-proof-20260830T1915Z` | `ba8d344c1240275a9c54042294b8129eea4e497b` | `ba8d344c1240275a9c54042294b8129eea4e497b` | `ba8d344c1240275a9c54042294b8129eea4e497b` | local/tracking/server equal |
| Docs main | `karmaterminal/karmaterminal-openclaw-docs:main` | object `0984dabae218000b20178f4a031e688bdf0584ac` | `0984dabae218000b20178f4a031e688bdf0584ac` | `0984dabae218000b20178f4a031e688bdf0584ac` | local object/tracking/server equal |

The independent final report commit cannot contain its own SHA. Its lane and
immutable savegame equality will be identity-gated after the report is frozen
and recorded in the completion dispatch.

## Verdict

`REQUEST_CHANGES`.

No: the product-driver lane may **not** resume unchanged against implementation
`2a219003d4a75bc2650dd72bbeb43274686e85b5`.

The candidate correctly advances the visible observed schema from global v13
to exact global v15 and adds the current product indexes. It does not, however,
enforce the exact physical schema it claims. A generated hidden resurrection of
the removed `target_agent_id` projection and an extra table-owned uniqueness
constraint both pass the candidate's actual "exact" predicate. The complete
focused suite also cannot produce a green local receipt on this `linux-x64`
lane because the committed reviewed-k6 policy contains only `linux-arm64`;
that infrastructure failure is inherited from the accepted parent and is
reported separately from the schema defect.

## Review finding

### Exact schema inventory omits hidden columns and table-owned uniqueness

Invariant: the docs-owned observer must reject every physical resurrection of
the v15-removed binding projections and every uniqueness mutation at the
`requireExactTable` composition boundary.

Implementation `2a219003` violates that invariant:

- `tools/k6-proofs/lib/return-covenant-retention-inspector.mjs:792` uses
  `PRAGMA table_info`, which SQLite intentionally omits generated/hidden
  columns. The function never calls `PRAGMA table_xinfo`.
- `tools/k6-proofs/lib/return-covenant-retention-inspector.mjs:534-535`
  filters the index inventory to `origin === 'c'`. It therefore ignores
  `origin === 'u'` autoindexes created by table-level or column-level `UNIQUE`
  constraints.
- The ordinary-column negative at
  `tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs:2599`
  adds a visible column, so it does not exercise the hidden-column escape.
  The index-order negative at line 2630 mutates a `CREATE INDEX` object, so it
  does not exercise an added table-owned uniqueness constraint.

Two deterministic controls imported the candidate module in memory, exposed
its unchanged private `requireExactTable` function, and called that actual
function against v15 binding tables with the required three product indexes:

| Mutation that exact v15 must reject | Candidate result | SQLite evidence |
|---|---|---|
| `target_agent_id TEXT GENERATED ALWAYS AS (target_session_key) VIRTUAL` | **accepted** | `PRAGMA table_info` omitted it; `PRAGMA table_xinfo` returned `target_agent_id` with `hidden=2`. |
| `binding_id TEXT NOT NULL UNIQUE` | **accepted** | `PRAGMA index_list` returned an additional unique `sqlite_autoindex_current_conversation_bindings_2` with `origin='u'`; the candidate filtered it out. |

The first mutation is a direct resurrection of a projection removed by product
v15. The second changes write semantics by rejecting duplicate binding IDs even
though the product schema does not make that column unique. Both preserve all
visible column names, types, nullability, primary-key ordinals, explicit index
names, explicit index ordering, explicit index uniqueness, sort directions,
and partial predicates currently checked by the candidate.

The same root cause means the hand-built per-agent fixture is not an exact
product v19 physical schema. For example, its `session_windows` definition at
`tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs:2241`
omits the product's reason/session-scope/status checks and both foreign keys
present in exact product
`src/state/openclaw-agent-schema.sql:121-150`. The reduced table passes because
the candidate checks only visible layout plus explicit indexes, not those
physical constraints.

Required correction is not prescribed in this review-only lane, but acceptance
requires a deterministic negative that fails on `2a219003` for the hidden
projection and succeeds on a successor, plus exact physical-shape coverage for
table-owned uniqueness. The candidate itself was not edited.

## Independently derived product schema history

All product facts below came from exact Git objects contained by product
authority `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3`, not from report successor
`faf2125`.

### v13

Global v13 is commit
`1ea2640f5428eacb70e182137e9501fbdfd8cbca`. It rebuilds the wide
`cron_jobs` and `subagent_runs` tables around canonical JSON, folds workspace
attestations and shared singleton stores, and removes obsolete physical
projections. At v13, `current_conversation_bindings` still contains
`target_agent_id TEXT NOT NULL` and nullable `target_session_id`; its target
index is:

```sql
(target_agent_id, target_session_key, updated_at DESC, binding_key)
```

### v14

Global v14 is commit
`036e0d9bf714ebec3b022760d96813b6ffd5ecbe`. Its state migration updates
valid historical human `cron_jobs.job_json` records with
`createdActor.source = "unknown"`. The commit adds no global `CREATE`, `ALTER`,
`DROP`, or index DDL, and `src/state/openclaw-state-schema.sql` is unchanged.
The physical binding table and target index therefore remain the v13 shape.

### v15

Global v15 is commit
`3506cf9d1a6735a03631000c7237c05ebe2ba83f`. Its migration drops
`idx_current_conversation_bindings_target`, removes `target_agent_id` and
`target_session_id`, then lets canonical schema convergence recreate the target
index as:

```sql
(target_session_key, updated_at DESC, binding_key)
```

The current binding writer and readers at exact authority use
`target_session_key` and canonical `record_json`; no runtime read or write
retains either removed projection. Opaque plugin target keys are accepted
without parsing them as agent session keys.

### Current observed global v15 inventory

Every observed table is `STRICT`. Explicit indexes listed below are all
non-unique; omitted directions are `ASC`.

| Table | Columns in exact order | Primary key |
|---|---|---|
| `schema_meta` | `meta_key, role, schema_version, agent_id, app_version, created_at, updated_at` | `meta_key` |
| `agent_databases` | `agent_id, path, schema_version, last_seen_at, size_bytes` | `(agent_id, path)` |
| `current_conversation_bindings` | `binding_key, binding_id, target_session_key, channel, account_id, conversation_kind, parent_conversation_id, conversation_id, target_kind, status, bound_at, expires_at, metadata_json, record_json, updated_at` | `binding_key` |
| `delivery_queue_entries` | `queue_name, id, status, entry_kind, session_key, channel, target, account_id, retry_count, last_attempt_at, last_error, recovery_state, platform_send_started_at, entry_json, enqueued_at, updated_at, failed_at` | `(queue_name, id)` |
| `subagent_runs` | `run_id, child_session_key, controller_session_key, requester_session_key, created_at, payload_json` | `run_id` |
| `flow_runs` | `flow_id, shape, sync_mode, owner_key, chain_id, requester_origin_json, controller_id, revision, status, notify_policy, goal, current_step, blocked_task_id, blocked_summary, state_json, wait_json, cancel_requested_at, created_at, updated_at, ended_at` | `flow_id` |

| Table | Explicit index | Ordered columns | Partial predicate |
|---|---|---|---|
| `current_conversation_bindings` | `idx_current_conversation_bindings_target` | `target_session_key, updated_at DESC, binding_key` | none |
| `current_conversation_bindings` | `idx_current_conversation_bindings_conversation` | `channel, account_id, conversation_kind, conversation_id` | none |
| `current_conversation_bindings` | `idx_current_conversation_bindings_expires` | `expires_at, binding_key` | none |
| `delivery_queue_entries` | `idx_delivery_queue_pending` | `queue_name, status, enqueued_at, id` | none |
| `delivery_queue_entries` | `idx_delivery_queue_failed` | `queue_name, status, failed_at, id` | none |
| `delivery_queue_entries` | `idx_delivery_queue_session` | `queue_name, status, session_key, enqueued_at, id` | `session_key IS NOT NULL` |
| `delivery_queue_entries` | `idx_delivery_queue_target` | `queue_name, status, channel, target, enqueued_at, id` | `channel IS NOT NULL AND target IS NOT NULL` |
| `subagent_runs` | `idx_subagent_runs_child_session_key` | `child_session_key, created_at DESC, run_id` | none |
| `subagent_runs` | `idx_subagent_runs_requester_session_key` | `requester_session_key, created_at DESC, run_id` | none |
| `subagent_runs` | `idx_subagent_runs_controller_session_key` | `controller_session_key, created_at DESC, run_id` | none |
| `flow_runs` | `idx_flow_runs_status` | `status` | none |
| `flow_runs` | `idx_flow_runs_owner_key` | `owner_key` | none |
| `flow_runs` | `idx_flow_runs_updated_at` | `updated_at` | none |

The required global metadata row is
`schema_meta(meta_key='primary', role='global', schema_version=15,
agent_id=NULL)`, and `PRAGMA user_version` must independently equal 15.

The product registry owns a composite `(agent_id,path)` identity, orders reads
by `agent_id,path`, stores in-root database paths relative to the state root,
resolves them back against that root, and filters ordinary discovery to exact
schema 19. Registration upserts by the composite key. The isolated harness
intentionally narrows this to one canonical default
`agents/<agent>/agent/openclaw-agent.sqlite` path per agent, requires exact v19,
and rejects registry/directory disagreement.

### Current observed per-agent v19 inventory

Product authority defines
`OPENCLAW_AGENT_SCHEMA_VERSION = 19`. The required owner row is
`schema_meta(meta_key='primary', role='agent', schema_version=19,
agent_id=<registered owner>)`, with independent `PRAGMA user_version=19`.

The observer reads exact visible columns for:

- `session_nodes`: `session_key, current_session_id, entry_json, entry_valid,
  updated_at, status, created_at, created_via, created_actor_type,
  created_actor_id, owner_actor_type, owner_actor_id, owner_assigned_by_type,
  owner_assigned_by_id, owner_assigned_at, project_id, parent_session_key,
  spawned_by, fork_source_session_key, fork_source_session_id,
  fork_source_entry_id, label, display_name, category, icon, pinned_at,
  archived_at, last_read_at, last_interaction_at, last_activity_at`; primary
  key `session_key`.
- `session_windows`: `session_id, session_key, previous_session_id, reason,
  session_scope, created_at, updated_at, transcript_updated_at,
  transcript_observed_at, session_entry_provenance, acp_owned,
  plugin_owner_id, hook_external_content_source, started_at, ended_at, status,
  chat_type, channel, account_id, primary_conversation_id, model_provider,
  model, agent_harness_id, parent_session_key, spawned_by, display_name`;
  primary key `session_id`.

All 12 explicit indexes are non-unique:

| Table | Index | Ordered columns | Partial predicate |
|---|---|---|---|
| `session_nodes` | `idx_agent_session_nodes_updated_at` | `updated_at DESC, session_key` | none |
| `session_nodes` | `idx_agent_session_nodes_last_interaction_at` | `last_interaction_at DESC, session_key` | none |
| `session_nodes` | `idx_agent_session_nodes_parent_session_key` | `parent_session_key, session_key` | none |
| `session_nodes` | `idx_agent_session_nodes_spawned_by` | `spawned_by, session_key` | none |
| `session_nodes` | `idx_agent_session_nodes_status` | `status, session_key` | `status IS NOT NULL` |
| `session_nodes` | `idx_agent_session_nodes_archived_at` | `archived_at, session_key` | `archived_at IS NOT NULL` |
| `session_nodes` | `idx_agent_session_nodes_current_session_id` | `current_session_id` | none |
| `session_nodes` | `idx_agent_session_nodes_entry_valid_pending` | `session_key` | `entry_valid = 0` |
| `session_windows` | `idx_agent_session_windows_updated_at` | `updated_at DESC, session_id` | none |
| `session_windows` | `idx_agent_session_windows_session_key` | `session_key, updated_at DESC, session_id` | none |
| `session_windows` | `idx_agent_session_windows_created_at` | `created_at DESC, session_id` | none |
| `session_windows` | `idx_agent_session_windows_conversation` | `primary_conversation_id, updated_at DESC, session_id` | `primary_conversation_id IS NOT NULL` |

## Observer-authority audit

Subject to the exact-shape defect above, the changed and adjacent authority
chain has these independently confirmed properties:

- `requireDatabaseIntegrity` requires exact global 15 and per-agent 19, not
  `>=`, an allowlist, or an optional marker. It separately requires the
  matching `schema_meta.primary` owner/version/agent tuple.
- The visible-column and explicit-index controls reject v13, v14, v16,
  metadata disagreement, wrong global owner, ordinary removed-column
  resurrection, required-column absence, explicit index order mutation,
  missing/renamed/view-substituted tables, malformed lifecycle/JSON, and
  registry/path disagreement.
- Explicit index checks cover names, non-uniqueness, partial status, ordered
  key columns, `ASC`/`DESC`, and normalized partial predicate text. The finding
  is specifically that hidden columns and non-`origin='c'` uniqueness remain
  outside that inventory.
- The exact product-store contract constant is
  `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3`; later product drift is not
  implicitly accepted.
- The exported store observer remains launcher-owned. It opens directories,
  databases, WAL, and SHM with `O_NOFOLLOW`, requires canonical real paths and
  regular bounded files, binds path/device/inode/mode/size/mtime identities,
  copies only opened descriptors, and revalidates identities after copying.
- The launcher freezes the attested process group, requires a stable stopped
  PID/start/socket set, takes the live snapshot, resamples before resume, then
  takes a second snapshot only after shutdown settlement. Live/final resources
  must agree.
- `deriveReturnCovenantTrustedRetention` derives retained resources from the
  durable-store chain. Candidate gateway resource responses are corroboration
  only; candidate cleanup is copied into a `passEligible=false` diagnostic.
  Missing, malformed, symlinked, or oversized cleanup diagnostics add signed
  failure categories rather than granting PASS.
- The resolver produces `PASS-candidate` only when every observation,
  cleanup, retention, runtime, redaction, and signing gate is valid. A failed
  store observation becomes `unverified-resource-retention`; it cannot be
  converted into PASS by a candidate response.
- Existing flow, subagent, delivery-queue, session tombstone, cleanup,
  rollback/restart, partial-failure, typed-tool, bracket-token, and signed-FAIL
  semantics were not weakened by the v15 patch.

No GitNexus graph result was credited. The installed fork is
`/home/figs/flesh_beast_best_beast/source/GitNexus`,
`gitnexus@1.6.5`, commit
`3c1e686edfc1acaac882927cada121ddd7c47bcc`; exact Git-object reads were used
for the workorder's explicit byte-review fallback.

## Deterministic replay

Acceptance path: `focused-only`. No Mode-B run and no Gate 3g fallback apply to
this docs-harness review.

### Accepted-parent negative control

A disposable tree used the candidate's exact v15 owner test byte and replaced
only `return-covenant-retention-inspector.mjs` with its exact
`16f8bca6593813adb25e864c91d38f456b1708c0` blob. Blob hashes were checked
before execution.

```bash
node --test --test-concurrency=1 \
  --test-name-pattern='durable inspector matches current product-shaped retention stores' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs
```

The clean v15 child failed exactly with
`retention snapshot has unexpected schema version 15`. The combined matrix was
`14/46` pass and `32/46` fail because the accepted parent stops every v15
observation at that owning version gate; those additional failures are not
counted as candidate findings.

### Candidate direct-store matrix

The same command on exact candidate `2a219003` produced `46/46` pass,
`0` fail, `2477.417394ms`. It covers:

- clean visible v15 global and v19 per-agent stores;
- v13, v14, v16, marker disagreement, wrong owner, ordinary removed
  projection, required visible shape, and explicit target-index order
  negatives;
- queue, flow, subagent, spawned-session, tombstone, and settled-terminal
  siblings;
- malformed row/JSON/lifecycle and missing/renamed/view table negatives;
- no-follow path swap and symlink rejection;
- WAL mutation rejection and a WAL-only retained-row positive; and
- exact per-agent index checks.

The two additional actual-predicate controls documented in the finding are
negative controls that should have rejected but instead returned **accepted**.

### Complete focused suite

The exact required command was run twice with no candidate-byte changes:

```bash
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
```

| Repetition | Pass | Fail | Duration | Classification |
|---|---:|---:|---:|---|
| candidate 1 | 111/128 | 17 | `54980.134640ms` | 16 launcher tests stop at `no reviewed k6 binary policy for linux-x64`; one schema test stops at missing Python `jsonschema`. |
| candidate 2 | 111/128 | 17 | `54928.084416ms` | Same 17 failures and causes. |
| exact accepted parent baseline | 102/119 | 17 | `54518.451388ms` | Same 16 k6-policy and one Python dependency failures. |

This host is `x86_64`, Node is `v26.7.0`, and the committed
`tools/k6-proofs/k6-proof-binaries.json` contains only `linux-arm64`. A local
regular x86-64 `/home/figs/bin/k6` exists and reports
`k6 v2.0.0 (commit/8c3be52cc1, go1.26.3, linux/amd64)`, SHA-256
`58165941f658517acfe79481e4ff66c72d6a93ed9e9bc7f87fb3f453f8ef33c1`,
but that byte is not in the reviewed policy and was therefore correctly
refused. No unreviewed policy was invented, no donor architecture was used,
and no dependency tree was transplanted.

Before those prerequisite-bound launcher cases, the suite's path/WAL/process
negatives, signed receipt and signed-FAIL controls, cleanup derivation, visible
schema negatives, clean v19/queue/flow/subagent/session controls, and synthetic
typed-tool plus bracket-token matrix are green. The trusted launcher positive
and its launcher-owned cleanup/retention siblings remain unverified on this
lane. Therefore the complete focused serial gate is deterministically red, not
a green receipt.

## History, provenance, and protected surfaces

- Implementation `2a219003d4a75bc2650dd72bbeb43274686e85b5`
  has exact parent `16f8bca6593813adb25e864c91d38f456b1708c0`
  and exact tree `11019042a7e2cfefc747a82fb82e036d3bda2d5c`.
- Its five changed files are exactly:
  `tools/k6-proofs/docs/RETURN-COVENANT-AUTHORITY-HARNESS.md`,
  `tools/k6-proofs/lib/return-covenant-retention-inspector.mjs`,
  `tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs`,
  `tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs`,
  and
  `tools/k6-proofs/tests/fixtures/return-covenant-authority/mock-product-driver.mjs`.
- Report successor `faf2125eb486c28d0b19904c8bcad03640ce0f76`
  has exact parent `2a219003` and changes only `output.md`.
- Both authored commits contain real paragraph newlines, contain no literal
  backslash-`n` paragraph escapes, and parse the exact trailer
  `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
- The candidate implementation branch/savegame, report branch/savegame,
  accepted parent/review, blocked corpus branch/savegame, product authority
  savegame, and docs main remained at the exact SHAs in the named-reference
  table when rechecked after evidence.
- Candidate and report diffs change no `PROOFS/**` byte. This review lane
  changes only `output.md`. No product, proof corpus, docs main, presentation,
  component, bootstrap, fleet, or product-driver ref was pushed or edited.
- No pull request, issue mutation, live proof, deployment, presentation update,
  or corpus fold was performed.
