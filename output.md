# READY_FOR_SCRIBE_REVIEW

Issue: `openclaw/openclaw#129388`

## Implementation identity

- Lane: `codeagent/129388-harness-global-schema-v15-currency-20260830`
- Implementation commit: `2a219003d4a75bc2650dd72bbeb43274686e85b5`
- Tree: `11019042a7e2cfefc747a82fb82e036d3bda2d5c`
- Parent: `16f8bca6593813adb25e864c91d38f456b1708c0`
- Changed committed files: 5
- Implementation savegame: `savegame/129388-harness-global-schema-v15-currency-20260830T195326Z`
- The final report-only successor changes this `output.md`; its exact identity and final savegame are recorded by the completion dispatch because a commit cannot contain its own SHA.
- Parsed trailer: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`

## Named refs

| Surface | Ref | Full SHA / disposition |
|---|---|---|
| Product/base | `karmaterminal/openclaw@0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | Exact local object and server commit authority |
| Safe lane | `codeagent/129388-harness-global-schema-v15-currency-20260830` | Implementation byte `2a219003d4a75bc2650dd72bbeb43274686e85b5`; final report successor resolved in completion dispatch |
| CI/workflow | N/A | Focused-only acceptance; no Mode-B dispatch |
| Presentation | N/A | Protected presentation, docs main, and fleet untouched |
| Docs/proof | accepted base `16f8bca6593813adb25e864c91d38f456b1708c0`; accepted review `6995218335b0fb9205de1e6c03b48acc88418d53`; blocked corpus `ba8d344c1240275a9c54042294b8129eea4e497b` | Exact objects retained unchanged |

## Product schema walk

- v13 (`1ea2640f5428eacb70e182137e9501fbdfd8cbca`) consolidated cron and subagent rows into canonical JSON and removed unused projections.
- v14 (`036e0d9bf714ebec3b022760d96813b6ffd5ecbe`) added no physical table, column, or index change. Its migration updates historical human `cron_jobs.job_json` creators with `createdActor.source="unknown"` rather than guessing a profile/channel namespace.
- v15 (`3506cf9d1a6735a03631000c7237c05ebe2ba83f`, contained by authority `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3`) removes `target_agent_id` and `target_session_id` from `current_conversation_bindings`. It rebuilds `idx_current_conversation_bindings_target` as `(target_session_key, updated_at DESC, binding_key)`. Conversation-binding reads/writes use `target_session_key` and canonical `record_json`; no removed projection is optional or defaulted.
- Exact authority remains global schema 15 and per-agent schema 19. Any later production-store delta is a review blocker, not an implicitly accepted schema.

## Observer changes

- Product-store binding advanced from `0109521b0c2b8a2c81c9f901789a81c5316074a7` to exact authority `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3`.
- Global integrity now requires both `PRAGMA user_version=15` and the `schema_meta.primary` global owner marker at version 15.
- Global exact inventory includes `schema_meta`, `agent_databases`, `delivery_queue_entries`, `subagent_runs`, `flow_runs`, and v15 `current_conversation_bindings`.
- Every explicit product index on the observed global tables is checked for exact name, uniqueness, partial predicate, ordered columns, and sort direction.
- The independently owned v19 `session_nodes` and `session_windows` layouts and all their product indexes are checked without changing retention semantics.
- Existing canonical reads for subagent payloads, flow state, delivery queue ownership, session nodes/windows, tombstones, cleanup, process freeze, registry paths, no-follow identity, WAL/SHM snapshots, and signed FAIL behavior remain intact.
- Candidate resource responses and cleanup claims remain diagnostic only; docs-owned durable reads remain verdict authority.

## Deterministic controls

The rejected accepted harness failed the fresh v15 fixture at the owning durable-store boundary with `retention snapshot has unexpected schema version 15`. The successor passes that same fresh v15 fixture.

Fail-closed controls cover global v13, v14, future v16, `user_version`/metadata disagreement, wrong owner metadata, removed v15 projection resurrection, required v15 projection absence, mutated v15 target-index order, missing/renamed/view-substituted tables, malformed lifecycle/JSON, noncanonical registry/path, symlink/path replacement, WAL mutation, runtime identity drift, teardown overlap, and signed diagnostic/observation failure. Existing v19 owner, registry, tombstone, restart, recovery, partial-failure, cleanup, and non-interference controls remain green.

Positive controls cover a clean exact v15 global store, exact v19 per-agent store, WAL-only retained rows, canonical queue/flow/subagent/session retention, terminal siblings, cleanup, signed receipt validation, and the complete typed-tool plus bracket-token launcher matrix.

## Focused validation

```text
node --test --test-concurrency=1 tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
```

Result: 128 tests passed, 0 failed, serial duration `454115.445201 ms`.

Acceptance path: `focused-only`. No Mode-B, Gate 3g, live product proof, presentation update, corpus fold, or fleet action was performed.

The product-driver blocker lane `129388-product-owned-covenant-fixture-driver-20260830` may resume unchanged against this docs-harness successor. Product work was not dispatched or resumed here.
