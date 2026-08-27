import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
  buildTargetReadinessBinding,
  publicGatewayTarget,
  targetReadinessBindingErrors,
} from '../../lib/target-readiness-binding.mjs';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const script = join(repoRoot, 'tools/k6-proofs/scripts/seat-readiness-preflight.mjs');
const policy = join(repoRoot, 'tools/k6-proofs/seat-readiness.policy.json');
const schema = join(repoRoot, 'tools/k6-proofs/seat-readiness.schema.json');

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
    env: {
      ...process.env,
      OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: '',
      OPENCLAW_SELECTED_ROWS: '',
      ...env,
    },
  });
}

async function writeFakeSeatTools(dir, { maxSpawnDepth, openclawFails = false } = {}) {
  const bin = join(dir, 'bin');
  const fakeK6 = join(bin, 'k6');
  const fakeOpenClaw = join(bin, 'openclaw');
  await mkdir(bin, { recursive: true });
  const defaults = {
    continuation: {
      enabled: true,
      maxChainLength: 200,
      maxDelegatesPerTurn: 500,
      costCapTokens: 500000,
    },
  };
  if (maxSpawnDepth !== undefined) {
    defaults.subagents = { maxSpawnDepth };
  }
  await writeFile(fakeK6, '#!/bin/sh\necho "k6 v2.0.0 (commit/test)"\n');
  await writeFile(
    fakeOpenClaw,
    openclawFails
      ? '#!/bin/sh\nexit 1\n'
      : `#!/bin/sh\nprintf '%s\\n' '${JSON.stringify(defaults)}'\n`,
  );
  await Promise.all([chmod(fakeK6, 0o755), chmod(fakeOpenClaw, 0o755)]);
  return { bin, fakeK6 };
}

function readyEnv({ bin, fakeK6, token = 'CANARY-TOKEN-VALUE-DO-NOT-PRINT' }) {
  return {
    K6_BIN: fakeK6,
    OPENCLAW_GATEWAY_TOKEN: token,
    OPENCLAW_CANDIDATE_SHA: '2723dbee783c113cae70e4fb63a4cff9f55402e3',
    OPENCLAW_SEAT_NAME: 'unit-seat',
    OPENCLAW_SESSION_KEY: 'agent:main:discord:channel:test',
    OPENCLAW_GATEWAY_WS: 'ws://127.0.0.1:18789',
    PATH: `${bin}:${process.env.PATH}`,
  };
}

async function withTargetGateway(dir, config, fn) {
  const fixture = join(dir, 'target-gateway.mjs');
  await writeFile(fixture, `
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:http';

function frame(payload) {
  const body = Buffer.from(JSON.stringify(payload));
  return body.length < 126
    ? Buffer.concat([Buffer.from([0x81, body.length]), body])
    : Buffer.concat([Buffer.from([0x81, 126, body.length >> 8, body.length & 0xff]), body]);
}

function decode(buffer) {
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;
  if (length === 126) {
    length = buffer.readUInt16BE(offset);
    offset += 2;
  }
  const mask = masked ? buffer.subarray(offset, offset + 4) : null;
  if (masked) offset += 4;
  const body = Buffer.from(buffer.subarray(offset, offset + length));
  if (mask) for (let i = 0; i < body.length; i += 1) body[i] ^= mask[i % 4];
  return JSON.parse(body.toString('utf8'));
}

const config = ${JSON.stringify(config)};
const counts = { configRpc: 0, rowOrModelTraffic: 0 };
const countsPath = ${JSON.stringify(join(dir, 'target-counts.json'))};
const saveCounts = () => writeFileSync(countsPath, JSON.stringify(counts));
saveCounts();
const server = createServer((req, res) => {
  if (req.url === '/counts') {
    res.writeHead(200);
    res.end(JSON.stringify(counts));
  } else {
    res.writeHead(req.url === '/health' || req.url === '/status' ? 200 : 404);
    res.end('{}');
  }
});
server.on('upgrade', (req, socket) => {
  const accept = createHash('sha1')
    .update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\nSec-WebSocket-Accept: ' + accept + '\\r\\n\\r\\n');
  socket.on('data', (data) => {
    const request = decode(data);
    if (request.method === 'connect') {
      socket.write(frame({ type: 'res', id: request.id, ok: true, payload: { type: 'hello-ok' } }));
    } else if (request.method === 'config.get') {
      counts.configRpc += 1;
      saveCounts();
      socket.write(frame({ type: 'res', id: request.id, ok: true, payload: { config } }));
    } else {
      counts.rowOrModelTraffic += 1;
      saveCounts();
    }
  });
});
server.listen(0, '127.0.0.1', () => console.log(server.address().port));
`);
  const child = spawn(process.execPath, [fixture], { stdio: ['ignore', 'pipe', 'pipe'] });
  const [chunk] = await once(child.stdout, 'data');
  try {
    return await fn(Number(String(chunk).trim()));
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
  }
}

test('seat readiness policy keeps the k6 proof-standard version in one place', async () => {
  const parsed = JSON.parse(await readFile(policy, 'utf8'));
  assert.equal(parsed.schema, 'openclaw.k6.seat-readiness-policy.v1');
  assert.equal(parsed.k6.expectedVersion, 'v2.0.0');
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_GATEWAY_TOKEN' && entry.secret === true));
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_CANDIDATE_SHA' && entry.required === true));
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_GATEWAY_RESTART_CMD' && entry.required === false));
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_K6_COST_CAP_TEST_VALUE' && entry.required === false));
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_SELECTED_ROWS' && entry.required === false));
  assert.ok(parsed.env.some((entry) => entry.name === 'OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH' && entry.required === false));
});

test('seat readiness JSON contains no env secret values and reports booleans only', async () => {
  await withTmp(async (dir) => {
    const tools = await writeFakeSeatTools(dir, { maxSpawnDepth: 5 });
    const token = 'CANARY-TOKEN-VALUE-DO-NOT-PRINT';
    const urlSecret = 'URL-CREDENTIAL-VALUE-DO-NOT-PRINT';
    const run = runPreflight([
      '--json',
      '--no-gateway',
      '--expected-k6-version', 'v2.0.0',
      '--expected-max-spawn-depth', '5',
      '--rows', 'R-CD-CHAINED-DEPTH-2,R-CD-TOKEN',
    ], {
      ...readyEnv({ ...tools, token }),
      OPENCLAW_GATEWAY_WS: `ws://user:${urlSecret}@127.0.0.1:18789/?token=${urlSecret}`,
    });

    assert.equal(run.status, 0, run.stderr || run.stdout);
    assert.doesNotMatch(run.stdout, new RegExp(token));
    assert.doesNotMatch(run.stdout, new RegExp(urlSecret));
    const report = JSON.parse(run.stdout);
    assert.equal(report.schema, 'openclaw.k6.seat-readiness.v1');
    assert.equal(report.outcome, 'PASS-candidate');
    assert.equal(report.policy.name, 'k6 PROOFS seat readiness policy');
    assert.equal(report.k6.path, tools.fakeK6);
    assert.equal(report.k6.version, 'v2.0.0');
    assert.equal(report.gateway.mode, 'skipped-by-flag');
    assert.equal(report.gateway.url, 'ws://127.0.0.1:18789');
    assert.equal(report.continuation.mode, 'checked');
    assert.equal(report.continuation.enabled, true);
    assert.equal(report.continuation.defaultsPresent, true);
    assert.deepEqual(report.continuationDepth.selectedRows, [
      'R-CD-CHAINED-DEPTH-2',
      'R-CD-TOKEN',
    ]);
    assert.deepEqual(report.continuationDepth.nestedRows, [
      'R-CD-CHAINED-DEPTH-2',
      'R-CD-TOKEN',
    ]);
    assert.equal(report.continuationDepth.configuredMaxSpawnDepth, 5);
    assert.equal(report.continuationDepth.effectiveMaxSpawnDepth, 5);
    assert.equal(report.continuationDepth.requiredMaxSpawnDepth, 2);
    assert.equal(report.continuationDepth.expectedMaxSpawnDepth, 5);
    assert.equal(report.continuationDepth.sufficient, true);
    const tokenEnv = report.env.find((entry) => entry.name === 'OPENCLAW_GATEWAY_TOKEN');
    assert.deepEqual(
      { present: tokenEnv.present, secret: tokenEnv.secret, value: tokenEnv.value },
      { present: true, secret: true, value: undefined },
    );
    assert.equal(report.session.scope, 'main-agent-session');
  });
});

test('target readiness A/B/C selects only authenticated target depth', async (t) => {
  const targetDefaults = (maxSpawnDepth) => ({
    agents: {
      defaults: {
        continuation: {
          enabled: true,
          maxChainLength: 200,
          maxDelegatesPerTurn: 500,
          costCapTokens: 500000,
        },
        ...(maxSpawnDepth === undefined ? {} : { subagents: { maxSpawnDepth } }),
      },
    },
  });

  await t.test('A: host unknown and target depth 5 passes required 2 expected 5', async () => {
    await withTmp(async (dir) => {
      const tools = await writeFakeSeatTools(dir, { openclawFails: true });
      await withTargetGateway(dir, targetDefaults(5), async (port) => {
        const run = runPreflight(
          ['--json', '--rows', 'R-CD-CHAINED-DEPTH-2,R-CD-TOKEN', '--expected-max-spawn-depth', '5'],
          {
            ...readyEnv(tools),
            OPENCLAW_GATEWAY_WS: `ws://127.0.0.1:${port}`,
          },
        );
        assert.equal(run.status, 0, run.stderr || run.stdout);
        const report = JSON.parse(run.stdout);
        assert.equal(report.outcome, 'PASS-candidate');
        assert.equal(report.continuationDepth.configuredMaxSpawnDepth, 5);
        assert.equal(report.continuationDepth.effectiveMaxSpawnDepth, 5);
        assert.equal(report.continuationDepth.requiredMaxSpawnDepth, 2);
        assert.equal(report.continuationDepth.expectedMaxSpawnDepth, 5);
        assert.equal(report.targetObservation.source, 'authenticated-gateway-config-rpc');
        assert.equal(report.targetObservation.bindingValid, true);
        assert.deepEqual(JSON.parse(await readFile(join(dir, 'target-counts.json'), 'utf8')), {
          configRpc: 1,
          rowOrModelTraffic: 0,
        });
      });
    });
  });

  for (const fixture of [
    { label: 'B: host depth 5 and target depth unknown stops', targetDepth: null, reason: 'configured-depth-unknown' },
    { label: 'C: host depth 5 and target depth 1 stops', targetDepth: 1, reason: 'effective-depth-insufficient' },
  ]) {
    await t.test(fixture.label, async () => {
      await withTmp(async (dir) => {
        const tools = await writeFakeSeatTools(dir, { maxSpawnDepth: 5 });
        const targetConfig = fixture.targetDepth === null ? {} : targetDefaults(fixture.targetDepth);
        await withTargetGateway(dir, targetConfig, async (port) => {
          const run = runPreflight(
            ['--json', '--rows', 'R-CD-CHAINED-DEPTH-2,R-CD-TOKEN', '--expected-max-spawn-depth', '5'],
            { ...readyEnv(tools), OPENCLAW_GATEWAY_WS: `ws://127.0.0.1:${port}` },
          );
          assert.equal(run.status, 2, run.stderr || run.stdout);
          const report = JSON.parse(run.stdout);
          assert.equal(report.outcome, 'PARTIAL-candidate');
          assert.equal(report.continuationDepth.reason, fixture.reason);
          assert.deepEqual(JSON.parse(await readFile(join(dir, 'target-counts.json'), 'utf8')), {
            configRpc: 1,
            rowOrModelTraffic: 0,
          });
        });
      });
    });
  }
});

test('D: target observation rejects wrong gateway, seat, candidate, and row binding', () => {
  const source = {
    gatewayWs: 'ws://127.0.0.1:19893',
    seat: 'target-seat',
    gatewayUnit: 'openclaw-gateway-isolated',
    docsHead: 'a'.repeat(40),
    candidateSha: 'b'.repeat(40),
    runtimeBuildSha: 'b'.repeat(40),
    selectedRows: ['R-CD-2', 'R-CD-TOKEN'],
    requiredMaxSpawnDepth: 2,
    expectedMaxSpawnDepth: 5,
  };
  const expected = buildTargetReadinessBinding(source);
  for (const mutation of [
    { gatewayUrlFingerprint: '0'.repeat(64) },
    { seat: 'wrong-seat' },
    { candidateSha: 'c'.repeat(40) },
    { selectedRows: ['R-CD-2'] },
  ]) {
    assert.notDeepEqual(
      targetReadinessBindingErrors({ ...expected, ...mutation }, expected, { requireComplete: true }),
      [],
    );
  }
  const secret = 'URL-CREDENTIAL-CANARY';
  const publicTarget = publicGatewayTarget(`ws://user:${secret}@127.0.0.1:19893/?token=${secret}`);
  assert.equal(publicTarget.url, 'ws://127.0.0.1:19893');
  assert.doesNotMatch(JSON.stringify(publicTarget), new RegExp(secret));
  assert.deepEqual(publicTarget, publicGatewayTarget('ws://127.0.0.1:19893'));
});

test('seat readiness schema tracks policy, continuation readiness, checked k6 candidates, and env purposes', async () => {
  const parsed = JSON.parse(await readFile(schema, 'utf8'));
  assert.ok(parsed.required.includes('policy'));
  assert.ok(parsed.required.includes('continuation'));
  assert.ok(parsed.required.includes('continuationDepth'));
  assert.ok(parsed.properties.continuation.required.includes('enabled'));
  assert.ok(parsed.properties.continuation.required.includes('defaultsPresent'));
  assert.ok(parsed.properties.continuationDepth.required.includes('configuredMaxSpawnDepth'));
  assert.ok(parsed.properties.continuationDepth.required.includes('effectiveMaxSpawnDepth'));
  assert.ok(parsed.properties.continuationDepth.required.includes('requiredMaxSpawnDepth'));
  assert.ok(parsed.properties.k6.required.includes('checked'));
  assert.ok(parsed.properties.env.items.required.includes('purpose'));
});

test('selected-row depth validation rejects omitted and depth-1 config, accepts depth 5, and leaves ordinary rows on defaults', async (t) => {
  await t.test('rejected isolated config shape with omitted depth fails nested rows', async () => {
    await withTmp(async (dir) => {
      const tools = await writeFakeSeatTools(dir);
      const run = runPreflight(
        ['--json', '--no-gateway', '--rows', 'R-CD-CHAINED-DEPTH-2,R-CD-TOKEN'],
        readyEnv(tools),
      );
      assert.equal(run.status, 2, run.stderr || run.stdout);
      const report = JSON.parse(run.stdout);
      assert.equal(report.outcome, 'PARTIAL-candidate');
      assert.equal(report.continuationDepth.configuredMaxSpawnDepth, null);
      assert.equal(report.continuationDepth.effectiveMaxSpawnDepth, 1);
      assert.equal(report.continuationDepth.requiredMaxSpawnDepth, 2);
      assert.equal(report.continuationDepth.source, 'product-default');
      assert.equal(report.continuationDepth.reason, 'effective-depth-insufficient');
    });
  });

  await t.test('explicit depth 1 fails nested rows', async () => {
    await withTmp(async (dir) => {
      const tools = await writeFakeSeatTools(dir, { maxSpawnDepth: 1 });
      const run = runPreflight(
        ['--json', '--no-gateway', '--rows', 'R-CD-TOKEN'],
        readyEnv(tools),
      );
      assert.equal(run.status, 2, run.stderr || run.stdout);
      const report = JSON.parse(run.stdout);
      assert.equal(report.continuationDepth.configuredMaxSpawnDepth, 1);
      assert.equal(report.continuationDepth.requiredMaxSpawnDepth, 2);
      assert.equal(report.continuationDepth.sufficient, false);
    });
  });

  await t.test('proof profile depth 5 passes both nested rows', async () => {
    await withTmp(async (dir) => {
      const tools = await writeFakeSeatTools(dir, { maxSpawnDepth: 5 });
      const run = runPreflight(
        [
          '--json',
          '--no-gateway',
          '--rows', 'R-CD-CHAINED-DEPTH-2,R-CD-TOKEN',
          '--expected-max-spawn-depth', '5',
        ],
        readyEnv(tools),
      );
      assert.equal(run.status, 0, run.stderr || run.stdout);
      const report = JSON.parse(run.stdout);
      assert.equal(report.continuationDepth.configuredMaxSpawnDepth, 5);
      assert.equal(report.continuationDepth.effectiveMaxSpawnDepth, 5);
      assert.equal(report.continuationDepth.requiredMaxSpawnDepth, 2);
      assert.equal(report.continuationDepth.expectationMatched, true);
      assert.equal(report.continuationDepth.sufficient, true);
    });
  });

  await t.test('ordinary non-nested row remains valid under the product default', async () => {
    await withTmp(async (dir) => {
      const tools = await writeFakeSeatTools(dir);
      const run = runPreflight(
        ['--json', '--no-gateway', '--rows', 'R-CD-2'],
        readyEnv(tools),
      );
      assert.equal(run.status, 0, run.stderr || run.stdout);
      const report = JSON.parse(run.stdout);
      assert.equal(report.continuationDepth.configuredMaxSpawnDepth, null);
      assert.equal(report.continuationDepth.effectiveMaxSpawnDepth, 1);
      assert.equal(report.continuationDepth.requiredMaxSpawnDepth, 1);
      assert.deepEqual(report.continuationDepth.nestedRows, []);
      assert.equal(report.continuationDepth.sufficient, true);
    });
  });
});

test('malformed or unknown configured depth fails closed', async (t) => {
  await t.test('malformed explicit depth', async () => {
    await withTmp(async (dir) => {
      const tools = await writeFakeSeatTools(dir, { maxSpawnDepth: 'five' });
      const run = runPreflight(
        ['--json', '--no-gateway', '--rows', 'R-CD-TOKEN'],
        readyEnv(tools),
      );
      assert.equal(run.status, 2, run.stderr || run.stdout);
      const report = JSON.parse(run.stdout);
      assert.equal(report.continuationDepth.effectiveMaxSpawnDepth, null);
      assert.equal(report.continuationDepth.source, 'invalid');
      assert.equal(report.continuationDepth.reason, 'configured-depth-malformed');
    });
  });

  await t.test('unknown depth because config cannot be read', async () => {
    await withTmp(async (dir) => {
      const tools = await writeFakeSeatTools(dir, { openclawFails: true });
      const run = runPreflight(
        ['--json', '--no-gateway', '--rows', 'R-CD-TOKEN'],
        readyEnv(tools),
      );
      assert.equal(run.status, 2, run.stderr || run.stdout);
      const report = JSON.parse(run.stdout);
      assert.equal(report.continuationDepth.mode, 'unavailable');
      assert.equal(report.continuationDepth.effectiveMaxSpawnDepth, null);
      assert.equal(report.continuationDepth.reason, 'configured-depth-unknown');
    });
  });
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
    await writeFile(readiness, `${JSON.stringify({ schema: 'openclaw.k6.seat-readiness.v1', outcome: 'PASS-candidate' })}\n`);

    const writer = join(repoRoot, 'tools/k6-proofs/scripts/evidence-writer.mjs');
    const run = spawnSync(process.execPath, [
      writer,
      '--input', k6Output,
      '--row', 'R-UNIT-SEAT-READINESS',
      '--seat', 'unit-seat',
      '--sha', '2723dbee783c113cae70e4fb63a4cff9f55402e3',
      '--seat-readiness', readiness,
    ], { cwd: dir, encoding: 'utf8' });

    assert.equal(run.status, 0, run.stderr || run.stdout);
    const printed = JSON.parse(run.stdout);
    const copied = JSON.parse(await readFile(join(dir, printed.runDir, 'seat-readiness.json'), 'utf8'));
    assert.equal(copied.schema, 'openclaw.k6.seat-readiness.v1');
    const evidence = await readFile(join(dir, printed.runDir, 'EVIDENCE.md'), 'utf8');
    assert.match(evidence, /seat-readiness\.json.*captured/);
    for (const name of ['EVIDENCE.md', 'k6-summary.json', 'gateway-events.ndjson', 'evidence-redaction.json']) {
      const content = await readFile(join(dir, printed.runDir, name), 'utf8');
      assert.doesNotMatch(content, new RegExp(nonce));
      assert.doesNotMatch(content, new RegExp(sessionKey));
    }
  });
});
