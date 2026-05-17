# R-SDPP-1 — skill-dispatch policy pipeline via resolveSkillDispatchTools

**SHA**: `581678f4378427a336c5ac0cf2698cb36e5de9a0`
**Build-info on host**: `OpenClaw 2026.5.17 (581678f)`, `build-info.json` commit `581678f4378427a336c5ac0cf2698cb36e5de9a0`, builtAt `2026-05-17T23:03:08.758Z`
**Fire by**: 🌫 silas-seat (`urudyne`)
**Re-fire of cure-(10)/(11)**: re-fired at cure-(12) candidate deploy to confirm the policy seam survived the cure-(12) Mantis/continue_work fold.

## Claim under test

Cure-(12) preserves the adopted upstream `resolveSkillDispatchTools` policy seam in `src/auto-reply/reply/get-reply-inline-actions.ts`. Skill-command dispatch that targets a tool must still resolve the tool through `resolveSkillDispatchTools` rather than bypassing owner/group/subagent policy resolution.

## Method

1. Confirmed live `/status` reports `OpenClaw 2026.5.17 (581678f)`, context `164k/1.0m (16%)`, queue `steer`. Later fleet status cards showed the active primary model varied by seat; this proof depends on build SHA + deployed bundle bytes, not primary-model pin.
2. Confirmed deployed `dist/build-info.json` commit is `581678f4378427a336c5ac0cf2698cb36e5de9a0`.
3. Located deployed runtime bundle `dist/get-reply-Bon0g1Wv.js`.
4. Byte-extracted the `resolveSkillDispatchTools` call site and surrounding skill-command dispatch context.

## Evidence

Full bundle context: [`deployed-bundle-context.txt`](./deployed-bundle-context.txt).

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
```

## Verdict

✅ Adoption preserved at cure-(12) deploy SHA.

## proofs-SHA == push-SHA invariant

`581678f4378427a336c5ac0cf2698cb36e5de9a0` (build-info.json) == `581678f4378427a336c5ac0cf2698cb36e5de9a0` (cure-(12) ship candidate at proofs-fire time).
