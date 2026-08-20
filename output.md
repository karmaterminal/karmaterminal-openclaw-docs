# Proof harness authority repair — #514

Branch: `codeagent/proof-harness-authority-514`
Base: `de315e25aad6871e51341de7916c7383fa3d06a7`
Head: `2aea6cde`
Bound issue: `karmaterminal/karmaterminal-openclaw-docs#514`

No OpenClaw product change. No live proofs. No edits under `PROOFS/c3a0e5a...`.
`replayInvalid` remains public safety metadata.

## What changed

### Defect 1 — R-CD-2 replay safety vs lifecycle success
- `gatewayLifecycleSucceeded()` no longer treats `replayInvalid=true` as failure.
- `gatewayLifecycleReplayInvalid()` records the flag separately.
- `r-cd-2-silent-wake.js` keeps `dispatch_replay_invalid` evidence and never maps replay safety to `delegate-replay-unsafe`.
- Authoritative receipt still fail-closes genuine `provider-or-turn-failure` / abort / missing sentinel. Historical `delegate-replay-unsafe` packets are PARTIAL, not FAIL.

### Defect 2 — R-CD-TOKEN exact runtime identity
- New fail-closed resolver: `lib/runtime-identity.mjs` + `scripts/resolve-runtime-identity.mjs`.
- Sources: structured receipt file, installed `~/.openclaw/*receipt.json`, `openclaw version --json`, operator exact env SHA.
- Never copies `candidate_sha`, never expands a short stamp into a full SHA.
- Ambiguous/malformed identity is rejected before token dispatch.
- Public metadata records `runtimeBuildShaSource`.
- Non-token rows may still publish a human version stamp.
- Workflow `project81-k6-proof.yml` resolves identity independently before the suite.

### Defect 3 — R-CW-3 shared-trace tool attribution
- `collect-continuation-trace.mjs` now scopes `continue_work` tool spans to the reason-bound work/fire topology.
- One matching tool on a reason-bound trace is accepted (preserves historical R-CW-1 packets).
- Multiple tools require a unique causal (parent/child/same-generation) origin; timing is only used to disambiguate causal candidates.
- Zero or multiple in-scope origins remain fail-closed. Time-window-only attribution is rejected.
- Repeated fire attempts still allowed.

### Defect 4 — R-RC-2 honest-limit policy
- Shared helper `lib/r-rc-2-honest-limit.mjs` is the single authority for bound threshold receipts.
- `HONEST-LIMIT-candidate` still requires nonce-bound `request_compaction` `toolResult` (`status=rejected`, `guard=context_threshold`) plus the matching child return.
- Prose / unbound tool results cannot promote.
- Runner, review-debt, report, candidate validation, and the R-RC-2 manifest notes agree: those receipts are sufficient; missing Tempo is not review debt on the honest-limit path.

## GitNexus

Indexed this exact worktree (not a stale OpenClaw product index):

```
npx gitnexus analyze --force
# 74,308 nodes | 84,398 edges | 670 clusters | 272 flows
```

MCP GitNexus could not read the new LadybugDB (file v42 vs server v40). Queries used CLI `gitnexus@1.6.9` with `--repo` set to this worktree.

Pre-edit: `gatewayLifecycleSucceeded` consumers in-repo are `r-cd-2-silent-wake.js:res` plus frozen `PROOFS/**` copies (not edited).

Post-edit compare to `de315e25`:

```
npx gitnexus detect-changes --scope compare --base-ref de315e25aad6871e51341de7916c7383fa3d06a7
# Changes: 22 files, 44 symbols
# Affected processes: 2 (Res → AgentIdFromSessionKey, Res → BuildRequest)
# Risk: medium
```

Helper context:
- `gatewayLifecycleReplayInvalid` <- `r-cd-2-silent-wake.js:res`
- `scopeWorkToolSpans` <- `validateTrace`
- `rrc2HonestLimitReceiptsSufficient` <- `receiptSummary`, `filterHonestLimitReviewDebt`
- `resolveExactRuntimeIdentity` used by `resolve-runtime-identity.mjs` / runner / workflow

## Validation

```
node --test tools/k6-proofs/scripts/__tests__/*.mjs tools/k6-proofs/tests/*.mjs
# 399 pass, 0 fail, 19759 ms

node tools/k6-proofs/scripts/check-manifest-scenarios.mjs --repo-root .
node tools/k6-proofs/scripts/check-scenario-alignment.mjs --repo-root .
node tools/k6-proofs/scripts/check-proof-row-manifests.mjs --repo-root .
node tools/k6-proofs/scripts/check-telemetry-contracts.mjs --repo-root .
node tools/k6-proofs/scripts/validate-corpus.mjs --index
git diff --check
```

All catalog/telemetry/corpus/whitespace checks passed.

## Uncertainties
- Live rows were not refired; this lane only repairs harness authority.
- When an operator already supplies an exact 40-char `OPENCLAW_RUNTIME_BUILD_SHA`, the CLI is not probed unless an explicit receipt file is also present (avoids host-SHA collisions in tests and accidental overwrite).
- Historical public R-CW-1 traces have one `continue_work` tool whose parent is not the work/fire parent; a unique reason-bound tool remains accepted.

## Verdict
Harness authority repair is complete and covered. Frond review still owns any sanctioned replacement fire / corpus fold.
