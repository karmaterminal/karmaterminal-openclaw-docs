# PR #129388 heartbeat relocation review

## Named-ref contract

| Category | Named ref | Full SHA | Identity receipt |
| --- | --- | --- | --- |
| Product/base | `karmaterminal/openclaw@c7131791a6d33ab83d1a820c7cdb81c1b1384931` | `c7131791a6d33ab83d1a820c7cdb81c1b1384931` | Local `HEAD`, the lane ref, its tracking ref, and the server commit object resolve to the same SHA. |
| Safe lane | `karmaterminal/openclaw:codeagent/129388-c713-heartbeat-review` | `c7131791a6d33ab83d1a820c7cdb81c1b1384931` | Published unchanged; local/tracking/server equality confirmed. |
| CI/workflow | N/A | N/A | This lane is expressly focused-only; it does not dispatch or credit a Mode-B run. |
| Presentation | `openclaw/openclaw#129388` via `karmaterminal/openclaw:codeagent/85651-upstream-1ba243c8-gates` | `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` | Local commit object, fetched tracking ref, and server branch resolve equally; presentation branch left untouched. |
| Docs/proof | External docs branch `41861059`, corpus anchored at `karmaterminal/openclaw@2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` | Local and GitHub server commit objects resolve equally. The external docs branch is not a Git tracking ref in this checkout. |
| Feature parent | `karmaterminal/openclaw@2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` | `2ffc7ca0615f5917acf809d1ccba82b0ef5b2d5a` | Local and GitHub server commit objects resolve equally. |
| Upstream parent | `openclaw/openclaw@df9b7a5fbe9b94b0ab25dc404db7784797feadca` | `df9b7a5fbe9b94b0ab25dc404db7784797feadca` | Local and GitHub server commit objects resolve equally. |

## Outcome

**APPROVE.** No blocking findings in the sole textual deletion/modify conflict. The result keeps the feature parent's extracted owner, ports the upstream cancellation decision before any reply classification or scratch mutation, and retains distinct preemption and cancellation outcomes through the caller.

Conflict/cancellation scope versus the feature parent:

- Production: `+14/-16` (net `-2`) across `heartbeat-runner-invoke.ts` and `heartbeat-runner-run.ts`.
- Tests: `+24/-14` (net `+10`) in `heartbeat-runner.tool-response.test.ts`.
- Repository files changed by this review: `0`.

## Exact evidence

- `src/infra/heartbeat-runner-invoke.ts:67-86`: `getReplyFromConfig` returns, then the shared agent-turn state is resolved immediately. `superseded` maps to `preempted`; `cancelled` maps to `cancelled`.
- `src/infra/heartbeat-runner-invoke.ts:88-116`: reply classification and scratch persistence occur only after that terminal-state return.
- `src/infra/heartbeat-runner-run.ts:39-76`: the private wrapper intercepts only dynamic supersession and otherwise returns the underlying result unchanged, so cancellation reaches the relocated owner. It contains no prompt, reply-classification, scratch, or delivery implementation.
- `src/infra/heartbeat-runner-run.ts:188-197`: non-completed results retain distinct downstream reasons: busy to `requests-in-flight`, preempted to `preempted`, cancelled to `agent-runner-cancelled`.
- `src/infra/heartbeat-runner-invoke.ts:134-137` and `src/infra/heartbeat-runner-delivery.ts:58-66`: `CompletedHeartbeatAgentRun` remains an `Extract<..., { kind: "completed" }>` and is the only shape accepted by delivery classification.
- `src/auto-reply/reply/agent-runner-execute.ts:488-499` and `src/auto-reply/reply/agent-runner-run.ts:636-645`: the reply-operation lifecycle records cancellation distinctly at both normal and error exits.
- `src/auto-reply/reply/reply-operation-agent-turn-state.ts:5-31`: the closed status contract carries `ok | failed | superseded | cancelled`, with live owner supersession taking precedence.
- `src/infra/heartbeat-wake.ts:43-52`: only preemption is retryable. Cancellation remains non-retryable while the original inspected work remains unconsumed.
- `src/infra/heartbeat-runner.tool-response.test.ts:339-376`: the paired boundary regression proves both outcomes suppress delivery and preserve system work, scratch, prior heartbeat state, and event reason; only supersession is retryable.
- The result's `heartbeat-runner-execution.ts` blob is byte-identical to the feature parent (`a4eea6220e63beca39912ae7aa6d313e61de066e`), preserving the deletion. Exactly one exported durable invoke owner exists, at `src/infra/heartbeat-runner-invoke.ts:40`; the similarly named function in `heartbeat-runner-run.ts` is a private interception wrapper.
- `heartbeat-runner.ts`, `heartbeat-runner-scheduler.ts`, `heartbeat-wake.ts`, and `heartbeat-wake-contracts.ts` are byte-identical between the feature parent and result. The delivery type import points to the relocated owner, and no conflict markers remain.
- Current upstream `main` at `b0526f7be7f15e302a3a4d72a97191ef8e515f82` still contains the upstream old-owner decision unchanged. The latest stable release, `v2026.7.1-2` at `0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c`, does not contain its introducing commit, so this is current/unshipped behavior rather than a shipped compatibility claim.

## Provenance and best-fix judgment

Upstream cancellation preservation came from openclaw/openclaw#122345, commit `fee6a756be30d5f6c2f4a462a49a2352479ee691` on 2026-08-25. Code author and PR author: @ooiuuii. Merger: @steipete. The exact relocation resolution is the merge commit under review, `c7131791a6d33ab83d1a820c7cdb81c1b1384931`. Presentation PR author: Gwydion Nanashi Ferrinas Solidor (@karmafeast, account created 2011-06-30).

**Best-fix verdict: best.** Keeping the old implementation in `heartbeat-runner-execution.ts` would undo the max-lines/ownership extraction; duplicating it would create two durable owners; collapsing cancellation into preemption would incorrectly enroll cancellation in retained-wake retry. The selected transposition preserves one canonical invoke implementation and the two distinct lifecycle policies.

**Code read:** `heartbeat-runner-execution.ts`, `heartbeat-runner-invoke.ts`, `heartbeat-runner-run.ts`, `heartbeat-runner-delivery.ts`, `heartbeat-runner.ts`, `heartbeat-runner-scheduler.ts`, `heartbeat-wake.ts`, `heartbeat-wake-contracts.ts`, the reply-operation state/producers, `get-reply.ts`, and both adjacent supersession/cancellation regressions.

**Remaining uncertainty:** none within the exact `c7131791` conflict. This verdict does not review the live presentation head `4737afdf7dcc5cca53f8dd1bdaaeaa122ce17bbd` or the rest of the 947-file PR. GitNexus could not index this worktree: the installed `karmaterminal/GitNexus` fork was v1.6.5 at `3c1e686edfc1acaac882927cada121ddd7c47bcc` (wrapper SHA-256 `8309aeb6858023f5cb3ff4ae8416b64c1989e4fe04d82dd822964127ed1355ca`), while the available OpenClaw index was stale at `fabc84d31ff67ac6c52a6761184ea67ef2644644`. The review therefore used the exact-ref Git/source fallback and did not substitute stock GitNexus.

## Focused proof

```text
node scripts/run-vitest.mjs run --config test/vitest/vitest.infra.config.ts --maxWorkers=1 src/infra/heartbeat-runner.tool-response.test.ts
```

Result: `1` file passed; `40/40` tests passed. Acceptance path: `focused-only`; no Mode-B or Gate 3g run was dispatched or credited.
