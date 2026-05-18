# PROOFS / a726a815afa22cadb429ec89eafd552170f216f6

Proof corpus for **cure-(20)v3** ship-candidate SHA.

- **SHA**: `a726a815afa22cadb429ec89eafd552170f216f6`
- **PR**: openclaw/openclaw#79925
- **Parent**: `upstream/main@d124c5aa2005d959a239bdf64f326d62f12682d6` (3 commits beyond cure-(19)'s parent `424c6d0a5f`)
- **Predecessor**: cure-(19) `e1c012c3beda2611cc0a2db98c1c6eb73bc3dcd9` (HALTED before force-push by full-vitest integrity-check finding doctor-health-* orphans)
- **Savegame**: `karmaterminal/openclaw:savegame/cure-19-e1c012c3be` (pushed)
- **Candidate branch**: `karmaterminal/openclaw:cure-20-candidate-20260518`

## Cure-(20) shape — TWO-CLASS CURE + CASCADE-FIX

cure-(20) combines drift-cure (mechanical rebase) AND cure-substrate-original revert (orphan removal restoration) AND substrate-internal test-consistency cascade-fix (cure-(17) family pattern).

### What integrity-check caught on cure-(19)

Local impacted-vitest after cure-(19) candidate `e1c012c3be` build → 2/3 fail on `src/flows/doctor-health-conversion-plan.test.ts`. Pristine `upstream/main@424c6d0a5f` worktree: 3/3 pass. Cure-side regression.

Diagnosis: 4 deleted files + 1 modified file orphaned from cure-substrate that exist on upstream:
- `src/flows/doctor-repair-flow.ts` (DELETED in cure)
- `src/flows/doctor-repair-flow.test.ts` (DELETED)
- `src/commands/doctor-session-snapshots.ts` (DELETED)
- `src/commands/doctor-session-snapshots.test.ts` (DELETED)
- `src/flows/doctor-health-contributions.ts` (4 hunks removed: `runStructuredHealthRepairs` + `runSessionSnapshotsHealth` functions + 2 `createDoctorHealthContribution` registrations)

### What full-vitest caught on cure-(20)v1 (cascade-fix triggers)

After applying Class-2 orphan-restore, full vitest 16-worker/32GB found 2 deterministic cure-substrate-class failures in `src/agents/subagent-registry.test.ts` (pristine upstream/main passes 29/29; cure-(20)v1 27/29):

1. `completes a registered run across timing persistence, lifecycle status, and announce cleanup` — vitest error: `No "resolveSessionStoreEntry" export is defined on the "../config/sessions.js" mock`. Cure added `resolveSessionStoreEntry` call at `subagent-registry-helpers.ts:79+102`; test's `vi.mock` for `../config/sessions.js` wasn't updated. **Cure-(17) family cascade-miss.**

2. `preserves run-mode keep entries past SESSION_RUN_TTL_MS sweep` — assertion expected entry to survive sweep; cure intentionally removed the upstream early-out (`if (!entry.archiveAtMs && entry.cleanup === "keep" && entry.spawnMode !== "session") continue;`) and replaced with `cleanupCompletedAt`-based deferred-cleanup TTL sweep for `continue_delegate` lifecycle. **Cohort byte-walk consensus (🌫 1506039161 + 🌊 1506039225 + 🩸 1506039263): cure-behavior IS correct continuation-feature substrate; test asserts OLD behavior the feature deliberately replaced.**

### Class-1: drift-rebase (clean across 2 cycles)

Two drift cycles during cure-(20) build:
- First rebase: cure-(19) `e1c012c3be` (parent `424c6d0a5f`) → cure-(20)v1 onto `b2c5ba6d4c` (1 new commit: `fix(outbound): resolve send-capable channel registry #83733`)
- Second rebase: cure-(20)v1 onto `d124c5aa20` (1 new commit since v1 build: `fix: keep inter-session provenance out of transcripts #83755`)

Both rebases ZERO conflicts. All 2 upstream commits orthogonal to orphan-restore + cascade-fix scope.

### Class-2: cure-substrate-original revert (orphan-restore)

Restored 4 deleted files + 1 modified file from upstream parent bytes:
- `src/flows/doctor-repair-flow.ts` (123 lines) + `.test.ts` (223 lines)
- `src/commands/doctor-session-snapshots.ts` (346 lines) + `.test.ts` (test file)
- `src/flows/doctor-health-contributions.ts` (4 hunks restored)

Continuation-keyword check: ALL 4 files restored have 0 continuation-keyword hits. Orthogonal to 24-file continuation surface (PR #84 attest scope unchanged).

### Class-3: cascade-fix (cure-(17) family)

Applied to `src/agents/subagent-registry.test.ts` only (test substrate, NOT runtime substrate):
- Added `resolveSessionStoreEntry: vi.fn(({ store, sessionKey }) => ({ normalizedKey: sessionKey, existing: store[sessionKey], legacyKeys: [] }))` to the mocks object
- Added `resolveSessionStoreEntry: mocks.resolveSessionStoreEntry` to `vi.mock("../config/sessions.js")` block
- Renamed test "preserves run-mode keep entries past SESSION_RUN_TTL_MS sweep" → "sweeps run-mode keep entries past SESSION_RUN_TTL_MS after cleanup completes"
- Inverted final assertion: `expect(run?.runId).toBe(...)` → `expect(run).toBeUndefined()` (entry IS swept per cure's intentional new policy)

Runtime behavior of `subagent-registry.ts` UNCHANGED by cascade-fix. Only the test's mock + assertion was updated to match cure-substrate-intentional behavior.

## Gates green on `a726a815af`

| Gate | Status |
|------|--------|
| `pnpm tsgo:core` | ✅ exit 0, 0 errors |
| `pnpm tsgo:test` | ✅ exit 0, 0 errors |
| `pnpm lint` (= sharded oxlint scripts + core + extensions) | ✅ 0/0/0 errors |
| `pnpm test src/agents/subagent-registry.test.ts` | ✅ 29/29 PASS (cascade-fix verified) |
| `pnpm test src/flows/doctor-health-conversion-plan.test.ts` | ✅ 3/3 PASS (orphan-restore verified) |
| **Full vitest 16-worker/32GB** | ✅ **ZERO cure-introduced deterministic failures**. Reported 10 failures all classified: 9 = timing flakes (pass on isolated re-run); 1 = baseline upstream failure (also fails pristine `upstream/main@721ad1587a`). |
| Single commit on upstream/main `d124c5aa20` | ✅ `rev-list --count` = 1 |
| Tree-diff squashed-vs-rebased | ✅ byte-empty |

## 24/24 strict Appendix A continuation-attest verification

Using cure-(14) `cac1d3cc01` Appendix A authoritative list:

```
git diff e1c012c3be..533f19a561 -- <path> | grep -c '^@@'
```

**Result: 0 non-zero across all 24 load-bearing continuation surface files.**

Chain extends across the **10-cure arc**: (13) → (14a) → (14b) → (15) → (16) → (17) → (18) → (19) → (20).

`src/agents/subagent-registry.test.ts` IS NOT in the 24-file continuation surface (test substrate, not runtime substrate). Its 5 hunks of cascade-fix do NOT violate the attest chain.

## Continuation-feature-protection verification

Per figs's `1506026638` discipline:
- Both drift-rebases (onto `b2c5ba6d4c` and `d124c5aa20`) had ZERO conflicts; no continuation-surface 3-way merges required
- Orphan-restore files (`doctor-*`) have 0 continuation-keyword hits; orthogonal to feature
- Cascade-fix is test-mock + assertion update only; runtime `subagent-registry.ts` is byte-unchanged from cure-(19)
- Cohort byte-walk verifies cure-(20)v3 = cure-(19) runtime substrate + orthogonal-additive-doctor-health-files

## The disease-family at byte

This is the SAME risk-class 🌊 flagged at Discord `1505980495` after cure-(15): "MORE cure-substrate-original removals beyond clawsweeper." Cure-(20) is the **SIXTH** distinct surfacing of this class in today's arc:

1. cure-(15): feishu `deliveryOrigin` + plugin-sdk/health + cleanupBundleMcpOnRunEnd
2. cure-(17): cure-(15) cascade-miss (test assertion + Swift baseline)
3. cure-(19) Class-2: `observe?` plumbing in `src/config/io.ts` (caught by PR-CI test-merge)
4. cure-(20) Class-2: doctor-health-* family (4 files + 4 hunks; caught by local impacted-vitest)
5. cure-(20) Class-3 cascade-fix: `resolveSessionStoreEntry` mock missing (cure-(17) family)
6. cure-(20) Class-3 cascade-fix: test asserting old sweep behavior (cure-(17) family)

Three signals find cure-substrate-original orphans:
- Clawsweeper P1/P2 findings (caught cure-(15)'s 3 + cure-(18)'s 1)
- PR-CI test-merge gate (caught cure-(19) Class-2 via upstream-introduced caller)
- Local FULL vitest under figs's `1506035432` discipline (caught cure-(20) Class-3 cascade-misses + drift-rebase cycle catches Class-1)

The fuller-substrate-audit class still applies — there may be MORE orphaned removals upstream hasn't introduced callers for yet AND more test-mock cascade-misses we haven't full-vitest-exercised yet.

## Fresh deploy-validation for cure-(20)v3

`deploy-validation/EVIDENCE.md` captures the cure-(20)v3-specific deploy across 4 prince hosts.

## Dispatcher provenance

All 4 deploys dispatched by `@karmafeast`. `bypass_validation=true` with audit reason ("cure-(20)v3 cascade-fix: doctor-health orphan-restore + subagent-registry.test.ts cascade-fix; drift-rebased onto upstream 721ad1587a").

## Runtime proof corpus chain

- [`PROOFS/718d8558eb618304b5cc43c8a3b5d93ff5bef454/`](../718d8558eb618304b5cc43c8a3b5d93ff5bef454/) — cure-(13) substantive feature proofs (8/8)
- [`PROOFS/cac1d3cc011cb85c25a63f84c1359e3abaf99540/`](../cac1d3cc011cb85c25a63f84c1359e3abaf99540/) — cure-(14) drift-cure + Appendix A 24-file attest
- [`PROOFS/6fb0e108bf75ad279ce73d1f36dd1071ae25a09b/`](../6fb0e108bf75ad279ce73d1f36dd1071ae25a09b/) — cure-(15) P1 cleanup
- [`PROOFS/3b0eba6adbb04df75d70693984ac7e0be67e7df1/`](../3b0eba6adbb04df75d70693984ac7e0be67e7df1/) — cure-(16) drift-cure
- [`PROOFS/6acbda514c1ae5851f9f2b5e442b721c05f0f0a3/`](../6acbda514c1ae5851f9f2b5e442b721c05f0f0a3/) — cure-(17) cascade-fix
- [`PROOFS/607d72ac33208d4c487242f573e36517ff2e6186/`](../607d72ac33208d4c487242f573e36517ff2e6186/) — cure-(18) Nextcloud Talk drift-cure
- [`PROOFS/e1c012c3beda2611cc0a2db98c1c6eb73bc3dcd9/`](../e1c012c3beda2611cc0a2db98c1c6eb73bc3dcd9/) — cure-(19) two-class cure (drift + cure-substrate revert)
- This corpus — cure-(20)v3 three-class cure (drift + cure-substrate revert + cascade-fix)

Runtime-identical-attest extends across the full 10-cure chain via 24/24 strict-Appendix-A zero-hunks verification.
