# Gate 2 disposition: `f4675cff00` → `f15237ec92` (F′)

| | |
|---|---|
| checker | `feature-cores-byte-check.sh f4675cff00 f15237ec92 --upstream 4fc73d6995` (receipt: `feature-cores-byte-check.f15237ec92.txt`) |
| result | **Identical to F `08c37a1562`, blob ids included:** 40 invariants, the same 16 FAIL, 16 exact-upstream, 5 tombstone, 3 PASS. F → F′ touches none of the 40 primitive cores |
| Gate 2.7 | `drift-cure-gate.sh 4fc73d6995 f15237ec92 4fc73d6995`: rc 0, 840 files, 375 GENUINE / 465 SAFE-NEW, 0 FROZEN-STALE, 0 MIXED-CLOBBER, 0 dropped upstream lines (receipt: `gate-2.7.f15237ec92.txt`) |

F′ is F plus 🌊's superseding Gate 2 scope ruling (2026-10-29 22:33:25Z, Discord `1565493793224925327`). The rulings recorded at F carry for every file F′ leaves unchanged: groups (A), (B), (C), (D) and (E) in `PROOFS/08c37a15621790d8bd20ebdaa42d16a65b4059c3/gates/cure-bytes/GATE2-DISPOSITION.md`. The F → F′ delta below is the only new material.

## (F′) The F → F′ delta, under 🌊's 22:33Z ruling

Lane `codeagent/f-prime-scope` (bootstrap#1727): `a24eb57d62` fossils (RED at F) → `a1f455c818` narrowing → `f15237ec92` D3b move. 10 files, +66/−113.

### 1. `412b3e5394` narrowed to continuation wakes

At F every superseded run kept `abortedLastRun: false`. At F′ only a superseded **continuation wake** does: the reply runner's terminal backstop stamps `continuationWake: true` on a wake's terminal, using get-reply-run's existing `isContinuationWake` marker. The lifecycle projection exempts only `terminal.reason === "superseded"` with that stamp, read off the same terminal event. Every other superseded run is exactly U11 (`abortedLastRun: status === "killed"`).

| file | owner | U11..F | U11..F′ | F′ hunk |
|---|---|---|---|---|
| `src/config/sessions/session-run-lifecycle-projection.ts` | upstream | +2/−1 | +6/−1 | the narrowed predicate; `continuationWake?: unknown` on the event data |
| `src/auto-reply/reply/agent-lifecycle-terminal.ts` | upstream | 0 | +3 | **new to the footprint**: the `isContinuationWake?` param and the stamp |
| `src/auto-reply/reply/agent-runner-cli-candidate.ts` | upstream | 0 | +1 | **new to the footprint**: passes the marker |
| `src/auto-reply/reply/agent-runner-embedded-candidate.ts` | upstream | +113/−1 | +114/−1 | passes the marker |
| `src/auto-reply/reply/agent-runner-error-handler.ts` | upstream | +17 | +18 | passes the marker |
| `src/auto-reply/reply/agent-runner-execution.types.ts` | upstream | +22 | +24 | `isContinuationWake?` on `AgentTurnParams` |

- **Counterfactual:** every hunk passes. Delete continuation, and `isContinuationWake` and every hunk go with it.
- **Gate 2.7:** the two files new to the footprint are GENUINE with 0 dropped upstream lines.
- **Fossils:** RED at F → GREEN → revert-RED → GREEN. Dropping only the producer stamp also turns them RED, which proves the marker travels the real wake path. Upstream's generic superseded test is unchanged and GREEN.
- **Accepted edge case, named by the lane:** a wake that runs as a queued follow-up carries no marker, so it keeps U11's behavior and the next turn gets the interrupted hint.
- **Review:** frond-scribe (the lane's own review subagent was stopped by the `--print` background ceiling before reporting).

This supersedes F's group (E) row for `412b3e5394`, which was behavior-wide.

### 2. The D3b fossil moved off the presentation head

`src/gateway/session-restart-resume.live-stop.test.ts` and its `gatewayDatabaseWorkerTestFiles` entry in `test/vitest/vitest.gateway-server-paths.mjs` are removed. Nothing continuation-owned depends on them. The patch restoring both is carried with fleet karmaterminal/openclaw#1468 (comment 6511630282), not on this line. This supersedes F's group (E) row for `vitest.gateway-server-paths.mjs`.

## Native locale entries: not on F′

🌊 re-ruled (2026-10-30 00:41:29Z, Discord `1565526020768137348`, correcting his 00:09Z ruling (a)): the 63 generated native locale entries stay **out** of F′. On an upstream PR, mixing `apps/.i18n/native/*.json` with source fails `scripts/ci-changed-scope.mjs` `assertNativeGeneratedArtifactsIsolated`. Upstream's locale refresh workflow fills translations after merge. The entries stay as a separate locale-refresh artifact on `codeagent/f-prime-i18n` (`d2464ed7cc`, model-written, disclosed).

At exact F′:
- **`native:i18n:verify`** (the source-PR gate): exit 0.
- **Upstream changed-scope guards** (control-ui and native) on the U11...F′ path set (840 paths): PASS. `shouldStrictNativeI18n` = false.
- **Strict `native:i18n:check`:** **pending locale refresh.** It is a fork-owned difference (the three continuation tool labels have no locale entries yet), not green, not an upstream PR gate, and not a baseline red, although U11 is green. It appears only in the generator / release-preflight sweep. Mode-B `pnpm check` does not run it.
