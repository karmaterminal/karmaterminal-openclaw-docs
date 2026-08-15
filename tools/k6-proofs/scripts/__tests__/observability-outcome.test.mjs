import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildObservabilityOutcome,
  classifyTraceFailure,
  OBSERVABILITY_OUTCOME_SCHEMA,
  TRACE_OUTCOME,
  traceRebindKeys,
  validateObservabilityOutcome,
} from '../../lib/observability-outcome.mjs';

const REBIND = traceRebindKeys({
  serviceName: 'cael-prince',
  query: '{ resource.service.name="cael-prince" && name="continuation.work" }',
  startUnixSeconds: 1786788650,
  endUnixSeconds: 1786788797,
  reasonHash: '1dcaf2da9577f8eb',
  reasonLength: 139,
  tool: 'continue_work',
  rowNonce: 'R-CW-3-1786788707904-ab12cd34',
  sessionKeys: ['agent:main:k6-r-cw-3'],
});

test('rebind keys are public-safe and deterministic', () => {
  assert.equal(REBIND.serviceName, 'cael-prince');
  assert.equal(REBIND.reason.hash, '1dcaf2da9577f8eb');
  assert.equal(REBIND.searchWindow.startUnixSeconds, 1786788650);
  assert.match(REBIND.rowNonceFingerprint, /^[a-f0-9]{16}$/);
  assert.equal(REBIND.sessionFingerprints.length, 1);
  assert.match(REBIND.sessionFingerprints[0], /^[a-f0-9]{16}$/);

  const serialized = JSON.stringify(REBIND);
  assert.ok(!serialized.includes('R-CW-3-1786788707904-ab12cd34'), 'raw nonce must never be published');
  assert.ok(!serialized.includes('agent:main:k6-r-cw-3'), 'raw session key must never be published');

  const again = traceRebindKeys({
    serviceName: 'cael-prince',
    query: REBIND.query,
    startUnixSeconds: 1786788650,
    endUnixSeconds: 1786788797,
    reasonHash: '1dcaf2da9577f8eb',
    reasonLength: 139,
    tool: 'continue_work',
    rowNonce: 'R-CW-3-1786788707904-ab12cd34',
    sessionKeys: ['agent:main:k6-r-cw-3'],
  });
  assert.deepEqual(again, REBIND, 'the same evidence must always rebind the same way');
});

test('a correlated outcome carries artifacts and no review debt', () => {
  const outcome = buildObservabilityOutcome({
    row: 'R-CD-1',
    seat: 'cael',
    status: TRACE_OUTCOME.CORRELATED,
    candidateCount: 1,
    attempts: 3,
    timeoutMs: 180000,
    traceId: '4aa9eeefcab9b91c87c85a0f0ec4a287',
    traceJson: 'tempo-trace-4aa9eeefcab9.json',
    correlationReceipt: 'continuation-trace-correlation.json',
  });
  assert.equal(outcome.schema, OBSERVABILITY_OUTCOME_SCHEMA);
  assert.equal(outcome.resolved, true);
  assert.deepEqual(outcome.reviewDebt, []);
  assert.equal(outcome.rebind, null);
  assert.deepEqual(validateObservabilityOutcome(outcome), { valid: true, status: TRACE_OUTCOME.CORRELATED });
});

test('every unresolved status names itself and carries rebind keys', () => {
  for (const status of [
    TRACE_OUTCOME.BACKEND_UNAVAILABLE,
    TRACE_OUTCOME.NO_MATCHING_TRACE,
    TRACE_OUTCOME.AMBIGUOUS_TRACE,
    TRACE_OUTCOME.TOPOLOGY_INVALID,
    TRACE_OUTCOME.CONTRACT_INVALID,
  ]) {
    const outcome = buildObservabilityOutcome({
      row: 'R-CW-3',
      seat: 'cael',
      status,
      detail: 'matched trace lacks the originating continue_work tool span',
      candidateCount: 1,
      attempts: 90,
      timeoutMs: 180000,
      rebind: REBIND,
    });
    assert.equal(outcome.resolved, false, `${status} must never claim resolution`);
    assert.deepEqual(outcome.reviewDebt, ['tempo-trace-json', 'continuation-trace-correlation']);
    assert.equal(outcome.traceId, null);
    assert.equal(outcome.traceJson, null);
    assert.equal(outcome.correlationReceipt, null);
    assert.ok(outcome.rebind, `${status} must be re-bindable without refiring the row`);
    assert.deepEqual(validateObservabilityOutcome(outcome), { valid: true, status });
  }
});

test('an unresolved outcome cannot be built into a success shape', () => {
  assert.throws(() => buildObservabilityOutcome({
    row: 'R-CW-3',
    seat: 'cael',
    status: TRACE_OUTCOME.NO_MATCHING_TRACE,
    traceId: '4aa9eeefcab9b91c87c85a0f0ec4a287',
    rebind: REBIND,
  }), /must not carry correlation artifacts/);

  assert.throws(() => buildObservabilityOutcome({
    row: 'R-CW-3',
    seat: 'cael',
    status: TRACE_OUTCOME.BACKEND_UNAVAILABLE,
  }), /requires rebind keys/);

  assert.throws(() => buildObservabilityOutcome({
    row: 'R-CD-1',
    seat: 'cael',
    status: TRACE_OUTCOME.CORRELATED,
    traceJson: 'tempo-trace.json',
    correlationReceipt: 'continuation-trace-correlation.json',
  }), /requires traceId/);

  assert.throws(() => buildObservabilityOutcome({
    row: 'R-CD-1', seat: 'cael', status: 'looks-fine',
  }), /unknown observability status/);
});

test('validation rejects hand-forged success-shaped outcomes', () => {
  const forged = {
    schema: OBSERVABILITY_OUTCOME_SCHEMA,
    row: 'R-CW-3',
    seat: 'cael',
    status: TRACE_OUTCOME.NO_MATCHING_TRACE,
    resolved: true,
    reviewDebt: [],
    detail: null,
    candidateCount: 0,
    attempts: 1,
    timeoutMs: 180000,
    traceId: null,
    traceJson: null,
    correlationReceipt: null,
    rebind: REBIND,
  };
  assert.deepEqual(validateObservabilityOutcome(forged), { valid: false, reason: 'resolved-status-mismatch' });

  const debtStripped = {
    ...forged,
    resolved: false,
    reviewDebt: [],
  };
  assert.deepEqual(validateObservabilityOutcome(debtStripped),
    { valid: false, reason: 'unresolved-without-review-debt' });

  const rebindStripped = { ...forged, resolved: false, rebind: null };
  assert.deepEqual(validateObservabilityOutcome(rebindStripped), { valid: false, reason: 'missing-rebind' });

  const correlatedWithoutTrace = {
    ...forged,
    status: TRACE_OUTCOME.CORRELATED,
    resolved: true,
    rebind: null,
  };
  assert.deepEqual(validateObservabilityOutcome(correlatedWithoutTrace),
    { valid: false, reason: 'missing-correlation-artifacts' });

  assert.deepEqual(validateObservabilityOutcome({ schema: 'openclaw.k6.other.v1' }),
    { valid: false, reason: 'invalid-schema' });
  assert.deepEqual(validateObservabilityOutcome(null), { valid: false, reason: 'invalid-schema' });
});

test('validation refuses to publish private attribution material', () => {
  const leaky = buildObservabilityOutcome({
    row: 'R-CD-4',
    seat: 'cael',
    status: TRACE_OUTCOME.NO_MATCHING_TRACE,
    detail: 'no trace for agent:main:k6-r-cd-4-target',
    rebind: REBIND,
  });
  assert.deepEqual(validateObservabilityOutcome(leaky), { valid: false, reason: 'private-material' });

  const traceparent = buildObservabilityOutcome({
    row: 'R-CD-4',
    seat: 'cael',
    status: TRACE_OUTCOME.NO_MATCHING_TRACE,
    detail: 'traceparent 00-abc-def-01',
    rebind: REBIND,
  });
  assert.deepEqual(validateObservabilityOutcome(traceparent), { valid: false, reason: 'private-material' });
});

test('failures classify by cause, not by convenience', () => {
  assert.equal(
    classifyTraceFailure({ error: Object.assign(new Error('Tempo search failed: HTTP 503 Service Unavailable'), { httpStatus: 503 }) }),
    TRACE_OUTCOME.BACKEND_UNAVAILABLE,
  );
  assert.equal(
    classifyTraceFailure({ error: Object.assign(new Error('fetch failed'), { code: 'ECONNREFUSED' }) }),
    TRACE_OUTCOME.BACKEND_UNAVAILABLE,
  );
  assert.equal(
    classifyTraceFailure({ error: new Error('trace correlation is ambiguous: 2 Tempo traces matched'), candidateCount: 2 }),
    TRACE_OUTCOME.AMBIGUOUS_TRACE,
  );
  assert.equal(
    classifyTraceFailure({ error: new Error('no Tempo trace matched reason hash abc before timeout'), candidateCount: 0 }),
    TRACE_OUTCOME.NO_MATCHING_TRACE,
  );
  assert.equal(
    classifyTraceFailure({
      error: new Error('Tempo trace did not reach valid continuation topology before timeout: matched trace lacks the originating continue_work tool span'),
      candidateCount: 1,
    }),
    TRACE_OUTCOME.TOPOLOGY_INVALID,
  );
  assert.equal(
    classifyTraceFailure({ error: new Error('manifest invocation.tool is required'), contractResolved: false }),
    TRACE_OUTCOME.CONTRACT_INVALID,
  );
});

test('a reachable backend with nothing to show is never excused as unavailable', () => {
  // The distinction is the whole point: "Tempo was down" is infrastructure,
  // "Tempo had no matching trace" is a statement about the product run.
  assert.equal(
    classifyTraceFailure({ error: new Error('no Tempo trace matched tool continue_delegate in the evidence window'), candidateCount: 0 }),
    TRACE_OUTCOME.NO_MATCHING_TRACE,
  );
  assert.notEqual(
    classifyTraceFailure({ error: new Error('no Tempo trace matched'), candidateCount: 0 }),
    TRACE_OUTCOME.BACKEND_UNAVAILABLE,
  );
});

test('an internal collector bug is never excused as backend trouble', () => {
  // Any TypeError used to sweep straight to `backend-unavailable`, which would
  // let a defect in the harness masquerade as infrastructure and quietly excuse
  // a row that the harness itself broke.
  const internal = new TypeError("Cannot read properties of undefined (reading 'spanId')");
  assert.equal(
    classifyTraceFailure({ error: internal, candidateCount: 1 }),
    TRACE_OUTCOME.TOPOLOGY_INVALID,
  );
  assert.equal(
    classifyTraceFailure({ error: internal, candidateCount: 0 }),
    TRACE_OUTCOME.NO_MATCHING_TRACE,
  );

  // Node's fetch transport failure still classifies correctly, by both routes.
  const transport = new TypeError('fetch failed');
  assert.equal(classifyTraceFailure({ error: transport }), TRACE_OUTCOME.BACKEND_UNAVAILABLE);
  transport.cause = { code: 'ECONNREFUSED' };
  assert.equal(classifyTraceFailure({ error: transport }), TRACE_OUTCOME.BACKEND_UNAVAILABLE);
  assert.equal(
    classifyTraceFailure({ error: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }) }),
    TRACE_OUTCOME.BACKEND_UNAVAILABLE,
  );
});

test('a reachable Tempo answering 404 is not an availability claim', () => {
  // A 404 on the trace body is Tempo telling us it is not carrying that trace —
  // the module's own invariant says a reachable backend returning nothing stays
  // an evidence statement, not an infrastructure excuse.
  const notFound = Object.assign(new Error('Tempo trace fetch failed: HTTP 404 Not Found'), { httpStatus: 404 });
  assert.equal(classifyTraceFailure({ error: notFound, candidateCount: 1 }), TRACE_OUTCOME.NO_MATCHING_TRACE);

  const forbidden = Object.assign(new Error('Tempo search failed: HTTP 403 Forbidden'), { httpStatus: 403 });
  assert.equal(classifyTraceFailure({ error: forbidden }), TRACE_OUTCOME.NO_MATCHING_TRACE);

  // Server-side refusal and rate limiting remain availability claims.
  for (const status of [500, 502, 503, 504, 429]) {
    const error = Object.assign(new Error(`Tempo search failed: HTTP ${status}`), { httpStatus: status });
    assert.equal(classifyTraceFailure({ error }), TRACE_OUTCOME.BACKEND_UNAVAILABLE, `status ${status}`);
  }
});
