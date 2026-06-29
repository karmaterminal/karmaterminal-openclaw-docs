# R-CD-4 — targetSessionKey / fanoutMode mutual-exclusion guard — rune-rog-ally

**Row:** R-CD-4 (#189)  
**Seat:** rune-rog-ally  
**Candidate / verified ref:** `575a46b61d4efeb4600ead64f13e63e1f9021d44`  
**Timestamp:** 2026-06-29T23:15Z  
**Verdict:** ✅ PASS — typed `continue_delegate` rejects an invalid targeting request that combines `fanoutMode` with `targetSessionKey` / `targetSessionKeys`.

## What was proven

This R-CD-4 row is the guard-side targeting proof. Explicit recipient addressing (`targetSessionKey` / `targetSessionKeys`) is mutually exclusive with structural broadcast (`fanoutMode=tree|all`). The invalid mixed request must fail at the tool/schema layer and must not enqueue/spawn a delegate.

This is not the positive targeted-return behavior proof; it is the invalid-combination rejection proof for the same targeting API family.

## Live receipt

I invoked the typed `continue_delegate` API with the invalid combination:

```json
{
  "mode": "silent",
  "targetSessionKey": "agent:main:discord:channel:1466192485440164011",
  "fanoutMode": "tree",
  "task": "R-CD-4-575a46b61d4e invalid-combination proof child SHOULD NOT SPAWN because fanoutMode+targetSessionKey must reject."
}
```

The tool returned the expected rejection:

```json
{
  "status": "error",
  "tool": "continue_delegate",
  "error": "fanoutMode cannot be combined with targetSessionKey or targetSessionKeys."
}
```

Full captured receipt: [`reject-receipt.json`](./reject-receipt.json).

## Source/test backing at candidate ref

Verified source worktree is exactly `575a46b61d4efeb4600ead64f13e63e1f9021d44` (`version-receipt.txt`). The guard is implemented in `src/agents/tools/continue-delegate-tool.ts` before enqueue:

```ts
if (fanoutMode && (targetSessionKey || (targetSessionKeys && targetSessionKeys.length > 0))) {
  throw new ToolInputError(
    "fanoutMode cannot be combined with targetSessionKey or targetSessionKeys.",
  );
}
```

Vitest proof executed on the candidate source tree:

```text
pnpm vitest run src/agents/tools/continue-delegate-tool.crosssession-gate.test.ts src/agents/tools/continue-delegate-tool.test.ts --maxWorkers 1 --no-fileParallelism
```

Result: `3 passed` test files, `60 passed` tests. Full log: [`vitest.log`](./vitest.log).

The relevant unit assertion is `continue-delegate-tool.crosssession-gate.test.ts` case 12: schema conflict takes precedence over cross-session policy rejection, and `consumePendingDelegates(DISPATCHING_SESSION)` remains `[]` (no enqueue).

## Artifacts

- [`EVIDENCE.md`](./EVIDENCE.md) — this proof summary.
- [`reject-receipt.json`](./reject-receipt.json) — live tool rejection receipt for `fanoutMode + targetSessionKey`.
- [`version-receipt.txt`](./version-receipt.txt) — exact candidate ref receipt.
- [`vitest.log`](./vitest.log) — passing vitest proof run.
- [`code-receipt.txt`](./code-receipt.txt) — source/test excerpts naming the guard.

## Final verdict

✅ **PASS** — On exact ref `575a46b61d4efeb4600ead64f13e63e1f9021d44`, `continue_delegate` rejects the invalid combination of `fanoutMode` with explicit recipient targeting (`targetSessionKey` / `targetSessionKeys`) with the expected error, before enqueue/spawn. Vitest coverage for the same guard passes (`60/60`).
