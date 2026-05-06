# SEAL BOY 🌊🩲💦 SWIM 6 — Test Protocol
*Three-layer architecture canary — build `3a03f4658`*

## 1. Wake routing
- [ ] Trigger CONTINUE_WORK → verify follow-up turn preserves chain state
- [ ] Trigger silent-wake delegate return → verify parent wakes as continuation, not user input
- [ ] Trigger non-silent delegate return → verify announce turn preserves continuation state

## 2. Queue-drain resistance
- [ ] While delegate in flight, force unrelated normal turn that drains system events
- [ ] When delegate returns, verify it still classifies as delegate-return wake
- [ ] Confirm no behavior depends on `[continuation:delegate-pending]` or `[continuation:delegate-returned]` surviving in prompt text

## 3. Post-compaction lifecycle
- [ ] Register `continue_delegate(..., mode: "post-compaction")` before compaction
- [ ] End turn without compacting → verify shard survives
- [ ] Force compaction → verify:
  - [ ] `[system:post-compaction]` is injected
  - [ ] Workspace boot context is injected
  - [ ] Persisted post-compaction delegates are released once
  - [ ] Session store clears `pendingPostCompactionDelegates`

## 4. Return-to-fresh-session path
- [ ] Have post-compaction shard return after compaction
- [ ] Verify fresh main session receives enrichment and continues from compacted state
- [ ] Confirm return is silent unless explicitly configured otherwise

## 5. Context-pressure lifecycle
- [ ] Set threshold < 0.90 → verify ordered firing across threshold, 90, 95
- [ ] Set threshold > 0.90 (e.g. 0.94) → verify fires 94 then 95, never 90
- [ ] Compact session → verify advisories re-arm on next climb

## 6. Legacy-token hygiene
- [ ] Inspect queued system events after delegate return
- [ ] Verify stale `[continuation:delegate-returned]` markers are not retained or shown to model
- [ ] Verify model-visible context still includes descriptive events (enrichment return, post-compaction lifecycle)

## 7. Observability
- [ ] Watch for: `continuationTrigger: "work-wake"`, `continuationTrigger: "delegate-return"`, `[system:post-compaction]`
- [ ] Confirm no unexpected channel echoes for silent or post-compaction delegate flows

## 8. Failure cases
- [ ] Reject or fail post-compaction delegate spawn → verify session remains stable
- [ ] Force direct announce delivery failure → verify fallback behavior works
- [ ] Verify no later human message is misclassified as continuation wake

## Success criteria
- Wake classification is metadata-driven
- Post-compaction delegates survive across turns and release exactly once
- Compaction re-arms pressure advisories
- Legacy control tokens are no longer required for correctness
