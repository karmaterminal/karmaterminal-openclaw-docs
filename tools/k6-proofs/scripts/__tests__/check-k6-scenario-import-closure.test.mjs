import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const guard = path.join(repoRoot, 'tools/k6-proofs/scripts/check-k6-scenario-import-closure.mjs');

async function fixtureRepo(files) {
  const root = await mkdtemp(path.join(tmpdir(), 'p81-k6-import-closure-'));
  const proofs = path.join(root, 'tools/k6-proofs');
  await mkdir(path.join(proofs, 'scenarios'), { recursive: true });
  await mkdir(path.join(proofs, 'manifests'), { recursive: true });
  for (const [relativePath, source] of Object.entries(files)) {
    const file = path.join(proofs, relativePath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, source);
  }
  return root;
}

function run(root, cwd = root) {
  const result = spawnSync(process.execPath, [guard, '--repo-root', root], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, OPENCLAW_PROOFS_REPO_ROOT: '' },
  });
  return {
    status: result.status,
    stderr: result.stderr,
    report: JSON.parse(result.stdout),
  };
}

test('k6 import-closure guard permits k6 modules and transitive relative helpers', async () => {
  const root = await fixtureRepo({
    'scenarios/r-safe.js': [
      "import crypto from 'k6/crypto';",
      "import { helper } from '../lib/helper.mjs';",
      'export default function () { return crypto.sha256(helper, "hex"); }',
    ].join('\n'),
    'lib/helper.mjs': "export const helper = 'safe';\n",
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.report.ok, true);
    assert.equal(result.report.scenarioCount, 1);
    assert.deepEqual(result.report.violations, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('k6 import-closure guard rejects direct and transitive Node builtins', async () => {
  const root = await fixtureRepo({
    'scenarios/r-direct.js': "import crypto from 'node:crypto';\nexport default function () {}\n",
    'scenarios/r-dynamic.js': "export default async function () { return import('node:os'); }\n",
    'scenarios/r-transitive.js': "import '../lib/node-helper.mjs';\nexport default function () {}\n",
    'lib/node-helper.mjs': "import { readFile } from 'fs/promises';\nexport { readFile };\n",
  });
  try {
    const result = run(root);
    assert.equal(result.status, 1);
    assert.equal(result.report.ok, false);
    assert.deepEqual(
      result.report.violations.map(({ scenario, file, specifier, reason }) => ({
        scenario,
        file,
        specifier,
        reason,
      })),
      [
        {
          scenario: 'tools/k6-proofs/scenarios/r-direct.js',
          file: 'tools/k6-proofs/scenarios/r-direct.js',
          specifier: 'node:crypto',
          reason: 'node-builtin-import',
        },
        {
          scenario: 'tools/k6-proofs/scenarios/r-dynamic.js',
          file: 'tools/k6-proofs/scenarios/r-dynamic.js',
          specifier: 'node:os',
          reason: 'node-builtin-import',
        },
        {
          scenario: 'tools/k6-proofs/scenarios/r-transitive.js',
          file: 'tools/k6-proofs/lib/node-helper.mjs',
          specifier: 'fs/promises',
          reason: 'node-builtin-import',
        },
      ],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('k6 import-closure guard fails closed on unresolved local imports', async () => {
  const root = await fixtureRepo({
    'scenarios/r-missing.js': "import '../lib/missing.mjs';\nexport default function () {}\n",
  });
  try {
    const result = run(root);
    assert.equal(result.status, 1);
    assert.deepEqual(result.report.violations.map(({ specifier, reason }) => ({ specifier, reason })), [
      { specifier: '../lib/missing.mjs', reason: 'unresolved-local-import' },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('k6 import-closure guard rejects a CommonJS require anywhere in the closure', async () => {
  const root = await fixtureRepo({
    'scenarios/r-require.js': [
      "import { helper } from '../lib/cjs-helper.mjs';",
      'export default function () { return helper; }',
    ].join('\n'),
    'lib/cjs-helper.mjs': "const os = require('node:os');\nexport const helper = os;\n",
  });
  try {
    const result = run(root);
    assert.equal(result.status, 1);
    assert.equal(result.report.ok, false);
    const reasons = result.report.violations.map((entry) => entry.reason);
    assert.ok(reasons.includes('commonjs-require'), JSON.stringify(result.report.violations));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('k6 import-closure guard rejects a computed dynamic import it cannot verify', async () => {
  const root = await fixtureRepo({
    'scenarios/r-computed.js': [
      "const name = 'node:' + 'crypto';",
      'export default async function () { const mod = await import(name); return mod; }',
    ].join('\n'),
  });
  try {
    const result = run(root);
    assert.equal(result.status, 1);
    assert.equal(result.report.ok, false);
    const reasons = result.report.violations.map((entry) => entry.reason);
    assert.ok(reasons.includes('computed-dynamic-import'), JSON.stringify(result.report.violations));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('k6 import-closure guard rejects Node-only globals reachable from a scenario', async () => {
  const root = await fixtureRepo({
    'scenarios/r-globals.js': [
      "import { seat } from '../lib/env-helper.mjs';",
      'export default function () { return seat; }',
    ].join('\n'),
    'lib/env-helper.mjs': "export const seat = process.env.OPENCLAW_SEAT_NAME;\n",
  });
  try {
    const result = run(root);
    assert.equal(result.status, 1);
    assert.equal(result.report.ok, false);
    const violation = result.report.violations.find((entry) => entry.reason === 'node-only-global');
    assert.ok(violation, JSON.stringify(result.report.violations));
    assert.equal(violation.specifier, 'process');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('k6 import-closure guard does not fire on prose, prompts, or member names', async () => {
  const root = await fixtureRepo({
    'scenarios/r-prose.js': [
      '// The gateway will process the request and buffer the reply.',
      "import { note } from '../lib/prose-helper.mjs';",
      'export default function () {',
      "  const step = { process: 'named property is not the Node global' };",
      "  const text = 'require(\"node:fs\") inside a prompt is not code';",
      '  return [note, step.process, text, step.module, step.exports];',
      '}',
    ].join('\n'),
    'lib/prose-helper.mjs': [
      '/* Buffer and __dirname appear here only in a comment. */',
      "export const note = `a template with process and require( inside`;",
      'export const preprocessed = 1;',
    ].join('\n'),
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, JSON.stringify(result.report.violations));
    assert.deepEqual(result.report.violations, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
