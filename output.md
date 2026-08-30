# Independent review: SQL tokenizer harness cure

Verdict: `CONFIRMED_COMMENT_AWARE_PHYSICAL_SCHEMA`.

Product-driver disposition: **YES** — product-driver work may resume against
implementation anchor
`15e479424518b4831c95511873f5c6b81ad52a79`.

Issue binding: `openclaw/openclaw#129388`.

## Named-reference contract

This table was recorded before deterministic replay or focused-suite evidence
was credited. The unchanged review lane was published to `origin` at
`15e479424518b4831c95511873f5c6b81ad52a79` first.

| Category | Named reference | Local SHA | Tracking SHA | Server/object SHA | Equality |
|---|---|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw@0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | N/A (immutable product object) | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | local/server equal |
| Safe lane ref | `codeagent/129388-15e47942-tokenizer-independent-review-20260830` | `15e479424518b4831c95511873f5c6b81ad52a79` | `15e479424518b4831c95511873f5c6b81ad52a79` | `15e479424518b4831c95511873f5c6b81ad52a79` | local/tracking/server equal |
| CI/workflow ref | N/A | N/A | N/A | N/A | Harness-only focused acceptance; no Mode-B product workflow applies |
| Presentation ref | N/A | N/A | N/A | N/A | Protected presentation surfaces are read-only |
| Docs/proof implementation ref | `savegame/129388-harness-sql-comment-tokenizer-cure-15e47942-20260830T223855Z` | `15e479424518b4831c95511873f5c6b81ad52a79` | `15e479424518b4831c95511873f5c6b81ad52a79` | `15e479424518b4831c95511873f5c6b81ad52a79` | local/tracking/server equal |
| Docs/proof final-report ref | `savegame/129388-harness-sql-comment-tokenizer-final-1f272dbe-20260830T224018Z` | `1f272dbef90048fa08df5a454bf63c224e3a9313` | `1f272dbef90048fa08df5a454bf63c224e3a9313` | `1f272dbef90048fa08df5a454bf63c224e3a9313` | local/tracking/server equal |

The rejected physical-schema base is
`d4deb21faa2e02076709e0c728308668924c9da4`; GitHub resolves the immutable
object to the same SHA. The candidate implementation branch has advanced to
the additive report commit `1f272dbef90048fa08df5a454bf63c224e3a9313`,
while the named implementation savegame remains fixed at the reviewed
`15e479424518b4831c95511873f5c6b81ad52a79` anchor.

## Review findings

### Implementation and history identity

| Surface | Exact identity | Finding |
|---|---|---|
| Rejected physical-schema base | `d4deb21faa2e02076709e0c728308668924c9da4` | Reproduces all four reported defects with additive tests |
| Rejected independent review | `6d69cdcfee96c5e59ae0bacded310f48c296c11a` | Immutable and consistent with replay |
| Test-only negative controls | `9dd514b79c28a471a69ef1f1f7024ae4cca60486` | Parent is exactly `d4deb21f`; production inspector is unchanged from rejection |
| Tokenizer implementation | `989bac1aee995ab3d2b929aeb87d2f54069f3be3` | Additive successor to negative controls |
| Full-harness implementation | `04a0fe3cf4411b4bbc7a5759ceec44f79a047265` | Tree `5b1ccbaed5f5bebb28459680db1c61cd6414a0cb` |
| Parsed-trailer implementation anchor | `15e479424518b4831c95511873f5c6b81ad52a79` | Parent `04a0fe3c`; same implementation tree `5b1ccbaed5f5bebb28459680db1c61cd6414a0cb` |
| Candidate final report | `1f272dbef90048fa08df5a454bf63c224e3a9313` | Parent exactly `15e47942`; report-only `output.md` successor |
| Product authority | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | GitHub and local product object resolve equally |

Malformed historical commits `9dd514b7`, `989bac1a`, and `04a0fe3c` remain
immutable in their original ancestry. Their literal separator defect remains
observable rather than rewritten. `15e47942` is an additive metadata
successor with real paragraph newlines and
`git interpret-trailers --parse` recognizes its Copilot trailer. The same is
true of additive final report `1f272dbe`.

Previously salvaged fossils
`8edd8005ac78a83dc57ab006fd791ef1a8dc53d3` and
`adb505b580104c107bf025c86cf11f6ecedfb71a` remain present on their disclosed
savegames and resolve to the same immutable objects locally and on GitHub.

### Scanner and caller audit

`tokenizeSql` is a single fail-closed scanner used by every raw-DDL consumer.
It emits typed ordinary, string, blob, identifier, and punctuation tokens and
tracks parenthesis depth over punctuation tokens only.

- Whitespace, `--` through newline or EOF, and closed `/* ... */` comments are
  discarded only in ordinary state. Each surrounding lexical unit remains a
  separate token, so a comment cannot concatenate split keywords.
- Single-quoted strings preserve original bytes, including doubled quote
  escapes and embedded line/block-comment markers. Blob literals preserve
  quoted bytes while normalizing only the case-insensitive `X` introducer.
- Double-quoted and backtick identifiers preserve embedded comment markers
  and decode only their respective doubled delimiter. Bracket identifiers
  close at the first `]`, matching the reviewed SQLite behavior; SQLite itself
  rejects the unsupported doubled-bracket form used by the control.
- Ordinary Unicode letters/numbers plus `_` and `$`, all punctuation, and
  multi-character SQLite operators are tokenized without substring matching.
- Unterminated strings, quoted identifiers, bracket identifiers, and block
  comments throw. Parenthesis underflow and nonzero final depth throw.

All scanner callers were read in full. `tableSqlClauses` and
`tableSqlModifiers` provide the shared table boundary; CHECK extraction,
generated expressions, and column COLLATE consume its tokens. Partial-index
WHERE predicates tokenize the complete index DDL. Trigger normalization,
default-expression normalization, expected fragments, and generic
`normalizeSqlFragment` all use the same token stream. Foreign keys, index
columns/origins, hidden columns, defaults, and table layout additionally use
SQLite PRAGMAs as structural authority. The only remaining direct use of
unparsed `object.sql` is a diagnostic SHA-256 in the returned fingerprint.
No regex/substr extraction of comment-bearing SQL bypasses the scanner.

### Equivalence policy

CHECK comparison extracts a balanced expression after a top-level `CHECK`
token. `stripWholeExpressionGrouping` recurses only while the first opening
parenthesis closes at the final token. It therefore removes redundant grouping
around the complete expression but leaves precedence-bearing inner grouping
untouched. Normalization case-folds ordinary/identifier tokens and inserts
canonical separators; it does not reorder terms, simplify Boolean algebra,
fold constants, alter string literal bytes, or erase inner punctuation.

Adversarial controls confirm nested whole-expression grouping, comments at
token and expression boundaries, embedded comment markers in all quoted
states, doubled escapes, split keywords, changed operators/predicates,
widened/narrowed enumerations, added/removed CHECKs, and altered defaults,
collations, triggers, and generated/index expressions remain distinguished as
required.

## Deterministic replay

The rejected replay used test-only commit `9dd514b7`, whose inspector bytes
equal rejected base `d4deb21f`:

```bash
OPENCLAW_PRODUCT_AUTHORITY_REPO=/home/figs/flesh_beast_best_beast/source/openclaw \
OPENCLAW_REQUIRE_PRODUCT_SCHEMA_DRIFT_CONTROL=1 \
node --test --test-concurrency=1 \
  --test-name-pattern='durable inspector matches current product-shaped retention stores' \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs
```

Result: `65/70` pass and the expected five failures: four defect leaves plus
their aggregate. A removed CHECK retained only in a block comment and executed
NOCASE preceded by commented BINARY were falsely accepted; a harmless comment
inside an enforced CHECK and one redundant whole-expression grouping were
falsely rejected. Every pre-existing sibling passed.

The identical candidate replay at implementation anchor `15e47942` produced
`92/92` pass, zero fail, zero skipped. The first two controls reject and the
latter two accept. Added passing controls cover block/line/EOF comments,
comments between tokens, quoted comment markers and doubled escapes,
double/backtick/bracket identifiers, malformed scanner states, unbalanced
parentheses, defaults, partial indexes, triggers, generated/hidden columns,
collations, CHECK/FK, all index origins, STRICT/table kind, owner/version
metadata, and product schema drift.

A separate uncommitted review-only copy added three adversarial leaves at the
same real `DatabaseSync` composition boundary: recursively nested
whole-expression grouping passed, precedence-bearing inner grouping remained
significant and rejected, and an `IS` to `IS NOT` operator change rejected.
The expanded matrix passed `95/95`, zero skipped. The first attempt placed the
new subtests inside a running sibling and was stopped without a receipt; after
correcting only that temporary test placement, the deterministic replay above
completed normally. No candidate or report-branch test bytes were changed.

## Complete focused acceptance

Acceptance path: `focused-only`. This is a docs-owned harness review with zero
product edits, so no Mode-B product workflow SHA/run ID applies. Gate 3g was
not used.

Reviewed prerequisites:

| Prerequisite | Receipt |
|---|---|
| Architecture | `aarch64` |
| Node | `v25.9.0` |
| k6 | `/home/figs/bin/k6`, `v2.0.0`, commit `8c3be52cc1`, `linux/arm64` |
| k6 SHA-256 | `6fcd167ac6525e444bb710a2cb98dbe200ef12a6e0a4e9f83d062a4acabc1e70`, equal to reviewed `linux-arm64` manifest |
| Python jsonschema | `4.10.3` |

The complete serial owner/closure suite ran with:

```bash
OPENCLAW_PRODUCT_AUTHORITY_REPO=/home/figs/flesh_beast_best_beast/source/openclaw \
OPENCLAW_REQUIRE_PRODUCT_SCHEMA_DRIFT_CONTROL=1 \
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
```

Result: `175/175` pass, `0` fail, `0` cancelled, `0` skipped,
`473018.061697ms`.

This includes fresh exact-product global-v15/per-agent-v19 physical contract
comparison at `0ed59cb6`; the complete durable-store mutation and retention
matrix; typed and bracket forms; trusted launcher; signed receipts; source,
path, inode, no-follow, WAL, process, socket, freeze, shutdown/recovery,
cleanup, isolation, partial-failure, and closure controls.

## Authority and protected-surface audit

The owning boundary remains exported
`inspectReturnCovenantPhysicalSchema`, composed through
`requirePhysicalSchema` and `requireExactTable`. Tests exercise real
`DatabaseSync` stores, real `sqlite_schema` text and PRAGMAs, WAL snapshots,
and the exported inspector rather than parser mocks.

Docs-owned stores remain verdict authority. Candidate responses and cleanup
remain diagnostics and cannot veto canonical observations. The candidate diff
from `d4deb21f` touches only the inspector, its owner test, and its harness
documentation. Authority logic outside the SQL fingerprint section is
unchanged, and the full suite reconfirms no-follow, WAL, path/inode,
process/socket, freeze, cleanup, restart/recovery, partial-failure, and signed
PASS/FAIL boundaries.

The exact product authority remains `0ed59cb6`. Candidate history contains no
product, blocked corpus (`PROOFS/**`), protected docs-main, presentation,
bootstrap, component, or fleet edits. No dependency installation, product
edit, live proof, deployment, PR, Mode-B run, or Gate 3g fallback occurred.

## Final disposition

`CONFIRMED_COMMENT_AWARE_PHYSICAL_SCHEMA`.

The implementation anchor closes both SQL-comment false accepts and both
equivalence false rejects without weakening prior exact physical-schema or
proof-authority boundaries. **Yes, product-driver work may resume against
`15e479424518b4831c95511873f5c6b81ad52a79`.**
