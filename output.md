# WO-P86-495/496 — Close Catalog Roots and Harness Provenance

Branch: `codeagent/p86-495-496-harness-provenance`
Base: `fb9d26b10a0fe90f24146015d3800efc60a3fa75` (docs `main`)
Scope: harness/docs only. No `PROOFS/**` corpus, `proofs-manifest.json`, or
`PROOFS/INDEX.json` bytes were touched. No product (`karmaterminal/openclaw`)
change. No live row fired, no gateway restarted, no prince seat touched.

---

## 1. What changed

### 1.1 One repository-root contract (#495)

**New:** `tools/k6-proofs/lib/repo-root.mjs`

Resolution order, applied identically by every catalog reader:

1. `--repo-root <dir>` (also `--repo-root=<dir>`);
2. `OPENCLAW_PROOFS_REPO_ROOT`;
3. the nearest ancestor-or-self of the working directory that contains a
   `tools/k6-proofs` directory.

Rule 3 makes the repository root, `tools/k6-proofs`, and
`tools/k6-proofs/scripts` all resolve to the same root, so the tool prefix can
never be joined twice. There is deliberately **no** fallback to the checkout that
happens to contain the module: a caller standing outside any harness fails closed
with an explicit contract error instead of silently validating an unrelated
catalog (or, as before, reporting an infrastructure ENOENT as an empty catalog).

**Migrated to the shared resolver** (each previously used `process.cwd()` or
caller-specific path stripping):

- `tools/k6-proofs/scripts/check-manifest-scenarios.mjs`
- `tools/k6-proofs/scripts/check-scenario-alignment.mjs`
- `tools/k6-proofs/scripts/check-proof-row-manifests.mjs`
- `tools/k6-proofs/scripts/list-runnable-rows.mjs` — this one carried the
  `process.cwd().endsWith('/tools/k6-proofs') ? … : join(cwd, 'tools/k6-proofs')`
  stripping the workorder explicitly forbids; it is now the same contract as the
  other three.

`run-proofs.sh` also resolves its own harness root from its script location and
`cd`s there, so the runner is no longer sensitive to the caller's directory
either. `--out-dir` is made absolute before that `cd`.

### 1.1b Ordered verification stages

A live matrix now proceeds strictly as: **byte-only identity** (no catalog is
parsed) → **immutable snapshot** (`git archive` of `tools/k6-proofs`, `PROOFS`
and `.github`, then `exec` into the snapshot's own `run-proofs.sh` with an
authenticated ownership handoff) → **catalog preflight** (validators run from the
snapshot under `env -i`) → **row selection and contract binding** → **credential
and session resolution** → **seat readiness** → **provenance** → **rows**.

Nothing the matrix consumes is read from the operator's mutable checkout after
the snapshot exists, and no credential is present in the process while unproven
bytes are executing.

### 1.2 Catalog preflight is harness infrastructure, not a product verdict (#495)

`run-proofs.sh` now runs all three catalog validators (with an explicit
`--repo-root`) **before any row work**. On failure it:

- writes exactly one `"$OUT_ROOT"/harness-control-receipt.json`
  (`openclaw.k6.harness-control-receipt.v1`, `classification:
  "harness-infrastructure"`, `rowsExecuted: 0`, `rowVerdictsSynthesized: false`,
  `productVerdict: null`, `stage`, `reason`, `detail`, `rowSelection`);
- preserves the raw validator output as `catalog-preflight.log`;
- exits `78` (`EX_CONFIG`), deliberately distinct from any row's effective exit
  code so a setup fault can never be read as a candidate outcome;
- executes **no** rows and synthesizes **no** per-row FAIL/BAD_PROOF.

On success any stale control receipt is removed.

### 1.3 Immutable harness identity (#496)

`run-proofs.sh --docs-ref <40-hex>` (env equivalent `OPENCLAW_PROOFS_DOCS_REF`).
A **live** run refuses to fire — same control receipt, same exit 78, zero rows —
unless all of:

| check | `detail.check` |
| --- | --- |
| approved ref is a 40-char lowercase SHA | `docs-ref-shape` |
| repository `HEAD` equals that ref | `head-equals-docs-ref` |
| every tracked byte under `tools/k6-proofs`, `PROOFS` and `.github` hashes to the approved blob (`git hash-object --no-filters`, never `git status`) | `harness-tree-clean` |
| the candidate SHA is exact 40-hex | `candidate-sha-shape` |
| the extracted snapshot matches the approved ref | `harness-snapshot-matches-docs-ref` |
| the executing runner is the snapshot's own, with a valid ownership sentinel | `snapshot-handoff-authentic` |
| every selected row is recorded at the approved ref | `row-recorded-at-docs-ref` |
| a public-safe `<owner>/<repo>` identity exists | `repository-identity` |
| each selected runnable row's scenario file exists | `scenario-present` |
| each selected manifest + scenario is tracked at that commit | `tracked-at-docs-ref` |
| those tracked bytes equal the working-tree bytes | `bytes-match-docs-ref` |

The ref and the per-row `manifestSha256` / `scenarioSha256` are resolved and
frozen once at startup into read-only state; the row loop refuses to fire any row
that is not in the frozen binding. The previous ambient
`DOCS_REF="$(git rev-parse HEAD)"` — which ran **after** each row had already
executed — is gone.

New/changed artifacts:

- `"$OUT_ROOT"/harness-provenance.json` (`openclaw.k6.harness-provenance.v1`),
  written before the first row fires: docs ref + source, repository identity,
  candidate SHA, runtime identity receipt (seat, runtime build SHA,
  candidate/runtime match, `seat-readiness.json` digest), runner script path +
  sha256, row selection, per-row manifest/scenario paths + sha256, `mode`,
  `harnessIdentityVerified`, `candidateOnly`, `foldRequiresReview`, `startedAt`.
- every `runner-metadata.json` gains `docsRef`, `repository`, `manifestPath`,
  `manifestSha256`, `scenarioPath`, `scenarioSha256`.
- every live run directory gains `row-scenario.js` — the exact scenario source
  bytes that fired, next to the already-copied `row-manifest.json`.

### 1.4 Candidate envelope binding (#496)

`validate-candidate-run-result.mjs` (emit side) now requires the metadata to
carry `docsRef` (equal to the approved `--docs-ref`), a safe `<owner>/<repo>`
`repository`, and both 64-hex digests; it recomputes the digests from the copied
`row-manifest.json` and `row-scenario.js` and refuses to emit on any mismatch or
omission. The envelope gains a `harness` block carrying those values plus the
artifact names it bound.

`candidate-run-result-contract.mjs` (`candidateEnvelopeMatchesSiblings`, the
consumer side used by `summarize-review-debt.mjs` and `render-run-report.mjs`)
performs the same re-verification, so a sidecar whose harness identity is
omitted, mismatched, or whose copied source was mutated after capture can no
longer suppress raw review debt or reach the report as ready-for-human-review.

Review-boundary invariants are unchanged: `candidateOnly:true`,
`foldRequiresReview:true`, `canonicalFoldForbidden:true`, `behaviorProof:false`.

### 1.5 Public-safety

- The control receipt records only `"malformed"` for a badly-shaped
  operator-supplied docs ref; it never echoes an arbitrary input string.
- Repository identity is derived only from a real remote (scheme or scp form) or
  the explicit `OPENCLAW_PROOFS_DOCS_REPOSITORY` override, so a local clone path
  can never reach a public receipt. A local-path remote yields no identity and a
  live run fails closed instead.
- All new receipt fields are repo-relative paths, SHAs, digests, booleans, and
  timestamps. No token, session key, prompt, private path, or raw process output
  is added to any public artifact.

### 1.6 CI

`.github/workflows/project81-k6-proof.yml`:

- `actions/checkout@v4` pinned to `ref: ${{ github.sha }}`;
- `DOCS_REF: ${{ github.sha }}` and `OPENCLAW_PROOFS_DOCS_REPOSITORY: ${{ github.repository }}`;
- the runner is invoked with `--docs-ref "$DOCS_REF"`;
- the catalog validators are invoked with `--repo-root "$GITHUB_WORKSPACE"`.

---

## 2. Exact changed files (20 files, +1524 / −62)

New:

```
tools/k6-proofs/lib/repo-root.mjs
tools/k6-proofs/scripts/__tests__/catalog-root-contract.test.mjs
tools/k6-proofs/scripts/__tests__/harness-provenance-runner.test.mjs
tools/k6-proofs/scripts/__tests__/helpers/harness-checkout.mjs
```

Modified:

```
.github/workflows/project81-k6-proof.yml
RUNBOOKS/project-81/EXECUTABLE-SUITE.md
RUNBOOKS/project-81/README.md
tools/k6-proofs/README.md
tools/k6-proofs/docs/PROOF-RUN-METHOD.md
tools/k6-proofs/scripts/candidate-run-result-contract.mjs
tools/k6-proofs/scripts/check-manifest-scenarios.mjs
tools/k6-proofs/scripts/check-proof-row-manifests.mjs
tools/k6-proofs/scripts/check-scenario-alignment.mjs
tools/k6-proofs/scripts/list-runnable-rows.mjs
tools/k6-proofs/scripts/run-proofs.sh
tools/k6-proofs/scripts/validate-candidate-run-result.mjs
tools/k6-proofs/scripts/__tests__/candidate-run-result.test.mjs
tools/k6-proofs/scripts/__tests__/continuation-row-contract.test.mjs
tools/k6-proofs/scripts/__tests__/report-render.test.mjs
tools/k6-proofs/scripts/__tests__/review-debt.test.mjs
```

---

## 3. Validation

### 3.1 Full-suite tally

The repository has no `scripts/test-projects.mjs` and no `package.json`; the
sanctioned complete k6 proof-script surface documented in
`tools/k6-proofs/docs/PROOF-RUN-METHOD.md` is `node --test`. No new test runner
was installed.

```
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
  baseline @ fb9d26b1 : 263 pass / 0 fail
  final    @ HEAD     : 318 pass / 0 fail   (+55)

node --test tools/k6-proofs/tests/*.test.mjs
  baseline @ fb9d26b1 :  31 pass / 0 fail
  final    @ HEAD     :  31 pass / 0 fail
```

`bash -n` clean. `shellcheck -S warning` reports only the two pre-existing SC2155
warnings. `git diff --check` clean. `PROOFS/**` diff is empty (0 files).

### 3.2 Exact commands

```bash
# full k6 proof-script surface (completion signal)
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
node --test tools/k6-proofs/tests/*.test.mjs

# targeted new suites
node --test tools/k6-proofs/scripts/__tests__/catalog-root-contract.test.mjs
node --test tools/k6-proofs/scripts/__tests__/harness-provenance-runner.test.mjs

# targeted changed suites
node --test tools/k6-proofs/scripts/__tests__/candidate-run-result.test.mjs
node --test tools/k6-proofs/scripts/__tests__/continuation-row-contract.test.mjs
node --test tools/k6-proofs/scripts/__tests__/report-render.test.mjs
node --test tools/k6-proofs/scripts/__tests__/review-debt.test.mjs
node --test tools/k6-proofs/scripts/__tests__/check-proof-row-manifests.test.mjs

# #495 parity, by hand, against the real catalog
for s in check-manifest-scenarios check-scenario-alignment check-proof-row-manifests list-runnable-rows; do
  diff <(node tools/k6-proofs/scripts/$s.mjs 2>&1; echo "exit=$?") \
       <(cd tools/k6-proofs && node scripts/$s.mjs 2>&1; echo "exit=$?") && echo "$s IDENTICAL"
done

# runner smoke, from both directories
./tools/k6-proofs/scripts/run-proofs.sh --dry-run --out-dir /tmp/p86-dry all <40-hex>
(cd tools/k6-proofs && ./scripts/run-proofs.sh --dry-run --out-dir /tmp/p86-dry2 all <40-hex>)

bash -n tools/k6-proofs/scripts/run-proofs.sh
shellcheck -S warning tools/k6-proofs/scripts/run-proofs.sh   # only pre-existing SC2155
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/project81-k6-proof.yml'))"
git --no-pager diff --check
```

### 3.3 Defect reproduction, before and after

**#495 — empirically confirmed, not assumed.** The pre-change validator was
extracted from the base commit and run against the same fixture:

```bash
git show fb9d26b1:tools/k6-proofs/scripts/check-manifest-scenarios.mjs > /tmp/old.mjs
# from the repository root:        "check passed: 1 manifests; 1 scenario files."
# from tools/k6-proofs:            ENOENT crash (doubled prefix)
# new script from tools/k6-proofs: identical to the repository-root run
```

**#496 — the exact Cael failure mode now fails closed.** Firing with the stale
detached runner commit while `HEAD` is current docs `main`:

```
$ ./scripts/run-proofs.sh --live --docs-ref 25d330ef558eefce124fe3b5a787d426e6adf772 ... ; echo $?
78
{"stage":"harness-identity",
 "reason":"harness checkout does not match the approved docs ref; refusing to fire a stale or mixed harness",
 "detail":{"check":"head-equals-docs-ref",
           "head":"fb9d26b10a0fe90f24146015d3800efc60a3fa75",
           "approved":"25d330ef558eefce124fe3b5a787d426e6adf772"},
 "rowsExecuted":0,"rowVerdictsSynthesized":false,"productVerdict":null}
```

### 3.4 Adversarial review

The branch went through **seven** rounds with an independent reviewer before it
was declared shippable. Findings that were real defects, all fixed and each
pinned by a regression test:

| # | Defect | Round |
| --- | --- | --- |
| 1 | Catalog validators executed with the gateway token in their environment, and their raw output was published | 1 |
| 2 | Digests were frozen at startup but k6 read the ambient worktree (TOCTOU) | 1 |
| 3 | `git` honours `refs/replace/*`, so `rev-parse` and `cat-file` could describe different trees | 1 |
| 4 | Failure receipts echoed rejected operator input verbatim | 1 |
| 5 | The consumer envelope contract accepted unknown keys, so a sidecar could smuggle extra material past review | 1 |
| 6 | The env-isolation test was vacuous; a denylist could not stop unrelated credentials | 2 |
| 7 | Only the manifest and top-level scenario were re-hashed — a scenario's `lib/` imports were unguarded | 2 |
| 8 | A missing file made the digest check abort under `set -e` with no control receipt and no exit 78 | 2 |
| 9 | A pre-execution failure left a provisional run directory and could let the interruption writer contradict `rowsExecuted:0` | 2 |
| 10 | `git status` is not byte integrity: `assume-unchanged` / `skip-worktree` hid a modified import | 3 |
| 11 | The catalog was parsed before it was validated, so a malformed manifest aborted with no receipt | 3 |
| 12 | `RUN_ID` was second-granular, so the provisional purge could delete a concurrent run's evidence | 3 |
| 13 | `rowsExecuted:0` was hard-coded and false once a later row failed | 3 |
| 14 | `git hash-object` applies clean filters by default — a filter could forge the approved blob hash and execute during the identity stage | 4 |
| 15 | Bracketing hash assertions only narrow a check-then-use window; harness code had to execute from an immutable snapshot | 4 |
| 16 | Unvalidated candidate input reached artifact paths and metadata | 4 |
| 17 | `rowsExecuted` counted pre-dispatch gates that never dispatched | 4 |
| 18 | Bash reads its own source incrementally, so the executing runner had to be the snapshot's copy | 5 |
| 19 | `PROOFS` was symlinked unverified, and static rows read it — a clean harness could emit `PASS-candidate` from dirty corpus bytes | 5 |
| 20 | The snapshot handoff was spoofable by setting the handoff variables and skipping `exec` | 6 |
| 21 | The bootstrap invoked `openclaw` and resolved session state with credentials present | 6 |
| 22 | **A rejected handoff `rm -rf`'d the directory it claimed** — introduced by the fix for #20 | 7 |

Defect 22 was the most dangerous in the set and was introduced by this work, not
inherited; it is now covered by a test asserting that an unrelated bystander
directory claimed as a snapshot survives with its contents intact.

### 3.5 New test coverage

`catalog-root-contract.test.mjs` (6 tests) — all four catalog readers must
produce byte-identical stdout, stderr and exit status from the repository root,
from `tools/k6-proofs`, and from `tools/k6-proofs/scripts`, on both the passing
and a genuine-defect path; `--repo-root` and `OPENCLAW_PROOFS_REPO_ROOT`
overrides; fail-closed contract error outside any harness; decoy directories
containing only `notes`, only `scenarios`, or only `manifests`; and an assertion
that no output ever contains `tools/k6-proofs/tools/k6-proofs`.

`harness-provenance-runner.test.mjs` (28 tests) — missing/malformed/mismatched
docs refs; the env equivalent; index-hidden (`assume-unchanged`,
`skip-worktree`) mutation of a shared import; a mutated proof-corpus evidence
file; an unrecorded row; a catalog-preflight failure; an unvalidated candidate
SHA; three spoofed-handoff shapes, each also asserting the claimed directory
survives; mid-matrix mutation before capture and between capture and k6, the
latter asserting the provisional directory is purged; `env -i` isolation proved
by a probe validator; log scrubbing proved by that probe printing its own working
directory; runner cwd-independence; a `git replace` decoy; direct observation
that k6 executes from the snapshot with the approved scenario bytes; and an
approved run's full provenance receipt.

Existing suites that would otherwise have started passing for the wrong reason
were repaired rather than left green: the `report-render` and `review-debt`
envelope-consumption fixtures now carry a valid harness identity, so they still
exercise the acceptance path.

---

## 4. Uncertainties and agreed follow-ups

The reviewer explicitly confirmed all three of the following are correctly
classified as follow-ups rather than blockers on this branch.

1. **Committed symlinks, gitlinks and executable-mode changes are not type- or
   mode-compared.** The verification compares blob content. No such entries
   exist in the verified trees today, and they fail closed if introduced, but a
   mode-only change would not be detected. Recommend a follow-up issue.

2. **`analysis/project86-proof-issue-plan.corrected.json` was deliberately not
   rewritten.** Its 23 emitted commands still read
   `./scripts/run-proofs.sh --live <ROW> <FINAL_CANDIDATE_SHA>`. Those commands
   now **fail closed** (exit 78, `docs-ref-shape`) unless the operator exports
   `OPENCLAW_PROOFS_DOCS_REF` — the correct safety posture, but it means a matrix
   generated verbatim from that plan will refuse to fire until the ref is
   supplied. I left it alone because that file is guarded by
   `apply-project86-plan-corrections.mjs` plus its idempotence and
   lock-serialization tests, and because adding a `<DOCS_REF>` placeholder would
   collide with the separate R-CD-2 runtime-selection correction the workorder
   excludes from this branch. Recommend a follow-up issue.

3. **Inherited-token trust boundary.** The bootstrap phase reads no credential
   and invokes no product tooling, but if the caller has already exported
   `OPENCLAW_GATEWAY_TOKEN` then that value is in the bootstrap process's
   environment by construction and cannot be dropped from inside the same
   script. The reviewer classified this as a trust-boundary hardening item, not
   a demonstrated receipt bypass.

Other notes:

4. **Pre-existing candidate artifacts** produced before this change carry no
   `docsRef`/digests and no `row-scenario.js`. Their sidecar envelopes will no
   longer suppress raw review debt and will fall back to the raw
   `run-result.json` path. That is the intended fail-closed behaviour — they
   genuinely cannot prove which harness contract produced them — but reviewers
   should expect existing bundles to reappear as review debt rather than
   silently as ready-for-human-review.

5. **New hard requirements for a live run**, each of which fails closed with a
   control receipt: an approved `--docs-ref`; an exact 40-hex candidate SHA; a
   public-safe `<owner>/<repo>` identity (set `OPENCLAW_PROOFS_DOCS_REPOSITORY`
   when the clone has no public remote); and every selected row being recorded at
   the approved ref. A live matrix also needs roughly 400MB of `TMPDIR` space for
   the snapshot, which is removed on exit.

6. **Not exercised end-to-end against a real gateway.** The workorder forbids
   firing a live row. The R-CD-2 fixture drives the full pipeline — k6 → evidence
   extraction → trace collection → resolver → sanitizer → candidate envelope →
   metrics → report — but against a stubbed `k6` and a local HTTP endpoint.

7. **`shellcheck -S warning`** still reports two pre-existing SC2155 warnings in
   `run-proofs.sh`. They are untouched by this change and out of scope.
