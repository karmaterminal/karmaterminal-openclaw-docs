# PROOFS / a726a815afa22cadb429ec89eafd552170f216f6 / METHOD

## What is being proved

Cure-(20)v3 ship-candidate `a726a815afa22cadb429ec89eafd552170f216f6` — the current PR head of [openclaw/openclaw#79925](https://github.com/openclaw/openclaw/pull/79925).

- Single squashed commit on `upstream/main@d124c5aa20` (at squash time)
- Continuation feature (`continue_work` / `continue_delegate` / `request_compaction`) shipped with all gates green and all conflict-resolution audited at byte.

## Why this corpus exists at this SHA

`proofs-SHA == push-SHA` invariant. Proofs validate runtime behavior at the exact SHA on the PR head — `a726a815af`. ClawSweeper's review gate expects current-head linked-artifact-path resolution and current-head real-behavior-proof; this corpus is fresh evidence at that SHA.

## Methodology

1. **Deploy** the candidate SHA to 4 hosts via `deploy-gateway.yml` (4/4 clean; see `deploy-validation/EVIDENCE.md`).
2. **Fire** real continuation tool invocations from each host's runtime against deployed bytes (not simulated, not mocked).
3. **Capture** W3C traceparents per fire — single trace-id-per-turn invariant validates gateway's continuation-trace-scope at v3. Tempo server-side traces stitched where available.
4. **Bank** per-row artifacts at `PROOFS/a726a815afa22cadb429ec89eafd552170f216f6/<row-class>/` with `EVIDENCE.md` + raw artifacts.
5. **Cross-validate** runtime-identical-attest chain: 24 continuation-load-bearing files have zero hunks between original cure-13 squash and current head (per [docs PR #84](https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/84) Appendix A).

## Pre-deploy gates

- **Savegame**: pre-force-push state preserved on `karmaterminal/openclaw` savegame branches before each force-push.
- **Byte-empty tree-diff**: each squash verified `git diff <pre>..<post>` empty → `proofs-SHA == push-SHA` invariant satisfied.
- **Type + lint + tests**:
  - `pnpm tsgo:core` exit 0
  - `pnpm tsgo:test` exit 0
  - `pnpm lint` (sharded oxlint scripts + core + extensions) 0/0/0
  - `pnpm test --run src/agents/subagent-registry.test.ts` 29/29 PASS
  - `pnpm test` FULL (16 workers / 32 GB heap): zero candidate-introduced deterministic failures; 9 timing flakes (pass on re-run); 1 pre-existing baseline upstream failure (`cli-runner.reliability.test.ts > does not emit llm_output when the CLI run returns no assistant text`), verified failing on pristine `upstream/main@721ad1587a` — not introduced by this PR.
- **Cohort byte-walk**: 4 independent byte-walks of the candidate SHA against `upstream/main` confirmed no conflict markers, no missing continuation surface, correct conflict resolution.

## Notes on this SHA's substrate

This candidate is the result of:

- Drift-rebase onto current `upstream/main`, absorbing recent upstream commits orthogonal to continuation.
- Restoration of several files that had been accidentally removed from earlier feature-squash iterations and which `upstream/main` still carries (orthogonal to continuation surface):
  - `src/flows/doctor-health-contributions.ts`
  - `src/flows/doctor-repair-flow.ts` / `.test.ts`
  - `src/commands/doctor-session-snapshots.ts` / `.test.ts`
- Test-expectation updates in `src/agents/subagent-registry.test.ts` to match an intentional change in sweep policy for the continuation delegate lifecycle (cure-introduced; tests now assert the new TTL-based behavior using `cleanupCompletedAt`).
- Adoption of an upstream flake-fix in `src/cli/config-cli.test.ts` (the `normalizedHelp` regex-replace approach to tolerate Commander line-wrapping).

None of these touch the 24-file continuation surface that `proofs-SHA == push-SHA` invariant pins.

## See

- [`README.md`](./README.md) — corpus overview + row inventory + ClawSweeper-facing index
- [PR #79925](https://github.com/openclaw/openclaw/pull/79925)
- [Cure-13 baseline PROOFS](../718d8558eb618304b5cc43c8a3b5d93ff5bef454/)
- [Docs PR #84 — runtime-identical-attest](https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/84)
