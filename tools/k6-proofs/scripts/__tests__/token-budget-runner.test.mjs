// The token budget at the row-list runner boundary: run-proofs.sh --live with
// OPENCLAW_PROOFS_TOKEN_BUDGET, a fake usage source and a k6 stub.
//
// 🌊's ruling (Discord 1573082087307616310): build and dry-fixture-prove a
// harness-side counter that aborts at the bound, and bring the enforcement
// receipt back before the held live rerun at ab5a30ea. The workorder's four
// fixture cases are here, each against the real runner: (a) usage climbs past
// the budget mid-row, (b) it stays under, (c) the counter is unreadable at the
// start, (d) it becomes unreadable mid-run. Around them: no budget keeps
// today's behaviour (the gateway is never asked for usage), a malformed budget
// is refused before anything runs, a dry run records the budget without
// contacting the gateway, and the workflow carries the input through.
//
// Each run fires PREFLIGHT, R-CONFIG-DEFAULTS and R-CONFIG-INTERSESSION. In the
// abort cases the middle row's k6 stub would run 60 s, so a run that finishes
// quickly with that row marked terminated proves the row was stopped, not
// waited out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUDGET_CONFIGURED_SESSION,
  disposableSessionListing,
  runBudgetMatrix,
  usagePoint,
} from './helpers/token-budget-runner-fixture.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const BUDGET_ABORT_EXIT = 79;
const BUDGET_UNENFORCEABLE_EXIT = 80;
const LONG_ROW = { 'r-config-defaults.js': 60 };

function rowStatuses(receipt) {
  return Object.fromEntries(receipt.rows.map((entry) => [entry.row, entry.status]));
}

function assertReadingsTimed(receipt) {
  assert.ok(receipt.readings.length >= 1, 'the receipt carries every reading');
  for (const reading of receipt.readings) {
    assert.match(reading.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u, 'each reading has its time');
    assert.equal(typeof reading.readable, 'boolean');
    assert.ok(Number.isInteger(reading.cumulative));
  }
  assert.match(receipt.baseline.at, /^\d{4}-\d{2}-\d{2}T/u);
}

function assertNoSecrets(fixture) {
  for (const secret of ['token-budget-runner-fixture-token', BUDGET_CONFIGURED_SESSION, 'r-config-defaults-fixture', 'disposable']) {
    assert.ok(!fixture.receiptText.includes(secret), `the receipt must not carry ${secret}`);
  }
}

test('(a) usage that climbs past the budget mid-row stops that row, leaves the rest not-run, and writes the budget-abort receipt', async () => {
  let disposableTokens = 0;
  const fixture = await runBudgetMatrix(repoRoot, {
    budget: '1000',
    sleepSeconds: LONG_ROW,
    usage: ({ started }) => ({
      'sessions.list': disposableSessionListing(() => started('r-config-defaults.js')),
      'sessions.usage.timeseries': ({ key }) => (key === BUDGET_CONFIGURED_SESSION
        ? usagePoint('configured', 5000)
        : usagePoint('disposable', (disposableTokens += 300))),
    }),
  });
  try {
    const { result, receipt, k6 } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.ok(result.elapsedMs < 45_000, `the 60 s row must be stopped, not waited out (took ${result.elapsedMs} ms)`);
    assert.deepEqual(k6.PREFLIGHT, { started: true, finished: true, terminated: false });
    assert.deepEqual(k6['R-CONFIG-DEFAULTS'], { started: true, finished: false, terminated: true }, 'the running k6 row is stopped');
    assert.deepEqual(k6['R-CONFIG-INTERSESSION'], { started: false, finished: false, terminated: false }, 'no row is dispatched after the trip');

    assert.ok(receipt, 'a budget-abort receipt is written');
    assert.equal(receipt.schema, 'openclaw.k6.token-budget-receipt.v1');
    assert.equal(receipt.verdict, 'BUDGET-ABORT');
    assert.equal(receipt.budget, 1000);
    assert.equal(receipt.exitCode, BUDGET_ABORT_EXIT);
    assert.ok(['projected-exceed', 'budget-reached'].includes(receipt.trip.reason), JSON.stringify(receipt.trip));
    assert.ok(receipt.trip.cumulative > 0);
    assert.equal(receipt.baseline.tokensInScope, 5000, 'pre-run usage is the baseline, never charged');
    assertReadingsTimed(receipt);
    assert.deepEqual(rowStatuses(receipt), {
      PREFLIGHT: 'completed',
      'R-CONFIG-DEFAULTS': 'budget-stopped',
      'R-CONFIG-INTERSESSION': 'not-run (budget)',
    });
    assert.equal(receipt.pollIntervalMs, 200);
    assert.ok(receipt.cadence.readings >= 2);
    assertNoSecrets(fixture);

    assert.match(result.stdout, /\[R-CONFIG-INTERSESSION\] NOT-RUN \(budget\)/u);
    assert.match(result.stderr, /TOKEN BUDGET ABORT/u);
    assert.equal(fixture.runDirs['R-CONFIG-INTERSESSION'], null, 'a not-run row leaves no run directory');
    const stopped = fixture.runDirs['R-CONFIG-DEFAULTS'];
    const stop = await fixture.readJson(path.join(stopped, 'budget-stop.json'));
    assert.equal(stop.row, 'R-CONFIG-DEFAULTS');
    assert.equal(stop.trip.reason, receipt.trip.reason);
    const runResult = await fixture.readJson(path.join(stopped, 'run-result.json'));
    assert.ok(runResult.review.pendingReceipts.includes('budget-stop'), 'a stopped row can never read as review-complete');
    assert.notEqual(runResult.k6ExitCode, 0);
    assert.ok(!existsSync(path.join(stopped, 'candidate-run-result.json')));
  } finally {
    await fixture.cleanup();
  }
});

test('(b) usage that stays under the budget lets every row finish and records a within-budget receipt', async () => {
  let disposableTokens = 0;
  const fixture = await runBudgetMatrix(repoRoot, {
    budget: '3200000',
    sleepSeconds: { 'r-config-defaults.js': 1 },
    usage: ({ started }) => ({
      'sessions.list': disposableSessionListing(() => started('r-config-defaults.js')),
      'sessions.usage.timeseries': ({ key }) => (key === BUDGET_CONFIGURED_SESSION
        ? usagePoint('configured', 5000)
        : usagePoint('disposable', (disposableTokens += 10))),
    }),
  });
  try {
    const { result, receipt, k6 } = fixture;
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    for (const row of ['PREFLIGHT', 'R-CONFIG-DEFAULTS', 'R-CONFIG-INTERSESSION']) {
      assert.deepEqual(k6[row], { started: true, finished: true, terminated: false }, row);
    }
    assert.equal(receipt.verdict, 'WITHIN-BUDGET');
    assert.equal(receipt.budget, 3_200_000);
    assert.equal(receipt.trip, null);
    assert.equal(receipt.exitCode, 0);
    assert.ok(receipt.cumulative > 0 && receipt.cumulative < 3_200_000);
    assert.equal(receipt.readings.at(-1).final, true, 'the meter takes a last reading when the matrix ends');
    assertReadingsTimed(receipt);
    assert.deepEqual(rowStatuses(receipt), {
      PREFLIGHT: 'completed',
      'R-CONFIG-DEFAULTS': 'completed',
      'R-CONFIG-INTERSESSION': 'completed',
    });
    assertNoSecrets(fixture);
  } finally {
    await fixture.cleanup();
  }
});

test('(c) a counter that is unreadable at the start refuses the matrix before any row', async () => {
  const fixture = await runBudgetMatrix(repoRoot, {
    budget: '3200000',
    usage: () => ({
      'sessions.list': () => ({ ok: false, error: { code: 'FORBIDDEN', message: 'missing scope: operator.read' } }),
    }),
  });
  try {
    const { result, receipt, k6 } = fixture;
    assert.equal(result.code, BUDGET_UNENFORCEABLE_EXIT, `${result.stdout}\n${result.stderr}`);
    for (const row of ['PREFLIGHT', 'R-CONFIG-DEFAULTS', 'R-CONFIG-INTERSESSION']) {
      assert.equal(k6[row].started, false, `${row} must not be dispatched`);
      assert.equal(fixture.runDirs[row], null, `${row} must leave no run directory`);
    }
    assert.equal(receipt.verdict, 'BUDGET-UNENFORCEABLE');
    assert.equal(receipt.exitCode, BUDGET_UNENFORCEABLE_EXIT);
    assert.equal(receipt.reason, 'baseline-unreadable: sessions-list:FORBIDDEN');
    assert.deepEqual(new Set(Object.values(rowStatuses(receipt))), new Set(['not-run (budget-unenforceable)']));
    assert.match(result.stderr, /BUDGET-UNENFORCEABLE/u);
  } finally {
    await fixture.cleanup();
  }
});

test('(d) a counter that becomes unreadable mid-run stops the running row and the rest', async () => {
  const fixture = await runBudgetMatrix(repoRoot, {
    budget: '3200000',
    sleepSeconds: LONG_ROW,
    usage: ({ started }) => ({
      'sessions.list': disposableSessionListing(() => false),
      'sessions.usage.timeseries': () => (started('r-config-defaults.js')
        ? { ok: false, error: { code: 'UNAVAILABLE', message: 'gateway shutting down' } }
        : usagePoint('configured', 5000)),
    }),
  });
  try {
    const { result, receipt, k6 } = fixture;
    assert.equal(result.code, BUDGET_ABORT_EXIT, `${result.stdout}\n${result.stderr}`);
    assert.ok(result.elapsedMs < 45_000, `took ${result.elapsedMs} ms`);
    assert.deepEqual(k6['R-CONFIG-DEFAULTS'], { started: true, finished: false, terminated: true });
    assert.equal(k6['R-CONFIG-INTERSESSION'].started, false);
    assert.equal(receipt.verdict, 'BUDGET-ABORT');
    assert.equal(receipt.trip.reason, 'counter-unreadable');
    assert.equal(receipt.trip.error, 'sessions-usage-timeseries:UNAVAILABLE');
    assertReadingsTimed(receipt);
    assert.ok(receipt.readings.some((reading) => reading.readable === false));
    assert.deepEqual(rowStatuses(receipt), {
      PREFLIGHT: 'completed',
      'R-CONFIG-DEFAULTS': 'budget-stopped',
      'R-CONFIG-INTERSESSION': 'not-run (budget)',
    });
  } finally {
    await fixture.cleanup();
  }
});

test('no budget keeps today\'s behaviour: the gateway is never asked for usage and no receipt is written', async () => {
  const fixture = await runBudgetMatrix(repoRoot, {
    budget: null,
    usage: () => ({
      'sessions.list': () => ({ ok: true, payload: { sessions: [], hasMore: false } }),
      'sessions.usage.timeseries': () => usagePoint('x', 1),
    }),
  });
  try {
    assert.equal(fixture.result.code, 0, `${fixture.result.stdout}\n${fixture.result.stderr}`);
    assert.deepEqual(fixture.usageCalls, []);
    assert.equal(fixture.receipt, null);
    for (const row of ['PREFLIGHT', 'R-CONFIG-DEFAULTS', 'R-CONFIG-INTERSESSION']) {
      assert.equal(fixture.k6[row].finished, true, row);
    }
  } finally {
    await fixture.cleanup();
  }
});

test('a malformed budget is refused before any row and before the gateway is asked for usage', async () => {
  for (const budget of ['1e6', '3,200,000', '0', '-5', ' 100']) {
    const fixture = await runBudgetMatrix(repoRoot, { budget });
    try {
      assert.equal(fixture.result.code, BUDGET_UNENFORCEABLE_EXIT, `${budget}: ${fixture.result.stdout}\n${fixture.result.stderr}`);
      assert.equal(fixture.receipt.verdict, 'BUDGET-UNENFORCEABLE');
      assert.equal(fixture.receipt.reason, 'budget-malformed');
      assert.equal(fixture.receipt.budget, null, 'rejected input is never echoed');
      assert.equal(fixture.receipt.budgetInput, 'malformed');
      assert.equal(fixture.k6.PREFLIGHT.started, false);
      assert.deepEqual(fixture.usageCalls, []);
    } finally {
      await fixture.cleanup();
    }
  }
});

test('--token-budget on the command line takes precedence over the environment', async () => {
  const fixture = await runBudgetMatrix(repoRoot, {
    budget: '3200000',
    extraArgs: ['--token-budget', 'not-a-number'],
  });
  try {
    assert.equal(fixture.result.code, BUDGET_UNENFORCEABLE_EXIT);
    assert.equal(fixture.receipt.reason, 'budget-malformed');
  } finally {
    await fixture.cleanup();
  }
});

test('a dry run records the budget without contacting the gateway', async () => {
  const fixture = await runBudgetMatrix(repoRoot, {
    budget: '3200000',
    dryRun: true,
    usage: () => ({ 'sessions.list': () => ({ ok: true, payload: { sessions: [], hasMore: false } }) }),
  });
  try {
    assert.equal(fixture.result.code, 0, `${fixture.result.stdout}\n${fixture.result.stderr}`);
    assert.deepEqual(fixture.usageCalls, []);
    assert.equal(fixture.receipt.verdict, 'NOT-ENFORCED-DRY-RUN');
    assert.equal(fixture.receipt.budget, 3_200_000);
    assert.equal(fixture.k6.PREFLIGHT.started, false);
  } finally {
    await fixture.cleanup();
  }
});

test('project81-k6-proof.yml takes token_budget, validates it, and hands it to run-proofs.sh', async () => {
  const workflow = await readFile(path.join(repoRoot, '.github/workflows/project81-k6-proof.yml'), 'utf8');
  const input = /\n {6}token_budget:\n((?: {8}.*\n)+)/u.exec(workflow);
  assert.ok(input, 'the workflow declares a token_budget input');
  assert.match(input[1], /type: string/u);
  assert.match(input[1], /default: ""/u);
  assert.match(input[1], /required: false/u);
  assert.match(workflow, /TOKEN_BUDGET_INPUT: \$\{\{ inputs\.token_budget \}\}/u);
  assert.match(workflow, /\^\[1-9\]\[0-9\]\{0,14\}\$/u, 'the rows step refuses a malformed budget before any runner starts');
  assert.match(workflow, /OPENCLAW_PROOFS_TOKEN_BUDGET: \$\{\{ inputs\.token_budget \}\}/u);
});
