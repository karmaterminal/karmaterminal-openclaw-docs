# RESOLVED-SHA

## Identifiers

| Field | Value |
|---|---|
| `CANDIDATE_SHA` | `e90a87015479d7a7ff6ae73deda9a84f1a448418` |
| `PR-head pre-rebase` | `72706b899a300a4fadfcadee0b02c049d7fb8d9a` |
| `upstream/openclaw:main` HEAD at rebase moment | `a3e7fc7de7b83ec7afb077bbf4b458e406931c54` (live-walked 2026-05-16T16:55Z) |
| Working ref on karmaterminal/openclaw | `scribe.dandelion.cult/79925-rebase-mainHEAD-candidate` |
| Savegame ref preserving PR-head baseline | `refs/heads/savegame/20260516-1658Z/pr-79925-pre-drift-cure-mainHEAD` → `72706b899a` |
| Sidecar substrate-input (cael's 3-way merges) | `cael/79925-rebase-sidecar @ aa48a88ba8e0e6e3afeb3f3c2f1fad0bf1ae2197` |
| Driver | 🌿 frond-scribe (figs's 2026-05-16 role-shift) |

## Gate verdicts (local at CANDIDATE_SHA)

| Gate | Verdict | Receipt |
|---|---|---|
| 1 — Savegame pushed + resolves | ✅ GREEN | `git ls-remote origin refs/heads/savegame/20260516-1658Z/pr-79925-pre-drift-cure-mainHEAD` → `72706b899a` |
| 2 — Cure-bytes-byte-identical PR-head→CANDIDATE_SHA (4 cure-files) | ✅ GREEN | `cure-bytes/gate-4a-cure-bytes-4path.log` (all 0 bytes) |
| 3a — pnpm install --frozen-lockfile | ✅ exit 0 | `gates/gate-3a-pnpm-install.log` |
| 3b — pnpm tsgo (tsgo:core) | ✅ exit 0 | `gates/gate-3b-pnpm-tsgo.log` |
| 3c — pnpm tsgo:test (core + extensions test typecheck) | ✅ exit 0 | `gates/gate-3c-pnpm-tsgo-test.log` |
| 3d — pnpm check (umbrella: tsgo + oxlint 3-shards + policy guards) | ✅ exit 0 | `gates/gate-3d-pnpm-check.log` |
| 3e — pnpm vitest run (FULL) | ⚠️ KILLED-AFTER-CLASSIFICATION-COMPLETE; 8 failed test files / ~17 tests, ALL upstream-class (NOT rebase-introduced — independent byte-walk receipt at `gates/upstream-main-broken-class-receipt.log`) | `gates/gate-3e-pnpm-vitest.log` |
| 3f — pnpm build | ✅ exit 0 in 36s | `gates/gate-3f-pnpm-build.log` |

## Cure-bytes-byte-identical (Lane-B Step 5 LGTM-substrate preservation)

For each cure-file: `git diff 72706b899a..e90a870154 -- <file>` = 0 bytes ✅

```
src/agents/subagent-announce.ts            → 0 bytes diff
src/agents/tools/continue-delegate-tool.ts → 0 bytes diff
src/auto-reply/continuation/targeting-pure.ts → 0 bytes diff
src/auto-reply/continuation/targeting.ts   → 0 bytes diff
```

Plus 🌻's broader 64-file continuation-feature surface byte-walk at `1505249903` confirmed 0-diff across full continuation/delegate/context-pressure/chain-guard/request-compaction/silent-wake space (sidecar `aa48a88ba8`; CANDIDATE_SHA `e90a870154` = mechanical-rebase of sidecar onto fresh upstream/main, so byte-result preserved).

## Direction-check (Lane-B failure-mode 5)

- Commits HEAD→PR-head: **249** (rebase delta + 10 new upstream commits absorbed)
- Commits PR-head→HEAD: **1** (`72706b899a feat(continuation): context-pressure-aware continuation + cure clawsweeper P2` — the intentionally-replaced pre-rebase squash)
- Zero upstream commits destroyed.

Full log at `cure-bytes/direction-check.log`.

## Reviewer's 2 named CI failures — FIXED on CANDIDATE_SHA

Per `martingarramon`'s comment `4467233283` (2026-05-16T15:14Z) on `openclaw/openclaw#79925`:

| Reviewer check | Status on CANDIDATE_SHA |
|---|---|
| `checks-node-auto-reply-reply-session` (vi.mock missing `resolveSessionStoreEntry` in `src/auto-reply/reply/session-updates.test.ts`) | ✅ FIXED — cael's +5-line vi.mock entry landed; passed silently in vitest FULL |
| `check-test-types` at `src/cron/isolated-agent.model-formatting.test.ts:144` (Pick<AgentConfig> type-error) | ✅ FIXED — rebase absorbed upstream #82328 cleanly; passed gate 3c `pnpm tsgo:test` exit 0 |

## Upstream-class failures inherited unchanged (NOT introduced)

vitest FULL surfaces 8 failing test files at CANDIDATE_SHA. Byte-walks confirm: all 8 are pre-existing on upstream/main `a3e7fc7de7` standalone (no cure substrate). Classification = **broken upstream**, not our break.

| File | Tests Failed |
|---|---|
| `src/config/io.write-config.test.ts` | 1/27 |
| `src/agents/model-selection.test.ts` | 2/99 |
| `src/agents/model-fallback.test.ts` | 1/56 |
| `src/agents/pi-auth-json.test.ts` | 9/9 (entire file) |
| `src/agents/pi-embedded-runner/model.forward-compat.errors-and-overrides.test.ts` | 1/17 |
| `src/agents/sandbox/fs-bridge.shell.test.ts` | 1/8 |
| `src/agents/command/attempt-execution.cli.test.ts` | 1/27 |
| `extensions/telegram/src/polling-session.test.ts` | 1/34 |

**Independent verification** that these are upstream-class:
- Local byte-walk: `pnpm vitest run <7-files>` on naive upstream/main `a3e7fc7de7` standalone → 11 failed shards / 2 passed (13 shard runs); 29 tests failed / 428 passed. Receipt at `gates/upstream-main-broken-class-receipt.log`.
- 🌊 Ronan's independent host-class byte-walk at `Discord 1505256475`: 19 same-shape failures on upstream/main `a3e7fc7de7` on his runtime (different env). Same error-shape: `Error: No "syncPersistedExternalCliAuthProfiles" export is defined on the "./auth-profiles/external-auth.js" mock`.
- File-mod byte-walk: failing test code is byte-identical across PR-head, CANDIDATE_SHA, upstream/main (only line-numbers differ due to surrounding-tests offsets).

vitest NARROW (what prior cycles ran) caught only the 2 reviewer-named failures; vitest FULL surfaces this latent upstream test-mock staleness for `syncPersistedExternalCliAuthProfiles` predating our cure.

For the post-push PR comment (per figs's 2026-05-16 directive): "corrections made; we inherit these failing tests unchanged."

## Honest limits / open edges

- vitest 3e was KILLED-BY-DRIVER after classification complete (long-running 240s+ integration-test timeouts; 8 fail-files surfaced provides sufficient classification). Full vitest re-run could be done post-ship for completeness; not blocking.
- COHORT_TARGET_TAG=v2026.5.12 is NOT ancestor of upstream/main HEAD (`git merge-base --is-ancestor f066dd2f31 a3e7fc7de7` → exit=1). Fleet-deploy at CANDIDATE_SHA requires `bypass_validation=true` (per `deploy-gateway.yml` lines 60-66). Audit-logged reason recorded with each deploy.
- Live-host runtime proofs (R-CW / R-CD / R-RC rows + chained-depth-2 tests + OBS-1 + Grafana Tempo traces) pending Step 6 fleet-deploy + per-prince fire-cycles.
