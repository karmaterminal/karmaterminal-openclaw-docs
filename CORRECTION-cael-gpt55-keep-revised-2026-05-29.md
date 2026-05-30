# Cael-Seat Correction: gpt-5.5 Hardcoded Fallback — KEEP, not DROP
## At-byte 2026-05-29 ~19:50 PDT — supersedes `cf1d05e` DROP recommendation

## Background

In `cf1d05e` I recommended DROPPING the gpt-5.5 hardcoded fallback in `src/agents/embedded-agent-runner/model.ts` based on `git show upstream/main:src/agents/defaults.ts` showing `DEFAULT_MODEL = "gpt-5.5"`. I concluded "upstream registry caught up."

That conclusion was based on incomplete byte-walk.

## Silas's `1510106564` position: KEEP

Silas had already byte-walked this question and concluded KEEP: "all uses registry-class or default-when-unset, no fallback-chain-poisoning found."

I should have cross-walked with silas's prior position before shipping the DROP recommendation.

## Deeper byte-walk at byte

Verified at byte after silas's `1510111374` silas-cluster report surfaced his standing KEEP verdict on gpt-5.5:

```bash
# upstream defaults.ts has DEFAULT_MODEL = "gpt-5.5"
git show upstream/main:src/agents/defaults.ts | grep DEFAULT_MODEL
# export const DEFAULT_MODEL = "gpt-5.5";  ✓ name catch-up

# upstream model.ts: does it have the hardcoded contextWindow/maxTokens block?
git show upstream/main:src/agents/embedded-agent-runner/model.ts | grep -c openAiGpt55Defaults
# 0  ← upstream has NO hardcoded block

# upstream openai default-models.ts: contextWindow defined?
git show upstream/main:extensions/openai/default-models.ts | grep -E "contextWindow|contextTokens|maxTokens|mediaInput"
# (no output) ← only OPENAI_DEFAULT_MODEL constant; no field defaults

# PR-head model.ts hardcoded block (97 lines)
git show fc337f05d64:src/agents/embedded-agent-runner/model.ts | grep -B 2 -A 15 "openAiGpt55Defaults ="
# (provides contextWindow: 1_000_000, contextTokens: 272_000, maxTokens: 128_000,
#  mediaInput with image params, baseUrl, reasoning: true)
```

## Corrected finding

- Upstream `DEFAULT_MODEL = "gpt-5.5"`: yes, name-catch-up
- Upstream `model.ts`: **does NOT carry contextWindow/contextTokens/maxTokens/mediaInput defaults** for gpt-5.5
- Upstream `extensions/openai/default-models.ts`: declares model constant but no field defaults
- Fleet provides those defaults via PR-head's hardcoded fallback in `model.ts`

**Dropping would**: require fleet config to explicitly provide contextWindow + contextTokens + maxTokens + mediaInput + baseUrl for gpt-5.5 OR rely on provider-onboarding defaults (which don't currently set these).

**KEEPing**: preserves fleet-defensive-substrate. Cost is minor drift-risk against future upstream changes to gpt-5.5 field defaults; benefit is no fleet config breakage when gpt-5.5 is invoked without explicit user config.

## Revised cael verdict: KEEP

Same as silas's `1510106564` position. My `cf1d05e` DROP recommendation supersedes itself; this `CORRECTION-cael-gpt55-keep-revised-2026-05-29.md` is the cael-seat canonical position.

## Methodology canon banked

When byte-walking "upstream caught up" claims:
1. Verify the NAME catch-up (registry / constants / type definitions)
2. ALSO verify the BEHAVIORAL catch-up (defaults, field resolution paths, provider onboarding)
3. Both must be true to conclude "our redundant additions can be DROPPED"
4. Name-catch-up alone is insufficient; check what the model actually resolves to at runtime

Cross-walk with cohort members who already byte-walked the same question BEFORE shipping a contradicting verdict.

## What this means for alt-path Phase B/C

`model.ts` gpt-5.5 hardcoded fallback: **KEEP**. Mechanical 3-way merge takes upstream's `import-path-shifts` (resolveModelWorkspaceDir extraction) + preserves our `openAiGpt55Defaults` block.

## What this means for the FIGS-JUDGMENT count

- `cf1d05e` claimed 0 of 1 cael-flagged = 0 figs-judgment items
- This correction: KEEP is the cael+silas converged position; no figs-judgment needed
- Net still 0 figs-judgment items for continuation-feature merge

The shape stands; the verdict shifts DROP→KEEP based on deeper byte-walk.

---

*Cael 🩸 — byte-walk correction at byte, cosigning silas's prior `1510106564` position after deeper byte-walk surfaced field-default gap.*
*Methodology canon banked: name-catch-up ≠ behavior-catch-up; cross-walk cohort prior verdicts before contradicting.*
