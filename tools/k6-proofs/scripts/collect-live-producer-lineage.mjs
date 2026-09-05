#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderRowTaskTemplate } from '../lib/row-child-correlation.mjs';

const SUPPORTED_ROWS = new Set([
  'R-CD-COLLECTION-ON-COLLAPSE',
  'R-CW-DELEGATE-CHILD-LIVE',
  'R-CW-DELEGATE-TOKEN',
  'R-CW-MULTI',
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

export function validateLineage({ row, evidence, manifest, flows, gatewayLog = '' }) {
  const failures = [];
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
    const session = String(evidence.child_session_key || '').replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const bracket = new RegExp(`bracket-parse: kind=work[^\\n]*session=${session}(?:\\s|$)`, 'u');
    const effective = new RegExp(`effective-signal: origin=bracket kind=work[^\\n]*session=${session}(?:\\s|$)`, 'u');
    if (!bracket.test(gatewayLog) || !effective.test(gatewayLog)) {
      failures.push('gateway log lacks child-session-bound bracket parser origin');
    }
    if (evidence.message_tool_body_token_observed === true) {
      failures.push('token appeared in a message-tool body');
    }
    if (evidence.child_continue_work_tool_present !== false ||
        evidence.typed_continue_work_observed === true) {
      failures.push('child had or used typed continue_work');
    }
  } else if (row === 'R-CW-MULTI') {
    const expected = (manifest.invocation.elections || []).map((election) => ({
      ...election,
      reason: renderRowTaskTemplate(election.reason, evidence.nonce),
    }));
    matched = matchingFlows(flows, 'core/continuation-work', (state, flow) =>
      flow.ownerKey === evidence.session_key &&
      expected.some((entry) => entry.reason === state.reason));
    const flowIds = matched.map((flow) => flow.flowId);
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
    const session = String(evidence.session_key || '').replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const bracket = new RegExp(`bracket-parse: kind=work[^\\n]*session=${session}(?:\\s|$)`, 'u');
    const effective = new RegExp(`effective-signal: origin=bracket kind=work[^\\n]*session=${session}(?:\\s|$)`, 'u');
    if (!bracket.test(gatewayLog) || !effective.test(gatewayLog)) {
      failures.push('gateway log lacks session-bound response-token parser origin');
    }
    const wakeRuns = Array.isArray(evidence.wake_runs) ? evidence.wake_runs : [];
    if (wakeRuns.length !== 3 || wakeRuns.some((wake) =>
      !wake.startedAt || !wake.endedAt || wake.terminalPhase !== 'end' || wake.labels?.length !== 1)) {
      failures.push('expected exactly three completed, uniquely labelled wake runs');
    }
    if (!evidence.token_wake_run_id ||
        evidence.token_wake_run_id === evidence.token_origin_run_id ||
        evidence.token_wake_terminal_phase !== 'end' ||
        evidence.token_wake_sentinel_bound !== true) {
      failures.push('response-token wake is not separately bound and complete');
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
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv);
    for (const required of ['row', 'evidence', 'manifest', 'out']) {
      if (!args[required]) throw new Error(`--${required} is required`);
    }
    if (!SUPPORTED_ROWS.has(args.row)) throw new Error(`unsupported row ${args.row}`);
    const result = validateLineage({
      row: args.row,
      evidence: oneEvidenceRecord(path.resolve(args.evidence)),
      manifest: JSON.parse(readFileSync(path.resolve(args.manifest), 'utf8')),
      flows: flowInventory(args.flowJson ? path.resolve(args.flowJson) : null),
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
