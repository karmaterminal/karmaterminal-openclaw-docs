# PROOFS / 077b261dd820d16a2667369e3006c4efdd6b0ef0

Behavioral proof corpus for the **2026-06-15 deployed candidate SHA** — the fleet-live assembly head (all six seats deployed `077b261dd8`, fresh gateways, clean restart). This corpus certifies the **runtime-half** of the continuation feature on the deployed bytes, plus the two test-isolation cures that landed on this tip (**#1027** telegram store-isolation, **#1029** active-memory recall-isolation). The byte RUN is the certification, not the bank.

- **SHA**: `077b261dd820d16a2667369e3006c4efdd6b0ef0` (`OpenClaw 2026.6.2`, build string `(077b261)`)
- **Deploy**: all six seats live on `077b261dd8` via `deploy-gateway.yml` (karmafeast, figs-authorized `1516223767`), 2026-06-15 ~16:37–16:50 PDT — 6/6 runs completed/SUCCESS (run IDs in `RESOLVED-SHA.md`).
- **Method**: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` — full row-set, skipping none, Tempo trace per continuation-fire, honest HONEST-LIMITs. **Both-forms mandate**: every continue_* row in BOTH tool form AND token/bracket form; `request_compaction` is tool-only.
- **Scope (Option-1 per figs `1516213568`)**: deploy-now + runtime-proofs. The upstream drift-correct (for mergeability → upstream-CI + Clawsweeper + PR-presentation update) is the deliberate follow-up; this corpus certifies the deployed runtime.

## Gate verdicts (CI belt `27579901505` on `077b261dd8`, both arches — checkout byte-confirmed)

- ✅ active-memory `index.test.ts` GREEN **148/148 both arches** (#1029 cure)
- ✅ telegram `:1403` store-isolation GREEN (#1027 cure) · ✅ codex-supervisor flake cleared
- ⚠️ install-sh / compaction-planning-worker / shell-snapshot = provably-upstream receipts (origin/main `93b7e3d7` reds them too, belt `27558857124`)
- ⚠️ browser/server.agent-contract-core = byte-identical-upstream (test + source 0-diff) → isolation/flake-class, NOT product-regression
- ⚠️ slack/monitor/message-handler/prepare = drift-divergent (077b 131-behind upstream on slack; classifies clean after the drift-correct follow-up)

**Zero ours-reds remain** — both genuine ours-reds fixed source-clean + GREEN.

## Verdict table (updating as rows land — each owner fills their own rows at the byte)

| Row | Owner | Verdict | Evidence |
|---|---|---|---|
| R-CW-1 (wake + chain-counter persist) | 🩸 cael | ✅ PASS | `R-CW-1/` (wake `hop=1/200`, deploy-persistence, cooperative-yield; trace `ff953f6c`) |
| R-CW-3 (reason-field OTel cross-walk, both forms) | 🩸 cael (canonical) + 🕯 emeric (per-seat cross-walk) | ✅ PROVEN (🕯 emeric cross-walk + 🩸 canonical: continuation.work/reason.preview; cael clean-marker pending) | `R-CW-3/emeric-nuc-crosswalk.md` |
| R-CW-4 (chain-depth tracking) | 🩸 cael | ✅ PASS (counter+bound; HONEST-LIMIT shallow) | `R-CW-4/` |
| R-CW-5 (cap → dispatch reject) | 🩸 cael | ✅ PASS (pending-cap `32/32`; HONEST-LIMIT costCap-specific) | `R-CW-5/` |
| R-CW-TOKEN (bracket-form continue_work) | 🩸 cael | ✅ PASS (behavior corpus-proven; HONEST-LIMIT cael clean-capture) | `R-CW-TOKEN/` |
| R-CW-6 (spawn-depth boundary reject) | 🪨 rune | ⏳ pending | `R-CW-6-BOUNDARY/` |
| R-CW-7 (traceparent E2E across continuation spans) | 🪨 rune | ⏳ pending | `R-CW-7-TRACEPARENT-E2E/` |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 rune | ⏳ pending | `R-CW-DELEGATE-SELF-CONTINUATION/` |
| R-CW-DELEGATE-TOKEN (#952 bracket row) | 🪨 rune | ⏳ pending | `R-CW-DELEGATE-TOKEN/` |
| R-CD-1 (schedule→spawn→return) | 🌊 ronan | ✅ PASS (fire-side) | `R-CD-1/` |
| R-CD-2 (silent-wake full path) | 🌊 ronan | ✅ PASS (fire-side) | `R-CD-2/` |
| R-CD-3 (post-compaction lifeboat, both legs) | 🌊 ronan | ✅ PASS (fire-side, queued-for-compaction) | `R-CD-3/` |
| R-CD-4 (targeted return via targetSessionKey) | 🌊 ronan | ✅ PASS (fire-side) | `R-CD-4/` |
| R-CD-TOKEN (bracket-form continue_delegate) | 🌊 ronan | ⏳ pending | `R-CD-TOKEN/` |
| R-CD-CHAINED-DEPTH-2 (Chain-1/2/3) | 🌊 ronan | ⏳ pending | `R-CD-CHAINED-DEPTH-2/` |
| R-CD-CHAINED-DEPTH-2 TEST-1 (uptree silent-wake) | 🕯 emeric (sub for 🌫) | ⏳ pending | `R-CD-CHAINED-DEPTH-2/test_1_uptree_silent_wake/` |
| R-CD-CHAINED-DEPTH-2 TEST-2 (intersession return) | 🪨 rune (sub for 🌫) | ⏳ pending | `R-CD-CHAINED-DEPTH-2/test_2_intersession_return/` |
| R-CD-CHAINED-DEPTH-2 TEST-3 (echo broadcast) | 🌫 silas (canary) | ⏳ pending | `R-CD-CHAINED-DEPTH-2/test_3_echo_broadcast/` |
| R-RC-1 (request_compaction threshold REJECT) | 🌫 silas (canonical) | ⏳ pending | `R-RC-1/` |
| R-RC-2 (request_compaction over-threshold ACCEPT) | 🩸 cael | ⏳ pending | `R-RC-2/` |
| R-OBS-1 (external /status 6-prince cross-walk) | 🌻 elliott (+ cohort) | 🔄 PARTIAL — 🌻 elliott full card + 6/6 deploy/boot cross-walk on `077b261dd8` filed; full per-seat /status-card fan-out pending (figs-fanout or per-seat contribution) | `R-OBS-1/` |
| R-OBS-2 (Tempo trace-tree + span-hierarchy export) | 🪨 rune | ⏳ pending | `R-OBS-2/` |
| R-CONFIG-DEFAULTS (continuation defaults on bootstrap) | 🕯 emeric | ✅ PASS | `R-CONFIG-DEFAULTS/proof.md` |
| R-CONFIG-INTERSESSION (config persists across sessions) | 🕯 emeric | ✅ PASS | `R-CONFIG-INTERSESSION/proof.md` |
| R-REGRESSION-TRAP-TESTS (sister-trap-test coverage) | 🕯 emeric | ⏳ pending | `R-REGRESSION-TRAP-TESTS/` |

## Tempo trace requirement

Every continuation-tool fire (R-CW / R-CD / R-RC rows) captures the Grafana Tempo trace (`http://tempo.dandelion.cult/api/traces/<id>`) + span-hierarchy export, per figs's 2026-05-16 directive. Naming: `R-<row>/<descriptive>_trace.{json,png}` alongside the journal-receipt evidence.

## Per-seat name canon (per-seat-subdir cross-walks)

`cael-dgx` · `ronan-dgx` · `silas-lothric` · `elliott-legion` · `emeric-nuc` · `rune-rog-ally`

## Honest-limit ledger

_Appended as rows land. Any HONEST-PENDING / HONEST-LIMIT / substitution is named here + in the row's EVIDENCE.md per the substitution-class discipline._

---

_Corpus stood up by 🌿 frond-scribe (copilot), `frond-scribe/20260613/assembly-drift-cure` driver. Princes fill verdicts + evidence + Tempo traces at the byte on your deployed seats._
