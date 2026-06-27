# R-OBS-1 — external `/status` 6-prince continuation-row cross-walk on `191a7af`

**Owner:** 🌻 Elliott (`elliott-legion`) + figs external-observer fanout
**Candidate SHA:** `191a7af989a637f435016fd8d72627fc47fae0e0`
**Build string:** `OpenClaw 2026.6.10 (191a7af)`
**Captured:** 2026-06-27 10:32 PDT
**Source:** figs `/status` fanout in Discord `#sprites-of-thornfield`, message `1520481868456136785`
**Verdict:** ✅ PASS-candidate — 6/6 external status cards show the deployed `191a7af` runtime and continuation status row.

## Evidence files

- `raw_status_cards_6prince.txt` — full figs-provided external `/status` fanout, with internal session-key strings redacted.
- `status_snapshot_191a7af_elliott.txt`
- `status_snapshot_191a7af_silas.txt`
- `status_snapshot_191a7af_cael.txt`
- `status_snapshot_191a7af_ronan.txt`
- `status_snapshot_191a7af_emeric.txt`
- `status_snapshot_191a7af_rune.txt`
- `elliott-legion/` — Elliott seat-local build/health receipt captured before the full fanout.

## SHA convergence

| Seat | Runtime from `/status` | Continuation row | Notes |
|---|---|---|---|
| 🌻 Elliott | `OpenClaw 2026.6.10 (191a7af)` | `chain 0/200` | gateway active; queue depth 0 |
| 🌫️ Silas | `OpenClaw 2026.6.10 (191a7af)` | `chain 1/200` | live `[continuation:chain-hop:1]` task visible for R-CD-CHAINED-DEPTH-2 |
| 🩸 Cael | `OpenClaw 2026.6.10 (191a7af)` | `chain 0/200` | gateway active; voice inbound config visible |
| 🌊 Ronan | `OpenClaw 2026.6.10 (191a7af)` | `chain 0/200 | 1 delegates pending` | Ronan PROOFS runbook reader task visible |
| 🕯️ Emeric | `OpenClaw 2026.6.10 (191a7af)` | `chain 0/200` | gateway active |
| 🪨 Rune | `OpenClaw 2026.6.10 (191a7af)` | `chain 1/200` | live `[continuation:chain-hop:1]` task visible for R-CW-7/R-CW-DELEGATE work |

## Behavior proven

R-OBS-1 proves the external operator/status-card surface for the deployed assembly:

1. 6/6 prince seats render `OpenClaw 2026.6.10 (191a7af)` in externally observed `/status` cards.
2. 6/6 cards render the continuation status row (`🔄 Continuation: chain …/200`).
3. Live continuation activity is visible in the status surface on active proof rows:
   - Silas: `[continuation:chain-hop:1]` task for `R-CD-CHAINED-DEPTH-2`.
   - Rune: `[continuation:chain-hop:1]` task for `R-CW-7 / R-CW-DELEGATE-…`.
   - Ronan: `1 delegates pending` while his R-CD lane executor shard is active.
4. Queue state is healthy at capture time (`Queue: steer (depth 0)` on all six cards).

## Caveats

- Context percentages, token counts, cache hit rates, and compaction counts are point-in-time status-card fields. They are evidence of the operator surface rendering, not durable context-health claims.
- Known upstream Discord reply-session-state bug `openclaw/openclaw#96936` was in play during this proof cycle. The external cards still render the deployed runtime and continuation row; this caveat does not change the R-OBS-1 status-surface verdict.
- Internal session-key strings were redacted in the checked-in raw/snapshot files.

## Verdict

✅ PASS-candidate for R-OBS-1 on `191a7af989a637f435016fd8d72627fc47fae0e0`: figs's external `/status` fanout confirms all six prince gateways are on `OpenClaw 2026.6.10 (191a7af)`, the continuation row renders on every seat, and live proof-continuation activity appears in the operator status surface where applicable.
