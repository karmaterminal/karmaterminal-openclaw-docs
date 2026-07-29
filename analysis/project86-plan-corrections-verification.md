# Project 86 issue-plan mechanical corrections — verification report

Machine-verified application of the fold-review verdict
`READY_AFTER_MECHANICAL_FIXES` to the Project 86 proof issue plan.

**No GitHub issue was created. Project 86 was not mutated. No proof row was
fired. No candidate SHA was bound.**

---

## 1. Binding

| Item | Value |
|---|---|
| Umbrella issue | `karmaterminal/karmaterminal-openclaw-docs#451` |
| Project | `karmaterminal` project 86 |
| Base / review commit | `6b97d681de2e4f23e650d3c36ea18408fc95467f` |
| Working branch | `codeagent/project86-plan-corrections` |
| Review verdict consumed | `READY_AFTER_MECHANICAL_FIXES` |

### Reviewed inputs (asserted by the transformer, not assumed)

| Input | SHA |
|---|---|
| docs base | `abe1f9f0749d849b01da4e5d354c205ecffac946` |
| catalog | `366251db79004274f4213e1cb59908aa27ef6693` |
| contract | `bb4ad4367e67190cba3f0909d58c36c259bf6a3d` |
| breadcrumbs | `14355117ec7efb111cb013826c441e62a29954ce` |

---

## 2. Exact SHA-256

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| **Input** issue plan `frond-scribe.project86.issue-plan.v1` | 264183 | `af607246e60ad23ecd691275463dd5691fb8a107877a84553d1b5f8488604220` |
| **Input** review report `analysis/project86-fold-readiness.json` | 159995 | `fe3a082c676d0c7f7c3ae49e8880ee8c2680c8caebffa81687542e444140fb76` |
| **Output** `analysis/project86-proof-issue-plan.corrected.json` | 471126 | `76b75c13b68397f58335ee714c6aebc7c200b6bde1faefd2ebffa345720cb7c7` |
| **Transformer** `analysis/apply-project86-plan-corrections.mjs` | 36990 | `34d0e5dd2a86f882823792cde65a5b77e356cac33d0dd39300395ce4e19a8960` |

Both inputs are SHA-256 **pinned inside the transformer**. Either one drifting
is a hard failure, not a warning.

### Reproduce

```bash
node analysis/apply-project86-plan-corrections.mjs \
  --plan <path-to>/project86-proof-issue-plan.json \
  --report analysis/project86-fold-readiness.json \
  --out analysis/project86-proof-issue-plan.corrected.json
sha256sum analysis/project86-proof-issue-plan.corrected.json
# 76b75c13b68397f58335ee714c6aebc7c200b6bde1faefd2ebffa345720cb7c7
```

### Determinism / idempotence

Two consecutive runs from the pinned input produced **byte-identical** output:

```
76b75c13b68397f58335ee714c6aebc7c200b6bde1faefd2ebffa345720cb7c7  run-1
76b75c13b68397f58335ee714c6aebc7c200b6bde1faefd2ebffa345720cb7c7  run-2
cmp run-1 run-2  ->  identical
```

The output carries no timestamp, no hostname, no run counter and no
nondeterministic ordering; every collection is emitted in input row order.

---

## 3. Per-correction application counts

Correction payloads are **read from the reviewed report**, not re-transcribed,
so "applied exactly as reviewed" is mechanically true rather than asserted.
Applied in strict numeric order MC-01 → MC-16 (report pre-create checklist
item 3). MC-03 **must** precede MC-04 because MC-04 introduces a second
` ```bash ` fence; the transformer asserts exactly one fence at MC-03 time.

| MC | kind | sites applied | rows touched | expected | result |
|---|---|---:|---:|---|---|
| MC-01 | `replace_in_body` | 23 | 23 | 23 live-runner rows | ✅ |
| MC-02 | `replace_in_body` | 23 | 23 | 23 live-runner rows | ✅ |
| MC-03 | `insert_in_command_fence` | 18 | 18 | 18 gateway-serialized rows | ✅ |
| MC-04 | `insert_section` | 38 | 38 | all 38 | ✅ |
| MC-05 | `replace_in_body` | 6 | 3 | 3 body + 3 `artifact_subtree` | ✅ |
| MC-06 | `append_after_line` | 3 | 3 | 3 support entries | ✅ |
| MC-07 | `replace_in_body` | 1 | 1 | `R-RC-2` | ✅ |
| MC-08 | `append_after_line` | 1 | 1 | `R-RC-1` | ✅ |
| MC-09 | `replace_in_body` | 2 | 2 | `R-CW-5`, `R-CW-6` | ✅ |
| MC-10 | `replace_in_body` | 38 | 38 | all 38 | ✅ |
| MC-11 | `append_after_line` | 38 | 38 | all 38 | ✅ |
| MC-12 | `insert_section` | 38 | 38 | all 38 | ✅ |
| MC-13 | `replace_title` | 38 | 38 | all 38 | ✅ |
| MC-14 | `append_section` | 38 | 38 | all 38 | ✅ |
| MC-15 | `append_after_line` | 1 | 1 | `R-OBS-1` | ✅ |
| MC-16 | `replace_in_body` | 1 | 1 | `R-CD-3` | ✅ |
| **MC-17** | `global_substitution` | **0** | **0** | **not applied** | ⏸ **DEFERRED** |

Total sites applied: **307** across 38 rows.

### Anchor uniqueness verified before any edit

Every reviewed anchor resolved uniquely in the input plan:

| Anchor | Occurrences |
|---|---|
| `## Run the committed automation first` | exactly 1 in each of 38 bodies |
| `## Failure routing and landing` | exactly 1 in each of 38 bodies |
| `## Verdict contract` | exactly 1 in each of 38 bodies |
| `Row-owned destination:` | exactly 1 in each of 38 bodies |
| `Same-session concurrency safe:` | exactly 1 in each of 38 bodies |
| `- Live assignment: none; claim this issue before running.` | exactly 1 in each of 38 bodies |
| ` ```bash ` | exactly 1 in each of 38 bodies (pre-MC-04) |
| MC-01 / MC-02 `find` | exactly 1 in each of the 23 targets, **zero leakage** into the other 15 |
| MC-13 `find` (title) | 38/38 exact string equality |
| MC-10 `find` | 38/38 exactly one occurrence |

MC-09's `find` string is **shared with 17 gateway rows**. The transformer scopes
it strictly by `applies_to`, so only `R-CW-5` and `R-CW-6` were rewritten and the
17 gateway rows kept the session-lock wording they legitimately need.

### Three deviations, recorded rather than silent

1. **MC-05 also rewrites `rows[].artifact_subtree`.** The correction's `kind`
   is `replace_in_body`, but its title ("Retarget support/companion artifact
   subtrees") and the report's own check `C08` are about the `artifact_subtree`
   field. Applying it to the body alone would leave the machine-readable field
   pointing at a bare corpus row dir. Both fields were rewritten; the counts are
   reported separately (3 body + 3 subtree).
2. **MC-14 body-terminator normalisation.** Input bodies carry no trailing
   newline, while every reviewed insert text begins with `\n` on the assumption
   that it follows a `\n`-terminated line. All 38 bodies were normalised to end
   with exactly one `\n` before MC-14's section was appended, so the appended
   `## Wave` heading starts on its own line. No reviewed byte was altered.
3. **MC-14 support-entry trim.** Per the reviewed note, `preflight`, `R-CW-5A`
   and `R-CW-6A` drop the two corpus-fold-only checklist lines
   (`validate-corpus.mjs --sha …`, `Scribe folded the row …`): 20 items on the
   35 corpus rows, 18 on the 3 support entries.

Reviewed placeholders that are **intentionally left literal** (they are per-seat
or per-row runtime values resolved by the prince, not by this transformer):
`<FINAL_CANDIDATE_SHA>`, `<SEAT>`, `<SESSION_KEY>`, `<PRINCE>`, `<ROW-ID>`,
`<row>`, `<FEATURE_SOURCE_PATH>`, `<FEATURE_MARKER>`,
`<EXACT_CANDIDATE_WORKTREE>`, `<EMPTY_PRIVATE_ARTIFACT_DIR>`.

---

## 4. Pre-create assertions (all runnable before candidate freeze)

Executed independently of the transformer against the committed output, the
committed review report, the original input plan, and the reviewed catalog
fetched at `366251db79004274f4213e1cb59908aa27ef6693`.

**Result: 61 assertions, 61 PASS, 0 FAIL.**

### 4.1 Set identity against the catalog

| ID | Assertion | Result |
|---|---|---|
| A1a | 38 rows, 38 unique `row_id` | PASS |
| A1b | `row_id` set identical to catalog `@366251db` (38 entries, both directions) | PASS |
| A1c | Row order and membership preserved from the input plan | PASS |

### 4.2 Denominator: 35 corpus rows + 3 named support entries

| ID | Assertion | Result |
|---|---|---|
| A2a | Catalog declares exactly 35 `reference_required` corpus rows | PASS |
| A2b | Exactly 3 non-corpus support entries: `preflight`, `R-CW-5A`, `R-CW-6A` | PASS |
| A2c | No support entry is a catalog corpus row | PASS |
| A2d | 35 exact-SHA corpus rows remain | PASS |
| A13a | `corrections.denominator` = 38 dispatched = 35 corpus + `preflight` + `R-CW-5A` + `R-CW-6A` | PASS |
| A13b | Denominator statement byte-identical to the reviewed report | PASS |
| A13c | Language names 35 and the three support entries; never publishes 36/34/38 as the denominator | PASS |

### 4.3 Candidate not frozen (MC-17 deferred)

| ID | Assertion | Result |
|---|---|---|
| A3a | `candidate_sha === null` | PASS |
| A3b | `<FINAL_CANDIDATE_SHA>` preserved: 363 body + 38 `artifact_subtree` + 0 title = **401** sites | PASS |
| A3c | No unreviewed 40-hex SHA anywhere in any title/body/subtree | PASS |
| A3d | `corrections.deferred["MC-17"].status === "DEFERRED"` | PASS |
| A3e | `corrections.applied` is exactly `MC-01 … MC-16` | PASS |

### 4.4 Forbidden strings eliminated

| ID | Assertion | Input | Output | Result |
|---|---|---:|---:|---|
| A4 | Bodies containing `OPENCLAW_RUNTIME_BUILD_SHA=` | 23 | **0** | PASS |
| A5 | Bodies containing `Live assignment: none` | 38 | **0** | PASS |

### 4.5 One accountable prince, substitution note, assignment/rebalance

| ID | Assertion | Result |
|---|---|---|
| A6a | All 38 bodies name exactly one `Accountable prince:` | PASS |
| A6b | `rows[].assignee` equals the body prince on all 38 | PASS |
| A6c | Reviewed substitution note present on all 38 | PASS |
| A6d | 6 rebalance moves, set-identical to `assignment.rebalance_moves` | PASS |
| A6e | Distribution equals reviewed recommendation: scribe 1, silas 4, cael 8, ronan 7, emeric 8, elliott 7, rune 3 | PASS |
| A6f | Only the 6 reviewed rows changed assignee (`R-CW-2`, `R-CW-3`, `R-CW-4`, `R-CW-5A`, `R-CW-6A`, `R-CW-DELEGATE-SELF-CONTINUATION`) | PASS |

### 4.6 Universal body content

| ID | Assertion (all 38 bodies) | Result |
|---|---|---|
| A7a–A7d, A7k | G1–G5 pre-fire gate: `## Pre-fire identity gate`, `G1 ok`, G2/G3/G4 steps, `seat-readiness-preflight.mjs`, G5 docs-authority freeze | PASS |
| A7e | `**Both-forms mandate:**` | PASS |
| A7f | `project86-proof-code-breadcrumbs` (breadcrumbs) | PASS |
| A7g | `project86-regression-triage-template` (regression triage) | PASS |
| A7h | `project86-proof-round-contract` (governing contract) | PASS |
| A7i–A7j | `## Wave` and `## Completion checklist` | PASS |

### 4.7 Serialization

| ID | Assertion | Result |
|---|---|---|
| A8a | All 18 gateway-serialized rows carry `live-run-guard.mjs` | PASS |
| A8b | All 18 carry the fail-closed clause `If the guard reports an active same-session lock: STOP.` | PASS |
| A8c | Exactly 18 bodies reference `live-run-guard.mjs` — no over-application | PASS |
| A8d | `R-RC-2` no longer says `Same-session concurrency safe: **true**`; carries `false (contract override, fail-closed)` | PASS |
| A8e | `R-RC-2` states procedural serialization **and** the fixed `R-RC-1 → R-RC-2` ordering | PASS |
| A8f | `R-RC-1` carries the reciprocal family-ordering obligation | PASS |
| A9 | `R-CW-5` / `R-CW-6` serialize **fixture resources** (one invocation per seat, `0700` private artifact dir, tracked-clean worktree), claim no gateway-session lock, and no longer carry the unactionable runner-lock sentence | PASS |

### 4.8 Non-corpus support entries

| ID | Assertion | Result |
|---|---|---|
| A10-preflight | `PROOFS/<FINAL_CANDIDATE_SHA>/gates/preflight/<SEAT>/` + "Not a corpus row" + "NOT a member of the 35-row exact-SHA denominator" + "MUST NOT change `INDEX.json::rollup`" | PASS |
| A10-R-CW-5A | `PROOFS/<FINAL_CANDIDATE_SHA>/_static-companions/R-CW-5A/<SEAT>/` + same three clauses | PASS |
| A10-R-CW-6A | `PROOFS/<FINAL_CANDIDATE_SHA>/_static-companions/R-CW-6A/<SEAT>/` + same three clauses | PASS |
| A10d | All 35 corpus rows keep their bare `PROOFS/<SHA>/<ROW-ID>/<SEAT>/` destination | PASS |
| A10e | All 38 artifact subtrees are disjoint | PASS |

Both retargets land in namespaces `validate-corpus.mjs no-orphan-row-dirs`
tolerates (`gates/`, `_`-prefixed), so folding cannot force `total_rows` to 38.

### 4.9 No row-local failure halts the fleet

| ID | Assertion | Result |
|---|---|---|
| A11a | `failure_scope.blocks_all_proofs === false` on all 38 | PASS |
| A11b | "Continue independent proof rows unless the finding is explicitly classified as a halt-state." on all 38 | PASS |
| A11c | No body authorises a fleet-wide halt (`halt the fleet` / `stop all rows across` / equivalents) | PASS |

### 4.10 HONEST_LIMIT scope

| ID | Assertion | Result |
|---|---|---|
| A12 | `HONEST_LIMIT` permitted on exactly one row, and that row is `R-RC-2`; the other 37 read `Not permitted for this row.` | PASS |

### 4.11 Schema and shape

| ID | Assertion | Result |
|---|---|---|
| A14a | `schema === "frond-scribe.project86.issue-plan.v1"` | PASS |
| A14b | `umbrella_issue` and `project` preserved | PASS |
| A14c | Every row keeps the exact v1 key set and order (`row_id, assignee, title, body, execution_class, artifact_subtree, failure_scope`) | PASS |
| A14d | `execution_class` untouched on all 38 | PASS |
| A14e | `failure_scope` untouched on all 38 | PASS |
| A14f | All 38 titles in `[P86] <ROW-ID> — <behavior> (<seat>)` form | PASS |
| A14g | All 38 titles end with the executing seat | PASS |

One additive top-level key, `corrections`, records provenance, the per-correction
ledger, the rebalance moves, the denominator statement and the MC-17 deferral.
`rows[]` retains the exact v1 shape.

### 4.12 Secret scan

| ID | Assertion | Result |
|---|---|---|
| A15a | Secret-shape scan (webhook URL, GitHub/Slack token, private key, AWS key, JWT, env var bound to a literal value, private home path) across 38 rows × 3 fields | **0 hits** |
| A15b | No body ever assigns `OPENCLAW_GATEWAY_TOKEN` | PASS |
| A15c | `OPENCLAW_SESSION_KEY` only ever bound to `<SESSION_KEY>` or `"$CANDIDATE_SHA"`-style placeholders | PASS |
| A15d | Neither tracked output contains the value of `WEBHOOK_SCRIBE_NOTIFY` (checked by in-process `String.includes`, never printed) | PASS |
| A15e | Tracked transformer + corrected plan scanned with the same pattern set | **0 hits** |

The transformer itself refuses to emit a plan that trips these patterns, so the
scan is enforced at generation time, not only after the fact.

### 4.13 Fail-closed behaviour (negative tests)

| Test | Scenario | Expected | Actual |
|---|---|---|---|
| N1 | Already-corrected output fed back as `--plan` | refuse | `FAIL-CLOSED: input plan: SHA-256 pin mismatch` — exit **2** |
| N2 | Tampered review report (`MC-01.find` altered) | refuse | `FAIL-CLOSED: review report: SHA-256 pin mismatch` — exit **2** |
| N3 | One MC-01 anchor deleted from the plan, pins relaxed on a throwaway copy so the anchor layer is reached | refuse | `FAIL-CLOSED: MC-01/R-CD-1: anchor absent` — exit **2** |

The transformer additionally fails closed on: wrong plan/report schema, a
verdict other than `READY_AFTER_MECHANICAL_FIXES`, a non-null input
`candidate_sha`, row count ≠ 38, duplicate `row_id`, plan/catalog set mismatch,
corpus ≠ 35 or support ≠ 3, any correction whose `kind` or `applies_to` length
drifted, any per-row spec missing, any site count that misses its expected
total, an unreviewed rebalance move, an unreviewed 40-hex SHA appearing anywhere,
elimination of `<FINAL_CANDIDATE_SHA>`, and every post-condition in §4.4–§4.12.

---

## 5. Deferred candidate-dependent checks

`MC-17` is **not applied**. `candidate_sha` remains `null` and all 401
`<FINAL_CANDIDATE_SHA>` sites remain literal, awaiting one atomic substitution
once the final assembly candidate is frozen. Everything below is deferred
**because it cannot be evaluated before that freeze** — none of it is skipped
work.

### 5.1 The substitution itself

- **D1** Freeze the candidate; record it on issue #451.
- **D2** Assert `[[ "$SHA" =~ ^[0-9a-f]{40}$ ]]` (report pre-create item 1).
- **D3** Set `plan.candidate_sha` to the frozen SHA.
- **D4** Byte-substitute the literal `<FINAL_CANDIDATE_SHA>` → `$SHA` across
  `rows[].body`, `rows[].title`, `rows[].artifact_subtree`.
- **D5** Assert **zero** residual `<FINAL_CANDIDATE_SHA>`.
- **D6** Assert the substituted-site count.
  > **Corrected target: 401, not 348.** The review report's `MC-17.counts`
  > (310 body + 38 subtree = 348) were measured against the *uncorrected* plan.
  > MC-04, MC-05, MC-06 and MC-14 legitimately add sites. Measured against the
  > corrected plan the target is **363 body + 38 artifact_subtree + 0 title =
  > 401**. This number is also carried in
  > `corrections.deferred["MC-17"].remaining_substitution_sites` in the output.
  > Asserting 348 after MC-01..MC-16 would fail spuriously.
- **D7** Leave `<SEAT>`, `<SESSION_KEY>`, `<PRINCE>`, `<ROW-ID>`, `<row>`,
  `<FEATURE_SOURCE_PATH>`, `<FEATURE_MARKER>`, `<EXACT_CANDIDATE_WORKTREE>`,
  `<EMPTY_PRIVATE_ARTIFACT_DIR>` unsubstituted.

### 5.2 Candidate-bound identity gates

- **D8** G1: 40-char lowercase hex assertion on the frozen candidate.
- **D9** G2: each firing seat's `openclaw version --json .build.sha` and source
  worktree `HEAD` must equal the candidate.
- **D10** G3: round-wide feature-presence probe against the candidate
  (`grep -c '<FEATURE_MARKER>'` > 0). Report pre-create item 2 — **if it returns
  0, create no issue; the pin is wrong.**
- **D11** G4: `seat-readiness-preflight.mjs` → `PASS-candidate` per seat.
- **D12** G5: docs authority `HEAD == abe1f9f0…` on the firing seat.

### 5.3 Corpus seeding and reconciliation (report pre-create items 10, 11, 14, 15)

- **D13** Seed C0: `PROOFS/<SHA>/` with `README.md`, `METHOD.md`,
  `RESOLVED-SHA.md`, `ARTIFACTS.md`, a seed `proofs-manifest.json` listing all
  **35** required rows at state `missing`, plus `required_rows[]` and
  `dispatch_allocation`; point `INDEX.json` at the new SHA.
- **D14** `node tools/k6-proofs/scripts/validate-corpus.mjs --index` exits 0
  with `missing == total_rows == 35`.
- **D15** Reconcile all 38 assignees against the **seeded**
  `proofs-manifest.json::dispatch_allocation` — not the catalog owner table and
  not the review report. Conflict ⇒ stop dispatch and repair the corpus first.
- **D16** Record the six rebalance moves and the seven seat substitutions as
  explicit substitution notes; name a non-firing independent reviewer for
  emeric's rows.
- **D17** Confirm project 86 currently holds 3 items so the post-create
  expectation is 41.
- **D18** Open Wave 1 only (one live row per participating seat); hold Wave 2 in
  `Todo` until every Wave 1 row clears `prince_review`.
- **D19** `check-manifest-scenarios.mjs`, `check-scenario-alignment.mjs`,
  `check-proof-row-manifests.mjs`, `validate-corpus.mjs --index` all green
  before Wave 1 fires.

### 5.4 Post-create verification (all 10 report items)

- **D20** Exactly 38 new issues, one per `row_id`, no duplicates.
- **D21** Each created body byte-identical to the corrected `rows[].body`.
- **D22** Project 86 holds 41 items; all 38 new items at `Status = Todo`.
- **D23** Exactly one assignee per issue; set matches the recommended allocation.
- **D24** Every issue linked to umbrella #451.
- **D25** Zero bodies contain `<FINAL_CANDIDATE_SHA>`,
  `OPENCLAW_RUNTIME_BUILD_SHA=`, `Live assignment: none`, or a 40-hex string
  other than the frozen candidate, `4c235d8c1997e8964160117f8d6bf650ad1e8203`
  and `abe1f9f0749d849b01da4e5d354c205ecffac946`.
- **D26** The 35 corpus issues name a destination under `PROOFS/<SHA>/<ROW-ID>/`;
  the 3 support issues do not.
- **D27** Secret-scan all 38 created bodies; zero hits beyond bare variable names.
- **D28** Post the denominator statement verbatim on #451 before Wave 1.

### 5.5 Row-execution checks (deferred to the princes)

`validate-corpus.mjs --sha <FINAL_CANDIDATE_SHA>`, evidence capture, Tempo trace
capture, gateway-journal redaction, per-row verdict states and the scribe fold
are all row-execution obligations carried in each issue's completion checklist.
They require both a frozen candidate and a fired row.

---

## 6. Statement of scope

- MC-01 … MC-16: **applied**, 307 sites, every count matched exactly.
- MC-17: **deferred**, 0 sites, `candidate_sha` still `null`.
- No GitHub issue created. Project 86 not read-modified and not mutated. No
  proof row fired. No candidate bound.
- Git history is descendant-only: no amend, no force-push, no merge, no rebase.
