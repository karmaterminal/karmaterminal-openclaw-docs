#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAW_PAYLOAD_KEYS = new Set([
  'agentinstruction',
  'events',
  'expectedtask',
  'message',
  'prompt',
  'prompttemplate',
  'raw',
  'rawevents',
  'rawfinaltext',
  'spawntask',
  'schedulecalls',
  'redactedevents',
  'task',
]);

function usage() {
  console.error(`Usage: node sanitize-k6-artifacts.mjs \\
  --input <private-evidence.jsonl> --out <evidence.jsonl> \\
  --lines-out <evidence-lines.log> --receipt-out <evidence-redaction.json> \\
  --log-input <private-k6.log> --log-out <k6.log> \\
  [--service-log-input <private-gateway.log> \\
   --service-log-out <gateway-journal.log> \\
   --service-log-receipt-out <gateway-journal-redaction.json>]`);
}

function parseArgs(argv) {
  const out = {};
  const allowed = new Set([
    '--input',
    '--out',
    '--lines-out',
    '--receipt-out',
    '--log-input',
    '--log-out',
    '--service-log-input',
    '--service-log-out',
    '--service-log-receipt-out',
  ]);
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!allowed.has(arg)) throw new Error(`unexpected argument: ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    out[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    i += 1;
  }
  return out;
}

function normalizedKey(key) {
  return String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function sensitiveCategory(key) {
  const normalized = normalizedKey(key);
  if (normalized.includes('nonce')) return 'nonce';
  if (normalized.includes('sessionkey') || normalized.endsWith('session')) return 'session-key';
  if (normalized.includes('runid')) return 'run-id';
  if (normalized.includes('flowid')) return 'flow-id';
  if (normalized.includes('taskid')) return 'task-id';
  if (normalized.includes('toolcallid')) return 'tool-call-id';
  if (normalized.includes('idempotencykey')) return 'idempotency-key';
  if (RAW_PAYLOAD_KEYS.has(normalized)) return 'payload';
  return null;
}

function collectSensitiveTokens(value, tokens) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const category = sensitiveCategory(key);
    if (category && (typeof child === 'string' || typeof child === 'number')) {
      const token = String(child);
      if (token.length >= 6) tokens.set(token, `<redacted-${category}>`);
      continue;
    }
    if (!category) collectSensitiveTokens(child, tokens);
  }
}

function scrubString(value, orderedTokens) {
  let out = value;
  for (const [token, replacement] of orderedTokens) {
    out = out.split(token).join(replacement);
  }
  return out
    .replace(/\bagent:[A-Za-z0-9:_-]{6,}\b/g, '<redacted-session-key>')
    .replace(/\bR-[A-Z0-9-]+-\d{10,}-[A-Za-z0-9_-]+\b/g, '<redacted-nonce>')
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*\b/gi, '<redacted-authorization>')
    .replace(/\btraceparent\s*[:=]\s*["']?[A-Za-z0-9-]+["']?/gi, 'trace-context=<redacted>')
    .replace(
      /(\b(?:[a-z0-9]+[_-])?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|operator[_-]?token|auth(?:orization)?[_-]?token|gateway[_-]?token|authorization|password|secret)\b["']?\s*[:=]\s*["']?)[^\s"',}]+/gi,
      '$1<redacted-secret>',
    )
    .replace(
      /(\b(?:agentinstruction|message|prompt|task)\b["']?\s*[:=]\s*)[^\r\n]*/gi,
      '$1<redacted-payload>',
    )
    .replace(/\bhttps?:\/\/[^@\s/]+:[^@\s/]+@/gi, 'https://<redacted-credentials>@');
}

function sanitizeValue(value, orderedTokens) {
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, orderedTokens));
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? scrubString(value, orderedTokens) : value;
  }

  const out = {};
  for (const [index, [key, child]] of Object.entries(value).entries()) {
    if (sensitiveCategory(key)) continue;
    const scrubbedKey = scrubString(key, orderedTokens);
    const publicKey = scrubbedKey === key
      ? scrubbedKey
      : `<redacted-identifier-key-${index}>`;
    out[publicKey] = sanitizeValue(child, orderedTokens);
  }
  return out;
}

function assertPublicSafe(value, orderedTokens) {
  const serialized = JSON.stringify(value);
  for (const [token] of orderedTokens) {
    if (serialized.includes(token)) throw new Error('sanitized evidence still contains a sensitive value');
  }

  function visit(child) {
    if (Array.isArray(child)) {
      child.forEach(visit);
      return;
    }
    if (!child || typeof child !== 'object') return;
    for (const [key, nested] of Object.entries(child)) {
      if (sensitiveCategory(key)) throw new Error(`sanitized evidence still contains sensitive key: ${key}`);
      for (const [token] of orderedTokens) {
        if (key.includes(token)) throw new Error('sanitized evidence key still contains a sensitive value');
      }
      visit(nested);
    }
  }
  visit(value);
}

function decodeMessage(line) {
  const marker = ' msg=';
  const start = line.indexOf(marker);
  if (start < 0) return line;
  const encodedStart = start + marker.length;
  const source = line.lastIndexOf(' source=');
  const encoded = line.slice(encodedStart, source > encodedStart ? source : undefined).trim();
  if (!encoded.startsWith('"')) return encoded;
  try {
    return JSON.parse(encoded);
  } catch {
    return null;
  }
}

function sanitizeLog(logText, sanitizedRecords, orderedTokens) {
  const out = [];
  let awaitingEvidenceRecord = false;
  let recordIndex = 0;

  for (const line of String(logText || '').split(/\r?\n/)) {
    const message = decodeMessage(line);
    const text = String(message || '').trim();
    const inlineEvidence = /(?:[A-Z0-9_-]+_EVIDENCE|===\s*K6-PROOF-EVIDENCE\s*===)\s+\{/.test(text);

    if (inlineEvidence) {
      if (sanitizedRecords[recordIndex]) {
        out.push(`PUBLIC_EVIDENCE ${JSON.stringify(sanitizedRecords[recordIndex])}`);
        recordIndex += 1;
      }
      continue;
    }
    if (/\bEVIDENCE SUMMARY\b|===\s*K6-PROOF-EVIDENCE\s*===/.test(text)) {
      awaitingEvidenceRecord = true;
      continue;
    }
    if (awaitingEvidenceRecord && text.startsWith('{')) {
      if (sanitizedRecords[recordIndex]) {
        out.push(`PUBLIC_EVIDENCE ${JSON.stringify(sanitizedRecords[recordIndex])}`);
        recordIndex += 1;
      }
      awaitingEvidenceRecord = false;
      continue;
    }
    if (/---\s*END EVIDENCE\s*---|===\s*END K6-PROOF-EVIDENCE\s*===/.test(text)) continue;
    if (text.includes('[k6-proof-harness]')) {
      out.push('[k6-proof-harness] <redacted-dispatch>');
      continue;
    }
    out.push(scrubString(line, orderedTokens));
  }

  return out.join('\n').replace(/\n+$/, '') + '\n';
}

function serviceIdentityFields(line) {
  const fields = [];
  const json = line.trim().startsWith('{') ? line.trim() : /:\s*(\{.*\})\s*$/u.exec(line)?.[1];
  if (json) {
    try {
      const record = JSON.parse(json);
      for (const source of [record, record.fields, record.attributes]) {
        if (source && typeof source === 'object' && !Array.isArray(source)) {
          fields.push(...Object.entries(source));
        }
      }
    } catch { /* Malformed structured logs cannot authorize publication. */ }
    return fields;
  }
  for (const match of line.matchAll(/(?:^|\s)([A-Za-z][A-Za-z0-9_.-]*)=("(?:\\.|[^"\\])*"|'[^']*'|[^\s"']+)/gu)) {
    const [, key, raw] = match;
    // Free-text payload tails are not structured identity fields.
    if (['note', 'body', 'message', 'msg', 'prompt', 'task'].includes(normalizedKey(key))) break;
    let value = raw;
    if (raw.startsWith('"')) {
      try { value = JSON.parse(raw); } catch { continue; }
    } else if (raw.startsWith("'")) value = raw.slice(1, -1);
    fields.push([key, value]);
  }
  return fields;
}

const PUBLIC_SERVICE_FIELDS = new Map([
  ['timestamp', 'timestamp'],
  ['time', 'timestamp'],
  ['level', 'level'],
  ['event', 'event'],
  ['kind', 'kind'],
  ['status', 'status'],
  ['phase', 'phase'],
  ['disposition', 'disposition'],
  ['controllerid', 'controllerId'],
  ['delayms', 'delayMs'],
  ['hop', 'hop'],
  ['row', 'row'],
]);

function publicServiceProjection(fields, orderedTokens) {
  const projected = {};
  for (const [rawKey, value] of fields) {
    const key = normalizedKey(rawKey);
    const category = {
      nonce: 'nonce',
      runid: 'run-id',
      taskid: 'task-id',
      flowid: 'flow-id',
      traceid: 'trace-id',
      spanid: 'span-id',
      toolcallid: 'tool-call-id',
      sessionkey: 'session-key',
    }[key];
    if (category) {
      const correlated = orderedTokens.some(([token, replacement]) =>
        token === value && replacement === `<redacted-${category}>`);
      if (correlated) {
        projected[`${key}Fingerprint`] = createHash('sha256')
          .update(String(value))
          .digest('hex')
          .slice(0, 16);
      }
      continue;
    }
    const publicKey = PUBLIC_SERVICE_FIELDS.get(key);
    if (!publicKey) continue;
    if (typeof value === 'number' || typeof value === 'boolean') {
      projected[publicKey] = value;
    } else if (typeof value === 'string' && /^[A-Za-z0-9_.:/-]{1,120}$/u.test(value)) {
      projected[publicKey] = value;
    }
  }
  return projected;
}

export function sanitizeServiceLog(logText, orderedTokens) {
  const lines = String(logText || '').split(/\r?\n/).filter(Boolean);
  const retained = [];
  const categories = { nonce: 'nonce', runid: 'run-id', taskid: 'task-id',
    flowid: 'flow-id', traceid: 'trace-id', toolcallid: 'tool-call-id' };

  for (const line of lines) {
    const rawFields = serviceIdentityFields(line);
    const fields = rawFields.map(([key, value]) => [normalizedKey(key), value]);
    const correlated = fields.some(([key, value]) => {
      if (!Object.hasOwn(categories, key) || fields.filter(([name]) => name === key).length !== 1) return false;
      return orderedTokens.some(([token, category]) =>
        token === value && category === `<redacted-${categories[key]}>`);
    });
    if (!correlated) continue;
    retained.push(JSON.stringify({
      schema: 'openclaw.k6.public-service-log-record.v1',
      fields: publicServiceProjection(rawFields, orderedTokens),
    }));
  }

  return {
    totalLines: lines.length,
    retainedLines: retained.length,
    text: retained.length > 0
      ? `${retained.join('\n')}\n`
      : '[gateway-journal] no positively correlated lines in the bounded capture window\n',
  };
}

export function sanitizeEvidenceRecords(records, extraTokens = []) {
  const tokens = new Map();
  for (const record of records) collectSensitiveTokens(record, tokens);
  for (const [token, replacement] of extraTokens) {
    if (String(token).length >= 6) tokens.set(String(token), replacement);
  }
  const orderedTokens = [...tokens.entries()].sort((a, b) => b[0].length - a[0].length);
  const sanitized = records.map((record) => sanitizeValue(record, orderedTokens));
  sanitized.forEach((record) => assertPublicSafe(record, orderedTokens));
  return { sanitized, orderedTokens };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.input || !args.out || !args.linesOut || !args.receiptOut || !args.logInput || !args.logOut) {
    usage();
    process.exitCode = 2;
    return;
  }
  const serviceLogArgs = [
    args.serviceLogInput,
    args.serviceLogOut,
    args.serviceLogReceiptOut,
  ].filter(Boolean);
  if (serviceLogArgs.length !== 0 && serviceLogArgs.length !== 3) {
    usage();
    process.exitCode = 2;
    return;
  }

  const evidenceText = await readFile(args.input, 'utf8');
  const records = evidenceText.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const extraTokens = process.env.OPENCLAW_SESSION_KEY
    ? [[process.env.OPENCLAW_SESSION_KEY, '<redacted-session-key>']]
    : [];
  const { sanitized, orderedTokens } = sanitizeEvidenceRecords(records, extraTokens);
  const logText = await readFile(args.logInput, 'utf8');
  const publicLog = sanitizeLog(logText, sanitized, orderedTokens);
  for (const [token] of orderedTokens) {
    if (publicLog.includes(token)) throw new Error('sanitized k6 log still contains a sensitive value');
  }
  let publicServiceLog = null;
  if (args.serviceLogInput) {
    publicServiceLog = sanitizeServiceLog(
      await readFile(args.serviceLogInput, 'utf8'),
      orderedTokens,
    );
    for (const [token] of orderedTokens) {
      if (publicServiceLog.text.includes(token)) {
        throw new Error('sanitized gateway journal still contains a sensitive value');
      }
    }
  }

  await writeFile(args.out, sanitized.map((record) => JSON.stringify(record)).join('\n') + (sanitized.length ? '\n' : ''));
  await writeFile(args.linesOut, sanitized.map((record) => `PUBLIC_EVIDENCE ${JSON.stringify(record)}`).join('\n') + (sanitized.length ? '\n' : ''));
  await writeFile(args.logOut, publicLog);
  if (publicServiceLog) {
    await writeFile(args.serviceLogOut, publicServiceLog.text);
    await writeFile(args.serviceLogReceiptOut, JSON.stringify({
      schema: 'openclaw.k6.public-service-log-redaction.v1',
      generatedAt: new Date().toISOString(),
      totalLines: publicServiceLog.totalLines,
      retainedLines: publicServiceLog.retainedLines,
      removedSensitiveValues: orderedTokens.length,
      output: path.basename(args.serviceLogOut),
    }, null, 2) + '\n');
  }
  await writeFile(args.receiptOut, JSON.stringify({
    schema: 'openclaw.k6.public-evidence-redaction.v1',
    generatedAt: new Date().toISOString(),
    records: sanitized.length,
    removedSensitiveValues: orderedTokens.length,
    outputs: {
      evidence: path.basename(args.out),
      evidenceLines: path.basename(args.linesOut),
      k6Log: path.basename(args.logOut),
      ...(publicServiceLog ? {
        gatewayJournal: path.basename(args.serviceLogOut),
        gatewayJournalRedaction: path.basename(args.serviceLogReceiptOut),
      } : {}),
    },
  }, null, 2) + '\n');

  if (sanitized.length === 0) {
    console.error('no evidence records were available for public artifact generation');
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ records: sanitized.length, removedSensitiveValues: orderedTokens.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  });
}
