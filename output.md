# Independent hostile review of covenant runtime-mount harness `e8483b66`

Status: **READY_FOR_SCRIBE_REVIEW**.

Verdict: **REQUEST_CHANGES**.

Issue binding: `openclaw/openclaw#129388`.

This lane is read-only review. The candidate branch
`codeagent/129388-harness-attested-runtime-mount-cure-20260831` was not
edited, amended, merged, or resumed. Product, presentation, bootstrap,
components, docs main, and fleet were not mutated.

## Named-reference contract

Resolved locally and against `origin` before crediting evidence. This
independent-review lane was not required as a product identity ref; it is
the publication branch for this report only.

| Category | Repository and named reference | Full SHA | Local / tracking / server disposition |
|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw` `codeagent/129388-product-covenant-driver-after-harness-15e47942-20260831` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | exact / exact / exact; tree `52b6141c80e575813f94241635ce02007b50d140` |
| This lane safe branch | `karmaterminal/karmaterminal-openclaw-docs` `codeagent/129388-e8483b66-runtime-mount-independent-review-20260831` | see publication commit | review publication only; candidate not mutated |
| Docs candidate/report head | `codeagent/129388-harness-attested-runtime-mount-cure-20260831` | `e8483b66900bacfff4d0761814b8eda129a2f10b` | exact / N/A local-untracked-before-review / exact |
| Implementation anchor | same candidate history | `2d3255461026c392bb926fe5d9aa65c09cdcd756` | exact / exact savegame / exact; tree `658bbf81ae7dd120840bf25a4883eb3e4f4c0418` |
| Implementation savegame | `savegame/129388-harness-runtime-mount-store-mode-2d325546-20260831T045338Z` | `2d3255461026c392bb926fe5d9aa65c09cdcd756` | exact / exact / exact |
| Docs base | `savegame/129388-harness-sql-comment-tokenizer-final-1f272dbe-20260830T224018Z` | `1f272dbef90048fa08df5a454bf63c224e3a9313` | exact / exact / exact |
| CI/workflow ref | N/A | N/A | focused-only; Mode-B and Gate 3g not used |
| Presentation ref | `karmaterminal/openclaw` `savegame/129388-covenant-final-00c7f721-20260828T1203Z` | `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` | exact / exact / exact; read-only; tree `55e2dc3b66ae909b37f948f4f96ebe9988cb8aae` |
| Blocked product-driver savegame | `karmaterminal/openclaw` `savegame/129388-product-driver-bootstrap-blocked-0ed59cb6-20260831T0140Z` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | exact / exact / exact |

Protected-surface movement: none observed. `origin/main` on docs is
`0984dabae218000b20178f4a031e688bdf0584ac` and does not contain the
candidate. Product `origin/main` is
`a36fedbbf80339a26ded6b89543e4c3e58c917dd` and was not used as
authority.

## Scope and identity

`git diff --name-only 1f272dbe..e8483b66` is **29 files**, all inside
`output.md` and `tools/k6-proofs/**`. Zero `PROOFS/**` or product
`src/skills/**` changes.

`2d325546^{tree}` is `658bbf81ae7dd120840bf25a4883eb3e4f4c0418`.
`e8483b66^{tree}` is `bc91d2f630b3865ddfa26bce82fd4bf8427277b5`.
The only file differing between implementation anchor and report head is
`output.md` (+257 / -28). No hidden behavioral delta.

Report commit `e8483b66` parses both trailers:

```text
Refs: openclaw/openclaw#129388
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Implementation `2d325546` parses Copilot only (`Refs` is not a Git
trailer there), matching the candidate's own disclosure.

## What independently held

- Git-only product snapshot at `0ed59cb6` / tree `52b6141c`:
  - `node scripts/run-node.mjs gateway --help` -> exit 1, `Cannot find module 'tsx'`
  - `node openclaw.mjs gateway --help` -> exit 1, `openclaw: missing dist/entry.(m)js (build output).`
- Focused owner matrix, serial (`node --test --test-concurrency=1`):
  **192/192 pass**, 0 fail, 0 skipped, `524170.945212ms`.
- Independent ARM64 artifact from exact product deps (pnpm 12.0.0 exe
  SHA-256 `6cc8f23fd03fce540489638f003cf753ade22f8b90c3d267ce37957179b21b7a`,
  Node v25.9.0 linux/arm64/glibc modules 141 N-API 10 exe SHA-256
  `6ddc7eec8c425db60c217241e2c9207eb299a17c227b9494655b18bb5da5a2e1`):
  - schema `openclaw.k6.return-covenant-runtime-artifact.v1`
  - run `rcv-fcd97ed768ac93442206ffdf3bb9cfa4`
  - docs harness `e8483b66900bacfff4d0761814b8eda129a2f10b`
  - inventory 109,027 entries / 100,327 files / 8,700 dirs / 3,248,438,199 bytes
  - FS audit: 0 writable, 0 symlinks, 0 hardlinks, 0 special; root `0555`
  - workspace output `packages/ai/dist` -> `payload/node_modules/@openclaw/ai/dist`
    including `internal/openai-responses-payload-policy.mjs`
  - gateway Git blob `a4f5b9d034486aff075ae1993341cf7f53c8e89e`, SHA-256
    `8abf50ee41cb28cfb01fe20a6b092bccc610962bd843135c63ba6b9b5ecbbddd`
  - source `node_modules` file count 98,324 before and after; esbuild
    mode `0755` nlink 3 preserved; tracked git remained clean; scratch
    count returned to zero
- Artifact producer/verifier attacks covered by the 192 tests: missing
  artifact, identity mismatch, digest alteration, missing/extra
  closures, writable/symlink/hardlink/FIFO/traversal, wrong Node/pnpm,
  workspace dist injection, scratch hardlink-mode preservation, original
  failure retained across cleanup.
- Six trusted supervisor probes require `EROFS` (not `EACCES`); writable
  mount test fails before the driver marker.
- `gatewayCommand.relativePath` is verified as a contained regular
  product Git blob; artifact cannot replace it.
- Report vs implementation is additive report metadata only.

Independent inventory is **+1 file / +5,999 bytes** versus the author's
private 109,026-entry artifact. That is build-output non-determinism, not
an open manifest. Closure SHA therefore differs, as required: this lane
did not reuse the author's private artifact.

## Material findings

### 1. Isolated config is EROFS; exact product gateway must write it

**Authority violated:** real tracked-gateway runtime, not merely the
dependency mount. Isolated `HOME`/`STATE` are writable; isolated
**config** is `--ro-bind`. Exact product `0ed59cb6` creates
`openclaw.json.lock` (and `.bak` / `.last-good`) in the config
directory.

**Affected:**

- `tools/k6-proofs/scripts/smoke-return-covenant-runtime-artifact.mjs:790`
- `tools/k6-proofs/scripts/launch-return-covenant-driver.mjs:1117`

**Negative control (independent):**

```text
node tools/k6-proofs/scripts/smoke-return-covenant-runtime-artifact.mjs \
  --plan <independent plan bound to rcv-fcd97ed768ac93442206ffdf3bb9cfa4> \
  --source-dir <exact 0ed59cb6 clone> \
  --runtime-config <published fixture> \
  --runtime-artifact <independent artifact> \
  --receipt <new path>
-> exit 1
```

Diagnostic with smoke-like bwrap `--ro-bind` of the config directory:

```text
OpenClaw cannot write to the config directory ...
Underlying error: EROFS: read-only file system, open '.../openclaw.json.lock'
```

Same harness with `--bind` config and `gateway.mode=local` keeps the
gateway process alive (fd inspect succeeds for >=10s). Artifact
`--ro-bind` mounts are not the failing surface.

**Smallest bounded repair:** `--bind` the isolated private config
directory (run-root only). Keep `payload/node_modules` and `payload/dist`
as `--ro-bind`. Do not widen artifact writability. Add a regression that
starts the real tracked `openclaw.mjs gateway` against exact product
`0ed59cb6` and asserts the config lock is creatable while mount probes
still return `EROFS`.

### 2. Smoke listener inspect does not retry `EACCES` on `/proc/<pid>/fd`

**Authority violated:** original gateway start failure must survive
observer errors. After `process.title` becomes `openclaw`,
`/proc/<pid>/fd` becomes `EACCES` then `ENOENT` while the process dies.
Smoke inner loop treats only `ENOENT`/`ESRCH` as retryable, so the
independent smoke surfaced:

```text
EACCES: permission denied, scandir '/proc/13/fd'
```

masking the EROFS config-lock error.

**Affected:**

- `tools/k6-proofs/scripts/smoke-return-covenant-runtime-artifact.mjs:587-589`
- `tools/k6-proofs/lib/return-covenant-driver-attestation.mjs:242-244`
  (`processSocketInodes` -> `readdir(/proc/<pid>/fd)`)

The launcher already retries `EACCES` in `inspectGatewayMember`. Smoke
inner does not.

**Smallest bounded repair:** treat `EACCES` as retryable in the inner
listen loop; if the child has already exited, raise the child's
stdout/stderr/exit cause, never the observer `EACCES`.

### 3. Published fixture runtime-config cannot boot the real gateway

**Authority violated:** independent real-gateway smoke must be
reproducible from published bytes. Fixture
`tools/k6-proofs/tests/fixtures/return-covenant-authority/runtime-config.valid.json`
has no `gateway.mode`. With a writable config dir the exact product
still exits 78:

```text
Gateway start blocked: existing config is missing gateway.mode.
```

The candidate report's smoke config SHA-256
`3986646ac39aeb2fa0dc15e0edcc8796e21866f94526b0fe6c9715c2200b37ee` is
**not** in this repository. 192/192 uses a synthetic driver, so it does
not catch this.

**Smallest bounded repair:** publish a bootable isolated runtime-config
(at least `gateway.mode=local` plus the existing plugin/runtime fields),
bind its digest in the smoke plan, and add a focused real-gateway smoke
owner test. Do not accept an unpublished private config as the
continuation receipt.

## High-risk questions

| Question | Independent answer |
|---|---|
| Can an omitted production dep escape the 109k manifest? | Not through the copied payload: extra/missing/digest/mode/symlink/hardlink/special fail closed. Residual: sandbox `--ro-bind / /` still exposes Node global prefix (`.../lib/node_modules`, including host `openclaw`). Git-only `tsx` still failed here, so no working omitted-dep PASS was observed. |
| Can writable bind / mode-only DAC / overlay fake EROFS? | No on this host. Six supervisor probes require `EROFS`; writable-mount test fails before driver. |
| Can pre-title observer accept a replaced/reused process? | PID+startTicks fingerprint plus Git-blob argv bind is fail-closed for reuse. Finding 2 is teardown `EACCES`, not substitution. |
| Can workspace `dist` copy unrelated outputs or omit a dynamic package? | Injection is only production workspace links whose package.json `main`/`module`/`exports`/`bin` reference `dist`. `@openclaw/ai/dist` is present. Unrelated leftover dist is not copied. Omission of a dynamically required missing dist fails at gateway start. |
| Can cleanup escape private roots or destroy caller store? | `removeReturnCovenantRuntimeArtifact` requires basename `runtime-artifact`. Scratch cleanup is directory-only chmod. Independent producer preserved source file count and esbuild `0755` hardlink mode. |
| Do report head and impl differ only by report metadata? | Yes: `output.md` only. |

## GitNexus

Installed fork wrapper `/home/figs/.local/bin/gitnexus` version `1.6.5`,
SHA-256 `8309aeb6858023f5cb3ff4ae8416b64c1989e4fe04d82dd822964127ed1355ca`,
CLI from `karmaterminal/GitNexus` `3c1e686edfc1acaac882927cada121ddd7c47bcc`.
`gitnexus status` on this worktree: **not indexed**. Registry entries are
stale unrelated worktrees/SHAs. No graph evidence credited. Stock `npx`
GitNexus was not invoked.

## Validation

Acceptance path: **focused-only**.

```bash
OPENCLAW_PRODUCT_AUTHORITY_REPO=/home/figs/flesh_beast_best_beast/tmp/129388-e8483b66-independent-product-0ed59cb6 \
OPENCLAW_REQUIRE_PRODUCT_SCHEMA_DRIFT_CONTROL=1 \
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-runtime-artifact.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs
# 192/192 pass, duration_ms 524170.945212
```

Independent producer:

```bash
node tools/k6-proofs/scripts/build-return-covenant-runtime-artifact.mjs \
  --source-dir <exact 0ed59cb6 disposable clone> \
  --output-dir <new empty dir> \
  --run-id rcv-fcd97ed768ac93442206ffdf3bb9cfa4 \
  --docs-harness-sha e8483b66900bacfff4d0761814b8eda129a2f10b \
  --package-manager-command '["<pnpm-12.0.0-linux-arm64-exe>"]'
```

Independent smoke: **FAIL** (finding 1, masked by finding 2).

Mode-B / Gate 3g: not used.

Product-driver resume remains denied: missing product-owned
`openclaw.k6.return-covenant-fixture-driver.v1` **and** the three
findings above. Do not resume the product-driver lane on this candidate.
