# PROOFS — Emeric🕯 lane (emeric-nuc) on ship-SHA `4bbd3aec096545992d6535f4ba96c3bd71414ed3`

**Seat:** emeric-nuc (Intel NUC, i7-12700H 6P+8E Alder Lake, 64GB, CachyOS)
**Exact ship-SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3` (deployed, byte-verified live at fire-time)
**Driver:** frond-scribe🌿 (corpus index). This is the emeric-seat row-set; cross-walk rows assemble cohort-wide.
**Captured:** 2026-06-10 ~04:42–04:50 PDT (post-deploy PROOFS sweep on `4bbd3aec096`).

## SUT provenance (deployed-SHA baseline) — reading-A, TRIPLE-CLOSED

emeric-nuc is a **dist-loading seat** (running gateway = `node /home/figs/flesh_beast_tmp/openclaw/dist/index.js gateway`, repo-tree `dist/` absolute path, NOT `node_modules/dist`, NOT run-from-tree). CLI entrypoint `command -v openclaw` → `~/.local/bin/openclaw` → `dist/index.js` shim is only the launcher; the daemon loads dist. (Cohort-corrected: ALL 6 prince-seats are dist-loading — the earlier "runs-from-tree" reads were CLI-entrypoint-vs-daemon-load conflation; uniform one-shape, not two classes.) reading-A is closed by three legs of DISTINCT strength:

1. **dist-freshness strict-ordering** (Ronan's blade) — CIRCUMSTANTIAL: `dist/index.js` built 04:33:39 → `dist/` finished 04:34:19 → gateway restarted 04:34:23 (PID 3456946) — restart strictly postdates the in-window dist-build by ~4s. A build-stage-checkout-with-pending-restart cannot have a restart that already fired AFTER the build completed → reading-B impossible by ordering.
2. **content-provenance** (Emeric's method, now cohort-canonical per commit `eec6dba`) — the SOURCE-DERIVATION proof, AIRTIGHT: three genuinely-target-only constructs absent at pre-deploy `9b1f42a` source but present in the built dist chunks — symbol `contextEngineOwnsCompaction` (0 files @9b1f42a → in `dist/compact.queued-BlByBXy0.js`), string `"after_context_engine"` (0→in-dist 4 files), string `"nativeHarnessCompaction"` (0→in-dist 1 file). Pre-deploy code never had these; the running dist *contains compiled code that only exists in target source* — unspoofable by a frozen-HEAD stamp. **This is the leg that closes "compiled-from-target-source" airtight.**
3. **dist build-stamp** (Ronan's finding, verified on emeric) — build-time-FROZEN-HEAD, strong-but-NOT-source-attestation: `dist/build-info.json` `commit=4bbd3aec096…`, `dist/.buildstamp` `head=4bbd3aec096…`, `dist/.runtime-postbuildstamp` `head=4bbd3aec096…`; `dist/cli-startup-metadata.json` carries `(4bbd3ae)`×8 / `(9b1f42a)`×0; `9b1f42a694ad` anywhere in `dist/` = 0 files (zero stale residue). HONEST LIMIT (per Ronan's sharpening `1514258...`): `write-build-info.ts` writes these from `git rev-parse HEAD` at build-time, so they record HEAD-WHEN-BUILT (frozen, better than runtime `--version` recompute), NOT a cryptographic attestation the compiled JS derives from `4bbd3ae` source. Residual "frozen-HEAD ≠ source-derivation" — which leg #2 (content-markers) closes.

**Net: emeric reading-A is AIRTIGHT via leg #2 (content-markers = source-derivation), with #3 as frozen-HEAD corroboration + #1 circumstantial.** (Earlier "triple-closed / dist-self-attests" phrasing tightened here: build-stamp is frozen-HEAD not attestation; content-markers are the airtight source-derivation closer.)

- HEAD `git rev-parse HEAD` → `4bbd3aec096545992d6535f4ba96c3bd71414ed3` ✓
- running `OpenClaw 2026.6.2 (4bbd3ae)` ✓
- reflog: HEAD reached target 04:34:22 (checkout from `9b1f42a`)
- `compactionFailureContext` literal grep src/+dist/ = **0** = clean Form-B upstream-faithful state (NOT the count-4 catastrophe). **Referent — frond's DEFINITIVE FINAL ruling (`1514255686`, ends the pin-churn; supersedes ALL prior pins including her own `1514253204` (a)-pin):** `compactionFailureContext` is frond's GO-shorthand (grep=0, NOT a source symbol); she is **NOT pinning a single source-referent** — there isn't one to byte-recover, and 3 real code-surfaces each fit a different reading. The "(a) tool-registration vs (c) queued-staging vs cross-walk" question is **MOOT**, because the only thing that matters is byte-established: **every candidate surface PASSES on `4bbd3ae`** —
  - **tool-registration:** full continuation-tool-set registers (emeric `R-CONTINUATION-TOOL-REGISTRATION.md` misconfig-warn 12/12 + all-3-families; Ronan 6/6) ✅
  - **queued-count:** `:559`=5 full-stage; `:634`'s 4 is an *accounted* budget-reduction (`droppedDelegates:1`), NOT a silent under-stage — so coherent under the semantic "never-silently-under-staged" reading ✅
  - **cross-walk:** Elliott's R-OBS-1 6/6 ✅
  - **volitional-surface:** intact, omit-at-zero by design (`status-message.ts:117-118`), reads 0 ✅
  So whatever frond meant in the GO, **the deployed binary satisfies it every way — the gate clears.** The exact label is **figs's coinage to confirm at his discretion: non-blocking, banked as a morning question.** (queued-count was earlier mis-cited as a *literal* never-4 invariant and byte-corrected via `:634`; under frond's final ruling it's simply one of the all-passing surfaces, not THE referent — nothing is THE referent.) The deployed-`0` is the clean state under every reading; **stop re-deriving — there's nothing left to derive.**
- #978 fix present: commit `0dba1d7` (announce-path post-compaction stages under `targetRequesterSessionKey` parent, not `childSessionKey` leaf — cites Emeric's whose-sessionKey sub-byte)

## Test-logic lane (vitest on the exact deployed-SHA code) — 353/353 EXIT 0

`vitest run` on live `4bbd3aec096` (12 lane suites → 19 files w/ pull-ins), **353 tests PASSED, EXIT 0**, 19.2s:

| Row | Suite(s) | Result |
|-----|----------|--------|
| R-CW-1 | continue-work-tool.test + .boundary + attempt-execution.continue-work-opts | ✅ |
| R-CD-CHAIN-GUARD | delegate-dispatch.chain-depth-exhaustion | ✅ |
| R-CD-POSTCOMP | post-compaction-delegate-dispatch (carries `{queuedDelegates:5,droppedDelegates:2}`) | ✅ |
| R-CD-CONTINUATION | subagent-announce.continuation.runtime + -delivery + -dispatch | ✅ |
| R-RC-STORE-MERGE | store.continuation-merge + continuation-delegate-store(.ordering) | ✅ |
| R-CD-DRAIN | subagent-announce.continuation-drain | ✅ |

(Broader continuation/compaction surface independently green: continue-delegate-tool.test + crosssession-gate + request-compaction-tool + delegate-dispatch + post-compaction-delegate-dispatch = 170/170 EXIT 0.)
Also: `completeSubagentRunWithRecovery` = 8 (def @subagent-registry.ts:370 + 7 call-sites) — the N+4 silent-drop sibling at FULL count, not regressed.

## Live-fire rows (continuation/delegation/compaction tools on the deployed runtime)

| Row | What | Verdict | Evidence |
|-----|------|---------|----------|
| R-CD-TOOL | `continue_delegate(silent-wake)` tool-form delegate-spawn | ✅ PASS | [R-CD-TOOL-EVIDENCE.md](./R-CD-TOOL-EVIDENCE.md) |
| R-CD-TOKEN | `[[CONTINUE_DELEGATE:]]` bracket-form delegate-spawn | ✅ PASS | [R-CD-TOKEN-EVIDENCE.md](./R-CD-TOKEN-EVIDENCE.md) |
| R-CW-TOOL | `continue_work()` self-continuation | ✅ PASS | [R-CW-TOOL-EVIDENCE.md](./R-CW-TOOL-EVIDENCE.md) |
| R-RC-1 | `request_compaction()` threshold-reject (ctx 23% < 70%) | ✅ PASS | [R-RC-1-EVIDENCE.md](./R-RC-1-EVIDENCE.md) |
| R-RC-2 | `request_compaction()` accept-path (>70%) | ⚠️ HONEST-LIMIT | ctx=23%; gate-stack correctly blocks synthetic-fire (per METHOD taxonomy) |
| R-CD-CHAINED-DEPTH-2 | recursive depth-2 chain (dual-seat w/ silas-lothric) | ✅ PASS | [R-CD-CHAINED-DEPTH-2-EVIDENCE.md](./R-CD-CHAINED-DEPTH-2-EVIDENCE.md) |

## Honest scope

These are vitest test-logic runs on the exact deployed-SHA code + live-tool fires on the deployed runtime with system-event/structured-receipt artifacts captured per-row. The full `continuation.*` OTel span-trees for the live-fire rows are the scribe-side Tempo pull (emeric-seat cannot reach `tempo.dandelion.cult` to self-capture; traceparents are recorded per-row for the pull). R-RC-2 accept-path is a documented designed-block, not a feature-gap.

Gathered: Emeric🕯, 2026-06-10 ~04:50 PDT.
