#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED = new Set(['PASS-candidate', 'HONEST-LIMIT-candidate', 'PARTIAL-candidate', 'FAIL-candidate', 'construct-only']);

function normalize(value) {
  if (value === 'BAD_PROOF') return 'FAIL-candidate';
  if (['PASS', 'PARTIAL', 'HONEST-LIMIT', 'FAIL'].includes(value)) return `${value}-candidate`;
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!['--run-dir', '--log'].includes(key) || !value) throw new Error(`invalid argument: ${key || '(missing)'}`);
    args[key.slice(2).replace('-', '')] = value;
  }
  return args;
}

export async function resolveRunVerdict(runDir, logPath) {
  const errors = [];
  const files = (await readdir(runDir)).filter((name) => /summary\.json$/i.test(name)).sort();
  const summaryVerdicts = [];
  for (const file of files) {
    try {
      const summary = JSON.parse(await readFile(path.join(runDir, file), 'utf8'));
      if (summary.verdict != null) summaryVerdicts.push(normalize(summary.verdict));
    } catch (error) {
      errors.push(`${file}: malformed JSON (${error.message})`);
    }
  }
  const log = await readFile(logPath, 'utf8').catch(() => '');
  const vuVerdicts = [...log.matchAll(/VERDICT:\s+(PASS|PARTIAL|HONEST-LIMIT|FAIL)-candidate/g)]
    .map((match) => `${match[1]}-candidate`);
  const distinctSummary = [...new Set(summaryVerdicts)];
  const distinctVu = [...new Set(vuVerdicts)];
  if (distinctSummary.length > 1) errors.push(`conflicting summary verdicts: ${distinctSummary.join(', ')}`);
  if (distinctVu.length > 1) errors.push(`conflicting VU verdicts: ${distinctVu.join(', ')}`);
  if (distinctSummary.length === 0 && distinctVu.length === 0) errors.push('verdict result missing');
  if (distinctSummary[0] && distinctVu[0] && distinctSummary[0] !== distinctVu[0]) {
    errors.push(`summary/VU verdict mismatch: ${distinctSummary[0]} != ${distinctVu[0]}`);
  }
  const selected = distinctVu[0] || distinctSummary[0];
  if (selected && !ALLOWED.has(selected)) errors.push(`unsupported verdict: ${selected}`);
  return {
    schema: 'openclaw.k6.resolved-run-verdict.v1',
    ok: errors.length === 0,
    verdict: errors.length === 0 ? selected : 'NO-VERDICT-candidate',
    verdictSource: errors.length === 0
      ? (distinctSummary[0] && distinctVu[0] ? 'vu-log+summary-file' : distinctVu[0] ? 'vu-log' : 'summary-file')
      : 'result-contract-failure',
    summaryFileVerdict: distinctSummary.length === 1 ? distinctSummary[0] : null,
    vuLogVerdict: distinctVu.length === 1 ? distinctVu[0] : null,
    summaryFiles: files,
    errors,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv);
  const result = await resolveRunVerdict(path.resolve(args.rundir), path.resolve(args.log));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
