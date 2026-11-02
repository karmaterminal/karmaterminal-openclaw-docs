# Scheduled proof pipe: Actions → Temporal → seat proof gateway → evidence lane → docs PR

Design for [docs#587](https://github.com/karmaterminal/karmaterminal-openclaw-docs/issues/587), plus a
dry-run skeleton that walks the stages without firing anything.

figs's direction (room msg 1566622869214199821, 2026-11-02, recorded on docs#587):

> proofs are largely non-disruptive, and a gh actions workflow to temporal to run that thing is highly
> desired. mai-code-2-flash briefed properly in a copilot lane running local to a prince could assemble
> the results, gather traces and logs, and arrange PR to karmaterminal-openclaw-docs -- that beats
> having to do it with prince paws

**Firing new rows stays under the bugs-first hold.** figs and 🕯 set the WIP limit, then 🌊 gives the go.
Building the pipe does not wait on that. Nothing in this document, the skeleton or its PR fires a row,
touches a seat, gateway or Temporal, or deploys.

Contents:

- [Named refs](#named-refs)
- [The pipe at a glance](#the-pipe-at-a-glance)
- [What exists today](#what-exists-today)
- [Stage (a): trigger](#stage-a-trigger)
- [Stage (b): hand-off](#stage-b-hand-off)
- [Stage (c): collection](#stage-c-collection)
- [Stage (d): assembly](#stage-d-assembly)
- [Stage (e): guards](#stage-e-guards)
- [The dry-run skeleton](#the-dry-run-skeleton)
- [Gaps](#gaps)
- [Open decisions for the princes](#open-decisions-for-the-princes)
- [Related work](#related-work)

## Named refs

The design reads these refs at these SHAs. It reads the other repositories only; it writes to none of them.

| what | repository | ref | SHA |
|---|---|---|---|
| base, and the harness the skeleton runs against | karmaterminal/karmaterminal-openclaw-docs | `main` | `7ca06bdb9b30cfe604fcdda60c115e5400924f59` |
| Actions ingress, Temporal Workflows, seat Activities | karmaterminal/temporal-thornfield-frond (ttf) | `main` | `1bf4404eeadd4353ed1175780612efb6a3f50972` |
| `deploy-gateway.yml` `stage_only`, `PROOF-CORPUS-METHOD.md` | karmaterminal/openclaw-bootstrap | `main` | `293d9f24ffad17ca8678a161b7ad3c9b2a2cf450` |
| `scripts/proof-gw/` launchers, corpus skill | karmaterminal/frond-scribe | `main` | `1f02c954ba183a69713da2bc34af7da9c13d8a15` |
| sibling candidate for #587 (Actions-only runner) | docs PR #588 | `rune/20261019/scheduled-k6-587` | `c392f8a456a663e2d4cc6b8630ff5619e4e605ca` |

A path below such as `ttf src/seat/proof-run.ts` means that file at the SHA above.

## The pipe at a glance

```text
 (a) trigger            (b) hand-off                      (c) collection            (d) assembly           review
 ─────────────          ─────────────────────────────     ──────────────────────    ────────────────────   ───────────
 Actions                 thornfield CLI on an ARC or      ttf proofCollect, per     mai-code-2-flash       princes read
 workflow_dispatch  ──▶  self-hosted runner starts   ──▶  row, on the seat:    ──▶  Copilot lane on   ──▶  the draft PR;
 (nightly cron or        proofRunWorkflow on Temporal     validate, recover         the seat writes        a fold is a
 on-deploy dispatch)     and exits. Per seat:             trace, copy the public    candidate row          separate,
                         proof worker → isolated          set, scan it, stage it;   evidence onto the      reviewed act
 product SHA, docs       gateway (stage_only build,       orchestrator merges       packet and opens       (direct to
 SHA, rows from          composite-launcher run) →        the staging branches      the docs PR            main, per the
 dispatch_allocation     run-proofs.sh --live             into a PROOF-RUNS/        (candidate only)       corpus method)
                         live gateway: never touched      packet, draft PR

 (e) guards, at every stage: hold switch · row authority · no refire · redaction · exact SHA · cost
```

## What exists today

Most of the pipe exists. The missing parts are the first leg (Actions → Temporal), the seat's
gateway (isolated, not live), the assembler, and the guards between them.

| stage | today's tool | what it does | gap |
|---|---|---|---|
| (a) trigger | docs `.github/workflows/project81-k6-proof.yml`; bootstrap `.github/workflows/project81-k6-proof.yml` | dispatch-only row-list runs on one runner, dry by default | no schedule, no on-deploy trigger, no Temporal hand-off ([G1](#g1), [G12](#g12)) |
| (a) trigger | docs PR #588 `k6-baseline-scheduled.yml` (draft) | nightly cron, 30-minute deployed-SHA poll and missed-fire watchdog on seat runners, no Temporal | open; overlaps this design ([decision 5](#open-decisions-for-the-princes)) |
| (a) row authority | ttf `planProofRun` / `allocationRows` (`src/sdlc/proof-run.ts`) | `dispatch_allocation` is the only firing authority, every required row allocated once, `--rows` only narrows | treats a `supplemental` bucket as an owner ([G7](#g7)) |
| (b) Actions → Temporal | ttf `thornfield-ingress-reusable.yml`, `thornfield-workshop.yml` | relay issue and PR events; start familiar and probe Workflows | no step starts `proofRunWorkflow` ([G1](#g1)); ttf#15 canary not yet proved |
| (b) Temporal | ttf `proofRunWorkflow` (`src/workflows/proof-run.ts`) | per-seat go check, preflight, one detached launch, bounded probe, collection, packet; never relaunches | none in itself |
| (b) seat | ttf `createProofSeatActivities` (`src/seat/proof-run.ts`) + frond-scribe `live-proof.sh` | preflight, launch, probe, collect on `thornfield-proof-<seat>` | **targets the seat's live gateway** ([G2](#g2)) |
| (b) isolated gateway | frond-scribe `composite-launcher.sh`; bootstrap `deploy-gateway.yml` `stage_only=true` | owner-run isolated gateway with its own state, token, port, unit and model sign-in, from a stage-only build | not wired to the proof worker; done line and run directory differ ([G2](#g2), [G3](#g3)) |
| (b) firing | docs `scripts/run-proofs.sh --live` | catalog preflight, exact docs-ref snapshot, signed seat readiness, per-row k6 run, sanitizer, journal capture, trace collection | none: the pipe calls it unchanged |
| (c) collection | ttf `proofCollect`, `proofWritePacket` (`src/github/proof-run.ts`) | validate each row, recover the trace post-run, copy only the sanitizer's outputs, scan for secret shapes, stage as an orphan commit, merge into `PROOF-RUNS/<candidate>/<ts>-<label>/`, open a draft PR | static rows not run ([G8](#g8)) |
| (c) trace | docs `collect-continuation-trace.mjs`, `fetch-tempo-trace.mjs` | public-safe Tempo projection and correlation receipt per row; post-run recovery without refire | none |
| (d) assembly | frond-scribe `dispatch-code-agent.sh` (`COPILOT_MODEL=mai-code-2-flash`) | launches a Copilot lane in tmux on a seat | no assembler brief, trigger or output check ([G10](#g10)) |
| (e) hold | none before this PR | | `proof-pipe/hold.json` added; Temporal does not read it yet ([G14](#g14)) |
| (e) no refire | ttf workflow id `proofs/<candidate>/<label>` with `REJECT_DUPLICATE`; corpus `rows[].fired`, `refires[]` | a Workflow id never runs twice; a corpus records fires | no single consumption ledger ([G5](#g5)) |
| (e) cost | bootstrap `openclaw-local-ci.yml` cost guard | refuses a rented hosted lane unless overridden | docs `project81-k6-proof.yml` defaults to `ubuntu-latest` ([G13](#g13)) |

## Stage (a): trigger

**What it is.** A GitHub Actions `workflow_dispatch` that names exactly what would fire. Two callers
dispatch it: a nightly clock and an on-deploy hook. A person can dispatch it by hand.

**Inputs.**

| input | rule |
|---|---|
| `product_sha` | 40 lowercase hex: the OpenClaw runtime build the rows fire against. Nightly takes it from a seat's `dist/build-info.json` `commit` (the deployed build). On-deploy takes it from the deploy run's elected `approved_ref`. Never a branch tip. |
| `docs_sha` | 40 lowercase hex: docs `main` resolved once when the trigger fires. It is the corpus manifest, the catalog and the harness the seat pins (`run-proofs.sh --docs-ref`). |
| `corpus_sha` | optional 40 hex: the pure corpus when the runtime is a composite (ttf `--pure`). Pure-SHA credit stays a separate, reviewed materiality judgment. |
| `rows` | `all`, `owner:<dispatch_allocation bucket>`, or a row list. Rows come only from `PROOFS/<corpus>/proofs-manifest.json::dispatch_allocation` at `docs_sha`, and a list only narrows it. |
| `trigger` | `manual`, `nightly` or `on-deploy`, recorded in the plan and the label. |
| `label` | lowercase slug. It names the Temporal Workflow id `proofs/<product>/<label>`, which is the run's idempotency key. A nightly label should carry the date (for example `nightly-20261103`), so one night is one run. |
| `dry_run` | defaults to true. False is refused while the hold is in effect. |

**Receipts.** The plan, `openclaw.k6.proof-pipe-plan.v1`, uploaded as the run's artifact and written to the
job summary. It records the product, docs, corpus and pipeline SHAs, the manifest path and blob, every
selected row and its disposition, and each guard's finding.

**Fail-closed refusals** (the skeleton implements each one and a test holds it):

- a SHA that is not 40 lowercase hex, an unsafe row, owner or label, an unknown trigger, or a `dry_run`
  that is not exactly `true` or `false`;
- a `docs_sha` that is not a commit in the checkout (the planner never fetches; the workflow fetches
  first, by full SHA only);
- no manifest at `PROOFS/<corpus>/proofs-manifest.json` at `docs_sha`, a schema other than
  `openclaw.proofs.manifest.v1`, or a `capture_sha` that is not the corpus SHA;
- no `dispatch_allocation`, an invalid shape, a row allocated twice, a required row allocated to nobody,
  or an allocated row outside `required_rows`. The `supplemental` bucket (docs#613) is never a firing
  bucket;
- a row list naming a row outside `required_rows`, or an unknown bucket;
- **a selected seat row that is consumed or possibly consumed** (see [no refire](#no-refire)). The whole
  trigger is refused and every refused row is listed. The operator narrows the rows deliberately; the
  pipe never drops them silently;
- a seat row whose catalog manifest `run-proofs.sh --live` would skip: not `k6-runnable`, or not
  `runnable`;
- nothing to fire. A run that does not fire is a failure (docs#587), so a selection made only of
  static rows or rows on no proof seat is refused;
- a rented runner (see [cost](#cost)).

**Gaps.** Nothing dispatches the trigger yet ([G1](#g1), [G12](#g12)). A nightly deployed build usually
has no seeded corpus with an allocation ([G6](#g6)).

## Stage (b): hand-off

**What it is.** The Actions job starts one `proofRunWorkflow` and exits. Temporal owns every wait, as in
ttf ingress. The job runs on an ARC or self-hosted runner that reaches the Temporal frontend
(`10.0.0.100:30733`) and has the installed thornfield app. It runs the equivalent of:

```bash
thornfield proofs run --candidate <product_sha> --docs-ref <docs_sha> [--pure <corpus_sha>] \
  --rows <seat rows> --label <label> --go <seat>=<go message id> [--go ...]
```

On the Temporal side nothing new is needed until the seat. `proofRunWorkflow` is the existing Workflow
(type `proofRunWorkflow`, task queue `thornfield-orchestrator`, id `proofs/<product>/<label>`,
`REJECT_DUPLICATE`), and it:

1. reads the manifest at `docs_sha` and plans from `dispatch_allocation` (ttf invariant 1);
2. checks each seat owner's go on the orchestrator before anything reaches the seat (invariant 16);
3. on `thornfield-proof-<seat>`, served only by that seat's worker with role `proof`: preflight, one
   detached launch, a probe on a timer until the done line or the deadline, then collection
   (invariants 3 to 6 and 17).

**The seat's gateway: isolated, never live.** This is where the pipe departs from today's seat
Activities. The rows fire against an isolated proof gateway:

- **The runtime is a `stage_only` build.** bootstrap `deploy-gateway.yml` with `stage_only=true` and
  `approved_ref=<product_sha>` builds and validates the candidate beside the live install at
  `<path-b-root>/stage-only/<sha>`. It writes `.path-b-stage-only/receipt.json`, and it proves the live
  unit's MainPID, start time and active state unchanged. There is no stop, cutover, config or timer
  change.
- **The owner runs the launcher.** frond-scribe `composite-launcher.sh`, run as the seat owner's user on
  their own seat. The owner does the one-time acts by hand:
  - `setup` derives the config read-only from the live `openclaw.json`, with no auth section and no
    channels. It mints its own token, port and unit (`openclaw-proof-comp-<sha8>`), its own state
    directory (`~/proof-gw/comp-<sha8>/state`) and its own OTel service;
  - `login` and `login-finish` do the isolated device-code sign-in;
  - `adopt-auth` moves an earlier isolated sign-in to the new SHA.

  The proof worker would only call `run`, which binds candidate, runtime and docs SHAs, the isolated
  WebSocket, unit and service name, disposable sessions and the seat class, then runs signed seat
  readiness and `run-proofs.sh --live`.
- **The live gateway is never touched.** `openclaw-gateway.service` keeps its MainPID,
  `ActiveEnterTimestamp` and `NRestarts`, and the pipe records that before and after
  ([G17](#g17)).

**Receipts.**

- Temporal: the Workflow and run id, each seat's go and its check (`verified` or
  `operator-attested (not verified)`), preflight, runner identity (pid, start ticks, boot id), probe
  errors and the done line's exit status.
- The stage-only build's `receipt.json`.
- The isolated gateway's `receipts/identity.json`, `config-shape.json`, `isolated-auth-status.json` and
  `state-setup.txt`.
- The signed `openclaw.k6.seat-readiness.v2` receipt, `harness-provenance.json` and
  `harness-provenance/<matrix-id>.json`.
- A structured live-gateway-untouched receipt (to build, [G17](#g17)).

**Fail-closed refusals that exist today.**

- ttf:
  - a malformed input;
  - a live seat with no go, or a go that is unverified or expires before launch (`not-run`);
  - no proof worker within the worker wait (`not-run`);
  - a failed preflight (`not-run`);
  - a second launch into the same state directory (refused, never relaunched);
  - a launch that failed after the worker took it, a probe deadline, a vanished runner or a cancel
    (`possibly-consumed`; never relaunched).
- `run-proofs.sh`:
  - a docs ref that is not `HEAD`, or a tracked tree that differs from it (exit 78, no row);
  - a candidate that is not the runtime build;
  - a row that is not `k6-runnable` (skipped);
  - a held same-session lock.
- `composite-launcher.sh`:
  - no validated stage-only build for the SHA;
  - `diagnostics-otel` absent;
  - a busy port;
  - an existing state directory (`setup` never reuses state);
  - an inactive proof unit;
  - a docs worktree that is not clean at the docs SHA.

**Gaps.** The seat Activities launch `live-proof.sh`, which fires against the live gateway. A launcher
contract for the isolated gateway is needed ([G2](#g2)). Stage-only provisioning and the owner's
one-time acts are not automated ([G3](#g3)). Unattended fires have no go source ([G4](#g4)).

## Stage (c): collection

**What it is.** The existing ttf collection, unchanged, for each fired row:

1. take the row from its one run directory (`<ts>/artifacts/<candidate>/<row>/<seat>/<run-id>/`, never
   the newest of several);
2. `fetch-tempo-trace.mjs --run-dir` recovers the trace post-run (never a refire), and
   `validate-candidate-run-result.mjs` validates the run, both from the harness worktree pinned at the
   docs ref;
3. copy only the public set: the outputs `sanitize-k6-artifacts.mjs` names in `evidence-redaction.json`,
   the validated `run-result.json`, the Tempo projection, and the collection's own receipts;
4. refuse the row's whole copy on a secret shape, a symlink, an unreadable file or a file that changed
   between scan and staging;
5. stage the bytes as an orphan commit on `proof-runs-staging/<workflowId-safe>/<seat>`. No artifact
   bytes enter Temporal;
6. on the orchestrator, merge each staging branch only if it names the recorded commit and holds exactly
   the recorded files and hashes. Write `PROOF-RUNS/<product>/<ts>-<label>/` (`RUN.md`, `run.json`,
   per row `row.json` plus its public set) on `proof-runs/<product8>-<ts>`, and open a draft PR.

**Receipts per fired row** (the dry run lists them per row from its catalog manifest):

- `run-result.json`, `runner-metadata.json`, `row-manifest.json`, `row-scenario.js`;
- the sanitizer's outputs (`evidence-redaction.json`, `evidence.jsonl`, `evidence-lines.log`, `k6.log`);
- the redacted journal (`gateway-journal.log`, `gateway-journal-capture.json`,
  `gateway-journal-redaction.json`);
- for every continuation row (`lib/continuation-trace-requirement.mjs`), the public-safe
  `tempo-trace-<trace-id>.json` and its correlation and topology receipt:
  `continuation-trace-correlation.json` for `continue_work` and `continue_delegate`,
  `tool-trace-correlation.json` otherwise. R-CD-2 keeps its signed authority receipt instead;
- only on their condition: `candidate-run-result.json` (when review completes) and
  `verdict-reconciliation.json` (when the VU and summary verdicts disagree);
- the collection's own `row.json`, `receipts/tempo-fetch.*` and `receipts/validation.*`;
- per run: `seat-readiness.json`, `harness-provenance.json`, `catalog-preflight.log`, `report.html`,
  `report-receipt.json`.

These never leave the seat: the raw k6 log, the raw journal, raw Tempo or OTLP responses,
`<artifact-dir>.private`, `openclaw.json`, the gateway token and model credentials.

**Fail-closed refusals that exist today.** Each is a row debt, never a pass:

- `row-dir-missing`, `ambiguous`, `harness-unusable`;
- `validation-failed`, `trace-missing`, `run-result-unreadable`, `verdict-missing`;
- `public-set-incomplete`, `secret-shape`, `not-a-regular-file`, `changed-during-collection`;
- `collection-missing`, `collection-duplicate`, `collection-misplaced-file`, `collection-refused`;
- `collect-failed`.

A verdict is copied byte for byte, and only onto a row with no debt.

**Gaps.** Static rows are recorded `not-run` and nobody runs their validators ([G8](#g8)). The pipe never
fires fixture and orchestration rows ([G9](#g9)).

## Stage (d): assembly

**What it is.** A Copilot lane on the seat, with model `mai-code-2-flash`, briefed with the corpus
contract:

- frond-scribe `skills/build-openclaw-proof-corpus/SKILL.md`;
- `tools/k6-proofs/CONTRIBUTING-ROWS.md` ("EVIDENCE.md must record");
- this document.

It reads the packet branch and turns the public sets into candidate row evidence that princes can
review, instead of assembling it by hand.

**Proposed shape** (the princes decide the host and owner, [decision 3](#open-decisions-for-the-princes)):

- **Input:** the packet branch `proof-runs/<product8>-<ts>` and its draft PR.
- **Writes:**
  - per fired row, `PROOF-RUNS/<product>/<ts>-<label>/<ROW>/EVIDENCE.md`. It records the run context,
    the copied candidate verdict and why it holds, the receipt table, the trace and correlation status,
    the debts, the live-run safety classification, `foldRequiresReview: true` and a no-secrets line;
  - `ASSEMBLY.md`: the rollup (pass, partial, fail, missing and honest-limit counts, each row's last
    same-row PASS from the `PROOFS/*/proofs-manifest.json` history, and `NEW-ROW-NO-PRIOR-PASS` where
    there is none), plus what it did not read.
- **Commits** onto the packet branch, so the princes review one PR. It adds files only: every packet
  file keeps its blob.
- **Opens or retitles** the draft PR `proof run evidence: <product8> @ docs <docs8> (candidate evidence
  only)`, with the princes as reviewers.

**Rules.**

- It copies the harness verdict exactly and never promotes one. A row with debt stays debt. A missing
  receipt is never retro-justified. `HONEST-LIMIT` is only R-RC-2's structured receipt.
- It never writes `PROOFS/INDEX.json`, anything under `PROOFS/`, `tools/`, `.github/` or `RUNBOOKS/`.
  The fold is a separate, reviewed act: direct to `main` per bootstrap `RUNBOOKS/PROOF-CORPUS-METHOD.md`,
  never by this lane.
- It refires nothing and contacts no gateway. It reads the public set, never the seat's private
  acquisition files.
- It re-scans every file it writes for the secret shapes ttf refuses (`SECRET_SHAPES`) before it
  pushes.

**Receipts.** The lane's commits (path, blob, size), the scan result, and the PR URL. The PR body names the
product, docs, corpus and pipeline SHAs, the Workflow id and the hold state at fire time.

**Gaps.** No assembler exists: no brief, no trigger and no output check ([G10](#g10)). Nothing reports the
rollup or alerts on a run that did not fire ([G11](#g11)).

## Stage (e): guards

### Hold switch

The bugs-first hold lives in `tools/k6-proofs/proof-pipe/hold.json` (`openclaw.k6.proof-pipe-hold.v1`), and
this PR commits it held. It fails closed:

- A release is only a well-formed file with `held: false` that names who released it, where and when
  (`release.by`, `release.ref`, `release.at`, each non-blank). A missing file, malformed JSON, another
  schema, a non-boolean `held`, or `held: false` with no named release is a hold.
- The planner reads it at two refs, the pipeline's own commit and the docs SHA, and either one holds. A
  release on a branch cannot lift a hold on the docs ref being fired, and an old docs ref that predates
  the file is held.
- The repository variable `PROOF_PIPE_HOLD` can add a hold (any value but empty, `false`, `0`, `off` or
  `no`). No value of it lifts one, so an operator can stop the pipe without a commit.
- Lifting the hold is a reviewed commit to `hold.json` that names 🌊's go. That commit also changes the
  test that pins the hold in effect.
- In the live leg, Temporal must re-read the hold at the docs ref immediately before each seat launch,
  as it does for the go's expiry ([G14](#g14)).

### Row authority

`proofs-manifest.json::dispatch_allocation` is the sole firing authority:

- it covers `required_rows` exactly once;
- `supplemental` never fires;
- a `*-static` owner's rows run on the orchestrator;
- an owner that is not a proof seat (`unfired`, `frond-scribe-fixture`) is `not-run`
  (`owner-not-a-proof-seat`), never a refusal.

The plan records the manifest path and its git blob at the docs SHA. ttf records the same.

### No refire

A row may fire only on affirmative evidence that it never has. The planner refuses a seat row as
**consumed** when any of these holds:

- its corpus row says `fired: true`;
- it lists `test_cases_executed`;
- its state is anything but `missing`;
- `refires[]` names it;
- a merged ttf packet (`PROOF-RUNS/<product or corpus>/<run>/<ROW>/row.json`) records it as `candidate:*`,
  `collected` or `debt`.

It refuses a row as **possibly consumed** when:

- the corpus has no `rows[]` entry for it;
- `fired` is not exactly `false`;
- the row carries a `possibly_consumed` marker;
- a packet records it in any state but `not-run`.

A folded `missing` does not mean unfired. F′'s R-CD-3, R-CD-SILENT and R-CW-TOKEN are `missing` with
`fired: true`, and the skeleton's real-data test refuses all 27 of F′'s emeric rows.

Two more layers hold in the live leg:

- the Workflow id `proofs/<product>/<label>` is `REJECT_DUPLICATE`, so a label never runs twice;
- ttf never relaunches a launch that may have started.

The ledger is still split ([G5](#g5)). The dry run reads the corpus and merged packets. The live leg must
also read open packet branches and Temporal history for `proofs/<product>/*`, and treat any it cannot
read as possibly consumed. A refire is a new, deliberate run with its authorization recorded in
`refires[]` (`authorized_by`), never an automatic retry.

### Redaction

These boundaries already exist, in order:

1. the scenario's `redactEvent()`;
2. the post-processor's refusal of raw events;
3. `run-proofs.sh`'s sanitizer and journal redaction before a row directory is final;
4. ttf's copy of only the sanitizer's named outputs, its secret-shape scan and its blob check.

The assembler adds a fifth, a re-scan of what it writes ([G16](#g16)). Public artifacts carry no
credentials, private acquisition directories, raw private identifiers or unredacted payload tails.

### Exact-SHA binding

Every SHA is 40 lowercase hex and immutable once the trigger fires:

- the product SHA is what the isolated gateway runs: seat readiness binds the runtime build ID, and
  `composite-launcher.sh setup` checks the stage-only build's `build-info.json`;
- the docs SHA is the snapshot `run-proofs.sh` executes from;
- the corpus SHA is the manifest's `capture_sha`;
- the pipeline SHA is the commit of the planner itself.

The plan records all four plus the manifest blob, and the packet records the product SHA, docs ref,
manifest blob, frond-scribe SHA and ttf SHA.

### Cost

ARC or self-hosted only, never a rented runner:

- the workflow's `runs-on` comes from `vars.PROOF_PIPE_RUNS_ON`, defaulting to the ARC scale set
  `oc-4cpu-16gb`;
- a value naming `ubuntu-*`, `windows-*`, `macos-*` or `blacksmith` skips the job before a runner is
  assigned;
- the planner's cost guard refuses those labels again, admits `self-hosted` or `oc-*` only, and records
  the decision in the plan;
- seat work runs on the seats themselves, as proof workers. The assembler runs there too, so nothing
  bills Actions minutes.

## The dry-run skeleton

| file | what it is |
|---|---|
| [`../scripts/proof-pipe-dry-run.mjs`](../scripts/proof-pipe-dry-run.mjs) | the runner: reads git objects at exact SHAs, prints the plan |
| [`../lib/proof-pipe-plan.mjs`](../lib/proof-pipe-plan.mjs) | the pure plan: input checks, hold, allocation, no refire, catalog, receipts, cost |
| [`../proof-pipe/hold.json`](../proof-pipe/hold.json) | the hold, in effect |
| [`../../../.github/workflows/proof-pipe-dry-run.yml`](../../../.github/workflows/proof-pipe-dry-run.yml) | the workflow: dispatch-only, dry by default |
| `../scripts/__tests__/proof-pipe-dry-run.test.mjs`, `proof-pipe-workflow.test.mjs` | the tests |

Run it locally from the repository root. It needs only git and node:

```bash
node tools/k6-proofs/scripts/proof-pipe-dry-run.mjs \
  --product-sha <40-hex runtime SHA> --docs-sha "$(git rev-parse HEAD)" \
  [--corpus-sha <40-hex pure SHA>] [--rows all|owner:<bucket>|R-A,R-B] \
  [--trigger manual|nightly|on-deploy] [--label <slug>] [--json] [--out plan.json]
```

Or dispatch the workflow once it is on `main`:

```bash
gh workflow run proof-pipe-dry-run.yml --repo karmaterminal/karmaterminal-openclaw-docs \
  -f product_sha=<40-hex> -f docs_sha=<40-hex> -f rows=all -f trigger=manual
```

| exit | meaning |
|---|---|
| 0 | a plan: every guard passed, and nothing fired |
| 2 | refused: input, manifest, allocation, consumption, catalog or cost; the JSON names every reason |
| 3 | `dry_run=false` refused: the hold is in effect |
| 4 | `dry_run=false` refused with the hold lifted: the live leg is not built |

**What it does.** It validates the inputs and reads the hold at the pipeline commit and the docs SHA. It
resolves the allocation at the docs SHA, refuses consumed and possibly consumed rows, and checks each seat
row against the catalog. It then prints stages (a) to (e): the thornfield command and Temporal start it
would make, the stage-only build, the launcher invocation and isolated gateway for each seat, the
receipts each row would leave, the assembler's writes and forbidden paths, and every guard's finding.
With `--json` it emits the same plan as `openclaw.k6.proof-pipe-plan.v1`, with `fired: 0` and
`contacted: []`.

**What it never does.** It never fetches, and git is the only process it starts: no k6, ssh, systemctl,
curl, gh, thornfield, temporal, docker or openclaw. The test puts a tripwire on each, and a contract test
scans the source. It reads no seat state, so a seat's own readiness and its `~/.local/state` are unread.
It never contacts Temporal, so the Temporal side of the ledger and the go checks are unread.

**What a dry run cannot prove.** A row's receipts in the plan are what the catalog says the row would
leave, not evidence. The packet's start timestamp is unknown until a Workflow starts, so the plan writes
`<start-ts>`. A plan that passes says only that the trigger is well formed, authorized by the allocation,
unfired as far as the docs SHA records, and planned to run on unbilled runners.

**Tests and probes.** The skeleton's two test files pass 39 of 39. Fifteen mutation probes each break one
guard and turn its named test red:

- the hold check;
- a missing hold read as released;
- only the HEAD hold counting;
- an operator variable lifting the hold;
- `fired: true` ignored;
- unknown `fired` accepted;
- packets ignored;
- `refires[]` ignored;
- a rented runner admitted;
- `supplemental` fired;
- a non-k6-runnable seat row admitted;
- the workflow defaulting to a live run;
- `ubuntu-latest`;
- an input spliced into a script;
- the planner starting `curl`.

## Gaps

Each gap names the repository that owns the fix. None is fixed here: this lane builds the design and
the dry run only, and reads the other repositories without writing to them.

<a id="g1"></a>**G1. No Actions → Temporal entrypoint for proofs (ttf).**

- `thornfield-ingress-reusable.yml` relays issue and PR events (`thornfield ingress`) only.
  `thornfield-workshop.yml` starts familiar and probe Workflows only.
- Two candidate shapes:
  - a `proofs-run` workshop command;
  - a reusable `thornfield-proofs` workflow the docs workflow calls with
    `uses: karmaterminal/temporal-thornfield-frond/...@<sha>`, as ingress-reusable is called from other
    repositories.
- Either starts `proofRunWorkflow` and exits.
- It depends on ttf#15 proving one real Actions ingress run to Temporal, and on ttf#4 and #9 for
  everything past echo.

<a id="g2"></a>**G2. The seat leg fires the live gateway (ttf, frond-scribe).**

- `proofPreflight` requires `systemctl --user is-active openclaw-gateway` and the live install's
  `dist/build-info.json` equal to the candidate.
- `proofLaunch` spawns `live-proof.sh`, which reads `~/.openclaw/openclaw.json` and fires at the live
  port and unit.
- The isolated route needs a launcher contract the seat Activities can probe and collect:
  - preflight: the isolated unit is active; its stage dir's `build-info.json` and its
    `receipts/identity.json` name the product (and the corpus); the live unit's identity is captured;
  - launch: `composite-launcher.sh run` writes into `LIVE_PROOF_STATE/<ts>/` and ends with ttf's done line
    (`live-proof done rc=<rc> <utc> out=<dir>`).
- Today `run` writes to `~/proof-runs/COMP-<sha8>-<ts>/` and prints no done line, so `proofProbe` would
  read it as possibly consumed.
- `thornfield doctor --role proof` checks `live-proof.sh` and would need to check the isolated launcher
  instead.

<a id="g3"></a>**G3. Stage-only provisioning and the owner's one-time acts are manual (bootstrap,
frond-scribe).**

- Nothing dispatches `deploy-gateway.yml stage_only=true` for the pipe's product SHA.
- Nothing reaps `stage-only/<sha>`, and a second stage-only run for the same target refuses while it
  exists.
- `composite-launcher.sh setup` refuses existing state.
- `login` needs a person; `adopt-auth` can move an earlier isolated sign-in to the new SHA.
- An unattended on-deploy run needs these done ahead of time by the owner, or a decision that the worker
  may run `setup` and `adopt-auth` ([decision 7](#open-decisions-for-the-princes)).

<a id="g4"></a>**G4. Unattended fires have no consent source (ttf).** A live seat needs a go: the seat's
prince posts `proof go <sha prefix> [<seat>]` in the frond room, 24 hours by default and at most 7 days
(`THORNFIELD_PROOF_GO_MAX_AGE_SEC`). A nightly or on-deploy run names a new SHA nobody has posted a go
for ([decision 4](#open-decisions-for-the-princes)).

<a id="g5"></a>**G5. The consumption ledger is split (docs, ttf).**

- Consumption truth lives in six places: the corpus `rows[]` (`fired`, `test_cases_executed`), the
  corpus `refires[]`, merged `PROOF-RUNS/` packets, open `proof-runs/*` packet branches, Temporal
  history, and seat state directories.
- No corpus manifest yet records a `possibly_consumed` marker.
- The dry run reads the first two and refuses anything not affirmatively unfired. The live leg must read
  the rest.
- A seeded corpus must write `fired: false` on every row; without it every row is possibly consumed.

<a id="g6"></a>**G6. A nightly build has no seeded corpus (docs).**

- The pipe fires only rows a manifest allocates at `capture_sha` = the corpus SHA.
- A deployed build usually has no `PROOFS/<sha>/`.
- The current INDEX corpus (`139e3657…`) has no `required_rows`, `dispatch_allocation` or
  `capture_sha`, and the skeleton refuses it, correctly.
- A seed step is needed: for example a candidate-only working corpus (docs#587's option) or a baseline
  manifest outside `PROOFS/` ([decision 8](#open-decisions-for-the-princes)).

<a id="g7"></a>**G7. ttf treats `supplemental` as an owner (ttf).** `allocationRows` reads every
`dispatch_allocation` key as an owner, so a docs#613 corpus with a `supplemental` bucket refuses the whole
run as `unknown row allocated`. `validate-corpus.mjs` and this planner exclude it.

<a id="g8"></a>**G8. Static rows are not run (ttf, docs).** `proofRunWorkflow` records `*-static` rows
`not-run` (`static-validator-orchestrator`). Nothing runs `static-corpus-row-validator.js` for them in
the pipe. An offline orchestrator step at the docs SHA would close it.

<a id="g9"></a>**G9. Fixture and orchestration rows stay manual (docs).** R-CW-5 and R-CW-6
(process-local fixtures, capped at PARTIAL) and R-CD-RETURN-COVENANT-AUTHORITY (a disposable real-restart
control) are not `k6-runnable`. They sit on owners that are not proof seats, and the pipe never fires
them.

<a id="g10"></a>**G10. No assembler (frond-scribe, ttf).** There are two routes:

- a `dispatch-code-agent.sh` Copilot lane with `COPILOT_MODEL=mai-code-2-flash`, started when the packet
  PR opens;
- a Temporal Activity after `proofWritePacket` that runs a Copilot turn on the seat. This route is
  blocked until non-echo turns are armed (ttf#4, #9).

Either one needs a written brief (the corpus contract above), the add-only and forbidden-path check,
and the secret re-scan.

<a id="g11"></a>**G11. No rollup or not-fired alert in the Temporal path (docs, ttf).** docs PR #588's
`scheduled-baseline.mjs` builds the last-same-row-PASS rollup and the missed-fire watchdog for its
Actions-only runner. This path has neither ([decision 5](#open-decisions-for-the-princes)).

<a id="g12"></a>**G12. No on-deploy hook (bootstrap).** `deploy-gateway.yml` dispatches nothing after a
deploy. A hook needs a token with `actions: write` on this repository. #588 polls every 30 minutes
instead.

<a id="g13"></a>**G13. Runner access and an existing rented default (docs).**

- This repository has never used the ARC `oc-*` scale sets, so the runner group must be granted before
  the skeleton workflow can run.
- The existing `project81-k6-proof.yml` here still defaults `runner_labels_json` to `["ubuntu-latest"]`,
  a rented runner.
- Both are outside this lane's scope and left unchanged.

<a id="g14"></a>**G14. Temporal does not read the hold (ttf).** The live leg must read
`tools/k6-proofs/proof-pipe/hold.json` at the docs ref before each seat launch, and refuse the seat
(`not-run: held`) when the hold is in effect.

<a id="g15"></a>**G15. Hold release is a convention (docs).** The release block names the authority, but
nothing checks that the named go exists. A release is reviewed like any other commit.

<a id="g16"></a>**G16. The assembler's writes are unscanned (frond-scribe).** ttf scans what leaves the
seat. Nothing yet scans what the assembler writes.

<a id="g17"></a>**G17. No structured live-gateway-untouched receipt (frond-scribe, ttf).**
`composite-launcher.sh` prints the live gateway's pid and build as text. The pipe should record the live
unit's MainPID, `ActiveEnterTimestamp` and `NRestarts` before and after each seat run, as
`deploy-gateway.yml` stage-only and #588's teardown do, and fail the run if any changed.

## Open decisions for the princes

This lane does not decide these.

1. **Which seat hosts the proof worker and the isolated gateway.** It could be one seat for every live
   row (F′ allocated all 27 live rows to emeric) or the seats each allocation names.
2. **The nightly window and cadence (UTC), and who owns the clock.** The clock could be an Actions
   `schedule:` here or a ttf Temporal Schedule (`.thornfield/schedules.json` has no proof entry). The
   on-deploy trigger could be a push hook in `deploy-gateway.yml` or a poll.
3. **Who owns the assembler lane:** which seat it runs on, who briefs and maintains it, and the fallback
   when `mai-code-2-flash` is unavailable.
4. **Consent for unattended fires:**
   - a per-run go (today);
   - a standing go per SHA, within the 7-day limit;
   - the hold release itself as consent;
   - a new seat-owner opt-in.
5. **Convergence with docs PR #588.** Options: the Temporal leg dispatches #588's runner (ttf#21's
   shape); this pipe reuses #588's rollup and watchdog; or the two stay separate. #588's
   `isolated-gateway.mjs` runs the deployed dist with provider keys, where this design runs a
   `stage_only` build through the owner-run launcher.
6. **The isolated gateway recipe.** The workorder names `stage_only` and the owner-run launcher. Confirm
   it, or adopt #588's recipe.
7. **Which launcher subcommands the proof worker may run unattended:** only `run`, or also `setup`,
   `adopt-auth`, `stop` and `shred`.
8. **The nightly corpus:** a candidate-only working corpus per deployed SHA, or a baseline manifest
   kind outside `PROOFS/`.
9. **Who lifts the hold, and how.** This design proposes a reviewed commit to `hold.json` naming 🌊's go.
10. **Where candidate evidence lands:** on the packet branch (one PR, proposed here) or a separate
    assembler PR. Also, when the `proof-runs-staging/*` branches are deleted.

## Related work

- **docs PR #588** (🪨, draft, head `c392f8a4`): an Actions-only scheduled runner for #587, with its own
  isolated gateway, rollup and missed-fire watchdog. It owns the runner without Temporal. This design adds
  the Temporal leg figs asked for on 2026-11-02 and maps where the two meet
  ([decision 5](#open-decisions-for-the-princes)).
- **ttf#4, #9, #15**: Thornfield's arming gates and the Actions → Temporal echo canary. The canary is this
  pipe's first leg. Until it is proved, nothing here can start a Workflow from Actions.
- **ttf#20**: Thornfield's own schedule health, not proof cadence. **ttf#21** (closed): the Temporal →
  Actions dispatch with `correlation_id`, the opposite direction to this pipe's first leg.
- **bootstrap#1494**: GATES via Temporal.
- **docs#123**: the discoverable k6 skill and `k6-proofs-pipeline.xml`.
