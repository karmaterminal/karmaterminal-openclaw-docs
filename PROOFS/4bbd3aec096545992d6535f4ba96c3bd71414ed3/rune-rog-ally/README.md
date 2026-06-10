# rune-rog-ally — PROOFS row verdicts

**SHA (deployed):** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Seat:** rune-rog-ally (ROG Ally Z1 Extreme RC71L, x86_64, 16GB) · **Prince:** 🪨 Rune
**Deployed gateway:** `OpenClaw 2026.6.2 (4bbd3ae)`, reading-A canonical.
**Seat flip:** 04:35:14 PDT (unit-active; the 04:38:55 node-MainThread lstart is a worker-respawn, not the gateway cycle)

### Loading-shape correction (byte-walked 2026-06-10, post-Cael-conflation-catch)
EARLIER FRAMING WAS WRONG: I (and Cael) initially characterized rune-seat as "runs-from-target-tree" via `readlink -f openclaw → openclaw.mjs`. That conflated the CLI *entrypoint* with the *daemon load-target*. Byte: the running gateway PID 643543 cmdline is `node /home/figs/flesh_beast_tmp/openclaw/dist/index.js gateway --port 18789` — it loads **dist/index.js**, NOT openclaw.mjs. So rune-seat is a **dist-shape seat** (like Ronan + Emeric + Cael-corrected), not a runs-from-tree seat.

The reading-A discriminator for rune-seat (one of several strands; see the corrected tiering below — ordering is a STRONG strand, content-provenance is the AIRTIGHT one) includes Ronan's dist-freshness + strict-restart-ordering blade, which holds:
- `dist/index.js` built 04:34:12
- `dist/` finished 04:35:06
- gateway ExecMainStart / active 04:35:14 — **8s after dist finished** (restart strictly postdates the in-window target-build)
- HEAD `4bbd3aec09`, running `OpenClaw 2026.6.2 (4bbd3ae)`

→ reading-B impossible: a coincidental pre-deploy restart would PREDATE the build, not fire 8s after the fresh dist finished writing. Same chain as Cael (+5s) and Ronan (+6s). Five+ seats, the dist-shape ones all pass via restart-postdates-target-dist-build. The Tempo-trace row evidence below is unaffected by this correction (it concerns continuation-primitive behavior on the deployed binary, which is `4bbd3ae` regardless of load-path).

### CORRECTED close: build-stamps are frozen-HEAD corroboration; content-provenance is the airtight leg
(Earlier this section said "dist-attests-own-build-commit closes B airtight, Ronan's blade." That OVERCLAIMED — corrected here per cohort byte-walk of the build-script + Ronan's retraction `1514247829`.)

The build-stamps on rune-seat all read target:
- `dist/build-info.json`: `"commit": "4bbd3aec096545992d6535f4ba96c3bd71414ed3"`
- `dist/.buildstamp`: `"head":"4bbd3aec096545992d6535f4ba96c3bd71414ed3"`
- `dist/.runtime-postbuildstamp`: `"head":"4bbd3aec096545992d6535f4ba96c3bd71414ed3"`
- compiled startup metadata: `(4bbd3ae)` ×8, `(9b1f42a)` ×0; **zero `9b1f42a` bytes anywhere in dist** (full recursive scan)

**BUT the build-stamps are NOT a bytes-attestation.** `scripts/write-build-info.ts` `resolveCommit()` = `git rev-parse HEAD` at build-time (`:27`) — NO content-hash, no sha256, no inspection of compiled bytes. So `.buildstamp.head` records the CHECKOUT's HEAD when the build ran, NOT a hash of what was compiled. A build at HEAD-target compiling stale/cached artifacts would write identical `.buildstamp.head=4bbd3ae`. So build-stamps = **frozen-HEAD provenance: STRONG (rules out a stale `9b1f42a` dist, since that dist would carry `9b1f42a` in its stamp), but NOT airtight-alone** (it's a HEAD-read, not a bytes-attestation).

**The AIRTIGHT bytes-attestation is content-provenance (Emeric's finding):** target-only symbols compiled INTO the dist chunks, absent at `9b1f42a` source — `contextEngineOwnsCompaction`, `after_context_engine`, `nativeHarnessCompaction` (+ the #978 post-compaction token-branch in `dist/tokens-*.js`), all present in dist chunks, 0 files at `9b1f42a` source. The compiled output CONTAINS target-only code → built-from-target-source, which a stale build cannot have. THAT closes the "built-from-target" residual the frozen-HEAD stamp cannot.

**Corrected reading-A tiering (4 strands, naming the load-bearer):**
- AIRTIGHT load-bearer: content-provenance (Emeric's symbol-in-chunk) + zero-stale-residue (my `(9b1f42a)`×0 negative complement)
- STRONG corroboration: build-stamps (frozen-build-HEAD, rules out stale-dist) + ordering-blade (restart postdates target-dist-build)

Attribution correction: Ronan's blade is the ORDERING + he ADOPTED Emeric's content-provenance; Ronan RETRACTED the "dist-stamp attests" framing (`1514247829`). My earlier "Ronan's dist-stamp blade is airtight" credit + "closes B airtight" grade were both wrong — build-stamp is frozen-HEAD corroboration, content-markers are the airtight leg. Reading-A holds (B impossible by content); the grade is corrected from "build-stamp-airtight" to "content-provenance-airtight + build-stamp-strong-corroboration."

## Verdict table

| Row | Behavior | Verdict | Evidence |
|---|---|---|---|
| R-CW-DELEGATE-SELF-CONTINUATION | `continue_delegate` self-continuation loop | ✅ PASS | Live dispatch → spawn (04:46:15) → wake → return; Tempo trace `e24be71c…` 54 spans, in-tree `dispatch→harness.run→run` stitch byte-walked |
| R-CW-7 | traceparent E2E propagation across continuation | ✅ PASS | Same trace-id `e24be71c…` carries dispatch→harness.run→run across the continuation boundary (stitched subtree, not disconnected root) |
| R-OBS-2 | Tempo trace-tree viz + parent-child span hierarchy export | ✅ PASS | Full 54-span hierarchy exported (`R-OBS-2_trace_e24be71c.json`), two-branch stitch under one root rendered |
| R-CW-6 | chain-depth-boundary reject (`maxChainLength`) | ⏸️ HONEST-LIMIT | Code-path verified live + correct (`scheduler.ts:27` `chain-capped`); empirical induce deferred — `maxChainLength` resolves global-only (`config.ts:64`), lowering it would trip live cohort chains. Reproducer documented, fire when cohort-idle |

## Honest-limits this cycle
- **R-CW-6**: deferred the temporary-low-cap induce because `resolveContinuationRuntimeConfig` reads global `agents.defaults.continuation` only (no per-agent override), so inducing my own reject would lower the chain cap for the whole gateway including the cohort's live PROOFS chains. Safety call (don't disrupt shared-host working state), not a defect — code-path presence + correctness verified on the deployed binary. Re-fire reproducer is in `R-CW-6.md`.

## Cross-cycle nuance (vs prior `9b1f42a`)
On `4bbd3aec096`, `continuation.queue.drain` roots as **separate traces** rather than nesting within the dispatch trace (confirmed via service.name search). The in-tree proof is the `continuation.delegate.dispatch → harness.run → run` stitch (present + load-bearing); queue.drain is sibling-rooted this cycle. Named for fidelity across all three rows rather than forced to match the prior nested shape.

## Not-mine this cycle
- R-CD-CHAINED-DEPTH-2 TEST-2 (inter-session return substitution): reverts to 🌫 Silas — his canary-seat is awake (PONG'd 04:37, watchdog live on lothric), so the substitution-condition doesn't trigger. Held as backup only if frond reassigns.
