// run-proofs.sh trace gate at the row-list runner boundary (karmaterminal-openclaw-docs#600).
//
// Live trap (cael, matrix 20261028T101626Z-7ca3969a5d2a-0c4808dc): R-CW-TOKEN and
// R-CW-DELEGATE-SELF-CONTINUATION came back PASS-candidate with
// traceCaptured:false, correlationReceiptPresent:false, pendingReceipts:[] and
// review.complete:true. The runner only collected a trace for manifests that
// spelled a receipt `trace-id` or `tempo-trace-json`; R-CW-TOKEN spelled it
// `tempo-trace` and R-CW-DELEGATE-SELF named none.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runRowThroughRunner } from './helpers/row-runner-fixture.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const traceId = '7'.repeat(32);
const dispatchAt = Date.parse('2026-10-28T10:16:40.000Z');

function attr(key, value) {
  return { key, value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: String(value) } };
}

function evidenceFor(row, extra = {}) {
  return {
    row,
    nonce: `${row}-1793182600000-docs600x`,
    started: new Date(dispatchAt - 1000).toISOString(),
    ended: new Date(dispatchAt + 30_000).toISOString(),
    dispatch_accepted_at_ms: dispatchAt,
    trace_id: null,
    ...extra,
  };
}

// Tempo answers the search with an error: the collector cannot produce a
// trace, which is the state the live rows were actually in.
function tempoUnavailable(url, response) {
  response.writeHead(503, { 'content-type': 'application/json' }).end('{"error":"tempo unavailable"}');
}

function tempoServing(trace) {
  return (url, response) => {
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/api/search') {
      response.end(JSON.stringify({ traces: [{ traceID: traceId }] }));
    } else if (url.pathname === `/api/traces/${traceId}`) {
      response.end(JSON.stringify(trace));
    } else {
      response.writeHead(404).end('{}');
    }
  };
}

function sessionsSpawnTrace() {
  return {
    batches: [{ scopeSpans: [{ spans: [
      {
        name: 'openclaw.tool.execution',
        traceId,
        spanId: '4'.repeat(16),
        parentSpanId: '5'.repeat(16),
        status: { code: 1 },
        attributes: [attr('gen_ai.tool.name', 'sessions_spawn')],
      },
    ] }] }],
  };
}

function assertNoCompleteEnvelope(fixture) {
  assert.equal(fixture.envelope, null, 'a trace-less continuation row must not receive a review-complete envelope');
  assert.ok(!fixture.files.includes('candidate-run-result.json'));
}

test('R-CW-TOKEN (receipt spelled tempo-trace) collects its trace and fails closed without one', async () => {
  const fixture = await runRowThroughRunner(repoRoot, {
    rowId: 'R-CW-TOKEN',
    evidence: evidenceFor('R-CW-TOKEN', { hop_2_executed: true }),
    tempo: tempoUnavailable,
  });
  try {
    const { runResult } = fixture;
    assert.equal(runResult.verdict, 'PASS-candidate', 'the VU verdict is not the runner trace gate\'s to change');
    assert.ok(fixture.tempoRequests.includes('/api/search'), 'the continuation trace collector must run for a token row');
    assert.equal(runResult.observability.traceStatus, 'missing');
    assert.equal(runResult.observability.traceId, null);
    assert.equal(runResult.observability.correlationReceipt, null);
    assert.equal(runResult.review.status, 'review-pending');
    for (const receipt of ['tempo-trace-json', 'tool-trace-correlation']) {
      assert.ok(runResult.review.pendingReceipts.includes(receipt), `pendingReceipts must name ${receipt}: ${JSON.stringify(runResult.review.pendingReceipts)}`);
    }
    assertNoCompleteEnvelope(fixture);
  } finally {
    await fixture.cleanup();
  }
});

test('R-CW-DELEGATE-SELF-CONTINUATION (no trace receipt declared) collects its trace and fails closed without one', async () => {
  const fixture = await runRowThroughRunner(repoRoot, {
    rowId: 'R-CW-DELEGATE-SELF-CONTINUATION',
    evidence: evidenceFor('R-CW-DELEGATE-SELF-CONTINUATION', {
      delegate_accepted: true,
      child_continue_work_accepted: true,
      child_hop_2_woke: true,
      parent_return: true,
    }),
    tempo: tempoUnavailable,
  });
  try {
    const { runResult } = fixture;
    assert.equal(runResult.verdict, 'PASS-candidate');
    assert.ok(fixture.tempoRequests.includes('/api/search'), 'the continuation trace collector must run for a continue_delegate row');
    assert.equal(runResult.observability.traceStatus, 'missing');
    assert.equal(runResult.review.status, 'review-pending');
    for (const receipt of ['tempo-trace-json', 'continuation-trace-correlation']) {
      assert.ok(runResult.review.pendingReceipts.includes(receipt), `pendingReceipts must name ${receipt}: ${JSON.stringify(runResult.review.pendingReceipts)}`);
    }
    assertNoCompleteEnvelope(fixture);
  } finally {
    await fixture.cleanup();
  }
});

test('positive control: a recovered trace and correlation receipt let a token row complete review', async () => {
  const fixture = await runRowThroughRunner(repoRoot, {
    rowId: 'R-CW-TOKEN',
    evidence: evidenceFor('R-CW-TOKEN', { hop_2_executed: true }),
    tempo: tempoServing(sessionsSpawnTrace()),
  });
  try {
    const { runResult, envelope } = fixture;
    assert.equal(runResult.observability.traceStatus, 'present');
    assert.equal(runResult.observability.traceId, traceId);
    assert.equal(runResult.observability.tempoTraceJson, `tempo-trace-${traceId.slice(0, 12)}.json`);
    assert.equal(runResult.observability.correlationReceipt, 'tool-trace-correlation.json');
    assert.deepEqual(runResult.review.pendingReceipts, []);
    assert.ok(envelope, `a complete run must receive its envelope: ${fixture.result.stderr}`);
    assert.equal(envelope.review.complete, true);
    assert.equal(envelope.observability.traceCaptured, true);
    assert.equal(envelope.observability.correlationReceiptPresent, true);
    assert.equal(envelope.result.outcome, 'PASS-candidate');
  } finally {
    await fixture.cleanup();
  }
});

test('sibling control: a read-only row stays not trace-required and completes without a trace', async () => {
  const fixture = await runRowThroughRunner(repoRoot, {
    rowId: 'R-CONFIG-DEFAULTS',
    evidence: evidenceFor('R-CONFIG-DEFAULTS', {
      config_read: true,
      enabled: true,
      max_chain_length: 3,
      max_delegates_per_turn: 3,
      cost_cap_tokens: 3,
    }),
    tempo: tempoUnavailable,
  });
  try {
    const { runResult, envelope } = fixture;
    assert.deepEqual(fixture.tempoRequests, [], 'no trace collection for a row that fires no continuation surface');
    assert.ok(!fixture.files.includes('continuation-trace-collector.error.log'));
    assert.equal(runResult.observability.traceStatus, 'unknown');
    assert.deepEqual(runResult.review.pendingReceipts, []);
    assert.ok(envelope, `the sibling row must still receive its envelope: ${fixture.result.stderr}`);
    assert.equal(envelope.review.complete, true);
    assert.equal(envelope.observability.traceCaptured, false);
  } finally {
    await fixture.cleanup();
  }
});
