# WO-1217 — proof harness authority repair

## Branch / PR
- Branch: `codeagent/wo1217-proof-harness-authority-fix`
- Review-fix code commit: `dffb1ceb8c78c789442c18135f00618b564da85d`
- Branch tip: use `git rev-parse HEAD` / origin branch tip after push
- Base: docs `origin/main` @ `513a74ad1db3cfbb5ac10cc45155ee1e1acb911a`
- PR: https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/510 (not merged)

## Review fix (PR review 4920192489)

**Finding:** `parentReturnContainsNonce` accepted any assistant/system message containing the nonce, so a paraphrased schedule acknowledgement could falsely satisfy `parent_return_nonce_bound`.

**Reproduction (now false):**
`parentReturnContainsNonce([{role:'assistant', content:'Scheduled delegate for nonce-x; waiting for completion.'}], 'nonce-x')` => `false`

**Fix:**
- Require the exact `MODEL-TOOL-CHILD <nonce> MODEL <provider/model>` marker for parent return authority (shared via `childReturnMarkerRegex` with auxiliary self-report parse).
- Adversarial schedule-paraphrase + loose MODEL-TOOL-CHILD mention cases added.
- Exact marker still accepted on assistant/system history.
- Metadata-only model equality unchanged (`resolveModelToolChildAuthority` / spawnedBy set-diff).
- Runbook authority note updated.

**Files touched in this fix:**
- `tools/k6-proofs/lib/r-cd-model-tool-authority.mjs`
- `tools/k6-proofs/tests/r-cd-model-tool-authority.test.mjs`
- `RUNBOOKS/project-81/rows/R-CD-MODEL-TOOL.md`
- `output.md`

## Prior WO-1217 work (a26ca671)
Shared targeted-return collector for R-CD-4 / R-CD-CHAINED-DEPTH-2; disposable-parent spawnedBy set-diff for R-CD-MODEL-TOOL; Tempo 31-hex pad. Historical PROOFS untouched; no product code.

## Validation

```bash
node --test tools/k6-proofs/tests/r-cd-model-tool-authority.test.mjs
# 5 pass / 0 fail

node --test tools/k6-proofs/tests/**/*.test.mjs tools/k6-proofs/scripts/__tests__/**/*.test.mjs
# full-suite: 363 pass / 1 fail (pre-existing INDEX schema drift on current_sha proofs-manifest)

node tools/k6-proofs/scripts/check-manifest-scenarios.mjs --repo-root "$PWD"  # pass
node tools/k6-proofs/scripts/check-scenario-alignment.mjs --repo-root "$PWD"  # pass
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs --repo-root "$PWD" # pass
```

## Coupled fallout
- No other k6-proofs lib helper used the loose assistant/system nonce-text return gate.
- Targeted-return authority remains journal-line bound.
- Model equality remains metadata-only.

## GitNexus
- Index present (70,515 nodes); impact/detect-changes blocked by LadybugDB v42 vs runtime v40.
- Manual blast radius LOW: only r-cd-model-tool scenario + unit test.

## Remaining live reruns
R-CD-4, R-CD-CHAINED-DEPTH-2, R-CD-MODEL-TOOL need fresh disposable-session PASS-candidate fires under new authority.

## Product notes
- R-CD-4 behavior did not regress.
- Product trace bug remains karmaterminal/openclaw#1251.
- Old artifacts unchanged. Do not merge.
