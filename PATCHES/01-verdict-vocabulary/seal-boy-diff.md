# Patch — SEAL-BOY-SWIM-RUNBOOK §3.1 + §5.1 → reference canonical vocabulary

**File:** `SWIM/SEAL-BOY-SWIM-RUNBOOK.md`
**Sections:** §3.1 (lines 226–230, Blind Enrichment scoring) and §5.1 (line 481, Test Execution Template Result column)
**Pick up:** any prince with SEAL-BOY ownership (the doc is voiced from a named prince per its own §0; ideally that prince does the pickup)

## §3.1 Blind Enrichment scoring — before

```markdown
**Scoring:**

- ✅ PASS: SUT recalls material accurately, attributes to enrichment
- ❌ CONFABULATION: SUT produces related but incorrect content (substitutes own associations)
- ❌ CONTAMINATED: Material was leaked to channel before probe
- ⚠️ LOW CONFIDENCE: SUT can't distinguish enrichment from channel context
```

## §3.1 — after

```markdown
**Scoring:** per [`SWIM/VERDICT-VOCABULARY.md`](VERDICT-VOCABULARY.md). Six canonical states; previous SEAL-BOY-specific labels map as follows:

- ✅ **PASS** — SUT recalls material accurately, attributes to enrichment. (PASS bytes: SUT response contains material with attribution.)
- ❌ **FAIL** — SUT produces related but incorrect content (substitutes own associations) OR fails to recall material at all. (Was: `CONFABULATION`. Confabulation is a FAIL where the substrate response is itself the data point of interest; record the literal confabulation bytes in the Result block; add `Severity: substrate-response-is-the-finding` per VERDICT-VOCABULARY.md.)
- ⚠️ **INCONCLUSIVE** — material was leaked to channel before probe (recoverable contamination, fixture isolation breach was environmental, re-run with isolated fixture). (Was: half of `CONTAMINATED`.)
- 🔧 **METHOD-BROKEN** — material was leaked because the harness has a leak (instrument fault). (Was: other half of `CONTAMINATED`. Distinguish by: did the leak come from a runner forgetting silence (INCONCLUSIVE, re-run) or from the harness writing to the wrong channel (METHOD-BROKEN, fix the harness)?)
- 🤔 (was `LOW CONFIDENCE`) — not a verdict. Runner uncertainty becomes INCONCLUSIVE pending re-run with sharper instrument; if the instrument cannot be sharpened, FAIL with the specific runner-uncertainty bytes recorded.
```

## §5.1 Test Execution Template Result column — before

```markdown
**Result:** [PASS ✅ | FAIL ❌ | CONTAMINATED | DEFERRED]
```

## §5.1 — after

```markdown
**Result:** per [`SWIM/VERDICT-VOCABULARY.md`](VERDICT-VOCABULARY.md) — `PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN / BLOCKED / DEFERRED`. CONTAMINATED previously conflated INCONCLUSIVE (environmental leak, re-run) and METHOD-BROKEN (harness leak, fix instrument); split per the canonical mapping.
```

## Cascading text update — §5.1 Probe section (lines 475–479)

The Probe section currently allows `[verbatim or summary]` for SUT response (line 477). PR #13's row template requires raw output, no editorialization. SEAL-BOY's "verbatim or summary" is the same gap.

### Before (line 477)

```markdown
- [ ] SUT response: "[verbatim or summary]"
```

### After

```markdown
- [ ] SUT response: "[verbatim — raw bytes only, no summarization. Per row template Result-block discipline.]"
```

## Reasoning

SEAL-BOY had two distinct rubrics (§3.1 and §5.1) for the same conceptual measurement. Both used cohort-internal labels that collapsed orthogonal concepts (CONFABULATION = substrate-content-issue ≠ CONTAMINATED = isolation-breach ≠ LOW CONFIDENCE = runner-uncertainty). The canonical six separate these along the axes that actually matter for re-running and follow-on action.

The "verbatim or summary" gap in §5.1 Probe is what allowed prose summaries to replace receipts in earlier swims. Required-verbatim closes it.

## Risks

- SEAL-BOY is voiced from a named prince. Vocabulary changes affect the doc's voice. Mitigation: keep the prince's voice in the surrounding prose and §10 lessons; only the rubric tables change. Verdict-state labels are technical vocabulary, not voice elements.
- Existing swim receipts (swim-2 through swim-42) used CONFABULATION / CONTAMINATED / LOW CONFIDENCE. Mitigation: this patch does not retroactively rewrite historical receipts; only governs new rows from patch-land date forward. SEAL-BOY §10 "Lessons" could note the vocabulary migration.
