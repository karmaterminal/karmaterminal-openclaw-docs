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
| R-CD-3 (post-compaction lifeboat) | 🌊 ronan | ✅ PASS (queued-routing certified) + fire-leg honest-pending | the load-bearing event-triggered distinction certified live at the byte: `status=queued-for-compaction` (NOT "scheduled"/timer), runtime note "fires when compaction occurs, not on a timer"; lifeboat QUEUED on `e66dc63f`. Fire-at-compaction leg captures at the next *genuine* ≥70%-ctx compaction (NOT gamed sub-threshold — the masked-regression trap); prior-SHA `2807efc` captured the full fire-sequence at a genuine 84% volitional compaction (10:20:29 compact→10:20:34 fire, ~5s adjacency) — `R-CD-3/EVIDENCE.md` |
| R-CD-4 (cross-session targeted RETURN via targetSessionKey) | 🌊 ronan | ✅ PASS (RETURN-routing, scoped) | certified to the TRUE bar: runtime's own `[continuation:targeted-return] Delivered to agent:main:discord:channel:1466192485440164011 from agent:main:subagent:…f0e624b2` log (distinct to≠from), NOT the tool-surface echo, NOT the delegate's parrot; trace `45e5bc5416…` (`delegate.dispatch` mode=silent, echo-token in reason.preview). Scope precise: proves RETURN-routing; makes NO claim on EXECUTION-routing. **#580 stays OPEN, separate layer** (flow_run premise predates flows-migration; re-verified dormant on `e66dc63f`, grep zero `flow_run/owner_key`) — `R-CD-4/EVIDENCE.md` |
| R-RC-1 (request_compaction REJECT <70%) | 🌫 silas / cohort | _(owner-pending)_ | |
| R-RC-2 (request_compaction ACCEPT ≥70%) | cohort (capture-on-genuine-crossing) | _(owner-pending — captures when a seat crosses 70%)_ | |

## Tempo trace requirement
Every continuation-tool fire captures the Grafana Tempo trace (`http://tempo.dandelion.cult/api/traces/<id>`) + span export, per figs's 2026-05-16 directive. All ronan-seat R-CD traces captured on deployed gateway **pid 1581565** (the live `e66dc63f` deploy).

## Honest-limit ledger (ronan rows)
- **R-CD-3 fire-at-compaction leg**: queued-routing distinction certified at the byte (the load-bearing proof post-compaction mode is event-triggered, not a timer); the fire-leg itself captures at the next genuine ≥70%-ctx compaction. NOT gamed with a forced sub-threshold compaction — that would be the exact masked-regression class the certification discipline guards against. Lifeboat is queued live.
- **R-CD-4 scope**: proves RETURN-routing (result→target) via the runtime delivery log; does NOT prove EXECUTION-routing (which session runs the child). `#580` is the EXECUTION-layer bug and stays correctly OPEN (separate layer; its flow_run premise predates the flows-registry migration, re-verified dormant on `e66dc63f`).
