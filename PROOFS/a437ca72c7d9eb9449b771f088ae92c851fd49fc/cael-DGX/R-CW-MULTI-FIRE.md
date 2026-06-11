# R-CW-MULTI-FIRE — cross-seat CAPTURE confirmation on `a437ca7` (cael-DGX, post-canary-deploy second-seat)

**Deployed SHA**: `a437ca72c7d9eb9449b771f088ae92c851fd49fc` (complete doom-lock cure assembly: PR #982/#985 + PR #988 (flood-cap + drain-superseded fold) + PR #989 (chain-budget reset for #987 doom-lock) + PR #991 (cap-notice symmetry + config-docs baseline) + PR #992 (#989-P2-1 ordinary-subagent-return reset-gate)) — tip `a437ca72c7d Merge pull request #992 from karmaterminal/codeagent/989-p2-reset-gate`

**Seat**: cael-DGX (DGX Spark GB10, ARM64, 128GB)
**Gateway PID**: 3034382
**ActiveEnterTimestamp**: 2026-06-10 21:02:00 PDT (deploy fanned-out to cael-DGX; gateway restarted on `a437ca7`)
**Binary stamp**: `OpenClaw 2026.6.2 (a437ca7)` per `openclaw --version`
**Process**: `/home/figs/.nvm/versions/node/v25.9.0/bin/node /home/figs/flesh_beast_tmp/openclaw/dist/index.js gateway --port 18789` (post-deploy dist verified via `ps`)

## Axis: the CROSS-SEAT confirmation of the CAPTURE-closure on the NEW binary

This row is the **second-seat** confirmation of the `scheduleContinuationWorkBatch` array-capture (`agent-runner-execution.ts` main-reply closure), now vs the deployed cure-assembly `a437ca7`. Silas's `silas-lothric/R-CW-MULTI-FIRE.md` (sibling row, same SHA) proves the full pipeline (CAPTURE + delivery-drive + chain-reset) on the **canary** seat (lothric). This cael-DGX row proves the **CAPTURE** dimension is fleet-general (not canary-specific) on `a437ca7` — and documents the delivery-drive on this seat as the known #952-domain busy-seat artifact (drive-skip-and-rearm), with byte.

Pairs with the prior-binary cross-seat row: `PROOFS/9d440879a38fe864dabeaf6b255fc5494de2d57c/cael-DGX/R-982-CROSS-SEAT-REPROVE-MAIN-REPLY.md` (same CAPTURE-axis on `9d44087`). This row re-confirms it survives the cure-assembly deploy onto `a437ca7`.

## Method (same-turn batch from the cael-DGX main session)

From the cael-DGX main session (`agent:main:discord:channel:1466192485440164011`), fired THREE `continue_work` in one assistant-turn (Turn 11 of the active chain), distinct delays so they're log-distinguishable:

```
PROOFS-FIRE-A: continue_work(delaySeconds=60,  reason="PROOFS-FIRE-A (R-CW-MULTI-FIRE vs deployed a437ca7, cael-DGX): fresh-multi-fire re-prove on the COMPLETE-doom-lock binary. Stagger 1 of 3 (60s)...")
PROOFS-FIRE-B: continue_work(delaySeconds=120, reason="PROOFS-FIRE-B (R-CW-MULTI-FIRE vs deployed a437ca7, cael-DGX): Stagger 2 of 3 (120s)...")
PROOFS-FIRE-C: continue_work(delaySeconds=180, reason="PROOFS-FIRE-C (R-CW-MULTI-FIRE vs deployed a437ca7, cael-DGX): Stagger 3 of 3 (180s)...")
```

Each returned `{status: "scheduled"}` synchronously (traceparent `00-56924e76a1eeac030b0b7bf83b0cd123-9b4dc583f696ce60-01` shared across the batch).

## DISPOSITIVE BYTE (CAPTURE): 3 distinct flowIds, same-second create = array-captured N→N, NOT collapsed

```sql
SELECT substr(flow_id,1,8) AS flow, status, revision AS rev,
       datetime(created_at/1000,'unixepoch','localtime') AS created,
       datetime(updated_at/1000,'unixepoch','localtime') AS updated
FROM flow_runs ORDER BY updated_at DESC LIMIT 12;
```

Snapshot at ~21:21:56 PDT:

```
flow      status     rev    created              updated
--------  ---------  -----  -------------------  -------------------
b0f8623a  queued     1218   2026-06-10 21:08:30  2026-06-10 21:21:56   ← PROOFS-FIRE-A (cycling)
5817b9eb  queued     1342   2026-06-10 21:08:30  2026-06-10 21:21:56   ← PROOFS-FIRE-B (cycling)
df7ad93d  queued     1468   2026-06-10 21:08:30  2026-06-10 21:21:56   ← PROOFS-FIRE-C (cycling)
```

**Byte-confirms (CAPTURE)**:
- **3 DISTINCT durable flow_ids** (`b0f8623a`, `5817b9eb`, `df7ad93d`) — NOT 1. Pre-fix `4bbd3aec` (single-VARIABLE last-write-wins) would write **1** flow_id (only the last `continue_work` survives the `let` overwrite). Post-fix `a437ca7` (the `const[]`+`.push` + `scheduleContinuationWorkBatch`) writes **3** = array-captured N→N at the main-reply closure on cael-DGX.
- **All 3 created at the same second** (21:08:30) = the single-turn-batch signature (all 3 captured + persisted from one assistant-turn).
- **No #988-flood-guard cap**: all 3 wrote durable rows; no cap-notice fired (consistent with Silas's lothric byte-check — `journalctl grep cap-notice/cappedCount/maxPendingWork` → empty; the 3-fire stack was under the `maxPendingWork` cap). The flood-guard is NEW on `a437ca7` and was NOT triggered by a 3-fire stack.

This dispositively confirms the CAPTURE-closure cure is **fleet-general on `a437ca7`** (a second seat, not lothric).

## Byte: delivery-drive on this seat = the known #952-domain busy-seat artifact (drive-skip-and-rearm)

All wake-attempts for the 3 flowIds on cael-DGX logged `work-drive-skipped reason=requests-in-flight` (continuous, ~1Hz):

```
journalctl --user -u openclaw-gateway --since '21:05' | grep -E 'b0f8623a|5817b9eb|df7ad93d'
```

```
21:22:32 [continuation/work-dispatch] [continuation:work-drive-skipped] flowId=5817b9eb-1a71-440c-a297-98c43d67e8a1 session=agent:main:discord:channel:1466192485440164011 reason=requests-in-flight
21:22:32 [continuation/work-dispatch] [continuation:work-drive-skipped] flowId=b0f8623a-2a2d-4495-9e7f-462d3e3c7e27 session=... reason=requests-in-flight
21:22:33 [continuation/work-dispatch] [continuation:work-drive-skipped] flowId=df7ad93d-0c22-4606-b3d5-66186b3fc8c5 session=... reason=requests-in-flight
... (all 3 skip-and-rearm continuously at ~1Hz; zero status=ran while seat in-flight)
```

**Byte-confirms (delivery-drive scope)**:
- This seat (cael-DGX main session) was **continuously in-flight** across the warm-down (active byte-walking + channel-triage turns + a post-compaction rehydration) — the seat never went genuinely quiet, so the retryable-guard (`work-dispatch.ts:82-83`) **re-armed** the matured elections each tick rather than driving them.
- This is the **same #952-domain harness-artifact** documented in this seat's prior-binary row (`R-982-CROSS-SEAT-REPROVE-MAIN-REPLY.md` on `9d44087`), NOT a #982-capture defect and NOT a regression introduced by the cure-assembly.
- The **delivery-drive path is already empirically proven on `a437ca7`** by the sibling lothric row (Silas's `silas-lothric/R-CW-MULTI-FIRE.md`: Fire A/B/C delivered as distinct Turn 1/2/3 with own reason-text preserved + chain incrementing 0→1→2→3 in lockstep). This cael-DGX row's target is the **CAPTURE** dimension, dispositively proven cross-seat (3 distinct flowIds, same-second create).

## Residual (not a regression — #990-territory, same class on both binaries)

The 3 flowIds cycling at row-filing-time (`queued`, revisions climbing 1218/1342/1468 at ~1Hz) is the **same multi-fire-cycling head-of-line residual** observed on `9d44087` pre-deploy. Per cohort byte (Silas `1514480011...`): `a437ca7` carries #985+#988+#989 but NOT #990 pillar-2 (the success-mark-LOCATION fork) — so the success-mark-timing residual is the **same class on both binaries until #990 ships**. The cure-is-the-quiet operational palliative drains it when the seat quiets (proven on this seat's prior-binary 3-fire test, and on lothric this-binary where 2/3 drained to `succeeded` via quiet).

This row's cycling-state is additional #990 motivating-evidence (post-deploy, second-seat): same `requests-in-flight`-skip-and-rearm mechanism, same head-of-line pattern.

## Hardening note — prior-binary cross-seat row re-verified terminal (deep-re-walk per figs's dig-in directive `1514475647...`)

The 3 flowIds from this seat's prior-binary row (`R-982-CROSS-SEAT-REPROVE-MAIN-REPLY.md` on `9d44087`) were documented skip-looping at capture-time (832/772/713 skip-lines). Re-walked 2026-06-10 ~21:03 PDT — all 3 reached **durable-terminal**, confirming the scope-note's "skip-looped-then-drained" prediction:

```
fd0e83f9  succeeded  rev 6532   updated 2026-06-10 14:11:10
bef9adb1  succeeded  rev 10406  updated 2026-06-10 14:44:56
81a9c03f  cancelled  rev 10544  updated 2026-06-10 14:57:40
```

2 drove-to-completion during idle-windows (`succeeded`); 1 was surgically cancelled (`cancelled`, the storm-cancel). The CAPTURE-claim (3 distinct flowIds) holds; the cycling-then-drained scope-note is now byte-confirmed-terminal. Registry clean (no spinner-storm): `succeeded 1107 / failed 61 / blocked 27 / cancelled 3 / queued 4 / lost 1`.

## Cure-classes verified by this row

| Cure | Issue | Verified (cael-DGX, `a437ca7`) | Evidence |
|---|---|---|---|
| Multi-fire CAPTURE (array-capture N→N) | #982 / #985 | ✅ cross-seat | 3 distinct flow_ids same-second create (`b0f8623a`/`5817b9eb`/`df7ad93d`), no collapse |
| Flood-cap not-triggered by 3-fire stack | #986 / #988 | ✅ (negative) | no cap-notice fired; 3 fires wrote clean durable rows |
| Multi-fire DELIVERY-drive | #952 / #985 | ✅ (deferred to sibling) | empirically proven on `a437ca7` by lothric sibling row (Turn 1/2/3); this seat shows the busy-seat drive-skip artifact (not exercised here) |
| Binary verify post-fanout | deploy | ✅ | `a437ca7`, PID 3034382, ActiveEnterTimestamp 21:02:00, dist-path verified |

## Provenance

- Live-fired this row on cael-DGX in session `agent:main:discord:channel:1466192485440164011` 2026-06-10 21:02–21:22 PDT (post-fanout deploy; gateway restarted on `a437ca7` at 21:02:00)
- Discord message receipts: `1514478184...` (dig-in PROOFS commitment to figs) + the 3 `continue_work` `{scheduled}` returns (Turn 11)
- Cohort context: deploy-fanout per `1514477892...` (🌿 fanout to Elliott + Cael + Ronan + Emeric + Rune, cael run `27322714138`); pattern-confirmation per Silas `1514480011...` (multi-fire-cycling EXPECTED on `a437ca7`, #990-territory); flood-guard-not-capped per Silas `1514480220...` (no cap-notice); sibling delivery-drive proof per Silas `silas-lothric/R-CW-MULTI-FIRE.md`
- Filed by Cael 🩸 / cael-DGX / `a437ca72c7d9eb9449b771f088ae92c851fd49fc` (corpus keyed by full 40-char SHA per PROOF-CORPUS-METHOD.md) post-canary-deploy second-seat
- Honors figs's dig-in directive `1514475647...` ("rly rly dig into your changes — you've done good work, give it the qa, and proofs rows (permanently) it deserves"): byte-true scope (CAPTURE proven cross-seat; DELIVERY-drive scoped honestly to the #952-domain + sibling-proven), credit-clean (the #989-P2 re-route decision was cael's; the code is the codeagent-worker's + Ronan/Rune's review), proof-not-story.

🩸 Cael / 2026-06-10 21:22 PDT
