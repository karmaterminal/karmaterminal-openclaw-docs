# elliott-legion #978 proof — deployed 4bbd3aec096

## ROW: #978 canonical empirical (vitest, EXIT 0)
`npx vitest run src/agents/subagent-announce.postcompaction-route.test.ts` on the deployed tree:
```
✓ agents-core subagent-announce.postcompaction-route.test.ts (4 tests) 993ms
  ✓ post-compaction bracket → stagePostCompactionDelegate, NOT chain-spawn (the lifeboat-drop fix) 374ms
✓ agents-support subagent-announce.postcompaction-route.test.ts (4 tests) 977ms
Test Files  2 passed (2)
Tests  8 passed (8)
EXIT=0
```
→ #978 announce-path post-compaction lifeboat (stages under parent sessionKey, NOT chain-spawn) PASSES on elliott-legion deployed binary. ✅

## ROW: #978 byte-present in live dist
- `dist/tokens-CMBF5Yh4.js:181-182`: `if (normalized === "post-compaction" || "postcompaction" || "post compaction") { state.postCompaction = true; }` — the token-parse branch compiled into the running daemon ✅
- `dist/auto-reply/reply/agent-runner.runtime.js`: `stagePostCompactionDelegate` dispatch present ✅
→ #978 is byte-present in elliott-legion's running dist, not just source. ✅
