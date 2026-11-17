// The pre-v3 readiness exception (docs#624 review, finding F1): a committed R-CD-2 run frozen
// in scripts/pre-v3-readiness-r-cd-2-runs.json keeps its v2 receipt re-verifiable through
// consumeRcd2Authority, the verifier the R-CD-2 KEYED-AUTHORITY-REVIEW.json files name. No
// other v2 receipt is accepted, and no gate in front of a live run accepts v2 at all.
//
// A listed run can only be exercised end to end with a list that names a fixture, because the
// committed receipts are signed with proof-gateway tokens this suite never holds. Those tests
// import a copy of the authority modules whose only difference is the frozen list file; the
// committed receipts themselves are checked up to the signature, with the real list.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
// Namespace imports, so a symbol a tree does not export yet fails only the test that reads it.
import * as authority from '../../lib/r-cd-2-authority-context.mjs';
import * as readiness from '../target-readiness.mjs';
import { consumeRunReadiness } from '../run-readiness-consumer.mjs';
import {
  BASE,
  digest,
  SIGNING_KEY,
  writeRcd2Bundle,
} from './helpers/r-cd-2-authority-fixture.mjs';
import {
  preV3ReadinessShape,
  resealReadinessFixture,
  signedSeatReadinessFixture,
} from './helpers/seat-readiness-fixture.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../../../..');
const k6Proofs = path.join(repoRoot, 'tools/k6-proofs');
const frozenListFile = path.join(k6Proofs, 'scripts/pre-v3-readiness-r-cd-2-runs.json');
const verifier = path.join(k6Proofs, 'scripts/verify-seat-readiness.mjs');
const writer = path.join(k6Proofs, 'scripts/evidence-writer.mjs');
const fixtureRun = [BASE.candidateSha, BASE.row, BASE.seat, BASE.runId].join('/');

/**
 * The authority modules as they are, copied beside a frozen list naming `runs`, so a fixture
 * run can be listed without touching the real list. Only the list file differs: `listBody`
 * replaces its whole text, and `null` leaves it out.
 */
async function authorityListing(runs, { listBody } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rcd2-pre-v3-modules-'));
  const copy = path.join(dir, 'tools/k6-proofs');
  await cp(path.join(k6Proofs, 'lib'), path.join(copy, 'lib'), { recursive: true });
  await mkdir(path.join(copy, 'scripts'), { recursive: true });
  await copyFile(path.join(k6Proofs, 'scripts/target-readiness.mjs'), path.join(copy, 'scripts/target-readiness.mjs'));
  const frozen = JSON.parse(await readFile(frozenListFile, 'utf8'));
  if (listBody !== null) {
    await writeFile(
      path.join(copy, 'scripts/pre-v3-readiness-r-cd-2-runs.json'),
      listBody ?? `${JSON.stringify({ ...frozen, runs }, null, 2)}\n`,
    );
  }
  for (const file of ['lib/r-cd-2-authority-context.mjs', 'scripts/target-readiness.mjs']) {
    assert.equal(
      digest(await readFile(path.join(copy, file))),
      digest(await readFile(path.join(k6Proofs, file))),
      `${file} is copied unchanged`,
    );
  }
  return {
    authority: await import(pathToFileURL(path.join(copy, 'lib/r-cd-2-authority-context.mjs')).href),
    readiness: await import(pathToFileURL(path.join(copy, 'scripts/target-readiness.mjs')).href),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

async function withBundle(options, fn) {
  const fixture = await writeRcd2Bundle(repoRoot, options);
  try {
    return await fn(fixture);
  } finally {
    await fixture.cleanup();
  }
}

async function withListing(runs, fn, options) {
  const listing = await authorityListing(runs, options);
  try {
    return await fn(listing);
  } finally {
    await listing.cleanup();
  }
}

const consume = (module, fixture, signingKey = SIGNING_KEY) =>
  module.consumeRcd2Authority({ runDir: fixture.runDir, signingKey });

// The v2 receipt with one more edit after the v2 shape.
const preV3With = (edit) => (unsigned) => edit(preV3ReadinessShape(unsigned)) ?? unsigned;

test('a listed v2 run re-verifies through consumeRcd2Authority, the keyed-review verifier', async () => {
  await withBundle({ readinessEdit: preV3ReadinessShape }, async (fixture) => {
    const committed = JSON.parse(fixture.seatReadinessBody);
    assert.equal(committed.schema, 'openclaw.k6.seat-readiness.v2');
    assert.deepEqual(committed.target.authentication.request.client, {
      id: 'cli', mode: 'cli', version: 'k6-proof-readiness-v2', platform: 'node',
    });
    assert.equal(Object.hasOwn(committed.target.authentication.response, 'authMethod'), false);
    await withListing(
      [{ run: fixtureRun, seatReadinessSha256: digest(fixture.seatReadinessBody) }],
      async ({ authority: listed }) => {
        const result = consume(listed, fixture);
        assert.equal(result.outcome, 'PASS-candidate');
        assert.equal(result.candidateOnly, true);
        assert.equal(result.foldRequiresReview, true);
        assert.equal(result.canonicalFoldForbidden, true);
      },
    );
  });
});

test('a listed v2 receipt signed with another key is refused: the signature is still checked', async () => {
  await withBundle({
    readinessEdit: preV3ReadinessShape,
    readinessSigningKey: 'another-proof-gateway-token',
  }, async (fixture) => {
    await withListing(
      [{ run: fixtureRun, seatReadinessSha256: digest(fixture.seatReadinessBody) }],
      async ({ authority: listed }) => {
        assert.throws(
          () => consume(listed, fixture),
          /copied seat readiness failed integrity validation: invalid-signature/u,
        );
      },
    );
  });
});

test('a missing or malformed frozen list re-verifies no v2 receipt', async () => {
  await withBundle({ readinessEdit: preV3ReadinessShape }, async (fixture) => {
    const entry = { run: fixtureRun, seatReadinessSha256: digest(fixture.seatReadinessBody) };
    const frozen = JSON.parse(await readFile(frozenListFile, 'utf8'));
    const list = (value) => `${JSON.stringify(value, null, 2)}\n`;
    const receipt = JSON.parse(fixture.seatReadinessBody);
    const expected = {
      signingKey: SIGNING_KEY,
      candidateSha: BASE.candidateSha,
      runtimeSha: BASE.runtimeBuildSha,
      docsSha: BASE.docsRef,
      gatewayFingerprint: receipt.bindings.gatewayUrlFingerprint,
      seat: BASE.seat,
      unit: receipt.bindings.unit,
      rows: receipt.bindings.selectedRows,
      requiredDepth: receipt.bindings.requiredMaxSpawnDepth,
      expectedDepth: receipt.bindings.expectedMaxSpawnDepth,
    };
    const run = { candidateSha: BASE.candidateSha, row: BASE.row, seat: BASE.seat, runId: BASE.runId };
    // The well-formed list admits the fixture, so each refusal below is the list's.
    await withListing([entry], async ({ readiness: listed }) => {
      assert.deepEqual(
        listed.validatePreV3ReadinessReceipt({ raw: Buffer.from(fixture.seatReadinessBody), run }, expected),
        { valid: true, reason: null },
      );
    });
    for (const [name, listBody] of [
      ['missing', null],
      ['not JSON', '{"schema":'],
      ['another schema', list({ ...frozen, schema: 'openclaw.k6.pre-v3-readiness-r-cd-2-runs.v2', runs: [entry] })],
      ['no runs', list({ ...frozen, runs: [] })],
      ['runs not a list', list({ ...frozen, runs: { [entry.run]: entry.seatReadinessSha256 } })],
      ['a duplicate run', list({ ...frozen, runs: [entry, entry] })],
      ['an uppercase digest', list({ ...frozen, runs: [{ ...entry, seatReadinessSha256: entry.seatReadinessSha256.toUpperCase() }] })],
      ['another row', list({ ...frozen, runs: [entry, { ...entry, run: entry.run.replace('/R-CD-2/', '/R-CW-2/') }] })],
    ]) {
      await withListing([entry], async ({ authority: listed, readiness: listedReadiness }) => {
        assert.deepEqual(
          listedReadiness.validatePreV3ReadinessReceipt({ raw: Buffer.from(fixture.seatReadinessBody), run }, expected),
          { valid: false, reason: 'pre-v3-run-list-unreadable' },
          name,
        );
        assert.throws(
          () => consume(listed, fixture),
          /copied seat readiness failed integrity validation: pre-v3-run-list-unreadable/u,
          name,
        );
      }, { listBody });
    }
  });
});

test('an unlisted v2 run is refused, by the real frozen list', async () => {
  await withBundle({ readinessEdit: preV3ReadinessShape }, async (fixture) => {
    assert.throws(
      () => consume(authority, fixture),
      /copied seat readiness failed integrity validation: pre-v3-run-not-listed/u,
    );
  });
});

test('a listed run whose receipt is not the pinned bytes is refused', async () => {
  await withBundle({ readinessEdit: preV3ReadinessShape }, async (fixture) => {
    // The same receipt, one byte different: re-serialized without the trailing newline.
    const pinnedElsewhere = digest(fixture.seatReadinessBody.trimEnd());
    await withListing([{ run: fixtureRun, seatReadinessSha256: pinnedElsewhere }], async ({ authority: listed }) => {
      assert.throws(
        () => consume(listed, fixture),
        /copied seat readiness failed integrity validation: pre-v3-receipt-bytes-mismatch/u,
      );
    });
  });
});

for (const [name, edit, refusal] of [
  [
    'from the backend identity',
    (unsigned) => {
      unsigned.target.authentication.request.client = {
        id: 'gateway-client', mode: 'backend', version: 'k6-proof-readiness-v2', platform: 'node',
      };
    },
    /copied seat readiness has invalid schema or outcome/u,
  ],
  [
    'from the cli id in backend mode',
    (unsigned) => { unsigned.target.authentication.request.client.mode = 'backend'; },
    /copied seat readiness failed integrity validation: invalid-receipt/u,
  ],
  [
    'with the v3 client version',
    (unsigned) => { unsigned.target.authentication.request.client.version = 'k6-proof-readiness-v3'; },
    /copied seat readiness failed integrity validation: invalid-receipt/u,
  ],
  [
    'that records an auth method v2 never wrote',
    (unsigned) => { unsigned.target.authentication.response.authMethod = 'token'; },
    /copied seat readiness failed integrity validation: invalid-receipt/u,
  ],
  [
    'bound to another candidate',
    (unsigned) => {
      unsigned.candidate.sha = '9'.repeat(40);
      unsigned.bindings.candidateSha = '9'.repeat(40);
      unsigned.bindings.runtimeSha = '9'.repeat(40);
    },
    /has invalid schema or outcome|authority identity mismatch/u,
  ],
]) {
  test(`a listed v2 receipt ${name} is refused`, async () => {
    await withBundle({ readinessEdit: preV3With(edit) }, async (fixture) => {
      await withListing(
        [{ run: fixtureRun, seatReadinessSha256: digest(fixture.seatReadinessBody) }],
        async ({ authority: listed }) => {
          assert.throws(() => consume(listed, fixture), refusal);
        },
      );
    });
  });
}

test('a v3 receipt from the cli identity is refused', async () => {
  const toCli = (unsigned) => {
    unsigned.target.authentication.request.client = {
      id: 'cli', mode: 'cli', version: 'k6-proof-readiness-v3', platform: 'node',
    };
  };
  await withBundle({ readinessEdit: toCli }, async (fixture) => {
    assert.equal(JSON.parse(fixture.seatReadinessBody).schema, 'openclaw.k6.seat-readiness.v3');
    assert.throws(() => consume(authority, fixture), /copied seat readiness has invalid schema or outcome/u);
    // Listing the run changes nothing for a v3 receipt.
    await withListing(
      [{ run: fixtureRun, seatReadinessSha256: digest(fixture.seatReadinessBody) }],
      async ({ authority: listed }) => {
        assert.throws(() => consume(listed, fixture), /copied seat readiness has invalid schema or outcome/u);
      },
    );
  });
});

test('a v3 run still re-verifies as before', async () => {
  await withBundle({}, async (fixture) => {
    assert.equal(JSON.parse(fixture.seatReadinessBody).schema, 'openclaw.k6.seat-readiness.v3');
    assert.equal(consume(authority, fixture).outcome, 'PASS-candidate');
  });
});

// ---- The committed runs, with the real list. ----------------------------------------------

async function frozenRuns() {
  const frozen = JSON.parse(await readFile(frozenListFile, 'utf8'));
  return Promise.all(frozen.runs.map(async ({ run, seatReadinessSha256 }) => {
    const [candidateSha, row, seat, runId] = run.split('/');
    const raw = await readFile(path.join(repoRoot, 'PROOFS', run, 'seat-readiness.json'));
    const receipt = JSON.parse(raw.toString('utf8'));
    return {
      run,
      path: { candidateSha, row, seat, runId },
      pinned: seatReadinessSha256,
      raw,
      receipt,
      // The bindings the archived-run check derives from the selected run and the receipt.
      expected: {
        candidateSha,
        runtimeSha: receipt.bindings.runtimeSha,
        docsSha: receipt.bindings.docsSha,
        gatewayFingerprint: receipt.bindings.gatewayUrlFingerprint,
        seat,
        unit: receipt.bindings.unit,
        rows: receipt.bindings.selectedRows,
        requiredDepth: receipt.bindings.requiredMaxSpawnDepth,
        expectedDepth: receipt.bindings.expectedMaxSpawnDepth,
      },
    };
  }));
}

test('the frozen list names the four committed v2 R-CD-2 runs, each with its exact receipt bytes', async () => {
  const frozen = JSON.parse(await readFile(frozenListFile, 'utf8'));
  assert.equal(frozen.schema, 'openclaw.k6.pre-v3-readiness-r-cd-2-runs.v1');
  assert.equal(frozen.frozenAt, '9ba5518bdb079da3c3c75961fd8cd26be040eb1e');
  assert.deepEqual(frozen.runs.map((entry) => entry.run), [
    '08c37a15621790d8bd20ebdaa42d16a65b4059c3/R-CD-2/emeric-isolated-composite/20261029T213444Z-r-cd-2-7ec4c1cf',
    '293c977f629f872a643fb94892603310b887293b/R-CD-2/emeric-isolated-composite/20261029T050321Z-r-cd-2-843e883b',
    '293c977f629f872a643fb94892603310b887293b/R-CD-2/matrix-012658Z/20261029T012745Z-r-cd-2-5e4ce138',
    'f15237ec921879d918482cdf372b0718d4c1aab9/R-CD-2/emeric-isolated-composite/20261030T013026Z-r-cd-2-44aa4c89',
  ]);
  for (const entry of await frozenRuns()) {
    assert.equal(digest(entry.raw), entry.pinned, `${entry.run} receipt bytes`);
    assert.equal(entry.receipt.schema, 'openclaw.k6.seat-readiness.v2', entry.run);
    assert.deepEqual(entry.receipt.target.authentication.request.client, {
      id: 'cli', mode: 'cli', version: 'k6-proof-readiness-v2', platform: 'node',
    }, entry.run);
    assert.equal(Object.hasOwn(entry.receipt.target.authentication.response, 'authMethod'), false, entry.run);
  }
});

test('the matrix-012658Z run is listed, but its committed folder is not its signed seat', async () => {
  // The fourth run backs no keyed review: 293c977f's names 843e883b, and its EVIDENCE.md keeps
  // this PARTIAL run as provenance. Its signed context names seat emeric-isolated-composite,
  // its folder matrix-012658Z, so consumeRcd2Authority refuses it from PROOFS at the seat-path
  // check after the readiness check, whatever its receipt.
  const run = '293c977f629f872a643fb94892603310b887293b/R-CD-2/matrix-012658Z/20261029T012745Z-r-cd-2-5e4ce138';
  const selection = JSON.parse(await readFile(
    path.join(repoRoot, 'PROOFS', run, authority.R_CD_2_SELECTION_RECEIPT_FILE),
    'utf8',
  ));
  assert.equal(run.split('/')[2], 'matrix-012658Z');
  assert.equal(selection.identity.seat, 'emeric-isolated-composite');
  assert.equal(selection.identity.runId, run.split('/')[3]);
  const review = JSON.parse(await readFile(
    path.join(repoRoot, 'PROOFS/293c977f629f872a643fb94892603310b887293b/R-CD-2/KEYED-AUTHORITY-REVIEW.json'),
    'utf8',
  ));
  assert.equal(
    review.reviewed_run,
    'PROOFS/293c977f629f872a643fb94892603310b887293b/R-CD-2/emeric-isolated-composite/20261029T050321Z-r-cd-2-843e883b',
  );
});

test('each committed v2 receipt passes the list, its bytes and the exact v2 shape, and stops only at the key', async () => {
  for (const entry of await frozenRuns()) {
    // Without the proof gateway's token this is as far as anyone gets; with it, the
    // reviewers' consumeRcd2Authority continues. At 66268cc6 these stopped at the schema.
    assert.deepEqual(
      readiness.validatePreV3ReadinessReceipt(
        { raw: entry.raw, run: entry.path },
        { ...entry.expected, signingKey: 'not-the-proof-gateway-token' },
      ),
      { valid: false, reason: 'invalid-signature' },
      entry.run,
    );
  }
});

test('a committed v2 receipt is not re-verified anywhere but its own run', async () => {
  const runs = await frozenRuns();
  for (const [index, entry] of runs.entries()) {
    const other = runs[(index + 1) % runs.length];
    // Its bytes under another listed run, or under a run directory nobody listed.
    assert.equal(
      readiness.validatePreV3ReadinessReceipt({ raw: entry.raw, run: other.path }, entry.expected).reason,
      'pre-v3-receipt-bytes-mismatch',
      entry.run,
    );
    assert.equal(
      readiness.validatePreV3ReadinessReceipt(
        { raw: entry.raw, run: { ...entry.path, runId: `${entry.path.runId}-copy` } },
        entry.expected,
      ).reason,
      'pre-v3-run-not-listed',
      entry.run,
    );
  }
});

// ---- Every gate in front of a live run stays v3-only. --------------------------------------

const liveValues = {
  signingKey: 'pre-v3-live-gate-token',
  candidateSha: '7cb9d71f622250bedbf565e327bd7d7b9d90b567',
  runtimeSha: '7cb9d71f622250bedbf565e327bd7d7b9d90b567',
  docsSha: 'd9fd19c6d3b587d36764d0184143b43885762ee1',
  gatewayWs: 'ws://127.0.0.1:21983',
  seat: 'isolated-seat',
  unit: 'openclaw-proof-129388.service',
  rows: ['R-CW-2'],
  requiredDepth: 2,
  expectedDepth: 5,
};
const liveEnv = {
  OPENCLAW_GATEWAY_TOKEN: liveValues.signingKey,
  OPENCLAW_CANDIDATE_SHA: liveValues.candidateSha,
  OPENCLAW_RUNTIME_SHA: liveValues.runtimeSha,
  OPENCLAW_DOCS_SHA: liveValues.docsSha,
  OPENCLAW_GATEWAY_WS: liveValues.gatewayWs,
  OPENCLAW_SEAT_NAME: liveValues.seat,
  OPENCLAW_GATEWAY_UNIT: liveValues.unit,
  OPENCLAW_SELECTED_ROWS: liveValues.rows.join(','),
  OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH: String(liveValues.requiredDepth),
  OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: String(liveValues.expectedDepth),
};
const cleanEnv = () => Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !/^(OPENCLAW_|HARNESS_)/u.test(name)),
);
const v3Receipt = () => signedSeatReadinessFixture(liveValues);
const v2Receipt = () => resealReadinessFixture(v3Receipt(), liveValues.signingKey, preV3ReadinessShape);

async function withTmp(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rcd2-pre-v3-live-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('validateReadinessReceipt, behind every live gate, refuses the exact v2 shape', () => {
  assert.deepEqual(readiness.validateReadinessReceipt(v3Receipt(), liveValues), { valid: true, reason: null });
  assert.deepEqual(readiness.validateReadinessReceipt(v2Receipt(), liveValues), {
    valid: false,
    reason: 'invalid-receipt',
  });
});

test('verify-seat-readiness (run-proofs.sh and both workflows) refuses v2, even a committed listed receipt', async () => {
  await withTmp(async (dir) => {
    const v2 = path.join(dir, 'v2.json');
    await writeFile(v2, `${JSON.stringify(v2Receipt(), null, 2)}\n`);
    const fixture = spawnSync(process.execPath, [verifier, v2], {
      encoding: 'utf8',
      env: { ...cleanEnv(), ...liveEnv },
    });
    assert.equal(fixture.status, 2, fixture.stdout);
    assert.match(fixture.stderr, /seat readiness receipt rejected: invalid-receipt/u);

    // A listed receipt's own bytes, with the environment it was bound to: the live
    // verifier never reads the frozen list.
    const [entry] = await frozenRuns();
    const listed = path.join(dir, 'listed.json');
    await writeFile(listed, entry.raw);
    const committed = spawnSync(process.execPath, [verifier, listed], {
      encoding: 'utf8',
      env: {
        ...cleanEnv(),
        OPENCLAW_GATEWAY_TOKEN: 'not-the-proof-gateway-token',
        OPENCLAW_CANDIDATE_SHA: entry.expected.candidateSha,
        OPENCLAW_RUNTIME_SHA: entry.expected.runtimeSha,
        OPENCLAW_DOCS_SHA: entry.expected.docsSha,
        OPENCLAW_SEAT_NAME: entry.expected.seat,
        OPENCLAW_GATEWAY_UNIT: entry.expected.unit,
        OPENCLAW_SELECTED_ROWS: entry.expected.rows.join(','),
        OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH: String(entry.expected.requiredDepth),
        OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH: String(entry.expected.expectedDepth),
      },
    });
    assert.equal(committed.status, 2, committed.stdout);
    assert.match(committed.stderr, /seat readiness receipt rejected: invalid-receipt/u);
  });
});

test('run-readiness-consumer refuses a v2 run-local receipt', async () => {
  await withTmp(async (dir) => {
    const body = `${JSON.stringify(v2Receipt(), null, 2)}\n`;
    await writeFile(path.join(dir, 'seat-readiness.json'), body);
    const receipt = JSON.parse(body);
    const metadata = {
      row: 'R-CW-2',
      candidateSha: liveValues.candidateSha,
      runtimeBuildSha: liveValues.runtimeSha,
      docsRef: liveValues.docsSha,
      seat: liveValues.seat,
      readiness: {
        receipt: 'seat-readiness.json',
        sha256: digest(body),
        gatewayUrlFingerprint: receipt.bindings.gatewayUrlFingerprint,
        unit: liveValues.unit,
        selectedRows: receipt.bindings.selectedRows,
        requiredMaxSpawnDepth: liveValues.requiredDepth,
        expectedMaxSpawnDepth: liveValues.expectedDepth,
      },
    };
    await assert.rejects(
      consumeRunReadiness(dir, metadata, liveValues.signingKey),
      /seat readiness receipt rejected: invalid-receipt/u,
    );
  });
});

test('the evidence writer refuses a v2 receipt before writing anything', async () => {
  await withTmp(async (dir) => {
    const input = path.join(dir, 'run.txt');
    await writeFile(input, `=== K6-PROOF-EVIDENCE ===\n${JSON.stringify({
      manifest_loaded: true,
      redacted_events: [],
    })}\n--- END EVIDENCE ---\n`);
    const receiptFile = path.join(dir, 'seat-readiness.json');
    await writeFile(receiptFile, `${JSON.stringify(v2Receipt(), null, 2)}\n`);
    const before = (await readdir(dir)).sort();
    const result = spawnSync(process.execPath, [
      writer,
      '--input', input,
      '--row', 'R-CW-2',
      '--seat', liveValues.seat,
      '--sha', liveValues.candidateSha,
      '--seat-readiness', receiptFile,
    ], { cwd: dir, encoding: 'utf8', env: { ...cleanEnv(), ...liveEnv } });
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /seat readiness receipt rejected: invalid-receipt/u);
    assert.deepEqual((await readdir(dir)).sort(), before);
  });
});

test('only the R-CD-2 archived-run check can reach the v2 validator or its frozen list', async () => {
  const sources = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') await walk(full);
      } else if (/\.(?:mjs|js|sh|ya?ml)$/u.test(entry.name) && !/\.test\.mjs$/u.test(entry.name)) {
        sources.push(full);
      }
    }
  };
  await walk(k6Proofs);
  await walk(path.join(repoRoot, '.github'));
  const reaching = [];
  for (const file of sources) {
    const text = await readFile(file, 'utf8');
    if (/validatePreV3ReadinessReceipt|PRE_V3_READINESS_RUNS_FILE|pre-v3-readiness-r-cd-2-runs/u.test(text)) {
      reaching.push(path.relative(repoRoot, file));
    }
  }
  assert.deepEqual(reaching.sort(), [
    'tools/k6-proofs/lib/r-cd-2-authority-context.mjs',
    'tools/k6-proofs/scripts/target-readiness.mjs',
  ]);
});
