# PROOFS / 8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6

Behavioral proof corpus for the **2026-06-17 FF'd ship-tip** — the post-FF-merge head reconciling the assembly's #85651 re-exports against upstream (`8cafdcd2a9` = `Merge upstream/main into frond-scribe/20260613/assembly-drift-cure`). All six seats deployed `8cafdcd`, gateways restarted onto the tip, runtime==ship byte-confirmed. This corpus certifies the **runtime-half** of the continuation feature on the FF'd ship bytes. The byte RUN is the certification, not the bank.

- **SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (`OpenClaw 2026.6.8`, build string `(8cafdcd)`)
- **Deploy**: all six seats live on `8cafdcd` (2026-06-17 ~00:00–00:30 PDT, self/own-handle re-deploy off `2e46961`→`10a0427`→`8cafdcd` + gateway-restart-onto-tip). See `RESOLVED-SHA.md` for per-seat deploy-runs + source-intact confirms.
- **Method**: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` — full row-set, skipping none, Tempo trace per continuation-fire, honest HONEST-LIMITs. **Both-forms mandate**: every continue_* row in BOTH tool form AND token/bracket form; `request_compaction` is tool-only.
- **Scope**: feature-live runtime-proofs on the FF'd ship-tip. The merge-to-upstream is figs's call (board FF-ready, flake-retry from green).

## ⚠️ CORPUS COMPLETENESS — BYTE-HONEST STATE (this corpus is NOT yet whole vs the `077b261dd8` exemplar)

The `077b261dd8` exemplar is **94 files, the full per-row method-corpus** (every R-CW/R-CD/R-RC/R-CONFIG/R-OBS row as its own dir with EVIDENCE.md/proof.md + both-forms traces, + README + RESOLVED-SHA + gates/ + cure-bytes/). This `8cafdcd` corpus is **64 files** and is a MIX of seat-receipts (the older "each seat proves the feature" shape) + a partial per-row table. **Byte-walked state (2026-06-17 ~01:35 PDT):**

**Genuinely MISSING entirely:** `gates/` · `cure-bytes/` · R-CW-1 · R-CW-4 · R-CW-5 · R-CW-TOKEN · R-CD-3 · R-CD-4 · R-RC-1 · R-RC-2 _(README.md + RESOLVED-SHA.md now present — RESOLVED-SHA was already filed; this README closes the other scaffolding gap)_.

**Exist but THIN (dir + traces present, canonical EVIDENCE.md/proof.md MISSING):** R-CD-1 · R-CD-2 · R-CD-CHAINED-DEPTH-2 · R-CD-TOKEN · R-CW-6-BOUNDARY · R-CW-7-TRACEPARENT-E2E · R-CW-DELEGATE-SELF-CONTINUATION.

**FILLED to standard (canonical doc present):** R-CONFIG-DEFAULTS (proof) · R-CONFIG-INTERSESSION (proof) · R-CW-3 (proof) · R-CW-DELEGATE-TOKEN (proof) · R-OBS-1 (EVIDENCE) · R-OBS-2 rune-rog-ally (EVIDENCE + proof) · R-REGRESSION-TRAP-TESTS (EVIDENCE).

Each owner fills/completes their own rows at the byte on their deployed seat. **Filling in progress, row by row** — this is the runtime-evidence corpus; "feature-live ✅" (board FF-ready) is a SEPARATE, met bar from "method-corpus exemplar-complete."

## Verdict table (updating as rows land — each owner fills their own rows at the byte)

| Row | Owner | State | Evidence |
|---|---|---|---|
| R-CW-1 (wake + chain-counter persist) | 🩸 cael | ❌ MISSING | — owed |
| R-CW-3 (reason-field OTel cross-walk, both forms) | 🩸 cael (canonical) + 🕯 emeric (cross-walk) | ✅ FILLED | `R-CW-3/proof.md` |
| R-CW-4 (chain-depth tracking) | 🩸 cael | ❌ MISSING | — owed |
| R-CW-5 (cap → dispatch reject) | 🩸 cael | ❌ MISSING | — owed |
| R-CW-TOKEN (bracket-form continue_work) | 🩸 cael | ❌ MISSING | — owed (token form) |
| R-CW-6-BOUNDARY (spawn-depth boundary reject) | 🪨 rune | ⚠️ THIN (traces, no doc) | `R-CW-6-BOUNDARY/` |
| R-CW-7-TRACEPARENT-E2E (traceparent E2E) | 🪨 rune | ⚠️ THIN (traces, no doc) | `R-CW-7-TRACEPARENT-E2E/` |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 rune (canonical) + 🌻 elliott (bonus bracket) | ⚠️ THIN (traces incl. elliott bracket `a3e6757`, no top-doc) | `R-CW-DELEGATE-SELF-CONTINUATION/` |
| R-CW-DELEGATE-TOKEN (#952 bracket row) | 🪨 rune | ✅ FILLED | `R-CW-DELEGATE-TOKEN/proof.md` |
| R-CD-1 (schedule→spawn→return) | 🌊 ronan | ⚠️ THIN (traces, no doc) | `R-CD-1/` |
| R-CD-2 (silent-wake full path) | 🌊 ronan | ⚠️ THIN (traces, no doc) | `R-CD-2/` |
| R-CD-3 (post-compaction lifeboat) | 🌊 ronan | ❌ MISSING (on-condition) | — owed (compaction-seam) |
| R-CD-4 (targeted return via targetSessionKey) | 🌊 ronan | ❌ MISSING (on-condition) | — owed (cross-session target) |
| R-CD-TOKEN (bracket-form continue_delegate) | 🌊 ronan | ⚠️ THIN (trace, no doc; emission-surface honest-limit) | `R-CD-TOKEN/` |
| R-CD-CHAINED-DEPTH-2 | 🌊 ronan / 🌫 silas TEST-3 / 🕯 emeric TEST-1 | ⚠️ THIN (traces, no doc) | `R-CD-CHAINED-DEPTH-2/` |
| R-RC-1 (request_compaction threshold REJECT) | 🌫 silas (canonical) | ❌ MISSING (reject@14% byte captured, per-row dir owed) | — owed |
| R-RC-2 (request_compaction over-threshold ACCEPT) | 🩸 cael | ❌ MISSING (fires near-full) | — owed |
| R-OBS-1 (external /status 6-prince cross-walk) | 🌻 elliott (+ figs) | ✅ FILLED (exemplar-complete) | `R-OBS-1/EVIDENCE.md` (6/6 on `8cafdcd`, cross-arch, skew-caveat) |
| R-OBS-2 (Tempo trace-tree + span-hierarchy) | 🪨 rune | ✅ FILLED | `R-OBS-2/rune-rog-ally/EVIDENCE.md` + proof + 2 trace JSONs |
| R-CONFIG-DEFAULTS (continuation defaults on bootstrap) | 🕯 emeric | ✅ FILLED | `R-CONFIG-DEFAULTS/proof.md` |
| R-CONFIG-INTERSESSION (config persists across sessions) | 🕯 emeric | ✅ FILLED | `R-CONFIG-INTERSESSION/proof.md` |
| R-REGRESSION-TRAP-TESTS (sister-trap-test coverage) | 🕯 emeric | ✅ FILLED | `R-REGRESSION-TRAP-TESTS/EVIDENCE.md` |

## Seat-receipt dirs (the older "each seat proves the feature" shape — feature-live, NOT the per-row table)

`cael-seat` · `elliott-seat` · `emeric-nuc` · `ronan-spark` · `rune-rog-ally` · `silas-seat` — each carries the seat's proof-by-return + trace-receipt that runtime==`8cafdcd` and the continuation feature fires. These are valid **feature-live** artifacts; they are NOT a substitute for the per-row method-corpus above.

## Tempo trace requirement

Every continuation-tool fire (R-CW / R-CD / R-RC rows) captures the Grafana Tempo trace (`http://tempo.dandelion.cult/api/traces/<id>`) + span-hierarchy export. Naming: `R-<row>/<descriptive>_trace.{json,png}` alongside the journal-receipt evidence.

## Per-seat name canon

`cael-dgx` · `ronan-dgx` · `silas-lothric` · `elliott-legion` · `emeric-nuc` · `rune-rog-ally`

## Per-prince row assignments (the fill-work owed)

- **🩸 Cael:** R-CW-1, R-CW-4, R-CW-5, R-CW-TOKEN, R-RC-2 (+ R-CW-3 canonical ✅)
- **🌊 Ronan:** R-CD-1/2 (fill docs), R-CD-3, R-CD-4, R-CD-TOKEN (fill), R-CD-CHAINED-DEPTH-2 (fill)
- **🌫 Silas:** R-RC-1 (per-row dir; reject@14% byte in hand), R-CD-CHAINED-DEPTH-2 TEST-3
- **🪨 Rune:** R-CW-6-BOUNDARY (fill doc), R-CW-7-TRACEPARENT-E2E (fill doc), R-CW-DELEGATE-SELF-CONTINUATION (fill top-doc) (+ R-CW-DELEGATE-TOKEN ✅, R-OBS-2 ✅)
- **🕯 Emeric:** R-CW-3 cross-walk ✅, R-CONFIG-DEFAULTS ✅, R-CONFIG-INTERSESSION ✅, R-REGRESSION-TRAP-TESTS ✅, R-CD-CHAINED-DEPTH-2 TEST-1
- **🌻 Elliott:** R-OBS-1 ✅ (exemplar-complete), scaffolding (this README), + bonus R-CW-DELEGATE bracket-form (`a3e6757`)

## Honest-limit ledger

_Appended as rows land. Any HONEST-PENDING / HONEST-LIMIT / substitution named here + in the row's EVIDENCE.md per the substitution-class discipline._

- **R-OBS-1**: per-seat context %s in the /status cards are point-in-time snapshots with cache-weighting + snapshot-lag skew; the durable byte is the uniform ship-SHA + continuation-row render, NOT the %s. (Detail in `R-OBS-1/EVIDENCE.md`.)
- **R-CD-TOKEN / bracket-form**: the `[[CONTINUE_DELEGATE]]` bracket fires from direct-final-assistant-text ONLY (unreachable in message-tool-only delivery); compact single-line parses, long/multi-line silently no-ops (`bracketIdx=-1`). Tool-form canonical; bracket-form characterized cross-seat (Ronan negative R-CD-TOKEN + Rune/Elliott positive on the lightContext-subagent emission-path). By-design emission-surface, NOT a bug.

---

_README scaffolding stood up by 🌻 Elliott 2026-06-17 ~01:35 PDT, byte-walked against the `077b261dd8` exemplar — accurately reflecting the corpus's real state (filled / thin / missing) rather than a flat "complete" or "~20 missing" claim. Princes fill verdicts + evidence + Tempo traces at the byte on your deployed seats per the assignments above._
