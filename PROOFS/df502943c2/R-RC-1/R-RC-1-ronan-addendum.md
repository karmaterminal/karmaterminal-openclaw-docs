# R-RC-1 ronan-seat addendum: tool-success / provider-failure split

**Candidate SHA**: `df502943c2667ff2e1eed9f850379b41f9b8a8f6`  
**Build pin**: `OpenClaw 2026.5.17 (df50294)`  
**Service**: `ronan-prince`  
**Fired at**: 2026-05-17T00:12:32-07:00 PDT  
**Traceparent**: `00-e8284b1601059489cc1aa84a86cbcc97-cebb3479ad86e234-01`  
**compactionRequestId**: `cmp-mp9ftz0m-tMwgmA`

## What happened

1. `request_compaction(reason="R-RC-1 PROOF-FIRE...")` — accepted by runtime, returned `status=compaction_requested, trigger=volitional, contextUsage=145%`
2. Pre-staged `continue_delegate(mode="post-compaction")` — accepted, returned `status=queued-for-compaction`
3. After turn-end, runtime attempted compaction → **provider error**:
   ```
   [system:compaction-failed] Volitional compaction request cmp-mp9ftz0m-tMwgmA failed
   code=provider_error_4xx
   reason=Turn prefix summarization failed: 400 bad request: missing Editor-Version header for IDE auth
   ```
4. Post-compaction lifeboat delegate stays pending.

## Why this is still useful evidence

This proves a **clean separation** between cure-(10)'s code and downstream provider configuration:

- **Cure-(10) substrate worked**: tool accepted, traceparent issued, compaction queued, lifeboat staged
- **Provider config failed**: GitHub Copilot's summarization endpoint rejected the call due to missing `Editor-Version` header — a provider auth-token configuration issue unrelated to PR #79925

The `request_compaction` tool fire pathway in cure-(10) operates correctly. The failure surface is upstream of any continuation-feature code: it's at the model provider's summarization endpoint, which is independent of `agent-command.ts` / `attempt-execution.ts` / `skill-tool-dispatch.runtime.ts` (the cure-(10) conflict-resolution surfaces).

## Pair with 🌫's R-RC-1 main proof

🌫 silas-seat fired the same row organically at 136% context and the compaction SUCCEEDED on his Pool (different `github-copilot:github` auth token). Same cure-(10) code, different provider auth — silas auth path worked, ronan auth path hit the Editor-Version 4xx.

The cure-(10) code is clean. The auth-token-pool issue is operational, not a continuation-feature regression.
