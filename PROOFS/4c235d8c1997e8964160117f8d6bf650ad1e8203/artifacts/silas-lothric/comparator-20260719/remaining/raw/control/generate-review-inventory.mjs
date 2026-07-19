#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const root = '/tmp/silas-comparator-full-4c235d8c-20260719T1930Z';
const candidate = '4c235d8c1997e8964160117f8d6bf650ad1e8203';
const unattended = join(root, 'unattended', candidate);
const json = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const text = (p) => { try { return readFileSync(p, 'utf8').trim(); } catch { return null; } };
const rows = [];
if (existsSync(unattended)) {
  for (const row of readdirSync(unattended).sort()) {
    const seatDir = join(unattended, row, 'silas');
    if (!existsSync(seatDir)) continue;
    const runIds = readdirSync(seatDir).sort();
    for (const runId of runIds) {
      const dir = join(seatDir, runId);
      const result = json(join(dir, 'run-result.json'));
      const evidenceLines = text(join(dir, 'evidence.jsonl'));
      const evidence = evidenceLines ? evidenceLines.split(/\n+/).map((line) => { try { return JSON.parse(line); } catch { return { parseError: true }; } }) : [];
      const traceError = text(join(dir, 'continuation-trace-collector.error.log')) || text(join(dir, 'tempo-trace-error.log'));
      const candidateEnvelope = json(join(dir, 'candidate-run-result.json'));
      rows.push({
        row, source: 'unattended', runId, dir,
        verdict: result?.verdict ?? null,
        effectiveExitCode: result?.effectiveExitCode ?? null,
        k6ExitCode: result?.k6ExitCode ?? null,
        traceId: result?.traceId ?? evidence.find((x) => x?.trace_id)?.trace_id ?? null,
        candidateEnvelopePresent: Boolean(candidateEnvelope),
        evidenceCount: evidence.length,
        evidence,
        traceError,
      });
    }
  }
}
for (const row of ['R-CW-5','R-CW-6']) {
  const dir = join(root, 'fixtures', `${row}-attempt-2`);
  const result = json(join(dir, 'fixture-result.json'));
  rows.push({row, source:'process-local-fixture', runId:`${row}-attempt-2`, dir, verdict:result?.verdict??null, effectiveExitCode:result ? 0 : null, k6ExitCode:null, traceId:null, candidateEnvelopePresent:false, evidenceCount:0, evidence:[], traceError:null, fixtureResult:result});
}
const priorRoot = '/home/figs/.openclaw-data/workspace/proof-artifacts/silas-comparator-4c235d8c-20260719T1908Z/4c235d8c1997e8964160117f8d6bf650ad1e8203';
for (const [row, runId] of [['R-CD-1','20260719T191117Z-r-cd-1'],['R-CW-1','20260719T191326Z-r-cw-1']]) {
  const dir = join(priorRoot,row,'silas',runId);
  const result = json(join(dir,'run-result.json'));
  const finalReview = json(join(dir,'FINAL-REVIEW.json'));
  rows.push({row, source:'preserved-consumed', runId, dir, verdict:result?.verdict??null, effectiveExitCode:result?.effectiveExitCode??null, k6ExitCode:result?.k6ExitCode??null, traceId:json(join(dir,'tempo-trace-postrun-receipt.json'))?.traceId??null, candidateEnvelopePresent:existsSync(join(dir,'candidate-run-result.json')), evidenceCount:0, evidence:[], traceError:text(join(dir,'continuation-trace-collector.error.log')), preservedFinalClassification:finalReview?.finalClassification??null});
}
rows.sort((a,b)=>a.row.localeCompare(b.row)||a.source.localeCompare(b.source));
const out={schema:'openclaw.k6.silas-comparator-review-inventory.v1',generatedAt:new Date().toISOString(),candidateSha:candidate,rows};
writeFileSync(join(root,'control','review-inventory.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({rows:rows.length, bySource:Object.fromEntries([...new Set(rows.map(r=>r.source))].map(s=>[s,rows.filter(r=>r.source===s).length])), missingRunResult:rows.filter(r=>r.source==='unattended'&&!r.verdict).map(r=>r.row)},null,2));
