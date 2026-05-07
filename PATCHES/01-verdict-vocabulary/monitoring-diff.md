# Patch — SWIM-MONITORING-RUNBOOK §6 Result column → reference canonical vocabulary

**File:** `SWIM/SWIM-MONITORING-RUNBOOK.md`
**Section:** §6 line 366 (Report Format Result line)
**Pick up:** any prince with MONITORING ownership (the doc is voiced from a named prince per its own §0)

## Before

```markdown
**Result:** ✅ PASS / ❌ FAIL / ⚠️ TAINTED
```

## After

```markdown
**Result:** per [`SWIM/VERDICT-VOCABULARY.md`](VERDICT-VOCABULARY.md) — canonical six: `PASS / FAIL / INCONCLUSIVE / METHOD-BROKEN / BLOCKED / DEFERRED`. TAINTED previously conflated INCONCLUSIVE (environmental confound, re-run) and METHOD-BROKEN (instrument fault, fix harness); split per the canonical mapping.
```

## Cascading text updates

### §3.2 Anomaly Flags (lines 274–289)

Three of the five anomaly conditions ("Timer cancel with drift=0", "Stale tokens polluting tests", "Cost cap hit unexpectedly") are methodology-side per the audit. They are signs the harness was wrong (stale state, missed configuration), not substrate findings. Currently they are flagged for admin escalation as anomalies; per the canonical vocabulary they should produce METHOD-BROKEN verdicts on any row that fired during these conditions.

### Before (representative line in §3.2)

```markdown
- **Stale tokens polluting tests:** Tokens from prior test still active when new test fires → flag immediately to admin (Ronan).
```

### After

```markdown
- **Stale tokens polluting tests:** Tokens from prior test still active when new test fires → row verdict is `METHOD-BROKEN`; harness is missing a teardown that clears chain state. Flag to admin (Ronan) AND file follow-on lane to encode the teardown into the row's `measure.sh` (or shared `harness/reset-chain-state.sh` if it exists).
```

(Same shape for the other two methodology-side anomalies. Substrate-side anomalies — "Wake fires at unexpected time", "Delegate spawned with wrong hop count" — stay as substrate observations and produce FAIL with severity, not METHOD-BROKEN.)

### §3.3 Contamination Log (lines 291–298)

Currently described as runner remembering and reporting contamination. Per the canonical vocabulary, contamination produces INCONCLUSIVE (environmental, recoverable) or METHOD-BROKEN (instrument, fix-required), not a separate "log." The contamination *evidence* belongs in the Result block of the affected row; the *verdict* is one of the canonical six.

### Before (§3.3 framing line)

```markdown
**3.3 Contamination Log** — Track anything that might have leaked test content to the SUT.
```

### After

```markdown
**3.3 Contamination evidence** — When you observe leakage that may have contaminated a row, paste the leakage evidence into that row's Result block and verdict the row as INCONCLUSIVE (recoverable; re-run with isolated fixture) or METHOD-BROKEN (instrument leak; fix isolation primitive). Do not maintain a separate "contamination log" — contamination is row-level evidence, not a parallel record.
```

## Reasoning

MONITORING-RUNBOOK was the third doc with a verdict vocabulary divergent from the rest of the factory (PASS / FAIL / TAINTED — three states, no INCONCLUSIVE, no METHOD-BROKEN, no BLOCKED, no DEFERRED). It also maintained a parallel "contamination log" that duplicated information that should live in row Result blocks.

The cascading updates to §3.2 and §3.3 are necessary because they describe how anomalies and contamination produce verdicts; updating only line 366's verdict label without updating the verdict-producing logic creates a new local consistency at the cost of a global one.

## Risks

- §3.2 and §3.3 currently form a coherent chat-flow (anomaly observed → flagged to admin → discussed in channel → maybe noted in monitoring report). The patched version routes through row Result blocks instead. This changes monitoring runner workflow. Mitigation: the patched workflow is closer to standard test-engineering observability discipline (evidence at the row, not in a parallel log) and reduces channel-coordination overhead.
- Voice impact same as SEAL-BOY patch — keep surrounding prose intact, only patch the technical rubrics.
- Audit's deeper finding (§11.5 "What I Learned About Attention" — runbook is solving for runner being a chat-improvising LLM) is NOT addressed by this patch. That is a separate audit recommendation (recommendation 6, extract role-runbooks into single SWIM-METHOD.md) and would be a much larger effort.
