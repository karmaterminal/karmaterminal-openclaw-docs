# R-CW-5: pass at `8ba08c76d8`

Cost-cap exhaustion, proved by the isolated exact-candidate typed-tool fixture (`tools/k6-proofs/docs/R-CW-5-ISOLATED-TOOL-SURFACE.md`). `continue_work` is intentionally not externally invocable through the gateway loopback.

- **Verdict:** fixture `PASS-candidate`, exit 0. Reviewed by frond-scribe: matrix, dispatch, tool surface and no-rejected-hop-spawn are all true; source clean before and after; worktree integrity held before install, after install and after execution.
- **Identity:** candidate `8ba08c76d8f74a63238f2ce79302168748c31965` (a clean detached checkout); docs/harness `94f63c05df362c8a89754d611b90789dd5eaf1df`; pnpm 12.15.0 from the candidate's pin, run from the package's declared JS entry (docs#611); frozen-lockfile disposable install, removed afterwards.
- **Command:** `node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs --source-dir <clean P'> --candidate-sha 8ba08c76d8f74a63238f2ce79302168748c31965 --artifact-dir <private> --cap 100 --json`, on ronan, run `fixtures-8ba08c76-20261029T074803Z`.
- **Surfaces:** boundary matrix at cap 100 (99 and 100 allow, 101 rejects); the candidate's own dispatch cost-cap suite, selected by its own config and judged from Vitest JSON (5/5: below-cap and exact-cap spawn, over-cap rejects and marks the record failed); the typed-tool surface on the candidate's durable custody store (over-cap elections leave 0 custody records plus the cap notice; the below-cap control leaves exactly 1 queued `work` record).
- **Receipts:** `fixture-ronan/`. This fixture writes no separate public-safety receipt. frond-scribe scanned every copied file: no private paths and no credential-shaped strings.
