# Scheduled exact-build baseline (#587)

Continuation went from 09-25 to 10-16 with no k6 run, and the deployed build
`7d8a1a91c6` was never proved live. Nothing scheduled noticed. This baseline
fires the live suite on its own and alerts when it does not.

- Workflow: [`.github/workflows/k6-baseline-scheduled.yml`](../../../.github/workflows/k6-baseline-scheduled.yml)
- Recipe: [`scripts/isolated-gateway.mjs`](../scripts/isolated-gateway.mjs) with its pure contract in [`lib/isolated-gateway.mjs`](../lib/isolated-gateway.mjs)
- Rollup, deploy-check and watchdog: [`scripts/scheduled-baseline.mjs`](../scripts/scheduled-baseline.mjs) and [`lib/scheduled-baseline.mjs`](../lib/scheduled-baseline.mjs)

This issue owns the runner. Thornfield owns only its own schedule
(temporal-thornfield-frond#20). Once Thornfield is armed, it may dispatch this
workflow and account for the receipt (#21). It does not re-implement the
runner, and this workflow has no Temporal arm.

## What runs

| trigger | when (UTC) | where | what |
|---|---|---|---|
| nightly | `17 2 * * *` | each seat's own self-hosted runner | `rows=live-suite` against the seat's deployed build |
| deploy-check | `7,37 * * * *` | each seat's own self-hosted runner | the same run, only when the seat's `build-info.commit` has no baseline artifact yet |
| watchdog | `41 6 * * *` | ARC (`oc-4cpu-16gb` by default) | alert for every seat with no *fired* baseline since 02:17 |

Every seat job does the following, in order:

1. **Resolve the SHA from the seat.** It reads `<install>/dist/build-info.json`
   from the first install dir that has one. The order matches the probe in
   bootstrap's `deploy-gateway.yml`: `~/flesh_beast_tmp/openclaw`,
   `~/.openclaw/workspace/openclaw`, then `~/flesh_beast_best_beast/openclaw`.
   That commit is both the candidate and the runtime SHA. A branch tip is never
   used. The step refuses a build:
   - with a non-40-hex commit;
   - with no `buildId` at all, or whose `buildId` lacks `commit[0:12]`. Readiness
     binds the runtime SHA through `hello.server.buildId`, so either way this
     build could only ever end in `runtime-sha-not-observed` *after* a gateway
     had been started. It is refused before anything runs.
   - with no `packages/*/dist`;
   - with no `extensions/diagnostics-otel/dist`.
2. **Bring up an isolated gateway** (`isolated-gateway.mjs up`). It starts a
   transient `systemd --user` unit, `openclaw-k6-iso-<seat>-<run>.service`,
   which runs `node <install>/openclaw.mjs gateway run --port <free> --bind loopback`
   from the seat's own dist. The unit gets:
   - a fresh `OPENCLAW_CONFIG_PATH`, `OPENCLAW_STATE_DIR`, `HOME` and workspace
     under `RUNNER_TEMP`. An empty state dir makes `agent:main:main` disposable.
   - a 32-byte ephemeral token, passed through a 0600 `EnvironmentFile`, never argv;
   - **no `channels` key**, with channel credentials unset from the unit
     environment and `--ambient-channels` left off;
   - `diagnostics.otel` and `plugins.entries.diagnostics-otel` enabled, with
     service name `<seat>-k6-isolated` (exported as `OPENCLAW_PROOFS_SERVICE_NAME`
     for trace lookup);
   - a finite `RuntimeMaxSec` backstop, so systemd stops the gateway even if the
     job dies before teardown. It is derived, never written twice: the seat job's
     `timeout-minutes` (150) plus a 15-minute grace, so
     `JOB_TIMEOUT_MINUTES * 60 + RUNTIME_GRACE_SEC` = **10500s**. A shorter
     backstop would stop the gateway mid-suite and turn a healthy night into a
     partial; `systemdRunArgs` throws on anything that does not outlast the job
     budget, and a contract test keeps the two numbers in step. The grace is well
     inside the next run's one-hour peer wait, so an orphan cannot block the
     following fire.
   - the seat's optional provider `environmentFile` **first** and the isolated
     env file **last**. systemd lets a later `EnvironmentFile=` override an
     earlier one, so the isolated `HOME`, config path, state dir, token and port
     win whatever the provider file says. `up` also refuses a provider file that
     so much as names any of those keys, or any channel credential, or that is
     readable by group or world — before any unit exists
     (`provider-env-file-sets-isolation-env:...`). `UnsetEnvironment=` is still
     applied after every `EnvironmentFile=`.

   The unit waits for any other `openclaw-k6-iso-<seat>-*` unit to finish
   first, which keeps it to one gateway per seat at the host.
3. **Prove readiness through the gateway's own authenticated `config.get`**,
   and fail closed if any check fails. The checks:
   - `hello.server.buildId` contains the SHA. This is the `runtimeSha=unknown`
     PARTIAL of 10-16, now refused before any row fires.
   - `configRevisionHash == appliedConfigHash`, so the applied config equals
     the persisted one, and the file on disk is unchanged.
   - No channel is enabled.
   - diagnostics-otel is enabled.
   - Effective `maxSpawnDepth` matches the profile.
   - Continuation is enabled.
   - `build-info.commit` did not change while the gateway started.

   Then `run-proofs.sh --live` runs its own signed seat-readiness against the
   same target before any row.
4. **Run `run-proofs.sh --live`** against the isolated gateway only. The suite
   reads its target from the 0600 env file `up` wrote. The restart command it
   gets is `systemctl --user restart <isolated unit>`, never the live one.
5. **Tear down** (`down`, always). This stops the unit and proves:
   - the port is closed;
   - the live `openclaw-gateway.service` has the same `MainPID`,
     `ActiveEnterTimestamp` and `NRestarts` as before;
   - the temp root is deleted.

   Anything else marks the run DIRTY, and the job fails.
6. **Roll up** each of the 34 rows as pass / partial / fail / missing /
   honest-limit, each with its previous observation, its regression **anchor**
   and its **last same-row PASS**. The sources are, newest first, the previous
   fired baseline for this seat (its artifact) and every
   `PROOFS/*/proofs-manifest.json`. See *Reading the history honestly* below.
7. **Publish** the rollup as one comment on `vars.K6_BASELINE_ISSUE`, plus the
   job summary. Upload it as the artifact
   `k6-baseline-<seat>-<sha12>-<nightly|deploy|manual>-<fired|nofire>-<run>-r<attempt>`.
   The attempt is part of the name because `upload-artifact@v4` refuses a name a
   previous attempt of the same run already published, which would otherwise
   lose the rollup of every re-run. The watchdog and the deploy-check parse the
   name, and still read a pre-attempt name as attempt 1. The watchdog counts only
   `nightly` artifacts, so a deploy-check or manual run cannot conceal a missed
   unattended nightly.
8. **Alert** in #sprites (`secrets.WEBHOOK_SCRIBE_NOTIFY`, the same webhook
   openclaw-local-ci uses) **only** when the run did not fire or a row
   regressed. A missing history is red in the job and rollup, but is not
   reported as a row regression. A
   regression means that row's newest *anchoring* observation was acceptable
   (PASS, or the R-RC-2 honest limit) and this one is not. A row that was
   already failing is listed but does not re-alert every night.
9. **Fail closed.** The job is red in any of these cases:
   - it did not fire;
   - the live suite aborted or any of its 34 rows are missing;
   - a row regressed;
   - **the last-PASS history it needed was not read** (`historyComplete: false`);
   - teardown was dirty;
   - the rollup was not published;
   - an alert was needed but could not be sent.

A run that fires no row is a failure in its own right. Its rollup names the
earliest stage that stopped it, for example `resolve-build:...`,
`blocked-at:seat-prerequisites` or `isolated-gateway-not-ready:...`.

## Reading the history honestly

The regression gate is a claim about the past, so the rollup states exactly how
much past it actually read. Four rules:

- **An unread history is not a green one.** The artifact-listing step is
  `continue-on-error`, so a listing failure cannot cost the nightly its fire.
  But the rollup is told the listing's outcome and the name of the previous
  baseline it should have weighed. A listing that failed or was skipped, or a
  named baseline that never arrived, is recorded in `historyGaps`
  (`artifact-listing-failure`, `previous-baseline-not-loaded:<name>`) and
  fails the job. "No regression" is never printed for a gate that did not
  run.
- **Exact seat matching.** The previous baseline is selected through the parsed
  artifact name, never a string prefix: seat labels nest, and `cael` must never
  inherit `cael-dgx`'s lineage. Only an unexpired `fired` artifact for exactly
  this seat counts, and never one from this run.
- **Deterministic corpus dates.** Corpus `generated` values are free-form
  (`2026-09-20`, `2026-09-20 (re-fired)`, an instant, or absent). `Date.parse()`
  resolves the noted forms in the *runner's* local zone, so the same corpus
  could order differently on two machines. Only an ISO instant with an offset
  and a bare `YYYY-MM-DD` day are accepted; a day is pinned to UTC midnight and
  loses to any instant later that day. Anything else is **skipped**, and
  `corpusProvenance.skipped` names every skipped corpus and why
  (`generated-absent`, `generated-unparseable`, `rows-not-a-list`,
  `no-row-states`). The rollup never implies it weighed all of `PROOFS`.
  A PASS whose corpus records no `fire_type` is reported as *provenance
  unknown*, never as `fresh`.
- **A documented non-discriminating PASS cannot anchor a 2.x claim.**
  `R-CW-DELEGATE-SELF-CONTINUATION`'s own manifest records that its retained
  PASS receipts from before #570 are historically non-discriminating: the
  parent-return evidence was a parent-stream substring check that the parent's
  own `continue_delegate` task text could satisfy. Those PASSes are kept as
  history and are **not** re-classified as FAIL, but the current gate will not
  anchor on them. `NON_DISCRIMINATING_PASS_EPOCHS` holds one explicit row with
  the #570 merge commit's date (`57478ad4`, 2026-10-05T05:31:56Z); it is not a
  blanket re-reading of the corpus. A row whose only observation is inside such
  an epoch is reported as `⚠️ no discriminating anchor` rather than as green,
  and a test pins the constant against the manifest note it copies.

## Honest denominator

`rows=live-suite` is **34 rows**, the runnable `k6-runnable` manifests. The
rollup states it on every run. Two groups sit outside it by design:

- **Orchestration-only:** `R-CW-5`, `R-CW-5A`, `R-CW-6` and `R-CW-6A`. These
  are fixture-driven and are not fired by this runner. The full continuation
  matrix is therefore 38 rows, and 34/38 is not a shortfall.
- **Construct-only:** `R-CD-RETURN-COVENANT-AUTHORITY`, `R-OBS-BACKEND-DISPOSITION`,
  `R-OBS-CONT-PROVENANCE`, `R-OBS-PROOF-MARKER` and `R-OBS-TERMINAL-OUTCOME`.
  These have no scenario.

`scheduled-baseline.test.mjs` pins the 34 and the four orchestration-only rows
against the catalog.

## Setup

None of this is armed until someone with the access below does it. Merging the
workflow arms only the cron entries. Until `K6_BASELINE_SEATS` is set, the
nightly fails at matrix expansion, so it is red rather than silent. The
deploy-check stays quiet.

### Repository settings (docs repo admin)

| kind | name | value |
|---|---|---|
| variable | `K6_BASELINE_SEATS` | JSON array of seat runner labels, e.g. `["ronan"]` |
| variable | `K6_BASELINE_ISSUE` | issue number that receives the rollup comments |
| secret | `WEBHOOK_SCRIBE_NOTIFY` | the #sprites webhook (exists in openclaw-bootstrap; the docs repo holds only `OPENCLAW_GATEWAY_TOKEN` today) |
| variable (optional) | `K6_BASELINE_WATCHDOG_RUNS_ON` | JSON runs-on for the watchdog, default `["oc-4cpu-16gb"]` |
| variable (optional) | `K6_BASELINE_PROFILE_PATH` | profile path on the seat, default `~/.config/openclaw-k6-baseline/profile.json` |
| variable (optional) | `K6_BASELINE_INSTALL_DIR` | pin the install dir instead of probing |

The isolated gateway mints its own token, so this workflow does not use the
existing `OPENCLAW_GATEWAY_TOKEN` secret.

### On each seat (that seat's prince)

1. A self-hosted runner labelled with the seat name, available to this
   repository. `project81-k6-proof.yml` already relies on this.
2. Node ≥ 22 on the runner's PATH (global `WebSocket`), plus `jq`, `systemd-run`,
   `systemctl --user` and `journalctl --user` reachable from the runner service.
3. k6 at the policy version (`seat-readiness.policy.json`, currently `v2.0.0`),
   on PATH or at `~/bin/k6`.
4. `extensions/diagnostics-otel/dist` built in the deployed install dir.
5. A profile at the path above, mode `0600`, in the shape of
   [`examples/isolated-gateway-profile.example.json`](../examples/isolated-gateway-profile.example.json).
   It holds the model, an `altModel` for the model-override rows, the
   providers, continuation limits, `maxSpawnDepth` ≥ 2, and the OTLP endpoint.
   It must not contain `channels`. Put provider keys in `environmentFile` (also
   0600, and not readable by group or world) and reference them as `${VAR}`.
   That file may define provider credentials **only**. `up` refuses it if it
   names `HOME`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_STATE_DIR`,
   `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_PORT` or any channel credential,
   because such a file would aim this gateway at live seat state.

Try it by hand on a seat before arming. This touches nothing live:

```bash
node tools/k6-proofs/scripts/isolated-gateway.mjs resolve-build
node tools/k6-proofs/scripts/isolated-gateway.mjs up --seat "$SEAT" --run-id manual1 \
  --profile ~/.config/openclaw-k6-baseline/profile.json --out /tmp/iso-out --private-dir /tmp/iso-private
node tools/k6-proofs/scripts/isolated-gateway.mjs down --private-dir /tmp/iso-private --out /tmp/iso-out
```

## Proving the DoD (not yet observed)

- **Two consecutive unattended nightlies.** Two scheduled runs in a row whose
  rollups were published on the issue.
- **Forced missed fire.** Use either of these:
  - Dispatch `mode=watchdog` with `seats_json=["k6-missed-fire-probe"]`. No runner
    has that label, so no baseline exists for it, and the watchdog must alert
    and go red.
  - On a real seat, temporarily point `K6_BASELINE_PROFILE_PATH` at a
    missing file and dispatch `mode=nightly`. That run does not fire
    (`isolated-gateway-not-ready:profile-unreadable`), and its own alert must post.

  An actually offline seat behaves like the first route. Its nightly job sits
  queued, and the watchdog reports `no-baseline-published`.

## Limits and what this repository cannot wire alone

- **On-deploy is a 30-minute poll, not a push.** A real hook would need a step
  in openclaw-bootstrap's `deploy-gateway.yml`. After a successful deploy that
  changes `build-info.commit`, that step would dispatch this workflow, and it
  would need a token with `actions: write` on this repository. The bootstrap
  maintainers would have to add both. The poll needs neither, and its
  detection latency is at most 30 minutes plus queue time.
- **A deploy-check attempt is retried, up to three times.** An attempt that did
  not fire proved nothing — transient contention on the seat ends in a `nofire`
  artifact — so the next poll refires it (`retry-after-nofire:<n>`). After
  `MAX_NOFIRE_ATTEMPTS` (3) no-fire attempts for one seat and SHA the poll goes
  quiet (`nofire-attempts-exhausted:3`), so a seat that is simply broken cannot
  alert every 30 minutes; the nightly still retries it once a day. A `fired`
  baseline for the SHA ends the polling regardless
  (`already-fired-for-deployed-sha`).
- **The watchdog's own runner can fail silently.** If ARC is down or GitHub
  stops scheduling, nothing here alerts. GitHub disables schedules after 60
  days without repository activity. The external dead-man's switch for that
  case is Thornfield's job (#21), not this workflow's.
- **ARC visibility is assumed.** The `oc-*` scale sets are documented in
  openclaw-bootstrap (`arc-smoke.yml`). This repository has never used them,
  so the docs repo must be granted that runner group.
- **The proving node is the runner's node.** The isolated gateway runs the
  deployed dist with the runner's `node` (≥ 22). If the live unit pins a
  different node binary, set the runner's PATH to match.
- **Single-SHA scope.** The baseline proves what is deployed. It does not
  replace a presentation corpus. Every row stays `candidateOnly` /
  `foldRequiresReview`.
