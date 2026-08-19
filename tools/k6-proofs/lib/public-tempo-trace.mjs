const PUBLIC_TRACE_ATTRIBUTE_KEYS = new Set([
  'chain.id',
  'delegate.mode',
  'gen_ai.tool.name',
  'openclaw.outcome',
  'openclaw.toolName',
  'reason.hash',
  'reason.length',
  'reason.present',
]);

export function tempoAttributeValue(attribute) {
  const value = attribute?.value || {};
  return value.stringValue ?? value.intValue ?? value.boolValue ?? value.doubleValue ?? null;
}

export function allTempoSpans(trace) {
  let spans;
  if (Array.isArray(trace?.batches)) {
    spans = trace.batches.flatMap((batch) =>
      (batch.scopeSpans || batch.instrumentationLibrarySpans || []).flatMap((scope) => scope.spans || []));
  } else if (Array.isArray(trace?.trace?.spans)) {
    spans = trace.trace.spans;
  } else if (trace?.schema === 'openclaw.k6.public-tempo-trace.v1' && Array.isArray(trace.spans)) {
    spans = trace.spans;
  } else {
    spans = [];
  }

  const seen = new Map();
  return spans.filter((span) => {
    if (!span?.traceId || !span?.spanId) return true;
    const identity = `${String(span.traceId)}:${String(span.spanId)}`;
    const serialized = JSON.stringify(span);
    const previous = seen.get(identity);
    if (previous === serialized) return false;
    if (previous === undefined) seen.set(identity, serialized);
    return true;
  });
}

function safeHex(value, length) {
  const text = String(value ?? '').toLowerCase();
  return new RegExp(`^[0-9a-f]{${length}}$`).test(text) && !/^0+$/.test(text) ? text : null;
}

function safeSpanId(value, bytes) {
  if (!value) return null;
  const text = String(value);
  if (text.length === bytes * 2 && /^[0-9a-f]+$/i.test(text)) return safeHex(text, bytes * 2);
  try {
    const decoded = Buffer.from(text, 'base64');
    return decoded.length === bytes ? safeHex(decoded.toString('hex'), bytes * 2) : null;
  } catch {
    return null;
  }
}

function publicTraceAttribute(attribute) {
  if (!attribute || !PUBLIC_TRACE_ATTRIBUTE_KEYS.has(attribute.key)) return null;
  const value = tempoAttributeValue(attribute);
  if (value === undefined || value === null) return null;

  if (attribute.key === 'reason.hash' && !/^[0-9a-f]{16}$/iu.test(String(value))) return null;
  if (attribute.key === 'reason.length' && !Number.isInteger(Number(value))) return null;
  if (attribute.key === 'reason.present' && value !== true && value !== false && value !== 'true' && value !== 'false') return null;
  if (attribute.key === 'delegate.mode' && !['normal', 'silent', 'silent-wake', 'post-compaction'].includes(String(value))) return null;
  if (['gen_ai.tool.name', 'openclaw.toolName'].includes(attribute.key) &&
      !['continue_delegate', 'continue_work', 'request_compaction'].includes(String(value))) return null;
  if (attribute.key === 'openclaw.outcome' && String(value) !== 'blocked') return null;
  if (attribute.key === 'chain.id' &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(String(value))) return null;

  if (typeof value === 'boolean') return { key: attribute.key, value: { boolValue: value } };
  if (typeof value === 'number' || attribute.key === 'reason.length') {
    return { key: attribute.key, value: { intValue: String(value) } };
  }
  return { key: attribute.key, value: { stringValue: String(value) } };
}

export function publicTempoStatusCode(value) {
  if (value == null || value === 0 || value === 'UNSET' || value === 'STATUS_CODE_UNSET') {
    return 'UNSET';
  }
  if (value === 1 || value === 'OK' || value === 'STATUS_CODE_OK') return 'OK';
  if (value === 2 || value === 'ERROR' || value === 'STATUS_CODE_ERROR') return 'ERROR';
  return 'UNKNOWN';
}

export function publicTempoSpanName(value) {
  return typeof value === 'string' && /^(?:openclaw|continuation)\.[A-Za-z0-9._:-]{1,150}$/u.test(value)
    ? value
    : null;
}

/**
 * Convert a private Tempo/OTLP response into the only trace shape permitted in
 * public proof-run artifacts. Arbitrary resource/span attributes, events,
 * links, status messages, task text, and credentials are intentionally absent.
 */
export function projectPublicTempoTrace(trace, traceId) {
  const spans = allTempoSpans(trace).flatMap((span) => {
    const name = publicTempoSpanName(span.name);
    if (!name) return [];
    const spanId = safeSpanId(span.spanId, 8);
    if (!spanId) return [];
    const parentSpanId = safeSpanId(span.parentSpanId, 8);
    return [{
      name,
      traceId,
      spanId,
      parentSpanId,
      status: { code: publicTempoStatusCode(span.status?.code) },
      attributes: (Array.isArray(span.attributes) ? span.attributes : [])
        .map(publicTraceAttribute)
        .filter(Boolean),
    }];
  });
  return {
    schema: 'openclaw.k6.public-tempo-trace.v1',
    traceId,
    spans,
  };
}
