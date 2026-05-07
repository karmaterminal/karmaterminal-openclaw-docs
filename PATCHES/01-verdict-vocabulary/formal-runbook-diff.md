# Patch — Formal Runbook §6 verdict list → reference canonical vocabulary

**File:** `SWIM/FORMAL-SWIM-RUNBOOK.md`
**Section:** §6 line 158
**Pick up:** any prince with Formal Runbook ownership

## Before

```markdown
- verdict: PASS / FAIL / FINDING / DEFERRED / INVALIDATED
```

## After

```markdown
- verdict: per [`SWIM/VERDICT-VOCABULARY.md`](VERDICT-VOCABULARY.md) — canonical six states are `PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN / BLOCKED / DEFERRED`
```

## Reasoning

Formal Runbook §6 was the second of two co-canonical docs that disagreed with the Charter on whether `BLOCKED` is a verdict state (Formal Runbook omitted it; Charter included it). After this patch and `charter-diff.md`, both docs reference the same canonical six. Disagreement structurally impossible.

`FINDING` and `INVALIDATED` removed for the reasons documented in `PATCH-NOTES.md` and `SWIM-VERDICT-VOCABULARY.md`.

## Risks

Same risk profile as `charter-diff.md` — old verdict names may persist in muscle-memory and tooling. Same mitigation (row template carries canonical six in Verdict field).
