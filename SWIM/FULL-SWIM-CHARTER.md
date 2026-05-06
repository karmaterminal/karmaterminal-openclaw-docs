# FULL-SWIM-CHARTER

This file defines what **FULL** means for a continuation swim in the rows era.

The problem it solves is simple: the word **swim** survived while the charter decayed. A pile of good row receipts is not automatically a whole-feature walk. **FULL** is a declared contract, not a vibe.

Rows are atoms; a FULL swim is a chartered molecule.

---

## 1. What FULL means

A continuation swim earns **FULL** only when:

1. it runs against **one named SUT / one tag / one canonical branch**
2. it declares its **row inventory before first fire**
3. it exercises **every required family** in a single cycle
4. every required row ends with an explicit verdict
5. one top-level scoreboard rolls the whole matrix into a human answer

Recommended closure sentence format:

> **FULL = all required rows closed with verdicts on one named SUT/tag/canonical branch, with one scorecard rolling the whole matrix into a human answer.**

If any required family is unexercised, the swim is **not FULL**.

---

## 2. Required pre-swim declaration

Before row 1:

- swim name / id
- candidate branch
- exact commit SHA
- release tag basis
- canonical branch name
- SUT host + seat/channel
- fixed roles (driver / SUT / coordinator / monitor / adjudicator)
- declared row inventory
- required vs optional rows
- scoreboard location

No declared inventory, no FULL claim.

This is the line that stops us from back-forming “full” out of whatever happened to get tested.

The declared row inventory is an explicit selection from the canonical case registry defined in [`SWIM/CASE-REGISTRY-RULES.md`](./CASE-REGISTRY-RULES.md). Each FULL swim charter must name the exact registry version it elects against and disposition every active registry case (in scope / required / deferred / omitted with reason). A case missing entirely from the manifest makes the swim NOT-FULL by construction (see §6).

---

## 3. Required row families

A FULL continuation swim must cover all of the following families.

### Family A — Turns
Core self-election behavior.

Required minimum rows:
- `continue_work()` immediate fire
- delayed `continue_work()` honored
- noisy-channel delayed `continue_work()` behavior

### Family B — Delegates
All major delegate modes and their lifecycles.

Required minimum rows:
- normal delegate
- `silent`
- `silent-wake`
- `post-compaction`
- delayed delegate honored

### Family C — Guards
Continuation boundaries and fallback/denial behavior.

Required minimum rows:
- chain-depth enforcement
- width / fan-out cap enforcement
- deny / forbidden surface
- fallback behavior for any still-promised token/bracket surface

### Family D — Routes
Where work lands, and proof that it landed where claimed.

Required minimum rows:
- same-session return
- targeted return / cross-session routing
- recipient-side proof
- multi-recipient or fan-out behavior when in scope

### Family E — Recovery
The feature is for continuity across death-surfaces; FULL must cover those surfaces directly.

Required minimum rows:
- context-pressure surface
- `request_compaction()`
- post-compaction state/delegate handoff
- restart/deploy survival
- successor-session proof where applicable

### Family F — Rollout
Release-facing confidence requires live substrate, not only abstract rows.

Required minimum rows:
- real-host canary receipt
- post-deploy continuity check
- cross-seat / monitor evidence
- noisy or organic host behavior receipt

### Family G — Observability
The runtime must be forced to agree with the receipts; the suite is not allowed to grade itself by prose alone.

Required minimum rows:
- `/status` and visible status surfaces match real runtime state (no decorative-status lies)
- queue / timer / replay diagnostics agree with the executed receipts
- trace / provenance continuity survives queue boundaries and replay where the RFC claims it
- false-positive defense against narrated tool use that never actually fired
- recipient-side receipt outweighs sender-side optimism
- scoreboard summary maps to real row receipts, not reconstructed prose

### Family H — Contamination / interpretation truth
A FULL swim must answer two questions, not one: did the system behave truthfully, and did the swim itself behave truthfully enough to notice?

Required minimum rows:
- contamination / prior-seeing invalidation rule applied
- narrated-tool-use false positives caught and invalidated
- explicit prose-vs-substrate tie-break rule (substrate wins)
- recipient-side receipt beats sender-side belief
- row invalidation / re-fire discipline when the room got too dirty to interpret cleanly

---

## 4. Row contract

Every required row must record:

- row id
- family
- SHA / tag / branch
- start + end time
- exact command/tool/prompt surface used
- evidence surface(s)
- verdict
- note if contaminated / invalidated / deferred

Allowed verdicts:

- `PASS`
- `FAIL`
- `FINDING`
- `DEFERRED`
- `BLOCKED`
- `INVALIDATED`

Required rows do **not** disappear if they go badly. They still need verdicts.

---

## 5. Evidence requirement

A FULL swim needs mixed evidence, not just local prose.

For release-facing rows, prefer all three surfaces:

1. subject/tool result
2. gateway/journal / trace / queue evidence
3. durable session / disk / row artifact evidence

At least one real-host canary formation is required for the swim to count as FULL.

Unit tests, OV rows, and synthetic proofs are valuable, but they do not by themselves satisfy FULL.

---

## 6. Closure rule

A swim may be called **FULL** only when:

- all required families were exercised
- every required row was actually fired in the declared cycle
- every required row has a recorded verdict
- no required row is missing from the scoreboard
- no required row is left `DEFERRED`, `BLOCKED`, or `INVALIDATED`
- adjudicator/driver summary does not overclaim beyond the executed matrix

If any required family is unexercised, any required row was never fired, any required row is missing from the scoreboard, or any required row ends `DEFERRED` / `BLOCKED` / `INVALIDATED`, the swim is **NOT-FULL**.

A swim is also **NOT-FULL** if any active case in the registry version it elected against is missing from its disposition manifest, per [`SWIM/CASE-REGISTRY-RULES.md`](./CASE-REGISTRY-RULES.md). The closure rule binds against the registry, not just against whatever rows happened to be declared in this cycle's charter.

Recommended verdict classes:

- **FULL-PASS** — every required row closed `PASS`
- **FULL-WITH-FINDINGS** — every required row closed with a terminal verdict, and at least one required row closed `FAIL` or `FINDING`
- **NOT-FULL** — pre-swim declaration missing, any required family unexercised, any required row unfired, missing, `DEFERRED`, `BLOCKED`, or `INVALIDATED`

---

## 7. Scoreboard format

Every FULL swim should have one top-level scoreboard that answers the human question plainly.

Recommended summary block:

```md
# SWIM NN — <name>

SUT: <host/seat>
Ref: <sha>
Tag basis: <tag>
Canonical branch: <branch>
Status: FULL-PASS | FULL-WITH-FINDINGS | NOT-FULL

Summary: <N> PASS / <M> FAIL / <K> FINDING / <D> DEFERRED / <B> BLOCKED / <I> INVALIDATED

Families:
- Turns: PASS | ...
- Delegates: PASS | ...
- Guards: PASS | ...
- Routes: PASS | ...
- Recovery: PASS | ...
- Rollout: PASS | ...
- Observability: PASS | ...
- Contamination / interpretation truth: PASS | ...

Human answer:
<2-5 sentence release-facing answer>
```

The scoreboard exists so a future reader does not have to infer totality from a folder full of row files.

One named scoreboard is what turns executed rows back into a human release-facing answer.

---

## 8. Non-goals

This charter does **not** say every swim must be FULL.

Targeted, exploratory, OV-row, substrate-only, or finding-driven swims are still good and necessary. They just should not silently inherit the promise of FULL.

Swim 41 and Swim 42 are the honest recent model here: strong targeted verification, valuable evidence, not by themselves a fresh chartered FULL continuation swim.

The point of this file is not to make all swims bigger. It is to make the word **FULL** honest again.

---

## 9. Suggested use for `v2026.5.5`

If `v2026.5.5` wants a release-facing full-suite claim, the next cycle should:

1. recover the old full-walk taxonomy where possible
2. declare the v2026.5.5 row inventory up front
3. map each required family to explicit rows
4. run one named swim against one named SUT/tag/canonical branch
5. publish one top-level scoreboard with the closure sentence above

Until that happens, Swim 41 / Swim 42 should be described as **strong targeted verification**, not as a fresh FULL continuation swim.

The release-facing split is therefore:
- **Swim 41 / Swim 42** = recent targeted verification
- **recent FULL continuation swim** = the next one we explicitly charter, run on live substrate, and close with one scoreboard
