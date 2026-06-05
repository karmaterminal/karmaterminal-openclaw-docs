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
| R-CW-3 | 🩸 cael + 🕯 emeric x-walk | ✅ PASS (cael + emeric-nuc) | reason-field in `continuation.work` span — instrumentation confirmed on-SHA + test-pinned (cael canonical). 🕯 emeric-nuc cross-walk ✅ PASS: span+`reason.preview` byte-confirmed in emeric's running dist (`continuation-tracer-6cQSzFX5.js`), test-pinned 5/5 on-seat, live Tempo exemplar `continuation.work` span carries `reason.preview` captured; emeric fired continue_work (wake journal-confirmed) + byte-honest path-finding: subagent fire runs agent-command path (`attempt-execution.ts:972`), work-span seam is reply-runner-only (`agent-runner.ts:2950`) — architectural, not #923 regression — `R-CW-3/emeric-nuc/EVIDENCE.md` |
| R-CW-4 | 🩸 cael | ✅ PASS | chain-counter progression under stable chain.id + tool-call-origin journal confirm on-SHA |
| R-CW-5 | 🩸 cael | ⚠️ HONEST-LIMIT | cost-cap gate exists+enforced; PASS-shape blocked (forcing 500k chain-cost wasteful); gate byte-identical vs presentation-head → not regression (SUBSTRATE-FINDING.md) |
| R-CW-6 / R-CW-7 | 🪨 rune | ⚠️ HONEST-LIMIT (held-dreaming) | chain-depth-boundary-reject / traceparent-E2E: owner held-dreaming (hands-off); fires on rune wake |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 rune + x-walk | ⚠️ HONEST-LIMIT (held-dreaming) | owner held-dreaming; fires on rune wake |
| R-CD-1 | 🌊 ronan | ✅ PASS | schedule→spawn→return: status=scheduled + spawn hop=4 + return-receipt `1512484438` + Tempo trace `da5cc910` |
| R-CD-2 | 🌊 ronan | ✅ PASS | silent-wake full path: `wakeOnReturn=true silentAnnounce=true` journal-proven + trace `8fb66cf1` |
| R-CD-3 | 🌊 ronan | ✅ PASS | post-compaction lifeboat FIRED at genuine 84%-ctx volitional compaction (10:20:29 compact → 10:20:34 fire, ~5s — event-triggered, not timer); `trigger=volitional outcome=compacted` diag=`cmp-mq16jps9-namnsg`; proof line returned, post-compaction path live |
| R-CD-4 | 🌊 ronan | ✅ PASS | targetSessionKey cross-session return: key echoed + targeted-return journal + trace `4dbd9fbf` |
| R-CD-CHAINED-DEPTH-2 Chain-1 | 🌊 ronan | ✅ PASS | depth-2 up-tree silent-wake: depth-1 hop=8 → depth-2 child hop=1 subagent-chain `b53ed2a8` → up-tree return |
| R-CD-CHAINED-DEPTH-2 Chain-2 | 🌊 ronan | ✅ PASS | depth-2 inter-session: depth-2 child `09e19282` + inter-session targetSessionKey |
| R-CD-CHAINED-DEPTH-2 Chain-3 | 🌊 ronan | ✅ PASS | depth-2 echo+broadcast: depth-2 child `9c6b9988` + `fanoutMode=tree` broadcast-to-ancestors |
| R-CD-CHAINED-DEPTH-2 TEST-3 | 🌫 silas (canary) | ✅ PASS | echo+cross-channel-broadcast: `continue_delegate(silent-wake, fanoutMode=all)` dispatched+returned, traceparent `970bbb41`, echo-token round-tripped, depth 2/5, dispatch→child stitch (`11890f9`) |
| R-CD-CHAINED-DEPTH-2 TEST-1 / TEST-2 | 🕯 emeric / 🪨 rune | ⚠️ HONEST-LIMIT (held-dreaming) | up-tree-silent-wake / inter-session: owners held-dreaming (hands-off-honored); honest-limit per substitution-class + completing-as-seats-come-up — NOT skipped |
| R-RC-1 (REJECT) | 🌫 silas | ✅ PASS | `request_compaction` REJECTED by context_threshold guard at 37%<70% — gate-fires-as-designed; verbatim receipt + honest pre-trace-by-design note (`11890f9`) |
| R-RC-2 (ACCEPT >70%) | 🩸 cael | ⚠️ HONEST-LIMIT (held-pending) | no deployed seat >70% ctx on a main turn (cael ~56%, silas ~37%, all REJECT-side); held until a seat crosses 70% — no overclaim (cure-12 R-RC-1-addendum precedent) |
| R-OBS-1 (/status cross-walk) | 🌻 elliott + cohort + 🍖 figs (operator fan-out) | ✅ PASS (4/4 deployed FULL) | figs-driven operator /status fan-out (09:05 PDT) confirms all 4 deployed seats render FULL continuation-substrate (chain/compactions/ctx) on candidate SHA; 9d07233-seats split: silas deployed-card-stale (Path-B --version-lag) vs emeric/rune genuinely-prior-SHA-dreaming HONEST-LIMIT; + Path-B version-string-lag finding + operator-surface verify-rule (`7c52446`) |
| R-OBS-2 (Tempo tree export) | 🪨 rune | ⚠️ HONEST-LIMIT (held-dreaming) | owner held-dreaming; fires on rune wake |
| R-CONFIG-DEFAULTS | 🕯 emeric | ✅ PASS | continuation config defaults byte-confirmed on-SHA (`config.ts` L15-21: delay 15000/min 5000/max 300000, maxChainLength 10, costCapTokens 500000, maxDelegatesPerTurn 5, earlyWarningBand 0.3125) applied at read-time by `resolveContinuationRuntimeConfig` w/ per-field clamps; test-pinned `config.test.ts` 14/14; deployed dist build-info commit = candidate SHA; emeric live-config overrides ceilings for cohort-fanout but leaves delay-defaults at source (15000/5000) — `EVIDENCE.md` |
| R-CONFIG-INTERSESSION | 🕯 emeric | ✅ PASS | continuation config consistent across session boundaries on-SHA: resolution is a process-global singleton (`runtime-snapshot.ts:90` `let runtimeConfigSnapshot`) read by all 104 co-resident sessions in the one shared store; continuation chain-STATE persists per-session (requester main session carries real persisted `continuationChainId=776a7d79…` across the boundary); test-pinned `store.continuation-merge` + `subagent-announce.continuation.runtime` 23/23 — `session-store-crosswalk.txt`+`EVIDENCE.md` |
| R-REGRESSION-TRAP-TESTS | 🕯 emeric | ✅ PASS | #923 sister-trap suite re-run on-SHA (emeric-nuc): `12 passed (2 projects × 6 cases)`, exit 0, 6.79s; locks #619 partial-registration guard + #923 `inventoryOnly:true` inventory-callsite suppression + preserved-prior-behavior arm; closes half-symmetric-cure-class (continueWorkOpts+requestCompactionOpts) — `vitest-pass.log`+`EVIDENCE.md` |

## Tempo trace requirement
Every continuation-tool fire captures the Grafana Tempo trace (`http://tempo.dandelion.cult/api/traces/<id>`) + span export, per figs's 2026-05-16 directive.

## Honest-limits
HONEST-LIMITs are NOT failures — they are byte-walked substrate-condition classifications (safety surface working as-designed). R-RC-2 (cael ACCEPT-path) held pending until a seat is above the 70% compaction threshold.
