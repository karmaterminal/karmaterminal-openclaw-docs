# Project 86 proof-row issue template

Ready for direct use by the foreground scribe. **One issue per proof row. One accountable
prince per issue.** Copy the block below, fill every `<...>`, and open it in
`karmaterminal/karmaterminal-openclaw-docs`. Governing contract:
[`analysis/project86-proof-round-contract.md`](project86-proof-round-contract.md).

Scribe pre-flight before opening the issue:

- The row is in `PROOFS/<FULL_SHA>/proofs-manifest.json::required_rows`.
- The row's owner matches `proofs-manifest.json::dispatch_allocation` — **not** the
  generic owner table, not a historical artifact, not a chat message. If those sources
  conflict: stop dispatch, retain executed artifacts without refiring, repair the corpus.
- `tools/k6-proofs/manifests/<row>.json` exists and its `liveRunSafety` block is filled.
- Title format: `[P86] <ROW-ID> — <one-line behavior> (<seat>)`
- Project 86 `Status` = `Todo`, assignee = the accountable prince.

**Never put a credential in the issue body, the command block, or any pasted output.**
Use `***` for token placeholders exactly as shown.

---

## Template — copy from here

````markdown
## Row

| Field | Value |
| --- | --- |
| Row id | `<ROW-ID>` |
| Wave | `<0 harness / 1 critical-first / 2 parallel bulk / 3 serialized tail>` |
| Accountable prince | `<@handle>` (canonical owner: `<emoji + seat-name>`) |
| Executing seat | `<cael-dgx \| ronan-dgx \| silas-lothric \| elliott-legion \| emeric-nuc \| rune-rog-ally>` |
| Substitution? | `<no \| yes — substituting for <canonical-owner> per <unavailability-reason>>` |
| Candidate SHA (40-char) | `<FULL_SHA>` |
| Docs authority commit | `<docs-sha>` |
| Row manifest | `tools/k6-proofs/manifests/<row>.json` |
| Scenario | `tools/k6-proofs/scenarios/<scenario>.js` |
| Transport / class | `<websocket \| offline \| process-local \| github-source-contract>` / `<k6-runnable \| orchestration-required \| static-preflight-only>` |
| Same-session concurrency safe | `<true \| false>` |
| Serialization | `<none \| same-session lock \| R-RC family serialized, R-RC-1 must resolve first>` |
| Umbrella | karmaterminal/karmaterminal-openclaw-docs#451 |
| Project | https://github.com/orgs/karmaterminal/projects/86 |

## Aim

**What this row asserts:** <one paragraph — the DESIRED behavior, stated positively.>

**What counts as ERRONEOUS:** <the specific wrong behavior this row would catch.>

**Both-forms mandate:** <required / not applicable>
- For `continue_work` / `continue_delegate` rows this row must exercise <the typed tool
  `<tool>()` | the token form `<CONTINUE_WORK[:N]>` / `[[CONTINUE_DELEGATE: ...]]`>.
  Tool-form sibling row: `<ROW-ID or n/a>`. Token-form sibling row: `<ROW-ID or n/a>`.
- A row proving only one surface is **INCOMPLETE**, not `pass`.
- `request_compaction` is tool-only; no bracket sibling exists.

**Surface provenance:** a continuation token inside a `message` tool body is **not**
token proof. Record which surface carried the token (raw assistant final text vs
message-tool body).

**Spec anchor:** `RUNBOOKS/CONTINUATION-BEHAVIOR-SPEC.md` §<section> ·
`RUNBOOKS/PROOF-CORPUS-METHOD.md` row table.

## Pre-fire identity gate (paste output into this issue before firing)

```bash
CANDIDATE_SHA=<FULL_SHA>

# G1 exact 40-char lowercase hex, never trimmed
[[ "$CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ ]] && echo "G1 ok"

# G2 this seat's gateway must actually be on the candidate
openclaw --version
git -C ~/flesh_beast_tmp/openclaw rev-parse HEAD          # must equal $CANDIDATE_SHA

# G3 the candidate must carry the feature under test
gh api repos/karmaterminal/openclaw/contents/<feature-source-path>?ref="$CANDIDATE_SHA" \
  --jq '.content' | base64 -d | grep -c '<feature-marker>'   # want > 0

# G4 seat readiness (public-safe: env presence booleans only)
OPENCLAW_CANDIDATE_SHA="$CANDIDATE_SHA" \
OPENCLAW_SEAT_NAME=<seat> \
OPENCLAW_SESSION_KEY=<scratch-or-disposable-session> \
OPENCLAW_GATEWAY_TOKEN=*** \
  node tools/k6-proofs/scripts/seat-readiness-preflight.mjs --json \
  > /tmp/<row>-seat-readiness.json

# G5 docs authority frozen for this round
git rev-parse HEAD
```

- **G2 ≠ G1** → deploy the seat first. Do **not** fire; a fire in this state is void.
- **G3 = 0** → candidate lacks the feature. Escalate to scribe as a **halt-state**.
- **G4 ≠ `PASS-candidate`** → stay in `in_coding_agent`; this is setup/PARTIAL, not
  product evidence.

## Exact command

<!-- Keep ONE of A1/A2/A3 as the primary and delete the others. -->

**A1 — workflow dispatch (default)**

```bash
gh workflow run project81-k6-proof.yml \
  --repo karmaterminal/openclaw-bootstrap \
  -f target_prince=<cael|ronan|silas|elliott|emeric|rune> \
  -f candidate_sha=<FULL_SHA> \
  -f rows=<ROW-ID> \
  -f docs_ref=<docs-sha> \
  -f session_selector=<scratch-selector> \
  -f dry_run=false \
  -f create_disposable_sessions=true
```

**A2 — local runner on the seat**

```bash
# same-session lock guard first (fail-closed; required for sameSessionConcurrencySafe:false rows)
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_SESSION_KEY=<target-session> \
  node tools/k6-proofs/scripts/live-run-guard.mjs \
    --manifest tools/k6-proofs/manifests/<row>.json --json

cd tools/k6-proofs
K6_PROOF_OUT_DIR=/tmp/p86-<row> \
OPENCLAW_GATEWAY_WS=ws://127.0.0.1:18789 \
OPENCLAW_GATEWAY_TOKEN=*** \
OPENCLAW_CANDIDATE_SHA=<FULL_SHA> \
OPENCLAW_SEAT_NAME=<seat> \
OPENCLAW_ROW_MANIFEST=manifests/<row>.json \
OPENCLAW_CREATE_DISPOSABLE_SESSION=true \
OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true \
  ./scripts/run-proofs.sh <ROW-ID> <FULL_SHA> 2>&1 | tee /tmp/<row>-output.txt
```

**A3 — scenario + post-processor (runner wrapper itself is broken)**

```bash
OPENCLAW_ROW_MANIFEST=tools/k6-proofs/manifests/<row>.json \
OPENCLAW_CANDIDATE_SHA=<FULL_SHA> \
OPENCLAW_GATEWAY_TOKEN=*** \
  k6 run tools/k6-proofs/scenarios/<scenario>.js 2>&1 | tee /tmp/<row>-output.txt

node tools/k6-proofs/scripts/evidence-writer.mjs \
  --input /tmp/<row>-output.txt \
  --row <ROW-ID> \
  --seat <seat> \
  --sha <FULL_SHA> \
  --manifest tools/k6-proofs/manifests/<row>.json \
  --seat-readiness /tmp/<row>-seat-readiness.json
```

<!-- R-CW-5 / R-CW-6 only: process-local fixtures. Never lower fleet config, never
     restart a gateway. gateway-reload.yml does not exist in this repository.
node tools/k6-proofs/scripts/run-cost-cap-fixture.mjs   # R-CW-5
node tools/k6-proofs/scripts/run-max-chain-fixture.mjs  # R-CW-6
-->

## Fallback

Take the highest rung that works and **record which rung you used** in `EVIDENCE.md`.

| Rung | Path | Use when |
| --- | --- | --- |
| A1 | workflow dispatch | default |
| A2 | `run-proofs.sh` on the seat | workflow unavailable / needs local env |
| A3 | direct `k6 run` + `evidence-writer.mjs` | runner wrapper is the broken thing |
| A4 | **old-runbook manual form** | automation is broken in a way that would otherwise leave the row unproven |

**A4 manual form** (`RUNBOOKS/PROOF-CORPUS-METHOD.md`): fire the primitive by hand from
the seat, capture the journal `[continuation:…]` receipts, then pull the trace:

```bash
# find the trace id fired from your seat
curl -sG "${OPENCLAW_PROOFS_TEMPO_BASE_URL:-http://tempo.dandelion.cult}/api/search" \
  --data-urlencode 'q={ resource.service.name="<seat>-prince" && .gen_ai.tool.name="<continue_work|continue_delegate|request_compaction>" }' \
  --data-urlencode "start=$(date -d '8 hours ago' +%s)" \
  --data-urlencode "end=$(date +%s)" \
  | jq -r '.traces[] | .traceID'

# export the full span tree — this curl IS the required span-hierarchy export
curl -sS "${OPENCLAW_PROOFS_TEMPO_BASE_URL:-http://tempo.dandelion.cult}/api/traces/<TRACE_ID>" \
  -o PROOFS/<FULL_SHA>/<ROW-ID>/<seat>/k6-run-<ts>/artifacts/<descriptive>_trace.json
```

Then hand-assemble the run directory to the layout in "Expected receipts".

Fallback rules:
- Dropping a rung is a **reportable event**, not a private workaround. Record the failing
  rung, the exact error, and the rung used.
- A fallback row is not a lesser row — but it may not skip a receipt for convenience.
- Never invent a mechanism the repo does not have; never lower fleet config or restart a
  gateway to make the row pass.

## Expected receipts

Artifact root: `PROOFS/<FULL_SHA>/<ROW-ID>/<seat>/k6-run-<UTC-timestamp>/`

| File | Required | Note |
| --- | --- | --- |
| `seat-readiness.json` | yes | must be `PASS-candidate` |
| `EVIDENCE.md` | yes | writer-generated schema — do not hand-edit the schema |
| `k6-summary.json` | yes | no raw unredacted events |
| `row-result.json` | yes | `PASS-candidate` / `PARTIAL-candidate` / `FAIL-candidate` (`HONEST-LIMIT-candidate` only for R-RC-2) |
| `gateway-events.ndjson` | unless no frames | redacted WS frames; note absence in `EVIDENCE.md` |
| `evidence-redaction.json` | yes | `openclaw.k6.public-evidence-redaction.v1` |
| `gateway-journal.log` + `-capture.json` + `-redaction.json` | live rows | bounded, public-safe row window |
| `artifacts/<descriptive>_trace.json` | trace-required rows | raw public-safe Tempo JSON; **no `pass` without it** |
| `interruption-receipt.json` | interrupted attempts | `write-interrupted-run-result.mjs`; write-once (`wx`) |

Row-specific mandatory receipts (from `manifests/<row>.json::liveRunSafety.requiredReceipts`):

- [ ] `<receipt-1>`
- [ ] `<receipt-2>`
- [ ] `<receipt-3>`

`EVIDENCE.md` must record: row id, deployed SHA, session, provider, seat, run id,
timestamp; candidate outcome + which checks did/did not fire; the receipt table; an
explicit **"no secrets"** line; the live-run safety classification, expected artifact
class, required receipts, same-session concurrency safety, and `foldRequiresReview: true`.

**Redaction:** zero secrets in artifacts, commits, or this issue. If a token reaches a
log — rotate first, then clean, then push. Screenshots are supplemental and never satisfy
a JSON trace requirement.

## Commit boundary

**You may commit direct to `main`**, but only paths under:

```
PROOFS/<FULL_SHA>/<ROW-ID>/**
```

- One commit per row. Message:
  `PROOFS/<sha_short>/<ROW-ID>: <verdict-shape> — refs karmaterminal/karmaterminal-openclaw-docs#451`
- `git pull --rebase` before pushing.
- Row commits **add** files; corrections go in a **new** `k6-run-<ts>` directory plus a
  note in the row-root `EVIDENCE.md`.

**Do NOT touch** (scribe-only — a row commit that edits these is reverted on sight):

```
PROOFS/INDEX.json
PROOFS/<FULL_SHA>/proofs-manifest.json
PROOFS/<FULL_SHA>/README.md
PROOFS/<FULL_SHA>/METHOD.md
PROOFS/<FULL_SHA>/RESOLVED-SHA.md
PROOFS/<FULL_SHA>/ARTIFACTS.md
PROOFS/publication-validation/<FULL_SHA>/**
```

Propose your row's state **in this issue**; the scribe transcribes it into the manifest.

Pre-commit checks:

```bash
git diff --cached | grep -nEi 'OPENCLAW_GATEWAY_TOKEN|bearer |authorization:|session_key' && echo "STOP"
grep -rnE 'pending_push|pending push|upload-blame|TODO-UPLOAD|pending_upload' PROOFS/<FULL_SHA>/<ROW-ID>/ && echo "STOP"
node tools/k6-proofs/scripts/validate-corpus.mjs --sha <FULL_SHA>
```

## Failure triage

**Default posture: continue. Classify honestly, commit artifacts, keep the round moving.**

1. **Setup / harness / coordination failure** — guard reports an active same-session lock,
   missing env, k6 version mismatch, unreachable gateway, seat not on the candidate.
   → **Not row evidence.** Fix and re-run: this is a *mechanically proven non-fire*, the
   one-fire budget is **not** consumed. Ledger the exact error string in this issue.

2. **Row-local failure** — missing trace, seat-specific tool-policy denial, late wake,
   withheld-by-secret-scan artifact.
   → Classify `partial` (assertion not evaluated) or `fail` (assertion evaluated, product
   wrong). Commit artifacts. **Do not pause any other row.**

3. **Family-local failure** — ≥2 rows on ≥2 seats failing at the same named receipt or
   gate string (e.g. every `*-TOKEN` row stopping at the surface gate; every delegate row
   rejected on `continuation.delegate.dispatch` span status).
   → Comment here, tag the scribe, open a regression issue (below). The scribe moves
   **only that family** to `swim` and re-dispatches the rest.

4. **Halt-state** — candidate lacks the feature (G3 = 0); INDEX / manifest / README
   allocation authority conflict; a secret or private session body reached a committed
   artifact; the evidence pipeline is emitting falsely-passing artifacts; the candidate is
   being force-pushed mid-round.
   → **Stop opening new fire windows.** Comment on #451. Let in-flight fires terminalize
   and write their receipts. **Delete nothing.** Rows move to `swim` with history intact.

5. **Non-trivial product / integration / harness regression** — reproducible on ≥2 seats,
   or 1 seat with a clear code-path explanation; a wrong-lane/wrong-gate defect; a receipt
   contract the product cannot satisfy; a harness defect that would silently mislabel
   product behavior.
   → Open an issue in `karmaterminal/openclaw` (docs/harness-only defects go to
   `karmaterminal-openclaw-docs`) using
   [`analysis/project86-regression-triage-template.md`](project86-regression-triage-template.md).
   Link it here and in `EVIDENCE.md`. **Then continue your unaffected rows.**
   Filing an issue does not change this row's verdict.

6. **Interruption** — the runner exited before a terminal result.
   → Write the receipt; do **not** silently re-run:

```bash
node tools/k6-proofs/scripts/write-interrupted-run-result.mjs \
  --run-dir <run-dir> --row <ROW-ID> \
  --candidate-sha <FULL_SHA> --runtime-sha <runtime-sha> \
  --attempt-hash <16-hex> --nonce-hash <16-hex> \
  --phase <phase> --cause <cause>
```

   `automaticRetryAllowed: false` — a scribe authorization is required before any retry.
   The interrupted directory is committed as-is; an authorized retry goes in a **new**
   `k6-run-<ts>` directory and both stay in the corpus.

**Never a reason to refire:** a `verdict-reconciliation.json` disagreement (harness
classification receipt); a missing Tempo trace (post-run **collector** retry is allowed —
behavioral reruns are not); a `partial` you would prefer to be a `pass`.

**Verdict discipline:** `HONEST_LIMIT` is valid for **`R-RC-2` only**, and only with a
structured live receipt proving `request_compaction` was denied because context pressure
remained **below** threshold. On every other row, context pressure, a barred
`request_compaction`, or any missing trace/model/lifecycle/journal/correlation receipt is
`PARTIAL` — never `honest_limit`, never retro-justified.

## Completion checklist

- [ ] Project 86 `Status` walked `Todo` → `in_coding_agent` → `In Progress` → `prince_review`
- [ ] Pre-fire identity gate G1–G5 pasted into this issue; G2 == G1; G3 > 0
- [ ] `seat-readiness.json` is `PASS-candidate`
- [ ] Same-session lock guard run (or row is documented concurrency-safe)
- [ ] Row fired **exactly once**; any prior attempt is a ledgered mechanically-proven non-fire
- [ ] Both-forms mandate satisfied, or explicitly N/A with the sibling row named
- [ ] Token-surface provenance recorded (raw final text vs message-tool body)
- [ ] All required receipts present and byte-readable; none promised
- [ ] Tempo trace JSON captured (or trace debt stated honestly and the row is not `pass`)
- [ ] Bounded, redacted gateway journal captured (or debt intentionally retained as PARTIAL)
- [ ] `EVIDENCE.md` carries the explicit "no secrets" line
- [ ] No secrets anywhere in artifacts, commits, or this issue; no stale `pending_push` /
      `upload-blame` / `TODO-UPLOAD` tokens
- [ ] `node tools/k6-proofs/scripts/validate-corpus.mjs --sha <FULL_SHA>` output pasted
- [ ] Artifacts committed direct to `main` under `PROOFS/<FULL_SHA>/<ROW-ID>/**` only
- [ ] Zero edits to `INDEX.json`, `proofs-manifest.json`, or corpus-root docs
- [ ] Proposed state stated here: `pass` / `partial` / `thin` / `fail` / `honest_limit`, with reasons
- [ ] Regression issue opened and linked, if applicable
- [ ] Reviewer (not the row prince) signed off
- [ ] Scribe folded the row; `validate-corpus.mjs --index` exit 0 pasted
- [ ] Status set to `Done` (or `swim` with the blocking issue named)
````

## Template — copy to here

---

## Scribe notes (do not paste into the issue)

- **Wave gating.** Do not open Wave 2 issues in `Todo` → `in_coding_agent` until every
  Wave 1 row has cleared `prince_review`. A shared harness defect found in Wave 1 is
  cheap; found in Wave 2 across six seats it is the historical splinter.
- **Denominator.** Publish which row denominator the round cites before Wave 1
  (`list-runnable-rows.mjs --all` includes `preflight` and the static `R-CW-5A`/`R-CW-6A`
  rows; the corpus `required_rows` may be a smaller set).
- **Never infer allocation** from the generic owner table in
  `RUNBOOKS/PROOF-CORPUS-METHOD.md`, a historical corpus, or a chat message. Only
  `proofs-manifest.json::dispatch_allocation` for the current SHA is live authority.
- **Seed first.** `PROOFS/<FULL_SHA>/proofs-manifest.json` should exist with every
  required row at `state: "missing"` before the first issue moves to `In Progress`, so
  the round's denominator cannot shrink.
- **A row that never leaves `Todo` folds as `missing`**, not dropped.
