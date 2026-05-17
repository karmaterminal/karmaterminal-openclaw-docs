# R-SDPP-1 — skill-dispatch policy pipeline via resolveSkillDispatchTools

**SHA**: `52262fff7ff86b2c0fb0266a1f524067e84e1412`
**Build-info on host**: `OpenClaw 2026.5.17 (52262ff)`, `build-info.json` commit `52262fff7ff86b2c0fb0266a1f524067e84e1412`, builtAt `2026-05-17T19:03:53.295Z`
**Fire by**: 🌫 silas-seat (`urudyne`)
**Re-fire of cure-(10)**: re-fired at ship-SHA post-rebase to confirm the policy seam was preserved through cure-(11) rebase + UNION-T-3 fold.

## Claim under test

Cure-(11) preserves cure-(10)'s adoption of upstream's `resolveSkillDispatchTools` policy seam at `src/auto-reply/reply/get-reply-inline-actions.ts` (the seam that replaced the older `createOpenClawTools` + `applyOwnerOnlyToolPolicy` path). The seam must still be present in the v7 squashed bundle, wired to the skill-command dispatch flow, with the four-layer policy resolution chain (`resolveEffectiveToolPolicy` → `resolveGroupToolPolicy` → `resolveInheritedToolPolicyForSession` → `resolveSubagentToolPolicyForSession`) reachable on the live runtime.

## Method

1. Confirmed `build-info.json` on live host shows `52262fff7ff86b2c0fb0266a1f524067e84e1412`.
2. Located deployed runtime bundle: `dist/get-reply-CXJU5Jn0.js` (Vite content-hash bundle, current under `52262ff`).
3. Byte-extracted the call site for `resolveSkillDispatchTools` and surrounding skill-command dispatch context from the deployed bundle.
4. Cross-referenced against cure-(10) `df502943c2` byte-extract — region is byte-identical (no regression introduced by squash + UNION-T-3 fold).
5. Verified the seam handles `dispatch?.kind === "tool"` branch (the canonical skill-command-to-tool path) and falls back cleanly when `tool` not found.

## Evidence

### Bundle byte-extract (recipient-side from deployed dist)

File: `dist/get-reply-CXJU5Jn0.js` (Vite content-hash bundle, current under `52262ff`).

Full surrounding context: [`deployed-bundle-context.txt`](./deployed-bundle-context.txt) (65 lines, captured from live bundle on urudyne).

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

Byte-identical to the cure-(10) `df502943c2` extract in `../df502943c2/R-SDPP-1/deployed-bundle-context.txt` (different bundle filename due to Vite content-hash rotation: `get-reply-5eEo3adx.js` → `get-reply-CXJU5Jn0.js`, but source-bytes preserved).

This is exactly the upstream policy seam (introduced upstream around #78525) that cure-(10) adopted in place of our older `createOpenClawTools` + `applyOwnerOnlyToolPolicy` orchestration. The `resolveSkillDispatchTools` function internally chains the four policy resolvers (`resolveEffectiveToolPolicy`, `resolveGroupToolPolicy`, `resolveInheritedToolPolicyForSession`, `resolveSubagentToolPolicyForSession`).

## Verdict

✅ Adoption preserved through cure-(11) rebase and v7 squash + UNION-T-3 fold.

## proofs-SHA == push-SHA invariant

`52262fff7ff86b2c0fb0266a1f524067e84e1412` (build-info.json) == `52262fff7ff86b2c0fb0266a1f524067e84e1412` (PR #79925 head at proofs-fire time).
