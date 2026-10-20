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
