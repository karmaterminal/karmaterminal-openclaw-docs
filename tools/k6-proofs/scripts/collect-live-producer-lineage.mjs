#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderRowTaskTemplate } from '../lib/row-child-correlation.mjs';
import { collectionTerminalComplete, requestedTokenObserved } from '../lib/producer-live-harness.js';

const SUPPORTED_ROWS = new Set([
  'R-CD-COLLECTION-ON-COLLAPSE',
  'R-CW-DELEGATE-CHILD-LIVE',
  'R-CW-DELEGATE-TOKEN',
  'R-CW-MULTI',
  'R-CW-7',
]);

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
    if (name === '--row') args.row = value.toUpperCase();
    else if (name === '--evidence') args.evidence = value;
    else if (name === '--manifest') args.manifest = value;
    else if (name === '--out') args.out = value;
    else if (name === '--flow-json') args.flowJson = value;
    else if (name === '--gateway-log') args.gatewayLog = value;
    else if (name === '--tempo-url') args.tempoUrl = value;
    else throw new Error(`unexpected argument: ${name}`);
    index += 1;
  }
  return args;
}

function oneEvidenceRecord(file) {
  const records = readFileSync(file, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  if (records.length !== 1) throw new Error(`expected one evidence record, found ${records.length}`);
  return records[0];
}

function flowInventory(file) {
  const parsed = file
    ? JSON.parse(readFileSync(file, 'utf8'))
    : JSON.parse(execFileSync('openclaw', ['tasks', 'flow', 'list', '--json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }));
  if (!Array.isArray(parsed?.flows)) throw new Error('flow inventory lacks flows array');
  return parsed.flows.map((flow) => ({
    ...flow,
    stateJson: typeof flow.stateJson === 'string' ? JSON.parse(flow.stateJson) : (flow.stateJson || {}),
  }));
}

function fingerprint(value) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function publicFlow(flow) {
  return {
    flowIdFingerprint: fingerprint(flow.flowId),
    controllerId: flow.controllerId,
    status: flow.status,
    ownerFingerprint: fingerprint(flow.ownerKey),
    originRunFingerprint: flow.stateJson.originRunId
      ? fingerprint(flow.stateJson.originRunId)
      : null,
    childSessionFingerprint: flow.stateJson.childSessionKey
      ? fingerprint(flow.stateJson.childSessionKey)
      : null,
    hop: flow.stateJson.hop ?? null,
    electedAt: flow.stateJson.electedAt ?? null,
    dueAt: flow.stateJson.dueAt ?? null,
    deliveredAt: flow.stateJson.deliveredAt ?? null,
    turnGrantedAt: flow.stateJson.turnGrantedAt ?? null,
    disposition: flow.stateJson.disposition ?? null,
  };
}

function matchingFlows(flows, controllerId, predicate) {
  return flows.filter((flow) => flow.controllerId === controllerId && predicate(flow.stateJson, flow));
}

function field(line, key, value) {
  if (typeof value !== 'string' || !value.length) return false;
  const values = [...line.matchAll(new RegExp(`(?:^|\\s)${key}=(\\S+)`, 'gu'))];
  return values.length === 1 && values[0][1] === value;
}

function parserBound(log, session, run, delayMs) {
  const lines = log.split(/\r?\n/u).filter((line) =>
    field(line, 'session', session) && field(line, 'runId', run));
  return lines.filter((line) => /\bbracket-parse: kind=work(?:\s|$)/u.test(line) &&
    field(line, 'delayMs', String(delayMs))).length === 1 &&
    lines.filter((line) => /\beffective-signal: origin=bracket kind=work(?:\s|$)/u.test(line)).length === 1;
}

export function delegateSpawnBound(flow, evidence, expectedTask, log) {
  if (!flow ||
      flow.controllerId !== 'core/continuation-delegate' ||
      flow.status !== 'succeeded' ||
      flow.stateJson?.disposition !== 'granted' ||
      flow.stateJson.task !== expectedTask ||
      flow.ownerKey !== evidence.parent_session_key ||
      flow.stateJson.originRunId !== evidence.parent_run_id ||
      flow.stateJson.childSessionKey !== evidence.child_session_key ||
      flow.stateJson.childRunId !== evidence.child_initial_run_id) {
    return false;
  }
  const trace = /^00-([a-f0-9]{32})-([a-f0-9]{16})-0[01]$/u.exec(
    flow.stateJson.traceparent || '',
  );
  if (!trace) return false;
  const [traceId] = trace.slice(1);
  return log.split(/\r?\n/u).filter((line) =>
    field(line, 'controllerId', flow.controllerId) &&
    field(line, 'toolCallId', evidence.spawn_tool_call_id) &&
    field(line, 'taskId', evidence.spawn_task_id) &&
    field(line, 'flowId', evidence.spawn_flow_id) &&
    field(line, 'taskSha256', createHash('sha256').update(expectedTask).digest('hex')) &&
    field(line, 'originRunId', evidence.parent_run_id) &&
    field(line, 'childSessionKey', evidence.child_session_key) &&
    field(line, 'childRunId', evidence.child_initial_run_id) &&
    field(line, 'traceId', traceId) &&
    field(line, 'status', 'succeeded') &&
    field(line, 'disposition', 'granted')).length === 1;
}

function spansOf(trace) {
  if (Array.isArray(trace?.spans)) return trace.spans;
  return (trace?.batches || trace?.resourceSpans || []).flatMap((batch) =>
    (batch.scopeSpans || batch.instrumentationLibrarySpans || []).flatMap((scope) => scope.spans || []));
}
function attrsOf(span) {
  return Object.fromEntries((span.attributes || []).map(({ key, value }) =>
    [key, value?.stringValue ?? value?.intValue ?? value?.doubleValue]));
}
function hexId(value, bytes) {
  if (typeof value !== 'string') return '';
  if (new RegExp(`^[a-f0-9]{${bytes * 2}}$`, 'iu').test(value)) return value.toLowerCase();
  const decoded = Buffer.from(value, 'base64');
  return decoded.length === bytes ? decoded.toString('hex') : '';
}
function exactRunSpan(span, runId, traceId, log) {
  const attrs = attrsOf(span);
  return Boolean(runId) && (attrs['openclaw.run.id'] === runId ||
    attrs['continuation.run.fingerprint'] === fingerprint(runId) ||
    log.split(/\r?\n/u).some((line) =>
      field(line, 'runId', runId) && field(line, 'traceId', traceId) &&
      field(line, 'spanId', hexId(span.spanId, 8))));
}

function reasonMatches(span, state) {
  const attrs = attrsOf(span);
  return state.reason
    ? attrs['reason.hash'] === fingerprint(state.reason)
    : !Object.hasOwn(attrs, 'reason.hash');
}

function workWakeJoin(flow, wake, traces, log, flows) {
  const state = flow?.stateJson;
  const context = /^00-([a-f0-9]{32})-([a-f0-9]{16})-0[01]$/u.exec(state?.traceparent || '');
  if (!context || !state.chainId || !flow.flowId || !wake?.runId ||
      wake.runId === state.originRunId || wake.terminalPhase !== 'end' ||
      !wake.startedAt || !wake.endedAt) return null;
  const [, traceId, parentSpanId] = context;
  const spans = spansOf(traces[traceId]).filter((span) => hexId(span.traceId, 16) === traceId);
  const accepts = spans.filter((span) => span.name === 'continuation.work' &&
    attrsOf(span)['chain.id'] === state.chainId &&
    Number(attrsOf(span)['delay.ms']) === state.delayMs &&
    reasonMatches(span, state));
  if (accepts.length !== 1) return null;
  const fires = spans.filter((span) => span.name === 'continuation.work.fire' &&
    attrsOf(span)['chain.id'] === state.chainId &&
    Number(attrsOf(span)['delay.ms']) === state.delayMs &&
    reasonMatches(span, state) &&
    [1, 'OK', 'STATUS_CODE_OK'].includes(span.status?.code));
  if (fires.length === 0) return null;
  const accept = accepts[0];
  if (![hexId(accept.spanId, 8), hexId(accept.parentSpanId, 8)].includes(parentSpanId)) return null;
  const runSpans = spans.filter((span) =>
    ['openclaw.run', 'openclaw.harness.run'].includes(span.name));
  const exclusiveParent = flows.filter((entry) =>
    entry.controllerId === 'core/continuation-work' &&
    entry.stateJson?.traceparent?.slice(0, 52) === state.traceparent.slice(0, 52)).length === 1 &&
    runSpans.filter((span) => hexId(span.parentSpanId, 8) === parentSpanId).length === 1;
  const runs = spans.filter((span) =>
    ['openclaw.run', 'openclaw.harness.run'].includes(span.name) &&
    exactRunSpan(span, wake.runId, traceId, log) &&
    [parentSpanId, hexId(accept.spanId, 8)].includes(hexId(span.parentSpanId, 8)) &&
    // A shared originating parent is not a per-election wake identity.
    (hexId(span.parentSpanId, 8) === hexId(accept.spanId, 8) ||
      exclusiveParent || log.split(/\r?\n/u).some((line) =>
        field(line, 'flowId', flow.flowId) && field(line, 'runId', wake.runId) &&
        field(line, 'traceId', traceId) && field(line, 'spanId', hexId(span.spanId, 8)))) &&
    [0, 1, 'UNSET', 'OK', 'STATUS_CODE_UNSET', 'STATUS_CODE_OK'].includes(span.status?.code));
  if (runs.length !== 1) return null;
  return { flowIdFingerprint: fingerprint(flow.flowId), runFingerprint: fingerprint(wake.runId),
    traceId, spanId: hexId(runs[0].spanId, 8) };
}

export function validateLineage({ row, evidence, manifest, flows, gatewayLog = '', traces = {} }) {
  const failures = [];
  const joins = [];
  function join(flow, wake, label) {
    const result = workWakeJoin(flow, wake, traces, gatewayLog, flows);
    if (!result) failures.push(`${label} lacks exact flow/lifecycle run/trace join`);
    else joins.push(result);
  }
  let matched = [];
  if (row === 'R-CD-COLLECTION-ON-COLLAPSE') {
    const expectedTask = `C-IDENTITY-${evidence.nonce} ${renderRowTaskTemplate(manifest.invocation.promptTemplate, evidence.nonce)}`;
    matched = matchingFlows(flows, 'core/continuation-delegate', (state, flow) =>
      state.task === expectedTask &&
      flow.ownerKey === evidence.b_session_key);
    if (matched.length !== 1) failures.push(`expected one B-owned delegate flow, found ${matched.length}`);
    const flow = matched[0];
    if (flow) {
      if (flow.flowId !== evidence.c_flow_id) failures.push('C task flowId does not match delegate flow');
      if (flow.stateJson.originRunId !== evidence.b_run_id) failures.push('delegate originRunId is not B run');
      if (flow.stateJson.childSessionKey !== evidence.c_session_key) failures.push('delegate childSessionKey is not C');
      if (flow.stateJson.fanoutMode !== 'tree') failures.push('delegate flow did not persist fanoutMode=tree');
      if (flow.status !== 'succeeded') failures.push('delegate flow is not succeeded');
    }
    if (!collectionTerminalComplete(evidence)) failures.push('root collection lacks exact successful terminal run');
  } else if (row === 'R-CW-DELEGATE-CHILD-LIVE') {
    const childTask = renderRowTaskTemplate(manifest.invocation.promptTemplate, evidence.nonce, {
      reason: renderRowTaskTemplate(manifest.invocation.reason, evidence.nonce),
      delaySeconds: manifest.invocation.cwDelaySeconds ?? 5,
    });
    const delegateFlows = matchingFlows(flows, 'core/continuation-delegate', (state, flow) =>
      state.task === childTask &&
      flow.ownerKey === evidence.parent_session_key);
    if (delegateFlows.length !== 1) {
      failures.push(`expected one parent-owned delegate flow, found ${delegateFlows.length}`);
    }
    const delegateFlow = delegateFlows[0];
    if (delegateFlow) {
      if (delegateFlow.flowId !== evidence.delegate_flow_id) failures.push('task flow does not match delegate flow');
      if (delegateFlow.stateJson.originRunId !== evidence.parent_run_id) failures.push('delegate origin run mismatch');
      if (delegateFlow.stateJson.childSessionKey !== evidence.child_session_key) failures.push('delegate child session mismatch');
      if (delegateFlow.status !== 'succeeded') failures.push('delegate flow is not succeeded');
    }
    const reason = renderRowTaskTemplate(manifest.invocation.reason, evidence.nonce);
    const workFlows = matchingFlows(flows, 'core/continuation-work', (state, flow) =>
      state.reason === reason &&
      flow.ownerKey === evidence.child_session_key);
    if (workFlows.length !== 1) failures.push(`expected one child work flow, found ${workFlows.length}`);
    const flow = workFlows[0];
    if (flow) {
      if (flow.stateJson.originRunId !== evidence.child_initial_run_id) failures.push('work originRunId is not initial child run');
      if (flow.stateJson.disposition !== 'granted') failures.push('child work flow was not granted');
      if (flow.status !== 'succeeded') failures.push('child work flow is not succeeded');
    }
    matched = [...delegateFlows, ...workFlows];
  } else if (row === 'R-CW-DELEGATE-TOKEN') {
    matched = matchingFlows(flows, 'core/continuation-work', (state, flow) =>
      flow.ownerKey === evidence.child_session_key &&
      state.originRunId === evidence.child_initial_run_id);
    if (matched.length !== 1) failures.push(`expected one token-origin child work flow, found ${matched.length}`);
    const flow = matched[0];
    if (flow && (flow.stateJson.disposition !== 'granted' || flow.status !== 'succeeded')) {
      failures.push('token-origin child work flow did not grant and succeed');
    }
    if (!requestedTokenObserved(evidence, '[[CONTINUE_WORK:5]]') ||
        evidence.hop_two_sentinel_bound !== true ||
        evidence.raw_final_text_run_id !== evidence.child_initial_run_id ||
        evidence.child_initial_terminal_phase !== 'end' ||
        flow?.stateJson.delayMs !== 5000 ||
        !parserBound(gatewayLog, evidence.child_session_key, evidence.child_initial_run_id, 5000)) {
      failures.push('exact requested raw token, delay and run-bound parser origin required');
    }
    const expectedTask = renderRowTaskTemplate(manifest.invocation.promptTemplate, evidence.nonce, {
      token: '[[CONTINUE_WORK:5]]',
    });
    const spawn = flows.filter((entry) => entry.flowId === evidence.spawn_flow_id);
    if (spawn.length !== 1 || evidence.spawn_task !== expectedTask ||
        !evidence.spawn_tool_call_id || !evidence.spawn_task_id ||
        evidence.spawn_mode !== 'run' || evidence.spawn_context !== 'isolated' ||
        !delegateSpawnBound(spawn[0], evidence, expectedTask, gatewayLog)) {
      failures.push('spawn toolcall/task/flow/child session/run join missing');
    }
    join(flow, { runId: evidence.hop_two_run_id,
      startedAt: evidence.hop_two_started, endedAt: evidence.hop_two_completed,
      terminalPhase: evidence.hop_two_terminal_phase }, 'token child return');
    if (spawn.length === 1) matched.push(spawn[0]);
    if (evidence.message_tool_body_token_observed === true) {
      failures.push('token appeared in a message-tool body');
    }
    if (evidence.child_continue_work_tool_present !== false ||
        evidence.typed_continue_work_observed === true) {
      failures.push('child had or used typed continue_work');
    }
  } else if (row === 'R-CW-7') {
    const reason = renderRowTaskTemplate(manifest.invocation.reason, evidence.nonce);
    matched = matchingFlows(flows, 'core/continuation-work', (state, flow) =>
      flow.ownerKey === evidence.session_key && state.reason === reason &&
      state.originRunId === evidence.origin_run_id);
    if (matched.length !== 1 || matched[0]?.status !== 'succeeded' ||
        matched[0]?.stateJson.disposition !== 'granted') failures.push('CW7 exact TaskFlow missing');
    if (evidence.hop_two_output_bound !== true) failures.push('CW7 exact successor output missing');
    join(matched[0], { runId: evidence.hop_two_run_id,
      startedAt: evidence.hop_two_started, endedAt: evidence.hop_two_completed,
      terminalPhase: evidence.hop_two_terminal_phase }, 'CW7 successor');
  } else if (row === 'R-CW-MULTI') {
    const expected = (manifest.invocation.elections || []).map((election) => ({
      ...election,
      reason: renderRowTaskTemplate(election.reason, evidence.nonce),
    }));
    matched = matchingFlows(flows, 'core/continuation-work', (state, flow) =>
      flow.ownerKey === evidence.session_key &&
      expected.some((entry) => entry.reason === state.reason));
    const flowIds = matched.map((flow) => flow.flowId);
    const calls = evidence.schedule_calls || [];
    const results = evidence.schedule_results || [];
    if (calls.length !== 3 || results.length !== 3 ||
        new Set(calls.map((call) => call.toolCallId)).size !== 3 ||
        new Set(results).size !== 3) failures.push('typed tool calls/results must join one-to-one');
    if (matched.length !== 3 || new Set(flowIds).size !== 3) {
      failures.push(`expected three distinct work flowIds, found ${new Set(flowIds).size}`);
    }
    for (const election of expected) {
      const matches = matched.filter((flow) =>
        flow.stateJson.reason === election.reason &&
        flow.stateJson.delayMs === election.delaySeconds * 1000);
      if (matches.length !== 1) failures.push(`${election.label} does not map to exactly one flow`);
      const flow = matches[0];
      if (flow) {
        if (flow.stateJson.originRunId !== evidence.origin_run_id) failures.push(`${election.label} originRunId mismatch`);
        if (flow.stateJson.disposition !== 'granted') failures.push(`${election.label} was not granted`);
        if (flow.status !== 'succeeded') failures.push(`${election.label} flow is not succeeded`);
        const wakes = (evidence.wake_runs || []).filter((wake) =>
          wake.labels?.length === 1 && wake.labels[0] === election.label);
        if (wakes.length !== 1) failures.push(`${election.label} requires one exact wake`);
        join(flow, wakes[0], election.label);
        const calls = (evidence.schedule_calls || []).filter((call) =>
          call.reason === election.reason && call.delaySeconds === election.delaySeconds &&
          (evidence.schedule_results || []).includes(call.toolCallId));
        if (calls.length !== 1 || !calls[0].toolCallId) failures.push(`${election.label} tool-call join missing`);
      }
    }
    const tokenFlows = matchingFlows(flows, 'core/continuation-work', (state, flow) =>
      flow.ownerKey === evidence.session_key &&
      state.originRunId === evidence.token_origin_run_id &&
      !expected.some((entry) => entry.reason === state.reason));
    if (tokenFlows.length !== 1) failures.push(`expected one response-token work flow, found ${tokenFlows.length}`);
    const tokenFlow = tokenFlows[0];
    if (tokenFlow &&
        (tokenFlow.stateJson.disposition !== 'granted' || tokenFlow.status !== 'succeeded')) {
      failures.push('response-token work flow did not grant and succeed');
    }
    if (!requestedTokenObserved(evidence, 'CONTINUE_WORK:0') ||
        evidence.raw_final_text_run_id !== evidence.token_origin_run_id ||
        evidence.token_origin_terminal_phase !== 'end' ||
        evidence.token_typed_tool_observed !== false || tokenFlow?.stateJson.delayMs !== 0 ||
        !parserBound(gatewayLog, evidence.session_key, evidence.token_origin_run_id, 0)) {
      failures.push('exact CONTINUE_WORK:0 raw token and run-bound zero-delay parser required');
    }
    const wakeRuns = Array.isArray(evidence.wake_runs) ? evidence.wake_runs : [];
    if (wakeRuns.length !== 3 || wakeRuns.some((wake) =>
      !wake.startedAt || !wake.endedAt || wake.terminalPhase !== 'end' || wake.labels?.length !== 1)) {
      failures.push('expected exactly three completed, uniquely labelled wake runs');
    }
    if (new Set(wakeRuns.map((wake) => wake.runId)).size !== 3 ||
        wakeRuns.some((wake) => !wake.runId || wake.runId === evidence.token_wake_run_id)) {
      failures.push('wake run identities must be distinct and one-to-one');
    }
    join(tokenFlow, { runId: evidence.token_wake_run_id, startedAt: evidence.token_wake_started,
      endedAt: evidence.token_wake_completed, terminalPhase: evidence.token_wake_terminal_phase }, 'token parity');
    if (!evidence.token_wake_run_id ||
        evidence.token_wake_run_id === evidence.token_origin_run_id ||
        evidence.token_wake_terminal_phase !== 'end' ||
        evidence.token_wake_sentinel_bound !== true) {
      failures.push('response-token wake is not separately bound and complete');
    }
    if (new Set(joins.map((entry) => `${entry.traceId}:${entry.spanId}`)).size !== joins.length) {
      failures.push('one trace run cannot discharge multiple flow obligations');
    }
    matched.push(...tokenFlows);
  } else {
    failures.push(`unsupported row ${row}`);
  }
  return {
    schema: 'openclaw.k6.live-producer-lineage.v1',
    rowId: row,
    classification: 'behavioral-live',
    ok: failures.length === 0,
    failures,
    flows: matched.map(publicFlow),
    joins,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv);
    for (const required of ['row', 'evidence', 'manifest', 'out']) {
      if (!args[required]) throw new Error(`--${required} is required`);
    }
    if (!SUPPORTED_ROWS.has(args.row)) throw new Error(`unsupported row ${args.row}`);
    const evidence = oneEvidenceRecord(path.resolve(args.evidence));
    const flows = flowInventory(args.flowJson ? path.resolve(args.flowJson) : null);
    const traces = {};
    const owners = [evidence.session_key, evidence.child_session_key].filter(Boolean);
    const traceIds = new Set(flows.filter((flow) => owners.includes(flow.ownerKey))
      .map((flow) => /^00-([a-f0-9]{32})-[a-f0-9]{16}-0[01]$/u.exec(flow.stateJson.traceparent || '')?.[1])
      .filter(Boolean));
    for (const traceId of traceIds) {
      const base = args.tempoUrl || process.env.OPENCLAW_PROOFS_TEMPO_BASE_URL;
      if (!base) continue;
      const response = await fetch(`${base.replace(/\/+$/u, '')}/api/traces/${traceId}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) traces[traceId] = await response.json();
    }
    const result = validateLineage({
      row: args.row,
      evidence,
      manifest: JSON.parse(readFileSync(path.resolve(args.manifest), 'utf8')),
      flows, traces,
      gatewayLog: args.gatewayLog ? readFileSync(path.resolve(args.gatewayLog), 'utf8') : '',
    });
    writeFileSync(path.resolve(args.out), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.ok) process.exitCode = 2;
  } catch {
    console.error('live producer lineage collection failed');
    process.exitCode = 2;
  }
}
