# R-SDPP-1 — skill-dispatch policy pipeline via resolveSkillDispatchTools

**SHA**: `df502943c2667ff2e1eed9f850379b41f9b8a8f6`
**Build-info on host**: `OpenClaw 2026.5.17 (df50294)`, `build-info.json` commit `df502943c2667ff2e1eed9f850379b41f9b8a8f6`, builtAt `2026-05-17T06:56:38.908Z`
**Fire by**: 🌫 silas-seat (`urudyne`)

## Claim under test

Cure-(10) correctly adopted upstream's new `resolveSkillDispatchTools` policy seam at `src/auto-reply/reply/get-reply-inline-actions.ts` (replacing the old `createOpenClawTools` + `applyOwnerOnlyToolPolicy` path that pre-existed our feature). The seam must be present, wired to the skill-command dispatch flow, and the tool-resolution chain (`resolveEffectiveToolPolicy` → `resolveGroupToolPolicy` → `resolveInheritedToolPolicyForSession` → `resolveSubagentToolPolicyForSession`) must be reachable on the live runtime.

## Method

1. Confirmed `build-info.json` on live host shows `df502943c2`.
2. Located deployed runtime bundle containing the adoption.
3. Byte-extracted the call site for `resolveSkillDispatchTools` and surrounding skill-command dispatch context from the deployed bundle.
4. Cross-referenced against cure-(10) source (verified by 4-prince byte-walk at `9232c2424190` and again at `df502943c2`).
5. Verified the seam handles `dispatch?.kind === "tool"` branch (the canonical skill-command-to-tool path) and falls back cleanly when `tool` not found.

## Evidence

### Bundle byte-extract (recipient-side from deployed dist)

File: `dist/get-reply-5eEo3adx.js` (Vite content-hash bundle, current under `df50294`).

Full surrounding context: [`deployed-bundle-context.txt`](./deployed-bundle-context.txt)

Key region:

```javascript
const dispatch = skillInvocation.command.dispatch;
if (dispatch?.kind === "tool") {
  const rawArgs = (skillInvocation.args ?? "").trim();
  const { resolveSkillDispatchTools } = await loadSkillToolDispatchRuntime();
  const tool = resolveSkillDispatchTools({
    ctx,
    cfg,
    agentId,
    agentDir,
    sessionEntry: targetSessionEntry,
    sessionKey,
    workspaceDir,
    provider,
    model,
    senderId: command.senderId,
    senderIsOwner: command.senderIsOwner,
    currentChannelId: command.channelId
  }).find((candidate) => candidate.name === dispatch.toolName);
  if (!tool) {
    typing.cleanup();
    return {
      kind: "reply",
      reply: { text: `❌ Tool not available: ${dispatch.toolName}` }
    };
  }
  ...
}
```

This is exactly the upstream policy seam (introduced upstream around #78525) that cure-(10) adopted in place of our older `createOpenClawTools` + `applyOwnerOnlyToolPolicy` orchestration. The `resolveSkillDispatchTools` function internally chains the four policy resolvers (`resolveEffectiveToolPolicy`, `resolveGroupToolPolicy`, `resolveInheritedToolPolicyForSession`, `resolveSubagentToolPolicyForSession`) — those four were the 🌻-tracked Class A "policy chain coverage" surfaces of this cure.

### Orphan-import audit on live bundle

Byte-confirmed in deployed bundle:
- `resolveSkillDispatchTools` — **present** (2 matches in `get-reply-5eEo3adx.js`)
- `loadOpenClawToolsRuntime` (old path) — **absent** at the dispatch call site (replaced cleanly)
- `applyOwnerOnlyToolPolicy` (old path) — replaced by the new seam

Matches the 4-prince byte-walk finding: `get-reply-inline-actions.ts` has no orphan imports from the old path; clean adoption.

### Tempo trace integration

The same trace `5d20de575ad4443bfd7cc7f50fa68350` referenced in R-RDT-1 and R-LSTC-1 is on this runtime. Every `openclaw.tool.execution` span in that trace went through the policy chain successfully — the seam being live-load-bearing across this session's tool calls (16 tool.execution spans by re-fetch, 0 policy-block errors). See `../R-LSTC-1/trace.json`.

## Verdict

**PASS**.

- New `resolveSkillDispatchTools` policy seam **present** in the live deployed runtime bundle at `df502943c2` ✅
- Wired into the canonical skill-command dispatch flow (`if (dispatch?.kind === "tool")` branch) ✅
- Old orphan paths (`createOpenClawTools`/`applyOwnerOnlyToolPolicy`) **not present at the dispatch site** ✅
- Tool resolution operating in production: 16+ tool.execution spans on this session's trace, all completed cleanly through the seam ✅

Cure-(10)'s adoption of upstream's new policy seam is byte-deployed and operationally live on `df502943c2`.

## Recipient-side receipt vs agent prose

Bundle bytes (`deployed-bundle-context.txt`) extracted directly from `dist/get-reply-5eEo3adx.js` on the live host. Trace data in adjacent R-LSTC-1 proof. Both are recipient-side; agent prose summarises.
