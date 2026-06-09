# R-CD-3 — timeout-compaction failover (deployed `9b1f42a694`)

✅ **16/16 PASS** — `src/agents/embedded-agent-runner/run.timeout-triggered-compaction.test.ts`, sanctioned runner /tmp worktree on `9b1f42a694`.
2× rotation asserted: `toHaveBeenCalledTimes(2)` at :176/:213/:343/:366/:394/:463/:568/:577/:611/:612.
Safety-byte: `run.ts` `compactionFailureContext` count = **0** (Form B, upstream-faithful; never 4 = the 1× catastrophe).
R-CD-3 is a RE-RUN here (the reorg moved files → re-verify on the deployed tree), not a re-point.
Honest scope: the deployed-runtime behavioral fire (live timeout-during-compaction on the running gateway, end-to-end) is harder to trigger on-demand; the 16/16 vitest on the deployed tree + count-0/2×-rotation is the gate-grade verification. Live runtime-trigger = deferred-if-wanted.
