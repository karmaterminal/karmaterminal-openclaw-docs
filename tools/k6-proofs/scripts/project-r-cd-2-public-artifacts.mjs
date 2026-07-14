#!/usr/bin/env node
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateAndProjectRcd2LifecycleReceipt } from '../lib/r-cd-2-lifecycle-receipt.js';
import {
  projectRcd2PublicManifest,
  projectRcd2PublicRowResult,
  projectRcd2PublicSeatReadiness,
  projectRcd2PublicSummary,
  renderRcd2PublicEvidence,
} from '../lib/r-cd-2-public-summary.mjs';

function parseArgs(argv) {
  const out = {};
  const allowed = new Set([
    '--run-dir',
    '--receipt',
    '--evidence',
    '--correlation',
    '--candidate-sha',
    '--seat',
  ]);
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!allowed.has(flag) || !value) {
      throw new Error(
        'usage: --run-dir <dir> --receipt <receipt> --evidence <private-evidence> [--correlation <private-correlation>]',
      );
    }
    out[flag.slice(2)] = value;
    i += 1;
  }
  if (!out['run-dir'] || !out.receipt || !out.evidence) {
    throw new Error('run-dir, receipt, and evidence are required');
  }
  return out;
}

async function jsonOrNull(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function oneJsonRecord(file) {
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean);
  if (lines.length !== 1) throw new Error('R-CD-2 private evidence must contain exactly one JSON record');
  return JSON.parse(lines[0]);
}

async function findPrivateSummary(runDir) {
  const names = await readdir(runDir);
  for (const name of names) {
    if (/summary\.json$/i.test(name)) {
      const summary = await jsonOrNull(path.join(runDir, name));
      if (summary) return summary;
    }
  }
  return {};
}

async function clearDirectory(runDir) {
  const entries = await readdir(runDir);
  await Promise.all(entries.map((name) =>
    rm(path.join(runDir, name), { recursive: true, force: true })));
}

export async function projectRcd2PublicArtifacts({
  runDir,
  receiptPath,
  evidencePath,
  correlationPath,
  candidateSha,
  seat,
}) {
  const canonicalReceiptPath = path.join(runDir, 'r-cd-2-lifecycle-receipt.json');
  if (path.resolve(receiptPath) !== path.resolve(canonicalReceiptPath)) {
    throw new Error('R-CD-2 receipt must use the canonical non-identifying filename');
  }

  const [receipt, evidence, correlation, manifest, privateSummary, seatReadiness] = await Promise.all([
    jsonOrNull(receiptPath),
    oneJsonRecord(evidencePath),
    correlationPath ? jsonOrNull(correlationPath) : null,
    jsonOrNull(path.join(runDir, 'row-manifest.json')),
    findPrivateSummary(runDir),
    jsonOrNull(path.join(runDir, 'seat-readiness.json')),
  ]);
  const publicManifest = projectRcd2PublicManifest({
    candidateSha: candidateSha || manifest?.candidateSha,
    seat: seat || manifest?.seat,
  });
  const validation = validateAndProjectRcd2LifecycleReceipt({
    receipt,
    evidence,
    correlation,
  });
  if (!validation.valid) {
    await clearDirectory(runDir);
    await mkdir(path.join(runDir, 'artifacts'), { recursive: true });
    await Promise.all([
      writeFile(
        path.join(runDir, 'row-manifest.json'),
        `${JSON.stringify(publicManifest, null, 2)}\n`,
      ),
      writeFile(
        path.join(runDir, 'projection-rejected.json'),
        `${JSON.stringify({
          schema: 'openclaw.k6.r-cd-2-public-projection-rejected.v1',
          row: 'R-CD-2',
          outcome: 'PARTIAL-candidate',
          reason: validation.reason,
          privateAcquisitionWithheld: true,
        }, null, 2)}\n`,
      ),
      writeFile(
        path.join(runDir, 'k6.log'),
        'R-CD-2 public projection rejected; private k6 acquisition withheld.\n',
      ),
      writeFile(
        path.join(runDir, 'gateway-journal.log'),
        'R-CD-2 public projection rejected; private gateway acquisition withheld.\n',
      ),
      writeFile(path.join(runDir, 'evidence.jsonl'), ''),
      writeFile(path.join(runDir, 'evidence-lines.log'), ''),
    ]);
    throw new Error(`R-CD-2 lifecycle receipt rejected: ${validation.reason}`);
  }

  const publicReceipt = validation.publicReceipt;
  const generatedAt = new Date().toISOString();
  const publicSummary = projectRcd2PublicSummary(privateSummary, publicReceipt);
  const result = projectRcd2PublicRowResult({
    lifecycleReceipt: publicReceipt,
    publicSummary,
    candidateSha: publicManifest.candidateSha,
    seat: publicManifest.seat,
    runId: path.basename(runDir),
    generatedAt,
  });

  await clearDirectory(runDir);
  await mkdir(path.join(runDir, 'artifacts'), { recursive: true });
  const publicWrites = [
    writeFile(path.join(runDir, 'row-manifest.json'), `${JSON.stringify(publicManifest, null, 2)}\n`),
    writeFile(canonicalReceiptPath, `${JSON.stringify(publicReceipt, null, 2)}\n`),
    writeFile(path.join(runDir, 'k6-summary.json'), `${JSON.stringify(publicSummary, null, 2)}\n`),
    writeFile(path.join(runDir, 'row-result.json'), `${JSON.stringify(result, null, 2)}\n`),
    writeFile(path.join(runDir, 'EVIDENCE.md'), renderRcd2PublicEvidence({ result })),
    writeFile(path.join(runDir, 'evidence.jsonl'), `${JSON.stringify({
      row: 'R-CD-2',
      verdict: publicReceipt.verdict,
      ...(publicReceipt.failureCategory
        ? { failureCategory: publicReceipt.failureCategory }
        : {}),
      lifecycleReceipt: 'r-cd-2-lifecycle-receipt.json',
      acquisition: 'private',
    })}\n`),
    writeFile(path.join(runDir, 'evidence-lines.log'), ''),
    writeFile(
      path.join(runDir, 'evidence-redaction.json'),
      `${JSON.stringify({
        schema: 'openclaw.k6.public-evidence-redaction.v1',
        generatedAt,
        projection: 'r-cd-2-allowlist',
        privateAcquisitionWithheld: true,
      }, null, 2)}\n`,
    ),
    writeFile(
      path.join(runDir, 'k6.log'),
      'R-CD-2 private k6 acquisition withheld; see public lifecycle receipt.\n',
    ),
    writeFile(
      path.join(runDir, 'gateway-journal.log'),
      'R-CD-2 private gateway acquisition withheld; see public lifecycle receipt.\n',
    ),
  ];
  if (seatReadiness) {
    publicWrites.push(writeFile(
      path.join(runDir, 'seat-readiness.json'),
      `${JSON.stringify(projectRcd2PublicSeatReadiness(seatReadiness, {
        candidateSha: publicManifest.candidateSha,
        seat: publicManifest.seat,
      }), null, 2)}\n`,
    ));
  }
  await Promise.all(publicWrites);
  return {
    receipt: publicReceipt,
    publicFiles: (await readdir(runDir)).sort(),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const result = await projectRcd2PublicArtifacts({
    runDir: path.resolve(args['run-dir']),
    receiptPath: path.resolve(args.receipt),
    evidencePath: path.resolve(args.evidence),
    correlationPath: args.correlation ? path.resolve(args.correlation) : null,
    candidateSha: args['candidate-sha'],
    seat: args.seat,
  });
  process.stdout.write(`${JSON.stringify({
    row: 'R-CD-2',
    receipt: 'validated',
    publicFiles: result.publicFiles.length,
  })}\n`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
