# Return-covenant runtime-mount real-config repair

Status: **READY_FOR_SCRIBE_REVIEW**.

Issue binding: `openclaw/openclaw#129388`.

The docs-owned harness successor repairs all three blockers independently
reported at `88349e733daa4847b91b4bb5f571fcbdd76cef76` against rejected report
`e8483b66900bacfff4d0761814b8eda129a2f10b`:

1. only the private run-root config directory is writable; the runtime
   artifact remains read-only;
2. bounded `/proc/<pid>/fd` `EACCES` retries preserve the gateway's original
   exit/stdout/stderr; and
3. the published runtime config is bootable and bound by path, Git blob, and
   canonical content digest.

The real tracked `openclaw.mjs gateway` now boots from the published config,
the config lock is observed and released, and all six `node_modules`/`dist`
mount probes still return `EROFS`.

This remains bootstrap authority only. Exact product
`0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` still has no product-owned
`openclaw.k6.return-covenant-fixture-driver.v1` command. Product-driver resume
remains denied pending a fresh external hostile review. This lane did not run
an in-process substitute review.

## Named-reference contract

The unchanged safe lane was published to `origin` at exact rejected head
`e8483b66900bacfff4d0761814b8eda129a2f10b` before any repair evidence.

| Category | Repository and named reference | Full SHA | Local / tracking / server disposition |
|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw` `codeagent/129388-product-covenant-driver-after-harness-15e47942-20260831` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | exact / exact / exact; tree `52b6141c80e575813f94241635ce02007b50d140` |
| This lane safe branch before evidence | `karmaterminal/karmaterminal-openclaw-docs` `codeagent/129388-harness-runtime-mount-real-config-cure-20260831` | `e8483b66900bacfff4d0761814b8eda129a2f10b` | exact / exact / exact; published unchanged |
| Rejected harness report | `codeagent/129388-harness-attested-runtime-mount-cure-20260831` | `e8483b66900bacfff4d0761814b8eda129a2f10b` | exact / exact / exact; tree `bc91d2f630b3865ddfa26bce82fd4bf8427277b5` |
| Rejected implementation | `savegame/129388-harness-runtime-mount-store-mode-2d325546-20260831T045338Z` | `2d3255461026c392bb926fe5d9aa65c09cdcd756` | exact / exact / exact; tree `658bbf81ae7dd120840bf25a4883eb3e4f4c0418` |
| Independent rejected-head review | `codeagent/129388-e8483b66-runtime-mount-independent-review-20260831` | `88349e733daa4847b91b4bb5f571fcbdd76cef76` | exact object / exact tracking / exact server; tree `46603727630cf280792f8da3d1178dd5d8aae250` |
| Repair implementation | this lane | `e16424624211520bb8c7810546bdc9b782235ddb` | exact / exact / exact before this report; tree `3cf7e77553ec91185f1bb4d5a04e863c30ded4ed`; parent `ebed002b524b975dfe2ecd2a90c4b0e30d060d14` |
| CI/workflow ref | N/A | N/A | focused-only docs-harness acceptance; Mode-B and Gate 3g do not apply |
| Presentation ref | `karmaterminal/openclaw` `savegame/129388-covenant-final-00c7f721-20260828T1203Z` | `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` | exact / exact / exact; tree `55e2dc3b66ae909b37f948f4f96ebe9988cb8aae`; read-only |
| Docs/proof base | `savegame/129388-harness-sql-comment-tokenizer-final-1f272dbe-20260830T224018Z` | `1f272dbef90048fa08df5a454bf63c224e3a9313` | exact / exact / exact |
| Blocked product-driver savegame | `karmaterminal/openclaw` `savegame/129388-product-driver-bootstrap-blocked-0ed59cb6-20260831T0140Z` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | exact / exact / exact |
| Components / docs main / fleet refs | N/A | N/A | read-only and not used as repair or acceptance authority |

The final report commit and immutable savegame resolve after this file is
committed; their exact local/tracking/server equality is published in the
lane COMPLETE receipt because a Git commit cannot embed its own identity.

## Scope and implementation

Behavioral implementation head
`e16424624211520bb8c7810546bdc9b782235ddb` has:

- tree `3cf7e77553ec91185f1bb4d5a04e863c30ded4ed`;
- parent `ebed002b524b975dfe2ecd2a90c4b0e30d060d14`; and
- rejected base `e8483b66900bacfff4d0761814b8eda129a2f10b`.

The rejected-base-to-implementation delta is 17 files, 884 insertions, and 83
deletions. Every path is `output.md` or `tools/k6-proofs/**`; there are zero
`PROOFS/**`, product `src/skills/**`, presentation, bootstrap, component,
docs-main, or fleet changes.

The implementation:

- adds `gateway.mode=local` to the existing published runtime config without
  adding unrelated settings;
- extends the closed plan schema with the fixture's exact repository-relative
  path and Git blob, while retaining its canonical SHA-256;
- rejects a byte-identical private/unpublished runtime config before sandbox
  creation;
- places immutable plan and k6 config files in a separate read-only authority
  directory;
- binds only the generated private run-root config directory read-write;
- leaves private artifact `payload/node_modules` and `payload/dist` as
  `--ro-bind`;
- observes `openclaw.json.lock` from the trusted sandbox supervisor and
  requires its release before PASS;
- retries only bounded `EACCES`, `ENOENT`, and `ESRCH` listener-inspection
  failures; and
- fails a persistently inaccessible live process while preserving a child
  exit and captured stdout/stderr as the primary cause.

## Regression completeness

| Blocker and owning composition boundary | Exact rejected negative | Successor control |
|---|---|---|
| Writable private config at smoke/launcher bubblewrap composition | Exact product and artifact under rejected `--ro-bind` config fail on `openclaw.json.lock`: `EROFS: read-only file system` | Real tracked gateway observes lock creation, `.bak`, `.last-good`, lock release, and cleanup while all six artifact probes remain `EROFS` |
| Gateway failure authority at smoke inner listener loop | Unmodified `e8483b66` smoke returns `EACCES: permission denied, scandir '/proc/13/fd'` instead of the child cause | Real-child tests cover transient `EACCES` to listener, persistent inaccessible live child to bounded failure, and child exit 78 with underlying stderr retained |
| Published runtime-config authority at plan/smoke boundary | Rejected tracked fixture, when config is writable, exits 78: `existing config is missing gateway.mode`; it creates only a backup | Published fixture has `gateway.mode=local`; plan binds path/blob/digest; exact tracked gateway boots; identical private copies reject |

Nearest sibling and failure-path coverage is retained:

- the product-driver launcher uses the same writable private config and
  separate read-only authority directories as the smoke;
- writable artifact binds still fail before driver execution;
- exact tracked gateway substitution still fails at the Git-blob verifier;
- source-build, production-selection, private-copy, sandbox, and run-root
  cleanup retain the original failure;
- restart/replay, reopen, rollback, retained-resource, socket/PID lineage,
  signed failure, and partial-cleanup controls remain in the complete serial
  matrix; and
- the missing product fixture seam still exits before any false proof claim.

## Fail-first receipts

All negative controls used exact product
`0ed59cb64f31971e8659b417fe3fd2ba6a1730c3`, tree
`52b6141c80e575813f94241635ce02007b50d140`.

The clean Git-only snapshot retained both dependency/build negatives:

```text
node scripts/run-node.mjs gateway --help
exit 1: Cannot find module 'tsx'

node openclaw.mjs gateway --help
exit 1: openclaw: missing dist/entry.(m)js (build output).
```

The rejected runtime smoke, with a freshly built exact ARM64 artifact, failed
before ready:

```text
runtime smoke sandbox exited before ready (exit 1):
EACCES: permission denied, scandir '/proc/13/fd'
```

Removing only that observer from the same exact composition exposed the hidden
child cause:

```text
OpenClaw cannot write to the config directory ...
EROFS: read-only file system, open '.../openclaw.json.lock'
```

Changing only the isolated config bind to read-write then exposed the third
blocker:

```text
exit 78: Gateway start blocked: existing config is missing gateway.mode.
```

Each temporary run root returned to its pre-control count, no receipt was
written for a failed smoke, and the Git-only source remained clean.

## Published runtime config

| Identity | Value |
|---|---|
| Path | `tools/k6-proofs/tests/fixtures/return-covenant-authority/runtime-config.valid.json` |
| Git blob | `23c7fc1d3a10fc7fcc12255ddda284a3ebf4be07` |
| Canonical SHA-256 | `4ce6c95d74e8cf1f6f94784073391de3e02432a5b9867ff25fb14d7f5632ed06` |
| Raw-file SHA-256 | `410e152868af713e070bab1edbf42a01c88938ff8b1a3ffcc9b085cc2be2decf` |
| Required gateway setting | `gateway.mode=local` |
| Existing runtime/plugin fields | `agents.defaults.model`, `agents.defaults.agentRuntime.id`, `plugins.entries.codex.enabled` |

The verifier requires the supplied path itself to be that regular,
non-symlink tracked file. It compares `git ls-tree` at the frozen docs SHA,
the working-tree blob, the planned Git blob, and the canonical content digest.

## Fresh ARM64 runtime artifact

The final artifact is private and uncommitted; no host pathname is public.

| Identity | Value |
|---|---|
| Schema | `openclaw.k6.return-covenant-runtime-artifact.v1` |
| Product commit | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` |
| Product/build-input tree | `52b6141c80e575813f94241635ce02007b50d140` |
| Docs implementation | `e16424624211520bb8c7810546bdc9b782235ddb` |
| Manifest SHA-256 | `8f24d0e76511e003383a8ab8bcac7857d527de58b50e080ede04b741db4c3ec9` |
| Closure/inventory SHA-256 | `03c6f631ad6b80cd9621d274ddd730ff6daad768658a3799ccd5fe6eddad1b95` |
| Dependency inventory SHA-256 | `d3891f2999c855c73e32eb82b101ee1a248b4461062234cf128b38638bd8477a` |
| Build-output inventory SHA-256 | `2fc5c41c0e33ddb996f93562fc38f76bb26a6b0aecd375f981c4e2b5e9f843c5` |
| Inventory | 109,025 entries: 100,325 files, 8,700 directories, 3,248,447,016 bytes |
| Filesystem audit | root `0555`; 0 writable entries, 0 symlinks, 0 hardlinks, 0 special files |
| Node | `v25.9.0`, `linux/arm64/glibc`, modules `141`, N-API `10` |
| Node executable SHA-256 | `6ddc7eec8c425db60c217241e2c9207eb299a17c227b9494655b18bb5da5a2e1` |
| Package manager | exact `pnpm@12.0.0`; executable SHA-256 `6cc8f23fd03fce540489638f003cf753ade22f8b90c3d267ce37957179b21b7a` |

The built workspace closure includes `packages/ai/dist` at
`payload/node_modules/@openclaw/ai/dist`: 99 entries, 97 files, 1,253,307
bytes, SHA-256
`10ef87cf10ddd4f129f7084372d029085f6288ecb30b6e499d82c712a0e4f80d`.

The rebuild used a disposable exact Git checkout and a fresh stable
lane-local pnpm 12 store passed explicitly in the pinned command. Two early
non-evidence attempts were discarded: a dependency-tree symlink made Vite
resolve through the donor clone, and an env-only store override exposed stale
cache metadata resolving an absent historical Actions-runner store. Both were
infrastructure, not candidate findings; their artifact and scratch roots were
absent afterward. The accepted build used its own same-host dependency install
with the exact pinned package manager and explicit fresh store. No project
install ran in this linked docs worktree.

The accepted rebuild preserved:

- 98,324 source dependency files before and after;
- the source/store-hardlinked esbuild executable at mode `0755`, link count 3;
- 76,256 lane-store files;
- clean tracked source bytes; and
- dependency scratch count 0 before and after.

## Real tracked-gateway receipt

The retained private smoke receipt is internally bound by SHA-256
`18b890bca038179367414c127dc2b27c047e17b07a7720625a08052a7f8990aa`;
the receipt file SHA-256 is
`3dec72a8eca7d202f9a4d1e3e99b4f25377b8e7455289cbf584aa305c66d790b`.

| Receipt | Value |
|---|---|
| Verdict | `PASS` |
| Product/tree | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` / `52b6141c80e575813f94241635ce02007b50d140` |
| Docs harness | `e16424624211520bb8c7810546bdc9b782235ddb` |
| Gateway path / Git blob | `openclaw.mjs` / `a4f5b9d034486aff075ae1993341cf7f53c8e89e` |
| Gateway SHA-256 / argv | `8abf50ee41cb28cfb01fe20a6b092bccc610962bd843135c63ba6b9b5ecbbddd` / `["gateway"]` |
| Command observation | `trusted-launcher-pre-title-procfs-v1` |
| Config write | `openclaw.json.lock` observed and released; `.bak` and `.last-good` observed |
| Process | distinct real gateway child; own loopback listener; `NODE_PATH` absent |
| Cleanup | gateway, sandbox, config lock, private artifact copy, and run root removed |

The six immutable-mount receipts are:

```text
node_modules directory chmod -> EROFS
node_modules file chmod      -> EROFS
node_modules file create     -> EROFS
dist directory chmod         -> EROFS
dist file chmod              -> EROFS
dist file create             -> EROFS
```

## Focused validation

Acceptance path: **focused-only**. Mode-B, Gate 3g, the full 38-row corpus,
fleet deployment, and live user/session data do not apply and were not used.

The complete serial owner matrix was:

```bash
OPENCLAW_PRODUCT_AUTHORITY_REPO=<exact-product-checkout> \
OPENCLAW_RETURN_COVENANT_RUNTIME_ARTIFACT=<fresh-private-artifact> \
OPENCLAW_REQUIRE_PRODUCT_SCHEMA_DRIFT_CONTROL=1 \
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-runtime-artifact.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-runtime-smoke.test.mjs
```

Result: **198/198 pass**, 0 fail, 0 cancelled, 0 skipped, 0 todo,
`676269.168593ms`. Private log SHA-256:
`b045065ffa7c69d41e436a83cbed6980da20b2c9065fc71c543ede11e3cc85b9`.

The five new runtime-smoke owner controls all passed:

- transient listener `EACCES` retries to the real child socket;
- persistent listener `EACCES` reaches bounded failure while the child lives;
- child exit 78 surfaces its underlying stderr through observer `EACCES`;
- tracked bootable config authority passes and a private copy rejects; and
- the real published-config gateway boots with all six `EROFS` probes.

The matrix also replays every prior artifact, process/socket, schema,
tokenizer, replay, signed-failure, persistence, restart/recovery, rollback,
partial-failure, and cleanup control with no skipped cases.

Changed JavaScript passed `node --check`; changed JSON parsed. The closed
fixture-input schema and harness closure tests include the new config
path/blob/digest authority and writable-config/read-only-artifact boundary.

## History, tooling, and remaining boundary

Every repair-lane commit is additive and contains a parsed contiguous trailer
block:

```text
Refs: openclaw/openclaw#129388
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

No amend, reset, rebase, squash, force-push, PR, proof fold, or protected
surface mutation occurred.

Installed GitNexus fork:

- path `/home/figs/.local/bin/gitnexus`;
- version `1.6.5`; and
- binary SHA-256
  `8309aeb6858023f5cb3ff4ae8416b64c1989e4fe04d82dd822964127ed1355ca`.

`gitnexus status` reports this repository is not indexed. No exact fork index
exists for this successor, so no graph evidence was credited and no stock
`npx`/npm GitNexus was used.

The three Cael blockers are repaired and the successor is
**READY_FOR_SCRIBE_REVIEW**. Product-driver work remains denied until a fresh
external hostile review accepts this exact final branch head.
