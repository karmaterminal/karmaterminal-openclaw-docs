# Project 86 proof-round coordination contract

Status: analysis + coordination contract. This document creates no issues, mutates no
project fields, and executes no proof rows.

| Binding | Value |
| --- | --- |
| Umbrella issue | `karmaterminal/karmaterminal-openclaw-docs#451` |
| Project | `https://github.com/orgs/karmaterminal/projects/86` |
| Docs base for this contract | `abe1f9f0749d849b01da4e5d354c205ecffac946` |
| Reference corpus (shape exemplar) | `PROOFS/4c235d8c1997e8964160117f8d6bf650ad1e8203` |
| Canon it does not replace | `RUNBOOKS/PROOF-CORPUS-METHOD.md`, `tools/k6-proofs/docs/PROOF-RUN-METHOD.md`, `tools/k6-proofs/CONTRIBUTING-ROWS.md`, `tools/k6-proofs/docs/SAFETY-ROWS.md`, `tools/k6-proofs/docs/GOLDEN-PATH.md` |

This contract is the coordination layer *on top of* those runbooks. Where a runbook and
this contract disagree on a mechanical command, the runbook wins and the divergence is
raised as a docs issue. Where they disagree on **who may commit what, when a round
halts, and what counts as a verdict**, this contract wins for project 86.

---

## 0. Why this contract exists

The reference corpus `4c235d8c1997e8964160117f8d6bf650ad1e8203` is the failure mode
written down. Its own receipts say so:

- Canonical rollup: **2 pass / 32 partial / 1 fail / 0 honest_limit / 35 total**
  (`PROOFS/INDEX.json`, `proofs-manifest.json::rollup`).
- The runner posture *before* review on the same arm was 26 `PASS-candidate` /
  7 `PARTIAL-candidate` / 1 `FAIL-candidate` / 1 `BAD_PROOF`
  (`execution-summary.json::runnerPostureBeforeHumanReview`). Almost every one of those
  26 candidate passes collapsed to `partial` at publication for **authority and receipt
  debt**, not for observed product misbehavior.
- A second, independent arm on the *same* runtime SHA published **25 pass / 9 partial /
  1 honest_limit / 0 fail** (`ARTIFACTS.md`, `artifacts/silas-lothric/comparator-20260719/`).
- The read-only reconciliation
  (`artifacts/emeric-nuc/reconciliation-20260719/EMERIC-READ-ONLY-RECONCILIATION-AUDIT.md`)
  classified 23 rows as concordant `PASS-candidate` behavior that still floored to
  `PARTIAL` because the primary arm lacked publication authority or a mandatory receipt.

So the round did not fail on product behavior. It failed on:

1. **Receipt debt** — trace/journal/correlation artifacts missing or unrecoverable, e.g.
   `tempo-recovery-review.json` preserving six rows as partial because
   `continuation.delegate.dispatch` / `continuation.work` spans were not status OK, and
   two rows unretriable at all.
2. **Setup/harness defects misread as product verdicts** — `R-CD-TOKEN` stopped at the
   pre-dispatch surface gate with `surface_class: "message-body"` and never fired
   behavior; `R-OBS-STATUS` was `BAD_PROOF` from a stale source-location assumption
   (docs issue #438); `R-OBS-1` failed because a disposable session's effective policy
   denied `session_status` (docs issue #439).
3. **One-fire accounting anxiety** — behavioral attempts are non-refireable, so an
   ambiguous interruption poisons a row unless the interruption itself is a receipt.

Every rule below exists to stop one of those three.

---

## 1. Roles

| Role | Who | Authority | Explicit non-authority |
| --- | --- | --- | --- |
| **Row prince** | Exactly one named prince/seat per row issue | Fire the row from their own seat; write **only** files under their own row/seat artifact path; commit those direct to docs `main`; classify their own candidate outcome; open regression issues | May not edit `PROOFS/INDEX.json`, `PROOFS/<FULL_SHA>/proofs-manifest.json`, corpus-root `README.md` / `METHOD.md` / `RESOLVED-SHA.md` / `ARTIFACTS.md`, or another row's directory |
| **Foreground scribe** | One per round | Owns shared index/manifest/root docs; folds reviewed rows; regenerates rollups; declares halt-state; authorizes refires; opens/updates project 86 items; assembles the final digest | May not promote a row's state above what its own receipts support; may not fire a row they own as scribe-of-record without a second reviewer |
| **Reviewer** | Any prince other than the row's own prince | Confirms receipts against the row manifest expectation; approves fold | May not repair evidence on the prince's behalf; a repair is a new attempt |
| **Product owner (`karmaterminal/openclaw`)** | Upstream | Owns regression issues filed against the product/harness | — |

**Single accountable prince rule.** A row has one accountable prince at all times.
Cross-walk / comparator arms are welcome and land under `<ROW>/<seat-name>/` or
`<ROW>/comparators/<seat-name>/<run-id>/`, but a comparator **never** reassigns
ownership and never substitutes for the canonical owner
(`PROOF-CORPUS-METHOD.md` §substitution-class discipline; reference corpus
`proofs-manifest.json::rows[].notes` repeats this per row). A substitution is only valid
when the canonical owner's seat is unavailable, it is named explicitly in the row's
`EVIDENCE.md`, and the row issue records it.

---

## 2. Project 86 status flow

Project 86's `Status` field has exactly these options (read-only verification at
authoring time): `Todo`, `in_coding_agent`, `In Progress`, `prince_review`, `swim`,
`Done`. The round uses all six with hard entry/exit gates. **Status is set by the
scribe; princes request transitions in the issue thread.** No transition is implied by
elapsed time.

```
Todo ──▶ in_coding_agent ──▶ In Progress ──▶ prince_review ──▶ Done
  ▲            │                  │                │
  │            └──────────────────┴────────────────┘
  │                     (blocked / refire authorized)
  └────────────────────────── swim ◀── halt-state or cross-cutting regression
```

| Status | Means | Entry gate | Exit gate |
| --- | --- | --- | --- |
| `Todo` | Row is in the round's denominator, not yet claimed | Row appears in `proofs-manifest.json::required_rows` and has a one-row issue | A named prince is assigned **and** the pre-fire identity gate (§4) is green |
| `in_coding_agent` | Automated/agent-driven preparation: manifest read, seat readiness, dry run, scenario/doc patches. **No behavioral fire.** | Assignee set; issue carries the exact command block | `seat-readiness.json` is `PASS-candidate` and the dry run enumerated the row |
| `In Progress` | The behavioral fire window is open — the one-fire budget is being spent | Identity gate green, readiness green, any required same-session lock held (§3) | A terminal `row-result.json` **or** an `interruption-receipt.json` exists on disk |
| `prince_review` | Artifacts committed; a reviewer who is not the row prince is checking receipts against the manifest expectation | Row artifacts committed to docs `main` under the row path; validator run pasted | Reviewer signs off with a state recommendation (`pass` / `partial` / `fail` / `honest_limit` / `thin`) |
| `swim` | Parked: halt-state, cross-cutting regression, or an authority/substrate blocker outside the prince's control | Scribe declares it, citing the halt/regression issue | The blocking issue is resolved *or* the round closes the row at its honest state |
| `Done` | Row is folded into `proofs-manifest.json` at a reviewed state and the index rollup validates | Reviewer sign-off + scribe fold + `validate-corpus.mjs --index` exit 0 | terminal |

Rules:

- **`Done` is not "passed".** A row folded as `partial` or `fail` with complete,
  honest receipts is `Done`. `Done` means *the round has extracted everything this
  row can honestly give at this candidate*.
- A row may return from `prince_review` to `In Progress` **only** with an explicit
  refire authorization (§11). Otherwise the review outcome is recorded as-is.
- `swim` never deletes collected data. Artifacts already committed stay committed.
- A row that never leaves `Todo` is folded as `missing`, not silently dropped. The
  round's denominator is fixed at dispatch and published in `required_rows`.

---

## 3. Concurrency and serialization

The round is **parallel by default and serialized by exception**. The exceptions are
mechanical, not stylistic.

### 3.1 Safe to run concurrently

Two rows may run at the same wall-clock time when **all** hold:

1. They run on **different seats**, or on the same seat against **different session
   keys**; and
2. Neither row's manifest declares `liveRunSafety.sameSessionConcurrencySafe: false`
   for a session they share; and
3. Neither row is in the `R-RC-*` family (§3.3); and
4. Each row uses its own disposable session
   (`OPENCLAW_CREATE_DISPOSABLE_SESSION(S)=true`) and its own fresh nonce; and
5. Neither is a `transport: "process-local"` fixture competing for the same artifact
   directory or worktree.

Offline / static rows (`transport: "offline"`, `"github-source-contract"`,
`static-preflight-only`) are unconditionally concurrency-safe against live rows: they do
not open a gateway session. In the current catalog those are `R-CD-COLLECTION-ON-COLLAPSE`,
`R-CD-RETURN-OVERLAP`, `R-CW-5A`, `R-CW-6A`, `R-CW-7`, `R-CW-DELEGATE-CHILD-LIVE`,
`R-CW-DELEGATE-TOKEN`, `R-CW-MULTI`, `R-CW-MULTI-COLLAPSE`, `R-OBS-2`, `R-OBS-STATUS`,
`R-REGRESSION-TRAP-TESTS`, `R-TRACE-REDACTION-1121`.

### 3.2 Must serialize — same-session lock

Rows whose manifest sets `liveRunSafety.sameSessionConcurrencySafe: false` take a
**same-session lock** for the whole fire window. In the current catalog that is:
`R-CD-1`, `R-CD-2`, `R-CD-4`, `R-CD-CHAINED-DEPTH-2`, `R-CD-MODEL-CHAINED-ALT`,
`R-CD-MODEL-DEFAULT`, `R-CD-MODEL-TOKEN`, `R-CD-MODEL-TOOL`, `R-CD-SILENT`,
`R-CD-TOKEN`, `R-CW-1`, `R-CW-2`, `R-CW-3`, `R-CW-4`, `R-CW-5`, `R-CW-6`,
`R-CW-DELEGATE-SELF-CONTINUATION`, `R-CW-TOKEN`, `R-RC-1`.

Enforcement is fail-closed and mechanical:

```bash
OPENCLAW_GATEWAY_TOKEN=***  OPENCLAW_SESSION_KEY=<target-session> \
  node tools/k6-proofs/scripts/live-run-guard.mjs \
    --manifest tools/k6-proofs/manifests/<row>.json --json
```

If the guard reports an active same-session lock, **stop**. That output is a
coordination failure, not row evidence (`CONTRIBUTING-ROWS.md` §Running the row, step 2),
and it must not be written into `EVIDENCE.md` as a product observation.

`R-CW-5` / `R-CW-6` are `transport: "process-local"`,
`classification: "orchestration-required"`. They serialize on the *fixture* resources,
not on a gateway session: one fixture invocation at a time per seat, a private `0700`
artifact directory, and a tracked-clean source worktree. The reference corpus records
both seats' first invocations exiting at the `0700` artifact-directory gate before any
fixture body ran — that is a **mechanically proven non-fire**, so the replacement
invocation is the sole behavioral execution, not a refire.

### 3.3 Must serialize — compaction family

`R-RC-1` and `R-RC-2` are opt-in, serialized, and require explicit human confirmation.
They must **never** co-fire with any `R-CW-*` / `R-CD-*` row on the same session
(`SAFETY-ROWS.md` §Guardrails 1): the compaction cycle holds a session-write-lock for
the duration of the summarization call, bounded by
`agents.defaults.compaction.timeoutSeconds` (default 180s). A parallel same-session
continuation row becomes a second lock-acquirer and stalls against the held write-lock —
a real fault, not a preference.

Ordering is fixed: **`R-RC-1` executes and resolves before `R-RC-2` is attempted on a
session** (`SAFETY-ROWS.md` §Guardrails 2).

> **Recorded discrepancy (do not resolve by improvisation).**
> `tools/k6-proofs/manifests/r-rc-2.json` currently declares
> `liveRunSafety.sameSessionConcurrencySafe: true`, which contradicts the
> `SAFETY-ROWS.md` serialization mandate for the whole `R-RC-*` family. For project 86,
> **treat `R-RC-2` as serialized (fail-closed)** and file a docs issue to reconcile the
> manifest with the runbook. Do not relax the runbook to match the manifest.

### 3.4 Wave discipline

The round runs in waves so a systemic defect is discovered on a small blast radius:

1. **Wave 0 — harness liveness (no fire).** Offline golden path, catalog checks,
   `validate-corpus.mjs --current`. Round-wide; one prince, results shared.
2. **Wave 1 — critical first wave.** One live row per participating seat, chosen to
   exercise the most distinct surfaces (the reference round used Ronan
   `R-CD-CHAINED-DEPTH-2`, Rune `R-CD-4`, Cael `R-CD-MODEL-TOOL`, Elliott `R-CD-TOKEN`
   — `proofs-manifest.json::proof_requirements.critical_first_wave`). Wave 1 rows
   **must** complete review before Wave 2 dispatches, because a shared harness defect
   found here is cheap and found in Wave 2 is not.
3. **Wave 2 — parallel bulk.** All remaining concurrency-safe rows, per §3.1/§3.2.
4. **Wave 3 — serialized tail.** `R-RC-1` → `R-RC-2`, plus any row that needed a
   same-session lock held by another Wave 2 row.

---

## 4. Exact candidate/deployment identity pre-fire gate

This is the single most load-bearing gate. `validate-corpus.mjs` checks that *artifacts*
are consistent with a SHA; it **cannot** verify the *running gateway* is on that SHA
(`CONTRIBUTING-ROWS.md` step 3). A row fired against a feature-less gateway produces a
failure at the gateway-lacks-feature layer that is trivially misread as a product
regression. That misread is exactly how a round splinters.

Every prince runs this gate **immediately before** the fire window opens, on the seat
they will fire from, and pastes the result into the row issue.

```bash
# G1 — corpus pin: the candidate this round proves (40 chars, lowercase hex, never trimmed)
CANDIDATE_SHA=<40-char-sha>
test "${#CANDIDATE_SHA}" -eq 40 && [[ "$CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ ]] && echo "G1 ok"

# G2 — what SHA is THIS seat's gateway actually running?
openclaw --version
git -C ~/flesh_beast_tmp/openclaw rev-parse HEAD     # must equal $CANDIDATE_SHA

# G3 — does that SHA carry the feature under test? (example: continuation token parser)
gh api repos/karmaterminal/openclaw/contents/src/auto-reply/tokens.ts?ref="$CANDIDATE_SHA" \
  --jq '.content' | base64 -d | grep -c CONTINUE_WORK        # want > 0

# G4 — seat readiness (public-safe; prints env presence booleans only)
OPENCLAW_CANDIDATE_SHA="$CANDIDATE_SHA" \
OPENCLAW_SEAT_NAME=<seat> \
OPENCLAW_SESSION_KEY=<scratch-or-disposable-session> \
OPENCLAW_GATEWAY_TOKEN=*** \
  node tools/k6-proofs/scripts/seat-readiness-preflight.mjs --json \
  > /tmp/seat-readiness.json

# G5 — docs authority: the docs commit this round dispatches from
git -C <docs-repo> rev-parse HEAD
```

Gate verdicts:

- **G2 ≠ G1** → the seat is on a different line. **Deploy the seat first.** Do not fire.
  A fire in this state is void: it consumes the one-fire budget for nothing and its
  artifacts must be filed as a setup non-fire, never as row evidence.
- **G3 = 0** → the candidate does not carry the feature. Stop the *round*, not the row;
  the pin is wrong. Escalate to the scribe (§9 halt-state).
- **G4 ≠ `PASS-candidate`** → row stays `in_coding_agent`, classified setup/`PARTIAL`
  until the seat is fixed, unless the row issue explicitly declares a different
  expectation.
- **G5 drift** → the round's dispatch authority moved mid-round. Freeze the docs commit
  for the round and record it; do not silently follow `main`.

The fleet can run mixed SHAs. **Check your own seat, not someone else's.**
The reference corpus records fleet readiness per seat
(`proofs-manifest.json::artifact_roots.fleet_readiness`) precisely so a seat that is
`pending` cannot be mistaken for `exact-sha-ready`.

Identity is also an *artifact* requirement, not just a gate: every live receipt must
report the exact candidate SHA and the actual executing seat
(`proof_requirements.identity`). An authoritative identity mismatch inside a receipt is
`fail`, not `partial`.

---

## 5. Automation-first, old-runbook fallback

**Automation is the default path.** The harness exists so that "running a k6 proof is
very little work beyond kickoff".

Ordered ladder — take the highest rung that works, and record which rung you used:

| Rung | Path | When |
| --- | --- | --- |
| A1 | `.github/workflows/project81-k6-proof.yml` workflow dispatch (`target_prince`, `candidate_sha`, `rows`, `docs_ref`, `session_selector`, `dry_run`, `create_disposable_sessions`) | Default for any row with a runner-labelled seat |
| A2 | `tools/k6-proofs/scripts/run-proofs.sh <ROWS> <SHA>` locally on the seat, with `OPENCLAW_ROW_MANIFEST` set | Workflow unavailable, or the row needs local env the runner lacks |
| A3 | Direct `k6 run tools/k6-proofs/scenarios/<row>.js` + `evidence-writer.mjs` / `postprocess-k6-summary.mjs` | The runner wrapper itself is the thing that broke |
| A4 | **Old-runbook manual form**: fire the primitive from the seat by hand, capture journal receipts, pull the Tempo trace by `curl` per `PROOF-CORPUS-METHOD.md` §Tempo trace requirement, hand-assemble the row dir to the §6 layout | Automation is broken in a way that would otherwise leave the row unproven |

Fallback discipline:

1. **Dropping a rung is a reportable event, not a private workaround.** The row issue
   records: which rung failed, the exact error, and the rung actually used. If the
   failure is non-trivial (§10), a `karmaterminal/openclaw` issue is opened *and linked*
   before the fallback run is folded.
2. **A fallback row is not a lesser row.** A4 evidence that carries the full receipt set
   is foldable at the same states as A1 evidence. What it must never do is *skip* a
   receipt because the manual path is inconvenient — a manually-run row missing its
   trace is `partial`, exactly like an automated one.
3. **Never invent a mechanism the repo does not have.** `PROOF-CORPUS-METHOD.md`
   already carries this scar: the historical caps procedure names `gateway-reload.yml`,
   which is not present in this repository. Do not substitute a restart. `R-CW-5` /
   `R-CW-6` use the process-local fixtures
   (`scripts/run-cost-cap-fixture.mjs`, `scripts/run-max-chain-fixture.mjs`); any future
   live-mutating row must name an available, explicitly approved reload mechanism in its
   own runbook before use.
4. **Never lower fleet config or restart a gateway to make a row pass.** A row that can
   only pass by mutating shared fleet state is `partial` plus a product/harness issue.

---

## 6. Artifact contract: path, filenames, redaction, receipts

### 6.1 Canonical path

```
PROOFS/<FULL_SHA>/<ROW-ID>/<seat-name>/k6-run-<UTC-timestamp>/
```

`<FULL_SHA>` is the exact 40-char lowercase candidate SHA — never trimmed, never
abbreviated (`evidence-writer.mjs` rejects anything else). `<seat-name>` uses the canon
list (`cael-dgx`, `ronan-dgx`, `silas-lothric`, `elliott-legion`, `emeric-nuc`,
`rune-rog-ally`). Comparator/cross-walk arms may additionally use
`<ROW-ID>/comparators/<seat-name>/<run-id>/` as the reference corpus does. Row-root
`EVIDENCE.md` (`PROOFS/<FULL_SHA>/<ROW-ID>/EVIDENCE.md`) is the row's summary document
that `proofs-manifest.json::rows[].evidence_doc` points at.

Corpus support directories `artifacts/` and `gates/` and any `_`-prefixed directory are
recognised by the validator and are **not** row dirs. Everything else directly under
`PROOFS/<FULL_SHA>/` must be declared in the manifest or it fails `no-orphan-row-dirs`.

### 6.2 Required files per run directory

| File | Required | Source |
| --- | --- | --- |
| `seat-readiness.json` | Always | `seat-readiness-preflight.mjs`; must be `PASS-candidate` or the row stays setup/`PARTIAL` |
| `EVIDENCE.md` | Always | `evidence-writer.mjs` emits the schema — **do not hand-edit the schema** |
| `k6-summary.json` | Always | post-processor output; no raw unredacted events |
| `row-result.json` | Always | normalised outcome: `PASS-candidate` / `PARTIAL-candidate` / `FAIL-candidate`, plus `HONEST-LIMIT-candidate` for `R-RC-2` only |
| `gateway-events.ndjson` | Unless genuinely no frames | redacted WS frames, one JSON object per line; absence must be stated in `EVIDENCE.md` |
| `evidence-redaction.json` | Always (writer emits) | `openclaw.k6.public-evidence-redaction.v1` receipt |
| `gateway-journal.log`, `gateway-journal-capture.json`, `gateway-journal-redaction.json` | Live rows | bounded, public-safe journal for the row window; `OPENCLAW_PROOFS_SERVICE_LOG_REQUIRED=false` only when the resulting receipt debt is *intentionally* retained as PARTIAL |
| `artifacts/<descriptive>_trace.json` | Trace-required rows | raw public-safe Tempo JSON. **A continuation row cannot fold as `pass` without it** |
| `interruption-receipt.json` | Interrupted attempts only | `write-interrupted-run-result.mjs`; written with `wx` so it can never be silently overwritten |
| `verdict-reconciliation.json` | When runner/summary verdicts disagree | harness-classification receipt — **never** a reason to refire |

### 6.3 Redaction boundary — non-negotiable

- Zero secrets in source, manifests, evidence, PR bodies, issue bodies, commit messages,
  console logs, or process arguments. `OPENCLAW_GATEWAY_TOKEN` and friends come from the
  seat environment. If a token reaches a log, **rotate first**, then clean, then push.
- `evidence-writer.mjs` refuses to write when evidence carries raw `events` without
  `redacted_events`. Do not work around it; fix the scenario to use `redactEvent()`.
- Nonces, session keys, run/idempotency identifiers, task/prompt bodies, message
  payloads, and raw captured event containers are removed by the shared sanitizer.
  Fingerprints (`reason_hash`, 16-hex attempt/nonce hashes) are the public-safe form.
- No private session material, user content, or provider prompt bodies — ever. The
  reference corpus's own secret-scan withheld allowlisted artifacts rather than publish
  them; withheld-by-scan is an honest `partial`, and it is the correct outcome.
- Screenshots are supplemental. They never satisfy a JSON trace requirement.

### 6.4 Receipt checks the prince runs before committing

```bash
# self-grep for secrets before any commit
git diff --cached | grep -nEi 'OPENCLAW_GATEWAY_TOKEN|bearer |authorization:|session_key' && echo "STOP"

# stale promise-of-artifact tokens are auto-bounced at fold time
grep -rnE 'pending_push|pending push|upload-blame|TODO-UPLOAD|pending_upload' PROOFS/<FULL_SHA>/<ROW-ID>/ && echo "STOP"

# corpus invariants for the SHA
node tools/k6-proofs/scripts/validate-corpus.mjs --sha <FULL_SHA>
```

Any row that says `pending_push`, `upload-blame`, `TODO-UPLOAD`, or similar
"promise-of-artifact" wording is bounced back. **Either the artifact exists or the row
is not folded.**

---

## 7. Commit boundaries

Proofs live on `karmaterminal/karmaterminal-openclaw-docs:main` directly — one clean
main, no branch/PR detour (`PROOF-CORPUS-METHOD.md` §Where proofs live). Project 86
keeps that, with a hard write-boundary.

### 7.1 Row-owned, direct-to-main

A row prince may commit **direct to `main`**, without review latency, when the commit
touches **only** paths inside:

```
PROOFS/<FULL_SHA>/<ROW-ID>/**          ← their own row only
```

Rules:

- **One commit per row** (or per tightly-related sub-row group). Easier to review, easier
  to revert one row's evidence without disturbing others.
- Commit message names the row and binds the round:
  `PROOFS/<sha_short>/R-XX: <verdict-shape> — refs karmaterminal/karmaterminal-openclaw-docs#451`
- Row commits **add** files. They do not rewrite another row's artifacts and do not
  retro-edit a previously committed attempt; a correction is a new run directory plus a
  note in the row-root `EVIDENCE.md`.
- Rebase-before-push (`git pull --rebase`) so concurrent row commits from six seats
  never conflict — they cannot, because their path sets are disjoint by construction.

### 7.2 Scribe-only files

These are **exclusively** the foreground scribe's, and a row commit that touches them is
reverted on sight:

```
PROOFS/INDEX.json
PROOFS/<FULL_SHA>/proofs-manifest.json
PROOFS/<FULL_SHA>/README.md          ← the verdict board
PROOFS/<FULL_SHA>/METHOD.md
PROOFS/<FULL_SHA>/RESOLVED-SHA.md
PROOFS/<FULL_SHA>/ARTIFACTS.md
PROOFS/publication-validation/<FULL_SHA>/**
```

Rationale is mechanical, not hierarchical: `INDEX.json::rollup` must equal the tally over
`proofs-manifest.json::rows[].state` or `validate-corpus.mjs --index` fails
(`rollup-matches-manifest`). Six princes editing a shared counter concurrently guarantees
a red board and merge conflicts on the one file everyone needs. Serialising *only* those
files through the scribe is what lets every other row commit be lock-free.

This mirrors the existing rule in `CONTRIBUTING-ROWS.md`: *"Do not edit
`PROOFS/INDEX.json` or `PROOFS/<sha>/proofs-manifest.json` from a row PR."*

### 7.3 What the prince does instead of editing shared files

The prince reports their row's proposed state in the **issue**, and the scribe folds it.
The row's own `row-result.json` + row-root `EVIDENCE.md` are the machine-readable
proposal; the manifest entry is the scribe's transcription of the reviewed decision.

---

## 8. Review and fold

1. **Reviewer (not the row prince)** reads `EVIDENCE.md` + receipts against the row
   manifest's declared expectation: `classification`, `requiresLiveGatewayToken`,
   `requiresTargetSessionKey`, `requiresCandidateSha`,
   `requiresExternalAgentOrToolInvocation`, `sameSessionConcurrencySafe`,
   `expectedArtifactClass`, `requiredReceipts`, `foldRequiresReview: true`.
2. **Both-forms check.** For `continue_work` / `continue_delegate` rows, a row proving
   only the typed tool **or** only the token/bracket surface is `INCOMPLETE`, not `pass`.
   The tool surfaces as `runOutcome.continueWorkRequest`; the bracket is parsed from
   finalized reply text (`tokens.ts:parseContinuationSignal`) — partially independent
   code paths, and lightContext subagents have no tool at all. `request_compaction` is
   tool-only and needs no bracket sibling.
3. **Surface-provenance check.** A continuation token inside a `message` tool body is
   **not** token proof. The row must record which surface carried the token
   (raw assistant final text vs message-tool body). The reference corpus's `R-CD-TOKEN`
   is the cautionary receipt: `surface_class: "message-body"`, `dispatched: false`, zero
   behavioral fire.
4. **Trace check.** Trace-required rows need raw public-safe Tempo JSON with valid
   fixed-width non-zero IDs, unique attribution, and row-specific topology. A span that
   is not status OK is a genuine `partial` — do not infer topology or manufacture
   receipts (`tempo-recovery-review.json::disposition`).
5. **Scribe folds**: appends/updates the `rows[]` entry (`row`, `title`, `owner`,
   `state`, `dir`, `evidence_doc`, `summary`, `test_cases_executed`, `traces[]`,
   `supporting_docs[]`, `notes`, `fired`), recomputes `rollup`, updates the README
   verdict board, then:

```bash
node tools/k6-proofs/scripts/validate-corpus.mjs --sha <FULL_SHA>
node tools/k6-proofs/scripts/validate-corpus.mjs --index      # green is MANDATORY
```

6. **Fold is incremental.** The scribe folds each reviewed row as it lands; the corpus is
   valid after every fold, never only at the end. `capture_sha` must equal the directory
   name, every `evidence_doc` and `dir` must exist on disk, and every declared state must
   be in `{pass, partial, thin, fail, honest_limit, missing}`.
7. **No promotion beyond receipts.** Candidate runner output is *candidate evidence*.
   `PASS-candidate` is not `pass`. The reference round's 26 candidate passes folding to
   2 canonical passes is the contract working correctly, not a bug — but it is also the
   signal that the *receipt* pipeline, not the product, was the round's real failure.

---

## 9. Halt-state vs row-local vs family-local failure

The default posture is **continue**. A round halts only when continuing would produce
data that is known-invalid.

### 9.1 Row-local failure — continue the round

Scope: this row, this seat, this attempt. Examples: a missing Tempo trace, a
seat-specific tool-inventory policy denying `session_status`
(reference corpus `R-OBS-1`, docs issue #439), a late wake, an interrupted attempt, a
withheld-by-secret-scan artifact.

Action: classify honestly (`partial` / `fail`), commit the artifacts, file the row for
review, **and keep every other row running**. A row-local failure never justifies pausing
a different prince.

### 9.2 Family-local failure — halt one family, continue the rest

Scope: every row sharing a surface, fixture, scenario helper, or gate. Examples: the
pre-dispatch surface gate misclassifying the token carrier for every `*-TOKEN` row; a
shared `continuation.delegate.dispatch` span-status contract rejecting every delegate
row; the compaction write-lock path breaking, taking down `R-RC-1` and `R-RC-2`.

Action: the scribe moves **only the affected family** to `swim`, opens a
`karmaterminal/openclaw` regression issue (§10), and explicitly re-dispatches the
unaffected families. Already-collected artifacts for the swum family stay committed as
evidence of the defect.

Detection heuristic: **two or more rows, on two or more seats, failing at the same
named receipt or the same gate string.** One seat failing alone is row-local until a
second seat reproduces it.

### 9.3 Halt-state — stop dispatching new fires round-wide

A halt-state exists when one of these is true:

- **Identity is wrong.** The candidate SHA does not carry the feature under test (G3 = 0),
  or the corpus pin, `INDEX.json::current_sha`, and
  `proofs-manifest.json::capture_sha` disagree. Every fire under a wrong pin is void.
- **Allocation authority conflicts.** `INDEX.json`, `proofs-manifest.json::dispatch_allocation`,
  and the corpus `README.md` disagree about who owns what. `PROOF-CORPUS-METHOD.md` is
  explicit: stop dispatch, retain every already-executed artifact **without refiring**,
  repair the exact-SHA corpus, then resume.
- **The redaction boundary failed.** A secret, private session body, or user content
  reached a committed artifact. Rotate, purge, then resume.
- **The evidence pipeline is producing unreadable or falsely-passing artifacts.** e.g.
  the writer emitting `PASS-candidate` while mandatory receipts are absent. Continuing
  manufactures a corpus nobody can trust.
- **The candidate is being rebuilt/force-pushed mid-round.** The proof SHA must be the
  SHA that will be presented; if code changes, rerun or explicitly classify the drift.

A halt-state is **declared in writing** by the scribe on issue #451, naming the trigger,
the affected rows, and the resume condition. Halt means *stop opening new fire windows*.
It does **not** mean:

- delete or amend already-collected artifacts;
- abandon in-flight fires — let them terminalize and write their receipt;
- close row issues; they move to `swim` and keep their history.

**Nothing collected is lost by a halt.** That is the whole point of §7.1's disjoint
commit boundaries: a halt freezes dispatch, not the corpus.

---

## 10. Product / integration / harness regressions

When a row exposes a defect that is **not** specific to one prince's seat state, the
prince opens an issue in `karmaterminal/openclaw` (harness/docs-only defects go to
`karmaterminal/karmaterminal-openclaw-docs`, as #438 and #439 did in the reference
round), using `analysis/project86-regression-triage-template.md`, and **continues with
their unaffected rows**.

Non-trivial means any of:

- reproducible on ≥2 seats, or on 1 seat with a clear code-path explanation;
- a wrong-lane / wrong-gate defect (the `R-CW-DELEGATE-CHILD-LIVE` class: a gate
  consulting a lane the actor does not contend for);
- a receipt/trace contract the product cannot satisfy as specified;
- a harness defect that would silently mislabel product behavior (the `R-CD-TOKEN`
  surface-gate and `R-OBS-STATUS` stale-source-path classes).

Trivial-and-local (a seat's own stale config, a missing local binary, an expired token)
is fixed in place and noted in the row issue — no upstream issue.

Discipline:

- The issue link goes into the row's `EVIDENCE.md` **and** the row issue, so the corpus
  is self-explaining.
- Filing an issue **never** blocks unaffected rows. The round continues; only the
  affected row/family changes status.
- The regression issue does not change the row's verdict. A row that observed erroneous
  product behavior with complete receipts is `fail` (a real, valuable result); a row that
  could not observe anything is `partial`.

---

## 11. Retry, refire, and interrupted attempts

**Baseline: each allocated row fires exactly once.**
(`proof_requirements.no_refire`: *"Each allocated row fires exactly once unless a
mechanically proven non-fire or explicit group authorization permits replacement."*)

### 11.1 The three cases

| Case | Definition | Authorization | Effect on one-fire budget |
| --- | --- | --- | --- |
| **Mechanically proven non-fire** | The attempt provably stopped *before* any behavioral effect: a pre-execution gate, a guard rejection, a readiness failure, an artifact-dir mode gate. Zero product state touched, zero artifacts from the body. | **None needed.** Prince re-runs, and ledgers the non-fire with its exact error string. | Not consumed |
| **Interrupted attempt** | The runner exited before a terminal result; consumption state is unknown. | **Scribe authorization required.** | Consumed unless proven otherwise |
| **Refire of a consumed attempt** | The behavior fired and produced a terminal result the owner dislikes. | **Explicit group authorization.** Default answer is no. | Already consumed |

The reference corpus's `R-CW-5`/`R-CW-6` fixtures are the canonical non-fire example:
first invocations exited 2 at `artifact dir must not be group/world accessible (mode 0700
required)` with empty stdout, before readiness writes, worktrees, module evaluation, or
fixture state — source-reviewed and ledgered as mechanically proven non-fires. The
replacements are the sole behavioral executions.

### 11.2 Interrupted attempts must stay visible

An interrupted attempt is **never** deleted and never quietly re-run. Write the receipt:

```bash
node tools/k6-proofs/scripts/write-interrupted-run-result.mjs \
  --run-dir <run-dir> --row R-CD-TOKEN \
  --candidate-sha <40-hex> --runtime-sha <40-hex> \
  --attempt-hash <16-hex> --nonce-hash <16-hex> \
  --phase <phase> --cause <cause>
```

It emits `interruption-receipt.json`
(`openclaw.k6.r-cd-token.interruption-receipt.v1`) with `proofTerminal: false`,
`consumptionState: "unknown-possibly-consumed"`, `automaticRetryAllowed: false`,
`candidateOutcome: "PARTIAL-candidate"`, and rewrites `run-result.json` with
`terminal: false` and the full `review.pendingReceipts` list. It is written with the `wx`
flag — it **cannot** be overwritten by a later run, by design.

Consequences:

- `automaticRetryAllowed: false` means **no automation may retry it**. A human/scribe
  decision is required.
- The interrupted run directory is committed as-is. A subsequent authorized attempt goes
  in a **new** `k6-run-<timestamp>` directory; both remain in the corpus and both are
  listed in the row's `supporting_docs[]`.
- A refire authorization is recorded in the row issue with: who authorized, why the prior
  attempt is non-terminal or a proven non-fire, and what changed to make the retry
  meaningful.

### 11.3 What is never a reason to refire

- A `verdict-reconciliation.json` disagreement between the VU-emitted `VERDICT:` line and
  a `handleSummary()` verdict. The runner prefers the VU line because k6 summary
  callbacks cannot read mutable VU-local evidence. This is a harness-classification
  receipt, full stop.
- A missing Tempo trace. Post-run **collector retry** is allowed and encouraged
  (`retryPolicy: "post-run collector retry only; no behavioral row reruns"`); refiring the
  behavior to chase a trace is not.
- A `partial` you would prefer to be a `pass`.

---

## 12. Verdict vocabulary and the sole HONEST_LIMIT exception

Corpus states (validator-enforced): `pass`, `partial`, `thin`, `fail`, `honest_limit`,
`missing`. Candidate states (runner): `PASS-candidate`, `PARTIAL-candidate`,
`FAIL-candidate`, `HONEST-LIMIT-candidate`.

### 12.1 The exception

> `HONEST_LIMIT` is valid for **`R-RC-2` only**, and only when an exact live receipt
> proves `request_compaction` was denied **because context pressure remained below the
> compaction threshold**.

That receipt must be structured and invocation-bound: the live `request_compaction`
call, the rejection, and the machine-readable reason identifying the threshold guard
(the reference Silas arm cites `guard=context_threshold`). A journal line, a screenshot,
or narrative prose is not the receipt.

Why this one row: `R-RC-2`'s whole assertion is "over-threshold `request_compaction` is
ACCEPTED". If the seat is genuinely below threshold, the product's *correct* behavior is
to refuse — the gate engaging **is** the observation. There is no product defect to
report and no amount of retrying the same seat state changes it. The substrate condition
itself is the proof.

### 12.2 Why generic context pressure is incomplete everywhere else

For every other row, "the seat had high/low context pressure" explains why *you could not
observe* the behavior; it says nothing about whether the behavior *is correct*. That is
the definition of `PARTIAL`: the row's assertion was never evaluated.

Concretely:

- **`R-RC-1`** asserts the below-threshold **REJECT** path. A below-threshold refusal is
  its expected `pass`, not a limit. If `R-RC-1` cannot fire, that is `partial` (or a
  documented `SUBSTRATE-FINDING.md` with the full gate-stack receipts and a byte-identity
  cross-walk proving it is not a cure regression) — never `honest_limit`.
- **`R-CW-*` / `R-CD-*`** assert wake, chain, fan-out, delegate, and token behavior. None
  of them is *about* compaction thresholds. Context pressure that prevents the fire leaves
  the assertion unevaluated → `PARTIAL`, and the row must be retried when the seat allows.
- **A subagent-policy gate barring `request_compaction`** (leaf subagents denied the tool)
  is likewise not `honest_limit` on any row. It is either the safety surface working
  as-designed — evidence for a *different*, explicitly-scoped safety row — or a
  `PARTIAL` for the row that needed the tool and could not use it. Reusing `R-RC-2`'s
  exception for it would launder "we couldn't test it" into "we tested it and it's fine".
- **Missing model, lifecycle, trace, journal, correlation, or scanner receipts** are
  `PARTIAL` and must not be retro-justified
  (`CONTRIBUTING-ROWS.md`: *"Every other missing seat, trace, model, lifecycle, or
  scanner receipt remains PARTIAL and must not be retro-justified."*).

**No continuation, model-routing, or token row may use `honest_limit`.** If a row is
tempted toward it, the correct outputs are: a `PARTIAL` state, a
`SUBSTRATE-FINDING.md` if the PASS-shape is structurally blocked, and a regression issue
if the blockage is a product/harness defect.

### 12.3 `fail` vs `partial`

- `fail` — the assertion was evaluated and the product did the wrong thing, **or** an
  authoritative identity mismatch exists in the receipts. `fail` is a *result*; it is
  preserved, not reclassified. The reference corpus preserved `R-OBS-1`'s explicit FAIL
  even though an independent arm passed the same row, precisely because a primary
  required-tool precondition failure cannot be averaged away by a comparator.
- `partial` — the assertion was not fully evaluated, or authority/receipts are missing.
- `thin` — evidence exists and supports the assertion but below the round's bar
  (e.g. single-form coverage on a both-forms row). Use sparingly; prefer `partial`.
- `missing` — never attempted. Kept in the denominator so the round cannot shrink its
  own scope.

---

## 13. Evidence assembly checkpoints and the final digest

The corpus is assembled **incrementally and deterministically**, never in one end-of-round
scramble.

| Checkpoint | Trigger | Scribe action | Gate |
| --- | --- | --- | --- |
| **C0 — seed** | Before Wave 1 | Create `PROOFS/<FULL_SHA>/` with `README.md`, `METHOD.md`, `RESOLVED-SHA.md`, `ARTIFACTS.md`, and a seed `proofs-manifest.json` listing **every** required row at `state: "missing"`, plus `required_rows[]` and `dispatch_allocation`. Point `INDEX.json` at the new SHA. | `validate-corpus.mjs --index` exit 0 with rollup `missing = total_rows` |
| **C1 — post-Wave-1** | All critical-first-wave rows reviewed | Fold Wave 1 rows; publish the harness-defect list found in Wave 1 | `--index` exit 0; Wave 2 dispatch is blocked until this is green |
| **C2 — rolling** | Each reviewed row | Fold that row; recompute rollup; update the README board | `--index` exit 0 after **every** fold |
| **C3 — serialized tail** | `R-RC-1`/`R-RC-2` resolved | Fold compaction family | `--index` exit 0 |
| **C4 — final digest** | All rows terminal (`Done` or closed at honest state) | Final digest, below | `--sha` **and** `--index` exit 0; secret scan clean |

### 13.1 Final digest — scribe's closing responsibilities

1. `proofs-manifest.json` is a **generated mirror** of the README verdict board — same
   rows, same order, same states — not a hand-written summary. `rollup` is the tally.
2. `INDEX.json` points `current_sha`, `corpus_path`, `manifest_path`, `readme_path`,
   `validation_path` at the new candidate, with a matching `rollup`. Never leave it on a
   historical corpus.
3. An `execution-summary.json`-class receipt records one-fire accounting: total attempts
   including preflight, unique canonical rows, duplicates, refires, runner posture
   *before* review, and the conservative published rollup. Divergence between runner
   posture and published rollup is the round's own honesty measure — publish both.
4. A recovery-review receipt (`tempo-recovery-review.json` class) records post-run
   collector retries, `behaviorRefired: false`, per-row outcome/reason, and any rows that
   could not be retried at all.
5. If two or more arms ran, publish a read-only reconciliation crosswalk
   (`E` / `S` / combined per row, with an explicit comparison class) and state the
   combined floor. **Divergence is not averaged.** A primary `fail` stands against a
   comparator `pass`.
6. `publication-validation/<FULL_SHA>/` carries `file-manifest.json`, `secret-scan.json`,
   `publication-plan.json`, `invariants.json`.
7. Final gate, pasted into issue #451:

```bash
node tools/k6-proofs/scripts/validate-corpus.mjs --sha <FULL_SHA>
node tools/k6-proofs/scripts/validate-corpus.mjs --index
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
```

---

## 14. Acceptance mapping

| Acceptance criterion | Where satisfied |
| --- | --- |
| A prince can execute and commit a row without touching shared index/manifest files | §7.1 disjoint row paths; §7.2 scribe-only list; §7.3 issue-reported state proposal |
| A single row failure cannot silently stop the proof round | §9.1 row-local = continue; §10 file-and-continue; §2 only the scribe changes status, in writing |
| A true cross-cutting regression can explicitly halt affected rows without losing data | §9.2 family-local `swim`; §9.3 halt = stop dispatch, never delete; §11.2 interrupted attempts committed as-is |
| The scribe can assemble the exact-SHA corpus incrementally and validate deterministically | §13 C0–C4 with `--index` green after every fold; §8.6 incremental fold |
| No secret values or private session material are copied | §6.3 redaction boundary; §6.4 pre-commit checks; §13.1.6 publication secret scan |

---

## 15. Open items and recorded uncertainties

1. **`R-RC-2` concurrency contradiction.** `manifests/r-rc-2.json` says
   `sameSessionConcurrencySafe: true`; `SAFETY-ROWS.md` mandates serialization for the
   whole `R-RC-*` family. This contract rules **serialized** (fail-closed) and asks for a
   docs issue to reconcile. Not resolved here.
2. **Row-id skew between catalog and corpus.** `list-runnable-rows.mjs --all` exposes
   `R-CW-5A` / `R-CW-6A` (static preflight rows) which are not members of the reference
   corpus's 35-row `required_rows`. The round must publish which denominator it cites
   (`PROOF-RUN-METHOD.md` §1 already requires this) before Wave 1.
3. **`gateway-reload.yml` does not exist in this repository.** Any future live-mutating
   cap row must name an available, approved reload mechanism before use.
4. **`R-CW-ACTIVE-OVERLAP` and `R-CONTINUATION-MIXED-SURFACE-FANOUT`** are defined in
   `RUNBOOKS/PROOF-CORPUS-METHOD.md` but are not in the reference corpus's
   `required_rows` and have no manifest under `tools/k6-proofs/manifests/`. If project 86
   includes them, they need a manifest + scenario before dispatch (§5 rung A4 alone is
   not sufficient for a row with no declared receipt contract).
5. **Project 86 field set** currently has no `Row`, `Seat`, or `Wave` custom fields; this
   contract therefore carries wave/seat/row identity in the **issue body** (see the issue
   template) rather than in project fields. Adding those fields later would be an
   improvement, not a prerequisite.
