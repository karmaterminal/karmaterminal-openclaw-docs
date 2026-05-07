# Patch — SWIM-COORDINATOR-NOTES Findings Tracker → separate tracker-states from verdict-states

**File:** `SWIM/SWIM-COORDINATOR-NOTES.md`
**Section:** Findings Tracker, line 60
**Pick up:** any prince with COORDINATOR-NOTES ownership

## Before

```markdown
Status values: `UNTESTED`, `VERIFIED`, `DISPROVED`, `NEW`, `TAINTED`, `CODE-FIX`
```

## After

```markdown
**Two columns, two distinct concepts:**

- **Tracker state** (lifecycle position): `UNTESTED`, `IN-PROGRESS`, `VERIFIED`, `DISPROVED`, `NEW`, `CODE-FIX`. Describes where the row sits in the swim's workflow — has it been picked up? authored? landed? merged?
- **Verdict** (substrate result, when the row has actually run): per [`SWIM/VERDICT-VOCABULARY.md`](VERDICT-VOCABULARY.md) — `PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN / BLOCKED / DEFERRED`. Describes what the substrate said when the test fired.

Previous COORDINATOR-NOTES conflated these into a single Status column with mixed members (`TAINTED` was a verdict; `UNTESTED` was a tracker state). Split per the canonical mapping. `TAINTED` removed (splits into INCONCLUSIVE or METHOD-BROKEN per cause).
```

## Cascading text update — Findings Tracker example table (lines 49–54)

The example table currently has a single Status column. Update to two columns.

### Before (representative table row)

```markdown
| R7-prompt-choice | branch docs | 7-L | — | UNTESTED |
```

### After

```markdown
| Row ID | Owner | Swim ref | Evidence | Tracker state | Verdict |
|---|---|---|---|---|---|
| R7-prompt-choice | branch docs | 7-L | — | UNTESTED | — |
| R7-hot-reload | Codex,Copilot | 7-A/B | journalctl @06:14 | VERIFIED | PASS |
| R7-width-narrow | convergence | 7-E | — | IN-PROGRESS | — |
```

(Verdict column shows `—` until the row actually runs and produces a Result block per row template.)

## Reasoning

COORDINATOR-NOTES was the worst case of vocabulary fragmentation — a single field carried six values that mixed lifecycle states (`UNTESTED`, `VERIFIED`, `NEW`) with verdict states (`TAINTED`) with non-states (`CODE-FIX`, which is a follow-on action class, not a verdict). The conflation made tracker queries impossible to answer cleanly: a query for "all rows that PASSED" would miss `VERIFIED` (which means "the lifecycle says verified" but says nothing about the substrate verdict); a query for "all rows that FAILED" would miss `DISPROVED` (which is a tracker conclusion derived from one or more FAIL verdicts).

Splitting tracker-state from verdict-state aligns with how every standard test-tracking system (JUnit XML, pytest fixtures with `@pytest.mark.skip`, GitHub Issues with labels) separates lifecycle from outcome. Each column can be queried, sorted, and reported independently.

## Risks

- COORDINATOR-NOTES is short (~219 lines) and the Findings Tracker table is a small fraction. Mechanical change.
- Existing tracker rows would need to be migrated — `UNTESTED` rows get verdict `—`; `VERIFIED` rows get verdict `PASS` (assumed; should be confirmed against actual swim receipts before this patch lands); `DISPROVED` rows get verdict `FAIL`; `NEW` rows get tracker-state `NEW` and verdict `—`; `TAINTED` rows need per-row review to determine INCONCLUSIVE vs METHOD-BROKEN (looking at the Result evidence). `CODE-FIX` is not a verdict; rows previously marked `CODE-FIX` should have their actual verdict re-derived from evidence and `CODE-FIX` recorded as a follow-on lane instead.
- Migration cost: ~30min per swim if there are many tracker entries. Lower priority than the docs that govern new rows (Charter, Formal Runbook, row template) which are all already patched.
