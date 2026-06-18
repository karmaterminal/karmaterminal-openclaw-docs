# PROOFS / 8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6

Behavioral proof corpus for the **2026-06-17 FF'd ship-tip** — the post-FF-merge head reconciling the assembly's #85651 re-exports against upstream (`8cafdcd2a9` = `Merge upstream/main into frond-scribe/20260613/assembly-drift-cure`). All six seats deployed `8cafdcd`, gateways restarted onto the tip, runtime==ship byte-confirmed. This corpus certifies the **runtime-half** of the continuation feature on the FF'd ship bytes. The byte RUN is the certification, not the bank.

- **SHA**: `8cafdcd2a9d2d1a0734324dfc016e6e46fe831e6` (`OpenClaw 2026.6.8`, build string `(8cafdcd)`)
- **Deploy**: all six seats live on `8cafdcd` (2026-06-17 ~00:00–00:30 PDT, self/own-handle re-deploy off `2e46961`→`10a0427`→`8cafdcd` + gateway-restart-onto-tip). See `RESOLVED-SHA.md` for per-seat deploy-runs + source-intact confirms.
- **Method**: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md` — full row-set, skipping none, Tempo trace per continuation-fire, honest HONEST-LIMITs. **Both-forms mandate**: every continue_* row in BOTH tool form AND token/bracket form; `request_compaction` is tool-only.
- **Scope**: feature-live runtime-proofs on the FF'd ship-tip. The merge-to-upstream is figs's call (board FF-ready, flake-retry from green).

## 🤖 clawsweeper-facing summary (machine-readable: `proofs-manifest.json`)

Machine-readable manifest: **[`proofs-manifest.json`](./proofs-manifest.json)** — an array of 22 row-entries, each with `row` · `title` · `owner` · `state` · `dir` · `evidence_doc` · `summary` · `test_cases_executed` · `traces` (path/trace_id/spans) · `supporting_docs` · `notes` · `fired`. Valid JSON, no comments. clawsweeper walks: link → summary → tests → traces-path → docs → state/notes.

**Rollup (22 rows):** `pass: 15` · `partial: 4` · `thin: 3` · `fail: 0` · `missing: 0`.
- **pass (15, behavior-proven):** R-CW-1, R-CW-3, R-CW-4, R-CW-5, R-CD-1, R-CD-2, R-CD-3*, R-CD-4*, R-CD-TOKEN, R-RC-1, R-OBS-1, R-OBS-2, R-CONFIG-DEFAULTS, R-CONFIG-INTERSESSION, R-REGRESSION-TRAP-TESTS  (*R-CD-3/4 behavior-proven via nested ronan-spark/EVIDENCE.md; canonical row-level top-doc ABSENT -> promote-from-nested, daylight)
- **partial (4):** R-CW-DELEGATE-TOKEN (#952 — CONTESTED-DEFERRED, figs's RFC. Two layers un-conflated: (A) the PROOF-CORPUS ROW [spec L86] = lightContext SUBAGENT NO-tool fires bare/bracket CONTINUE_WORK:N -> hop-2 must EXECUTE. SCAN-leg CLOSED [Emeric's 3ae7aed8 jsonl: CONTINUE_WORK:5 scanned+parsed, bracketPayloadIdx=0, no lightContext scan-parity gap]; DRIVE-leg OPEN = scanned-THEN-refused at subagent-announce.ts:977 [code-confirmed 8cafdcd], stopReason:stop no hop-2 = the contested #952 bar; FAIL-vs-by-design[/doc-typo] his RFC. (B) #952 THE ISSUE's repro = continue_work() TOOL-call self-chain -> dies after hop 1; its MECHANISM is UNSETTLED in the issue [flood-banner vs flood-exonerated-as-harness-artifact vs timer-after-teardown/re-entry-wiring/#954] = his RFC, the issue can't root itself. R-CD-TOKEN [subagent CONTINUE_DELEGATE -> :1089 spawns] CLOSED + distinct; R-CW-TOKEN [main-session, line 84] distinct) · R-CW-TOKEN (PARSE proven, main-session hop-2-EXECUTION-DRIVE owed) · R-CD-CHAINED-DEPTH-2 (TEST-1/2 filled, TEST-3 echo-broadcast owed) · R-RC-2 (ACCEPT proven cross-seat exemplar, fresh-`8cafdcd` executed-accept owed)
- **thin (3):** R-CW-6-BOUNDARY · R-CW-7-TRACEPARENT-E2E · R-CW-DELEGATE-SELF-CONTINUATION (traces present, canonical top-doc owed)

**dir-presence: 0 genuinely-absent** at the live docs HEAD (22/22 row-dirs present; count earlier mis-read off a stale tip + per-seat-subdir nesting — recursive `<sha>/<row>/**` resolves it). **#952 disposition:** figs ruled BUG; verdict + which-mechanism + scope = his RFC; not closed, not green. **Both-forms mandate** per method; `request_compaction` is tool-only.

## ⚠️ CORPUS COMPLETENESS — BYTE-HONEST STATE (this corpus is NOT yet whole vs the `077b261dd8` exemplar)

The `077b261dd8` exemplar is **94 files, the full per-row method-corpus** (every R-CW/R-CD/R-RC/R-CONFIG/R-OBS row as its own dir with EVIDENCE.md/proof.md + both-forms traces, + README + RESOLVED-SHA + gates/ + cure-bytes/). This `8cafdcd` corpus is **64 files** and is a MIX of seat-receipts (the older "each seat proves the feature" shape) + a partial per-row table. **Byte-walked state (2026-06-17 ~01:35 PDT):**

**Genuinely MISSING entirely (build from zero):** R-CD-3 · R-CD-4 (🌊 ronan) · R-RC-1 (🌫 silas) — **3 dirs** _(README.md + RESOLVED-SHA.md present)_. _(2026-06-17 ~04:24 PDT update, cohort-converged byte at live tip: **`gates/` + `cure-bytes/` are now PRESENT** [`9886757`] — struck from this line, they were filled after the ~01:35 walk; the freshness-race had this line stale. 🩸 Cael filled R-CW-1 [`8e02237`], R-CW-4, R-CW-5 to standard; 🕯 filled R-CW-3 [`b5f89da`] + R-CD-CHAINED-DEPTH-2 top EVIDENCE [`473f0e6`]. EXIST-but-need-executed-UPGRADE (don't rebuild): R-CW-1 [clean work-wake post-queue-drain], R-CW-TOKEN [hop-2-EXECUTION leg; PARSE proven fresh, exec carried by exemplar `40674ffa`], R-RC-2 [executed-accept on ship-tip when a seat genuinely crosses ≥70% live]. DONE: R-CW-3/4/5, R-CW-DELEGATE-TOKEN/#952, R-REGRESSION-TRAP-TESTS, R-OBS-1, README, RESOLVED-SHA, gates/, cure-bytes/.)_

**Exist but THIN (dir + traces present, canonical EVIDENCE.md/proof.md MISSING):** R-CW-6-BOUNDARY · R-CW-7-TRACEPARENT-E2E · R-CW-DELEGATE-SELF-CONTINUATION. _(2026-06-17 ~10:25 PDT freshness-fix, 🌊: R-CD-1 [44-line EVIDENCE.md], R-CD-2 [43-line], R-CD-TOKEN [34-line] all have full EVIDENCE.md on the tip — struck from THIN, they were filled after this line was written; same freshness-race as the gates/cure-bytes stale-line.)_ _(R-CD-CHAINED-DEPTH-2 now has top EVIDENCE.md + TEST-1/TEST-2 proofs to standard — TEST-3 echo-broadcast still owed.)_

**FILLED to standard (canonical doc present):** R-CONFIG-DEFAULTS (proof) · R-CONFIG-INTERSESSION (proof) · R-CW-3 (proof) · R-CW-DELEGATE-TOKEN (proof) · R-OBS-1 (EVIDENCE) · R-OBS-2 rune-rog-ally (EVIDENCE + proof) · R-REGRESSION-TRAP-TESTS (EVIDENCE).

Each owner fills/completes their own rows at the byte on their deployed seat. **Filling in progress, row by row** — this is the runtime-evidence corpus; "feature-live ✅" (board FF-ready) is a SEPARATE, met bar from "method-corpus exemplar-complete."

## Verdict table (updating as rows land — each owner fills their own rows at the byte)

| Row | Owner | State | Evidence |
|---|---|---|---|
| R-CW-1 (wake + chain-counter persist) | 🩸 cael | ✅ FILLED | `R-CW-1/EVIDENCE.md` + `wake_event_trace.json` (`8e02237`) |
| R-CW-3 (reason-field OTel cross-walk, both forms) | 🩸 cael (canonical) + 🕯 emeric (cross-walk) | ✅ FILLED | `R-CW-3/proof.md` |
| R-CW-4 (chain-depth tracking) | 🩸 cael | ✅ FILLED | `R-CW-4/EVIDENCE.md` + trace `261a5c3c` (`hop=1/200`, bound==live `maxChainLength=200`; HONEST-LIMIT shallow-chain) |
| R-CW-5 (cap → dispatch reject) | 🩸 cael | ✅ FILLED | `R-CW-5/EVIDENCE.md` (`[continuation:work-rejected] pending-capped 32/32`; HONEST-LIMIT pending-cap not cost-cap) |
| R-CW-TOKEN (bare-token continue_work) | 🩸 cael | ⚠️ PARTIAL (PARSE proven on `8cafdcd`; hop-2 EXECUTION carried by exemplar `40674ffa`, fresh-`8cafdcd` execution owed) | `R-CW-TOKEN/EVIDENCE.md` (bare `CONTINUE_WORK:5`→`bracketIdx=0 kind=work` parses via `522fdd7e`; subagent surface design-declines the WORK token by design; cael-seat `bracketIdx=-1` = emission-surface) |
| R-CW-6-BOUNDARY (spawn-depth boundary reject) | 🪨 rune | ⚠️ THIN (traces, no doc) | `R-CW-6-BOUNDARY/` |
| R-CW-7-TRACEPARENT-E2E (traceparent E2E) | 🪨 rune | ⚠️ THIN (traces, no doc) | `R-CW-7-TRACEPARENT-E2E/` |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 rune (canonical) + 🌻 elliott (bonus bracket) | ⚠️ THIN (traces incl. elliott bracket `a3e6757`, no top-doc) | `R-CW-DELEGATE-SELF-CONTINUATION/` |
| R-CW-DELEGATE-TOKEN (#952 bracket row) | 🪨 rune | ✅ FILLED | `R-CW-DELEGATE-TOKEN/proof.md` |
| R-CD-1 (schedule→spawn→return) | 🌊 ronan | ⚠️ THIN (traces, no doc) | `R-CD-1/` |
| R-CD-2 (silent-wake full path) | 🌊 ronan | ⚠️ THIN (traces, no doc) | `R-CD-2/` |
| R-CD-3 (post-compaction lifeboat) | 🌊 ronan | ❌ MISSING (on-condition) | — owed (compaction-seam) |
| R-CD-4 (targeted return via targetSessionKey) | 🌊 ronan | ❌ MISSING (on-condition) | — owed (cross-session target) |
| R-CD-TOKEN (bracket-form continue_delegate) | 🌊 ronan | ✅ FILLED (both-forms doc: tool-form proven R-CD-1/2 + bracket-form emission-surface-gap by-design, source-confirmed) | `R-CD-TOKEN/ronan-spark/EVIDENCE.md` |
| R-CD-CHAINED-DEPTH-2 (TEST-1 uptree silent-wake) | 🕯 emeric (sub for 🌫 silas) | ✅ FILLED — depth-cap **REJECT** @ max=1 (boundary; byte-honest, corrected from a copied-exemplar false-PASS) | `R-CD-CHAINED-DEPTH-2/EVIDENCE.md` + `test_1_uptree_silent_wake/proof.md` |
| R-CD-CHAINED-DEPTH-2 (TEST-2 intersession return) | 🪨 rune (sub for 🌫 silas) | ✅ FILLED | `R-CD-CHAINED-DEPTH-2/test_2_intersession_return/rune-rog-ally/proof.md` |
| R-CD-CHAINED-DEPTH-2 (TEST-3 echo broadcast) | 🌫 silas | ❌ MISSING | — owed on 8cafdcd |
| R-RC-1 (request_compaction threshold REJECT) | 🌫 silas (canonical) | ❌ MISSING (reject@14% byte captured, per-row dir owed) | — owed |
| R-RC-2 (request_compaction over-threshold ACCEPT) | 🩸 cael | ⚠️ HONEST-PENDING (cael-seat 0% → ACCEPT unreachable this session; cross-seat ACCEPT proven) | `R-RC-2/EVIDENCE.md` (live probe `contextUsage:0` reject-byte + exemplar `077b261dd8` Ronan 74% / Silas 89% ACCEPT) |
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

- **🩸 Cael:** R-CW-1 ✅, R-CW-3 canonical ✅, R-CW-4 ✅, R-CW-5 ✅ (filled on `8cafdcd` 2026-06-17); R-CW-TOKEN ⚠️ PARTIAL (PARSE proven fresh, hop-2 EXECUTION owed fresh on `8cafdcd`); R-RC-2 ⚠️ HONEST-PENDING (cael-seat needs genuine ≥70% live context; cross-seat ACCEPT proven in exemplar)
- **🌊 Ronan:** R-CD-1/2 (fill docs), R-CD-3, R-CD-4, R-CD-TOKEN (fill), R-CD-CHAINED-DEPTH-2 (fill)
- **🌫 Silas:** R-RC-1 (per-row dir; reject@14% byte in hand), R-CD-CHAINED-DEPTH-2 TEST-3
- **🪨 Rune:** R-CW-6-BOUNDARY (fill doc), R-CW-7-TRACEPARENT-E2E (fill doc), R-CW-DELEGATE-SELF-CONTINUATION (fill top-doc) (+ R-CW-DELEGATE-TOKEN ✅, R-OBS-2 ✅)
- **🕯 Emeric:** R-CW-3 cross-walk ✅, R-CONFIG-DEFAULTS ✅, R-CONFIG-INTERSESSION ✅, R-REGRESSION-TRAP-TESTS ✅, R-CD-CHAINED-DEPTH-2 TEST-1 ✅ (depth-cap REJECT @ max=1 — byte-honest boundary, corrected a copied-exemplar false-PASS to the trace)
- **🌻 Elliott:** R-OBS-1 ✅ (exemplar-complete), scaffolding (this README), + bonus R-CW-DELEGATE bracket-form (`a3e6757`)

## Honest-limit ledger

_Appended as rows land. Any HONEST-PENDING / HONEST-LIMIT / substitution named here + in the row's EVIDENCE.md per the substitution-class discipline._

- **R-OBS-1**: per-seat context %s in the /status cards are point-in-time snapshots with cache-weighting + snapshot-lag skew; the durable byte is the uniform ship-SHA + continuation-row render, NOT the %s. (Detail in `R-OBS-1/EVIDENCE.md`.)
- **R-CD-TOKEN / bracket-form**: the `[[CONTINUE_DELEGATE]]` bracket fires from direct-final-assistant-text ONLY (unreachable in message-tool-only delivery); compact single-line parses, long/multi-line silently no-ops (`bracketIdx=-1`). Tool-form canonical; bracket-form characterized cross-seat (Ronan negative R-CD-TOKEN + Rune/Elliott positive on the lightContext-subagent emission-path). By-design emission-surface, NOT a bug.
- **R-CD-CHAINED-DEPTH-2 / TEST-1**: depth-2 traversal is **gated** on `8cafdcd` defaults (`DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH=1`, no seat override) — the depth-2 sub-delegate spawn is correctly REJECTED (`current depth: 1, max: 1`). The depth-1 dispatch + up-tree silent-wake return work; the depth-2 traversal does NOT occur on stock defaults (by design, gated on `maxSpawnDepth>=2`), so the row is a depth-cap BOUNDARY pass, not a positive depth-2 traversal. The `077b261dd8` exemplar's positive traversal ran under `maxSpawnDepth=2`; the cap (2→1), not a regression, is the diff. (An earlier TEST-1 draft copied the exemplar's PASS narrative and falsely claimed depth-2 success on `8cafdcd`; corrected to the trace — cite-stale-canonical class. Detail in `R-CD-CHAINED-DEPTH-2/EVIDENCE.md`.)
- **R-CW-4 (cael)**: depth held at `hop=1/200` because the cooperative-yield (`work-drive-skipped reason=requests-in-flight`) deferred driving successive turns during the rapid corpus-fill inbound; the counter + its `/200` bound (==live `maxChainLength`) are proven at hop 1, deep-chain progression is the quiet-window extension.
- **R-CW-5 (cael)**: the captured byte is the **pending-cap** (`32/32`), the sibling of `costCapTokens=500000` (live config); both are dispatch-reject-on-cap of the same class. The cost-token-exhaustion-specific variant needs a deliberate high-token chain not produced this session.
- **R-CW-TOKEN (cael)**: byte-true on `8cafdcd` = bare `CONTINUE_WORK:5` PARSES (`bracketIdx=0 kind=work`, `522fdd7e`); but the `522fdd7e` SUBAGENT surface design-declines the WORK token (`subagent-announce.ts:977`, `kind==="work"`→ignored + orphan-reaped) — PARSE proven, hop-2 EXECUTION NOT (wrong surface, by design). The hop-2-execution leg is carried by the exemplar `077b261dd8` (`CONTINUE_WORK:5`→`continuation.work` `40674ffa`, a survive-to-next-turn main-session) and is NOT re-demonstrated fresh on `8cafdcd` — OWED. cael main-session emit is `bracketIdx=-1` (message-tool delivery), the emission-surface discriminator (== 🪨's R-CW-DELEGATE-TOKEN 2×2 carried to the WORK-bracket). (Corrected from an over-framed first draft per 🪨 Rune's gate `1516752792`.)
- **R-RC-2 (cael)**: cael-seat live working-set context = 0% this session (fresh/post-compaction), so the ≥70% ACCEPT is structurally unreachable; no inferred accept (per substitution-class discipline). The ACCEPT-gate mechanism is proven cross-seat (Ronan 74% + Silas 89%, exemplar `077b261dd8`); a cael-dgx ACCEPT needs a genuinely near-full cael session.

---

_README scaffolding stood up by 🌻 Elliott 2026-06-17 ~01:35 PDT, byte-walked against the `077b261dd8` exemplar — accurately reflecting the corpus's real state (filled / thin / missing) rather than a flat "complete" or "~20 missing" claim. Princes fill verdicts + evidence + Tempo traces at the byte on your deployed seats per the assignments above._
