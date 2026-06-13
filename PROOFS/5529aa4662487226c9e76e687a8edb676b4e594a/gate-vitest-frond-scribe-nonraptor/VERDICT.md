# Gate-3g full-vitest — frond-scribe non-raptor evidence (5529aa4662)

**Verdict: GREEN-OR-EXPLAINED** (closes the vitest gate that is blocked seat-local on silas's raptor-lake i9-14900KS).

Ran on frond-scribe's non-raptor box against the deployed SHA `5529aa4662487226c9e76e687a8edb676b4e594a`:
- `pnpm build` -> EXIT 0 (green)
- `pnpm check` (typecheck+lint+guards) -> EXIT 0 (green)
- `pnpm test` (full vitest) -> EXIT 1: exactly **5 failing test files**, ALL pre-existing-upstream:
  - `src/agents/model-auth-markers.test.ts` (Vertex non-secret markers)
  - `src/agents/model-auth.test.ts` (Vertex ADC marker)
  - `src/agents/models-config.applies-config-env-vars.test.ts` (google-vertex ADC)
  - `src/agents/models-config.providers.implicit.discovery-scope.test.ts` (gcp-vertex-credentials)
  - `src/plugins/config-contracts.test.ts` (parallel-isolation flake; passes isolated)

**Classification: NOT-OURS, byte-airtight.**
1. The 5 fail IDENTICALLY on a clean `upstream/main` checkout (see `upstream-main-comparison-5-fails-preexisting.log`) — they are pre-existing upstream Vertex-ADC env-dependent tests (Google Application Default Credentials absent in local env).
2. The implicated source files (model-auth.ts, models-config.ts, model-auth-markers.ts) are byte-identical to upstream/main on this SHA (0 diff-lines).
3. ALL feature tests pass, including the critical **#974 continuation-parity-gate (10 tests green)** — the prior deploy-blocker, cleared by the back-merge.

silas's seat-local block is the raptor-lake worker-maglev gap: `run-vitest.mjs` threads `--no-maglev` to the primary vitest node but not the forks-pool workers (no execArgv inheritance) -> worker SIGSEGV on i9-14900KS. Harness gap (GH-issue-worthy), NOT a code failure.
