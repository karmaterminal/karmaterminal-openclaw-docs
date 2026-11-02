# GitHub Actions workflows — k6 PROOFS

## `k6-proof.yml` — proof-row kickoff (#127)

The **kickoff side** of the k6-PROOFS integration. A prince triggers a proof run
with `workflow_dispatch`; the gateway token is supplied as a **repo secret**, so
there are zero secrets in source. This is the "very little work from a prince
beyond kickoff" path.

Pairs with **#105** (the fold/validation side: `validate-corpus.mjs` +
`CONTRIBUTING-ROWS.md`). This workflow fires the row; #105 validates + folds the
candidate artifacts into the canonical corpus.


### Trigger (Actions tab → "k6 PROOF row" → Run workflow)

Inputs:

| Input | Default | Notes |
|-------|---------|-------|
| `scenario` | `preflight.js` | Scenario under `tools/k6-proofs/scenarios/`. |
| `row` | — | Row id for evidence (e.g. `R-CD-1`). Required when `dry_run=false`. |
| `manifest_path` | — | Optional row manifest under `tools/k6-proofs/manifests/`; enables manifest-driven mode. |
| `seat` | `ci-runner` | Seat identifier for the artifact layout. |
| `candidate_sha` | — | 40-char openclaw deploy SHA the proof runs against. Required (and hex-validated) when `dry_run=false`. |
| `gateway_ws` | `ws://127.0.0.1:18789` | Target gateway WS URL. The gateway runs on a **seat**, not the runner — point this at the reachable seat (a self-hosted runner on/near the seat is the typical shape). |
| `session_key` | `main` | Target session key. |
| `dry_run` | `true` | Preflight/dry mode: runs the scenario but writes **no proof verdicts** and uploads only the run log. |

### Modes

- **`dry_run=true` (default):** runs the scenario (use `preflight.js`), writes no
  verdicts, uploads the run log only. Use this to exercise the plumbing + confirm
  gateway reachability before any verdict-writing run.
- **`dry_run=false`:** runs the scenario, post-processes via
  `evidence-writer.mjs` into `PROOFS/<sha>/<row>/<seat>/k6-run-<ts>/`, uploads the
  candidate artifacts. All output is **CANDIDATE** status; human review (the #105
  validator + fold) promotes to canonical.

### Secret-safety properties

- Token is referenced only in the run step's `env:` from `secrets.OPENCLAW_GATEWAY_TOKEN`.
- No `echo` of the token, no `set -x`, no `printenv`; the registered secret is
  masked by the runner in logs.
- `evidence-writer.mjs` refuses to write artifacts containing unredacted event
  data (the harness redaction boundary), so committed/uploaded artifacts carry no
  secrets even on the verdict path.
- `permissions: contents: read` — least privilege; the workflow does not write to
  the repo (it uploads artifacts; the corpus fold is a reviewed step).

### Notes

- Proof rows are single-VU and serialized; `concurrency` keys on `seat`+`row` so
  the same row/seat does not run in parallel against the same session.
- The runner needs a network route to the target gateway WS. For seat-local
  gateways, run this on a self-hosted runner on/near that seat.

## `proof-pipe-dry-run.yml` — scheduled proof pipe, dry run only (#587)

The skeleton of the scheduled proof pipe designed in
[`tools/k6-proofs/docs/PROOF-PIPE-DESIGN.md`](../../tools/k6-proofs/docs/PROOF-PIPE-DESIGN.md):
Actions → Temporal → isolated proof gateway → evidence lane → docs PR. It runs
`tools/k6-proofs/scripts/proof-pipe-dry-run.mjs` and nothing else: it validates
the dispatch, resolves rows from `PROOFS/<corpus>/proofs-manifest.json::dispatch_allocation`
at the exact docs SHA, refuses consumed or possibly consumed rows, and prints the
plan and the receipts the pipe would collect. It fires no row and contacts no
seat, gateway or Temporal Service.

| Input | Default | Notes |
|-------|---------|-------|
| `product_sha` | — | 40-char runtime SHA the rows would fire against. |
| `docs_sha` | — | 40-char docs SHA: manifest, catalog and harness. |
| `corpus_sha` | blank | Pure corpus SHA for a composite runtime. |
| `rows` | `all` | `all`, `owner:<bucket>` or a row list; only narrows the allocation. |
| `trigger` | `manual` | `manual`, `nightly` or `on-deploy`. |
| `label` | blank | Workflow id label; blank is `<trigger>-<docs sha 8>`. |
| `dry_run` | `true` | `false` is refused: while `tools/k6-proofs/proof-pipe/hold.json` (or `vars.PROOF_PIPE_HOLD`) holds, and after, because no live leg is built. |

- **Cost:** `runs-on` is `vars.PROOF_PIPE_RUNS_ON`, default the ARC scale set
  `oc-4cpu-16gb`. The job's `if:` admits only an unset variable, a JSON list or
  string starting with an `oc-*` scale set, or a list starting with
  `"self-hosted"`, written without spaces. Anything else, a GitHub-hosted image
  or a Blacksmith runner included, skips the job before a runner is assigned,
  and the planner refuses it again. Grant this repository the ARC runner group
  before the first dispatch.
- **Secret-free and read-only:** `permissions: contents: read`, no secret, and
  dispatch inputs reach shell steps only through `env:`.
- **Artifact:** `proof-pipe-plan-<run id>-<attempt>` holds the plan as JSON
  (`openclaw.k6.proof-pipe-plan.v1`) and text; the job summary shows the text.
