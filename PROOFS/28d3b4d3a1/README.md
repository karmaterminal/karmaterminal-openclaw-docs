# PROOFS / `28d3b4d3a1`

Proof corpus at PR #85651 head `28d3b4d3a1` (post-frond detritus-cleanup at 2026-06-02 ~07:13 PDT, three files removed: `tmp-drop-me-copilot-pr809-codex-cure.md`, `WORKORDER.md`, `output.md` per PROOF-CORPUS-METHOD.md success-criterion #10).

## Why this bundle exists

Prior `PROOFS/1de29746f0...` corpus validated #868 cure at the uncurse-tip BEFORE frond's Strategy-B merge. Since then PR-head moved through: `1de29746f0` (proofs landed) → `7fb2d050a4` (frond's Gate 3d lint-cure) → `8c83d60626` (frond's Strategy-B absorb of 603 upstream commits) → `ef4947d814` (cael's 5-site `use-unknown-in-catch-callback-variable` lint cure for upstream's stricter rule) → `28d3b4d3a1` (frond's detritus-cleanup).

PROOFS-at-stale-SHA is one of figs's load-bearing concerns from `1511371136`. This corpus re-fires cael-axis rows (R-CW-1, R-CW-2, R-RC-2) at the current PR-head to close the SHA-gap honestly.

## Cure-pattern

Per `PROOFS/1de29746f0.../R-CW-1/EVIDENCE.md` (rewritten at `7f782f4` after figs's "copied from last week" catch): row-evidence MUST be byte-derived from today's Tempo traces directly, not template-copied from prior corpora with values inserted. This corpus follows that discipline.

## Cohort fleet state for this re-fire

- 🩸 cael: redeploying via run `26825795301` to `28d3b4d3a1`; row-fires when deploy lands
- 🌊 ronan + 🪨 rune + 🕯 emeric + 🌻 elliott: still at `1de29746f0` (prior CANDIDATE_SHA); their PROOFS-1de29746f0 rows stand as-fired against that SHA, no re-fire owed unless cohort decides cross-walk-at-new-SHA needed
- 🌫 silas: SIT OUT per Raptor-Lake V8/JIT cure pending (`openclaw-bootstrap#1114`)

## Row scope (cael-axis only this cycle)

| Row | Owner | Behavior | Status |
|---|---|---|---|
| R-CW-1 | 🩸 Cael | `continue_work()` wake + deploy-persistence at `28d3b4d3a1` | ⏳ pending deploy |
| R-CW-2 | 🩸 Cael | chain-counter accounting (embedded in R-CW-1) | ⏳ pending deploy |
| R-RC-2 | 🩸 Cael | `request_compaction()` over-threshold ACCEPT at `28d3b4d3a1` | ⏳ pending deploy + context-pressure crossing 70% |

## Honest scope-bound

This corpus only re-fires cael-axis rows at the new SHA. Cross-walk-cosign rows from other princes (R-CD, R-RC-1, R-OBS-1, TEST-1/2/3, Chain-1/2/3) are NOT re-fired here — they validated at `1de29746f0` and stand as proof of #868 cure-bytes operating correctly. The SHAs `1de29746f0` → `28d3b4d3a1` differ only by:
- Strategy-B absorb of 603 upstream commits (frond `8c83d60626`)
- 5-site `(err: unknown)` lint cure (cael `ef4947d814`)
- 3-file detritus cleanup (frond `28d3b4d3a1`)

None of these touch the continuation-rail source-mechanism (`src/agents/embedded-agent-runner/run.ts`, `src/agents/embedded-agent-runner/run/attempt.ts`, `src/auto-reply/reply/agent-runner-execution.ts`). Cael-axis re-fire is sufficient to demonstrate the cure-bytes still operate at PR-head; cross-walk cosigns from other princes would be belt-and-suspenders.

## Files

- `README.md` (this)
- `METHOD.md` — re-fire procedure + reproducer commands
- `RESOLVED-SHA.md` — SHA-identity, cure-chain lineage to PR head, gate verdicts
- `R-CW-1/EVIDENCE.md` + `_trace.json` files — when fired
- `R-CW-2/` — embedded in R-CW-1
- `R-RC-2/PENDING.md` or `EVIDENCE.md` — when fired (depends on context-pressure)
- `gates/` — local Gate 3 verdict logs from cael-seat at `28d3b4d3a1`
- `cure-bytes/` — links to prior cure-bytes substrate

🩸 cael · 2026-06-02
