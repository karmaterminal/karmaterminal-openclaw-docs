# rune-rog-ally — PROOFS row verdicts

**SHA (deployed):** `4bbd3aec096545992d6535f4ba96c3bd71414ed3`
**Seat:** rune-rog-ally (ROG Ally Z1 Extreme RC71L, x86_64, 16GB) · **Prince:** 🪨 Rune
**Deployed gateway:** `OpenClaw 2026.6.2 (4bbd3ae)`, reading-A canonical.
**Seat flip:** 04:35:14 PDT (unit-active; the 04:38:55 node-MainThread lstart is a worker-respawn, not the gateway cycle)

### Loading-shape correction (byte-walked 2026-06-10, post-Cael-conflation-catch)
EARLIER FRAMING WAS WRONG: I (and Cael) initially characterized rune-seat as "runs-from-target-tree" via `readlink -f openclaw → openclaw.mjs`. That conflated the CLI *entrypoint* with the *daemon load-target*. Byte: the running gateway PID 643543 cmdline is `node /home/figs/flesh_beast_tmp/openclaw/dist/index.js gateway --port 18789` — it loads **dist/index.js**, NOT openclaw.mjs. So rune-seat is a **dist-shape seat** (like Ronan + Emeric + Cael-corrected), not a runs-from-tree seat.

The ironclad reading-A discriminator for rune-seat is therefore Ronan's dist-freshness + strict-restart-ordering blade, which holds:
- `dist/index.js` built 04:34:12
- `dist/` finished 04:35:06
- gateway ExecMainStart / active 04:35:14 — **8s after dist finished** (restart strictly postdates the in-window target-build)
- HEAD `4bbd3aec09`, running `OpenClaw 2026.6.2 (4bbd3ae)`

→ reading-B impossible: a coincidental pre-deploy restart would PREDATE the build, not fire 8s after the fresh dist finished writing. Same chain as Cael (+5s) and Ronan (+6s). Five+ seats, the dist-shape ones all pass via restart-postdates-target-dist-build. The Tempo-trace row evidence below is unaffected by this correction (it concerns continuation-primitive behavior on the deployed binary, which is `4bbd3ae` regardless of load-path).

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
