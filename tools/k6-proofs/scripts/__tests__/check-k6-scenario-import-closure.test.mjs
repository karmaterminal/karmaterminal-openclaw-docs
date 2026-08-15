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
