import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const runNode = promisify(execFile);
const script = path.resolve('tools/k6-proofs/scripts/fetch-loki-query.mjs');

async function withServer(handler, fn) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('writes a complete public-safe Loki backend receipt', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'loki-fetch-complete-'));
  try {
    await withServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        status: 'success',
        data: {
          resultType: 'streams',
          result: [{ stream: { job: 'openclaw' }, values: [['1', 'a'], ['2', 'b']] }],
          stats: {
            summary: {
              totalBlocks: 2,
              completedJobs: 1,
              totalJobs: 1,
              totalBytesProcessed: 2048,
            },
          },
        },
      }));
    }, async (baseUrl) => {
      const backend = path.join(root, 'backend-status.json');
      const { stdout } = await runNode(process.execPath, [
        script,
        '--logql', '{job="openclaw"}',
        '--loki-url', baseUrl,
        '--start', '2026-08-25T00:00:00.000Z',
        '--end', '2026-08-25T00:05:00.000Z',
        '--backend-status', backend,
        '--row', 'R-OBS-BACKEND-DISPOSITION',
        '--candidate-sha', 'a'.repeat(40),
        '--seat', 'cael',
        '--proof-run-id', 'loki-unit',
      ]);
      const receipt = JSON.parse(stdout);
      assert.equal(receipt.backendDisposition, 'complete');
      assert.equal(receipt.backendComplete, true);
      assert.equal(receipt.resultCount, 2);
      const status = JSON.parse(await readFile(backend, 'utf8'));
      assert.equal(status.interactions[0].zeroResultAuthoritative, false);
      assert.doesNotMatch(JSON.stringify(status), /job="openclaw"/);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('HTTP 200 with zero results and no Loki stats is unknown', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'loki-fetch-unknown-'));
  try {
    await withServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        status: 'success',
        data: { resultType: 'streams', result: [] },
      }));
    }, async (baseUrl) => {
      const backend = path.join(root, 'backend-status.json');
      const { stdout } = await runNode(process.execPath, [
        script,
        '--logql', '{job="openclaw"}',
        '--loki-url', baseUrl,
        '--backend-status', backend,
      ]);
      const receipt = JSON.parse(stdout);
      assert.equal(receipt.backendDisposition, 'unknown');
      assert.equal(receipt.backendComplete, false);
      const status = JSON.parse(await readFile(backend, 'utf8'));
      assert.equal(status.countAuthority, false);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Loki max-entry rejection is capped and retains the slice strategy', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'loki-fetch-capped-'));
  try {
    await withServer((_request, response) => {
      response.statusCode = 400;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        status: 'error',
        error: 'max_entries_limit exceeded',
      }));
    }, async (baseUrl) => {
      const backend = path.join(root, 'backend-status.json');
      await assert.rejects(
        runNode(process.execPath, [
          script,
          '--logql', '{job="openclaw"}',
          '--loki-url', baseUrl,
          '--backend-status', backend,
          '--slice-strategy', 'daily-reslice-required',
        ]),
      );
      const status = JSON.parse(await readFile(backend, 'utf8'));
      assert.equal(status.status, 'capped');
      assert.equal(status.interactions[0].sliceStrategy, 'daily-reslice-required');
      assert.equal(status.countAuthority, false);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
