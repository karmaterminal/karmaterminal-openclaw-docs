# WO-1217 — proof harness authority repair

## Branch / PR
- Branch: `codeagent/wo1217-proof-harness-authority-fix`
- Head SHA: `bed55dbaa9ec6d58b8413eb23b52e7083b9dde9c`
- Base: docs `origin/main` @ `513a74ad1db3cfbb5ac10cc45155ee1e1acb911a`
- PR: https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/510 (not merged)

## Review fix (PR review 4920192489)

**Finding:** `parentReturnContainsNonce` accepted any assistant/system message containing the nonce, so a paraphrased schedule acknowledgement could falsely satisfy `parent_return_nonce_bound`.

**Fix:**
- Require the exact `MODEL-TOOL-CHILD <nonce> MODEL <provider/model>` marker for parent return authority (shared via `childReturnMarkerRegex` with auxiliary self-report parse).
- Adversarial case added: `Scheduled delegate for nonce-x; waiting for completion.` => `false`.
- Loose `MODEL-TOOL-CHILD` mention without the full marker also => `false`.
- Metadata-only model equality unchanged (`resolveModelToolChildAuthority` / spawnedBy set-diff).
- Runbook authority note updated.

**Files touched in this fix:**
- `tools/k6-proofs/lib/r-cd-model-tool-authority.mjs`
- `tools/k6-proofs/tests/r-cd-model-tool-authority.test.mjs`
- `RUNBOOKS/project-81/rows/R-CD-MODEL-TOOL.md`

## What changed earlier (prior commit a26ca671)

### Shared targeted-return authority
- **New** `tools/k6-proofs/lib/targeted-return-receipt.mjs`
- **New** `tools/k6-proofs/scripts/collect-targeted-return-receipt.mjs`
- Wired for R-CD-4 and R-CD-CHAINED-DEPTH-2 as authoritative verdict source.

### R-CD-4 / R-CD-CHAINED-DEPTH-2 / Tempo
- Journal targeted-return authority; nested fanoutMode=tree; 31-hex Tempo pad.

### Untouched
- Historical `PROOFS/**` preserved; `PROOFS/INDEX.json` not repointed; no product code.

## Validation

```bash
node --test tools/k6-proofs/tests/r-cd-model-tool-authority.test.mjs
# 5 pass / 0 fail (includes adversarial schedule paraphrase)

node -e "import { parentReturnContainsNonce } from './tools/k6-proofs/lib/r-cd-model-tool-authority.mjs';
console.log(parentReturnContainsNonce([{role:'assistant',content:'Scheduled delegate for nonce-x; waiting for completion.'}],'nonce-x'));"
# false

node --test tools/k6-proofs/tests/**/*.test.mjs tools/k6-proofs/scripts/__tests__/**/*.test.mjs
# full-suite: 363 pass / 1 fail
# fail is pre-existing: candidate envelope corpus INDEX schema drift
#   (openclaw.k6.proofs-manifest.v1 vs openclaw.proofs.manifest.v1); INDEX not modified.

node tools/k6-proofs/scripts/check-manifest-scenarios.mjs --repo-root "$PWD"  # pass
node tools/k6-proofs/scripts/check-scenario-alignment.mjs --repo-root "$PWD"  # pass
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs --repo-root "$PWD" # pass
```

## Coupled fallout inspection
- No other k6-proofs lib helper used the loose "any assistant/system text containing nonce" return gate.
- Sibling targeted-return authority remains journal-line bound (not transcript nonce text).
- Scenario still gates PASS on metadata model equality separately from return marker.

## GitNexus
- Prior re-analyze: 70,515 nodes on this worktree.
- `impact` / `detect-changes` blocked by LadybugDB storage version mismatch (file v42 vs runtime v40).
- Manual blast radius: `parentReturnContainsNonce` callers are only `r-cd-model-tool.js` + unit test — LOW risk.

## Remaining exact-live rerun requirements
Live disposable-session fires still needed for R-CD-4, R-CD-CHAINED-DEPTH-2, and R-CD-MODEL-TOOL under the new authority. Do not fold old PARTIAL rows as PASS without a new live run.

## Product notes
- R-CD-4 behavior did not regress.
- Product trace bug remains `karmaterminal/openclaw#1251`.
- Old artifacts unchanged.
