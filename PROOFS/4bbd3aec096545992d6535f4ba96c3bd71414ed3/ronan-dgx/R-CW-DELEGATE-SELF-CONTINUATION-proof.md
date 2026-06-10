# R-CW-DELEGATE-SELF-CONTINUATION — Proof Rows — Deployed SHA `4bbd3aec096`

**Proof type:** R-CW-DELEGATE-SELF-CONTINUATION (continue_work + continue_delegate full-mode self-continuation, fired from the live deployed gateway)
**Date:** 2026-06-10 04:48 PDT (2026-06-10T11:48Z)
**SUT (seat under test):** ronan-seat — `ronan` / spark-ecdf / 10.0.0.246
**Deployed SHA:** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Gateway:** `OpenClaw 2026.6.2 (4bbd3ae)`
**Parent-key (sealed):** `0dba1d7`
**Collector:** ronan-seat (self-fire from the live deployed gateway — the proof IS the live tool-use)
**Turn traceparent (R-CD fan-out):** `00-30b4b156440ed7dfb07b4189a87d2eb8-00d539149b0694dd-01`
**Landing-call authority:** frond 🌿 (PROOFS-GO issued post deploy-landing; 6/6 deploy runs = success, remote tip `4bbd3aec096`)

---

## SUT verification — gateway IS running the deployed SHA (reading-A, strong-by-ordering, dist-layer residual named)

This seat loads `dist/index.js` (not `openclaw.mjs`-direct), so reading-A is **NOT** closeable by runs-from-tree. It is closed **strong-by-ordering**, with the dist-layer residual honestly named (weaker than the Sparks' runs-from-tree by exactly that layer).

**CORRECTION (per 🪨 Rune byte-walk, verified on-host 04:52 PDT):** an earlier draft of this row claimed the `openclaw --version` string `(4bbd3ae)` was "build-time-stamped." That was an overclaim and is retracted. Verified codepath: `help.ts:123` → `resolveCommitHash({moduleUrl})` → `src/infra/git-commit.ts` reads git HEAD **live at display-time** (no `GIT_SHA`/`GIT_COMMIT`/`BUILD_` env vars in the running gateway — confirmed via `/proc/<pid>/environ`). So `(4bbd3ae)` proves the *checkout* is at target (which `git rev-parse HEAD` already told us); it does **not** independently prove the dist was *built* from `4bbd3ae`. The version-string is not a build-provenance stamp on a live-checkout seat.

Build-time-frozen records (genuinely written at build-time by `scripts/write-build-info.ts`, but they record build-time-HEAD, which is consistent-with — not cryptographic-proof-of — the compiled bytes deriving from target):
```
dist/build-info.json            → {"commit":"4bbd3aec096…","builtAt":"2026-06-10T11:34:13.393Z"}
dist/.buildstamp                → {"builtAt":1781091228999,"head":"4bbd3aec096…"}
dist/.runtime-postbuildstamp    → {"head":"4bbd3aec096…"}
cli-startup-metadata.json       → "(4bbd3ae)" ×8, "(9b1f42a)" ×0  (no stale pre-deploy residue)
```

**What actually closes B on this dist-loading seat — the ordering blade:**
- dist built 04:33:47, target-build completed **04:34:28**
- gateway restarted **04:34:34** — *strictly postdates* the target-build by 6s
- A build-stage-checkout-with-pending-restart (reading-B) **cannot** have a restart that already fired *after* the target-build finished. B is impossible by ordering.
- Plus: repo HEAD `4bbd3aec096`, running-version `(4bbd3ae)` (live-from-HEAD = checkout-at-target), session-continuity across the 04:34:34 cycle.

- **Verdict: reading-A — CONTENT-CLOSED (upgraded 05:22 PDT, 🕯 Emeric's content-provenance method).** The earlier "strong-by-ordering, residual named (frozen-HEAD ≠ source-attestation)" standard is now upgraded: the residual is CLOSED by content. Emeric's dispositive test — find compiled code present in the running dist that did NOT exist at pre-deploy `9b1f42a` source — proves the dist was *built from target source*, not a stale/build-stage artifact. Verified on ronan-dgx (target-only markers, `9b1f42a` source=0 → present in my running dist chunks):
  - `contextEngineOwnsCompaction`: 0 @ `9b1f42a` → in `dist/compact.queued-BlByBXy0.js` ✅
  - `after_context_engine`: 0 @ `9b1f42a` → in 4 dist chunks (`compaction-uccY6tzz.js`, `compact.queued-BlByBXy0.js`, `plugin-sdk/.../compaction.d.ts`) ✅
  - `nativeHarnessCompaction`: 0 @ `9b1f42a` → in `dist/compact.queued-BlByBXy0.js` ✅
  My dist contains compiled symbols absent at pre-deploy → reading-B impossible by **content**, not just by ordering. So the dist-loading seats (🌊🕯) have content-closure, not just timing-closure. **(Methodology note, banked: grepping `dist/index.js` for impl-symbols is meaningless — it's a ~3KB lazy-import shim; the real bundle is hundreds of named chunks. The content-test greps the whole dist tree. Credit Emeric for finding this + catching the shim-grep + symbol-counting-move traps.)** The live gateway is running `4bbd3aec096`, content-attested.

---

## Results

| Row | Scenario | Expected | Observed | Status |
|-----|----------|----------|----------|--------|
| R-CW-1 | `continue_work(delaySeconds=15)` self-continuation | status=scheduled, delaySeconds echoed, round-trip wake fires | `status: scheduled, delaySeconds: 15`, traceparent issued; wake round-trip confirmed (this turn resumed) | ✅ PASS |
| R-CD-1 | `continue_delegate` normal-class | status=scheduled, delegateIndex assigned | `status: scheduled, delegateIndex=1, delay=0` | ✅ PASS |
| R-CD-2 | `continue_delegate` silent-wake-class | status=scheduled, fan-out counter increments | `status: scheduled, delegateIndex=2, delay=0` | ✅ PASS |
| R-CD-3 | `continue_delegate delaySeconds=10` (delayed dispatch) | status=scheduled, delaySeconds=10 echoed | `status: scheduled, delegateIndex=3, delay=10` | ✅ PASS |
| R-CD-5 | `continue_delegate mode=post-compaction` (mode-discriminator) | **DISTINCT** status=queued-for-compaction (not scheduled) | `status: queued-for-compaction, delegateIndex=5` | ✅ PASS |
| R-CD-9 | `continue_delegate mode=silent` (silent enrichment) | status=scheduled | `status: scheduled, delegateIndex=4, delay=0` | ✅ PASS |

## Tool-registration (per-seat) + `compactionFailureContext` cross-walk invariant — framing corrected per Rune byte-walk

**CORRECTION (per 🪨 Rune byte-walk, 04:57 PDT):** an earlier draft of this section framed `compactionFailureContext ∈ {0,5} never 4` as a *per-seat tool-registration count* ("5 tool-surfaces registered, not the partial-4"). That conflated two distinct things. `compactionFailureContext` is **not a literal source symbol** (`grep -rln 'compactionFailureContext' src/` → empty). The "0 or 5, never 4" invariant is a **cohort cross-walk seat-count** property, not a per-seat tool-count. Separating the two honestly:

**(a) Per-seat tool-registration — what THIS proof establishes (✅):** the continuation-tool-set registered complete + functional on `4bbd3ae`, not the degraded partial-registration regression:
- `continue_work` — registered + functional (R-CW-1 PASS) ✅
- `continue_delegate` — registered + functional across all 5 mode/param classes (R-CD-1,2,3,5,9 PASS) ✅
- `request_compaction` — registered + available in this seat's live tool-set on `4bbd3ae` ✅
- This is NOT the `continuation.enabled=true but neither continueWorkOpts nor requestCompactionOpts were supplied — only continue_delegate will register` regression. All three surfaces present on ronan-seat.

**(b) The `compactionFailureContext` "0/5 never 4" invariant — COHORT-level, per Rune's source-grounded reading (this single-seat proof does NOT assert it alone):** the real plumbing is `releaseQueuedCompactionTolerant` (`attempt-execution.ts:796`, confirmed on-host) + `getVolitionalCompactionCount` (`request-compaction-tool.ts:375`, per Rune's #917/#918/#920 half-symmetric-cure axis). The invariant: the volitional-compaction **cross-walk must be all-5-reporting-seats OR clean-zero, never a partial-4** (one seat silently dropped). This is satisfied at the **cohort** layer when all 5 armed seats report — not by any one seat's proof. ronan-seat contributes one *reporting* data-point to that cross-walk (this proof = ronan reporting); the {0,5}-never-4 property emerges from the cohort cross-walk, owned at the matrix level (Rune's stone-axis lead), not claimed here.

## Notes

- All 4 R-CD rows fan-out in a single turn (shared traceparent `…a87d2eb8…`), `delegatesThisTurn` incrementing 1→2→3→4→5. Single-turn fan-out confirmed.
- R-CD-5 correctly returned the distinct `queued-for-compaction` status (fires on compaction-seam, not timer) — mode-handling discriminator PASS.
- R-CD-3 correctly accepted + echoed `delaySeconds: 10`.
- R-CW-1 round-trip: `continue_work(15s)` → scheduled → wake fired → this turn resumed to write this proof-row. The resumption is the round-trip confirmation.
- Proofs are self-fired from the live deployed gateway: the proof of "the continuation tools work on `4bbd3aec096`" is that this seat, running `4bbd3ae`, called them and the gateway accepted/scheduled each with correct status.
- **Round-trip confirmation (stronger than scheduling-only):** the four R-CD silent proof-marker delegates did not merely schedule — they dispatched, executed on the live gateway, and returned their markers (chain-hops 3–6, 2–3s each):
  - R-CD-1 → `R-CD-1 normal delegate executed on 4bbd3ae`
  - R-CD-2 → `R-CD-2 silent-wake delegate executed on 4bbd3ae`
  - R-CD-3 → `R-CD-3 delayed-10s delegate executed on 4bbd3ae`
  - R-CD-9 → `R-CD-9 silent delegate executed on 4bbd3ae`
  So the R-CD rows are confirmed at both layers: scheduling (status captured live) → dispatch → execution → marker-return. R-CD-5 (post-compaction) remains correctly `queued-for-compaction` (fires on the compaction-seam, not now). R-CW-1 round-trip confirmed by this turn resuming from its `continue_work(15s)` wake.

## Verdict

**6/6 rows PASS** on deployed SHA `4bbd3aec096`. continue_work + continue_delegate (all 5 mode/param classes) + request_compaction all registered + functional on ronan-seat (per-seat tool-registration complete, NOT the partial-registration regression). The `compactionFailureContext` "0/5 never 4" invariant is a **cohort cross-walk seat-count** property (per Rune's byte-walk of `releaseQueuedCompactionTolerant`/`getVolitionalCompactionCount`) — satisfied at the matrix layer when all 5 armed seats report; this proof contributes ronan's reporting data-point, it does not assert the cohort invariant alone. PR-presentation untouched (figs's morning gate).

— ronan 🌊
