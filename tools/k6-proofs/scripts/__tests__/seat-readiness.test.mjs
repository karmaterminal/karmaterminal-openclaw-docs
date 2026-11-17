import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir, rm, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { signedSeatReadinessFixture } from './helpers/seat-readiness-fixture.mjs';
import { attachReadinessGateway } from './helpers/readiness-gateway.mjs';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const script = join(repoRoot, 'tools/k6-proofs/scripts/seat-readiness-preflight.mjs');
const policy = join(repoRoot, 'tools/k6-proofs/seat-readiness.policy.json');
const schema = join(repoRoot, 'tools/k6-proofs/seat-readiness.schema.json');
const workflow = join(repoRoot, '.github/workflows/k6-proof.yml');
const project81Workflow = join(repoRoot, '.github/workflows/project81-k6-proof.yml');
const runner = join(repoRoot, 'tools/k6-proofs/scripts/run-proofs.sh');

async function withTmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'p81-seat-readiness-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runPreflight(args, env) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('seat readiness policy keeps the k6 proof-standard version in one place', async () => {
  const parsed = JSON.parse(await readFile(policy, 'utf8'));
  assert.equal(parsed.schema, 'openclaw.k6.seat-readiness-policy.v1');
  assert.equal(parsed.k6.expectedVersion, 'v2.0.0');
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_GATEWAY_TOKEN' && entry.secret === true));
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_CANDIDATE_SHA' && entry.required === true));
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_GATEWAY_RESTART_CMD' && entry.required === false));
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_K6_COST_CAP_TEST_VALUE' && entry.required === false));
});

test('offline readiness remains public-safe and cannot become a pass receipt', async () => {
  await withTmp(async (dir) => {
    const fakeK6 = join(dir, 'k6');
    await writeFile(fakeK6, '#!/bin/sh\necho "k6 v2.0.0 (commit/test)"\n');
    await chmod(fakeK6, 0o755);

    const token = 'CANARY-TOKEN-VALUE-DO-NOT-PRINT';
    const candidateSha = '2723dbee783c113cae70e4fb63a4cff9f55402e3';
    const run = runPreflight(['--json', '--no-gateway', '--expected-k6-version', 'v2.0.0'], {
      K6_BIN: fakeK6,
      OPENCLAW_GATEWAY_TOKEN: token,
      OPENCLAW_CANDIDATE_SHA: candidateSha,
      OPENCLAW_RUNTIME_SHA: candidateSha,
      OPENCLAW_DOCS_SHA: 'd9fd19c6d3b587d36764d0184143b43885762ee1',
      OPENCLAW_SEAT_NAME: 'unit-seat',
      OPENCLAW_GATEWAY_UNIT: 'unit-gateway.service',
      OPENCLAW_SELECTED_ROWS: 'R-UNIT-SEAT-READINESS',
      OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH: '2',
      OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: '5',
      OPENCLAW_SESSION_KEY: 'agent:main:discord:channel:test',
      OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:18789',
    });

    assert.equal(run.status, 2, run.stderr || run.stdout);
    assert.doesNotMatch(run.stdout, new RegExp(token));
    const report = JSON.parse(run.stdout);
    assert.equal(report.schema, 'openclaw.k6.seat-readiness.v3');
    assert.equal(report.outcome, 'PARTIAL-candidate');
    assert.equal(report.policy.name, 'k6 PROOFS seat readiness policy');
    assert.equal(report.k6.command, 'k6');
    assert.doesNotMatch(JSON.stringify(report.k6), new RegExp(dir));
    assert.equal(report.k6.version, 'v2.0.0');
    assert.equal(report.gateway.mode, 'skipped-by-flag');
    assert.equal(report.target.authentication.authenticated, false);
    assert.equal(report.integrity.signature, null);
    const tokenEnv = report.env.find((entry) => entry.name === 'OPENCLAW_GATEWAY_TOKEN');
    assert.deepEqual(
      { present: tokenEnv.present, secret: tokenEnv.secret, value: tokenEnv.value },
      { present: true, secret: true, value: undefined },
    );
    assert.equal(report.session.scope, 'main-agent-session');
  });
});

test('seat readiness schema tracks policy, continuation readiness, checked k6 candidates, and env purposes', async () => {
  const parsed = JSON.parse(await readFile(schema, 'utf8'));
  assert.ok(parsed.required.includes('policy'));
  assert.ok(parsed.required.includes('target'));
  assert.ok(parsed.required.includes('bindings'));
  assert.ok(parsed.required.includes('bindingDigest'));
  assert.ok(parsed.required.includes('integrity'));
  assert.ok(parsed.properties.target.required.includes('configuredMaxSpawnDepth'));
  assert.ok(parsed.properties.target.required.includes('effectiveMaxSpawnDepth'));
});

test('seat readiness schema v3 records the backend client identity and the Gateway auth method', async () => {
  const parsed = JSON.parse(await readFile(schema, 'utf8'));
  assert.equal(parsed.properties.schema.const, 'openclaw.k6.seat-readiness.v3');
  const authentication = parsed.properties.target.properties.authentication.properties;
  assert.deepEqual(authentication.request.properties.client.properties, {
    id: { const: 'gateway-client' },
    mode: { const: 'backend' },
  });
  assert.deepEqual(authentication.response.properties.authMethod, { enum: ['none', 'token'] });
});

test('workflow and matrix runner cannot fall through failed readiness or ambient host config', async () => {
  const [workflowSource, project81Source, runnerSource] = await Promise.all([
    readFile(workflow, 'utf8'),
    readFile(project81Workflow, 'utf8'),
    readFile(runner, 'utf8'),
  ]);
  const readiness = workflowSource.indexOf('- name: Seat readiness preflight');
  assert.ok(readiness >= 0);
  const downstream = workflowSource.slice(readiness);
  for (const step of ['Run k6 scenario', 'Write evidence artifacts', 'Upload run log (dry_run)', 'Upload proof artifacts']) {
    const start = downstream.indexOf(`- name: ${step}`);
    assert.ok(start >= 0, `missing workflow step ${step}`);
    const next = downstream.indexOf('\n      - name:', start + 1);
    const section = downstream.slice(start, next < 0 ? undefined : next);
    assert.match(section, /if:.*steps\.readiness\.outputs\.ready == 'true'/u);
  }
  assert.doesNotMatch(downstream, /expanduser\("~\/\.openclaw/u);
  assert.match(project81Source, /id: target_readiness/u);
  assert.match(project81Source, /steps\.target_readiness\.outputs\.ready == 'true'/u);
  assert.doesNotMatch(project81Source, /~\/\.openclaw|openclaw\.json/u);
  assert.doesNotMatch(runnerSource, /~\/\.openclaw\/openclaw\.json/u);
  assert.match(runnerSource, /verify-seat-readiness\.mjs/u);
});

test('evidence writer copies supplied seat-readiness report into candidate artifacts', async () => {
  await withTmp(async (dir) => {
    const k6Output = join(dir, 'run.txt');
    const readiness = join(dir, 'seat-readiness.json');
    const nonce = 'R-CD-1-1783882863334-writer';
    const sessionKey = `agent:main:r-cd-1-${nonce}`;
    await writeFile(k6Output, `=== K6-PROOF-EVIDENCE ===\n${JSON.stringify({
      manifest_loaded: true,
      tool_accepted: true,
      child_spawned: true,
      nonce,
      sessionKey,
      reason_hash: 'adfa6bb5a86112ed',
      reason_length: 139,
      redacted_events: [{ type: 'res', ok: true, sessionKey, message: `Proof nonce ${nonce}` }],
    })}\n--- END EVIDENCE ---\n`);
    const signingKey = 'evidence-writer-readiness-token';
    const candidateSha = '2723dbee783c113cae70e4fb63a4cff9f55402e3';
    const docsSha = 'd9fd19c6d3b587d36764d0184143b43885762ee1';
    const gatewayWs = 'ws://127.0.0.1:18789';
    await writeFile(readiness, `${JSON.stringify(signedSeatReadinessFixture({
      signingKey,
      candidateSha,
      docsSha,
      gatewayWs,
      seat: 'unit-seat',
      unit: 'unit-gateway.service',
      rows: ['R-UNIT-SEAT-READINESS'],
    }))}\n`);

    const writer = join(repoRoot, 'tools/k6-proofs/scripts/evidence-writer.mjs');
    const run = spawnSync(process.execPath, [
      writer,
      '--input', k6Output,
      '--row', 'R-UNIT-SEAT-READINESS',
      '--seat', 'unit-seat',
      '--sha', '2723dbee783c113cae70e4fb63a4cff9f55402e3',
      '--seat-readiness', readiness,
    ], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        OPENCLAW_GATEWAY_TOKEN: signingKey,
        OPENCLAW_GATEWAY_WS: gatewayWs,
        OPENCLAW_RUNTIME_SHA: candidateSha,
        OPENCLAW_DOCS_SHA: docsSha,
        OPENCLAW_GATEWAY_UNIT: 'unit-gateway.service',
        OPENCLAW_SELECTED_ROWS: 'R-UNIT-SEAT-READINESS',
        OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH: '2',
        OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: '5',
      },
    });

    test('evidence writer rejects a missing receipt before creating artifacts', async () => {
      await withTmp(async (dir) => {
        const input = join(dir, 'run.txt');
        await writeFile(input, '=== K6-PROOF-EVIDENCE ===\n{}\n--- END EVIDENCE ---\n');
        const result = spawnSync(process.execPath, [
          join(repoRoot, 'tools/k6-proofs/scripts/evidence-writer.mjs'),
          '--input', input,
          '--row', 'R-CD-1',
          '--seat', 'unit-seat',
          '--sha', '2723dbee783c113cae70e4fb63a4cff9f55402e3',
        ], { cwd: dir, encoding: 'utf8' });
        assert.notEqual(result.status, 0);
        assert.deepEqual(await readdir(dir), ['run.txt']);
      });
    });

    assert.equal(run.status, 0, run.stderr || run.stdout);
    const printed = JSON.parse(run.stdout);
    const copied = JSON.parse(await readFile(join(dir, printed.runDir, 'seat-readiness.json'), 'utf8'));
    assert.equal(copied.schema, 'openclaw.k6.seat-readiness.v3');
    const evidence = await readFile(join(dir, printed.runDir, 'EVIDENCE.md'), 'utf8');
    assert.match(evidence, /seat-readiness\.json.*captured/);
    for (const name of ['EVIDENCE.md', 'k6-summary.json', 'gateway-events.ndjson', 'evidence-redaction.json']) {
      const content = await readFile(join(dir, printed.runDir, name), 'utf8');
      assert.doesNotMatch(content, new RegExp(nonce));
      assert.doesNotMatch(content, new RegExp(sessionKey));
    }
  });
});

// The preflight runs as a child process while the target answers from this process,
// so the child must not block this event loop (no spawnSync).
function runNode(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: repoRoot, env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

async function withAb5aTarget(target, fn, { preflightEnv = {}, verifyEnv = {} } = {}) {
  await withTmp(async (dir) => {
    const fakeK6 = join(dir, 'k6');
    await writeFile(fakeK6, '#!/bin/sh\necho "k6 v2.0.0 (commit/test)"\n');
    await chmod(fakeK6, 0o755);
    const token = 'READINESS-E2E-TOKEN-DO-NOT-PRINT';
    const candidateSha = 'ab5a30ea79b776f149e24b1fccab9e79b0a5d299';
    const server = createServer((request, response) => {
      response.writeHead(request.url === '/health' ? 200 : 404).end('{}');
    });
    const { connects } = attachReadinessGateway(server, {
      token,
      runtimeSha: candidateSha,
      requireClient: null,
      ...target,
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const inherited = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !/^(OPENCLAW_|K6_BIN$|HARNESS_)/u.test(name)),
    );
    const env = {
      ...inherited,
      K6_BIN: fakeK6,
      OPENCLAW_GATEWAY_TOKEN: token,
      OPENCLAW_GATEWAY_WS: `ws://127.0.0.1:${server.address().port}`,
      OPENCLAW_GATEWAY_UNIT: 'openclaw-gateway.service',
      OPENCLAW_SEAT_NAME: 'emeric',
      OPENCLAW_SESSION_KEY: 'agent:main:k6-readiness-e2e',
      OPENCLAW_CANDIDATE_SHA: candidateSha,
      OPENCLAW_RUNTIME_SHA: candidateSha,
      OPENCLAW_DOCS_SHA: '9ba5518bdb079da3c3c75961fd8cd26be040eb1e',
      OPENCLAW_SELECTED_ROWS: 'R-CW-2',
      OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH: '2',
      OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: '5',
    };
    try {
      const preflight = await runNode([script, '--json'], { ...env, ...preflightEnv });
      const receiptPath = join(dir, 'seat-readiness.json');
      await writeFile(receiptPath, preflight.stdout);
      const verify = await runNode(
        [join(repoRoot, 'tools/k6-proofs/scripts/verify-seat-readiness.mjs'), receiptPath],
        { ...env, ...verifyEnv },
      );
      await fn({ preflight, verify, connects, token });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
}

for (const [authMode, seats] of [['none', 'emeric, elliott, silas'], ['token', 'cael, rune, ronan']]) {
  test(`readiness on an auth.mode=${authMode} target (${seats}) passes as the row scenarios' backend identity`, async () => {
    await withAb5aTarget({ authMode }, async ({ preflight, verify, connects, token }) => {
      assert.equal(preflight.status, 0, preflight.stderr || preflight.stdout);
      assert.doesNotMatch(preflight.stdout, new RegExp(token));
      const receipt = JSON.parse(preflight.stdout);
      assert.equal(receipt.schema, 'openclaw.k6.seat-readiness.v3');
      assert.equal(receipt.outcome, 'PASS-candidate');
      assert.deepEqual(receipt.notes, []);
      const { authentication } = receipt.target;
      assert.equal(authentication.authenticated, true);
      assert.deepEqual(authentication.request.client, {
        id: 'gateway-client',
        mode: 'backend',
        version: 'k6-proof-readiness-v3',
        platform: 'node',
      });
      assert.deepEqual(authentication.request.scopes, ['operator.read']);
      assert.equal(authentication.response.authMethod, authMode);
      assert.deepEqual(authentication.response.authScopes, ['operator.read']);
      assert.match(receipt.integrity.signature, /^[a-f0-9]{64}$/u);
      assert.equal(verify.status, 0, verify.stderr);
      assert.deepEqual(connects, [{
        client: { id: 'gateway-client', mode: 'backend' },
        role: 'operator',
        scopes: ['operator.read'],
        device: false,
        tokenMatches: true,
      }]);
    });
  });
}

for (const [name, target, rejection] of [
  ['an auth.mode=token target with another token', { authMode: 'token', token: 'the-target-token' }, 'INVALID_REQUEST/AUTH_TOKEN_MISMATCH'],
  ['an auth.mode=none target that does not see a local connect', { authMode: 'none', locality: 'remote' }, 'NOT_PAIRED/DEVICE_IDENTITY_REQUIRED'],
]) {
  test(`readiness refused by ${name} fails closed with no signed receipt`, async () => {
    await withAb5aTarget(target, async ({ preflight, verify, connects }) => {
      assert.equal(preflight.status, 2, preflight.stderr || preflight.stdout);
      const receipt = JSON.parse(preflight.stdout);
      assert.equal(receipt.outcome, 'PARTIAL-candidate');
      assert.equal(receipt.target.authentication.authenticated, false);
      assert.equal(receipt.target.authentication.request, null);
      assert.equal(receipt.target.authentication.response, null);
      assert.equal(receipt.integrity.signature, null);
      assert.ok(receipt.notes.includes('gateway-auth-rejected'), receipt.notes.join(','));
      assert.ok(receipt.notes.includes(`gateway-rejection:${rejection}`), receipt.notes.join(','));
      assert.equal(verify.status, 2);
      assert.match(verify.stderr, /seat readiness receipt rejected: invalid-receipt/u);
      assert.equal(connects.length, 1);
      assert.deepEqual(connects[0].client, { id: 'gateway-client', mode: 'backend' });
    });
  });
}

// connectFrame honours HARNESS_CLIENT_ID / HARNESS_CLIENT_MODE, and run-proofs.sh runs k6 with
// the environment verify-seat-readiness saw, so an override would split the rows' identity
// from the one readiness checked (docs#624 review, F3).
for (const [name, overrides, note] of [
  ['HARNESS_CLIENT_ID is set', { HARNESS_CLIENT_ID: 'cli' }, 'harness-client-override-set:HARNESS_CLIENT_ID'],
  [
    'both overrides are set, one of them empty',
    { HARNESS_CLIENT_ID: 'cli', HARNESS_CLIENT_MODE: '' },
    'harness-client-override-set:HARNESS_CLIENT_ID,HARNESS_CLIENT_MODE',
  ],
]) {
  test(`readiness refuses to pass while ${name}`, async () => {
    await withAb5aTarget({ authMode: 'token' }, async ({ preflight, verify, connects }) => {
      assert.equal(preflight.status, 2, preflight.stderr || preflight.stdout);
      const receipt = JSON.parse(preflight.stdout);
      assert.equal(receipt.outcome, 'PARTIAL-candidate');
      assert.equal(receipt.integrity.signature, null);
      assert.deepEqual(receipt.notes, [note]);
      // Readiness itself still connected as the harness identity and was admitted.
      assert.equal(receipt.target.authentication.authenticated, true);
      assert.deepEqual(connects.map((connect) => connect.client), [{ id: 'gateway-client', mode: 'backend' }]);
      assert.equal(verify.status, 2);
      assert.match(verify.stderr, new RegExp(`seat readiness receipt rejected: ${note}`, 'u'));
    }, { preflightEnv: overrides, verifyEnv: overrides });
  });
}

test('verify-seat-readiness refuses a passing receipt while an identity override is set', async () => {
  await withAb5aTarget({ authMode: 'none' }, async ({ preflight, verify }) => {
    assert.equal(preflight.status, 0, preflight.stderr || preflight.stdout);
    assert.equal(JSON.parse(preflight.stdout).outcome, 'PASS-candidate');
    assert.equal(verify.status, 2);
    assert.match(verify.stderr, /seat readiness receipt rejected: harness-client-override-set:HARNESS_CLIENT_MODE/u);
  }, { verifyEnv: { HARNESS_CLIENT_MODE: 'cli' } });
});

test('the evidence writer refuses a valid receipt while an identity override is set', async () => {
  await withTmp(async (dir) => {
    const input = join(dir, 'run.txt');
    await writeFile(input, `=== K6-PROOF-EVIDENCE ===\n${JSON.stringify({
      manifest_loaded: true,
      redacted_events: [],
    })}\n--- END EVIDENCE ---\n`);
    const signingKey = 'evidence-writer-override-token';
    const candidateSha = '2723dbee783c113cae70e4fb63a4cff9f55402e3';
    const docsSha = 'd9fd19c6d3b587d36764d0184143b43885762ee1';
    const gatewayWs = 'ws://127.0.0.1:18789';
    const readiness = join(dir, 'seat-readiness.json');
    await writeFile(readiness, `${JSON.stringify(signedSeatReadinessFixture({
      signingKey,
      candidateSha,
      docsSha,
      gatewayWs,
      seat: 'unit-seat',
      unit: 'unit-gateway.service',
      rows: ['R-UNIT-SEAT-READINESS'],
    }))}\n`);
    const writer = join(repoRoot, 'tools/k6-proofs/scripts/evidence-writer.mjs');
    const env = {
      ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(OPENCLAW_|HARNESS_)/u.test(name))),
      OPENCLAW_GATEWAY_TOKEN: signingKey,
      OPENCLAW_GATEWAY_WS: gatewayWs,
      OPENCLAW_RUNTIME_SHA: candidateSha,
      OPENCLAW_DOCS_SHA: docsSha,
      OPENCLAW_GATEWAY_UNIT: 'unit-gateway.service',
      OPENCLAW_SELECTED_ROWS: 'R-UNIT-SEAT-READINESS',
      OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH: '2',
      OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: '5',
      HARNESS_CLIENT_ID: 'cli',
    };
    const run = spawnSync(process.execPath, [
      writer,
      '--input', input,
      '--row', 'R-UNIT-SEAT-READINESS',
      '--seat', 'unit-seat',
      '--sha', candidateSha,
      '--seat-readiness', readiness,
    ], { cwd: dir, encoding: 'utf8', env });
    assert.notEqual(run.status, 0, run.stdout);
    assert.match(run.stderr, /seat readiness receipt rejected: harness-client-override-set:HARNESS_CLIENT_ID/u);
    assert.deepEqual((await readdir(dir)).sort(), ['run.txt', 'seat-readiness.json']);
  });
});

test('run-proof.sh refuses an identity override from the environment or its k6 arguments before k6 runs', async () => {
  await withTmp(async (dir) => {
    const marker = join(dir, 'k6-invoked');
    const fakeK6 = join(dir, 'k6');
    await writeFile(fakeK6, `#!/bin/sh\nprintf '%s\\n' "$@" > '${marker}'\n`);
    await chmod(fakeK6, 0o755);
    const runProof = join(repoRoot, 'tools/k6-proofs/run-proof.sh');
    const base = {
      ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(OPENCLAW_|HARNESS_)/u.test(name))),
      PATH: `${dir}:${process.env.PATH}`,
      OPENCLAW_CANDIDATE_SHA: '2723dbee783c113cae70e4fb63a4cff9f55402e3',
      OPENCLAW_SEAT_NAME: 'unit-seat',
    };
    const run = (args, env = {}) => spawnSync('bash', [runProof, 'preflight', ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...base, ...env },
    });

    // Control: without an override the runner reaches k6.
    const clean = run([]);
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(await readFile(marker, 'utf8'), /^run\n.*scenarios\/preflight\.js\n/su);
    await rm(marker);

    for (const [args, env, name] of [
      [[], { HARNESS_CLIENT_ID: '' }, 'HARNESS_CLIENT_ID'],
      [[], { HARNESS_CLIENT_MODE: 'cli' }, 'HARNESS_CLIENT_MODE'],
      [['-e', 'HARNESS_CLIENT_MODE=cli'], {}, 'HARNESS_CLIENT_MODE'],
      [['--env=HARNESS_CLIENT_ID=cli'], {}, 'HARNESS_CLIENT_ID'],
    ]) {
      const refused = run(args, env);
      assert.equal(refused.status, 2, JSON.stringify({ args, env, stdout: refused.stdout }));
      assert.match(refused.stderr, new RegExp(`harness-client-override-set:${name}`, 'u'));
      assert.deepEqual(await readdir(dir).then((names) => names.includes('k6-invoked')), false);
    }
  });
});
