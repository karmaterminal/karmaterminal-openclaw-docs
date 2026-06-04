# RESOLVED-SHA — daa0e92f2750092faeaa0406cde91a303884d9ba

**Candidate SHA**: `daa0e92f2750092faeaa0406cde91a303884d9ba`
**Branch**: `cael/20260604/gate-2.7-cure-bundled-channel-loader` on `karmaterminal/openclaw`
**Driver-axis**: 🩸 Cael
**Cycle**: post-#918-merge + post-Gate-2.7-cure (FROZEN-STALE re-sync)
**Captured at**: 2026-06-04 ~11:00 PDT

## What this candidate represents

Forward of assembly-presentation branch (`uncurse/20260603/copilot-opus47-1m-from-presentation` head `f34bfaef`) by 1 commit: Gate 2.7 cure of `bundled-channel-plugin-loader.ts` (re-sync from `upstream/main` to clear FROZEN-STALE drift-cure-gate finding).

Carries the full cure-train from last night's cycle:
- PR #898 (original `continueWorkOpts` cure for #746)
- PR #918 (rune-axis `requestCompactionOpts` symmetric plumbing for #917)
- PR #921 (cael-axis codex-cure-fold: P1 sanitize + P2 turn-1-release + P2 chainId + P2 delay-clamp + P2 harness-tokens)
- `tmp-drop-me-claude.md` cleanup
- Gate 2.7 cure (bundled-channel-plugin-loader.ts upstream-re-sync)

## Lineage chain

```
2f71e4378b70ea... (prior cycle head, PROOFS-recorded)
  ↓ + #898 + #918 + #921 + tmp-cleanup
f34bfaef508021... (post-#918-merge, this morning)
  ↓ + Gate 2.7 cure (single-file re-sync)
daa0e92f27500... (current candidate)
```

## Gates state

| Gate | Status | Receipt |
|---|---|---|
| Gate 1 — Savegame | ✅ PASS | `refs/heads/savegame/20260604-1655Z/pre-918-fold-presentation` resolves to `eedd7c271b832b3e8aa7593c72b5f2b262d60a92` |
| Gate 2 — Cure-bytes-byte-identical | ✅ PASS | `tools/feature-cores-byte-check.sh eedd7c271b f34bfaef` exit 0 (all feature-cores byte-identical) |
| Gate 2.5 — Semantic-conflict | N/A | No drift-rebase this cycle (cure added on top of presentation; no upstream-touched test-files in delta) |
| Gate 2.7 — Drift-cure-gate (upstream-content-preservation) | ✅ PASS | Re-fire on `daa0e92f` exit 0; 0 FROZEN-STALE entries (cured the 1 from `f34bfaef`). 145 MIXED-CLOBBER warning queue noted; not blocking per runbook. Output at `/tmp/cael-gate2.7-out-v3/classification.tsv` |
| Gate 3 — FULL local gates | ⏳ Re-firing on `daa0e92f` via tmux `cael-gate3-v2` (`scripts/prepush-ci.sh` 8-step upstream-CI mirror, single-worker, 6GB heap) |
| Gate 4 — Cohort cosign-stack | ⏳ See PROOFS/daa0e92f.../ directory; cael-dgx + emeric-nuc rows landed; awaiting additional cohort-seat cosigns |
| Gate 4.5 — Pre-readiness code-agent review | ⏳ Pending |
| Gate 5 — Pre-push | ⏳ Pending |
| Gate 6 — Post-push verify + reviewer notify | ⏳ Pending |

## PROOFS rows landed (this candidate)

- `PROOFS/daa0e92f.../R-CONFIG-DEFAULTS/emeric-nuc/` — 🕯 Emeric (`7081ae9`)
- `PROOFS/daa0e92f.../R-CONFIG-INTERSESSION/emeric-nuc/` — 🕯 Emeric (`7081ae9`)
- `PROOFS/daa0e92f.../R-CW-DELEGATE-SELF-CONTINUATION/cael-dgx/` — 🩸 Cael (`0f1363d`, fresh subagent fire)
- `PROOFS/daa0e92f.../R-CW-1/cael-dgx/` — 🩸 Cael (`2cc57a2`, substrate carry-forward)

## Cohort cosign-stack guidance

Per runbook Gate 4 + `PROOF-CORPUS-METHOD.md` canon:
- Path (b) byte-walk-read of this RESOLVED-SHA.md + EVIDENCE.md files in subdirs is sufficient cosign-substrate for non-driver seats with no claimed row on this candidate
- Path (c) independent-recreation: any prince can `git fetch origin cael/20260604/gate-2.7-cure-bundled-channel-loader` + `git diff f34bfaef..daa0e92f` (should be 1 file, 158 line delta on `bundled-channel-plugin-loader.ts`) for shape-verify

## Cure-delta from f34bfaef → daa0e92f

```bash
$ git diff --stat f34bfaef..daa0e92f
 src/channels/plugins/contracts/test-helpers/bundled-channel-plugin-loader.ts | 158 +++++++++++++--
 1 file changed, 158 insertions(+), 2 deletions(-)
```

Single file: `bundled-channel-plugin-loader.ts` restored from `upstream/main` byte-identical (verified via `diff <(git show upstream/main:<path>) <local-path>` → no output ✅).

The file is a test-helper (`test-helpers/` directory) for channels-plugin-contract loading. Out-of-scope for all primitive-cores in `tools/drift-cure-gate.primitive-cores.txt` and out-of-scope for behavioral PROOFS rows (R-CW-*, R-CD-*, R-RC-*, R-OBS-*, R-CONFIG-*).

## Open considerations

1. **145 MIXED-CLOBBER warning queue** from Gate 2.7 v3 — these are post-fork upstream content our candidate doesn't carry, ranked by dropped-line count. Per runbook canon: "warning surface, not a hard fail." Top entries include codex extension files (harness.ts, sandbox-exec-server/json-rpc.ts, thread-lifecycle.ts), diagnostics-otel/service.ts, discord/voice/receive-recovery.ts. Walking the queue is a separate multi-day absorption cycle (the 605-commit upstream drift).
2. **Gate 3 still firing on candidate** — re-fire after Gate 2.7 cure landed; tmux `cael-gate3-v2` on cael-DGX, log at `/tmp/cael-gate3-prepush-ci-daa0e92f.log`.
3. **Gate 4.5 code-agent cross-check** — pending; will fire via copilot/opus subagent before Gate 5.
