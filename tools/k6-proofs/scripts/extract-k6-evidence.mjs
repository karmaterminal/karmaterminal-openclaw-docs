#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function usage() {
  console.error('Usage: node extract-k6-evidence.mjs --input <k6.log> --out <evidence.jsonl> [--lines-out <evidence-lines.log>]');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!['--input', '--out', '--lines-out'].includes(arg)) throw new Error(`unexpected argument: ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    out[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    i += 1;
  }
  return out;
}

function decodeMessage(line) {
  const marker = ' msg=';
  const start = line.indexOf(marker);
  if (start < 0) return line;
  const encodedStart = start + marker.length;
  const source = line.lastIndexOf(' source=');
  const encoded = line.slice(encodedStart, source > encodedStart ? source : undefined).trim();
  if (!encoded) return null;
  if (!encoded.startsWith('"')) return encoded;
  try {
    return JSON.parse(encoded);
  } catch {
    return null;
  }
}

function parseJsonCandidate(value) {
  const text = String(value || '').trim();
  if (!text.startsWith('{')) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractEvidenceData(logText) {
  const records = [];
  const lines = [];
  let awaitingRecord = false;

  for (const line of String(logText || '').split(/\r?\n/)) {
    const message = decodeMessage(line);
    if (!message) continue;
    const text = String(message).trim();

    const inline = text.match(/(?:[A-Z0-9_-]+_EVIDENCE|===\s*K6-PROOF-EVIDENCE\s*===)\s+(\{[\s\S]*\})$/);
    if (inline) {
      const record = parseJsonCandidate(inline[1]);
      if (record) {
        records.push(record);
        lines.push(line);
      }
      awaitingRecord = false;
      continue;
    }

    if (/\bEVIDENCE SUMMARY\b|===\s*K6-PROOF-EVIDENCE\s*===/.test(text)) {
      lines.push(line);
      const sameMessageJson = text.match(/(?:SUMMARY\b|===)\s*[\r\n]+(\{[\s\S]*\})/);
      const record = sameMessageJson ? parseJsonCandidate(sameMessageJson[1]) : null;
      if (record) {
        records.push(record);
        awaitingRecord = false;
      } else {
        awaitingRecord = true;
      }
      continue;
    }

    if (awaitingRecord) {
      const record = parseJsonCandidate(text);
      if (record) {
        records.push(record);
        lines.push(line);
        awaitingRecord = false;
      }
    }
  }

  return { records, lines };
}

export function extractEvidence(logText) {
  return extractEvidenceData(logText).records;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.input || !args.out) {
    usage();
    process.exitCode = 2;
    return;
  }
  const { records, lines } = extractEvidenceData(await readFile(args.input, 'utf8'));
  if (records.length === 0) throw new Error('no evidence JSON found in k6 output');
  await writeFile(args.out, records.map((record) => JSON.stringify(record)).join('\n') + '\n');
  if (args.linesOut) await writeFile(args.linesOut, lines.join('\n') + '\n');
  console.log(JSON.stringify({ records: records.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  });
}
