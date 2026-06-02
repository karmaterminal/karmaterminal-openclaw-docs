# R-RC-2 substrate-byte-identity bridge to pre-cure binary

**Bridge-axis**: same source-file as R-RC-1 (`src/auto-reply/continuation/request-compaction-tool.ts`); R-RC-2 tests the ACCEPT-branch of the same conditional that R-RC-1 tests the REJECT-branch of. No live ACCEPT receipt was captured this cycle at any seat (silas had tool but low context; undertow had high context but no tool — and per Ronan's at-byte correction `1511185476`, undertow's afternoon "94% context" claim was phantom-narrative anyway; emeric was at 107% context but tool-surface not byte-confirmed; cael had neither tool nor high context).

**Why R-RC-2 inherits R-RC-1's bridge**:
- REJECT (R-RC-1) and ACCEPT (R-RC-2) are two branches of the same `if (contextUsage < threshold) { ... } else { ... }` conditional in the same source-file.
- The conditional + the predicate evaluation are unmodified by the cure-stack (byte-identity established in R-RC-1 bridge).
- R-RC-1's PROVEN-via-byte-identity-bridge therefore validates BOTH branches structurally at uncurse-tip.

**Why this is NOT a substitute for live at-SHA ACCEPT receipt**:
- Same constraint as R-RC-1: tool-registration regression at uncurse-tip blocks any direct fire from main-session.
- A pre-cure binary live ACCEPT receipt would strengthen the bridge — but no cohort seat captured one this cycle (would have required silas-seat to artificially-load context past 70% on pre-cure binary; cohort chose against artificial-load per substrate-purity canon).

**Verdict-shape**:
- R-RC-2 at uncurse-tip validated by: source-file byte-identity (single argument-axis) + R-RC-1's bridge-receipt cross-walk (REJECT-branch live-fire on pre-cure validates the conditional that ACCEPT-branch lives in).
- ⚠️ HONEST-LIMIT on live at-SHA fire: same constraint as R-RC-1 — blocked by the tool-registration regression.
