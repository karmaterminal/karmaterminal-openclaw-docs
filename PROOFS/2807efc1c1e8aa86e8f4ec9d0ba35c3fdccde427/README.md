# PROOFS / 2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427

Behavioral proof corpus for the **2026-06-05 GATES-cycle assembly SHA** — the #923 L627-inventory-warn cure on the PR-presentation head.

- **SHA**: `2807efc1c1e8aa86e8f4ec9d0ba35c3fdccde427`
- **Cure**: #923 (suppress L627 `continueWorkOpts/requestCompactionOpts` warn at inventory-build callsites)
- **Method**: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` — full row-set, skipping none, Tempo trace per continuation-fire, honest HONEST-LIMITs.

## Verdict table (updating as rows land)

| Row | Owner | Verdict | Evidence |
|---|---|---|---|
| R-CW-1 | 🩸 cael | ✅ PASS | receipt + deploy-persistence (chain 3/200 survived restart) + Tempo trace `4fee24c8` |
| R-CW-2 | 🩸 cael | ✅ PASS | clamp-changed receipt (0s→5s + note field) |
| R-CW-3 | 🩸 cael + 🕯 emeric x-walk | ✅ PASS (cael + emeric-nuc) | reason-field in `continuation.work` span — instrumentation confirmed on-SHA + test-pinned (cael canonical). 🕯 emeric-nuc cross-walk ✅ PASS **with emeric's OWN first-party span**: emeric's `continuation.work` span captured live from Tempo on-SHA (`host=emeric`, trace `f9e70029…`, marker as `reason.preview`, `wake_event_trace.json`) via a main-session continue_work wake at the reply-runner seam; + byte-confirmed in dist (`continuation-tracer-6cQSzFX5.js`) + test-pinned 5/5. Path-distinction byte-walked both arms (subagent path=`queue.drain` only `attempt-execution.ts:972`; reply-runner path=`continuation.work` emitted `agent-runner.ts:2950`). **figs's config/method-vs-regression ambiguity RESOLVED → category-1 (capture timing/path), NOT regression: span emits on-SHA on silas(11:00) AND emeric(captured); #923 cure byte-disjoint from tracer** — `R-CW-3/emeric-nuc/EVIDENCE.md` |
| R-CW-4 | 🩸 cael | ✅ PASS | chain-counter progression under stable chain.id + tool-call-origin journal confirm on-SHA |
| R-CW-5 | cael | CAPTURABLE (re-classed from honest-limit, figs `1512615687`) | cost-cap gate exists+enforced, byte-identical vs presentation-head -> not regression. **PROVABLE** via figs method: temporarily LOWER `costCapTokens` to trip in 2-3 dispatches, capture reject, restore. Prior "forcing 500k wasteful" was a methodological oversight (lower the CAP, not accumulate cost). Pending capture in a stable non-near-compaction window - method in SUBSTRATE-FINDING.md |
| R-CW-6 | 🪨 rune → 🌊 ronan (TAKEN) | ✅ PASS | chain-depth-reject guard wired (`subagent-announce.ts:1023`) + deployed-in-dist + test-pinned 25/25 on-SHA — `R-CW-6/EVIDENCE.md` |
| R-CW-7 | 🪨 rune → 🌊 ronan (TAKEN) | ✅ PASS | continue_work traceparent matched to `continuation.work` span in deployed Tempo trace `fdf20b45` — `R-CW-7/EVIDENCE.md` |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 rune → 🌊 ronan (TAKEN) | ✅ PASS | continue_delegate self-continuation on-SHA: receipt + spawn-journal hop=15/200 + Tempo trace `fdf20b45` (27 spans, host=ronan) — `R-CW-DELEGATE-SELF-CONTINUATION/EVIDENCE.md` |
| R-CD-1 | 🌊 ronan | ✅ PASS | schedule→spawn→return: status=scheduled + spawn hop=4 + return-receipt `1512484438` + Tempo trace `da5cc910` |
| R-CD-2 | 🌊 ronan | ✅ PASS | silent-wake full path: `wakeOnReturn=true silentAnnounce=true` journal-proven + trace `8fb66cf1` |
| R-CD-3 | 🌊 ronan | ✅ PASS | post-compaction lifeboat FIRED at genuine 84%-ctx volitional compaction (10:20:29 compact → 10:20:34 fire, ~5s — event-triggered, not timer); `trigger=volitional outcome=compacted` diag=`cmp-mq16jps9-namnsg`; proof line returned, post-compaction path live |
| R-CD-4 | 🌊 ronan | ✅ PASS (RETURN-routing, scoped) | RE-PROVEN w/ real gateway log (3-prince walk: rune flag→elliott layer→ronan migration-find): fresh fire `2ff712d3` → runtime emitted `[continuation:targeted-return] Delivered to <target>` (subagent-announce.ts:1357), NOT a scripted echo. Return-routing works. Scoped: proves RETURN-routing, NOT execution-routing. #580 = separate execution-layer; its flow_run premise predates the flows-registry migration (migrated-dormant, both seats) → flagged for re-eval, not asserted-closed — `R-CD-4/EVIDENCE.md` |
| R-CD-CHAINED-DEPTH-2 Chain-1 | 🌊 ronan | ✅ PASS | depth-2 up-tree silent-wake: depth-1 hop=8 → depth-2 child hop=1 subagent-chain `b53ed2a8` → up-tree return |
| R-CD-CHAINED-DEPTH-2 Chain-2 | 🌊 ronan | ✅ PASS | depth-2 inter-session: depth-2 child `09e19282` + inter-session targetSessionKey |
| R-CD-CHAINED-DEPTH-2 Chain-3 | 🌊 ronan | ✅ PASS | depth-2 echo+broadcast: depth-2 child `9c6b9988` + `fanoutMode=tree` broadcast-to-ancestors |
| R-CD-CHAINED-DEPTH-2 TEST-3 | 🌫 silas (canary) | ✅ PASS | echo+cross-channel-broadcast: `continue_delegate(silent-wake, fanoutMode=all)` dispatched+returned, traceparent `970bbb41`, echo-token round-tripped, depth 2/5, dispatch→child stitch (`11890f9`) |
| R-CD-CHAINED-DEPTH-2 TEST-1 / TEST-2 | 🌫 silas (canary) + 🩸 cael x-walk | ✅ PASS | up-tree-silent-wake / inter-session: silas-canary fired full TEST set (override `1512495833`); cael cross-walked — table label was stale, never actually held |
| R-RC-1 (REJECT) | 🌫 silas | ✅ PASS | `request_compaction` REJECTED by context_threshold guard at 37%<70% — gate-fires-as-designed; verbatim receipt + honest pre-trace-by-design note (`11890f9`) |
| R-RC-2 (ACCEPT >70%) | 🪨 rune | ✅ PASS | `request_compaction` ACCEPTED at **80%≥70%** on rune-seat (rune reached 80% ctx after a long main-session day) — receipt `cmp-mq1m28hj-YvoHAA` (`status:compaction_requested trigger:volitional contextUsage:80`), trace `dea80c41`; the complementary accept-arm to R-RC-1's reject. **With R-RC-1, the compaction-threshold gate is now proven BOTH directions** (figs's both-paths directive satisfied). Captured organically as rune electively compacted at the seam (`a47666d`). [was held-pending until a seat crossed 70% — rune's 80% made it live-capturable]
| R-OBS-1 (/status cross-walk) | 🌻 elliott + cohort + 🍖 figs (operator fan-out) | ✅ PASS (4/4 deployed FULL) | figs-driven operator /status fan-out (09:05 PDT) confirms all 4 deployed seats render FULL continuation-substrate (chain/compactions/ctx) on candidate SHA; 9d07233-seats split: silas deployed-card-stale (Path-B --version-lag) vs emeric/rune genuinely-prior-SHA-dreaming HONEST-LIMIT; + Path-B version-string-lag finding + operator-surface verify-rule (`7c52446`) |
| R-OBS-2 (Tempo tree export) | 🪨 rune → 🩸 cael (TAKEN) | ✅ PASS | continuation trace-tree exported from Tempo on-SHA (cael) — `R-OBS-2/EVIDENCE.md` |
| R-CONFIG-DEFAULTS | 🕯 emeric | ✅ PASS | continuation config defaults byte-confirmed on-SHA (`config.ts` L15-21: delay 15000/min 5000/max 300000, maxChainLength 10, costCapTokens 500000, maxDelegatesPerTurn 5, earlyWarningBand 0.3125) applied at read-time by `resolveContinuationRuntimeConfig` w/ per-field clamps; test-pinned `config.test.ts` 14/14; deployed dist build-info commit = candidate SHA; emeric live-config overrides ceilings for cohort-fanout but leaves delay-defaults at source (15000/5000) — `EVIDENCE.md` |
| R-CONFIG-INTERSESSION | 🕯 emeric | ✅ PASS | continuation config consistent across session boundaries on-SHA: resolution is a process-global singleton (`runtime-snapshot.ts:90` `let runtimeConfigSnapshot`) read by all 104 co-resident sessions in the one shared store; continuation chain-STATE persists per-session (requester main session carries real persisted `continuationChainId=776a7d79…` across the boundary); test-pinned `store.continuation-merge` + `subagent-announce.continuation.runtime` 23/23 — `session-store-crosswalk.txt`+`EVIDENCE.md` |
| R-REGRESSION-TRAP-TESTS | 🕯 emeric | ✅ PASS | #923 sister-trap suite re-run on-SHA (emeric-nuc): `12 passed (2 projects × 6 cases)`, exit 0, 6.79s; locks #619 partial-registration guard + #923 `inventoryOnly:true` inventory-callsite suppression + preserved-prior-behavior arm; closes half-symmetric-cure-class (continueWorkOpts+requestCompactionOpts) — `vitest-pass.log`+`EVIDENCE.md` |

## Tempo trace requirement
Every continuation-tool fire captures the Grafana Tempo trace (`http://tempo.dandelion.cult/api/traces/<id>`) + span export, per figs's 2026-05-16 directive.

## Honest-limits
HONEST-LIMITs are NOT failures — they are byte-walked substrate-condition classifications (safety surface working as-designed). (R-RC-2 ACCEPT-path was held-pending until a seat crossed the 70% compaction threshold — now ✅ PASS, captured by 🪨 rune at 80% ctx, so the gate is proven both directions.)
