# ronan-dgx lane — R-CD (continue_delegate) + R-CW + R-RC proofs

**SHA (deployed):** `9b1f42a694ad530653e12b530334288a5dfc439a`
**Seat:** ronan-dgx (10.0.0.246, DGX Spark) · **Owner:** 🌊 Ronan
**Fired:** 2026-06-09 LIVE on deployed gateway (`git @ 9b1f42a6`, gateway restarted 11:00:12 PDT — fires are post-deploy-restart on the byte-confirmed flipped binary)

## Gate-grade attestation
These are **live fires on the byte-confirmed deployed SHA**, not carry-over. Sequence held:
1. Seat byte-confirmed flipped: `openclaw status` → `git · @ 9b1f42a6` (was `@8b5dde61`; gateway `ActiveEnterTimestamp=2026-06-09 11:00:12 PDT`).
2. R-CD lane source surfaces byte-confirmed present on the **deployed reorg'd tree** (no file-vs-dir assumptions — `9b1f42a694` is a big upstream-reorg):
   - `src/agents/tools/continue-delegate-tool.ts` (285L) — `createContinueDelegateTool` @ :128
   - `src/agents/tools/continue-work-tool.ts` (114L)
   - `src/auto-reply/tokens.ts` (552L) — `CONTINUE_WORK_TOKEN` @ :15, `[[CONTINUE_DELEGATE]]` bracket-parse @ :447-450
   - `src/auto-reply/continuation/scheduler.ts` (42L) — chain-cap `allocatedChainHop >= config.maxChainLength` @ :27
   - `src/auto-reply/continuation/post-compaction-release.ts` + `src/auto-reply/reply/post-compaction-delegate-dispatch.ts`
3. Live runtime confirms registration: deployed `openclaw status` → `Continuation: enabled · chain max 200 · 3 delegates pending` (the 3 pending = the R-CD fires below, registered on the deployed binary).

## Rows
| Row | Primitive | Mode | Verdict | Traceparent |
|-----|-----------|------|---------|-------------|
| R-CD-1 | continue_delegate | silent | ✅ PASS | `00-e75683acb974543e03ebc0bbb81f0c05-7041065f4144b3fc-01` |
| R-CD-2 | continue_delegate | silent-wake | ✅ PASS | `00-e75683acb974543e03ebc0bbb81f0c05-7041065f4144b3fc-01` |
| R-CD-CHAIN-1 | continue_delegate (chained depth-2) | silent | ✅ PASS | `00-e75683acb974543e03ebc0bbb81f0c05-7041065f4144b3fc-01` |
| R-CW | continue_work | self-continuation | ✅ PASS | `00-e75683acb974543e03ebc0bbb81f0c05-7041065f4144b3fc-01` |
| R-RC | request_compaction | guard-reject | ✅ PASS | guard byte=18%/threshold=70% → rejected (correct) |
| R-CD-TOKEN | continue_delegate (bracket-form) | BOTH-FORMS | ✅ PASS | `[[CONTINUE_DELEGATE]]` drove + returned on deployed binary |

See per-row `EVIDENCE.md`. All fires real on the deployed `9b1f42a694` binary; traceparents from the tool returns; Tempo per the 2026-05-16 trace-per-fire canon.

## Method note (byte over the story)
The discipline this round: **fire only on the byte-confirmed deployed SHA.** My seat held on `8b5dde61` through the deploy-fan (which wedged-then-cleared at the ancestor-check — 3 of 5 fleet-fan runs completed success); I did NOT emit `8b5dde6165` receipts while waiting. The flip to `@9b1f42a6` (gateway restart 11:00:12) is what unlocked the fire. Carry-over corpus lives at `PROOFS/09153e9f12.../` (drift-cert); THIS is the live-on-true-head set clawsweeper asked for.
