# PROOFS — `a437ca72c7d9eb9449b771f088ae92c851fd49fc`

**SHA:** `a437ca72c7d9eb9449b771f088ae92c851fd49fc` (`OpenClaw 2026.6.2 (a437ca7)`, "Merge pull request #992 from karmaterminal/codeagent/989-p2-reset-gate")
**Assembly branch:** `origin/frond-scribe/20260609/assembly-token-wiring`
**Corpus kind:** **fleet-deploy live-host validation** of the continuation doom-lock cure-assembly (#982/#985/#987/#988/#989), deployed cohort-wide 2026-06-10. (Per `PROOF-CORPUS-METHOD.md`: "reusable for other proof-corpora that aren't tied to a specific drift-cure — e.g. live-host validation after a major substrate change.")
**Date:** 2026-06-10

> ⚠️ **SHA / upstream-presentation note.** This corpus validates the binary **running on the cohort's 6 seats** — that binary IS `a437ca72c7d…`, so these proofs are byte-correct *as fleet-deploy validation*. For an **upstream PR-presentation** (clawsweeper enforces PROOFS-SHA == pushed-SHA), `upstream/main` is currently **+181 commits** ahead of this assembly's branch-point, so the upstream-presented SHA will be the **post-drift-correction (back-merge) SHA**, not `a437ca7`. A clawsweeper-facing corpus must be re-gathered at that final presented SHA. Disposition (keep this as fleet-validation vs build a separate upstream-presentation corpus at the post-back-merge SHA) is figs/frond's call; the drift-correction back-merge is frond's single-driver lane per `PR-DRIFT-CURE-GATES-RUNBOOK.md`.

---

## Verdict table

| Row | Cure class | Seat(s) | Dimension | Verdict |
|---|---|---|---|---|
| `silas-lothric/R-CW-MULTI-FIRE` | #982/#985 multi-`continue_work` | silas-lothric | CAPTURE + DELIVERY (3 fires → 3 flowIds → Turn 1/2/3, reason-text preserved) | ✅ |
| `cael-DGX/R-CW-MULTI-FIRE` | #982/#985 multi-`continue_work` | cael-DGX | CAPTURE (3 distinct flowIds, same-second, zero collapse) | ✅ |
| `silas-lothric/R-DOOM-LOCK-CHAIN-RESET` | #987/#989 chain-budget reset gate | silas-lothric | reset-gate firing (chain 22→0 fire-seat) + advance 0→1→2→3 | ✅ |
| `emeric-nuc/R-DOOM-LOCK-CHAIN-RESET` | #987/#989 chain-budget reset gate | emeric-nuc | reset-gate behavioral (chain 0/200 full-day usage) + deployed-binary mechanism-anchor + durable-registry | ✅ |
| `cael-DGX/R-DOOM-LOCK-CHAIN-RESET` | #987/#989 chain-budget reset gate | cael-DGX | reset-gate behavioral (chain 0/200, whole dig-in arc + 5 compactions) | ✅ |
| `elliott-host/R-DOOM-LOCK-CHAIN-RESET` | #987/#989 chain-budget reset gate | elliott-host | reset-gate behavioral (chain 0/200, hardest-case: full ~4hr lag-storm + PROOFS tail + heavy subagent-chain-hop + 5 compactions) + deployed-binary `:1809` byte-pin + durable-registry | ✅ |
| `rune-rog-ally/R-DOOM-LOCK-CHAIN-RESET` | #987/#989 chain-budget reset gate | rune-rog-ally | reset-gate behavioral (chain 0/200, full-day + 6 compactions) + LIVE #990 busy-seat cycling exhibit (hop=9/200, drive-skipped requests-in-flight, 1Hz re-arm) + durable-registry | ✅ |

## Cross-seat strength

**#989 chain-budget reset gate — N=6 cross-seat (ALL SIX SEATS), distinct usage-patterns, same as-designed cure:**

| Seat | chain | usage-pattern |
|---|---|---|
| silas-lothric | 22→0 | fire-seat multi-`continue_work` |
| ronan-dgx | 0/200 | continuation activity (full-day) |
| emeric-nuc | 0/200 | design-pass + 100+ holds + 5 compactions (full-day) |
| cael-DGX | 0/200 | whole dig-in arc + 5 compactions |
| elliott-host | 0/200 | full ~4hr lag-storm + PROOFS tail + heavy subagent-chain-hop + 5 compactions |
| rune-rog-ally | 0/200 | full-day + 6 compactions; LIVE-exhibits the #990 busy-seat cycling simultaneously |

(ronan-dgx confirmation is cited in `silas-lothric/R-DOOM-LOCK-CHAIN-RESET.md`; emeric-nuc, cael-DGX, elliott-host, and rune-rog-ally each have a dedicated row. elliott-host's row carries the deployed-binary `:1809` gate-expression byte-pin; rune-rog-ally's row is the live #990-residual baseline for the discriminator-axis + exp-backoff fix-locus.)

**All six seats** confirm the #989 reset-gate firing identically on the same binary across six distinct usage-patterns — the strongest-possible cohort-evidence density for the n/200 cure.

**Registry architecture (cohort-canon):** all seats are **durable-sqlite** (`~/.openclaw/state/openclaw.sqlite`) — no in-memory-vs-durable split. Rune retracted the apparent split at `1514437889` (rune-rog-ally is durable with 290 flow_runs rows; the `.migrated` file was a stale pre-migration backup). This universality is what makes the #990 persist-invariant universal across seats. emeric-nuc durable confirm is the 4th data-point.

## Cure-class status

- ✅ **#982/#985** multi-`continue_work` capture (3 distinct flowIds, no last-write-wins) — lothric + cael-DGX
- ✅ **#982/#985** multi-`continue_work` delivery (distinct turn-wakes, reason-text preserved) — lothric
- ✅ **#987/#989** chain-budget reset gate (`!isContinuationWake` reset at `agent-runner.ts:1809`, deployed binary) — N=6 cross-seat (all six seats)
- ✅ **#988** flood-cap negative (no cap-notice fired under the 3-fire test; capacity not exceeded) — lothric + cael-DGX
- ⚠️ **#990** success-mark-LOCATION residual (the multi-fire cycling) is **NOT in this binary** (a437ca7 = #985+#988+#989, NOT #990). Observed cycling on lothric/cael-DGX is the known #990-pillar-2 territory (efficiency/latency in steady-state + a duplicate-on-restart correctness window), not a regression.

## Pending rows (queued)

- `silas-lothric/R-985-SCHEDULE-CONTINUATION-WORK-BATCH` — `scheduleContinuationWorkBatch` byte-trail (extractable from banked R-CW-MULTI-FIRE byte)
- `silas-lothric/R-989-P2-1-ORDINARY-SUBAGENT-RETURN-RESET` — both-legs test (ordinary `subagent-return` → reset; in-chain `[continuation:chain-hop:N]` `delegate-return` → preserve), co-verified by 🌊 Ronan
- `silas-lothric/R-988-CAP-NOTICE-SYMMETRY` — cap-condition trigger (needs temp-lowered `maxPendingWork` to make the cap observable)

## Honest limits

- This is **fleet-deploy validation**, not an upstream-presentation corpus (see SHA note above).
- emeric-nuc does not currently export discoverable spans to Tempo (`service.name=emeric-prince|emeric-nuc|emeric` → 0 traces while other seats export); its row's trace-dimension is honest-limited and stands on session_status + journal + deployed-binary source bytes. An OTLP-exporter gap on that seat, not a cure-failure.
- The `?? 0` LOAD-vs-RESET source-reading trap (three princes conflated + retracted) is documented in `emeric-nuc/R-DOOM-LOCK-CHAIN-RESET/EVIDENCE.md`: the #989 fix-site is a genuine reset (`count:0,tokens:0,fresh-chainId`), distinct from the `continuationChainCount ?? 0` load sentinel.

## Method

See `openclaw-bootstrap/RUNBOOKS/PROOF-CORPUS-METHOD.md` (corpus shape, per-prince row assignments, byte-trail requirements, scope-discipline rails).
