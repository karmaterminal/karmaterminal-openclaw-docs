# SWIM Verdict Vocabulary

_Canonical row-verdict state set for the SWIM/ factory. Six states, each defined by literal substrate bytes. Propagated to every doc that mentions verdicts._

## Context

Before this doc existed, the factory carried seven distinct verdict vocabularies across six docs (see `PATCHES/01-verdict-vocabulary/PATCH-NOTES.md` for the table). Two co-canonical docs (Charter + Formal Runbook) disagreed with each other on whether `BLOCKED` was a state. None of the docs *defined* the verdict states; they listed them. This file is the single source of truth.

## The six canonical verdict states

### `PASS`

**Meaning:** The gather (per row template field 3) ran cleanly, the substrate produced output within the measurement window, and the Result block contains the literal PASS bytes specified in row template field 2.

**Bytes specification:** Result block contains the literal PASS string(s) named in field 2 (e.g. `WORK timer fired for session <session-id>` for delayed `continue_work` rows). All PASS strings present, no FAIL strings present.

**Required fields when verdict=PASS:**
- Result block populated with raw output (no editorialization)
- Verdict line: `Verdict: PASS — <one-sentence reason citing the literal bytes>`

**Example:**
```
Verdict: PASS — `WORK timer fired` literal-string present in window at 06:16:46 PDT (T0+120s).
```

### `FAIL`

**Meaning:** The gather ran cleanly, the substrate produced output within the measurement window, and the Result block contains the literal FAIL bytes specified in row template field 2 (or the absence of PASS bytes, after a raw re-read confirmed the substrate vocabulary matches expectation).

**Bytes specification:** Result block contains FAIL strings (if field 2 specified them) OR contains substrate output but no PASS strings AND the raw re-read step confirmed the harness vocabulary is correct (i.e. this is not METHOD-BROKEN in disguise).

**Required fields when verdict=FAIL:**
- Result block populated with raw output
- Verdict line: `Verdict: FAIL — <one-sentence reason citing the literal bytes>`
- If the substrate response is itself the data point of interest (what the Charter previously called `FINDING`), add a `Severity:` line and a one-paragraph `Finding-context:` block. The verdict stays FAIL.

**Example (plain FAIL):**
```
Verdict: FAIL — `WORK timer fired` literal-string absent from window after raw re-read confirmed substrate is using `[continuation:wake]` vocabulary as expected. Substrate did not fire wake.
```

**Example (FAIL with finding):**
```
Verdict: FAIL
Severity: substrate-response-is-the-finding
Finding-context: Substrate fired wake at T+148s instead of T+120s ± 30s. The 28s drift past tolerance is the data point. Filed follow-on lane #N for scheduler-tolerance investigation.
```

### `INCONCLUSIVE`

**Meaning:** The substrate question cannot be answered from this run because of an environmental confound. The harness was correct; the substrate was running; the run was contaminated by something neither side controls (gateway restart mid-window, network partition, host clock skew, stale chain tokens, parallel test traffic).

**Bytes specification:** Result block populated with raw output; the output contains evidence of the confound (e.g. `event-loop-lag armed` followed by new node PID inside the measurement window, indicating gateway restart). Verdict line names the confound and the re-run plan.

**Required fields when verdict=INCONCLUSIVE:**
- Result block populated with raw output
- Verdict line: `Verdict: INCONCLUSIVE — <confound named>; re-run on <stable conditions>`
- Re-run scheduled or row marked DEFERRED for next cycle

**Example:**
```
Verdict: INCONCLUSIVE — gateway restart at 06:11:46 PDT (new node PID 1454882) inside measurement window 06:08:30–06:13:30 PDT. Wake-event delivery cannot be byte-decided when process turned over mid-window. Re-run on stable gateway after next deploy quiesces.
```

### `METHOD-BROKEN`

**Meaning:** The gather harness itself is wrong. Vocabulary mismatch with substrate, missing log-scope, stale grep pattern, incorrect timing window, harness assumes a substrate primitive that doesn't exist. Do NOT interpret the gather output as a substrate finding. Fix the harness and re-run.

**Bytes specification:** Result block populated with raw output (so the next runner can see what the harness *did* return); raw re-read step in the truth-floor reach (per row template) returned different bytes than the canonical gather expected; verdict names the specific harness defect.

**Required fields when verdict=METHOD-BROKEN:**
- Result block populated with both the canonical gather output AND the raw re-read output
- Verdict line: `Verdict: METHOD-BROKEN — <specific harness defect>; fixing <file path> and re-running`
- Follow-on commit/PR fixing the harness

**Example:**
```
Verdict: METHOD-BROKEN — gather grepped for `continuation:wake` literal but substrate emits `WORK timer fired`. Vocabulary inheritance from prior cycle never verified against raw bytes. Fixing `swims/swim-43/row-03/measure.sh` to drop grep filter and read raw journal; re-running.
```

This is the verdict state that prevents the swim-43 row-03 incident-class from re-firing. When the gather returns 0 results, METHOD-BROKEN is the default reach, not interpretation-of-0-as-substrate-finding.

### `BLOCKED`

**Meaning:** The pre-conditions for the row could not be established. The test never started. Distinct from INCONCLUSIVE because there was no run to inconclude — the row failed at setup.

**Bytes specification:** Result block contains the setup-failure output (deploy command failed with exit code N, dependency unavailable with literal error, fixture script errored at line X). Verdict names the blocker and what would unblock.

**Required fields when verdict=BLOCKED:**
- Result block populated with setup-failure output
- Verdict line: `Verdict: BLOCKED — <blocker named>; unblocked by <prerequisite>`
- Pre-condition explicitly noted in the row's "Surface under test" or status ladder for re-run

**Example:**
```
Verdict: BLOCKED — gateway deploy failed on cael-host (`systemctl start openclaw-gateway` exit 1, `Address already in use` on port 18789). Unblocked by stopping orphan gateway process and re-deploying. Row re-runs after deploy succeeds.
```

### `DEFERRED`

**Meaning:** The row is consciously not run this cycle. Counts toward NOT-FULL per Charter §6 (the swim does not claim FULL coverage). Distinct from BLOCKED because the cohort *chose* not to run, not because something prevented running.

**Bytes specification:** Result block contains the deferral reason (out of scope for this swim's claim, dependency on uncompleted work, time budget exhausted). Verdict names the deferral reason and when the row is expected to run.

**Required fields when verdict=DEFERRED:**
- Result block populated with deferral reason (no command output required since nothing ran)
- Verdict line: `Verdict: DEFERRED — <reason>; expected to run <when>`
- Tracker anchor updated to reflect deferral

**Example:**
```
Verdict: DEFERRED — row depends on harness primitive `harness/wait-for-cluster-quiescence.sh` which doesn't exist yet. Expected to run swim-44 after harness lands.
```

## States explicitly NOT in the canonical set

The following appeared in pre-canonical-vocabulary docs and are absorbed by the six canonical states. See `PATCHES/01-verdict-vocabulary/PATCH-NOTES.md` for the full mapping rationale.

- `FINDING` → FAIL with severity field
- `INVALIDATED` → METHOD-BROKEN or BLOCKED (depending on cause)
- `TAINTED` → INCONCLUSIVE or METHOD-BROKEN (depending on cause)
- `CONFABULATION` → FAIL (the confabulation bytes go in Result)
- `LOW CONFIDENCE` → INCONCLUSIVE (re-run with sharper instrument)
- `CONTAMINATED` → INCONCLUSIVE or METHOD-BROKEN (depending on cause)
- `UNTESTED / VERIFIED / DISPROVED / NEW / CODE-FIX` → tracker-states, not verdict-states; they describe lifecycle position not substrate output

## What the verdict state is and is not

The verdict state is what the row says about the substrate.

It is **not**:
- What the runner felt about the run
- Where the row sits in the tracker lifecycle
- The failure-mode taxonomy (failure modes belong in the Result block bytes)
- A confidence tier
- A composite of multiple measurements (one verdict per Result block; one Result block per host / re-run)

When in doubt about which state applies, the order of investigation is:
1. Was the harness correct? If no → METHOD-BROKEN.
2. Did the test even start? If no → BLOCKED.
3. Did environmental confounds prevent a clean answer? If yes → INCONCLUSIVE.
4. Did the cohort choose not to run? If yes → DEFERRED.
5. Did the substrate produce the literal PASS bytes? If yes → PASS.
6. Did the substrate produce literal FAIL bytes (or absence of PASS bytes after raw re-read)? If yes → FAIL.

## Required by

- `SWIM/templates/row-issue-template.md` Verdict field
- `SWIM/FULL-SWIM-CHARTER.md` §4 row contract
- `SWIM/FORMAL-SWIM-RUNBOOK.md` §6 evidence contract
- `SWIM/SEAL-BOY-SWIM-RUNBOOK.md` §3.1 + §5.1
- `SWIM/SWIM-MONITORING-RUNBOOK.md` §6
- `SWIM/SWIM-COORDINATOR-NOTES.md` Findings Tracker
- `SWIM/PR-UPDATE-VALIDATION-WALKTHROUGH.md` §1.5

If a doc mentions a verdict state not in the canonical six, that doc is out of date and needs a patch.
