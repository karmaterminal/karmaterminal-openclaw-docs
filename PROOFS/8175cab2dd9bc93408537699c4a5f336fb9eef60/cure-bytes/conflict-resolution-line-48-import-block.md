# Cure-bytes / Conflict resolution at `src/auto-reply/reply/agent-runner-execution.ts` import-block

## Conflict produced by rebase

```typescript
<<<<<<< HEAD
import { isMessagingToolSendAction } from "../../agents/pi-embedded-messaging.js";
import { runEmbeddedPiAgent } from "../../agents/pi-embedded.js";
=======
import type { EmbeddedPiCompactResult } from "../../agents/pi-embedded-runner/types.js";
>>>>>>> 75a09beab5 (feat(continuation): context-pressure-aware continuation (continue_work / continue_delegate / request_compaction))
```

## Investigation

### Was each import actually referenced in the merged file?

| Import | Reference sites (post-merge) | Reference type | Keep? |
|--------|------------------------------|----------------|-------|
| `isMessagingToolSendAction` | line 2149 `isMessagingToolSendAction(name, args)` | static call | ✅ KEEP |
| `runEmbeddedPiAgent` (static) | lines 120, 123-127 ALL via `typeof import("../../agents/pi-embedded.runtime.js").runEmbeddedPiAgent` or dynamic-import; ZERO static call sites | type-only / dynamic from DIFFERENT path | ❌ DROP (unused → TS6133) |
| `EmbeddedPiCompactResult` | line 157 `compactionResult: EmbeddedPiCompactResult` | type alias | ✅ KEEP |

### Verification of `runEmbeddedPiAgent` removal-by-PR

```
$ git show f98255262d:src/auto-reply/reply/agent-runner-execution.ts | grep -n "runEmbeddedPiAgent"
118:  ReturnType<typeof import("../../agents/pi-embedded.runtime.js").runEmbeddedPiAgent>
121:async function runEmbeddedPiAgentDefault(
122:  ...args: Parameters<typeof import("../../agents/pi-embedded.runtime.js").runEmbeddedPiAgent>
124:  const { runEmbeddedPiAgent } = await import("../../agents/pi-embedded.runtime.js");
125:  return await runEmbeddedPiAgent(...args);
1927:              const result = await runEmbeddedPiAgentDefault({
```

PR-head version has **zero static-import** of `runEmbeddedPiAgent`. Our PR's `feat(continuation)` commit migrated all references to dynamic import from `pi-embedded.runtime.js` (different path than upstream's static import from `pi-embedded.js`).

## Final resolution

```typescript
import { isMessagingToolSendAction } from "../../agents/pi-embedded-messaging.js";
import type { EmbeddedPiCompactResult } from "../../agents/pi-embedded-runner/types.js";
```

## Initial mistake + correction trail

1. **First resolution** (CANDIDATE `13e52e7ddc`): kept all 3 imports. Gate 3b (`pnpm tsgo`) FAILED with TS6133 `'runEmbeddedPiAgent' is declared but its value is never read`.
2. **Investigation**: per-import-usage check + PR-head provenance walk surfaced that our PR deliberately removed the static import. Stale-resolution-by-me — I conflated "appears in the file" with "static-imported reference."
3. **Corrected resolution** (CANDIDATE `8175cab2dd`): drop unused `runEmbeddedPiAgent` import. Gate 3b ✅.

The correction was amended onto commit 3 (`test(codex)`) not commit 1 (`feat(continuation)`) where it logically belongs. Semantic feature-bytes preserved; commit-boundary cleanup deferred to cohort discretion before force-push.
