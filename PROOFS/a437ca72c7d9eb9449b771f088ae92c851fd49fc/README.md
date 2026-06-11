# PROOFS corpus — `a437ca72c7d9eb9449b771f088ae92c851fd49fc`

Behavioral proof-corpus for the **complete doom-lock cure assembly** (`a437ca7`), gathered live on the deployed fleet. See `RESOLVED-SHA.md` for the SHA-identity + cure-PR chain. Methodology: `openclaw-bootstrap/RUNBOOKS/PROOF-CORPUS-METHOD.md` (the proofs-generation runbook) + `METHOD.md` here for this corpus's reproducer anchors.

**Where these live:** `karmaterminal/karmaterminal-openclaw-docs:main` directly — one clean main, no branch/PR detour (figs 2026-05-16). Path keyed by the full 40-char SHA.

---

## Cross-seat deploy + #989 doom-lock cure confirmation

The deploy fanned out cohort-wide; each seat byte-confirmed the binary + the #989 chain-reset cure (chain at 0/200 or observed-reset on a fresh non-continuation user-turn — pre-#989 a full-day continuation session would carry a stuck-high count; observing reset = the `!isContinuationWake` gate at `agent-runner.ts:1788` firing as designed).

| Seat | Hardware | Binary `a437ca7` | #989 chain-reset | Registry | Notes |
|---|---|---|---|---|---|
| 🌫 silas-lothric | i9-14900KS + RTX 5090 (x86_64) | ✅ | ✅ chain 22→0 (fresh-turn) | durable-sqlite | canary; fire-seat multi-fire |
| 🌊 ronan-dgx | DGX Spark (ARM64) | ✅ | ✅ chain 0/200 | durable-sqlite | continuation-activity session |
| 🩸 cael-DGX | DGX Spark (ARM64) | ✅ | ✅ (reset on fresh-turn) | durable-sqlite | cross-seat CAPTURE confirm |
| 🕯 emeric-nuc | Intel NUC i7-12700H (x86_64) | ✅ | ✅ chain 0/200 | durable-sqlite | full-day design-pass + holds |
| 🌻 elliott-host | Legion AMD + RTX 3080 (x86_64) | ✅ | ✅ chain 0/200 | durable-sqlite | ~4hr storm tail + 4 compactions |
| 🪨 rune-rog-ally | ROG Ally Z1 Extreme (x86_64) | (pending row) | (pending row) | durable-sqlite | byte-walker third-seat |

**N≥4 seats byte-confirm #989 firing identically on the same binary under distinct usage-patterns** = not a one-seat-or-usage artifact. (All seats durable-sqlite; the earlier in-memory-vs-durable split was retracted — persist-invariant is universal; registry-divergence MOOT.)

---

## Row verdict table

Per-row assignments per `PROOF-CORPUS-METHOD.md`. **Both-forms mandate** (figs 2026-06-07): every `continue_work`/`continue_delegate` row needs BOTH the tool-form AND the token/bracket-form fired — a row proving only one form is INCOMPLETE. `request_compaction()` is tool-only.

| Row | Owner | Behavior | Status |
|---|---|---|---|
| R-CW-MULTI-FIRE | 🌫 + 🩸 | multi-`continue_work` CAPTURE + DELIVERY on `a437ca7` | ✅ lothric (3/3 deliver) + cael-DGX (cross-seat CAPTURE) |
| R-DOOM-LOCK-CHAIN-RESET | 🌫 | #989 chain-reset (chain 22→0→1) explicit row | ✅ lothric |
| R-CW-1 | 🩸 Cael | `continue_work()` wake + deploy-persistence | ⏳ pending |
| R-CW-2 | 🩸 Cael | chain-counter accounting | ⏳ pending (may embed in R-CW-1) |
| R-CW-4 | 🩸 Cael | chain depth tracking across hops | ⏳ pending |
| R-CW-5 | 🩸 Cael | cost-cap exhaustion → dispatch-time reject | ⏳ pending |
| R-CW-TOKEN | 🩸 Cael | **token/bracket form** of `continue_work` drives hop-2 | ⏳ pending (both-forms sibling of R-CW-MULTI-FIRE) |
| R-RC-2 | 🩸 Cael | `request_compaction()` over-threshold ACCEPT | ⏳ pending |
| R-989-P2-1 | 🌫 (lothric primary) + 🩸 (cael-DGX cross-seat) | ordinary subagent-return → reset; in-chain → preserve (both legs) | ⏳ pending |
| R-CW-3 | 🩸 Cael + 🕯 Emeric (per-seat sister) | `continue_work` reason-field in OTel span | ⏳ pending |
| R-CW-6 / R-CW-7 | 🪨 Rune | chain-depth-boundary reject / traceparent E2E | ⏳ pending |
| R-CW-DELEGATE-SELF-CONTINUATION | 🪨 Rune | `continue_delegate` self-continuation | ⏳ pending |
| R-CW-DELEGATE-TOKEN | 🪨 Rune | **the #952 row** — lightContext subagent bracket-fire hop-2 executes | ⏳ pending |
| R-CD-1..4 / R-CD-TOKEN | 🌊 Ronan | `continue_delegate` schedule/silent-wake/post-compaction/cross-session + token | ⏳ pending |
| R-CD-CHAINED-DEPTH-2 | 🌊 + 🕯 + 🪨 + 🌫 | depth-2 chain (up-tree / inter-session / echo-broadcast) | ⏳ pending |
| R-RC-1 | 🌫 Silas | `request_compaction()` threshold REJECT | ⏳ pending |
| R-OBS-1 / R-OBS-2 | 🌻 Elliott + 🪨 Rune | external `/status` 6-prince cross-walk + Tempo trace-tree | ⏳ pending |
| R-CONFIG-* / R-REGRESSION-TRAP-TESTS | 🕯 Emeric | config-defaults/intersession + sister-trap-tests | ⏳ pending |

Verdict legend: ✅ PASS · ⚠️ HONEST-LIMIT (substrate condition is itself the proof) · 🔴 FAIL (HALT → back to Gate 1) · ⏳ pending.

**Tempo trace requirement** (figs 2026-05-16): each continuation-tool fire captures the Grafana Tempo trace (trace-id + `http://tempo.dandelion.cult/api/traces/<id>` + span-hierarchy export) alongside the journal/sqlite receipts.

---

## Corpus contents

```
PROOFS/a437ca72c7d9eb9449b771f088ae92c851fd49fc/
├── README.md            ← this file (verdict table + cross-seat confirm)
├── METHOD.md            ← reproducer anchors + runbook pointer
├── RESOLVED-SHA.md      ← SHA-identity + cure-PR chain + residual
├── silas-lothric/
│   ├── R-CW-MULTI-FIRE.md
│   └── R-DOOM-LOCK-CHAIN-RESET.md
└── cael-DGX/
    └── R-CW-MULTI-FIRE.md
```

Rows land per-seat (or per-row-per-seat for cross-walk rows) as each prince fires their assigned set. README updates alongside each row commit.
