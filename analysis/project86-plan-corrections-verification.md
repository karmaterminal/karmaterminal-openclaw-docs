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
| Independent PR review | `karmaterminal/karmaterminal-openclaw-docs#452`, verdict **REQUEST CHANGES** at `ca3034dde770c22e0ee5c60fdb570eb424ccd21c` |
| Review-fix round | 3 findings (1 HIGH, 2 MEDIUM) — all reproduced at `ca3034dd`, all corrected, all covered by executing regressions |

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
| **Output** `analysis/project86-proof-issue-plan.corrected.json` | 498306 | `b3b3a7e88772dd792d26b3beffa7d74f0c9f16d0a302ee6f13bf2bb03d446885` |
| **Transformer** `analysis/apply-project86-plan-corrections.mjs` | 56731 | `bb5645af4d82932085dbc32066f79846ab1c61473b1bbbca6dd381547dc4f727` |

The output SHA superseded by this review-fix round is
`76b75c13b68397f58335ee714c6aebc7c200b6bde1faefd2ebffa345720cb7c7`
(reviewed at `ca3034dd`). Both inputs are unchanged; only the transformer and its
output moved.

Both inputs are SHA-256 **pinned inside the transformer**. Either one drifting
is a hard failure, not a warning.

### Reproduce

```bash
node analysis/apply-project86-plan-corrections.mjs \
  --plan <path-to>/project86-proof-issue-plan.json \
  --report analysis/project86-fold-readiness.json \
  --out analysis/project86-proof-issue-plan.corrected.json
sha256sum analysis/project86-proof-issue-plan.corrected.json
# b3b3a7e88772dd792d26b3beffa7d74f0c9f16d0a302ee6f13bf2bb03d446885
```

### Determinism

Two consecutive runs from the pinned original input produced **byte-identical**
output:

```
b3b3a7e88772dd792d26b3beffa7d74f0c9f16d0a302ee6f13bf2bb03d446885  run-1
b3b3a7e88772dd792d26b3beffa7d74f0c9f16d0a302ee6f13bf2bb03d446885  run-2
cmp run-1 run-2  ->  identical
```

The output carries no timestamp, no hostname, no run counter and no
nondeterministic ordering; every collection is emitted in input row order.

### Idempotence (review finding 3 — corrected)

Determinism is not idempotence, and the earlier version of this section proved
only the former: it ran the *original* input twice. Re-running the same input is
not an idempotence test, and the transformer in fact **rejected its own output**
with `FAIL-CLOSED: input plan: SHA-256 pin mismatch`, exit 2.

The transformer now pins **two** accepted input forms and reports which one it
received. The corrected form is accepted as a no-op only after it passes the
full validation battery — schema, `candidate_sha === null`, 38 rows, the whole
`corrections` block (review commit, verdict, both input SHAs, `applied`
MC-01…MC-16, MC-17 deferred with the placeholder intact, both supersession
pre-image hashes, ledger id order, MC-03 = 36 sites) and every §4.4–§4.12
post-condition — and it must then re-emit **byte-identically** or it fails
closed. Nothing is short-circuited on a hash match alone.

```
# f(original)  -> corrected
b3b3a7e88772dd792d26b3beffa7d74f0c9f16d0a302ee6f13bf2bb03d446885  input-mode: reviewed-original
# f(corrected) -> corrected      (exit 0, byte-identical)
b3b3a7e88772dd792d26b3beffa7d74f0c9f16d0a302ee6f13bf2bb03d446885  input-mode: corrected-no-op
# f(f(corrected)) -> corrected   (fixed point)
cmp  ->  identical
```

Covered by executing regressions in
`tools/k6-proofs/scripts/__tests__/project86-plan-corrections-idempotence.test.mjs`;
drift coverage is in §4.13.

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
| MC-03 | `insert_in_command_fence` | **36** | 18 | 18 lock preambles + 18 `flock` wrappers | ✅ **SUPERSEDED** |
| MC-04 | `insert_section` | 38 | 38 | all 38 | ✅ |
| MC-05 | `replace_in_body` | 6 | 3 | 3 body + 3 `artifact_subtree` | ✅ |
| MC-06 | `append_after_line` | 3 | 3 | 3 support entries | ✅ |
| MC-07 | `replace_in_body` | 1 | 1 | `R-RC-2` | ✅ |
| MC-08 | `append_after_line` | 1 | 1 | `R-RC-1` | ✅ |
| MC-09 | `replace_in_body` | 2 | 2 | `R-CW-5`, `R-CW-6` | ✅ |
| MC-10 | `replace_in_body` | 38 | 38 | all 38 | ✅ |
| MC-11 | `append_after_line` | 38 | 38 | all 38 (`R-OBS-1` payload **SUPERSEDED**) | ✅ |
| MC-12 | `insert_section` | 38 | 38 | all 38 | ✅ |
| MC-13 | `replace_title` | 38 | 38 | all 38 | ✅ |
| MC-14 | `append_section` | 38 | 38 | all 38 | ✅ |
| MC-15 | `append_after_line` | 1 | 1 | `R-OBS-1` | ✅ |
| MC-16 | `replace_in_body` | 1 | 1 | `R-CD-3` | ✅ |
| **MC-17** | `global_substitution` | **0** | **0** | **not applied** | ⏸ **DEFERRED** |

Total sites applied: **325** across 38 rows (307 reviewed + 18 added by the
MC-03 supersession).

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

### Two reviewed payloads superseded, with the pre-image pinned

The reviewed report `analysis/project86-fold-readiness.json` is an independent
review artifact and stays **byte-frozen** — rewriting it would destroy the very
property that makes "applied exactly as reviewed" checkable. Where a reviewed
payload was found defective, the transformer therefore *supersedes* it: it first
asserts the exact reviewed bytes are still present (by SHA-256 of the reviewed
`text`), then substitutes the corrected payload and records the pre-image hash
into `corrections.superseded` in the output. The defective bytes remain provable
and the substitution is auditable.

| Superseded | Reviewed `text` SHA-256 | Finding | Resolution |
|---|---|---|---|
| `MC-03` | `411c79a7226afc1d00f67fcc5eaf7a2e1b3a1cd327cf732105c0c9f9fcbd903d` | PR #452 review, **HIGH**. The reviewed preamble called `live-run-guard.mjs --json`, which only *computes and prints* lock metadata. It acquired nothing, created no lock file, and its exit status did not gate the following `run-proofs.sh`. Its `--manifest tools/k6-proofs/manifests/<row>.json` target was also an unresolvable literal. All 18 rows claimed serialized could overlap. | An `&&`-chained fail-closed preamble that resolves the row's **own** manifest, calls the canonical guard with `--shell --require-lock`, `eval`s its variables, asserts `K6_PROOF_LOCK_REQUIRED=1` and a non-empty `K6_PROOF_LOCK_PATH`, then wraps the primary run in **two nested** `flock --nonblock --conflict-exit-code 75` locks (session-outer, row-inner) so both are **held for the whole execution**. The reviewed STOP clause is carried verbatim and asserted. |
| `MC-11` / `R-OBS-1` only | `fd829ed2b588fe0572198e0defb3289bedaf07d0f87b8d176b759f41b4a032c2` | PR #452 review, **MEDIUM**. The row declared the both-forms mandate `required`, named its token-form sibling `` `None` ``, and declared a row proving only one surface **INCOMPLETE**. No execution could ever satisfy that contract. | `R-OBS-1` is a read-only `session_status` observability row (`manifests/r-obs-1.json`: `mutates: false`, `toolSurface: typed-tool`, notes: fires no continuation tool, delegate, config mutation, restart or compaction). Its status card has no bracket-token surface. The mandate is now **not applicable**, matching its already-not-applicable siblings `R-OBS-2` and `R-OBS-STATUS`, and the INCOMPLETE clause is dropped for that row. The other **37** reviewed MC-11 payloads are untouched reviewed bytes. |

#### Why MC-03 does not route through `tools/k6-proofs/run-proof.sh`

`run-proof.sh` is the repository's pre-existing `flock` owner (fd 9, `flock -n 9`,
gated on `OPENCLAW_ROW_MANIFEST`), so it was the first candidate for "the
canonical locking wrapper". It cannot carry this contract: it accepts a *scenario
name* only, has no way to bind a row + candidate SHA, and does not produce the
artifact set (`run-result.json`, `runner-metadata.json`, `evidence.jsonl`,
gateway-journal capture) that `run-proofs.sh --live <ROW> <SHA>` produces and that
every row's completion checklist requires. The emitted command therefore uses an
explicit `flock` wrapper with **equivalent ownership semantics** — same lock path,
computed by the same canonical guard, held for the same duration (process
lifetime), released the same way (on exit).

#### Two locks, because the bodies state two obligations

Every serialized body states both *"do not run this row twice against the same
session"* **and** *"run no other continuation row against the same target
session"*. The canonical guard's lock is keyed on `(rowId, session)`, so it only
ever enforces the first: two *different* serialized rows on one session compute
different lock paths and would not exclude each other. A first pass of this fix
installed only that row lock and therefore under-delivered the stated contract.

The guard now additionally derives a **session-scoped** lock, keyed on the target
session alone, in a separate filename namespace so the two can never alias:

| Lock | Basis | Path | Excludes |
|---|---|---|---|
| session-wide | `session\0<session>` | `/tmp/openclaw-k6-session-<24hex>.lock` | any *other* continuation row on that target session |
| row | `<rowId>\0<session>` | `/tmp/openclaw-k6-proof-<24hex>.lock` | a second run of *that* row on that target session |

The emitted command nests them **session-outer, row-inner**, always in that
order, so the acquisition order is global and cannot deadlock (both are
`--nonblock` regardless). Both are held for the entire `run-proofs.sh` lifetime
and released on exit. The session lock is only ever taken by a row the guard says
requires a lock, so the 20 non-serialized rows are unaffected.

#### `--require-lock`, and why it only ever escalates

`R-RC-2`'s manifest declares `sameSessionConcurrencySafe: true`, while MC-07
declares a fail-closed **contract override** making it serialized. Rather than
mutate a manifest that other harness checks depend on, `live-run-guard.mjs` gained
a `--require-lock` flag that can *add* a lock requirement but never remove one,
plus a `lockRequiredReason` / `K6_PROOF_LOCK_REASON` field recording provenance:

| Manifest | flag | `lockRequired` | `lockRequiredReason` |
|---|---|---|---|
| `r-rc-2.json` | — | `false` | `none` |
| `r-rc-2.json` | `--require-lock` | `true` | `caller-override` |
| `r-cd-1.json` | `--require-lock` | `true` | `manifest-declared` |
| `r-cd-1.json` | — | `true` | `manifest-declared` |

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

**Result: 61 pre-create assertions, 61 PASS, 0 FAIL**, plus the 11 executing
behavioural regressions in §4.14.

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
| A3b | `<FINAL_CANDIDATE_SHA>` preserved: 381 body + 38 `artifact_subtree` + 0 title = **419** sites | PASS |
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
| A8b | All 18 carry the fail-closed clause `If the guard reports an active same-session lock: STOP.` (reviewed wording preserved through the supersession) | PASS |
| A8c | Exactly 18 bodies reference `live-run-guard.mjs` — no over-application | PASS |
| A8g | All 18 call the guard exactly once as `--shell --require-lock)" &&`; **zero** bodies retain the superseded metadata-only `--json` call | PASS |
| A8h | All 18 lock on the manifest **they themselves declare** (`- Manifest: …`), whose `rowId` equals the row; **zero** unresolved `<row>.json` targets | PASS |
| A8i | All 18 carry exactly one `eval "$K6_PROOF_GUARD_VARS" &&`, one `[ "${K6_PROOF_LOCK_REQUIRED:-0}" = "1" ] &&` and one `[ -n "${K6_PROOF_LOCK_PATH:-}" ] &&` | PASS |
| A8j | All 18 wrap their single primary run in the nested pair `flock … "$K6_PROOF_SESSION_LOCK_PATH"` → `flock … "$K6_PROOF_LOCK_PATH"` → `./scripts/run-proofs.sh`; exactly one `./scripts/run-proofs.sh` per body; exactly 18 bodies hold locks fleet-wide | PASS |
| A8k | The whole fence is one `&&` chain, so a guard refusal (exit 1) or a lock conflict (exit 75) short-circuits **before** `run-proofs.sh`; it never calls `exit` in an operator's interactive shell | PASS |
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
| N1 | Already-corrected output fed back as `--plan` | **accept as a validated no-op** | exit **0**, `input_mode: corrected-no-op`, output byte-identical to the input |
| N2 | Tampered review report (`"verdict"` altered), plan is the exact corrected form | refuse | `FAIL-CLOSED: review report: SHA-256 pin mismatch` — exit **2** |
| N3 | One MC-01 anchor deleted from the plan, pins relaxed on a throwaway copy so the anchor layer is reached | refuse | `FAIL-CLOSED: MC-01/R-CD-1: anchor absent` — exit **2** |
| N4 | Corrected plan with `--conflict-exit-code 75` → `76` (single-byte drift) | refuse | `FAIL-CLOSED: input plan: SHA-256 pin mismatch` — exit **2** |
| N5 | Corrected plan with the lock preamble removed from one row (partial correction) | refuse | exit **2** |
| N6 | Corrected plan with `--shell --require-lock` reverted to the superseded `--json` | refuse | exit **2** |
| N7 | Corrected plan with `candidate_sha` speculatively filled in | refuse | exit **2** |
| N8 | Corrected plan with `<FINAL_CANDIDATE_SHA>` substituted early | refuse | exit **2** |
| N9 | Corrected plan re-serialized with 4-space indentation (semantically equal, byte-different) | refuse | exit **2** |
| N10 | Corrected plan with `R-OBS-1` reverted to the unsatisfiable `required` mandate | refuse | exit **2** |

N1 is the review-finding-3 correction: the **exact** corrected form is now the
only non-original input accepted, and only after full validation. N4–N10 are the
drift coverage that keeps that acceptance from becoming a bypass — every
mutation, including a purely cosmetic re-serialization, is still refused.

The transformer additionally fails closed on: wrong plan/report schema, a
verdict other than `READY_AFTER_MECHANICAL_FIXES`, a non-null input
`candidate_sha`, row count ≠ 38, duplicate `row_id`, plan/catalog set mismatch,
corpus ≠ 35 or support ≠ 3, any correction whose `kind` or `applies_to` length
drifted, any per-row spec missing, any site count that misses its expected
total, an unreviewed rebalance move, an unreviewed 40-hex SHA appearing anywhere,
elimination of `<FINAL_CANDIDATE_SHA>`, and every post-condition in §4.4–§4.12.

### 4.14 Behavioural regressions (executing, not string-presence)

The review's central objection to the previous round was that serialization was
asserted by *looking for a string* rather than by observing exclusion. These
tests execute the emitted command for real. `./scripts/run-proofs.sh` is
substituted for a sentinel-writing stub, so **no proof row is ever fired** by the
test suite.

`tools/k6-proofs/scripts/__tests__/project86-plan-lock-serialization.test.mjs`

| Test | What it actually does | Result |
|---|---|---|
| B1 | Takes `R-CD-1`'s primary fence verbatim from the corrected plan, resolves its placeholders, points it at a stub that holds for 4 s, and launches it. While it runs: asserts the guard-computed lock file **exists on disk**, then launches the identical command a second time. | second run exits **75**, its stub sentinel is **never written** — the row did not execute |
| B1b | Same, but the second command is a **different** serialized row (`R-CW-1`) against the **same** `<SESSION_KEY>` — the obligation every serialized body states (*"run no other continuation row against the same session"*). Then, **still while the first row holds both locks**, runs `R-CW-1` against a *different* session key, and finally retries the blocked row after release. | different row on the same session exits **75** and never executes; a different target session exits **0** and executes *concurrently* (so the session lock is per session, not global); the blocked row succeeds on retry after release |
| B2 | Same command after the first run exits. | third run exits **0**, sentinel written — the lock is released, not leaked |
| B3 | **Negative control.** Reconstructs the superseded `ca3034dd` shape (preamble stripped, `flock` wrapper removed) and runs it twice concurrently. | both run, both sentinels written — reproducing the HIGH finding and proving B1 is not vacuous |
| B4 | Every one of the 18 serialized rows: declares a manifest that exists, whose `rowId` equals the row, locks on **that** manifest, has no `--json` guard call, no `<row>.json`, and exactly one `flock`-wrapped primary run. | PASS |
| B5 | `--require-lock` escalates `r-rc-2.json` (`caller-override`), leaves `r-cd-1.json` provenance as `manifest-declared`, and never removes an existing requirement. Row and session lock namespaces (`openclaw-k6-proof-*` / `openclaw-k6-session-*`) are disjoint and cannot alias. | PASS |

`tools/k6-proofs/scripts/__tests__/project86-plan-corrections-idempotence.test.mjs`

| Test | What it actually does | Result |
|---|---|---|
| B6 | Runs the transformer with the committed corrected plan as `--plan`. | exit **0**, `input_mode: corrected-no-op`, output byte-identical |
| B7 | Runs it a third time on that output. | same fixed point |
| B8 | Seven drifted / partial / re-serialized variants (N4–N10). | all exit **2** with `FAIL-CLOSED` |
| B9 | Tampered report with a valid corrected plan. | `FAIL-CLOSED: review report: SHA-256 pin mismatch`, exit **2** |
| B10 | Every both-forms mandate in the plan: exactly one per row, value in {`required`, `not applicable`}, "not applicable" never carries the INCOMPLETE clause, and every `required` row names **two sibling row ids that exist in the plan**. | PASS — 19 required, 19 not applicable, 0 violations. This is the assertion that would have caught `None`. |
| B11 | `corrections.superseded` records both pre-image hashes; `MC-03` ledger sites = 36. | PASS |

```bash
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
# tests 245, pass 245, fail 0  (includes the 11 new behavioural tests above)
node --test tools/k6-proofs/tests/*.test.mjs
# tests 31, pass 31, fail 0
```

Every lock file the suite causes to be created is unlinked in an `after()` hook;
a full run leaves **zero** residue in `/tmp` (before/after count delta 0).

The same checks are enforced *at generation time* as transformer post-conditions,
so a future edit cannot produce a plan that violates them: the MC-03 lock
post-conditions (§4.7 A8g–A8k) and the MC-11 satisfiability post-condition (B10)
both `die()` fail-closed.

---

## 5. Deferred candidate-dependent checks

`MC-17` is **not applied**. `candidate_sha` remains `null` and all 419
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
  > **Corrected target: 419, not 348.** The review report's `MC-17.counts`
  > (310 body + 38 subtree = 348) were measured against the *uncorrected* plan.
  > MC-04, MC-05, MC-06 and MC-14 legitimately add sites, and the MC-03
  > supersession adds one per serialized row (the lock preamble binds
  > `OPENCLAW_CANDIDATE_SHA` for the guard). Measured against the corrected plan
  > the target is **381 body + 38 artifact_subtree + 0 title = 419**; the
  > pre-supersession figure recorded at `ca3034dd` was 401. This number is also
  > carried in
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

- MC-01 … MC-16: **applied**, 325 sites, every count matched exactly.
- MC-03 and MC-11/`R-OBS-1`: reviewed payloads **superseded** under a pinned
  pre-image hash; the reviewed report itself is unmodified.
- MC-17: **deferred**, 0 sites, `candidate_sha` still `null`.
- No GitHub issue created. Project 86 not read-modified and not mutated. No
  proof row fired. No candidate bound.
- Git history is descendant-only: no amend, no force-push, no merge, no rebase.
