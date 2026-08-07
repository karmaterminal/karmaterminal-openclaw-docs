#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root='/tmp/silas-comparator-full-4c235d8c-20260719T1930Z';
const candidate='4c235d8c1997e8964160117f8d6bf650ad1e8203';
const docsRef='1303a03c2858fce82c235992b7ee06385e8e6304';
const manifest=JSON.parse(readFileSync('/tmp/silas-proof-matrix-20260719-1206/PROOFS/'+candidate+'/proofs-manifest.json','utf8'));
const owner=new Map(manifest.rows.map(r=>[r.row,r.owner]));
const readJson=(p)=>JSON.parse(readFileSync(p,'utf8'));
const reviewedAt=new Date().toISOString();
const partial={
 'R-CD-1':['Preserved original attempt: required continuation.delegate.dispatch status was UNSET rather than OK; required causal-parent contract did not validate.'],
 'R-CD-2':['Authoritative row-scoped receipt is PARTIAL-candidate; required continuation trace/correlation is absent, and post-run recovery could not derive a valid public evidence reason hash.'],
 'R-CD-4':['Behavioral receipts passed, but mandatory Tempo topology validation rejected continuation.delegate.dispatch because span status was not OK.'],
 'R-CD-CHAINED-DEPTH-2':['Depth-2 child/grandchild receipts passed, but mandatory Tempo topology validation rejected continuation.delegate.dispatch because span status was not OK.'],
 'R-CD-MODEL-TOOL':['Dispatch and parent scheduled sentinel were observed, but no authoritative child session/model metadata or return payload arrived within 180337ms.'],
 'R-CD-TOKEN':['Pre-dispatch surface gate classified the attempted carrier as message-body, which is not scanned as raw final text; no parser, queue, spawn, return, or Tempo receipts exist.'],
 'R-CW-1':['Preserved original attempt: schedule was accepted, but the wake arrived roughly 272 seconds late after command-queue-busy; required topology also had UNSET status and duplicate fire-span debt.'],
 'R-CW-3':['Dispatch and scheduled sentinel were observed, but the required wake was not observed within 600424ms; Tempo topology validation also rejected continuation.work because span status was not OK.'],
 'R-OBS-STATUS':['Exact candidate source was fetched, but the status formatter could not be extracted; neither active-line presence nor clean-session absence was proven.']
};
const honest={
 'R-RC-2':['Only row authorized for HONEST_LIMIT: authoritative request_compaction toolResult was invocation-bound and rejected by guard=context_threshold; acceptance and post-compaction path were therefore unavailable without mutating seat pressure.']
};
const priorRoot='/home/figs/.openclaw-data/workspace/proof-artifacts/silas-comparator-4c235d8c-20260719T1908Z/'+candidate;
const unattended=join(root,'unattended',candidate);
const rows=[];

for (const [row,runId] of [['R-CD-1','20260719T191117Z-r-cd-1'],['R-CW-1','20260719T191326Z-r-cw-1']]) {
 const dir=join(priorRoot,row,'silas',runId);
 const existing=readJson(join(dir,'FINAL-REVIEW.json'));
 rows.push({row,canonicalOwner:owner.get(row),executionSeat:'silas-lothric',runnerSeat:'silas',source:'preserved-consumed',runId,artifactDir:dir,finalClassification:'PARTIAL',canonicalFoldAllowed:false,refireAllowed:false,blockers:partial[row],preservedReview:existing});
}

for (const row of readdirSync(unattended).sort()) {
 if (row==='PREFLIGHT') continue;
 const seatDir=join(unattended,row,'silas');
 if (!existsSync(seatDir)) throw new Error(`missing seat dir for ${row}`);
 const runIds=readdirSync(seatDir).filter(x=>!x.startsWith('.')).sort();
 if (runIds.length!==1) throw new Error(`${row}: expected one run dir, found ${runIds.length}`);
 const runId=runIds[0], dir=join(seatDir,runId), result=readJson(join(dir,'run-result.json'));
 let finalClassification, blockers=[], basis=[];
 if (partial[row]) { finalClassification='PARTIAL'; blockers=partial[row]; }
 else if (honest[row]) { finalClassification='HONEST_LIMIT'; blockers=honest[row]; }
 else {
   finalClassification='PASS';
   if (result.verdict!=='PASS-candidate' || result.effectiveExitCode!==0) throw new Error(`${row}: pass classification conflicts with run result`);
   const candidatePath=join(dir,'candidate-run-result.json');
   const validationPath=join(dir,'candidate-run-result-validation.json');
   if (!existsSync(candidatePath) || !existsSync(validationPath)) throw new Error(`${row}: pass classification lacks candidate envelope`);
   const envelope=readJson(candidatePath), validated=readJson(validationPath);
   const checks=[
     envelope.candidate?.sha===candidate,
     envelope.candidate?.docsRef===docsRef,
     envelope.run?.rowId===row,
     envelope.run?.seat==='silas',
     envelope.result?.outcome==='PASS-candidate',
     envelope.result?.effectiveExitCode===0,
     envelope.review?.complete===true,
     Array.isArray(envelope.review?.pendingReceipts)&&envelope.review.pendingReceipts.length===0,
     JSON.stringify(envelope)===JSON.stringify(validated)
   ];
   if (checks.some(v=>!v)) throw new Error(`${row}: candidate envelope did not pass independent structural review`);
   basis=['Exact candidate/docs identity matched; runner outcome PASS-candidate with effective exit 0; candidate envelope and validation mirror are byte-equivalent; review complete with no pending receipts; sanitized runner/journal packet preserved.'];
 }
 const review={
   schema:'openclaw.k6.silas-comparator.final-review.v1',
   reviewedAt,candidateSha:candidate,docsRef,row,canonicalOwner:owner.get(row),executionSeat:'silas-lothric',runnerSeat:'silas',runId,
   runnerVerdict:result.verdict,effectiveExitCode:result.effectiveExitCode,finalClassification,comparatorClassificationFinal:true,
   canonicalFoldAllowed:false,canonicalFoldReason:'Independent Silas comparator evidence does not overwrite or substitute for the exact manifest canonical owner.',
   refireAllowed:false,basis,blockers,
 };
 writeFileSync(join(dir,'FINAL-REVIEW.json'),JSON.stringify(review,null,2)+'\n');
 rows.push({...review,source:'remaining-unattended',artifactDir:dir});
}

for (const row of ['R-CW-5','R-CW-6']) {
 const dir=join(root,'fixtures',`${row}-attempt-2`), result=readJson(join(dir,'fixture-result.json'));
 if (result.verdict!=='PASS-candidate' || Object.values(result.checks||{}).some(v=>v!==true)) throw new Error(`${row}: fixture is not fully green`);
 const review={schema:'openclaw.k6.silas-comparator.final-review.v1',reviewedAt,candidateSha:candidate,docsRef,row,canonicalOwner:owner.get(row),executionSeat:'silas-lothric',runnerSeat:'process-local-fixture',runId:`${row}-attempt-2`,runnerVerdict:result.verdict,effectiveExitCode:0,finalClassification:'PASS',comparatorClassificationFinal:true,canonicalFoldAllowed:false,canonicalFoldReason:'Exact-candidate process-local component evidence is review-required and does not overwrite the canonical owner.',refireAllowed:false,basis:['Exact candidate fixture completed with every declared check true; source worktree remained tracked-clean; production gateway/config/state were not mutated; attempt 1 is preserved as a mechanically proven pre-execution 0700 safety-gate non-fire.'],blockers:[]};
 writeFileSync(join(dir,'FINAL-REVIEW.json'),JSON.stringify(review,null,2)+'\n');
 rows.push({...review,source:'process-local-fixture',artifactDir:dir});
}

rows.sort((a,b)=>a.row.localeCompare(b.row));
if (rows.length!==35 || new Set(rows.map(r=>r.row)).size!==35) throw new Error(`expected 35 unique rows, got ${rows.length}`);
const rollup={pass:rows.filter(r=>r.finalClassification==='PASS').length,partial:rows.filter(r=>r.finalClassification==='PARTIAL').length,honest_limit:rows.filter(r=>r.finalClassification==='HONEST_LIMIT').length,fail:rows.filter(r=>r.finalClassification==='FAIL').length,total_rows:rows.length};
const consolidated={schema:'openclaw.k6.silas-comparator.final-review-rollup.v1',reviewedAt,candidateSha:candidate,docsRef,executionSeat:'silas-lothric',runnerSeatAlias:'silas',canonicalOwnershipPreserved:true,canonicalFoldAllowed:false,refireAllowed:false,rollup,rows:rows.map(({preservedReview,...r})=>r)};
writeFileSync(join(root,'control','final-review-rollup.json'),JSON.stringify(consolidated,null,2)+'\n');
console.log(JSON.stringify(rollup,null,2));
