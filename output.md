# Retention-authority product-store alignment

**Verdict: `READY_FOR_SCRIBE_REVIEW`.** This is a docs-harness readiness
verdict only. No exact-head product proof, live proof, corpus fold, or proof
verdict upgrade is claimed.

Issue binding: `openclaw/openclaw#129388`.

## Named-reference contract

Every applicable ref was resolved before evidence was credited. The safe lane
was published unchanged at its base and again at each implementation checkpoint.

| Category | Named reference | Local SHA | Tracking SHA | Server SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw:scribe/129388-covenant-upstream-absorb-20260828` | `0109521b0c2b8a2c81c9f901789a81c5316074a7` | `0109521b0c2b8a2c81c9f901789a81c5316074a7` | `0109521b0c2b8a2c81c9f901789a81c5316074a7` | equal |
| Product staged-successor input | `karmaterminal/openclaw@93f7152b098beeb9ac64cb9b2437fc45a7558adf` | `93f7152b098beeb9ac64cb9b2437fc45a7558adf` | N/A - commit pin | `93f7152b098beeb9ac64cb9b2437fc45a7558adf` | local/server equal; unpublished merge excluded from evidence |
| Safe lane reviewed implementation | `codeagent/129388-retention-authority-product-store-alignment-20260829` | `c428de5585d09537aecc2dbf93483dec0998ba99` | `c428de5585d09537aecc2dbf93483dec0998ba99` | `c428de5585d09537aecc2dbf93483dec0998ba99` | equal |
| Final report-only successor | This `output.md` handoff | N/A | N/A | Recorded by the final COMPLETE receipt | Cannot contain its own commit SHA |
| CI/workflow ref | N/A - workorder forbids Mode-B and live product proof | N/A | N/A | N/A | N/A |
| Presentation ref | N/A - presentation, corpus, and live proof are out of scope | N/A | N/A | N/A | N/A |
| Docs/proof base/report | `karmaterminal-openclaw-docs@094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49` | `094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49` | `094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49` | `094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49` | equal |
| Reviewed/rejected implementation | `karmaterminal-openclaw-docs@281552c039dcf45f7fdc3a7960448f0e989ea801` | `281552c039dcf45f7fdc3a7960448f0e989ea801` | N/A - commit pin | `281552c039dcf45f7fdc3a7960448f0e989ea801` | local/server equal |
| Rejected parent harness | `codeagent/129388-covenant-authority-proof-harness-20260828` | `78927a643e8b5894a389691e695c1eb6bd7d2b4b` | `78927a643e8b5894a389691e695c1eb6bd7d2b4b` | `78927a643e8b5894a389691e695c1eb6bd7d2b4b` | equal |
| Independent review | `codeagent/129388-retention-authority-independent-review-20260829` | `91aaf5b961f107e281c702274f83eab848f971bc` | `91aaf5b961f107e281c702274f83eab848f971bc` | `91aaf5b961f107e281c702274f83eab848f971bc` | equal |

The final independent review resolved
`c428de5585d09537aecc2dbf93483dec0998ba99` identically at local `HEAD`,
tracking, and server, then returned `VERDICT: CONFIRMED`.

## Product ownership read

The ownership walk used Git object reads at the exact product floor; it did not
enter or mutate the staged-successor worktree.

| Product owner | SHA-256 at `0109521b…` | Authority used |
|---|---|---|
| `src/state/openclaw-state-schema.sql` | `b8c026d6c1e7f53e28b216450a68d13743833adc7f9a1bf48206d3e2455e8037` | v13 `flow_runs`, `subagent_runs`, `delivery_queue_entries`, `agent_databases`, and global `schema_meta` |
| `src/agents/subagents/registry/subagent-registry.store.sqlite.ts` | `251c0c240ae7265b915149bdda0032429afcf60d7969f784aa638e3dd19e31db` | canonical `payload_json` decoder and indexed identity overrides |
| `src/infra/session-delivery-queue-storage.ts` | `7c2dfad3fa6d1694a1eb2d2c2d42499b757e274926daf1f50b00cdca84781826` | session queue namespace, unfinished settlement, and attempt ownership |
| `src/tasks/task-flow-registry.store.sqlite.ts` | `1ebd7291328fd73bccd66f605aeacc8eeb5c5903c199020e39c8b71013ac0a8a` | TaskFlow status and owner/controller projection |
| `src/state/openclaw-agent-schema.sql` | `b3b7daf7453e741d1309ea9b7532d85e004e5f1c55188784de4fef5cf9707592` | v19 canonical `session_nodes.entry_json` and retained `session_windows` |
| `src/state/openclaw-agent-db.paths.ts` | `3ef1af6e72680821b8f4217a2a57d2077ee2c44edec2385a2c18b6c98b482ced` | `agents/<agent>/agent/openclaw-agent.sqlite` |

The walk also covered the v13 wide-row migration, v19 session-node migration,
agent database registry/listing, continuation work/delegate codecs, generic
delivery queue writer/terminalizer, session entry decoder, subagent cleanup,
and required-final-delivery retention predicate.

## Implemented authority

- `subagent_runs` is decoded from canonical `payload_json`. Execution,
  cleanup-completion, required-final-delivery, suspended delivery, recovery,
  requester-wake, kill, steer, and collector obligations retain a delegate.
  Unknown or malformed lifecycle/delivery state fails closed.
- `flow_runs` uses exact product TaskFlow status and controller semantics.
  `core/continuation-work` honors the exact durable `succeeded` marker;
  continuation delegate and post-compaction rows retain only recoverable
  queued/running ownership. Unknown status, sync mode, or known-controller JSON
  fails closed.
- `delivery_queue_entries` treats `pending` and failed
  `settlement_pending` rows as unfinished, preserves producer/platform/session
  attempt ownership, accepts product writer-owned metadata such as
  `outbound-media-stage`, and excludes canonical completed/failed tombstones.
- Per-agent inventory comes from the global `agent_databases` registry and must
  match the canonical directory layout and v19 owner metadata. The inspector
  reads `session_nodes.entry_json`; every spawned child in the fresh isolated
  state is temporary even after all run/flow/queue rows retire. Root and
  UI-only `parentSessionKey` rows are excluded. The product's
  `entry_json={}`, `entry_valid=-1`, matching-`session_windows` tombstone is
  accepted and ignored; all other invalid rows fail closed.
- The candidate HTTP resource inspection is diagnostic only. Current product
  has no such endpoint, so a missing, redirected, malformed, or forged response
  can neither grant nor veto PASS. Canonical launcher snapshots are the sole
  resource-retention authority.

## Stable observation and temporal binding

For the live leg, the launcher independently resolves the final gateway, checks
driver and gateway PID/start/socket ownership, stops the complete detached
process group, and waits for two identical all-stopped membership samples. It
then opens the state root, canonical directories, each database, and every
present `-wal`/`-shm` sidecar with `O_NOFOLLOW`; binds device, inode, mode, size,
and mtime; copies bytes from those open handles into a disjoint launcher-owned
directory; revalidates source paths and handles; and queries only the copied
databases. WAL-only rows are therefore visible. The same driver/gateway/socket
and stopped member set must match after the snapshot before `SIGCONT`.

The live observation completes before the process group resumes, so k6 teardown
cannot overlap it. Teardown now records start and completion timestamps. The
final snapshot begins only after two consecutive empty-group samples and dead
driver/gateway identities. Receipt validation independently binds:

```text
evidence end
  <= live snapshot
  <= teardown start <= teardown completion
  <= shutdown settlement
  <= final snapshot
```

Any snapshot, schema, source-identity, process-identity, or temporal failure is
projected as signed `unverified-resource-retention`; the failure projection no
longer throws when `sourceBinding` is null. Both live and final resource sets
must be byte-equivalent.

## Regression map

| Invariant and owning boundary | Pre-fix negative | Successor and nearest sibling/recovery coverage |
|---|---|---|
| Product `payload_json` is the subagent authority | `281552c0` rejects a clean product-shaped store because it requires invented flat columns | Running row retained; clean terminal row excluded; required `in_progress` final delivery retained; malformed execution/delivery/payload fails closed |
| Durable delivery queue is part of queue retention | `281552c0` never reads `delivery_queue_entries` | Pending and failed `settlement_pending` retained; completed and ordinary failed siblings excluded; producer/media metadata and terminal diagnostics accepted |
| Canonical per-agent sessions use `session_nodes.entry_json` | `281552c0` requires `agents/*/sessions/sessions.json` | Spawned child retained; root and UI-parent siblings excluded; orphaned spawned child detected without ledger residue; retained-window tombstone accepted only with its matching window |
| Required tables are real exact-shape product tables | `281552c0` accepts its invented schema and cannot pass the product schema | Missing table, renamed column, global view, agent view, wrong owner/version/layout all fail closed |
| SQLite observation binds opened identities | `281552c0` preflights then reopens a pathname | Symlink and deterministic post-open pathname swap fail closed; every opened file and directory is revalidated |
| WAL participates in authority | `281552c0` opens only the main pathname | A row absent from a main-file-only copy but present in WAL is observed by the trusted snapshot |
| Live process identity is stable across observation | `281552c0` samples only before the read | Driver and final gateway PID/start/socket plus stopped group members are identical before/after; mutation fails |
| Teardown cannot overlap live observation | `281552c0` awaits the live promise only after sandbox exit | Group remains stopped until observation completion; receipt rejects teardown starting before live completion |
| Final observation follows settled shutdown | `281552c0` has no bounded empty-group settlement receipt | Two empty-group/dead-PID samples precede the final snapshot |
| Open case handles cannot be hidden by candidate cleanup | Prior controls covered only missing/duplicate ledger rows | Explicitly open ledger entry yields `phase-chain-mismatch`; candidate `allCaseHandlesClosed` remains diagnostic only |
| Clean exact product-shaped stores can pass | `281552c0` product-shape run exits nonzero; clean case fails with `subagent_runs does not expose the canonical retention columns` | Clean v13/v19 stores, absent candidate endpoint, WAL snapshot, live/final ordering, and bounded shutdown yield `PASS-candidate` |

The original parent `78927a643e8b5894a389691e695c1eb6bd7d2b4b`
fails the transplanted control immediately because it has no retention
inspector. The reviewed implementation
`281552c039dcf45f7fdc3a7960448f0e989ea801` runs the transplanted final
product-shape suite but fails 20/30 controls, including the clean-store control,
for its flat-column assumption. The successor runs the same product-shape
control successfully.

## Validation

Acceptance path: **focused-only**, as required by this workorder. Mode-B, Gate
3g, live product execution, and whole-repository product tests were not run.

```bash
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
# repetition 1: 104/104 pass
# repetition 2: 104/104 pass

node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/current-corpus-active-scope.test.mjs
# 2/2 pass

node tools/k6-proofs/scripts/validate-corpus.mjs --current
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
# pass: 37 current rows, 42 manifests, 35 scenarios, 13 telemetry contracts

node --check <each of the eight changed JavaScript/MJS files>
# pass

# JSON.parse all six return-covenant JSON schemas
# pass

git diff --check 094ae88f9c3c3e0b2ad9caf64fbb87246c8c1d49..c428de5585d09537aecc2dbf93483dec0998ba99
# pass
```

Independent final review at exact pushed implementation
`c428de5585d09537aecc2dbf93483dec0998ba99` re-read product ownership at
`0109521b0c2b8a2c81c9f901789a81c5316074a7`, exercised the edge cases, and
returned `VERDICT: CONFIRMED`.

## Non-interference and remaining boundary

- `PROOFS/**` is byte-identical to the docs base:
  tree `8692ee960b3455d3e7a3d0b638c2d38d75497946`.
- `PROOFS/INDEX.json` is byte-identical to the docs base:
  blob `3c719b950f8fd01ff4d4a018b9c15feee47df584`.
- No product file, live runtime, workflow, presentation, PR, or corpus verdict
  was modified.
- The product-owned behavioral fixture command remains missing. Until a reviewed
  exact product successor supplies that fixture, the plan must remain
  `driver.fixtureCommand.status=missing-product-seam`; this lane makes no
  exact-head proof claim.
