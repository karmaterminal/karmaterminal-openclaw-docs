# Gate 4 at `a22bd9c05c`: Mode-B and the locally run cut shards

**Ruling: PASS-candidate** (🌊, karmaterminal/openclaw#1271 comment 6653747059). It clears the
candidate-owned Mode-B precondition at this exact SHA. It is not a claim that Mode-B was green, and
it does not clear corpus promotion, exact-head fleet readiness or the terminal acceptance gate. A
product change reopens it.

This file and `gate-4-summary.json` are summaries. The raw logs are not published here: they are
13 MB of test output with local paths, and this repository is public. They stay in the evidence
bundle below.

## The two SHAs

| | |
|---|---|
| product (`-f ref=`) | `a22bd9c05c4a7a9c86e72a132cb7939e399104cb` (the run's preflight job names `karmaterminal/openclaw@a22bd9c05c4a7a9c86e72a132cb7939e399104cb`) |
| workflow (`headSha`) | `a768f04231bd0a6f94cc7b845aecaec28a4a4c9e` (openclaw-bootstrap `main`) |

## The Mode-B receipt

[Run 41927761314](https://github.com/karmaterminal/openclaw-bootstrap/actions/runs/41927761314),
`openclaw-local-ci`, `workflow_dispatch`, attempt 1, 2026-11-04 22:43Z to 2026-11-05 04:47Z,
concluded **failure**.

- 91 jobs: 53 success, 27 failure, 3 cancelled, 8 skipped.
- Jobs with a runner: 80 on the ARC scale set `oc-8cpu-32gb`, and 3 on `self-hosted,openclaw-ci-eligible`
  (preflight, static gates, aggregate). The only `ubuntu-24.04` labels are on 2 skipped matrix jobs
  that never had a runner.
- From the scribe's receipt (#1271 comment 6649989076): `receipts_valid`; routed equals planned;
  `hosted_worker_pools == ["arc:oc-8cpu-32gb"]`; the preflight log's line
  `[cost-guard] hosted lane on ARC scale set oc-8cpu-32gb; nothing rented.`; 218,033 passed, 220
  failed, 202 deterministic.

## The failing set, against j12

| | distinct failing tests | sorted-set sha256 (C locale) |
|---|---|---|
| this run (a22b) | **64** | `185b6dea9f175e4867551e227b80e6ce26d21bdb824509d5d8bf4aed27e8a2db` |
| j12, run 41266680278 (product `352f56029dc9…`, workflow `293d9f24ffad…`) | **64** | `185b6dea9f175e4867551e227b80e6ce26d21bdb824509d5d8bf4aed27e8a2db` |

**Identical: all 64 are j12's, and none is new.** This lane re-extracted both sets itself from the
runs' job logs (30 failed or cancelled jobs each, every log available) with the `mb-failset.sh`
method, and both match the bundle's `fs-a22b.tests` and `fs-j12.tests` byte for byte.

From the bundle's failsets (the scribe's extraction): none is new against U12 (41223007528, 66) or
2907 (41834121271, 67). Gone since 2907: the `session-actor-memory` pair (the `4f891818d9`
regression, fixed by the merged `ae11b292`) and a `progress-narrator-model` fallback flake.

The test names are not published here (the bundle has them in `failsets/`).

## The cut shards, run locally at this SHA

Serial, one worker, in a detached worktree at the product SHA. The bundle's
`scripts/run-cut-shards-local.sh` refuses unless `HEAD` equals that SHA; the logs themselves carry
no SHA line. Totals were re-read by this lane from each log's vitest summary.

| shard | failed | passed | classification |
|---|---|---|---|
| `core-runtime-infra-storage-state` | 52 | 21,466 | baseline (2907/j12/U12), except `update-command-post-update` ×3: a load flake that passes alone 94/94 twice |
| `agentic-control-plane-startup-core` | 0 | 89 + 50 | clean |
| `gateway-server-isolated` | 0 | 171 | clean |
| `gateway-database-workers` | 116 (49 files) | 6,712 | **no candidate red** (below) |
| `runtime-config` | 0 | 5,897 | clean; the `4f891818d9` actor-memory pair is fixed |
| `runtime-config` archive-session | 0 | 22 | clean |
| `extension-database-workers` | 0 | 10,177 (781 files) | clean, and run to completion (2907's run of this shard was cut by SIGTERM, so its baseline was partial) |

**`gateway-database-workers`**, as the scribe classified it (#1271 comment 6653707483):

- 27 failing files also fail at j12 or 2907.
- 16 files that fail only at a22b, plus 3 file-level failures, come from test order. The config runs
  `isolate: false`, and a baseline 120 s timeout (`models-list.worker-recovery.integration`, red at
  j12, at 2907 and alone at a22b) ran 2nd instead of about 310th. It left the process-global
  plugin-metadata owner closing, so later files failed with "Gateway plugin metadata is shutting
  down".
- Counterfactuals (log summaries re-read by this lane):
  - the 16 files as one batch without the timeout file: 15 pass (1 failed, 121 passed tests);
  - the 3 file-level failures alone: 42/42;
  - `models-list.native-lifecycle` alone: 3/3, three times;
  - seed-shuffled 6-file runs: seeds 11, 22, 33 and 44 pass 79/79 at a22b; seed 55 fails 1 at
    a22b **and at 2907e656**;
  - the two-file pair with `skill-library-read` first fails 1 at a22b (twice) and at 2907; the 2907
    repeat ran `native-lifecycle` first and passed 5/5.
- So the last order failure is a baseline order leak.

🌊 spot-checked the retained logs and the counterfactual summaries. He records that the full
fail-set extraction and the causal classification are the scribe's, not an independent regrade by
him.

## Evidence bundle

| | |
|---|---|
| path (MinIO, `frond` alias) | `frond/thornfield-artifacts/proof-runs/2026-11-05/j12prime-gate4-local-a22bd9c0/gate4-evidence-a22bd9c0.tar.gz` |
| sha256 | `cf7644f755ede925b201bf5bcb6f8bf654dd08404507d008b0d181a476981166` (re-read and matched by this lane) |
| size | 1,576,476 bytes |
| map | #1271 comment 6653764472: `local-shards/`, `counterfactuals/`, `scripts/`, `failsets/` |
