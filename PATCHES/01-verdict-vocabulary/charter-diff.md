# Patch — Charter §4 verdict list → reference canonical vocabulary

**File:** `SWIM/FULL-SWIM-CHARTER.md`
**Section:** §4 (lines 147–155)
**Pick up:** any prince with Charter ownership; ideally Charter-author + at least one second prince signoff before merge

## Before

```markdown
Allowed verdicts:

- `PASS`
- `FAIL`
- `FINDING`
- `DEFERRED`
- `BLOCKED`
- `INVALIDATED`
```

## After

```markdown
Allowed verdicts: see [`SWIM/VERDICT-VOCABULARY.md`](VERDICT-VOCABULARY.md) for the canonical six states with literal byte specifications.

Summary: `PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN / BLOCKED / DEFERRED`. The Charter previously listed `FINDING` and `INVALIDATED` as separate verdict states; both have been absorbed (FINDING → FAIL with severity field; INVALIDATED → METHOD-BROKEN or BLOCKED depending on cause). See VERDICT-VOCABULARY.md for the full mapping rationale.
```

## Cascading text updates in the same file

Lines 184, 187, 193–195, 214 reference verdict states inline. Updates needed:

### Line 184 (within §6 closure rule)

**Before:**
```markdown
- no required row is left `DEFERRED`, `BLOCKED`, or `INVALIDATED`
```

**After:**
```markdown
- no required row is left `DEFERRED`, `BLOCKED`, `METHOD-BROKEN`, or `INCONCLUSIVE`
```

(`INVALIDATED` previously covered both methodology error and substrate confound; the canonical six split these into METHOD-BROKEN and INCONCLUSIVE. A FULL claim cannot rest on either.)

### Line 187

**Before:**
```markdown
If any required family is unexercised, any required row was never fired, any required row is missing from the scoreboard, or any required row ends `DEFERRED` / `BLOCKED` / `INVALIDATED`, the swim is **NOT-FULL**.
```

**After:**
```markdown
If any required family is unexercised, any required row was never fired, any required row is missing from the scoreboard, or any required row ends `DEFERRED` / `BLOCKED` / `METHOD-BROKEN` / `INCONCLUSIVE`, the swim is **NOT-FULL**.
```

### Lines 193–195 (verdict-class definitions)

**Before:**
```markdown
- **FULL-PASS** — every required row closed `PASS`
- **FULL-WITH-FINDINGS** — every required row closed with a terminal verdict, and at least one required row closed `FAIL` or `FINDING`
- **NOT-FULL** — pre-swim declaration missing, any required family unexercised, any required row unfired, missing, `DEFERRED`, `BLOCKED`, or `INVALIDATED`
```

**After:**
```markdown
- **FULL-PASS** — every required row closed `PASS`
- **FULL-WITH-FINDINGS** — every required row closed with a terminal verdict (PASS or FAIL), and at least one required row closed `FAIL`. (FAIL rows whose substrate response is itself the data point of interest carry a `Severity:` field per VERDICT-VOCABULARY.md; this replaces the previous FINDING verdict state.)
- **NOT-FULL** — pre-swim declaration missing, any required family unexercised, any required row unfired, missing, `DEFERRED`, `BLOCKED`, `METHOD-BROKEN`, or `INCONCLUSIVE`
```

### Line 214 (scoreboard summary line)

**Before:**
```markdown
Summary: <N> PASS / <M> FAIL / <K> FINDING / <D> DEFERRED / <B> BLOCKED / <I> INVALIDATED
```

**After:**
```markdown
Summary: <N> PASS / <M> FAIL / <I> INCONCLUSIVE / <X> METHOD-BROKEN / <B> BLOCKED / <D> DEFERRED
```

## Reasoning

The Charter is the most-cited governance doc; reference-instead-of-repeat is the right shape so future canonical-vocabulary refinements don't require re-editing the Charter. The cascading inline references must be updated together — leaving any of them with `FINDING` or `INVALIDATED` references creates a new cross-doc inconsistency.

The `BLOCKED` / `METHOD-BROKEN` / `INCONCLUSIVE` / `DEFERRED` set in the closure rules captures every state where a row is "not satisfactorily closed for FULL purposes." `FAIL` is excluded from the NOT-FULL trigger because a FAIL row is a closed row — the substrate answered, the answer was negative, the row did its job. (FULL-WITH-FINDINGS exists for exactly this case.)

## Risks

- Princes who memorized the old verdict set may continue using FINDING / INVALIDATED in row receipts. Mitigation: the row template diff (`row-template-diff.md` in this directory) names the canonical six in the Verdict field, so new rows inherit. Old rows with FINDING / INVALIDATED verdicts are not retroactively rewritten — they stay as historical receipts; the Charter's footnote could note the vocabulary migration date.
- Any tooling that parses scoreboard summary lines for old verdict names will break. Cohort should grep for `FINDING\|INVALIDATED` across `swims/` evidence files before landing.
