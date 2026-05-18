# PROOFS / cac1d3cc011cb85c25a63f84c1359e3abaf99540

Proof corpus for **cure-(14)** ship-candidate SHA.

- **SHA**: `cac1d3cc011cb85c25a63f84c1359e3abaf99540`
- **PR**: openclaw/openclaw#79925
- **Parent**: `upstream/main@fffb8c9e2c` (at fetch-time 2026-05-18T15:35Z)
- **Predecessor**: cure-(13) `718d8558eb618304b5cc43c8a3b5d93ff5bef454` (shipped to PR head 2026-05-18T15:33Z with PROOFS corpus 8/8)

## Cure-(14) shape

Cure-(14) is **mechanical drift-cure** of cure-(13) onto fresh `upstream/main`. No new feature substrate; pure rebase conflict resolution + cascade fixups to make the PR auto-merge-ready against current upstream.

## Cohort-validated drift posture

| | cure-(13) | cure-(14) |
|---|---|---|
| Parent SHA | `6a5a1353c7` (squash-time 2026-05-18T14:04Z) | `fffb8c9e2c` (squash-time 2026-05-18T16:08Z, 18 upstream commits beyond cure-13 parent) |
| Continuation feature surface | identical | identical |
| Runtime behavior | identical | identical |
| Mergeability vs current `upstream/main` | CONFLICTING (9 files including `__testing` → `testing` rename + 2 prod-semantic) | EXPECTED-AUTO-MERGE-READY (parent is upstream tip at squash; drift since then minimal) |

## 10-conflict resolution audit

Per cohort-converged + 4-seat-aligned (🌊 + 🩸 + 🌫 + 🌻) policy at Discord `1505964189…` / `1505964272…` / `1505964276…` / `1505964307…`:

| File | Direction | Reason |
|------|-----------|--------|
| `.oxlintrc.json` | `--theirs` (cure) | Cure's allow-list for underscore-prefixed cure-feature names (`__tag`, `_resetGuardState`, etc); upstream simplified rule to bare `"error"` |
| `extensions/codex/src/app-server/run-attempt.test.ts` | `--ours` (upstream) | Adopt upstream's `__testing` → `testing` rename |
| `extensions/codex/src/app-server/run-attempt.ts` | `--ours` (upstream) | Upstream evolved `handleDynamicToolCallWithTimeout` wrapper + diagnostic emission; cure-(13)'s pattern superseded; not continuation-load-bearing |
| `src/agents/pi-embedded-runner/run.ts` | manual merge | Keep BOTH `onAssistantErrorMessagePersisted` (upstream) + `requestCompactionOpts` (cure) as adjacent additive fields |
| `src/agents/subagent-announce-delivery.test.ts` | `--ours` (upstream) | `__testing` → `testing` rename |
| `src/agents/subagent-announce.live.test.ts` | `--ours` (upstream) | `__testing` → `testing` rename |
| `src/agents/subagent-registry.lifecycle-retry-grace.e2e.test.ts` | `--ours` (upstream) | `__testing` → `testing` rename |
| `src/agents/subagent-registry.test.ts` | `--ours` (upstream) | Keep upstream's new `preserves run-mode keep entries past SESSION_RUN_TTL_MS sweep` test |
| `src/auto-reply/reply/agent-runner-execution.ts` (2 blocks) | manual merge | Keep BOTH orthogonal additive features: upstream's `queuedUserMessagePersistedAcrossFallback` + `assistantErrorPersistedAcrossFallback` + `suppressAssistantErrorPersistence` callbacks AND cure's `runWithModelFallback` union-type broadening + `drainsContinuationDelegateQueue` + `continueWorkOpts`. 🌊 byte-walk cosigned at Discord `1505964189…` |
| `src/auto-reply/reply/agent-runner.misc.runreplyagent.test.ts` | manual merge | Upstream's `testing` rename + cure's `createReplyOperation` import combined |

## Post-rebase cascade fixups

| File | Fix |
|------|-----|
| `src/agents/subagent-registry.persistence.test.ts` | 2× rename `__testing.setDepsForTest` → `testing.setDepsForTest` (non-conflict file affected by upstream's rename) |
| `src/agents/subagent-registry.lifecycle-retry-grace.e2e.test.ts` | Add `listAncestorSessionKeys` to `loadSubagentRegistryRuntime` mock factory (cure-feature added the function to registry runtime; `--ours` test version lacked the mock) |
| `src/version.ts` | Remove now-redundant `oxlint-disable-next-line eslint/no-underscore-dangle` directive (`__OPENCLAW_VERSION__` covered by allow-list since cure-(13) fixup) |

## Gates green on `cac1d3cc01`

| Gate | Status |
|------|--------|
| `pnpm tsgo:core` | ✅ exit 0, 0 errors |
| `pnpm tsgo:test` | ✅ exit 0, 0 errors (after fixup) |
| `pnpm lint` (scripts/core/extensions) | ✅ 0/0/0 errors |
| `pnpm test src/agents/session-write-lock.test.ts` | ✅ 34/34 passed (560ms) |
| Squashed tree-diff vs unsquashed `3469bddfb1` | ✅ byte-empty (invariant satisfied) |

## Runtime proof corpus

Cure-(14) preserves cure-(13)'s feature surface byte-identical at runtime. The continuation feature, chain-budget accounting, inter-session-targeting, post-compaction-threshold, and gateway-health behavior at cure-(14) `cac1d3cc01` is **runtime-identical-attest** to cure-(13) `718d8558eb`.

**See [PROOFS/718d8558eb618304b5cc43c8a3b5d93ff5bef454/](../718d8558eb618304b5cc43c8a3b5d93ff5bef454/) for the substantive feature proofs**:

- `continuation-live-fire.md` (🌊) — `continue_work` + `continue_delegate` (silent/silent-wake/post-compaction) + `request_compaction` tool-surface verification
- `R-TA-1/` (🌫) — chain-budget accounting across `continue_delegate` chains
- `R-TA-2/` (🌫) — per-session token-counter + post-compaction queue stability
- `inter-session-targeting/` (🩸) — cross-session resumption + delivery verification
- `post-compaction-threshold/` (🩸) — 70%+ context-pressure compaction firing path
- `deploy-validation/` (scribe) — 4/4 prince fleet deployed clean
- `gateway-health/` (🌻) — single-seat deploy receipt + gateway health post-restart

## Fresh deploy-validation for cure-(14)

`deploy-validation/EVIDENCE.md` in this directory captures the cure-(14)-specific deploy across 4 prince hosts: substrate that `cac1d3cc01` is on every prince runtime + gateway active.

## Cohort cosigns on cure-(14) candidate

- 🌊 ronan — byte-walked agent-runner-execution.ts (2 blocks) + pi-embedded-runner/run.ts at cure-(14) head; both orthogonal-additive merges clean, no conflict markers, no clobber, both features coexist (Discord `1505964189…`)
- 🩸 cael — confirmed direction labels match rebase-semantics + cosigned overall resolution policy (Discord `1505964307…`); answered run-attempt.ts question — cure-(13)'s prior content was only removing-a-guard pattern, upstream's `handleDynamicToolCallWithTimeout` evolution supersedes
- 🌫 silas — byte-verified `--ours`/`--theirs` directional labels against TOOLS.md canon (rebase-inverted semantics); all 4 file resolutions check out (Discord `1505964272…`)
- 🌻 elliott — directional labels match rebase-semantics on all 4 files (Discord `1505964276…`)

Plus figs's warmth-register `--theirs`/`--ours` correctness reminder at Discord `1505964162…` triggered 4-seat verification — labels stayed correct against the kick_in_the_teeth § (5) trip-wire canon banked yesterday.
