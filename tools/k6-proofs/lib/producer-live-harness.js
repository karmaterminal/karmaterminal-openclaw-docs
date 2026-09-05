import { gatewayLifecycleSucceeded } from './gateway-lifecycle.js';

export const HARNESS_MARKER = '[k6-proof-harness]';

export function boolEnv(name) {
  return (__ENV[name] || '').toLowerCase() === 'true';
}

export function requireGatewayToken() {
  const token = __ENV.OPENCLAW_GATEWAY_TOKEN;
  if (!token) console.error('OPENCLAW_GATEWAY_TOKEN is required for a live producer');
  return token || null;
}

export function disposableSessionKey(rowId, rowNonce) {
  return `${rowId.toLowerCase()}-${rowNonce}`.replace(/[^a-z0-9-]/g, '-');
}

export function renderTemplate(template, rowNonce, replacements = {}) {
  let rendered = String(template || '').replaceAll('{{nonce}}', rowNonce);
  for (const [name, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(`{{${name}}}`, String(value));
  }
  return rendered;
}

export function eventEnvelope(classified) {
  const event = classified?.kind === 'event' ? classified.data : null;
  return event && typeof event === 'object' ? event : null;
}

export function eventIdentity(classified) {
  const event = eventEnvelope(classified);
  if (!event) return null;
  return {
    event: classified.event || null,
    sessionKey: typeof event.sessionKey === 'string' ? event.sessionKey : null,
    runId: typeof event.runId === 'string' ? event.runId : null,
    seq: Number.isInteger(event.seq) ? event.seq : null,
    stream: typeof event.stream === 'string' ? event.stream : null,
    ts: Number.isFinite(event.ts) ? event.ts : null,
    spawnedBy: typeof event.spawnedBy === 'string' ? event.spawnedBy : null,
    data: event.data && typeof event.data === 'object' ? event.data : {},
  };
}

export function eventDedupKey(identity) {
  if (!identity?.sessionKey || !identity?.runId || identity.seq === null) return null;
  return `${identity.sessionKey}\u0000${identity.runId}\u0000${identity.seq}`;
}

export function acceptedSpawn(classified, expectedParentSession, expectedParentRun = null) {
  const identity = eventIdentity(classified);
  if (!identity ||
      identity.event !== 'agent' ||
      identity.sessionKey !== expectedParentSession ||
      (expectedParentRun && identity.runId !== expectedParentRun) ||
      identity.stream !== 'tool' ||
      identity.data?.phase !== 'result' ||
      identity.data?.name !== 'sessions_spawn' ||
      identity.data?.isError === true) {
    return null;
  }
  const details = identity.data?.result?.details;
  if (details?.status !== 'accepted' ||
      typeof details.childSessionKey !== 'string' ||
      typeof details.runId !== 'string') {
    return null;
  }
  return {
    parentSessionKey: identity.sessionKey,
    parentRunId: identity.runId,
    toolCallId: identity.data.toolCallId || null,
    childSessionKey: details.childSessionKey,
    childRunId: details.runId,
    mode: details.mode || null,
    context: details.context || null,
  };
}

export function lifecycleEvent(classified, expectedSession, expectedRun = null) {
  const event = eventEnvelope(classified);
  const identity = eventIdentity(classified);
  if (!identity ||
      identity.event !== 'agent' ||
      identity.stream !== 'lifecycle' ||
      identity.sessionKey !== expectedSession ||
      (expectedRun && identity.runId !== expectedRun) ||
      !['start', 'end', 'error'].includes(identity.data?.phase)) {
    return null;
  }
  const rawPhase = identity.data.phase;
  const succeeded = gatewayLifecycleSucceeded(event);
  return {
    sessionKey: identity.sessionKey,
    runId: identity.runId,
    phase: rawPhase === 'end' && !succeeded ? 'error' : rawPhase,
    startedAt: identity.data.startedAt || null,
    endedAt: identity.data.endedAt || null,
    succeeded,
  };
}

export function toolEvent(classified, expectedSession, expectedRun, toolName) {
  const identity = eventIdentity(classified);
  if (!identity ||
      identity.event !== 'agent' ||
      identity.stream !== 'tool' ||
      identity.sessionKey !== expectedSession ||
      identity.runId !== expectedRun ||
      identity.data?.name !== toolName ||
      !['start', 'result'].includes(identity.data?.phase)) {
    return null;
  }
  return {
    sessionKey: identity.sessionKey,
    runId: identity.runId,
    phase: identity.data.phase,
    toolCallId: identity.data.toolCallId || null,
    isError: identity.data.isError === true,
  };
}

export function assistantTextEvent(classified, expectedSession, expectedRun = null) {
  const identity = eventIdentity(classified);
  if (!identity ||
      identity.event !== 'agent' ||
      identity.stream !== 'assistant' ||
      identity.sessionKey !== expectedSession ||
      (expectedRun && identity.runId !== expectedRun)) {
    return null;
  }
  const text = typeof identity.data?.text === 'string'
    ? identity.data.text
    : typeof identity.data?.delta === 'string'
      ? identity.data.delta
      : null;
  return text === null ? null : { ...identity, text };
}

function directTaskRecords(payload) {
  const records = [];
  if (Array.isArray(payload?.tasks)) records.push(...payload.tasks);
  if (payload && typeof payload === 'object' && !Array.isArray(payload) &&
      (typeof payload.taskId === 'string' || typeof payload.id === 'string')) {
    records.push(payload);
  }
  return records;
}

export function taskRecordsForIdentity(payload, tokens) {
  const expected = tokens.filter((token) => typeof token === 'string' && token.length > 0);
  return directTaskRecords(payload).filter((record) => {
    const identityText = [record.title, record.task, record.text]
      .filter((value) => typeof value === 'string')
      .join('\n');
    return expected.every((token) => identityText.includes(token));
  }).map((record) => ({
    taskId: record.taskId || record.id || null,
    flowId: record.flowId || null,
    sessionKey: record.sessionKey || null,
    childSessionKey: record.childSessionKey || null,
    runId: record.runId || null,
    status: record.status || null,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  }));
}

export function uniquePush(values, value) {
  if (value !== null && value !== undefined && !values.includes(value)) values.push(value);
}
