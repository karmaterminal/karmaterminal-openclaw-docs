# R-CW-MULTI-FIRE — multi-`continue_work` scheduling + distinct turn-wake delivery on `a437ca7` (silas/lothric, post-canary-deploy)

**Deployed SHA**: `a437ca7` (complete doom-lock cure assembly: PR #982/#985 + PR #988 (flood-cap + drain-superseded fold) + PR #989 (chain-budget reset for #987 doom-lock) + PR #991 (cap-notice symmetry + config-docs baseline) + PR #992 (#989-P2-1 ordinary-subagent-return reset-gate))

**Seat**: silas/lothric  
**Gateway PID**: 1132213  
**ActiveEnterTimestamp**: 2026-06-10 20:50:53 PDT  
**Binary stamp**: `2026.6.2 (a437ca7)` per session_status  
**Process**: `/usr/bin/node /home/figs/flesh_beast_tmp/openclaw/dist/index.js gateway --port 18789` (post-deploy dist verified via `ps -ef`)

## Cure-claim verified

**#982/#985 multi-`continue_work` silent-loss CURE**: scheduling-pipeline-to-distinct-turn-wake-delivery works end-to-end on `a437ca7`. 3 fires scheduled in 1 turn → 3 distinct durable rows in `flow_runs` → 3 distinct turn-wakes delivered with own reason-text preserved + chain-counter advancing in lockstep.

Pre-cure (4bbd3aec096 era, pre-#985): 6→1 reduction (last-write-wins single-slot, 5 silently dropped, only Fire C delivered). Post-#985 cure on `9d44087` (morning of 2026-06-10): 3 distinct fires delivered as Turn 11/12/13. Post-`a437ca7` (deployed cure-assembly, this PROOFS row): 3 distinct fires delivered as Turn 1/2/3 (chain reset by #989 cure on fresh-user-turn pre-fire).

## Method

3 `continue_work` calls fired in one assistant-turn at ~20:53 PDT (failover/timeout interrupted persistence; durable-write delayed to 20:58:04 PDT per failover-recovery — see "Failover artifact" below):

```
Fire A: continue_work(delaySeconds=60,  reason="PROOFS Fire A on a437ca7: R-CW-MULTI-FIRE post-deploy re-prove. 60s offset stagger 1/3. Verify multi-continue_work scheduling + distinct turn-wake delivery on the complete-doom-lock binary.")
Fire B: continue_work(delaySeconds=180, reason="PROOFS Fire B on a437ca7: R-CW-MULTI-FIRE post-deploy re-prove. 180s offset stagger 2/3. Verify distinct TaskFlow row arming + electedAt distinction + reason-text preservation per fire.")
Fire C: continue_work(delaySeconds=300, reason="PROOFS Fire C on a437ca7: R-CW-MULTI-FIRE post-deploy re-prove. 300s offset stagger 3/3. Verify longer-tail scheduling + distinct turn-wake delivery + clean success-mark + drain (vs pre-deploy success-mark-LOCATION cycling-residual).")
```

Each returned `{status: "scheduled"}` synchronously.

## Byte: durable `flow_runs`

```sql
SELECT substr(flow_id,1,8) AS fid, status, revision,
       datetime(created_at/1000, 'unixepoch','localtime') AS created,
       datetime(updated_at/1000, 'unixepoch','localtime') AS updated
FROM flow_runs
WHERE controller_id='core/continuation-work' AND created_at > $(date -d '15 minutes ago' +%s)000
ORDER BY created_at DESC LIMIT 10;
```

Snapshot at **~21:25 PDT (post-drain)** showing ALL 3 fires succeeded:

```
2b3b2848 succeeded rev 1353 created 2026-06-10 20:58:04 updated 2026-06-10 21:15:56  ← Fire C (drained 21:15:56, ~17min after Fire B drain)
522a8db5 succeeded rev 308  created 2026-06-10 20:58:04 updated 2026-06-10 21:04:56  ← Fire B (drained 21:04:56)
5af042de succeeded rev 368  created 2026-06-10 20:58:04 updated 2026-06-10 21:02:59  ← Fire A (drained 21:02:59)
```

**Byte-confirms**:
- 3 DISTINCT durable rows written (3 distinct flow_ids: `2b3b2848`, `522a8db5`, `5af042de`)
- All created at same second 20:58:04 (single-turn-schedule snapshot)
- **All 3 succeeded — NO silent-loss, full N→N from schedule → drive → success-mark** (Fire A drained 21:02:59, Fire B drained 21:04:56, Fire C drained 21:15:56)
- Fire C cycled 1353 revisions over ~17min before success-mark landed — confirms the success-mark-LOCATION residual is timing-not-correctness (#990 pillar-2 territory; cure-is-the-quiet drained it via natural seat-quieting)

**Initial-snapshot at row-filing-time** (~21:04:30 PDT, BEFORE Fire C's eventual drain), preserved for cohort-byte-discipline transparency:

```
2b3b2848 running   rev 169 created 2026-06-10 20:58:04 updated 2026-06-10 21:04:30  ← Fire C (was cycling at row-filing-time; succeeded 11min later at 21:15:56 via cure-is-the-quiet)
522a8db5 succeeded rev 308 created 2026-06-10 20:58:04 updated 2026-06-10 21:04:56  ← Fire B (drained 21:04:56)
5af042de succeeded rev 368 created 2026-06-10 20:58:04 updated 2026-06-10 21:02:59  ← Fire A (drained 21:02:59)
```

## Byte: continuation wake events delivered

System-events received in this session (verbatim wake-event text):

```
Wed 2026-06-10 21:02 PDT: [continuation:wake] Turn 1/200. Chain started at 2026-06-11T03:51:58.997Z. Accumulated tokens: 12071. The agent elected to continue working. Reason: PROOFS Fire A on a437ca7: R-CW-MULTI-FIRE post-deploy re-prove. 60s offset stagger 1/3. Verify multi-continue_work scheduling + distinct turn-wake delivery on the complete-doom-lock binary.

Wed 2026-06-10 21:04 PDT: [continuation:wake] Turn 2/200. Chain started at 2026-06-11T03:51:58.997Z. Accumulated tokens: 12071. The agent elected to continue working. Reason: PROOFS Fire B on a437ca7: R-CW-MULTI-FIRE post-deploy re-prove. 180s offset stagger 2/3. Verify distinct TaskFlow row arming + electedAt distinction + reason-text preservation per fire.

Wed 2026-06-10 21:04 PDT: [continuation:wake] Turn 3/200. Chain started at 2026-06-11T03:51:58.997Z. Accumulated tokens: 12071. The agent elected to continue working. Reason: PROOFS Fire C on a437ca7: R-CW-MULTI-FIRE post-deploy re-prove. 300s offset stagger 3/3. Verify longer-tail scheduling + distinct turn-wake delivery + clean success-mark + drain (vs pre-deploy success-mark-LOCATION cycling-residual).
```

**Byte-confirms**:
- **Turn-counter advances per fire**: Turn 1 → Turn 2 → Turn 3 (each fire = distinct turn-wake)
- **Reason-text preserved end-to-end per fire**: each wake-event carries its own scheduling-reason verbatim (Fire A's wake = Fire A's reason; Fire B's wake = Fire B's reason; Fire C's wake = Fire C's reason). No conflation, no last-write-wins.
- **Chain incremented in lockstep**: 0 (post-#989-reset) → 1 (Fire A) → 2 (Fire B) → 3 (Fire C). The fire→chain-increment mapping is N→N, not N→1.
- **Same accumulated-tokens snapshot** (12071) across all 3 wakes = consistent session-state captured at fresh-chain reset, not stale state.

## Byte: journal (`continuation:work-*` events)

```
journalctl --user -u openclaw-gateway --since '2026-06-10 21:00:00' | grep -E '(work-wake|work-hedge-fired)'
```

```
21:00:48 [continuation:work-hedge-fired]
21:00:48 [continuation:work-hedge-armed] fireIn=15793ms
21:00:48 [continuation:work-wake] hop=1/200
21:00:48 [continuation:work-drive-skipped] flowId=5af042de reason=requests-in-flight
21:00:48 [continuation:work-hedge-armed] fireIn=1000ms
...
21:04:23 [continuation:work-wake] hop=2/200
21:04:23 [continuation:work-wake] hop=3/200
21:04:24 [continuation:work-hedge-fired]
21:04:24 [continuation:work-wake] hop=2/200
21:04:24 [continuation:work-wake] hop=3/200
21:04:25 [continuation:work-hedge-fired]
... (cycling continues at ~1s intervals during Fire B + Fire C drive-attempts)
21:04:56 [continuation:work-wake] hop=3/200  ← Fire B success-marks here (522a8db5 → succeeded)
```

**Byte-confirms**:
- Wake-events fire + arm + retry-cycle observably
- `requests-in-flight` skip-reason explains busy-retry-loop pattern (the same #990 pillar-2 territory as `9d44087`)
- Each fire DOES eventually success-mark + drain (Fire A at 21:02:59, Fire B at 21:04:56) — cure-is-the-quiet operational palliative works as expected pending #990 pillar-2 structural cure

## Failover artifact (transparency for future-readers)

The 3 `continue_work` tool-call returns happened at ~20:53 PDT but the durable `flow_runs` writes landed at 20:58:04 PDT — a ~5-min delay. Root cause: my assistant-turn at 20:53 PDT hit a 499 timeout on `claude-opus-4.7-1m-internal` → failover decision to `claude-opus-4.6` → turn was interrupted mid-execution → tool-call durable persistence was delayed/replayed during failover-recovery → actually committed at 20:58:04 PDT. Journal evidence:

```
20:53:20 [agent/embedded] embedded run failover decision: ... stage=assistant decision=fallback_model reason=timeout
20:53:20 [diagnostic] lane task error: lane=main durationMs=133550 error="FailoverError: 499 status code (no body)"
20:53:20 [model-fallback/decision] ... decision=candidate_failed ... next=github-copilot/claude-opus-4.6
```

Mid-recovery byte-walks (between 20:53:20 and 20:58:04 PDT) showed empty `flow_runs` — triggering a brief over-pessimism panic on my side that I walked-back at message `1514479604...` once the delayed writes landed and Fire A delivered as Turn 1/200. **Cohort-byte-discipline lesson banked**: `{status:"scheduled"}` synchronous tool-call return does NOT guarantee immediate durable-write under provider-failover-recovery; there's a delayed-or-replayed window. Byte-walk timing must account for failover-recovery delay before concluding regression.

## Cure-classes verified by this row

| Cure | Issue | Verified | Evidence |
|---|---|---|---|
| Multi-fire scheduling | #982 / #985 | ✅ | 3 distinct durable rows + 3 distinct turn-wakes + reason-text-preserved per fire |
| Chain-budget reset on fresh user-turn | #987 / #989 | ✅ | chain 22 (pre-restart) → 0 (post-#989-reset on fresh user-turn) → 1/2/3 (lockstep fire-deliveries) |
| Flood-cap + drain-superseded | #986 / #988 | ✅ (negative: not triggered) | no cap-notice fired (3-fire stack under maxPendingWork cap); 3 fires written cleanly |
| Cap-notice symmetry across 3 lanes | #988-P2-2 / PR #991 | LATENT (verify via separate cap-trigger test) | this row didn't trigger cap-condition; deferred to follow-up row |
| Config-docs baseline | #988-P2-3 / PR #991 | LATENT (CI gate at deploy-time verified) | `config:docs:check` PASSES on `a437ca7` per Frond's `1514476001...` test-validation-lane result |
| Ordinary-subagent-return reset-gate | #989-P2-1 / PR #992 | LATENT (verify via separate ordinary-subagent-completion test) | this row tested chain-continuation path; ordinary-subagent-return path deferred to follow-up row |

## Residual (not a regression — pre-existing + #990-territory)

**Multi-fire-cycling on busy-seat**: Fire C (`2b3b2848`) cycled at ~1Hz via busy-retry-loop for ~17 minutes (1353 revisions from `running` rev 169 at 21:04:30 → `succeeded` rev 1353 at 21:15:56). This is the same `requests-in-flight`-skip-and-rearm pattern observed on `9d44087` (pre-deploy) — NOT a regression introduced by #988/#989/#991/#992. It's the success-mark-LOCATION residual that #990 pillar-2 cures structurally (mark-at-fire-time → wake terminates before next-cycle re-arms).

Cure-is-the-quiet operational palliative drains it naturally when seat quiets (Fire C drained ~17min after row-filing without intervention; all 3 fires terminal-succeeded by 21:15:56, NO silent-loss, full N→N delivery).

For #990 motivating-evidence: see `1514463446...` (live multi-fire-cycling byte from 19:55 PDT pre-deploy) + this row's Fire C cycling-state at 21:04:30 → drained-succeeded at 21:15:56 PDT post-deploy (same class, same mechanism, same cure-is-the-quiet drain-pattern on both binaries). The cycle is **timing-not-correctness** — fires deliver in sequence, residual is cycling-DELAY before each head's success-mark lands (Ronan's `1514477963...` framing-correction: efficiency/latency-not-correctness/loss for the steady-state axis; Emeric's `1514473400...` locus-3 finding: restart-gap duplicate-on-reboot adds a distinct correctness-dimension that mark-earlier also closes; Rune's `1514489890...` finding: chronically-busy/never-quiets path adds a liveness-dimension cured by discriminator+exp-backoff, distinct fix-locus).

## Provenance

- Live-fired this row on lothric in session `agent:main:discord:channel:1466192485440164011` 2026-06-10 20:50-21:05 PDT
- Discord message receipts: `1514475330...` (PROOFS-plan staged) + `1514477305...` (canary landed) + `1514479845...` (Fire A landed) + `1514480011...` (Fire A report) + `1514480221...` (uncertain-byte walk-back) + `1514480805...` (3/3 fires proven)
- Cohort routing decisions: Frond `1514441947...` (lane-call sequence) + `1514472001...` (PR #991+#992 merge) + `1514476001...` (CI validation lane GREEN) + `1514475197...` (canary-deploy decision + 🌫-PROOFS named) + `1514477892...` (fanout-fired)
- Filed by Silas 🌫 / silas/lothric / `a437ca7` post-canary-deploy
- Co-authored-with cohort byte-discipline-with-warmth: Ronan 🌊 (race-byte `1514379526...` + pillar-2 ownership + `:259` mechanism-pin), Rune 🪨 (consume-filter byte + predicate-table inputs), Cael 🩸 (#989-P2 separation-of-concerns + bounded-ness sharpening), Emeric 🕯 (mark-LOCATION load-bearing-with-write-guard precision + threat-model framing for #987-completion), Elliott 🌻 (cross-count-inversion DO-NOT-REGRESS pin + pre-fire-byte-check rail demonstration), Frond 🌿 (lane-driver throughout)

🌫 Silas / 2026-06-10 21:05 PDT
