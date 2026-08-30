# Exact physical-schema covenant observer cure

Status: `READY_FOR_SCRIBE_REVIEW`.

Issue binding: `openclaw/openclaw#129388`.

## Named-reference contract

This table was established before evidence. The unchanged lane was published at
rejected implementation `2a219003d4a75bc2650dd72bbeb43274686e85b5`
before the successor was written.

| Category | Named reference | Resolved SHA | Equality |
|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw@0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | Exact local immutable product object; both complete schema-source blobs were read from this commit. |
| Safe lane ref | `codeagent/129388-harness-exact-physical-schema-cure-20260830` | implementation `d4deb21faa2e02076709e0c728308668924c9da4` | Local/tracking/server equal after the implementation checkpoint. |
| CI/workflow ref | N/A | N/A | Focused-only docs-harness acceptance; no Mode-B or Gate 3g run applies. |
| Presentation ref | N/A | N/A | Protected presentation and fleet remained read-only. |
| Docs/proof ref | rejected implementation `2a219003d4a75bc2650dd72bbeb43274686e85b5`; rejected report `faf2125eb486c28d0b19904c8bcad03640ce0f76`; independent review `b952a02ceca205945f63d8a785924c2613fdf2b6`; accepted ancestor `16f8bca6593813adb25e864c91d38f456b1708c0`; blocked corpus `ba8d344c1240275a9c54042294b8129eea4e497b` | Exact listed objects | Additive successor only; protected corpus and prior history were not edited. |
| Docs main | `karmaterminal/karmaterminal-openclaw-docs:main` | `0984dabae218000b20178f4a031e688bdf0584ac` | Local tracking/server equal. |

The report commit cannot contain its own identity. Final branch and immutable
savegame equality are gated after this file is committed.

## Implementation identity and scope

Implementation:

- head `d4deb21faa2e02076709e0c728308668924c9da4`
- tree `12b8e488bb5228fd54c7f5e68664903710a451f8`
- parent `2a219003d4a75bc2650dd72bbeb43274686e85b5`
- five changed files:
  - `tools/k6-proofs/docs/RETURN-COVENANT-AUTHORITY-HARNESS.md`
  - `tools/k6-proofs/lib/return-covenant-retention-inspector.mjs`
  - `tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs`
  - `tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs`
  - `tools/k6-proofs/tests/fixtures/return-covenant-authority/mock-product-driver.mjs`

The commit uses real paragraph newlines and parses:

`Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.

No product, product-driver, bootstrap, presentation, fleet, component, docs
main, or `PROOFS/**` byte changed.

## Structured physical contract

The owning boundary remains the docs-owned
`requireExactTable`/`requirePhysicalSchema` durable-snapshot composition inside
`return-covenant-retention-inspector.mjs`. It now compares one structured
semantic fingerprint for every observed global-v15 and per-agent-v19 table:

- real SQLite table kind, `STRICT`, and no `WITHOUT ROWID`;
- complete ordered `PRAGMA table_xinfo`, including cid, hidden/generated class,
  type, nullability, normalized default, primary-key ordinal, and collation;
- complete `PRAGMA index_list` inventory with `c`, `u`, and `pk` origins,
  uniqueness, partial status, and every ordered key/auxiliary
  `PRAGMA index_xinfo` row with cid, name/expression marker, collation, sort
  direction, and key flag;
- normalized partial-index predicates;
- complete ordered `PRAGMA foreign_key_list` groups with source/target mapping,
  target table, update/delete action, and match behavior;
- quote- and nesting-aware normalized CHECK constraints;
- generated expressions plus virtual/stored mode;
- exact table-owned trigger inventory, including all three
  `session_nodes.entry_valid` maintenance triggers;
- exact `schema_meta.primary` ownership/version/agent tuple and independent
  `PRAGMA user_version`.

The parser ignores formatting, case, insignificant whitespace, `IF NOT EXISTS`,
and equivalent identifier quoting while preserving quoted string bytes. It
therefore accepts semantically identical fresh and supported migrated DDL
without raw SQL-text equality.

Expected facts are bound to exact product authority with full-source hashes:

- `src/state/openclaw-state-schema.sql`:
  `95b7bb4a438b5a60010e27249ef504be3143a474bf938c7d417dceaaacf66564`
- `src/state/openclaw-agent-schema.sql`:
  `27078c3f4cee45bfec3066790c34098b1c625b03c3804dc09f051c5e8af6ddeb`

The mandatory drift control reads both blobs from exact product commit
`0ed59cb6`, verifies both hashes, creates fresh full global and per-agent
databases, and applies the same physical predicate.

## Deterministic controls

The exact successor test byte was replayed with only the inspector replaced by
the exact rejected `2a219003` blob. The rejected observer returned `observed`
for each required bad schema:

| Required rejected-SHA negative | Rejected result | Successor result |
|---|---|---|
| hidden virtual `target_agent_id` resurrection | accepted | rejected by exact `table_xinfo` inventory |
| table-owned `UNIQUE(binding_id)` | accepted | rejected by complete index-origin inventory |
| removed representative per-agent CHECK | accepted | rejected by exact CHECK inventory |
| removed representative per-agent foreign key | accepted | rejected by exact FK inventory |

The rejected replay was intentionally red: `44/66` pass and `22/66` fail. The
four rows above each failed because actual status was `observed` instead of
`unverified-resource-retention`.

Successor mutation controls also reject hidden stored columns, altered defaults,
wrong column and index collations, unexpected composite primary-key shape,
changed partial predicates, removed/widened/narrowed/additional CHECKs,
removed/additional/retargeted/action-mutated foreign keys, missing/additional
triggers, non-STRICT tables, views, renamed/missing tables, and ordinary
missing/extra columns. Fresh exact product stores and quoted/case/whitespace
equivalent migrated DDL pass.

The same serial owner matrix preserves queue, flow, subagent, binding, and
session-retention behavior; tombstone and settled-terminal siblings; WAL-only
rows; WAL mutation, no-follow/path-swap, malformed state, and registry-layout
failure controls.

## Validation and prerequisites

Acceptance path: `focused-only`. No Mode-B run and no Gate 3g fallback were
used or claimed.

Complete command:

```bash
OPENCLAW_PRODUCT_AUTHORITY_REPO=/home/figs/flesh_beast_best_beast/source/openclaw \
OPENCLAW_REQUIRE_PRODUCT_SCHEMA_DRIFT_CONTROL=1 \
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
```

Receipt: `149/149` pass, `0` fail, `0` skipped,
`475189.677437ms`. It includes the complete launcher and signed-observer
surface: reviewed k6 launch, process freeze and shutdown, live/final snapshots,
WAL/SHM, no-follow/path swap, cleanup, candidate-cleanup diagnostics,
signed PASS/FAIL, typed-tool and bracket-token matrices, and protected registry
closure.

Prerequisites were satisfied through repository policy:

- host `aarch64`;
- Node `v25.9.0`;
- `/home/figs/bin/k6` reports
  `k6 v2.0.0 (commit/8c3be52cc1, go1.26.3, linux/arm64)`;
- k6 SHA-256
  `6fcd167ac6525e444bb710a2cb98dbe200ef12a6e0a4e9f83d062a4acabc1e70`
  exactly matches reviewed `tools/k6-proofs/k6-proof-binaries.json`
  `linux-arm64`;
- Python `jsonschema` `4.10.3`.

No GitNexus graph result was credited. The installed required fork is
`/home/figs/flesh_beast_best_beast/source/GitNexus`, commit
`3c1e686edfc1acaac882927cada121ddd7c47bcc`; exact Git-object and product-source
reads were the explicit fallback.

## Verdict

`READY_FOR_SCRIBE_REVIEW`.

The docs-owned observer now makes its exact global-v15/per-agent-v19
physical-schema predicate true while preserving all existing authority,
retention, isolation, cleanup, and signed-failure behavior. Product-driver work
remains blocked and was not resumed.
