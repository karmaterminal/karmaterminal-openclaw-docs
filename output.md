# PR #129388 cured-composite affected-row refire

## Outcome

The bounded lane is complete but the required five-row outcome is **not
accepted**. Exact Project-81 run
[32981265676](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/32981265676)
concluded `failure`; the red is preserved rather than summarized away.

| Row | Reviewed verdict | Classification |
|---|---|---|
| `R-CD-2` | `PARTIAL-candidate` | Product observability: same-trace dispatch/fire and current-turn parent exist, but the originating typed-tool span is absent |
| `R-CD-CHAINED-DEPTH-2` | `PARTIAL-candidate` | Harness/model acknowledgment: cured frozen returns reached the root, but the model did not emit the exact root-ack sentinel |
| `R-CD-TOKEN` | `PARTIAL-candidate` | Product origin binding and trace propagation: one durable delegate completed and returned to root, not the disposable origin child; dispatch/fire split across traces |
| `R-OBS-BACKEND-DISPOSITION` | `PASS-candidate` | Complete disposition contract with honest backend `partial`, `complete=false`, `countAuthority=false` |
| `R-CW-6` | `PASS-candidate` | Exact-candidate process-local fixture, max chain 3, all nine receipts green |

No red row was rerun. No artifact was folded into the corpus.

Acceptance path: **focused-only plus named Project-81 live run
`32981265676`**. Broad Mode-B and Gate 3g were excluded by the workorder.

## Named-ref identity gate

The unchanged safe lane was published before evidence. These were the exact
executed refs; the later report commit changes no workflow, harness, scenario,
manifest, or product bytes.

| Category | Named ref | Resolved SHA | Local | Tracking | Server | Equality |
|---|---|---|---|---|---|---|
| Product/runtime composite | `karmaterminal/openclaw@a5db13ad6297721cbf43af445d5a4a9b9bb0ad67` | `a5db13ad6297721cbf43af445d5a4a9b9bb0ad67` | `a5db13ad6297721cbf43af445d5a4a9b9bb0ad67` | `a5db13ad6297721cbf43af445d5a4a9b9bb0ad67` | `a5db13ad6297721cbf43af445d5a4a9b9bb0ad67` | local = tracking = branch server = immutable GitHub commit |
| Safe lane, pre-evidence/executed | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-cured-row-refire` | `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` | `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` | `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` | `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` | local = tracking = server; unchanged branch published before evidence |
| CI/workflow | `.github/workflows/project81-k6-proof.yml` from the exact safe-lane ref | `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` | `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` | `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` | `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` | run `headSha` equal; workflow blob `c08b7b5556e604feb62b981b3c41dfec4cb013ea`, SHA-256 `6b7cb215cc64ae250c748561e9023f2b602bdf7e3fafa3b9532d1a65703d8c1a` |
| Presentation | `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates@4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | local = tracking = branch server = immutable GitHub commit; read-only |
| Docs/proof base | `karmaterminal/karmaterminal-openclaw-docs@821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` | `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` | `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` | N/A (immutable commit) | `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` | local = immutable GitHub commit |

Harness closure `45cf1ae59ba0f32031a90dde193fe2d48d494e25`
is an ancestor of the docs base and is their exact merge base. Product parents
are `6aca9d1d9294376d0466cc8cc608ba731220aab9` and
`2f9b9b7a90988190a149208cbbad68558d1d7daa`. Discarded observability overlay
`2a42f96a3e9579caf04a2c203ce2ffc27ffaa0b8` is not an ancestor.

## Exact runtime and isolated gateway

| Check | Receipt |
|---|---|
| Host/tooling | Ronan `aarch64`; Node `v25.9.0`; k6 `v2.0.0`; lane-local pnpm `11.22.0` |
| Source | Tracked-clean exact checkout `a5db13ad6297721cbf43af445d5a4a9b9bb0ad67` |
| Dependencies | Same-host tree; package, workspace, candidate lock, and installed lock bytes equal; 17 workspace-local links; no project install in `source/WORKTREES` |
| Build | Successful exact build; `dist/build-info.json` commit `a5db13ad...`, SHA-256 `9d7049b6bca9ec1bbb85b1571763e10a21caeaa9d0f5748a3cf040fb11445eec` |
| Stable dist | 12,147 files; SHA-256 `822b9665d27d463469edb70f034a96c0dc8cb3cefc9227865e653ce5ec5beae3` before smoke, after smoke, after proof traffic, and after shutdown |
| Isolation | Separate private config, state, database, workspace, home, logs, token file, and disposable sessions |
| Auth route | One OpenAI OAuth profile copied into the isolated shared store; zero live/prior sessions copied; `auth.sharedStore` owned by the isolated state DB |
| Service | `openclaw-proof-129388-cured-row-refire.service`; PID/PGID/SID `3990716`; loopback `127.0.0.1:19892` and `[::1]:19892` only |
| OTel | `diagnostics-otel`; direct `http://otel.dandelion.cult:4318`; `http/protobuf`; traces on; metrics/logs off; `captureContent=false`; sample `1.0`; service `ronan-isolated-129388-a5db13ad` |
| Readiness | `PASS-candidate`; authenticated health/status; continuation defaults present; raw-final-text seat |
| Model/Tempo smoke | Exact OpenAI sentinel at canonical payload and raw-final text; 13 unique-service traces queryable before dispatch |
| Smoke backend honesty | Tempo HTTP 200 with `completedJobs=1`, `inspectedBytes=39177`, missing `totalBlocks`; retained as `partial` and `countAuthority=false` |

The exact workflow reads Ronan's local gateway token before connecting to the
specified loopback URL, so the isolated gateway used that token without changing
the live config. This was classified before proof traffic.

## Project-81 artifact

| Field | Value |
|---|---|
| Run | [32981265676](https://github.com/karmaterminal/karmaterminal-openclaw-docs/actions/runs/32981265676) |
| Workflow head | `821ad107e5ef8e2d5b2bb9dc74da6a9c9e177512` |
| Product/runtime input | `a5db13ad6297721cbf43af445d5a4a9b9bb0ad67` |
| Conclusion | `failure` |
| Artifact | ID `9612027467`, `project81-k6-proof-32981265676`, 122 files |
| Downloaded checksum manifest | SHA-256 `d0629ab10de68c25d1aa99f1f63dd829eff7b9a761554b39746578575c062d63` |
| Harness provenance | Verified matrix `20260826T143618Z-821ad107e5ef-556f28f9`; runner SHA-256 `bbf6edad8a853852d2de5cdd61857dbb11144f7537e2ffea70d8e7e48ae41081` |
| Workflow seat readiness | `PASS-candidate`; receipt SHA-256 `1d79822be4f5e3bcaff9b6d14aec83be64e0b5366eb635739233915a35498400` |

Every copied row manifest and scenario matches the digest in its row-scoped
runner metadata. The two signed receipts were independently HMAC-validated with
the gateway key and retained their `PARTIAL-candidate` verdicts.

### `R-CD-2`

The behavioral half completed: `sessions.send` and the exact dispatch terminal
sentinel were bound to one successful run, a distinct silent wake occurred, and
the post-wake quiet gate saw no channel delivery. k6 reported zero behavioral
failures.

The signed receipt (SHA-256
`94fa0439efa6a28cf5e17ba51d64910566f73a204715499f11f4b62289c2db05`)
is `PARTIAL-candidate`, category `missing-continuation-topology`. A post-run
Tempo control found the row-bound dispatch/fire on the same trace and chain with
the current `openclaw.run` parent, but no originating
`openclaw.tool.execution` span. This is a product-observability failure, not
backend timing. It repeats predecessor run `32956764849` after partially proving
the current-parent cure.

Issue update:
[karmaterminal/openclaw#1251](https://github.com/karmaterminal/openclaw/issues/1251#issuecomment-5427241056).

### `R-CD-CHAINED-DEPTH-2`

Parent acceptance, child and grandchild identities, real depth 2, the recovery
wake, both descendant sentinels, and a valid typed-tool dispatch/fire trace were
present. The cured admission bytes persisted one target for depth 1 and two
targets (child plus root) for depth 2. Durable task and transcript controls show
the grandchild return and final child return both reached the root.

The model did not emit exact assistant sentinel `ROOT-CHAIN-ACK` before the
fresh 120-second root window expired, so row authority remains
`PARTIAL-candidate`. This is classified as harness/model acknowledgment rather
than recurrence of the predecessor's lost-ancestry producer bug.

Issue updates:
[karmaterminal/openclaw#1183](https://github.com/karmaterminal/openclaw/issues/1183#issuecomment-5427241293)
and
[#119](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/119#issuecomment-5427241734).

### `R-CD-TOKEN`

Candidate/runtime identity and raw-final-text gates passed. The cured queue path
created one managed delegate flow, spawned one delegate child, completed it, and
returned the exact sentinel once to the root. This is material improvement over
predecessor run `32956764849`, which had no durable delegate task.

The signed receipt (SHA-256
`0fed6eb18c482e5e079d852cc67f4571a387417f08973cc6eff3441b5cc668e6`)
remains `PARTIAL-candidate`, category
`incomplete-or-nonunique-lifecycle`: the delegate task is bound to the root
requester instead of the disposable origin child, so the row's authoritative
origin ledger sees zero matching delegates and no bound origin return. The
reason-bound dispatch and fire also exist on separate traces. Classification is
product accepted-child/origin binding plus trace propagation.

Issue update:
[karmaterminal/openclaw#1054](https://github.com/karmaterminal/openclaw/issues/1054#issuecomment-5427241512).

### `R-OBS-BACKEND-DISPOSITION`

The row is `PASS-candidate`. Its candidate envelope and local revalidation exit
green. Tempo and Loki each returned HTTP 200; both omitted `totalBlocks`, so both
interactions remain `partial`, aggregate `complete=false`, and
`countAuthority=false`. Both zero results are explicitly non-authoritative.
All four receipt controls, all rebind keys, and all required artifacts are
present. Candidate-envelope SHA-256 is
`bb272ef562d5dfe0fa792e431fd5c5427c09dffd2d55f522f2b48f31e368f9bf`;
backend receipt SHA-256 is
`9d740e55fc69c3ebeaae0dcce4b7ab703cfbdf980f50f29bfc7f512d76153025`.

Issue update:
[#517](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/517#issuecomment-5427241922).

## `R-CW-6`

The separate exact-candidate process-local fixture is `PASS-candidate` at
`maxChainLength=3`. It used the lane-local stable pnpm cache/store and created
its candidate-local frozen dependency tree outside `source/WORKTREES`.

All nine required files were reviewed:

- below-limit hop 2 and at-limit hop 3 scheduled;
- attempted hop 4 returned structured `chain-capped`;
- rejected-hop flow count stayed `2`, with no rejected durable row;
- persisted/reloaded count stayed `3`, and recovery rejected the same over-limit
  attempt;
- the real registered `continue_work` executor captured three elections and
  scheduled exactly two;
- selected delegate boundary performed one dispatch and one pre-spawn reject,
  with the rejected flow failed;
- candidate regression suite passed;
- disposable worktree/state cleanup passed;
- public-artifact safety passed.

The artifact directory contains exactly nine files. Its checksum-manifest
SHA-256 is
`197930ded7057aa30df37822d51f5b393769da9269f1a083ab8d223fbdc56524`.
The fixture records `hostToolchainHermetic=false`; lock/tree/version alignment is
proven, but host executable origin is not claimed.

## GitNexus tooling

The installed prebuilt fork is `karmaterminal/GitNexus` version `1.6.5`, path
`/home/figs/src/gitnexus/gitnexus`, fork SHA
`3c1e686edfc1acaac882927cada121ddd7c47bcc`, command SHA-256
`8309aeb6858023f5cb3ff4ae8416b64c1989e4fe04d82dd822964127ed1355ca`.
No index exists for exact candidate `a5db13ad...`; the available `openclaw`
index is unrelated and stale. No stock `npx`/npm substitute was used. Failure
classification therefore used the workorder's direct exact-source, durable DB,
transcript, and raw Tempo fallback.

## Cleanup

- Exact isolated PID/PGID/SID `3990716` was stopped only through
  `openclaw-proof-129388-cured-row-refire.service`; port `19892` is free and the
  process no longer exists.
- Live prince `openclaw-gateway.service` stayed active with PID `2272093`, start
  ticks `50957076`, and config SHA-256
  `541f1838b549ccf53199a5b00f3607bf05588c7721577c3efd6b0fd446ee799f`
  before and after.
- Foreign held proof service `openclaw-proof-a0aa4ec-hold.service` stayed
  active at PID `2498654`, start ticks `51871376`.
- Candidate dist hash remains
  `822b9665d27d463469edb70f034a96c0dc8cb3cefc9227865e653ce5ec5beae3`;
  product tracked state is clean.
- Private workflow downloads, logs, Tempo controls, isolated state, and fixture
  receipts are preserved outside the repository.
- `PROOFS/`, `PROOFS/INDEX.json`, docs `main`, product code, presentation,
  live-prince config/state, and supplemental observability rows are untouched.
- No PR was opened and no product issue was closed.

## Exact commands

```bash
gh workflow run project81-k6-proof.yml \
  --repo karmaterminal/karmaterminal-openclaw-docs \
  --ref codeagent/129388-cured-row-refire \
  -f rows=R-CD-2,R-CD-CHAINED-DEPTH-2,R-CD-TOKEN,R-OBS-BACKEND-DISPOSITION \
  -f candidate_sha=a5db13ad6297721cbf43af445d5a4a9b9bb0ad67 \
  -f runtime_build_sha=a5db13ad6297721cbf43af445d5a4a9b9bb0ad67 \
  -f dry_run=false \
  -f 'runner_labels_json=["self-hosted","ronan"]' \
  -f gateway_ws=ws://127.0.0.1:19892 \
  -f session_selector=main \
  -f seat_name=ronan-isolated-129388 \
  -f seat_class=raw-final-text \
  -f create_disposable_sessions=true \
  -f metrics_push=false \
  -f otel_service_name=ronan-isolated-129388-a5db13ad \
  -f gateway_unit=openclaw-proof-129388-cured-row-refire.service \
  -f 'tempo_traceql={ resource.service.name="ronan-isolated-129388-a5db13ad" }' \
  -f 'loki_logql={service_name="ronan-isolated-129388-a5db13ad"}'
```

```bash
XDG_CACHE_HOME=<lane-stable-cache> \
PNPM_CONFIG_STORE_DIR=<lane-stable-store> \
node tools/k6-proofs/scripts/run-max-chain-fixture.mjs \
  --source-dir <clean-exact-a5db13ad-worktree> \
  --candidate-sha a5db13ad6297721cbf43af445d5a4a9b9bb0ad67 \
  --artifact-dir <new-empty-mode-0700-private-directory> \
  --max-chain-length 3 \
  --json
```
