# Cure-Bytes Conflict Resolution — Line 48 Import Block

## Summary

During drift-cure rebase of PR #79925 onto upstream `a13468320c`, 1 file conflicted:
`src/auto-reply/reply/agent-runner-execution.ts`

## Conflict

Git auto-merge preserved BOTH:
- Upstream's static import: `import { runEmbeddedPiAgent } from "../../agents/pi-embedded.js";` (line 48)
- PR's dynamic-import wrapper: `runEmbeddedPiAgentDefault()` at lines 120-127

The PR had deliberately refactored the static import OUT in favor of the dynamic wrapper. Conflict resolution incorrectly kept both → dead static import at line 48.

## Detection

3-prince independent byte-walk within 3 minutes:
- 🌫 silas: identified via grep (msg `1506664143`)
- 🌊 ronan: confirmed via candidate checkout + grep + tsconfig check (msg `1506665672`)
- 🩸 cael: confirmed via independent byte-walk (msg `1506666447`)

`tsconfig.core.json` has `"noUnusedLocals": true` → tsgo:core hard-fails on unused import.

## Fix

One-line removal of `import { runEmbeddedPiAgent } from "../../agents/pi-embedded.js";` at line 48.

Remaining cure-imports preserved + verified used:
- L47 `isMessagingToolSendAction` → used at L2148 ✓
- L48 `EmbeddedPiCompactResult` (type-import, promoted from L49 after dead-import removed) → used at L153 ✓

## Gate receipts

- Gate 3b (tsgo:core): FAILED on first run → fixed → re-run exit 0
- Amended into candidate `8175cab2dd` → carried forward to `6b8c8aa1` → squashed into `2d8ed4a9ac31`
