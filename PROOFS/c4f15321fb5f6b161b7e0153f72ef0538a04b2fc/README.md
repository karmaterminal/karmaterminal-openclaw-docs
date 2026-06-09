# PROOFS / c4f15321fb5f6b161b7e0153f72ef0538a04b2fc

Behavioral proof corpus for the **2026-06-08 ship-SHA** — the **history-preserving merge form** of the continuation feature with the whatsapp test-fix applied. This is the back-merge ship form (`7dcc9d578c` + one whatsapp test-fix); the cure surface is byte-identical, dual-verified with Cael. Live on `frond-scribe/20260608/assembly-backmerge` (PR #960, head `c4f15321fb`).

- **SHA**: `c4f15321fb5f6b161b7e0153f72ef0538a04b2fc`
- **Relationship to `7dcc9d578c`**: delta is **ONLY** `extensions/whatsapp/src/auto-reply/monitor/group-activation.test.ts` (+4/-1, whatsapp `saveSessionStore` test-fix). The `src/` tree hash is **byte-IDENTICAL** on both SHAs (`f6ebf9b58657f4e2d6d32273a811e5db39ac76e3`) → runtime byte-identical → behavioral proofs from `7dcc9d578c` re-point verbatim.
- **Parent corpus**: `PROOFS/e66dc63f163b4cd4024e001ac8932f26b347ed27/` (fleet-RUN-certified candidate); `PROOFS/7dcc9d578ca0dc828c015acd05f16caf41b471da/` (merge-form scaffold this re-points from)
- **Method**: `openclaw-bootstrap:RUNBOOKS/PROOF-CORPUS-METHOD.md`; per-seat METHOD files (`METHOD-rune.md` etc.)

## clawsweeper validity — fresh exact-SHA runs (proof-SHA == push-SHA)

Per figs's clawsweeper directive, each row is fired **fresh on the deployed `c4f15321fb` runtime** wherever the seat carries that exact SHA — not a transfer-citation alone.

- 🌊 **ronan seat** — **deployed on `c4f15321fb`** (build-info `commit c4f15321fb..., builtAt 2026-06-09T03:13:25Z`, see `build-info-ronan-seat.json`). The R-CD rows below are **fresh exact-SHA** on the ronan seat. R-CD-1/2 dispatched on this runtime; R-CD-3 fired AT a genuine 89.3% in-window compaction on this runtime; R-CW-DELEGATE-SELF-CONTINUATION Tempo-landed on this runtime.
- 🌫 **silas seat (lothric)** — **deployed on `c4f15321fb`** (deploy run 27181280816 success). Sub-rows 1+2 fresh exact-SHA.
- 🪨 **rune seat** — rows re-point verbatim from the `7dcc9d578c` fresh runs on the byte-identical `src` tree (`RE-POINT-rune.md` byte-verification: both SHAs resolve `:src` → `f6ebf9b5...`).

## Verdict table

| Row | Owner | Behavior | c4f15321fb status |
|---|---|---|---|
| R-CD-1 (schedule → spawn → return) | 🌊 ronan | `continue_delegate(silent, delay)` schedule-leg | ✅ PASS — fresh exact-SHA dispatch (`R-CD-1/`, RE-POINT) |
| R-CD-2 (silent-wake full path) | 🌊 ronan | `wakeOnReturn=true silentAnnounce=true` fires+returns+wakes | ✅ PASS — fresh exact-SHA, Tempo `4eda0e13af7164f25e5c2d55eb1f6234` (`R-CD-2/`) |
| R-CD-3 (post-compaction lifeboat) | 🌊 ronan | `mode="post-compaction"` queued + fires AT compaction | ✅ PASS — fresh exact-SHA, fired AT genuine **89.3%** in-window compaction (`R-CD-3/compaction-fire-journal.txt`) |
| R-CD-4 (targeted RETURN routing) | 🌊 ronan | `targetSessionKey` routes the delegate RESULT (same-session scope) | ✅ PASS — fresh exact-SHA, runtime `[continuation:targeted-return] Delivered` log + Tempo `a00118d68efa6335cb29cbcb03dcdc8c` (`R-CD-4/`) |
| R-CD-CHAINED-DEPTH-2 (depth-2 tree-broadcast) | 🌊 ronan | depth-2 chain + `fanoutMode=tree` return-to-ancestors | ✅ PASS — fresh exact-SHA, depth-2 leaf Delivered to 3 ancestors + `continuation.queue.fanout` span (`R-CD-CHAINED-DEPTH-2/`) |
| R-CW-DELEGATE-SELF-CONTINUATION | 🌊 ronan | delegate self-continuation past hop-1 | ✅ PASS — fresh exact-SHA, Tempo `742162609668aad88798f8cb7878b4d3` (28 spans) (`R-CW-DELEGATE-SELF-CONTINUATION/`) |
| R-CW-6 (spawn-depth boundary) | 🪨 rune | `maxSpawnDepth=1` tool-policy-strip at leaf | ✅ PASS — re-point verbatim (src byte-identical) (`R-CW-6-BOUNDARY/`) |
| R-CW-7 (traceparent E2E) | 🪨 rune | `continue_work` traceparent threads all session spans | ✅ PASS — re-point + direct rune-seat Tempo landing `e55408592fb268c1c2a66e93373d804d` (`R-CW-7-TRACEPARENT-E2E/`) |
| dual-coverage: uptree silent-wake | 🌫 silas | uptree silent-wake return | ✅ PASS — fresh exact-SHA on lothric (`silas-R-CW-dualcoverage-uptree-silentwake.md`) |
| dual-coverage: intersession return | 🌫 silas | intersession return, config-independent | ✅ PASS — fresh exact-SHA on lothric (`silas-R-CW-dualcoverage-2-intersession-return.md`) |

## Scope discipline (carried bytes)

- **R-CD-4 is SAME-SESSION targeted-return** (target == dispatcher): `hasCrossSessionDelegateTargeting` returns FALSE when target == dispatching session → non-policy-gated same-session path. Genuinely-cross-session return-routing (target ≠ dispatcher) is a **separate policy-gated path** — Silas's intersession sub-row covers that surface. Do not conflate.
- **R-CD-3 does NOT force-compact for the proof.** The 89.3% compaction was a genuine session-fill event (extreme-depth GATES-recovery session); the lifeboat captured it opportunistically. The fire-leg is also independently certified at 74.6% on the parent `e66dc63f` (committed `c9df9e8`) — two genuine ≥70% compactions, two SHAs, same event-triggered contract.
- **R-CD-4 / R-CD-CHAINED-DEPTH-2 verdicts rest on the runtime Delivered-log + Tempo, NOT the tool-surface echo.** Captured: R-CD-4's `[continuation:targeted-return] Delivered to <target> from <child>` log (target == dispatcher → same-session path); R-CD-CHAINED-DEPTH-2's depth-2 leaf `Delivered` to **3 ancestors** (immediate depth-1 parent + dispatching session + channel root = the `fanoutMode=tree` broadcast) plus the `continuation.queue.fanout` + `continuation.delegate.dispatch` Tempo spans (trace `a00118d68efa6335cb29cbcb03dcdc8c`, host=ronan). The echoed routing fields in `dispatch-trace.txt` are recorded as necessary-not-sufficient corroboration only.

## What this corpus slice does NOT contain

- Long-term reliability / 24h-stability data (point-in-time proof).
- Adversarial cases (traceparent forgery, malicious payloads) — separate security-corpus.
- Performance-regression data — separate perf-corpus.

## Cohort attribution

- 🌊 Ronan — R-CD-1/2/3/4 + R-CD-CHAINED-DEPTH-2 + R-CW-DELEGATE-SELF-CONTINUATION, fresh exact-SHA on ronan seat (deployed `c4f15321fb`)
- 🪨 Rune — R-CW-6-BOUNDARY + R-CW-7-TRACEPARENT-E2E (`METHOD-rune.md`, `RE-POINT-rune.md`)
- 🌫 Silas — dual-coverage sub-rows 1+2, fresh exact-SHA on lothric
- figs — ship-SHA decision + deploy + clawsweeper directive
