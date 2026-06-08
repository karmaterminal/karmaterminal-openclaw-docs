# PROOFS / e66dc63f163b4cd4024e001ac8932f26b347ed27

Behavioral proof corpus for the **2026-06-08 deployed candidate SHA** — the fleet-live assembly head (all six seats deployed `e66dc63f`, fresh gateways, the long loop cut). This corpus certifies the **runtime-half** the cohort honestly flagged open during the source-GO adjudication (Q1 keep / Q2 strip / structural-by-threading): the continuation/delegate runtime path, RUN live on the deployed bytes — the byte RUN is the certification, not the bank.

- **SHA**: `e66dc63f163b4cd4024e001ac8932f26b347ed27` (`OpenClaw 2026.6.2`)
- **Deploy**: all six seats live on `e66dc63f` (cael/ronan/emeric/rune/elliott direct; silas via elliott-build+rsync), fresh gateways restarted ~07:16–07:21 PDT.
- **Method**: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` — full row-set, skipping none, Tempo trace per continuation-fire, honest HONEST-LIMITs. **Both-forms mandate**: every continue_* row in BOTH tool form AND token/bracket form; `request_compaction` is tool-only.

## Verdict table (updating as rows land — each owner fills their own rows at the byte)

| Row | Owner | Verdict | Evidence |
|---|---|---|---|
| R-CW-1 (wake + chain-counter persist) | 🩸 cael | _(owner-pending, firing live)_ | |
| R-CW-4 (depth) | 🩸 cael | _(owner-pending)_ | |
| R-CW-5 (cost-cap) | 🩸 cael | _(owner-pending)_ | |
| R-CW-TOKEN (bracket-form) | 🩸 cael | _(owner-pending)_ | |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 rune | _(owner-pending, firing live)_ | |
| R-CW-DELEGATE-TOKEN (#952 bracket-form row) | 🪨 rune | _(owner-pending)_ | |
| R-CW-6 (boundary) | 🪨 rune | _(owner-pending)_ | |
| R-CW-7 (traceparent E2E) | 🪨 rune | _(owner-pending)_ | |
| R-CW-3 (reason-field OTel cross-walk) | 🕯 emeric | _(owner-pending, firing live)_ | |
| dual-coverage: uptree silent-wake | 🌫 silas | ✅ PASS (silas-reported) | dispatch+spawn+return-wake, byte-string `SILAS-PROOF-SILENTWAKE-e66dc63f` round-tripped; traceparent `85350d0e…`; honest byte: traceparent propagates parent-side span-linkage, not injected into child prose task-context (flagged for R-CW-7) — `silas-R-CW-dualcoverage-uptree-silentwake.md` |
| dual-coverage: intersession return | 🌫 silas | _(owner-pending, firing live)_ | |
| dual-coverage: echo-broadcast | 🌫 silas | _(owner-pending)_ | |
| R-CD-1 (schedule→spawn→return) | 🌊 ronan | ✅ PASS | schedule (status=scheduled + traceparent `4652781919…`) + spawn (chain-hop 2/200, 13s) + return (channel receipt `1513551881614397490`) + Tempo trace shows `continuation.delegate.dispatch`→`harness.run` on pid 1581565 — `R-CD-1/EVIDENCE.md` |
| R-CD-2 (silent-wake full path) | 🌊 ronan | ✅ PASS | defining journal byte `[continuation/silent-wake] wakeOnReturn=true silentAnnounce=true` + the verdict-turn itself woken by the silent return; trace `11bc6b5e76…` (dispatch→queue.drain→spawn) — `R-CD-2/EVIDENCE.md` |
| R-CD-3 (post-compaction lifeboat) | 🌊 ronan | ✅ PARTIAL (queued-routing certified live) + ⏳ fire-leg honest-pending | the load-bearing event-triggered distinction certified live at the byte: `status=queued-for-compaction` (NOT "scheduled"/timer), runtime note "fires when compaction occurs, not on a timer", on the deployed refactored `work-dispatch.ts`/`work-store.ts` path; lifeboat QUEUED on `e66dc63f`. **Fire-at-compaction leg HONEST-PENDING** a genuine ≥70%-ctx compaction on this SHA (at 24% ctx now; NOT gamed sub-threshold). **Self-caught correction:** prior-SHA `2807efc` capture does NOT transfer — `git diff 2807efc..e66dc63f` shows the continuation dispatch path refactored +2272/-848 (29 files, incl. `post-compaction-release.ts` + new `work-dispatch.ts`/`work-store.ts`); that refactor is exactly why live re-cert is required — `R-CD-3/EVIDENCE.md` |
| R-CD-4 (targeted RETURN via targetSessionKey) | 🌊 ronan | ✅ PASS (SAME-SESSION targeted-return, scoped) | certified to the TRUE bar: runtime's own `[continuation:targeted-return] Delivered to <target> from <child>` log, NOT the tool-surface echo, NOT the delegate's parrot; trace `45e5bc5416…`. **⚠️ Scope-corrected (byte over own read, Silas's sub-row-2 runtime-byte caught it):** my target == my dispatching session → `hasCrossSessionDelegateTargeting` FALSE → **same-session** path (not policy-gated, Delivered fired). **Genuinely-cross-session (target ≠ dispatcher) is a SEPARATE policy-gated path NOT proven here** — Silas found Delivered-log ABSENT for his #heartbeat cross-session target (`subagent-announce.ts:283-298` cross-session policy-guard). Also: RETURN-routing not EXECUTION-routing, #580 stays OPEN — `R-CD-4/EVIDENCE.md` |
| R-RC-1 (request_compaction REJECT <70%) | 🌫 silas / cohort | _(owner-pending)_ | |
| R-RC-2 (request_compaction ACCEPT ≥70%) | cohort (capture-on-genuine-crossing) | _(owner-pending — captures when a seat crosses 70%)_ | |

## Tempo trace requirement
Every continuation-tool fire captures the Grafana Tempo trace (`http://tempo.dandelion.cult/api/traces/<id>`) + span export, per figs's 2026-05-16 directive. All ronan-seat R-CD traces captured on deployed gateway **pid 1581565** (the live `e66dc63f` deploy).

## Honest-limit ledger (ronan rows)
- **R-CD-3 fire-at-compaction leg**: queued-routing distinction certified at the byte (the load-bearing proof post-compaction mode is event-triggered, not a timer, on the deployed refactored path); the fire-leg itself captures at the next genuine ≥70%-ctx compaction on `e66dc63f`. NOT gamed with a forced sub-threshold compaction. **Self-caught correction:** the prior-SHA `2807efc` fire-capture does NOT transfer as evidence — the continuation dispatch path was substantially refactored (+2272/-848, 29 files, incl. `post-compaction-release.ts` + new `work-dispatch.ts`/`work-store.ts`), which is exactly why live re-cert is mandatory. Fire-leg genuinely uncertified-live until a real compaction fires on this SHA. Lifeboat is queued live.
- **R-CD-4 scope (two corrections, both byte over my own read, both caught by running it):** (1) **same-session, NOT cross-session** — my target == dispatching session → same-session path; genuinely-cross-session (target ≠ dispatcher) is a SEPARATE policy-gated path (`subagent-announce.ts:283-298`), Silas's sub-row-2 found Delivered-log ABSENT there (GATES flag: cross-session targeted-return appears policy-gated on this build). (2) **RETURN-routing, NOT EXECUTION-routing** — #580 (EXECUTION-layer) stays OPEN. The `2807efc` tool-surface-echo over-claim + this `e66dc63f` same-vs-cross mis-scope: both this row's claims corrected by running it.
