# Resolved identities

| item | value |
|---|---|
| product / proof source / ship (presented) | `51ff02dc16d0b4ac08c0c1ea544f98a391faecad` (`karmaterminal/openclaw` `ronan/1547-forwardport-c6276079`; the server ref resolved to this SHA on 2026-11-17). It is the reviewed continuation slice, and the second parent of `eb1be03be5f959c84fc2c762de558c056b2c91c0` ("Merge reviewed continuation slice into owner-account assembly"). 🌊 and 🕯: "slice identity, not an ancestry-purity claim". |
| runtime that executed the rows (SUT) | `ab5a30ea79b776f149e24b1fccab9e79b0a5d299`, live on all six seats (committed 2026-11-17T10:30Z). On emeric, `dist/build-info.json` `commit` == `ab5a30ea…` (built 2026-11-15T10:42:53Z), checkout `HEAD` == `ab5a30ea…` with 0 tracked modifications, and 17 `packages/*/dist`. |
| ancestry | `51ff02dc` **is** a git ancestor of `ab5a30ea` (`git merge-base --is-ancestor`). |
| continuation-surface diff `51ff02dc → ab5a30ea` | `git diff --stat … -- src/auto-reply/continuation/ src/infra/continuation-tracer.ts src/gateway/ src/agents/`: 1 file, +1 −1, test-only (`src/agents/tools/continuation-tools-registration.test.ts`: the delay-text pin now expects "0 or omitted = dispatch after this response"). |
| whole diff `51ff02dc → ab5a30ea` | 61 files, +1349 −324 across 26 commits. Production files outside the canonical surface list but on the turn-ingress path: `src/auto-reply/reply/get-reply-run-execute.ts`, `get-reply-run-fast-mode.ts`, `queue/enqueue.ts`, `queue/delivery-context.ts`, `queue/followup-run-payload.types.ts`, `src/auto-reply/templating.ts`, `src/channels/{inbound-event/context.ts, message/ingress-queue-cap-drop.ts, message/ingress-retry-policy.ts, turn/types.ts}`, config schema (`zod-schema.messages.ts`, `zod-schema.agent-runtime.ts`, labels/help/tiers), plus `extensions/discord` (14), `extensions/slack` (4), `extensions/telegram` (3), `extensions/memory-core` (2). Theme: owner-account queue protection, room-event collect, ingress backpressure. Recorded as context; none of it is in the continuation surface. |
| execution identity bound into every run | `candidate_sha` = `runtime_sha` = `ab5a30ea…` (see `METHOD.md` § Binding). |
| docs / harness | `karmaterminal-openclaw-docs` main `9ba5518bdb079da3c3c75961fd8cd26be040eb1e` (the workflow's `github.sha`). |
| CI / workflow | `project81-k6-proof.yml` `workflow_dispatch` from `main` on the org runner `emeric` (labels `self-hosted, emeric`). |
| proof seat | 🕯 emeric (🕯 confirmed, Discord msg 1572214875294273550). |
| presentation ref | N/A. No presentation movement; `PROOFS/INDEX.json` is not repointed. |
| previous live corpora (provenance only, nothing carries) | `PROOFS/f15237ec…/` (F′, 2026-10-30, emeric isolated gateway, the last live-suite fire); `PROOFS/a22bd9c0…/` (j12′ packet, 2026-11-05, every live row missing); `PROOFS/3821eaef…/` (2026-09-20, the composite-carrier precedent on ronan). |
