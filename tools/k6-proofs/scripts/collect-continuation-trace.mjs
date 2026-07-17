#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  allTempoSpans as allSpans,
  projectPublicTempoTrace,
  publicTempoSpanName as publicSpanName,
  publicTempoStatusCode as publicStatusCode,
  tempoAttributeValue as attributeValue,
} from '../lib/public-tempo-trace.mjs';
import { sanitizeEvidenceRecords } from './sanitize-k6-artifacts.mjs';

const DEFAULT_TEMPO_BASE_URL = 'http://tempo.dandelion.cult';
const CORRELATION_WINDOW_PADDING_SECONDS = 60;

function usage() {
  console.error(`Usage: node collect-continuation-trace.mjs \\
  --run-dir <row-run-dir> --manifest <row-manifest.json> --seat <seat> \\
  [--evidence <private-evidence.jsonl>] \\
  [--tempo-url <base-url>] [--timeout-ms 60000] [--poll-ms 2000]`);
}

function parseArgs(argv, env = process.env) {
  const out = {
    tempoUrl: env.OPENCLAW_PROOFS_TEMPO_BASE_URL || env.TEMPO_BASE_URL || DEFAULT_TEMPO_BASE_URL,
    timeoutMs: 60000,
    pollMs: 2000,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!['--run-dir', '--manifest', '--seat', '--evidence', '--tempo-url', '--timeout-ms', '--poll-ms'].includes(arg)) {
      throw new Error(`unexpected argument: ${arg}`);
    }
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    out[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    i += 1;
  }
  out.timeoutMs = Number(out.timeoutMs);
  out.pollMs = Number(out.pollMs);
  return out;
}

function escapeTraceqlString(value) {
  const text = String(value ?? '');
  if (!/^[A-Za-z0-9._:/-]+$/.test(text)) throw new Error(`unsafe TraceQL value: ${text}`);
  return text;
}

function safeHex(value, length, label) {
  const text = String(value ?? '').toLowerCase();
  if (!new RegExp(`^[0-9a-f]{${length}}$`).test(text) || /^0+$/.test(text)) {
    throw new Error(`invalid ${label}: ${text || '(empty)'}`);
  }
  return text;
}

function idHex(value, bytes, label) {
  const text = String(value ?? '');
  if (text.length === bytes * 2 && /^[0-9a-f]+$/i.test(text)) return safeHex(text, bytes * 2, label);
  const decoded = Buffer.from(text, 'base64');
  if (decoded.length !== bytes) throw new Error(`invalid ${label} byte length`);
  return safeHex(decoded.toString('hex'), bytes * 2, label);
}

function attributes(span) {
  return new Map((span?.attributes || []).map((attribute) => [attribute.key, attributeValue(attribute)]));
}

async function readEvidence(evidencePath) {
  const text = await readFile(evidencePath, 'utf8');
  const records = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  if (records.length !== 1) throw new Error(`expected exactly one evidence record, found ${records.length}`);
  return records[0];
}

function traceContract(manifest, evidence) {
  const tool = manifest?.invocation?.tool;
  const nonce = evidence?.nonce;

  let reason;
  let mode;
  let acceptSpanName;
  let fireSpanName;
  let attribution;
  if (tool === 'continue_delegate') {
    const template = manifest?.invocation?.promptTemplate;
    if (!template) throw new Error('continue_delegate manifest promptTemplate is required');
    if (nonce) reason = String(template).replaceAll('{{nonce}}', String(nonce));
    const manifestMode = manifest.invocation.mode;
    const evidenceMode = evidence.delegate_mode;
    if (manifestMode && evidenceMode && manifestMode !== evidenceMode) {
      throw new Error(
        `evidence delegate_mode mismatch: expected ${manifestMode}, got ${evidenceMode}`,
      );
    }
    mode = escapeTraceqlString(evidenceMode || manifestMode);
    acceptSpanName = 'continuation.delegate.dispatch';
    fireSpanName = 'continuation.delegate.fire';
    attribution = 'reason-hash-length-mode';
  } else if (tool === 'continue_work') {
    const template = manifest?.invocation?.reason;
    if (!template) throw new Error('continue_work manifest reason is required');
    if (nonce) reason = String(template).replaceAll('{{nonce}}', String(nonce));
    acceptSpanName = 'continuation.work';
    fireSpanName = 'continuation.work.fire';
    attribution = 'reason-hash-length';
  } else if (tool) {
    return {
      kind: 'tool',
      tool: escapeTraceqlString(tool),
      attribution: 'seat-tool-dispatch-window',
      fingerprintSource: 'public-evidence-window',
    };
  } else {
    throw new Error('manifest invocation.tool is required for trace collection');
  }

  let hash;
  let length;
  let fingerprintSource;
  if (reason !== undefined) {
    hash = createHash('sha256').update(reason).digest('hex').slice(0, 16);
    length = reason.length;
    fingerprintSource = 'manifest-nonce';
    if (evidence.reason_hash !== undefined && evidence.reason_hash !== hash) {
      throw new Error(`evidence reason_hash mismatch: expected ${hash}, got ${evidence.reason_hash}`);
    }
    if (evidence.reason_length !== undefined && Number(evidence.reason_length) !== length) {
      throw new Error(`evidence reason_length mismatch: expected ${length}, got ${evidence.reason_length}`);
    }
  } else {
    hash = safeHex(evidence.reason_hash, 16, 'evidence reason hash');
    length = Number(evidence.reason_length);
    if (!Number.isInteger(length) || length < 1) {
      throw new Error('public evidence requires a positive integer reason_length');
    }
    fingerprintSource = 'public-evidence';
  }
  return {
    kind: 'continuation',
    tool,
    hash,
    length,
    raw: reason,
    fingerprintSource,
    mode,
    acceptSpanName,
    fireSpanName,
    attribution,
  };
}

function assertTraceIsPublicSafe(trace, evidence, reason) {
  const serialized = JSON.stringify(trace);
  const { orderedTokens } = sanitizeEvidenceRecords([evidence]);
  const forbidden = [reason.raw, ...orderedTokens.map(([token]) => token)]
    .filter((value) => typeof value === 'string' && value.length >= 6);

  if (serialized.toLowerCase().includes('traceparent')) {
    throw new Error('Tempo trace contains forbidden traceparent material');
  }
  if (forbidden.some((value) => serialized.includes(value))) {
    throw new Error('Tempo trace contains private proof attribution material');
  }
}


async function tempoSearch(baseUrl, query, start, end) {
  const root = String(baseUrl).replace(/\/+$/, '');
  const params = new URLSearchParams({ q: query, start: String(start), end: String(end), limit: '20' });
  const response = await fetch(`${root}/api/search?${params}`, { headers: { accept: 'application/json' } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Tempo search failed: HTTP ${response.status} ${response.statusText}`.trim());
  const json = JSON.parse(text);
  return json.traces || [];
}

async function fetchTrace(baseUrl, traceId) {
  const root = String(baseUrl).replace(/\/+$/, '');
  const response = await fetch(`${root}/api/traces/${encodeURIComponent(traceId)}`, {
    headers: { accept: 'application/json' },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Tempo trace fetch failed: HTTP ${response.status} ${response.statusText}`.trim());
  return JSON.parse(text);
}

function matchesContinuationSpan(span, expected, name) {
  const attrs = attributes(span);
  return span.name === name &&
    attrs.get('reason.hash') === expected.reasonHash &&
    Number(attrs.get('reason.length')) === expected.reasonLength &&
    (expected.mode === undefined || attrs.get('delegate.mode') === expected.mode);
}

function validateTrace(trace, expected) {
  const spans = allSpans(trace);
  const accept = spans.find((span) =>
    matchesContinuationSpan(span, expected, expected.acceptSpanName));
  if (!accept) throw new Error(`matched trace lacks the expected ${expected.acceptSpanName} span`);
  const acceptAttrs = attributes(accept);
  const chainId = String(acceptAttrs.get('chain.id') || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(chainId)) {
    throw new Error(`${expected.acceptSpanName} span lacks a public-safe UUIDv4 chain.id`);
  }

  const fire = spans.find((span) => {
    const attrs = attributes(span);
    return matchesContinuationSpan(span, expected, expected.fireSpanName) &&
      attrs.get('chain.id') === chainId &&
      (expected.mode === undefined || attrs.get('delegate.mode') === expected.mode);
  });
  if (!fire) throw new Error(`matched trace lacks the expected ${expected.fireSpanName} span`);

  const tools = spans.filter((span) => {
    const attrs = attributes(span);
    return span.name === 'openclaw.tool.execution' &&
      attrs.get('gen_ai.tool.name') === expected.tool;
  });
  if (tools.length !== 1) {
    throw new Error(
      tools.length === 0
        ? `matched trace lacks the originating ${expected.tool} tool span`
        : `matched trace contains ${tools.length} ${expected.tool} tool spans`,
    );
  }

  const traceId = idHex(accept.traceId, 16, 'trace id');
  const fireTraceId = idHex(fire.traceId, 16, 'fire trace id');
  const toolTraceIds = tools.map((span) => idHex(span.traceId, 16, 'tool trace id'));
  if (fireTraceId !== traceId || toolTraceIds.some((value) => value !== traceId)) {
    throw new Error('tool/fire/accept do not share one trace');
  }

  const acceptSpanId = idHex(accept.spanId, 8, 'accept span id');
  const fireSpanId = idHex(fire.spanId, 8, 'fire span id');
  const toolSpanIds = tools.map((span) => idHex(span.spanId, 8, 'tool span id'));
  if (acceptSpanId === fireSpanId ||
      toolSpanIds.includes(acceptSpanId) ||
      toolSpanIds.includes(fireSpanId)) {
    throw new Error('tool/fire/accept span IDs are not distinct');
  }

  const childSpans = spans
    .filter((span) =>
      span.parentSpanId && idHex(span.parentSpanId, 8, 'parent span id') === acceptSpanId)
    .map((span) => ({ name: publicSpanName(span.name), spanId: idHex(span.spanId, 8, 'child span id') }))
    .filter((span) => span.name !== null);

  const topology = {
    traceId,
    chainId,
    toolSpanIds,
    fireSpanId,
    fireParentSpanId: idHex(fire.parentSpanId, 8, 'fire parent span id'),
    childSpans,
  };
  if (expected.tool === 'continue_delegate') {
    return {
      ...topology,
      dispatchSpanId: acceptSpanId,
      dispatchParentSpanId: idHex(accept.parentSpanId, 8, 'dispatch parent span id'),
    };
  }
  return {
    ...topology,
    workSpanId: acceptSpanId,
    workParentSpanId: idHex(accept.parentSpanId, 8, 'work parent span id'),
  };
}

function validateToolTrace(trace, expected) {
  const spans = allSpans(trace);
  const tools = spans.filter((span) => {
    const attrs = attributes(span);
    return span.name === 'openclaw.tool.execution' &&
      (attrs.get('gen_ai.tool.name') === expected.tool ||
        attrs.get('openclaw.toolName') === expected.tool);
  });
  if (tools.length === 0) {
    throw new Error(`matched trace lacks the originating ${expected.tool} tool span`);
  }
  if (tools.length > 1) {
    throw new Error(`matched trace contains ${tools.length} ${expected.tool} tool spans`);
  }

  const tool = tools[0];
  const attrs = attributes(tool);
  return {
    traceId: idHex(tool.traceId, 16, 'trace id'),
    toolSpanId: idHex(tool.spanId, 8, 'tool span id'),
    toolParentSpanId: tool.parentSpanId
      ? idHex(tool.parentSpanId, 8, 'tool parent span id')
      : null,
    status: {
      code: publicStatusCode(tool.status?.code),
    },
  };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.runDir || !args.manifest || !args.seat) {
    usage();
    process.exitCode = 2;
    return;
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 0 ||
      !Number.isFinite(args.pollMs) || args.pollMs < 1) {
    throw new Error('timeout and poll values must be positive numbers');
  }

  const runDir = path.resolve(args.runDir);
  const evidencePath = path.resolve(args.evidence || path.join(runDir, 'evidence.jsonl'));
  const evidence = await readEvidence(evidencePath);
  const manifest = JSON.parse(await readFile(args.manifest, 'utf8'));

  const contract = traceContract(manifest, evidence);
  const prince = escapeTraceqlString(String(args.seat).split('-')[0]);
  const serviceName = `${prince}-prince`;
  const query = contract.kind === 'continuation'
    ? (() => {
        const modeClause = contract.mode === undefined
          ? ''
          : ` && .delegate.mode="${contract.mode}"`;
        return `{ resource.service.name="${serviceName}" && name="${contract.acceptSpanName}" && .reason.hash="${contract.hash}" && .reason.length=${contract.length}${modeClause} }`;
      })()
    : `{ resource.service.name="${serviceName}" && name="openclaw.tool.execution" && .gen_ai.tool.name="${contract.tool}" }`;
  const dispatchMs = Number(evidence.dispatch_accepted_at_ms || Date.parse(evidence.started));
  if (!Number.isFinite(dispatchMs)) throw new Error('evidence lacks a valid dispatch/start time');
  const dispatchSeconds = Math.floor(dispatchMs / 1000);
  const start = dispatchSeconds - CORRELATION_WINDOW_PADDING_SECONDS;
  const evidenceEndMs = Date.parse(evidence.ended);
  const evidenceEndSeconds = Number.isFinite(evidenceEndMs)
    ? Math.floor(evidenceEndMs / 1000)
    : dispatchSeconds;
  const end = Math.max(dispatchSeconds, evidenceEndSeconds) + CORRELATION_WINDOW_PADDING_SECONDS;
  const deadline = Date.now() + args.timeoutMs;
  let candidates = [];
  let traceId = '';
  let trace = null;
  let topology = null;
  let validationError = null;

  do {
    candidates = await tempoSearch(args.tempoUrl, query, start, end);
    if (candidates.length > 1) {
      throw new Error(`trace correlation is ambiguous: ${candidates.length} Tempo traces matched`);
    }
    if (candidates.length === 1) {
      traceId = safeHex(candidates[0].traceID || candidates[0].traceId || candidates[0].trace_id, 32, 'search trace id');
      trace = await fetchTrace(args.tempoUrl, traceId);
      try {
        topology = contract.kind === 'continuation'
          ? validateTrace(trace, {
              tool: contract.tool,
              reasonHash: contract.hash,
              reasonLength: contract.length,
              mode: contract.mode,
              acceptSpanName: contract.acceptSpanName,
              fireSpanName: contract.fireSpanName,
            })
          : validateToolTrace(trace, { tool: contract.tool });
        if (topology.traceId !== traceId) throw new Error('Tempo search and trace payload IDs disagree');
        break;
      } catch (error) {
        validationError = error;
      }
    }
    if (Date.now() >= deadline) break;
    await sleep(args.pollMs);
  } while (true);

  if (candidates.length === 0 || !topology || !trace) {
    if (validationError) {
      throw new Error(`Tempo trace did not reach valid continuation topology before timeout: ${validationError.message}`);
    }
    const fingerprint = contract.kind === 'continuation'
      ? `reason hash ${contract.hash}`
      : `tool ${contract.tool} in the evidence window`;
    throw new Error(`no Tempo trace matched ${fingerprint} before timeout`);
  }
  assertTraceIsPublicSafe(trace, evidence, contract);
  const publicTrace = projectPublicTempoTrace(trace, traceId);

  const traceOut = path.join(runDir, `tempo-trace-${traceId.slice(0, 12)}.json`);
  const receiptOut = path.join(
    runDir,
    contract.kind === 'continuation'
      ? 'continuation-trace-correlation.json'
      : 'tool-trace-correlation.json',
  );
  await writeFile(traceOut, JSON.stringify(publicTrace, null, 2) + '\n');
  const receipt = {
    schema: contract.kind === 'continuation'
      ? 'openclaw.k6.continuation-trace-correlation.v1'
      : 'openclaw.k6.tool-trace-correlation.v1',
    row: evidence.row || manifest.rowId,
    seat: args.seat,
    attribution: contract.attribution,
    query,
    searchWindow: {
      startUnixSeconds: start,
      endUnixSeconds: end,
      paddingSeconds: CORRELATION_WINDOW_PADDING_SECONDS,
      source: Number.isFinite(evidenceEndMs) ? 'dispatch-and-evidence-ended' : 'dispatch-only',
    },
    traceJson: path.basename(traceOut),
    ...topology,
    ...(contract.kind === 'continuation'
      ? {
          reason: {
            hash: contract.hash,
            length: contract.length,
            source: contract.fingerprintSource,
            rawPersisted: false,
          },
          continuation: {
            tool: contract.tool,
            acceptSpan: contract.acceptSpanName,
            fireSpan: contract.fireSpanName,
          },
          // R-CD-2's row resolver needs the same opaque row identity on both
          // the accepted sessions.send lifecycle and the Tempo topology. The
          // trace has already been selected by this evidence's nonce-derived
          // reason hash; retain only fingerprints, never raw run IDs/nonces.
          ...(evidence.row === 'R-CD-2'
            ? {
                // This is deliberately the collector's native continuation
                // shape. The R-CD-2 resolver consumes these exact fields; it
                // must not rely on a separately invented topology fixture.
                tool: contract.tool,
                mode: contract.mode,
                typedToolObserved: topology.toolSpanIds.length === 1,
                dispatchObserved: Boolean(topology.dispatchSpanId),
                fireObserved: Boolean(topology.fireSpanId),
                sameChain: true,
                rowBinding: {
                  acceptedSendRunFingerprint: evidence.send_run_fingerprint || null,
                  nonceFingerprint: evidence.row_nonce_fingerprint || null,
                  acceptedSendTraceId: evidence.accepted_send_trace_id || null,
                },
              }
            : {}),
          ...(contract.mode === undefined ? {} : { delegate: { mode: contract.mode } }),
          sameTrace: true,
          distinctSpans: true,
        }
      : {
          tool: {
            name: contract.tool,
            spanId: topology.toolSpanId,
            parentSpanId: topology.toolParentSpanId,
            status: topology.status,
          },
          uniqueTrace: true,
        }),
  };
  await writeFile(receiptOut, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({
    traceId,
    traceFile: path.basename(traceOut),
    receiptFile: path.basename(receiptOut),
    ...(contract.kind === 'continuation'
      ? {
          reasonHash: contract.hash,
          reasonLength: contract.length,
          chainId: topology.chainId,
        }
      : {
          tool: contract.tool,
          toolSpanId: topology.toolSpanId,
        }),
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  });
}
