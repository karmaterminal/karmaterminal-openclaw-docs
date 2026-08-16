# Review output — docs PR #512 @ d206f0cd

Independent read-only review of `karmaterminal/karmaterminal-openclaw-docs#512`.
This file is a review artifact on `codeagent/review-docs-pr512`. It is not a
mutation of PR #512 (`codeagent/continuation-telemetry-remedy-rows`).

## Scope

Exact head `d206f0cdb11fed5b2e1b850be6dae2c99343e3f9` vs `origin/main`
`ead47a618c539c535e6845c52207f7a16b23d677`. Reads via `gh` / `ghread` /
`gh pr view` after `gh api user --jq .login` == `scribe-dandelion-cult`.
Census commit `39803b297bd4786db3971eb82a3a7fd0b29bc643` and issue
`karmaterminal/openclaw#1254` checked independently. No GitHub MCP.

## Row mapping (verified)

| Row | Class | enforcement | rebindable | passScope | productPrereq | concern |
|---|---|---|---|---|---|---|
| R-OBS-CONT-PROVENANCE | construct-only | blocking | false | behavioral-only | true | origin-provenance |
| R-OBS-PROOF-MARKER | construct-only | blocking | false | behavioral-only | true | proof-run-classification |
| R-OBS-TERMINAL-OUTCOME | construct-only | blocking | false | behavioral-only | true | terminal-outcome |
| R-OBS-BACKEND-DISPOSITION | construct-only | blocking | false | behavioral-only | **false** (harness) | backend-disposition |
| R-CD-1, R-CD-2, R-CD-4, R-CD-CHAINED-DEPTH-2, R-CD-MODEL-TOOL, R-CD-TOKEN, R-CW-1, R-CW-3, R-RC-2 | existing / k6-runnable | advisory | false | behavioral-only | true | (none) |

Owner-separation is machine-enforced (`REMEDY_CONCERNS`, one owner each).
Construct-only is triple-gated: `scenario.status`, `liveRunSafety.classification`,
`expectedArtifactClass`. `run-proofs.sh` skips non-runnable; `list-runnable-rows.mjs`
omits all four `R-OBS-{CONT-PROVENANCE,PROOF-MARKER,TERMINAL-OUTCOME,BACKEND-DISPOSITION}`;
`live-run-guard.mjs` rejects `construct-only` as not directly runnable.

The nine behavioral contracts are advisory. Telemetry required-ness agrees
between `liveRunSafety.requiredReceipts` and `expectedReceipts` for every
catalog telemetry receipt. `R-CD-MODEL-TOOL` honestly keeps
`trace-or-session-correlation` optional; its authority is gateway metadata.

No committed row has `rebindable=true` or `passScope=behavioral-and-telemetry-rebindable`.
Validator output: `13 declared; 9 rows require telemetry receipts; 0 claim telemetry-rebindable PASS`.

## Fail-closed checks (independently re-read)

1. **Symlink CLI guard.** `invokedAsCli()` realpath-compares `process.argv[1]` to
   `import.meta.url`. Test drives the validator through a symlinked `scripts/`
   directory against a catalog with `R-CW-1` stripped of its contract: exit 1,
   not silent 0.
2. **Rebind/PASS.** Catalog refuses `rebindable=true` without product-emitted
   origin/session/turn/run + proof-run marker, and refuses a rebindable claim
   without `enforcement=blocking` and `rebindReceipts[]`. Post-processor
   withholds `PASS-candidate` when (a) a required receipt (union of both lists)
   is explicitly `missing`, or (b) blocking/rebindable claim is not `proven`.
   Tests cover advisory-rebindable bypass, live-only required receipt, explicit
   missing receipt, blocking unproven → proven, and advisory debt-without-verdict-change.
3. **Catalog preflight.** `CATALOG_CHECKS` includes `check-telemetry-contracts.mjs`;
   failure is `fail_harness` / exit 78 / zero rows executed.

## PROOFS / INDEX

`git diff --name-only origin/main...HEAD` contains no `PROOFS/` path.
`git rev-parse origin/main:PROOFS/INDEX.json` == `HEAD:PROOFS/INDEX.json`
== `cf5eaa4b8e339a692785f6cc8344f6a95fd39808`.

## Census / PR honesty

PR census table matches `39803b29` `output.md`: 23/24h and 366/7d entry spans
vs 585 / 23,796 model-turn spans; 147/115 and 12,722/1,664 log heuristics;
no k6/Project-81 marker; Tempo 200 live-store-only degradation; journalctl
unavailable not zero. PR and remedy doc state the instrumentation does **not**
exist. Product basis `6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955` is bound in
every contract. No secret values in the diff (only “gateway token” as a
forbidden-in-artifacts label).

## Validation

Exact commands:

```bash
gh api user --jq .login   # scribe-dandelion-cult
node --test tools/k6-proofs/scripts/__tests__/telemetry-contract.test.mjs
# 24 tests · 24 pass · 0 fail

node tools/k6-proofs/scripts/check-telemetry-contracts.mjs
node tools/k6-proofs/scripts/check-manifest-scenarios.mjs
node tools/k6-proofs/scripts/check-scenario-alignment.mjs
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs
# all exit 0

node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
# HEAD d206f0cd: 344 tests · 343 pass · 1 fail

# baseline worktree at ead47a61:
node --test tools/k6-proofs/scripts/__tests__/*.test.mjs
# 320 tests · 319 pass · 1 fail

cd tools/k6-proofs && K6_PROOF_OUT_DIR=/tmp/p81-remedy-dryrun-review \
  OPENCLAW_CANDIDATE_SHA=6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955 \
  ./scripts/run-proofs.sh --dry-run \
  R-CD-1,R-CD-2,R-CD-4,R-CD-CHAINED-DEPTH-2,R-CD-MODEL-TOOL,R-CD-TOKEN,R-CW-1,R-CW-3,R-RC-2,R-OBS-CONT-PROVENANCE,R-OBS-PROOF-MARKER,R-OBS-TERMINAL-OUTCOME,R-OBS-BACKEND-DISPOSITION \
  6b09b1dbe938ab6b5f56eaf4e58f1ed243f89955
# exit 0; 9 DRY RUN; 4 SKIPPED construct-only; zero live fires
```

The single failure is identical on exact main and this head:
`candidate-run-result.test.mjs:474` `candidate envelope is outside and invisible
to canonical corpus validation`. `validate-corpus.mjs --index` rejects
`PROOFS/a7ef0317…/proofs-manifest.json` (`openclaw.k6.proofs-manifest.v1` vs
`openclaw.proofs.manifest.v1`, missing `capture_sha`, no `rows[]`). Out of lane.

Net +24 tests, all passing.

## Uncertainties

- GitNexus has no current index of this docs worktree; review is from the
  `origin/main...HEAD` diff, validators, tests, and census bytes.
- I did not re-execute the prior independent-review session. The third-commit
  hole closures were re-derived from current source + tests, not from that
  session’s conclusions.

## Verdict

**CLEAN.** Approve. Residual P3s in `review.md` are the documented gate-scope
limits, not new false-PASS paths.
