import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const workflowPath = join(repoRoot, '.github/workflows/k6-baseline-scheduled.yml');

function step(source, name) {
  const start = source.indexOf(`- name: ${name}`);
  assert.ok(start >= 0, `missing step ${name}`);
  const next = source.indexOf('\n      - name:', start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

test('schedule, watchdog window and job conditions name the same crons', async () => {
  const source = await readFile(workflowPath, 'utf8');
  const crons = [...source.matchAll(/- cron: "([^"]+)"/gu)].map((m) => m[1]);
  assert.deepEqual(crons, ['17 2 * * *', '7,37 * * * *', '41 6 * * *']);
  assert.match(source, /NIGHTLY_CRON: "17 2 \* \* \*"/u);
  for (const cron of crons) {
    assert.ok(source.includes(`github.event.schedule == '${cron}'`), `job condition for ${cron}`);
  }
});

test('never a hosted runner: seats are self-hosted, the watchdog is ARC', async () => {
  const source = await readFile(workflowPath, 'utf8');
  assert.doesNotMatch(source, /(ubuntu|windows|macos)-(latest|\d)/u);
  assert.match(source, /runs-on: \[self-hosted, "\$\{\{ matrix\.seat \}\}"\]/u);
  assert.match(source, /K6_BASELINE_WATCHDOG_RUNS_ON \|\| '\["oc-4cpu-16gb"\]'/u);
});

test('never targets a live gateway: the suite reads only the isolated env', async () => {
  const source = await readFile(workflowPath, 'utf8');
  assert.doesNotMatch(source, /18789|gateway_ws|OPENCLAW_GATEWAY_TOKEN: \$\{\{ secrets/u);
  const suite = step(source, 'Run live suite against the isolated gateway');
  assert.match(suite, /if: \$\{\{ steps\.iso\.outputs\.ready == 'true' \}\}/u);
  assert.match(suite, /\. "\$ISO_PRIVATE\/isolated-gateway\.env"/u);
  assert.match(suite, /::add-mask::\$OPENCLAW_GATEWAY_TOKEN/u);
  assert.match(suite, /run-proofs\.sh --live --docs-ref "\$DOCS_REF"/u);
});

test('the SHA under test comes from the seat build-info, and the isolated gateway is bound to it', async () => {
  const source = await readFile(workflowPath, 'utf8');
  assert.match(step(source, 'Resolve deployed build'), /isolated-gateway\.mjs resolve-build/u);
  assert.match(step(source, 'Resolve deployed build'), /XDG_RUNTIME_DIR=\/run\/user\/\$\(id -u\)/u, 'runner services lack the user bus');
  assert.match(step(source, 'Start isolated gateway on the deployed build'), /--expected-sha "\$SHA"/u);
  assert.doesNotMatch(source, /candidate_sha|github\.ref_name|git rev-parse/u);
});

test('teardown, rollup, publication and the fail-closed gate run even after failures', async () => {
  const source = await readFile(workflowPath, 'utf8');
  for (const name of ['Tear down isolated gateway', 'Roll up verdicts against last same-row PASS', 'Fail closed']) {
    assert.match(step(source, name), /if: \$\{\{ always\(\) && steps\.decide\.outputs\.fire == 'true' \}\}/u, name);
  }
  assert.match(step(source, 'Upload baseline rollup'), /always\(\)/u);
  assert.match(step(source, 'Publish rollup comment'), /always\(\)/u);
  const gate = step(source, 'Fail closed');
  for (const reason of ['baseline did not fire', 'regressed from last PASS', 'teardown was not clean', 'K6_BASELINE_ISSUE is not set']) {
    assert.ok(gate.includes(reason), reason);
  }
  assert.match(gate, /SUITE_OUTCOME: \$\{\{ steps\.suite\.outcome \}\}/u);
  assert.match(gate, /MISSING: \$\{\{ steps\.rollup\.outputs\.missing \}\}/u);
  assert.ok(gate.includes('live suite did not complete'), 'a failed suite cannot be masked by continue-on-error');
  assert.ok(gate.includes('live suite has ${MISSING:-unknown} missing rows'), 'one row cannot stand in for the full suite');
});

test('the seat job budget is the one the isolated unit backstop is derived from', async () => {
  const source = await readFile(workflowPath, 'utf8');
  const { JOB_TIMEOUT_MINUTES } = await import('../../lib/isolated-gateway.mjs');
  const budgets = [...source.matchAll(/^ {4}timeout-minutes: (\d+)$/gmu)].map((m) => Number(m[1]));
  assert.equal(budgets[0], JOB_TIMEOUT_MINUTES, 'seat job budget matches JOB_TIMEOUT_MINUTES');
  // The isolated unit's RuntimeMaxSec is not written in the workflow at all;
  // systemdRunArgs derives it, so the two can never drift apart by hand.
  assert.doesNotMatch(source, /RuntimeMaxSec|--runtime-max-sec/u);
});

test('the last-PASS history the gate needs is named, and a gap is red', async () => {
  const source = await readFile(workflowPath, 'utf8');
  // Exact-seat selection goes through the parsed artifact name, never a string
  // prefix: seat labels nest (`cael` inside `cael-dgx`).
  const listing = step(source, 'List published baselines');
  assert.match(listing, /selectPreviousBaseline\(\{/u);
  assert.match(listing, /continue-on-error: true/u, 'a listing failure must not cost the nightly its fire');
  assert.doesNotMatch(listing, /startsWith\(prefix\)/u);

  // Without a run id, download-artifact would look inside this run instead.
  const download = step(source, 'Download previous baseline rollup');
  assert.match(download, /steps\.published\.outputs\.previous_name != ''/u);
  assert.match(download, /steps\.published\.outputs\.previous_run_id != ''/u);

  const rollup = step(source, 'Roll up verdicts against last same-row PASS');
  assert.match(rollup, /LISTING_STATUS: \$\{\{ steps\.published\.outcome \}\}/u);
  assert.match(rollup, /HISTORY_EXPECTED: \$\{\{ steps\.published\.outputs\.previous_name \}\}/u);
  assert.match(rollup, /--history-expected "\$HISTORY_EXPECTED" --listing-status "\$LISTING_STATUS"/u);

  const gate = step(source, 'Fail closed');
  assert.match(gate, /HISTORY_COMPLETE: \$\{\{ steps\.rollup\.outputs\.history_complete \}\}/u);
  assert.match(gate, /HISTORY_GAPS: \$\{\{ steps\.rollup\.outputs\.history_gaps \}\}/u);
  assert.ok(gate.includes('last-PASS history incomplete'), 'an unread history is red, not green');
});

test('every upload carries the run attempt, so a re-run cannot lose its receipts', async () => {
  const source = await readFile(workflowPath, 'utf8');
  // upload-artifact@v4 refuses a name a previous attempt already published.
  assert.match(step(source, 'Roll up verdicts against last same-row PASS'), /--run-attempt "\$\{\{ github\.run_attempt \}\}"/u);
  assert.match(step(source, 'Upload baseline rollup'), /name: \$\{\{ steps\.rollup\.outputs\.artifact_name \}\}/u);
  assert.match(step(source, 'Upload proof artifacts'), /name: k6-baseline-proof-\$\{\{ matrix\.seat \}\}-\$\{\{ github\.run_id \}\}-r\$\{\{ github\.run_attempt \}\}/u);
  // The isolated unit name is already per-attempt, so two attempts never share one.
  assert.match(step(source, 'Start isolated gateway on the deployed build'), /--run-id "\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}"/u);
});

test('alerts go out only on regression or missed fire, and a missing webhook is a failure', async () => {
  const source = await readFile(workflowPath, 'utf8');
  assert.match(step(source, 'Alert on regression or missed fire'), /if: \$\{\{ always\(\) && steps\.rollup\.outputs\.alert == 'true' \}\}/u);
  assert.match(step(source, 'Alert in #sprites'), /if: \$\{\{ steps\.check\.outputs\.alert == 'true' \}\}/u);
  assert.equal((source.match(/WEBHOOK_SCRIBE_NOTIFY is not set/gu) ?? []).length, 2);
});

test('serial per seat, least privilege', async () => {
  const source = await readFile(workflowPath, 'utf8');
  assert.match(source, /group: k6-baseline-\$\{\{ matrix\.seat \}\}-/u);
  assert.match(source, /cancel-in-progress: false/u);
  assert.match(source, /^permissions: \{\}$/mu);
});
