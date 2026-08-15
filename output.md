# WO-1217 — proof harness authority repair

## Branch / PR
- Branch: `codeagent/wo1217-proof-harness-authority-fix`
- Base: docs `origin/main` @ `513a74ad1db3cfbb5ac10cc45155ee1e1acb911a`
- PR: https://github.com/karmaterminal/karmaterminal-openclaw-docs/pull/510 (not merged)
- Review-fix head before this turn: `5046874a38da47e074c61630b26c4e02f54853c3`
- Branch tip: use `git rev-parse HEAD` / origin branch tip after push

## Review fix (PR review 4920347189)

### Finding 1 — targeted-return `authoritativeReceipt` unsigned / structuralOk false PASS
**Fix:**
- HMAC-seal targeted-return receipts with `hmac-sha256-gateway-token-v1` over canonical closed fields (same createHmac/timingSafeEqual pattern as R-CD-2/R-CD-TOKEN).
- Collector requires `OPENCLAW_GATEWAY_TOKEN`; self-validates seal before write.
- `validateTargetedReturnReceipt(receipt, signingKey, expectedRow)` rejects missing token, forged unsigned PASS, tampered fields, wrong key.
- PASS requires `structuralOk === true` (plus existing counts/fingerprints); hand-forged PASS with structuralOk:false is rejected even when HMAC is valid for that impossible body.
- Candidate contract/validator wrappers pass the gateway token through.
- `run-proofs.sh` fails closed if token missing on R-CD-4 / R-CD-CHAINED-DEPTH-2 collector path.
- Public artifacts remain redacted (fingerprints only; token never serialized).

### Finding 2 — R-CD-MODEL-TOOL sole dispatch lost when pre baseline >500ms
**Fix:**
- Added `createModelToolDispatchGate()` state machine: dispatch exactly once from successful pre `sessions.list` baseline response.
- Removed fixed +800ms sole dispatch timer.
- 5s watchdog still fail-closes if baseline never arrives; late baseline after fail-closed cannot resurrect dispatch.
- Delayed-baseline regression tests prove dispatchCount===1 and never-before-baseline.

## Files touched this fix
- `tools/k6-proofs/lib/targeted-return-receipt.mjs`
- `tools/k6-proofs/scripts/collect-targeted-return-receipt.mjs`
- `tools/k6-proofs/scripts/candidate-run-result-contract.mjs`
- `tools/k6-proofs/scripts/validate-candidate-run-result.mjs`
- `tools/k6-proofs/scripts/run-proofs.sh`
- `tools/k6-proofs/lib/r-cd-4-authority.mjs`
- `tools/k6-proofs/lib/r-cd-chained-depth-2-authority.mjs`
- `tools/k6-proofs/lib/r-cd-model-tool-authority.mjs`
- `tools/k6-proofs/scenarios/r-cd-model-tool.js`
- `tools/k6-proofs/tests/targeted-return-receipt.test.mjs`
- `tools/k6-proofs/tests/r-cd-model-tool-authority.test.mjs`
- `tools/k6-proofs/tests/r-cd-4-authority.test.mjs`
- `tools/k6-proofs/tests/r-cd-chained-depth-2-authority.test.mjs`
- `output.md`

## Validation

```bash
node --test \
  tools/k6-proofs/tests/targeted-return-receipt.test.mjs \
  tools/k6-proofs/tests/r-cd-model-tool-authority.test.mjs \
  tools/k6-proofs/tests/r-cd-chained-depth-2-authority.test.mjs \
  tools/k6-proofs/tests/r-cd-4-authority.test.mjs
# 36 pass / 0 fail

node --test tools/k6-proofs/tests/**/*.test.mjs tools/k6-proofs/scripts/__tests__/**/*.test.mjs
# full-suite: 367 pass / 1 fail (pre-existing INDEX schema drift on current_sha proofs-manifest)

node tools/k6-proofs/scripts/check-manifest-scenarios.mjs --repo-root "$PWD"  # pass
node tools/k6-proofs/scripts/check-scenario-alignment.mjs --repo-root "$PWD"  # pass
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs --repo-root "$PWD" # pass
```

## Product notes
- R-CD-4 behavior did not regress.
- Product trace bug remains karmaterminal/openclaw#1251.
- Old PROOFS artifacts unchanged. Do not merge.
- Remaining live reruns: R-CD-4, R-CD-CHAINED-DEPTH-2, R-CD-MODEL-TOOL under sealed authority.

## GitNexus
- Index present; prior LadybugDB version skew may block impact/detect-changes MCP.
- Manual blast radius LOW: receipt seal + model-tool dispatch gate + collector/validator plumbing only.
