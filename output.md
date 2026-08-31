# Return-covenant runtime-mount real-config repair

Status: **WORK_IN_PROGRESS**.

Issue binding: `openclaw/openclaw#129388`.

This additive repair lane starts from rejected harness report
`e8483b66900bacfff4d0761814b8eda129a2f10b`. No repair evidence is credited
before the named-reference contract below. The unchanged safe lane was
published to `origin` at that exact SHA before any negative control or
successor test ran.

## Repair-lane named-reference contract

| Category | Repository and named reference | Full SHA | Local / tracking / server disposition |
|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw` `codeagent/129388-product-covenant-driver-after-harness-15e47942-20260831` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | exact / exact / exact; tree `52b6141c80e575813f94241635ce02007b50d140` |
| This lane safe branch before evidence | `karmaterminal/karmaterminal-openclaw-docs` `codeagent/129388-harness-runtime-mount-real-config-cure-20260831` | `e8483b66900bacfff4d0761814b8eda129a2f10b` | exact / exact / exact; published unchanged |
| Rejected harness report | `codeagent/129388-harness-attested-runtime-mount-cure-20260831` | `e8483b66900bacfff4d0761814b8eda129a2f10b` | exact / exact / exact; tree `bc91d2f630b3865ddfa26bce82fd4bf8427277b5` |
| Rejected report savegame | `savegame/129388-harness-attested-runtime-mount-final-e8483b66-20260831T053255Z` | `e8483b66900bacfff4d0761814b8eda129a2f10b` | exact / exact / exact |
| Rejected implementation anchor | `savegame/129388-harness-runtime-mount-store-mode-2d325546-20260831T045338Z` | `2d3255461026c392bb926fe5d9aa65c09cdcd756` | exact / exact / exact; tree `658bbf81ae7dd120840bf25a4883eb3e4f4c0418` |
| Independent review report | `codeagent/129388-e8483b66-runtime-mount-independent-review-20260831` | `88349e733daa4847b91b4bb5f571fcbdd76cef76` | exact object / exact tracking / exact server; tree `46603727630cf280792f8da3d1178dd5d8aae250` |
| CI/workflow ref | N/A | N/A | Focused-only docs-harness acceptance; Mode-B and Gate 3g do not apply |
| Presentation ref | `karmaterminal/openclaw` `savegame/129388-covenant-final-00c7f721-20260828T1203Z` | `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` | exact / exact / exact; tree `55e2dc3b66ae909b37f948f4f96ebe9988cb8aae`; read-only |
| Docs/proof base | `savegame/129388-harness-sql-comment-tokenizer-final-1f272dbe-20260830T224018Z` | `1f272dbef90048fa08df5a454bf63c224e3a9313` | exact / exact / exact |
| Blocked product-driver savegame | `karmaterminal/openclaw` `savegame/129388-product-driver-bootstrap-blocked-0ed59cb6-20260831T0140Z` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | exact / exact / exact |
| Components / docs main / fleet refs | N/A | N/A | Read-only and not used as repair or acceptance authority |

The product driver, protected presentation, bootstrap, components, docs main,
fleet, and proof corpus remain read-only. The work below this marker is the
rejected `e8483b66` report retained temporarily for comparison; it is not
successor evidence and will be replaced by the final repair receipt.

---

# Rejected report retained for comparison

Status: **READY_FOR_SCRIBE_REVIEW**.

Issue binding: `openclaw/openclaw#129388`.

The docs-owned harness can now start the unchanged exact product's tracked
gateway command from its Git-only snapshot by mounting a completely verified,
private, read-only runtime artifact. Product, protected presentation,
bootstrap, components, docs main, fleet, and proof-corpus bytes remain
unchanged.

This is bootstrap authority only. Exact product
`0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` still has no product-owned
`openclaw.k6.return-covenant-fixture-driver.v1` command, so the 38-row corpus
was not run and the product-driver lane remains denied pending scribe review.

## Named-reference contract

This table was first written and committed before regression or runtime
evidence. The unchanged safe lane was published to `origin` at
`1f272dbef90048fa08df5a454bf63c224e3a9313`.

| Category | Repository and named reference | Full SHA | Local / tracking / server disposition |
|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw` `codeagent/129388-product-covenant-driver-after-harness-15e47942-20260831` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | exact / exact / exact; tree `52b6141c80e575813f94241635ce02007b50d140` |
| Safe lane ref before evidence | `karmaterminal/karmaterminal-openclaw-docs` `codeagent/129388-harness-attested-runtime-mount-cure-20260831` | `1f272dbef90048fa08df5a454bf63c224e3a9313` | exact / exact / exact |
| Reviewed implementation ref | same safe lane | `2d3255461026c392bb926fe5d9aa65c09cdcd756` | exact / exact / exact |
| Implementation savegame | `savegame/129388-harness-runtime-mount-store-mode-2d325546-20260831T045338Z` | `2d3255461026c392bb926fe5d9aa65c09cdcd756` | exact / exact / exact |
| CI/workflow ref | N/A | N/A | Docs-only focused acceptance; Mode-B and Gate 3g were expressly not used |
| Historical workflow context only | `karmaterminal/openclaw-bootstrap` `savegame/129388-primitive-core-semantic-test-routing-cure-3c5acdb7-20260830T1825Z` | `3c5acdb72e94755f469fc6cc3276d5b8623d5b49` | exact / exact / exact; historical red run `33323536011`, never acceptance |
| Presentation ref | `karmaterminal/openclaw` `savegame/129388-covenant-final-00c7f721-20260828T1203Z` | `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` | exact / exact / exact; read-only |
| Docs/proof base | `savegame/129388-harness-sql-comment-tokenizer-final-1f272dbe-20260830T224018Z` | `1f272dbef90048fa08df5a454bf63c224e3a9313` | exact / exact / exact |
| Harness implementation | `savegame/129388-harness-sql-comment-tokenizer-cure-15e47942-20260830T223855Z` | `15e479424518b4831c95511873f5c6b81ad52a79` | exact / exact / exact |
| Independent harness confirmation | `savegame/129388-15e47942-tokenizer-independent-review-192a1814-20260830T231752Z` | `192a1814cf4150fc07496c1164fbcff6c3fe9e54` | exact / exact / exact |
| Blocked product-driver savegame | `karmaterminal/openclaw` `savegame/129388-product-driver-bootstrap-blocked-0ed59cb6-20260831T0140Z` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | exact / exact / exact |
| Prior blocked corpus | `savegame/129388-0ed59cb6-blocked-proof-20260830T1915Z` | `ba8d344c1240275a9c54042294b8129eea4e497b` | exact / exact / exact |

Component, docs-main, and fleet execution refs are `N/A`; none was read as
authority or mutated.

## Implementation identity and scope

The executable implementation anchor is:

- head `2d3255461026c392bb926fe5d9aa65c09cdcd756`;
- tree `658bbf81ae7dd120840bf25a4883eb3e4f4c0418`;
- parent `692c5c95d7e726f905edd2a8c60d0d61d0df26c6`; and
- base `1f272dbef90048fa08df5a454bf63c224e3a9313`.

The complete lane delta through that anchor is 29 files, 5,771 insertions, and
297 deletions. It touches only `output.md` and `tools/k6-proofs/**`; there are
zero `PROOFS/**` or product `src/skills/**` changes.

The cure adds:

- a closed runtime-artifact schema and pure binding/mount-observation contract;
- a producer that runs the exact product build, selects current-platform
  production dependencies in a disposable exact Git scratch checkout, injects
  generated `dist` only for workspace packages referenced by that closure,
  and leaves the caller dependency tree/store intact;
- a no-follow verifier that checks commit, tree, build inputs, Node/pnpm
  identity, full inventory, sizes, modes, and every content digest;
- a private-copy boundary that re-verifies independently copied bytes before
  sandbox entry;
- fixed read-only binds from `payload/node_modules` to candidate
  `node_modules` and `payload/dist` to candidate `dist`;
- trusted sandbox-supervisor directory-chmod, file-chmod, and create probes
  that must each return `EROFS` before the product driver can start;
- a docs-owned pre-title `/proc` observer that captures exact
  Node/script/argv/cwd before product `process.title` rewrites Linux cmdline,
  then binds only the same PID/start/environment/socket listener; and
- artifact identity through plan, phase requests, ready, driver attestation,
  observations, retention, live/final store identity, cleanup, and the signed
  public receipt.

`gatewayCommand.relativePath` remains a contained regular product Git blob.
The artifact satisfies imports/build lookup only; it cannot provide or replace
the executable.

## Final runtime artifact

The final artifact is private and uncommitted. Its raw run ID and host paths
are not published; public run fingerprint: `67cdceb0b8813ceb`.

| Identity | Value |
|---|---|
| Schema | `openclaw.k6.return-covenant-runtime-artifact.v1` |
| Product commit | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` |
| Product tree / build-input tree | `52b6141c80e575813f94241635ce02007b50d140` |
| Docs implementation | `2d3255461026c392bb926fe5d9aa65c09cdcd756` |
| Manifest SHA-256 | `2ca5006907df8e3e42f3ec20fc0316910fc15961d98152ef06f6dc1d86b9364d` |
| Closure SHA-256 | `4fab08f44c5dae351bd84e2f3b189dcfe7b50cd041f1d6b5ef629110c9ef7ae1` |
| Dependency inventory SHA-256 | `e0c9a5f75677a89eca0b327b583b6d2776d9942574a96d49fede3a3dac1336c1` |
| Build-output inventory SHA-256 | `8c81f48251d0ab9b8133ad1fe3a431dd85ea119228187cc659d8817d5f9e1c6c` |
| Inventory | 109,026 entries: 100,326 files, 8,700 directories, 3,248,432,200 bytes |
| Filesystem audit | 0 writable entries, 0 symlinks, 0 hardlinks, 0 special files |
| Node | `v25.9.0`, `linux/arm64/glibc`, modules `141`, N-API `10` |
| Node executable SHA-256 | `6ddc7eec8c425db60c217241e2c9207eb299a17c227b9494655b18bb5da5a2e1` |
| Package manager | exact product pin `pnpm@12.0.0`; executable SHA-256 `6cc8f23fd03fce540489638f003cf753ade22f8b90c3d267ce37957179b21b7a` |

Build inputs include exact regular Git blob and SHA-256 identities for
`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
`node-version.mjs`, `scripts/build-all.mts`, `scripts/tsx.mjs`, and both
tsdown configurations. Commands are bound as:

```text
pnpm run build
pnpm install --prod --frozen-lockfile --os linux --cpu arm64 --libc glibc
```

The production closure references `packages/ai/dist`; its mounted
`payload/node_modules/@openclaw/ai/dist` inventory is 98 entries, 96 files,
1,253,060 bytes, SHA-256
`459048568b6af4d2f0e00a9c6be49b23938177871dac626973a7789b47b7bcc9`.

The real producer preserved all 101,543 source dependency files and the
source/store hardlinked esbuild executable at mode `0755` before and after the
build. Its disposable dependency scratch count returned to zero.

## Fail-first and pass-after evidence

The exact Git-only product snapshot reproduced both original failures before
dependencies or build output were present:

```text
node scripts/run-node.mjs gateway --help
exit 1: Cannot find module 'tsx'

node openclaw.mjs gateway --help
exit 1: openclaw: missing dist/entry.(m)js (build output).
```

Additional deterministic fail-first controls found and cured during real
composition:

| Rejected boundary | Expected failure | Successor proof |
|---|---|---|
| report base `1f272dbe` | no runtime-artifact argument, verifier, or mount exists | implementation requires and verifies the artifact before spawn |
| first real smoke | product rewrites cmdline to `openclaw-gateway`, so direct post-ready argv match rejects it | trusted pre-title procfs observation binds exact argv to same PID/start/listener |
| pre-review mount probe | mode-0555 payload on a writable bind can return `EACCES` and false-pass | supervisor requires six `EROFS` receipts; writable-mount test fails before driver marker |
| pre-review producer | in-place production selection removed full source dependencies | exact scratch production checkout; success/failure preserve source dependencies |
| pre-review scratch cleanup | chmod on pnpm hardlinked files changed store executable modes | directory-only cleanup plus hardlinked-store mode regression |
| first scratch-built closure | `@openclaw/ai/dist` absent; real gateway exits on missing `openai-responses-payload-policy.mjs` | production-linked workspace output is inventoried and final real gateway starts |

The final deterministic regression matrix covers:

| Control | Result |
|---|---|
| no artifact supplied | rejected before driver |
| product SHA/tree, docs, row, run, or manifest mismatch | rejected before driver |
| altered manifest or payload digest | rejected |
| missing/extra file or mount root | rejected |
| writable artifact entry | rejected |
| writable sandbox bind over immutable modes | trusted `chmod` succeeds, therefore rejected before driver |
| symlink, hardlink, path traversal, FIFO/special file | rejected |
| wrong Node or package-manager identity | rejected |
| stale artifact replay | rejected by run/row/docs/product binding |
| dependency closure without build output | rejected |
| build output without dependency closure | rejected |
| required workspace `dist` absent | rejected |
| untracked gateway executable substitution | rejected by regular Git blob verifier |
| artifact/source/scratch cleanup failure | original failure retained; output/scratch/run root cleaned |
| clean exact-product tracked gateway | PASS |
| exact product fixture-driver absence | exit 1, `product-owned fixture command is not available` |

## Real gateway smoke

The final smoke used only the exact product checkout, the verified private
artifact, isolated home/state/config/IPC roots, and the tracked
`openclaw.mjs` command:

| Receipt | Value |
|---|---|
| Runtime config SHA-256 | `3986646ac39aeb2fa0dc15e0edcc8796e21866f94526b0fe6c9715c2200b37ee` |
| Gateway relative path | `openclaw.mjs` |
| Gateway Git blob | `a4f5b9d034486aff075ae1993341cf7f53c8e89e` |
| Gateway SHA-256 | `8abf50ee41cb28cfb01fe20a6b092bccc610962bd843135c63ba6b9b5ecbbddd` |
| Frozen argv | `["gateway"]` |
| Command observation | `trusted-launcher-pre-title-procfs-v1` |
| Gateway start fingerprint | `81e00f575143272a2999625e37b65e484f5ea4d60ce781d1cc9e3b4cd7bbeff7` |
| Listener-set SHA-256 | `75c6590365f9dfc488c5d6f155f26d693bf2c0c287c4f65cde172fa3de1ddf82` |
| Internal smoke receipt SHA-256 | `7c085a8d94f1b808407cc803fe009ce20155473916bce3a7e62fa1a2dc51967a` |
| Private receipt-file SHA-256 | `4f63677fa5aafca2906db02a61c87589705a3e2c6e25c10eadf9dd8bf25d77f3` |

Both `node_modules` and `dist` returned `EROFS` independently for directory
chmod, payload-file chmod, and file creation. The listener belonged to a
distinct real gateway child. `NODE_PATH` was absent. Gateway, sandbox, private
artifact copy, and run root were all gone before PASS.

## Focused validation

Acceptance path: **focused-only**. No product Mode-B, Gate 3g, full 38-row
corpus, fleet run, deployment, or live user/session data applies.

The final serial owner command was:

```bash
OPENCLAW_PRODUCT_AUTHORITY_REPO=/home/figs/flesh_beast_best_beast/source/openclaw-129388-runtime-artifact-build-0ed59cb6 \
OPENCLAW_REQUIRE_PRODUCT_SCHEMA_DRIFT_CONTROL=1 \
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-runtime-artifact.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
```

Result: **192/192 pass**, 0 fail, 0 skipped, `526069.645247ms`.

That serial suite retains the nearest sibling controls for:

- exact global-v15 and per-agent-v19 physical schemas;
- comments, quotes, token boundaries, CHECK/FK/index/collation/default/
  generated-column/trigger enforcement and malformed DDL;
- fresh, migration, reopen, WAL-only, live/final, path-swap, and no-follow
  store observation;
- typed-tool/bracket origins, phase challenge/HMAC, replay and receipt reuse;
- PID ancestry, pre-title argv, socket ownership, restart lineage, and
  listener disjointness;
- candidate diagnostic distrust, signed PASS/FAIL, cleanup, rollback,
  retry/recovery, retained resources, and partial failures; and
- physical immutable artifact files, trusted `EROFS` mount enforcement,
  workspace build-output closure, scratch cleanup, and pnpm hardlink modes.

Existing docs/harness static gates also pass:

- current corpus: 37 rows; `pass=32`, `partial=4`, `honest_limit=1`, `fail=0`;
- proof manifests: 37 rows, 42 manifests, 0 missing;
- manifest/scenario registry: 42 manifests, 35 scenario files;
- workflow scenario alignment: `ok=true`;
- telemetry contracts: 13 declared, 9 receipt-requiring rows, 0
  telemetry-rebindable PASS claims;
- 16 changed JavaScript files pass `node --check`;
- 10 changed JSON files parse; and
- final runtime manifest passes its closed Draft 2020-12 schema with all
  109,026 entries.

This docs repository has no package-level typecheck/lint/build manifest.
Existing repository static/syntax/schema commands were run; the product build
used to create the artifact passed under exact pinned dependencies.

## Review and tooling

An independent read-only reviewer found two substantive issues in the initial
successor: a DAC-only read-only probe and destructive source dependency
selection. Both were repaired. A second independent review at the repaired
boundary marked both **RESOLVED** and found no new high-confidence issue.
Scribe review is still required before the product-driver lane resumes.

Installed GitNexus fork:

- path `/home/figs/.local/bin/gitnexus`;
- version `1.6.5`; and
- binary SHA-256
  `8309aeb6858023f5cb3ff4ae8416b64c1989e4fe04d82dd822964127ed1355ca`.

`gitnexus status` reports this repository is not indexed. Available docs
indexes are unrelated stale worktrees, so no graph/impact evidence was
credited and no stock `npx` substitute was used.

## History and residual boundary

Every additive checkpoint commit contains the exact body line
`Refs: openclaw/openclaw#129388` and the Copilot attribution with real
newlines. The checkpoint commits placed those as separate paragraphs, so Git's
trailer parser recognizes the Copilot trailer but not `Refs`; the final
additive report commit restores one contiguous parsed trailer block without
amending, rebasing, resetting, or force-pushing history.

No PR was opened. No proof result was folded. The exact-product negative
remains intentional: runtime availability is cured, while the missing
product-owned protocol command remains a product-layer prerequisite.
