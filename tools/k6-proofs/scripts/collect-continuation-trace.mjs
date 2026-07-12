#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_TEMPO_BASE_URL = 'http://tempo.dandelion.cult';

function usage() {
  console.error(`Usage: node collect-continuation-trace.mjs \\
  --run-dir <row-run-dir> --manifest <row-manifest.json> --seat <seat> \\
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
    if (!['--run-dir', '--manifest', '--seat', '--tempo-url', '--timeout-ms', '--poll-ms'].includes(arg)) {
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

function attributeValue(attribute) {
  const value = attribute?.value || {};
  return value.stringValue ?? value.intValue ?? value.boolValue ?? value.doubleValue ?? null;
}

function attributes(span) {
  return new Map((span?.attributes || []).map((attribute) => [attribute.key, attributeValue(attribute)]));
}

function allSpans(trace) {
  if (Array.isArray(trace?.batches)) {
    return trace.batches.flatMap((batch) =>
      (batch.scopeSpans || batch.instrumentationLibrarySpans || []).flatMap((scope) => scope.spans || []));
  }
  if (Array.isArray(trace?.trace?.spans)) return trace.trace.spans;
  return [];
}

async function readEvidence(runDir) {
  const text = await readFile(path.join(runDir, 'evidence.jsonl'), 'utf8');
  const records = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  if (records.length !== 1) throw new Error(`expected exactly one evidence record, found ${records.length}`);
  return records[0];
}

function reasonReceipt(manifest, evidence) {
  const template = manifest?.invocation?.promptTemplate;
  const nonce = evidence?.nonce;
  if (!template || !nonce) throw new Error('manifest promptTemplate and evidence nonce are required');
  const reason = String(template).replaceAll('{{nonce}}', String(nonce));
  const hash = createHash('sha256').update(reason).digest('hex').slice(0, 16);
  const length = reason.length;
  if (evidence.reason_hash && evidence.reason_hash !== hash) {
    throw new Error(`evidence reason_hash mismatch: expected ${hash}, got ${evidence.reason_hash}`);
  }
  if (evidence.reason_length && Number(evidence.reason_length) !== length) {
    throw new Error(`evidence reason_length mismatch: expected ${length}, got ${evidence.reason_length}`);
  }
  return { hash, length };
}

async function tempoSearch(baseUrl, query, start, end) {
  const root = String(baseUrl).replace(/\/+$/, '');
  const params = new URLSearchParams({ q: query, start: String(start), end: String(end), limit: '20' });
  const response = await fetch(`${root}/api/search?${params}`, { headers: { accept: 'application/json' } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Tempo search failed: HTTP ${response.status} ${text.slice(0, 240)}`);
  const json = JSON.parse(text);
  return json.traces || [];
}

async function fetchTrace(baseUrl, traceId) {
  const root = String(baseUrl).replace(/\/+$/, '');
  const response = await fetch(`${root}/api/traces/${encodeURIComponent(traceId)}`, {
    headers: { accept: 'application/json' },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Tempo trace fetch failed: HTTP ${response.status} ${text.slice(0, 240)}`);
  return JSON.parse(text);
}

function validateTrace(trace, expected) {
  const spans = allSpans(trace);
  const dispatch = spans.find((span) => {
    const attrs = attributes(span);
    return span.name === 'continuation.delegate.dispatch' &&
      attrs.get('reason.hash') === expected.reasonHash &&
      Number(attrs.get('reason.length')) === expected.reasonLength &&
      attrs.get('delegate.mode') === expected.mode;
  });
  if (!dispatch) throw new Error('matched trace lacks the expected continuation.delegate.dispatch span');
  const dispatchAttrs = attributes(dispatch);
  const chainId = String(dispatchAttrs.get('chain.id') || '');
  if (!chainId) throw new Error('dispatch span lacks chain.id');

  const fire = spans.find((span) => {
    const attrs = attributes(span);
    return span.name === 'continuation.delegate.fire' &&
      attrs.get('chain.id') === chainId &&
      attrs.get('reason.hash') === expected.reasonHash &&
      Number(attrs.get('reason.length')) === expected.reasonLength &&
      attrs.get('delegate.mode') === expected.mode;
  });
  if (!fire) throw new Error('matched trace lacks the expected continuation.delegate.fire span');

  const tools = spans.filter((span) => {
    const attrs = attributes(span);
    return span.name === 'openclaw.tool.execution' && attrs.get('gen_ai.tool.name') === 'continue_delegate';
  });
  if (tools.length === 0) throw new Error('matched trace lacks the originating continue_delegate tool span');

  const traceId = idHex(dispatch.traceId, 16, 'trace id');
  const fireTraceId = idHex(fire.traceId, 16, 'fire trace id');
  const toolTraceIds = tools.map((span) => idHex(span.traceId, 16, 'tool trace id'));
  if (fireTraceId !== traceId || toolTraceIds.some((value) => value !== traceId)) {
    throw new Error('tool/fire/dispatch do not share one trace');
  }

  const dispatchSpanId = idHex(dispatch.spanId, 8, 'dispatch span id');
  const fireSpanId = idHex(fire.spanId, 8, 'fire span id');
  const toolSpanIds = tools.map((span) => idHex(span.spanId, 8, 'tool span id'));
  if (dispatchSpanId === fireSpanId || toolSpanIds.includes(dispatchSpanId) || toolSpanIds.includes(fireSpanId)) {
    throw new Error('tool/fire/dispatch span IDs are not distinct');
  }

  const childSpans = spans
    .filter((span) => span.parentSpanId && idHex(span.parentSpanId, 8, 'parent span id') === dispatchSpanId)
    .map((span) => ({ name: span.name, spanId: idHex(span.spanId, 8, 'child span id') }));

  return {
    traceId,
    chainId,
    toolSpanIds,
    fireSpanId,
    dispatchSpanId,
    fireParentSpanId: idHex(fire.parentSpanId, 8, 'fire parent span id'),
    dispatchParentSpanId: idHex(dispatch.parentSpanId, 8, 'dispatch parent span id'),
    childSpans,
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
  const evidence = await readEvidence(runDir);
  const manifest = JSON.parse(await readFile(args.manifest, 'utf8'));
  if (manifest?.invocation?.tool !== 'continue_delegate') {
    throw new Error('collector currently supports continue_delegate rows only');
  }

  const reason = reasonReceipt(manifest, evidence);
  const mode = escapeTraceqlString(manifest.invocation.mode);
  const prince = escapeTraceqlString(String(args.seat).split('-')[0]);
  const serviceName = `${prince}-prince`;
  const query = `{ resource.service.name="${serviceName}" && name="continuation.delegate.dispatch" && .reason.hash="${reason.hash}" && .reason.length=${reason.length} && .delegate.mode="${mode}" }`;
  const dispatchMs = Number(evidence.dispatch_accepted_at_ms || Date.parse(evidence.started));
  if (!Number.isFinite(dispatchMs)) throw new Error('evidence lacks a valid dispatch/start time');
  const start = Math.floor(dispatchMs / 1000) - 60;
  const deadline = Date.now() + args.timeoutMs;
  let candidates = [];
  let traceId = '';
  let trace = null;
  let topology = null;
  let validationError = null;

  do {
    candidates = await tempoSearch(args.tempoUrl, query, start, Math.floor(Date.now() / 1000) + 60);
    if (candidates.length > 1) {
      throw new Error(`reason correlation is ambiguous: ${candidates.length} Tempo traces matched`);
    }
    if (candidates.length === 1) {
      traceId = safeHex(candidates[0].traceID || candidates[0].traceId || candidates[0].trace_id, 32, 'search trace id');
      trace = await fetchTrace(args.tempoUrl, traceId);
      try {
        topology = validateTrace(trace, {
          reasonHash: reason.hash,
          reasonLength: reason.length,
          mode,
        });
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
    throw new Error(`no Tempo trace matched reason hash ${reason.hash} before timeout`);
  }

  const traceOut = path.join(runDir, `tempo-trace-${traceId.slice(0, 12)}.json`);
  const receiptOut = path.join(runDir, 'continuation-trace-correlation.json');
  await writeFile(traceOut, JSON.stringify(trace, null, 2) + '\n');
  const receipt = {
    schema: 'openclaw.k6.continuation-trace-correlation.v1',
    generatedAt: new Date().toISOString(),
    row: evidence.row || manifest.rowId,
    seat: args.seat,
    attribution: 'reason-hash-length-mode',
    reason: { hash: reason.hash, length: reason.length, rawPersisted: false },
    delegate: { mode },
    query,
    traceJson: path.basename(traceOut),
    ...topology,
    sameTrace: true,
    distinctSpans: true,
  };
  await writeFile(receiptOut, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({
    traceId,
    traceOut,
    receiptOut,
    reasonHash: reason.hash,
    reasonLength: reason.length,
    chainId: topology.chainId,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    usage();
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
}
