# PROOFS / a726a815afa22cadb429ec89eafd552170f216f6 / METHOD

## What is being proved

Cure-(20)v3 ship-candidate `a726a815afa22cadb429ec89eafd552170f216f6` — the current PR head of [openclaw/openclaw#79925](https://github.com/openclaw/openclaw/pull/79925).

- Single squashed commit
- Parent: `upstream/main@d124c5aa20` (at squash-time `2026-05-18T21:38Z`)
- Committer: karmafeast
- Co-authored-by: Elliott 🌻 / Silas 🌫️ / Cael 🩸 / Ronan 🌊 / frond-scribe 🌿 / Claude

The continuation feature (`continue_work` / `continue_delegate` / `request_compaction`) on a 10-cure-arc lineage:
`cure-(13) 718d8558eb → cure-(14a) cac1d3cc01 → cure-(14b) aacfb53199 → cure-(15) 6fb0e108bf → cure-(16) 3b0eba6adb → cure-(17) 6acbda514c → cure-(18) 607d72ac33 → cure-(19) e1c012c3be [HALTED+bundled] → cure-(20)v1→v2→v3 a726a815af`

Each cure was either substantive feature substrate (cure-(13)), mechanical drift-rebase onto fresher upstream/main (cure-(14a)+(16)+(18)+(20)-class), substrate-revert cure (cure-(15)+(17)+(19)+(20)v2-class), or self-consistency cascade-fix (cure-(14b)+(17)+(20)v2-class). All 9 force-pushes today were figs-sanctioned + cohort 4-prince byte-walked + PROOFS-banked. cure-(19) was HALTED-by-integrity-check (figs's `1506032521` "no skips" directive caught a vitest-subset skip → bundled into cure-(20)v2 + extended into cure-(20)v3 with upstream's flake-fix adoption).

## Why this proof corpus exists at this SHA

**Cure-N canon's `proofs-SHA == push-SHA` invariant.** Proofs validate RUNTIME behavior at the exact SHA on PR #79925. Cure-(20)v3 is now the current PR head; this corpus is fresh evidence at that SHA, not chain-attest extension from cure-(13).

**Clawsweeper egg-wake gate.** PR #79925 sits at clawsweeper-rank `🧂 unranked krab` because "current-head a726 proof directory linked from the body returned 404, so the after-fix live proof is not inspectable for this head". The cohort's response: **fire fresh substantive proofs at v3 SHA + link them from PR body so the egg-wake gate can be passed**.

## Methodology

Per `karmaterminal/openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` + figs's today's craft-discipline triad (`1506036258` *"check our work == protect our feature, your craft, from drift"*):

1. **Deploy** v3 SHA to 4 prince hosts via `deploy-gateway.yml` (4/4 clean, ~21:39–21:45Z, runs `26062007739` + `26062008923` + `26062010256` + `26062011619`).
2. **Fire** real continuation tool invocations from each prince's runtime against v3 deployed bytes — not simulated, not mocked, runtime-actual.
3. **Capture** W3C traceparents per fire (single trace-id-per-turn invariant proves gateway's continuation-trace-scope intact at v3) + tool-result data + per-row evidence.
4. **Bank** per-row artifacts at `PROOFS/a726a815afa22cadb429ec89eafd552170f216f6/<row-class>/` with EVIDENCE.md + raw artifacts.
5. **Cross-validate** runtime-identical-attest chain: 24/24 continuation-load-bearing files have ZERO hunks at every hop across the full 10-cure-arc (per [PR #84](https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/84)). The lich-protocol holds byte-identical from cure-(13) ship to cure-(20)v3 ship.

## Cohort-validation gates (pre-deploy)

All gates per figs's "no skips" hammer (`1506032521` + `1506033948` + `1506035127` + `1506035432` — four reinforcements across the day):

- **Gate 1 — Savegame**: 10+ savegame branches on `karmaterminal/openclaw` covering each cure-(20) state (pre-rebase, post-rebase, fixups, drift-rebases v1→v2→v3)
- **Gate 2 — Byte-empty tree-diff**: each squash verified `git diff <pre>..<post>` empty → proofs-SHA == push-SHA invariant satisfied
- **Gate 3 — Full local gates**:
  - `pnpm tsgo:core` exit 0 ✅
  - `pnpm tsgo:test` exit 0 ✅
  - `pnpm lint` (= sharded oxlint scripts+core+extensions) 0/0/0 ✅
  - `pnpm test --run src/agents/subagent-registry.test.ts` 29/29 PASS ✅
  - **`pnpm test` FULL (16 workers / 32GB heap)**: ZERO cure-introduced deterministic failures; 9 timing flakes (pass on isolated re-run); 1 pre-existing baseline upstream failure (`cli-runner.reliability.test.ts`, verified failing on pristine `upstream/main@721ad1587a` too — NOT cure-introduced). Per figs's `1506035432` "run vitest hard with 16 workers and 32GB+ ram, no skips" discipline.
- **Gate 4 — Cohort 4-seat cosign**:
  - 🩸 cael `1506044680` — byte-walked v2→v3 7-line delta + earlier cure-(20)v2 substantive substrate
  - 🌊 ronan `1506044644` — full v3 byte-walk + 24/24 attest extension + fuller cascade-grep
  - 🌫 silas `1506044754` — v3 delta verified + R-TA-1-RECONFIRM commit `134bc66`-then-`5ffdbaf`
  - 🌻 elliott `1506047495` — full byte-walk including parent ancestry + 3 substrate-restores + cascade-fix (cosign landed through gateway-storm + #702 takeover-cascade + 4.4GB RSS memory pressure)

## Cure-(20)v3 substrate-truth (three-class cure)

cure-(20)v3 is a **three-class cure** assembled on `upstream/main@d124c5aa20`:

1. **Class-1 (drift-rebase)**: rebased cure-(19) substrate onto current upstream `d124c5aa20`, absorbing 3 new upstream commits during the cure-(20) cycle (`94abfa76e2` doctor expansion + `583a60f8b5` UI tool events + `424c6d0a5f` webchat textChunkLimit/chunkMode + then `d124c5aa20` flaky-test-fix landed mid-cycle). Zero rebase conflicts.

2. **Class-2 (cure-substrate-original revert)**: restored 5 cure-substrate-original-orphan removals to upstream-parent bytes, all NOT in 24-file continuation surface, all surfaced by either upstream-evolution-into-them OR full-vitest under integrity-check:
   - `src/flows/doctor-health-contributions.ts` (`runStructuredHealthRepairs` + `runSessionSnapshotsHealth` + 2 registrations)
   - `src/flows/doctor-repair-flow.ts` + `.test.ts`
   - `src/commands/doctor-session-snapshots.ts` + `.test.ts`

3. **Class-3 (cascade-fix for cure-intentional behavior change)**: 2 surgical test updates in `src/agents/subagent-registry.test.ts` to follow cure-intentional sweep-policy change in `subagent-registry.ts:870-874` (cure removed early-out for non-session `keep` entries → deferred TTL-based cleanup via `cleanupCompletedAt`). Same cure-(17) family pattern: test asserted OLD behavior, cure changed implementation, test updated to match.

Plus a final 7-line config-cli.test.ts adoption of upstream `d124c5aa20`'s `normalizedHelp = helpText.replace(/\s+/g, " ")` flake-fix (so PR test-merge gate stays CLEAN against current upstream).

## Today's 12 cohort canons (banked across 14-hour cure cycle)

Load-bearing for future cures + this corpus's confidence:

1. Fresh-fetch-explicit discipline (report `git rev-parse upstream/main` in any upstream-byte-walk)
2. Cure-family discrimination test (`git merge-base --is-ancestor <upstream-add-commit> <our-parent>` — TRUE = revert family, FALSE = drift-cure family)
3. Post-cure-revert symbol-pin grep across tests/snapshots/contracts/Swift baselines
4. Cosign-of-bytes vs cosign-of-trust ("Gates all green" cosign should mean *I personally saw the green*)
5. Drift-cure broader-audit complements post-revert cascade-grep
6. The dragon is the test suite + the dragon is FULL (16-worker canonical, not impacted-only)
7. Integrity-check holds the bridge ("good to go IF skipped nothing")
8. **Craft-protection > gate-protection** (figs: *"check our work == protect our feature, your craft, from drift; the motivation beyond merge"*)
9. Cure-INTENTIONAL vs cure-ACCIDENTAL substrate-changes (test-cascade-fix for intentional, cure-(17) family)
10. SSH-cohort-check-vantage-priority (most-recent-mtime + active-inference > log-history)
11. Bounce-after-ship ordering (preserve cosign-as-substrate before any restart)
12. The treadmill has a limit (if upstream moves AGAIN during cure-cycle byte-walk window, accept "N behind" + ship under standing-lane)

## Runtime-identical-attest chain (PR #84 + this corpus)

Continuation-load-bearing surface (24 files) zero hunks at every hop across the full 10-cure-arc:

```
cure-(13) 718d8558eb → (14a) cac1d3cc01 → (14b) aacfb53199 → (15) 6fb0e108bf → 
(16) 3b0eba6adb → (17) 6acbda514c → (18) 607d72ac33 → (19) e1c012c3be → 
(20)v1 a794983a58 → (20)v2 533f19a561 → (20)v3 a726a815af
```

8 R-TA-1-RECONFIRMs across the chain demonstrate behavioral byte-identity at every hop. Empirically verified at v3 by fresh fires + same trace-contract + same fan-out counter + same status discriminator as cure-(13).

## What this corpus delivers

| Row | Prince | Status | Path |
|---|---|---|---|
| `continuation-live-fire.md` | 🌊 ronan | ✅ landed (PR #85) | `continuation-live-fire.md` |
| `inter-session-targeting/` | 🩸 cael | ✅ landed | `inter-session-targeting/` |
| `post-compaction-threshold/` | 🩸 cael | ✅ landed | `post-compaction-threshold/` |
| `R-TA-1/` chain-budget | 🌫 silas | ✅ landed | `R-TA-1/` |
| `R-TA-2/` token-counter | 🌫 silas | ✅ landed | `R-TA-2/` |
| `R-TA-1-RECONFIRM/` | 🌫 silas | ✅ landed (8th in chain) | `R-TA-1-RECONFIRM/` |
| `deploy-validation/` | 🌿 scribe | ✅ landed (4-seat fleet AFTER state) | `deploy-validation/` |
| `gateway-health/` | 🌻 elliott | ⏳ in flight | `gateway-health/` |

## See

- [`README.md`](./README.md) — corpus overview + clawsweeper-facing index
- [PR #79925](https://github.com/openclaw/openclaw/pull/79925)
- [Cure-(13) baseline PROOFS](../718d8558eb618304b5cc43c8a3b5d93ff5bef454/) — first ship-arc proofs
- [PR #84 runtime-identical-attest](https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/84) — 24/24 zero-hunks chain

— Ronan 🌊 (assembling on behalf of cohort per figs's `1506054050` directive)
