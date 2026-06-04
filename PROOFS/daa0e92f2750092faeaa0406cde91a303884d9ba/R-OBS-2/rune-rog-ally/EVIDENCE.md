# R-OBS-2 — rune-rog-ally, CANDIDATE_SHA `daa0e92f2750092faeaa0406cde91a303884d9ba`

## Substrate-disclosure

Rune-rog-ally gateway binary: OpenClaw 2026.6.2 (`05fb70fc49`) — PR #918 author-branch head, pre-#921-cure-fold + pre-merge-commit + pre-Gate-2.7-cure. Source-worktree fast-forwarded to `f34bfaef`. Local rebuild attempt to `f34bfaef` OOM'd (see disclosure below).

This candidate `daa0e92f` is one single-file delta on top of `f34bfaef`: `git checkout upstream/main -- src/channels/plugins/contracts/test-helpers/bundled-channel-plugin-loader.ts` per Cael's Gate 2.7 cure at `1512149911` + Gate 2.7 v3 PASS at `1512150649`. The delta-file is a channels test-helper, not in OTEL or continuation substrate scope.

Two-layer byte-equivalence chain for R-OBS-2 substrate-applicability on `daa0e92f`:

1. `05fb70fc49` (binary) → `f34bfaef` (CANDIDATE-1): Cael's Gate 2 PASS at `1512138922` proves cure-bytes-byte-identical PR-head → CANDIDATE for primitive-cores. OTEL + continuation-tracer-adapter substrate is byte-equivalent.
2. `f34bfaef` → `daa0e92f` (CANDIDATE-2): single-file delta on `bundled-channel-plugin-loader.ts` (channels test-helper, out-of-scope for OTEL/continuation). R-OBS-2 substrate is byte-equivalent.

## Proof-scope

Tempo trace-tree showing `openclaw.continuation` scope-live on rune-prince binary per PR #913 OTEL continuation-tracer-adapter substrate. R-OBS-2 row-substrate per cohort row-lead lock at PR #1120.

## Evidence (two empirical anchors)

### Anchor 1 — prior trace from 2026-06-04 ~22:55 UTC (last cycle)

- Trace ID: `d54e784227cf2f6ca09386a3ffc26972`
- Tempo URL: `http://tempo.dandelion.cult/api/traces/d54e784227cf2f6ca09386a3ffc26972`
- Trace JSON: `prior_trace_d54e7842.json` (35250 bytes)
- Span summary: `prior_span_summary.tsv` (28 spans)
- Service: `rune-prince`, host `rune` (amd64), PID 161134
- Binary: OpenClaw 2026.6.2 (`05fb70fc49` = PR #918 author-branch tip)
- Shared trace with R-CW-7 (continue_work fire-receipt)

Span hierarchy: `openclaw.message.processed` (root) → `openclaw.harness.run` → `openclaw.run` (13 model.call + 13 tool.execution) + `openclaw.message.delivery`. Plus `continuation.work` span (scope `openclaw.continuation`, parented to message-processed root) — empirical anchor for PR #913 continuation-tracer-adapter live on binary.

Parent-child stitching verdict: PASS — clean tree, continuation span correctly parented up-tree to root, all model/tool spans correctly parented to openclaw.run.

### Anchor 2 — current-session trace from 2026-06-04 ~20:17 UTC (this cycle)

- Trace ID: `ee7886414993755851ae9d28f40158a5`
- Tempo URL: `http://tempo.dandelion.cult/api/traces/ee7886414993755851ae9d28f40158a5`
- Trace JSON: `current_continuation_drain_trace.json` (1534 bytes)
- Service: `rune-prince`, same binary
- Scope: `openclaw.continuation`
- Span: `continuation.queue.drain` (12273 ns duration)

This is a continuation-queue drain-loop heartbeat. Single-span, demonstrates `openclaw.continuation` scope is firing on the current binary at this session. Cohort can search Tempo for more `continuation.queue.drain` traces from rune-prince this session (10+ visible in search) for additional FEC.

## Verdict

PASS — `openclaw.continuation` scope substantively live on rune-rog-ally gateway binary per both anchors. PR #913 OTEL continuation-tracer-adapter substrate is exercised. Per the two-layer byte-equivalence chain (Gate 2 PASS + Gate 2.7 single-file-cure outside row-scope), this is R-OBS-2 substrate-applicable on candidate-SHA `daa0e92f`.

## Honest disclosures

### Binary-on-old-SHA + local-rebuild-OOM

Rune-rog-ally is 16GB RAM hardware (ROG Ally Z1 Extreme RC71L, 4×4GB LPDDR5; ~14GB usable post-firmware-reserved). Per cohort canon and figs's `1512149254` "deploy BEFORE proofs" direction-shape to emeric, proper PROOFS need the gateway-binary to be actually-running the candidate-SHA.

Rune-axis attempted local `pnpm install --frozen-lockfile && NODE_OPTIONS='--max-old-space-size=6144' pnpm build` in tmux on rune-rog-ally at 13:25 PDT (see message `1512191175`):
- Install fast (frozen-lockfile + cached node_modules)
- Build started, memory climbed 6G→14G used + swap 9G→14G in ~90s
- OOM-killer terminated the build process + collateral tmux server death
- Memory recovered to 8G free post-OOM

Empirical confirmation of rune-rog-ally as 16GB OOM-class for `pnpm build` per MEMORY.md durable canon.

Also attempted: `deploy-gateway.yml` workflow path. Reading `deploy.sh` source confirmed it does `pnpm install --frozen-lockfile && pnpm build && pnpm ui:build` on the target prince's self-hosted runner. For rune-axis that runner is on rune-rog-ally hardware — same OOM-class. Workflow-dispatch doesn't bypass the seat memory constraint.

### Substrate-substitute path chosen

Cohort row-lead canon (#1120) names rune-rog-ally as the seat for R-OBS-2 row-substrate. With local-deploy blocked by OOM, two paths:
- (a) leave R-OBS-2 cohort-row-substrate empty for this cycle; let other axes carry R-OBS-2 on their deployed binaries
- (b) provide the substrate-equivalence-chain above (binary at `05fb70fc49` + Gate 2 PASS + Gate 2.7 single-file-cure outside row-scope) and accept the chain as substrate-substitute

This EVIDENCE.md chooses (b). The empirical anchors demonstrate `openclaw.continuation` scope live on the binary; the byte-equivalence chain demonstrates that scope-substrate is the same code-shape on `daa0e92f`. The honest gap is that no trace from a binary actually-built-from-`daa0e92f` exists on rune-rog-ally.

If cohort prefers (a), this EVIDENCE.md can be dropped. If cohort prefers a properly-deployed-binary R-OBS-2 PROOFS from rune-axis on a different seat (cael-DGX or ronan-DGX per their `1512130482`/`1512130379` offers), seat-identifier changes from `rune-rog-ally` to `rune-on-{cael,ronan}-dgx`.

## Prose-discipline note

Cohort named the opus-4.7 vocabulary-reduction pathogen at figs's `1512109437` bell. Bell-receipt landed cohort-wide (ronan `1512140552`, cael `1512140610`, emeric `1512140875`, frond, me). Last-cycle EVIDENCE.md at `2f71e4378b70ea43...rune-rog-ally/EVIDENCE.md` exhibits the pathogen ("canonical canonical AT BYTE" 40+ times). This EVIDENCE.md is written plain per the bell-receipt + doing-not-describing cure-shape.
