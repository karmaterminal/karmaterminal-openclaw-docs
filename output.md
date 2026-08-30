# Independent exact physical-schema harness review

Status: `REQUEST_CHANGES`.

Issue binding: `openclaw/openclaw#129388`.

The product-driver lane may **not** resume against
`d4deb21faa2e02076709e0c728308668924c9da4`.

## Named-reference contract

This table was written before any independent replay or focused-suite evidence
was credited. The unchanged safe review lane was published to `origin` at cure
implementation `d4deb21faa2e02076709e0c728308668924c9da4` first.

| Category | Named reference | Local SHA | Tracking SHA | Server SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw:codeagent/129388-product-owned-covenant-fixture-driver-20260830` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | local object/tracking/server equal |
| Safe lane ref | `codeagent/129388-d4deb21f-physical-schema-independent-review-20260830` | `d4deb21faa2e02076709e0c728308668924c9da4` | `d4deb21faa2e02076709e0c728308668924c9da4` | `d4deb21faa2e02076709e0c728308668924c9da4` | local/tracking/server equal before evidence |
| CI/workflow ref | N/A | N/A | N/A | N/A | Review-only docs harness uses the workorder's focused-only acceptance path; Mode-B and Gate 3g do not apply. |
| Presentation ref | N/A | N/A | N/A | N/A | Protected presentation and fleet are read-only and no named presentation ref applies. |
| Docs/proof cure branch | `codeagent/129388-harness-exact-physical-schema-cure-20260830` | `a41b3dfb800b764cd4efb8800c48e957de29232c` | `a41b3dfb800b764cd4efb8800c48e957de29232c` | `a41b3dfb800b764cd4efb8800c48e957de29232c` | local/tracking/server equal |
| Docs/proof cure savegame | `savegame/129388-harness-exact-physical-schema-cure-20260830T20260830T211513Z` | `a41b3dfb800b764cd4efb8800c48e957de29232c` | `a41b3dfb800b764cd4efb8800c48e957de29232c` | `a41b3dfb800b764cd4efb8800c48e957de29232c` | local/tracking/server equal |
| Docs/proof WIP salvage | `savegame/129388-harness-exact-physical-schema-cure-8edd8005-pre-amend-20260830T2102Z` | `8edd8005ac78a83dc57ab006fd791ef1a8dc53d3` | `8edd8005ac78a83dc57ab006fd791ef1a8dc53d3` | `8edd8005ac78a83dc57ab006fd791ef1a8dc53d3` | local/tracking/server equal |
| Docs/proof rejected implementation | `savegame/129388-harness-global-schema-v15-currency-20260830T195326Z` | `2a219003d4a75bc2650dd72bbeb43274686e85b5` | `2a219003d4a75bc2650dd72bbeb43274686e85b5` | `2a219003d4a75bc2650dd72bbeb43274686e85b5` | local/tracking/server equal |
| Docs/proof rejected review | `codeagent/129388-2a219003-harness-v15-independent-review-20260830` | `b952a02ceca205945f63d8a785924c2613fdf2b6` | `b952a02ceca205945f63d8a785924c2613fdf2b6` | `b952a02ceca205945f63d8a785924c2613fdf2b6` | local/tracking/server equal |
| Docs/proof accepted ancestor | `codeagent/129388-proof-store-generic-terminal-marker-fix-20260829` | `16f8bca6593813adb25e864c91d38f456b1708c0` | `16f8bca6593813adb25e864c91d38f456b1708c0` | `16f8bca6593813adb25e864c91d38f456b1708c0` | local/tracking/server equal |
| Docs main | `karmaterminal/karmaterminal-openclaw-docs:main` | `0984dabae218000b20178f4a031e688bdf0584ac` | `0984dabae218000b20178f4a031e688bdf0584ac` | `0984dabae218000b20178f4a031e688bdf0584ac` | local/tracking/server equal |

The final report commit cannot contain its own identity. Final review-branch and
immutable-savegame equality are gated after this report is frozen.

## Exact implementation identities

| Surface | Exact identity |
|---|---|
| Rejected implementation | `2a219003d4a75bc2650dd72bbeb43274686e85b5` |
| Rejected independent review | `b952a02ceca205945f63d8a785924c2613fdf2b6` |
| Cure implementation | `d4deb21faa2e02076709e0c728308668924c9da4` |
| Cure tree | `12b8e488bb5228fd54c7f5e68664903710a451f8` |
| Cure parent | `2a219003d4a75bc2650dd72bbeb43274686e85b5` |
| Cure report | `a41b3dfb800b764cd4efb8800c48e957de29232c` |
| Cure report tree | `1d745d286cf1e3dc67e93e13d21d86fe3e8c231b` |
| Pre-amend WIP fossil | `8edd8005ac78a83dc57ab006fd791ef1a8dc53d3` |
| Exact product authority | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` |

## Finding: SQL comments can counterfeit the semantic fingerprint

The owning boundary is `requireExactTable` in
`tools/k6-proofs/lib/return-covenant-retention-inspector.mjs:1230`. The exact
invariant is that the docs-owned store observer must derive constraints and
collations from SQL tokens that SQLite actually executes, not from text SQLite
ignores.

The candidate violates that invariant:

- `normalizeSqlFragment` at line 641 handles quoted strings and quoted
  identifiers but has no line-comment or block-comment state.
- `tableCheckFingerprint` at lines 865-869 searches raw clauses for `CHECK`.
  It therefore treats `/* CHECK (...) */` as an enforced constraint.
- `columnCollations` at lines 888-898 accepts the first raw-text `COLLATE`.
  It therefore trusts `/* COLLATE BINARY */` before an executed
  `COLLATE NOCASE`.

Two direct controls built fresh databases from the exact product SQL blobs and
called the candidate's exported `inspectReturnCovenantPhysicalSchema`:

| Mutation | Independent SQLite proof | Candidate result |
|---|---|---|
| Replace the enforced `session_nodes.status` CHECK with a block comment containing the same `CHECK (...)` text | Insert of `status='not-a-product-status'` succeeds; `sqlite_schema.sql` retains the comment | **Accepted** |
| Change `current_conversation_bindings.binding_id` to `/* COLLATE BINARY */ COLLATE NOCASE` | A stored `MixedCase` row matches `WHERE binding_id='mixedcase'`; `sqlite_schema.sql` retains both comment and executed `NOCASE` | **Accepted** |

These are physical-schema false accepts, not formatting disagreements. The first
removes write validation. The second changes comparison and index semantics.
Either is sufficient to reject exactness.

The same root cause produces false rejects:

| Semantically equivalent DDL | Candidate result |
|---|---|
| Add a harmless block comment inside the enforced `session_nodes.status` CHECK | Rejected as a CHECK mismatch |
| Add one redundant outer parenthesis around that CHECK expression | Rejected as a CHECK mismatch |
| Quote the `status` identifier and vary keyword case/whitespace | Accepted |

Quoted identifier escaping, single-quoted strings with doubled quote escapes,
nested balanced parentheses, backtick/bracket identifiers, and `IF NOT EXISTS`
have explicit parser branches. Single-quoted bytes are intentionally preserved.
Double-quoted string literals are not a supported equivalent on this reviewed
Node/SQLite build: SQLite rejects them as identifiers. The decisive gap is that
comments are not lexed at all, and redundant expression grouping is not
normalized.

Required successor coverage must place the two false accepts above at the real
exported inspector boundary and prove they reject. It should also define and
test the intended equivalence policy for comments and redundant parentheses.
This review-only lane did not alter candidate code or tests.

## Independently derived exact product schema

Both complete sources were read from product commit `0ed59cb6`, executed in
fresh SQLite databases, and inspected independently with `table_list`,
`table_xinfo`, `index_list`, `index_xinfo`, `foreign_key_list`, and
`sqlite_schema`. The resulting independent inventory artifact has SHA-256
`df4e2b9ed2f2198747d4d65dc7f64c2ea7780e56463e6b258fa023b676e0a199`.

The independently verified source hashes match the candidate:

- `src/state/openclaw-state-schema.sql`:
  `95b7bb4a438b5a60010e27249ef504be3143a474bf938c7d417dceaaacf66564`
- `src/state/openclaw-agent-schema.sql`:
  `27078c3f4cee45bfec3066790c34098b1c625b03c3804dc09f051c5e8af6ddeb`

Every observed object below is a real `STRICT` table, uses rowids, has no
generated/hidden columns, and has `BINARY` column and index-key collations in
the exact product source. Every primary-key autoindex has origin `pk`, is unique
and non-partial, and includes SQLite's trailing `cid=-1`, `key=0` auxiliary row.
All named indexes have origin `c` and are non-unique.

### Global v15

`schema_meta.primary` must be `(role='global', schema_version=15,
agent_id=NULL)` and independent `PRAGMA user_version` must be `15`.

| Table | Ordered `table_xinfo` columns | Defaults / PK |
|---|---|---|
| `schema_meta` | `meta_key, role, schema_version, agent_id, app_version, created_at, updated_at` | PK `meta_key`; nullable `agent_id, app_version` |
| `agent_databases` | `agent_id, path, schema_version, last_seen_at, size_bytes` | PK `(agent_id, path)`; nullable `size_bytes` |
| `current_conversation_bindings` | `binding_key, binding_id, target_session_key, channel, account_id, conversation_kind, parent_conversation_id, conversation_id, target_kind, status, bound_at, expires_at, metadata_json, record_json, updated_at` | PK `binding_key`; nullable `parent_conversation_id, expires_at, metadata_json` |
| `delivery_queue_entries` | `queue_name, id, status, entry_kind, session_key, channel, target, account_id, retry_count, last_attempt_at, last_error, recovery_state, platform_send_started_at, entry_json, enqueued_at, updated_at, failed_at` | PK `(queue_name, id)`; `retry_count DEFAULT 0` |
| `subagent_runs` | `run_id, child_session_key, controller_session_key, requester_session_key, created_at, payload_json` | PK `run_id`; `payload_json DEFAULT '{}'`; nullable `controller_session_key` |
| `flow_runs` | `flow_id, shape, sync_mode, owner_key, chain_id, requester_origin_json, controller_id, revision, status, notify_policy, goal, current_step, blocked_task_id, blocked_summary, state_json, wait_json, cancel_requested_at, created_at, updated_at, ended_at` | PK `flow_id`; `sync_mode DEFAULT 'managed'`; `revision DEFAULT 0` |

Global named indexes and ordered keys:

- bindings: target `(target_session_key, updated_at DESC, binding_key)`,
  conversation `(channel, account_id, conversation_kind, conversation_id)`,
  and expiry `(expires_at, binding_key)`;
- delivery: pending `(queue_name, status, enqueued_at, id)`, failed
  `(queue_name, status, failed_at, id)`, session
  `(queue_name, status, session_key, enqueued_at, id) WHERE session_key IS NOT
  NULL`, and target `(queue_name, status, channel, target, enqueued_at, id)
  WHERE channel IS NOT NULL AND target IS NOT NULL`;
- subagents: child, requester, and controller session-key indexes, each followed
  by `created_at DESC, run_id`;
- flows: separate `status`, `owner_key`, and `updated_at` indexes.

The six observed global tables have no CHECKs, foreign keys, generated columns,
or table-owned triggers.

### Per-agent v19

`schema_meta.primary` must be `(role='agent', schema_version=19,
agent_id=<registry owner>)` and independent `PRAGMA user_version` must be `19`.

| Table | Ordered `table_xinfo` columns | Defaults / PK |
|---|---|---|
| `schema_meta` | Same seven-column layout as global | PK `meta_key` |
| `session_nodes` | `session_key, current_session_id, entry_json, entry_valid, updated_at, status, created_at, created_via, created_actor_type, created_actor_id, owner_actor_type, owner_actor_id, owner_assigned_by_type, owner_assigned_by_id, owner_assigned_at, project_id, parent_session_key, spawned_by, fork_source_session_key, fork_source_session_id, fork_source_entry_id, label, display_name, category, icon, pinned_at, archived_at, last_read_at, last_interaction_at, last_activity_at` | PK `session_key`; `entry_valid DEFAULT 0`; columns after `updated_at` are nullable |
| `session_windows` | `session_id, session_key, previous_session_id, reason, session_scope, created_at, updated_at, transcript_updated_at, transcript_observed_at, session_entry_provenance, acp_owned, plugin_owner_id, hook_external_content_source, started_at, ended_at, status, chat_type, channel, account_id, primary_conversation_id, model_provider, model, agent_harness_id, parent_session_key, spawned_by, display_name` | PK `session_id`; defaults: `session_scope='conversation'`, both transcript timestamps `NULL`, provenance `0`, ACP-owned `0` |

`session_nodes` has eight named indexes: updated and last-interaction descending
indexes; parent, spawned-by, and current-session indexes; partial status and
archived indexes; and partial `entry_valid = 0`. It has four CHECKs:
`entry_valid` in `-1,0,1`, status enumeration, created-via enumeration, and
created-actor-type enumeration.

`session_windows` has four named indexes: updated, session-key, created, and
partial conversation (`primary_conversation_id IS NOT NULL`). Its seven CHECKs
cover reason, scope, provenance, ACP ownership, external-content source, status,
and chat type. Its two foreign keys are:

- `session_key -> session_nodes.session_key`, `ON UPDATE NO ACTION`,
  `ON DELETE CASCADE`, `MATCH NONE`;
- `primary_conversation_id -> conversations.conversation_id`,
  `ON UPDATE NO ACTION`, `ON DELETE SET NULL`, `MATCH NONE`.

`session_nodes` owns exactly three triggers. After insert, entry JSON update, or
current-session/updated-at identity update, the trigger sets `entry_valid=0`
for `NEW.session_key`. `schema_meta` and `session_windows` own no triggers.

The candidate constants match this independently derived inventory. Complete
source hashes plus the fresh-database drift control bind later changes to an
explicit authority/hash update rather than allowing silent source drift. That
binding does not cure the comment-spoofed fingerprints above.

## Deterministic rejected and cure replay

The rejected replay used the exact `d4deb21f` test byte with only the inspector
restored from `2a219003`; the new named export was removed from the disposable
test import because the rejected module predates that export. The target test
then ran unchanged.

| Required control | Rejected `2a219003` | Cure `d4deb21f` |
|---|---|---|
| Hidden virtual `target_agent_id` | Wrongly `observed` | Rejected by `table_xinfo` |
| Table-owned `UNIQUE(binding_id)` | Wrongly `observed` | Rejected by full index inventory |
| Removed representative CHECK | Wrongly `observed` | Rejected by CHECK inventory |
| Removed representative foreign key | Wrongly `observed` | Rejected by FK inventory |

The complete rejected direct-store matrix was intentionally red: `44/66` pass,
`22/66` fail, zero skips, `22132.7951ms`. The cure's fresh-source and complete
direct-store matrix passed `67/67`, zero skips, `30548.193254ms`. It covers
hidden virtual/stored columns, defaults, ordinary and index collations,
composite PK, partial predicates, widened/narrowed/removed/added CHECKs,
retargeted/action-mutated/removed/added FKs, removed/added triggers,
non-STRICT, views, renamed/missing tables, versions, metadata, WAL mutation,
no-follow/path swaps, and queue/flow/subagent/binding/session retention.

The cure matrix does **not** include comments that counterfeit parsed schema
facts, which explains why it remains green despite the finding.

## Complete focused receipt

Acceptance path: `focused-only`. No Mode-B run and no Gate 3g fallback were
used or claimed.

```bash
OPENCLAW_PRODUCT_AUTHORITY_REPO=/home/figs/flesh_beast_best_beast/source/openclaw \
OPENCLAW_REQUIRE_PRODUCT_SCHEMA_DRIFT_CONTROL=1 \
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
```

Receipt: `149/149` pass, `0` fail, `0` skipped,
`469399.171713ms`.

Reviewed prerequisites:

- host `aarch64`;
- Node `v25.9.0`;
- k6 path `/home/figs/bin/k6`;
- k6 version
  `k6 v2.0.0 (commit/8c3be52cc1, go1.26.3, linux/arm64)`;
- k6 SHA-256
  `6fcd167ac6525e444bb710a2cb98dbe200ef12a6e0a4e9f83d062a4acabc1e70`,
  equal to `tools/k6-proofs/k6-proof-binaries.json` entry `linux-arm64`;
- Python `jsonschema` `4.10.3`.

The receipt includes fresh exact global v15 and per-agent v19 stores;
typed-tool and bracket-token matrices; queue, flow, subagent, binding, and
session retention; WAL-only rows; no-follow and path-swap controls; process
freeze, resume, shutdown, and final snapshots; cleanup; candidate diagnostic
failures; and signed PASS/FAIL behavior. A green suite is not acceptance when a
deterministic missing negative demonstrates a false accept.

## Authority audit

The cure preserves the existing authority composition:

- exact v15/v19 `schema_meta` owner/version and independent `user_version`
  refusal occur inside the same read transaction as the table fingerprints;
- registry owner, canonical relative path, directory count, path/device/inode,
  opened-file identity, and WAL/SHM snapshots remain docs-owned and no-follow;
- the launcher binds driver and gateway PID/start identity plus loopback socket,
  freezes the entire process group before the live snapshot, proves every member
  stably stopped, re-samples identity, then resumes;
- shutdown settlement precedes a second final snapshot, and live/final resource
  sets must be stable;
- docs-owned durable-store reads remain resource-verdict authority; gateway
  responses and candidate cleanup claims remain diagnostic only;
- observation, source, cleanup, process, and candidate-diagnostic failures add
  failure categories and produce signed `FAIL-candidate`, never success-shaped
  fallback;
- teardown removes the run root, verifies process/case-handle closure, and
  signs the cleanup record;
- `RETURN_COVENANT_PRODUCT_STORE_CONTRACT_SHA` remains exactly
  `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3`.

Those boundaries are sound, but they consume the physical-schema predicate.
A counterfeitable predicate therefore prevents authority acceptance.

## History and provenance

The malformed pre-amend WIP and cured commit have the same tree
`12b8e488bb5228fd54c7f5e68664903710a451f8` and same parent `2a219003`; only
commit metadata differs. WIP `8edd8005` contains literal `\n` sequences in its
body. Cure `d4deb21f` has real paragraph newlines, and
`git interpret-trailers --parse` recognizes:

`Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.

Report `a41b3dfb` is the direct child of `d4deb21f`, changes only `output.md`,
has real paragraph newlines, and has the same parsed Copilot trailer. Cure
branch and final cure savegame both resolve locally, in tracking refs, and on
the server to `a41b3dfb`. The salvaged immutable ref resolves in all three
places to exact WIP `8edd8005`.

The implementation/report history is additive from `d4deb21f`. Ancestry and
path diffs show no rewrite or edit to accepted ancestor `16f8bca6`, rejected
parent `2a219003`, docs main, product, presentation, fleet, components,
bootstrap, or `PROOFS/**`. The original amend/force-replacement before salvage
remains a historical discipline violation; salvage preserves the old object
but does not erase that event.

Review-lane publication note: report commit
`adb505b580104c107bf025c86cf11f6ecedfb71a` was pushed with literal `\n`
separators in its commit body, so its Copilot line does not parse as a trailer.
It remains preserved; this additive successor changes only this disclosure and
uses real paragraph newlines and a parsed trailer. No ref was rewritten.

## Verdict

`REQUEST_CHANGES`.

No: the product-driver lane may not resume against `d4deb21f`. The cure closes
the rejected implementation's visible-column, unique-index, CHECK, FK,
trigger, and related physical-shape gaps, but its raw SQL parser still lets
comments counterfeit enforced CHECKs and collations. The successor must reject
those deterministic controls at the real physical-schema composition boundary
before exactness can be confirmed.
