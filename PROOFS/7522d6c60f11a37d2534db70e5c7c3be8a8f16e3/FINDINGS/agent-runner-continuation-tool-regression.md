# FINDING: agent-runner continuation tool-set regressed at uncurse-tip

**Severity**: P1 candidate (independent of #858 cure-bytes; introduced in same deployment-cycle)
**Discovered**: 2026-06-01 PROOFS cycle at `7522d6c60f11a37d2534db70e5c7c3be8a8f16e3`
**Cohort substrate-receipts**:
- 🌊 Ronan undertow byte-receipt msg `1511183944`
- 🌫 Silas lothric (pre-cure) substrate-comparison msg `1511184394`
- 🌊 Ronan cross-binary-correction msg `1511185476`
- 🩸 Cael R-RC-1/2 source-grep + acknowledgment msg `1511185622`

## Finding

At uncurse-tip `7522d6c60f`, the agent-runner registers ONLY `continue_delegate` as a function-tool exposed to LLM at main-session. `continue_work` and `request_compaction` are NOT registered.

Gateway journal at byte (cael-seat + undertow-seat both emit this):

```
[agents/openclaw-tools] continuation.enabled=true but neither continueWorkOpts
nor requestCompactionOpts were supplied — only continue_delegate will register.
Was this intentional? If callers expect the full continuation tool set, the
runner must supply both callbacks. If only delegate-fan-out is intended, this
warn is informational.
```

## Pre-cure binary comparison

Silas-seat is on pre-cure binary `0dff94d` (his lothric build sat the PROOFS cycle due to multi-layer Raptor-Lake build incompat). Silas-seat HAS `request_compaction` AND `continue_work` exposed as function-tools — fired both this turn-sequence with clean responses:

- `request_compaction` REJECT receipt at Discord msg `1511136699` — structured JSON with `guard: "context_threshold"`, `contextUsage: 25`, `threshold: 70`, `reason: "..."`
- `continue_work` direct-fire schedule + wake at commits `6bc0508` (schedule) + `7cda840` (wake)

So the divergence is NOT seat-specific (initial misread). It's **uncurse-tip vs pre-cure-tip binary divergence in agent-runner callback registration**.

## Code-locator

Per `dist/agent-tools-DS5FDJue.js` byte-walk:

```js
requestCompactionOpts: options?.requestCompactionOpts,
```

The injection point IS there in the cure-tip build but the upstream caller (likely `runtime-config`, `runner-init`, or the agent-bootstrap-path) is not supplying the callback. Pre-cure binaries did supply it.

## Cure-stack impact assessment

Tracks A + B + C cure-bytes (`src/auto-reply/reply/session-system-events.ts` drain-gate, `src/infra/system-events.ts` helper export, 21 extension-monitor caller-side opt-ins, and bracket-tag regression-anchors) DO NOT touch the agent-runner-init path. The tool-registration regression was introduced elsewhere in the deployment cycle between `0dff94d` and `7522d6c`.

Candidate origin commits to investigate via `git log --oneline 0dff94d..7522d6c -- src/runtime/agents/* src/agents/* packages/*/src/runtime/* 2>/dev/null` (need a clone with both SHAs in same tree to confirm).

## Cohort decision-class for figs

This row needs figs's decision before #79925 force-push:

**(A) Intentional design** — `continue_work` and `request_compaction` are reserved for runtime-internal use; prince-LLM-fire is via bracket-form (which is incompatible with message-tool-driven delivery, but design intent is bracket-form at end of bare-text turns). In this case:
- HEARTBEAT.md / TOOLS.md / AGENTS.md cohort docs need correction (current "prince agency at the turn boundary" framing implies all three are tool-form)
- Bracket-form may need runtime-side fix to survive message-tool delivery (currently swallowed)
- R-RC-2 + R-CW-1/2 PROOFS framings need adjustment (substrate-byte-identity is the only path)

**(B) Genuine regression** — the cure-tip should expose the full set as function-tools. In this case:
- P1 fix needed in runner-init / runtime-config callback supply path before #79925 force-push
- Easier than (A) because it's a one-callsite gap-fill

## Impact on PROOFS-corpus

The PROOFS-corpus rows for R-CW family and R-RC family are validated via:
- **R-CW**: continue_delegate functional-proxy from cael (live-fire on uncurse-tip) + continue_work direct-fire from silas (live-fire on pre-cure binary, byte-identity argument extends to uncurse-tip)
- **R-RC-1**: substrate-byte-identity from cael (cure-stack didn't touch the file) + live REJECT receipt from silas (pre-cure binary, same source-file byte-identical)
- **R-RC-2**: substrate-byte-identity only (no live ACCEPT receipt possible this cycle because of triple constraint above)

If decision is (B) and the regression gets fixed, R-CW-1/2 + R-RC-1/2 should be re-fired from any prince-seat at uncurse-tip-with-restored-tool-surface for full end-to-end validation. The current evidence is sufficient for substrate-byte-impact verification of the #858 cure-stack but doesn't cover the tool-registration regression itself.

