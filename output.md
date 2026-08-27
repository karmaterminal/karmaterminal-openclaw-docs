# Project-81 Cael Codex runtime validation

Bound issue: `karmaterminal/karmaterminal-openclaw-docs#525`

## Verdict

`PASS` for isolated Codex runtime harness acceptance on Cael. This was not a
continuation proof-row run and produced no corpus evidence.

## Named refs

| Category | Ref | Exact SHA | Identity receipt |
|---|---|---|---|
| Product/base runtime | `karmaterminal/openclaw:codeagent/composite-121204-124337-current` | `6e6da7bba079b0fc50d134b96657cda683985837` | Server ref, Cael live checkout, and independent exact-source runtime equal |
| Lane safe branch | `karmaterminal/karmaterminal-openclaw-docs:codeagent/project81-codex-runtime-cael-validation-20260827` | `39ef6b268650c5ff718226cb17fdfcf2d5f4a3da` at the pre-evidence identity gate | Published unchanged; local docs base, tracking ref, dated server ref, and dispatch server ref equal before evidence |
| CI/workflow | N/A | N/A | Focused validation only |
| Presentation | N/A | N/A | No presentation movement |
| Docs/proof authority | `karmaterminal/karmaterminal-openclaw-docs:codeagent/129388-final-authority-harness-cure` | `39ef6b268650c5ff718226cb17fdfcf2d5f4a3da` | Local docs base and server authority ref equal |

## Isolated target

- Seat: `cael`
- Root: `/home/figs/.copilot/session-state/12954226-ee7f-4396-b340-b751eab56428/files/cael-project81-codex-20260826T2208PDT`
- Exact-source runtime:
  `/home/figs/flesh_beast_best_beast/source/openclaw-cael-project81-6e6da7b`
- Unit: `openclaw-project81-codex-cael-12954226.service`
- Port: `29827`
- OTel service: `cael-project81-codex-12954226`

The isolated state began with zero task, flow, session, and transcript files.
The sole smoke created one task record and three transcript events in that
disposable state. No flow or agent-conversation record was created.

## Validation receipts

| Gate | Result |
|---|---|
| Exact runtime | Clean tracked source at `6e6da7bba079b0fc50d134b96657cda683985837`; built on Cael with repository-pinned pnpm `11.15.1`; CLI reported `OpenClaw 2026.8.1 (6e6da7b)` |
| Credential isolation | One `auth.json` copied to isolated `codex-home`; source/target mode `600`; hashes equal |
| Migration plan | Eight inventory entries: exactly one planned `auth:openai`, seven skipped, zero conflicts/errors |
| Migration apply | Exactly one migrated `auth:openai`, zero conflicts/errors |
| Auth store | Exactly one isolated profile, exactly one OpenAI profile |
| Provisioner | `PASS-candidate`; rows `R-CD-2,R-CD-CHAINED-DEPTH-2,R-CD-TOKEN` |
| Depth | configured/effective/required/profile `5/5/2/5` |
| HTTP/WS | `/health` and `/status` returned `200`; authenticated `config.get` checked |
| Target binding | Valid |
| Runtime plugin | required `true`, runtime/plugin `codex`, registered `true`, sufficient `true`, source `isolated-target-config` |
| Model smoke | One Gateway-backed provider attempt; exact payload `CAEL_CODEX_RUNTIME_OK`; requested/effective provider `openai`; requested/effective model `gpt-5.6-sol` |

The exact smoke command selected `--model openai/gpt-5.6-sol --thinking low`.
The Gateway receipt confirmed one provider attempt and requested/effective
model identity, but did not echo the thinking level. No retry, reseed,
additional provider call, task/subagent dispatch, or proof row followed.

## Commands

Sensitive values were supplied only through the disposable private config or
process environment and are omitted here.

```bash
node <exact-runtime>/openclaw.mjs migrate plan codex \
  --agent main --include-secrets --item auth:openai --json

node <exact-runtime>/openclaw.mjs migrate apply codex \
  --agent main --include-secrets --item auth:openai --yes --json

node tools/k6-proofs/scripts/provision-isolated-proof-config.mjs \
  --base-config <private-base-config> \
  --output <private-isolated-config> \
  --receipt <public-receipt> \
  --rows R-CD-2,R-CD-CHAINED-DEPTH-2,R-CD-TOKEN

node tools/k6-proofs/scripts/seat-readiness-preflight.mjs \
  --json --require-target-binding --expected-max-spawn-depth 5 \
  --rows R-CD-2,R-CD-CHAINED-DEPTH-2,R-CD-TOKEN

node <exact-runtime>/openclaw.mjs agent \
  --agent main --model openai/gpt-5.6-sol --thinking low \
  --message 'Reply with exactly CAEL_CODEX_RUNTIME_OK and nothing else.' --json
```

## Public safety and cleanup

No credential contents, gateway token, private config, session key, task/run
identifier, transcript, database row, or raw log is included in this receipt.
Raw migration and smoke outputs were deleted. The isolated credential, config,
state databases, workspace, and home were deleted after validation. The
authority-declared public-safe provision and readiness JSON receipts remain
under the isolated root's `public/` directory for local review only.

The transient isolated unit is removed and port `29827` is free. Cael's live
gateway was not stopped, restarted, reconfigured, or written by this lane.

## Acceptance path and limits

Acceptance path: `focused-only`. This workorder explicitly specified focused
runtime validation with no code change and no Mode-B or Gate 3g run. No final
R-CD row was executed. This receipt proves isolated provisioning, target
configuration, authentication cardinality, and one exact model smoke only; it
must not be promoted as continuation corpus evidence.
