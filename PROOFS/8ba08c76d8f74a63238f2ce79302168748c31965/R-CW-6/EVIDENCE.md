# R-CW-6: pass at `8ba08c76d8`

Max-chain boundary, proved by the isolated process-local fixture (`tools/k6-proofs/docs/R-CW-6-ISOLATED-MAX-CHAIN.md`).

- **Verdict:** fixture `PASS-candidate`, exit 0. Reviewed by frond-scribe: all 14 checks true, `privateDiagnosticsRetainedFor` empty, public-artifact safety passed.
- **Identity:** candidate `8ba08c76d8f74a63238f2ce79302168748c31965` (a clean detached checkout, still clean afterwards); docs/harness `94f63c05df362c8a89754d611b90789dd5eaf1df` (main, with docs#610 and #611); pnpm 12.15.0 from the candidate's pin, in a fresh disposable install worktree with a frozen lockfile, removed afterwards.
- **Command:** `node tools/k6-proofs/scripts/run-max-chain-fixture.mjs --source-dir <clean P'> --candidate-sha 8ba08c76d8f74a63238f2ce79302168748c31965 --artifact-dir <private> --private-dir <private> --max-chain-length 3 --json`, on ronan, run `fixtures-8ba08c76-20261029T074803Z`.
- **Surfaces:** boundary matrix (1→2 allow, 2→3 allow, 3→4 chain-capped); the selected delegate boundary at max 3 (dispatched 1, rejected 1, only the accepted task spawned, rejected custody record failed for chain-capped, a trusted cap notice on the owner queue); the candidate's own chain-depth suite in the database-worker lane; the runtime structured chain-capped hop; durable recovery (no recovered attempt scheduled); the typed `continue_work` surface.
- **Receipts:** `fixture-ronan/` (every file the fixture declares public-safe, plus the runner's JSON stdout).

The `293c977f62` lane fire (docs#610) was PASS-candidate too; it is historical and not carried.
