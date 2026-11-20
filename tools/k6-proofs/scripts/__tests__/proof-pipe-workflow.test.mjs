/**
 * proof-pipe-workflow.test.mjs — docs#587.
 *
 * Contract for the proof pipe's dry-run skeleton outside the runner itself:
 *
 * - the workflow is hand-dispatched only, defaults to dry_run=true, never
 *   names a rented runner, holds no secret and only reads the repository;
 * - no step can fire a row or reach a seat, a gateway or Temporal: the one
 *   script it runs is the dry-run planner, given the dispatcher's dry_run;
 * - dispatch inputs reach shell steps only through env, never spliced into a
 *   script;
 * - the committed bugs-first hold is well formed and in effect;
 * - the planner and its library open no socket and start no process but git.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWithPyYaml } from '../check-k6-skill.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const WORKFLOW = path.join(repoRoot, '.github/workflows/proof-pipe-dry-run.yml');
const HOLD = path.join(repoRoot, 'tools/k6-proofs/proof-pipe/hold.json');
const PLANNER = path.join(repoRoot, 'tools/k6-proofs/scripts/proof-pipe-dry-run.mjs');
const LIBRARY = path.join(repoRoot, 'tools/k6-proofs/lib/proof-pipe-plan.mjs');

const probe = parseWithPyYaml('probe: ok\n');
const noYamlParser = probe.value?.probe === 'ok' ? false : `no YAML parser here: ${probe.unavailable ?? probe.error}`;

const RENTED = /\b(ubuntu|windows|macos)-|blacksmith/iu;

async function workflow() {
  const text = await readFile(WORKFLOW, 'utf8');
  const parsed = parseWithPyYaml(text);
  assert.equal(parsed.error, undefined, parsed.error);
  // YAML 1.1 reads the bare key `on` as true.
  const doc = parsed.value;
  return { text, doc, on: doc.on ?? doc.true };
}

test('the workflow is hand-dispatched only and defaults to a dry run', { skip: noYamlParser }, async () => {
  const { on } = await workflow();
  assert.deepEqual(Object.keys(on), ['workflow_dispatch'], 'no schedule, push, pull_request or workflow_run trigger in the skeleton');
  const inputs = on.workflow_dispatch.inputs;
  assert.equal(inputs.dry_run.type, 'boolean');
  assert.equal(inputs.dry_run.default, true);
  for (const name of ['product_sha', 'docs_sha']) assert.equal(inputs[name].required, true, `${name} is required`);
  assert.deepEqual(inputs.trigger.options, ['manual', 'nightly', 'on-deploy']);
});

test('the workflow only reads, holds no secret and never names a rented runner', { skip: noYamlParser }, async () => {
  const { text, doc } = await workflow();
  assert.deepEqual(doc.permissions, { contents: 'read' });
  assert.equal(/\bsecrets\./u.test(text), false, 'the dry run needs no secret');
  const jobs = Object.values(doc.jobs);
  assert.equal(jobs.length, 1);
  const [job] = jobs;
  assert.equal(RENTED.test(String(job['runs-on']).replace(/vars\.PROOF_PIPE_RUNS_ON/gu, '')), false, `runs-on ${job['runs-on']}`);
  assert.match(String(job['runs-on']), /oc-4cpu-16gb/u, 'the default runner is the ARC scale set');
  // An allowlist decides before a runner is assigned; the blocklist stays as a second layer.
  for (const admitted of ["vars.PROOF_PIPE_RUNS_ON == ''", `startsWith(vars.PROOF_PIPE_RUNS_ON, '["oc-')`, `startsWith(vars.PROOF_PIPE_RUNS_ON, '"oc-')`, `startsWith(vars.PROOF_PIPE_RUNS_ON, '["self-hosted"')`]) {
    assert.ok(String(job.if).includes(admitted), `the job's allowlist admits ${admitted}`);
  }
  assert.equal(String(job.if).match(/startsWith\(/gu)?.length, 3, 'nothing else is admitted');
  // On the decoded labels, so a JSON escape cannot hide one.
  const decoded = `toJSON(fromJSON(vars.PROOF_PIPE_RUNS_ON || '["oc-4cpu-16gb"]'))`;
  for (const label of ['ubuntu-', 'windows-', 'macos-', 'blacksmith']) {
    assert.ok(String(job.if).includes(`!contains(${decoded}, '${label}')`), `the job is skipped before a runner when a decoded label names ${label}`);
  }
});

test('no step can fire a row or reach a seat, a gateway or Temporal', { skip: noYamlParser }, async () => {
  const { doc } = await workflow();
  const [job] = Object.values(doc.jobs);
  const scripts = job.steps.map((step) => step.run ?? '').join('\n');
  // `k6` as a command, not the k6-proofs directory every path here names.
  const forbidden = /run-proofs\.sh|run-proof\.sh|(^|[\s;&|(])k6(\s|$)|live-proof|composite-launcher|thornfield|\btemporal\b|\bssh\b|systemctl|systemd-run|openclaw\.mjs|seat-readiness-preflight|gh workflow run/imu;
  assert.equal(forbidden.test(scripts), false, scripts.match(forbidden)?.[0]);
  const planner = job.steps.filter((step) => (step.run ?? '').includes('proof-pipe-dry-run.mjs'));
  assert.equal(planner.length, 1);
  assert.match(planner[0].run, /--dry-run "\$DRY_RUN"/u);
  assert.equal(planner[0].env.DRY_RUN, '${{ inputs.dry_run }}');
  assert.equal(planner[0].env.RUNS_ON, "${{ vars.PROOF_PIPE_RUNS_ON || '[\"oc-4cpu-16gb\"]' }}");
  assert.match(planner[0].run, /--runner-labels "\$RUNS_ON"/u);
  assert.equal(planner[0].env.PROOF_PIPE_HOLD, '${{ vars.PROOF_PIPE_HOLD }}');
});

test('dispatch inputs reach shell steps only through env', { skip: noYamlParser }, async () => {
  const { doc } = await workflow();
  const [job] = Object.values(doc.jobs);
  for (const step of job.steps) {
    if (step.run) assert.equal(/\$\{\{/u.test(step.run), false, `step "${step.name}" splices an expression into its script`);
  }
});

test('the committed bugs-first hold is well formed and in effect', async () => {
  const hold = JSON.parse(await readFile(HOLD, 'utf8'));
  assert.equal(hold.schema, 'openclaw.k6.proof-pipe-hold.v1');
  // Lifting it is a reviewed change to this file (naming 🌊's go) and to this test.
  assert.equal(hold.held, true);
  assert.equal(hold.release, null);
  assert.match(hold.reason, /bugs-first/u);
  assert.match(hold.reason, /docs#587/u);
});

/** The planner and every local module it imports, transitively. */
async function plannerModules() {
  const seen = new Set();
  const queue = [PLANNER];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = await readFile(file, 'utf8');
    for (const [, spec] of source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/gu)) queue.push(path.resolve(path.dirname(file), spec));
  }
  return [...seen];
}

test('the planner opens no socket and starts no process but git', async () => {
  const modules = await plannerModules();
  assert.ok(modules.includes(LIBRARY) && modules.length >= 4, `scanned ${modules.map((m) => path.basename(m)).join(', ')}`);
  for (const file of modules) {
    const source = await readFile(file, 'utf8');
    assert.equal(/from ['"]node:(http|https|http2|net|tls|dgram|dns)['"]/u.test(source), false, `${path.basename(file)} imports a network module`);
    assert.equal(/\bfetch\(|\bWebSocket\b/u.test(source), false, `${path.basename(file)} reaches the network`);
    // A call, not a method such as RegExp.prototype.exec.
    const spawned = [...source.matchAll(/(?<![.\w])(?:execFileSync|spawnSync|execFile|spawn|execSync|exec)\(\s*([^,)]+)/gu)].map((m) => m[1].trim());
    assert.ok(spawned.every((target) => target === "'git'"), `${path.basename(file)} starts ${spawned.join(', ')}`);
  }
  // A partial clone would fetch a missing object behind a read; the planner forbids it.
  assert.match(await readFile(PLANNER, 'utf8'), /GIT_NO_LAZY_FETCH: '1'/u);
});
