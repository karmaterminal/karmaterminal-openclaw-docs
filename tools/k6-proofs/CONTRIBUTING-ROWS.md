# Contributing a row PR — k6 proofs

Checklist for a prince opening a row PR against `karmaterminal-openclaw-docs`.

The goal: **running a k6 proof is very little work beyond kickoff**. This page is the
short version of what each row PR must include so the coordinator can fold it
into `PROOFS/<sha>/` without back-and-forth.

## Before you start

1. **Claim the labelled issue on [Project 81](https://github.com/orgs/karmaterminal/projects/81)
   BEFORE doing row work.** Assign yourself. If you don't see it on the board, ping the
   coordinator — don't shadow-run.
2. **Run seat readiness before row fire.**
   The proof-standard k6 version and public-safe env contract live in
   [`seat-readiness.policy.json`](seat-readiness.policy.json). Run the helper and
   save the JSON beside your candidate artifacts:
   ```bash
   OPENCLAW_CANDIDATE_SHA="<40-char-sha>" \
   OPENCLAW_SEAT_NAME="<seat>" \
   OPENCLAW_SESSION_KEY="<target-session>" \
   OPENCLAW_GATEWAY_TOKEN="***" \
     node tools/k6-proofs/scripts/seat-readiness-preflight.mjs --json \
       > /tmp/seat-readiness.json
   ```
   A missing/mismatched k6 binary, missing required env, invalid candidate SHA, or
   unreachable checked gateway is `PARTIAL-candidate` / setup failure — not
   product behavior evidence. The report prints env presence booleans only; no
   token/secret values, prompt bodies, or raw gateway payloads are allowed.
3. **Verify the gateway you fire against is actually deployed to the corpus-pin SHA.**
   This is a PRE-FIRE gate the validator CANNOT do for you: `validate-corpus.mjs`
   checks that your *artifacts* are consistent with a SHA, but it cannot verify your
   running *gateway* is on that SHA. Confirm both, on the seat you will run from:
   ```bash
   # (a) what SHA is this seat's gateway actually running?
   openclaw --version            # or: git -C ~/flesh_beast_tmp/openclaw rev-parse HEAD
   # (b) does that SHA carry the feature under test? (example: continuation parser)
   gh api repos/karmaterminal/openclaw/contents/src/auto-reply/tokens.ts?ref=<that-sha> \
     --jq '.content' | base64 -d | grep -c CONTINUE_WORK   # want > 0
   ```
   The SHA is the identity of your proof; do not invent or trim it. If the gateway is
   on a different line than the corpus pin (e.g. `main` / an upstream-mirror SHA that
   lacks the feature), **deploy the seat first** — firing against a feature-less
   gateway produces rows that fail at the gateway-lacks-feature layer, not the harness
   layer, and the failure is easy to misread. The fleet can run mixed SHAs; check
   *your* seat, not someone else's.
4. Confirm secrets are in env, not on disk. `OPENCLAW_GATEWAY_TOKEN` and friends come
   from the seat's environment or GH Actions repo secrets — **zero secrets in source,
   manifests, evidence, or PR body**. If the token leaks into a log, rotate before
   pushing.
4. For any live row, fill or verify the manifest's `liveRunSafety` block before firing:
   `classification`, `requiresLiveGatewayToken`, `requiresTargetSessionKey`,
   `requiresCandidateSha`, `requiresExternalAgentOrToolInvocation`, `sameSessionConcurrencySafe`,
   `expectedArtifactClass`, `requiredReceipts`, and `foldRequiresReview:true`.
   `OPENCLAW_SESSION_KEY` must be explicit when the row mutates/wakes a session; do
   not rely on the `main` fallback for live continuation rows.
5. Run `node tools/k6-proofs/scripts/check-proof-contracts.mjs`. Every runnable
   scenario must emit evidence plus one summary verdict, and any intentionally
   unregistered scenario must have a specific entry in
   `scenario-contract-exceptions.json`.

## Running the row

Use the harness as documented in [`README.md`](README.md):

1. Optional preflight: `k6 run tools/k6-proofs/scenarios/preflight.js`.
2. Run the fail-closed guard before the live row (the wrapper does this automatically
   when `OPENCLAW_ROW_MANIFEST` is set):

   ```bash
   OPENCLAW_GATEWAY_TOKEN="***" \
   OPENCLAW_SESSION_KEY="<target-session>" \
     node tools/k6-proofs/scripts/live-run-guard.mjs \
       --manifest tools/k6-proofs/manifests/<row>.json --json
   ```

   If it reports missing token/session env or an active same-session lock, stop; the
   output is setup/coordination failure, not row evidence.
3. Run the row scenario with the manifest pointed via `OPENCLAW_ROW_MANIFEST` and the
   deployed SHA in `OPENCLAW_CANDIDATE_SHA`. Tee the output to a local file.
4. Post-process into proof artifacts with `evidence-writer.mjs` (or
   `postprocess-k6-summary.mjs` for the summary-driven path):

   ```bash
   node tools/k6-proofs/scripts/evidence-writer.mjs \
     --input /tmp/<row>-output.txt \
     --row <ROW-ID> \
     --seat <seat> \
     --sha <40-char-sha> \
     --manifest tools/k6-proofs/manifests/<row>.json
   ```

   The script writes into `PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/`.

## Required artifacts per row dir

Every `PROOFS/<sha>/<row>/<seat>/k6-run-<ts>/` directory must contain:

- `seat-readiness.json` — public-safe readiness report from
  `scripts/seat-readiness-preflight.mjs`. If this is not `PASS-candidate`, the row
  must stay setup/PARTIAL until the seat is fixed or the row issue declares a
  different expectation.
- `EVIDENCE.md` — candidate evidence document. Captures the run context, the
  candidate outcome, receipts table, and the review checklist (`evidence-writer.mjs`
  emits the right shape; do not hand-edit the schema).
- `k6-summary.json` — the structured k6 summary / evidence block (post-processor
  output; no raw unredacted events).
- `gateway-events.ndjson` — redacted gateway events, one JSON object per line. Skip
  only if the row genuinely captured no frames; note the absence in EVIDENCE.md.
- `row-result.json` — normalised outcome (`PASS-candidate` / `PARTIAL-candidate` /
  `FAIL-candidate`, plus `HONEST-LIMIT-candidate` only for `R-RC-2` when a structured
  receipt proves below-threshold `request_compaction` refusal).
- Trace JSON (e.g. Tempo dump) under `artifacts/` if the row produced one. Trace
  evidence is required before a continuation row can be folded as `pass`.

## EVIDENCE.md must record

- Row id, deployed SHA, session, provider, seat, run id, generated timestamp.
- Candidate outcome and the reason for it (which checks did/did not fire).
- Receipt table (tool/prompt accepted, task/child spawned, parent return, nonce,
  manifest loaded).
- A "no secrets" line — explicit statement that the captured artifacts contain no
  tokens, no prompt bodies, no user content.
- The live-run safety classification, expected artifact class, required receipts,
  same-session concurrency safety, and `foldRequiresReview:true`.
- For the sole `R-RC-2` HONEST-LIMIT outcome: the structured below-threshold
  `request_compaction` receipt. Every other missing seat, trace, model, lifecycle,
  or scanner receipt remains PARTIAL and must not be retro-justified.

## PR contract

- **PR body** includes:
  - the row issue link (Project 81 card),
  - the row id(s) covered,
  - the seat,
  - the deployed 40-char SHA (not abbreviated).
- **Run the validator and paste the output:**

  ```bash
  node tools/k6-proofs/scripts/validate-corpus.mjs --sha <40-char-sha>
  ```

  The PR is only review-ready when the validator exits 0 against the SHA you fired
  on. If the SHA is not yet folded into INDEX/manifests, fold-style integration
  PRs run `--sha` after the fold; row-only PRs that only add a row dir + EVIDENCE
  still paste the validator output for whichever SHA the artifacts target.

- **Zero secrets** anywhere in the diff. Grep your PR yourself for `OPENCLAW_GATEWAY_TOKEN`,
  bearer fragments, session keys, etc. If found, rotate the secret and remove from
  history before pushing.

- **Do not edit `PROOFS/INDEX.json` or `PROOFS/<sha>/proofs-manifest.json` from a row PR.**
  The coordinator (Silas) folds rows + regenerates INDEX/manifest in one integration
  PR after evidence review. Row PRs only **add** files under your row directory.

## What the coordinator does next

1. Reviews EVIDENCE.md + receipts against the manifest's declared expectation.
2. Folds the row into the corpus, regenerates INDEX/manifest, and runs
   `node tools/k6-proofs/scripts/validate-corpus.mjs --index` — green is mandatory
   before merge.
3. Any row that fires `pending_push`, `upload-blame`, `TODO-UPLOAD`, or similar
   "promise-of-artifact" wording is bounced back. Either the artifact exists or
   the row is not folded.

## See also

- [README.md](README.md) — harness usage, design principles, redaction boundary.
- [`validate-corpus.mjs`](scripts/validate-corpus.mjs) — invariants enforced at fold time.
- [Project 81](https://github.com/orgs/karmaterminal/projects/81) — row backlog.
