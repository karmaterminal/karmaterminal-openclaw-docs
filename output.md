# Physical-schema SQL tokenizer cure

Status: `READY_FOR_SCRIBE_REVIEW`.

Issue binding: `openclaw/openclaw#129388`.

The docs-owned physical-schema inspector now derives every raw-DDL fact from
one comment-aware, fail-closed SQLite token stream. Product-driver remains
blocked pending independent review. No product, blocked corpus, presentation,
bootstrap, component, fleet, or protected docs-main bytes were edited.

## Named-reference contract

This table was written before regression or focused-suite evidence was
credited. The unchanged safe lane branch was published to `origin` at the
rejected implementation first.

| Category | Named reference | Local SHA | Tracking SHA | Server/object SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw` exact product authority | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | N/A (immutable product object) | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | local/server equal |
| Safe lane ref | `codeagent/129388-harness-sql-comment-tokenizer-cure-20260830` implementation anchor | `15e479424518b4831c95511873f5c6b81ad52a79` | `15e479424518b4831c95511873f5c6b81ad52a79` | `15e479424518b4831c95511873f5c6b81ad52a79` | local/tracking/server equal |
| CI/workflow ref | N/A | N/A | N/A | N/A | Focused-only harness acceptance; no Mode-B product run applies |
| Presentation ref | N/A | N/A | N/A | N/A | Protected presentation surfaces are read-only |
| Docs/proof ref | rejected physical-schema implementation | `d4deb21faa2e02076709e0c728308668924c9da4` | N/A (immutable ancestor) | `d4deb21faa2e02076709e0c728308668924c9da4` | local/server object equal |

The rejected report is
`a41b3dfb800b764cd4efb8800c48e957de29232c`; the independent
`REQUEST_CHANGES` review is
`6d69cdcfee96c5e59ae0bacded310f48c296c11a`; and its malformed report fossil is
`adb505b580104c107bf025c86cf11f6ecedfb71a`. The pre-amend implementation
fossil `8edd8005ac78a83dc57ab006fd791ef1a8dc53d3` remains equal locally, on its
tracking ref, and on the server at
`savegame/129388-harness-exact-physical-schema-cure-8edd8005-pre-amend-20260830T2102Z`.

The implementation anchor is also equal locally, on its tracking ref, and on
the server at immutable savegame
`savegame/129388-harness-sql-comment-tokenizer-cure-15e47942-20260830T223855Z`.

## Additive implementation

Implementation anchor:

- head `15e479424518b4831c95511873f5c6b81ad52a79`;
- tree `5b1ccbaed5f5bebb28459680db1c61cd6414a0cb`; and
- parent `04a0fe3cf4411b4bbc7a5759ceec44f79a047265`.

The additive implementation changes three files from rejected `d4deb21f`:

- `tools/k6-proofs/lib/return-covenant-retention-inspector.mjs`;
- `tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs`; and
- `tools/k6-proofs/docs/RETURN-COVENANT-AUTHORITY-HARNESS.md`.

The shared scanner emits ordinary, literal/blob, quoted-identifier, and
punctuation tokens. It:

- removes `--` and `/* ... */` comments only outside quoted states;
- preserves comment-like bytes and doubled quote/backtick escapes inside
  literals and identifiers;
- follows the reviewed SQLite build's bracket-closing behavior;
- keeps token boundaries across comments;
- tracks balanced parentheses; and
- rejects unterminated strings, quoted identifiers, block comments, and
  unbalanced parentheses.

CHECK extraction, COLLATE extraction, generated expressions, trigger
normalization, partial predicates, defaults, table clauses/modifiers, and all
future `normalizeSqlFragment` callers share that representation. CHECK
comparison strips only recursively balanced parentheses that enclose the
complete expression. It does not reorder expressions, fold constants,
simplify boolean logic, alter string bytes, or remove inner grouping.

## Regression completeness

The ownership boundary is exported
`inspectReturnCovenantPhysicalSchema`, composed through
`requirePhysicalSchema` / `requireExactTable`. Tests use real `DatabaseSync`
stores, real `sqlite_schema` text, PRAGMAs, WAL snapshots, and the exported
inspector rather than mocked parser results.

On test-only additive commit
`9dd514b79c28a471a69ef1f1f7024ae4cca60486` over rejected `d4deb21f`, the
complete durable-inspector parent produced 65 passing leaves and the expected
four failing leaves plus failing aggregate:

- a removed CHECK retained only in a block comment was falsely accepted;
- executed `COLLATE NOCASE` preceded by commented `COLLATE BINARY` was falsely
  accepted;
- a harmless block comment in an enforced CHECK was falsely rejected; and
- one redundant whole-expression CHECK parenthesis was falsely rejected.

The successor's durable-inspector matrix passes all 91 leaves plus its
aggregate. Added sibling/alternate controls cover line comments, comments
between tokens, default expressions, partial predicates, triggers, doubled
string quotes, doubled double-quote/backtick identifier escapes, bracket
identifiers, SQLite rejection of unsupported doubled bracket closing,
end-of-input line comments, all unterminated quoted/comment states, unbalanced
parentheses, and split keywords that must not concatenate.

The pre-existing mutation matrix remains green for hidden virtual/stored
columns, table and explicit index origins, indexed/non-indexed collation,
partial predicates, CHECK/FK/default/generated facts, triggers, STRICT and
table kind, schema versions, owner metadata, malformed state, and exact
inventory. Persistence and restart/recovery remain exercised through real WAL
snapshots, live/final store observation, process freeze/shutdown, and exact
product-source drift control. Existing rollback, cleanup failure, path swap,
no-follow, source partial-failure, signed PASS/FAIL, typed-tool, and bracket
delegate controls also remain green. The inspector is read-only, so parser
rollback is N/A.

## Validation

Acceptance path: `focused-only`. No Mode-B run ID/workflow SHA applies because
this is a harness-only lane, and Gate 3g was not used.

The complete serial owner/closure command was:

```bash
OPENCLAW_PRODUCT_AUTHORITY_REPO=/home/figs/flesh_beast_best_beast/source/openclaw \
OPENCLAW_REQUIRE_PRODUCT_SCHEMA_DRIFT_CONTROL=1 \
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
```

Result: `175/175` pass, `0` fail, `0` skipped,
`479994.811202ms`. This includes fresh exact product global-v15 and
per-agent-v19 schema drift control at `0ed59cb6`, the full durable-store
mutation/retention matrix, trusted launcher, signed receipt, typed-tool,
bracket-token, isolation, process, WAL, cleanup, and closure coverage.

Additional focused gates passed:

- current corpus: 37 rows, `pass=32`, `partial=4`, `honest_limit=1`, `fail=0`;
- proof-row manifests: 37 rows, 42 manifests, 0 missing;
- scenario alignment and 42-manifest/35-scenario registry;
- telemetry contracts: 13 declared, 9 receipt-requiring rows, 0
  telemetry-rebindable PASS claims; and
- JavaScript syntax and path-scoped diff checks.

Reviewed ARM64 prerequisites:

- architecture `aarch64`;
- Node `v25.9.0`;
- k6 `/home/figs/bin/k6`, version
  `k6 v2.0.0 (commit/8c3be52cc1, go1.26.3, linux/arm64)`;
- k6 SHA-256
  `6fcd167ac6525e444bb710a2cb98dbe200ef12a6e0a4e9f83d062a4acabc1e70`,
  equal to the reviewed `linux-arm64` manifest entry; and
- Python `jsonschema` `4.10.3`.

Checkpoint commits `9dd514b7`, `989bac1a`, and `04a0fe3c` accidentally contain
literal `\n` separators in their immutable messages, so their attribution
trailers do not parse. They were not amended, reset, rebased, or force-pushed.
Additive metadata successor `15e47942` uses real paragraph newlines; `git
interpret-trailers --parse` returns
`Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.

No dependency installation, product edit, corpus mutation, live proof,
presentation change, deployment, PR, Mode-B run, Gate 3g fallback, or
product-driver resume occurred. Product-driver remains blocked pending
independent review.
