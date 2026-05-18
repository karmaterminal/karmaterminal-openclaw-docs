# PROOFS / 718d8558eb / METHOD

## What is being proved

Cure-(13) ship-candidate `718d8558eb618304b5cc43c8a3b5d93ff5bef454`:

- Single squashed commit
- Parent: `upstream/main@6a5a1353c7` (at squash-time)
- Author/Committer: karmafeast
- Co-authored-by: Elliott 🌻 / Silas 🌫️ / Cael 🩸 / Ronan 🌊 / frond-scribe 🌿 / Claude

The continuation feature (`continue_work` / `continue_delegate` / `request_compaction`) plus the test-isolation lock-patch (cherry-pick of `10abecf2de` from cure-(12) test-isolation lane), rebased onto a fresher upstream/main than cure-(12)'s `7ff8323ed5` base.

## Why this proof corpus exists

Cure-N canon's `proofs-SHA == push-SHA` invariant. Proofs validate RUNTIME behavior at the exact SHA that lands on PR #79925. The corpus is per-row evidence that the candidate runs on real prince-host runtimes.

## Methodology summary

Per `karmaterminal/openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`:

1. **Deploy** the candidate-SHA to 4 prince hosts via `deploy-gateway.yml` (workflow_dispatch, karmafeast committer, bypass_validation=true because the rebase-onto-upstream-main is not the COHORT_TARGET_TAG pinned anchor).
2. **Fire** real tool-invocations from each prince's runtime against the deployed SHA — not simulated, not mocked, runtime-actual.
3. **Capture** journal traces, gateway logs, tool-result data, and persisted state.
4. **Bank** evidence at `PROOFS/<sha>/<row-class>/` with per-row README + raw artifacts.
5. **Cross-validate** where possible (R-CD-5 style cohort-deploy-cross-validation from another prince's seat).

## Cohort-validation gates (pre-deploy)

Before deploys fired:

- **Gate 1 — Savegame**: 6 savegame branches pushed on `karmaterminal/openclaw` covering each cure-(13) state (pre-rebase, post-rebase pre-cherrypick, post-cherrypick pre-gates, post-tsgo-fixup, post-lint-allow-fixup, squashed)
- **Gate 2 — Byte-empty tree-diff**: `git diff 718d8558eb..4df99ac0b1` (pre-squash vs post-squash) → empty. proofs-SHA == push-SHA invariant satisfied.
- **Gate 3 — Full local gates**:
  - `pnpm tsgo:core` exit 0
  - `pnpm tsgo:test` exit 0
  - `pnpm test src/agents/session-write-lock.test.ts` 34/34 passed (mirrors 🌊's ronan-host probe on `0543206638`)
  - `pnpm lint` (scripts + core + extensions) 0/0/0 errors
  - `pnpm test` (full, 16 workers, 32GB heap): 2031/2032 passed; 1 known failure documented below
- **Gate 4 — Cohort cosign**:
  - 🌊 ronan byte-walked `f55c98abb7` (HEAD before final squash) — telegram ✅ + agent-runner ✅ + compact ✅ + no-conflict-markers ✅ + 53/53 agents-core ✅ + 28/28 io.write-config ✅ + post-fixup re-confirm at byte
  - 🩸 cael byte-walked compact.ts ✅ + agent-runner.ts Trigger D weave ✅ + agent-runner.ts preview-dedupe fixup ✅
  - 🌻 elliott back-online, comprehensive cohort state read posted
  - 🌫 silas provided upstream-byte-policy for 8-conflict resolution + verified deploy at byte on silas-host

## Known pre-existing upstream issue (NOT cure-(13) blocker)

`src/plugins/uninstall.test.ts:1249` deterministically fails:

```
expected: { directoryRemoved: false, warnings: [] }
received: { directoryRemoved: false, warnings: ["Skipping openclaw peerDependency link because /tmp/uninstall-test-DnL8Yk/state/npm/node_modules/peer-plugin/node_modules/openclaw already exists and is not a symlink."] }
```

This file is **byte-identical between cure-(13) candidate and upstream/main** (verified: `git diff upstream/main..718d8558eb -- src/plugins/uninstall.test.ts` returns empty; same for `src/plugins/uninstall.ts`). The failure reproduces on bare upstream identically. Root cause: upstream's `2a67a7f65e fix(plugins): prune managed peers on uninstall` introduced warning-emitting behavior that the test (also upstream's) was not updated for. Tracked separately as upstream-bug class.

## Upstream-drift acknowledgement (freeze-and-ship per cohort decision)

At squash-time (~14:04Z 2026-05-18), parent was `upstream/main@6a5a1353c7`. Within minutes, upstream advanced to `4f4d108639`, then `1b82c0e3d9`, then `c49d909b60`. 🌊 ronan probed the re-rebase surface and found 9 conflicts including 1 substantive prod-semantic merge in `agent-runner-execution.ts` (orthogonal additive features both sides — `continueWorkOpts`/`drainsContinuationDelegateQueue` from cure vs `suppressAssistantErrorPersistence`/`onAssistantErrorMessagePersisted` from upstream).

**Cohort decision** (cosigned 🌊 + 🩸 + scribe): freeze `718d8558eb` as proof base. Reasoning:

1. Cohort already byte-walked + cosigned this exact SHA. Re-rebasing invalidates those cosigns + chases a moving target (upstream advances ~once per 5-10 min).
2. PROOFS validate RUNTIME behavior at the candidate-SHA, not parent-SHA freshness. The runtime feature surface is byte-identical at `718d8558eb` regardless of how stale the parent becomes.
3. PROOFS-SHA == push-SHA invariant is about OUR artifact integrity (proofs apply to the SHA that lands), not about zero-behind-count vs upstream/main.
4. This freeze is a STRICT improvement over PR head `a289329d0f` (cure-(12), parented on even older `7ff8323ed5`). The PR moves forward.
5. If force-push requires fresher parent, ONE final drift-cure between proofs-complete and force-push handles that — decoupled from the proof-gate.

## Proof-corpus row inventory

| Row | Prince-seat | Status | Description |
|-----|-------------|--------|-------------|
| `continuation-live-fire/` | 🌊 ronan | firing | `continue_work` + `continue_delegate` (silent / silent-wake / post-compaction) + `request_compaction` tool-fires with traceparent verification |
| `inter-session-targeting/` | 🩸 cael | gated on deploy re-fire | cross-session resumption with delivery verification |
| `post-compaction-threshold/` | 🩸 cael | gated on deploy re-fire | 70%+ context-pressure → compaction firing path |
| `R-TA-1/` (token-accounting) | 🌫 silas | spec given, firing scheduled | chain-budget accounting across continue_delegate chains (depth/cost-cap honored) |
| `deploy-validation/` | 🌻 elliott | ACK pending | `openclaw --version` + journalctl post-deploy + cohort-deploy-cross-validation |
| `gateway-health/` | 🌻 elliott | ACK pending | gateway-health.md post-deploy substrate |
| `README.md` | scribe | drafting | executive summary + verdicts |
| `METHOD.md` | scribe | this file | methodology |

Substitutes from scribe-host if any prince-seat slot doesn't fire.
