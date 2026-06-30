# R-CW-MULTI — Rune ROG Ally evidence

- Row: `R-CW-MULTI`
- Assembly/source ref under test: `78d31449a23f4bd356219e367fd2a94dfc477f7a`
- Source checkout: `/home/figs/.openclaw/workspace/proof-r-cw-multi-78d31449/openclaw`
- Docs checkout: `/home/figs/.openclaw/workspace/proof-r-cw-multi-78d31449/docs`
- Seat: `rune-rog-ally`
- Session: `agent:main:subagent:continuation-6344f02369161ea8db6cdd0c4b923f74`
- Marker: `RUNE_RCW_MULTI_78D31449_20260629`
- Capture window: 2026-06-29 19:26–19:28 PDT (2026-06-30 02:26–02:28Z)

## Claim

PASS for the typed-tool `R-CW-MULTI` behavior: three `continue_work()` tool elections made in one assistant turn produced three distinct continuation wake turns in the same chain.

This proof covers the typed tool path. It does **not** claim an additional bare-token/fallback-token subcase for this row.

## Same-turn elections

In one assistant turn, the session called `continue_work()` three times with the same row marker:

| Election | delaySeconds | traceparent span id | Reason marker |
| --- | ---: | --- | --- |
| A | `0` | `0000000000000a01` | `same-turn multi continue_work fan-out election A immediate/default` |
| B | `60` | `0000000000000b02` | `same-turn multi continue_work fan-out election B delayed 60s` |
| C | `120` | `0000000000000c03` | `same-turn multi continue_work fan-out election C delayed 120s` |

All three tool calls returned `status: scheduled`.

## Wake receipts

The runtime then delivered three distinct continuation wake turns with the same chain start (`2026-06-30T02:26:16.111Z`):

| Wake | Continuation turn | Received | Reason observed |
| --- | ---: | --- | --- |
| A | `1/200` | 2026-06-29 19:26 PDT | election A immediate/default |
| B | `2/200` | 2026-06-29 19:27 PDT | election B delayed 60s |
| C | `3/200` | 2026-06-29 19:28 PDT | election C delayed 120s |

See `live-receipts.md` for the per-wake receipt artifact captured during each wake.

## Source harness

The source repo was checked out detached at `78d31449a23f4bd356219e367fd2a94dfc477f7a`.

Passing focused harness:

```text
pnpm exec vitest run src/agents/command/attempt-execution.continue-work-opts.test.ts \
  -t "schedules every same-turn continue_work tool election with independent delays"
```

Result: PASS (`2 passed`, one matching test executed in each of the `agents-core` and `agents-support` projects). See `rcw-multi-attempt-execution-vitest.log`.

Two dispatch-only focused invocations were also preserved as honest negative artifacts:

- `rcw-multi-work-dispatch-targeted-fail.log`
- `rcw-multi-zero-delay-targeted-fail.log`

Those targeted tests did not deliver under this exact isolated invocation at `78d31449a2` because the dispatch helper treated parent-run-associated rows as not grantable in the narrow one-test filter. They are not used as PASS evidence. The PASS evidence is the capture-layer focused harness plus the live three-wake receipt sequence above.

## Verdict

PASS for `R-CW-MULTI` typed same-turn multi-`continue_work()` fan-out on assembly/source ref `78d31449a23f4bd356219e367fd2a94dfc477f7a`.
