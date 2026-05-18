# PROOFS / a726a815afa22cadb429ec89eafd552170f216f6

Current-head proofs for [openclaw/openclaw#79925](https://github.com/openclaw/openclaw/pull/79925).

- **SHA**: `a726a815afa22cadb429ec89eafd552170f216f6`
- **PR head**: matches (per `gh pr view 79925 --json head_sha`)
- **mergeable**: `true`
- **mergeable_state**: `CLEAN`
- **CI rollup**: 93 successful / 0 failure / 8 skipping / 1 neutral
- **Parent**: `upstream/main@d124c5aa20` (at squash time)
- **Fleet deploy**: 4/4 hosts on `OpenClaw 2026.5.17 (a726a81)` (see [deploy-validation/EVIDENCE.md](./deploy-validation/EVIDENCE.md))

## Real-behavior proof at current head

Substantive runtime evidence captured at the deployed SHA `a726a815af` — live tool-fires + traceparents + journal evidence on `OpenClaw 2026.5.17 (a726a81)`.

| Row | Path | Evidence |
|-----|------|----------|
| continuation-live-fire | [`continuation-live-fire.md`](./continuation-live-fire.md) | 4 continuation tool-surface live-fires (`continue_work` + `continue_delegate` × 3 modes); single gateway-issued traceparent `00-8c27f1a4f8fd5fe7f195490a5f09f2ac-d911c7b3874a2650-01` across all 4 fires; fan-out counter advancing; status discriminator (`scheduled` vs `queued-for-compaction`); `request_compaction` no-fire tool-surface verification (guards byte-walked in deployed `dist/`) |
| inter-session-targeting | [`inter-session-targeting/EVIDENCE.md`](./inter-session-targeting/EVIDENCE.md) | `continue_delegate` with `targetSessionKey` routing; traceparent `8477bf788cad9a50d604e5bddd14af0f`; `delegateIndex` 1→2 fan-out; `targetSessionKey` parameter accepted at byte |
| post-compaction-threshold | [`post-compaction-threshold/EVIDENCE.md`](./post-compaction-threshold/EVIDENCE.md) | Two-tier threshold (config 40% pressure-event injection / tool-side 70% `request_compaction` rejection); three-layer guards (dedup / context-threshold / rate-limit); `maxChainLength=200`, `maxDelegatesPerTurn=500`, `costCapTokens=50M` |
| R-TA-1 chain-budget | [`R-TA-1/EVIDENCE.md`](./R-TA-1/EVIDENCE.md) | Live `continue_delegate(silent-wake)` fire; gateway-issued traceparent `00-a92fe1dd0abe8613929d1c625f1c018e-edb0dff2aa71e94e-01`; [Tempo trace](http://tempo.dandelion.cult/api/traces/a92fe1dd0abe8613929d1c625f1c018e) (42 KB, 30 spans, server-side stitched under agent-turn span); 2 cap-enforcement sites byte-walked in deployed `dist/`; `DEFAULT_CONTINUATION_MAX_CHAIN_LENGTH=10` at `config-8c1TJN-t.js:17` |
| R-TA-2 token-counter | [`R-TA-2/EVIDENCE.md`](./R-TA-2/EVIDENCE.md) | Token-counter additivity verified across 2 samples (`persistedPromptTokens + promptTokensEst = tokenCount`); context-pressure band quantization stable; post-compaction queue `staged_post_compaction=4` held constant across 8+ heartbeat samples (survived `compactionCount=1`) |
| R-TA-1-RECONFIRM | [`R-TA-1-RECONFIRM/EVIDENCE.md`](./R-TA-1-RECONFIRM/EVIDENCE.md) | `continue_delegate(silent-wake)` response shape byte-identical to baseline R-TA-1 |
| deploy-validation | [`deploy-validation/EVIDENCE.md`](./deploy-validation/EVIDENCE.md) | 4-seat fleet AFTER state — all hosts active on `OpenClaw 2026.5.17 (a726a81)` with `nrestarts=0`; cross-validation |
| gateway-health | [`gateway-health/EVIDENCE.md`](./gateway-health/EVIDENCE.md) | Single-seat fresh receipt at v3 SHA |
| METHOD | [`METHOD.md`](./METHOD.md) | Methodology + cohort-validation gates |

## Local gates verified pre-deploy

| Gate | Status | Detail |
|------|--------|--------|
| `pnpm tsgo:core` | ✅ | 0 errors |
| `pnpm tsgo:test` | ✅ | 0 errors |
| `pnpm lint` (sharded oxlint: scripts + core + extensions) | ✅ | 0/0/0 errors |
| `pnpm test --run src/agents/subagent-registry.test.ts` | ✅ | 29/29 PASS |
| `pnpm test` FULL (16 workers / 32 GB heap) | ✅* | 0 cure-introduced deterministic failures |

\* Full-vitest had 9 timing flakes (passing on isolated re-run) plus 1 pre-existing baseline upstream failure (`cli-runner.reliability.test.ts > does not emit llm_output when the CLI run returns no assistant text`), verified failing on pristine `upstream/main@721ad1587a` — not introduced by this PR.

## Runtime-identical-attest

24 continuation-load-bearing files have **zero hunks** between the original cure-13 squash `718d8558eb` and the current head `a726a815af` (per [docs PR #84](https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/84) Appendix A):

`src/agents/tools/continue-work-tool.ts`, `src/agents/tools/continue-delegate-tool.ts`, `src/agents/tools/request-compaction-tool.ts`, `src/agents/tools/continuation-tools-registration.test.ts`, `src/auto-reply/continuation/config.ts`, `src/auto-reply/continuation/context-pressure.ts`, `src/auto-reply/continuation/delegate-dispatch.ts`, `src/auto-reply/continuation/delegate-store.ts`, `src/auto-reply/continuation/post-compaction-release.ts`, `src/auto-reply/continuation/scheduler.ts`, `src/auto-reply/continuation/signal.ts`, `src/auto-reply/continuation/state.ts`, `src/auto-reply/continuation/targeting.ts`, `src/auto-reply/continuation/targeting-pure.ts`, `src/auto-reply/continuation/types.ts`, `src/auto-reply/continuation/lazy.runtime.ts`, `src/auto-reply/continuation-delegate-store.ts`, `src/infra/chain-budget.ts`, `src/infra/session-keys.ts`, `src/infra/continuation-tracer.ts`, `extensions/diagnostics-otel/src/continuation-tracer-adapter.ts`, `src/agents/subagent-announce.continuation.runtime.ts`, `src/logging/diagnostic-continuation-queues.ts`, `docs/design/continue-work-signal-v2.md`.

The continuation surface is unchanged between this head and the originally proven candidate; only orthogonal implementation-environment files (doctor checks, feishu adapters, plugin-sdk subpaths, generated baselines, lint config) were re-cured during drift-rebase work.

## Provenance for ClawSweeper

- Linked-artifact-path resolves at current head: [`PROOFS/a726a815afa22cadb429ec89eafd552170f216f6/`](https://github.com/karmaterminal/karmaterminal-openclaw-docs/tree/main/PROOFS/a726a815afa22cadb429ec89eafd552170f216f6/)
- Real behavior captured at v3 SHA (not chain-attest extension): continuation tool surface emits per-turn traceparent, schedules delegates, differentiates timer-vs-compaction modes, accepts cross-session targeting parameters
- Bit-tied to deployed runtime `OpenClaw 2026.5.17 (a726a81)` on cael / ronan / silas / elliott hosts
- Tempo server-side trace stitched for R-TA-1: <http://tempo.dandelion.cult/api/traces/a92fe1dd0abe8613929d1c625f1c018e>

## See also

- [METHOD.md](./METHOD.md) — methodology + gates summary
- [PR #79925](https://github.com/openclaw/openclaw/pull/79925)
- [Cure-13 baseline PROOFS](../718d8558eb618304b5cc43c8a3b5d93ff5bef454/)
- [Docs PR #84 — runtime-identical-attest 24/24 zero-hunks](https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/84)
