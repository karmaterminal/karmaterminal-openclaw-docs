# swim-42 deploy-rollout receipt — cael host

**Status**: ✅ post-deploy verified per cael-seat attestation (banked from runner-seat)

## Deploy run

- workflow: `deploy-gateway`
- run id: `25296154316` (retry after frond-scribe stash-rescue)
- repo: `karmaterminal/openclaw-bootstrap`
- conclusion: `success`
- target ref: `f39b8c9751` (canonical HEAD with all five v5.2 deploy-inbound PRs merged)

## Pre-roll context

The first cael deploy attempt was blocked by 3 modified tracked files in the live `~/flesh_beast_tmp/openclaw` checkout (canon: don't work in active openclaw runtime). Frond-scribe stashed the working tree with descriptive message `frond-scribe-2026-05-04: pre-deploy rescue stash` and retried. The 3 files were:

- `src/agents/tools/continue-delegate-tool.ts`
- `src/auto-reply/continuation/types.ts`
- `src/auto-reply/tokens.ts`

## Post-roll snapshot (cael-seat attestation)

- runtime checkout `Git @ f39b8c97` ✅ (matches deploy SHA, tip = `#576` merge commit)
- gateway PID rotated `295284 → 321567` at `18:08:40 PDT`
- SIGTERM clean shutdown of pre-roll process at `18:08:39 PDT`
- new gateway up at `18:08:45 PDT` (4.8s plugin load, 13 plugins)
- `openclaw status` reports `cael (10.0.0.148) app 2026.5.2 linux` — app banner correct
- `Continuation` row: `enabled · chain max 200 · fan-out max 500` — runtime substrate intact
- `agents.defaults.continuation` config readable on the post-roll gateway

## Journal observations

- only post-roll journal noise is the pre-existing `acpx.permissionMode=approve-all` security warning (banked-known config across fleet, not deploy-introduced)
- no rollback triggered

## Working-tree note

`openclaw status` `Update` row reads `git HEAD · dirty` because of the stash-rescued working tree (`stash@{0}: frond-scribe-2026-05-04: pre-deploy rescue stash`). The committed tree itself is cleanly on `f39b8c9751`. cael-seat plan: relocate the stashed work into a proper `git worktree` (per TOOLS.md worktree pattern), not recover into the live runtime tree.

## Verdict

Deploy succeeded on cael host. Version banner + runtime checkout HEAD both byte-aligned with target ref `f39b8c9751`. Continuation runtime substrate intact and readable post-roll. The stashed pre-deploy work is preserved and recoverable; cael-seat has the recovery plan.
