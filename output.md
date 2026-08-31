# Independent hostile review of runtime-mount repair successor `5384acb5`

Status: **READY_FOR_SCRIBE_REVIEW**.

Verdict: **CONFIRMED_RUNTIME_MOUNT_AUTHORITY**.

Issue binding: `openclaw/openclaw#129388`.

This lane is read-only review of repair successor
`5384acb5a137fdcfe30f1742bdc6af86ef8899d1`. The candidate branch
`codeagent/129388-harness-runtime-mount-real-config-cure-20260831` was not
edited, amended, merged, or resumed. Product, presentation, bootstrap,
components, docs main, and fleet were not mutated.

Product-driver resume may proceed only after scribe acceptance and against
the independently accepted bounded continuation successor. Exact product
`0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` still has no product-owned
`openclaw.k6.return-covenant-fixture-driver.v1` command.

## Named-reference contract

Resolved locally and against `origin` before crediting evidence.

| Category | Repository and named reference | Full SHA | Local / tracking / server disposition |
|---|---|---|---|
| Product/base ref | `karmaterminal/openclaw` `codeagent/129388-product-covenant-driver-after-harness-15e47942-20260831` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | exact / exact / exact; tree `52b6141c80e575813f94241635ce02007b50d140` |
| This lane safe branch | `karmaterminal/karmaterminal-openclaw-docs` `codeagent/129388-e8483b66-runtime-mount-independent-review-20260831` | see publication commit | additive review only; candidate not mutated |
| Repair successor / report head | `codeagent/129388-harness-runtime-mount-real-config-cure-20260831` | `5384acb5a137fdcfe30f1742bdc6af86ef8899d1` | exact / exact / exact; tree `6d48c5605f8c8b69d213f2956c9c1256d37eb159`; parent `e16424624211520bb8c7810546bdc9b782235ddb` |
| Repair implementation | same lane | `e16424624211520bb8c7810546bdc9b782235ddb` | exact; tree `3cf7e77553ec91185f1bb4d5a04e863c30ded4ed`; parent `ebed002b524b975dfe2ecd2a90c4b0e30d060d14` |
| Repair savegame | `savegame/129388-harness-runtime-mount-real-config-cure-final-5384acb5-20260831T075042Z` | `5384acb5a137fdcfe30f1742bdc6af86ef8899d1` | exact / exact / exact |
| Rejected report | `codeagent/129388-harness-attested-runtime-mount-cure-20260831` | `e8483b66900bacfff4d0761814b8eda129a2f10b` | exact / exact / exact; tree `bc91d2f630b3865ddfa26bce82fd4bf8427277b5` |
| Prior independent review | this lane | `88349e733daa4847b91b4bb5f571fcbdd76cef76` | exact / exact / exact; tree `46603727630cf280792f8da3d1178dd5d8aae250` |
| CI/workflow ref | N/A | N/A | focused-only; Mode-B and Gate 3g not used |
| Presentation ref | `karmaterminal/openclaw` `savegame/129388-covenant-final-00c7f721-20260828T1203Z` | `00c7f721a55554d0b9228337cc8bc6bec88f9e9f` | exact / exact / exact; read-only |
| Blocked product-driver savegame | `karmaterminal/openclaw` `savegame/129388-product-driver-bootstrap-blocked-0ed59cb6-20260831T0140Z` | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` | exact / exact / exact |

Protected-surface movement: none. Report vs implementation on the successor
is `output.md` only.

## Prior negatives reproduced on `e8483b66`

All used exact product `0ed59cb6` / tree `52b6141c`.

1. Real smoke from rejected harness + independent prior artifact:

```text
runtime smoke sandbox exited before ready (exit 1):
EACCES: permission denied, scandir '/proc/13/fd'
```

No receipt was written.

2. Same composition with `--ro-bind` isolated config:

```text
EROFS: read-only file system, open '.../openclaw.json.lock'
```

Config dir after: `openclaw.json` only.

3. Isolated config `--bind` + rejected published fixture (no `gateway.mode`):

```text
exit 78: Gateway start blocked: existing config is missing gateway.mode.
```

Config dir after: `openclaw.json` and `openclaw.json.bak`.

## Successor repairs independently proven

`e8483b66..5384acb5` is 17 files, all inside `output.md` and
`tools/k6-proofs/**`. Behavioral implementation is `e1642462`.

| Repair | Independent proof |
|---|---|
| Writable private config only | Smoke/launcher `--bind` the run-root config dir; artifact `node_modules`/`dist` remain `--ro-bind`. Plan/k6 files sit in a separate `--ro-bind` authority dir. Private byte-identical config copies are rejected before sandbox creation. |
| Lock / bak / last-good | Independent smoke receipt: `lockObserved=true`, `writeArtifactsObserved=["openclaw.json.bak","openclaw.json.lock"]`, `lockReleased=true`, `finalArtifacts=["openclaw.json.bak","openclaw.json.last-good"]`. |
| Bounded proc-fd EACCES preserves child error | Owner controls: transient EACCES retries to a real child socket; persistent live EACCES reaches bounded failure; child exit 78 surfaces underlying stderr and does not publish the observer denial. |
| Published `gateway.mode=local` | Fixture blob `23c7fc1d3a10fc7fcc12255ddda284a3ebf4be07`, canonical SHA-256 `4ce6c95d74e8cf1f6f94784073391de3e02432a5b9867ff25fb14d7f5632ed06`. Plan binds path/blob/digest. Exact tracked `openclaw.mjs gateway` boots. |

## Fresh ARM64 artifact

Built from exact product deps with pnpm 12.0.0 exe SHA-256
`6cc8f23fd03fce540489638f003cf753ade22f8b90c3d267ce37957179b21b7a`.
Did not reuse the author's private artifact.

| Identity | Value |
|---|---|
| Run | `rcv-35dde5cf00e6473dbdc3e2f70c198ee2` |
| Docs harness | `5384acb5a137fdcfe30f1742bdc6af86ef8899d1` |
| Product / tree | `0ed59cb64f31971e8659b417fe3fd2ba6a1730c3` / `52b6141c80e575813f94241635ce02007b50d140` |
| Manifest SHA-256 | `03af99cbc0739b544a38dfb8ee0a9c102819e15df7ccacacd57ac1f79475da22` |
| Inventory | 109,026 entries: 100,326 files, 8,700 dirs, 3,248,437,882 bytes |
| FS audit | root `0555`; 0 writable, 0 symlink, 0 hardlink, 0 special |
| Node | v25.9.0 linux/arm64/glibc modules 141 N-API 10; exe `6ddc7eec8c425db60c217241e2c9207eb299a17c227b9494655b18bb5da5a2e1` |
| Workspace dist | `packages/ai/dist` -> `payload/node_modules/@openclaw/ai/dist` (96 files) |

Source `node_modules` file count 98,324 and esbuild mode `0755` nlink 3
were preserved; tracked git stayed clean; scratch count returned to zero.

## Real tracked-gateway smoke

Independent smoke against the successor harness and the fresh artifact:
**PASS**. Receipt SHA-256
`d054bbdf956e458318b34f8d4d14188cffa8bb71eca84aee990704e00d94eaf8`.

- Gateway Git blob `a4f5b9d034486aff075ae1993341cf7f53c8e89e`, SHA-256
  `8abf50ee41cb28cfb01fe20a6b092bccc610962bd843135c63ba6b9b5ecbbddd`, argv
  `["gateway"]`
- Command observation `trusted-launcher-pre-title-procfs-v1`
- Distinct real gateway child; `NODE_PATH` absent
- Six mount probes all `EROFS`
- Cleanup: gateway, sandbox, config lock, private artifact, run root gone

## Focused owner matrix

Acceptance path: **focused-only**.

```bash
cd <successor-5384acb5-worktree>
OPENCLAW_PRODUCT_AUTHORITY_REPO=<exact-0ed59cb6-clone> \
OPENCLAW_RETURN_COVENANT_RUNTIME_ARTIFACT=<fresh-private-artifact> \
OPENCLAW_REQUIRE_PRODUCT_SCHEMA_DRIFT_CONTROL=1 \
node --test --test-concurrency=1 \
  tools/k6-proofs/scripts/__tests__/return-covenant-authority.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-runtime-artifact.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-harness-closure-contract.test.mjs \
  tools/k6-proofs/scripts/__tests__/return-covenant-runtime-smoke.test.mjs
```

**198/198 pass**, 0 fail, 0 skipped, `615217.623983ms`. Includes the five
new runtime-smoke controls and the real published-config gateway boot
(101156.702456ms).

## GitNexus

Installed fork `/home/figs/.local/bin/gitnexus` 1.6.5, SHA-256
`8309aeb6858023f5cb3ff4ae8416b64c1989e4fe04d82dd822964127ed1355ca`.
This repository is not indexed. No graph evidence credited. Stock `npx`
GitNexus was not invoked.

## Residual

Sandbox still `--ro-bind / /`, so the host Node prefix remains visible.
Git-only `tsx` still fails, and no omitted-dep PASS was observed. Not a
material finding against this successor's claimed config/EACCES/mode
repairs.

Product-driver lane remains denied until scribe acceptance.
